import init, { Store } from 'oxigraph/web.js'
import wasmUrl from 'oxigraph/web_bg.wasm?url'
import { executeReadOnlyQuery } from './queryPolicy.js'

self.onmessage=async({data})=>{
  try{
    await init({module_or_path:wasmUrl})
    // Only local JSON-LD created by Kamin reaches this worker. No endpoint,
    // remote context loader, SERVICE handler or update API is exposed.
    self.postMessage({result:executeReadOnlyQuery(Store,data.dataset,data.query)})
  }catch(error){
    const code=String(error?.message||'')
    self.postMessage({error:/^(QUERY_|DATASET_)/.test(code)?code:'QUERY_FAILED'})
  }
}
