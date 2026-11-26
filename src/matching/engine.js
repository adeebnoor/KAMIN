import { targetProfiles } from './targets.js'
import { skills as skillCatalog } from '../data.js'
import {
  GRAPH_MATCHING_VERSION,
  buildTargetSemanticGraph,
  describeCapabilityPath,
  indexPersonGraph,
  strongestCapabilityPath,
} from './graph.js'
import { deriveKnowledgeInsights } from '../knowledge/query.js'
import { inferRelations, sweepOrphanInferences } from './inference.js'
import { normalizeDeclaredPreferences, preferenceValues } from '../insight.js'

const text=(ar,en,lang)=>lang==='ar'?ar:en
const pref=(profile,key)=>profile?.preferences?.[key]||null
// Task 78: every chosen value of a scheme (interest areas and work values take up to 3), in the order chosen.
const prefs=(profile,key)=>profile?.preferenceChoices?.[key]||(pref(profile,key)?[pref(profile,key)]:[])
const hasSkill=(profile,id)=>new Set(profile?.skills||[]).has(id)

const preferenceObject=index=>Object.fromEntries(
  [...(index?.preferences||new Map()).entries()].map(([scheme,value])=>[scheme,value.key])
)
const choiceObject=index=>Object.fromEntries(
  [...(index?.preferenceChoices||new Map()).entries()].map(([scheme,list])=>[scheme,list.map(value=>value.key)])
)
// The flat profile's preferences: `preferences` keeps one value per scheme (the first chosen), as before.
const firstValues=declared=>Object.fromEntries(Object.entries(declared).map(([scheme,value])=>[scheme,Array.isArray(value)?value[0]:value]))
const allValues=declared=>Object.fromEntries(Object.keys(declared).map(scheme=>[scheme,preferenceValues(declared,scheme)]))

// Task 65 · a goal is one of the four directions of the old interface ('data', 'cyber', …) or, from the new
// interface's step 4 (Task 58's goals), a pathway id. A pathway aligns with a goal when it supports that
// direction, or when it is the pathway chosen. Every chosen goal counts (at most 3); the first is the main one.
const goalList=(main,goals)=>[...new Set([main,...(Array.isArray(goals)?goals:[])].filter(g=>typeof g==='string'&&g))]
const alignedGoal=(goals,target,keys)=>goals.find(g=>g===target.id||keys.includes(g))||null
// The goal node's IRI, as src/matching/graph.js names a pathway's goals.
const goalNode=goal=>`urn:kamin:goal:${goal}`

export function buildMatchingProfile({graph=null,skills=[],goal=null,goals=[],insight=null}={}){
  if(graph?.['@type']==='Person'){
    const index=indexPersonGraph(graph)
    return {
      mode:'person360-graph',
      graph,
      index,
      skills:[...index.capabilities.keys()],
      goal:index.goal?.key||null,
      // Task 78: the graph holds every chosen goal; goals passed in (state.goals) still come first.
      goals:goalList(index.goal?.key,Array.isArray(goals)&&goals.length?goals:index.goals.map(item=>item.key)),
      preferences:preferenceObject(index),
      preferenceChoices:choiceObject(index),
    }
  }
  return {
    mode:'legacy-flat',
    skills:(skills||[]).map(skill=>skill.id),
    goal:goal||null,
    goals:goalList(goal,goals),
    preferences:firstValues(normalizeDeclaredPreferences(insight?.declaredPreferences)),
    preferenceChoices:allValues(normalizeDeclaredPreferences(insight?.declaredPreferences)),
  }
}

function graphCapabilitySummary(path,target,lang){
  const course=path?.courseCode||text('دليل معتمد','approved evidence',lang)
  const capability=typeof path?.capabilityLabel==='string'
    ? path.capabilityLabel
    : path?.capabilityLabel?.[lang]||path?.capabilityLabel?.ar||path?.capabilityLabel?.en||path?.capabilityKey
  const title=target.title?.[lang]||target.title?.ar||target.title?.en||target.id
  return text(
    `مسار الدليل: ${course} → ${capability} → ${title}.`,
    `Evidence path: ${course} → ${capability} → ${title}.`,
    lang,
  )
}

