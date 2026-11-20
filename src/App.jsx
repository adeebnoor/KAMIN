import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronDown, ClipboardCheck,
  Download, FileCheck2, Fingerprint, GraduationCap, Languages, LayoutDashboard,
  LockKeyhole, Menu, SearchCheck, ShieldCheck,
  UploadCloud, X, FolderGit2, Info } from 'lucide-react'
import { copy, fill } from './i18n.js'
import TechDetails from './components/TechDetails.jsx'
import {SiteHeader,SiteFooter} from './site/SiteChrome.jsx'
import {pageHref} from '../public/site-content.js'
import LandingExperience from './components/LandingExperience.jsx'
import DecisionStudio from './components/DecisionStudio.jsx'
import {RecommendationReviewHistory} from './components/RecommendationReview.jsx'
import ProjectEvidencePanel from './components/ProjectEvidence.jsx'
import { projectsForSkill } from './utils/projectEvidence.js'
import Dashboard from './components/Dashboard.jsx'
import Notice, { useNotice } from './components/Notice.jsx'
import StepBar from './components/StepBar.jsx'
import PathwayCompare from './components/PathwayCompare.jsx'
import { verifiedSkillIds } from './credentials/records.js'
const CredentialImport = lazy(()=>import('./components/CredentialImport.jsx'))
import StudentInsight from './components/StudentInsight.jsx'
import { skillProvenance } from './utils/provenance.js'
import { skills as skillsCatalog } from './data.js'
import { awaitingEvidence } from './utils/engine.js'
import AppNav, { SectionTabs, NeedsRecord } from './components/AppNav.jsx'
import StartScreen from './components/StartScreen.jsx'
import { pageName, paramToView, resolveView, sectionOf, topbarTitle, viewToParam } from './navigation.js'
import { appParamInUrl, consumeEntryParams, replaceUrl, urlWithApp, useAppHistory, usePageHistory } from './utils/useAppHistory.js'
import { sectionFromHash } from './utils/privacySections.js'
import { levelLabel, basisLabel, evidenceSentence } from './evidence/levels.js'
import { ssceReference } from './reference/ssce.js'
import { emptyDigitalInterests } from './digitalInterests.js'
import { trustMicrocopy } from './content/trustCopy.js'
import { saveOffer } from './content/saveOfferCopy.js'
import {parseSnapshotFragment} from './utils/capabilitySnapshot.js'
import { pilotModeOn, readStudy, trackPilotEvent } from './utils/pilotAnalytics.js'
// Task 59: the profile (state, saving, approve, recompute, delete, backups) lives in one hook shared with the new interface.
import { useKaminProfile } from './state/useKaminProfile.js'
import { hasMeaningfulProfileState } from './state/profileState.js'

const KnowledgeWorkspace = lazy(()=>import('./components/KnowledgeWorkspace.jsx'))
// Task 22: the review screen (and its summary card) loads when it opens; My data shares its course list.
const CourseReview = lazy(()=>import('./components/CourseReview.jsx'))
// Task 55: the document signals (upload error with a QR code) load only when shown.
const DocumentSignals = lazy(()=>import('./components/DocumentSignals.jsx'))
// Task 23: "My next step → Matches" as a short list (loads when the view opens).
const MatchList = lazy(()=>import('./components/MatchList.jsx'))
const WhatChanged = lazy(()=>import('./components/WhatChanged.jsx'))
const Privacy = lazy(()=>import('./components/Privacy.jsx'))
const MyData = lazy(()=>import('./components/MyData.jsx'))
const NeedsReview = lazy(()=>import('./components/NeedsReview.jsx'))
const CapabilitySnapshot = lazy(()=>import('./components/CapabilitySnapshot.jsx'))
// Task 19: the suggested learning path (planned feature) loads with the Courses tab.
// Task 24: My next step → Courses (cards, the learning path summary) loads when the tab opens.
const CourseCards = lazy(()=>import('./components/CourseCards.jsx'))
// Task 18: the trial layer loads only in pilot mode (?pilot=1).
const PilotStudy = lazy(()=>import('./components/PilotStudy.jsx'))
const SnapshotReceiver = lazy(()=>import('./components/CapabilitySnapshot.jsx').then(m=>({default:m.SnapshotReceiver})))

const timeText = (ts, lang) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts))

function setMeta(name, content, attr = 'name') {
  const el = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (el) el.setAttribute('content', content)
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true">ك</span>
}

function Logo({ lang = 'ar' }) {
  return <span className="logo">
    <img
      src="/kamin-logo-v3.webp"
      alt={lang === 'ar' ? 'شعار كامن' : 'Kamin logo'}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      width="259"
      height="430"
    />
  </span>
}

function Audit({ lang, entries }) {
  return <div className="panel audit-list">{entries.length ? entries.map((e,i)=><div className="audit-item" key={i}><ClipboardCheck/><div><strong>{e.label}</strong><small>{timeText(e.ts,lang)}</small></div></div>) : <p>{lang==='ar'?'لا توجد أحداث بعد.':'No events yet.'}</p>}</div>
}

