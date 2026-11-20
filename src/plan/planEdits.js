// Task 58 · goals and "My plan": the changes the student makes (moved unchanged from src/plan/plan.js in Task 65).
// Pure functions over the profile state, like plan.js: nothing here reads courses, evidence or the ontology. They
// live apart from plan.js because plan.js is in the startup bundle; these load only with the screens that use them
// (the new interface's step 4 and My plan).
import { copy } from '../i18n.js'
import { GOALS_MAX, NOT_FOR_ME_MAX, PLAN_ACTIONS, PLAN_MAX, isId, iso, normalizePlan, withAudit } from './plan.js'

export const isInPlan = (state, itemId) => normalizePlan(state).plan.some(p => p.itemId === itemId)
export const canAddToPlan = (state, itemId) => isInPlan(state, itemId) || normalizePlan(state).plan.length < PLAN_MAX

/**
 * Save "take this course" / "get this certificate". An item already in the plan keeps its place (its
 * action is updated); a "not for me" mark on it is lifted. A full plan (20) is returned unchanged.
 * Usage log: "Next step saved" (no title).
 */
export function addToPlan(state, { itemId, action } = {}, { lang = 'ar', now } = {}) {
  const s = normalizePlan(state)
  if (!isId(itemId) || !PLAN_ACTIONS.includes(action)) throw new Error('INVALID_PLAN_ITEM')
  const existing = s.plan.find(p => p.itemId === itemId)
  if (!existing && s.plan.length >= PLAN_MAX) return s
  const plan = existing
    ? s.plan.map(p => (p === existing ? { ...p, action } : p))
    : [...s.plan, { itemId, action, addedAt: iso(now), status: 'planned' }]
  return withAudit({ ...s, plan, notForMe: s.notForMe.filter(id => id !== itemId) }, 'saved', { lang, now })
}

/** Mark a saved step done (or back to planned with done = false). Unknown items: unchanged. */
export function markDone(state, itemId, done = true) {
  const s = normalizePlan(state)
  return { ...s, plan: s.plan.map(p => (p.itemId === itemId ? { ...p, status: done ? 'done' : 'planned' } : p)) }
}

/** "Not for me": the feed stops showing the item; a saved step for it is removed from the plan. */
export function notForMe(state, itemId) {
  const s = normalizePlan(state)
  if (!isId(itemId)) throw new Error('INVALID_PLAN_ITEM')
  const list = [...s.notForMe.filter(id => id !== itemId), itemId].slice(-NOT_FOR_ME_MAX)
  return { ...s, plan: s.plan.filter(p => p.itemId !== itemId), notForMe: list }
}

export function undoNotForMe(state, itemId) {
  const s = normalizePlan(state)
  return { ...s, notForMe: s.notForMe.filter(id => id !== itemId) }
}

/** Add another goal (at most 3; a full list or a goal already there: unchanged). */
export function addGoal(state, goalId) {
  const s = normalizePlan(state)
  if (!isId(goalId)) throw new Error('INVALID_GOAL')
  if (s.goals.includes(goalId) || s.goals.length >= GOALS_MAX) return s
  const goals = [...s.goals, goalId]
  return { ...s, goals, goal: goals[0] }
}

export function removeGoal(state, goalId) {
  const s = normalizePlan(state)
  const goals = s.goals.filter(id => id !== goalId)
  return { ...s, goals, goal: goals[0] ?? null }
}

/** The one-line notice for dropped steps, or null. */
export function planNotice(count, lang = 'ar') {
  if (!Number.isInteger(count) || count <= 0) return null
  const text = (copy[lang] || copy.ar).plan
  return count === 1 ? text.droppedOne : text.droppedMany.replace('{n}', String(count))
}

/** Opening the plan shows the notice once: returns it and the state with planDropped reset. */
export function openPlan(state, lang = 'ar') {
  const s = normalizePlan(state)
  return { state: s.planDropped ? { ...s, planDropped: 0 } : s, notice: planNotice(s.planDropped, lang) }
}
