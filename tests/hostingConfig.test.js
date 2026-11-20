import {describe,it,expect} from 'vitest'
import {hostingConfig} from '../scripts/hosting-config.mjs'
import {pageHref} from '../public/site-content.js'
import {readFileSync} from 'node:fs'
import {securityHeaders,metaContentSecurityPolicy} from '../scripts/security-headers.mjs'
import {hostingDrift,hostingFiles,metaPolicies,renderHeaderEntries,syncHosting,vercelHeaderEntries} from '../scripts/prepare-hosting.mjs'
describe('portable static hosting',()=>{
 it('retains existing Render URLs and requires a deliberate Cloudflare canonical origin',()=>{
  expect(hostingConfig({})).toEqual({origin:'https://kamin-12mf.onrender.com',documentUrls:'html'})
  expect(()=>hostingConfig({CF_PAGES:'1'})).toThrow('SITE_ORIGIN')
  expect(hostingConfig({CF_PAGES:'1',SITE_ORIGIN:'https://example.edu/'})).toEqual({origin:'https://example.edu',documentUrls:'clean'})
 })
 it('rejects origins that could corrupt metadata or cross the origin boundary',()=>{
  for(const origin of ['http://example.edu','https://user:secret@example.edu','https://example.edu/path','https://example.edu?q=1','https://example.edu#fragment'])expect(()=>hostingConfig({SITE_ORIGIN:origin})).toThrow()
  expect(()=>hostingConfig({SITE_URL_STYLE:'unknown'})).toThrow()
 })
 it('uses Cloudflare extensionless links without dropping language, query intent or anchors',()=>{
  expect(pageHref('/ar/guide.html?lang=ar#ar-query','en','clean')).toBe('/en/guide#ar-query')
  expect(pageHref('/en/index.html?view=knowledge','ar','clean')).toBe('/ar/?view=knowledge')
  expect(pageHref('/en/pdpl','ar','clean')).toBe('/ar/pdpl')
  expect(pageHref('guide.html','en','html')).toBe('/en/guide.html')
 })
})

// Task 16: the browser may only connect to the site itself. Every hosting config keeps
// connect-src 'self', so even a stray outside call is refused by the browser.
const connectSrc=csp=>{const m=/(?:^|;)\s*connect-src\s+([^;"]+)/.exec(csp);return m?m[1].trim():null}
describe('Content-Security-Policy keeps connect-src to the site itself',()=>{
 it('render.yaml',()=>{
  const yaml=readFileSync(new URL('../render.yaml',import.meta.url),'utf8')
  const policies=[...yaml.matchAll(/Content-Security-Policy[\s\S]*?value:\s*"([^"]+)"/g)].map(m=>m[1])
  expect(policies.length).toBeGreaterThan(0)
  for(const csp of policies)expect(connectSrc(csp)).toBe("'self'")
 })
 it('vercel.json',()=>{
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'))
  const policies=config.headers.flatMap(h=>h.headers).filter(h=>h.key==='Content-Security-Policy').map(h=>h.value)
  expect(policies.length).toBeGreaterThan(0)
  for(const csp of policies)expect(connectSrc(csp)).toBe("'self'")
 })
 it('the headers written into the built site (_headers and each page’s meta tag)',()=>{
  expect(connectSrc(securityHeaders['Content-Security-Policy'])).toBe("'self'")
 })
})

// Task 47: one Content-Security-Policy. vercel.json, render.yaml and index.html's meta tag are
// copies of scripts/security-headers.mjs; editing any one of them alone fails here and in the build.
describe('one Content-Security-Policy source (Task 47)',()=>{
 const files=Object.fromEntries(Object.entries(hostingFiles).map(([key,file])=>[key,readFileSync(new URL(`../${file}`,import.meta.url),'utf8')]))
 const csp=securityHeaders['Content-Security-Policy']
 const cspValues=entries=>entries.filter(h=>h.name==='Content-Security-Policy').map(h=>h.value)
 const scriptSrc=policy=>/(?:^|;)\s*script-src\s+([^;]+)/.exec(policy)[1]
 it('vercel.json, render.yaml and index.html carry exactly the policy of scripts/security-headers.mjs',()=>{
  expect(cspValues(vercelHeaderEntries(files.vercel))).toEqual([csp])
  expect(cspValues(renderHeaderEntries(files.render))).toEqual([csp])
  expect(metaPolicies(files.html)).toEqual([metaContentSecurityPolicy])
  expect(hostingDrift(files)).toEqual([])
 })
 it('the meta form is the same policy without frame-ancestors, which a meta tag cannot carry',()=>{
  expect(csp).toContain("frame-ancestors 'none'")
  expect(metaContentSecurityPolicy).toBe(csp.replace("; frame-ancestors 'none'",''))
 })
 it('no copy lets inline scripts run',()=>{
  for(const policy of [csp,metaContentSecurityPolicy,...cspValues(vercelHeaderEntries(files.vercel)),...cspValues(renderHeaderEntries(files.render))])expect(scriptSrc(policy)).not.toContain('unsafe-inline')
 })
 it('editing any one of the three copies alone is caught, and --sync puts it back',()=>{
  const loosen=text=>text.replace("script-src 'self'","script-src 'self' 'unsafe-inline'")
  for(const key of Object.keys(hostingFiles)){
   const changed={...files,[key]:loosen(files[key])}
   expect(changed[key],key).not.toBe(files[key])
   const drift=hostingDrift(changed)
   expect(drift,key).toHaveLength(1)
   expect(drift[0]).toContain(hostingFiles[key])
   const synced=syncHosting(changed)
   expect(hostingDrift(synced)).toEqual([])
   expect(synced[key]).toBe(files[key])
  }
 })
 it('--sync leaves the repository files byte for byte unchanged when nothing drifted',()=>{
  expect(syncHosting(files)).toEqual(files)
 })
 it('a missing or duplicated header in a copy is reported',()=>{
  const vercel=JSON.parse(files.vercel);vercel.headers[0].headers=vercel.headers[0].headers.filter(h=>h.key!=='X-Frame-Options')
  expect(hostingDrift({...files,vercel:JSON.stringify(vercel)})).toEqual(['vercel.json: expected one X-Frame-Options header for /(.*), found 0'])
  const html=files.html.replace(/(<meta\s+http-equiv="Content-Security-Policy"[^>]*>)/,'$1$1')
  expect(hostingDrift({...files,html})).toEqual(['index.html: expected one meta Content-Security-Policy, found 2'])
 })
})
