export const KAMIN_ONTOLOGY_VERSION = '0.2.0'

export const NAMESPACES = Object.freeze({
  rdf:'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs:'http://www.w3.org/2000/01/rdf-schema#',
  xsd:'http://www.w3.org/2001/XMLSchema#',
  schema:'https://schema.org/',
  skos:'http://www.w3.org/2004/02/skos/core#',
  prov:'http://www.w3.org/ns/prov#',
  dpv:'https://w3id.org/dpv#',
  vc:'https://www.w3.org/2018/credentials#',
  clr:'https://purl.imsglobal.org/spec/vc/clr/vocab.html#',
  esco:'http://data.europa.eu/esco/',
  ctdl:'https://purl.org/ctdl/terms/',
  ceasn:'https://purl.org/ctdlasn/terms/',
  kamin:'urn:kamin:',
})

/*
 * Standards-first rule:
 * 1) reuse a stable external identifier/vocabulary where possible;
 * 2) map institution/local vocabularies to it with provenance;
 * 3) mint a Kamin term only when no reused term captures the meaning cleanly.
 */
export const ONTOLOGY_STACK = Object.freeze({
  person:{
    standard:'Schema.org Person',
    version:'living vocabulary',
    source:'https://schema.org/Person',
    role:'Canonical person identity shell. Public graph identifiers must be opaque and non-institutional.',
    use:['schema:Person'],
  },
  learnerRecord:{
    standard:'1EdTech Comprehensive Learner Record (CLR)',
    version:'2.0',
    source:'https://www.1edtech.org/standards/clr',
    role:'Learner-controlled achievements, courses, skills, competencies, employment milestones and evidence-bearing assertions.',
    use:['CLR credential','achievement credential','achievement assertion'],
  },
  competencyExchange:{
    standard:'1EdTech CASE',
    version:'1.1',
    source:'https://standards.1edtech.org/case/',
    role:'Machine-referenceable learning outcomes, competencies, framework items, associations and rubrics. CASE is used as an exchange/data model with GUIDs, not treated as a Kamin RDF ontology namespace.',
    use:['CFDocument','CFItem','CFAssociation','CASE GUID'],
  },
  skillsOccupations:{
    standard:'ESCO',
    version:'1.2.1',
    source:'https://esco.ec.europa.eu/en/use-esco/use-esco-services-api',
    role:'Multilingual skills, competences and occupation concept URIs for education/job matching.',
    use:['skill concept URI','occupation concept URI','skill-occupation relations'],
  },
  workforceModel:{
    standard:'O*NET Content Model / RDF',
    version:'31.0',
    source:'https://www.onetcenter.org/database.html',
    role:'Occupation-linked career interests, work styles, skills, knowledge, abilities, activities and context.',
    use:['Occupation','Element','Career Interest','Work Style','Work Context'],
  },
  credentialsPathways:{
    standard:'Credential Engine CTDL / CTDL-ASN',
    version:'living schema; reviewed 2026-09-26',
    source:'https://credentialengine.org/credential-transparency/ctdl/',
    role:'Credentials, courses, learning opportunities, assessments, competencies, occupations and career/learning pathways as linked open data.',
    use:['ctdl:Credential','ctdl:Course','ceasn:Competency','ceasn:CompetencyFramework'],
  },
  classification:{
    standard:'W3C SKOS',
    version:'2009 Recommendation',
    source:'https://www.w3.org/TR/skos-reference/',
    role:'Controlled concept schemes, hierarchy and crosswalks. Use for SASCED and other national taxonomies.',
    use:['skos:Concept','skos:ConceptScheme','skos:broader','skos:exactMatch','skos:closeMatch'],
  },
  provenance:{
    standard:'W3C PROV-O',
    version:'2013 Recommendation',
    source:'https://www.w3.org/TR/prov-o/',
    role:'Evidence lineage, extraction/assessment activity, responsible source agent and timestamps.',
    use:['prov:Entity','prov:Activity','prov:Agent','prov:wasDerivedFrom','prov:wasGeneratedBy','prov:generatedAtTime'],
  },
  privacy:{
    standard:'W3C Data Privacy Vocabulary (DPV)',
    version:'2.0',
    source:'https://www.w3.org/community/reports/dpvcg/CG-FINAL-dpv-20240801/',
    role:'Purpose-specific processing, consent lifecycle and privacy metadata.',
    use:['dpv:Consent','dpv:Purpose','dpv:PersonalData','dpv:Processing'],
  },
  verifiableCredentials:{
    standard:'W3C Verifiable Credentials Data Model',
    version:'2.0',
    source:'https://www.w3.org/TR/vc-data-model/',
    role:'Machine-verifiable signed credentials/claims exchanged across issuers, holders and verifiers.',
    use:['vc:VerifiableCredential'],
  },
})

