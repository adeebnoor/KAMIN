// Task 29 · "Why is this level limited?" in plain words, and what the levels mean.
// Only shows reasons that src/evidence/levels.js already produces (limitingReasons); it never
// changes a level. Kept apart from i18n.js because the methodology page (scripts/) uses the same
// level meanings, as it does with COURSE_EVIDENCE_PRINCIPLE.
import { limitingReasons } from '../evidence/levels.js'

// One sentence per level, describing the rules in levels.js (weakest factor wins).
export const LEVEL_MEANINGS = Object.freeze({
  ar: Object.freeze({
    title: 'ماذا تعني المستويات؟',
    none: 'لا يوجد دليل كافٍ: لا يدعم هذه القدرة شيء في سجلك بعد، أو المقرر راسب أو منسحب منه أو مُدخل يدويًا.',
    limited: 'قرينة محدودة: يدعمها مقرر، لكن شيئًا واحدًا على الأقل يحدّها: ربط المقرر لم يعتمده القسم بعد، أو نوع التقييم غير معروف، أو درجة D، أو مقرر مُعادَل أو ناجح دون درجة، أو رمز مقرر غيّرته. السطر تحت القدرة يذكر أيّها.',
    moderate: 'قرينة متوسطة: يدعمها مقرر، لكن درجة C أو تقييم بالاختبارات وحدها يبقيها دون القوية.',
    strong: 'قرينة قوية: ربط معتمد من القسم، ودرجة B أو أعلى، وتقييم بمشروع أو مختبر، من مستند غير معدّل.',
    rule: 'أضعف هذه العوامل يحدد المستوى؛ الدرجة العالية لا تعوّض غيرها.',
  }),
  en: Object.freeze({
    title: 'What do the levels mean?',
    none: 'Not enough evidence: nothing in your record supports this capability yet, or the course was failed, withdrawn or typed by hand.',
    limited: 'Limited clue: a course supports it, but at least one thing caps it: the department has not approved the course link yet, the assessment type is not known, a D grade, a course completed by transfer or passed without a grade, or a course code you changed. The line under the capability says which.',
    moderate: 'Moderate clue: a course supports it, but a C grade or an exam-based assessment keeps it below strong.',
    strong: 'Strong clue: a department-approved course link, a grade of B or above, and project or lab assessment, from an unedited document.',
    rule: 'The weakest of these factors sets the level; a high grade does not make up for the others.',
  }),
})

// Reasons that complete "Limited because …". `one`: a row (this course); `all`: the shared line
// (these courses). Arabic carries its own connector (لأن / لأننا / لأنك) in the row form.
const BECAUSE = {
  'mapping-proposed': {
    en: { one: 'the department has not approved this course link yet', all: 'the department has not approved these course links yet' },
    ar: { one: 'لأن القسم لم يعتمد ربط هذا المقرر بعد', all: 'القسم لم يعتمد ربط هذه المقررات بعد' },
  },
  'assessment-unknown': {
    en: { one: 'we don’t know yet how this course is assessed', all: 'we don’t know yet how these courses are assessed' },
    ar: { one: 'لأننا لا نعرف بعد كيف يُقيَّم هذا المقرر', all: 'لا نعرف بعد كيف تُقيَّم هذه المقررات' },
  },
  'assessment-exam': {
    en: { one: 'this course is assessed by exams', all: 'these courses are assessed by exams' },
    ar: { one: 'لأن هذا المقرر يُقيَّم بالاختبارات', all: 'هذه المقررات تُقيَّم بالاختبارات' },
  },
  'assessment-mixed': {
    en: { one: 'this course mixes exams and practice', all: 'these courses mix exams and practice' },
    ar: { one: 'لأن هذا المقرر يجمع الاختبار والتطبيق', all: 'هذه المقررات تجمع الاختبار والتطبيق' },
  },
  'source-code-edited': {
    en: { one: 'you changed the course code after it was read from your document', all: 'you changed course codes after they were read from your document' },
    ar: { one: 'لأنك غيّرت رمز المقرر بعد قراءته من مستندك', all: 'غيّرت رموز المقررات بعد قراءتها من مستندك' },
    action: 'review',
  },
}

