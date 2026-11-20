// Ordinal evidence levels (Task 02). A course grade is a clue to an expected learning outcome,
// never a guarantee of mastery. Every factor below can only cap the level, never raise it, and
// every cap carries a reason the student can read. No weights, no percentages.
import { normalizeGrade } from '../utils/grades.js'

// v2 (Task 54): TR (completed by transfer) and P (passed without a grade) give at most 'limited';
// IC and NF are listed with the other codes that create no evidence.
export const EVIDENCE_LEVELS_VERSION = 'kamin-evidence-levels-v2'
export const LEVELS = ['none', 'limited', 'moderate', 'strong']
const rank = level => LEVELS.indexOf(level)
export const weakest = (...levels) => levels.reduce((a, b) => (rank(b) < rank(a) ? b : a), 'strong')
export const strongest = (...levels) => levels.reduce((a, b) => (rank(b) > rank(a) ? b : a), 'none')
export const compareLevels = (a, b) => rank(a) - rank(b)

// Trust ladder for the source of a row (T0 nothing … T4 verified by a trusted issuer).
export const SOURCE_TIERS = { declared: 'T1', edited: 'T2', document: 'T3', synthetic: 'T3', 'verified-credential': 'T4' }

const NO_EVIDENCE = new Set(['F', 'W', 'WF', 'I', 'IP', 'NP', 'DN', 'IC', 'NF'])
// Task 54 · completed without a grade on this transcript: the course counts, but the grade cannot
// say how well, so the strongest such a row can give is 'limited'. The other caps still apply.
const NO_GRADE_PASS = { TR: 'grade-transfer', P: 'grade-pass' }
// Grade → the highest level that grade alone allows.
export function gradeCap(grade) {
  const g = normalizeGrade(grade)
  if (!g || NO_EVIDENCE.has(g)) return 'none'
  if (NO_GRADE_PASS[g]) return 'limited'
  if (/^[AB][+-]?$/.test(g)) return 'strong'
  if (/^C[+-]?$/.test(g)) return 'moderate'
  if (/^D[+-]?$/.test(g)) return 'limited'
  const numeric = Number(g)
  if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 100) {
    if (numeric >= 80) return 'strong'
    if (numeric >= 70) return 'moderate'
    if (numeric >= 60) return 'limited'
  }
  return 'none'
}

const ASSESSMENT_CAP = { project: 'strong', lab: 'strong', mixed: 'moderate', exam: 'moderate', unknown: 'limited' }
const SOURCE_CAP = { document: 'strong', synthetic: 'strong', edited: 'strong', declared: 'none', 'verified-credential': 'strong' }
const MAPPING_CAP = { approved: 'strong', reviewed: 'strong', proposed: 'limited', missing: 'none' }

const R = {
  'grade-high': g => ({ ar: `الدرجة ${g}`, en: `grade ${g}` }),
  'grade-medium': g => ({ ar: `الدرجة ${g}`, en: `grade ${g}` }),
  'grade-low': g => ({ ar: `الدرجة ${g} منخفضة`, en: `low grade ${g}` }),
  'grade-transfer': () => ({ ar: 'أُكمل بالمعادلة: الدرجة ليست في هذا السجل', en: 'completed by transfer: the grade is not on this transcript' }),
  'grade-pass': () => ({ ar: 'ناجح دون درجة', en: 'passed without a grade' }),
  'grade-none': g => ({ ar: `الدرجة ${g || '—'} لا تُنشئ دليلًا (رسوب أو انسحاب أو غير مكتمل)`, en: `grade ${g || '—'} creates no evidence (fail, withdrawal or incomplete)` }),
  'grade-original': (g, original) => ({ ar: `الدرجة الأصلية ${original} من المستند؛ تعديلك إلى ${g} لا يُحتسب`, en: `original grade ${original} from the document; your edit to ${g} is not counted` }),
  'grade-lowered': (g, original) => ({ ar: `خفّضت الدرجة من ${original} إلى ${g}؛ تُستخدم الدرجة الأدنى`, en: `you lowered the grade from ${original} to ${g}; the lower grade is used` }),
  'assessment-project': () => ({ ar: 'في مقرر قائم على مشروع', en: 'in a project-based course' }),
  'assessment-lab': () => ({ ar: 'في مقرر قائم على المختبر', en: 'in a lab-based course' }),
  'assessment-mixed': () => ({ ar: 'في مقرر يجمع الاختبار والتطبيق', en: 'in a course mixing exams and practice' }),
  'assessment-exam': () => ({ ar: 'في مقرر يُقيَّم بالاختبارات', en: 'in an exam-based course' }),
  'assessment-unknown': () => ({ ar: 'نوع التقييم غير معروف بعد', en: 'assessment type not known yet' }),
  'source-document': () => ({ ar: 'من مستند غير معدّل', en: 'from an unedited document' }),
  'source-edited': () => ({ ar: 'عُدّل بعد الاستخراج', en: 'edited after extraction' }),
  'source-code-edited': () => ({ ar: 'رمز المقرر عُدّل بعد الاستخراج', en: 'course code edited after extraction' }),
  'source-declared': () => ({ ar: 'مُدخل يدويًا — بانتظار مستند أو مراجعة', en: 'typed by hand — waiting for a document or review' }),
  'source-synthetic': () => ({ ar: 'مثال وهمي', en: 'synthetic example' }),
  'source-verified-credential': () => ({ ar: 'اعتماد موثّق من جهة إصدار معتمدة', en: 'credential verified by a trusted issuer' }),
  'mapping-approved': () => ({ ar: 'ربط المقرر معتمد من القسم', en: 'course mapping approved by the department' }),
  'mapping-proposed': () => ({ ar: 'ربط المقرر مقترح ولم يعتمده القسم بعد', en: 'course mapping still proposed, not yet department-approved' }),
  'mapping-missing': () => ({ ar: 'المقرر غير مربوط بقدرة', en: 'course is not mapped to a capability' }),
}
const reason = (code, factor, cap, ...args) => ({ code, factor, cap, ...R[code](...args) })

