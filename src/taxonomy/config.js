import { OccupationTaxonomyRegistry } from './occupationTaxonomy.js'
import { createExternalOccupationTaxonomy } from './externalService.js'

export const SSCO_ENABLED = String(import.meta.env.VITE_SSCO_ENABLED||'false').toLowerCase()==='true'
export const OCCUPATION_TAXONOMY_ENDPOINT = import.meta.env.VITE_OCCUPATION_TAXONOMY_ENDPOINT||''

export function createOccupationTaxonomyRegistry({fetchImpl=globalThis.fetch}={}){
  const registry=new OccupationTaxonomyRegistry()
  if(SSCO_ENABLED){
    if(!OCCUPATION_TAXONOMY_ENDPOINT) throw new Error('SSCO_PRIVATE_ENDPOINT_REQUIRED')
    registry.register('ssco',createExternalOccupationTaxonomy({
      taxonomyId:'ssco',
      endpoint:OCCUPATION_TAXONOMY_ENDPOINT,
      fetchImpl,
    }))
  }
  return registry
}

export async function searchOccupationTarget(query,{fallbackSearch=async()=>[],registry=null}={}){
  const activeRegistry=registry||createOccupationTaxonomyRegistry()
  if(SSCO_ENABLED && activeRegistry.has('ssco')){
    const local=await activeRegistry.search('ssco',query)
    if(local.length) return {source:'ssco',results:local}
  }
  return {source:'fallback',results:await fallbackSearch(query)}
}

export async function resolveOccupationCodes(target,{registry=null}={}){
  const codes={onet:null,esco:null,ssco:null,...(target?.occupationCodes||{})}
  if(!SSCO_ENABLED) return codes
  const activeRegistry=registry||createOccupationTaxonomyRegistry()
  const query=target?.title?.en||target?.title?.ar||target?.id||''
  const matches=await activeRegistry.search('ssco',query)
  const primary=matches[0]
  if(!primary?.code) return codes
  codes.ssco=String(primary.code)
  for(const taxonomy of ['esco','onet']){
    if(codes[taxonomy]) continue
    const mapped=await activeRegistry.crosswalk('ssco',taxonomy,codes.ssco)
    if(mapped?.toCode) codes[taxonomy]=mapped.toCode
  }
  return codes
}
