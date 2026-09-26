export const KAMIN_ONTOLOGY_VERSION = '0.1.0'

export const NAMESPACES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  schema: 'https://schema.org/',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  prov: 'http://www.w3.org/ns/prov#',
  sh: 'http://www.w3.org/ns/shacl#',
  dpv: 'https://w3id.org/dpv#',
  vc: 'https://www.w3.org/2018/credentials#',
  esco: 'http://data.europa.eu/esco/',
  elm: 'http://data.europa.eu/snb/model/ontology/',
  ceterms: 'https://purl.org/ctdl/terms/',
  ctdl: 'https://purl.org/ctdl/terms/',
  ceasn: 'https://purl.org/ctdlasn/terms/',
  kamin: 'urn:kamin:',
}

/*
 * Kamin deliberately reuses established vocabularies instead of creating a
 * monolithic local ontology. Local terms exist only when an interoperable term
 * is unavailable or when Kamin needs a qualified, evidence-bearing relation.
 */
export const ONTOLOGY_STACK = {
  person: {
    standard: 'Schema.org',
    version: 'living',
    source: 'https://schema.org/Person',
    terms: ['schema:Person'],
    role: 'Canonical person identity and general person metadata',
  },
  learnerRecord: {
    standard: '1EdTech CLR',
    version: '2.0',
    source: 'https://www.1edtech.org/standards/clr',
    terms: ['ClrCredential','AchievementCredential','Achievement'],
    role: 'Learner-controlled, verifiable achievements and longitudinal learner record',
  },
  openBadges: {
    standard: '1EdTech Open Badges',
    version: '3.0',
    source: 'https://www.1edtech.org/standards/open-badges',
    terms: ['AchievementCredential','Achievement','Evidence'],
    role: 'Portable, verifiable learner achievements with issuer, criteria and evidence metadata',
  },
  verifiableCredentials: {
    standard: 'W3C Verifiable Credentials Data Model',
    version: '2.0 Recommendation',
    source: 'https://www.w3.org/TR/vc-data-model/',
    terms: ['vc:VerifiableCredential'],
    role: 'Tamper-evident, privacy-aware exchange of future verified claims',
  },
  learningModel: {
    standard: 'European Learning Model',
    version: '3.3',
    source: 'https://europass.europa.eu/en/qdr-european-learning-model',
    terms: ['elm:LearningOpportunity','elm:LearningAchievementSpecification','elm:LearningOutcome'],
    role: 'Interoperable learning opportunities, qualifications, outcomes, accreditations and credentials',
  },
  competency: {
    standard: '1EdTech CASE',
    version: '1.1',
    source: 'https://www.1edtech.org/standards/case',
    terms: ['CFDocument','CFItem','CFAssociation'],
    role: 'Learning outcomes, competencies, rubrics and framework associations',
  },
  skillsOccupations: {
    standard: 'ESCO',
    version: '1.2.1',
    source: 'https://esco.ec.europa.eu/en/use-esco/use-esco-services-api',
    terms: ['esco:skill','esco:occupation'],
    role: 'Multilingual skills and occupation concept URIs',
  },
  workforceModel: {
    standard: 'O*NET Content Model / RDF',
    version: '31.0',
    source: 'https://www.onetcenter.org/database.html',
    terms: ['Occupation','Element','WorkStyle','CareerInterest','WorkContext'],
    role: 'Occupation-linked interests, work styles, abilities, knowledge, work context and activities',
  },
  credentialsPathways: {
    standard: 'Credential Engine CTDL / CTDL-ASN',
    version: 'current',
    source: 'https://credentialengine.org/credential-transparency/ctdl/',
    terms: ['ceterms:Credential','ceasn:Competency','ceasn:CompetencyFramework'],
    role: 'Credentials, assessments, pathways, occupation alignment and competency frameworks',
  },
  classification: {
    standard: 'W3C SKOS',
    version: '2009 Recommendation',
    source: 'https://www.w3.org/TR/skos-reference',
    terms: ['skos:Concept','skos:ConceptScheme','skos:broader','skos:exactMatch','skos:closeMatch'],
    role: 'SASCED and other taxonomies, labels, hierarchy and crosswalks',
  },
  provenance: {
    standard: 'W3C PROV-O',
    version: '2013 Recommendation',
    source: 'https://www.w3.org/TR/prov-o/',
    terms: ['prov:Entity','prov:Activity','prov:Agent','prov:wasDerivedFrom','prov:wasGeneratedBy','prov:generatedAtTime'],
    role: 'Evidence lineage, extraction/assessment activities and accountable source agents',
  },
  graphValidation: {
    standard: 'W3C SHACL',
    version: '2017 Recommendation',
    source: 'https://www.w3.org/TR/shacl/',
    terms: ['sh:NodeShape','sh:PropertyShape'],
    role: 'Machine-validatable structural and provenance constraints for Kamin RDF graphs',
  },
  privacy: {
    standard: 'W3C Data Privacy Vocabularies and Controls CG — DPV',
    version: '2.0',
    source: 'https://www.w3.org/community/reports/dpvcg/CG-FINAL-dpv-20240801/',
    terms: ['dpv:Consent','dpv:ExplicitlyExpressedConsent','dpv:ConsentGiven','dpv:ConsentWithdrawn','dpv:Purpose'],
    role: 'Purpose-specific consent and consent lifecycle metadata',
  },
}

