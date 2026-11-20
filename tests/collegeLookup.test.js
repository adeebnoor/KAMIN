// Task 53: the college printed on a transcript → which approved course map applies.
// Exact match on a normalised alias only: a wrong college is never guessed.
import { describe, test, expect } from 'vitest'
import { COLLEGES, COLLEGE_ABBREVIATIONS, collegeFromText, normalizeCollegeText } from '../src/catalog/colleges.js'
import { readStudentInfo, readStudentInfoFromText, isStudentInfoLine, STUDENT_FIELDS } from '../src/transcript/studentInfo.js'

describe('collegeFromText (Task 53)', () => {
  test("the brief's example: COMPUTING &amp; INFORMATION TECH. is FCIT, the printed text kept", () => {
    expect(collegeFromText('COMPUTING &amp; INFORMATION TECH.')).toEqual({ id: 'FCIT', raw: 'COMPUTING &amp; INFORMATION TECH.' })
    expect(normalizeCollegeText('COMPUTING &amp; INFORMATION TECH.')).toBe('COMPUTING AND INFORMATION TECHNOLOGY')
  })

  test.each([
    'COMPUTING AND INFORMATION TECHNOLOGY',
    'Computing and Information Technology',
    'FACULTY OF COMPUTING & INFORMATION TECHNOLOGY',
    'College of Computing & Information Technology',
    'COMPUTING & INFO. TECH.',
    'COMPUTING&INFORMATION TECH',
    '  COMPUTING   &   INFORMATION    TECH .  ',
    'COMPUTING AND INFORMATION TECH.',
    'COMPUTING, AND INFORMATION TECH',
    'COMP. & INFO. TECH.',
    'FCIT',
  ])('spacing, dots, case and short forms: %j is FCIT', raw => {
    expect(collegeFromText(raw).id).toBe('FCIT')
  })

  test.each([
    ['FACULTY OF SCI.', 'SCI'], ['Faculty of Science', 'SCI'], ['SCIENCE', 'SCI'], ['College of Sciences', 'SCI'], ['SCI', 'SCI'],
    ['FACULTY OF MEDICINE', 'MED'], ['FACULTY OF MED.', 'MED'], ['Medicine', 'MED'], ['COLLEGE OF MED', 'MED'],
  ])('Science and Medicine, short forms too: %j is %s', (raw, id) => {
    expect(collegeFromText(raw)).toEqual({ id, raw: raw.trim() })
  })

  test.each([
    'FACULTY OF ECONOMICS & ADMIN.',
    'FACULTY OF ENGINEERING',
    'COMPUTING',
    'INFORMATION TECHNOLOGY',
    'COMPUTER SCIENCE',
    'MEDICINE AND SURGERY',
    'COMPUTING AND INFORMATION TECHNOLOGY DEPARTMENT',
    'FACULTY OF COMPUTNG & INFORMATION TECH.',
  ])('an unknown (or misspelt, or partial) college is not guessed: %j gives id null, raw kept', raw => {
    expect(collegeFromText(raw)).toEqual({ id: null, raw })
  })

  test('an empty value gives id null', () => {
    expect(collegeFromText('')).toEqual({ id: null, raw: '' })
    expect(collegeFromText('   ')).toEqual({ id: null, raw: '' })
    expect(collegeFromText(null)).toEqual({ id: null, raw: null })
    expect(collegeFromText(undefined)).toEqual({ id: null, raw: null })
    expect(collegeFromText('FACULTY OF')).toEqual({ id: null, raw: 'FACULTY OF' })
  })

  test('every college has aliases in normalised form, each alias belongs to one college only, and the table expands short forms', () => {
    const seen = new Map()
    for (const college of COLLEGES) {
      expect(college.aliases.length, college.id).toBeGreaterThan(0)
      for (const alias of college.aliases) {
        expect(alias).toMatch(/^[A-Z ]+$/)
        const key = normalizeCollegeText(alias)
        if (seen.has(key)) expect(seen.get(key), `${alias} is listed for two colleges`).toBe(college.id)
        seen.set(key, college.id)
        expect(collegeFromText(alias).id).toBe(college.id)
      }
    }
    expect(COLLEGE_ABBREVIATIONS).toMatchObject({ TECH: 'TECHNOLOGY', INFO: 'INFORMATION', COMP: 'COMPUTING', SCI: 'SCIENCE', MED: 'MEDICINE', ENG: 'ENGINEERING', ADMIN: 'ADMINISTRATION', ECON: 'ECONOMICS' })
  })
})

// Header lines shaped as src/transcript/layout.js gives them (one column of one band, items in x order).
const line = (...strs) => ({ text: strs.join(' '), items: strs.map((str, i) => ({ str, x: i * 50, y: 700, width: 40, height: 7 })) })

