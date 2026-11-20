// Task 67 · Settings: every data control in one page, reached from Profile (never from Home). Loads on its own (lazy, from
// AppNext.jsx). Three groups of rows: Your record (My courses, Usage log), Keep and share (Save on this device, a switch
// on this page with the dashboard's sentence; Backup and restore; Share a snapshot link; Export), Consent and deletion
// (Consents, Delete everything). Each row opens its sub-page at ?app=settings#<section> (Task 27's address rule; Back
// returns to the list). Every sub-page is the old interface's own component, unchanged and loaded when opened, so
// every consent, saving, backup and deletion sentence stays word for word: My courses is MyData.jsx (edit, delete one,
// undo once, re-review), Backup and restore is BackupSection.jsx, Share is CapabilitySnapshot.jsx, Consents is
// PermissionsSection.jsx and StatusSummary.jsx, Delete everything is DeleteSection.jsx with its list of what will go.
// Every action is the profile hook's (src/state/useKaminProfile.js) or src/utils/dataControl.js's; nothing is copied.
// Consents adds one thing the old page did not have: before a consent is withdrawn, what withdrawing it would remove,
// in dataControl's own summary sentences (withdrawConsent on the current profile, nothing applied).
import { Suspense, lazy, useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ClipboardCheck, Download, FileCheck2, FileText, LockKeyhole, RefreshCw, Share2, ShieldCheck, Trash2, UploadCloud } from 'lucide-react'
import { copy } from '../../i18n.js'
import { saveOffer } from '../../content/saveOfferCopy.js'
import { permissionsOn } from '../../utils/privacySections.js'
import { withdrawConsent } from '../../utils/dataControl.js'
import { replaceUrl } from '../../utils/useAppHistory.js'
import TechDetails from '../../components/TechDetails.jsx'
import { RecommendationReviewHistory } from '../../components/RecommendationReview.jsx'
import { VIEW_TEXT, settingsSectionFromHash } from '../views.js'
import { nextCopy } from '../copy.js'
import SettingsRow from '../components/SettingsRow.jsx'
import '../settings.css'

// The old interface's components, each loaded when its sub-page opens.
const MyData = lazy(() => import('../../components/MyData.jsx'))
const WhatChanged = lazy(() => import('../../components/WhatChanged.jsx'))
// The four privacy sections come through Privacy.jsx, which re-exports them, so they stay in the old privacy chunk.
const privacyPart = name => lazy(() => import('../../components/Privacy.jsx').then(m => ({ default: m[name] })))
const BackupSection = privacyPart('BackupSection')
const PermissionsSection = privacyPart('PermissionsSection')
const StatusSummary = privacyPart('StatusSummary')
const DeleteSection = privacyPart('DeleteSection')
const CapabilitySnapshot = lazy(() => import('../../components/CapabilitySnapshot.jsx'))

const ICONS = { courses: FileText, log: ClipboardCheck, save: LockKeyhole, backup: Download, share: Share2, export: FileCheck2, consents: ShieldCheck, delete: Trash2 }
// The rows in page order, by group ('save' is the switch on this page; the others open a sub-page).
export const SETTINGS_GROUPS = Object.freeze([['record', ['courses', 'log']], ['keep', ['save', 'backup', 'share', 'export']], ['control', ['consents', 'delete']]])
const L = lang => (lang === 'en' ? 'en' : 'ar')
// The usage log's time, as the old usage-log view writes it (src/App.jsx).
const timeText = (ts, lang) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts))

/** The one-line status of the rows that have one: the courses, the usage-log events, the consents that are on. */
export function rowStatus(state, lang) {
  const ws = nextCopy(lang).settings
  const { on, total } = permissionsOn(state?.consents)
  return {
    courses: state?.approved ? nextCopy(lang).profile.courses(state.courses?.length || 0).join('') : ws.noTranscript,
    log: ws.events((state?.audit || []).length).join(''),
    consents: copy[L(lang)].screens.privacy.onCount(on, total),
  }
}

