import { describe,it,expect } from 'vitest'
import oxigraph from 'oxigraph'
import { buildWorkspaceDataset, buildSyntheticGraph, QUERY_TEMPLATES, searchKnowledge } from '../src/knowledge/workspace.js'
import { executeReadOnlyQuery,prepareReadOnlyQuery } from '../src/knowledge/queryPolicy.js'
const run=(scope,query,options)=>executeReadOnlyQuery(oxigraph.Store,buildWorkspaceDataset(scope,options),query)
describe('local SPARQL workspace',()=>{
  it('keeps personal data out of the default reference graph even when supplied',()=>{
    const personalGraph=buildSyntheticGraph()
    const reference=buildWorkspaceDataset('reference',{personalGraph,allowPersonal:true})
    expect(JSON.stringify(reference)).not.toContain('urn:kamin:person:local')
    expect(reference['@graph'].map(g=>g['@id'])).toEqual(['urn:kamin:graph:reference'])
    expect(()=>buildWorkspaceDataset('personal',{personalGraph})).toThrow('PERSONAL_CONSENT_REQUIRED')
  })
  it('executes all templates over actual JSON-LD named graphs and preserves inputs',()=>{
    const personalGraph=buildSyntheticGraph(),before=JSON.stringify(personalGraph)
    for(const template of QUERY_TEMPLATES){
      expect(run('demo',template.query).rows.length).toBeGreaterThan(0)
      expect(run('personal',template.query,{personalGraph,allowPersonal:true}).rows.length).toBeGreaterThan(0)
    }
    expect(JSON.stringify(personalGraph)).toBe(before)
    expect(run('reference',QUERY_TEMPLATES.find(t=>t.id==='inferred').query).rows).toEqual([])
  })
  it('supports real SELECT aggregation, OPTIONAL, language filters and ASK',()=>{
    expect(run('reference','ASK {GRAPH <urn:kamin:graph:reference> {?s <urn:kamin:requiresCapability> ?o}}').value).toBe(true)
    expect(run('reference','ASK {<urn:missing> ?p ?o}').value).toBe(false)
    const result=run('reference','SELECT (COUNT(DISTINCT ?s) AS ?count) WHERE {?s <urn:kamin:requiresCapability> ?o OPTIONAL {?s <http://www.w3.org/2000/01/rdf-schema#label> ?l FILTER(LANG(?l)="ar")}}')
    expect(Number(result.rows[0].count.value)).toBeGreaterThan(0)
  })
  it('blocks updates, remote clauses and nested SERVICE at the syntax tree',()=>{
    for(const query of ['INSERT DATA {<urn:a> <urn:b> <urn:c>}','DELETE WHERE {?s ?p ?o}','LOAD <https://example.com>','CONSTRUCT {?s ?p ?o} WHERE {?s ?p ?o}','DESCRIBE <urn:a>']) expect(()=>prepareReadOnlyQuery(query)).toThrow('QUERY_READ_ONLY')
    for(const query of ['SELECT * FROM <urn:kamin:graph:reference> WHERE {?s ?p ?o}','ASK { SERVICE SILENT <https://example.com> {?s ?p ?o}}','SELECT * WHERE {{SELECT * WHERE { OPTIONAL { service ?endpoint { ?s ?p ?o } } }}}']) expect(()=>prepareReadOnlyQuery(query)).toThrow('QUERY_LOCAL_ONLY')
    expect(run('reference','SELECT ("SERVICE FROM DELETE" AS ?label) WHERE {}').rows[0].label.value).toBe('SERVICE FROM DELETE')
  })
  it('caps actual SELECT results while preserving explicit LIMIT zero',()=>{
    const result=run('demo','SELECT ?s ?p ?o WHERE {?s ?p ?o} LIMIT 999999')
    expect(result.rows).toHaveLength(100);expect(result.truncated).toBe(true)
    expect(run('demo','SELECT ?s WHERE {?s ?p ?o} LIMIT 0').rows).toEqual([])
  })
  it('handles malformed and oversized input with controlled errors',()=>{
    expect(()=>prepareReadOnlyQuery('')).toThrow('QUERY_EMPTY')
    expect(()=>prepareReadOnlyQuery('SELECT')).toThrow('QUERY_SYNTAX')
    expect(()=>prepareReadOnlyQuery('x'.repeat(6001))).toThrow('QUERY_TOO_LONG')
  })
  it('does not retain old personal or synthetic results in later reference queries',()=>{
    const query='ASK {GRAPH <urn:kamin:graph:inferred> {<urn:kamin:person:local> <urn:kamin:hasInterestContextFor> ?target}}'
    expect(run('demo',query).value).toBe(true)
    expect(run('reference',query).value).toBe(false)
  })
  it('searches both languages and filters interests independently from capabilities',()=>{
    expect(searchKnowledge('قواعد البيانات','skill').map(c=>c.id)).toContain('urn:kamin:skill:database')
    expect(searchKnowledge('data','interest').every(c=>c.kind==='interest')).toBe(true)
    expect(searchKnowledge('zz-unmatched')).toEqual([])
  })
})
