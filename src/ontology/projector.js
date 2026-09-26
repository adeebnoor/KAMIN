import { addClaim, addEntity, createClaim, emptyPerson360 } from '../person360.js'

const slug=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g,'-').replace(/^-|-$/g,'')
const courseId=code=>`urn:kamin:course:${slug(code)}`
const evidenceId=(type,key)=>`urn:kamin:evidence:${type}:${slug(key)}`
const skillId=id=>`urn:kamin:skill:${slug(id)}`
const preferenceId=(scheme,option)=>`urn:kamin:preference:${slug(scheme)}:${slug(option)}`

export function projectStateToPerson360({state,skills=[],educationClassification=null}){
  let graph=emptyPerson360()
  graph={...graph,updatedAt:new Date().toISOString()}

  for(const course of state?.courses||[]){
    const cid=courseId(course.code)
    const eid=evidenceId('course',course.code)
    graph=addEntity(graph,{
      '@id':cid,
      '@type':'Course',
      code:course.code,
      name:course.name,
      grade:course.grade,
      hours:course.hours??null,
    })
    graph=addEntity(graph,{
      '@id':eid,
      '@type':'Evidence',
      evidenceType:course.source||'transcript-row',
      course:cid,
      grade:course.grade,
      sourceDocument:course.source||'approved-session-record',
    })
    graph=addClaim(graph,createClaim({
      id:`urn:kamin:claim:studied:${slug(course.code)}`,
      predicate:'kamin:studied',
      object:cid,
      source:eid,
      sourceType:course.source||'transcript',
      generatedBy:'urn:kamin:activity:transcript-approval',
      evidenceStrength:course.source==='manual'?'declared':'document-derived',
      consentPurpose:'urn:kamin:purpose:academic-profile',
    }))
  }

  for(const skill of skills||[]){
    const sid=skill.uri||skillId(skill.id)
    graph=addEntity(graph,{
      '@id':sid,
      '@type':'Competency',
      label:skill.labels||skill.label||skill.id,
      alignmentStatus:skill.uri?'externally-aligned':'pilot-local-unmapped',
    })
    const evidence=(skill.evidence||[]).map(item=>evidenceId('course',item.code))
    for(const [index,source] of evidence.entries()){
      graph=addClaim(graph,createClaim({
        id:`urn:kamin:claim:demonstrates:${slug(skill.id)}:${index+1}`,
        predicate:'kamin:demonstrates',
        object:sid,
        source,
        sourceType:'approved-course-mapping',
        generatedBy:'urn:kamin:activity:skill-inference',
        evidenceStrength:skill.confidenceLabel||'preliminary',
        consentPurpose:'urn:kamin:purpose:academic-profile',
        metadata:{mappingVersion:'pilot-v1'},
      }))
    }
  }

  const primary=educationClassification?.primary
  if(primary){
    const sascedId=`urn:kamin:sasced:${primary.code}`
    graph=addEntity(graph,{
      '@id':sascedId,
      '@type':'ClassificationConcept',
      prefLabel:primary.labels,
      notation:primary.code,
      conceptScheme:'urn:kamin:sasced',
      exactMatch:null,
      source:primary.mappingSourceUrl||null,
    })
    graph=addClaim(graph,createClaim({
      id:`urn:kamin:claim:academic-context:${primary.code}`,
      predicate:'kamin:academicContext',
      object:sascedId,
      source:primary.mappingSourceUrl||'urn:kamin:evidence:institutional-prefix-mapping',
      sourceType:'institutional-programme-mapping',
      generatedBy:'urn:kamin:activity:sasced-context-inference',
      evidenceStrength:'contextual-candidate',
      consentPurpose:'urn:kamin:purpose:academic-profile',
      metadata:{coverage:educationClassification.coverage??null,isMixed:!!educationClassification.isMixed},
    }))
  }

  for(const [scheme,option] of Object.entries(state?.insight?.declaredPreferences||{})){
    const pid=preferenceId(scheme,option)
    graph=addEntity(graph,{
      '@id':pid,
      '@type':'skos:Concept',
      scheme:`urn:kamin:preference-scheme:${scheme}`,
      notation:option,
    })
    graph=addClaim(graph,createClaim({
      id:`urn:kamin:claim:preference:${slug(scheme)}`,
      predicate:`kamin:prefers:${scheme}`,
      object:pid,
      source:'urn:kamin:evidence:self-declaration',
      sourceType:'self-declared',
      generatedBy:'urn:kamin:activity:structured-preference',
      evidenceStrength:'self-reported',
      consentPurpose:'urn:kamin:purpose:student-insight',
    }))
  }

  for(const observation of state?.insight?.personGraph?.observations||[]){
    graph={...graph,observations:[...graph.observations,observation]}
  }

  return graph
}
