import { describe, expect, it } from 'vitest'
import { ONTOLOGY_STACK, NAMESPACES, KAMIN_CLASSES, KAMIN_RELATIONS, expandTerm } from '../src/ontology/registry.js'
import { PSYCHOMETRIC_INSTRUMENTS, PSYCHOMETRIC_GOVERNANCE } from '../src/psychometrics/registry.js'
import { addClaim, addEntity, addObservation, createClaim, createObservation, emptyPerson360, SIMILARITY_POLICY, validatePerson360 } from '../src/person360.js'
import { DECLARED_PREFERENCE_SCHEMES, emptyInsightState, setDeclaredPreference } from '../src/insight.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'

describe('Kamin ontology stack', () => {
  it('reuses external standards rather than a monolithic local ontology', () => {
    expect(ONTOLOGY_STACK.competency.standard).toMatch(/CASE/)
    expect(ONTOLOGY_STACK.skillsOccupations.standard).toBe('ESCO')
    expect(ONTOLOGY_STACK.workforceModel.standard).toMatch(/O\*NET/)
    expect(ONTOLOGY_STACK.provenance.standard).toMatch(/PROV-O/)
    expect(ONTOLOGY_STACK.classification.standard).toMatch(/SKOS/)
    expect(ONTOLOGY_STACK.privacy.standard).toMatch(/DPV/)
  })

  it('pins canonical namespaces for external learning and credential vocabularies', () => {
    expect(NAMESPACES.ceterms).toBe('https://purl.org/ctdl/terms/')
    expect(NAMESPACES.ceasn).toBe('https://purl.org/ctdlasn/terms/')
    expect(NAMESPACES.elm).toBe('http://data.europa.eu/snb/model/ontology/')
    expect(NAMESPACES.vc).toBe('https://www.w3.org/2018/credentials#')
    expect(KAMIN_CLASSES.Credential).toBe('ceterms:Credential')
  })

  it('registers graph validation and verifiable learning standards explicitly', () => {
    expect(ONTOLOGY_STACK.learningModel.version).toBe('3.3')
    expect(ONTOLOGY_STACK.openBadges.version).toBe('3.0')
    expect(ONTOLOGY_STACK.verifiableCredentials.version).toMatch(/2\.0/)
    expect(ONTOLOGY_STACK.graphValidation.standard).toMatch(/SHACL/)
    expect(ONTOLOGY_STACK.privacy.standard).toMatch(/Community|CG/i)
  })

  it('keeps local extensions limited to qualified claims and matching concepts', () => {
    expect(KAMIN_CLASSES.Person).toBe('schema:Person')
    expect(KAMIN_CLASSES.Competency).toBe('ceasn:Competency')
    expect(KAMIN_CLASSES.Claim).toBe('kamin:Claim')
    expect(KAMIN_RELATIONS.instrument).toBe('kamin:instrument')
    expect(expandTerm('prov:Entity')).toBe('http://www.w3.org/ns/prov#Entity')
  })
})

describe('Person 360 provenance rules', () => {
  it('rejects a claim without a provenance source', () => {
    expect(()=>createClaim({predicate:'kamin:demonstrates',object:'urn:kamin:skill:test'})).toThrow('CLAIM_SOURCE_REQUIRED')
  })

  it('requires instrument, source and consent for psychometric observations', () => {
    expect(()=>createObservation({concept:'urn:kamin:trait:test',value:4,source:'urn:kamin:evidence:self'})).toThrow('OBSERVATION_INSTRUMENT_REQUIRED')
    const observation=createObservation({
      concept:'urn:kamin:trait:test',
      value:4,
      instrument:'ipip-50-arabic',
      instrumentVersion:'candidate-v1',
      source:'urn:kamin:evidence:self',
      consentPurpose:'urn:kamin:purpose:student-insight',
    })
    let graph=emptyPerson360()
    graph=addEntity(graph,{'@id':'urn:kamin:evidence:self','@type':'Evidence'})
    graph=addObservation(graph,observation)
    expect(validatePerson360(graph).valid).toBe(true)
  })

  it('keeps similarity distinct from suitability and disallows default equal weights', () => {
    expect(SIMILARITY_POLICY.principle).toMatch(/not suitability/i)
    expect(SIMILARITY_POLICY.weighting).toMatch(/never equal by default/i)
  })
})

