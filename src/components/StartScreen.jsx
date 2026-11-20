import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, FileText, Fingerprint, LockKeyhole, Plus, RefreshCw, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react'
import { pageHref } from '../../public/site-content.js'
import { copy } from '../i18n.js'
import StepBar from './StepBar.jsx'
import { TRANSCRIPT_ACCEPT, acceptsTranscriptFile } from '../utils/transcriptAccept.js'

// Task 10 · a start screen with one clear decision: one primary action (upload your transcript),
// one secondary action (try the synthetic example), and everything else under "Other options".
// The file input accepts images, so phones offer the camera inside the same picker; the separate
// camera input stays for browsers that need it and is listed under "Other options".
// Task 21 · the upload area also takes a dropped file, reading shows what is happening (with Cancel),
// and a failed upload stays here with the reason and three ways forward.
// Task 51 · a scanned PDF (no text layer; `error` is { scanned: file }) gets its own message and two
// choices: another file, or read the picture (OCR, slower). OCR never starts on its own.
const tr = (lang, ar, en) => lang === 'ar' ? ar : en

export default function StartScreen({ lang, fileRef, cameraRef, onFile, onDemo, onManual, onInterests, onRestore, onSampleReport, processing, progress,
  steps = false, stage = null, onCancel, error = '', errorDetails = null, onRejectFile }) {
  const s = copy[lang].screens.start
  const [dragging, setDragging] = useState(false)
  const scanned = error?.scanned
  const uploadRef = useRef(null), errorRef = useRef(null)
  // An error is announced (role="alert") and gets focus, so keyboard and screen reader users land on it.
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  const onDrag = event => { event.preventDefault(); event.stopPropagation(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; setDragging(true) }
  const onDragLeave = event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }
  const onDrop = event => {
    event.preventDefault(); event.stopPropagation(); setDragging(false)
    const file = event.dataTransfer?.files?.[0]
    if (!file) return
    if (acceptsTranscriptFile(file)) onFile(file)
    else onRejectFile?.()
  }
  const cancel = () => { onCancel?.(); requestAnimationFrame(() => uploadRef.current?.focus()) }
  return <>
    <div className="app-title start-title">
      {steps && <StepBar lang={lang} step={1}/>}
      <h2>{s.title}</h2>
      <p>{s.intro}</p>
    </div>

    {error && <div className="start-error" role="alert" tabIndex={-1} ref={errorRef} data-testid={scanned ? 'scanned-pdf' : 'upload-error'}>
      <p className="start-error-text"><AlertCircle size={18} aria-hidden="true"/><span>{scanned ? s.scanned.message : error}</span></p>
      <div className="start-error-actions">
        <button type="button" className="button primary" onClick={() => fileRef.current?.click()}><RefreshCw size={16}/>{scanned ? s.scanned.another : s.retry.another}</button>
        {scanned ? <button type="button" className="button secondary" onClick={() => onFile(scanned)}><FileText size={16}/>{s.scanned.readPicture}</button> : <>
          <button type="button" className="button secondary" onClick={onManual}><Plus size={16}/>{s.retry.manual}</button>
          <button type="button" className="button secondary" onClick={onDemo}><Sparkles size={16}/>{s.retry.demo}</button>
        </>}
      </div>
      {!scanned && errorDetails}
    </div>}

    <div className="start-actions">
      <button type="button" ref={uploadRef} className={`onboarding-upload${dragging ? ' is-dragging' : ''}`} data-testid="upload-drop-zone" onClick={() => fileRef.current?.click()}
        onDragEnter={onDrag} onDragOver={onDrag} onDragLeave={onDragLeave} onDrop={onDrop}>
        <div className="start-icon"><UploadCloud/></div>
        <div><h3>{dragging ? s.drop : tr(lang, 'ارفع كشف الدرجات', 'Upload your transcript')}</h3><p>{tr(lang, 'PDF أو صورة. على الجوال يمكنك التصوير مباشرة.', 'PDF or image. On a phone you can take a photo.')}</p></div>
      </button>
      <p className="inline-trust" data-testid="start-trust"><ShieldCheck size={18}/><span>{tr(lang, 'يُقرأ ملفك على جهازك فقط ولا يُرفع إلى أي خادم.', 'Your file is read on your device only and is not uploaded to any server.')}</span> <a href={pageHref('privacy.html', lang)} target="_blank" rel="noreferrer">{tr(lang, 'كيف؟', 'How?')}</a></p>
      <button type="button" className="button secondary start-demo" onClick={onDemo}><Sparkles size={17}/>{tr(lang, 'جرّب المثال التوضيحي', 'Try synthetic demo')}</button>
    </div>

    <details className="start-more" data-testid="start-more">
      <summary>{tr(lang, 'خيارات أخرى', 'Other options')}</summary>
      <div className="start-more-list">
        <button type="button" className="text-button" onClick={onManual}><Plus size={16}/>{tr(lang, 'أدخل المقررات يدويًا', 'Enter courses manually')}</button>
        <button type="button" className="text-button" onClick={onInterests}><Fingerprint size={16}/>{tr(lang, 'ابدأ باهتماماتك دون كشف درجات', 'Start with your interests (no transcript)')}</button>
        <button type="button" className="text-button" onClick={onRestore}><LockKeyhole size={16}/>{tr(lang, 'استعد ملفك المحفوظ', 'Restore your saved profile')}</button>
        <button type="button" className="text-button" onClick={() => cameraRef.current?.click()}><Camera size={16}/>{tr(lang, 'صوّر كشف الدرجات بالكاميرا', 'Photograph your transcript')}</button>
        <a className="text-button" href={pageHref('sample-report.html', lang)} onClick={onSampleReport}><FileText size={16}/>{tr(lang, 'شاهد التقرير التوضيحي', 'View the synthetic report')}</a>
      </div>
    </details>

    <ul className="start-benefits">
      <li>{tr(lang, 'قدرات مقترحة، ولكل قدرة مصدرها ومستوى دليلها.', 'Suggested capabilities, each with its source and evidence level.')}</li>
      <li>{tr(lang, 'مسارات ودورات تناسب هدفك، مع السبب.', 'Pathways and courses that fit your goal, with the reason.')}</li>
      <li>{tr(lang, 'تصحّح بياناتك أو تحذفها متى شئت.', 'You correct or delete your data at any time.')}</li>
    </ul>

    {/* The value is cleared after each choice, so "Try another file" can take the same file again. */}
    <label className="sr-only" htmlFor="kamin-transcript-file">{tr(lang, 'اختر ملف كشف الدرجات', 'Choose transcript file')}</label>
    <input id="kamin-transcript-file" className="sr-only" ref={fileRef} type="file" accept={TRANSCRIPT_ACCEPT} onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }}/>
    <label className="sr-only" htmlFor="kamin-transcript-camera">{tr(lang, 'صوّر كشف الدرجات بالكاميرا', 'Photograph transcript with camera')}</label>
    <input id="kamin-transcript-camera" className="sr-only" ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }}/>

    {processing && <div className="processing" data-testid="processing">
      <div className="processing-row" role="status" aria-live="polite"><div className="spinner"/><strong data-testid="reading-stage" data-stage={stage || 'open'}>{s.stages[stage] || s.stages.open}</strong><b>{progress}%</b></div>
      <div className="progress" aria-label={s.progressLabel}><i style={{ width: `${progress}%` }}/></div>
      {onCancel && <button type="button" className="button secondary processing-cancel" data-testid="cancel-reading" onClick={cancel}>{s.cancel}</button>}
    </div>}
  </>
}
