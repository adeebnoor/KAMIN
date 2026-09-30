import {useState} from 'react'
import {ArrowLeft,ArrowRight,CheckCircle2} from 'lucide-react'
import './quick-tour.css'
export default function QuickTour({lang,onSample,onProfile}) {
 const [step,setStep]=useState(0)
 const t=(ar,en)=>lang==='ar'?ar:en
 const slides=[
  [t('ابدأ بدليل يمكنك مراجعته','Start with evidence you can review'),t('سارة · طالبة افتراضية','Sara · fictional student'),t('مقرر قواعد البيانات CPIT-260 مرتبط بقدرة قواعد البيانات في الخريطة التجريبية. مراجعة الطالب لا تعني تحقق الجامعة.','The CPIT-260 course links to database capability in the pilot map. Student review does not mean university verification.'),t('دليل أكاديمي ← قدرة','Academic evidence → capability')],
  [t('افهم السبب وحدوده','Understand the reason and its limits'),t('مسار تحليل البيانات','Data analysis pathway'),t('هذا المسار يحتاج دليلًا في قواعد البيانات والتحليل الكمي. الاهتمام بالتحليل وحده لا يثبت أيًا منهما.','This pathway needs evidence in databases and quantitative analysis. An interest in analysis alone proves neither.'),t('اهتمام ≠ قدرة مثبتة','Interest ≠ proven capability')],
  [t('اختر خطوة تُنتج دليلًا','Choose a step that produces evidence'),t('مشروع صغير قابل للمراجعة','A small, reviewable project'),t('حلّل بيانات عامة، اشرح طريقة العمل وحدود النتيجة، ثم ناقش المشروع مع مستشار. لا ينتج عن هذا المثال شهادة أو قرار توظيف.','Analyze public data, explain your method and limitations, then discuss the project with an advisor. This example issues no credential or hiring decision.'),t('فجوة ← مشروع ← مراجعة','Gap → project → review')],
 ]
 const Arrow=lang==='ar'?ArrowLeft:ArrowRight
 return <section className="quick-tour" aria-label={t('جولة البداية','Getting started tour')}>
  <div className="quick-tour-heading"><span>{t('جولة في نحو دقيقة','ABOUT A MINUTE')}</span><small>{t('مثال توضيحي · دون بيانات شخصية','Synthetic example · no personal data')}</small></div>
  <ol className="quick-tour-steps">{slides.map((slide,i)=><li key={i}><button aria-current={step===i?'step':undefined} aria-label={t(`الخطوة ${i+1}: ${slide[0]}`,`Step ${i+1}: ${slide[0]}`)} onClick={()=>setStep(i)}>{i+1}</button></li>)}</ol>
  <div aria-live="polite" className="quick-tour-content"><small>{slides[step][1]}</small><h2>{slides[step][0]}</h2><p>{slides[step][2]}</p><strong><CheckCircle2 size={20}/>{slides[step][3]}</strong></div>
  <div className="quick-tour-controls"><button className="text-button" disabled={step===0} onClick={()=>setStep(i=>i-1)}>{t('السابق','Back')}</button>{step<2?<button className="button secondary" onClick={()=>setStep(i=>i+1)}>{t('التالي','Next')}<Arrow size={18}/></button>:<button className="button primary" onClick={onSample}>{t('افتح المثال التفاعلي','Open the interactive sample')}<Arrow size={18}/></button>}</div>
  <button className="text-button" onClick={onProfile}>{t('أو ابدأ ملفك الآن','Or build your own profile now')}</button>
 </section>
}
