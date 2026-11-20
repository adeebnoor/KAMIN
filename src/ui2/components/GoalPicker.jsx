// Task 65 · "Where do you want to go?": the student's goals, shared by step 4 (src/ui2/screens/NextSteps.jsx) and My
// plan (src/ui2/screens/Plan.jsx). Goals are pathways (Task 58: at most 3, the first is the main one). Without a goal
// the chips show at once: first the pathways the student's own words point to (Task 56, only with the interests
// consent), then every pathway in the order the matching engine gives (matchTargets). With goals, they sit at the top
// as removable chips and "Change goals" shows the chips again. While the chips are open their order stays fixed, so a
// tap never moves a chip under the finger.
// "Why these paths?" opens a sheet with each pathway's judgment in words and its one reason (the old Matches list,
// src/components/MatchList.jsx, with the same sentences), and, on demand, its reference, what supports it, its gaps
// and the count of evidence paths ("a count, not a score"). No score, no percentage.
// Task 74: on My plan (`withPlan`), an opened pathway also offers the old Matches row's "Open this pathway’s plan": the
// old development plan (src/plan/developmentPlan.jsx, the same code and words as "Show connections" → "Development
// plan"), its four steps and its text download, in the old panel (inside .ui2-legacy, as Profile's reused parts).
import { useId, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { copy, fill } from '../../i18n.js'
import { pageHref } from '../../../public/site-content.js'
import { normalizePlan } from '../../plan/plan.js'
import { opportunityStatus } from '../../market/localOpportunities.js'
import { MATCH_GROUPS, groupMatches, matchReason } from '../../utils/matchReason.js'
import { PATHWAY_COPY } from '../../content/pathwayCopy.js'
import { fillIn, nextCopy } from '../copy.js'
import { goalsFull, isPathway, pathwayTitle, wordPathways } from '../nextState.js'
import Chip from '../Chip.jsx'
import Sheet from '../Sheet.jsx'
import HelpPageLink from '../HelpPageLink.jsx'
import { DevelopmentPlanPanel } from '../../plan/developmentPlan.jsx'

// A goal's name: a pathway's title, or one of the old interface's four directions (its label), never an id.
export const goalName = (id, lang) => pathwayTitle(id, lang) || copy[lang].app.goals[id] || null

function PathRow({ item, lang, open, onToggle, planState = null }) {
  const S = copy[lang].screens.matches
  const w = nextCopy(lang).next
  const id = useId()
  const [plan, setPlan] = useState(false)
  return <li className="ui2-path" data-testid="ui2-path">
    <h4 className="ui2-path-title"><button type="button" className="ui2-path-toggle" aria-expanded={open} aria-controls={`${id}-panel`} onClick={onToggle}>
      <span>{item.title[lang]}</span><ChevronDown size={16} aria-hidden="true"/>
    </button></h4>
    <p className="ui2-path-meta">{S.type[item.type] || item.subtitle[lang]} · <strong>{PATHWAY_COPY.judgment[item.judgment][lang]}</strong></p>
    <p className="ui2-path-reason" data-testid="ui2-path-reason">{matchReason(item, lang).text}</p>
    <div className="ui2-path-details" id={`${id}-panel`} hidden={!open} data-testid="ui2-path-details">
      {item.source && <p><a href={item.source.url.startsWith('/') ? pageHref(item.source.url, lang) : item.source.url}>{PATHWAY_COPY.reference[lang]}: {item.source.title}</a> · {item.source.checked}<br/>{PATHWAY_COPY.provisional[lang]}</p>}
      <p className="ui2-path-head">{S.supports}</p>
      <ul>{item.supportingMechanisms.map((line, i) => <li key={i}>{line}</li>)}</ul>
      {item.limitingMechanisms.length > 0 && <><p className="ui2-path-head">{PATHWAY_COPY.limits[lang]}</p><ul>{item.limitingMechanisms.map((line, i) => <li key={i}>{line}</li>)}</ul></>}
      <p className="ui2-path-count">{item.graphTrace ? fill(S.pathCount, { n: item.graphTrace.evidencePathCount, total: item.graphTrace.requiredCapabilities }) : S.noScore}</p>
      {planState && <>
        <button type="button" className="ui2-text-btn" aria-expanded={plan} aria-controls={`${id}-plan`} onClick={() => setPlan(shown => !shown)}>{w.openPlan}</button>
        {plan && <section className="ui2-legacy ui2-path-plan" id={`${id}-plan`} aria-label={w.planTitle} data-testid="ui2-development-plan">
          <DevelopmentPlanPanel lang={lang} match={item} state={planState}/>
        </section>}
      </>}
    </div>
  </li>
}

// The pathways, grouped as the old Matches list groups them (fits, fits with conditions, not for now).
export function PathwaysSheet({ open, onClose, lang, matches, planState = null }) {
  const S = copy[lang].screens.matches
  const w = nextCopy(lang).next
  const [openId, setOpenId] = useState(null)
  const groups = groupMatches(matches)
  return <Sheet open={open} onClose={onClose} title={w.pathsTitle} lang={lang}>
    <div className="ui2-paths" data-testid="ui2-paths">
      {MATCH_GROUPS.filter(group => groups[group].length).map(group => <section key={group} aria-label={S.groups[group]}>
        <h3>{S.groups[group]} ({groups[group].length})</h3>
        <ul>{groups[group].map(item => <PathRow key={item.id} item={item} lang={lang} planState={planState} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)}/>)}</ul>
      </section>)}
      <p className="ui2-paths-note" data-testid="ui2-opportunity-note">{opportunityStatus().note[lang]}</p>
      {/* Task 68: the matching Help page. */}
      <HelpPageLink lang={lang} page="guide"/>
    </div>
  </Sheet>
}

