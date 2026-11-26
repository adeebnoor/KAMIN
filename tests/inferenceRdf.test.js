import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import jsonld from 'jsonld'
import { demoCourses } from '../src/data.js'
import { inferSkills } from '../src/utils/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { JSON_LD_CONTEXT } from '../src/ontology/registry.js'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'
import { buildInferenceDataset } from '../src/ontology/rdf.js'
import { INFERENCE_VERSION, inferRelations } from '../src/matching/inference.js'

function sample({courses=demoCourses,interest='investigative',goal='data'}={}) {
  const graph=projectStateToPerson360({state:{courses,goal,insight:{declaredPreferences:interest?{careerInterest:interest}:{}}},skills:inferSkills(courses)})
  return {graph,match:judge(graph)}
}
const judge=(graph,id='job-data-analyst')=>matchTargets(buildMatchingProfile({graph}),{lang:'en'}).find(m=>m.id===id)
const toRdf=document=>jsonld.toRDF(document,{format:'application/n-quads'})

describe('Semantic inference and standards-based RDF export',()=>{
  it('preserves profile claims, IRIs, multilingual labels and provenance in a standard RDF processor',async()=>{
    const {graph}=sample()
    const rdf=await toRdf(graph)
    for(const claim of graph.claims){
      expect(rdf).toContain(`<${claim['@id']}> <urn:kamin:predicate> <${claim.predicate.replace('kamin:','urn:kamin:')}>`)
      expect(rdf).toContain(`<${claim['@id']}> <urn:kamin:object> <${claim.object}>`)
      expect(rdf).toContain(`<${claim['@id']}> <http://www.w3.org/ns/prov#wasDerivedFrom> <${claim.source}>`)
    }
    expect(rdf).toContain('"قواعد البيانات"@ar')
    expect(rdf).toContain('"Databases"@en')
    expect(JSON.parse(readFileSync('public/ontology/kamin-context.jsonld','utf8'))['@context']).toEqual(JSON_LD_CONTEXT)
  })
  it('exports inferred statements in a separate named graph with rule and premise provenance',async()=>{
    const {graph,match}=sample()
    const before=JSON.stringify(graph)
    const rdf=await toRdf(buildInferenceDataset(graph,match))
    expect(rdf).toContain('<urn:kamin:person:local> <urn:kamin:hasPreferenceContextFor> <urn:kamin:target:job-data-analyst> <urn:kamin:graph:inferred>')
    expect(rdf).toContain('<urn:kamin:person:local> <urn:kamin:hasCapabilityEvidenceFor> <urn:kamin:target:job-data-analyst> <urn:kamin:graph:inferred>')
    expect(rdf).toContain(`<urn:kamin:rule:${INFERENCE_VERSION}:R3>`)
    expect(rdf).toContain('<http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate> <urn:kamin:prefers:careerInterest>')
    expect(JSON.stringify(graph)).toBe(before)
  })
  it('retracts a preference conclusion when the declaration changes without altering capability conclusions',()=>{
    const initial=sample().match
    const changed=sample({interest:'social'}).match
    expect(initial.inferences.some(r=>r.ruleId==='R3')).toBe(true)
    expect(changed.inferences.some(r=>r.ruleId==='R3')).toBe(false)
    expect(changed.inferences.filter(r=>r.ruleId==='R1')).toEqual(initial.inferences.filter(r=>r.ruleId==='R1'))
  })
  it('keeps self-declared alignment from satisfying missing academic requirements',async()=>{
    const {graph,match}=sample({courses:[]})
    expect(match.inferences.some(r=>r.ruleId==='R3')).toBe(true)
    expect(match.inferences.some(r=>r.ruleId==='R1')).toBe(false)
    expect(match.judgment).toBe('conditional')
    expect(match.missingSkills).toEqual(expect.arrayContaining(['database','statistics']))
    expect(await toRdf(buildInferenceDataset(graph,match))).not.toContain('<urn:kamin:hasCapabilityEvidenceFor>')
  })
  it('does not infer an evidence relationship from a dangling evidence reference',()=>{
    const {graph}=sample()
    graph.entities=graph.entities.filter(e=>e['@type']!=='Evidence')
    expect(judge(graph).inferences.some(r=>r.ruleId==='R1')).toBe(false)
  })
  it('does not equate a different concept IRI merely because its notation matches',()=>{
    const {graph}=sample()
    const original='urn:kamin:skill:database'
    graph.entities=graph.entities.map(e=>e['@id']===original?{...e,'@id':'urn:other:database'}:e)
    graph.claims=graph.claims.map(c=>c.object===original?{...c,object:'urn:other:database'}:c)
    expect(judge(graph).missingSkills).toContain('database')
  })
  it('ignores withdrawn and other-person claims and does not invent conclusions for an empty profile',()=>{
    const {graph}=sample()
    graph.claims=graph.claims.map(c=>({...c,status:'withdrawn'}))
    expect(judge(graph).inferences).toEqual([])
    graph.claims=graph.claims.map(c=>({...c,status:'active',subject:'urn:kamin:person:other'}))
    expect(judge(graph).inferences).toEqual([])
    expect(sample({courses:[],interest:null,goal:null}).match.inferences).toEqual([])
  })
  // Task 76: step 4 and My plan store a goal as a pathway id (e.g. job-data-analyst). R2's second premise used to get no
  // object for it ({"@id": null}); it now names the student's goal node. The four old directions keep their catalog edge.
  it('states both R2 premises for a pathway-id goal and keeps its evidence strength and scope',async()=>{
    const {graph,match}=sample({goal:'job-data-analyst'})
    const r2=match.inferences.find(r=>r.ruleId==='R2')
    expect(r2.premises).toEqual([
      {subject:'urn:kamin:person:local',predicate:'kamin:pursuesGoal',object:'urn:kamin:goal:job-data-analyst'},
      {subject:'urn:kamin:target:job-data-analyst',predicate:'kamin:supportsGoal',object:'urn:kamin:goal:job-data-analyst'},
    ])
    expect(r2.evidenceStrength).toBe('self-reported')
    expect(r2.scope).toBe('self-declared-context')
    const dataset=buildInferenceDataset(graph,match)
    expect(JSON.stringify(dataset)).not.toContain('"@id":null')
    const rdf=await toRdf(dataset)
    expect(rdf).toContain('<urn:kamin:person:local> <urn:kamin:hasGoalContextFor> <urn:kamin:target:job-data-analyst> <urn:kamin:graph:inferred>')
    expect(rdf).toContain('<http://www.w3.org/1999/02/22-rdf-syntax-ns#object> <urn:kamin:goal:job-data-analyst>')
  })
  it('gives no goal conclusion to another pathway when the goal is a pathway id',()=>{
    const {graph}=sample({goal:'job-data-analyst'})
    expect(judge(graph,'job-cyber-analyst').inferences.some(r=>r.ruleId==='R2')).toBe(false)
  })
  it('keeps the four old directions on their catalog goal edge',()=>{
    for(const goal of ['data','cyber','management','product']){
      const {graph}=sample({goal})
      for(const match of matchTargets(buildMatchingProfile({graph}),{lang:'en'})){
        for(const r2 of match.inferences.filter(r=>r.ruleId==='R2')) expect(r2.premises[1].object).toBe(`urn:kamin:goal:${goal}`)
      }
    }
    expect(sample({goal:'data'}).match.inferences.some(r=>r.ruleId==='R2')).toBe(true)
  })
  it('never exports a conclusion whose premise has no object',()=>{
    const path={kind:'goal-alignment',status:'supported',targetId:'job-x',personClaimId:'urn:c',personGoalId:'urn:kamin:goal:x',goal:'x',targetGoalId:null}
    expect(inferRelations('urn:kamin:person:local',[path])).toEqual([])
    expect(inferRelations('urn:kamin:person:local',[{...path,targetGoalId:'urn:kamin:goal:x'}])).toHaveLength(1)
  })
})
