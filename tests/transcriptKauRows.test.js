// Task 52: reading KAU rows (src/transcript/kau.js), the letter-code table (src/utils/grades.js), the
// review rules for retakes, transfers and unknown codes (src/utils/profileQuality.js) and the review labels
// (src/utils/courseStatus.js). Every line and fixture here is made up.
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseRowLine, parseTermHeader, parseKauLines, isKauTranscript, reviewRows } from '../src/transcript/kau.js'
import { readLayout } from '../src/transcript/layout.js'
import { LETTER_CODES, LETTER_STATUS, letterStatus } from '../src/utils/grades.js'
import { readKauLayout, parseTranscriptTextDetailed, pdfLayoutText } from '../src/utils/transcript.js'
import { reviewProfileQuality } from '../src/utils/profileQuality.js'
import { courseStatus, issuesByRow, termLabel } from '../src/utils/courseStatus.js'
import { inferSkills } from '../src/utils/engine.js'
import { readPdf } from './helpers/readPdfText.js'
import { FIXTURE_DIR } from '../scripts/make-transcript-fixtures.mjs'

const fixture = async name => readLayout((await readPdf(readFileSync(path.join(FIXTURE_DIR, `${name}.pdf`)))).pages)
const KAU = ['STUDENT INFORMATION']
const read = lines => parseKauLines({ headerLines: KAU, lines })

describe('letter codes: one table (Task 52)', () => {
  const expected = {
    'A+': 'passed', A: 'passed', 'B+': 'passed', B: 'passed', 'C+': 'passed', C: 'passed', 'D+': 'passed', D: 'passed',
    F: 'not-passed', NP: 'not-passed', TR: 'transfer', W: 'not-passed', WF: 'not-passed', IC: 'not-passed', IP: 'not-passed', DN: 'not-passed', NF: 'not-passed', P: 'passed-no-grade',
  }
  test('the 18 KAU codes and their status', () => {
    expect([...LETTER_CODES].sort()).toEqual(Object.keys(expected).sort())
    expect(LETTER_STATUS).toEqual(expected)
    expect(letterStatus('ZZ')).toBe('unknown')
    expect(letterStatus('')).toBe('unknown')
  })

  test.each(Object.entries(expected))('%s is read from the end of the row with status %s', (code, status) => {
    const marksCell = status === 'passed' || code === 'F' || code === 'NF' ? '77' : code
    const section = code === 'TR' ? 'equivalent' : 'term'
    const line = code === 'TR' ? 'CPIT 250 SYSTEM ANALYSIS & DESIGN 3 3 TR' : `CPIT 250 SYSTEM ANALYSIS & DESIGN 3 3 ${marksCell} ${code}`
    const cells = parseRowLine(line, { section })
    expect(cells).toMatchObject({ code: 'CPIT-250', name: 'SYSTEM ANALYSIS & DESIGN', credits: { ua: 3, ue: 3 }, letter: code })
    expect(cells.marks).toBe(code === 'TR' ? null : /^\d+$/.test(marksCell) ? 77 : code)
    const rows = read(section === 'equivalent' ? ['EQUIVALENT COURSES', line] : ['FALL 2021/2022', line]).rows
    expect(rows).toHaveLength(1)
    expect(rows[0].letterStatus).toBe(status)
  })

  test('an unknown code is kept on its row, never throws, and does not block approval', () => {
    let parsed
    expect(() => { parsed = read(['FALL 2021/2022', 'CPIT 250 SYSTEM ANALYSIS 3 3 ZZ ZZ', 'CPIT 251 SOFTWARE ENG. 3 3 81 QX']) }).not.toThrow()
    expect(parsed.rows.map(r => [r.code, r.marks, r.letter, r.letterStatus])).toEqual([['CPIT-250', 'ZZ', 'ZZ', 'unknown'], ['CPIT-251', 81, 'QX', 'unknown']])
    const courses = reviewRows(parsed.rows).map(r => ({ ...r, grade: r.letter, source: 'pdf' }))
    const quality = reviewProfileQuality(courses)
    expect(quality.issues).toEqual([])
    expect(quality.warnings.map(w => w.kind)).toEqual(['unknownLetter', 'unknownLetter'])
    expect(quality.canApprove).toBe(true)
    // Shown on its row, with the code.
    const status = courseStatus(courses[0], { lang: 'en', issue: issuesByRow(courses)[0] })
    expect(status.attention).toBe(true)
    expect(status.reasons[0]).toEqual({ tone: 'issue', text: 'Grade code ZZ is not one we know. Check it against your transcript; it does not stop approval.' })
    expect(courseStatus(courses[0], { lang: 'ar', issue: 'unknownLetter' }).reasons[0].text).toContain('ZZ')
    // Changing it to another unknown code is a normal grade problem again (it no longer matches the print).
    expect(reviewProfileQuality([{ ...courses[0], grade: 'QQ' }]).issues.map(i => i.kind)).toEqual(['grade'])
  })

  // Task 54 set the evidence rule this test waited for: TR and P now give at most a limited clue;
  // IC, NF and an unknown code still give nothing.
  test('no evidence from IC, NF or an unknown code; TR and P give at most a limited clue (Task 54)', () => {
    for (const grade of ['IC', 'NF', 'ZZ']) expect(inferSkills([{ code: 'CPIT-240', name: 'DATABASES I', grade, source: 'pdf' }]), grade).toEqual([])
    for (const grade of ['TR', 'P']) {
      const skills = inferSkills([{ code: 'CPIT-240', name: 'DATABASES I', grade, source: 'pdf' }])
      expect(skills.length, grade).toBeGreaterThan(0)
      for (const skill of skills) expect(skill.evidenceLevel, grade).toBe('limited')
    }
  })
})