// Reasons that are a sentence of their own.
const ALONE = {
  'grade-low': { en: (g, code) => `Limited by the grade ${g} in ${code}.`, ar: (g, code) => `قرينة محدودة بسبب الدرجة ${g} في ${code}.` },
  'grade-medium': { en: (g, code) => `Moderate because of the grade ${g} in ${code}.`, ar: (g, code) => `قرينة متوسطة بسبب الدرجة ${g} في ${code}.` },
  'grade-original': { en: () => 'Your edit is not counted; the document’s grade is used.', ar: () => 'تعديلك لا يُحتسب؛ تُستخدم درجة المستند.', action: 'review' },
  'grade-lowered': { en: () => 'You lowered the grade; the lower grade is used.', ar: () => 'خفّضت الدرجة؛ تُستخدم الدرجة الأدنى.', action: 'review' },
  // Task 54 · TR and P: the course counts, at most as a limited clue, because no grade is shown.
  'grade-transfer': { en: (g, code) => `Limited because ${code} was completed by transfer: the grade is not on this transcript.`, ar: (g, code) => `قرينة محدودة لأن ${code} أُكمل بالمعادلة: الدرجة ليست في هذا السجل.` },
  'grade-pass': { en: (g, code) => `Limited because ${code} was passed without a grade.`, ar: (g, code) => `قرينة محدودة لأن ${code} اجتيز دون درجة.` },
  'source-declared': { en: () => 'Waiting for a document: you typed this course in.', ar: () => 'بانتظار مستند: أدخلت هذا المقرر يدويًا.', action: 'upload' },
}

const PREFIX = { en: { limited: 'Limited', moderate: 'Moderate' }, ar: { limited: 'قرينة محدودة', moderate: 'قرينة متوسطة' } }
const WORD = { en: { limited: 'limited', moderate: 'moderate' }, ar: { limited: 'محدودة', moderate: 'متوسطة' } }
const isGrade = code => code.startsWith('grade-')

// Actions the student can take; null when nobody but the department or the KAMIN team can change it.
export const ACTION_LABELS = Object.freeze({
  ar: Object.freeze({ upload: 'ارفع سجلك', review: 'راجع بياناتي' }),
  en: Object.freeze({ upload: 'Upload your record', review: 'Review my data' }),
})

const L = lang => (lang === 'ar' ? 'ar' : 'en')
const unique = list => [...new Set(list)]

/**
 * The "because" line for one capability (or one hand-typed row): text naming only the limiting
 * factor(s), and the one action the student can take, if any.
 * @param {{evidenceLevel?:string, level?:string, reasons:object[]}} skill
 * @param {string} lang
 * @param {{code?:string}} [context] the course the reasons come from (for grade sentences)
 * @returns {{codes:string[], text:string, action:'upload'|'review'|null}|null}
 */
export function limitLine(skill, lang, { code = '' } = {}) {
  const l = L(lang)
  const level = skill?.evidenceLevel ?? skill?.level
  const reasons = limitingReasons(skill)
  const codes = unique(reasons.map(r => r.code)).filter(c => BECAUSE[c] || ALONE[c])
  if (!codes.length) return null
  const parts = []
  const because = Object.keys(BECAUSE).filter(c => codes.includes(c))
  if (because.length && PREFIX[l][level]) {
    const clauses = because.map(c => BECAUSE[c][l].one)
    const notGrade = !codes.some(isGrade)
    if (l === 'ar') parts.push(`${PREFIX.ar[level]} ${clauses.join('، و')}${notGrade ? '، وليس بسبب درجتك' : ''}.`)
    else parts.push(`${PREFIX.en[level]} because ${clauses.join(', and ')}${notGrade ? ', not because of your grade' : ''}.`)
  }
  for (const c of codes.filter(c => ALONE[c])) {
    const r = reasons.find(x => x.code === c)
    // The grade as levels.js wrote it in its English reason ("low grade D", "grade C+", "grade 65").
    parts.push(ALONE[c][l](r?.en?.match(/\b(?:[A-F][+-]?|\d+(?:\.\d+)?)(?=\s|$|;)/)?.[0] ?? '', code))
  }
  const action = codes.map(c => (BECAUSE[c] || ALONE[c]).action).find(Boolean) || null
  return { codes, text: parts.join(' '), action }
}

/**
 * When every capability is limited by the same reason(s) and none of them depends on a single
 * course (no grade), say it once above the list instead of on every row.
 * @returns {{codes:string[], text:string, action:'review'|null}|null}
 */
export function sharedLimitLine(skills, lang) {
  const l = L(lang)
  if (!skills || skills.length < 2) return null
  const level = skills[0].evidenceLevel
  if (!WORD[l][level] || skills.some(s => s.evidenceLevel !== level)) return null
  const key = s => unique(limitingReasons(s).map(r => r.code)).sort().join(' ')
  const first = key(skills[0])
  if (!first || skills.some(s => key(s) !== first)) return null
  const codes = first.split(' ')
  if (!codes.every(c => BECAUSE[c])) return null
  const order = Object.keys(BECAUSE).filter(c => codes.includes(c))
  const clauses = order.map(c => BECAUSE[c][l].all)
  const many = clauses.length > 1
  const text = l === 'ar'
    ? `كلها ${WORD.ar[level]} ${many ? 'للأسباب نفسها' : 'للسبب نفسه'}، وليس بسبب درجاتك: ${clauses.join('، و')}.`
    : `All ${WORD.en[level]} for the same ${many ? 'reasons' : 'reason'}, not your grades: ${clauses.join(', and ')}.`
  return { codes: order, text, action: order.map(c => BECAUSE[c].action).find(Boolean) || null }
}
