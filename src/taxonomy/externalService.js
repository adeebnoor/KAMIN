import { assertOccupationTaxonomy, normalizeCrosswalk } from './occupationTaxonomy.js'

const asArray = value => Array.isArray(value) ? value : []

export function createExternalOccupationTaxonomy({taxonomyId,endpoint,fetchImpl=globalThis.fetch}={}){
  if(!taxonomyId) throw new Error('TAXONOMY_ID_REQUIRED')
  if(!endpoint) throw new Error('PRIVATE_TAXONOMY_ENDPOINT_REQUIRED')
  if(typeof fetchImpl!=='function') throw new Error('FETCH_REQUIRED')

  const request = async (action,params={}) => {
    const url=new URL(endpoint,globalThis.location?.origin||'http://localhost')
    url.searchParams.set('action',action)
    url.searchParams.set('taxonomy',taxonomyId)
    Object.entries(params).forEach(([key,value])=>{ if(value!==undefined && value!==null) url.searchParams.set(key,String(value)) })
    const response=await fetchImpl(url.toString(),{headers:{accept:'application/json'},credentials:'same-origin'})
    if(!response.ok) throw new Error('PRIVATE_TAXONOMY_SERVICE_FAILED')
    return response.json()
  }

  return assertOccupationTaxonomy({
    async lookup(code){ return request('lookup',{code}) },
    async search(query){ return asArray(await request('search',{query})) },
    async crosswalk(fromTaxonomy,toTaxonomy,code){
      const result=await request('crosswalk',{fromTaxonomy,toTaxonomy,code})
      return normalizeCrosswalk(result)
    },
  })
}
