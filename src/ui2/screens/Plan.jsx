// Task 65 · My plan (the "My plan" tab; the four-step flow ends here). Loads on its own (lazy, from AppNext.jsx).
// The goals (the same chips as step 4, editable), the steps the student chose (mark done, remove with Undo), the items
// marked "Not for me" (show again), and "Compare paths": a sheet with the old interface's pathway comparison
// (src/components/PathwayCompare.jsx, reused unchanged) starting from the goals. Then one line saying where the plan
// is kept, and the dashboard's offer to keep the profile on this device (the same words, src/content/saveOfferCopy.js).
// Everything here is the student's own choice (Task 58, src/plan/plan.js): nothing changes evidence.
// Task 44: in the trial, Remove counts once (step_removed, with the feed's version; src/pilot/studyCounts.js) and Undo
// takes the count back. Never the item or its title.
import { useEffect, useRef, useState } from 'react'
import { Columns3, LockKeyhole } from 'lucide-react'
import { LEARNING_PATH_COPY } from '../../content/learningPathCopy.js'
import { saveOffer } from '../../content/saveOfferCopy.js'
import { normalizePlan } from '../../plan/plan.js'
import { markDone, openPlan } from '../../plan/planEdits.js'
import PathwayCompare from '../../components/PathwayCompare.jsx'
import { VIEW_TEXT } from '../views.js'
import { fillIn, nextCopy } from '../copy.js'
import Skeleton from '../Skeleton.jsx'
import Sheet from '../Sheet.jsx'
import GoalPicker from '../components/GoalPicker.jsx'
import { dropStep, hideStep, isPathway, restoreStep, toggleGoal, unhideStep } from '../nextState.js'
import { useStepsEngine } from '../useStepsEngine.js'
import { recordStepChoice, takeBackStepChoice } from '../../pilot/studyCounts.js'
import '../next.css'

// The comparison starts from the goals that are pathways (two or three); with one, that goal and the first other
// job; with none, the comparison's own first choice (the first two jobs).
export function compareStart(goals, matches) {
  const known = goals.filter(id => isPathway(id) && matches.some(m => m.id === id)).slice(0, 3)
  if (!known.length) return null
  if (known.length >= 2) return known
  const other = matches.find(m => m.type === 'job' && !known.includes(m.id))
  return other ? [...known, other.id] : known
}

