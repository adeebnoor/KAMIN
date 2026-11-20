// Task 53 · privacy guard: a student's name, student number, nationality and national ID never leave the
// STUDENT INFORMATION block. Every Task 50 fixture prints made-up values for them (MADE_UP_PERSONAL in
// scripts/make-transcript-fixtures.mjs); none of them may appear in what the reader returns, nor in anything
// the app stores or exports after approval: the session copy, the device copy (IndexedDB), the backup
// (decrypted) and the capability file (CLR). The e2e twin is e2e/transcript-privacy.spec.js.
//
// This file must stay green (fixed rule). If src/transcript/studentInfo.js ever returns the NAME value, it fails.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { readPdf } from './helpers/readPdfText.js'
import { createFakeIndexedDb, createMemoryStorage } from './helpers/fakeIndexedDb.js'
import { FIXTURES, FIXTURE_DIR, MADE_UP_PERSONAL } from '../scripts/make-transcript-fixtures.mjs'
import { readTranscriptPages } from '../src/utils/transcript.js'
import { STUDENT_FIELDS } from '../src/transcript/studentInfo.js'
import { canonicalCourseCode } from '../src/utils/profileQuality.js'
import { profileSkills } from '../src/utils/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { KAMIN_LOCAL_DB, KAMIN_LOCAL_KEY, KAMIN_LOCAL_STORE, readLocalProfile, writeLocalProfile } from '../src/utils/localProfileStore.js'
import { buildPortableProfile, decryptPortableProfile, encryptPortableProfile } from '../src/utils/portableProfile.js'
import { buildClrExport } from '../src/utils/clrExport.js'
import { emptyInsightState } from '../src/insight.js'
import { normalizeDigitalInterests } from '../src/digitalInterests.js'
import { cleanAuditEntries } from '../src/utils/auditPrivacy.js'
import { normalizeRecommendationReviews } from '../src/review/recommendations.js'
import { normalizeProjectEvidence } from '../src/utils/projectEvidence.js'
import { normalizeTaskProgress } from '../src/tasks/progress.js'
import { normalizeCredentialRecords } from '../src/credentials/records.js'
import { normalizeCollege, cleanTranscriptText } from '../src/catalog/colleges.js'
import { mergeNeedsReview } from '../src/evidence/needsReview.js'
import { normalizePlan } from '../src/plan/plan.js'

const SESSION_KEY = 'kamin-session-v3' // src/state/profileState.js STORAGE_KEY (Task 59)
const PASSPHRASE = 'made-up test passphrase only'

// The app's own `normalizeState` (Task 59: moved from src/App.jsx to src/state/profileState.js, shared by
// both interfaces), so this guard runs the app's real code and follows it when it changes.
import { normalizeState } from '../src/state/profileState.js'

const fixtures = await Promise.all(FIXTURES.map(async def => ({
  def,
  personal: Object.values(MADE_UP_PERSONAL[def.name]),
  expected: JSON.parse(readFileSync(path.join(FIXTURE_DIR, `${def.name}.expected.json`), 'utf8')),
  pdf: await readPdf(path.join(FIXTURE_DIR, `${def.name}.pdf`)),
})))
// Every made-up value of every fixture: one fixture's result must not hold another's either.
const ALL_PERSONAL = Object.values(MADE_UP_PERSONAL).flatMap(Object.values)
const expectNone = (json, where) => {
  for (const value of ALL_PERSONAL) expect(json.toUpperCase(), `${where} contains the made-up value "${value}"`).not.toContain(value.toUpperCase())
}

let idb, session
beforeEach(() => {
  idb = createFakeIndexedDb()
  session = createMemoryStorage()
  vi.stubGlobal('indexedDB', idb)
  vi.stubGlobal('sessionStorage', session)
})
afterEach(() => vi.unstubAllGlobals())

