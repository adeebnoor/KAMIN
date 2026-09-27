import { describe, expect, it } from 'vitest'
import jsonld from 'jsonld'
import { DIGITAL_NOTICE, confirmDigitalInterest, emptyDigitalInterests, grantDigitalAnalysis, normalizeDigitalInterests, removeDigitalInterest, suggestDigitalInterests } from '../src/digitalInterests.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'
import { buildInferenceDataset } from '../src/ontology/rdf.js'
import { buildPortableProfile, normalizePortableState } from '../src/utils/portableProfile.js'

const text='PrivateMarker-DO-NOT-STORE: أحب تحليل البيانات وSQL وPython.'
const makeDigital=()=>{
  let digital=grantDigitalAnalysis()
  for(const suggestion of suggestDigitalInterests(text,digital)) digital=confirmDigitalInterest(digital,suggestion)
  return digital
}
const stateFor=digital=>({courses:[],approved:false,consents:{insight:true},insight:{digitalInterests:digital}})
const graphFor=digital=>projectStateToPerson360({state:stateFor(digital)})
const matchesFor=digital=>matchTargets(buildMatchingProfile({graph:graphFor(digital)}))

describe('voluntary digital interests',()=>{
  it('requires current, explicit, dated consent before any analysis',()=>{
    for(const consent of [null,emptyDigitalInterests(),{...grantDigitalAnalysis(),noticeVersion:'old'},{...grantDigitalAnalysis(),grantedAt:'invalid'}]){
      expect(()=>suggestDigitalInterests(text,consent)).toThrow('DIGITAL_CONSENT_REQUIRED')
    }
    expect(()=>suggestDigitalInterests('x'.repeat(4001),grantDigitalAnalysis())).toThrow('DIGITAL_TEXT_TOO_LONG')
  })
  it('recognizes normalized Arabic and full English tokens without personality judgments',()=>{
    const consent=grantDigitalAnalysis()
    expect(suggestDigitalInterests('أَهتم بِالأَمْن السِّيبراني و تَعَلُّم الآلة',consent).map(x=>x.topicId)).toEqual(['ai','cyber'])
    expect(suggestDigitalInterests('paid reaction figure',consent)).toEqual([])
    expect(suggestDigitalInterests('صحتي وديانتي وحسابي البنكي ومخالفاتي',consent)).toEqual([])
    expect(suggestDigitalInterests(text,consent).map(x=>x.topicId)).toEqual(['data','software'])
  })
  it('keeps suggestions out of state and stores only an allowlisted reviewed summary',()=>{
    const digital=makeDigital()
    const dirty={...digital,rawText:text,account:'private',confirmed:[...digital.confirmed,{...digital.confirmed[0],topicId:'health'},...digital.confirmed]}
    const clean=normalizeDigitalInterests(dirty)
    expect(clean.confirmed).toHaveLength(2)
    expect(JSON.stringify(clean)).not.toContain('PrivateMarker')
    expect(JSON.stringify(clean)).not.toContain('account')
    expect(clean.contextConsent).toBe(false)
    expect(normalizeDigitalInterests({...dirty,analysisConsent:false})).toEqual(emptyDigitalInterests())
  })
  it('requires a second purpose permission and never changes capability gaps, ranking or judgments',()=>{
    const digital=makeDigital()
    const baseline=matchesFor(emptyDigitalInterests())
    const summaries=items=>items.map(({id,judgment,missingSkills,hardGates})=>({id,judgment,missingSkills,hardGates}))
    expect(matchesFor(digital).flatMap(match=>match.inferences).some(rule=>rule.ruleId==='R4')).toBe(false)
    const enabled=matchesFor({...digital,contextConsent:true})
    expect(enabled.flatMap(match=>match.inferences).some(rule=>rule.ruleId==='R4')).toBe(true)
    expect(summaries(enabled)).toEqual(summaries(baseline))
    expect(buildMatchingProfile({graph:graphFor(digital)}).skills).toEqual([])
  })
  it('retracts derived connections when interest or either consent is removed',()=>{
    const digital={...makeDigital(),contextConsent:true}
    const withoutData=removeDigitalInterest(digital,'data')
    const dataMatch=matchesFor(withoutData).find(match=>match.id==='job-data-analyst')
    expect(dataMatch.inferences.some(rule=>rule.ruleId==='R4')).toBe(false)
    expect(matchesFor({...digital,analysisConsent:false}).flatMap(match=>match.inferences)).toEqual([])
    expect(matchesFor({...digital,contextConsent:false}).flatMap(match=>match.inferences)).toEqual([])
    const state=stateFor(digital);state.consents.insight=false
    expect(projectStateToPerson360({state}).claims).toEqual([])
  })
  it('ignores unreviewed claims, foreign subjects and missing or withdrawn consent/evidence',()=>{
    const graph=graphFor({...makeDigital(),contextConsent:true})
    const mutations=[
      g=>g.claims.forEach(c=>c.status='pending'),
      g=>g.claims.forEach(c=>c.subject='urn:kamin:person:other'),
      g=>g.claims.forEach(c=>c.metadata.reviewStatus='suggested'),
      g=>g.entities.splice(0,g.entities.length,...g.entities.filter(e=>e['@type']!=='Evidence')),
      g=>g.entities.filter(e=>e['@type']==='kamin:Consent').forEach(e=>e.status='withdrawn'),
    ]
    for(const mutate of mutations){
      const copy=structuredClone(graph);mutate(copy)
      expect(matchTargets(buildMatchingProfile({graph:copy})).flatMap(match=>match.inferences)).toEqual([])
    }
  })
  it('exports traceable RDF and encrypted-backup payloads without original posts',async()=>{
    const digital={...makeDigital(),contextConsent:true}
    const graph=graphFor(digital)
    const match=matchesFor(digital).find(item=>item.id==='job-data-analyst')
    const dataset=buildInferenceDataset(graph,match)
    const nquads=await jsonld.toRDF(dataset,{format:'application/n-quads'})
    expect(nquads).toContain('<urn:kamin:hasInterestContextFor>')
    expect(nquads).toContain('<urn:kamin:topic:data>')
    expect(nquads).toContain(DIGITAL_NOTICE)
    expect(nquads).not.toContain('PrivateMarker')
    const payload=buildPortableProfile({state:stateFor(digital),person360:graph})
    expect(JSON.stringify(payload)).not.toContain('PrivateMarker')
    expect(normalizePortableState(payload).insight.digitalInterests).toEqual(digital)
    payload.state.insight.digitalInterests.originalText=text
    expect(JSON.stringify(normalizePortableState(payload))).not.toContain('PrivateMarker')
  })
})
