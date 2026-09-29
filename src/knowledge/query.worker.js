import init, { Store, quad, defaultGraph } from 'oxigraph/web.js'
import wasmUrl from 'oxigraph/web_bg.wasm?url'
import { executeReadOnlyQuery } from './queryPolicy.js'
import { exportDataset } from './exports.js'

self.onmessage=async({data})=>{
  try{
    await init({module_or_path:wasmUrl})
    // Only local JSON-LD created by Kamin reaches this worker. No endpoint,
    // remote context loader, SERVICE handler or update API is exposed.
    self.postMessage({result:data.action==='export'?{text:exportDataset(Store,quad,defaultGraph,data.dataset,data.format),format:data.format}:executeReadOnlyQuery(Store,data.dataset,data.query)})
  }catch(error){
    const code=String(error?.message||'')
    self.postMessage({error:{code:/^(QUERY_|DATASET_)/.test(code)?code:'QUERY_FAILED',line:error?.line||null,column:error?.column||null,reason:error?.reason||null}})
  }
}
