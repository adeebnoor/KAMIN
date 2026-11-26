// Task 60 · the interface (src/ui2; Task 70: the only one). One lazy chunk: src/main.jsx loads it with
// import(), so the startup bundle does not carry it.
// A full page, not a window over the landing page: a slim top bar, three tabs (bottom bar on phones, side
// rail on desktop), the page, and sheets for details. The profile engine is the one the old interface uses
// (src/state/useKaminProfile.js, Task 59); the address follows Task 20's rule (?app=<view>).
// Task 62: Home (one sentence, one button) and step 1 (upload, confirm in one line, fix in a sheet; its own lazy
// chunk). Approving step 1 opens step 2. The synthetic example opens at ?start=sample only, and the trial layer
// (?pilot=1, Task 18) works here as in the old interface.
// Task 63: step 2, projects only (its own lazy chunk; saved and deleted say so in the one message, with Undo);
// Next and "Skip for now" open step 3.
// Task 64: step 3, interests as chips plus the student's own words (its own lazy chunk; the local engine loads only
// on Add); Next and "Skip for now" open step 4.
// Task 65: step 4, the next-steps feed with the goal chips, and My plan (each its own lazy chunk; the feed and the
// learning list load on demand). After step 4 the flow ends on My plan.
// Task 66: Profile (its own lazy chunk). Its Edit buttons open steps 1–4 in edit mode: the step chip is gone and the
// step's main button says "Back to Profile" (approving step 1 in edit mode comes back to Profile too). The "what
// changed" summary after an approval or a recompute shows once, at the top of Profile.
// Task 67: Settings (its own lazy chunk), reached from Profile only: every data control, each section a sub-page at
// ?app=settings#<section>. Profile's "Correct a course" opens its My courses section at once. A section's fragment never
// follows the student to another view.
// Task 68: Help (its own lazy chunk), reached from Profile and from the footer: the public pages in the interface's
// language and the reviewer tools, each tool a sub-page at ?app=help#<tool> (the same fragment rule). The footer
// (Footer.jsx) is on Home and Help only, never in the four steps.
// Task 69: this interface is the default (Task 70: the only one); the old interface's addresses and entry links open the
// nearest view here (views.js, translateOldAddress).
// Task 74: a shared snapshot link (#payload=…&key=…) opens here too. src/main.jsx reads it once and takes it out of the
// address; this page shows the old interface's reader (CapabilitySnapshot.jsx SnapshotReceiver, unchanged, loaded only
// then) in place of the view, and its "Close" button shows the view again. A link opened while the page is open
// (hashchange) is read the same way and replaces any snapshot on screen.
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useKaminProfile } from '../state/useKaminProfile.js'
import { hasMeaningfulProfileState } from '../state/profileState.js'
import { appParamInUrl, replaceUrl, useAppHistory } from '../utils/useAppHistory.js'
import { pilotModeOn, readStudy, trackPilotEvent } from '../utils/pilotAnalytics.js'
import { pageHref } from '../../public/site-content.js'
import { parseSnapshotFragment } from '../utils/snapshotLink.js'
import { HELP_SECTIONS, SETTINGS_SECTIONS, mainAction, nextViewToParam, paramToNextView, sectionFromHash, translateOldAddress, VIEW_TEXT } from './views.js'
import TopBar from './TopBar.jsx'
import NavTabs from './NavTabs.jsx'
import Notice, { useNotice } from './Notice.jsx'
import StorageAlert from './StorageAlert.jsx'
import Skeleton from './Skeleton.jsx'
import Footer from './Footer.jsx'
import Home from './screens/Home.jsx'
import Placeholder from './screens/Placeholder.jsx'
import './ui2.css'
// Task 61: dark values for the same tokens (System follows the device, or the saved Light/Dark choice).
import './theme.css'
// Task 75: the old interface's look on the new interface's parts, and dark mode for the old parts it reuses.
import './look.css'
import './legacy-dark.css'