function Compare({ lang, items, onChoose, onSuggest }) {
  const t = copy[lang].app
  if (!items.length) return <div className="empty-state"><SearchCheck/><h3>{lang==='ar'?'اختر حتى ثلاث دورات للمقارنة':'Choose up to three courses to compare'}</h3><p>{lang==='ar'?'ابدأ باقتراحين من قائمة الدورات الحالية، أو اختر الدورات بنفسك.':'Start with two suggestions from the current course list, or choose your own.'}</p><div className="compare-empty-actions"><button className="button primary" onClick={onChoose}>{lang==='ar'?'اختر الدورات':'Choose courses'}</button><button className="button secondary" onClick={onSuggest}>{lang==='ar'?'قارن اقتراحين':'Compare two suggestions'}</button></div></div>
  return <div className="compare-table-wrap">
    <table className="compare-table">
      <thead><tr><th>{lang==='ar'?'البعد':'Dimension'}</th>{items.map(item=><th key={item.id}>{item.title[lang]}</th>)}</tr></thead>
      <tbody>
        <tr><th>{lang==='ar'?'الحكم':'Judgment'}</th>{items.map(item=><td key={item.id}><span className={`status ${item.status}`}>{t.fit[item.status]}</span></td>)}</tr>

        <tr><th>{lang==='ar'?'الفجوة':'Gap'}</th>{items.map(item=><td key={item.id}>{item.gapType}</td>)}</tr>
        <tr><th>{lang==='ar'?'المدة':'Duration'}</th>{items.map(item=><td key={item.id}>{item.duration[lang]}</td>)}</tr>
        <tr><th>{lang==='ar'?'الكلفة':'Cost'}</th>{items.map(item=><td key={item.id}>{item.cost[lang]}</td>)}</tr>
        <tr><th>{t.becomes}</th>{items.map(item=><td key={item.id}>{item.becomes}</td>)}</tr>
      </tbody>
    </table>
  </div>
}

