import { describe, expect, it } from 'vitest'
import { OccupationTaxonomyRegistry, normalizeCrosswalk } from '../src/taxonomy/occupationTaxonomy.js'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const TAXONOMY_DIR = path.resolve(import.meta.dirname, '../src/taxonomy')

describe('occupation taxonomy abstraction',()=>{
  it('requires lookup, crosswalk and search without embedding taxonomy logic',()=>{
    expect(()=>new OccupationTaxonomyRegistry().register('x',{lookup(){},search(){}})).toThrow(/CROSSWALK_REQUIRED/)
  })

  it('accepts only governed SKOS match relations',()=>{
    expect(normalizeCrosswalk({fromTaxonomy:'a',toTaxonomy:'b',fromCode:'1',toCode:'2',relation:'exactMatch'}).relation).toBe('exactMatch')
    expect(()=>normalizeCrosswalk({fromTaxonomy:'a',toTaxonomy:'b',fromCode:'1',toCode:'2',relation:'sameAs'})).toThrow('INVALID_SKOS_MATCH_RELATION')
  })

  // Task 49: the external taxonomy service (src/taxonomy/externalService.js, config.js) is deleted.
  // This test used to drive that service with a fake fetch; it now drives the same contract through a
  // static, local adapter in the registry, and checks that nothing in src/taxonomy can call out.
  it('runs search and crosswalk through a static local adapter; no service and no fetch in src/taxonomy',async()=>{
    const calls=[]
    const local={
      async lookup(code){ calls.push(['lookup',code]); return code==='X1'?{code:'X1'}:null },
      async search(query){ calls.push(['search',query]); return query==='analyst'?[{code:'X1'}]:[] },
      async crosswalk(fromTaxonomy,toTaxonomy,code){ calls.push(['crosswalk',code]); return {fromTaxonomy,toTaxonomy,fromCode:code,toCode:'E1',relation:'closeMatch'} },
    }
    const registry=new OccupationTaxonomyRegistry().register('Local-Reference',local)
    expect(registry.has('local-reference')).toBe(true)
    const rows=await registry.search('local-reference','analyst')
    expect(rows[0].code).toBe('X1')
    expect(await registry.lookup('local-reference','X1')).toEqual({code:'X1'})
    const mapped=await registry.crosswalk('local-reference','esco','X1')
    expect(mapped).toEqual({fromTaxonomy:'local-reference',toTaxonomy:'esco',fromCode:'X1',toCode:'E1',relation:'closeMatch'})
    expect(JSON.stringify(calls)).not.toMatch(/classification|hierarchy|scoring/)
    expect(()=>registry.search('ssco','analyst')).toThrow('OCCUPATION_TAXONOMY_NOT_REGISTERED')

    expect(readdirSync(TAXONOMY_DIR).sort()).toEqual(['occupationTaxonomy.js'])
    const source=readFileSync(path.join(TAXONOMY_DIR,'occupationTaxonomy.js'),'utf8')
    expect(source).not.toMatch(/\bfetch\w*\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|import\.meta\.env|https?:\/\//)
  })
})
