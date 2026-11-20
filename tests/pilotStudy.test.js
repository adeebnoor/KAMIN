// Task 18 · the trial, browser-only: consent first, a local queue, an anonymous study file, withdrawal.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  STUDY_KEY, LEGACY_PILOT_KEYS, MAX_EVENTS, PILOT_EVENT_NAMES, readStudy, trackPilotEvent,
  clearPilotLocalData, pilotModeOn, noteSyntheticTranscript, roundToMinute,
} from '../src/utils/pilotAnalytics.js'
// Task 44: joining, the form, the file and withdrawal moved out of the startup bundle (same functions).
import { STUDY_TASKS, joinStudy, saveStudyFeedback, buildStudyFile, studyFileName, withdrawFromStudy, personalDataInComment } from '../src/pilot/studyFile.js'
import {
  COUNT_EVENTS, COUNTS_CONSENT_VERSIONS, projectSuggestionCounts, recordCount, recordProjectSuggestions, recordStepChoice, summarizeCounts, takeBackStepChoice,
} from '../src/pilot/studyCounts.js'
import { PROJECT_SUGGEST_IMPROVED_VERSION as ENGINE, suggestCapabilities } from '../src/ai/projectSuggestImproved.js'
import { skills as catalog } from '../src/data.js'
import { createHash } from 'node:crypto'
import { PILOT_CONSENT, PILOT_COPY } from '../src/content/pilotConsent.js'
import { syntheticTranscript, SYNTHETIC_TRANSCRIPTS } from '../src/pilot/syntheticTranscripts.js'
import { catalogCourse } from '../src/catalog/fcit.js'

import { validate as check } from './helpers/miniJsonSchema.js'

const schema = JSON.parse(readFileSync('src/pilot/study-file.schema.json', 'utf8'))
const validate = value => check(value, schema)
const STUDY_SCHEMA_ID = schema.properties.schema.const

class MemoryStorage {
  constructor() { this.map = new Map() }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
  get length() { return this.map.size }
  key(i) { return [...this.map.keys()][i] ?? null }
}
const at = (h, m, s = 0) => new Date(Date.UTC(2026, 11, 1, h, m, s, 123))
const join = (storage, now = at(9, 0, 41)) => joinStudy({ consent: true, consentVersion: PILOT_CONSENT.version, lang: 'en', now, storage })

describe('pilot mode', () => {
  it('is off for normal users: no flag, no enrolment', () => {
    expect(pilotModeOn({ search: '', storage: new MemoryStorage() })).toBe(false)
    expect(pilotModeOn({ search: '?lang=en&start=profile', storage: new MemoryStorage() })).toBe(false)
  })
  it('turns on with ?pilot=1, or while a participant is enrolled', () => {
    expect(pilotModeOn({ search: '?pilot=1', storage: new MemoryStorage() })).toBe(true)
    const storage = new MemoryStorage(); join(storage)
    expect(pilotModeOn({ search: '', storage })).toBe(true)
  })
  it('records nothing before consent', () => {
    const storage = new MemoryStorage()
    expect(trackPilotEvent('landing', { storage })).toEqual({ recorded: false, record: null })
    expect(storage.length).toBe(0)
    expect(() => joinStudy({ consent: false, consentVersion: PILOT_CONSENT.version, storage })).toThrow('STUDY_CONSENT_REQUIRED')
    expect(() => saveStudyFeedback({}, { storage })).toThrow('STUDY_CONSENT_REQUIRED')
    expect(() => buildStudyFile({ storage })).toThrow('STUDY_CONSENT_REQUIRED')
  })
})