describe('rows: read from the right (Task 52)', () => {
  test('Roman numerals in titles are never a grade', () => {
    expect(parseRowLine('CPIT 110 PROGRAMMING I 3 3 91 A')).toMatchObject({ name: 'PROGRAMMING I', marks: 91, letter: 'A' })
    expect(parseRowLine('CPCS 203 PROGRAMMING II 3 3 52 F')).toMatchObject({ name: 'PROGRAMMING II', marks: 52, letter: 'F' })
    expect(parseRowLine('ISLS 401 ISLAMIC CULTURE IV 2 2 85 B+')).toMatchObject({ name: 'ISLAMIC CULTURE IV', letter: 'B+' })
    expect(parseRowLine('ELI 101 ENGLISH LANGUAGE I 2 2 TR', { section: 'equivalent' })).toMatchObject({ name: 'ENGLISH LANGUAGE I', marks: null, letter: 'TR' })
    // Registrar typos and abbreviations stay as printed.
    expect(parseRowLine('CPIT 250 SYSTEM ANALYSIS & DESGIN 3 3 88 B+')).toMatchObject({ code: 'CPIT-250', name: 'SYSTEM ANALYSIS & DESGIN' })
    expect(parseRowLine('CPIT 435 NEEDS ASSESS. & TECH. EVAL. 3 3 88 B+')).toMatchObject({ name: 'NEEDS ASSESS. & TECH. EVAL.' })
  })

  test('an upper-case title word next to a number never becomes the code', () => {
    expect(parseRowLine('CPIT 250 SYSTEM 250 DESIGN 3 3 88 B+')).toMatchObject({ code: 'CPIT-250', name: 'SYSTEM 250 DESIGN' })
    expect(parseRowLine('SYSTEM 250 DESIGN 3 3 88 B+')).toBeNull() // 6 letters: not a subject
    expect(parseRowLine('Term 10 7 32.25 4.61')).toBeNull()
  })

  test('irregular spaces and a code printed without a space', () => {
    expect(parseRowLine('ISLS   201    ISLAMIC  CULTURE II   2  2   93   A')).toMatchObject({ code: 'ISLS-201', name: 'ISLAMIC CULTURE II', credits: { ua: 2, ue: 2 }, marks: 93, letter: 'A' })
    expect(parseRowLine('CPIT250 SYSTEM ANALYSIS 3 3 88 B+')).toMatchObject({ code: 'CPIT-250', name: 'SYSTEM ANALYSIS' })
    expect(parseRowLine('ISLS\t201 ISLAMIC CULTURE II 2 2 93 A')).toMatchObject({ code: 'ISLS-201' })
  })

  test('a description with digits ("CALCULUS 2") keeps them; credits and marks come from the end', () => {
    expect(parseRowLine('MATH 202 CALCULUS 2 3 3 75 C+')).toEqual({ code: 'MATH-202', name: 'CALCULUS 2', credits: { ua: 3, ue: 3 }, marks: 75, letter: 'C+' })
    expect(parseRowLine('MATH 202 CALCULUS 2 3 3 TR', { section: 'equivalent' })).toEqual({ code: 'MATH-202', name: 'CALCULUS 2', credits: { ua: 3, ue: 3 }, marks: null, letter: 'TR' })
  })

  test('0 credits are kept (summer training: 0 0 NP NP); the app row has hours 0', () => {
    const parsed = read(['SUMMER 2021/2022', 'CPIT 290 SUMMER TRAINING 0 0 NP NP'])
    expect(parsed.rows[0]).toMatchObject({ credits: { ua: 0, ue: 0 }, marks: 'NP', letter: 'NP', letterStatus: 'not-passed' })
    const app = readKauLayout({ headerLines: KAU, lines: ['SUMMER 2021/2022', 'CPIT 290 SUMMER TRAINING 0 0 NP NP'] }).courses[0]
    expect(app).toMatchObject({ code: 'CPIT-290', name: 'SUMMER TRAINING', grade: 'NP', hours: 0 })
  })

  test('a row whose end is not UA UE MARKS LETTER is rejected, never thrown or guessed', () => {
    const parsed = read(['FALL 2021/2022', 'CPIT 240 DATABASES I 3 3 91', 'CPIT 241 DATABASES II B+', 'CPIT 242 3 3 91 A'])
    expect(parsed.rows).toEqual([])
    expect(parsed.rejected.map(r => r.line)).toEqual(['CPIT 240 DATABASES I 3 3 91', 'CPIT 241 DATABASES II B+', 'CPIT 242 3 3 91 A'])
  })

  test('a row split by pdf.js into many items (one per word, "B" and "+" apart, any order) reads the same', () => {
    const H = 7
    const item = (str, x, y) => ({ str, transform: [H, 0, 0, H, x, y], width: str.length * H * 0.5, height: H })
    const words = (text, x0, y, gap = 3) => { let x = x0; return text.split(' ').map(word => { const it = item(word, x, y); x += it.width + gap; return it }) }
    const items = [
      item('STUDENT INFORMATION', 30, 790), item('COLLEGE', 30, 778), item('COMPUTING & INFORMATION TECH.', 82, 778),
      ...words('FALL 2021/2022', 30, 700),
      item('CPIT', 30, 680), item('250', 48, 680), ...words('SYSTEM ANALYSIS & DESIGN', 70, 680), item('3', 206, 680), item('3', 222, 680), item('88', 238, 680), item('B', 266, 680), item('+', 270.5, 680),
      ...words('MATH 202', 30, 660), ...words('CALCULUS 2', 70, 660), item('3', 206, 660), item('3', 222, 660), item('75', 238, 660), item('C+', 266, 660),
      item('Term', 70, 640), item('6', 206, 640), item('6', 222, 640),
      // The right column, as on every KAU page (its term header places the gutter).
      ...words('SPRING 2021/2022', 306, 700),
      item('ISLS', 306, 680), item('201', 324, 680), ...words('ISLAMIC CULTURE II', 346, 680), item('2', 482, 680), item('2', 498, 680), item('93', 514, 680), item('A', 542, 680),
    ].reverse()
    const layout = readLayout([items])
    expect(isKauTranscript(layout)).toBe(true)
    expect(parseKauLines(layout).rows.map(r => [r.code, r.name, r.credits.ua, r.credits.ue, r.marks, r.letter, r.term, r.year])).toEqual([
      ['CPIT-250', 'SYSTEM ANALYSIS & DESIGN', 3, 3, 88, 'B+', 'FALL', '2021/2022'],
      ['MATH-202', 'CALCULUS 2', 3, 3, 75, 'C+', 'FALL', '2021/2022'],
      ['ISLS-201', 'ISLAMIC CULTURE II', 2, 2, 93, 'A', 'SPRING', '2021/2022'],
    ])
  })

  test('no hardcoded subject list: any 2–4 letter subject is a course; the course map is matched by code only', () => {
    const rows = read(['FALL 2021/2022', 'QZX 101 MADE UP SUBJECT 3 3 90 A', 'CPIT 240 A TITLE THAT IS NOT DATABASES 3 3 90 A', 'MED 201 DATABASES I 3 3 90 A']).rows
    expect(rows.map(r => [r.code, r.inCourseMap])).toEqual([['QZX-101', false], ['CPIT-240', true], ['MED-201', false]])
    const source = readFileSync('src/transcript/kau.js', 'utf8')
    for (const subject of ['CPIT', 'CPCS', 'CPIS', 'MATH', 'ELI', 'ISLS', 'STAT']) expect(source, subject).not.toMatch(new RegExp(`['"\`]${subject}\\b`))
  })

  test('a course outside the map stays a row and the review says "Not in the course map"', () => {
    const row = { ...readKauLayout({ headerLines: KAU, lines: ['FALL 2021/2022', 'QZX 101 MADE UP SUBJECT 3 3 90 A'] }).courses[0], source: 'pdf' }
    expect(row.inCourseMap).toBe(false)
    expect(courseStatus(row, { lang: 'en' }).reasons.map(r => r.text)).toEqual(['Not in the course map: it stays in your record but creates no capability.'])
    expect(courseStatus(row, { lang: 'ar' }).reasons.map(r => r.text)).toEqual(['غير موجود في خريطة المقررات: يبقى في سجلك لكنه لا ينتج قدرة.'])
  })
})

