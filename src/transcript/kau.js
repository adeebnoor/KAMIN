// Task 52 · read the rows of a KAU English transcript exactly as printed.
//
// Input: the lines of src/transcript/layout.js (Task 51), each column of each page in reading order, and
// the header lines (the STUDENT INFORMATION block). Output: { rows, terms, checkGpa, ignored, rejected }.
//
// A row is   SUBJECT NUMBER  description …  UA UE MARKS LETTER
// read from the END of the line, so that no word of the description (a Roman numeral, a registrar typo,
// a number such as "CALCULUS 2") can ever be taken for a grade or for credits. TR rows under
// "EQUIVALENT COURSES" print no MARKS. No list of subjects or courses is hardcoded: any upper-case
// subject of 2–4 letters followed by a 3-digit number is a course code.
//
// Nothing from the STUDENT INFORMATION block is read here (Task 53 reads the college and the programme;
// the name, number, nationality and national ID are never read). Ignored lines are only counted.
import { canonicalCourseCode } from '../ontology/registry.js'
import { catalogCourse } from '../catalog/fcit.js'
import { letterStatus } from '../utils/grades.js'

export const KAU_FORMAT = 'kau'
const SEASONS = ['FALL', 'WINTER', 'SPRING', 'SUMMER']
const TERM_HEADER = /^(FALL|WINTER|SPRING|SUMMER)\s+(\d{4})\/(\d{4})(\s*\(QUARTER\))?/
const EQUIVALENT = /^EQUIVALENT COURSES\b/
const STUDENT_INFORMATION = /^STUDENT INFORMATION\b/
// Case-sensitive on purpose: an upper-case title word followed by a number ("SYSTEM 250") is never at the
// start of a row, and "Term 10 7 …" is a total line, not a course.
const COURSE_CODE = /^([A-Z]{2,4})\s*(\d{3})(?![\d.])/
const NUMBER = /^\d+(?:\.\d+)?$/
const LETTER = /^[A-Z]{1,4}\+?$/
const CHECK_GPA = /^Cumulative GPA\s+(\d+(?:\.\d+)?)/

// Lines that are never rows. Order matters: the longer label first.
const IGNORED = [
  ['cumulative-gpa', /^Cumulative GPA\b/],
  ['cumulative-total', /^Cumulative Total\b/],
  ['transferred-total', /^Transferred Total\b/],
  ['grand-total', /^Grand Total\b/],
  ['cumulative', /^Cumulative\b/],
  ['term-total', /^Term\b/],
  ['transfer-equivalency', /^Transfer Equivalency\b/],
  ['quarter-total', /^Quarter\b/],
  ['semester-total', /^Semester\b/],
  ['print-date', /^Print Date\b/],
  ['page', /^Page\s+\d+/],
  ['dean', /^Dean of Admission\b/],
  ['system-change', /^SEMESTER SYSTEM RE-ADOPTED\b/],
  ['end', /^End of Transcript\b/],
]

const lineText = line => String(typeof line === 'string' ? line : line?.text ?? '').replace(/\s+/g, ' ').trim()

// The KAU format is recognised by its STUDENT INFORMATION header; anything else goes to the generic parser.
export function isKauTranscript({ lines = [], headerLines = [] } = {}) {
  return [...headerLines, ...lines].some(line => STUDENT_INFORMATION.test(lineText(line)))
}

export function parseTermHeader(text) {
  const m = TERM_HEADER.exec(lineText(text))
  if (!m) return null
  return { season: m[1], year: `${m[2]}/${m[3]}`, system: m[4] ? 'quarter' : 'semester' }
}

// One row line → its cells, or null when the line does not start with a course code, or { error } when it
// does but its end is not "UA UE [MARKS] LETTER".
export function parseRowLine(text, { section = 'term' } = {}) {
  const line = lineText(text)
  const code = COURSE_CODE.exec(line)
  if (!code) return null
  const tokens = line.slice(code[0].length).split(' ').filter(Boolean)
  // pdf.js may hand "B+" over as "B" and "+": the layout joins them with a space.
  for (let i = tokens.length - 1; i > 0; i -= 1) if (tokens[i] === '+' && LETTER.test(tokens[i - 1])) tokens.splice(i - 1, 2, `${tokens[i - 1]}+`)
  const fail = reason => ({ error: reason })
  let end = tokens.length
  const letter = tokens[end - 1]
  if (!letter || !LETTER.test(letter)) return fail('no letter at the end of the row')
  end -= 1
  let marks = null
  const before = tokens[end - 1]
  if (before && LETTER.test(before)) { marks = before; end -= 1 }
  else if (section !== 'equivalent' && letter !== 'TR') {
    if (!before || !NUMBER.test(before)) return fail('no marks before the letter')
    marks = Number(before); end -= 1
  }
  const ue = tokens[end - 1], ua = tokens[end - 2]
  if (!NUMBER.test(ue || '') || !NUMBER.test(ua || '')) return fail('no credits before the marks')
  end -= 2
  const name = tokens.slice(0, end).join(' ')
  if (!name) return fail('no description')
  return { code: canonicalCourseCode(`${code[1]}-${code[2]}`), name, credits: { ua: Number(ua), ue: Number(ue) }, marks, letter }
}

