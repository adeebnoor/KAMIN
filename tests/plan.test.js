import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  PLAN_MAX, NOT_FOR_ME_MAX, GOALS_MAX,
  normalizePlan, planFields, removeFromPlan, chooseGoal, dropMissingItems,
} from '../src/plan/plan.js'
// Task 65: the changes only the new interface makes moved unchanged to planEdits.js (plan.js is in the startup bundle).
import { addToPlan, markDone, notForMe, undoNotForMe, addGoal, removeGoal, canAddToPlan, isInPlan, planNotice, openPlan } from '../src/plan/planEdits.js'
import { checkPlanItems, offeredItemIds, planItemTitle } from '../src/plan/catalogCheck.js'
import learningCatalog from '../src/catalog/learning-opportunities.json' with { type: 'json' }
import { profileSkills } from '../src/utils/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { emptyInsightState } from '../src/insight.js'
import { normalizeDigitalInterests } from '../src/digitalInterests.js'
import { cleanAuditEntries } from '../src/utils/auditPrivacy.js'
import { normalizeRecommendationReviews } from '../src/review/recommendations.js'
import { normalizeProjectEvidence } from '../src/utils/projectEvidence.js'
import { normalizeTaskProgress } from '../src/tasks/progress.js'
import { normalizeCredentialRecords } from '../src/credentials/records.js'
import { normalizeCollege, cleanTranscriptText } from '../src/catalog/colleges.js'
import { mergeNeedsReview } from '../src/evidence/needsReview.js'
import { demoCourses } from '../src/data.js'
import * as appProfileState from '../src/state/profileState.js'

// Task 58 · goals and My plan: the student's own choices, editable at any time, never evidence.
const NOW = Date.parse('2026-11-18T09:00:00.000Z')
const base = () => ({ approved: true, college: 'FCIT', goal: null, courses: demoCourses.map(c => ({ ...c })), consents: { analyze: true, insight: true, advisor: false, research: false }, insight: emptyInsightState(), audit: [] })
const item = (itemId, action = 'take-course', status = 'planned') => ({ itemId, action, addedAt: '2026-11-18T09:00:00.000Z', status })
const titles = learningCatalog.items.flatMap(i => [i.title.ar, i.title.en])

// The app's own blankState, normalizeState and hasMeaningfulProfileState. Task 59 moved them from src/App.jsx
// to src/state/profileState.js (exported, shared by both interfaces) and the profile actions to
// src/state/useKaminProfile.js; the source checks below read the files the code now lives in.
const appState = appProfileState
const readSource = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const app = readSource('src/App.jsx')
const profileHook = readSource('src/state/useKaminProfile.js')
const profileStateSource = readSource('src/state/profileState.js')

describe('Task 58 · the stored shape', () => {
  it('a blank or old state gets empty lists; an old single goal becomes goals [goal]', () => {
    expect(normalizePlan({})).toMatchObject({ goal: null, goals: [], plan: [], notForMe: [], planDropped: 0 })
    expect(normalizePlan(null)).toMatchObject({ goal: null, goals: [], plan: [], notForMe: [] })
    expect(normalizePlan({ goal: 'data' })).toMatchObject({ goal: 'data', goals: ['data'] })
  })

  it('goal is always goals[0] (the old interface reads goal)', () => {
    expect(normalizePlan({ goal: 'data', goals: ['cyber', 'data'] })).toMatchObject({ goal: 'cyber', goals: ['cyber', 'data'] })
    expect(normalizePlan({ goal: 'data', goals: [] })).toMatchObject({ goal: 'data', goals: ['data'] })
  })

  it('limits: 20 saved steps, 100 "not for me" marks (newest kept), 3 goals; duplicates and malformed entries dropped', () => {
    const many = Array.from({ length: 25 }, (_, i) => item(`item-${i}`))
    expect(normalizePlan({ plan: many }).plan).toHaveLength(PLAN_MAX)
    const marks = Array.from({ length: 120 }, (_, i) => `mark-${i}`)
    const kept = normalizePlan({ notForMe: marks }).notForMe
    expect(kept).toHaveLength(NOT_FOR_ME_MAX)
    expect(kept[0]).toBe('mark-20')
    expect(normalizePlan({ goals: ['a', 'b', 'c', 'd', 'a'] }).goals).toEqual(['a', 'b', 'c'])
    expect(GOALS_MAX).toBe(3)
    const messy = normalizePlan({
      goals: ['data', 'data', 7, '<script>', 'x'.repeat(65)],
      plan: [item('capm', 'get-certificate'), item('capm'), { ...item('a'), action: 'buy' }, { ...item('b'), addedAt: 'yesterday' }, { ...item('c'), status: 'weird' }, item('urn:kamin:x'), null, 'capm'],
      notForMe: ['pmp', 'pmp', '', 3, 'capm'],
      planDropped: -2,
    })
    expect(messy.goals).toEqual(['data'])
    expect(messy.plan).toEqual([item('capm', 'get-certificate'), item('c')])
    expect(messy.notForMe).toEqual(['pmp']) // a saved step wins over an old mark for the same item
    expect(messy.planDropped).toBe(0)
  })

  it('stored entries hold only the four fields (no title, no score)', () => {
    const s = addToPlan(base(), { itemId: 'fcit-cpit-340', action: 'take-course' }, { now: NOW })
    expect(Object.keys(s.plan[0]).sort()).toEqual(['action', 'addedAt', 'itemId', 'status'])
    expect(s.plan[0]).toEqual({ itemId: 'fcit-cpit-340', action: 'take-course', addedAt: '2026-11-18T09:00:00.000Z', status: 'planned' })
  })
})

