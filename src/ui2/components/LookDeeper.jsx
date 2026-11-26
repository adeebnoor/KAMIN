// Task 43 · "Look deeper": the MiniLM fallback for one project description, offered only with the hybrid method
// (?suggest=hybrid, src/ai/activeSuggestMethod.js; the default only between Task 80 and Task 80b) and only after the
// improved engine abstained. Same consent pattern as
// SemanticRecall.jsx: nothing downloads until the student ticks the box AND presses the button; the model files
// come from /models/ on this site (src/semantic/recall.worker.js checks every file's sha256), the description
// never leaves the device, and "Stop and delete model files" removes the cached files. At most one suggestion,
// quoting the student's own sentence (src/ai/hybridFallback.js); no score is shown. Part of the lazy Projects chunk.
import { useEffect, useId, useRef, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { nextCopy } from '../copy.js'

// EMBEDDING_MODEL.cache of src/semantic/config.js (checked by tests/projectSuggestImproved.test.js). Not imported:
// sharing config.js with SemanticRecall's chunk would split it out and lengthen the startup bundle's preload list.
export const MODEL_CACHE = 'kamin-embedding-model-v1'

export default function LookDeeper({ lang, description, onFound }) {
  const w = nextCopy(lang).projects.deeper
  const id = useId()
  const [agreed, setAgreed] = useState(false)
  // idle → loading → searching → done (or error)
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [outcome, setOutcome] = useState(null)
  const [cacheNotice, setCacheNotice] = useState(false)
  const [status, setStatus] = useState('')
  const worker = useRef(null), timer = useRef(null)
  const dispose = () => {
    clearTimeout(timer.current)
    const current = worker.current
    worker.current = null
    if (current) { current.onmessage = null; current.postMessage({ type: 'dispose' }); setTimeout(() => current.terminate(), 300) }
  }
  useEffect(() => () => dispose(), [])
  const failure = code => { dispose(); setPhase('error'); setOutcome({ error: code }) }
  const busy = phase === 'loading' || phase === 'searching'

  const lookDeeper = () => {
    if (!agreed || busy) return
    dispose(); setOutcome(null); setStatus(''); setProgress(0); setPhase('loading')
    try {
      const current = new Worker(new URL('../../semantic/recall.worker.js', import.meta.url), { type: 'module' })
      worker.current = current
      current.onmessage = ({ data }) => {
        if (current !== worker.current) return
        if (data.status === 'loading') setProgress(data.progress)
        if (data.status === 'cache-unavailable') setCacheNotice(true)
        if (data.status === 'ready') {
          clearTimeout(timer.current); setPhase('searching')
          timer.current = setTimeout(() => failure('MODEL_TIMEOUT'), 30000)
          current.postMessage({ type: 'project', text: description.trim() })
        }
        if (data.status === 'project') { clearTimeout(timer.current); setPhase('done'); setOutcome(data.result); if (data.result.suggestions.length) onFound(data.result) }
        if (data.status === 'error') failure(data.code)
      }
      current.onerror = () => failure('MODEL_UNAVAILABLE')
      timer.current = setTimeout(() => failure('MODEL_TIMEOUT'), 180000)
      current.postMessage({ type: 'load' })
    } catch { failure('MODEL_UNAVAILABLE') }
  }
  const remove = async () => {
    dispose(); setPhase('idle'); setAgreed(false); setOutcome(null)
    try { await caches.delete(MODEL_CACHE); setStatus(w.removed) } catch { setStatus(w.removeFailed) }
  }

  return <section className="ui2-look-deeper" aria-labelledby={`${id}-line`} data-testid="look-deeper">
    <p id={`${id}-line`}>{w.line}</p>
    <p className="ui2-look-deeper-details">{w.details}</p>
    <label className="ui2-look-deeper-consent">
      <input type="checkbox" checked={agreed} disabled={busy} onChange={event => { setAgreed(event.target.checked); if (!event.target.checked) dispose() }}/>
      <span>{w.consent}</span>
    </label>
    <div className="ui2-look-deeper-actions">
      <button type="button" className="ui2-btn" disabled={!agreed || busy || phase === 'done'} onClick={lookDeeper}><Download size={16} aria-hidden="true"/>{w.button}</button>
      <button type="button" className="ui2-text-btn" onClick={remove}><Trash2 size={16} aria-hidden="true"/>{w.remove}</button>
    </div>
    {phase === 'loading' && <div role="status"><p>{w.loading}</p><progress value={progress} max="100" aria-label={w.progressLabel}/></div>}
    {phase === 'searching' && <p role="status">{w.searching}</p>}
    {phase === 'done' && <p role="status" data-testid="look-deeper-result">{outcome?.suggestions?.length ? w.found : w.nothing}</p>}
    {phase === 'error' && <p className="ui2-project-reason" role="alert">{w.error}</p>}
    {cacheNotice && <p role="status">{w.cacheNotice}</p>}
    {status && <p role="status">{status}</p>}
  </section>
}