// Task 62: step 1 loads on its own (the review's rows, the college fix and the reader's front end come with it).
const Upload = lazy(() => import('./screens/Upload.jsx'))
// Task 63: step 2 (projects) loads on its own too; the local suggestion engine loads only when asked.
const Projects = lazy(() => import('./screens/Projects.jsx'))
// Task 64: step 3 (interests) loads on its own; the free-text engine loads only when the student adds a sentence.
const Interests = lazy(() => import('./screens/Interests.jsx'))
// Task 65: step 4 (next steps) and My plan load on their own; the feed and the learning list load when one opens.
const NextSteps = lazy(() => import('./screens/NextSteps.jsx'))
const Plan = lazy(() => import('./screens/Plan.jsx'))
// Task 66: Profile loads on its own; the old components it reuses load only when the student opens them.
const Profile = lazy(() => import('./screens/Profile.jsx'))
// Task 67: Settings loads on its own; each section's old component loads when that section opens.
const Settings = lazy(() => import('./screens/Settings.jsx'))
// Task 68: Help loads on its own; each reviewer tool's old component loads when that tool opens.
const Help = lazy(() => import('./screens/Help.jsx'))
// Task 18's trial layer (consent, the session bar, the end-of-session form), loaded only in pilot mode.
const PilotStudy = lazy(() => import('../components/PilotStudy.jsx'))
// Task 74: the snapshot reader, loaded only for a shared snapshot link.
const SnapshotReceiver = lazy(() => import('../components/CapabilitySnapshot.jsx').then(m => ({ default: m.SnapshotReceiver })))

// The same language rule as the old interface: the address (/ar/, /en/, ?lang=), then the saved choice, then Arabic.
function firstLanguage() {
  let stored
  try { stored = localStorage.getItem('kamin-lang') } catch { /* blocked storage */ }
  return [location.pathname.match(/^\/(ar|en)(?:\/|$)/)?.[1], new URLSearchParams(location.search).get('lang'), stored].find(value => ['ar', 'en'].includes(value)) || 'ar'
}

// Task 62: ?start=sample opens step 1 with the synthetic example (tests, reviewers, the pilot); Home and Start never
// offer it. The entry link is read once and removed from the address (Task 20's rule), so a refresh does not
// repeat it. The answer is kept for the page's life, so a second render reads the same answer.
let sampleAsked = null
function takeSampleEntry() {
  if (sampleAsked !== null) return sampleAsked
  const url = new URL(location.href)
  sampleAsked = url.searchParams.get('start') === 'sample'
  if (sampleAsked) { url.searchParams.delete('start'); replaceUrl(url.pathname + url.search + url.hash) }
  return sampleAsked
}
// Task 69: an old interface's address (?app=mydata, ?app=privacy#backup, ?start=profile, ?view=knowledge) is written as
// the nearest new view and section before the first render, so the screens read their section from the address as usual.
let oldAddressRead = false
function takeOldAddress() {
  if (oldAddressRead) return
  oldAddressRead = true
  const href = translateOldAddress(location.href)
  if (href) replaceUrl(href)
}
const dropPilotFlag = () => { const url = new URL(location.href); if (url.searchParams.has('pilot')) { url.searchParams.delete('pilot'); replaceUrl(url.pathname + url.search + url.hash) } }

