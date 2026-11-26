// Task 65 · step 4 of 4: your next steps. Loads on its own (lazy, from AppNext.jsx).
// Goal first ("Where do you want to go?", src/ui2/components/GoalPicker.jsx), then a vertical feed of short cards, one
// per item of the next-steps feed (src/path/nextSteps.js, Task 57): only items that close a gap of a chosen goal, in
// the written order (never a score). The feed and the learning list load on demand; a skeleton shows meanwhile.
// "Take this course" / "Get this certificate" puts the item in My plan, "Not for me" hides it: the card leaves the
// feed at once and the one message (Task 25) offers Undo. Details opens a sheet. An empty feed says why and what to
// do. "Next: My plan" ends the flow on My plan.
// Task 74: under Details, the old interface's review of a recommendation (src/components/RecommendationReview.jsx,
// unchanged: review, accept, reject or contest with a reason and a note, withdraw, the test-candidate download), saved
// on this device by the profile hook; then "See my review history" opens Settings → Usage log, where the history is.
// Task 44: in the trial, "Take this course" and "Not for me" each count once (step_taken, step_not_for_me, with the
// feed's version; src/pilot/studyCounts.js) and Undo takes the count back. Never the item, its title or a goal.
// Task 79: an empty feed says its real reason: no goal yet; the learning list has nothing yet for the gap (never
// "No gap"); every suggestion already handled; or a real "no gap". When the feed follows only pathways from the
// student's own words (no chosen goal), each is a one-tap "Make it my goal" chip. Every goal that is a pathway has a
// "Roadmap" button that opens its roadmap (src/ui2/components/Roadmap.jsx; the data loads on demand) in a sheet.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { copy } from '../../i18n.js'
import { LEARNING_PATH_COPY } from '../../content/learningPathCopy.js'
import { VIEW_TEXT } from '../views.js'
import { fillIn, nextCopy } from '../copy.js'
import StepChip from '../StepChip.jsx'
import Skeleton from '../Skeleton.jsx'
import Sheet from '../Sheet.jsx'
import GoalPicker, { goalName } from '../components/GoalPicker.jsx'
import Roadmap from '../components/Roadmap.jsx'
import { normalizePlan } from '../../plan/plan.js'
import { tickRoadmapItem } from '../../roadmap/roadmap.js'
import { useRoadmaps } from '../useRoadmaps.js'
import StepCard, { StepDetails, capabilityName } from '../components/StepCard.jsx'
import RecommendationReview from '../../components/RecommendationReview.jsx'
import { dropStep, feedInput, hideStep, isPathway, takeStep, toggleGoal, unhideStep, wordPathways } from '../nextState.js'
import { useStepsEngine } from '../useStepsEngine.js'
import { recordStepChoice, takeBackStepChoice } from '../../pilot/studyCounts.js'
import '../next.css'