describe('terms, sections and ignored lines (Task 52)', () => {
  test('term headers: season, year, quarter or semester', () => {
    expect(parseTermHeader('FALL 2019/2020')).toEqual({ season: 'FALL', year: '2019/2020', system: 'semester' })
    expect(parseTermHeader('WINTER 2020/2021 (QUARTER)')).toEqual({ season: 'WINTER', year: '2020/2021', system: 'quarter' })
    expect(parseTermHeader('SUMMER   2021/2022(QUARTER)')).toEqual({ season: 'SUMMER', year: '2021/2022', system: 'quarter' })
    expect(parseTermHeader('Fall 2019/2020')).toBeNull()
    expect(parseTermHeader('CPIT 250 SUMMER 2021 3 3 90 A')).toBeNull()
  })

  test('every row gets the term it sits under; EQUIVALENT COURSES lasts until the next term header', () => {
    const parsed = read([
      'EQUIVALENT COURSES', 'ELI 101 ENGLISH LANGUAGE I 2 2 TR', 'Transfer Equivalency 2 2',
      'FALL 2020/2021 (QUARTER)', 'CPIT 110 PROGRAMMING I 3 3 91 A', 'Term 3 3 13.50 4.50',
      'SEMESTER SYSTEM RE-ADOPTED', 'SPRING 2022/2023', 'CPIT 240 DATABASES I 3 3 88 B+',
    ])
    expect(parsed.rows.map(r => [r.code, r.section, r.term, r.year, r.system])).toEqual([
      ['ELI-101', 'equivalent', null, null, null],
      ['CPIT-110', 'term', 'FALL', '2020/2021', 'quarter'],
      ['CPIT-240', 'term', 'SPRING', '2022/2023', 'semester'],
    ])
    expect(parsed.terms).toEqual([{ season: 'FALL', year: '2020/2021', system: 'quarter', rows: 1 }, { season: 'SPRING', year: '2022/2023', system: 'semester', rows: 1 }])
  })

  test('a term that runs onto the next column or page is one term', () => {
    const parsed = read(['FALL 2022/2023', 'CPIT 252 SOFTWARE DESIGN 3 3 91 A', 'Dean of Admission', 'DR. TEST DEAN', 'CPIT 305 ADV. PROGRAMMING 3 3 86 B+'])
    expect(parsed.rows.map(r => [r.code, r.term])).toEqual([['CPIT-252', 'FALL'], ['CPIT-305', 'FALL']])
    expect(parsed.terms).toHaveLength(1)
  })

  test('totals, footers, the dean and the line after it, and the STUDENT INFORMATION block are counted, never rows', () => {
    const parsed = read([
      'STUDENT INFORMATION', 'NAME TEST STUDENT ZULU', 'STUDENT NO 0000099', 'MAJOR INFORMATION TECHNOLOGY',
      'FALL 2021/2022', 'CPIT 240 DATABASES I 3 3 88 B+',
      'Term 3 3 13.50 4.50', 'Cumulative 3 3 13.50 4.50', 'Quarter 65 65', 'Semester 43 43',
      'Print Date: 01/01/2026 Page 1 of 2', 'Page 2 of 2', 'SEMESTER SYSTEM RE-ADOPTED',
      'Dean of Admission', 'ABC 123 NOT A ROW 3 3 90 A',
      'Cumulative Total 3 3 13.50 4.50', 'Transferred Total 0 0', 'Grand Total 3 3 13.50 4.50', 'Cumulative GPA 3.10', 'Cumulative GPA 4.50', 'End of Transcript',
    ])
    expect(parsed.rows.map(r => r.code)).toEqual(['CPIT-240'])
    expect(parsed.ignored).toEqual({
      'student-information': 4, 'term-total': 1, cumulative: 1, 'quarter-total': 1, 'semester-total': 1, 'print-date': 1, page: 1, 'system-change': 1,
      dean: 2, 'cumulative-total': 1, 'transferred-total': 1, 'grand-total': 1, 'cumulative-gpa': 2, end: 1,
    })
    expect(parsed.checkGpa).toBe('4.50') // the final one; read only
    // Nothing of the STUDENT INFORMATION block is kept anywhere in the result.
    expect(JSON.stringify(parsed)).not.toMatch(/ZULU|0000099/)
  })

  test('the KAU format is recognised only by its STUDENT INFORMATION header', () => {
    expect(isKauTranscript({ headerLines: [{ text: 'STUDENT INFORMATION' }], lines: [] })).toBe(true)
    expect(isKauTranscript({ headerLines: [], lines: ['CPIT 240 DATABASES I 3 3 88 B+'] })).toBe(false)
  })
})

