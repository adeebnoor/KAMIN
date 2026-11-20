// Task 65 · step 4 (the next-steps feed) and My plan: pure changes the screens apply with actions.setState (the shared
// hook is not changed). The work is Task 58's src/plan/plan.js (goals, plan, "not for me"); this file only names the
// student's actions and reads what the feed needs. Nothing here reads or changes evidence: a goal, a saved step and a
// "not for me" mark are the student's own choices.
import { normalizePlan, removeFromPlan, GOALS_MAX } from '../plan/plan.js'
import { addGoal, addToPlan, notForMe, removeGoal, undoNotForMe } from '../plan/planEdits.js'
import { normalizeFreeInterests } from '../interests/freeInterestState.js'
import { targetProfiles } from '../matching/targets.js'

export { GOALS_MAX }
const TARGETS = new Map(targetProfiles.map(target => [target.id, target]))
export const isPathway = id => TARGETS.has(id)
export const pathwayTitle = (id, lang) => TARGETS.get(id)?.title?.[lang] || null

// "Take this course" for a course or a university course, "Get this certificate" for a certificate.
export const actionFor = kind => (kind === 'certificate' ? 'get-certificate' : 'take-course')

/** A tap on a goal chip: chosen → removed; otherwise added (at most 3; a full list is returned unchanged). */
export function toggleGoal(state, goalId) {
  const s = normalizePlan(state)
  return s.goals.includes(goalId) ? removeGoal(s, goalId) : addGoal(s, goalId)
}
export const goalsFull = state => normalizePlan(state).goals.length >= GOALS_MAX

/** "Take this course" / "Get this certificate": the card's item goes into My plan (usage log: "Next step saved", no title). */
export const takeStep = (state, card, options) => addToPlan(state, { itemId: card.itemId, action: actionFor(card.kind) }, options)
/** Undo of Take, and Remove in My plan (usage log: "Next step removed", no title). */
export const dropStep = (state, itemId, options) => removeFromPlan(state, itemId, options)
/** Undo of Remove in My plan: the step goes back where it was, with its date and status. */
export function restoreStep(state, entry, index) {
  const s = normalizePlan(state)
  if (s.plan.some(p => p.itemId === entry.itemId)) return s
  const plan = [...s.plan]
  plan.splice(Math.max(0, Math.min(index, plan.length)), 0, entry)
  return normalizePlan({ ...s, plan, notForMe: s.notForMe.filter(id => id !== entry.itemId) })
}
export const hideStep = (state, itemId) => notForMe(state, itemId)
export const unhideStep = (state, itemId) => undoNotForMe(state, itemId)

/** The pathways the student's own words point to (Task 56; only with the interests consent): the same rule as the feed's feedGoals. */
export function wordPathways(state) {
  if (!state?.consents?.insight) return []
  return [...new Set(normalizeFreeInterests(state.insight?.freeInterests)
    .flatMap(entry => entry.understood.filter(chip => chip.kind === 'pathway' && !chip.removed).map(chip => chip.id)))].filter(isPathway)
}

/** What nextStepFeed (src/path/nextSteps.js, Task 57) needs from the profile. Free interests only with the interests consent. */
export function feedInput(state, skills) {
  const s = normalizePlan(state)
  return {
    skills,
    goalIds: s.goals,
    freeInterests: state?.consents?.insight ? state.insight?.freeInterests || [] : [],
    plan: s.plan,
    notForMe: s.notForMe,
    takenCourses: (state?.courses || []).map(course => course.code).filter(Boolean),
  }
}

/** The first sentence of a reason (a card shows one; Details shows them all). */
export function firstSentence(text) {
  const clean = String(text || '').trim()
  const match = clean.match(/^.*?[.!?؟](?=\s|$)/)
  return match ? match[0] : clean
}