describe('the local queue', () => {
  it('joining stores the consent version, a random study code and a time rounded to the minute', () => {
    const storage = new MemoryStorage()
    const study = join(storage)
    expect(study.studyCode).toMatch(/^K-[A-HJ-NP-Z2-9]{6}$/)
    expect(study.consentVersion).toBe(PILOT_CONSENT.version)
    expect(study.joinedAt).toBe('2026-12-01T09:00:00.000Z')
    expect(study.events).toEqual([{ event: 'study_joined', at: '2026-12-01T09:00:00.000Z' }])
    expect(join(storage).studyCode).toBe(study.studyCode) // joining twice keeps the same session
  })
  it('only allowlisted events, with times rounded to the minute, at most 200', () => {
    const storage = new MemoryStorage(); join(storage)
    expect(() => trackPilotEvent('transcript_contents', { storage })).toThrow('PILOT_EVENT_NOT_ALLOWED')
    expect(trackPilotEvent('upload_started', { now: at(9, 7, 59), storage }).record).toEqual({ event: 'upload_started', at: '2026-12-01T09:07:00.000Z' })
    for (let i = 0; i < MAX_EVENTS + 20; i++) trackPilotEvent('landing', { now: at(10, 0), storage })
    expect(readStudy(storage).events).toHaveLength(MAX_EVENTS)
    expect(roundToMinute('2026-12-01T09:59:59.999Z')).toBe('2026-12-01T09:59:00.000Z')
  })
  it('the form keeps only the six task outcomes, one clarity answer and a comment without personal data', () => {
    const storage = new MemoryStorage(); join(storage)
    const saved = saveStudyFeedback({ tasks: { 'build-profile': 'success', 'find-evidence': 'with-help', 'save-and-restore': 'failed', 'choose-learning-step': 'A+', extra: 'x' }, clarity: 4, comment: '  The compare button was hard to find.  ' }, { storage })
    expect(saved.tasks).toEqual({ 'build-profile': 'success', 'find-evidence': 'with-help', 'understand-recommendation': null, 'choose-learning-step': null, 'save-and-restore': 'failed', 'correct-withdraw-delete': null })
    expect(saved.comment).toBe('The compare button was hard to find.')
    expect(() => saveStudyFeedback({ clarity: 7 }, { storage })).toThrow('STUDY_CLARITY_INVALID')
    expect(() => saveStudyFeedback({ comment: 'mail me at sara@example.com' }, { storage })).toThrow('STUDY_COMMENT_PERSONAL_DATA')
    expect(() => saveStudyFeedback({ comment: 'my id is 2134567' }, { storage })).toThrow('STUDY_COMMENT_PERSONAL_DATA')
    expect(personalDataInComment('050 123 4567')).toEqual(['number'])
    expect(personalDataInComment('Task 3 took 2 tries')).toEqual([])
  })
})