describe('retakes (Task 52)', () => {
  const lines = [
    'FALL 2021/2022', 'CPIT 240 DATABASES I 3 3 52 F', 'ELI 101 ENGLISH LANGUAGE I 2 2 90 A',
    'SPRING 2021/2022', 'CPIT 240 DATABASES I 3 3 58 F',
    'FALL 2022/2023', 'CPIT 240 DATABASES I 3 3 87 B+',
  ]

  test('every attempt is kept in order; the latest is used, older ones are retaken', () => {
    const parsed = read(lines)
    expect(parsed.rows.map(r => [r.code, r.letter, r.retaken])).toEqual([['CPIT-240', 'F', true], ['ELI-101', 'A', false], ['CPIT-240', 'F', true], ['CPIT-240', 'B+', false]])
  })

  test('the review list shows one row per course, the latest attempt, with every attempt in `attempts`', () => {
    const courses = reviewRows(read(lines).rows)
    expect(courses.map(r => [r.code, r.letter])).toEqual([['ELI-101', 'A'], ['CPIT-240', 'B+']])
    expect(courses[1].attempts.map(a => [a.letter, a.term, a.year, a.retaken])).toEqual([['F', 'FALL', '2021/2022', true], ['F', 'SPRING', '2021/2022', true], ['B+', 'FALL', '2022/2023', false]])
    expect(courses[0].attempts).toBeUndefined()
  })

  test('the latest is chosen by term, not by reading order; a transfer is older than any term', () => {
    const parsed = read(['SPRING 2022/2023', 'CPIT 240 DATABASES I 3 3 87 B+', 'FALL 2021/2022', 'CPIT 240 DATABASES I 3 3 52 F', 'EQUIVALENT COURSES', 'CPIT 240 DATABASES I 3 3 TR'])
    expect(parsed.rows.map(r => [r.letter, r.retaken])).toEqual([['B+', false], ['F', true], ['TR', true]])
  })

  test('the same code twice in one term is not a retake: both rows stay and the review reports a duplicate', () => {
    const parsed = read(['FALL 2021/2022', 'CPIT 240 DATABASES I 3 3 52 F', 'CPIT 240 DATABASES I 3 3 87 B+'])
    expect(parsed.rows.map(r => r.retaken)).toEqual([false, false])
    const courses = reviewRows(parsed.rows).map(r => ({ ...r, grade: r.letter, source: 'pdf' }))
    expect(reviewProfileQuality(courses).issues.map(i => i.kind)).toEqual(['duplicate'])
  })

  test('the review labels: the term, "Retaken: latest attempt shown"', () => {
    const [eli, cpit] = reviewRows(read(lines).rows)
    expect(termLabel(eli, 'en')).toBe('Fall 2021/2022')
    expect(termLabel(eli, 'ar')).toBe('الخريف 2021/2022')
    expect(termLabel({ term: 'WINTER', year: '2020/2021', system: 'quarter' }, 'en')).toBe('Winter 2020/2021 (quarter system)')
    expect(termLabel({ section: 'equivalent', term: null }, 'en')).toBe('Transferred (equivalent courses)')
    expect(termLabel({ code: 'CPIT-240', name: 'x', grade: 'A' }, 'en')).toBeNull()
    expect(cpit.attempts.filter(a => a.retaken)).toHaveLength(2)
  })
})