describe('Task 53: the reader returns no name, student number, nationality or NID', () => {
  test('the made-up values are really printed in the PDFs (otherwise this guard would prove nothing)', () => {
    for (const { def, pdf, personal } of fixtures.filter(f => !f.def.scanned)) {
      const text = pdf.pages.flatMap(p => p.items.map(i => i.str)).join('\n')
      for (const value of personal) expect(text, `${def.name}.pdf`).toContain(value)
    }
  })

  test.each(FIXTURES.map(d => d.name))('%s: none of the values in JSON.stringify of the result; no page text; only the five fields', name => {
    const { pdf, expected } = fixtures.find(f => f.def.name === name)
    const result = readTranscriptPages(pdf.pages)
    expectNone(JSON.stringify(result), `${name}: parser result`)
    expect(result).not.toHaveProperty('text')
    expect(Object.keys(result.student)).toEqual(STUDENT_FIELDS)
    if (expected.student) for (const key of STUDENT_FIELDS) expect(result.student[key], `${name}: ${key}`).toBe(expected.student[key])
    else expect(Object.values(result.student).every(v => v === null)).toBe(true)
  })

  test('a header-block line is never in validation.rejected, also in the generic (non-KAU) reader', () => {
    // A made-up transcript that is not in the KAU format: no STUDENT INFORMATION, but a header block above
    // the first term header with a course-like line that the generic reader cannot parse.
    const at = (str, x, y) => ({ str, x, y, width: str.length * 4, height: 8 })
    const pages = [[
      at('MATRIC REF', 30, 780), at('CS 4021 TEST STUDENT ZULU', 120, 780),
      at('FALL 2019/2020', 30, 740),
      at('CPIT 250 Systems Analysis', 30, 720), at('3', 250, 720), at('A', 280, 720),
      at('CPIT 240 Database Management', 30, 705), at('3', 250, 705), at('B+', 280, 705),
      at('CPIT 201 Programming lab work pending', 30, 690),
    ]]
    const result = readTranscriptPages(pages)
    expect(result.validation.format).toBeUndefined()
    expect(result.courses.map(c => c.code)).toEqual(['CPIT-250', 'CPIT-240'])
    const rejected = result.validation.rejected.map(r => r.line)
    expect(rejected).toContain('CPIT 201 Programming lab work pending')
    expect(rejected.filter(line => /MATRIC|CS 4021/.test(line))).toEqual([])
    expect(JSON.stringify(result)).not.toContain('ZULU')
    expect(result).not.toHaveProperty('text')
  })
})

describe('Task 53: after approval, nothing stored or exported holds the values', () => {
  test.each(FIXTURES.filter(d => !d.scanned).map(d => d.name))('%s: session, device, backup and capability file', async name => {
    const { pdf } = fixtures.find(f => f.def.name === name)
    const result = readTranscriptPages(pdf.pages)
    // App.jsx upload → review → approve, with "keep on this device" on. The college, and since Task 55 the
    // college and major as printed (collegeRaw, major), are the ones read from the transcript.
    const courses = result.courses.map(row => ({ ...row, code: canonicalCourseCode(row.code), source: row.source || 'manual' }))
    let state = normalizeState(null)
    state = normalizeState({ ...state, courses, college: result.student.collegeId, collegeRaw: result.student.collegeRaw, major: result.student.majorRaw, approved: true, consents: { ...state.consents, analyze: true }, localPersistence: true,
      audit: [{ label: 'Transcript analysis consent granted and record approved', ts: 1 }] })
    expect(state.courses.length).toBe(result.courses.length)
    expect(state.collegeRaw).toBe(result.student.collegeRaw)

    // App.jsx's storage effect: the session copy, and the device copy.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
    await writeLocalProfile(state)
    expectNone(session.dump(), `${name}: sessionStorage`)
    expectNone(JSON.stringify(idb.raw(KAMIN_LOCAL_DB, KAMIN_LOCAL_STORE, KAMIN_LOCAL_KEY)), `${name}: IndexedDB`)
    // A reload reads the session copy back through normalizeState, and the device copy through readLocalProfile.
    expectNone(JSON.stringify(normalizeState(JSON.parse(sessionStorage.getItem(SESSION_KEY)))), `${name}: state after reload`)
    expectNone(JSON.stringify(await readLocalProfile()), `${name}: device copy read back`)

    // Backup (decrypted, so the check is on the real content) and the capability file.
    const skills = profileSkills(state)
    const person360 = projectStateToPerson360({ state, skills })
    const envelope = await encryptPortableProfile(buildPortableProfile({ state, person360 }), PASSPHRASE)
    expectNone(JSON.stringify(envelope), `${name}: backup file`)
    expectNone(JSON.stringify(await decryptPortableProfile(envelope, PASSPHRASE)), `${name}: backup content`)
    for (const lang of ['ar', 'en']) expectNone(JSON.stringify(buildClrExport({ state, skills, lang })), `${name}: capability file (${lang})`)
  })
})
