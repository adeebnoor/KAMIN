import { JSON_LD_CONTEXT, KAMIN_ONTOLOGY_VERSION } from './ontology/registry.js'
import { PSYCHOMETRIC_REGISTRY_VERSION } from './psychometrics/registry.js'

const nowIso=()=>new Date().toISOString()
const safeId=value=>String(value||'').trim().replace(/[^a-zA-Z0-9._:-]+/g,'-')

export const PERSON360_DOMAINS = [
  'identity',
  'academic',
  'capability',
  'experience',
  'achievement',
  'interest',
  'personality',
  'values',
  'motivation',
  'workStyle',
  'goals',
  'preferences',
  'constraints',
  'outcomes',
]

export function emptyPerson360(){
  return {
    '@context':JSON_LD_CONTEXT,
    '@id':'urn:kamin:person:local',
    '@type':'Person',
    ontologyVersion:KAMIN_ONTOLOGY_VERSION,
    psychometricRegistryVersion:PSYCHOMETRIC_REGISTRY_VERSION,
    entities:[],
    claims:[],
    observations:[],
    goals:[],
    preferences:[],
    constraints:[],
    outcomes:[],
    updatedAt:null,
  }
}

export function createClaim({
  id,
  subject='urn:kamin:person:local',
  predicate,
  object=null,
  value=null,
  source,
  sourceType,
  generatedBy='urn:kamin:activity:manual',
  generatedAtTime=nowIso(),
  evidenceStrength='declared',
  consentPurpose=null,
  status='active',
  metadata={},
}){
  if(!predicate) throw new Error('CLAIM_PREDICATE_REQUIRED')
  if(!source) throw new Error('CLAIM_SOURCE_REQUIRED')
  const claimId=id||`urn:kamin:claim:${safeId(predicate)}:${Date.now()}`
  return {
    '@id':claimId,
    '@type':'Claim',
    subject,
    predicate,
    ...(object?{object}:{}),
    ...(value!==null?{value}:{}),
    source,
    sourceType:sourceType||'unspecified',
    generatedBy,
    generatedAtTime,
    evidenceStrength,
    ...(consentPurpose?{consentPurpose}:{}),
    status,
    metadata,
  }
}

export function createObservation({
  id,
  subject='urn:kamin:person:local',
  concept,
  value,
  scale,
  instrument,
  instrumentVersion,
  source,
  generatedAtTime=nowIso(),
  consentPurpose='urn:kamin:purpose:student-insight',
  status='self-reported',
  metadata={},
}){
  if(!concept) throw new Error('OBSERVATION_CONCEPT_REQUIRED')
  if(value===undefined || value===null) throw new Error('OBSERVATION_VALUE_REQUIRED')
  if(!instrument) throw new Error('OBSERVATION_INSTRUMENT_REQUIRED')
  if(!source) throw new Error('OBSERVATION_SOURCE_REQUIRED')
  return {
    '@id':id||`urn:kamin:observation:${safeId(instrument)}:${safeId(concept)}:${Date.now()}`,
    '@type':'Observation',
    subject,
    concept,
    value,
    scale:scale||null,
    instrument,
    instrumentVersion:instrumentVersion||'unknown',
    source,
    generatedAtTime,
    consentPurpose,
    status,
    metadata,
  }
}

export function addEntity(graph,entity){
  if(!entity?.['@id']) throw new Error('ENTITY_ID_REQUIRED')
  const entities=[...(graph.entities||[]).filter(item=>item['@id']!==entity['@id']),entity]
  return {...graph,entities,updatedAt:nowIso()}
}

export function addClaim(graph,claim){
  return {...graph,claims:[...(graph.claims||[]),claim],updatedAt:nowIso()}
}

export function addObservation(graph,observation){
  return {...graph,observations:[...(graph.observations||[]),observation],updatedAt:nowIso()}
}

export function validatePerson360(graph){
  const errors=[]
  const warnings=[]
  if(!graph || graph['@type']!=='Person') errors.push('ROOT_MUST_BE_PERSON')
  const entityIds=new Set((graph?.entities||[]).map(entity=>entity['@id']))
  for(const claim of graph?.claims||[]){
    if(!claim.predicate) errors.push(`CLAIM_MISSING_PREDICATE:${claim['@id']||'unknown'}`)
    if(!claim.source) errors.push(`CLAIM_MISSING_SOURCE:${claim['@id']||'unknown'}`)
    if(!claim.generatedAtTime) errors.push(`CLAIM_MISSING_TIME:${claim['@id']||'unknown'}`)
    if(claim.source && !entityIds.has(claim.source) && !/^https?:|^urn:/.test(claim.source)) warnings.push(`CLAIM_SOURCE_NOT_IRI:${claim['@id']||'unknown'}`)
  }
  for(const obs of graph?.observations||[]){
    if(!obs.concept) errors.push(`OBSERVATION_MISSING_CONCEPT:${obs['@id']||'unknown'}`)
    if(!obs.instrument) errors.push(`OBSERVATION_MISSING_INSTRUMENT:${obs['@id']||'unknown'}`)
    if(!obs.source) errors.push(`OBSERVATION_MISSING_SOURCE:${obs['@id']||'unknown'}`)
    if(!obs.consentPurpose) errors.push(`OBSERVATION_MISSING_CONSENT:${obs['@id']||'unknown'}`)
    if(obs.instrumentVersion==='unknown') warnings.push(`OBSERVATION_UNKNOWN_INSTRUMENT_VERSION:${obs['@id']||'unknown'}`)
  }
  return {valid:errors.length===0,errors,warnings}
}

export function serializePerson360(graph){
  const validation=validatePerson360(graph)
  if(!validation.valid){
    const error=new Error('PERSON360_INVALID')
    error.validation=validation
    throw error
  }
  return JSON.stringify(graph,null,2)
}

/*
 * A fit engine consumes the graph but never mutates it. Fit is use-case specific.
 * Academic/formal gates are evaluated before preferences or psychometrics.
 */
export const FIT_PIPELINE = [
  'formal-gates',
  'academic-evidence',
  'capability-evidence',
  'goal-alignment',
  'interest-alignment',
  'values-alignment',
  'work-style-alignment',
  'personality-context',
  'constraints',
  'mechanisms-of-fit',
  'outcome-validation',
]

export const SIMILARITY_POLICY = {
  principle:'Similarity is not suitability.',
  personPerson:['capability','interest','values','workStyle','goals'],
  personJob:['capability','experience','interest','values','workStyle','constraints'],
  personCourse:['prerequisites','capabilityGap','goal','interest','learningPreference'],
  personTraining:['capabilityGap','goal','learningPreference','time','cost'],
  weighting:'use-case-specific and evidence-calibrated; never equal by default',
}