export default function Plan({ lang, profile, focusHeading, onNavigate, notify }) {
  const w = nextCopy(lang).plan
  const T = LEARNING_PATH_COPY[lang]
  const { state, actions, derived } = profile
  const engine = useStepsEngine()
  const { goals, plan, notForMe } = normalizePlan(state)
  const [compare, setCompare] = useState(false)
  const [notNow, setNotNow] = useState(false)
  const heading = useRef(null)
  useEffect(() => { if (focusHeading) heading.current?.focus() }, [focusHeading])
  // Task 58: steps dropped because their item left the list are named once, the first time the plan opens.
  useEffect(() => {
    if (!state.planDropped) return
    const { notice } = openPlan(state, lang)
    actions.setState(s => openPlan(s, lang).state)
    if (notice) notify(notice, { tone: 'info' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const title = id => engine?.catalogItem(id)?.title?.[lang] || ''
  const toggleGoalHere = goalId => { actions.setState(s => toggleGoal(s, goalId)); actions.log(lang === 'ar' ? 'تغيير الهدف' : 'Goal changed') }
  const remove = (entry, index) => {
    actions.setState(s => dropStep(s, entry.itemId, { lang }))
    // Task 44: the trial's count (only for an enrolled participant). The list shows only once the engine is loaded.
    if (engine) recordStepChoice('step_removed', engine.NEXT_STEPS_VERSION)
    notify(w.removed, { action: { label: w.undo, onClick: () => { actions.setState(s => restoreStep(s, entry, index)); takeBackStepChoice('step_removed') } } })
  }
  const restore = itemId => {
    actions.setState(s => unhideStep(s, itemId))
    notify(w.restored, { action: { label: w.undo, onClick: () => actions.setState(s => hideStep(s, itemId)) } })
  }
  const keep = async () => { if (await actions.changePersistence(true)) notify(saveOffer('kept', lang)) }

  return <section className="ui2-page ui2-plan" aria-labelledby="ui2-page-title" data-view="plan" data-testid="ui2-page">
    <h1 id="ui2-page-title" tabIndex={-1} ref={heading}>{VIEW_TEXT.plan.title[lang]}</h1>
    <p className="ui2-plan-line">{VIEW_TEXT.plan.line[lang]}</p>

    {/* Task 74: "Why these paths?" here also opens each pathway's development plan (K08). */}
    <GoalPicker lang={lang} state={state} matches={derived.matches} onToggle={toggleGoalHere} withPlan/>
    <button type="button" className="ui2-btn ui2-plan-compare" aria-haspopup="dialog" onClick={() => setCompare(true)}><Columns3 size={18} aria-hidden="true"/>{w.compare}</button>

    <section className="ui2-plan-block" aria-labelledby="ui2-plan-steps" data-testid="ui2-plan-steps">
      <h2 id="ui2-plan-steps">{w.planned}</h2>
      {!plan.length ? <div className="ui2-plan-empty">
        <p>{w.empty}</p>
        <button type="button" className="ui2-btn ui2-btn-primary" onClick={() => onNavigate('next')}>{w.seeSteps}</button>
      </div>
        : !engine ? <Skeleton lang={lang} lines={plan.length}/>
          : <ul className="ui2-plan-list">{plan.map((entry, index) => {
            const name = title(entry.itemId)
            const item = engine.catalogItem(entry.itemId)
            return <li key={entry.itemId} className="ui2-plan-item" data-testid="ui2-plan-item" data-item={entry.itemId} data-status={entry.status}>
              <p className="ui2-plan-title"><strong>{name}</strong></p>
              <p className="ui2-plan-meta">{T.kind[item?.kind] || ''} · {w.action[entry.action]} · <span data-testid="ui2-plan-status">{w.status[entry.status]}</span></p>
              <div className="ui2-plan-actions">
                <label className="ui2-plan-done"><input type="checkbox" checked={entry.status === 'done'} aria-label={fillIn(w.markDone, { title: name })}
                  onChange={event => actions.setState(s => markDone(s, entry.itemId, event.target.checked))}/><span aria-hidden="true">{w.doneLabel}</span></label>
                <button type="button" className="ui2-text-btn" aria-label={fillIn(w.removeOf, { title: name })} onClick={() => remove(entry, index)}>{w.remove}</button>
              </div>
            </li>
          })}</ul>}
    </section>

    {notForMe.length > 0 && <section className="ui2-plan-block" aria-labelledby="ui2-plan-hidden" data-testid="ui2-plan-hidden">
      <h2 id="ui2-plan-hidden">{w.hiddenTitle}</h2>
      {!engine ? <Skeleton lang={lang} lines={notForMe.length}/>
        : <ul className="ui2-plan-list">{notForMe.map(itemId => <li key={itemId} className="ui2-plan-item" data-testid="ui2-plan-hidden-item" data-item={itemId}>
          <p className="ui2-plan-title">{title(itemId)}</p>
          <div className="ui2-plan-actions"><button type="button" className="ui2-text-btn" aria-label={fillIn(w.restoreOf, { title: title(itemId) })} onClick={() => restore(itemId)}>{w.restore}</button></div>
        </li>)}</ul>}
    </section>}

    <div className="ui2-plan-save" data-testid="ui2-plan-save">
      {state.localPersistence
        ? <p className="ui2-plan-saved"><LockKeyhole size={16} aria-hidden="true"/>{saveOffer('savedNote', lang)}</p>
        : <>
          <p className="ui2-plan-saved"><LockKeyhole size={16} aria-hidden="true"/>{w.savedSession}</p>
          {!notNow && <div className="ui2-plan-offer" data-testid="ui2-save-offer">
            <p><strong>{saveOffer('question', lang)}</strong></p>
            <p>{saveOffer('detail', lang)}</p>
            <div className="ui2-plan-actions">
              <button type="button" className="ui2-btn ui2-btn-primary" onClick={keep}>{saveOffer('keep', lang)}</button>
              <button type="button" className="ui2-btn" onClick={() => setNotNow(true)}>{saveOffer('notNow', lang)}</button>
            </div>
          </div>}
        </>}
    </div>

    <Sheet open={compare} onClose={() => setCompare(false)} title={w.compare} lang={lang}>
      <div className="ui2-compare">
        <PathwayCompare lang={lang} matches={derived.matches} profile={derived.matchProfile} initial={compareStart(goals, derived.matches)}/>
      </div>
    </Sheet>
  </section>
}