describe('Task 58 · editing the plan', () => {
  it('addToPlan saves a step with the usage-log line "Next step saved" and no title', () => {
    const en = addToPlan(base(), { itemId: 'fcit-cpit-340', action: 'take-course' }, { lang: 'en', now: NOW })
    expect(en.audit[0]).toEqual({ label: 'Next step saved', ts: NOW })
    const ar = addToPlan(base(), { itemId: 'capm', action: 'get-certificate' }, { lang: 'ar', now: NOW })
    expect(ar.audit[0].label).toBe('حُفظت خطوة تالية')
    expect(isInPlan(ar, 'capm')).toBe(true)
  })

  it('adding again changes the action, never duplicates; it lifts a "not for me" mark', () => {
    let s = notForMe(base(), 'capm')
    s = addToPlan(s, { itemId: 'capm', action: 'take-course' }, { now: NOW })
    s = addToPlan(s, { itemId: 'capm', action: 'get-certificate' }, { now: NOW + 1 })
    expect(s.plan).toEqual([{ itemId: 'capm', action: 'get-certificate', addedAt: '2026-11-18T09:00:00.000Z', status: 'planned' }])
    expect(s.notForMe).toEqual([])
  })

  it('a full plan (20) is returned unchanged; a step already in it can still be changed', () => {
    const full = { ...base(), plan: Array.from({ length: PLAN_MAX }, (_, i) => item(`item-${i}`)) }
    expect(canAddToPlan(full, 'capm')).toBe(false)
    expect(canAddToPlan(full, 'item-3')).toBe(true)
    expect(addToPlan(full, { itemId: 'capm', action: 'get-certificate' }).plan).toHaveLength(PLAN_MAX)
    expect(addToPlan(full, { itemId: 'capm', action: 'get-certificate' }).plan.some(p => p.itemId === 'capm')).toBe(false)
    expect(addToPlan(full, { itemId: 'item-3', action: 'get-certificate' }).plan[3].action).toBe('get-certificate')
  })

  it('bad input is refused', () => {
    expect(() => addToPlan(base(), { itemId: 'capm', action: 'buy-it' })).toThrow('INVALID_PLAN_ITEM')
    expect(() => addToPlan(base(), { itemId: 'urn:kamin:item', action: 'take-course' })).toThrow('INVALID_PLAN_ITEM')
    expect(() => notForMe(base(), '')).toThrow('INVALID_PLAN_ITEM')
    expect(() => chooseGoal(base(), 'a b')).toThrow('INVALID_GOAL')
  })

  it('markDone and back', () => {
    let s = addToPlan(base(), { itemId: 'fcit-cpit-340', action: 'take-course' }, { now: NOW })
    s = markDone(s, 'fcit-cpit-340')
    expect(s.plan[0].status).toBe('done')
    expect(markDone(s, 'fcit-cpit-340', false).plan[0].status).toBe('planned')
    expect(markDone(s, 'unknown').plan).toEqual(s.plan)
  })

  it('removeFromPlan logs "Next step removed" without a title; an unknown step changes nothing', () => {
    const s = addToPlan(base(), { itemId: 'fcit-cpit-340', action: 'take-course' }, { now: NOW })
    const removed = removeFromPlan(s, 'fcit-cpit-340', { lang: 'en', now: NOW + 5 })
    expect(removed.plan).toEqual([])
    expect(removed.audit[0]).toEqual({ label: 'Next step removed', ts: NOW + 5 })
    expect(removeFromPlan(s, 'fcit-cpit-340', { lang: 'ar' }).audit[0].label).toBe('أُزيلت خطوة تالية')
    expect(removeFromPlan(s, 'nothing-here').audit).toHaveLength(1)
  })

  it('"not for me" hides an item, removes it from the plan, and can be undone; the oldest mark goes first when full', () => {
    let s = addToPlan(base(), { itemId: 'capm', action: 'get-certificate' }, { now: NOW })
    s = notForMe(s, 'capm')
    expect(s.plan).toEqual([])
    expect(s.notForMe).toEqual(['capm'])
    expect(undoNotForMe(s, 'capm').notForMe).toEqual([])
    let full = { ...base(), notForMe: Array.from({ length: NOT_FOR_ME_MAX }, (_, i) => `mark-${i}`) }
    full = notForMe(full, 'pmp')
    expect(full.notForMe).toHaveLength(NOT_FOR_ME_MAX)
    expect(full.notForMe[0]).toBe('mark-1')
    expect(full.notForMe.at(-1)).toBe('pmp')
  })

  it('no usage-log line ever holds an item title', () => {
    let s = base()
    for (const i of learningCatalog.items) s = addToPlan(s, { itemId: i.id, action: i.kind === 'certificate' ? 'get-certificate' : 'take-course' }, { lang: 'en' })
    for (const i of learningCatalog.items) s = removeFromPlan(s, i.id, { lang: 'ar' })
    const labels = s.audit.map(a => a.label).join('\n')
    for (const title of titles) expect(labels).not.toContain(title)
    expect(new Set(s.audit.map(a => a.label))).toEqual(new Set(['Next step saved', 'أُزيلت خطوة تالية']))
  })
})

