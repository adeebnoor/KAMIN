import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { copy } from '../i18n.js'
import { profileSkills } from '../utils/engine.js'
import { initialOpen, permissionsOn, sectionFromHash, toggleOpen } from '../utils/privacySections.js'
import PrivacySection from './privacy/PrivacySection.jsx'
import StatusSummary from './privacy/StatusSummary.jsx'
import PermissionsSection from './privacy/PermissionsSection.jsx'
import BackupSection from './privacy/BackupSection.jsx'
import DeleteSection from './privacy/DeleteSection.jsx'

const CapabilitySnapshot = lazy(()=>import('./CapabilitySnapshot.jsx'))

const timeOf = (ts, lang) => new Date(ts).toLocaleTimeString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' })

// Privacy and data control: consents, withdrawal, encrypted backup and restore, deletion.
// Moved out of App.jsx (Task 05) and loaded lazily so the initial bundle stays within budget.
// Task 27: a status card, then five sections (src/components/privacy/), each a <details> with a status
// line. At most two are open. `request` ({ section, n }) opens a section from a link or shortcut
// (?app=privacy#backup); onSectionChange reports the section the student chose, for the address.
// Only order, headings and grouping changed: every consent and deletion sentence is as it was.
export default function Privacy({ lang, state, setState, log, onExport, onImport, onDelete, onPersistenceChange, onChangeSummary, onClearReviews, onExportClr, onSaveCredential, onRemoveCredential, startWithDeleteConfirm = false, request = null, onSectionChange, session = {}, onSession }) {
  const p = copy[lang].screens.privacy
  // The section to open first: Delete for the My data shortcut, then a shortcut's request, then the
  // address (a link, a refresh, or Back to this page; the address already names it while this renders).
  const firstTarget = startWithDeleteConfirm ? 'delete' : request?.section || sectionFromHash(location.hash)
  const [open,setOpen] = useState(()=>initialOpen({ target:firstTarget, approved:state.approved }))
  const openRef = useRef(open)
  openRef.current = open
  // The address names a section only after the student (or a link) chose one, not for the default.
  const chosen = useRef(!!firstTarget)
  const handled = useRef(request?.n)

  const scrollToSection = id => requestAnimationFrame(()=>document.getElementById(`privacy-${id}`)?.scrollIntoView({block:'start'}))
  // Opened from "Delete all my data" in My data: show the list of what will be deleted right away.
  // After App's scroll-to-top on view change (parent effects run after this one), bring the confirmation into view.
  // Opened for another section (a link or shortcut): bring that section into view the same way.
  useEffect(()=>{
    if(startWithDeleteConfirm){const id=requestAnimationFrame(()=>document.querySelector('[data-testid="delete-everything-confirm"]')?.scrollIntoView({block:'center'}));return()=>cancelAnimationFrame(id)}
    if(firstTarget){const id=scrollToSection(firstTarget);return()=>cancelAnimationFrame(id)}
  },[])
  // A shortcut while this page is already open (the save chip in the top bar).
  useEffect(()=>{
    if(!request?.section||request.n===handled.current)return
    handled.current=request.n
    chosen.current=true
    setOpen(list=>toggleOpen(list,request.section,true))
    onSectionChange?.(request.section)
    const id=scrollToSection(request.section)
    return()=>cancelAnimationFrame(id)
  },[request?.n])
  useEffect(()=>{onSectionChange?.(chosen.current?open.at(-1)??null:null)},[open])

  // The browser toggles a <details> itself; a toggle event also fires when React opens or closes one,
  // which then matches the state already, so only the student's own opening counts as a choice.
  const onToggle = (id, isOpen) => {
    if (isOpen && !openRef.current.includes(id)) chosen.current = true
    setOpen(list => toggleOpen(list, id, isOpen))
  }
  const section = id => ({ id, title: p.sections[id], open: open.includes(id), onToggle })
  const { on, total } = permissionsOn(state.consents)

  return <div className="privacy-layout">
    <StatusSummary lang={lang} state={state}/>
    <PrivacySection {...section('permissions')} status={p.onCount(on, total)}>
      <PermissionsSection lang={lang} state={state} setState={setState} log={log} onChangeSummary={onChangeSummary} onClearReviews={onClearReviews}/>
    </PrivacySection>
    <PrivacySection {...section('save')} status={state.localPersistence ? p.saveOn : p.saveOff}>
      <button className="button secondary" onClick={()=>onPersistenceChange(!state.localPersistence)}>{state.localPersistence?(lang==='ar'?'إيقاف الحفظ الدائم على هذا الجهاز':'Stop persistent saving on this device'):(lang==='ar'?'الاحتفاظ بملفي على هذا الجهاز':'Keep my profile on this device')}</button>
    </PrivacySection>
    <PrivacySection {...section('backup')} status={session.backupAt ? p.lastBackup(timeOf(session.backupAt, lang)) : null}>
      <BackupSection lang={lang} state={state} onExport={onExport} onImport={onImport} onExportClr={onExportClr} onSaveCredential={onSaveCredential} onRemoveCredential={onRemoveCredential} onBackupDone={backupAt=>onSession?.({backupAt})}/>
    </PrivacySection>
    <PrivacySection {...section('share')} status={session.linkCreated ? p.linkMade : p.noLink}>
      <Suspense fallback={<p role="status">{lang==='ar'?'جارٍ تحميل خيارات المشاركة…':'Loading sharing options…'}</p>}><CapabilitySnapshot key={JSON.stringify([state.approved,state.courses,state.goal])} lang={lang} skills={profileSkills(state)} goal={state.consents.insight?state.goal:null} onLinkCreated={()=>onSession?.({linkCreated:true})}/></Suspense>
    </PrivacySection>
    <PrivacySection {...section('delete')} status={p.deleteStatus}>
      <DeleteSection lang={lang} state={state} onDelete={onDelete} startWithDeleteConfirm={startWithDeleteConfirm}/>
    </PrivacySection>
  </div>
}

// Task 67: the new interface's Settings loads these sections through this module, so they stay in this lazy chunk
// (loading them on their own would split them out and lengthen the startup bundle's preload lists). No visible change.
export { StatusSummary, PermissionsSection, BackupSection, DeleteSection }