export default function NextSteps({ lang, profile, focusHeading, onNavigate, notify, editMode = false, onReviewHistory = null }) {
  const c = copy[lang]
  const w = nextCopy(lang).next
  const T = c.screens.courses
  const L = LEARNING_PATH_COPY[lang]
  const { state, actions, derived } = profile
  const engine = useStepsEngine()
  const feed = useMemo(() => (engine ? engine.nextStepFeed(feedInput(state, derived.skills)) : null), [engine, state, derived.skills])
  const [details, setDetails] = useState(null)
  const [roadmapOf, setRoadmapOf] = useState(null)
  const roadmaps = useRoadmaps(Boolean(roadmapOf))
  const heading = useRef(null), feedHeading = useRef(null)
  const cardHeadings = useRef(new Map())
  const focusAfter = useRef(null)
  useEffect(() => { if (focusHeading) heading.current?.focus() }, [focusHeading])
  // A card that leaves the feed hands focus to the card that takes its place (or the next one up, or the feed's heading).
  useEffect(() => {
    if (focusAfter.current === null || !feed) return
    const index = Math.min(focusAfter.current, feed.cards.length - 1)
    focusAfter.current = null
    ;(index >= 0 ? cardHeadings.current.get(feed.cards[index].itemId) : feedHeading.current)?.focus()
  }, [feed])

  const toggle = goalId => {
    actions.setState(s => toggleGoal(s, goalId))
    // The old goal control's usage-log line (no goal in it).
    actions.log(lang === 'ar' ? 'تغيير الهدف' : 'Goal changed')
  }
  const leave = (card, change, message, undo, event) => {
    focusAfter.current = feed.cards.findIndex(other => other.itemId === card.itemId)
    actions.setState(change)
    // Task 44: the trial's count (only for an enrolled participant; nothing about the card itself).
    recordStepChoice(event, engine.NEXT_STEPS_VERSION)
    notify(message, { action: { label: w.undo, onClick: () => { actions.setState(undo); takeBackStepChoice(event) } } })
  }
  const take = card => leave(card, s => takeStep(s, card, { lang }), w.taken, s => dropStep(s, card.itemId, { lang }), 'step_taken')
  const hide = card => leave(card, s => hideStep(s, card.itemId), w.hidden, s => unhideStep(s, card.itemId), 'step_not_for_me')
  const Forward = lang === 'ar' ? ArrowLeft : ArrowRight
  const tick = (key, done) => actions.setState(s => tickRoadmapItem(s, key, done))
  // Task 79: why the feed is empty, and the pathways from the student's own words when no goal is chosen.
  const empty = !feed || feed.cards.length ? null
    : feed.reason ? 'no-goal' : feed.uncovered.length ? 'list-empty' : feed.handled ? 'handled' : 'no-gap'
  const wordsOnly = !normalizePlan(state).goals.length ? wordPathways(state) : []
  const gapNames = feed ? [...new Set(feed.uncovered.flatMap(u => u.capabilities))].map(cap => capabilityName(cap, lang)).join(lang === 'ar' ? '، ' : ', ') : ''
  const roadmapGoals = feed ? feed.goals.filter(isPathway) : []
  const opened = details && feed?.cards.find(card => card.itemId === details)
  const openedItem = opened && engine.catalogItem(opened.itemId)

  return <section className="ui2-page ui2-next" aria-labelledby="ui2-page-title" data-view="next" data-testid="ui2-page">
    {!editMode && <StepChip view="next" lang={lang} onNavigate={onNavigate}/>}
    <h1 id="ui2-page-title" tabIndex={-1} ref={heading}>{VIEW_TEXT.next.title[lang]}</h1>
    <p className="ui2-next-line">{VIEW_TEXT.next.line[lang]}</p>

    <GoalPicker lang={lang} state={state} matches={derived.matches} onToggle={toggle}/>

    <section className="ui2-feed" aria-labelledby="ui2-feed-title" data-testid="ui2-feed" aria-busy={!feed}>
      <h2 id="ui2-feed-title" tabIndex={-1} ref={feedHeading}>{L.steps}</h2>
      {!feed ? <Skeleton lang={lang} lines={4}/>
        : feed.cards.length ? <>
          <p className="ui2-feed-rule" data-testid="ui2-feed-rule">{T.rule}</p>
          <ul className="ui2-feed-list">{feed.cards.map(card => <li key={card.itemId}>
            <StepCard lang={lang} card={card} item={engine.catalogItem(card.itemId)} goals={feed.goals}
              ref={node => { if (node) cardHeadings.current.set(card.itemId, node); else cardHeadings.current.delete(card.itemId) }}
              onTake={() => take(card)} onHide={() => hide(card)} onDetails={() => setDetails(card.itemId)}/>
          </li>)}</ul>
        </>
          : <div className="ui2-feed-empty" data-testid="ui2-feed-empty" data-reason={empty}>
            {empty === 'no-goal' && <><p><strong>{feed.reason[lang]}</strong></p><p>{w.noGoalHint}</p></>}
            {empty === 'list-empty' && <><p><strong>{fillIn(w.listEmpty, { capabilities: gapNames })}</strong></p><p>{w.listEmptyHint}</p>{feed.handled > 0 && <p>{w.handledHint}</p>}</>}
            {empty === 'handled' && <><p><strong>{w.handled}</strong></p><p>{w.handledHint}</p></>}
            {empty === 'no-gap' && <><p><strong>{w.noGap}</strong></p><p>{w.noGapHint}</p></>}
            {empty !== 'no-goal' && wordsOnly.length > 0 && <div className="ui2-feed-words" data-testid="ui2-feed-words">
              <p>{w.wordsGoals}</p>
              <div className="ui2-feed-words-chips">{wordsOnly.map(pathway => <button key={pathway} type="button" className="ui2-chip" data-testid="ui2-make-goal" onClick={() => toggle(pathway)}>
                {fillIn(w.makeGoal, { path: goalName(pathway, lang) })}
              </button>)}</div>
            </div>}
          </div>}
      {feed && feed.uncovered.length > 0 && empty !== 'list-empty' && <p className="ui2-feed-uncovered" data-testid="ui2-feed-uncovered">
        {L.nothing} {gapNames}
      </p>}
      {roadmapGoals.length > 0 && <div className="ui2-feed-roadmaps" data-testid="ui2-feed-roadmaps">
        <p className="ui2-feed-roadmaps-title">{w.roadmaps}</p>
        <div className="ui2-feed-roadmaps-list">{roadmapGoals.map(goal => <button key={goal} type="button" className="ui2-btn" aria-haspopup="dialog" data-goal={goal} onClick={() => setRoadmapOf(goal)}>
          {fillIn(w.seeRoadmap, { path: goalName(goal, lang) })}
        </button>)}</div>
      </div>}
    </section>

    <div className="ui2-next-actions">
      {/* Task 66: opened from Profile's Edit (goals), the way on is "Back to Profile". */}
      {editMode
        ? <button type="button" className="ui2-btn ui2-btn-primary" onClick={() => onNavigate('profile')}>{nextCopy(lang).profile.backToProfile}</button>
        : <button type="button" className="ui2-btn ui2-btn-primary" onClick={() => onNavigate('plan')}>{w.toPlan}<Forward size={18} aria-hidden="true"/></button>}
    </div>

    {engine && <details className="ui2-next-technical">
      <summary>{w.technical}</summary>
      <p dir="ltr">{fillIn(w.method, { method: engine.NEXT_STEPS_VERSION })}</p>
    </details>}

    <Sheet open={Boolean(roadmapOf)} onClose={() => setRoadmapOf(null)} title={roadmapOf ? fillIn(nextCopy(lang).roadmap.title, { path: goalName(roadmapOf, lang) }) : ''} lang={lang}>
      {roadmapOf && (roadmaps ? <Roadmap lang={lang} data={roadmaps} pathwayId={roadmapOf} state={state} onTick={tick} level={3}/> : <Skeleton lang={lang} lines={5}/>)}
    </Sheet>

    <Sheet open={Boolean(opened)} onClose={() => setDetails(null)} title={openedItem?.title?.[lang] || ''} lang={lang}>
      {opened && <StepDetails lang={lang} card={opened} item={openedItem} skills={derived.skills} reviewed={engine.LIST_REVIEWED} onTake={() => { setDetails(null); take(opened) }}
        gaps={opened.forGoals.map(goal => engine.computeGap(derived.skills, goal))}/>}
      {opened && openedItem && <div className="ui2-legacy ui2-step-review" data-testid="ui2-step-review">
        <RecommendationReview key={opened.itemId} item={openedItem} kind="course" state={state} lang={lang} onSave={actions.saveRecommendationReview}/>
      </div>}
      {opened && onReviewHistory && <p className="ui2-step-history"><button type="button" className="ui2-text-btn" onClick={() => { setDetails(null); onReviewHistory() }}>{w.reviewHistory}</button></p>}
    </Sheet>
  </section>
}