export default function GoalPicker({ lang, state, matches = [], onToggle, withPlan = false }) {
  const w = nextCopy(lang).next
  const id = useId()
  const goals = normalizePlan(state).goals
  const words = wordPathways(state).filter(pathway => !goals.includes(pathway))
  // Open at once when nothing guides the feed yet (no chosen goal, no pathway from the student's words).
  // (Removing the last goal shows them again; a tap on a chip keeps them open until Done, so up to 3 can be picked.)
  const [chosenOpen, setPicking] = useState(false)
  const picking = chosenOpen || (!goals.some(isPathway) && !words.length)
  const [sheet, setSheet] = useState(false)
  const order = useRef(null)
  const ids = matches.map(item => item.id)
  if (picking && !order.current) order.current = ids
  if (!picking) order.current = null
  const fixed = (order.current || ids).filter(pathway => ids.includes(pathway))
  const full = goalsFull(state)
  const fromWords = wordPathways(state)
  const chip = pathway => <Chip key={pathway} selected={goals.includes(pathway)} disabled={full && !goals.includes(pathway)} onClick={() => { setPicking(true); onToggle(pathway) }}>{goalName(pathway, lang)}</Chip>
  return <section className="ui2-goals" aria-labelledby={`${id}-title`} data-testid="ui2-goals">
    <h2 id={`${id}-title`}>{w.yourGoals}</h2>
    {goals.length > 0 && <ul className="ui2-goal-list" aria-labelledby={`${id}-title`}>
      {goals.map(goal => <li key={goal}>
        <button type="button" className="ui2-chip ui2-goal-chip" aria-label={fillIn(w.removeGoal, { goal: goalName(goal, lang) || goal })} onClick={() => onToggle(goal)}>
          {goalName(goal, lang) || goal}<X size={14} aria-hidden="true"/>
        </button>
      </li>)}
    </ul>}
    {words.length > 0 && <p className="ui2-goal-words">{fillIn(w.alsoWords, { paths: words.map(pathway => goalName(pathway, lang)).join(lang === 'ar' ? '، ' : ', ') })}</p>}
    {picking
      ? <fieldset className="ui2-goal-picker" aria-describedby={`${id}-hint`}>
        <legend>{w.where}</legend>
        <p className="ui2-goal-hint" id={`${id}-hint`}>{full ? w.full : w.pickUpTo}</p>
        {fromWords.length > 0 && <div role="group" aria-label={w.fromWords}><span className="ui2-goal-group">{w.fromWords}</span>{fixed.filter(pathway => fromWords.includes(pathway)).map(chip)}</div>}
        <div role="group" aria-label={w.allPaths}>{fromWords.length > 0 && <span className="ui2-goal-group">{w.allPaths}</span>}{fixed.filter(pathway => !fromWords.includes(pathway)).map(chip)}</div>
        {goals.some(isPathway) && <button type="button" className="ui2-btn" onClick={() => setPicking(false)}>{w.done}</button>}
      </fieldset>
      : <button type="button" className="ui2-text-btn" onClick={() => setPicking(true)}>{w.changeGoals}</button>}
    <button type="button" className="ui2-text-btn ui2-goal-about" aria-haspopup="dialog" onClick={() => setSheet(true)}>{w.aboutPaths}</button>
    <PathwaysSheet open={sheet} onClose={() => setSheet(false)} lang={lang} matches={matches} planState={withPlan ? state : null}/>
  </section>
}
