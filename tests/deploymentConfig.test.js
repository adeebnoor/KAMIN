import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('deployment performance configuration',()=>{
  const blueprint=readFileSync(new URL('../render.yaml',import.meta.url),'utf8')
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8')
  const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'))

  it('declares the manifest media type in both HTML and Render headers',()=>{
    expect(html).toMatch(/rel="manifest"[^>]+type="application\/manifest\+json"/)
    expect(blueprint).toContain('path: /manifest.json')
    expect(blueprint).toContain('application/manifest+json; charset=utf-8')
  })

  it('uses immutable one-year caching for hashed assets and OCR runtime',()=>{
    expect(blueprint).toMatch(/path: \/assets\/\*[\s\S]*?max-age=31536000, immutable/)
    expect(blueprint).toMatch(/path: \/ocr\/\*[\s\S]*?max-age=31536000, immutable/)
  })

  it('keeps the service worker uncached so deployments can take control promptly',()=>{
    expect(blueprint).toMatch(/path: \/sw\.js[\s\S]*?no-cache, no-store, must-revalidate/)
  })

  it('declares consent-UI security headers for both deployment targets',()=>{
    for(const required of ['Content-Security-Policy','X-Frame-Options','Referrer-Policy','X-Content-Type-Options']){
      expect(blueprint).toContain(`name: ${required}`)
    }
    const globalRule=vercel.headers.find(rule=>rule.source==='/(.*)')
    const names=new Set(globalRule.headers.map(header=>header.key))
    expect([...names]).toEqual(expect.arrayContaining(['Content-Security-Policy','X-Frame-Options','Referrer-Policy','X-Content-Type-Options']))
  })

  it('configures Vercel as an always-on static CDN fallback with immutable hashed assets',()=>{
    expect(vercel.buildCommand).toBe('npm run build')
    expect(vercel.outputDirectory).toBe('dist')
    const assets=vercel.headers.find(rule=>rule.source==='/assets/(.*)')
    expect(assets.headers.some(header=>header.key==='Cache-Control'&&header.value.includes('max-age=31536000')&&header.value.includes('immutable'))).toBe(true)
  })

})

// Task 47: the site students open is built from exactly the versions CI tested, on the same runner image.
describe('every install uses the lockfile, the same runner and no pasted branch names (Task 47)',()=>{
  const dir=new URL('../.github/workflows/',import.meta.url)
  const workflows=readdirSync(dir).filter(name=>/\.ya?ml$/.test(name)).map(name=>({name,text:readFileSync(new URL(name,dir),'utf8').replace(/\r\n/g,'\n')}))
  const blueprint=readFileSync(new URL('../render.yaml',import.meta.url),'utf8').replace(/\r\n/g,'\n')
  const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'))
  const install='npm ci --no-audit --no-fund'
  // The shell text of every `run:` step, inline or as a | / > block.
  const runScripts=text=>{
    const lines=text.split('\n'),scripts=[]
    for(let i=0;i<lines.length;i++){
      const match=/^(\s*)(- )?run:\s*(.*)$/.exec(lines[i]);if(!match)continue
      const keyIndent=match[1].length+(match[2]?2:0)
      if(!/^[|>]/.test(match[3])){scripts.push(match[3]);continue}
      const body=[];while(i+1<lines.length&&(lines[i+1].trim()===''||lines[i+1].search(/\S/)>keyIndent))body.push(lines[++i])
      scripts.push(body.join('\n'))
    }
    return scripts
  }

  it('checks all three workflows',()=>{
    expect(workflows.map(w=>w.name)).toEqual(expect.arrayContaining(['ci.yml','pages.yml','visual-baselines.yml']))
  })

  it('no workflow, render.yaml or vercel.json runs npm install; each installs with npm ci',()=>{
    for(const {name,text} of [...workflows,{name:'render.yaml',text:blueprint},{name:'vercel.json',text:JSON.stringify(vercel)}]){
      expect(text,name).not.toMatch(/\bnpm\s+(install|i|add)\b/)
      expect(text,name).toContain(install)
    }
    expect(blueprint).toMatch(new RegExp(`^\\s*buildCommand: ONNXRUNTIME_NODE_INSTALL=skip ${install} && npm run build$`,'m'))
    expect(vercel.installCommand).toBe(`ONNXRUNTIME_NODE_INSTALL=skip ${install}`)
  })

  it('every job runs on ubuntu-24.04, never ubuntu-latest',()=>{
    for(const {name,text} of workflows){
      const runners=[...text.matchAll(/^\s*runs-on:\s*(\S+)/gm)].map(m=>m[1])
      expect(runners.length,name).toBeGreaterThan(0)
      for(const runner of runners)expect(runner,name).toBe('ubuntu-24.04')
    }
  })

  it('skips the onnxruntime-node CUDA download with the documented variable, not an unknown .npmrc key',()=>{
    const npmrc=new URL('../.npmrc',import.meta.url)
    if(existsSync(npmrc))expect(readFileSync(npmrc,'utf8')).not.toMatch(/onnxruntime/)
    for(const {name,text} of workflows)expect(text,name).toMatch(/^env:\n(?:[ #].*\n)*?  ONNXRUNTIME_NODE_INSTALL: skip$/m)
  })

  it('no ${{ }} expression is pasted into a run: script (branch names reach the shell through env)',()=>{
    for(const {name,text} of workflows){
      const scripts=runScripts(text)
      expect(scripts.length,name).toBeGreaterThan(0)
      for(const script of scripts)expect(script,name).not.toContain('${{')
    }
    const baselines=workflows.find(w=>w.name==='visual-baselines.yml').text
    expect(runScripts(baselines).some(script=>script.includes('git push origin "HEAD:$REF_NAME"'))).toBe(true)
    expect(baselines).toContain('REF_NAME: ${{ github.ref_name }}')
  })

  it('visual-baselines.yml has the quality gate timeout of 30 minutes',()=>{
    const baselines=workflows.find(w=>w.name==='visual-baselines.yml').text
    expect([...baselines.matchAll(/timeout-minutes:\s*(\d+)/g)].map(m=>Number(m[1]))).toEqual([30])
  })
})
