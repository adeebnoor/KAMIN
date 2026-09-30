import {headerHtml,footerHtml,languageLabel,pageHref} from './site-content.js'
const pathLang=location.pathname.match(/^\/(ar|en)(?:\/|$)/)?.[1]
const queryLang=new URLSearchParams(location.search).get('lang')
let stored;try{stored=localStorage.getItem('kamin-lang')}catch{}
const lang=pathLang||(['ar','en'].includes(queryLang)?queryLang:null)||(['ar','en'].includes(stored)?stored:'ar')
const apply=()=>{
 const canonicalPath=pageHref(location.pathname+location.search+location.hash,lang)
 if(location.pathname+location.search+location.hash!==canonicalPath){location.replace(canonicalPath);return}
 document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr'
 try{localStorage.setItem('kamin-lang',lang)}catch{}
 for(const node of document.querySelectorAll('[data-kamin-lang]')){const inactive=node.dataset.kaminLang!==lang;node.hidden=inactive;node.lang=node.dataset.kaminLang;node.inert=inactive;node.setAttribute('aria-hidden',String(inactive))}
 const title=document.body.dataset[lang==='ar'?'titleAr':'titleEn'];if(title)document.title=title
 const description=document.body.dataset[lang==='ar'?'descriptionAr':'descriptionEn'];if(description)document.querySelector('meta[name="description"]')?.setAttribute('content',description)
 if(location.hash){const candidates=[...document.querySelectorAll('[id]')].filter(n=>n.id===location.hash.slice(1));const visible=candidates.find(n=>n.getClientRects().length);visible?.scrollIntoView()}
 const segment=location.pathname.split('/').pop()
 const page=segment&&!segment.endsWith('.html')?segment+'.html':segment
 const header=document.querySelector('.k-site-header');if(header)header.outerHTML=headerHtml(lang,page)
 const footer=document.querySelector('.k-site-footer');if(footer)footer.outerHTML=footerHtml(lang)
 const skip=document.querySelector('.k-skip');if(skip)skip.textContent=lang==='ar'?'تجاوز إلى المحتوى':'Skip to content'
 const menu=document.querySelector('.k-menu');menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));document.querySelector('.k-nav').classList.toggle('is-open',open)})
 for(const link of document.querySelectorAll('a[href]')){const raw=link.getAttribute('href');if(raw.startsWith('#'))continue;const url=new URL(raw,location.href);if(url.origin!==location.origin)continue;if(url.pathname==='/'||/^\/(ar|en)\/$/.test(url.pathname)||url.pathname.endsWith('.html'))link.href=pageHref(url.pathname+url.search+url.hash,lang)}
 for(const button of document.querySelectorAll('[data-language-toggle]')){button.setAttribute('aria-label',languageLabel(lang));button.addEventListener('click',()=>{const next=lang==='ar'?'en':'ar';const url=new URL(location.href);if(pathLang){url.pathname=url.pathname.replace(/^\/(ar|en)/,`/${next}`);url.searchParams.delete('lang')}else url.searchParams.set('lang',next);location.href=url.toString()})}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply()
