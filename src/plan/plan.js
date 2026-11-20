// Task 58 · goals and "My plan" as data the student can change at any time.
//
// Pure functions over the profile state. Nothing here reads courses, evidence or the ontology, and
// nothing here recomputes evidence: a plan item, a "not for me" mark and a goal are the student's own
// choices (goal signals), never evidence. Editing them never needs a transcript upload.
//
// State:
//   state.goal      the target pathway, kept equal to goals[0] for the old interface (or null)
//   state.goals     [targetId], at most 3, the first one is the main goal
//   state.plan      [{ itemId, action: 'take-course' | 'get-certificate', addedAt, status: 'planned' | 'done' }], at most 20
//   state.notForMe  [itemId], at most 100 (the oldest mark goes first when full)
//   state.planDropped  how many saved steps were dropped because the item left the list; shown once,
//                      as one line, the next time the plan opens (openPlan), then reset to 0
//
// Small and dependency-free apart from the copy: App.jsx needs normalizePlan at startup. The check
// against the learning list (which is not in the startup bundle) lives in src/plan/catalogCheck.js.
// Task 65: the changes only the new interface's step 4 and My plan make (add, done, not for me, more goals, the
// dropped-steps notice) moved unchanged to src/plan/planEdits.js. This file is in the startup bundle (the app
// normalises the plan at startup), and every function it exports is kept there; planEdits.js loads with the screens.
import { copy } from '../i18n.js'

export const PLAN_VERSION = 'kamin-plan-v1'
export const PLAN_MAX = 20
export const NOT_FOR_ME_MAX = 100
export const GOALS_MAX = 3
export const PLAN_ACTIONS = Object.freeze(['take-course', 'get-certificate'])
export const PLAN_STATUSES = Object.freeze(['planned', 'done'])

export const isId = value => typeof value === 'string' && /^[\w-]{1,64}$/.test(value)
const isDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
export const iso = now => new Date(now ?? Date.now()).toISOString()
const auditLine = (key, lang, now) => ({ label: (copy[lang] || copy.ar).plan[key], ts: now ?? Date.now() })
export const withAudit = (state, key, { lang = 'ar', now } = {}) => ({ ...state, audit: [auditLine(key, lang, now), ...(Array.isArray(state.audit) ? state.audit : [])].slice(0, 100) })

function cleanGoals(goals, goal) {
  const list = [...new Set((Array.isArray(goals) ? goals : []).filter(isId))].slice(0, GOALS_MAX)
  if (list.length) return list
  return isId(goal) ? [goal] : []
}

function cleanPlan(plan) {
  const seen = new Set()
  return (Array.isArray(plan) ? plan : []).flatMap(entry => {
    const { itemId, action, addedAt, status } = entry || {}
    if (!isId(itemId) || seen.has(itemId) || !PLAN_ACTIONS.includes(action) || !isDate(addedAt)) return []
    seen.add(itemId)
    return [{ itemId, action, addedAt, status: status === 'done' ? 'done' : 'planned' }]
  }).slice(0, PLAN_MAX)
}

function cleanNotForMe(list, plan) {
  const planned = new Set(plan.map(p => p.itemId))
  // A saved step wins over an old "not for me" mark for the same item.
  return [...new Set((Array.isArray(list) ? list : []).filter(isId))].filter(id => !planned.has(id)).slice(-NOT_FOR_ME_MAX)
}

/** The state with goal, goals, plan, notForMe and planDropped in their stored shape (anything else is dropped). */
export function normalizePlan(state) {
  const s = state && typeof state === 'object' ? state : {}
  const goals = cleanGoals(s.goals, s.goal)
  const plan = cleanPlan(s.plan)
  const dropped = Number.isInteger(s.planDropped) && s.planDropped > 0 ? Math.min(s.planDropped, PLAN_MAX) : 0
  return { ...s, goal: goals[0] ?? null, goals, plan, notForMe: cleanNotForMe(s.notForMe, plan), planDropped: dropped }
}

/** Only the plan fields, normalised (for the backup). */
export function planFields(state) {
  const { goal, goals, plan, notForMe } = normalizePlan(state)
  return { goal, goals, plan, notForMe }
}



/** Remove a saved step. Usage log: "Next step removed" (no title). Unknown items: unchanged, no log line. */
export function removeFromPlan(state, itemId, { lang = 'ar', now } = {}) {
  const s = normalizePlan(state)
  if (!s.plan.some(p => p.itemId === itemId)) return s
  return withAudit({ ...s, plan: s.plan.filter(p => p.itemId !== itemId) }, 'removed', { lang, now })
}


/**
 * The old interface's single goal control: replaces the main goal (goals[0]) and keeps the others;
 * null removes the main goal. goal stays equal to goals[0].
 */
export function chooseGoal(state, goalId) {
  const s = normalizePlan(state)
  if (goalId == null || goalId === '') return normalizePlan({ ...s, goals: s.goals.slice(1), goal: null })
  if (!isId(goalId)) throw new Error('INVALID_GOAL')
  const goals = [goalId, ...s.goals.slice(1).filter(id => id !== goalId)].slice(0, GOALS_MAX)
  return { ...s, goals, goal: goals[0] }
}


/**
 * Drop saved steps and "not for me" marks whose item is no longer offered (missing from the list or
 * retired). knownItemIds: the ids still offered. The number of dropped saved steps is kept in
 * planDropped for the one-line notice. Returns the same state object when nothing was dropped.
 */
export function dropMissingItems(state, knownItemIds) {
  const s = normalizePlan(state)
  const known = knownItemIds instanceof Set ? knownItemIds : new Set(knownItemIds || [])
  const plan = s.plan.filter(p => known.has(p.itemId))
  const marks = s.notForMe.filter(id => known.has(id))
  if (plan.length === s.plan.length && marks.length === s.notForMe.length) return state
  return { ...s, plan, notForMe: marks, planDropped: Math.min(PLAN_MAX, s.planDropped + s.plan.length - plan.length) }
}