describe('Task 58 · goals', () => {
  it("chooseGoal (the old interface's chips) changes the main goal and keeps goal === goals[0]", () => {
    let s = chooseGoal(base(), 'data')
    expect(s).toMatchObject({ goal: 'data', goals: ['data'] })
    s = chooseGoal(s, 'cyber')
    expect(s).toMatchObject({ goal: 'cyber', goals: ['cyber'] }) // with one goal the old behaviour is unchanged
    s = addGoal(s, 'job-data-analyst')
    s = chooseGoal(s, 'management')
    expect(s).toMatchObject({ goal: 'management', goals: ['management', 'job-data-analyst'] })
    s = chooseGoal(s, 'job-data-analyst') // already a goal: it becomes the main one, never twice
    expect(s).toMatchObject({ goal: 'job-data-analyst', goals: ['job-data-analyst'] })
    expect(chooseGoal(s, null)).toMatchObject({ goal: null, goals: [] })
    expect(chooseGoal({ ...base(), goals: ['a', 'b'] }, '')).toMatchObject({ goal: 'b', goals: ['b'] })
  })

  it('more than one path: addGoal up to 3, removeGoal; goal follows goals[0]', () => {
    let s = addGoal(addGoal(addGoal(base(), 'job-data-analyst'), 'job-cyber-analyst'), 'training-ai-work')
    expect(s.goals).toEqual(['job-data-analyst', 'job-cyber-analyst', 'training-ai-work'])
    expect(addGoal(s, 'job-business-analyst').goals).toHaveLength(3)
    expect(addGoal(s, 'job-cyber-analyst').goals).toHaveLength(3)
    s = removeGoal(s, 'job-data-analyst')
    expect(s).toMatchObject({ goal: 'job-cyber-analyst', goals: ['job-cyber-analyst', 'training-ai-work'] })
    expect(removeGoal(removeGoal(s, 'job-cyber-analyst'), 'training-ai-work')).toMatchObject({ goal: null, goals: [] })
  })
})

