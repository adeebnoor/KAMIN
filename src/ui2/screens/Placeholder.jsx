// Task 60 · the views that are not built yet are placeholders: a heading and one sentence. Tasks 62–68 replace
// them with the real screens (Task 62: Home and step 1 have their own screens). Flow steps show the step
// indicator, which opens the four steps in a sheet (src/ui2/StepChip.jsx); Profile leads to Settings and Help.
import { useEffect, useRef } from 'react'
import { VIEW_TEXT } from '../views.js'
import StepChip from '../StepChip.jsx'

export default function Placeholder({ view, lang, focusHeading, onNavigate }) {
  const text = VIEW_TEXT[view]
  const heading = useRef(null)
  // After a view change the heading takes focus, so a screen reader names the new page (not on first load).
  useEffect(() => { if (focusHeading) heading.current?.focus() }, [view, focusHeading])
  return <section className="ui2-page" aria-labelledby="ui2-page-title" data-view={view} data-testid="ui2-page">
    <StepChip view={view} lang={lang} onNavigate={onNavigate}/>
    <h1 id="ui2-page-title" tabIndex={-1} ref={heading}>{text.title[lang]}</h1>
    <p>{text.line[lang]}</p>
    {view === 'profile' && <div className="ui2-page-links">
      {['settings', 'help'].map(id => <button key={id} type="button" className="ui2-btn" onClick={() => onNavigate(id)}>{VIEW_TEXT[id].title[lang]}</button>)}
    </div>}
  </section>
}
