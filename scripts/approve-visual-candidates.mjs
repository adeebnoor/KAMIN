#!/usr/bin/env node
// One-command review of CI visual candidates against the versioned baselines.
//
//   node scripts/approve-visual-candidates.mjs ~/Downloads/visual-desktop.zip ~/Downloads/visual-mobile.zip
//   node scripts/approve-visual-candidates.mjs ~/Downloads/visual-*.zip --approve privacy,trust
//   node scripts/approve-visual-candidates.mjs visual-candidates --approve all
//
// Without --approve it only reports which pages differ, so a human decides. CI never runs this.
import {createHash} from 'node:crypto'
import {mkdtempSync,readdirSync,readFileSync,statSync,copyFileSync,existsSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'

const args=process.argv.slice(2)
const approveIndex=args.indexOf('--approve')
const approve=approveIndex===-1?null:(args[approveIndex+1]||'').split(',').map(s=>s.trim()).filter(Boolean)
const inputs=args.filter((a,i)=>a!=='--approve'&&(approveIndex===-1||i!==approveIndex+1))
if(!inputs.length){console.error('Give the downloaded visual-desktop.zip / visual-mobile.zip files or an extracted visual-candidates directory.');process.exit(2)}

const baselines=path.resolve('e2e/visual-baselines')
const projects=['desktop-chromium','mobile-chromium']
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex')

// Collect candidate roots: {project -> directory containing ar/ and en/}
const roots={}
for(const input of inputs){
 const resolved=path.resolve(input)
 if(!existsSync(resolved)){console.error(`Not found: ${input}`);process.exit(2)}
 if(statSync(resolved).isFile()&&resolved.endsWith('.zip')){
  const project=/mobile/i.test(path.basename(resolved))?'mobile-chromium':'desktop-chromium'
  const out=mkdtempSync(path.join(tmpdir(),'kamin-visual-'))
  execFileSync('tar',['-xf',resolved,'-C',out],{stdio:'inherit'}) // bsdtar on Windows 10+, macOS and Linux reads zip
  roots[project]=out
 }else{
  for(const project of projects){
   const candidate=path.join(resolved,project)
   if(existsSync(candidate))roots[project]=candidate
  }
  if(existsSync(path.join(resolved,'ar'))&&existsSync(path.join(resolved,'en'))){
   const project=/mobile/i.test(resolved)?'mobile-chromium':'desktop-chromium';roots[project]=resolved
  }
 }
}
if(!Object.keys(roots).length){console.error('No candidate screenshots found in the given inputs.');process.exit(2)}

const rows=[];const changed=new Set()
for(const [project,root] of Object.entries(roots))for(const lang of ['ar','en']){
 const dir=path.join(root,lang);if(!existsSync(dir))continue
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.png')).sort()){
  const candidate=path.join(dir,file),baseline=path.join(baselines,project,lang,file)
  const status=!existsSync(baseline)?'new':hash(candidate)===hash(baseline)?'same':'differs'
  if(status!=='same')changed.add(file.replace('.png',''))
  rows.push({project,lang,page:file.replace('.png',''),status,candidate,baseline})
 }
}
const differing=rows.filter(r=>r.status!=='same')
console.log(`Compared ${rows.length} screenshots; ${differing.length} differ from the versioned baselines.`)
for(const r of differing)console.log(`  ${r.status.padEnd(7)} ${r.project}/${r.lang}/${r.page}`)
if(!approve){
 if(differing.length)console.log(`\nReview the candidates above, then rerun with --approve ${[...changed].join(',')} (or --approve all).`)
 process.exit(0)
}
const wanted=approve.includes('all')?changed:new Set(approve)
const unknown=[...wanted].filter(p=>!changed.has(p))
if(unknown.length){console.error(`These pages do not differ or were not found: ${unknown.join(', ')}`);process.exit(2)}
let copied=0
for(const r of differing)if(wanted.has(r.page)){mkdirSync(path.dirname(r.baseline),{recursive:true});copyFileSync(r.candidate,r.baseline);copied++;console.log(`approved ${r.project}/${r.lang}/${r.page}`)}
console.log(`\nApproved ${copied} baselines. Review them in git diff, then commit e2e/visual-baselines with a message naming the pages and why they changed.`)
