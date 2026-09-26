import { opportunities, courseSkillMap, skills as skillCatalog } from '../data.js'

const ARABIC_GRADES = new Map([
  ['أ+','A+'],['أ','A'],['ب+','B+'],['ب','B'],['ج+','C+'],['ج','C'],['د+','D+'],['د','D'],
  ['هـ','F'],['ه','F'],['ح','W'],['م','I'],
])
const NON_EVIDENCE = new Set(['F','W','WF','I','IP','NP','DN'])
const normalizeCode = (code) => String(code || '').trim().toUpperCase().replace(/\s+/g,'-').replace(/--+/g,'-')
export const normalizeGrade = (grade) => {
  const raw=String(grade || '').trim().replace(/\s+/g,'').toUpperCase()
  return ARABIC_GRADES.get(raw) || raw
}
const gradeWeight = (grade) => {
  const g=normalizeGrade(grade)
  if (!g || NON_EVIDENCE.has(g)) return null
  if (g.startsWith('A')) return 1
  if (g.startsWith('B')) return .88
  if (g.startsWith('C')) return .72
  if (g.startsWith('D')) return .58
  const numeric=Number(g)
  if (!Number.isNaN(numeric) && numeric >= 50 && numeric <= 100) return Math.max(.5,Math.min(1,numeric/100))
  return null
}
const strengthLabel=(value)=>value>=.86?'high':value>=.68?'medium':'low'

export function inferSkills(courses) {
  const evidenceBySkill=new Map()
  for (const course of courses || []) {
    const weight=gradeWeight(course.grade)
    if (weight === null) continue
    const mapping=courseSkillMap[normalizeCode(course.code)]
    if (!mapping) continue
    for (const id of mapping.skills) {
      if (!skillCatalog[id] && id !== 'cyber') continue
      const list=evidenceBySkill.get(id)||[]
      list.push({...course,learningOutcome:mapping.learningOutcome,evidenceType:mapping.evidenceType,weight})
      evidenceBySkill.set(id,list)
    }
  }
  return [...evidenceBySkill.entries()].map(([id,evidence])=>{
    const catalog=skillCatalog[id] || {id,labels:{ar:'الأمن السيبراني',en:'Cybersecurity'}}
    const avg=evidence.reduce((sum,e)=>sum+e.weight,0)/evidence.length
    const applied=evidence.some(e=>e.evidenceType==='applied')
    const preliminary=Math.round(Math.min(96,(avg*82)+(applied?8:0)+Math.min(6,(evidence.length-1)*3)))
    return {...catalog,confidence:preliminary,confidenceLabel:strengthLabel(avg),isPreliminary:true,evidence}
  }).sort((a,b)=>b.confidence-a.confidence)
}

const statusRank={yes:0,conditional:1,no:2}
export function judgeOpportunities(skills, goal = null, lang = 'ar') {
  const map=new Map((skills||[]).map(s=>[s.id,s]))
  const t=(ar,en)=>lang==='ar'?ar:en
  return opportunities.map(opp=>{
    const required=(opp.requires||[])
    const teaches=(opp.teaches||[])
    const presentRequired=required.filter(id=>map.has(id))
    const presentTaught=teaches.filter(id=>map.has(id))
    const goalMatch=goal ? opp.goals.includes(goal) : null
    let status='conditional'
    let gapType=t('فجوة قابلة للسد','Bridgeable gap')
    let becomes=t('تسد الفجوة المطلوبة بدليل مناسب.','You bridge the required gap with suitable evidence.')
    const reasons=[]
    if (opp.formalGate) {
      status='no'; gapType=t('ليس الآن','Not yet')
      becomes=opp.formalGate.alternative[lang]
      reasons.push(opp.formalGate.text[lang])
      reasons.push(t('الشرط الرسمي له مصدر وتاريخ مراجعة، ولا يُستبدل بمقرر أكاديمي.','The formal condition has a source and review date and is not replaced by academic coursework.'))
    } else if (goal && !goalMatch) {
      status='no'; gapType=t('تعارض مع رغبتك','Goal mismatch')
      becomes=t('تغيّر هدفك أو تستخدم الدورة كمسار ثانوي واضح.','Your goal changes or you deliberately use the course as a secondary path.')
    } else if (required.some(id=>!map.has(id))) {
      status='no'; gapType=t('فجوة قابلة للسد','Bridgeable gap')
      becomes=t('تضيف دليلًا على المتطلب السابق قبل البدء.','You add evidence for the prerequisite before starting.')
    } else if (teaches.length && presentTaught.length === teaches.length) {
      status='no'; gapType=t('تكرار','Repetition')
      becomes=t('تختار مستوى أعلى بدل إعادة ما لديك عليه دليل بالفعل.','You choose a higher level instead of repeating content you already evidence.')
    } else if (!goal) {
      status='conditional'; gapType=t('استكشاف بلا هدف محدد','Exploration without a chosen goal')
      becomes=t('تختار هدفًا أولًا حتى يصبح الحكم مرتبطًا بما تريد تحقيقه.','You choose a goal first so the judgment is tied to what you want to achieve.')
    } else {
      status='yes'; gapType=t('لا توجد فجوة جوهرية ظاهرة','No material gap is visible')
      becomes=t('تتأكد من شروط المزود وتختار المستوى المناسب.','You verify provider prerequisites and choose the right level.')
    }
    if (presentRequired.length) reasons.push(t(
      `لدينا دليل مباشر على: ${presentRequired.map(id=>map.get(id).labels.ar).join('، ')}.`,
      `We have direct evidence for: ${presentRequired.map(id=>map.get(id).labels.en).join(', ')}.`
    ))
    if (!required.length && !teaches.length) reasons.push(t('هذه الفرصة لا تحتوي متطلبات معرفة مهيكلة بعد.','This opportunity has no structured knowledge requirements yet.'))
    const coverage=required.length?presentRequired.length/required.length:1
    const score=Math.round(Math.max(0,Math.min(100,coverage*70+(goalMatch===true?20:0)+(status==='yes'?10:0))))
    return {...opp,status,gapType,becomes,reasons,score,isPreliminary:true,formalSource:opp.formalGate?.source||null}
  }).sort((a,b)=>statusRank[a.status]-statusRank[b.status] || b.score-a.score)
}
