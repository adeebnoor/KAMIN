export const SKOS_MATCH_RELATIONS = Object.freeze(['exactMatch','closeMatch','broadMatch'])

const requireMethod = (adapter,name) => {
  if(typeof adapter?.[name]!=='function') throw new Error(`OCCUPATION_TAXONOMY_${name.toUpperCase()}_REQUIRED`)
}

export function assertOccupationTaxonomy(adapter){
  requireMethod(adapter,'lookup')
  requireMethod(adapter,'crosswalk')
  requireMethod(adapter,'search')
  return adapter
}

export function normalizeCrosswalk(result){
  if(!result) return null
  if(!SKOS_MATCH_RELATIONS.includes(result.relation)) throw new Error('INVALID_SKOS_MATCH_RELATION')
  if(!result.fromTaxonomy || !result.toTaxonomy || !result.fromCode || !result.toCode) throw new Error('INVALID_CROSSWALK_RESULT')
  return {
    fromTaxonomy:String(result.fromTaxonomy),
    toTaxonomy:String(result.toTaxonomy),
    fromCode:String(result.fromCode),
    toCode:String(result.toCode),
    relation:result.relation,
  }
}

export class OccupationTaxonomyRegistry {
  constructor(){ this.adapters=new Map() }
  register(id,adapter){
    if(!id) throw new Error('TAXONOMY_ID_REQUIRED')
    this.adapters.set(String(id).toLowerCase(),assertOccupationTaxonomy(adapter))
    return this
  }
  has(id){ return this.adapters.has(String(id).toLowerCase()) }
  get(id){
    const adapter=this.adapters.get(String(id).toLowerCase())
    if(!adapter) throw new Error('OCCUPATION_TAXONOMY_NOT_REGISTERED')
    return adapter
  }
  lookup(id,code){ return this.get(id).lookup(code) }
  search(id,query){ return this.get(id).search(query) }
  async crosswalk(fromTaxonomy,toTaxonomy,code){
    const result=await this.get(fromTaxonomy).crosswalk(fromTaxonomy,toTaxonomy,code)
    return normalizeCrosswalk(result)
  }
}
