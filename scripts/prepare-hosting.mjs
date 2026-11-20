import {readFile,writeFile,readdir,stat} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {securityHeaders,metaContentSecurityPolicy} from './security-headers.mjs'
// Shared deployment output for Render static sites and Cloudflare Pages.
// Task 47: vercel.json, render.yaml and index.html's meta CSP must equal scripts/security-headers.mjs.
// The build fails when one of them drifts; `node scripts/prepare-hosting.mjs --sync` rewrites them.

export const hostingFiles={vercel:'vercel.json',render:'render.yaml',html:'index.html'}
const CSP='Content-Security-Policy'
const lf=text=>text.replace(/\r\n/g,'\n')
const keepEol=(original,text)=>original.includes('\r\n')?text.replace(/\r?\n/g,'\r\n'):text
const unquote=value=>/^".*"$/.test(value)?value.slice(1,-1):value
const metaPattern=/(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/g

// Every `- path / name / value` header entry in render.yaml.
export function renderHeaderEntries(yaml){
 return [...lf(yaml).matchAll(/^\s*- path:\s*(\S+)\s*\n\s*name:\s*(.+?)\s*\n\s*value:\s*(.+?)\s*$/gm)].map(([,path,name,value])=>({path,name,value:unquote(value)}))
}
// Every header entry in vercel.json, with the rule's source.
export const vercelHeaderEntries=json=>JSON.parse(json).headers.flatMap(rule=>rule.headers.map(({key,value})=>({path:rule.source,name:key,value})))
export const metaPolicies=html=>[...html.matchAll(metaPattern)].map(match=>match[2])

// One line per difference from scripts/security-headers.mjs; empty when all three files agree.
export function hostingDrift({vercel,render,html}){
 const drift=[]
 const check=(file,entries,globalPath)=>{
  for(const [name,value] of Object.entries(securityHeaders)){
   const found=entries.filter(entry=>entry.path===globalPath&&entry.name===name)
   if(found.length!==1)drift.push(`${file}: expected one ${name} header for ${globalPath}, found ${found.length}`)
   else if(found[0].value!==value)drift.push(`${file}: ${name} differs from scripts/security-headers.mjs`)
  }
  for(const entry of entries)if(entry.name===CSP&&entry.path!==globalPath)drift.push(`${file}: extra ${CSP} for ${entry.path}`)
 }
 check(hostingFiles.vercel,vercelHeaderEntries(vercel),'/(.*)')
 check(hostingFiles.render,renderHeaderEntries(render),'/*')
 const metas=metaPolicies(html)
 if(metas.length!==1)drift.push(`${hostingFiles.html}: expected one meta ${CSP}, found ${metas.length}`)
 else if(metas[0]!==metaContentSecurityPolicy)drift.push(`${hostingFiles.html}: meta ${CSP} differs from scripts/security-headers.mjs`)
 return drift
}

// Writes the values of scripts/security-headers.mjs into the three copies, keeping everything else.
export function syncHosting({vercel,render,html}){
 const config=JSON.parse(vercel)
 let global=config.headers.find(rule=>rule.source==='/(.*)')
 if(!global){global={source:'/(.*)',headers:[]};config.headers.unshift(global)}
 for(const [key,value] of Object.entries(securityHeaders)){
  const header=global.headers.find(entry=>entry.key===key)
  if(header)header.value=value;else global.headers.push({key,value})
 }
 let yaml=lf(render)
 for(const [name,value] of Object.entries(securityHeaders)){
  const line=`value: ${/[:'"#]/.test(value)?JSON.stringify(value):value}`
  const pattern=new RegExp(`(^\\s*- path: /\\*\\s*\\n\\s*name: ${name}\\s*\\n(\\s*))value:.*$`,'m')
  yaml=pattern.test(yaml)?yaml.replace(pattern,(_,head)=>head+line):yaml.replace(/\s*$/,`\n      - path: /*\n        name: ${name}\n        ${line}\n`)
 }
 return {
  vercel:keepEol(vercel,JSON.stringify(config,null,2)+'\n'),
  render:keepEol(render,yaml),
  html:html.replace(metaPattern,(_,start,__,end)=>start+metaContentSecurityPolicy+end)
 }
}

const read=async()=>Object.fromEntries(await Promise.all(Object.entries(hostingFiles).map(async([key,file])=>[key,await readFile(file,'utf8')])))

async function main(){
 if(process.argv.includes('--sync')){
  const before=await read(),after=syncHosting(before)
  for(const [key,file] of Object.entries(hostingFiles))if(after[key]!==before[key]){await writeFile(file,after[key]);console.log(`Updated ${file} from scripts/security-headers.mjs`)}
  return
 }
 const drift=hostingDrift(await read())
 if(drift.length)throw new Error(`Security headers drifted from scripts/security-headers.mjs:\n- ${drift.join('\n- ')}\nRun: node scripts/prepare-hosting.mjs --sync`)
 await writeFile('dist/_headers','/*\n'+Object.entries(securityHeaders).map(([k,v])=>`  ${k}: ${v}`).join('\n')+'\n')
 let count=0,largest=0
 async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const name=`${dir}/${entry.name}`;if(entry.isDirectory())await walk(name);else{const size=(await stat(name)).size;count++;largest=Math.max(largest,size);if(size>25*1024*1024)throw new Error(`Cloudflare Pages asset exceeds 25 MiB: ${name}`)}}}
 await walk('dist');if(count>20000)throw new Error('Cloudflare Pages free file-count limit exceeded')
 console.log(`Static-host compatibility: ${count} files; largest ${(largest/1024/1024).toFixed(1)} MiB. Security headers included and equal in vercel.json, render.yaml and index.html.`)
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main()
