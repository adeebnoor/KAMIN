import {mkdir,readFile,writeFile,copyFile,rm,stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'
import {EMBEDDING_MODEL as model} from '../src/semantic/config.js'
import {semanticCatalog} from '../src/semantic/catalog.js'
const root=path.resolve('.model-cache',model.revision),out=path.resolve('public'+model.root)
const digest=b=>createHash('sha256').update(b).digest('hex')
await mkdir(root,{recursive:true});await mkdir(out,{recursive:true})
const files=['config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json',model.filename,'README.md']
const manifest={version:model.version,model:model.id,revision:model.revision,license:'Apache-2.0',files:[],index:[],totalBytes:0}
for(const file of files){
 const target=path.join(root,file);await mkdir(path.dirname(target),{recursive:true})
 let bytes
 try{bytes=await readFile(target)}catch{
  const response=await fetch(`https://huggingface.co/${model.id}/resolve/${model.revision}/${file}`,{signal:AbortSignal.timeout(180000)})
  if(!response.ok)throw new Error(`Model asset download failed: ${file} (${response.status})`)
  bytes=Buffer.from(await response.arrayBuffer());await writeFile(target,bytes)
 }
 if(file===model.filename&&(bytes.length!==model.bytes||digest(bytes)!==model.sha256))throw new Error('Pinned embedding model hash mismatch')
 if(file==='README.md'){await writeFile(path.join(out,'MODEL_CARD.md'),bytes);continue}
 const pieces=[]
 // Cloudflare Pages permits 25 MiB per asset. Shards remain below 16 MiB;
 // the worker verifies and reassembles them locally before ONNX loads them.
 const chunk=16*1024*1024
 for(let offset=0;offset<bytes.length;offset+=chunk){
  const content=bytes.subarray(offset,Math.min(offset+chunk,bytes.length))
  const name=bytes.length>chunk?`${file}.part-${pieces.length}`:file
  await mkdir(path.dirname(path.join(out,name)),{recursive:true});await writeFile(path.join(out,name),content)
  pieces.push({path:name,bytes:content.length,sha256:digest(content)})
 }
 manifest.files.push({path:file,bytes:bytes.length,sha256:digest(bytes),parts:pieces});manifest.totalBytes+=bytes.length
}
const {pipeline,env}=await import('@huggingface/transformers')
env.allowRemoteModels=false;env.allowLocalModels=true;env.useFSCache=false
const cacheIndex=path.join(root,'catalog-index-v1.json')
const catalogHash=digest(JSON.stringify(semanticCatalog))
let cached
try{cached=JSON.parse(await readFile(cacheIndex,'utf8'))}catch{}
if(cached?.catalogHash===catalogHash&&cached?.runtimeVersion===env.version)manifest.index=cached.index
else{
 const extractor=await pipeline('feature-extraction',root+'/',{dtype:'q8',device:'cpu',local_files_only:true})
 try{for(const item of semanticCatalog){const tensor=await extractor(item.text,{pooling:'mean',normalize:true});manifest.index.push({id:item.id,lang:item.lang,vector:Array.from(tensor.data)})}}
 finally{await extractor.dispose()}
 await writeFile(cacheIndex,JSON.stringify({catalogHash,runtimeVersion:env.version,index:manifest.index}))
}
manifest.runtimeVersion=env.version
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest))
await writeFile(path.join(out,'TRANSFORMERS_LICENSE.txt'),await readFile('node_modules/@huggingface/transformers/LICENSE','utf8'))
await rm('public/ai-runtime',{recursive:true,force:true})
await mkdir('public/ai-runtime',{recursive:true})
for(const file of ['ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs']){
 if((await stat(`node_modules/onnxruntime-web/dist/${file}`)).size>25*1024*1024)throw new Error('WASM exceeds Cloudflare Pages per-file limit')
 await copyFile(`node_modules/onnxruntime-web/dist/${file}`,`public/ai-runtime/${file}`)
}
console.log(`Prepared pinned local multilingual embeddings: ${(manifest.totalBytes/1024/1024).toFixed(1)} MiB of model/tokenizer assets, ${manifest.index.length} reference vectors. No student inputs are used.`)
