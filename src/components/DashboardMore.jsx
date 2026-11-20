import { Check, LockKeyhole } from 'lucide-react'
import { copy } from '../i18n.js'
import TaskLoop, { TodayStrip } from './TaskLoop.jsx'
import RecommendationReview from './RecommendationReview.jsx'
import { EducationClassificationCard } from './Dashboard.jsx'

// Task 11 · what used to stack on the dashboard, folded under "More" and loaded only when opened:
// today's step and tasks, the full next decision (with its review), the connections network and
// the national education classification. Nothing was removed.
const tr = (lang, ar, en) => lang === 'ar' ? ar : en

export default function DashboardMore({ lang, state, matches, nextDecision, focusTaskId, onFocusTask, onUpdateTasks, onGoal, onOpenNetwork, onExploreCourses, onSaveReview, classification }) {
  const t = copy[lang].app
  return <div className="dashboard-more-body">
    <TodayStrip lang={lang} state={state} matches={matches} onGoal={onGoal} onOpenTask={id => { onFocusTask(id); requestAnimationFrame(() => document.getElementById('task-loop-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }}/>
    <div id="task-loop-anchor"/><TaskLoop key={focusTaskId || 'tasks'} lang={lang} state={state} matches={matches} onUpdate={onUpdateTasks} focusTaskId={focusTaskId}/>
    {nextDecision
      ? <div className="panel decision"><div className="decision-head"><div><small>{tr(lang, 'القرار التالي', 'Next decision')}</small><h3>{nextDecision.title[lang]}</h3></div><span className={`status ${nextDecision.status}`}>{t.fit[nextDecision.status]}</span></div><div className="decision-body"><div className="decision-score"><strong>{t.fit[nextDecision.status]}</strong><small>{copy[lang].screens.dashboard.decisionNote}</small></div><div>{nextDecision.reasons.map((reason, i) => <p key={i}><Check size={15}/>{reason}</p>)}<p className="becomes"><strong>{t.becomes}</strong> {nextDecision.becomes}</p></div></div><button type="button" className="button primary" onClick={onExploreCourses}>{tr(lang, 'استكشف كل الدورات', 'Explore all courses')}</button><RecommendationReview item={nextDecision} kind="course" state={state} lang={lang} onSave={onSaveReview}/></div>
      : <div className="panel decision decision-locked"><LockKeyhole size={28}/><div><small>{tr(lang, 'القرار التالي', 'Next decision')}</small><h3>{tr(lang, 'أضف أو اعتمد مقررًا مرتبطًا بقدرة لفتح أول توصية', 'Add or approve capability-linked coursework to unlock your first recommendation')}</h3><p>{tr(lang, 'لا يعرض كامن حكم دورة عندما لا توجد أي مهارة مدعومة بالدليل. أضف دليلًا معتمدًا أولًا.', 'Kamin shows no course judgment when no skill is supported by evidence. Add approved evidence first.')}</p></div></div>}
    <div className="dashboard-studio-prompt"><div><h3>{tr(lang, 'شاهد الروابط التي صنعت هذه النتيجة', 'See the connections behind your result')}</h3><p>{tr(lang, 'شبكة قدرات تفاعلية، إجابات مستندة إلى ملفك، وخطة للخطوة التالية.', 'An interactive capability network, grounded answers, and a plan for your next step.')}</p></div><button type="button" className="button primary" onClick={onOpenNetwork}>{tr(lang, 'افتح شبكتي ومساعدي', 'Open my network & guide')}</button></div>
    <EducationClassificationCard lang={lang} classification={classification}/>
  </div>
}