/**
 * @param {object} input
 * @param {string} [input.grade]           grade on the row now
 * @param {string} [input.originalGrade]   grade extracted from the document, if the student changed it
 * @param {string[]} [input.editedFields]  fields changed after extraction
 * @param {'exam'|'project'|'lab'|'mixed'|'unknown'} [input.assessment]
 * @param {'document'|'edited'|'declared'|'synthetic'|'verified-credential'} input.provenance
 * @param {'approved'|'reviewed'|'proposed'|'missing'} [input.mappingStatus]
 * @returns {{level:string, basis:'academic'|'practical', reasons:object[], factors:object, version:string}}
 */
export function evidenceLevel({ grade, originalGrade, editedFields = [], assessment = 'unknown', provenance = 'declared', mappingStatus = 'missing' } = {}) {
  // T4: a credential verified against a trusted issuer is practical evidence on its own terms.
  if (provenance === 'verified-credential') {
    const reasons = [reason('source-verified-credential', 'source', 'strong')]
    return { level: 'strong', basis: 'practical', reasons, factors: { source: 'strong', tier: 'T4' }, version: EVIDENCE_LEVELS_VERSION }
  }
  const reasons = []
  // Grade: an edited row is never judged by a raised value. The document's grade is used unless
  // the student lowered it (e.g. correcting an OCR misread), so an edit can only lower the level.
  const changed = provenance === 'edited' && originalGrade != null && String(originalGrade).trim() !== '' && normalizeGrade(originalGrade) !== normalizeGrade(grade)
  const usesOriginal = changed && compareLevels(gradeCap(originalGrade), gradeCap(grade)) <= 0
  const gradeUsed = usesOriginal ? originalGrade : grade
  const g = gradeCap(gradeUsed)
  const shown = normalizeGrade(gradeUsed)
  reasons.push(reason(NO_GRADE_PASS[shown] || (g === 'none' ? 'grade-none' : g === 'strong' ? 'grade-high' : g === 'moderate' ? 'grade-medium' : 'grade-low'), 'grade', g, shown))
  if (usesOriginal) reasons.push(reason('grade-original', 'grade', g, normalizeGrade(grade), normalizeGrade(originalGrade)))
  else if (changed) reasons.push(reason('grade-lowered', 'grade', g, normalizeGrade(grade), normalizeGrade(originalGrade)))

  const a = ASSESSMENT_CAP[assessment] ? assessment : 'unknown'
  reasons.push(reason(`assessment-${a}`, 'assessment', ASSESSMENT_CAP[a]))

  const p = SOURCE_CAP[provenance] ? provenance : 'declared'
  let sourceCap = SOURCE_CAP[p]
  reasons.push(reason(`source-${p}`, 'source', sourceCap))
  // A changed course code could re-point the row at another course's mapping.
  if (p === 'edited' && editedFields.includes('code')) {
    sourceCap = weakest(sourceCap, 'limited')
    reasons.push(reason('source-code-edited', 'source', 'limited'))
  }

  const m = MAPPING_CAP[mappingStatus] ? mappingStatus : 'missing'
  reasons.push(reason(`mapping-${m === 'reviewed' ? 'approved' : m}`, 'mapping', MAPPING_CAP[m]))

  const factors = { grade: g, assessment: ASSESSMENT_CAP[a], source: sourceCap, mapping: MAPPING_CAP[m], tier: SOURCE_TIERS[p], gradeUsed: shown }
  // Weakest link wins: a high grade never compensates for a weak source, assessment or mapping.
  const level = weakest(factors.grade, factors.assessment, factors.source, factors.mapping)
  for (const r of reasons) r.limiting = level !== 'strong' && r.cap === level
  return { level, basis: 'academic', reasons, factors, version: EVIDENCE_LEVELS_VERSION }
}

// Task 29: the reasons that set the level, i.e. those whose cap equals the final level. It only
// reads reasons evidenceLevel() already produced; the rules above are unchanged. Works for a
// capability from inferSkills() ({ evidenceLevel, reasons }) and for one result ({ level, reasons }).
// A strong level has no limiting reason.
export function limitingReasons(skill) {
  const level = skill?.evidenceLevel ?? skill?.level
  if (!LEVELS.includes(level) || level === 'strong') return []
  return (skill.reasons || []).filter(r => r.cap === level)
}

const LEVEL_LABEL = {
  strong: { ar: 'قرينة قوية', en: 'Strong clue' },
  moderate: { ar: 'قرينة متوسطة', en: 'Moderate clue' },
  limited: { ar: 'قرينة محدودة', en: 'Limited clue' },
  none: { ar: 'لا يوجد دليل كافٍ', en: 'Not enough evidence' },
}
export const levelLabel = (level, lang) => (LEVEL_LABEL[level] || LEVEL_LABEL.none)[lang === 'ar' ? 'ar' : 'en']
export const basisLabel = (basis, lang) => (basis === 'practical'
  ? (lang === 'ar' ? 'مثبت عمليًا' : 'Demonstrated in practice')
  : (lang === 'ar' ? 'مدعوم أكاديميًا' : 'Academically supported'))

// "Moderate clue: grade B, in an exam-based course, from an unedited document."
export function evidenceSentence(result, lang = 'ar') {
  const parts = result.reasons.map(r => r[lang === 'ar' ? 'ar' : 'en'])
  return `${levelLabel(result.level, lang)}: ${parts.join(lang === 'ar' ? '، ' : ', ')}.`
}
