import {useState} from 'react'
import {Menu, X, ArrowLeft, ArrowRight, Languages} from 'lucide-react'
import {navItems, footerItems, pageHref, languageLabel, text} from '../../public/site-content.js'
import '../../public/site-chrome.css'
export function SiteHeader({lang,setLang,onTry,onKnowledge}) {
 const [open,setOpen]=useState(false), t=(ar,en)=>text(lang,ar,en), Arrow=lang==='ar'?ArrowLeft:ArrowRight
 return <header className="k-site-header"><div className="k-header-inner">
  <a className="k-brand" href={pageHref('',lang)}><span aria-hidden="true">ك</span><strong>{t('كامن','Kamin')}<small>{t('قدراتك أوضح. خطوتك أقرب.','Clarity for your next step.')}</small></strong></a>
  <button className="k-menu" aria-label={t(open?'إغلاق القائمة':'فتح القائمة',open?'Close menu':'Open menu')} aria-expanded={open} aria-controls="k-public-nav" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
  <nav id="k-public-nav" className={`k-nav ${open?'is-open':''}`} aria-label={t('التنقل الرئيسي','Main navigation')}>
   {navItems.map(([path,ar,en])=>path.startsWith('?')?<button key={path} onClick={()=>{onKnowledge();setOpen(false)}}>{t(ar,en)}</button>:<a key={path} href={pageHref(path,lang)}>{t(ar,en)}</a>)}
   <button className="k-try" onClick={()=>{onTry();setOpen(false)}}>{t('جرّب كامن','Try Kamin')}<Arrow size={16}/></button>
  </nav>
  <button className="k-language" aria-label={languageLabel(lang)} onClick={()=>setLang(lang==='ar'?'en':'ar')}><Languages size={17}/><span lang={t('en','ar')}>{t('EN','العربية')}</span></button>
 </div></header>
}
export function SiteFooter({lang}) {return <footer className="k-site-footer"><div><strong>{text(lang,'كامن · قدراتك أوضح. خطوتك أقرب.','Kamin · Clarity for your next step.')}</strong><p>{text(lang,'نسخة بحثية عامة · معالجة ملفك محليًا في المتصفح.','Public research release · Your profile is processed in your browser.')}</p><nav aria-label={text(lang,'روابط المساعدة والمشروع','Help and project links')}>{footerItems.map(([path,ar,en])=><a key={path} href={pageHref(path,lang)}>{text(lang,ar,en)}</a>)}</nav></div></footer>}
