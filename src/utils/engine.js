import { GOALS, SKILL_CATALOG, opportunities } from '../data.js'
import { COURSE_MAP_VERSION, getCourseMapping, normalizeCourseCode } from '../data/courseMap.js'

export const RULE_VERSION = 'kamin-rules-2026-09-26.1'

const ARABIC_GRADE_MAP = {
  'أ+': 'A+', 'ا+': 'A+', 'أ': 'A', 'ا': 'A',
  'ب+': 'B+', 'ب': 'B', 'ج+': 'C+', 'ج': 'C',
  'د+': 'D+', 'د': 'D', 'هـ': 'F', 'ه': 'F',
  'ح': 'W', 'م': 'I',
}

const NON_EVIDENCE_GRADES = new Set(['F', 'W', 'WF', 'I', 'IP', 'NP', 'DN'])

export function normalizeGrade(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (ARABIC_GRADE_MAP[raw]) return ARABIC_GRADE_MAP[raw]
  const upper = raw.toUpperCase().replace(/\s+/g, '')
  if (NON_EVIDENCE_GRADES.has(upper)) return upper
  if (/^[A-D][+-]?$/.test(upper)) return upper
  if (/^\d{1,3}(?:\.\d+)?$/.test(upper)) {
    const n = Number(upper)
    if (n < 0 || n > 100) return null
    if (n >= 90) return 'A'
    if (n >= 80) return 'B'
    if (n >= 70) return 'C'
    if (n >= 60) return 'D'
    return 'F'
  }
  return null
}

export function gradeStrength(value) {
  const grade = normalizeGrade(value)
  if (!grade || NON_EVIDENCE_GRADES.has(grade)) return null
  if (grade.startsWith('A')) return 1
  if (grade.startsWith('B')) return 0.88
  if (grade.startsWith('C')) return 0.72
  if (grade.startsWith('D')) return 0.58
  return null
}

export function evidenceReliability(source = 'manual') {
  if (source === 'university') return { id: 'verified', ar: 'موثّق من الجهة', en: 'Verified by issuer', weight: 1 }
  if (['pdf', 'image', 'text'].includes(source)) return { id: 'uploaded', ar: 'مستند مرفوع', en: 'Uploaded document', weight: 0.85 }
  if (source === 'demo') return { id: 'illustrative', ar: 'مثال توضيحي', en: 'Illustrative demo', weight: 0.75 }
  return { id: 'declared', ar: 'مُصرّح به', en: 'Self-declared', weight: 0.65 }
}

function evidenceIndex(evidence) {
  if (!evidence.length) return 0
  const weighted = evidence.map((e) => e.gradeStrength * e.reliability.weight)
  const average = weighted.reduce((sum, n) => sum + n, 0) / weighted.length
  const corroboration = Math.min(0.08, Math.max(0, evidence.length - 1) * 0.04)
  return Math.round(Math.min(0.96, average + corroboration) * 100)
}

export function inferSkills(courses, { deniedSkillIds = [] } = {}) {
  const denied = new Set(deniedSkillIds)
  const buckets = new Map()

  for (const course of courses || []) {
    const grade = normalizeGrade(course.grade)
    const strength = gradeStrength(course.grade)
    if (!grade || strength == null) continue

    const mapping = getCourseMapping(course)
    if (!mapping) continue

    const reliability = evidenceReliability(course.source)
    for (const skillId of mapping.skills) {
      if (denied.has(skillId) || !SKILL_CATALOG[skillId]) continue
      const evidence = {
        code: normalizeCourseCode(course.code),
        name: course.name,
        grade,
        source: course.source || 'manual',
        reliability,
        courseType: mapping.courseType,
        learningOutcome: mapping.learningOutcome,
        mappingVersion: COURSE_MAP_VERSION,
      }
      const list = buckets.get(skillId) || []
      list.push(evidence)
      buckets.set(skillId, list)
    }
  }

  return [...buckets.entries()].map(([id, evidence]) => ({
    ...SKILL_CATALOG[id],
    confidence: evidenceIndex(evidence),
    calibrated: false,
    confidenceLabel: { ar: 'مؤشر دليل مبدئي', en: 'Provisional evidence indicator' },
    evidence,
    appliedEvidence: evidence.filter((e) => e.courseType === 'applied'),
    knowledgeEvidence: evidence.filter((e) => e.courseType !== 'applied'),
    ruleVersion: RULE_VERSION,
  })).sort((a, b) => b.confidence - a.confidence)
}

