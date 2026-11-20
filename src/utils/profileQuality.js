import { courseSkillMap } from '../data.js'
import { normalizeGrade } from './engine.js'
import { LETTER_CODES } from './grades.js'
import { provenanceSignals } from './provenance.js'

import { canonicalCourseCode } from '../ontology/registry.js'

// Re-exported so existing imports keep working; the single definition lives in the ontology registry.
export { canonicalCourseCode }
// Task 52: every KAU letter code (src/utils/grades.js) is a valid grade, with today's numeric, Arabic and
// other letter forms.
export const validGrade = value => LETTER_CODES.includes(normalizeGrade(value)) || /^(A[+-]?|B[+-]?|C[+-]?|D[+-]?|F|W|WF|I|IP|NP|DN|P|PASS)$/.test(normalizeGrade(value)) || (/^\d+(\.\d+)?$/.test(normalizeGrade(value)) && Number(normalizeGrade(value)) >= 0 && Number(normalizeGrade(value)) <= 100)

// The term a row sits under (rows typed by hand or read by the generic parser have none: one shared term).
const termKey = row => row.section === 'equivalent' ? 'equivalent' : `${row.term ?? ''}|${row.year ?? ''}|${row.system ?? ''}`
// A letter the transcript printed but the table does not know (e.g. "ZZ"): kept, shown, never blocking,
// as long as the row still holds the printed letter.
const unknownPrintedLetter = row => row.letterStatus === 'unknown' && row.letter != null && normalizeGrade(row.grade) === normalizeGrade(row.letter)

// Integrity checks identify inconsistencies; they cannot authenticate a transcript. `issues` block
// approval; `warnings` are shown on their row and do not.
export function reviewProfileQuality(rows = []) {
  const issues = []
  const warnings = []
  const seen = new Set()
  for (const [index, row] of rows.entries()) {
    const code = canonicalCourseCode(row.code)
    const name = typeof row.name === 'string' ? row.name.trim() : row.name?.ar || row.name?.en
    if (!code || !name || !String(row.grade || '').trim()) issues.push({ index, code, kind: 'incomplete' })
    else if (!validGrade(row.grade)) (unknownPrintedLetter(row) ? warnings : issues).push({ index, code, kind: unknownPrintedLetter(row) ? 'unknownLetter' : 'grade' })
    // Task 52: the same code in another term is a retake, not a duplicate.
    const key = `${code}#${termKey(row)}`
    if (code && seen.has(key)) issues.push({ index, code, kind: 'duplicate' })
    seen.add(key)
  }
  return { issues, warnings, signals: provenanceSignals(rows), canApprove: rows.length > 0 && issues.length === 0, mapped: rows.filter(r => courseSkillMap[canonicalCourseCode(r.code)]).length, total: rows.length }
}