describe('the anonymous study file', () => {
  const fullSession = () => {
    const storage = new MemoryStorage(); join(storage)
    const record = syntheticTranscript()
    noteSyntheticTranscript(record.id, { now: at(9, 2), storage })
    for (const event of ['upload_started', 'upload_completed', 'profile_completed']) trackPilotEvent(event, { now: at(9, 5, 30), storage })
    saveStudyFeedback({ tasks: Object.fromEntries(STUDY_TASKS.map(id => [id, 'success'])), clarity: 5, comment: 'Clear overall.' }, { now: at(9, 30), storage })
    return { storage, record, file: buildStudyFile({ now: at(9, 31, 12), storage }) }
  }
  it('validates against src/pilot/study-file.schema.json', () => {
    const { file } = fullSession()
    expect(validate(file)).toEqual([])
    expect(file.transcript).toBe('fcit-synthetic-a-v1')
    expect(file.exportedAt).toBe('2026-12-01T09:31:00.000Z')
    expect(studyFileName(file)).toBe(`kamin-study-${file.studyCode}.json`)
  })
  it('the schema itself refuses grades, courses, names and unrounded times (checker self-test)', () => {
    const { file } = fullSession()
    expect(validate({ ...file, grade: 'A' })).toContain('$.grade: not allowed')
    expect(validate({ ...file, courses: [] })).toContain('$.courses: not allowed')
    expect(validate({ ...file, events: [{ event: 'upload_started', at: '2026-12-01T09:05:30.000Z' }] })).toContain('$.events[0].at: pattern')
    expect(validate({ ...file, events: [{ event: 'upload_started', at: '2026-12-01T09:05:00.000Z', course: 'CPIT-240' }] })).toContain('$.events[0].course: not allowed')
  })
  it('contains no grade, course code or course name from the transcript the participant used', () => {
    const { file, record } = fullSession()
    const text = JSON.stringify(file)
    for (const course of record.courses) {
      expect(text).not.toContain(course.code)
      expect(text).not.toContain(course.name.en)
      expect(text).not.toContain(course.name.ar)
    }
    const grades = new Set(record.courses.map(c => c.grade))
    const values = JSON.stringify(file, (k, v) => (k === 'comment' ? undefined : v))
    for (const g of grades) expect(values).not.toMatch(new RegExp(`"${g.replace('+', '\\+')}"`))
    expect(Object.keys(file).sort()).toEqual(Object.keys(schema.properties).sort())
  })
  it('even a tampered queue cannot add fields to the file', () => {
    const { storage } = fullSession()
    const raw = JSON.parse(storage.getItem(STUDY_KEY))
    storage.setItem(STUDY_KEY, JSON.stringify({ ...raw, name: 'Sara', courses: [{ code: 'CPIT-240', grade: 'A' }], events: [...raw.events, { event: 'landing', at: '2026-12-01T09:40:13.000Z', grade: 'A' }] }))
    const file = buildStudyFile({ now: at(9, 45), storage })
    expect(validate(file)).toEqual([])
    expect(JSON.stringify(file)).not.toMatch(/Sara|CPIT-240/)
  })
})

describe('withdrawing', () => {
  it('deletes the local queue and any older pilot keys; nothing is recorded afterwards', () => {
    const storage = new MemoryStorage(); join(storage)
    for (const key of LEGACY_PILOT_KEYS) storage.setItem(key, '[]')
    storage.setItem('kamin-lang', 'en')
    expect(withdrawFromStudy({ storage })).toEqual({ withdrawn: true, left: [] })
    expect(storage.getItem(STUDY_KEY)).toBeNull()
    for (const key of LEGACY_PILOT_KEYS) expect(storage.getItem(key)).toBeNull()
    expect(storage.getItem('kamin-lang')).toBe('en')
    expect(trackPilotEvent('landing', { storage }).recorded).toBe(false)
    expect(pilotModeOn({ search: '', storage })).toBe(false)
  })
  it('"delete everything" in the app can keep the study queue until the session ends', () => {
    const storage = new MemoryStorage(); join(storage)
    storage.setItem(LEGACY_PILOT_KEYS[0], '[]')
    clearPilotLocalData({ keepStudy: true, storage })
    expect(readStudy(storage)).not.toBeNull()
    expect(storage.getItem(LEGACY_PILOT_KEYS[0])).toBeNull()
    clearPilotLocalData({ storage })
    expect(readStudy(storage)).toBeNull()
  })
  it('Task 44: "delete everything" still removes the suggestion and step counts; the study record and its funnel events stay', () => {
    const storage = new MemoryStorage(); join(storage)
    recordProjectSuggestions({ suggested: ['a', 'b', 'c'], saved: ['a', 'b', 'd'], engine: ENGINE }, { now: at(9, 5), storage })
    recordStepChoice('step_taken', 'kamin-next-steps-v1', { now: at(9, 6), storage })
    trackPilotEvent('profile_completed', { now: at(9, 7), storage })
    expect(readStudy(storage).events.some(e => COUNT_EVENTS.includes(e.event))).toBe(true)
    clearPilotLocalData({ keepStudy: true, storage })
    const kept = readStudy(storage)
    expect(kept).not.toBeNull()
    expect(kept.events.map(e => e.event)).toEqual(['study_joined', 'profile_completed'])
    const file = buildStudyFile({ now: at(9, 30), storage })
    expect(validate(file)).toEqual([])
    expect(file.suggestions).toMatchObject({ shown: 0, kept: 0, unticked: 0, addedByHand: 0, saved: 0, stepsTaken: 0, keptOfShown: null })
  })
})