export function mappingCoverage(courses = []) {
  const usable = []
  const failed = []
  const unmapped = []
  const unknownGrade = []

  for (const course of courses) {
    const grade = normalizeGrade(course.grade)
    if (!grade) {
      unknownGrade.push(course)
      continue
    }
    if (NON_EVIDENCE_GRADES.has(grade)) {
      failed.push(course)
      continue
    }
    if (!getCourseMapping(course)) {
      unmapped.push(course)
      continue
    }
    usable.push(course)
  }
  return { usable, failed, unmapped, unknownGrade }
}

const t = (lang, ar, en) => lang === 'ar' ? ar : en

function evaluateOpportunity(opp, skills, goal, lang) {
  const skillMap = new Map(skills.map((s) => [s.id, s]))
  const evidence = (opp.requires || []).map((id) => skillMap.get(id)).filter(Boolean)
  const missing = (opp.requires || []).filter((id) => !skillMap.has(id))
  const taughtKnown = (opp.teaches || []).filter((id) => skillMap.has(id))
  const goalMatch = !!goal && opp.goals.includes(goal)
  const reasons = []
  const chain = []

  if (evidence.length) {
    reasons.push(t(
      lang,
      `لدينا دليل على: ${evidence.map((s) => s.labels.ar).join('، ')}.`,
      `Evidence supports: ${evidence.map((s) => s.labels.en).join(', ')}.`,
    ))
    chain.push(...evidence.flatMap((s) => s.evidence.map((e) => `${e.code}→${s.id}`)))
  }

  if (!goal) {
    return {
      status: 'explore',
      gapType: t(lang, 'لم يُختر هدف بعد', 'No goal selected yet'),
      becomes: t(lang, 'اختر هدفًا أو استخدم الاستكشاف قبل إصدار حكم ملاءمة.', 'Choose a goal or explore paths before a fit judgment is issued.'),
      reasons: [t(lang, 'لا يصدر كامن حكمًا مبنيًا على هدف لم تختره.', 'Kamin does not issue a goal-based judgment before you choose a goal.')],
      score: null,
      scoreLabel: null,
      evidence,
      chain,
    }
  }

  if (opp.formalGate) {
    reasons.unshift(t(lang, opp.formalGate.ar, opp.formalGate.en))
    return {
      status: 'no',
      gapType: t(lang, 'ليس الآن', 'Not yet'),
      noType: 'not-now',
      becomes: t(lang, opp.formalGate.alternative.ar, opp.formalGate.alternative.en),
      reasons,
      score: 30,
      scoreLabel: t(lang, 'مؤشر مبدئي — غير معاير', 'Provisional indicator — not calibrated'),
      evidence,
      chain: [opp.formalGate.id, ...chain],
      formalGate: opp.formalGate,
    }
  }

  if (!goalMatch) {
    return {
      status: 'no',
      gapType: t(lang, 'تعارض مع رغبتك', 'Preference mismatch'),
      noType: 'preference-conflict',
      becomes: t(lang, 'تختار هذا المسار صراحة كهدف أو مسار ثانوي.', 'You explicitly choose this as a goal or secondary path.'),
      reasons: [t(lang, 'هذه الفرصة خارج الهدف الذي اخترته الآن.', 'This opportunity is outside the goal you selected.'), ...reasons],
      score: 35,
      scoreLabel: t(lang, 'مؤشر مبدئي — غير معاير', 'Provisional indicator — not calibrated'),
      evidence,
      chain,
    }
  }

  if (missing.length) {
    const labels = missing.map((id) => SKILL_CATALOG[id]?.labels?.[lang] || id)
    return {
      status: 'no',
      gapType: t(lang, 'فجوة قابلة للسد', 'Bridgeable gap'),
      noType: 'bridgeable-gap',
      becomes: t(
        lang,
        `تضيف دليلًا على: ${labels.join('، ')}.`,
        `You add evidence for: ${labels.join(', ')}.`,
      ),
      reasons: [t(
        lang,
        `لا نرى بعد دليلًا معتمد الربط على: ${labels.join('، ')}.`,
        `We do not yet see approved-mapping evidence for: ${labels.join(', ')}.`,
      ), ...reasons],
      score: Math.max(20, Math.round((evidence.length / Math.max(1, opp.requires.length)) * 70)),
      scoreLabel: t(lang, 'مؤشر مبدئي — غير معاير', 'Provisional indicator — not calibrated'),
      evidence,
      chain,
    }
  }

  if ((opp.teaches || []).length && taughtKnown.length === opp.teaches.length) {
    return {
      status: 'no',
      gapType: t(lang, 'تكرار', 'Duplication'),
      noType: 'duplication',
      becomes: t(lang, 'تختار مستوى أعلى أو دورة تضيف مهارة جديدة.', 'You choose a more advanced level or a course that adds a new skill.'),
      reasons: [t(
        lang,
        `الدورة تعلّم أساسًا ما يظهر عندك عليه دليل بالفعل: ${taughtKnown.map((id) => SKILL_CATALOG[id]?.labels?.[lang] || id).join('، ')}.`,
        `The course mainly teaches skills already supported by your evidence: ${taughtKnown.map((id) => SKILL_CATALOG[id]?.labels?.[lang] || id).join(', ')}.`,
      ), ...reasons],
      score: 45,
      scoreLabel: t(lang, 'مؤشر مبدئي — غير معاير', 'Provisional indicator — not calibrated'),
      evidence,
      chain,
    }
  }

  const evidenceQuality = evidence.length
    ? Math.round(evidence.reduce((sum, s) => sum + s.confidence, 0) / evidence.length)
    : 70

  return {
    status: evidence.length ? 'yes' : 'conditional',
    gapType: evidence.length
      ? t(lang, 'لا توجد فجوة جوهرية ظاهرة', 'No material gap is visible')
      : t(lang, 'ابدأ كتجربة تعلم', 'Use as a learning path'),
    becomes: evidence.length
      ? t(lang, 'تراجع مستوى الدورة وبيان النتيجة قبل التسجيل.', 'Review the level and outcome statement before enrolling.')
      : t(lang, 'تراجع المتطلبات وبيان النتيجة ثم تقرر.', 'Review the requirements and outcome statement, then decide.'),
    reasons: reasons.length ? reasons : [t(lang, 'لا توجد متطلبات سابقة في هذا المثال.', 'This example has no prerequisite skills.')],
    score: Math.min(90, Math.max(55, evidenceQuality)),
    scoreLabel: t(lang, 'مؤشر مبدئي — غير معاير', 'Provisional indicator — not calibrated'),
    evidence,
    chain,
  }
}

export function judgeOpportunities(skills, goal = null, lang = 'ar') {
  // Commercial fields are deliberately not read by evaluateOpportunity.
  // This boundary is protected by a regression test (AC-16 / FR-29).
  return opportunities.map((opp) => ({
    ...opp,
    ...evaluateOpportunity(opp, skills, goal, lang),
    ruleVersion: RULE_VERSION,
  }))
}

export function goalEvidence(skills, goal, lang = 'ar') {
  if (!goal || !GOALS[goal]) return { goal: null, evidence: [], missing: [] }
  const ids = GOALS[goal].relatedSkills || []
  const map = new Map(skills.map((s) => [s.id, s]))
  return {
    goal,
    evidence: ids.map((id) => map.get(id)).filter(Boolean),
    missing: ids.filter((id) => !map.has(id)).map((id) => SKILL_CATALOG[id]?.labels?.[lang] || id),
  }
}
