// Task 18 · the trial layer: consent first, a small bar during the session, the end-of-session form,
// the review of the anonymous study file, its download, and withdrawal at any time. Loaded only in
// pilot mode. No network: the file is made in the browser and saved by the participant.
import { useEffect, useRef, useState } from 'react'
import { PILOT_CONSENT, PILOT_COPY } from '../content/pilotConsent.js'
import { clearPilotLocalData } from '../utils/pilotAnalytics.js'
// Task 44: these moved out of the startup bundle; they load with this layer.
import { STUDY_TASKS, TASK_OUTCOMES, buildStudyFile, joinStudy, personalDataInComment, saveStudyFeedback, studyFileName, withdrawFromStudy } from '../pilot/studyFile.js'
import '../pilot.css'

function Modal({ labelId, onClose, children, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const node = ref.current
    node?.querySelector('h2')?.focus()
    const onKey = event => {
      if (event.key === 'Escape' && onClose) { event.preventDefault(); event.stopPropagation(); onClose(); return }
      if (event.key !== 'Tab' || !node) return
      event.stopPropagation() // the app window has its own focus trap; this dialog sits inside it
      const focusable = [...node.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length > 0)
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    node?.addEventListener('keydown', onKey)
    return () => node?.removeEventListener('keydown', onKey)
  }, [onClose])
  return <div className="pilot-backdrop"><div className={`pilot-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelId} ref={ref}>{children}</div></div>
}

function ConsentDialog({ lang, onJoin, onDecline }) {
  const text = PILOT_CONSENT[lang]
  const [agreed, setAgreed] = useState(false)
  return <Modal labelId="pilot-consent-title" className="pilot-consent">
    <h2 id="pilot-consent-title" tabIndex={-1}>{text.title}</h2>
    {!PILOT_CONSENT.approved && <p className="pilot-draft" data-testid="pilot-draft-notice">{text.draftNotice}</p>}
    <p>{text.intro}</p>
    <ul>{text.points.map(point => <li key={point}>{point}</li>)}</ul>
    <label className="pilot-agree"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} /><span>{text.agree}</span></label>
    <div className="pilot-actions">
      <button type="button" className="button primary" disabled={!agreed} onClick={() => onJoin(joinStudy({ consent: true, consentVersion: PILOT_CONSENT.version, lang }))}>{text.start}</button>
      <button type="button" className="button secondary" onClick={onDecline}>{text.decline}</button>
    </div>
  </Modal>
}

function WithdrawDialog({ lang, onCancel, onWithdrawn }) {
  const c = PILOT_COPY[lang]
  return <Modal labelId="pilot-withdraw-title" onClose={onCancel}>
    <h2 id="pilot-withdraw-title" tabIndex={-1}>{c.withdraw}</h2>
    <p>{c.withdrawConfirm}</p>
    <div className="pilot-actions">
      <button type="button" className="button danger" onClick={() => onWithdrawn(withdrawFromStudy())}>{c.withdrawYes}</button>
      <button type="button" className="button secondary" onClick={onCancel}>{c.cancel}</button>
    </div>
  </Modal>
}

function FinishDialog({ lang, study, onClose, onEnded, onChange }) {
  const c = PILOT_COPY[lang]
  const [tasks, setTasks] = useState(() => ({ ...study.tasks }))
  const [clarity, setClarity] = useState(study.clarity)
  const [comment, setComment] = useState(study.comment || '')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const [preview, setPreview] = useState(() => buildStudyFile())
  const blocked = personalDataInComment(comment).length > 0
  const save = () => {
    setError(''); setStatus('')
    if (blocked) { setError(c.commentBlocked); return false }
    onChange(saveStudyFeedback({ tasks, clarity, comment }))
    setPreview(buildStudyFile())
    setStatus(c.saved)
    return true
  }
  const download = () => {
    if (!save()) return
    const file = buildStudyFile()
    setPreview(file)
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2) + '\n'], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = studyFileName(file)
    document.body.append(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDownloaded(true); setStatus(c.downloaded)
  }
  const end = () => { clearPilotLocalData(); onEnded(c.ended) }
  return <Modal labelId="pilot-finish-title" onClose={onClose} className="pilot-finish">
    <h2 id="pilot-finish-title" tabIndex={-1}>{c.formTitle}</h2>
    <p>{c.formIntro}</p>
    <form onSubmit={e => { e.preventDefault(); save() }}>
      {STUDY_TASKS.map(id => <fieldset key={id} className="pilot-task" data-task={id}>
        <legend>{c.tasks[id]}</legend>
        <div className="pilot-choices">{TASK_OUTCOMES.map(outcome => <label key={outcome}><input type="radio" name={`pilot-task-${id}`} value={outcome} checked={tasks[id] === outcome} onChange={() => setTasks(t => ({ ...t, [id]: outcome }))} /><span>{c.outcomes[outcome]}</span></label>)}</div>
      </fieldset>)}
      <fieldset className="pilot-task" data-question="clarity">
        <legend>{c.clarity}</legend>
        <div className="pilot-choices">
          {c.clarityScale.map((label, i) => <label key={label}><input type="radio" name="pilot-clarity" value={i + 1} checked={clarity === i + 1} onChange={() => setClarity(i + 1)} /><span>{label}</span></label>)}
          <label><input type="radio" name="pilot-clarity" value="" checked={clarity === null} onChange={() => setClarity(null)} /><span>{c.clarityNone}</span></label>
        </div>
      </fieldset>
      <label className="pilot-comment" htmlFor="pilot-comment">{c.comment}</label>
      <p id="pilot-comment-warning" className="pilot-warning">{c.commentWarning}</p>
      <textarea id="pilot-comment" value={comment} maxLength={600} aria-describedby="pilot-comment-warning" aria-invalid={blocked || undefined} onChange={e => setComment(e.target.value)} />
      {blocked && <p className="pilot-error" role="alert">{c.commentBlocked}</p>}
      <div className="pilot-actions"><button type="submit" className="button secondary">{c.save}</button></div>
    </form>
    <section className="pilot-review" aria-labelledby="pilot-review-title">
      <h3 id="pilot-review-title">{c.reviewTitle}</h3>
      <p>{c.reviewIntro}</p>
      <pre data-testid="pilot-file-preview" tabIndex={0}>{JSON.stringify(preview, null, 2)}</pre>
    </section>
    {error && !blocked && <p className="pilot-error" role="alert">{error}</p>}
    {status && <p className="pilot-status" role="status">{status}</p>}
    <div className="pilot-actions">
      <button type="button" className="button primary" onClick={download} disabled={blocked}>{c.download}</button>
      {downloaded && <button type="button" className="button danger" onClick={end}>{c.endSession}</button>}
      <button type="button" className="button secondary" onClick={onClose}>{c.close}</button>
    </div>
  </Modal>
}

// One component for both places (page level, or inside the app window); the parent keeps the state.
export default function PilotStudy({ lang, inApp = false, study, panel, setPanel, onJoin, onDecline, onLeft, onChange }) {
  const c = PILOT_COPY[lang]
  if (!study) return <ConsentDialog lang={lang} onJoin={onJoin} onDecline={onDecline} />
  return <>
    <div className={inApp ? 'pilot-bar in-app' : 'pilot-bar'} role="region" aria-label={c.bar} data-testid="pilot-bar">
      <span><strong>{c.bar}</strong> · {c.code}: <span dir="ltr" data-testid="pilot-code">{study.studyCode}</span></span>
      <span className="pilot-bar-actions">
        <button type="button" className="button primary" onClick={() => setPanel('finish')}>{c.finish}</button>
        <button type="button" className="button secondary" onClick={() => setPanel('withdraw')}>{c.withdraw}</button>
      </span>
    </div>
    {panel === 'finish' && <FinishDialog lang={lang} study={study} onChange={onChange} onClose={() => setPanel(null)} onEnded={message => onLeft(message)} />}
    {panel === 'withdraw' && <WithdrawDialog lang={lang} onCancel={() => setPanel(null)} onWithdrawn={result => onLeft(result.withdrawn ? c.withdrawn : null)} />}
  </>
}