describe('synthetic transcript and consent text', () => {
  it('the trial transcript is synthetic, uses real FCIT catalog codes and is labelled synthetic in the app', () => {
    const record = syntheticTranscript()
    expect(record.college).toBe('FCIT')
    expect(record.courses.length).toBeGreaterThanOrEqual(6)
    for (const course of record.courses) {
      expect(course.source).toBe('demo')
      expect(catalogCourse(course.code), course.code).not.toBeNull()
      expect(course.name.ar && course.name.en).toBeTruthy()
    }
    expect(SYNTHETIC_TRANSCRIPTS.every(t => /^[a-z0-9-]{1,60}$/.test(t.id))).toBe(true)
    expect(() => syntheticTranscript('missing')).toThrow('SYNTHETIC_TRANSCRIPT_NOT_FOUND')
  })
  it('the consent text exists in both languages, says voluntary, on this device, and how to withdraw', () => {
    expect(PILOT_CONSENT.version).toMatch(new RegExp(schema.properties.consentVersion.pattern))
    // Changed on 2026-11-11: the supervisor approved the text, so it is versioned as v1 and dated.
    // Changed on 2026-11-19 (Task 44): v2 adds the point on suggestion counts, approved under Amjd's standing approval
    // of 2026-11-18; tests/pilotStudy.test.js 'Task 44' checks that v1's sentences are all still there.
    expect(PILOT_CONSENT).toMatchObject({ approved: true, approvedOn: '2026-11-19', version: 'pilot-consent-v2-2026-11-19' })
    for (const lang of ['ar', 'en']) {
      const c = PILOT_CONSENT[lang]
      expect(c.points.length).toBeGreaterThanOrEqual(5)
      expect(c.draftNotice).toBeTruthy()
      for (const id of STUDY_TASKS) expect(PILOT_COPY[lang].tasks[id]).toBeTruthy()
    }
    expect(PILOT_CONSENT.en.points.join(' ')).toMatch(/voluntary/i)
    expect(PILOT_CONSENT.en.points.join(' ')).toMatch(/not sent to any server/i)
    expect(PILOT_CONSENT.en.points.join(' ')).toMatch(/Withdraw from the study/)
    expect(PILOT_CONSENT.ar.points.join(' ')).toMatch(/طوعية/)
  })
  it('every event name the app can record is in the schema', () => {
    // Task 44: the funnel events (startup) and the count events (src/pilot/studyCounts.js), together, are the schema's list.
    expect([...PILOT_EVENT_NAMES, ...COUNT_EVENTS].sort()).toEqual([...schema.properties.events.items.properties.event.enum].sort())
  })
})

