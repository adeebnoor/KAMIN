// Task 50: synthetic KAU transcripts (tests first). Every fixture is made up; see
// scripts/make-transcript-fixtures.mjs (npm run fixtures:transcripts).
//
// Two kinds of tests:
// 1. Fixture self-checks (normal tests): the PDFs and expected files are what they claim to be.
// 2. Parser comparisons: today's reader against each expected file, row by row. Today's reader gets
//    them wrong, so each one is `test.fails`: the suite stays green, and the moment a comparison starts
//    passing, vitest reports it, so the right task flips it to `test`. Never `skip`.
import { describe, test, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { readPdf } from './helpers/readPdfText.js'
import { isScannedPdf } from '../src/utils/transcript.js'
import { readLayout } from '../src/transcript/layout.js'
import { isKauTranscript, parseKauLines } from '../src/transcript/kau.js'
import { readStudentInfo } from '../src/transcript/studentInfo.js'
import { catalogCourse } from '../src/catalog/fcit.js'
import { FIXTURES, FIXTURE_DIR, MADE_UP_PERSONAL, buildFixture, expectedJson } from '../scripts/make-transcript-fixtures.mjs'

const fixtures = await Promise.all(FIXTURES.map(async def => {
  const pdfBytes = readFileSync(path.join(FIXTURE_DIR, `${def.name}.pdf`))
  const expectedText = readFileSync(path.join(FIXTURE_DIR, `${def.name}.expected.json`), 'utf8')
  return { def, pdfBytes, expectedText, expected: JSON.parse(expectedText), pdf: await readPdf(pdfBytes) }
}))
const byName = Object.fromEntries(fixtures.map(f => [f.def.name, f]))
const allText = pdf => pdf.pages.flatMap(p => p.items.map(i => i.str)).join('\n')

// ---- today's reader ------------------------------------------------------------------------------------
// The one place the later tasks change. Task 51 (done): lines from src/transcript/layout.js (each column
// in reading order), and `validation.scanned` as the app decides it.
// Task 52 (done): rows and checkGpa from src/transcript/kau.js (every attempt of a retaken course, in
// order; the app's review list then shows the latest attempt of each).
// Task 53 (done): `student` from src/transcript/studentInfo.js (the header lines of the layout).
function readTranscript(pdf) {
  if (isScannedPdf(pdf.pages)) return { rows: [], checkGpa: null, student: null, validation: { scanned: true } }
  const layout = readLayout(pdf.pages)
  if (!isKauTranscript(layout)) return { rows: [], checkGpa: null, student: undefined, validation: { scanned: false } }
  const parsed = parseKauLines(layout)
  return {
    rows: parsed.rows,
    checkGpa: parsed.checkGpa,
    student: readStudentInfo(layout.headerLines),
    validation: { scanned: false },
  }
}

// A diff that names the row: "row 3 (CPIT-250, SPRING 2021/2022): letter expected "B+", got "I"".
function compareRows(expected, actual) {
  const problems = []; let exact = 0
  for (let i = 0; i < Math.max(expected.length, actual.length); i += 1) {
    const e = expected[i]; const a = actual[i]
    if (!e) { problems.push(`row ${i + 1}: not expected, got ${JSON.stringify(a)}`); continue }
    const name = `row ${i + 1} (${e.code}, ${e.section === 'equivalent' ? 'EQUIVALENT COURSES' : `${e.term} ${e.year}`})`
    if (!a) { problems.push(`${name}: missing`); continue }
    const wrong = Object.keys(e).filter(key => !isDeepStrictEqual(e[key], a[key]))
    if (!wrong.length) { exact += 1; continue }
    problems.push(`${name}: ${wrong.map(key => `${key} expected ${JSON.stringify(e[key])}, got ${JSON.stringify(a[key])}`).join('; ')}`)
  }
  return { exact, problems }
}

function expectSameRows(expected, result) {
  const { exact, problems } = compareRows(expected.rows, result.rows)
  if (result.checkGpa !== expected.checkGpa) problems.push(`checkGpa expected ${JSON.stringify(expected.checkGpa)}, got ${JSON.stringify(result.checkGpa)}`)
  if (problems.length) {
    const shown = problems.slice(0, 12).join('\n  ')
    throw new Error(`${expected.fixture}: ${exact} of ${expected.rows.length} rows exact\n  ${shown}${problems.length > 12 ? `\n  … and ${problems.length - 12} more` : ''}`)
  }
}

function expectSameStudent(expected, result) {
  const wrong = Object.keys(expected.student).filter(key => result.student?.[key] !== expected.student[key])
  if (wrong.length) throw new Error(`${expected.fixture}: student ${wrong.map(key => `${key} expected ${JSON.stringify(expected.student[key])}, got ${JSON.stringify(result.student?.[key])}`).join('; ')}`)
}

describe('KAU transcript fixtures: self-checks (Task 50)', () => {
  test('10 fixtures, each a PDF and an expected file; 1, 2 and 3-page transcripts present', () => {
    const files = readdirSync(FIXTURE_DIR).sort()
    expect(files).toEqual(FIXTURES.flatMap(d => [`${d.name}.expected.json`, `${d.name}.pdf`]).sort())
    expect(FIXTURES).toHaveLength(10)
    expect(new Set(fixtures.map(f => f.pdf.numPages))).toEqual(new Set([1, 2, 3]))
  })

  test.each(FIXTURES.map(d => d.name))('%s opens, has its page count, and the generator gives the same bytes twice', name => {
    const { def, pdf, expected, pdfBytes, expectedText } = byName[name]
    expect(pdf.numPages).toBe(def.pages)
    expect(expected.pages).toBe(def.pages)
    const first = buildFixture(def); const second = buildFixture(def)
    expect(Buffer.compare(first.pdf, second.pdf)).toBe(0)
    expect(Buffer.compare(first.pdf, pdfBytes), 'committed PDF is out of date: run npm run fixtures:transcripts').toBe(0)
    expect(expectedJson(first.expected), 'committed expected file is out of date: run npm run fixtures:transcripts').toBe(expectedText)
  })

  test('the scanned fixture has no text items; every other page has text, its header and its footer', () => {
    expect(byName.scanned.pdf.pages.every(p => p.items.length === 0)).toBe(true)
    expect(byName.scanned.expected).toMatchObject({ scanned: true, rows: [], student: null, checkGpa: null })
    for (const { def, pdf } of fixtures.filter(f => !f.def.scanned)) {
      pdf.pages.forEach((page, i) => {
        const strings = page.items.map(item => item.str)
        expect(strings, `${def.name} page ${i + 1}`).toEqual(expect.arrayContaining(['STUDENT INFORMATION', 'COLLEGE', 'MAJOR', 'DEGREE', 'STATUS', `Page ${i + 1} of ${def.pages}`, 'Dean of Admission', def.dean]))
      })
      const text = allText(pdf)
      for (const line of ['Term', 'Cumulative', 'Cumulative Total', 'Transferred Total', 'Grand Total', 'Cumulative GPA', 'End of Transcript']) expect(text.split('\n'), `${def.name}: ${line}`).toContain(line)
      expect(text).toMatch(/^Print Date: \d{2}\/\d{2}\/\d{4}$/m)
    }
  })

  test("every expected row's code appears in the PDF text, and every expected row is complete", () => {
    for (const { def, pdf, expected } of fixtures) {
      const text = allText(pdf)
      for (const row of expected.rows) {
        const [subject, number] = row.code.split('-')
        expect(text, `${def.name}: ${row.code}`).toMatch(new RegExp(`(^|\\n)${subject}\\s+${number}(\\n|$)`))
        expect(Object.keys(row)).toEqual(['code', 'credits', 'marks', 'letter', 'term', 'year', 'system', 'section', 'retaken', 'inCourseMap'])
        expect(row.code).toMatch(/^[A-Z]{2,4}-\d{3}$/)
        expect(row.inCourseMap, `${def.name}: ${row.code} inCourseMap`).toBe(!!catalogCourse(row.code))
        if (row.section === 'term') expect([row.term, row.system]).toEqual([expect.stringMatching(/^(FALL|WINTER|SPRING|SUMMER)$/), expect.stringMatching(/^(quarter|semester)$/)])
        if (row.section === 'term') expect(row.year).toMatch(/^\d{4}\/\d{4}$/)
      }
    }
  })

  test('no expected file contains a NAME, STUDENT NO, NATIONALITY or NID value; the PDFs do (for the Task 53 guard)', () => {
    expect(Object.keys(MADE_UP_PERSONAL).sort()).toEqual(FIXTURES.map(d => d.name).sort())
    for (const { def, pdf } of fixtures) {
      const text = allText(pdf)
      for (const value of Object.values(MADE_UP_PERSONAL[def.name])) {
        for (const other of fixtures) expect(other.expectedText.toUpperCase(), `${other.def.name}.expected.json holds ${value}`).not.toContain(value.toUpperCase())
        if (!def.scanned) expect(text, `${def.name}.pdf should print ${value}`).toContain(value)
      }
      for (const value of Object.values(MADE_UP_PERSONAL[def.name])) expect(value).toMatch(/^(TEST STUDENT [A-Z]+|0{3,}\d+|TESTLAND|SAMPLELAND|MOCKLAND)$/)
    }
    for (const { expected } of fixtures.filter(f => !f.def.scanned)) expect(Object.keys(expected.student)).toEqual(['collegeRaw', 'collegeId', 'majorRaw', 'degreeRaw', 'statusRaw', 'studyModeRaw'])
  })

  test('each fixture covers what its name says', () => {
    const rows = name => byName[name].expected.rows
    const systems = rows('fcit-it-2p').map(r => r.system)
    expect(systems.indexOf('semester')).toBe(systems.lastIndexOf('quarter') + 1)
    expect(allText(byName['fcit-it-2p'].pdf).split('\n')).toEqual(expect.arrayContaining(['SEMESTER SYSTEM RE-ADOPTED', 'Quarter', 'Semester']))
    expect(buildFixture(byName['fcit-is-3p'].def).splitTerms.length).toBeGreaterThan(0)
    expect(Object.fromEntries(fixtures.filter(f => !f.def.scanned).map(f => [f.def.name, f.expected.student.collegeId]))).toEqual({
      'fcit-it-2p': 'FCIT', 'fcit-cs-1p': 'FCIT', 'fcit-is-3p': 'FCIT', 'science-2p': 'SCI', 'medicine-1p': 'MED',
      'transfer-tr': 'FCIT', 'codes-mix': 'FCIT', retake: 'FCIT', 'unknown-college': null,
    })
    expect(byName['science-2p'].expected.student.collegeRaw).toBe('FACULTY OF SCI.')
    const transfer = rows('transfer-tr').filter(r => r.section === 'equivalent')
    expect(transfer.length).toBeGreaterThanOrEqual(3)
    expect(transfer.every(r => r.letter === 'TR' && r.marks === null && r.term === null)).toBe(true)
    expect(allText(byName['transfer-tr'].pdf)).toContain('Transfer Equivalency')
    for (const f of fixtures.filter(x => x.def.name !== 'transfer-tr')) {
      expect(allText(f.pdf)).not.toContain('EQUIVALENT COURSES')
      expect(f.expected.rows.every(r => r.section === 'term')).toBe(true)
    }
    const letters = new Set(rows('codes-mix').map(r => r.letter))
    for (const code of ['NP', 'W', 'IC', 'IP', 'P', 'WF', 'DN', 'NF', 'ZZ']) expect(letters.has(code), code).toBe(true)
    expect(rows('codes-mix').find(r => r.letter === 'NP')).toMatchObject({ credits: { ua: 0, ue: 0 }, marks: 'NP' })
    expect(rows('codes-mix').find(r => r.letter === 'NF').marks).toBe(38)
    const attempts = rows('retake').filter(r => r.code === 'CPIT-240')
    expect(attempts.map(r => [r.letter, r.retaken])).toEqual([['F', true], ['B+', false]])
    for (const f of fixtures.filter(x => x.def.name !== 'retake')) expect(f.expected.rows.some(r => r.retaken), f.def.name).toBe(false)
  })
})

describe('KAU transcript fixtures: today\'s reader against the expected rows (Task 50)', () => {
  const textFixtures = fixtures.filter(f => !f.def.scanned)

  // Flipped to `test` in Task 52 (rows).
  for (const { def, pdf, expected } of textFixtures) {
    test(`${def.name}: every row in order, and the transcript GPA (flipped to test in Task 52)`, () => {
      expectSameRows(expected, readTranscript(pdf))
    })
  }

  // Flipped to `test` in Task 53 (student info).
  for (const { def, pdf, expected } of textFixtures) {
    test(`${def.name}: college, major, degree, status and study mode (flipped to test in Task 53)`, () => {
      expectSameStudent(expected, readTranscript(pdf))
    })
  }

  // Flipped to `test` in Task 51 (scanned).
  test('scanned: reported as a scanned PDF (flipped to test in Task 51)', () => {
    expect(readTranscript(byName.scanned.pdf).validation.scanned).toBe(true)
  })

  test('the comparison names the row and the field', () => {
    const expected = { fixture: 'x', checkGpa: '4.00', rows: [{ code: 'CPIT-250', letter: 'B+', term: 'FALL', year: '2019/2020', section: 'term' }] }
    expect(() => expectSameRows(expected, { checkGpa: '4.00', rows: [{ code: 'SYSTEM-250', letter: 'B+', term: 'FALL', year: '2019/2020', section: 'term' }] }))
      .toThrow('row 1 (CPIT-250, FALL 2019/2020): code expected "CPIT-250", got "SYSTEM-250"')
    expect(() => expectSameRows(expected, { checkGpa: '4.00', rows: [] })).toThrow('0 of 1 rows exact')
    expect(() => expectSameRows(expected, { checkGpa: '4.00', rows: expected.rows })).not.toThrow()
  })
})
