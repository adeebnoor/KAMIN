import {pipeline,env} from '@huggingface/transformers'
import {EMBEDDING_MODEL as model} from './config.js'
import {rankSemanticCandidates} from './catalog.js'
let extractor=null,manifest=null,modelCache=null
const memory=new Map()
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('')
async function initialise(){
 const response=await fetch(model.root+'manifest.json',{credentials:'omit'})
 if(!response.ok)throw new Error('MODEL_DOWNLOAD_FAILED')
 manifest=await response.json()
 if(manifest.revision!==model.revision||manifest.version!==model.version||manifest.files.find(f=>f.path===model.filename)?.sha256!==model.sha256)throw new Error('MODEL_VERSION_MISMATCH')
 try{modelCache=await caches.open(model.cache)}catch{self.postMessage({status:'cache-unavailable'})}
 let loaded=0
 for(const file of manifest.files){
  for(const part of file.parts){
   if(!/^[a-zA-Z0-9_./-]+$/.test(part.path)||part.path.includes('..'))throw new Error('MODEL_VERSION_MISMATCH')
   const url=new URL(model.root+part.path,location.origin).href
   let cached=await modelCache?.match(url),bytes
   if(cached)bytes=new Uint8Array(await cached.arrayBuffer())
   if(!bytes||bytes.length!==part.bytes||await hash(bytes)!==part.sha256){
    const res=await fetch(url,{credentials:'omit',cache:'no-store'})
    if(!res.ok)throw new Error('MODEL_DOWNLOAD_FAILED')
    bytes=new Uint8Array(await res.arrayBuffer())
    if(bytes.length!==part.bytes||await hash(bytes)!==part.sha256)throw new Error('MODEL_INTEGRITY_FAILED')
    try{await modelCache?.put(url,new Response(bytes))}catch{modelCache=null;self.postMessage({status:'cache-unavailable'})}
   }
   memory.set(part.path,bytes);loaded+=bytes.length;self.postMessage({status:'loading',progress:Math.round(loaded/manifest.totalBytes*100)})
  }
 }
 env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath='/models/'
 env.useBrowserCache=false;env.useFSCache=false;env.useCustomCache=true
 env.useWasmCache=false;env.cacheKey=model.cache
 env.remoteHost=location.origin
 env.customCache={
  async match(request){
   const pathname=new URL(String(request),location.origin).pathname
   if(!pathname.startsWith(model.root))return undefined
   const file=manifest.files.find(f=>f.path===pathname.slice(model.root.length))
   if(!file)return undefined
   const bytes=new Uint8Array(file.bytes);let offset=0
   for(const part of file.parts){const data=memory.get(part.path);if(!data)throw new Error('MODEL_DOWNLOAD_FAILED');bytes.set(data,offset);offset+=data.length}
   if(await hash(bytes)!==file.sha256)throw new Error('MODEL_INTEGRITY_FAILED')
   return new Response(bytes,{headers:{'Content-Length':String(bytes.length),'Content-Type':file.path.endsWith('.json')?'application/json':'application/octet-stream'}})
  },async put(){},
 }
 env.backends.onnx.wasm.wasmPaths={wasm:location.origin+'/ai-runtime/ort-wasm-simd-threaded.wasm',mjs:location.origin+'/ai-runtime/ort-wasm-simd-threaded.mjs'}
 env.backends.onnx.wasm.numThreads=1
 env.backends.onnx.wasm.proxy=false
 extractor=await pipeline('feature-extraction','kamin-minilm-v1',{dtype:'q8',device:'wasm',local_files_only:true})
 memory.clear();self.postMessage({status:'ready'})
}
self.onmessage=async({data})=>{
 try{
  if(data.type==='dispose'){await extractor?.dispose();extractor=null;memory.clear();self.close();return}
  if(!extractor)await initialise()
  if(data.type==='query'){
   if(typeof data.text!=='string'||!data.text.trim()||data.text.length>300)throw new Error('INVALID_RECALL_INPUT')
   const tensor=await extractor(data.text.trim(),{pooling:'mean',normalize:true})
   self.postMessage({status:'result',results:rankSemanticCandidates(Array.from(tensor.data),manifest.index)})
  }
 }catch(error){
  await extractor?.dispose().catch(()=>{});extractor=null;memory.clear()
  self.postMessage({status:'error',code:/^(MODEL_|INVALID_)/.test(error.message)?error.message:'MODEL_UNAVAILABLE'})
 }
}