describe('the fixtures in the app: approval and the generic path (Task 52)', () => {
  test('retake.pdf: one row per course, CPIT-240 shows B+ with its F attempt; can be approved', async () => {
    const { courses, checkGpa } = readKauLayout(await fixture('retake'))
    expect(courses).toHaveLength(9)
    expect(courses.filter(c => c.code === 'CPIT-240').map(c => [c.grade, c.attempts.map(a => a.letter)])).toEqual([['B+', ['F', 'B+']]])
    expect(checkGpa).toBe('3.95')
    expect(reviewProfileQuality(courses.map(c => ({ ...c, source: 'pdf' })))).toMatchObject({ issues: [], canApprove: true })
  })

  test('transfer-tr.pdf: the TR rows are valid grades and can be approved', async () => {
    const { courses } = readKauLayout(await fixture('transfer-tr'))
    expect(courses.filter(c => c.grade === 'TR').length).toBeGreaterThanOrEqual(3)
    expect(reviewProfileQuality(courses)).toMatchObject({ issues: [], canApprove: true })
  })

  test('codes-mix.pdf: every code read, the unknown one flagged, and it can be approved', async () => {
    const { courses } = readKauLayout(await fixture('codes-mix'))
    const quality = reviewProfileQuality(courses)
    expect(quality.issues).toEqual([])
    expect(quality.warnings.map(w => courses[w.index].code)).toEqual(['CPIT-250'])
    expect(quality.canApprove).toBe(true)
  })

  test('a text or PDF without the KAU header still goes through the generic parser, unchanged', () => {
    const layout = { headerLines: [], lines: ['CPIT-240 Databases 3 A', 'CPIT 251 Software Engineering 3 B+'] }
    expect(isKauTranscript(layout)).toBe(false)
    expect(parseTranscriptTextDetailed(pdfLayoutText({ headerLines: [], lines: layout.lines.map(text => ({ text })) })).courses.map(c => [c.code, c.grade, c.hours]))
      .toEqual([['CPIT-240', 'A', 3], ['CPIT-251', 'B+', 3]])
  })
})
