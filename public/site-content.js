// One bilingual navigation model for React and every public document.
export const text = (lang, ar, en) => lang === 'ar' ? ar : en
export const navItems = [
  ['services.html', 'الخدمات والميزات', 'Services & features'],
  ['guide.html', 'دليل الاستخدام', 'User guide'],
  ['?view=knowledge', 'مستكشف المعرفة', 'Knowledge explorer'],
  ['methodology.html', 'المنهجية', 'Methodology'],
  ['trust.html', 'مركز الثقة', 'Trust center'],
]
export const footerItems = [
  ['about.html', 'عن كامن والفريق', 'About & team'],
  ['contact.html', 'التواصل والمساعدة', 'Contact & help'],
  ['privacy.html', 'الخصوصية', 'Privacy'],
  ['pdpl.html', 'مطابقة PDPL', 'PDPL mapping'],
  ['faq.html', 'الأسئلة الشائعة', 'FAQ'],
  ['sample-report.html', 'تقرير تجريبي', 'Sample report'],
  ['validation.html', 'التحقق والتجربة الجامعية', 'Validation & pilot'],
  ['capstone.html', 'خطة فريق التطوير', 'Capstone team plan'],
  ['stories.html', 'أدلة التطوير', 'Development evidence'],
  ['interoperability.html', 'التكامل', 'Interoperability'],
  ['business-model.html', 'للجامعات والشركاء', 'Universities & partners'],
  ['changelog.html', 'سجل التحديثات', 'Changelog'],
]
export function pageHref(file,lang,style=typeof document==='undefined'?'html':document.documentElement.dataset.documentUrls||'html'){
 const url=new URL(file.startsWith('/')?file:`/${file}`,'https://kamin.invalid')
 url.pathname=url.pathname.replace(/^\/(ar|en)(?=\/|$)/,'').replace(/\/index\.html$/,'/')
 url.pathname=`/${lang}${url.pathname==='/'?'/':url.pathname}`
 if(style==='clean')url.pathname=url.pathname.replace(/\.html$/,'')
 url.searchParams.delete('lang')
 return url.pathname+url.search+url.hash
}
export const languageLabel = lang => text(lang, 'التبديل إلى الإنجليزية', 'Switch to Arabic')
export function headerHtml(lang, page = '') {
  const t = (ar,en)=>text(lang,ar,en)
  return `<header class="k-site-header"><div class="k-header-inner"><a class="k-brand" href="${pageHref('',lang)}"><span aria-hidden="true">ك</span><strong>${t('كامن','Kamin')}<small>${t('قدراتك أوضح. خطوتك أقرب.','Clarity for your next step.')}</small></strong></a><button class="k-menu" aria-expanded="false" aria-controls="k-public-nav">${t('القائمة','Menu')}</button><nav id="k-public-nav" class="k-nav" aria-label="${t('التنقل الرئيسي','Main navigation')}">${navItems.map(([path,ar,en])=>`<a href="${pageHref(path,lang)}" ${page===path?'aria-current="page"':''}>${t(ar,en)}</a>`).join('')}<a class="k-try" href="${pageHref('?start=profile',lang)}">${t('جرّب كامن','Try Kamin')} <span aria-hidden="true">${t('←','→')}</span></a></nav><button class="k-language" data-language-toggle aria-label="${languageLabel(lang)}"><span lang="${t('en','ar')}">${t('EN','العربية')}</span></button></div></header>`
}
export function footerHtml(lang) {
  return `<footer class="k-site-footer"><div><strong>${text(lang,'كامن · قدراتك أوضح. خطوتك أقرب.','Kamin · Clarity for your next step.')}</strong><p>${text(lang,'نسخة بحثية عامة · معالجة ملفك محليًا في المتصفح.','Public research release · Your profile is processed in your browser.')}</p><nav aria-label="${text(lang,'روابط المساعدة والمشروع','Help and project links')}">${footerItems.map(([path,ar,en])=>`<a href="${pageHref(path,lang)}">${text(lang,ar,en)}</a>`).join('')}</nav></div></footer>`
}