/** The consents that are on and whose withdrawal goes through dataControl (the Permissions list's rule: the transcript
 *  analysis only once the record is approved). */
export const withdrawable = state => Object.keys(state?.consents || {}).filter(key => state.consents[key] && (key !== 'analyze' || state.approved))
/** What withdrawing one consent would remove, in dataControl's own summary sentences (computed, never applied). */
export const withdrawPreview = (state, key, lang) => withdrawConsent(state, key, { lang: L(lang) }).summary.sentences[L(lang)]

// One consent of "What does withdrawing remove?": closed, and computed only when opened.
function PreviewItem({ state, consent, lang }) {
  const [open, setOpen] = useState(false)
  return <details className="ui2-settings-preview-item" data-consent={consent} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{copy[L(lang)].app.consentItems[consent]}</summary>
    {open && <ul>{withdrawPreview(state, consent, lang).map((line, i) => <li key={i}>{line}</li>)}</ul>}
  </details>
}

function WithdrawPreview({ state, lang }) {
  const ws = nextCopy(lang).settings
  const id = useId()
  const keys = withdrawable(state)
  return <section className="ui2-settings-preview" aria-labelledby={id} data-testid="ui2-withdraw-preview">
    <h3 id={id}>{ws.previewTitle}</h3>
    {keys.length ? <><p>{ws.previewIntro}</p>{keys.map(key => <PreviewItem key={key} state={state} consent={key} lang={lang}/>)}</> : <p>{ws.previewNone}</p>}
  </section>
}

// "Save on this device": the status, the dashboard's sentence (src/content/saveOfferCopy.js) and one button.
function SaveRow({ lang, saved, onKeep, onStop }) {
  const ws = nextCopy(lang).settings
  const id = useId()
  const c = copy[L(lang)].app
  return <div className="ui2-settings-save" role="group" aria-labelledby={id} data-testid="ui2-settings-save">
    <p className="ui2-settings-save-head"><LockKeyhole size={18} aria-hidden="true"/><strong id={id}>{ws.rows.save}</strong>
      <span className="ui2-settings-row-status" data-testid="save-status" data-saved={saved ? 'true' : 'false'}>{saved ? c.savedOnDevice : c.sessionOnly}</span></p>
    {saved
      ? <p>{saveOffer('savedNote', lang)}</p>
      : <><p><strong>{saveOffer('question', lang)}</strong></p><p>{saveOffer('detail', lang)}</p></>}
    <button type="button" className={saved ? 'ui2-btn' : 'ui2-btn ui2-btn-primary'} onClick={saved ? onStop : onKeep}>{saved ? ws.stopSaving : saveOffer('keep', lang)}</button>
  </div>
}

// After "Delete everything": the old interface's confirmation (src/App.jsx), with the check of this device.
export function DeletedConfirmation({ deletion, lang }) {
  const d = copy[L(lang)].screens.start.deleted
  return <div className={deletion.clean ? 'deleted-confirmation' : 'deleted-confirmation incomplete'} data-testid="deleted-confirmation" role="status">
    <strong>{deletion.clean ? d.title : d.incompleteTitle}</strong>
    <p>{deletion.clean ? `${d.text} ${d.outside}` : d.incompleteText}</p>
    {deletion.studyKept && <p data-testid="study-kept">{nextCopy(lang).settings.studyKept}</p>}
    <TechDetails lang={lang}>{d.technical}</TechDetails>
  </div>
}

