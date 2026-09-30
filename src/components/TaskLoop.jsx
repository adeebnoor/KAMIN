import { useId, useState } from 'react'
import { ListChecks, Play, Paperclip, ClipboardCheck, ChevronDown } from 'lucide-react'
import { taskCatalog, taskById, TASK_GOVERNANCE } from '../tasks/catalog.js'
import { normalizeTaskProgress, startTask, attachTaskOutput, selfAssessTask, recordLocalTaskReview, recommendTask, taskProof, REVIEWER_ROLES } from '../tasks/progress.js'
import { skills as catalog } from '../data.js'
import { copy } from '../i18n.js'

const tr = (lang, ar, en) => lang === 'ar' ? ar : en
const statusLabel = {
  'not-started': ['لم تبدأ', 'Not started'], 'in-progress': ['قيد التنفيذ', 'In progress'], 'output-attached': ['أُرفق مخرج', 'Output attached'],
  'needs-improvement': ['يحتاج تحسينًا', 'Needs improvement'], reviewed: ['روجع محليًا', 'Reviewed locally'],
}
const roleLabel = { student: ['أنا (تقييم ذاتي)', 'Me (self-assessment)'], peer: ['زميل', 'Peer'], advisor: ['مستشار — صفة مصرح بها', 'Advisor — self-declared role'] }
const skillLabel = (id, lang) => Object.values(catalog).find(s => s.id === id)?.labels[lang] || id

// The three questions of the day: my goal, my most important missing evidence, what I do now.
export function TodayStrip({ lang, state, matches = [], onOpenTask, onGoal }) {
  const goal = state.goal ? copy[lang].app.goals[state.goal] : null
  const match = matches.find(m => state.goal && (m.goals || []).includes(state.goal)) || matches[0]
  const missing = match?.missingSkills?.[0] || null
  const recommendation = recommendTask({ missingSkills: match?.missingSkills || [], records: state.tasks })
  return <section className="today-strip" aria-label={tr(lang, 'يومي في كامن', 'My day in Kamin')} data-testid="today-strip">
    <div><small>{tr(lang, 'هدفي الحالي', 'My current goal')}</small><strong>{goal || tr(lang, 'لم يُحدد بعد', 'Not set yet')}</strong>{!goal && <button type="button" className="text-button" onClick={onGoal}>{tr(lang, 'حدد هدفًا', 'Set a goal')}</button>}</div>
    <div><small>{tr(lang, 'أهم دليل ناقص', 'Most important missing evidence')}</small><strong>{missing ? skillLabel(missing, lang) : tr(lang, 'لا فجوة في المتطلبات الأساسية لهذا المسار', 'No gap in this pathway’s core requirements')}</strong>{match && <span>{tr(lang, 'للمسار: ', 'For pathway: ')}{match.title[lang]}</span>}</div>
    <div><small>{tr(lang, 'ما الذي أنفذه الآن', 'What I do now')}</small>{recommendation ? <><strong>{recommendation.task.title[lang]}</strong><button type="button" className="text-button" onClick={() => onOpenTask(recommendation.task.id)}><Play size={14}/>{recommendation.reason === 'continue' ? tr(lang, 'أكمل المهمة', 'Continue the task') : tr(lang, 'افتح المهمة', 'Open the task')}</button></> : <strong>{tr(lang, 'لا مهمة مقترحة الآن؛ راجع مساراتك', 'No task suggested now; review your pathways')}</strong>}</div>
  </section>
}