function KaminApp({ lang, setLang, onClose, entry = 'default', knowledgeSearch = '', pilot = false, pilotLayer = null }) {
  const t = copy[lang]
  // Task 59: the profile engine. Restoring the copy kept on this device is the hook's; which view opens and
  // what the student is told stay here.
  const restoredRef = useRef(null)
  const profile = useKaminProfile({ lang, pilot, entry, onRestored: next => restoredRef.current?.(next) })
  const { state, derived: { skills, recs, matches, personGraph, matchProfile, educationClassification }, actions } = profile
  const { setState, log } = actions
  const { rows: draft, setRows: setDraft, college: draftCollege, setCollege: setDraftCollege, student: draftStudent, consent: reviewConsent, setConsent: setReviewConsent, validation } = profile.draft
  const { changeSummary, canUndo, myDataVersion, storageError, processing, progress, readingStage } = profile.status
  const [view,setView] = useState(entry==='sample'?'review':entry!=='default'?paramToView(entry,state):state.approved?'dashboard':state.consents.insight?'insight':'start')
  // Task 21: the document signals of a file in which no course was found (shown with the error when the
  // file carries a verification link).
  const [uploadDocument,setUploadDocument] = useState(null)
  const [compareIds,setCompareIds] = useState([])
  // Task 23: pathways chosen for comparison ("Add to compare" on a Matches row). null = not chosen yet:
  // the Compare tab then shows the first two jobs, as before.
  const [pathwayIds,setPathwayIds] = useState(null)
  const togglePathway = id => setPathwayIds(ids => { const current = ids || []; return current.includes(id) ? current.filter(x => x !== id) : current.length >= 3 ? current : [...current, id] })
  // Task 25: one message at a time, in the page flow (src/components/Notice.jsx).
  const { notice, show: setNotice, hide: hideNotice } = useNotice()
  const [selectedMatch,setSelectedMatch] = useState(null)
  const [fileError,setFileError] = useState('')
  const [persistenceDismissed,setPersistenceDismissed] = useState(false)
  // Task 25: "Got it" on the dashboard's "What changed" is remembered for that change (its ts).
  const [dismissedChangeTs,setDismissedChangeTs] = useState(null)
  const [deleteRequested,setDeleteRequested] = useState(false)
  useEffect(()=>{if(view!=='privacy')setDeleteRequested(false)},[view])
  // Task 21: an upload error belongs to the start screen; leaving it clears the error. Task 51: for a
  // scanned PDF the error is { scanned: file } (in memory only), so "Try reading the picture" can read it.
  useEffect(()=>{if(view!=='start'){setFileError('');setUploadDocument(null)}},[view])
  // Task 21: the step bar shows on the dashboard the first time it opens after approval; once the student
  // leaves the dashboard, that approval's step bar is done.
  const [stepBarDoneTs,setStepBarDoneTs] = useState(null)
  const stepBarViewRef = useRef(view)
  useEffect(()=>{
    if(stepBarViewRef.current==='dashboard'&&view!=='dashboard'&&changeSummary?.type==='approve') setStepBarDoneTs(changeSummary.ts)
    stepBarViewRef.current=view
  },[view])
  // Task 06: result of "delete everything" (verified in code that this device holds nothing).
  const [deletion,setDeletion] = useState(null)
  const stateRef = useRef(state)
  stateRef.current = state
  // Task 20: the view is in the URL (?app=<view>); each view change adds one history entry.
  const appHistory = useAppHistory({ view, setView, getState: () => stateRef.current })
  // Task 27: a section of "Consent, saving & deletion" can be opened by a link (?app=privacy#backup) or a
  // shortcut. privacyRequest asks Privacy to open one (n counts the asks); privacyHash is the section the
  // student chose, kept in the address while the privacy view is open (replaced, never a new entry).
  // These effects run after useAppHistory's, so a new history entry gets its section afterwards.
  const [privacyRequest,setPrivacyRequest] = useState({ section: null, n: 0 })
  const [privacyHash,setPrivacyHash] = useState(()=>view==='privacy'?sectionFromHash(location.hash):null)
  // Known only in memory, never stored: a backup downloaded or a share link made in this session.
  const [privacySession,setPrivacySession] = useState({})
  const openPrivacy = section => { setPrivacyRequest(r=>({ section, n: r.n+1 })); setView('privacy') }
  useEffect(()=>{if(view!=='privacy'){setPrivacyRequest(r=>r.section?{ section: null, n: r.n }:r);setPrivacyHash(null)}},[view])
  useEffect(()=>{
    // Task 55: only while the address names this view. During Back or Forward the browser has already moved
    // to another entry before popstate updates the view; a late run here (under load) used to remove that
    // entry's section (Back to ?app=privacy#share then opened Permissions). popstate runs this again.
    const param=viewToParam(view)
    if(param&&appParamInUrl()!==param)return
    const current=sectionFromHash(location.hash), want=view==='privacy'?privacyHash:null
    if(current===want||(!want&&!current))return
    const url=new URL(location.href);url.hash=want||'';replaceUrl(url.pathname+url.search+url.hash)
  },[view,privacyHash])
  // A link, a refresh or Back onto a privacy address: Privacy reads the section from the address when it
  // opens. Closing the app leaves no section behind.
  useEffect(()=>()=>{if(sectionFromHash(location.hash))replaceUrl(location.pathname+location.search)},[])
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const nextDecision = useMemo(()=>{
    if(!state.approved || skills.length===0) return null
    return recs.find(item=>item.gapCode!=='repetition')||null
  },[state.approved,skills,recs])
  const compared = recs.filter(r=>compareIds.includes(r.id))

  // The copy kept on this device replaced an empty session: open its view and say so.
  restoredRef.current = next => {
    appHistory.replaceView(entry==='sample'?'review':entry!=='default'?paramToView(entry,next):next.approved?'dashboard':next.consents.insight?'insight':'start')
    setPersistenceDismissed(true)
    setNotice(lang==='ar'?'أعدنا ملفك المحفوظ محليًا على هذا الجهاز.':'Your locally saved profile was restored on this device.')
  }
  // The close button has focus when the window opens. Only then: onClose is a new function on every
  // App render (a language switch is one), and focus must stay on the control the student used (Task 26).
  useEffect(()=>{closeButtonRef.current?.focus()},[])
  useEffect(()=>{
    const dialog=dialogRef.current
    const onKey=(event)=>{
      if(event.key==='Escape'){ event.preventDefault(); onClose(); return }
      if(event.key!=='Tab' || !dialog) return
      const focusable=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length>0)
      if(!focusable.length) return
      const first=focusable[0], last=focusable[focusable.length-1]
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus()}
    }
    dialog?.addEventListener('keydown',onKey)
    return()=>dialog?.removeEventListener('keydown',onKey)
  },[onClose])
  // Task 18: in pilot mode the example is the trial's synthetic transcript (the hook loads it).
  const loadDemo = () => { void actions.loadExample().then(()=>{ setDeletion(null); setFileError(''); setView('review') }) }
  const startManual = () => { actions.startManual(); setFileError(''); setView('review') }
  // Task 21: a failed upload, or one with no course, stays on the start screen with the reason and three
  // ways forward; the review screen opens only when there is at least one row.
  const uploadErrorText = code => ({
    PDF_OPEN_FAILED:lang==='ar'?'تعذر فتح ملف PDF أو أنه تالف.':'The PDF could not be opened or is corrupt.',
    UNSUPPORTED_FILE_TYPE:lang==='ar'?'نوع الملف غير مدعوم. استخدم PDF أو صورة أو TXT.':'Unsupported file type. Use PDF, image, or TXT.',
    NO_FILE:lang==='ar'?'لم يتم اختيار ملف.':'No file was selected.',
  })[code]||(lang==='ar'?'حدث خطأ أثناء المعالجة المحلية. لم تُستخدم بيانات Demo.':'Local processing failed. Demo data were not used.')
  const failUpload = (message, document=null) => { setFileError(message); setUploadDocument(document); actions.clearDraft(); setView('start') }
  const upload = async (file) => {
    if (!file) return
    // Task 51: the very file just reported as a scanned PDF, sent again by "Try reading the picture": read the picture.
    const readPicture = file===fileError?.scanned
    setFileError(''); setUploadDocument(null)
    const result = await actions.upload(file,{readPicture})
    if(result.stale) return
    if(result.ok){ setView('review'); return }
    if('code' in result) failUpload(uploadErrorText(result.code))
    else failUpload(result.scanned?{scanned:result.scanned}:t.screens.start.noCourses, result.document)
  }
  // Cancel: stop waiting and stay on (or return to) the start screen; the reading's late result is ignored.
  const cancelUpload = () => { actions.cancelUpload(); setView('start') }
  // Task 25: no message after approval. The dashboard's one alert ("What changed", with the save offer
  // inside it) already says what happened and what to do next.
  const approve = () => { if(actions.approve()) setView('dashboard') }
  const openFullReview = () => { actions.openFullReview(); setView('review') }
  const { saveMyData, undoMyData, changeCollege, chooseGoal, exportClr, exportProfile, saveCredential, applyDataControl, removeCredential, updateTasks, saveProject, removeProject, saveRecommendationReview, clearRecommendationReviews } = actions
  const [focusTaskId,setFocusTaskId] = useState(null)
  const toggleCompare = id => setCompareIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):(ids.length<3?[...ids,id]:ids))
  const importProfile = async (file,passphrase) => {
    const next=await actions.importProfile(file,passphrase)
    setCompareIds([])
    setFileError('')
    setView(next.approved?'dashboard':next.consents.insight?'insight':next.recommendationReviews.length?'audit':'start')
    setNotice(lang==='ar'?'تمت استعادة ملفك محليًا. أُعيد حساب النتائج من الأدلة، ولم تُفعّل موافقات المشاركة الخارجية.':'Your profile was restored locally. Derived results were recomputed from evidence; external sharing consents remain off.')
  }
  const changePersistence = async enabled => {
    setPersistenceDismissed(true)
    if(!await actions.changePersistence(enabled)) return
    if(enabled) setNotice(saveOffer('kept',lang))
    else setNotice(lang==='ar'?'أُوقف الحفظ الدائم؛ بقيت الجلسة الحالية.':'Persistent saving is off; the current session remains.')
  }

  const deleteAll = async () => {
    const result=await actions.deleteAll()
    if(!result) return
    setDeletion(result)
    setCompareIds([]); setPersistenceDismissed(false); setView('start')
  }

  // Task 09: four sections; any older view id still resolves to its section and tab.
  const navigate=id=>setView(resolveView(id,state))
  // Each page opens at its top (the content area kept the previous page's scroll position).
  const contentRef = useRef(null)
  useEffect(()=>{if(view!=='skills')contentRef.current?.scrollTo?.(0,0)},[view])
  // Task 20: after a view change (not on the first open, where the close button keeps focus), read
  // out the page name and move focus to the page heading. Lazy views get their heading a moment
  // later, so wait for it; if focus moved elsewhere meanwhile (arrow keys keep it on the tabs), leave it.
  const [announcement,setAnnouncement]=useState('')
  const announcedViewRef=useRef(view)
  useEffect(()=>{
    if(announcedViewRef.current===view)return undefined
    announcedViewRef.current=view
    setAnnouncement(pageName(view,lang))
    const from=document.activeElement
    let frame=0,tries=0
    const focusHeading=()=>{
      const content=contentRef.current
      const heading=content?.querySelector('.app-content h2')||content?.querySelector('.app-content h3')
      if(!heading){if(++tries<120)frame=requestAnimationFrame(focusHeading);return}
      const active=document.activeElement
      if(active!==from&&active&&active!==document.body)return
      heading.setAttribute('tabindex','-1')
      heading.focus({preventScroll:true})
    }
    focusHeading()
    return()=>cancelAnimationFrame(frame)
  },[view])
  // The old "skills" page is now the lower half of "My capabilities".
  useEffect(()=>{if(view==='skills')requestAnimationFrame(()=>document.getElementById('my-skills')?.scrollIntoView({block:'start'}))},[view])


  return <div className="app-overlay" role="dialog" aria-modal="true" aria-label={t.app.title} ref={dialogRef}>
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand"><BrandMark/><div><strong>{t.name}</strong><small>{t.tagline}</small></div></div>
        <AppNav lang={lang} view={view} onNavigate={navigate}/>
        <button type="button" className="sidebar-tool-link" data-testid="open-knowledge" onClick={()=>setView('knowledge')}>{lang==='ar'?'مستكشف المعرفة — أداة للمراجعين':'Knowledge explorer — reviewer tool'}</button>
        <div className="sidebar-trust"><ShieldCheck/><span>{lang==='ar'?'المعالجة محلية في النسخة العامة':'Local processing in public release'}</span></div>
      </aside>
      <div className="app-main">
        {pilotLayer /* Task 18: the trial bar is the first row of the app, so it never covers the navigation */}
        {/* Task 26: where am I (section title), is my profile saved (chip → My data: consent, saving &
            deletion), switch language (same setLang as the site header; the app stays open on this view). */}
        <header className="app-topbar">
          <p className="app-topbar-title" data-testid="app-topbar-title">{topbarTitle(view,lang)}</p>
          <div className="app-topbar-actions">
            {hasMeaningfulProfileState(state)&&<button type="button" className={`save-chip ${state.localPersistence?'saved':'session'}`} data-testid="save-status" data-saved={state.localPersistence?'true':'false'} title={pageName('privacy',lang)} onClick={()=>openPrivacy('save')}>{state.localPersistence?<Check size={15} aria-hidden="true"/>:<Info size={15} aria-hidden="true"/>}<span>{state.localPersistence?t.app.savedOnDevice:t.app.sessionOnly}</span></button>}
            <button type="button" className="app-lang" data-testid="app-language" onClick={()=>setLang(lang==='ar'?'en':'ar')}><Languages size={16} aria-hidden="true"/><span lang={lang==='ar'?'en':'ar'}>{lang==='ar'?'English':'العربية'}</span></button>
            <button ref={closeButtonRef} className="icon-button" onClick={onClose} aria-label={lang==='ar'?'إغلاق':'Close'}><X/></button>
          </div>
        </header>
        <p className="sr-only" aria-live="polite" data-testid="view-announcement">{announcement}</p>
        <Notice notice={notice} onClose={hideNotice} lang={lang}/>
        {storageError&&<div className="storage-recovery" role="alert"><strong>{lang==='ar'?(storageError==='delete'?'تعذر إكمال حذف النسخة المحلية':'تعذر الوصول إلى التخزين أو حفظ آخر التغييرات'):(storageError==='delete'?'Could not finish deleting the local copy':'Storage is unavailable or recent changes could not be saved')}</strong><p>{lang==='ar'?'أبقِ الصفحة مفتوحة. راجع إعدادات المتصفح، وصدّر نسخة مشفّرة قبل المغادرة.':'Keep this page open. Check browser settings and export an encrypted backup before leaving.'}</p><button className="text-button" onClick={()=>openPrivacy('backup')}>{lang==='ar'?'افتح خيارات الحفظ والنسخ':'Open saving & backup options'}</button><a href={pageHref('guide.html#recovery',lang)} target="_blank" rel="noreferrer">{lang==='ar'?'خطوات حل المشكلة':'Recovery steps'}</a></div>}
        <div className="app-content-wrap" role="main" ref={contentRef}>
          <SectionTabs lang={lang} view={view} onNavigate={navigate}/>
          {view==='knowledge'&&<section className="app-content"><Suspense fallback={<p role="status" data-testid="view-loading">{lang==='ar'?'جارٍ فتح مستكشف المعرفة…':'Opening knowledge explorer…'}</p>}><KnowledgeWorkspace initialSearch={knowledgeSearch} lang={lang} personalGraph={personGraph} hasProfile={!!(state.approved||state.consents.insight)} onStudent={()=>navigate('insight')}/></Suspense></section>}
          {view==='start' && <section className="app-content onboarding">
            {deletion&&<div className={deletion.clean?'deleted-confirmation':'deleted-confirmation incomplete'} data-testid="deleted-confirmation" role="status"><strong>{deletion.clean?t.screens.start.deleted.title:t.screens.start.deleted.incompleteTitle}</strong><p>{deletion.clean?`${t.screens.start.deleted.text} ${t.screens.start.deleted.outside}`:t.screens.start.deleted.incompleteText}</p>{deletion.studyKept&&<p data-testid="study-kept">{lang==='ar'?'بقي ملف الدراسة المجهول فقط؛ يُحذف عند إنهاء الجلسة أو الانسحاب من الدراسة.':'Only the anonymous study file is kept; it is deleted when you finish the session or withdraw from the study.'}</p>}<TechDetails lang={lang}>{t.screens.start.deleted.technical}</TechDetails></div>}
            <StartScreen lang={lang} fileRef={fileRef} cameraRef={cameraRef} onFile={upload} onDemo={loadDemo} onManual={startManual} onInterests={()=>setView('insight')} onRestore={()=>openPrivacy('backup')} onSampleReport={()=>trackPilotEvent('sample_report_viewed')} processing={processing} progress={progress}
              steps={!state.approved} stage={readingStage} onCancel={cancelUpload} error={fileError} onRejectFile={()=>failUpload(uploadErrorText('UNSUPPORTED_FILE_TYPE'))}
              errorDetails={uploadDocument?.qr?.length?<Suspense fallback={null}><DocumentSignals lang={lang} document={uploadDocument}/></Suspense>:null}/>
          </section>}
          {view==='review' && <section className="app-content"><div className="app-title">{!state.approved&&<StepBar lang={lang} step={2}/>}<h2>{t.screens.review.title}</h2>{validation?.rejected?.length>0&&<p className="review-found" data-testid="review-found">{fill(t.screens.start.found,{n:validation.recognized??draft.length,m:validation.rejected.length})}</p>}<p>{t.screens.review.intro}</p></div><Suspense fallback={<p role="status" data-testid="view-loading">{lang==='ar'?'جارٍ التحميل…':'Loading…'}</p>}><CourseReview lang={lang} rows={draft} setRows={setDraft} onApprove={approve} consent={reviewConsent} setConsent={setReviewConsent} college={draftCollege} setCollege={setDraftCollege} student={draftStudent} validation={validation} change={changeSummary?.type==='upload'?changeSummary:null}/></Suspense></section>}
          {['dashboard','skills'].includes(view) && !state.approved && <section className="app-content"><NeedsRecord lang={lang} onAdd={()=>setView('start')}/></section>}
          {state.approved && ['dashboard','skills'].includes(view) && <section className="app-content dashboard">
            {changeSummary?.type==='approve'&&changeSummary.ts!==stepBarDoneTs&&<StepBar lang={lang} step={3}/>}
            <Dashboard lang={lang} state={state} skills={skills} matches={matches}
              change={['approve','recompute'].includes(changeSummary?.type)&&changeSummary.ts!==dismissedChangeTs?changeSummary:null} onDismissChange={()=>setDismissedChangeTs(changeSummary?.ts??null)}
              offerSave={!state.localPersistence&&!persistenceDismissed} onKeep={()=>changePersistence(true)} onNotNow={()=>setPersistenceDismissed(true)}
              expandAll={view==='skills'} onOpenMyData={()=>setView('mydata')} onUpload={()=>setView('start')} onCollege={changeCollege} onChooseGoal={chooseGoal} onOpenNext={()=>navigate('next')}
              projectsFor={id=>projectsForSkill(state.projects,id)} verifiedIds={verifiedSkillIds(state.credentials)}
              awaiting={awaitingEvidence(state.courses,{college:state.college})}
              projectPanel={<ProjectEvidencePanel compact lang={lang} projects={state.projects||[]} onSave={saveProject} onRemove={removeProject}/>}
              moreProps={{lang,state,matches,nextDecision,focusTaskId,onFocusTask:setFocusTaskId,onUpdateTasks:updateTasks,onGoal:()=>setView('insight'),onOpenNetwork:()=>setView('studio'),onExploreCourses:()=>setView('courses'),onSaveReview:saveRecommendationReview,classification:educationClassification}}/>
          </section>}
          {view==='studio' && <section className="app-content"><DecisionStudio onSaveReview={saveRecommendationReview} projects={state.projects||[]} onSaveProject={saveProject} onRemoveProject={removeProject} initialTarget={selectedMatch} lang={lang} matches={matches} state={state} graph={personGraph} onReview={()=>{if(!state.approved){setView('start');return}actions.reviewCourses();setView('review')}} onGoal={()=>setView('insight')}/></section>}
          {view==='insight' && <section className="app-content"><StudentInsight matches={matches} onInspect={id=>{setSelectedMatch(id);setView('studio')}} lang={lang} state={state} setState={setState} log={log} onGoal={chooseGoal} onExplore={()=>setView('studio')} onRecord={()=>setView('start')} onSave={()=>openPrivacy('save')}/></section>}
          {view==='matches' && <section className="app-content"><Suspense fallback={<p role="status" data-testid="view-loading">{lang==='ar'?'جارٍ التحميل…':'Loading…'}</p>}><MatchList state={state} onSaveReview={saveRecommendationReview} lang={lang} matches={matches} onChooseGoal={chooseGoal} onPlan={id=>{setSelectedMatch(id);setView('studio')}}
            compareIds={pathwayIds} onToggleCompare={state.approved?togglePathway:null} onOpenCompare={state.approved?()=>setView('compare'):null}/></Suspense></section>}
          {!state.approved && ['courses','compare','mydata'].includes(view) && <section className="app-content"><NeedsRecord lang={lang} onAdd={()=>setView('start')}/></section>}
          {state.approved && view==='courses' && <section className="app-content"><Suspense fallback={<p role="status" data-testid="view-loading">{lang==='ar'?'جارٍ التحميل…':'Loading…'}</p>}><CourseCards lang={lang} state={state} recs={recs} skills={skills} compareIds={compareIds} onToggleCompare={toggleCompare} onOpenCompare={()=>setView('compare')} onChooseGoal={chooseGoal} onSaveReview={saveRecommendationReview}/></Suspense></section>}
          {state.approved && view==='compare' && <section className="app-content"><div className="app-title"><small>{t.app.compare}</small><h2>{lang==='ar'?'نفس الأبعاد. قرار أسهل.':'Same dimensions. Easier decision.'}</h2></div>
            <PathwayCompare lang={lang} matches={matches} profile={matchProfile} selected={pathwayIds} onChange={setPathwayIds} title={t.screens.matches.comparePathways}/>
            <section className="compare-courses" aria-labelledby="compare-courses-title"><h3 id="compare-courses-title">{t.screens.matches.compareCourses}</h3><p>{lang==='ar'?'اختر حتى ثلاث دورات من صفحة الدورات.':'Choose up to three courses from the courses page.'}</p><Compare lang={lang} items={compared} onChoose={()=>setView('courses')} onSuggest={()=>setCompareIds(recs.slice(0,2).map(item=>item.id))}/></section></section>}
          {state.approved && view==='mydata' && <section className="app-content"><Suspense fallback={<p role="status" data-testid="view-loading">{lang==='ar'?'جارٍ التحميل…':'Loading…'}</p>}><MyData key={myDataVersion} lang={lang} state={state} change={['recompute','delete-item'].includes(changeSummary?.type)?changeSummary:null} onApplyDelete={applyDataControl} canUndo={canUndo} onSave={saveMyData} onUndo={undoMyData} onEditInsight={()=>setView('insight')} onFullReview={openFullReview} onConsents={()=>openPrivacy('permissions')} onDeleteAll={()=>{setDeleteRequested(true);setView('privacy')}}/></Suspense></section>}
          {view==='privacy' && <section className="app-content"><div className="app-title"><small>{t.app.privacy}</small><h2>{t.screens.myData.privacyTitle}</h2><p>{t.screens.myData.privacyIntro}</p></div><><Suspense fallback={null}><WhatChanged change={/^(withdraw-|grant$|delete-item$)/.test(changeSummary?.type||'')?changeSummary:null} lang={lang}/></Suspense><Suspense fallback={<p role="status" data-testid="view-loading">{lang==='ar'?'جارٍ التحميل…':'Loading…'}</p>}><Privacy key={deleteRequested?'delete':'privacy'} startWithDeleteConfirm={deleteRequested} lang={lang} state={state} setState={setState} log={log} onExport={exportProfile} onImport={importProfile} onDelete={deleteAll} onPersistenceChange={changePersistence} onChangeSummary={actions.noteChange} onClearReviews={clearRecommendationReviews} onExportClr={exportClr} onSaveCredential={saveCredential} onRemoveCredential={removeCredential} request={privacyRequest} onSectionChange={setPrivacyHash} session={privacySession} onSession={patch=>setPrivacySession(s=>({...s,...patch}))}/></Suspense></></section>}
          {view==='audit' && <section className="app-content"><div className="app-title"><small>{t.app.audit}</small><h2>{t.screens.myData.auditTitle}</h2><p>{t.screens.myData.auditIntro}</p></div><Audit lang={lang} entries={state.audit}/><RecommendationReviewHistory records={state.recommendationReviews} lang={lang}/></section>}
          {sectionOf(view)==='my-data' && <div className="section-footer-link"><button type="button" className="text-button" data-testid="open-knowledge-data" onClick={()=>setView('knowledge')}>{lang==='ar'?'مستكشف المعرفة — أداة للمراجعين':'Knowledge explorer — reviewer tool'}</button></div>}
        </div>
        <AppNav lang={lang} view={view} onNavigate={navigate} variant="bottom"/>
      </div>
    </div>
  </div>
}