function judgeGraphTarget(profile,target,lang='ar'){
  const index=profile.index
  const targetGraph=buildTargetSemanticGraph(target)
  const support=[]
  const limits=[]
  const hardGates=[]
  const semanticPaths=[]

  const requirementEdges=targetGraph.edges.filter(edge=>edge.subject===targetGraph['@id'] && edge.predicate==='kamin:requiresCapability')
  const targetEntities=new Map((targetGraph.entities||[]).map(entity=>[entity['@id'],entity]))
  const displayCapability=edge=>{
    const entity=targetEntities.get(edge.object)
    const label=entity?.label
    if(typeof label==='string') return label
    return label?.[lang]||label?.ar||label?.en||entity?.notation||edge.objectKey
  }
  const missing=[]
  const met=[]

  for(const edge of requirementEdges){
    const candidatePaths=(index.capabilities.get(edge.objectKey)||[]).filter(path=>path.capabilityId===edge.object)
    const best=strongestCapabilityPath(candidatePaths)
    if(best){
      met.push(edge.objectKey)
      semanticPaths.push({
        ...best,
        kind:'capability-match',
        targetId:target.id,
        targetNode:targetGraph['@id'],
        targetRelation:edge.predicate,
        targetCapabilityId:edge.object,
        pathText:describeCapabilityPath(best,target,lang),
        relationChain:[
          best.courseId ? {from:best.evidenceId,predicate:'kamin:courseContext',to:best.courseId} : null,
          {from:best.personId,predicate:best.relation||'kamin:demonstrates',to:best.capabilityId,claimId:best.claimId},
          {from:targetGraph['@id'],predicate:'kamin:requiresCapability',to:edge.object},
        ].filter(Boolean),
      })
      support.push(graphCapabilitySummary(best,target,lang))
    }else{
      missing.push(edge.objectKey)
      semanticPaths.push({
        kind:'capability-gap',
        status:'missing',
        targetId:target.id,
        targetNode:targetGraph['@id'],
        targetRelation:edge.predicate,
        targetCapabilityId:edge.object,
        capabilityKey:edge.objectKey,
        relationChain:[{from:targetGraph['@id'],predicate:'kamin:requiresCapability',to:edge.object}],
      })
    }
  }

  if(requirementEdges.length){
    if(met.length) support.unshift(text(
      `وجد كامن ${met.length} مسار دليل صالح من أصل ${requirementEdges.length} قدرات أساسية مطلوبة.`,
      `Kamin found ${met.length} valid evidence path(s) across ${requirementEdges.length} core required capabilities.`,
      lang,
    ))
    if(missing.length){
      const missingLabels=requirementEdges.filter(edge=>missing.includes(edge.objectKey)).map(displayCapability)
      limits.push(text(
        `لا يوجد حتى الآن مسار دليل معتمد إلى: ${missingLabels.join('، ')}.`,
        `No approved evidence path currently reaches: ${missingLabels.join(', ')}.`,
        lang,
      ))
    }
  }else{
    support.push(text(
      'هذا المسار لا يفرض قدرة أكاديمية مسبقة في الرسم المرجعي الحالي.',
      'This pathway has no academic capability prerequisite in the current reference graph.',
      lang,
    ))
  }

  const targetGoalEdges=targetGraph.edges.filter(edge=>edge.subject===targetGraph['@id'] && edge.predicate==='kamin:supportsGoal')
  const selectedGoals=profile.goals?.length?profile.goals:goalList(index.goal?.key)
  const matchedGoal=alignedGoal(selectedGoals,target,targetGoalEdges.map(edge=>edge.objectKey))
  const selectedGoal=matchedGoal||selectedGoals[0]||null
  const goalMatch=selectedGoal ? Boolean(matchedGoal) : null
  if(selectedGoal&&index.goal){
    const edge=targetGoalEdges.find(item=>item.objectKey===selectedGoal)
    // Task 78: the person graph holds one goal claim per chosen goal, so R2's first premise names the goal that
    // matched (its own claim and node), the same goal as the second premise, for the 2nd and 3rd goals too. With no
    // match, or a goal missing from the graph, the main goal's claim is named, as before.
    const personGoal=(matchedGoal&&(index.goals||[]).find(item=>item.key===matchedGoal))||index.goal
    // Task 76: a goal that is this pathway's own id (step 4 and My plan store pathway ids) has no catalog
    // "supports goal" edge, so R2's second premise had no object ({"@id": null} in the dataset). The pathway supports
    // the goal of reaching it: the premise names the goal node the student chose (the person's own goal node when it
    // is in the graph). The rule, its scope and its evidence strength (self-reported) are unchanged.
    const ownGoal=matchedGoal&&matchedGoal===target.id
      ? (personGoal.key===matchedGoal&&personGoal.objectId ? personGoal.objectId : goalNode(matchedGoal))
      : null
    semanticPaths.push({
      kind:'goal-alignment',
      status:matchedGoal?'supported':'outside-current-goal',
      targetId:target.id,
      personClaimId:personGoal.claimId,
      personGoalId:personGoal.objectId,
      goal:selectedGoal,
      targetRelation:'kamin:supportsGoal',
      targetGoalId:edge?.object||ownGoal||null,
    })
  }
  if(goalMatch===true) support.push(text(
    'هدفك المصرح به مرتبط بهذا المسار في كتالوج كامن.',
    'Your declared goal is linked to this pathway in the KAMIN catalog.',
    lang,
  ))
  else if(goalMatch===false) limits.push(text(
    'هذا المسار خارج الهدف الذي اخترته حاليًا؛ يبقى للاستكشاف ولا يُعد توصية رئيسية.',
    'This pathway sits outside your current goal; it remains exploratory rather than a primary recommendation.',
    lang,
  ))

  const preferenceSpecs=[
    ['careerInterest','preferredInterests',text('الاهتمام المهني','career interest',lang)],
    ['workValue','preferredValues',text('قيمة العمل','work value',lang)],
    ['workStructure','preferredWorkStructure',text('درجة الهيكلة','work structure',lang)],
    ['collaboration','preferredCollaboration',text('نمط التعاون','collaboration style',lang)],
  ]
  // Task 78: interest areas and work values hold up to 3 values each. Every chosen value gets its own path (and, when
  // the pathway is compatible with it, its own R3 conclusion); the scheme's sentence is said once: "aligns" when any
  // value fits, "less connected" only when none does. With one value this is exactly the old single-value rule.
  for(const [scheme,targetField,label] of preferenceSpecs){
    const chosen=index.preferenceChoices?.get(scheme)||(index.preferences.get(scheme)?[index.preferences.get(scheme)]:[])
    if(!chosen.length) continue
    let anyAligned=false
    chosen.forEach((personPreference,choice)=>{
      const aligned=(target[targetField]||[]).includes(personPreference.key)
      anyAligned=anyAligned||aligned
      semanticPaths.push({
        kind:'preference-alignment',
        status:aligned?'supported':'context-only',
        targetId:target.id,
        scheme,
        option:personPreference.key,
        ...(choice?{choiceKey:`${scheme}:${personPreference.key}`}:{}),
        personClaimId:personPreference.claimId,
        personPreferenceId:personPreference.objectId,
        targetRelation:`kamin:compatiblePreference:${scheme}`,
      })
    })
    if(anyAligned) support.push(text(
      `${label} الذي اخترته متوافق مع هذا المسار.`,
      `Your declared ${label} aligns with this pathway.`,
      lang,
    ))
    else if(scheme==='careerInterest' && target[targetField]?.length) limits.push(text(
      'اهتمامك المهني المصرح به أقل ارتباطًا بهذا المسار؛ هذه إشارة سياقية وليست مانعًا.',
      'Your declared career interest is less connected to this pathway; this is contextual, not a gate.',
      lang,
    ))
  }

  let judgment='exploratory'
  if(hardGates.length) judgment='not-yet'
  else if(missing.length) judgment='conditional'
  else if(goalMatch===false) judgment='exploratory'
  else if(requirementEdges.length===0 || met.length===requirementEdges.length) judgment='fits'

  // Confirmed topics add explanations only: never capabilities, scores or eligibility.
  for(const interest of index.digitalInterests || []){
    const edge=targetGraph.edges.find(item=>item.predicate==='kamin:relatesToTopic' && item.object===interest.objectId)
    if(!edge) continue
    semanticPaths.push({kind:'digital-interest-alignment',status:'supported',targetId:target.id,targetNode:targetGraph['@id'],topicId:interest.topicId,personTopicId:interest.objectId,personClaimId:interest.claimId,evidenceId:interest.evidenceId,evidenceStrength:'student-confirmed-interest'})
    support.push(text(`اهتمام «${interest.label.ar}» الذي أكدته من نصوصك يرتبط بهذا المسار؛ يفسر العلاقة ولا يثبت القدرة.`,`Your confirmed interest in “${interest.label.en}” connects to this pathway; it explains context, not capability.`,lang))
  }

  const knowledgeInsights=deriveKnowledgeInsights(index,target.id,{
    lang,
    requiredCapabilityKeys:missing,
  })

  return {
    ...target,
    judgment,
    hardGates,
    supportingMechanisms:support,
    limitingMechanisms:limits,
    missingSkills:missing,
    semanticPaths,
    inferences:sweepOrphanInferences(inferRelations(profile.graph['@id'],semanticPaths),profile.graph),
    knowledgeInsights,
    graphTrace:{
      personGraphId:profile.graph?.['@id']||null,
      personGraphVersion:profile.graph?.ontologyVersion||null,
      targetGraphId:targetGraph['@id'],
      targetGraphVersion:targetGraph.version,
      requiredCapabilities:requirementEdges.length,
      matchedCapabilities:met.length,
      evidencePathCount:semanticPaths.filter(path=>path.kind==='capability-match').length,
      academicContextCount:index.academicContexts.length,
      knowledgeGraphId:targetGraph.knowledgeGraph?.id||null,
      knowledgeGraphVersion:targetGraph.knowledgeGraph?.version||null,
    },
    decisionBasis:'person360-semantic-graph',
    calibrationStatus:'graph-rule-based-uncalibrated',
    ruleVersion:'kamin-graph-fit-v1',
    semanticMatchingVersion:GRAPH_MATCHING_VERSION,
  }
}

