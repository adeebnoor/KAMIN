import { KAMIN_ONTOLOGY_VERSION, makeEdge, makeNode, validateGraph } from './kaminOntology.js'

const slug=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g,'-').replace(/^-+|-+$/g,'')

export function buildPersonGraph({
  personId='person:local',
  courses=[],
  skills=[],
  educationClassification=null,
  insight=null,
  goals=[],
  constraints=[],
  outcomes=[],
}={}){
  const nodes=[makeNode({id:personId,type:'Person',label:personId,metadata:{local:true}})]
  const edges=[]
  const addNode=node=>{if(!nodes.some(n=>n.id===node.id)) nodes.push(node)}

  for(const course of courses){
    const courseId=`course:${slug(course.code||course.name)}`
    addNode(makeNode({id:courseId,type:'Course',label:course.name||course.code,externalId:course.code||null,metadata:{grade:course.grade||null,hours:course.hours||null}}))
    edges.push(makeEdge({
      id:`edge:${personId}:studied:${courseId}`,
      type:'studied',from:personId,to:courseId,assertionKind:'observed',
      source:course.source||'approved-transcript',consentScope:'academic-profile',
      evidenceLevel:course.source==='manual'?'declared':'document',
    }))
  }

  for(const skill of skills){
    const skillId=`skill:${slug(skill.id||skill.labels?.en||skill.labels?.ar)}`
    addNode(makeNode({
      id:skillId,type:'Skill',label:skill.labels?.en||skill.labels?.ar||skill.id,
      scheme:'ESCO-compatible',externalId:skill.escoUri||null,
      metadata:{labels:skill.labels||null},
    }))
    const evidence=(skill.evidence||[]).map(e=>e.code).filter(Boolean)
    edges.push(makeEdge({
      id:`edge:${personId}:demonstrates:${skillId}`,
      type:'demonstrates',from:personId,to:skillId,assertionKind:'inferred',
      ruleVersion:'course-skill-map-v1',consentScope:'academic-profile',
      confidence:skill.confidenceLabel||null,metadata:{evidenceCourses:evidence},
    }))
  }

  if(educationClassification?.primary){
    const primary=educationClassification.primary
    const programId=`program:sasced:${primary.code}`
    addNode(makeNode({
      id:programId,type:'AcademicProgram',label:primary.labels?.en||primary.labels?.ar||primary.code,
      scheme:'SASCED-20',externalId:primary.code,
      metadata:{labels:primary.labels||null,contextual:true},
    }))
    edges.push(makeEdge({
      id:`edge:${personId}:enrolledIn:${programId}`,
      type:'enrolledIn',from:personId,to:programId,assertionKind:'observed',
      source:primary.mappingSourceUrl||'institutional-program-context',
      consentScope:'academic-profile',evidenceLevel:'document',
      metadata:{coverage:educationClassification.coverage||null,isMixed:!!educationClassification.isMixed},
    }))
  }

  const insightDomains=insight?.domains||{}
  const instrumentMap={
    interests:'O*NET-RIASEC',
    values:'O*NET-WorkValues',
    workstyle:'O*NET-WorkStyles',
    tendencies:'IPIP-BigFive-compatible',
    motivations:'Kamin-Motivation-v0',
  }
  const edgeMap={
    interests:['Interest','interestedIn'],
    values:['WorkValue','values'],
    workstyle:['WorkStyle','prefersWorkStyle'],
    tendencies:['PersonalityTrait','hasTrait'],
    motivations:['Motivation','motivatedBy'],
  }
  for(const [domainId,domain] of Object.entries(insightDomains)){
    const mapping=edgeMap[domainId]
    if(!mapping) continue
    const [nodeType,edgeType]=mapping
    for(const dim of domain.dimensions||[]){
      const nodeId=`${domainId}:${slug(dim.id)}`
      addNode(makeNode({id:nodeId,type:nodeType,label:dim.label,scheme:instrumentMap[domainId],externalId:dim.externalId||null,metadata:{descriptor:dim.descriptor||null}}))
      edges.push(makeEdge({
        id:`edge:${personId}:${edgeType}:${nodeId}`,
        type:edgeType,from:personId,to:nodeId,assertionKind:'assessed',
        source:'student-self-assessment',instrument:{id:instrumentMap[domainId],version:insight.version||'draft'},
        consentScope:'student-insight',evidenceLevel:'assessed',
        metadata:{score:dim.score??null,evidenceCount:dim.evidenceCount??null},
      }))
    }
  }

  for(const goal of goals){
    const goalId=`goal:${slug(goal.id||goal.label||goal)}`
    addNode(makeNode({id:goalId,type:'Goal',label:goal.label||String(goal)}))
    edges.push(makeEdge({id:`edge:${personId}:targets:${goalId}`,type:'targets',from:personId,to:goalId,assertionKind:'declared',consentScope:'career-preferences'}))
  }

  for(const constraint of constraints){
    const constraintId=`constraint:${slug(constraint.id||constraint.label||constraint)}`
    addNode(makeNode({id:constraintId,type:'Constraint',label:constraint.label||String(constraint)}))
    edges.push(makeEdge({id:`edge:${personId}:constrainedBy:${constraintId}`,type:'constrainedBy',from:personId,to:constraintId,assertionKind:'declared',consentScope:'career-preferences'}))
  }

  for(const outcome of outcomes){
    const outcomeId=`outcome:${slug(outcome.id||outcome.type||Date.now())}`
    addNode(makeNode({id:outcomeId,type:'Outcome',label:outcome.label||outcome.type||'Outcome',metadata:outcome}))
    edges.push(makeEdge({id:`edge:${personId}:producedOutcome:${outcomeId}`,type:'producedOutcome',from:personId,to:outcomeId,assertionKind:'observed',source:outcome.source||'user-recorded-outcome',consentScope:'outcomes'}))
  }

  const graph={ontologyVersion:KAMIN_ONTOLOGY_VERSION,nodes,edges}
  return {...graph,validation:validateGraph(graph)}
}