export const KAMIN_CLASSES = {
  Person: 'schema:Person',
  Course: 'schema:Course',
  Occupation: 'schema:Occupation',
  Credential: 'ceterms:Credential',
  Competency: 'ceasn:Competency',
  ClassificationConcept: 'skos:Concept',
  Evidence: 'prov:Entity',
  Activity: 'prov:Activity',
  Agent: 'prov:Agent',

  // Minimal Kamin extensions. These are qualified claim structures rather than
  // replacements for external concepts.
  Claim: 'kamin:Claim',
  Observation: 'kamin:Observation',
  Goal: 'kamin:Goal',
  Constraint: 'kamin:Constraint',
  FitAssessment: 'kamin:FitAssessment',
  FitMechanism: 'kamin:FitMechanism',
  Outcome: 'kamin:Outcome',
}

export const KAMIN_RELATIONS = {
  hasClaim: 'kamin:hasClaim',
  subject: 'kamin:subject',
  predicate: 'kamin:predicate',
  object: 'kamin:object',
  value: 'kamin:value',
  scale: 'kamin:scale',
  evidenceStrength: 'kamin:evidenceStrength',
  confidenceStatus: 'kamin:confidenceStatus',
  sourceType: 'kamin:sourceType',
  instrument: 'kamin:instrument',
  instrumentVersion: 'kamin:instrumentVersion',
  consentPurpose: 'kamin:consentPurpose',
  validFrom: 'kamin:validFrom',
  validUntil: 'kamin:validUntil',
  mechanism: 'kamin:mechanism',
  fitTarget: 'kamin:fitTarget',
  outcomeStatus: 'kamin:outcomeStatus',
}

export const JSON_LD_CONTEXT = {
  '@version': 1.1,
  ...NAMESPACES,
  Person: 'schema:Person',
  Course: 'schema:Course',
  Occupation: 'schema:Occupation',
  Credential: 'ceterms:Credential',
  Competency: 'ceasn:Competency',
  Claim: 'kamin:Claim',
  Observation: 'kamin:Observation',
  Evidence: 'prov:Entity',
  source: {'@id':'prov:wasDerivedFrom','@type':'@id'},
  generatedBy: {'@id':'prov:wasGeneratedBy','@type':'@id'},
  generatedAtTime: {'@id':'prov:generatedAtTime','@type':'xsd:dateTime'},
  concept: {'@id':'kamin:object','@type':'@id'},
  subject: {'@id':'kamin:subject','@type':'@id'},
  consentPurpose: {'@id':'kamin:consentPurpose','@type':'@id'},
}

export const EXTERNAL_ID_POLICY = {
  person: 'Kamin-local opaque ID; never use university/student identifiers as public graph IDs',
  skill: 'Prefer ESCO URI; allow O*NET/CASE/CTDL competency IDs as aligned concepts',
  occupation: 'Prefer explicit source URI (ESCO or O*NET-SOC); keep crosswalk provenance',
  learningOutcome: 'Prefer CASE GUID when institution publishes one',
  credential: 'Prefer CLR/Open Badge/CTDL identifier when available',
  sasced: 'Represent SASCED code as a SKOS concept in the Kamin-managed concept scheme',
}

export function expandTerm(term){
  if(typeof term!=='string') return term
  const [prefix,...rest]=term.split(':')
  if(!rest.length || !NAMESPACES[prefix]) return term
  return NAMESPACES[prefix]+rest.join(':')
}