function judgeLegacyTarget(profile,target,lang='ar'){
  const support=[]
  const limits=[]
  const hardGates=[]
  const required=target.requiredSkills||[]
  const missing=required.filter(id=>!hasSkill(profile,id))
  const missingLabels=missing.map(id=>skillCatalog[id]?.labels?.[lang]||id)
  const met=required.filter(id=>hasSkill(profile,id))

  if(required.length){
    if(met.length) support.push(text(
      `لديك دليل حالي على ${met.length} من ${required.length} مهارات أساسية مطلوبة.`,
      `You currently have evidence for ${met.length} of ${required.length} core required skills.`,lang))
    if(missing.length) limits.push(text(
      `تحتاج إلى بناء دليل على: ${missingLabels.join('، ')}.`,
      `You still need evidence for: ${missingLabels.join(', ')}.`,lang))
  } else {
    support.push(text('لا توجد مهارة أكاديمية إلزامية في الملف المرجعي لهذا المسار.','This reference pathway has no mandatory academic-skill prerequisite.',lang))
  }

  const selectedGoals=profile.goals?.length?profile.goals:goalList(profile.goal)
  const goalMatch=selectedGoals.length ? Boolean(alignedGoal(selectedGoals,target,target.goals||[])) : null
  if(goalMatch===true) support.push(text('المسار متوافق مع الهدف الذي اخترته.','The pathway aligns with your selected goal.',lang))
  else if(goalMatch===false) limits.push(text('المسار ليس ضمن هدفك الحالي؛ يمكن استكشافه لكن لا نعده توصية رئيسية.','This pathway is outside your current goal; it can be explored but is not treated as a primary recommendation.',lang))

  // Task 78: any chosen interest area (up to 3) or work value (up to 3) that the pathway lists counts, once.
  const interests=prefs(profile,'careerInterest')
  if(interests.some(id=>(target.preferredInterests||[]).includes(id))) support.push(text('اهتمامك المهني المصرح به متوافق مع طبيعة هذا المسار.','Your declared career interest aligns with this pathway.',lang))
  else if(interests.length && target.preferredInterests?.length) limits.push(text('اهتمامك المصرح به أقل تطابقًا مع هذا المسار؛ هذه إشارة تفضيل وليست مانعًا.','Your declared interest is less aligned with this pathway; this is a preference signal, not a gate.',lang))

  const values=prefs(profile,'workValue')
  if(values.some(id=>(target.preferredValues||[]).includes(id))) support.push(text('قيمة العمل التي اخترتها تجد دعمًا في هذا المسار المرجعي.','Your selected work value is supported by this reference pathway.',lang))
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
    semanticPaths:[],
    decisionBasis:'legacy-flat-profile',
    calibrationStatus:'rule-based-uncalibrated',
    ruleVersion:'kamin-fit-v1',
  }
}

const ORDER={fits:0,conditional:1,exploratory:2,'not-yet':3}

export function matchTargets(profile,{type=null,lang='ar'}={}){
  const graphMode=profile?.mode==='person360-graph' && profile?.index
  return targetProfiles
    .filter(target=>!type || target.type===type)
    .map(target=>graphMode?judgeGraphTarget(profile,target,lang):judgeLegacyTarget(profile,target,lang))
    .sort((a,b)=>ORDER[a.judgment]-ORDER[b.judgment] || a.id.localeCompare(b.id))
}
