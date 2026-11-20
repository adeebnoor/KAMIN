// Task 59 · the pure profile helpers moved from src/App.jsx to src/state/profileState.js, and the shared
// profile hook (src/state/useKaminProfile.js) that the old and the new interface both use.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  STORAGE_KEY, LEGACY_SESSION_KEY, LEGACY_STORAGE_KEY, blankState, normalizeState, hasMeaningfulProfileState,
  getSaved, hasSessionCopy, normalizeCourseCode, isMappedCourse,
} from '../src/state/profileState.js'
import { createMemoryStorage } from './helpers/fakeIndexedDb.js'
import { emptyInsightState } from '../src/insight.js'
import { copy } from '../src/i18n.js'

const read = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const NOW = '2026-11-18T09:00:00.000Z'

describe('Task 59 · blankState', () => {
  it('has every field empty, no college, no consent and no saving on the device', () => {
    expect(blankState).toMatchObject({
      courses: [], approved: false, goal: null, goals: [], plan: [], notForMe: [], planDropped: 0,
      consents: { analyze: false, insight: false, advisor: false, research: false },
      audit: [], recommendationReviews: [], projects: [], tasks: [], credentials: [],
      college: null, collegeRaw: null, major: null, needsReview: [], localPersistence: false,
    })
    expect(blankState.insight).toEqual(emptyInsightState())
  })
  it('keeps the session key the earlier tasks wrote (old sessions still load)', () => {
    expect([STORAGE_KEY, LEGACY_SESSION_KEY, LEGACY_STORAGE_KEY]).toEqual(['kamin-session-v3', 'kamin-pilot-session-v2', 'kamin-pilot-v1'])
  })
})

