// Task 62 · the step indicator of the four flow steps ("Step 1 of 4"). A tap shows the four steps in a sheet,
// each a link to its step. Task 60 had this sheet behind a "What are the four steps?" button on Home; Home is
// now one sentence and one button, so the four steps moved next to the step they explain.
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { FLOW, VIEW_TEXT } from './views.js'
import Chip from './Chip.jsx'
import Sheet from './Sheet.jsx'
import { fillIn, nextCopy } from './copy.js'

export default function StepChip({ view, lang, onNavigate }) {
  const w = nextCopy(lang).steps
  const [open, setOpen] = useState(false)
  const step = FLOW.indexOf(view)
  if (step < 0) return null
  return <>
    <button type="button" className="ui2-chip ui2-step-chip" aria-haspopup="dialog" data-testid="ui2-step" onClick={() => setOpen(true)}>
      {fillIn(w.step, { n: step + 1, of: FLOW.length })}<ChevronDown size={16} aria-hidden="true"/>
    </button>
    <Sheet open={open} onClose={() => setOpen(false)} title={w.title} lang={lang}>
      <ol>{FLOW.map((id, i) => <li key={id}><Chip aria-hidden="true">{i + 1}</Chip>
        <button type="button" className="ui2-text-btn" aria-current={id === view ? 'step' : undefined} onClick={() => { setOpen(false); onNavigate(id) }}>{VIEW_TEXT[id].title[lang]}</button></li>)}</ol>
    </Sheet>
  </>
}
