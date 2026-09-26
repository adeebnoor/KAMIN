import { JSON_LD_CONTEXT, KAMIN_ONTOLOGY_VERSION } from './registry.js'

const encode=value=>encodeURIComponent(String(value??'').trim().toLowerCase()).replace(/%/g,'')
const id=(kind,value)=>`urn:kamin:${kind}:${encode(value)}`
const nowIso=()=>new Date().toISOString()

const sourceStrength=source=>({
  verified:'verified',
  pdf:'document',
  ocr:'document',
  text:'document',
  demo:'illustrative',
  manual:'self-declared',
  'self-report':'self-reported',
}[source]||'unknown')

function claim({claimId,subject,predicate,object=null,value=null,source,sourceType='derived',generatedAt=null,extra={}}){
  if(!source) throw new Error('CLAIM_SOURCE_REQUIRED')
  return {
    '@id':claimId,
    '@type':'kamin:Claim',
    'kamin:subject':subject,
    'kamin:predicate':predicate,
    ...(object?{'kamin:object':object}:{}),
    ...(value!==null?{'kamin:value':value}:{}),
    'prov:wasDerivedFrom':source,
    'prov:generatedAtTime':generatedAt||nowIso(),
    'kamin:sourceType':sourceType,
    ...extra,
  }
}

function educationConceptNode(primary){
  if(!primary) return null
  return {
    '@id':id('sasced',primary.code),
    '@type':['skos:Concept','kamin:AcademicClassification'],
    'skos:notation':primary.code,
    'skos:prefLabel':[
      {'@value':primary.labels?.ar||primary.ar||primary.code,'@language':'ar'},
      {'@value':primary.labels?.en||primary.en||primary.code,'@language':'en'},
    ],
    'skos:inScheme':'urn:kamin:scheme:sasced-20',
    'prov:wasDerivedFrom':'urn:kamin:source:sasced-20',
  }
}

