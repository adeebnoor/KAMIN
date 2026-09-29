import {writeFile,readdir,stat} from 'node:fs/promises'
import {securityHeaders} from './security-headers.mjs'
// Shared deployment output for Render static sites and Cloudflare Pages.
await writeFile('dist/_headers','/*\n'+Object.entries(securityHeaders).map(([k,v])=>`  ${k}: ${v}`).join('\n')+'\n')
let count=0,largest=0
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const name=`${dir}/${entry.name}`;if(entry.isDirectory())await walk(name);else{const size=(await stat(name)).size;count++;largest=Math.max(largest,size);if(size>25*1024*1024)throw new Error(`Cloudflare Pages asset exceeds 25 MiB: ${name}`)}}}
await walk('dist');if(count>20000)throw new Error('Cloudflare Pages free file-count limit exceeded')
console.log(`Static-host compatibility: ${count} files; largest ${(largest/1024/1024).toFixed(1)} MiB. Security headers included.`)
