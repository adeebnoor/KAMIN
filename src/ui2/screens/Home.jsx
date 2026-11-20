// Task 62 · Home in one sentence. The sentence is the page heading (src/ui2/views.js, ≤ 12 words), then one main
// button: Start with no profile yet, or Continue with a one-line summary (where the flow stopped). The footer
// comes with Task 68. Nothing else: no how-it-works, no examples, no demo, no live example, no tutorial, no FAQ.
// Task 75 (Amjd, 2026-11-19): under the heading, KAMIN's idea in three short lines (src/ui2/copy.js home.idea, from the
// How-it-works wording), on the old landing hero's gradient (src/ui2/look.css). Still one main button; no link or tutorial.
// The synthetic example is never offered here; it stays at ?start=sample (tests, reviewers, the pilot).
import { useEffect, useRef } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { VIEW_TEXT } from '../views.js'
import { fillIn, nextCopy } from '../copy.js'

// The line above Continue: the approved courses (a count, never a percentage) and the step the flow resumes at.
export function homeSummary(state, action, lang) {
  if (action?.kind !== 'continue') return null
  const w = nextCopy(lang).home
  return [state?.approved ? fillIn(w.approvedCourses, { n: state.courses?.length || 0 }) : null, fillIn(w.nextStep, { step: VIEW_TEXT[action.view].title[lang] })]
    .filter(Boolean).join(' · ')
}

export default function Home({ lang, state, action, focusHeading, onNavigate }) {
  const w = nextCopy(lang).home
  const heading = useRef(null)
  // After a move the heading takes focus, so a screen reader names the page (never on the first load).
  useEffect(() => { if (focusHeading) heading.current?.focus() }, [focusHeading])
  const Forward = lang === 'ar' ? ArrowLeft : ArrowRight
  const summary = homeSummary(state, action, lang)
  return <section className="ui2-page ui2-home" aria-labelledby="ui2-page-title" data-view="home" data-testid="ui2-page">
    <h1 id="ui2-page-title" tabIndex={-1} ref={heading}>{VIEW_TEXT.home.line[lang]}</h1>
    <ul className="ui2-home-idea" data-testid="ui2-home-idea">{w.idea.map(line => <li key={line}>{line}</li>)}</ul>
    {summary && <p className="ui2-home-summary" data-testid="ui2-home-summary">{summary}</p>}
    <button type="button" className="ui2-btn ui2-btn-primary ui2-btn-large" data-testid="ui2-home-action" data-kind={action.kind} onClick={() => onNavigate(action.view)}>
      {action.kind === 'start' ? w.start : w.continue}<Forward size={20} aria-hidden="true"/>
    </button>
  </section>
}
