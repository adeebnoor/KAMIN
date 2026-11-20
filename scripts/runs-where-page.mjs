// Task 16 · the public page "What runs where", generated from src/content/runtimeManifest.js.
// Nothing here is written by hand per feature: add or change a feature in the manifest.
import {RUNTIME_MANIFEST,STORED_IN,featuresRunningIn} from '../src/content/runtimeManifest.js'

const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const card=(title,body,id='')=>`<section class="k-doc-card"${id?` id="${id}"`:''}><h2>${title}</h2>${body}</section>`

export function runsWherePage(lang){
 const t=(ar,en)=>lang==='ar'?ar:en
 const built=featuresRunningIn('browser'),notBuilt=featuresRunningIn('not-built')
 const head=[t('الميزة','Feature'),t('ما الذي تفعله','What it does'),t('البيانات التي تستخدمها','Data it touches'),t('أين تُحفظ','Where it is kept')]
 const table=`<div class="k-doc-table" role="region" tabindex="0" aria-label="${t('ما يعمل في متصفحك','What runs in your browser')}"><table><thead><tr>${head.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${
  built.map(item=>`<tr data-feature="${item.id}" data-runs-in="browser"><th scope="row">${esc(item.name[lang])}</th><td>${esc(item.does[lang])}</td><td>${esc(item.data[lang])}</td><td>${esc(STORED_IN[item.storedIn][lang])}</td></tr>`).join('')
 }</tbody></table></div>`
 const missing=`<ul>${notBuilt.map(item=>`<li data-feature="${item.id}" data-runs-in="not-built"><strong>${esc(item.name[lang])}</strong>: ${esc(item.does[lang])}</li>`).join('')}</ul>`
 return [
  t('ما الذي يعمل وأين','What runs where'),
  t('كل ما يلمس بياناتك يعمل داخل متصفحك. لا يوجد خادم لكامن يستقبل بياناتك أو يعالجها.','Everything that touches your data runs in your browser. Kamin has no server that receives or processes your data.'),
  card(t('الإجابة المختصرة','The short answer'),
   `<p>${t(`ميزات تعمل في متصفحك: ${built.length}. ميزات غير مبنية: ${notBuilt.length}. ميزات تعمل على خادم: لا شيء.`,`${built.length} features run in your browser and ${notBuilt.length} are not built. No feature runs on a server.`)}</p>`+
   `<p>${t('مزوّد الاستضافة يرسل ملفات الموقع فقط: الصفحات والبرمجيات والخطوط وملفات النموذج اللغوي العامة. لا يستقبل سجلك أو ملفك أو ما تكتبه.','The hosting provider only sends the site’s files: pages, scripts, fonts and the public language-model files. It does not receive your transcript, your profile or what you type.')}</p>`,'short-answer')+
  card(t('يعمل في متصفحك','Runs in your browser'),table,'in-browser')+
  card(t('غير مبني أو خارج النطاق','Not built or out of scope'),`<p>${t('هذه الميزات غير موجودة في هذه النسخة. لا نلمّح إلى وجودها.','These features do not exist in this release. We do not imply that they do.')}</p>${missing}`,'not-built')+
  card(t('كيف نتحقق من ذلك','How we check this'),
   `<ul><li>${t('سياسة أمان المحتوى في الموقع تسمح بالاتصال بالموقع نفسه فقط (connect-src \'self\')، فيرفض المتصفح أي اتصال بخدمة أخرى.','The site’s Content Security Policy allows connections to this site only (connect-src \'self\'), so the browser refuses any connection to another service.')}</li>`+
   `<li>${t('اختبار آلي يفحص الشيفرة: كل استدعاء شبكة يجب أن يكون في القائمة المسموح بها وإلى الموقع نفسه، ولا يُسمح بعناوين خدمات ذكاء اصطناعي خارجية.','An automated test scans the code: every network call must be on the allowed list and go to this same site, and no external AI service address is allowed.')}</li>`+
   `<li>${t('اختبار متصفح يمرّ بالرحلة الأساسية (رفع سجل وهمي، الاعتماد، القدرات، الخطوة التالية، الحفظ، النسخة الاحتياطية) ويفشل إذا طُلب أي عنوان من خارج الموقع.','A browser test walks the main journey (upload a synthetic transcript, approve, capabilities, next step, save, backup) and fails if any address outside the site is requested.')}</li></ul>`+
   `<p><a href="/privacy.html">${t('سياسة الخصوصية','Privacy policy')}</a> · <a href="/pdpl.html">${t('مطابقة PDPL','PDPL mapping')}</a></p>`,'how-we-check'),
 ]
}

export const runsWhereFeatureIds=RUNTIME_MANIFEST.map(item=>item.id)