function TaskCard({ lang, task, record, open, onToggle, onUpdate }) {
  const id = useId()
  const [output, setOutput] = useState({ url: '', note: '' })
  const [review, setReview] = useState({ reviewerLabel: '', role: 'student', scope: '', decision: 'reviewed', note: '' })
  const [message, setMessage] = useState('')
  const status = record?.status || 'not-started'
  const proof = taskProof(record)
  const apply = (fn, done) => { try { onUpdate(fn); setMessage(done) } catch (error) { setMessage(errorText(error.message, lang)) } }
  return <article className={`task-card status-${status}`} data-task={task.id} data-status={status}>
    <button type="button" className="task-head" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
      <div><strong>{task.title[lang]}</strong><small>{task.skillIds.map(s => skillLabel(s, lang)).join(tr(lang, '، ', ', '))} · {task.hours} {tr(lang, 'ساعات تقريبًا', 'hours approx.')}</small></div>
      <span className={`task-status ${status}`}>{statusLabel[status][lang === 'ar' ? 0 : 1]}</span><ChevronDown size={16}/>
    </button>
    {open && <div id={`${id}-body`} className="task-body">
      <p>{task.why[lang]}</p>
      <div className="task-columns">
        <div><h4>{tr(lang, 'الخطوات', 'Steps')}</h4><ol>{task.steps.map((s, i) => <li key={i}>{s[lang]}</li>)}</ol></div>
        <div><h4>{tr(lang, 'المخرج المطلوب', 'Required output')}</h4><ul>{task.deliverables.map((d, i) => <li key={i}>{d[lang]}</li>)}</ul><p className="task-synthetic">{task.syntheticData[lang]}</p></div>
      </div>
      <div className="task-proof" data-testid="task-proof"><span>{tr(lang, 'إكمال المهمة: ', 'Task completion: ')}<b>{proof.completion ? tr(lang, 'مخرج مرفق (تصريح ذاتي)', 'output attached (self-declared)') : tr(lang, 'لا مخرج بعد', 'no output yet')}</b></span><span>{tr(lang, 'تقييم المخرج: ', 'Output evaluation: ')}<b>{proof.evaluation === 'local-declared-review' ? tr(lang, 'رأي مراجع محلي مصرح به', 'locally declared reviewer opinion') : proof.evaluation === 'self-assessment' ? tr(lang, 'تقييم ذاتي', 'self-assessment') : tr(lang, 'لا تقييم', 'none')}</b></span><span>{tr(lang, 'توثيق جهة الإصدار: ', 'Issuer verification: ')}<b>{tr(lang, 'غير متاح في هذه النسخة', 'not available in this release')}</b></span></div>
      {status === 'not-started' && <button type="button" className="button primary" onClick={() => apply(r => startTask(r, task.id), tr(lang, 'بدأت المهمة. يُحفظ تقدمك محليًا.', 'Task started. Progress is saved locally.'))}><Play size={16}/>{tr(lang, 'ابدأ المهمة', 'Start the task')}</button>}
      {status === 'needs-improvement' && <button type="button" className="button secondary" onClick={() => apply(r => startTask(r, task.id), tr(lang, 'عدت إلى التنفيذ.', 'Back in progress.'))}><Play size={16}/>{tr(lang, 'أكمل التحسين', 'Continue improving')}</button>}
      {status !== 'not-started' && <form className="task-form" onSubmit={e => { e.preventDefault(); apply(r => attachTaskOutput(r, task.id, output), tr(lang, 'أُرفق المخرج كتصريح ذاتي. لم يتغيّر مستوى الدليل.', 'Output attached as self-declared. The evidence level did not change.')); setOutput({ url: '', note: '' }) }}>
        <h4><Paperclip size={15}/> {tr(lang, 'أرفق مخرجًا', 'Attach an output')}</h4>
        <label htmlFor={`${id}-url`}>{tr(lang, 'رابط https — اختياري', 'https link — optional')}</label><input id={`${id}-url`} dir="ltr" value={output.url} onChange={e => setOutput(o => ({ ...o, url: e.target.value }))} placeholder="https://"/>
        <label htmlFor={`${id}-note`}>{tr(lang, 'وصف المخرج وما أنجزته بنفسك', 'Describe the output and what you did yourself')}</label><textarea id={`${id}-note`} rows={2} maxLength={400} value={output.note} onChange={e => setOutput(o => ({ ...o, note: e.target.value }))}/>
        <button className="button secondary" type="submit">{tr(lang, 'احفظ المخرج محليًا', 'Save output locally')}</button>
      </form>}
      {record?.outputs?.length > 0 && <ul className="task-outputs">{record.outputs.map((o, i) => <li key={i}>{o.url && <a href={o.url} target="_blank" rel="noopener noreferrer">{o.url}</a>}{o.note && <span>{o.note}</span>}<time dateTime={o.at}>{new Date(o.at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB')}</time></li>)}</ul>}
      {proof.completion && <fieldset className="task-rubric" data-testid="task-rubric"><legend>{tr(lang, 'معايير التقييم — قيّم نفسك أولًا', 'Rubric — assess yourself first')}</legend>
        {task.rubric.map(c => <div key={c.id} className="rubric-row"><span>{c.criterion[lang]}</span>{['meets', 'needs-improvement'].map(v => <label key={v}><input type="radio" name={`${id}-${c.id}`} checked={record?.selfAssessment?.[c.id] === v} onChange={() => apply(r => selfAssessTask(r, task.id, { [c.id]: v }), '')}/>{v === 'meets' ? tr(lang, 'مستوفى', 'Meets') : tr(lang, 'يحتاج تحسينًا', 'Needs improvement')}</label>)}</div>)}
      </fieldset>}
      {proof.completion && <form className="task-form task-review" onSubmit={e => { e.preventDefault(); apply(r => recordLocalTaskReview(r, task.id, review), tr(lang, 'سُجّل رأي المراجع محليًا كرأي مصرح به. لا يرفع مستوى الدليل.', 'Reviewer opinion recorded locally as self-declared. It does not raise the evidence level.')) }}>
        <h4><ClipboardCheck size={15}/> {tr(lang, 'مراجعة محلية للمخرج', 'Local review of the output')}</h4>
        <p>{task.reviewScope[lang]}. {tr(lang, 'الاسم والصفة إقرار محلي، ليسا هوية موثّقة ولا اعتمادًا.', 'Name and role are local declarations, not verified identity or approval.')}</p>
        <label htmlFor={`${id}-reviewer`}>{tr(lang, 'اسم المراجع أو اسمه المستعار', 'Reviewer name or alias')}</label><input id={`${id}-reviewer`} maxLength={60} value={review.reviewerLabel} onChange={e => setReview(r => ({ ...r, reviewerLabel: e.target.value }))}/>
        <label htmlFor={`${id}-role`}>{tr(lang, 'صفة المراجع', 'Reviewer role')}</label><select id={`${id}-role`} value={review.role} onChange={e => setReview(r => ({ ...r, role: e.target.value }))}>{REVIEWER_ROLES.map(role => <option key={role} value={role}>{roleLabel[role][lang === 'ar' ? 0 : 1]}</option>)}</select>
        <label htmlFor={`${id}-scope`}>{tr(lang, 'نطاق المراجعة', 'Review scope')}</label><input id={`${id}-scope`} maxLength={160} value={review.scope} onChange={e => setReview(r => ({ ...r, scope: e.target.value }))} placeholder={task.reviewScope[lang]}/>
        <label htmlFor={`${id}-decision`}>{tr(lang, 'النتيجة', 'Outcome')}</label><select id={`${id}-decision`} value={review.decision} onChange={e => setReview(r => ({ ...r, decision: e.target.value }))}><option value="reviewed">{tr(lang, 'روجع — يستوفي المعايير', 'Reviewed — meets the rubric')}</option><option value="needs-improvement">{tr(lang, 'يحتاج تحسينًا', 'Needs improvement')}</option></select>
        <label htmlFor={`${id}-rnote`}>{tr(lang, 'ملاحظة المراجع', 'Reviewer note')}</label><textarea id={`${id}-rnote`} rows={2} maxLength={400} value={review.note} onChange={e => setReview(r => ({ ...r, note: e.target.value }))}/>
        <button className="button secondary" type="submit" disabled={review.reviewerLabel.trim().length < 2}>{tr(lang, 'سجّل المراجعة محليًا', 'Record review locally')}</button>
      </form>}
      {record?.reviews?.length > 0 && <ul className="task-reviews">{record.reviews.map((r, i) => <li key={i}><b>{r.reviewerLabel}</b> · {roleLabel[r.role][lang === 'ar' ? 0 : 1]} · {r.decision === 'reviewed' ? tr(lang, 'روجع', 'reviewed') : tr(lang, 'يحتاج تحسينًا', 'needs improvement')}{r.scope && <> · {r.scope}</>}{r.note && <p>{r.note}</p>}</li>)}</ul>}
      {message && <p role="status">{message}</p>}
    </div>}
  </article>
}

const errorText = (code, lang) => code.startsWith('TASK_OUTPUT_URL') ? tr(lang, 'الرابط يجب أن يبدأ بـ https:// أو اتركه فارغًا.', 'The link must start with https:// or be left empty.')
  : code === 'TASK_OUTPUT_REQUIRED' ? tr(lang, 'أضف رابطًا أو وصفًا من عشرة أحرف على الأقل.', 'Add a link or a description of at least ten characters.')
  : tr(lang, 'تعذر حفظ التغيير. راجع الحقول.', 'Could not save the change. Check the fields.')

export default function TaskLoop({ lang, state, matches = [], onUpdate, focusTaskId = null }) {
  const [openId, setOpenId] = useState(focusTaskId)
  const records = normalizeTaskProgress(state.tasks)
  const match = matches.find(m => state.goal && (m.goals || []).includes(state.goal)) || matches[0]
  const relevant = new Set(match?.missingSkills || [])
  const ordered = [...taskCatalog].sort((a, b) => Number(b.skillIds.some(s => relevant.has(s))) - Number(a.skillIds.some(s => relevant.has(s))))
  const update = fn => onUpdate(fn(records))
  return <section className="panel task-loop" data-testid="task-loop" aria-label={tr(lang, 'المهمة والدليل والمراجعة', 'Task, evidence and review')}>
    <div className="panel-head"><div><small>{tr(lang, 'المهمة → الدليل → المراجعة', 'TASK → EVIDENCE → REVIEW')}</small><h3><ListChecks size={18}/> {tr(lang, 'مهمة واحدة لكل فجوة', 'One task per gap')}</h3></div></div>
    <p>{tr(lang, 'كل مهمة تنتج مخرجًا يمكن لمراجع فحصه. إكمال المهمة وتقييم المخرج وتوثيق جهة الإصدار ثلاثة أشياء مختلفة، ولا يرفع أي منها مستوى الدليل فوق «تصريح ذاتي» في هذه النسخة.', 'Each task produces an output a reviewer can inspect. Completing the task, evaluating the output and issuer verification are three different things; none raises the evidence level above self-declared in this release.')}</p>
    <div className="task-list">{ordered.map(task => <TaskCard key={task.id} lang={lang} task={task} record={records.find(r => r.taskId === task.id) || null} open={openId === task.id} onToggle={() => setOpenId(openId === task.id ? null : task.id)} onUpdate={update}/>)}</div>
    <small className="task-governance">{tr(lang, `نطاق تصميم مقترح: ${TASK_GOVERNANCE.validityScope} مالك المراجعة: ${TASK_GOVERNANCE.reviewOwner}.`, `Design proposal scope: ${TASK_GOVERNANCE.validityScope} Review owner: ${TASK_GOVERNANCE.reviewOwner}.`)}</small>
  </section>
}
