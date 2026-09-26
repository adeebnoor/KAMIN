import { describe, expect, it } from 'vitest'
import { OccupationTaxonomyRegistry, normalizeCrosswalk } from '../src/taxonomy/occupationTaxonomy.js'
import { createExternalOccupationTaxonomy } from '../src/taxonomy/externalService.js'

describe('occupation taxonomy abstraction',()=>{
  it('requires lookup, crosswalk and search without embedding taxonomy logic',()=>{
    expect(()=>new OccupationTaxonomyRegistry().register('x',{lookup(){},search(){}})).toThrow(/CROSSWALK_REQUIRED/)
  })

  it('accepts only governed SKOS match relations',()=>{
    expect(normalizeCrosswalk({fromTaxonomy:'a',toTaxonomy:'b',fromCode:'1',toCode:'2',relation:'exactMatch'}).relation).toBe('exactMatch')
    expect(()=>normalizeCrosswalk({fromTaxonomy:'a',toTaxonomy:'b',fromCode:'1',toCode:'2',relation:'sameAs'})).toThrow('INVALID_SKOS_MATCH_RELATION')
  })

  it('keeps the implementation behind an external service contract',async()=>{
    const calls=[]
    const adapter=createExternalOccupationTaxonomy({
      taxonomyId:'private-taxonomy',
      endpoint:'/api/occupations',
      fetchImpl:async url=>{
        calls.push(url)
        return {ok:true,json:async()=>url.includes('action=search')?[{code:'X1'}]:{fromTaxonomy:'private-taxonomy',toTaxonomy:'esco',fromCode:'X1',toCode:'E1',relation:'closeMatch'}}
      },
    })
    const rows=await adapter.search('analyst')
    expect(rows[0].code).toBe('X1')
    const mapped=await adapter.crosswalk('private-taxonomy','esco','X1')
    expect(mapped.relation).toBe('closeMatch')
    expect(calls.join(' ')).not.toMatch(/classification|hierarchy|scoring/)
  })
})