describe('Psychometric governance', () => {
  it('registers standards-based instruments and no home-grown diagnostic instrument', () => {
    expect(PSYCHOMETRIC_INSTRUMENTS.onetMiniIp30.dimensions).toEqual(['Realistic','Investigative','Artistic','Social','Enterprising','Conventional'])
    expect(PSYCHOMETRIC_INSTRUMENTS.ipip50Arabic.items).toBe(50)
    expect(PSYCHOMETRIC_INSTRUMENTS.onetMiniIp30.productionUse).toBe(false)
    expect(PSYCHOMETRIC_INSTRUMENTS.ipip50Arabic.productionUse).toBe(false)
    expect(PSYCHOMETRIC_INSTRUMENTS.onetMiniIp30.decisionRole).toBe('none-until-saudi-validation')
    expect(PSYCHOMETRIC_INSTRUMENTS.ipip50Arabic.decisionRole).toBe('none-until-saudi-validation')
    expect(PSYCHOMETRIC_GOVERNANCE.rules.join(' ')).toMatch(/must not affect Fit judgments/i)
    expect(PSYCHOMETRIC_GOVERNANCE.rules.join(' ')).toMatch(/never assume equal weights/i)
    expect(PSYCHOMETRIC_GOVERNANCE.prohibitedLabels).toContain('diagnosis')
  })

  it('uses controlled preference vocabularies instead of free text for rule inputs', () => {
    let insight=emptyInsightState()
    insight=setDeclaredPreference(insight,'workStructure','balanced')
    expect(insight.declaredPreferences.workStructure).toBe('balanced')
    expect(DECLARED_PREFERENCE_SCHEMES.workStructure.options.map(x=>x.id)).toContain('structured')
    expect(()=>setDeclaredPreference(insight,'workStructure','anything-free-text')).toThrow('UNKNOWN_PREFERENCE_OPTION')
  })
})

describe('Person 360 projection', () => {
  it('projects academic evidence, SASCED context and declared preferences with provenance', () => {
    const state={
      courses:[{code:'CPIT-251',name:'Systems Analysis',grade:'A',source:'pdf'}],
      insight:setDeclaredPreference(emptyInsightState(),'collaboration','small-team'),
    }
    const skills=[{
      id:'requirements',
      labels:{ar:'تحليل المتطلبات',en:'Requirements Analysis'},
      confidenceLabel:'high',
      evidence:[{code:'CPIT-251',name:'Systems Analysis',grade:'A'}],
    }]
    const educationClassification={
      primary:{
        code:'061303',
        labels:{ar:'تقنية المعلومات',en:'Information Technology'},
        mappingSourceUrl:'https://example.edu/mapping',
      },
      coverage:1,
      isMixed:false,
    }
    const graph=projectStateToPerson360({state,skills,educationClassification})
    expect(validatePerson360(graph).valid).toBe(true)
    expect(graph.claims.some(claim=>claim.predicate==='kamin:studied')).toBe(true)
    expect(graph.claims.some(claim=>claim.predicate==='kamin:demonstrates')).toBe(true)
    expect(graph.claims.some(claim=>claim.predicate==='kamin:academicContext')).toBe(true)
    expect(graph.claims.some(claim=>claim.predicate==='kamin:prefers:collaboration')).toBe(true)
    const preferenceClaim=graph.claims.find(claim=>claim.predicate==='kamin:prefers:collaboration')
    expect(preferenceClaim.evidenceStrength).toBe('self-reported')
    expect(preferenceClaim.consentPurpose).toBe('urn:kamin:purpose:student-insight')
  })
})
