import {describe,it,expect} from 'vitest'
import oxigraph from 'oxigraph'
import {resultsToCsv,exportDataset} from '../src/knowledge/exports.js'
import {buildWorkspaceDataset} from '../src/knowledge/workspace.js'
import {prepareReadOnlyQuery} from '../src/knowledge/queryPolicy.js'
import {buildCapabilitySnapshot,encryptSnapshot,decryptSnapshot,snapshotFragment,parseSnapshotFragment,validateSnapshot} from '../src/utils/capabilitySnapshot.js'
import {pageHref} from '../public/site-content.js'
import {rankSemanticCandidates} from '../src/semantic/catalog.js'
describe('SPARQL diagnostics and interoperability',()=>{
 it('reports line/column for malformed multiline syntax and EOF',()=>{
  for(const [q,line,column]of [['SELECT * WHERE {\n?s ?p\n}',3,1],['SELECT',1,7],['SELECT ?s WHERE {\n?s missing:p ?o\n}',2,4]]){
   try{prepareReadOnlyQuery(q);expect.fail('accepted invalid query')}catch(error){expect(error.message).toBe('QUERY_SYNTAX');expect(error.line).toBe(line);expect(error.column).toBe(column)}
  }
 })
 it('exports CSV quotes, unicode, nulls, ASK and formula protection',()=>{
  const csv=resultsToCsv({kind:'select',columns:['label','empty'],rows:[{label:{value:'بيانات, "SQL"\nنتيجة'}},{label:{value:'=HYPERLINK("https://bad.invalid")'}},{label:{value:'\t+1'}}]})
  expect(csv).toContain('"بيانات, ""SQL""\nنتيجة",""')
  expect(csv).toContain('"\'=HYPERLINK(');expect(csv).toContain('"\'\t+1"')
  expect(resultsToCsv({kind:'ask',value:false})).toBe('"boolean"\r\n"false"\r\n')
 })
 it('round-trips full TriG graphs and a nonempty Turtle union through an independent JSON-LD input',()=>{
  const data=buildWorkspaceDataset('demo'),source=new oxigraph.Store(),trigStore=new oxigraph.Store(),ttlStore=new oxigraph.Store()
  try{
   source.load(JSON.stringify(data),{format:'application/ld+json'})
   trigStore.load(exportDataset(oxigraph.Store,oxigraph.quad,oxigraph.defaultGraph,data,'trig'),{format:'application/trig'})
   ttlStore.load(exportDataset(oxigraph.Store,oxigraph.quad,oxigraph.defaultGraph,data,'turtle'),{format:'text/turtle'})
   expect(trigStore.size).toBe(source.size)
   expect(trigStore.match(null,null,null,oxigraph.namedNode('urn:kamin:graph:inferred')).length).toBeGreaterThan(0)
   expect(ttlStore.size).toBeGreaterThan(100)
   const union=new Set(source.match().map(q=>`${q.subject} ${q.predicate} ${q.object}`))
   expect(ttlStore.size).toBe(union.size)
   expect(ttlStore.match().every(q=>q.graph.termType==='DefaultGraph')).toBe(true)
  }finally{source.free();trigStore.free();ttlStore.free()}
 })
})
describe('minimal encrypted sharing',()=>{
 const snapshot=()=>buildCapabilitySnapshot({skillIds:['database'],goal:'data'})
 it('has an explicit allowlist and rejects full-profile/sensitive fields',()=>{
  const value=buildCapabilitySnapshot({skillIds:['database'],goal:'data',name:'DO NOT SHARE',courses:[{grade:100}],audit:['secret']})
  expect(Object.keys(value).sort()).toEqual(['capabilities','createdAt','format','goal','version'])
  expect(JSON.stringify(value)).not.toContain('DO NOT SHARE')
  expect(()=>validateSnapshot({...value,person360:{}})).toThrow()
  expect(()=>buildCapabilitySnapshot({skillIds:['not-in-catalog']})).toThrow()
  expect(()=>buildCapabilitySnapshot({skillIds:[]})).toThrow()
  expect(buildCapabilitySnapshot({skillIds:['ai-work']}).capabilities).toEqual(['ai-work'])
 })
 it('round-trips locally and puts key/payload in the fragment only',async()=>{
  const value=snapshot(),packet=await encryptSnapshot(value),hash=snapshotFragment(packet)
  const url=new URL('https://kamin.invalid/en/'+hash)
  expect(url.search).toBe('');expect(url.pathname).toBe('/en/')
  expect(hash).not.toContain('database')
  expect(await decryptSnapshot(parseSnapshotFragment(hash))).toEqual(value)
  const second=await encryptSnapshot(value);expect(second.payload).not.toBe(packet.payload);expect(second.key).not.toBe(packet.key)
 })
 it('rejects tampering, another key, unsupported schemas, truncation and oversized fragments',async()=>{
  const packet=await encryptSnapshot(snapshot()),other=await encryptSnapshot(snapshot())
  await expect(decryptSnapshot({...packet,key:other.key})).rejects.toThrow('SNAPSHOT_DECRYPT_FAILED')
  await expect(decryptSnapshot({...packet,payload:(packet.payload[0]==='A'?'B':'A')+packet.payload.slice(1)})).rejects.toThrow('SNAPSHOT_DECRYPT_FAILED')
  expect(parseSnapshotFragment('#payload=a&key=b')).toEqual({invalid:true})
  expect(parseSnapshotFragment('#payload='+'a'.repeat(12001))).toEqual({invalid:true})
  expect(parseSnapshotFragment('#semantic-inference')).toBeNull()
 })
})
describe('locale routes and recall boundaries',()=>{
 it('canonicalises old links without dropping query intent or anchors',()=>{
  expect(pageHref('guide.html?lang=ar#recovery','en')).toBe('/en/guide.html#recovery')
  expect(pageHref('/ar/?view=knowledge&lang=ar','en')).toBe('/en/?view=knowledge')
  expect(pageHref('?start=profile','ar')).toBe('/ar/?start=profile')
  expect(pageHref('/en/index.html','ar')).toBe('/ar/')
 })
 it('recalls only known IDs, collapses bilingual duplicates and abstains on unrelated vectors',()=>{
  const a=Array(384).fill(0);a[0]=1;const b=Array(384).fill(0);b[1]=1
  const index=[{id:'job-data-analyst',vector:a},{id:'job-data-analyst',vector:a},{id:'job-business-analyst',vector:b}]
  expect(rankSemanticCandidates(a,index).map(r=>r.id)).toEqual(['job-data-analyst'])
  expect(rankSemanticCandidates(a.map(n=>-n),index)).toEqual([])
  expect(()=>rankSemanticCandidates(a,[{id:'invented-job',vector:a}])).toThrow('INVALID_SEMANTIC_INDEX')
 })
})
