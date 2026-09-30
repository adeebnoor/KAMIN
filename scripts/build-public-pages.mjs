import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises'
import {parse,parseFragment,serialize} from 'parse5'
import {headerHtml,footerHtml,text,pageHref} from '../public/site-content.js'
import {pages,additions,extraFaq} from './public-page-content.mjs'
import {securityHeaders} from './security-headers.mjs'
import {hostingConfig} from './hosting-config.mjs'
const {origin,documentUrls}=hostingConfig()
const publicPath=(file,lang)=>pageHref(file,lang,documentUrls)
const documentFile=file=>file==='index.html'?'':documentUrls==='clean'?file.replace(/\.html$/,''):file
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
const attrs=n=>Object.fromEntries((n.attrs||[]).map(a=>[a.name,a.value]))
const set=(n,name,value)=>{n.attrs??=[];const a=n.attrs.find(a=>a.name===name);if(a)a.value=value;else n.attrs.push({name,value})}
const removeAttr=(n,name)=>{n.attrs=n.attrs?.filter(a=>a.name!==name)}
function all(n,pred){return [pred(n)?n:null,...(n.childNodes||[]).flatMap(c=>all(c,pred))].filter(Boolean)}
function remove(n){if(n.parentNode)n.parentNode.childNodes=n.parentNode.childNodes.filter(c=>c!==n)}
function append(n,html){const children=parseFragment(html).childNodes;for(const c of children)c.parentNode=n;n.childNodes.push(...children)}
function prepend(n,html){const children=parseFragment(html).childNodes;for(const c of children)c.parentNode=n;n.childNodes.unshift(...children)}
const getText=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(getText).join('')
const activeIn=(n,lang)=>{for(let p=n;p;p=p.parentNode){const l=attrs(p)['data-kamin-lang'];if(l&&l!==lang)return false}return true}
const plain=html=>getText(parseFragment(html)).trim().replace(/\s+/g,' ')
for(const [file,locales]of Object.entries(pages)){
 const sections=Object.entries(locales).map(([lang,[title,lead,body]])=>`<section data-kamin-lang="${lang}" ${lang==='en'?'hidden':''}><h1>${title}</h1><p class="k-doc-lead">${lead}</p>${body}</section>`).join('')
 await writeFile(`dist/${file}`,`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${locales.ar[0]} | كامن</title><script type="module" src="/static-i18n.js"></script></head><body class="k-document" data-title-ar="${escape(locales.ar[0])} | كامن" data-title-en="${escape(locales.en[0])} | Kamin" data-description-ar="${escape(locales.ar[1])}" data-description-en="${escape(locales.en[1])}"><main class="k-doc-main">${sections}</main></body></html>`)
}
const files=(await readdir('dist')).filter(f=>f.endsWith('.html'))
for(const file of files){
 const source=await readFile(`dist/${file}`,'utf8')
 for(const locale of [null,'ar','en']){
  const lang=locale||'ar',doc=parse(source,{scriptingEnabled:false}),html=all(doc,n=>n.tagName==='html')[0],head=all(doc,n=>n.tagName==='head')[0],body=all(doc,n=>n.tagName==='body')[0],home=file==='index.html'
  set(html,'lang',lang);set(html,'dir',lang==='ar'?'rtl':'ltr')
  set(html,'data-document-urls',documentUrls)
  for(const n of all(head,n=>n.tagName==='link'&&attrs(n).as==='font'))remove(n)
  append(head,`<link rel="preload" href="/fonts/${lang==='en'?'inter-latin':'noto-sans-arabic'}.woff2" as="font" type="font/woff2" crossorigin>`)
  if(!home){
   set(body,'class',[...new Set(`${attrs(body).class||''} k-document`.trim().split(/\s+/))].join(' '))
   set(body,'data-page',file.replace(/\.html$/,''))
   for(const n of all(head,n=>n.tagName==='link'&&['/fonts/noto-sans-arabic.css','/brand.css','/site-layout.css','/document-pages.css'].includes(attrs(n).href)))remove(n)
   prepend(head,'<link rel="stylesheet" href="/brand.css"><link rel="stylesheet" href="/site-layout.css"><link rel="stylesheet" href="/document-pages.css">')
   for(const n of all(body,n=>['header','footer'].includes(n.tagName)||attrs(n)['data-language-toggle']!==undefined||['topline','skip'].includes(attrs(n).class)))remove(n)
   let main=all(body,n=>n.tagName==='main')[0];set(main,'id','main');set(main,'tabindex','-1')
   for(const l of ['ar','en']){
    const blocks=all(main,n=>attrs(n)['data-kamin-lang']===l)
    const target=blocks.find(n=>all(n,x=>x.tagName==='h1').length)||blocks[0]
    if(additions[file]?.[l])append(target||main,additions[file][l])
    if(file==='faq.html')append(target||main,`<section><h2>${text(l,'الفريق والمساعدة والتجربة','Team, help and evaluation')}</h2>${extraFaq[l].map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>`)
   }
   prepend(body,`<a class="k-skip" href="#main">${text(lang,'تجاوز إلى المحتوى','Skip to content')}</a>${headerHtml(lang,file)}`);append(body,footerHtml(lang))
   for(const n of all(head,n=>n.tagName==='script'&&attrs(n).src==='/static-i18n.js'))set(n,'type','module')
   append(head,'<link rel="stylesheet" href="/semantic-tools.css">')
  }else{
   const skip=all(body,n=>n.tagName==='a'&&attrs(n).class==='skip-link')[0];if(skip){skip.childNodes=[];append(skip,text(lang,'تجاوز إلى المحتوى','Skip to content'))}
  }
  for(const n of all(body,n=>attrs(n)['data-kamin-lang'])){
   const l=attrs(n)['data-kamin-lang'];if(locale&&l!==lang){remove(n);continue}
   set(n,'lang',l);if(l!==lang){set(n,'hidden','');set(n,'aria-hidden','true');set(n,'inert','')}else{removeAttr(n,'hidden');removeAttr(n,'aria-hidden');removeAttr(n,'inert')}
  }
  const ba=attrs(body),title=home?text(lang,'كامن | اهتماماتك وقدراتك في شبكة واحدة','Kamin | Your interests and capabilities, connected'):ba[`data-title-${lang}`]||pages[file]?.[lang][0]||text(lang,'كامن','Kamin')
  const description=home?text(lang,'ابدأ باهتماماتك وهدفك، وافهم الروابط بين أدلتك وقدراتك ومساراتك. ملفك تحت سيطرتك.','Start with your interests and a goal. Understand the connections between evidence, capabilities and pathways in a profile you control.'):ba[`data-description-${lang}`]||plain(all(body,n=>n.tagName==='p'&&activeIn(n,lang)).slice(0,1).map(serialize).join('')).slice(0,170)||title
  const canonical=origin+publicPath(home?'':file,lang)
  for(const n of all(head,n=>n.tagName==='title'||(n.tagName==='meta'&&['description','twitter:card','twitter:title','twitter:description','twitter:image'].includes(attrs(n).name))||(n.tagName==='meta'&&(attrs(n).property?.startsWith('og:')||attrs(n)['http-equiv']==='Content-Security-Policy'))||(n.tagName==='link'&&['canonical','alternate'].includes(attrs(n).rel))||(n.tagName==='script'&&attrs(n).type==='application/ld+json')))remove(n)
  append(head,`<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta http-equiv="Content-Security-Policy" content="${escape(securityHeaders['Content-Security-Policy'].replace("; frame-ancestors 'none'",''))}"><link rel="stylesheet" href="/site-chrome.css"><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="ar-SA" href="${origin}/ar/${documentFile(file)}"><link rel="alternate" hreflang="en" href="${origin}/en/${documentFile(file)}"><link rel="alternate" hreflang="x-default" href="${origin}/${documentFile(file)}"><meta property="og:type" content="website"><meta property="og:url" content="${canonical}"><meta property="og:locale" content="${lang==='ar'?'ar_SA':'en_US'}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:image" content="${origin}/og-kamin-${lang}.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${origin}/og-kamin-${lang}.jpg">`)
  const ld=home?{'@type':'SoftwareApplication',name:text(lang,'كامن','Kamin'),applicationCategory:'EducationalApplication',operatingSystem:'Web',offers:{'@type':'Offer',price:'0',priceCurrency:'SAR'},creator:{'@type':'Person',name:'Adeeb Noor',url:'https://adeebnoor.github.io/'}}:file==='faq.html'?{'@type':'FAQPage',mainEntity:extraFaq[lang].map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}:{'@type':'WebPage',name:title}
  append(head,`<script id="${home?'kamin-ld':'page-ld'}" type="application/ld+json">${JSON.stringify({'@context':'https://schema.org',...ld,url:canonical,inLanguage:lang,description}).replaceAll('<','\\u003c')}</script>`)
  for(const link of all(body,n=>n.tagName==='a'&&attrs(n).href)){
   const raw=attrs(link).href;if(raw.startsWith('#'))continue
   const url=new URL(raw,`${origin}/${file}`)
   if(url.origin===origin&&(url.pathname==='/'||/^\/(ar|en)\/$/.test(url.pathname)||url.pathname.endsWith('.html')))set(link,'href',publicPath(url.pathname+url.search+url.hash,lang))
  }
  const destination=locale?`dist/${locale}/${file}`:`dist/${file}`;if(locale)await mkdir(`dist/${locale}`,{recursive:true});await writeFile(destination,serialize(doc))
 }
}
const urls=['ar','en'].flatMap(l=>files.filter(f=>!['404.html','admin.html','advisor.html'].includes(f)).map(f=>origin+publicPath(f,l)))
await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${url}</loc></url>`).join('')}</urlset>`)
await writeFile('dist/robots.txt',`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`)
console.log(`Built shared navigation and ${files.length*2} localized public pages.`)
