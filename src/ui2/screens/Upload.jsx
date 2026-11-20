// Task 62 · step 1 of 4: upload, confirm in one line, fix in a sheet. Loads on its own (lazy, from AppNext.jsx).
// One big area to choose or drop the transcript (it takes images too, so a phone offers its camera in the same
// picker) and the one-line privacy promise with "Why?" in a sheet. While the file is read: a skeleton of the
// result card and the stage (Task 21's stages), with Cancel; no percentage. A file that cannot be read stays
// here with its message and its ways forward (Task 21; Task 51's scanned-PDF message and "Try reading the
// picture", which never starts on its own). Once read: the result card (ResultCard.jsx). The synthetic example
// is never offered here; it opens at ?start=sample (AppNext.jsx).
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { AlertCircle, FileText, Plus, RefreshCw, ShieldCheck, UploadCloud } from 'lucide-react'
import { copy } from '../../i18n.js'
import { pageHref } from '../../../public/site-content.js'
import { TRANSCRIPT_ACCEPT, acceptsTranscriptFile } from '../../utils/transcriptAccept.js'
import { VIEW_TEXT } from '../views.js'
import { nextCopy } from '../copy.js'
import StepChip from '../StepChip.jsx'
import Sheet from '../Sheet.jsx'
import ResultCard from '../components/ResultCard.jsx'
import '../step1.css'

// Shown with the message of a file in which no course was found, when the file carries a verification link (Task 21).
const DocumentSignals = lazy(() => import('../../components/DocumentSignals.jsx'))

// The shape of the result card while the file is read (bars only; the stage line says what is happening).
function ResultSkeleton() {
  return <div className="ui2-card ui2-result-skeleton" aria-hidden="true" data-testid="ui2-result-skeleton"><span/><span/><span/><span/></div>
}