export default function AppNext({ incomingSnapshot = null }) {
  const [lang, setLang] = useState(firstLanguage)
  // Task 74: a shared snapshot (src/main.jsx already took it out of the address). `version` remounts the reader for a new one.
  const [snapshot, setSnapshot] = useState(() => (incomingSnapshot ? { packet: incomingSnapshot, version: 0 } : null))
  useEffect(() => {
    const receive = () => {
      const packet = parseSnapshotFragment(location.hash)
      if (!packet) return
      replaceUrl(location.pathname + location.search)
      setSnapshot(previous => ({ packet, version: (previous?.version || 0) + 1 }))
    }
    window.addEventListener('hashchange', receive)
    return () => window.removeEventListener('hashchange', receive)
  }, [])
  const [sample] = useState(takeSampleEntry)
  const [view, setView] = useState(() => { takeOldAddress(); return sample ? 'upload' : paramToNextView(appParamInUrl()) || 'home' })
  // Task 25's rule: one message at a time.
  const { notice, show, hide } = useNotice()
  // Task 18: pilot mode. The study record lives in localStorage (src/utils/pilotAnalytics.js); this keeps what the
  // trial layer shows (the consent until the participant joins, then the session bar and its dialogs).
  const [pilot, setPilot] = useState(() => (pilotModeOn() ? { study: readStudy(), panel: null } : null))
  const profile = useKaminProfile({
    lang,
    pilot: Boolean(pilot?.study),
    entry: sample ? 'sample' : 'default',
    onRestored: () => show(lang === 'ar' ? 'أعدنا ملفك المحفوظ محليًا على هذا الجهاز.' : 'Your locally saved profile was restored on this device.'),
  })
  const { state, actions, status } = profile
  const stateRef = useRef(state)
  stateRef.current = state
  useAppHistory({ view, setView, getState: () => stateRef.current, toParam: nextViewToParam, fromParam: paramToNextView })
  // The heading takes focus after the student moves, never on the first load.
  const [moved, setMoved] = useState(false)
  // Task 66: the step Profile's Edit opened (edit mode lasts while that step is open; any other move ends it).
  const [editing, setEditing] = useState(null)
  const navigate = (next, { edit = false } = {}) => { setEditing(edit ? next : null); if (next !== view) { setMoved(true); setView(next) } }
  // "Update transcript" opens step 1 empty (the approved record stays as it is until a new one is approved).
  const openEdit = step => { if (step === 'upload') actions.clearDraft(); navigate(step, { edit: true }) }
  // Task 67: My courses' "Re-review the whole record" opens step 1 with the approved rows, in edit mode.
  const openReview = () => { actions.openFullReview(); navigate('upload', { edit: true }) }
  // Task 67: a Settings section to open at once (Profile's "Correct a course"); written into the address below.
  const [settingsEntry, setSettingsEntry] = useState(null)
  const openSettings = section => { setSettingsEntry(section); navigate('settings') }
  // Task 68: a reviewer tool to open at once (the footer's links). A new object each time, so Help opens it even when
  // Help is already on screen.
  const [helpEntry, setHelpEntry] = useState(null)
  const openTool = tool => { setHelpEntry({ tool }); navigate('help') }
  // Task 66 (Task 25's rule): the "what changed" summary after an approval or a recompute shows once, at the top of
  // Profile, and never next to another message. "Got it" hides it; so does leaving Profile after it was on screen.
  const [seenChange, setSeenChange] = useState(null)
  const shownChange = useRef(null)
  const change = status.changeSummary
  const summary = ['approve', 'recompute'].includes(change?.type) && change.ts !== seenChange ? change : null
  useEffect(() => { if (view !== 'profile' && shownChange.current !== null) { setSeenChange(shownChange.current); shownChange.current = null } }, [view])
  // Task 67: the address keeps a Settings section (#backup) only while Settings is open. useAppHistory (above) has
  // already written this view's entry, so only the fragment of that entry changes here. Task 68: the same for Help's
  // reviewer tools (#knowledge, #pathways): a fragment that names another view's section is dropped.
  useEffect(() => {
    const pending = view === 'settings' ? settingsEntry : view === 'help' ? helpEntry?.tool : null
    const named = location.hash.replace(/^#/, '')
    if (pending) replaceUrl(`${location.pathname}${location.search}#${pending}`)
    else if ([...SETTINGS_SECTIONS, ...HELP_SECTIONS].includes(named) && !sectionFromHash(view, location.hash)) replaceUrl(location.pathname + location.search)
    // The entry was read when its screen opened; any later move forgets it.
    if (settingsEntry) setSettingsEntry(null)
    if (helpEntry) setHelpEntry(null)
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps
  // Back and Forward move focus to the new heading as well.
  useEffect(() => {
    const onPop = () => setMoved(true)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const ar = lang === 'ar'
    document.documentElement.lang = lang
    document.documentElement.dir = ar ? 'rtl' : 'ltr'
    const skip = document.querySelector('.skip-link')
    if (skip) skip.textContent = ar ? 'تجاوز إلى المحتوى' : 'Skip to content'
    try { localStorage.setItem('kamin-lang', lang) } catch { /* blocked storage */ }
    replaceUrl(pageHref(location.pathname + location.search + location.hash, lang))
  }, [lang])
  useEffect(() => { document.title = `${VIEW_TEXT[view].title[lang]} · ${lang === 'ar' ? 'كامن' : 'KAMIN'}` }, [view, lang])
  // Task 26: Back or Forward can land on an entry whose address has the other language; the screen keeps
  // the current language and only the language part of that address is rewritten (no new entry).
  const langRef = useRef(lang)
  langRef.current = lang
  useEffect(() => {
    const onPop = () => { const here = location.pathname + location.search + location.hash; const want = pageHref(here, langRef.current); if (want !== here) replaceUrl(want) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Task 18: in the trial the example is the trial's own synthetic transcript (the hook loads it in pilot mode):
  // right after the participant joins, and for ?start=sample during a session. It opens on step 1.
  useEffect(() => { trackPilotEvent('landing') }, [])
  const [trialPending, setTrialPending] = useState(() => sample && Boolean(pilot?.study))
  useEffect(() => {
    if (!trialPending || !pilot?.study) return
    setTrialPending(false)
    void actions.loadExample().then(() => { setMoved(true); setView('upload') })
  }, [trialPending, pilot?.study]) // eslint-disable-line react-hooks/exhaustive-deps
  const consentOpen = Boolean(pilot) && !pilot.study
  const pilotLayer = pilot && <Suspense fallback={null}><PilotStudy lang={lang} inApp study={pilot.study} panel={pilot.panel}
    setPanel={panel => setPilot(p => ({ ...p, panel }))}
    onJoin={study => { setPilot({ study, panel: null }); trackPilotEvent('landing'); setTrialPending(true) }}
    onDecline={() => { setPilot(null); dropPilotFlag() }}
    onChange={study => setPilot(p => ({ ...p, study }))}
    onLeft={message => { setPilot(null); dropPilotFlag(); if (message) show(message) }}/></Suspense>

  // Task 62: approving step 1 opens step 2. Nothing is approved without the consent tick (the hook checks it again).
  // Task 66: "Update transcript" on Profile opens step 1 in edit mode; approving it comes back to Profile.
  const approve = () => { const back = editing === 'upload' && view === 'upload'; if (actions.approve()) navigate(back ? 'profile' : 'projects') }
  const edit = editing === view
  const action = mainAction(state, hasMeaningfulProfileState(state))
  // Task 68: the footer is on Home and Help only; the four steps, My plan, Profile and Settings have none.
  const footed = view === 'home' || view === 'help'
  return <div className="ui2" data-ui="next">
    {/* The trial bar is the first row of the page, so it never covers the top bar or the tabs. While the trial's
        consent is open, the page behind it is inert. */}
    {pilotLayer}
    <div className="ui2-frame" inert={consentOpen}>
      <TopBar lang={lang} view={view} action={action} onNavigate={navigate} onLanguage={() => setLang(l => (l === 'ar' ? 'en' : 'ar'))}/>
      <div className="ui2-body">
        <NavTabs lang={lang} view={view} onNavigate={navigate}/>
        <div className={footed ? 'ui2-col ui2-footed' : 'ui2-col'}>
        <main id="main" className="ui2-main" tabIndex={-1}>
          <Notice notice={notice} onClose={hide} lang={lang}/>
          {/* Task 70: the old interface's storage alert; it stays until saving works again. */}
          <StorageAlert lang={lang} code={status.storageError} onBackup={() => openSettings('backup')}/>
          {/* Screens that load on their own (Tasks 62–68) show the skeleton while they load. */}
          <Suspense fallback={<Skeleton lang={lang}/>}>
            {snapshot ? <div className="ui2-legacy ui2-snapshot" data-testid="ui2-snapshot">
              <SnapshotReceiver key={snapshot.version} lang={lang} packet={snapshot.packet} onClose={() => setSnapshot(null)}/>
            </div>
              : view === 'home' ? <Home key="home" lang={lang} state={state} action={action} focusHeading={moved} onNavigate={navigate}/>
              : view === 'upload' ? <Upload key="upload" lang={lang} profile={profile} focusHeading={moved} onNavigate={navigate} onApprove={approve} editMode={edit}/>
              : view === 'projects' ? <Projects key="projects" lang={lang} profile={profile} focusHeading={moved} onNavigate={navigate} notify={show} editMode={edit}/>
              : view === 'interests' ? <Interests key="interests" lang={lang} profile={profile} focusHeading={moved} onNavigate={navigate} notify={show} editMode={edit}/>
              : view === 'next' ? <NextSteps key="next" lang={lang} profile={profile} focusHeading={moved} onNavigate={navigate} notify={show} editMode={edit} onReviewHistory={() => openSettings('log')}/>
              : view === 'plan' ? <Plan key="plan" lang={lang} profile={profile} focusHeading={moved} onNavigate={navigate} notify={show}/>
              : view === 'profile' ? <Profile key="profile" lang={lang} profile={profile} focusHeading={moved} onNavigate={navigate} onEdit={openEdit}
                change={notice ? null : summary} onChangeShown={ts => { shownChange.current = ts }} onDismissChange={() => { shownChange.current = null; setSeenChange(summary?.ts ?? null) }}
                onCourses={() => openSettings('courses')}/>
              : view === 'settings' ? <Settings key="settings" lang={lang} profile={profile} focusHeading={moved} entry={settingsEntry} onNavigate={navigate} onEdit={openEdit} onReview={openReview}
                notify={show} messageOn={Boolean(notice)} onChangeSeen={ts => setSeenChange(ts)}/>
              : view === 'help' ? <Help key="help" lang={lang} profile={profile} focusHeading={moved} entry={helpEntry} onNavigate={navigate}/>
              : <Placeholder key={view} view={view} lang={lang} focusHeading={moved} onNavigate={navigate}/>}
          </Suspense>
        </main>
        {footed && <Footer lang={lang} onNavigate={navigate} onTool={openTool}/>}
        </div>
      </div>
    </div>
  </div>
}
