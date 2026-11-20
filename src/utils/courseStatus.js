// Task 22 · the status of one course row on the review screen and in My data: where it came from
// (provenance), whether it is linked to a capability (mapping), and the reasons a student should look
// at it. Plain functions, shared by src/components/CourseReview.jsx and its unit tests.
import { copy, fill } from '../i18n.js'
import { courseSkillMap } from '../data.js'
import { rowProvenance } from './provenance.js'
import { reviewProfileQuality } from './profileQuality.js'
import { collegeHasMap } from '../catalog/colleges.js'

const normalizeCourseCode = code => String(code || '').trim().toUpperCase().replace(/\s+/g, '-').replace(/^([A-Z]{2,8})-?(\d{2,4})$/, '$1-$2')
export const isMappedCourse = code => !!courseSkillMap[normalizeCourseCode(code)]
const ISSUE_TEXT = { duplicate: 'duplicate', grade: 'badGrade', incomplete: 'incomplete' }

// Task 52: where a row sits on the transcript ("Fall 2021/2022", "Transferred (equivalent courses)"), or
// null for rows without a term (typed by hand, read by the generic parser).
export function termLabel(row, lang) {
  const R = copy[lang].screens.review
  if (row?.section === 'equivalent') return R.equivalentTerm
  if (!row?.term || !row?.year) return null
  return `${R.seasons[row.term] || row.term} ${row.year}${row.system === 'quarter' ? ` (${R.quarterSystem})` : ''}`
}

// The provenance sentence of an edited row (the wording of the old review table's signal list).
export function editSentence(row, provenance, lang) {
  if (provenance.gradeRaised) return lang === 'ar'
    ? `رفعت درجة ${row.code} من ${row.edits.grade} إلى ${row.grade} بعد الاستخراج؛ ستُعامل كتصريح ذاتي لا كدليل من المستند.`
    : `You raised the grade of ${row.code} from ${row.edits.grade} to ${row.grade} after extraction; it will count as self-declared, not document evidence.`
  return lang === 'ar'
    ? `عدّلت ${provenance.edits.map(f => ({ code: 'الرمز', name: 'الاسم', grade: 'الدرجة' })[f]).join(' و')} في ${row.code}؛ يصبح الصف تصريحًا ذاتيًا حتى تعيده إلى قيمته المستخرجة.`
    : `You edited the ${provenance.edits.join(' and ')} of ${row.code}; the row counts as self-declared until you restore the extracted value.`
}

// A row needs a look when it has a problem (duplicate, unknown grade, incomplete), was edited after
// extraction, or is not linked to a capability yet. Task 52: a printed letter code we do not know
// (`unknownLetter`) is shown the same way but does not block approval; a code outside the course map
// says so.
export function courseStatus(row, { lang, college = null, issue = null }) {
  const R = copy[lang].screens.review
  const provenance = rowProvenance(row)
  const noMap = !!college && !collegeHasMap(college)
  const mapped = isMappedCourse(row.code)
  const mapping = noMap ? { kind: 'unmapped', text: R.noMap }
    : mapped && provenance.level === 'declared' ? { kind: 'pending', text: R.pendingBadge }
    : mapped ? { kind: 'mapped', text: R.mappedBadge } : { kind: 'unmapped', text: R.unmappedBadge }
  const edited = provenance.gradeRaised || provenance.level === 'edited'
  const reasons = []
  if (issue) reasons.push({ tone: 'issue', text: issue === 'unknownLetter' ? fill(R.unknownLetter, { letter: row.letter }) : R[ISSUE_TEXT[issue]] })
  if (edited) reasons.push({ tone: 'edited', text: editSentence(row, provenance, lang) })
  if (mapping.kind === 'unmapped') reasons.push({ tone: 'unlinked', text: noMap ? R.noMapReason : row.inCourseMap === false ? R.notInCourseMap : R.notLinkedReason })
  return { provenance, mapping, reasons, attention: reasons.length > 0, tone: issue ? 'issue' : edited ? 'edited' : mapping.kind }
}

// The first problem of each row, by row index ("incomplete" and "grade" before "duplicate"; a warning
// such as an unknown printed letter only when the row has no problem).
export function issuesByRow(rows) {
  const map = {}
  const quality = reviewProfileQuality(rows)
  for (const issue of quality.issues) if (!map[issue.index] || map[issue.index] === 'duplicate') map[issue.index] = issue.kind
  for (const warning of quality.warnings) if (!map[warning.index]) map[warning.index] = warning.kind
  return map
}

// Display order: rows that need a look first, then the rest, each group in transcript order.
export function attentionOrder(rows, { lang = 'en', college = null } = {}) {
  const issues = issuesByRow(rows)
  const needs = rows.map((row, i) => courseStatus(row, { lang, college, issue: issues[i] }).attention)
  return [...rows.keys()].sort((a, b) => (needs[b] - needs[a]) || (a - b))
}