export default function Upload({ lang, profile, focusHeading, onNavigate, onApprove, editMode = false }) {
  const s = copy[lang].screens.start
  const w = nextCopy(lang).upload
  const { draft, status, actions } = profile
  const { processing, readingStage } = status
  // A message, or { scanned: file } for a scanned PDF (the file stays in memory only, for "Try reading the picture").
  const [error, setError] = useState('')
  const [errorDocument, setErrorDocument] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [whyOpen, setWhyOpen] = useState(false)
  const [justRead, setJustRead] = useState(false)
  const fileRef = useRef(null), dropRef = useRef(null), errorRef = useRef(null), heading = useRef(null)
  const scanned = error?.scanned
  useEffect(() => { if (focusHeading) heading.current?.focus() }, [focusHeading])
  // A message is announced (role="alert") and takes focus, so keyboard and screen-reader users land on it.
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])

  const fail = (message, document = null) => { setError(message); setErrorDocument(document); actions.clearDraft() }
  const read = async file => {
    if (!file) return
    // The very file just reported as a scanned PDF, sent again by "Try reading the picture": read the picture.
    const readPicture = !!scanned && file === scanned
    setError(''); setErrorDocument(null); setJustRead(false)
    const result = await actions.upload(file, { readPicture })
    if (result.stale) return
    if (result.ok) { setJustRead(true); return }
    if ('code' in result) fail(w.errors[result.code] || w.errors.failed)
    else fail(result.scanned ? { scanned: result.scanned } : s.noCourses, result.document)
  }
  const choose = () => fileRef.current?.click()
  const cancel = () => { actions.cancelUpload(); requestAnimationFrame(() => dropRef.current?.focus()) }
  const manual = () => { setError(''); setErrorDocument(null); setJustRead(false); actions.startManual() }
  const onDrag = event => { event.preventDefault(); event.stopPropagation(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; setDragging(true) }
  const onDragLeave = event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }
  const onDrop = event => {
    event.preventDefault(); event.stopPropagation(); setDragging(false)
    const file = event.dataTransfer?.files?.[0]
    if (!file) return
    if (acceptsTranscriptFile(file)) void read(file)
    else fail(w.errors.UNSUPPORTED_FILE_TYPE)
  }

  // The card once something was read (or the student chose to type the courses in); a message replaces it.
  const showCard = !processing && !error && (draft.rows.length > 0 || draft.validation?.mode === 'manual')
  return <section className="ui2-page ui2-upload" aria-labelledby="ui2-page-title" data-view="upload" data-testid="ui2-page">
    {/* Task 66: "Update transcript" on Profile opens this step in edit mode (no step chip; Approve comes back to Profile). */}
    {!editMode && <StepChip view="upload" lang={lang} onNavigate={onNavigate}/>}
    <h1 id="ui2-page-title" tabIndex={-1} ref={heading}>{VIEW_TEXT.upload.title[lang]}</h1>

    {error && <div className="ui2-error" role="alert" tabIndex={-1} ref={errorRef} data-testid={scanned ? 'scanned-pdf' : 'upload-error'}>
      <p className="ui2-error-text"><AlertCircle size={18} aria-hidden="true"/><span>{scanned ? s.scanned.message : error}</span></p>
      <div className="ui2-error-actions">
        <button type="button" className="ui2-btn ui2-btn-primary" onClick={choose}><RefreshCw size={16} aria-hidden="true"/>{scanned ? s.scanned.another : s.retry.another}</button>
        {scanned
          ? <button type="button" className="ui2-btn" onClick={() => read(scanned)}><FileText size={16} aria-hidden="true"/>{s.scanned.readPicture}</button>
          : <button type="button" className="ui2-btn" onClick={manual}><Plus size={16} aria-hidden="true"/>{s.retry.manual}</button>}
      </div>
      {!scanned && errorDocument?.qr?.length > 0 && <Suspense fallback={null}><DocumentSignals lang={lang} document={errorDocument}/></Suspense>}
    </div>}

    {processing && <div className="ui2-reading" data-testid="processing">
      <p className="ui2-reading-stage" role="status" aria-live="polite"><span className="ui2-vh">{w.reading}: </span><strong data-testid="reading-stage" data-stage={readingStage || 'open'}>{s.stages[readingStage] || s.stages.open}</strong></p>
      <ResultSkeleton/>
      <button type="button" className="ui2-btn" data-testid="cancel-reading" onClick={cancel}>{s.cancel}</button>
    </div>}

    {showCard && <ResultCard lang={lang} draft={draft} focusOnMount={justRead} onApprove={onApprove} onAnother={choose}/>}

    {!processing && !showCard && <>
      <button type="button" ref={dropRef} className={`ui2-drop${dragging ? ' is-dragging' : ''}`} data-testid="upload-drop-zone" onClick={choose}
        onDragEnter={onDrag} onDragOver={onDrag} onDragLeave={onDragLeave} onDrop={onDrop}>
        <UploadCloud size={32} aria-hidden="true"/>
        <span className="ui2-drop-title">{dragging ? s.drop : w.choose}</span>
        <span className="ui2-drop-hint">{w.hint}</span>
      </button>
      <p className="ui2-privacy" data-testid="ui2-privacy"><ShieldCheck size={18} aria-hidden="true"/><span>{w.privacy}</span>
        <button type="button" className="ui2-text-btn" aria-haspopup="dialog" onClick={() => setWhyOpen(true)}>{w.why}</button></p>
      <Sheet open={whyOpen} onClose={() => setWhyOpen(false)} title={w.whyTitle} lang={lang}>
        <div className="ui2-why">
          {w.whyText.map(line => <p key={line}>{line}</p>)}
          <a href={pageHref('privacy.html', lang)} target="_blank" rel="noreferrer">{w.privacyPage}</a>
        </div>
      </Sheet>
    </>}

    {/* The value is cleared after each choice, so "Try another file" can take the same file again. The area
        above opens it; it is not a stop of its own on the keyboard. */}
    <label className="ui2-vh" htmlFor="ui2-transcript-file">{w.fileLabel}</label>
    <input id="ui2-transcript-file" className="ui2-vh" ref={fileRef} type="file" tabIndex={-1} accept={TRANSCRIPT_ACCEPT} onChange={event => { void read(event.target.files?.[0]); event.target.value = '' }}/>
  </section>
}
