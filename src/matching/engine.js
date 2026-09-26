import { targetProfiles } from './targets.js'

const pref=(profile,key)=>profile?.preferences?.[key]||null
const hasSkill=(profile,id)=>new Set(profile?.skills||[]).has(id)

const text=(ar,en,lang)=>lang==='ar'?ar:en

export function buildMatchingProfile({skills=[],goal=null,insight=null}={}){
  return {
    skills:(skills||[]).map(skill=>skill.id),
    goal:goal||null,
    preferences:{...(insight?.declaredPreferences||{})},
  }
}

function judgeTarget(profile,target,lang='ar'){
  const support=[]
  const limits=[]
  const hardGates=[]
  const required=target.requiredSkills||[]
  const missing=required.filter(id=>!hasSkill(profile,id))
  const met=required.filter(id=>hasSkill(profile,id))

  if(required.length){
    if(met.length) support.push(text(
      `لديك دليل حالي على ${met.length} من ${required.length} مهارات أساسية مطلوبة.`,
      `You currently have evidence for ${met.length} of ${required.length} core required skills.`,lang))
    if(missing.length) limits.push(text(
      `تحتاج إلى بناء دليل على: ${missing.join('، ')}.`,
      `You still need evidence for: ${missing.join(', ')}.`,lang))
  } else {
    support.push(text('لا توجد مهارة أكاديمية إلزامية في الملف المرجعي لهذا المسار.','This reference pathway has no mandatory academic-skill prerequisite.',lang))
  }

  const goalMatch=profile.goal ? (target.goals||[]).includes(profile.goal) : null
  if(goalMatch===true) support.push(text('المسار متوافق مع الهدف الذي اخترته.','The pathway aligns with your selected goal.',lang))
  else if(goalMatch===false) limits.push(text('المسار ليس ضمن هدفك الحالي؛ يمكن استكشافه لكن لا نعده توصية رئيسية.','This pathway is outside your current goal; it can be explored but is not treated as a primary recommendation.',lang))

  const interest=pref(profile,'careerInterest')
  if(interest && (target.preferredInterests||[]).includes(interest)) support.push(text('اهتمامك المهني المصرح به متوافق مع طبيعة هذا المسار.','Your declared career interest aligns with this pathway.',lang))
  else if(interest && target.preferredInterests?.length) limits.push(text('اهتمامك المصرح به أقل تطابقًا مع هذا المسار؛ هذه إشارة تفضيل وليست مانعًا.','Your declared interest is less aligned with this pathway; this is a preference signal, not a gate.',lang))

  const value=pref(profile,'workValue')
  if(value && (target.preferredValues||[]).includes(value)) support.push(text('قيمة العمل التي اخترتها تجد دعمًا في هذا المسار المرجعي.','Your selected work value is supported by this reference pathway.',lang))

  const structure=pref(profile,'workStructure')
  if(structure && target.preferredWorkStructure?.includes(structure)) support.push(text('درجة الهيكلة التي تفضلها متوافقة مع البيئة المرجعية للمسار.','Your preferred level of structure aligns with the reference environment.',lang))

  const collaboration=pref(profile,'collaboration')
  if(collaboration && target.preferredCollaboration?.includes(collaboration)) support.push(text('نمط التعاون الذي اخترته متوافق مع طبيعة العمل المرجعية.','Your declared collaboration style aligns with the reference environment.',lang))

  let judgment='exploratory'
  if(hardGates.length) judgment='not-yet'
  else if(missing.length) judgment='conditional'
  else if(goalMatch===false) judgment='exploratory'
  else if(required.length===0 || met.length===required.length) judgment='fits'

  return {
    ...target,
    judgment,
    hardGates,
    supportingMechanisms:support,
    limitingMechanisms:limits,
    missingSkills:missing,
    calibrationStatus:'rule-based-uncalibrated',
    ruleVersion:'kamin-fit-v1',
  }
}

const ORDER={fits:0,conditional:1,exploratory:2,'not-yet':3}

export function matchTargets(profile,{type=null,lang='ar'}={}){
  return targetProfiles
    .filter(target=>!type || target.type===type)
    .map(target=>judgeTarget(profile,target,lang))
    .sort((a,b)=>ORDER[a.judgment]-ORDER[b.judgment] || a.id.localeCompare(b.id))
}
