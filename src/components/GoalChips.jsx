import { useState } from 'react'
import { Target } from 'lucide-react'
import { copy, fill } from '../i18n.js'
import { targetProfiles } from '../matching/targets.js'

// Task 65: a goal chosen in the new interface is a pathway; it is named by its title, never by its id.
const pathwayTitle = (goal, lang) => targetProfiles.find(target => target.id === goal)?.title[lang] || goal

// Task 24 · one goal control, one look, everywhere: the dashboard's "next step" card, My next step →
// Matches and → Courses. Every chip saves through the same chooseGoal (state.goal), so a goal chosen in
// one place shows in the others at once.
export default function GoalChips({ lang, goal, onChoose }) {
  const goals = copy[lang].app.goals
  return <div className="goal-options">{Object.entries(goals).map(([id, label]) => <button key={id} type="button" className={goal === id ? 'active' : ''} aria-pressed={goal === id} onClick={() => onChoose(id)}><Target size={15}/>{label}</button>)}</div>
}

// Without a goal: a short prompt and the chips. With a goal: "Your goal: … · Change" (Change shows the
// chips again). Task 23 introduced it on Matches; Task 24 shares it with Courses.
export function GoalPicker({ lang, goal, onChoose, testId, prompt = null }) {
  const S = copy[lang].screens.matches
  const goals = copy[lang].app.goals
  const [changing, setChanging] = useState(false)
  if (goal && !changing) return <p className="match-goal-current goal-current" data-testid={testId}><Target size={16} aria-hidden="true"/><span>{fill(S.goalCurrent, { goal: goals[goal] || pathwayTitle(goal, lang) })}</span><button type="button" className="text-button" onClick={() => setChanging(true)}>{S.changeGoal}</button></p>
  return <div className="match-goal goal-picker" data-testid={testId}><p>{prompt || S.goalPrompt}</p><GoalChips lang={lang} goal={goal} onChoose={id => { onChoose(id); setChanging(false) }}/></div>
}