describe('Task 58 · items that left the learning list', () => {
  it('are dropped (plan and marks) and counted once for a one-line notice the next time the plan opens', () => {
    const s = { ...base(), plan: [item('fcit-cpit-340'), item('gone-1'), item('gone-2')], notForMe: ['capm', 'gone-3'] }
    const checked = dropMissingItems(s, new Set(['fcit-cpit-340', 'capm']))
    expect(checked.plan.map(p => p.itemId)).toEqual(['fcit-cpit-340'])
    expect(checked.notForMe).toEqual(['capm'])
    expect(checked.planDropped).toBe(2)
    const opened = openPlan(checked, 'en')
    expect(opened.notice).toBe('2 saved steps were removed because they are no longer in the list.')
    expect(opened.state.planDropped).toBe(0)
    expect(openPlan(opened.state, 'en').notice).toBeNull() // once only
    expect(planNotice(1, 'en')).toBe('A saved step was removed because it is no longer in the list.')
    expect(planNotice(1, 'ar')).toBe('أُزيلت خطوة محفوظة لأنها لم تعد في القائمة.')
    expect(planNotice(3, 'ar')).toBe('أُزيلت 3 خطوات محفوظة لأنها لم تعد في القائمة.')
    expect(planNotice(0, 'en')).toBeNull()
    for (const lang of ['ar', 'en']) expect(planNotice(2, lang)).not.toMatch(/\n|urn:kamin|gone-/)
  })

  it('nothing missing: the same state object (no re-render, no notice)', () => {
    const s = { ...base(), plan: [item('fcit-cpit-340')], notForMe: ['capm'] }
    expect(checkPlanItems(s)).toBe(s)
  })

  it('with the real list: retired and unknown items go, offered ones stay', () => {
    const offered = offeredItemIds()
    expect(offered.has('fcit-cpit-340')).toBe(true)
    expect(offered.has('ba')).toBe(false) // retired in Task 36: kept for history, never offered
    const s = { ...base(), plan: [item('fcit-cpit-340'), item('ba'), item('no-such-item')], notForMe: ['sql', 'pmp'] }
    const checked = checkPlanItems(s)
    expect(checked.plan.map(p => p.itemId)).toEqual(['fcit-cpit-340'])
    expect(checked.notForMe).toEqual(['pmp'])
    expect(checked.planDropped).toBe(2)
    expect(planItemTitle('fcit-cpit-340')).toEqual({ ar: expect.any(String), en: 'Database (II)' })
    expect(planItemTitle('no-such-item')).toBeNull()
  })

  it('the learning list stays out of the startup bundle: plan.js does not import it, the app loads the check on demand', () => {
    const plan = readFileSync('src/plan/plan.js', 'utf8')
    expect(plan.match(/^import .*$/gm)).toEqual(["import { copy } from '../i18n.js'"])
    // Task 59: the check runs in the shared profile hook (was App.jsx).
    expect(profileHook).toContain("import('../plan/catalogCheck.js')")
    for (const source of [app, profileHook, profileStateSource]) expect(source).not.toMatch(/^import .*catalogCheck/m)
    expect(profileStateSource).toMatch(/^import \{ normalizePlan \} from '\.\.\/plan\/plan\.js'$/m)
    expect(profileHook).toMatch(/^import \{ chooseGoal as chooseGoalIn \} from '\.\.\/plan\/plan\.js'$/m)
  })
})

