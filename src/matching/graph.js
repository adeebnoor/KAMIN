export const GRAPH_MATCHING_VERSION='kamin-semantic-match-v1'

const localSkillId=id=>`urn:kamin:skill:${String(id||'').trim().toLowerCase()}`
const targetId=id=>`urn:kamin:target:${id}`
const goalId=id=>`urn:kamin:goal:${id}`
const preferenceId=(scheme,option)=>`urn:kamin:preference:${scheme}:${option}`

const labelFor=(entity,lang='ar')=>{
  const label=entity?.label||entity?.prefLabel||entity?.title||entity?.notation||entity?.['@id']||''
  return typeof label==='string' ? label : label?.[lang]||label?.ar||label?.en||''
}

const skillKey=(entityOrId)=>{
  if(entityOrId && typeof entityOrId==='object'){
    if(entityOrId.notation) return String(entityOrId.notation)
    return skillKey(entityOrId['@id'])
  }
  const id=String(entityOrId||'')
  const marker='urn:kamin:skill:'
  if(id.startsWith(marker)) return id.slice(marker.length)
  return id
}

export function buildTargetSemanticGraph(target){
  const tid=targetId(target.id)
  const entities=[{
    '@id':tid,
    '@type':target.type==='job'?'Occupation':'LearningOpportunity',
    targetId:target.id,
    title:target.title,
    targetType:target.type,
  }]
  const edges=[]

  for(const skill of target.requiredSkills||[]){
    const sid=localSkillId(skill)
    entities.push({'@id':sid,'@type':'Competency',notation:skill})
    edges.push({subject:tid,predicate:'kamin:requiresCapability',object:sid,objectKey:skill})
  }
  for(const skill of target.teachesSkills||[]){
    const sid=localSkillId(skill)
    entities.push({'@id':sid,'@type':'Competency',notation:skill})
    edges.push({subject:tid,predicate:'kamin:developsCapability',object:sid,objectKey:skill})
  }
  for(const goal of target.goals||[]){
    const gid=goalId(goal)
    entities.push({'@id':gid,'@type':'Goal',notation:goal})
    edges.push({subject:tid,predicate:'kamin:supportsGoal',object:gid,objectKey:goal})
  }

  const preferenceSpecs=[
    ['careerInterest','preferredInterests'],
    ['workValue','preferredValues'],
    ['workStructure','preferredWorkStructure'],
    ['collaboration','preferredCollaboration'],
  ]
  for(const [scheme,field] of preferenceSpecs){
    for(const option of target[field]||[]){
      const pid=preferenceId(scheme,option)
      entities.push({'@id':pid,'@type':'skos:Concept',scheme:`urn:kamin:preference-scheme:${scheme}`,notation:option})
      edges.push({subject:tid,predicate:`kamin:compatiblePreference:${scheme}`,object:pid,scheme,objectKey:option})
    }
  }

  const codes=target.occupationCodes||{}
  for(const [scheme,code] of Object.entries(codes)){
    if(!code) continue
    const cid=`urn:kamin:occupation-code:${scheme}:${code}`
    entities.push({'@id':cid,'@type':'ClassificationConcept',conceptScheme:scheme,notation:code})
    edges.push({subject:tid,predicate:'kamin:classifiedAs',object:cid,scheme,objectKey:code})
  }

  return {
    '@id':tid,
    '@type':'SemanticTargetGraph',
    version:GRAPH_MATCHING_VERSION,
    entities:[...new Map(entities.map(entity=>[entity['@id'],entity])).values()],
    edges,
  }
}

export function indexPersonGraph(graph){
  const entities=new Map((graph?.entities||[]).map(entity=>[entity['@id'],entity]))
  const claims=(graph?.claims||[]).filter(claim=>claim?.status!=='withdrawn' && claim?.status!=='inactive')
  const capabilities=new Map()
  const preferences=new Map()
  let goal=null

  for(const claim of claims){
    const object=entities.get(claim.object)
    if(claim.predicate==='kamin:demonstrates'){
      const key=skillKey(object||claim.object)
      const evidence=entities.get(claim.source)||null
      const course=evidence?.course ? entities.get(evidence.course)||null : null
      const path={
        kind:'capability-evidence',
        status:'supported',
        personId:graph?.['@id']||'urn:kamin:person:local',
        claimId:claim['@id'],
        relation:'kamin:demonstrates',
        capabilityId:claim.object,
        capabilityKey:key,
        capabilityLabel:object?.label||object?.notation||key,
        evidenceId:claim.source,
        evidenceType:evidence?.evidenceType||claim.sourceType||null,
        evidenceStrength:claim.evidenceStrength||null,
        courseId:course?.['@id']||evidence?.course||null,
        courseCode:course?.code||null,
        courseName:course?.name||null,
        generatedBy:claim.generatedBy||null,
        sourceType:claim.sourceType||null,
      }
      const current=capabilities.get(key)||[]
      current.push(path)
      capabilities.set(key,current)
    }else if(claim.predicate==='kamin:pursuesGoal'){
      goal={
        key:object?.notation||String(claim.object||'').split(':').pop()||null,
        claimId:claim['@id'],
        objectId:claim.object,
        source:claim.source,
      }
    }else if(String(claim.predicate||'').startsWith('kamin:prefers:')){
      const scheme=claim.predicate.slice('kamin:prefers:'.length)
      preferences.set(scheme,{
        scheme,
        key:object?.notation||String(claim.object||'').split(':').pop()||null,
        claimId:claim['@id'],
        objectId:claim.object,
        source:claim.source,
      })
    }
  }

  const academicContexts=claims
    .filter(claim=>claim.predicate==='kamin:academicContext')
    .map(claim=>({
      claimId:claim['@id'],
      concept:entities.get(claim.object)||null,
      evidenceStrength:claim.evidenceStrength||null,
      source:claim.source,
    }))

  return {
    graph,
    entities,
    claims,
    capabilities,
    preferences,
    goal,
    academicContexts,
  }
}

export function strongestCapabilityPath(paths=[]){
  const rank={high:5,medium:4,'document-derived':4,applied:4,low:3,preliminary:2,declared:1}
  return [...paths].sort((a,b)=>(rank[b.evidenceStrength]||0)-(rank[a.evidenceStrength]||0))[0]||null
}

export function describeCapabilityPath(path,target,lang='ar'){
  if(!path) return ''
  const targetLabel=target?.title?.[lang]||target?.title?.ar||target?.title?.en||target?.id||''
  const capability=labelFor({label:path.capabilityLabel,notation:path.capabilityKey},lang)||path.capabilityKey
  const course=path.courseCode||labelFor({label:path.courseName},lang)||path.evidenceType||path.evidenceId
  return lang==='ar'
    ? `${course} → ${capability} → ${targetLabel}`
    : `${course} → ${capability} → ${targetLabel}`
}