// `entry`: a section to open at once (Profile's "Correct a course" opens My courses); otherwise the address names it.
export default function Settings({ lang, profile, focusHeading, entry = null, onNavigate, onEdit, onReview, notify, messageOn = false, onChangeSeen }) {
  const ws = nextCopy(lang).settings
  const wp = nextCopy(lang).profile
  const c = copy[L(lang)]
  const id = useId()
  const { state, actions, status, derived } = profile
  const [section, setSection] = useState(() => entry || settingsSectionFromHash(globalThis.location?.hash))
  const [deletion, setDeletion] = useState(null)
  const heading = useRef(null)
  const title = useRef(null)
  const page = useRef(null)
  // The section this page added a history entry for (Back from it is the list), and the row to give focus back to.
  const pushedFor = useRef(null)
  const lastRow = useRef(null)
  const firstRender = useRef(true)
  useEffect(() => { if (focusHeading) (title.current || heading.current)?.focus() }, [focusHeading])
  // Back and Forward between the list and a section (the view stays Settings, so AppNext leaves it to this page).
  useEffect(() => {
    const onPop = () => setSection(settingsSectionFromHash(location.hash))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // A section opens at its title; back on the list, focus returns to the row that opened it.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const row = !section && lastRow.current && page.current?.querySelector(`.ui2-settings-row[data-section="${lastRow.current}"]`)
    ;(row || title.current || heading.current)?.focus()
    if (!row) window.scrollTo?.(0, 0)
  }, [section])

  const open = next => {
    lastRow.current = next
    history.pushState(history.state, '', `${location.pathname}${location.search}#${next}`)
    pushedFor.current = next
    setSection(next)
  }
  const close = () => {
    if (pushedFor.current === section) { history.back(); return }
    replaceUrl(location.pathname + location.search)
    setSection(null)
  }

  // Task 25: one message at a time. The summary of a change shows only while no notice is on screen; once shown here,
  // Profile does not show it again.
  const change = messageOn ? null : status.changeSummary
  const courseChange = section === 'courses' && ['recompute', 'delete-item'].includes(change?.type) ? change : null
  const consentChange = section === 'consents' && /^(withdraw-|grant$|delete-item$)/.test(change?.type || '') ? change : null
  useEffect(() => { if (courseChange) onChangeSeen?.(courseChange.ts) }, [courseChange?.ts]) // eslint-disable-line react-hooks/exhaustive-deps

  const keep = async () => { if (await actions.changePersistence(true)) notify(saveOffer('kept', lang)) }
  const stop = async () => { if (await actions.changePersistence(false)) notify(ws.savingOff) }
  // Restore: the hook replaces the profile (or throws, and the backup section says why); then Profile, as the old
  // interface opens its dashboard, with the old interface's message.
  const restore = async (file, passphrase) => { await actions.importProfile(file, passphrase); notify(ws.restored); onNavigate('profile') }
  const remove = async () => { const result = await actions.deleteAll(); if (result) setDeletion(result) }
  const statusOf = rowStatus(state, lang)
  const loading = <p role="status">{wp.loading}</p>
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft

  const sections = {
    courses: () => <>
      <p className="ui2-settings-actions">
        <button type="button" className="ui2-btn" onClick={() => onEdit('upload')}>{state.approved ? <><RefreshCw size={18} aria-hidden="true"/>{wp.update}</> : <><UploadCloud size={18} aria-hidden="true"/>{wp.upload}</>}</button>
      </p>
      {state.approved
        ? <div className="ui2-legacy ui2-settings-legacy"><Suspense fallback={loading}>
          <MyData key={status.myDataVersion} lang={lang} state={state} change={courseChange} canUndo={status.canUndo} onSave={actions.saveMyData} onUndo={actions.undoMyData}
            onApplyDelete={actions.applyDataControl} onEditInsight={() => onEdit('interests')} onFullReview={onReview} onConsents={() => open('consents')} onDeleteAll={() => open('delete')}/>
        </Suspense></div>
        : <p>{wp.noTranscript}</p>}
    </>,
    log: () => <>
      <p>{c.screens.myData.auditIntro}</p>
      <div className="ui2-legacy ui2-settings-legacy">
        <div className="panel audit-list" data-testid="ui2-usage-log">{state.audit?.length
          ? state.audit.map((entry, i) => <div className="audit-item" key={i}><ClipboardCheck aria-hidden="true"/><div><strong>{entry.label}</strong><small>{timeText(entry.ts, lang)}</small></div></div>)
          : <p>{ws.noEvents}</p>}</div>
        <RecommendationReviewHistory records={state.recommendationReviews || []} lang={lang}/>
      </div>
    </>,
    backup: () => <div className="ui2-legacy ui2-settings-legacy"><Suspense fallback={loading}>
      <BackupSection lang={lang} state={state} onExport={actions.exportProfile} onImport={restore}/>
    </Suspense></div>,
    share: () => <div className="ui2-legacy ui2-settings-legacy"><Suspense fallback={loading}>
      <CapabilitySnapshot key={JSON.stringify([state.approved, state.courses, state.goal])} lang={lang} skills={derived.skills} goal={state.consents?.insight ? state.goal : null}/>
    </Suspense></div>,
    export: () => <>
      <p>{ws.exportLine}</p>
      <p className="ui2-settings-actions"><button type="button" className="ui2-btn ui2-btn-primary" data-testid="export-clr" disabled={!state.approved && !state.projects?.length} onClick={actions.exportClr}>
        <Download size={18} aria-hidden="true"/>{c.screens.myData.exportFile}</button></p>
      <div className="ui2-legacy ui2-settings-legacy"><TechDetails lang={lang}>{c.screens.myData.technical.exportFile}</TechDetails></div>
    </>,
    consents: () => <>
      <p>{c.screens.myData.privacyIntro}</p>
      {consentChange && <div className="ui2-legacy ui2-settings-legacy"><Suspense fallback={null}><WhatChanged change={consentChange} lang={lang}/></Suspense></div>}
      <WithdrawPreview state={state} lang={lang}/>
      <div className="ui2-legacy ui2-settings-legacy"><Suspense fallback={loading}>
        <PermissionsSection lang={lang} state={state} setState={actions.setState} log={actions.log} onChangeSummary={actions.noteChange} onClearReviews={actions.clearRecommendationReviews}/>
        <StatusSummary lang={lang} state={state}/>
      </Suspense></div>
    </>,
    delete: () => <div className="ui2-legacy ui2-settings-legacy">
      {deletion ? <DeletedConfirmation deletion={deletion} lang={lang}/>
        : <Suspense fallback={loading}><DeleteSection lang={lang} state={state} onDelete={remove} startWithDeleteConfirm/></Suspense>}
    </div>,
  }

  // On a sub-page the page heading stays "Settings" (for screen readers; the old components' own headings are h3 and
  // follow the section's title, an h2) and "Back to Settings" says it on screen.
  return <section className="ui2-page ui2-settings" aria-labelledby={section ? `${id}-title` : 'ui2-page-title'} data-view="settings" data-section={section || undefined} data-testid="ui2-page" ref={page}>
    {section && <button type="button" className="ui2-text-btn ui2-settings-back" onClick={close}><Back size={16} aria-hidden="true"/>{ws.back}</button>}
    <h1 id="ui2-page-title" tabIndex={-1} ref={heading} className={section ? 'ui2-vh' : undefined}>{VIEW_TEXT.settings.title[lang]}</h1>
    {section ? <div className="ui2-settings-section" data-testid="ui2-settings-section">
      <h2 id={`${id}-title`} className="ui2-settings-title" tabIndex={-1} ref={title}>{ws.rows[section]}</h2>
      {sections[section]()}
    </div> : <>
      <p>{VIEW_TEXT.settings.line[lang]}</p>
      {SETTINGS_GROUPS.map(([group, rows]) => <section key={group} className="ui2-settings-group" aria-labelledby={`${id}-${group}`}>
        <h2 id={`${id}-${group}`}>{ws.groups[group]}</h2>
        <ul className="ui2-settings-list">{rows.map(row => <li key={row}>
          {row === 'save'
            ? <SaveRow lang={lang} saved={Boolean(state.localPersistence)} onKeep={keep} onStop={stop}/>
            : <SettingsRow icon={ICONS[row]} label={ws.rows[row]} status={statusOf[row]} section={row} onOpen={() => open(row)}/>}
        </li>)}</ul>
      </section>)}
    </>}
  </section>
}