describe('Task 58 · never evidence, never a transcript upload', () => {
  it('editing goals, plan and marks leaves courses, capabilities and the evidence graph exactly as they were', () => {
    const before = base()
    const skillsBefore = JSON.stringify(profileSkills(before))
    // The academic claims without their generation time (the projector stamps the current time).
    const academic = state => JSON.stringify(projectStateToPerson360({ state, skills: profileSkills(state) }).claims
      .filter(c => ['kamin:studied', 'kamin:demonstrates', 'kamin:verifiedBy'].includes(c.predicate))
      .map(({ generatedAtTime, ...claim }) => claim))
    const claimsBefore = academic(before)
    let s = addToPlan(before, { itemId: 'fcit-cpit-340', action: 'take-course' }, { now: NOW })
    s = addToPlan(s, { itemId: 'capm', action: 'get-certificate' }, { now: NOW })
    s = markDone(notForMe(s, 'pmp'), 'capm')
    s = addGoal(chooseGoal(s, 'data'), 'job-cyber-analyst')
    expect(s.courses).toBe(before.courses)
    expect(s.approved).toBe(true)
    expect(JSON.stringify(profileSkills(s))).toBe(skillsBefore)
    expect(academic(s)).toBe(claimsBefore)
    expect(claimsBefore).toContain('kamin:studied')
  })

  it('works without any transcript (no courses, not approved)', () => {
    const empty = { goal: null, courses: [], approved: false, audit: [] }
    let s = addToPlan(empty, { itemId: 'capm', action: 'get-certificate' }, { now: NOW })
    s = addGoal(notForMe(s, 'pmp'), 'job-data-analyst')
    expect(s).toMatchObject({ courses: [], approved: false, goal: 'job-data-analyst', notForMe: ['pmp'] })
    expect(s.plan).toHaveLength(1)
  })

  it('plan.js reads nothing from evidence, courses or the ontology', () => {
    // Task 65: the same for planEdits.js, which holds the changes moved out of plan.js.
    for (const file of ['src/plan/plan.js', 'src/plan/planEdits.js']) {
      const src = readFileSync(file, 'utf8').replace(/^\/\/.*$/gm, '')
      expect(src, file).not.toMatch(/courses|recompute|profileSkills|ontology|evidenceLevel/)
    }
    // planEdits.js imports only the copy and plan.js (so it never brings the learning list or evidence along).
    expect(readFileSync('src/plan/planEdits.js', 'utf8').match(/^import .*$/gm)).toEqual(["import { copy } from '../i18n.js'", "import { GOALS_MAX, NOT_FOR_ME_MAX, PLAN_ACTIONS, PLAN_MAX, isId, iso, normalizePlan, withAudit } from './plan.js'"])
  })
})

describe("Task 58 · the app's own state (src/App.jsx)", () => {
  it('blankState has empty goals, plan and marks; normalizeState keeps goal === goals[0]', () => {
    const { blankState, normalizeState } = appState
    expect(blankState).toMatchObject({ goal: null, goals: [], plan: [], notForMe: [], planDropped: 0 })
    expect(normalizeState(null)).toMatchObject({ goal: null, goals: [], plan: [], notForMe: [] })
    expect(normalizeState({ goal: 'data' })).toMatchObject({ goal: 'data', goals: ['data'] }) // a session saved before Task 58
    expect(normalizeState({ goal: 'data', goals: ['cyber', 'data'] })).toMatchObject({ goal: 'cyber', goals: ['cyber', 'data'] })
  })

  it('a session with saved steps and marks comes back identical (keep on this device / reload)', () => {
    const { normalizeState } = appState
    let s = normalizeState(base())
    s = addToPlan(s, { itemId: 'fcit-cpit-340', action: 'take-course' }, { now: NOW })
    s = addToPlan(s, { itemId: 'capm', action: 'get-certificate' }, { now: NOW })
    s = addGoal(chooseGoal(notForMe(s, 'pmp'), 'data'), 'job-cyber-analyst')
    const back = normalizeState(JSON.parse(JSON.stringify(s)))
    expect(planFields(back)).toEqual(planFields(s))
    expect(back.goal).toBe('data')
  })

  it('a profile holding only goals, steps or marks is still saved to the session', () => {
    const { hasMeaningfulProfileState } = appState
    expect(hasMeaningfulProfileState({ goals: [], plan: [], notForMe: [] })).toBe(false)
    expect(hasMeaningfulProfileState({ plan: [item('capm')] })).toBe(true)
    expect(hasMeaningfulProfileState({ notForMe: ['capm'] })).toBe(true)
    expect(hasMeaningfulProfileState({ goals: ['data'] })).toBe(true)
  })

  it("the old goal chips save through plan.js's chooseGoal", () => {
    expect(profileHook).toContain('const chooseGoal = goal => { setState(s=>chooseGoalIn(s,goal));') // Task 59: in the shared hook
  })
})