describe('Task 59 · normalizeState', () => {
  it('nothing, or not an object, gives a fresh blank state (new objects, never the shared blankState)', () => {
    for (const value of [null, undefined, 'text', 42]) {
      const s = normalizeState(value)
      expect(s).toMatchObject({ courses: [], approved: false, college: null, goals: [], plan: [] })
      expect(s.consents).not.toBe(blankState.consents)
      expect(s.audit).not.toBe(blankState.audit)
    }
  })

  it('an old profile (before goals, plan, college text, free interests) loads with the new fields empty', () => {
    // Shaped like a session saved before Tasks 04, 46, 55, 56 and 58: one goal, no college, no lists.
    const old = { approved: true, goal: 'data', courses: [{ code: 'CPIT-240', name: 'Database Management', grade: 'B+', source: 'pdf' }], consents: { analyze: true } }
    const s = normalizeState(old)
    expect(s.courses).toEqual(old.courses)
    expect(s).toMatchObject({ approved: true, goal: 'data', goals: ['data'], plan: [], notForMe: [], college: null, collegeRaw: null, major: null, localPersistence: false })
    expect(s.consents).toEqual({ analyze: true, insight: false, advisor: false, research: false })
    expect(s.insight.freeInterests).toEqual([])
    expect(s.insight.responses).toEqual({})
    for (const list of ['audit', 'recommendationReviews', 'projects', 'tasks', 'credentials', 'needsReview']) expect(s[list], list).toEqual([])
  })

  it('an unknown college is "not chosen" (null), never FCIT by default; the printed text is cleaned', () => {
    expect(normalizeState({ college: 'NOT-A-COLLEGE' }).college).toBeNull()
    expect(normalizeState({ college: 'FCIT' }).college).toBe('FCIT')
    expect(normalizeState({ collegeRaw: '  COMPUTING & INFO. TECH.  ', major: '' })).toMatchObject({ collegeRaw: 'COMPUTING & INFO. TECH.', major: null })
  })

  it('Task 46: old usage-log lines that copied a file name or a project title are dropped on load', () => {
    const audit = [
      { label: 'Local file read: Transcript_TEST-NAME_0000001.pdf', ts: 3 },
      { label: 'قراءة ملف محلي: كشف_اسم_تجريبي.pdf', ts: 2 },
      { label: 'Self-declared applied evidence recorded: TEST PROJECT TITLE', ts: 1 },
      { label: 'تسجيل دليل تطبيقي مصرّح: عنوان تجريبي', ts: 1 },
      { label: copy.en.screens.myData.auditUpload, ts: 4 },
      { label: 'Transcript analysis consent granted and record approved', ts: 5 },
      null,
      'not an entry',
    ]
    const s = normalizeState({ audit })
    expect(s.audit.map(e => e.label)).toEqual([copy.en.screens.myData.auditUpload, 'Transcript analysis consent granted and record approved'])
    expect(JSON.stringify(s)).not.toMatch(/TEST-NAME|TEST PROJECT TITLE|كشف_اسم|عنوان تجريبي/)
    expect(normalizeState({ audit: 'not a list' }).audit).toEqual([])
  })

  it('Task 58: goals, plan and marks are kept; goal always equals goals[0]; bad entries are dropped', () => {
    const plan = [{ itemId: 'fcit-cpit-340', action: 'take-course', addedAt: NOW, status: 'planned' }, { itemId: 'bad id!', action: 'take-course', addedAt: NOW, status: 'planned' }]
    const s = normalizeState({ goal: 'data', goals: ['cyber', 'data'], plan, notForMe: ['pmp', '<script>'] })
    expect(s.goal).toBe('cyber')
    expect(s.goals).toEqual(['cyber', 'data'])
    expect(s.plan).toEqual([plan[0]])
    expect(s.notForMe).toEqual(['pmp'])
    expect(normalizeState({ goal: null, goals: [] })).toMatchObject({ goal: null, goals: [] })
  })

  it('a saved profile survives the session round trip unchanged (reload)', () => {
    const s = normalizeState({
      approved: true, college: 'FCIT', collegeRaw: 'COMPUTING & INFO. TECH.', major: 'INFORMATION TECHNOLOGY', goal: 'data',
      courses: [{ code: 'CPIT-240', name: 'Database Management', grade: 'B+', source: 'pdf' }],
      consents: { analyze: true, insight: true }, localPersistence: true,
      plan: [{ itemId: 'capm', action: 'get-certificate', addedAt: NOW, status: 'done' }], notForMe: ['pmp'],
      audit: [{ label: 'Goal changed', ts: 1 }],
    })
    expect(normalizeState(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })
})

describe('Task 59 · hasMeaningfulProfileState (what is worth a session copy)', () => {
  it('a blank state is not; any one thing the student did is', () => {
    expect(hasMeaningfulProfileState(normalizeState(null))).toBe(false)
    expect(hasMeaningfulProfileState(null)).toBe(false)
    for (const patch of [
      { approved: true }, { courses: [{ code: 'CPIT-240' }] }, { projects: [{}] }, { tasks: [{}] }, { credentials: [{}] },
      { goal: 'data' }, { goals: ['data'] }, { plan: [{}] }, { notForMe: ['pmp'] }, { localPersistence: true },
      { consents: { insight: true } }, { insight: { declaredPreferences: { work: 'team' } } }, { audit: [{}] }, { recommendationReviews: [{}] },
    ]) expect(hasMeaningfulProfileState({ ...normalizeState(null), ...patch }), JSON.stringify(patch)).toBe(true)
  })
})

describe('Task 59 · getSaved (reading the session copy)', () => {
  let session, local
  beforeEach(() => {
    session = createMemoryStorage(); local = createMemoryStorage()
    vi.stubGlobal('sessionStorage', session); vi.stubGlobal('localStorage', local)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('no copy: a blank state, and no session copy is reported', () => {
    expect(getSaved()).toEqual(normalizeState(null))
    expect(hasSessionCopy()).toBe(false)
  })
  it('the session copy is read through normalizeState', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ approved: true, goal: 'data', audit: [{ label: 'Local file read: x.pdf', ts: 1 }] }))
    expect(getSaved()).toMatchObject({ approved: true, goal: 'data', goals: ['data'], audit: [] })
    expect(hasSessionCopy()).toBe(true)
  })
  it('an older pilot copy moves to the current key once, and the old keys are removed', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ goal: 'cyber' }))
    expect(getSaved()).toMatchObject({ goal: 'cyber', goals: ['cyber'] })
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY))).toEqual({ goal: 'cyber' })
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull()
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify({ approved: true }))
    expect(hasSessionCopy()).toBe(true)
    expect(getSaved().approved).toBe(true)
    expect(sessionStorage.getItem(LEGACY_SESSION_KEY)).toBeNull()
  })
  it('a broken copy or a blocked storage gives the blank state, never an error', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not json')
    expect(getSaved()).toBe(blankState)
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('SecurityError') } })
    expect(getSaved()).toBe(blankState)
    expect(hasSessionCopy()).toBe(false)
  })
})

