// Task 59: one profile engine for the old interface (src/App.jsx) and the new one (src/ui2, behind
// ?ui=next). Reading, saving, approving, recomputing, deleting and backups live here, moved unchanged
// from KaminApp. Actions return results or throw codes; they never choose a view, show a message or move
// focus: the interface decides where to go and what to say.
import { useEffect, useMemo, useRef, useState } from 'react'
import { copy } from '../i18n.js'
import { normalizeProjectEvidence } from '../utils/projectEvidence.js'
import { normalizeCredentialRecords } from '../credentials/records.js'
import { normalizeTaskProgress } from '../tasks/progress.js'
import { appendRecommendationReview } from '../review/recommendations.js'
import { canonicalCourseCode, reviewProfileQuality } from '../utils/profileQuality.js'
import { demoCourses, demoCollegeRaw } from '../data.js'
import { profileSkills, judgeOpportunities } from '../utils/engine.js'
import { mergeNeedsReview } from '../evidence/needsReview.js'
import { normalizeCollege, cleanTranscriptText } from '../catalog/colleges.js'
import { inferTranscriptSsces } from '../reference/ssce.js'
import { emptyInsightState } from '../insight.js'
import { chooseGoal as chooseGoalIn } from '../plan/plan.js'
import { buildMatchingProfile, matchTargets } from '../matching/engine.js'
import { projectStateToPerson360 } from '../ontology/projector.js'
import { clearLocalProfile, readLocalProfile, writeLocalProfile } from '../utils/localProfileStore.js'
import { errorCode } from '../utils/auditPrivacy.js'
import { STUDY_KEY, clearPilotLocalData, noteSyntheticTranscript, readStudy, trackPilotEvent } from '../utils/pilotAnalytics.js'
import { LEGACY_SESSION_KEY, LEGACY_STORAGE_KEY, STORAGE_KEY, blankState, getSaved, hasMeaningfulProfileState, hasSessionCopy, isMappedCourse, normalizeState } from './profileState.js'

const studentOf = s => ({collegeRaw:s.collegeRaw??null,major:s.major??null})

