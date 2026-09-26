import { opportunities, skillRules } from '../data.js'

const gradeWeight = (grade) => {
  const g = String(grade || '').trim().toUpperCase()
  if (g.startsWith('A')) return 1
  if (g.startsWith('B')) return 0.88
  if (g.startsWith('C')) return 0.72
  if (g.startsWith('D')) return 0.58
  const numeric = Number(g)
  if (!Number.isNaN(numeric)) return Math.max(0.5, Math.min(1, numeric / 100))
  return 0.68
}

export function inferSkills(courses) {
  return skillRules.flatMap((rule) => {
    const matched = courses.filter((course) => {
      const text = `${course.code} ${typeof course.name === 'string' ? course.name : `${course.name?.ar || ''} ${course.name?.en || ''}`}`.toLowerCase()
      return rule.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
    })
    if (!matched.length) return []
    const avg = matched.reduce((sum, c) => sum + gradeWeight(c.grade), 0) / matched.length
    const confidence = Math.round(Math.min(96, rule.base * avg + Math.min(10, (matched.length - 1) * 5)))
    return [{ ...rule, confidence, evidence: matched }]
  }).sort((a, b) => b.confidence - a.confidence)
}

export function judgeOpportunities(skills, goal = 'management', lang = 'ar') {
  const skillMap = new Map(skills.map((s) => [s.id, s]))
  const t = (ar, en) => lang === 'ar' ? ar : en
  return opportunities.map((opp) => {
    const evidence = opp.requires.map((id) => skillMap.get(id)).filter(Boolean)
    const bonus = (opp.bonus || []).map((id) => skillMap.get(id)).filter(Boolean)
    const goalMatch = opp.goals.includes(goal)
    let score = 40 + (goalMatch ? 22 : 0) + evidence.length * 24 + bonus.length * 7
    score = Math.min(96, score)
    let status = 'conditional'
    let gapType = t('فجوة قابلة للسد', 'Bridgeable gap')
    let becomes = t('تعزّز المهارة المطلوبة بدليل أكاديمي أو دورة تأسيسية.', 'You strengthen the required skill with academic evidence or a foundation course.')
    let reasons = []

    if (opp.formalGate) {
      status = 'no'
      score = Math.min(score, 48)
      gapType = t('ليس الآن', 'Not yet')
      becomes = t('تستوفي شرط الخبرة المهنية الرسمي المنشور من الجهة المانحة.', 'You meet the official professional-experience requirement published by the credential owner.')
      reasons.push(t('هذه الشهادة لها شرط خبرة رسمي؛ كامن لا يعتبر المقرر الأكاديمي بديلًا عنه.', 'This credential has a formal experience gate; academic coursework is not treated as a substitute.'))
    } else if (evidence.length === opp.requires.length && goalMatch) {
      status = score >= 80 ? 'yes' : 'conditional'
      gapType = status === 'yes' ? t('لا توجد فجوة جوهرية', 'No material gap') : gapType
      becomes = status === 'yes' ? t('تحافظ على هذا المسار وتختار المستوى الملائم.', 'You stay on this path and select the appropriate level.') : becomes
    } else if (!goalMatch) {
      status = 'conditional'
      score = Math.min(score, 66)
      gapType = t('تعارض جزئي مع الهدف', 'Partial goal mismatch')
      becomes = t('يتغير هدفك أو تستخدم الدورة كمسار ثانوي واضح.', 'Your goal changes or you use the course as an explicit secondary path.')
    }

    if (evidence.length) reasons.push(t(`لدينا دليل مباشر على ${evidence.map((s) => s.labels.ar).join('، ')}.`, `We have direct evidence for ${evidence.map((s) => s.labels.en).join(', ')}.`))
    if (bonus.length) reasons.push(t(`نقاط داعمة: ${bonus.map((s) => s.labels.ar).join('، ')}.`, `Supporting strengths: ${bonus.map((s) => s.labels.en).join(', ')}.`))
    if (!evidence.length && !opp.formalGate) reasons.push(t('لا نرى بعد دليلًا كافيًا على المهارة الأساسية المطلوبة.', 'We do not yet see sufficient evidence for the core required skill.'))

    return { ...opp, score, status, reasons, gapType, becomes, evidence }
  }).sort((a, b) => b.score - a.score)
}
