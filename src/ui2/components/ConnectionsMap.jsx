// Task 75 · Profile → My map is the old interface's "Show connections" graph, the supervisor's map (Amjd, 2026-11-19: Task
// 74's layered map "is not acceptable"; "reuse it as it was, with its look and behaviour"). Loaded only when the student
// opens My map (lazy, from Profile.jsx). Everything inside is the old code from src/components/ShowConnections.jsx, shared
// with the old interface's "Show connections" tab: "Pathway to explore", the relationship network with its four questions,
// nodes, legend and inspector, the inference proof, "My profile dimensions", "Edit my interests & goal" and "Academic
// evidence path to the opportunity". It sits inside .ui2-legacy like every reused old part (light: the old colours; dark:
// src/ui2/legacy-dark.css).
// - The pathway starts at the student's first goal when that goal is a pathway (Task 58's My plan), else the old default.
// - A tap on a capability node selects it, as in the old graph, and opens Profile's reasons sheet when it is one of the
//   student's capabilities (`onCapability`).
// - "Edit my interests & goal" opens step 3 (interests) in edit mode, where the old button went (the interests view).
import { useState } from 'react'
import ShowConnections, { PathwayControls } from '../../components/ShowConnections.jsx'
import { planStatus } from '../../plan/developmentPlan.jsx'
import { normalizePlan } from '../../plan/plan.js'

export const DEFAULT_PATHWAY = 'job-data-analyst'

/** The pathway the map opens at: the first chosen goal that is a pathway, else the old studio's default. */
export function firstPathway(state, matches = []) {
  const goals = normalizePlan(state).goals
  return goals.find(id => matches.some(match => match.id === id)) || DEFAULT_PATHWAY
}

export default function ConnectionsMap({ lang, state, matches, graph, skills, onCapability, onGoal }) {
  const [targetId, setTargetId] = useState(() => firstPathway(state, matches))
  const match = matches.find(m => m.id === targetId) || matches[0]
  const mine = new Set(skills.map(skill => skill.id))
  const openCapability = id => { if (mine.has(id)) onCapability(id) }
  return <div className="ui2-legacy ui2-connections" data-testid="ui2-map">
    <PathwayControls lang={lang} matches={matches} match={match} status={planStatus(state, lang)} onChange={setTargetId}/>
    <ShowConnections lang={lang} state={state} match={match} graph={graph} onGoal={onGoal} onCapability={openCapability}/>
  </div>
}