class AppErrorBoundary extends Component {
  constructor(props){super(props);this.state={failed:false}}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(error,info){console.error('Kamin UI error boundary',error,info)}
  render(){
    if(!this.state.failed) return this.props.children
    return <div className="app-overlay" role="alertdialog" aria-modal="true"><div className="error-boundary-card"><ShieldCheck/><h2>{this.props.lang==='ar'?'تعذر إكمال هذه الشاشة بأمان':'This screen could not complete safely'}</h2><p>{this.props.lang==='ar'?'بياناتك لم تُرسل إلى خادم. أغلق التجربة وحاول مرة أخرى أو استخدم الإدخال اليدوي.':'Your data were not sent to a server. Close the app and try again or use manual entry.'}</p><button className="button primary" onClick={this.props.onClose}>{this.props.lang==='ar'?'إغلاق التطبيق':'Close app'}</button></div></div>
  }
}

export default function App({incomingSnapshot=null}) {
  const [sharedPacket,setSharedPacket]=useState(incomingSnapshot)
  const [snapshotVersion,setSnapshotVersion]=useState(0)
  const [lang,setLang] = useState(()=>{let stored;try{stored=localStorage.getItem('kamin-lang')}catch{};return [location.pathname.match(/^\/(ar|en)(?:\/|$)/)?.[1],new URLSearchParams(location.search).get('lang'),stored].find(value=>['ar','en'].includes(value))||'ar'})
  const [appOpen,setAppOpen] = useState(false)
  const appTriggerRef=useRef(null)
  const [appEntry,setAppEntry]=useState('default')
  const [knowledgeSearch,setKnowledgeSearch]=useState('')
  const openApp=(entry='default')=>{setSharedPacket(null);appTriggerRef.current=document.activeElement;setAppEntry(typeof entry==='string'?entry:'default');setAppOpen(true)}
  const openKnowledge=(search='')=>{setKnowledgeSearch(typeof search==='string'?search:'');openApp('knowledge')}
  const finishClose=()=>{setAppOpen(false);requestAnimationFrame(()=>appTriggerRef.current?.focus?.())}
  // Task 20: Back from the first view closes the window; X and Escape leave no app entry behind.
  const closeApp=usePageHistory({appOpen,openApp,finishClose})
  const t = copy[lang]
  // Task 18: pilot mode. The study record lives in localStorage (src/utils/pilotAnalytics.js); this keeps
  // the session bar and its dialogs in one place whether the app window is open or not.
  const [pilot,setPilot]=useState(()=>pilotModeOn()?{study:readStudy(),panel:null}:null)
  const [pilotNotice,setPilotNotice]=useState('')
  const dropPilotFlag=()=>{const url=new URL(location.href);if(url.searchParams.has('pilot')){url.searchParams.delete('pilot');replaceUrl(url.pathname+url.search+url.hash)}}
  const pilotLayer=inApp=>pilot&&<Suspense fallback={null}><PilotStudy lang={lang} inApp={inApp} study={pilot.study} panel={pilot.panel}
    setPanel={panel=>setPilot(p=>({...p,panel}))}
    onJoin={study=>{setPilot({study,panel:null});trackPilotEvent('landing');openApp('default')}}
    onDecline={()=>{setPilot(null);dropPilotFlag()}}
    onChange={study=>setPilot(p=>({...p,study}))}
    onLeft={message=>{setPilot(null);dropPilotFlag();setPilotNotice(message||'')}}/></Suspense>
  // Entry links: start=sample, start=profile and view=knowledge are read once and removed (Task 20);
  // ?app=<view> (a link or a refresh) opens the app on that view.
  useEffect(()=>{if(incomingSnapshot)return;trackPilotEvent('landing');const entry=consumeEntryParams();const linked=appParamInUrl();if(entry==='knowledge')openKnowledge();else if(entry)openApp(entry);else if(linked)openApp(linked)},[])
  useEffect(()=>{
    // A second shared link can arrive through same-document navigation.
    // Consume it immediately and remount the receiver so an old decrypted
    // snapshot or pending decryption cannot appear under the new link.
    const receive=()=>{
      const packet=parseSnapshotFragment(location.hash)
      if(!packet)return
      history.replaceState(null,'',urlWithApp(null,{keepHash:false}))
      setAppOpen(false);setSharedPacket(packet);setSnapshotVersion(version=>version+1)
    }
    window.addEventListener('hashchange',receive)
    return()=>window.removeEventListener('hashchange',receive)
  },[])
  useEffect(()=>{
    const ar = lang === 'ar'
    const title = ar ? 'كامن | اهتماماتك وقدراتك في شبكة واحدة' : 'Kamin | Your interests and capabilities, connected'
    const description = ar
      ? 'كامن يربط اهتماماتك وأهدافك وتفضيلاتك وأدلتك الأكاديمية في ملف تملكه، ويساعدك على فهم مساراتك وخطوتك القادمة.'
      : 'Kamin connects your interests, goals, preferences and academic evidence in a profile you control, helping you understand your pathways and next steps.'
    const origin = window.location.origin
    const publicOrigin = ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? 'https://kamin-12mf.onrender.com'
      : origin
    document.documentElement.lang=lang
    document.documentElement.dir=ar?'rtl':'ltr'
    document.title=title
    const skip=document.querySelector('.skip-link');if(skip)skip.textContent=ar?'تجاوز إلى المحتوى':'Skip to content'
    setMeta('description', description)
    setMeta('og:title', title, 'property')
    setMeta('og:description', description, 'property')
    setMeta('og:locale', ar ? 'ar_SA' : 'en_US', 'property')
    setMeta('twitter:title', title)
    setMeta('twitter:description', description)
    setMeta('og:image', publicOrigin + '/og-kamin-' + lang + '.jpg', 'property')
    setMeta('twitter:image', publicOrigin + '/og-kamin-' + lang + '.jpg')
    const canonical = document.head.querySelector('link[rel="canonical"]')
    if (canonical) canonical.setAttribute('href', publicOrigin + '/' + lang + '/')
    const ld = document.getElementById('kamin-ld')
    if (ld) ld.textContent = JSON.stringify({
      '@context':'https://schema.org',
      '@type':'SoftwareApplication',
      name: ar ? 'كامن' : 'Kamin',
      alternateName: ar ? 'Kamin' : 'كامن',
      applicationCategory:'EducationalApplication',
      operatingSystem:'Web',
      url: publicOrigin + '/',
      description,
      inLanguage: ar ? 'ar-SA' : 'en',
      offers:{'@type':'Offer',price:'0',priceCurrency:'SAR'},
      privacyPolicy: publicOrigin + pageHref('privacy.html',lang)
    })
    try{localStorage.setItem('kamin-lang',lang)}catch{}
    const url=new URL(window.location.href)
    replaceUrl(pageHref(url.pathname+url.search+url.hash,lang))
  },[lang])
  // Task 26: the language can change inside the app, so Back or Forward can land on an entry whose
  // address still has the other language (/ar/ vs /en/). The screen keeps the current language;
  // only the language part of that address is rewritten (no new entry, ?app and the depth stay).
  const langRef=useRef(lang)
  langRef.current=lang
  useEffect(()=>{
    const onPop=()=>{const here=location.pathname+location.search+location.hash;const want=pageHref(here,langRef.current);if(want!==here)replaceUrl(want)}
    window.addEventListener('popstate',onPop)
    return()=>window.removeEventListener('popstate',onPop)
  },[])
  useEffect(()=>{ document.body.style.overflow=appOpen?'hidden':''; return()=>{document.body.style.overflow=''} },[appOpen])
  return <>
    <div inert={appOpen||(pilot&&!pilot.study)} aria-hidden={appOpen||(pilot&&!pilot.study)?true:undefined}>
    <SiteHeader lang={lang} setLang={setLang} onTry={()=>openApp('insight')} onKnowledge={openKnowledge}/>
    <main id="main">{sharedPacket?<Suspense fallback={<p role="status">{lang==='ar'?'جارٍ تحميل قارئ اللقطة…':'Loading snapshot reader…'}</p>}><SnapshotReceiver key={snapshotVersion} lang={lang} packet={sharedPacket} onClose={()=>setSharedPacket(null)}/></Suspense>:<LandingExperience lang={lang} onTry={()=>openApp()} onProfile={()=>openApp('insight')} onSample={()=>openApp('sample')} onKnowledge={openKnowledge}/>}</main>
    <SiteFooter lang={lang}/>
    </div>
    {appOpen&&<AppErrorBoundary lang={lang} onClose={closeApp}><KaminApp lang={lang} setLang={setLang} onClose={closeApp} entry={appEntry} knowledgeSearch={knowledgeSearch} pilot={Boolean(pilot?.study)} pilotLayer={pilotLayer(true)}/></AppErrorBoundary>}
    {!appOpen&&pilotLayer(false)}
    {pilotNotice&&<div className="pilot-notice" role="status" data-testid="pilot-notice"><span>{pilotNotice}</span><button type="button" className="button secondary" onClick={()=>setPilotNotice('')}>{lang==='ar'?'إغلاق':'Close'}</button></div>}
  </>
}
