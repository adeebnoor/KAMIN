import { addClaim, addEntity, createClaim, emptyPerson360 } from '../person360.js'
import { DIGITAL_METHOD, DIGITAL_NOTICE, DIGITAL_PURPOSE, digitalInterestClaims } from '../digitalInterests.js'
import { rowProvenance, provenanceStrength } from '../utils/provenance.js'

const slug=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g,'-').replace(/^-|-$/g,'')
const courseId=code=>`urn:kamin:course:${slug(code)}`
const evidenceId=(type,key)=>`urn:kamin:evidence:${type}:${slug(key)}`
const skillId=id=>`urn:kamin:skill:${slug(id)}`
const preferenceId=(scheme,option)=>`urn:kamin:preference:${slug(scheme)}:${slug(option)}`
const goalId=goal=>`urn:kamin:goal:${slug(goal)}`

export function projectStateToPerson360({state,skills=[],educationClassification=null}){
  let graph=emptyPerson360()
  graph={...graph,updatedAt:new Date().toISOString()}

  for(const course of state?.courses||[]){
    const cid=courseId(course.code)
    const eid=evidenceId('course',course.code)
    const provenance=rowProvenance(course)
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
      provenanceLevel:provenance.level,
      editedFields:provenance.edits,
      gradeRaisedByStudent:provenance.gradeRaised,
    })
    graph=addClaim(graph,createClaim({
      id:`urn:kamin:claim:studied:${slug(course.code)}`,
      predicate:'kamin:studied',
      object:cid,
      source:eid,
      sourceType:course.source||'transcript',
      generatedBy:'urn:kamin:activity:transcript-approval',
      evidenceStrength:provenanceStrength(provenance.level),
      consentPurpose:'urn:kamin:purpose:academic-profile',
    }))
  }

  for(const skill of skills||[]){
    const sid=skill.uri||skillId(skill.id)
    graph=addEntity(graph,{
      '@id':sid,
      '@type':'Competency',
      notation:skill.id,
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

  // Self-declared applied evidence: visible to reviewers, never a capability claim.
  for(const project of state?.projects||[]){
    const pid=`urn:kamin:evidence:project:${slug(project.id)}`
    graph=addEntity(graph,{
      '@id':pid,
      '@type':'Evidence',
      evidenceType:'student-project-declaration',
      kind:project.kind,
      title:project.title,
      url:project.url||null,
      description:project.description||'',
      provenanceLevel:'declared-applied',
      reviewStatus:project.reviewStatus||'unreviewed',
      createdAt:project.createdAt,
    })
    for(const id of project.skillIds||[]){
      graph=addClaim(graph,createClaim({
        id:`urn:kamin:claim:declares-evidence:${slug(project.id)}:${slug(id)}`,
        predicate:'kamin:declaresEvidenceFor',
        object:skillId(id),
        source:pid,
        sourceType:'student-project-declaration',
        generatedBy:'urn:kamin:activity:project-declaration',
        evidenceStrength:'declared-applied',
        consentPurpose:'urn:kamin:purpose:academic-profile',
        metadata:{affectsFit:false,reviewRequired:true},
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

  if(state?.goal){
    const gid=goalId(state.goal)
    graph=addEntity(graph,{
      '@id':gid,
      '@type':'Goal',
      notation:state.goal,
      goalType:'career-direction',
    })
    graph=addClaim(graph,createClaim({
      id:`urn:kamin:claim:goal:${slug(state.goal)}`,
      predicate:'kamin:pursuesGoal',
      object:gid,
      source:'urn:kamin:evidence:self-declaration',
      sourceType:'self-declared',
      generatedBy:'urn:kamin:activity:goal-selection',
      evidenceStrength:'self-reported',
      consentPurpose:'urn:kamin:purpose:student-insight',
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

  if(state?.consents?.insight){
    for(const item of digitalInterestClaims(state.insight?.digitalInterests)){
      graph=addEntity(graph,{'@id':item.topicIri,'@type':'skos:Concept',label:item.topic.label,notation:item.topicId})
      graph=addEntity(graph,{'@id':item.consentIri,'@type':'kamin:Consent',consentPurpose:DIGITAL_PURPOSE,generatedAtTime:item.grantedAt,status:'active',metadata:{noticeVersion:DIGITAL_NOTICE,contextAllowed:item.contextAllowed}})
      graph=addEntity(graph,{'@id':item.evidenceIri,'@type':'Evidence',label:{ar:'تأكيد الطالب لاقتراح من نص اختاره',en:'Student confirmation of a selected-text suggestion'},sourceType:item.sourceType,generatedAtTime:item.confirmedAt,metadata:{matchedTerms:item.matchedTerms,methodVersion:DIGITAL_METHOD,rawTextRetained:false,reviewStatus:'student-confirmed'}})
      graph=addClaim(graph,createClaim({id:item.claimIri,predicate:'kamin:hasConfirmedInterest',object:item.topicIri,source:item.evidenceIri,sourceType:item.sourceType,generatedBy:`urn:kamin:activity:${DIGITAL_METHOD}`,generatedAtTime:item.confirmedAt,evidenceStrength:'student-confirmed-interest',consentPurpose:DIGITAL_PURPOSE,metadata:{consentId:item.consentIri,contextAllowed:item.contextAllowed,reviewStatus:'student-confirmed',methodVersion:DIGITAL_METHOD}}))
    }
  }

  return graph
}
