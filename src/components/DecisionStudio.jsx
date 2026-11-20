import { useMemo, useState } from 'react'
import { Route, SearchCheck, Waypoints, ShieldCheck, ArrowLeft, ArrowRight } from 'lucide-react'
import RecommendationReview from './RecommendationReview.jsx'
import ProjectEvidencePanel from './ProjectEvidence.jsx'
// Task 75: the "Capability network" tab and the pathway controls live in ShowConnections.jsx, word for word, so the new
// interface's Profile → My map shows the same map from the same code.
import ShowConnections, { PathwayControls } from './ShowConnections.jsx'
import { copy } from '../i18n.js'
import { DevelopmentPlanPanel, buildDevelopmentPlan, planStatus } from '../plan/developmentPlan.jsx'
const tr = (lang, ar, en) => lang === 'ar' ? ar : en
// Task 74: the development plan (buildDevelopmentPlan, its panel and download) lives in src/plan/developmentPlan.jsx,
// word for word, so the new interface's My plan shows the same plan from the same code.
export { buildDevelopmentPlan }
export default function DecisionStudio({ lang, matches, state, graph, onReview, onGoal, initialTarget, onSaveReview, projects = [], onSaveProject, onRemoveProject }) {
  const [active, setActive] = useState(initialTarget?'plan':'network')
  const [targetId, setTargetId] = useState(initialTarget||'job-data-analyst')
  const [question, setQuestion] = useState('why')
  const match = matches.find(m => m.id === targetId) || matches[0]
  const plan = useMemo(() => buildDevelopmentPlan(match, lang), [match, lang])
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight
  const S = copy[lang].screens.studio
  const status = planStatus(state, lang)
  const questions = [
    ['why', tr(lang, 'لماذا يرتبط هذا المسار بملفي؟', 'Why does this pathway connect to my profile?')],
    ['missing', tr(lang, 'ما الذي ينقصني فعلًا؟', 'What evidence am I missing?')],
    ['first', tr(lang, 'ما أفضل خطوة أبدأ بها؟', 'What should I do first?')],
    ['honest', tr(lang, 'كيف أجعل بياناتي أدق؟', 'How can I improve my data?')],
  ]
  const answers = question === 'why' ? (match?.supportingMechanisms?.length ? match.supportingMechanisms : [tr(lang,'لا توجد علاقة داعمة لهذا المسار في مدخلاتك الحالية. أضف اهتمامًا أو هدفًا، وراجع الأدلة المطلوبة في تبويب الفجوات.','No supporting connection exists for this pathway in your current inputs. Add an interest or goal, and review the missing evidence question.')])
    : question === 'missing' ? ((match?.limitingMechanisms?.length) ? match.limitingMechanisms : [tr(lang, 'لا توجد فجوة في المتطلبات الأساسية المحدودة لهذا المثال. هذا لا يثبت اكتمال استعدادك لوظيفة حقيقية.', 'No gap appears in this example’s limited core requirements. This does not establish readiness for a real job.')])
    : question === 'first' ? [plan[0]?.action, plan[1]?.action]
    : [tr(lang, 'طابق رمز المقرر والدرجة مع السجل الأصلي. الرمز غير الصحيح قد يربطك بقدرة لا يمثلها المقرر.', 'Match course codes and grades to the original record. An incorrect code can create an irrelevant capability link.'), tr(lang, 'اختر تفضيلاتك الحالية؛ يمكنك تركها غير محددة وتعديلها لاحقًا. لا توجد إجابة مثالية.', 'Choose your current preferences. You may leave them undecided and change them later. There is no ideal answer.'), tr(lang, 'موافقتك تعني أنك راجعت البيانات، ولا تعني أن الجامعة أو كامن تحققا من صحتها.', 'Your approval means you reviewed the information; it does not mean Kamin or a university authenticated it.')]
  return <div className="decision-studio">
    <div className="app-title"><small>{S.kicker}</small><h2>{S.title}</h2><p>{S.intro}</p></div>
    {!state.approved && <div className="studio-grounding"><ShieldCheck size={18}/>{tr(lang,'يمكنك استكشاف الاهتمامات والأهداف الآن. لم تضف دليلًا أكاديميًا بعد؛ وجود اهتمام لا يعني إثبات القدرة أو الجاهزية.','You can explore interests and goals now. Academic evidence has not been added; an interest does not prove capability or readiness.')}</div>}
    <PathwayControls lang={lang} matches={matches} match={match} status={status} onChange={setTargetId}/>
    {!state.goal && <div className="studio-notice"><TargetNote lang={lang}/><button className="text-button" onClick={onGoal}>{tr(lang, 'حدد اهتماماتي وهدفي', 'Set interests & goal')}<Arrow size={16}/></button></div>}
    <div className="studio-tabs" role="tablist" aria-label={tr(lang, 'خدمات القرار', 'Decision services')}>{[['network', Waypoints, tr(lang, 'شبكة القدرات', 'Capability network')], ['guide', SearchCheck, tr(lang, 'مساعد القرار', 'Decision guide')], ['plan', Route, tr(lang, 'خطة التطوير', 'Development plan')]].map(([id, Icon, text]) => <button key={id} id={`studio-tab-${id}`} role="tab" aria-selected={active === id} aria-controls="studio-panel" tabIndex={active===id?0:-1} onKeyDown={e=>{const ids=['network','guide','plan'];let index=ids.indexOf(id);if(e.key==='Home')index=0;else if(e.key==='End')index=2;else if(['ArrowLeft','ArrowRight'].includes(e.key))index=(index+(e.key===(lang==='ar'?'ArrowLeft':'ArrowRight')?1:2))%3;else return;e.preventDefault();setActive(ids[index]);document.getElementById(`studio-tab-${ids[index]}`)?.focus()}} onClick={() => setActive(id)}><Icon size={18}/>{text}</button>)}</div>
    <div id="studio-panel" role="tabpanel" aria-labelledby={`studio-tab-${active}`}>
      {active === 'network' && <ShowConnections lang={lang} state={state} match={match} graph={graph} onGoal={onGoal}/>}
      {active === 'guide' && <div className="panel studio-guide"><label>{tr(lang, 'اختر سؤالك', 'Choose your question')}<select value={question} onChange={e => setQuestion(e.target.value)}>{questions.map(([id, q]) => <option key={id} value={id}>{q}</option>)}</select></label><div className="guide-answer" aria-live="polite"><h3>{questions.find(([id]) => id === question)[1]}</h3>{answers.filter(Boolean).map((answer, i) => <p key={i}>{answer}</p>)}</div><div className="studio-grounding"><ShieldCheck size={18}/>{tr(lang, 'الإجابة مستندة إلى ملفك وقواعد المطابقة الحالية. يمكنك مراجعة مصدرها في شبكة القدرات.', 'The answer uses your profile and current matching rules. Inspect its source in the capability network.')}</div>{question === 'missing' && onSaveProject && <ProjectEvidencePanel compact lang={lang} projects={projects} onSave={onSaveProject} onRemove={onRemoveProject} suggestedSkillIds={match?.missingSkills || []}/>}<button className="text-button" onClick={onReview}>{tr(lang, 'راجع معلومات سجلي', 'Review my record')}<Arrow size={16}/></button></div>}
      {active === 'plan' && <DevelopmentPlanPanel lang={lang} match={match} state={state}/>}
    </div>
    {match && <RecommendationReview key={match.id} item={match} lang={lang} state={state} onSave={onSaveReview}/>}
  </div>
}
function TargetNote({ lang }) { return <p>{tr(lang, 'لم تحدد هدفًا بعد؛ النتائج للاستكشاف العام.', 'No goal selected yet; these results are general exploration.')}</p> }
