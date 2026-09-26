import { courseSkillMap } from '../data.js'
import { normalizeGrade } from './engine.js'

export const canonicalCourseCode = code => String(code || '').trim().toUpperCase().replace(/\s+/g, '-').replace(/^([A-Z]{2,8})-?(\d{2,4})$/, '$1-$2')
export const validGrade = value => /^(A[+-]?|B[+-]?|C[+-]?|D[+-]?|F|W|WF|I|IP|NP|DN|P|PASS)$/.test(normalizeGrade(value)) || (/^\d+(\.\d+)?$/.test(normalizeGrade(value)) && Number(normalizeGrade(value)) >= 0 && Number(normalizeGrade(value)) <= 100)

// Integrity checks identify inconsistencies; they cannot authenticate a transcript.
export function reviewProfileQuality(rows = []) {
  const issues = []
  const seen = new Set()
  for (const [index, row] of rows.entries()) {
    const code = canonicalCourseCode(row.code)
    const name = typeof row.name === 'string' ? row.name.trim() : row.name?.ar || row.name?.en
    if (!code || !name || !String(row.grade || '').trim()) issues.push({ index, code, kind: 'incomplete' })
    else if (!validGrade(row.grade)) issues.push({ index, code, kind: 'grade' })
    if (code && seen.has(code)) issues.push({ index, code, kind: 'duplicate' })
    seen.add(code)
  }
  return { issues, canApprove: rows.length > 0 && issues.length === 0, mapped: rows.filter(r => courseSkillMap[canonicalCourseCode(r.code)]).length, total: rows.length }
}
