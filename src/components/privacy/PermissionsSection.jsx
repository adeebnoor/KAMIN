import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { copy } from '../../i18n.js'
import { withdrawConsent, regrantNotice } from '../../utils/dataControl.js'
import { normalizeDigitalInterests } from '../../digitalInterests.js'

// Task 27 · section 1, "Permissions": the consent list, the digital activity source and the
// recommendation-review control, moved here from Privacy.jsx word for word (Tasks 05, 06).
export default function PermissionsSection({ lang, state, setState, log, onChangeSummary, onClearReviews }) {
  const t = copy[lang].app
  const p = copy[lang].screens.privacy
  const [confirmClearReviews,setConfirmClearReviews] = useState(false)
  const digital=normalizeDigitalInterests(state.insight?.digitalInterests)

  // Task 06: withdrawal per purpose goes through withdrawConsent, which names what was deleted,
  // which capabilities dropped, which judgments were recomputed and what stayed. Granting again
  // says that deleted data does not come back.
  const toggle = (key) => {
    const on = !!state.consents[key]
    if (on && (key !== 'analyze' || state.approved)) {
      const result = withdrawConsent(state, key, { lang })
      onChangeSummary?.({ type: `withdraw-${key}`, sentences: result.summary.sentences, ts: Date.now() })
      setState(result.state)
      return
    }
    setState(s => ({...s,consents:{...s.consents,[key]:!s.consents[key]}}))
    if (!on) onChangeSummary?.({ type: 'grant', sentences: { ar: [regrantNotice(key, 'ar')], en: [regrantNotice(key, 'en')] }, ts: Date.now() })
    log(lang==='ar'? `تغيير موافقة: ${t.consentItems[key]}` : `Consent changed: ${t.consentItems[key]}`)
  }

  return <>
    <div className="consents" aria-label={t.consent} role="group">{Object.keys(state.consents).map(key=>{const note=key==='analyze'
        ? (lang==='ar'?'ضروري فقط بعد اعتماد السجل':'Required only after transcript approval')
        : key==='insight'
          ? (lang==='ar'?'اختياري؛ يبقى محليًا ويتبع اختيارك للحفظ على هذا الجهاز ويمكن سحبه مستقلاً':'Optional; stays local, follows your device-persistence choice, and can be withdrawn independently')
          : (lang==='ar'?'عرض تجريبي فقط — لا توجد مشاركة فعلية مفعّلة في النسخة العامة':'Demonstration only — no operational sharing is enabled in the public release')
        return <label key={key}><span><strong>{t.consentItems[key]}</strong><small>{note}</small></span><input type="checkbox" checked={!!state.consents[key]} onChange={()=>toggle(key)}/></label>})}</div>

    {/* Task 27: one line each (heading and status); the full text is one click away, word for word. */}
    <div className="panel digital-privacy-control privacy-row"><details className="privacy-more"><summary><h4>{lang==='ar'?'مصدر النشاط الرقمي':'Digital activity source'}</h4><span>{lang==='ar'?`التحليل: ${digital.analysisConsent?'مفعّل':'غير مفعّل'} · شرح المسارات: ${digital.contextConsent?'مفعّل':'غير مفعّل'}`:`Analysis: ${digital.analysisConsent?'enabled':'off'} · Pathway explanations: ${digital.contextConsent?'enabled':'off'}`}</span></summary><p>{lang==='ar'?'الغرض: اقتراح اهتمامات تراجعها. لا تُحفظ النصوص الأصلية أو الحسابات. استخدام الاهتمامات لشرح المسارات يحتاج إذنًا مستقلًا داخل شاشة ملفك.':'Purpose: suggest interests for your review. Original text and accounts are not saved. Using interests for pathway explanations needs separate permission in your profile.'}</p><p>{lang==='ar'?'جمع الصحة والمخالفات والتفاصيل المالية وتحليل الشخصية من الحسابات غير مفعّل. الحذف من المتصفح لا يمحو نسخًا احتياطية سبق تنزيلها.':'Health, violations, financial details and guessing your personality from accounts are not enabled. Browser deletion cannot erase backups you previously downloaded.'}</p></details>{digital.analysisConsent&&<button className="button secondary" onClick={()=>{const result=withdrawConsent(state,'digital',{lang});onChangeSummary?.({type:'withdraw-digital',sentences:result.summary.sentences,ts:Date.now()});setState(result.state)}}><Trash2 size={17}/>{lang==='ar'?'اسحب الموافقة واحذف الاهتمامات الرقمية':'Withdraw consent and delete digital interests'}</button>}</div>

    <div className="panel review-privacy-actions privacy-row"><details className="privacy-more"><summary><h4>{lang==='ar'?'مراجعات التوصيات تحت سيطرتك':'You control recommendation reviews'}</h4><span>{p.reviewEvents(state.recommendationReviews.length)}</span></summary><p>{lang==='ar'?`لديك ${state.recommendationReviews.length} حدث مراجعة محلي. يتضمن الاسم أو الاسم المستعار والسبب والملاحظة والوقت إن اخترت قياسه. يتبع الحفظ اختيار الجلسة أو هذا الجهاز، وتشمله النسخة المشفرة. لا يُرسل ولا يدخل الرسم المعرفي أو رابط مشاركة القدرات.`:`You have ${state.recommendationReviews.length} local review events. They include a name or alias, reason, note and optional timing. They follow your session/device storage choice and are included in encrypted backups. They are not sent or added to the knowledge graph or capability-sharing links.`}</p><p>{lang==='ar'?'سحب موافقة تحليل السجل أو ملف الاهتمامات يحذف المراجعات أيضًا. النسخ التي سبق تنزيلها تبقى عند من يملكها.':'Withdrawing transcript-analysis or insight consent also deletes reviews. Previously downloaded copies remain with their holders.'}</p></details>{confirmClearReviews?<div><p>{lang==='ar'?'هل تحذف سجل المراجعات المحلي؟ لن تتغير مقرراتك أو قدراتك.':'Delete the local review history? Your courses and capabilities will stay as they are.'}</p><button className="button danger" onClick={()=>{onClearReviews();setConfirmClearReviews(false)}}>{lang==='ar'?'نعم، احذف المراجعات':'Yes, delete reviews'}</button><button className="button secondary" onClick={()=>setConfirmClearReviews(false)}>{t.cancel}</button></div>:<button className="button secondary" disabled={!state.recommendationReviews.length} onClick={()=>setConfirmClearReviews(true)}>{lang==='ar'?'احذف مراجعات التوصيات':'Delete recommendation reviews'}</button>}</div>
  </>
}
