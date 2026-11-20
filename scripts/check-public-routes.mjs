import {readFile,readdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {parse} from 'parse5'
import {hostingConfig} from './hosting-config.mjs'
import {pageHref} from '../public/site-content.js'
import {COURSE_EVIDENCE_PRINCIPLE} from '../src/content/trustCopy.js'
const {origin,documentUrls}=hostingConfig()
const nodes=n=>[n,...(n.childNodes||[]).flatMap(nodes)]
const attrs=n=>Object.fromEntries((n.attrs||[]).map(a=>[a.name,a.value]))
let checked=0
for(const lang of ['ar','en'])for(const file of(await readdir(`dist/${lang}`)).filter(f=>f.endsWith('.html'))){
 const tree=nodes(parse(await readFile(`dist/${lang}/${file}`,'utf8')))
 const links=tree.filter(n=>n.tagName==='link').map(attrs)
 const expected=origin+pageHref(file,lang,documentUrls)
 assert.equal(links.find(a=>a.rel==='canonical')?.href,expected,`${lang}/${file} canonical`)
 for(const [locale,code]of [['ar','ar-SA'],['en','en']])assert.equal(links.find(a=>a.hreflang===code)?.href,origin+pageHref(file,locale,documentUrls),`${lang}/${file} hreflang`)
 for(const a of tree.filter(n=>n.tagName==='a').map(attrs)){
  if(!a.href||a.href.startsWith('#'))continue
  const url=new URL(a.href,expected)
  if(url.origin!==origin)continue
  assert(!url.searchParams.has('lang'),`${file}: legacy language query in ${a.href}`)
  if(documentUrls==='clean')assert(!url.pathname.endsWith('.html'),`${file}: HTML link on clean host: ${a.href}`)
 }
 // Task 03: the methodology page states that a course grade is a clue, not a guarantee.
 if(file==='methodology.html'){
  const shown=tree.filter(n=>attrs(n)['data-course-evidence-principle']!==undefined).map(n=>nodes(n).filter(x=>x.nodeName==='#text').map(x=>x.value).join(''))
  assert(shown.includes(COURSE_EVIDENCE_PRINCIPLE[lang]),`${lang}/methodology.html must show the course-evidence principle`)
 }
 checked++
}
const robots=await readFile('dist/robots.txt','utf8'),sitemap=await readFile('dist/sitemap.xml','utf8')
assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`))
for(const [,url]of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)){
 assert.equal(new URL(url).origin,origin)
 if(documentUrls==='clean')assert(!new URL(url).pathname.endsWith('.html'))
}
console.log(`Public routing verified: ${checked} localized pages, ${documentUrls} URLs, matching canonical/hreflang/sitemap/robots.`)
