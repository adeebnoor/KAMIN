import { useMemo, useState } from 'react'
import { Download, Route, SearchCheck, Waypoints, ShieldCheck, ArrowLeft, ArrowRight } from 'lucide-react'
import KnowledgeNetwork from './KnowledgeNetwork.jsx'
import { skills as skillCatalog } from '../data.js'
import { copy } from '../i18n.js'
const tr = (lang, ar, en) => lang === 'ar' ? ar : en
const skillLabel = (id, lang) => skillCatalog[id]?.labels?.[lang] || id
export function buildDevelopmentPlan(match, lang = 'ar') {
  if (!match) return []
  const required = (match.missingSkills || []).map(id => skillLabel(id, lang))
  const developing = (match.knowledgeInsights?.developmentGaps || []).map(g => g.label)
  const focus = required[0] || developing[0] || tr(lang, 'تطبيق قدراتك الحالية', 'applying your current capabilities')
  return [
    { title: tr(lang, 'راجع نقطة البداية', 'Review your starting point'), action: required.length ? tr(lang, `تأكد من نقص دليل على: ${required.join('، ')}. إذا درستها بالفعل، راجع المقرر الأصلي قبل تعلمها من جديد.`, `Check the missing evidence for ${required.join(', ')}. If you already studied it, review the original record before repeating the learning.`) : tr(lang, 'المتطلبات الموجودة في هذا المثال لها روابط دليل. راجع مدى تمثيلها لمهاراتك الحالية؛ هذا لا يثبت الجاهزية المهنية.', 'This example’s requirements have evidence links. Check how well they reflect your current skills; this does not establish professional readiness.') },
    { title: tr(lang, 'اختر تجربة تطبيقية واحدة', 'Choose one applied exercise'), action: tr(lang, `اجعل تركيزك: ${focus}. اختر مهمة صغيرة تخدم مسار «${match.title.ar}»، وحدد مخرجًا تستطيع عرضه وشرحه.`, `Focus on ${focus}. Choose a small task for “${match.title.en}” and define an output you can show and explain.`) },
    { title: tr(lang, 'وثّق ما فعلته بنفسك', 'Document your own contribution'), action: tr(lang, 'احتفظ بملف العمل وطريقة تنفيذه والنتيجة. اذكر مساهمة الفريق أو أدوات الذكاء الاصطناعي بوضوح، وما تستطيع شرحه بنفسك.', 'Keep the work, method and result. Clearly describe team or AI contributions and what you can explain yourself.') },
    { title: tr(lang, 'راجع الدليل مع مرشد', 'Review the evidence with an advisor'), action: tr(lang, 'اطلب تغذية راجعة على المخرج، ثم حدّث بياناتك المتاحة في كامن. تنفيذ الخطة لا يضيف مهارة تلقائيًا؛ اعتماد المشاريع غير متاح في النسخة الحالية.', 'Ask for feedback, then update the information supported by Kamin. Completing a plan does not automatically add a skill; project verification is not available in this release.') },
  ]
}
export default function DecisionStudio({ lang, matches, state, onReview, onGoal }) {
  const [active, setActive] = useState('network')
  const [targetId, setTargetId] = useState('job-data-analyst')
  const [question, setQuestion] = useState('why')
  const [exportError, setExportError] = useState('')
  const match = matches.find(m => m.id === targetId) || matches[0]
  const plan = useMemo(() => buildDevelopmentPlan(match, lang), [match, lang])
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight
  const status = state.courses.some(c=>c.source==='demo') ? tr(lang, 'ملف يتضمن بيانات وهمية · تجربة فقط', 'Profile includes synthetic data · demo only') : tr(lang, 'استكشاف مبدئي · كتالوج مرجعي', 'Preliminary exploration · reference catalog')
  const questions = [
    ['why', tr(lang, 'لماذا يرتبط هذا المسار بملفي؟', 'Why does this pathway connect to my profile?')],
    ['missing', tr(lang, 'ما الذي ينقصني فعلًا؟', 'What evidence am I missing?')],
    ['first', tr(lang, 'ما أفضل خطوة أبدأ بها؟', 'What should I do first?')],
    ['honest', tr(lang, 'كيف أجعل بياناتي أدق؟', 'How can I improve my data?')],
  ]
  const answers = question === 'why' ? (match?.supportingMechanisms || [])
    : question === 'missing' ? ((match?.limitingMechanisms?.length) ? match.limitingMechanisms : [tr(lang, 'لا توجد فجوة في المتطلبات الأساسية المحدودة لهذا المثال. هذا لا يثبت اكتمال استعدادك لوظيفة حقيقية.', 'No gap appears in this example’s limited core requirements. This does not establish readiness for a real job.')])
    : question === 'first' ? [plan[0]?.action, plan[1]?.action]
    : [tr(lang, 'طابق رمز المقرر والدرجة مع السجل الأصلي. الرمز غير الصحيح قد يربطك بقدرة لا يمثلها المقرر.', 'Match course codes and grades to the original record. An incorrect code can create an irrelevant capability link.'), tr(lang, 'اختر تفضيلاتك الحالية؛ يمكنك تركها غير محددة وتعديلها لاحقًا. لا توجد إجابة مثالية.', 'Choose your current preferences. You may leave them undecided and change them later. There is no ideal answer.'), tr(lang, 'موافقتك تعني أنك راجعت البيانات، ولا تعني أن الجامعة أو كامن تحققا من صحتها.', 'Your approval means you reviewed the information; it does not mean Kamin or a university authenticated it.')]
  const downloadPlan = () => {
    try {
      const content = [tr(lang, 'كامن — خطة تطوير استرشادية', 'Kamin — exploratory development plan'), match.title[lang], status, ...plan.flatMap((p, i) => [`${i + 1}. ${p.title}`, p.action]), tr(lang, 'هذه الخطة لا تغيّر أدلة الملف أو حكم الملاءمة.', 'This plan does not change profile evidence or fit judgments.')].join('\n\n')
      const url = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = 'kamin-development-plan.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setExportError(tr(lang, 'تعذر تنزيل الخطة. حاول مرة أخرى.', 'Could not download the plan. Please try again.')) }
  }
  if (!state.approved) return <div className="panel"><h2>{tr(lang, 'ابدأ بدليل تراجعه', 'Start with evidence you review')}</h2><p>{tr(lang, 'ارفع سجلك أو جرّب المثال لبناء شبكة قدرات وخطة مرتبطة ببيانات واضحة.', 'Upload your record or try the demo to build a network and plan grounded in clear inputs.')}</p><button className="button primary" onClick={onReview}>{tr(lang, 'أضف سجلًا', 'Add a record')}</button></div>
  return <div className="decision-studio">
    <div className="app-title"><small>{tr(lang, 'افهم · استكشف · خطط', 'UNDERSTAND · EXPLORE · PLAN')}</small><h2>{tr(lang, 'شبكتي ومساعد القرار', 'My network & decision guide')}</h2><p>{tr(lang, 'اختر مسارًا، تتبّع علاقاته بملفك، ثم حوّل ما ينقصه إلى خطوة عملية.', 'Choose a pathway, trace its connections to your profile, then turn missing evidence into a practical step.')}</p></div>
    <div className="studio-controls"><label>{tr(lang, 'المسار الذي أريد استكشافه', 'Pathway to explore')}<select value={match?.id || ''} onChange={e => setTargetId(e.target.value)}>{matches.map(m => <option key={m.id} value={m.id}>{m.title[lang]}</option>)}</select></label><div><small>{status}</small><span>{tr(lang, 'مبني على قواعد وشبكة معرفة محلية، دون نموذج محادثة خارجي.', 'Based on local rules and a knowledge graph, without an external chat model.')}</span></div></div>
    {!state.goal && <div className="studio-notice"><TargetNote lang={lang}/><button className="text-button" onClick={onGoal}>{tr(lang, 'اختر هدفي', 'Choose my goal')}<Arrow size={16}/></button></div>}
    <div className="studio-tabs" role="tablist" aria-label={tr(lang, 'خدمات القرار', 'Decision services')}>{[['network', Waypoints, tr(lang, 'شبكة القدرات', 'Capability network')], ['guide', SearchCheck, tr(lang, 'مساعد القرار', 'Decision guide')], ['plan', Route, tr(lang, 'خطة التطوير', 'Development plan')]].map(([id, Icon, text]) => <button key={id} id={`studio-tab-${id}`} role="tab" aria-selected={active === id} aria-controls="studio-panel" tabIndex={active===id?0:-1} onKeyDown={e=>{const ids=['network','guide','plan'];let index=ids.indexOf(id);if(e.key==='Home')index=0;else if(e.key==='End')index=2;else if(['ArrowLeft','ArrowRight'].includes(e.key))index=(index+(e.key===(lang==='ar'?'ArrowLeft':'ArrowRight')?1:2))%3;else return;e.preventDefault();setActive(ids[index]);document.getElementById(`studio-tab-${ids[index]}`)?.focus()}} onClick={() => setActive(id)}><Icon size={18}/>{text}</button>)}</div>
    <div id="studio-panel" role="tabpanel" aria-labelledby={`studio-tab-${active}`}>
      {active === 'network' && <KnowledgeNetwork key={match?.id} match={match} lang={lang} demo={state.courses.some(c=>c.source==='demo')} goalLabel={copy[lang].app.goals[state.goal]}/>}
      {active === 'guide' && <div className="panel studio-guide"><label>{tr(lang, 'اختر سؤالك', 'Choose your question')}<select value={question} onChange={e => setQuestion(e.target.value)}>{questions.map(([id, q]) => <option key={id} value={id}>{q}</option>)}</select></label><div className="guide-answer" aria-live="polite"><h3>{questions.find(([id]) => id === question)[1]}</h3>{answers.filter(Boolean).map((answer, i) => <p key={i}>{answer}</p>)}</div><div className="studio-grounding"><ShieldCheck size={18}/>{tr(lang, 'الإجابة مستندة إلى ملفك وقواعد المطابقة الحالية. يمكنك مراجعة مصدرها في شبكة القدرات.', 'The answer uses your profile and current matching rules. Inspect its source in the capability network.')}</div><button className="text-button" onClick={onReview}>{tr(lang, 'راجع معلومات سجلي', 'Review my record')}<Arrow size={16}/></button></div>}
      {active === 'plan' && <div className="panel studio-plan"><div className="panel-head"><div><small>{tr(lang, 'خطة عمل مقترحة', 'SUGGESTED ACTION PLAN')}</small><h3>{match?.title[lang]}</h3></div><button className="text-button" onClick={downloadPlan}><Download size={17}/>{tr(lang, 'تنزيل الخطة', 'Download plan')}</button></div><p>{tr(lang, 'الأولوية لنقص دليل المتطلبات، ثم فرص التطوير. إشارات السوق الأجنبية سياق إضافي، ولا تمثل طلب السوق السعودي.', 'Required evidence gaps come first, followed by development opportunities. Foreign market signals are additional context, not Saudi demand.')}</p><ol>{plan.map(p => <li key={p.title}><h4>{p.title}</h4><p>{p.action}</p></li>)}</ol><div className="studio-grounding"><ShieldCheck size={18}/>{tr(lang, 'الخطة لا تغيّر المهارات أو نتائج المطابقة، ولا تَعِد بقبول أو توظيف.', 'The plan does not change skills or matching results, and does not promise acceptance or employment.')}</div>{exportError && <p role="alert">{exportError}</p>}</div>}
    </div>
  </div>
}
function TargetNote({ lang }) { return <p>{tr(lang, 'لم تحدد هدفًا بعد؛ النتائج للاستكشاف العام.', 'No goal selected yet; these results are general exploration.')}</p> }