export const KAMIN_CLASSES = Object.freeze({
  Person:'schema:Person',
  Course:'schema:Course',
  Occupation:'schema:Occupation',
  Credential:'ctdl:Credential',
  Competency:'ceasn:Competency',
  ClassificationConcept:'skos:Concept',
  Evidence:'prov:Entity',
  Activity:'prov:Activity',
  Agent:'prov:Agent',
  Claim:'kamin:Claim',
  Observation:'kamin:Observation',
  Goal:'kamin:Goal',
  Constraint:'kamin:Constraint',
  FitAssessment:'kamin:FitAssessment',
  FitMechanism:'kamin:FitMechanism',
  Outcome:'kamin:Outcome',
})

export const KAMIN_RELATIONS = Object.freeze({
  hasClaim:'kamin:hasClaim',
  subject:'kamin:subject',
  predicate:'kamin:predicate',
  object:'kamin:object',
  value:'kamin:value',
  scale:'kamin:scale',
  evidenceStrength:'kamin:evidenceStrength',
  confidenceStatus:'kamin:confidenceStatus',
  sourceType:'kamin:sourceType',
  instrument:'kamin:instrument',
  instrumentVersion:'kamin:instrumentVersion',
  consentPurpose:'kamin:consentPurpose',
  validFrom:'kamin:validFrom',
  validUntil:'kamin:validUntil',
  mechanism:'kamin:mechanism',
  fitTarget:'kamin:fitTarget',
  outcomeStatus:'kamin:outcomeStatus',
})

export const JSON_LD_CONTEXT = Object.freeze({
  '@version':1.1,
  ...NAMESPACES,
  Person:'schema:Person',
  Course:'schema:Course',
  Occupation:'schema:Occupation',
  Credential:'ctdl:Credential',
  Competency:'ceasn:Competency',
  Claim:'kamin:Claim',
  Observation:'kamin:Observation',
  Evidence:'prov:Entity',
  source:{'@id':'prov:wasDerivedFrom','@type':'@id'},
  generatedBy:{'@id':'prov:wasGeneratedBy','@type':'@id'},
  generatedAtTime:{'@id':'prov:generatedAtTime','@type':'xsd:dateTime'},
  subject:{'@id':'kamin:subject','@type':'@id'},
  concept:{'@id':'kamin:object','@type':'@id'},
  consentPurpose:{'@id':'kamin:consentPurpose','@type':'@id'},
})

export const EXTERNAL_ID_POLICY = Object.freeze({
  person:'Use a Kamin-local opaque ID. Never use university/student identifiers as public graph IDs.',
  skill:'Prefer an ESCO URI. Keep O*NET, CASE or CTDL-ASN alignments as separately sourced mappings.',
  occupation:'Keep the source-native URI/code (ESCO or O*NET-SOC) and provenance for every crosswalk.',
  learningOutcome:'Prefer CASE GUID when the institution publishes one; otherwise mint a local opaque outcome ID and retain institutional source.',
  credential:'Prefer CLR/Open Badges/CTDL identifiers when supplied by an issuer.',
  sasced:'Represent SASCED codes as SKOS concepts in a Kamin-managed concept scheme; retain the official code and source document.',
})

export function expandTerm(term){
  if(typeof term!=='string') return term
  const split=term.indexOf(':')
  if(split<1) return term
  const prefix=term.slice(0,split)
  const local=term.slice(split+1)
  return NAMESPACES[prefix] ? NAMESPACES[prefix]+local : term
}
