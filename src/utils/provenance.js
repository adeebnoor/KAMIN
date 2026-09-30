// Field-level provenance for transcript rows.
//
// A row extracted from a document keeps the extracted values in `edits` when the
// student changes them, so every later judgment can say whether a grade came from
// the document or from the student's hand. Provenance never authenticates a
// document; it only makes the trust level of each claim visible and non-inflatable.
import { normalizeGrade } from './engine.js'

export const DOCUMENT_SOURCES = new Set(['pdf', 'ocr', 'text', 'image'])
export const EDITABLE_FIELDS = ['code', 'name', 'grade']
export const PROVENANCE_LEVELS = ['document', 'edited', 'declared', 'mixed', 'synthetic']

const rank = grade => {
  const g = normalizeGrade(grade)
  if (/^A[+-]?$/.test(g)) return 4
  if (/^B[+-]?$/.test(g)) return 3
  if (/^C[+-]?$/.test(g)) return 2
  if (/^D[+-]?$/.test(g)) return 1
  const numeric = Number(g)
  if (Number.isFinite(numeric) && numeric >= 50 && numeric <= 100) return numeric / 25
  return null
}
const asText = value => typeof value === 'string' ? value : (value && typeof value === 'object' ? (value.en || value.ar || '') : '')

// Apply one field edit while remembering the first value that came from the document.
export function editCourseRow(row, key, value) {
  if (!EDITABLE_FIELDS.includes(key)) return { ...row, [key]: value }
  const edits = { ...(row.edits || {}) }
  const original = Object.hasOwn(edits, key) ? edits[key] : asText(row[key])
  if (String(value).trim() === String(original).trim()) delete edits[key]
  else edits[key] = original
  const originalSource = row.originalSource || row.source || 'manual'
  const edited = Object.keys(edits).length > 0
  const source = row.source === 'demo' || originalSource === 'demo' ? 'demo' : (edited ? 'manual' : originalSource)
  return { ...row, [key]: value, edits, originalSource, source }
}

export function rowProvenance(row) {
  const origin = row?.originalSource || row?.source || 'manual'
  const edits = row?.edits && typeof row.edits === 'object' ? Object.keys(row.edits).filter(k => EDITABLE_FIELDS.includes(k)) : []
  if (row?.source === 'demo' || origin === 'demo') return { level: 'synthetic', origin: 'demo', edits: [], gradeRaised: false }
  if (!DOCUMENT_SOURCES.has(origin)) return { level: 'declared', origin, edits: [], gradeRaised: false }
  const before = edits.includes('grade') ? rank(row.edits.grade) : null
  const after = rank(row.grade)
  const gradeRaised = before !== null && after !== null && after > before
  return { level: edits.length ? 'edited' : 'document', origin, edits, gradeRaised }
}

// Aggregate the rows behind one capability. Mixed means at least one row is document-extracted
// and at least one is edited or declared; the weakest row always stays visible.
export function skillProvenance(skill) {
  const rows = (skill?.evidence || []).map(rowProvenance)
  const count = level => rows.filter(r => r.level === level).length
  const summary = { document: count('document'), edited: count('edited'), declared: count('declared'), synthetic: count('synthetic'), gradeRaised: rows.some(r => r.gradeRaised) }
  if (!rows.length) return { level: 'declared', ...summary }
  if (summary.synthetic === rows.length) return { level: 'synthetic', ...summary }
  if (summary.document === rows.length) return { level: 'document', ...summary }
  if (summary.document === 0 && summary.edited === 0) return { level: 'declared', ...summary }
  if (summary.document === 0) return { level: 'edited', ...summary }
  return { level: 'mixed', ...summary }
}

// Non-blocking signals for the review screen: the student may keep an edit, but it is named.
export function provenanceSignals(rows = []) {
  const signals = []
  rows.forEach((row, index) => {
    const p = rowProvenance(row)
    if (p.gradeRaised) signals.push({ index, code: row.code, kind: 'grade-raised', from: row.edits.grade, to: row.grade })
    else if (p.level === 'edited') signals.push({ index, code: row.code, kind: 'edited', fields: p.edits })
  })
  return signals
}

const labels = {
  document: ['من المستند', 'From the document'],
  edited: ['معدّل بعد الاستخراج', 'Edited after extraction'],
  declared: ['تصريح ذاتي', 'Self-declared'],
  mixed: ['مستند وتصريح ذاتي', 'Document and self-declared'],
  synthetic: ['مثال وهمي', 'Synthetic example'],
}
export const provenanceLabel = (level, lang) => (labels[level] || labels.declared)[lang === 'ar' ? 0 : 1]

const strengths = { document: 'document-derived', edited: 'edited-declared', declared: 'declared', synthetic: 'synthetic', mixed: 'mixed' }
export const provenanceStrength = level => strengths[level] || 'declared'