// onRestored(next): called once when the copy kept on this device replaces an empty session (the
// interface then picks the view and says so).
export function useKaminProfile({ lang, pilot = false, entry = 'default', onRestored } = {}) {
  const t = copy[lang]
  const [state,setState] = useState(getSaved)
  // The review screen's working copy: rows, the college and major the transcript printed, the consent box.
  const [draft,setDraft] = useState(entry==='sample'?demoCourses:[])
  const [draftCollege,setDraftCollege] = useState(entry==='sample'?'FCIT':state.college)
  // Task 55: the college and major the transcript printed, shown on the review screen and saved on approval.
  const [draftStudent,setDraftStudent] = useState(()=>entry==='sample'?{collegeRaw:demoCollegeRaw,major:null}:{collegeRaw:state.collegeRaw,major:state.major})
  const [reviewConsent,setReviewConsent] = useState(false)
  const [validation,setValidation] = useState(entry==='sample'?{recognized:demoCourses.length,rejected:[],usedOcr:false,mode:'demo'}:null)
  const [processing,setProcessing] = useState(false)
  const [progress,setProgress] = useState(0)
  // Task 21: what the reading is doing ('open' | 'read' | 'find').
  const [readingStage,setReadingStage] = useState(null)
  const [storageError,setStorageError] = useState('')
  const [changeSummary,setChangeSummary] = useState(null)
  // Task 05: one-step undo for "My data" edits and a key that resets the screen after save/undo.
  const [undoSnapshot,setUndoSnapshot] = useState(null)
  const [myDataVersion,setMyDataVersion] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state
  const onRestoredRef = useRef(onRestored)
  onRestoredRef.current = onRestored
  const initialSessionRef = useRef(hasSessionCopy())

  const skills = useMemo(()=>profileSkills(state),[state])
  const recs = useMemo(()=>judgeOpportunities(skills,state.goal,lang),[skills,state.goal,lang])
  const educationClassification = useMemo(()=>state.approved?inferTranscriptSsces(state.courses):{primary:null},[state])
  const personGraph = useMemo(()=>projectStateToPerson360({state,skills,educationClassification}),[state,skills,educationClassification])
  // Task 65: every chosen goal counts (the graph holds the main one).
  const matchProfile = useMemo(()=>buildMatchingProfile({graph:personGraph,goals:state.goals}),[personGraph,state.goals])
  const matches = useMemo(()=>matchTargets(matchProfile,{lang}),[matchProfile,lang])

  useEffect(()=>{
    if(initialSessionRef.current) return undefined
    let cancelled=false
    readLocalProfile().then(saved=>{
      if(cancelled || !saved?.localPersistence) return
      const next=normalizeState(saved)
      setState(next)
      if(entry!=='sample'){setDraft(next.courses||[]);setDraftCollege(next.college);setDraftStudent(studentOf(next))}
      trackPilotEvent('profile_returned_to')
      onRestoredRef.current?.(next)
    }).catch(()=>{if(!cancelled)setStorageError('read')})
    return()=>{cancelled=true}
  },[])
  // Task 58: saved steps whose item left the learning list are dropped once the profile is loaded (the
  // list is not in the startup bundle, so the check loads on demand, and only when there is something to check).
  useEffect(()=>{
    if(!state.plan.length&&!state.notForMe.length) return undefined
    let cancelled=false
    import('../plan/catalogCheck.js').then(({checkPlanItems})=>{if(!cancelled)setState(s=>checkPlanItems(s))}).catch(()=>{})
    return()=>{cancelled=true}
  },[state.plan,state.notForMe])
  useEffect(()=>{
    try{
      if(hasMeaningfulProfileState(state)) sessionStorage.setItem(STORAGE_KEY,JSON.stringify(state))
      else sessionStorage.removeItem(STORAGE_KEY)
    }catch{setStorageError('session')}
    if(state.localPersistence) void writeLocalProfile(state).catch(()=>setStorageError('device'))
  },[state])

  const log = (label) => setState(s=>({...s,audit:[{label,ts:Date.now()},...s.audit].slice(0,100)}))
  const showSynthetic = (courses, college='FCIT', collegeRaw=demoCollegeRaw) => {
    setDraft(courses)
    setDraftCollege(college) // the synthetic records are FCIT records
    setDraftStudent({collegeRaw,major:null})
    setValidation({recognized:courses.length,rejected:[],usedOcr:false,mode:'demo'})
    setChangeSummary({
      type:'upload',
      recognized:courses.length,
      mapped:courses.filter(course=>isMappedCourse(course.code)).length,
      rejected:0,
      ts:Date.now(),
    })
    setReviewConsent(false)
    log(lang==='ar'?'تحميل إيداع تجريبي توضيحي':'Synthetic demonstration deposit loaded')
  }
  // Task 18: in pilot mode the example button loads the trial's synthetic transcript (local fixture).
  // Resolves when the example is in the review draft.
  const loadExample = () => {
    if(!pilot){showSynthetic(demoCourses);return Promise.resolve()}
    return import('../pilot/syntheticTranscripts.js').then(({syntheticTranscript})=>{const record=syntheticTranscript();noteSyntheticTranscript(record.id);showSynthetic(record.courses,record.college,record.collegeRaw)})
  }
  const startManual = () => { setDraft([]); setDraftCollege(state.college); setDraftStudent(studentOf(state)); setValidation({recognized:0,rejected:[],usedOcr:false,mode:'manual'}); setChangeSummary(null); setReviewConsent(false) }
  const clearDraft = () => { setDraft([]); setReviewConsent(false) }
  // Task 21: each reading has a number: Cancel, or a newer file, makes an older reading stale, and a stale
  // result is never applied. Result: { ok: true } (rows in the draft), { stale: true },
  // { ok: false, scanned, document } (no course found; scanned = the file when it is a scanned PDF) or
  // { ok: false, code } (the reading failed).
  const uploadRunRef = useRef(0)
  const upload = async (file, { readPicture = false } = {}) => {
    const run = ++uploadRunRef.current
    const current = () => run===uploadRunRef.current
    trackPilotEvent('upload_started')
    setProcessing(true); setProgress(2); setReadingStage('open')
    try {
      const { extractTranscript } = await import('../utils/transcript.js')
      const result = await extractTranscript(file,(value,stage)=>{if(!current())return;setProgress(value);if(stage)setReadingStage(stage)},{readPicture})
      if(!current()) return { stale: true }
      log(t.screens.myData.auditUpload) // Task 46: never the file name (it often holds the student's name)
      // Task 51: a scanned PDF (no courses, no text layer) is not read by OCR on its own; the start screen says so and offers to.
      if(!result.courses.length) return { ok: false, scanned: result.validation?.scanned?file:null, document: result.validation?.document||null }
      setDraft(result.courses)
      // Task 55: the college comes from the transcript. Only when it prints none (a plain list of courses)
      // does the saved college stay; an unrecognised one is kept as printed, with the one-tap fix.
      const student=result.student||{}
      const printed=!!cleanTranscriptText(student.collegeRaw)
      setDraftCollege(printed?normalizeCollege(student.collegeId):state.college)
      setDraftStudent({collegeRaw:printed?cleanTranscriptText(student.collegeRaw):state.collegeRaw??null,major:cleanTranscriptText(student.majorRaw)??(printed?null:state.major??null)})
      setValidation(result.validation||null)
      setChangeSummary({
        type:'upload',
        recognized:result.courses.length,
        mapped:result.courses.filter(course=>isMappedCourse(course.code)).length,
        rejected:(result.validation?.rejected||[]).length,
        ts:Date.now(),
      })
      setReviewConsent(false)
      trackPilotEvent('upload_completed')
      return { ok: true }
    } catch (err) {
      if(!current()) return { stale: true }
      console.warn('KAMIN upload failed', errorCode(err))
      return { ok: false, code: err?.message }
    } finally { if(current()){ setProcessing(false); setProgress(0); setReadingStage(null) } }
  }
  // Cancel: stop waiting; the reading's late result is ignored.
  const cancelUpload = () => { uploadRunRef.current++; setProcessing(false); setProgress(0); setReadingStage(null) }
  // Task 04: every change to an approved record or college goes through recomputeProfile. The
  // module loads on demand (initial-bundle budget); the screen updates at once and the
  // "what changed" details follow when the diff is ready.
  const applyRecompute = (prev, next, college) => import('../evidence/recompute.js').then(({recomputeProfile,describeDiff,recomputeAuditLabel})=>{
    const result=recomputeProfile(prev,next)
    setChangeSummary({type:'recompute',diff:result.diff,sentences:{ar:describeDiff(result.diff,'ar'),en:describeDiff(result.diff,'en')},ts:Date.now()})
    setState(s=>({...s,needsReview:mergeNeedsReview(s.needsReview,result.diff.staleDerived,result.skills),audit:[{label:recomputeAuditLabel(result.diff,lang,college),ts:Date.now()},...s.audit].slice(0,100)}))
  })
  // Returns true when the draft was approved (consent given, no blocking row).
  const approve = () => {
    if (!reviewConsent || !reviewProfileQuality(draft).canApprove) return false
    const courses=draft.map(row=>({...row,code:canonicalCourseCode(row.code),source:row.source||'manual'}))
    const college=normalizeCollege(draftCollege)
    const collegeRaw=cleanTranscriptText(draftStudent.collegeRaw), major=cleanTranscriptText(draftStudent.major)
    const prev=state, next={...state,courses,college,collegeRaw,major,approved:true,consents:{...state.consents,analyze:true}}
    const reapproval=state.approved
    if(!reapproval) setChangeSummary({type:'approve',courses:draft.length,skills:profileSkills(next).length,college,ts:Date.now()})
    setState(s=>({...s,courses,college,collegeRaw,major,approved:true,consents:{...s.consents,analyze:true},audit:reapproval?s.audit:[{label:lang==='ar'?'منح موافقة تحليل السجل واعتماده':'Transcript analysis consent granted and record approved',ts:Date.now()},...s.audit].slice(0,100)}))
    setUndoSnapshot(null)
    // Task 55: a later upload with another college, or a fix on the review screen, recomputes and names it.
    if(reapproval) void applyRecompute(prev,next,prev.college!==college?college:undefined)
    trackPilotEvent('profile_completed')
    return true
  }
  // Task 05: "My data" saves go through the same recompute path and can be undone once.
  const saveMyData = ({courses,college,lines}) => {
    const prev=state, next={...state,courses,college:normalizeCollege(college)}
    const ts=Date.now()
    setUndoSnapshot({courses:state.courses,college:state.college})
    setState(s=>({...s,courses:next.courses,college:next.college,audit:[...(lines?.[lang]||[]).map(label=>({label,ts})).reverse(),...s.audit].slice(0,100)}))
    setDraftCollege(next.college); setMyDataVersion(v=>v+1)
    void applyRecompute(prev,next,prev.college!==next.college?next.college:undefined)
  }
  const undoMyData = () => {
    if(!undoSnapshot) return
    const prev=state, next={...state,...undoSnapshot}
    setUndoSnapshot(null)
    setState(s=>({...s,courses:undoSnapshot.courses,college:undoSnapshot.college,audit:[{label:lang==='ar'?'التراجع عن آخر تغيير في بياناتي':'Last change to my data undone',ts:Date.now()},...s.audit].slice(0,100)}))
    setDraftCollege(undoSnapshot.college); setMyDataVersion(v=>v+1)
    void applyRecompute(prev,next)
  }
  // The approved record back in the review draft (My data → "Review the whole record").
  const openFullReview = () => {setDraft(state.courses.map(row=>({...row})));setDraftCollege(state.college);setDraftStudent(studentOf(state));setReviewConsent(false);setValidation(null)}
  // The approved rows back in the review draft, college and major as they are in the draft (the network view's "Review").
  const reviewCourses = () => {setDraft(state.courses.map(row=>({...row})));setReviewConsent(false);setValidation(null)}
  const changeCollege = value => {
    const college=normalizeCollege(value)
    if(college===state.college) return
    const prev=state
    setDraftCollege(college)
    setState(s=>({...s,college}))
    void applyRecompute(prev,{...prev,college},college)
  }
  // Task 58: the old goal chips change the main goal (goals[0]); goal stays equal to it.
  const chooseGoal = goal => { setState(s=>chooseGoalIn(s,goal)); log(lang==='ar'?'تغيير الهدف':'Goal changed') }
  // Task 59: the capability-file builder loads when the student asks for the file (it was in the startup
  // bundle only because App.jsx imported it; moving the profile code into this hook would otherwise have
  // grown the startup bundle by about 1 KiB).
  const exportClr = () => import('../utils/clrExport.js').then(({buildClrExport,clrExportFilename})=>{
    const document=buildClrExport({state,skills,lang})
    const url=URL.createObjectURL(new Blob([JSON.stringify(document,null,2)],{type:'application/ld+json'}))
    const a=window.document.createElement('a');a.href=url;a.download=clrExportFilename();a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
    log(t.screens.myData.exportDone)
  }).catch(error=>{ console.warn('KAMIN export failed', errorCode(error)) })
  const saveCredential = record => setState(previous=>({...previous,credentials:normalizeCredentialRecords([record,...(previous.credentials||[])]),audit:[{label:lang==='ar'?`استيراد اعتماد: ${record.outcome==='verified'?'موثّق':record.outcome==='unresolved'?'غير محسوم':'غير موثّق'}`:`Credential imported: ${record.outcome}`,ts:Date.now()},...previous.audit].slice(0,100)}))
  // Task 06: every single-item deletion goes through dataControl.deleteItem (recompute, named
  // summary, count-only audit). Undo never brings deleted data back.
  const applyDataControl = result => { setState(result.state); setUndoSnapshot(null); setChangeSummary({type:result.summary.operation,sentences:result.summary.sentences,ts:Date.now()}) }
  const deleteOne = (kind,id) => import('../utils/dataControl.js').then(({deleteItem})=>{ try{ applyDataControl(deleteItem(stateRef.current,{kind,id},{lang})) }catch{} })
  const removeCredential = id => deleteOne('credential',id)
  const updateTasks = next => setState(previous=>({...previous,tasks:normalizeTaskProgress(next)}))
  const saveProject = record => setState(previous=>({...previous,projects:normalizeProjectEvidence([record,...(previous.projects||[])]),audit:[{label:t.screens.myData.auditProject,ts:Date.now()},...previous.audit].slice(0,100)}))
  const removeProject = id => deleteOne('project',id)
  const saveRecommendationReview = record => setState(previous=>({...previous,recommendationReviews:appendRecommendationReview(previous.recommendationReviews,record)}))
  const clearRecommendationReviews = () => setState(previous=>({...previous,recommendationReviews:[],audit:[{label:lang==='ar'?'حذف سجل مراجعات التوصيات':'Recommendation review history deleted',ts:Date.now()},...previous.audit].slice(0,100)}))
  // A summary written by a privacy screen (withdraw, grant, delete one); a withdrawal ends the undo.
  const noteChange = summary => { setChangeSummary(summary); if(/^withdraw-/.test(summary?.type||'')) setUndoSnapshot(null) }
  const exportProfile = async passphrase => {
    const portable = await import('../utils/portableProfile.js')
    const person360=projectStateToPerson360({state,skills,educationClassification})
    const payload=portable.buildPortableProfile({state,person360,appVersion:'1.0.0'})
    const envelope=await portable.encryptPortableProfile(payload,passphrase)
    const url=URL.createObjectURL(new Blob([JSON.stringify(envelope,null,2)],{type:'application/vnd.kamin.profile+json'}))
    const a=document.createElement('a')
    a.href=url
    a.download=`kamin-profile-${new Date().toISOString().slice(0,10)}.kamin`
    a.click()
    URL.revokeObjectURL(url)
    log(lang==='ar'?'إنشاء نسخة محلية مشفّرة':'Encrypted local backup created')
  }
  // Throws BACKUP_TOO_LARGE, INVALID_BACKUP_FILE or the decryption code; returns the restored state.
  const importProfile = async (file,passphrase) => {
    if (!file || file.size > 10*1024*1024) throw new Error('BACKUP_TOO_LARGE')
    let envelope
    try { envelope=JSON.parse(await file.text()) } catch { throw new Error('INVALID_BACKUP_FILE') }
    const { decryptPortableProfile, normalizePortableState } = await import('../utils/portableProfile.js')
    const payload=await decryptPortableProfile(envelope,passphrase)
    const restored=normalizePortableState(payload)
    const next={
      ...blankState,
      ...restored,
      consents:{...blankState.consents,...restored.consents,advisor:false,research:false},
      insight:{...emptyInsightState(),...(restored.insight||{}),responses:{...(restored.insight?.responses||{})}},
      audit:[{label:lang==='ar'?'استعادة نسخة محلية مشفّرة وإعادة الحساب':'Encrypted local backup restored and recomputed',ts:Date.now()},...(restored.audit||[])].slice(0,100),
    }
    setState(next)
    setDraft(next.courses)
    setDraftCollege(next.college)
    setDraftStudent(studentOf(next))
    setValidation(null)
    setReviewConsent(false)
    return next
  }
  // Returns true when the device copy was written (enabled) or deleted (disabled).
  const changePersistence = async enabled => {
    try{
      if(enabled){
        await writeLocalProfile({...state,localPersistence:true})
        setState(s=>({...s,localPersistence:true,audit:[{label:lang==='ar'?'حُفظ الملف على هذا الجهاز بموافقتك':'Profile saved on this device with consent',ts:Date.now()},...s.audit].slice(0,100)}))
      }else{
        await clearLocalProfile()
        setState(s=>({...s,localPersistence:false,audit:[{label:lang==='ar'?'إيقاف الحفظ الدائم وحذف النسخة المحلية':'Persistent saving disabled and local copy deleted',ts:Date.now()},...s.audit].slice(0,100)}))
      }
      setStorageError('')
      return true
    }catch{setStorageError(enabled?'device':'delete');return false}
  }
  // Returns the check that this device holds nothing ({ clean, ..., studyKept }), or null when it failed.
  const deleteAll = async () => {
    const studyKept=readStudy()!==null
    try{
      await clearLocalProfile()
      sessionStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(LEGACY_SESSION_KEY)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      // Task 18: a trial participant's anonymous study queue is separate research data. It stays until
      // they finish the session or withdraw from the study, and the confirmation says so.
      clearPilotLocalData({keepStudy:studyKept})
    }catch{setStorageError('delete');return null}
    setStorageError('')
    const { verifyDeviceCleared } = await import('../utils/dataControl.js')
    const deletion={...await verifyDeviceCleared({keep:studyKept?[STUDY_KEY]:[]}),studyKept}
    setChangeSummary(null)
    setState(normalizeState(blankState)); setUndoSnapshot(null); setDraft([]); setDraftCollege(null); setDraftStudent({collegeRaw:null,major:null}); setValidation(null); setReviewConsent(false)
    return deletion
  }

  return {
    state,
    derived: { skills, recs, matches, personGraph, matchProfile, educationClassification },
    draft: { rows: draft, setRows: setDraft, college: draftCollege, setCollege: setDraftCollege, student: draftStudent, consent: reviewConsent, setConsent: setReviewConsent, validation },
    status: { changeSummary, canUndo: !!undoSnapshot, myDataVersion, storageError, processing, progress, readingStage },
    actions: {
      setState, log, loadExample, startManual, clearDraft, upload, cancelUpload, approve, saveMyData, undoMyData,
      openFullReview, reviewCourses, changeCollege, chooseGoal, exportClr, saveCredential, applyDataControl, deleteOne,
      removeCredential, updateTasks, saveProject, removeProject, saveRecommendationReview, clearRecommendationReviews,
      noteChange, exportProfile, importProfile, changePersistence, deleteAll,
    },
  }
}