// Chronological order of a row: transfers first, then by academic year and season.
const termOrder = row => row.section === 'equivalent' ? -1 : Number(String(row.year).slice(0, 4)) * 10 + SEASONS.indexOf(row.term)
const sameTerm = (a, b) => a.section === b.section && a.term === b.term && a.year === b.year

export function parseKauLines({ lines = [] } = {}) {
  const rows = []; const terms = []; const ignored = {}; const rejected = []
  let checkGpa = null
  let current = null // { season, year, system }
  let section = 'term'
  let skip = null // 'dean' (the line after "Dean of Admission") or 'student' (the STUDENT INFORMATION block)
  const count = kind => { ignored[kind] = (ignored[kind] || 0) + 1 }

  for (const line of lines) {
    const text = lineText(line)
    if (!text) continue
    const term = parseTermHeader(text)
    if (term) {
      skip = null
      section = 'term'
      current = terms.find(t => t.season === term.season && t.year === term.year && t.system === term.system) || null
      if (!current) { current = { ...term, rows: 0 }; terms.push(current) }
      continue
    }
    if (EQUIVALENT.test(text)) { skip = null; section = 'equivalent'; current = null; continue }
    if (skip === 'dean') { count('dean'); skip = null; continue }
    if (skip === 'student') { count('student-information'); continue }
    if (STUDENT_INFORMATION.test(text)) { count('student-information'); skip = 'student'; continue }
    const kind = IGNORED.find(([, re]) => re.test(text))?.[0]
    if (kind) {
      count(kind)
      if (kind === 'cumulative-gpa') checkGpa = CHECK_GPA.exec(text)?.[1] ?? checkGpa
      if (kind === 'dean') skip = 'dean'
      continue
    }
    const cells = parseRowLine(text, { section })
    if (!cells) { count('other'); continue }
    if (cells.error) { rejected.push({ line: text, reason: cells.error }); continue }
    const inTerm = section === 'term' && current
    if (inTerm) current.rows += 1
    rows.push({
      ...cells,
      letterStatus: letterStatus(cells.letter),
      term: inTerm ? current.season : null,
      year: inTerm ? current.year : null,
      system: inTerm ? current.system : null,
      section,
      retaken: false,
      inCourseMap: !!catalogCourse(cells.code),
    })
  }

  // Retakes: the same code in more than one term. The latest term's attempt is the one used; earlier
  // terms' attempts are `retaken`. Two rows of one code in the same term are not a retake (a duplicate,
  // reported by profileQuality).
  const byCode = new Map()
  rows.forEach(row => byCode.set(row.code, [...(byCode.get(row.code) || []), row]))
  for (const group of byCode.values()) {
    if (group.length < 2) continue
    const latest = group.reduce((a, b) => termOrder(b) >= termOrder(a) ? b : a)
    for (const row of group) row.retaken = !sameTerm(row, latest)
  }

  return { format: KAU_FORMAT, rows, terms: terms.map(({ season, year, system, rows: n }) => ({ season, year, system, rows: n })), checkGpa, ignored, rejected }
}

// The rows the review list shows: older attempts of a retaken course are not separate rows; they ride on
// the row used, in `attempts` (every attempt in transcript order, the used one included).
export function reviewRows(rows = []) {
  const byCode = new Map()
  rows.forEach(row => byCode.set(row.code, [...(byCode.get(row.code) || []), row]))
  return rows.filter(row => !row.retaken).map(row => {
    const all = byCode.get(row.code)
    if (!all.some(a => a.retaken)) return { ...row }
    return { ...row, attempts: all.map(({ code, name, credits, marks, letter, letterStatus: status, term, year, system, section, retaken }) => ({ code, name, credits, marks, letter, letterStatus: status, term, year, system, section, retaken })) }
  })
}
