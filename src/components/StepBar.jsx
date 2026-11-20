import { Check } from 'lucide-react'
import { copy, fill } from '../i18n.js'

// Task 21 · three onboarding steps: Upload → Review → Your capabilities. Shown on the start screen and
// the review screen before the first approval, and on the dashboard the first time it opens after it.
// An ordered list with aria-current="step". On phones only the current step shows, as one line
// ("Step 2 of 3 · Review"); the "Step n of 3" words are visible on phones only.
export const STEPS = Object.freeze(['upload', 'review', 'capabilities'])

export default function StepBar({ lang, step }) {
  const t = copy[lang].screens.start.steps
  return <div className="step-bar" data-testid="step-bar" data-step={step}>
    <ol aria-label={t.label}>
      {STEPS.map((id, i) => {
        const n = i + 1, state = n < step ? 'done' : n === step ? 'current' : 'next'
        return <li key={id} className={`step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
          <span className="step-mark" aria-hidden="true">{state === 'done' ? <Check size={13}/> : n}</span>
          {state === 'current' && <span className="step-count">{fill(t.count, { n, total: STEPS.length })} · </span>}
          <span className="step-name">{t[id]}</span>
        </li>
      })}
    </ol>
  </div>
}