// ---------- Task 44 · how students use the suggestions: counts only, never text ----------
describe('Task 44 · suggestion and step counts in the trial', () => {
  const V1 = 'pilot-consent-v1-2026-11-11'
  const STEPS = 'kamin-next-steps-v1'
  const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
  const joinV1 = storage => joinStudy({ consent: true, consentVersion: V1, lang: 'en', now: at(9, 0), storage })
  // A made-up project (no person, no real work), run through the engine the app uses.
  const PROJECT = { title: 'Meeting room booking app (made up)', description: 'A web app to book meeting rooms with a React front end, a REST API and a PostgreSQL database; I also wrote unit tests.' }
  const KEYS = ['at', 'count', 'engine', 'event']

  it('consent v2 keeps every v1 sentence word for word and adds one point that names the counts', () => {
    expect(COUNTS_CONSENT_VERSIONS).toContain(PILOT_CONSENT.version)
    expect(COUNTS_CONSENT_VERSIONS).not.toContain(V1)
    // sha256 of v1's points (git show bd370dc:src/content/pilotConsent.js): the six sentences are unchanged.
    const v1 = { ar: '929153e6dd7d5e10bf044c851a269534376036390153d4cf55497c282982cc68', en: 'cd2ae91517aef149324aa209fed8ae4af6ed2bb23707a415c8cc4e19dfe0bc4c' }
    for (const lang of ['ar', 'en']) {
      expect(PILOT_CONSENT[lang].points).toHaveLength(7)
      expect(sha(PILOT_CONSENT[lang].points.filter((_, i) => i !== 4)), lang).toBe(v1[lang])
    }
    expect(PILOT_CONSENT.en.points[4]).toMatch(/counts how you used the suggestions/)
    expect(PILOT_CONSENT.en.points[4]).toMatch(/never your project text or the skills and courses themselves/)
    expect(PILOT_CONSENT.ar.points[4]).toMatch(/أرقام وإصدار طريقة الاقتراح فقط/)
  })

  it('not enrolled: nothing is recorded and nothing is stored', () => {
    const storage = new MemoryStorage()
    expect(recordCount('suggest_shown', 3, ENGINE, { storage })).toEqual({ recorded: false, record: null })
    expect(recordProjectSuggestions({ suggested: ['web-development'], saved: ['web-development'], engine: ENGINE }, { storage })).toMatchObject({ shown: 1, kept: 1 })
    expect(recordStepChoice('step_taken', STEPS, { storage }).recorded).toBe(false)
    expect(takeBackStepChoice('step_taken', { storage })).toBe(false)
    expect(storage.length).toBe(0)
  })

  it('agreed to consent v1 (which does not name the counts): no count is recorded and the file says suggestions: null', () => {
    const storage = new MemoryStorage(); joinV1(storage)
    expect(recordCount('suggest_kept', 2, ENGINE, { storage }).recorded).toBe(false)
    recordStepChoice('step_taken', STEPS, { storage })
    expect(readStudy(storage).events.map(e => e.event)).toEqual(['study_joined'])
    // Even a count written into a v1 queue by hand never reaches the file.
    const raw = JSON.parse(storage.getItem(STUDY_KEY))
    storage.setItem(STUDY_KEY, JSON.stringify({ ...raw, events: [...raw.events, { event: 'suggest_kept', at: '2026-12-01T09:05:00.000Z', count: 2, engine: ENGINE }] }))
    const file = buildStudyFile({ now: at(9, 10), storage })
    expect(file.suggestions).toBeNull()
    expect(file.events.map(e => e.event)).toEqual(['study_joined'])
    expect(validate(file)).toEqual([])
  })

  it('a saved project gives four counts: shown, kept, unticked, added by hand (an edit does not count its old skills again)', () => {
    expect(projectSuggestionCounts({ suggested: ['a', 'b', 'c'], saved: ['a', 'b', 'd'] })).toEqual({ shown: 3, kept: 2, unticked: 1, addedByHand: 1 })
    expect(projectSuggestionCounts({ suggested: ['a', 'a'], saved: ['a'] })).toEqual({ shown: 1, kept: 1, unticked: 0, addedByHand: 0 })
    expect(projectSuggestionCounts({ suggested: ['a'], saved: ['a', 'x', 'y'], before: ['x'] })).toEqual({ shown: 1, kept: 1, unticked: 0, addedByHand: 1 })
    expect(projectSuggestionCounts({ suggested: [], saved: [] })).toEqual({ shown: 0, kept: 0, unticked: 0, addedByHand: 0 })
  })

  it('no event contains free text: the description, the snippets, the title and the skills never reach the queue or the file', () => {
    const storage = new MemoryStorage(); join(storage)
    const result = suggestCapabilities(PROJECT.description)
    const ids = result.suggestions.map(s => s.skillId)
    expect(ids.length, 'the made-up project gets suggestions').toBeGreaterThanOrEqual(2)
    // The student unticks the first suggestion and adds one skill by hand, then saves.
    const byHand = Object.values(catalog).map(s => s.id).find(id => !ids.includes(id))
    const counts = recordProjectSuggestions({ suggested: ids, saved: [...ids.slice(1), byHand], engine: result.version }, { now: at(9, 12, 40), storage })
    expect(counts).toEqual({ shown: ids.length, kept: ids.length - 1, unticked: 1, addedByHand: 1 })
    recordStepChoice('step_taken', STEPS, { now: at(9, 20), storage })
    recordStepChoice('step_not_for_me', STEPS, { now: at(9, 21), storage })
    const file = buildStudyFile({ now: at(9, 30), storage })
    for (const where of [readStudy(storage).events, file.events]) for (const e of where) {
      expect(Object.keys(e).every(k => KEYS.includes(k)), JSON.stringify(e)).toBe(true)
      if (COUNT_EVENTS.includes(e.event)) {
        expect(Number.isInteger(e.count) && e.count >= 1).toBe(true)
        expect(e.engine).toMatch(/^kamin-[a-z0-9-]{1,60}$/)
      }
    }
    const text = JSON.stringify([readStudy(storage), file])
    const words = [PROJECT.title, PROJECT.description, ...PROJECT.description.split(/[\s,;.]+/).filter(w => w.length >= 5), ...result.suggestions.map(s => s.snippet), ...ids, byHand]
    for (const id of [...ids, byHand]) { const skill = Object.values(catalog).find(s => s.id === id); words.push(skill.labels.en, skill.labels.ar) }
    for (const word of words) expect(text, word).not.toContain(word)
    // Every string in the file is one of its fixed values: no field can carry free text except the optional comment.
    const strings = []
    JSON.stringify(file, (k, v) => { if (typeof v === 'string' && k !== 'comment') strings.push(v); return v })
    const fixed = new Set([STUDY_SCHEMA_ID, file.studyCode, file.consentVersion, file.language, file.joinedAt, file.exportedAt, ...PILOT_EVENT_NAMES, ...COUNT_EVENTS, ...file.events.map(e => e.at), result.version, STEPS])
    expect(strings.filter(s => !fixed.has(s))).toEqual([])
  })

  it('the functions refuse text where a count or a version belongs', () => {
    const storage = new MemoryStorage(); join(storage)
    expect(() => recordCount('suggest_shown', 'A web app with a database', ENGINE, { storage })).toThrow('PILOT_COUNT_INVALID')
    expect(() => recordCount('suggest_shown', 2.5, ENGINE, { storage })).toThrow('PILOT_COUNT_INVALID')
    expect(() => recordCount('suggest_shown', 2, 'I built a web app', { storage })).toThrow('PILOT_ENGINE_INVALID')
    expect(() => recordCount('suggest_description', 2, ENGINE, { storage })).toThrow('PILOT_EVENT_NOT_ALLOWED')
    expect(() => recordStepChoice('suggest_kept', STEPS, { storage })).toThrow('PILOT_EVENT_NOT_ALLOWED')
    expect(() => trackPilotEvent('suggest_kept', { storage }), 'count events never go through the funnel recorder').toThrow('PILOT_EVENT_NOT_ALLOWED')
    expect(readStudy(storage).events.map(e => e.event)).toEqual(['study_joined'])
  })

  it('the file carries the summary: kept / shown, unticked / shown, added by hand / saved, and the step choices; it validates', () => {
    const storage = new MemoryStorage(); join(storage)
    recordProjectSuggestions({ suggested: ['a', 'b', 'c'], saved: ['a', 'b', 'd'], engine: ENGINE }, { now: at(9, 5), storage })
    recordProjectSuggestions({ suggested: ['e'], saved: ['e'], engine: ENGINE }, { now: at(9, 8), storage })
    recordStepChoice('step_taken', STEPS, { storage })
    recordStepChoice('step_taken', STEPS, { storage })
    recordStepChoice('step_removed', STEPS, { storage })
    const file = buildStudyFile({ now: at(9, 30), storage })
    expect(validate(file)).toEqual([])
    expect(file.suggestions).toEqual({
      engines: [ENGINE, STEPS].sort(),
      shown: 4, kept: 3, unticked: 1, addedByHand: 1, saved: 4,
      keptOfShown: 0.75, untickedOfShown: 0.25, addedByHandOfSaved: 0.25,
      stepsTaken: 2, stepsNotForMe: 0, stepsRemoved: 1,
    })
    // Zero counts add no event: the second project had nothing unticked and nothing added by hand.
    expect(file.events.filter(e => e.event.startsWith('suggest_')).map(e => `${e.event}:${e.count}`)).toEqual(['suggest_shown:3', 'suggest_kept:2', 'suggest_unticked:1', 'suggest_added_by_hand:1', 'suggest_shown:1', 'suggest_kept:1'])
    expect(summarizeCounts([])).toMatchObject({ shown: 0, keptOfShown: null, untickedOfShown: null, addedByHandOfSaved: null })
  })

  it('Undo takes the last step count of that kind back', () => {
    const storage = new MemoryStorage(); join(storage)
    recordStepChoice('step_taken', STEPS, { storage })
    recordStepChoice('step_not_for_me', STEPS, { storage })
    expect(takeBackStepChoice('step_taken', { storage })).toBe(true)
    expect(takeBackStepChoice('step_taken', { storage })).toBe(false)
    expect(readStudy(storage).events.map(e => e.event)).toEqual(['study_joined', 'step_not_for_me'])
    expect(() => takeBackStepChoice('study_joined', { storage })).toThrow('PILOT_EVENT_NOT_ALLOWED')
  })

  it('the schema refuses text in a count event (checker self-test); a tampered count event never reaches the file', () => {
    const storage = new MemoryStorage(); join(storage)
    recordStepChoice('step_taken', STEPS, { now: at(9, 5), storage })
    const file = buildStudyFile({ now: at(9, 30), storage })
    const ok = { event: 'suggest_kept', at: '2026-12-01T09:05:00.000Z', count: 2, engine: ENGINE }
    expect(validate({ ...file, events: [{ ...ok, snippet: 'React front end' }] })).toContain('$.events[0].snippet: not allowed')
    expect(validate({ ...file, events: [{ ...ok, count: 0 }] })).toContain('$.events[0].count: below minimum')
    expect(validate({ ...file, events: [{ ...ok, count: '2' }] })).toContain('$.events[0].count: type string')
    expect(validate({ ...file, events: [{ ...ok, engine: 'A web app' }] })).toContain('$.events[0].engine: pattern')
    expect(validate({ ...file, suggestions: { ...file.suggestions, title: 'x' } })).toContain('$.suggestions.title: not allowed')
    const raw = JSON.parse(storage.getItem(STUDY_KEY))
    storage.setItem(STUDY_KEY, JSON.stringify({ ...raw, events: [...raw.events, { ...ok, description: PROJECT.description, skillIds: ['web-development'] }, { ...ok, count: 'many' }, { ...ok, engine: PROJECT.title }] }))
    const tampered = buildStudyFile({ now: at(9, 31), storage })
    expect(validate(tampered)).toEqual([])
    expect(tampered.events.filter(e => e.event === 'suggest_kept')).toEqual([ok])
    expect(JSON.stringify(tampered)).not.toMatch(/PostgreSQL|web-development|Meeting room/)
  })

  it('withdrawing and ending the session leave no count behind; nothing is recorded afterwards', () => {
    for (const remove of [s => withdrawFromStudy({ storage: s }), s => clearPilotLocalData({ storage: s })]) {
      const storage = new MemoryStorage(); join(storage)
      recordProjectSuggestions({ suggested: ['a', 'b'], saved: ['a'], engine: ENGINE }, { storage })
      recordStepChoice('step_taken', STEPS, { storage })
      remove(storage)
      expect(storage.length).toBe(0)
      expect(recordCount('suggest_shown', 1, ENGINE, { storage }).recorded).toBe(false)
    }
  })
})