describe('readStudentInfo (Task 53)', () => {
  test('reads only COLLEGE, MAJOR, DEGREE, STATUS and STUDY MODE; NAME, STUDENT NO, NATIONALITY and NID are dropped', () => {
    const student = readStudentInfo([
      line('STUDENT INFORMATION'),
      line('NAME', 'TEST STUDENT ZULU'), line('STUDENT NO', '0000099'),
      line('NATIONALITY', 'TESTLAND'), line('NID', '0000000099'),
      line('COLLEGE', 'COMPUTING & INFO. TECH.'), line('MAJOR', 'COMPUTER SCIENCE'),
      line('DEGREE', 'BACHELOR'), line('STATUS', 'ACTIVE'), line('STUDY MODE', 'REGULAR'),
    ])
    expect(student).toEqual({ collegeId: 'FCIT', collegeRaw: 'COMPUTING & INFO. TECH.', majorRaw: 'COMPUTER SCIENCE', degreeRaw: 'BACHELOR', statusRaw: 'ACTIVE', studyModeRaw: 'REGULAR' })
    expect(Object.keys(student)).toEqual(STUDENT_FIELDS)
    for (const value of ['TEST STUDENT ZULU', '0000099', 'TESTLAND', '0000000099']) expect(JSON.stringify(student)).not.toContain(value)
  })

  test('a value ends at the next label, known or dropped, on the same line; a value split over items is joined', () => {
    expect(readStudentInfo([line('COLLEGE', 'FACULTY', 'OF', 'MEDICINE', 'NAME', 'TEST STUDENT ZULU', 'MAJOR', 'MEDICINE AND SURGERY')]))
      .toMatchObject({ collegeId: 'MED', collegeRaw: 'FACULTY OF MEDICINE', majorRaw: 'MEDICINE AND SURGERY' })
    const student = readStudentInfo([line('NAME', 'TEST STUDENT ZULU', 'STATUS', 'ACTIVE')])
    expect(student.statusRaw).toBe('ACTIVE')
    expect(JSON.stringify(student)).not.toContain('ZULU')
  })

  test('"LABEL: value" in one item, and a label with a trailing colon', () => {
    expect(readStudentInfo([line('COLLEGE: FACULTY OF SCI.'), line('MAJOR:', 'MATHEMATICS')]))
      .toMatchObject({ collegeId: 'SCI', collegeRaw: 'FACULTY OF SCI.', majorRaw: 'MATHEMATICS' })
  })

  test('an unknown label on its own line, and anything not after a read label, is never returned', () => {
    const student = readStudentInfo([line('GENDER', 'MADE-UP VALUE'), line('BIRTH DATE', '01/01/2000'), line('ACADEMIC TRANSCRIPT'), line('COLLEGE', 'FACULTY OF MEDICINE')])
    expect(JSON.stringify(student)).not.toMatch(/MADE-UP VALUE|01\/01\/2000|TRANSCRIPT/)
    expect(student.collegeId).toBe('MED')
  })

  test('the first value printed wins (every page repeats the block); missing fields are null', () => {
    expect(readStudentInfo([line('COLLEGE', 'FACULTY OF SCI.'), line('COLLEGE', 'FACULTY OF MEDICINE')]))
      .toEqual({ collegeId: 'SCI', collegeRaw: 'FACULTY OF SCI.', majorRaw: null, degreeRaw: null, statusRaw: null, studyModeRaw: null })
    expect(readStudentInfo([])).toEqual({ collegeId: null, collegeRaw: null, majorRaw: null, degreeRaw: null, statusRaw: null, studyModeRaw: null })
    expect(readStudentInfo([line('COLLEGE')]).collegeRaw).toBeNull()
  })

  test('an unknown college keeps its raw text with collegeId null', () => {
    expect(readStudentInfo([line('COLLEGE', 'FACULTY OF ECONOMICS & ADMIN.')])).toMatchObject({ collegeId: null, collegeRaw: 'FACULTY OF ECONOMICS & ADMIN.' })
  })

  test('plain text reads only "LABEL: value" lines; isStudentInfoLine finds the block\'s lines', () => {
    const student = readStudentInfoFromText('NAME: TEST STUDENT ZULU\nCOLLEGE: Faculty of Science\nMAJOR CHEMISTRY\nCPIT 250 SYSTEMS 3 3 90 A+')
    expect(student).toMatchObject({ collegeId: 'SCI', collegeRaw: 'Faculty of Science', majorRaw: null })
    expect(JSON.stringify(student)).not.toContain('ZULU')
    for (const text of ['NAME TEST STUDENT ZULU STUDENT NO 0000099', 'student no 0000099', 'NID 0000000099', 'NATIONALITY TESTLAND', 'STUDENT INFORMATION', 'COLLEGE FACULTY OF SCI.']) expect(isStudentInfoLine(text), text).toBe(true)
    for (const text of ['CPIT 250 SYSTEMS ANALYSIS 3 3 90 A+', 'NAMED ENTITIES 101 3 A']) expect(isStudentInfoLine(text), text).toBe(false)
  })
})