describe('Task 59 · course codes in the upload summary', () => {
  it('normalizes spacing and case, and counts only mapped courses', () => {
    expect(normalizeCourseCode(' cpit 240 ')).toBe('CPIT-240')
    expect(normalizeCourseCode('CPIT240')).toBe('CPIT-240')
    expect(isMappedCourse('cpit 240')).toBe(true)
    expect(isMappedCourse('XYZ-999')).toBe(false)
    expect(isMappedCourse(null)).toBe(false)
  })
})

describe('Task 59 · one profile engine for both interfaces', () => {
  const app = read('src/App.jsx')
  const hook = read('src/state/useKaminProfile.js')
  const stateFile = read('src/state/profileState.js')

  it('App.jsx no longer holds the profile helpers or actions; it uses the hook', () => {
    for (const moved of ['const blankState', 'const normalizeState', 'const getSaved', 'const hasMeaningfulProfileState =', "'kamin-session-v3'", 'const applyRecompute', 'readLocalProfile', 'writeLocalProfile', 'clearLocalProfile', 'sessionStorage.setItem', 'import(\'./evidence/recompute.js\')', 'import(\'./utils/portableProfile.js\')', 'import(\'./utils/transcript.js\')']) {
      expect(app, moved).not.toContain(moved)
    }
    expect(app).toMatch(/^import \{ useKaminProfile \} from '\.\/state\/useKaminProfile\.js'$/m)
    expect(app).toContain('useKaminProfile({ lang, pilot, entry,')
  })

  it('the hook exports useKaminProfile and returns state, derived, draft and actions', () => {
    expect(hook).toMatch(/^export function useKaminProfile\(\{ lang, pilot = false, entry = 'default', onRestored \} = \{\}\)/m)
    expect(hook).toMatch(/derived: \{ skills, recs, matches, personGraph, matchProfile, educationClassification \}/)
    for (const key of ['state,', 'draft: {', 'actions: {']) expect(hook).toContain(key)
    for (const action of ['upload', 'approve', 'saveMyData', 'undoMyData', 'changeCollege', 'chooseGoal', 'exportClr', 'exportProfile', 'importProfile', 'changePersistence', 'deleteAll', 'deleteOne', 'saveProject', 'saveCredential']) {
      expect(hook, action).toMatch(new RegExp(`actions: \\{[\\s\\S]*\\b${action}\\b[\\s\\S]*\\n    \\},`))
    }
  })

  it('actions never pick a view, show a message or move focus (the interface decides)', () => {
    const code = hook.replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/\bsetView\b|\bsetNotice\b|replaceView|\.focus\(|useAppHistory|useNotice|document\.querySelector/)
    expect(code).not.toMatch(/from '\.\.\/components\//) // no screen code in the engine
  })

  it('the pure helpers hold no React and no screen code; the heavy modules stay lazy', () => {
    expect(stateFile).not.toMatch(/from 'react'|\.jsx'/)
    for (const lazyModule of ['../utils/transcript.js', '../evidence/recompute.js', '../utils/portableProfile.js', '../utils/dataControl.js', '../plan/catalogCheck.js', '../pilot/syntheticTranscripts.js', '../utils/clrExport.js']) {
      expect(hook, lazyModule).toContain(`import('${lazyModule}')`)
      expect(hook, lazyModule).not.toMatch(new RegExp(`^import .* from '${lazyModule.replace(/[./]/g, '\\$&')}'`, 'm'))
    }
  })
})