export function buildPerson360Graph({
  state,
  skills=[],
  educationClassification=null,
  personId='local-person',
  generatedAt=nowIso(),
}={}){
  const person=id('person',personId)
  const record=id('record','academic-transcript')
  const graph=[
    {
      '@id':person,
      '@type':['schema:Person','kamin:Person360'],
      'schema:identifier':personId,
      'kamin:ontologyVersion':KAMIN_ONTOLOGY_VERSION,
    },
    {
      '@id':'urn:kamin:source:sasced-20',
      '@type':'prov:Entity',
      'schema:name':'Saudi Standard Classification of Educational Levels and Specialties (SASCED-20)',
      'kamin:sourceType':'official-classification',
    },
  ]

  if(state?.approved || state?.courses?.length){
    graph.push({
      '@id':record,
      '@type':['prov:Entity','kamin:AcademicRecord'],
      'schema:name':'Academic transcript evidence',
      'kamin:sourceType':'academic-record',
      'prov:generatedAtTime':generatedAt,
    })
    graph.push(claim({
      claimId:id('claim','person-academic-record'),
      subject:person,
      predicate:'kamin:hasAcademicRecord',
      object:record,
      source:record,
      sourceType:'academic-record',
      generatedAt,
    }))
  }

  for(const [index,course] of (state?.courses||[]).entries()){
    const code=course.code||`course-${index+1}`
    const courseId=id('course',code)
    graph.push({
      '@id':courseId,
      '@type':['schema:Course','kamin:Course'],
      'schema:courseCode':code,
      'schema:name':typeof course.name==='string'?course.name:(course.name?.en||course.name?.ar||code),
      'kamin:grade':course.grade??null,
      'kamin:creditHours':course.hours??null,
      'kamin:sourceType':course.source||'unknown',
    })
    graph.push(claim({
      claimId:id('claim',`studied-${code}`),
      subject:person,
      predicate:'kamin:studied',
      object:courseId,
      source:record,
      sourceType:course.source||'academic-record',
      generatedAt,
      extra:{'kamin:evidenceStrength':sourceStrength(course.source)},
    }))
  }

  for(const skill of skills){
    const skillId=skill.escoUri||id('skill',skill.id||skill.labels?.en||skill.labels?.ar||'unknown')
    graph.push({
      '@id':skillId,
      '@type':['skos:Concept','kamin:Skill'],
      'skos:prefLabel':[
        ...(skill.labels?.ar?[{'@value':skill.labels.ar,'@language':'ar'}]:[]),
        ...(skill.labels?.en?[{'@value':skill.labels.en,'@language':'en'}]:[]),
      ],
      'kamin:mappingStatus':skill.escoUri?'external-identifier':'local-pilot-unmapped',
    })
    const evidenceIds=(skill.evidence||[]).map((e,i)=>id('course',e.code||`skill-evidence-${skill.id}-${i}`))
    graph.push(claim({
      claimId:id('claim',`demonstrated-${skill.id}`),
      subject:person,
      predicate:'kamin:demonstrated',
      object:skillId,
      source:evidenceIds[0]||record,
      sourceType:'approved-course-mapping',
      generatedAt,
      extra:{
        'kamin:evidenceStrength':skill.confidenceLabel||'preliminary',
        'kamin:supportedBy':evidenceIds,
      },
    }))
  }

  const academic=educationConceptNode(educationClassification?.primary)
  if(academic){
    graph.push(academic)
    graph.push(claim({
      claimId:id('claim','academic-classification'),
      subject:person,
      predicate:'kamin:classifiedAs',
      object:academic['@id'],
      source:'urn:kamin:source:sasced-20',
      sourceType:'official-classification-context',
      generatedAt,
      extra:{'kamin:evidenceStrength':'contextual'},
    }))
  }

  const insight=state?.insight||{}
  if(state?.consents?.insight){
    for(const [key,value] of Object.entries(insight.declaredPreferences||{})){
      const prefId=id('preference',`${key}-${Array.isArray(value)?value.join('-'):value}`)
      graph.push({
        '@id':prefId,
        '@type':['skos:Concept','kamin:DeclaredPreference'],
        'skos:notation':Array.isArray(value)?value.join('|'):value,
        'kamin:preferenceDimension':key,
      })
      graph.push(claim({
        claimId:id('claim',`preference-${key}`),
        subject:person,
        predicate:'kamin:declaredPreference',
        object:prefId,
        source:prefId,
        sourceType:'self-report',
        generatedAt,
        extra:{
          'kamin:evidenceStrength':'self-reported',
          'kamin:consentPurpose':'student-insight',
        },
      }))
    }

    for(const observation of insight.observations||[]){
      const obsId=id('observation',observation.id||`${observation.instrumentId}-${observation.dimensionId}-${observation.generatedAt}`)
      graph.push({
        '@id':obsId,
        '@type':['prov:Entity','kamin:Observation'],
        'kamin:instrument':observation.instrumentId,
        'kamin:instrumentVersion':observation.instrumentVersion,
        'kamin:dimension':observation.dimensionId,
        'kamin:value':observation.value,
        'kamin:scale':observation.scale,
        'kamin:sourceType':'self-report',
        'kamin:consentPurpose':observation.consentPurpose||'student-insight',
        'prov:generatedAtTime':new Date(observation.generatedAt||Date.now()).toISOString(),
      })
      graph.push(claim({
        claimId:id('claim',`observation-${observation.id||obsId}`),
        subject:person,
        predicate:'kamin:hasObservation',
        object:obsId,
        source:obsId,
        sourceType:'self-report',
        generatedAt:new Date(observation.generatedAt||Date.now()).toISOString(),
        extra:{
          'kamin:evidenceStrength':'self-reported',
          'kamin:consentPurpose':observation.consentPurpose||'student-insight',
        },
      }))
    }
  }

  for(const [purpose,granted] of Object.entries(state?.consents||{})){
    if(!granted) continue
    const consentId=id('consent',purpose)
    graph.push({
      '@id':consentId,
      '@type':['dpv:Consent','prov:Entity'],
      'dpv:hasPurpose':id('purpose',purpose),
      'kamin:consentStatus':'given',
      'prov:generatedAtTime':generatedAt,
    })
    graph.push(claim({
      claimId:id('claim',`consent-${purpose}`),
      subject:person,
      predicate:'kamin:hasConsent',
      object:consentId,
      source:consentId,
      sourceType:'consent',
      generatedAt,
    }))
  }

  return {
    '@context':JSON_LD_CONTEXT,
    '@type':'kamin:Person360Graph',
    'kamin:ontologyVersion':KAMIN_ONTOLOGY_VERSION,
    'prov:generatedAtTime':generatedAt,
    '@graph':graph,
  }
}

export function validatePerson360Graph(document){
  const errors=[]
  const nodes=document?.['@graph']
  if(!Array.isArray(nodes)) return {valid:false,errors:['GRAPH_REQUIRED']}
  const ids=new Set(nodes.map(node=>node?.['@id']).filter(Boolean))
  const claims=nodes.filter(node=>{
    const type=node?.['@type']
    return type==='kamin:Claim' || (Array.isArray(type)&&type.includes('kamin:Claim'))
  })
  for(const item of claims){
    if(!item['kamin:subject']) errors.push(`${item['@id']||'claim'}:SUBJECT_REQUIRED`)
    if(!item['kamin:predicate']) errors.push(`${item['@id']||'claim'}:PREDICATE_REQUIRED`)
    if(!item['prov:wasDerivedFrom']) errors.push(`${item['@id']||'claim'}:PROVENANCE_REQUIRED`)
    if(!('kamin:object' in item) && !('kamin:value' in item)) errors.push(`${item['@id']||'claim'}:OBJECT_OR_VALUE_REQUIRED`)
  }
  const observations=nodes.filter(node=>{
    const type=node?.['@type']
    return type==='kamin:Observation' || (Array.isArray(type)&&type.includes('kamin:Observation'))
  })
  for(const obs of observations){
    if(!obs['kamin:instrument']) errors.push(`${obs['@id']||'observation'}:INSTRUMENT_REQUIRED`)
    if(!obs['kamin:consentPurpose']) errors.push(`${obs['@id']||'observation'}:CONSENT_PURPOSE_REQUIRED`)
  }
  const dangling=claims
    .map(item=>item['kamin:object'])
    .filter(value=>typeof value==='string' && value.startsWith('urn:kamin:') && !ids.has(value))
  for(const value of dangling) errors.push(`${value}:DANGLING_OBJECT`)
  return {valid:errors.length===0,errors}
}
