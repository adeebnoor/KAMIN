// Task 53 · read only the college, major, degree, status and study mode from the STUDENT INFORMATION block.
//
// Input: Task 51's `headerLines` (src/transcript/layout.js): each line one column of one band, with its text
// items in x order. The block is a form, label then value:  COLLEGE  COMPUTING & INFORMATION TECH.
// A label is a text item that is exactly a known label (a trailing colon allowed), or that starts with the
// label followed by a colon ("COLLEGE: …"). Its value is the items after it, up to the next known label or
// the end of the line.
//
// Only COLLEGE, MAJOR, DEGREE, STATUS and STUDY MODE are kept. NAME, STUDENT NO, NATIONALITY, NID and any
// other label are known only so that their values END the value before them; the values themselves are
// dropped right here and never returned, logged or stored. Kept values are free text, as printed (trimmed,
// spaces collapsed). The college is then looked up by src/catalog/colleges.js (exact alias, never guessed).
import { collegeFromText } from '../catalog/colleges.js'

// The labels whose values are read, and the field each one fills.
export const READ_LABELS = Object.freeze({
  COLLEGE: 'collegeRaw',
  MAJOR: 'majorRaw',
  DEGREE: 'degreeRaw',
  STATUS: 'statusRaw',
  'STUDY MODE': 'studyModeRaw',
})
// Labels that are recognised only to end the value before them. Their values are never read.
export const DROPPED_LABELS = Object.freeze(['STUDENT INFORMATION', 'STUDENT NO', 'NAME', 'NATIONALITY', 'NID'])
const LABELS = [...Object.keys(READ_LABELS), ...DROPPED_LABELS].sort((a, b) => b.length - a.length)

export const STUDENT_FIELDS = Object.freeze(['collegeId', 'collegeRaw', 'majorRaw', 'degreeRaw', 'statusRaw', 'studyModeRaw'])

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim()

// An item's text → { label, rest } when it is a label ("COLLEGE", "COLLEGE:", "COLLEGE: FACULTY OF …"), else null.
function labelOf(str) {
  const text = clean(str).toUpperCase()
  for (const label of LABELS) {
    if (text === label || text === `${label}:`) return { label, rest: '' }
    if (text.startsWith(`${label}:`)) return { label, rest: clean(clean(str).slice(label.length + 1)) }
  }
  return null
}

const lineItems = line => Array.isArray(line?.items) && line.items.length
  ? line.items.map(item => item.str)
  : [typeof line === 'string' ? line : line?.text]

// headerLines → { collegeId, collegeRaw, majorRaw, degreeRaw, statusRaw, studyModeRaw }; a field not printed
// is null. Every page repeats the block: the first value printed wins.
export function readStudentInfo(headerLines = []) {
  const found = {}
  for (const line of headerLines || []) {
    let field = null; let parts = []
    const close = () => {
      if (field && !(field in found)) { const value = clean(parts.join(' ')); if (value) found[field] = value }
      field = null; parts = []
    }
    for (const str of lineItems(line)) {
      const label = labelOf(str)
      if (label) {
        close()
        field = READ_LABELS[label.label] || null // a dropped label: nothing after it is kept
        if (field && label.rest) parts.push(label.rest)
        continue
      }
      if (field) parts.push(str)
    }
    close()
  }
  const collegeRaw = found.collegeRaw ?? null
  return {
    collegeId: collegeRaw === null ? null : collegeFromText(collegeRaw).id,
    collegeRaw,
    majorRaw: found.majorRaw ?? null,
    degreeRaw: found.degreeRaw ?? null,
    statusRaw: found.statusRaw ?? null,
    studyModeRaw: found.studyModeRaw ?? null,
  }
}

// Plain text (a .txt file or OCR): each line is read as one item, so only "LABEL: value" lines count.
export const readStudentInfoFromText = text => readStudentInfo(String(text || '').split(/\r?\n/).map(clean).filter(Boolean))

// A line that belongs to the STUDENT INFORMATION block (it starts with one of its labels). Used to keep such
// lines out of `validation.rejected` when the text has no separate header block (a .txt file or OCR).
export const isStudentInfoLine = text => LABELS.some(label => new RegExp(`^${label}\\b`).test(clean(text).toUpperCase()))
