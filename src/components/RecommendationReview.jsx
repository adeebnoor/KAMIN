import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { MessageSquareWarning, ClipboardCheck, Undo2, Download } from 'lucide-react'
import { skills } from '../data.js'
import { pageHref } from '../../public/site-content.js'
import {
  MAX_REVIEWS, REVIEW_CHECKS, describeRecommendation, recommendationSeed, fingerprintRecommendation,
  createRecommendationReview, recommendationReviewStatus, withdrawRecommendationReview, buildRedTeamCandidate,
} from '../review/recommendations.js'
import './recommendation-review.css'

const t = (lang, ar, en) => lang === 'ar' ? ar : en
const actions = {
  accepted: ['أقبلها كخطوة استكشافية', 'Accept as an exploratory step'],
  rejected: ['أرفض التوصية الحالية', 'Reject this recommendation'],
  contested: ['أعترض على هذا الحكم', 'Contest this judgment'],
  unresolved: ['لم أحسم بعد', 'Still unresolved'],
  withdrawn: ['سُحب القرار المحلي', 'Local decision withdrawn'],
  unreviewed: ['لم تُراجع بعد', 'Not reviewed yet'],
  outdated: ['تغيّرت المدخلات أو التوصية؛ أعد المراجعة', 'Inputs or recommendation changed; review again'],
  imported: ['مراجعة مستعادة؛ يلزم تأكيد جديد', 'Restored review; fresh confirmation needed'],
}
const reasons = {
  reviewed: ['مراجعة الدليل والخطوة التالية', 'Evidence and next step reviewed'],
  'wrong-evidence': ['الدليل لا يمثل ما درسته أو أنجزته', 'Evidence does not represent my work'],
  'wrong-mapping': ['ربط الدليل بالقدرة غير مناسب', 'Evidence-to-capability mapping is unsuitable'],
  'missing-evidence': ['دليل مهم مفقود', 'Relevant evidence is missing'],
  'outdated-source': ['المصدر أو المتطلب قديم', 'Source or requirement is outdated'],
  'unclear-explanation': ['التفسير غير واضح أو غير كافٍ', 'Explanation is unclear or insufficient'],
  'goal-mismatch': ['الخطوة لا تخدم هدفي الحالي', 'Step does not serve my current goal'],
  other: ['سبب آخر — اشرحه دون معلومات حساسة', 'Other — explain without sensitive information'],
}
const checks = {
  evidence: ['راجعت المصدر والمتطلبات والدليل الموجود أو المفقود.', 'I reviewed the source, requirements and present or missing evidence.'],
  goal: ['قارنت هذه الخطوة بهدفي وظروفي الحالية.', 'I compared this step with my current goal and circumstances.'],
  limits: ['فهمت حدود الحكم؛ قبولي لا يثبت مهارة أو أهلية مهنية.', 'I understand the limits; accepting does not establish a skill or professional eligibility.'],
}
const label = (entries, value, lang) => entries[value]?.[lang === 'ar' ? 0 : 1] || value
const blank = () => ({ action: 'unresolved', reason: 'unclear-explanation', note: '', reviewer: { label: '', role: 'student' }, confidence: 'unsure', checks: [] })

function exportCandidate(record) {
  const content = JSON.stringify(buildRedTeamCandidate(record), null, 2)
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = `kamin-review-candidate-${record.targetId}.json`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function RecommendationReview({ item, kind = 'pathway', state, lang, onSave }) {
  const id = useId()
  const seed = recommendationSeed(item, kind, state)
  const descriptor = useMemo(() => describeRecommendation(item, kind, state), [seed])
  const records = state.recommendationReviews || []
  const latest = records.find(r => r.key === descriptor.key)
  const [fingerprint, setFingerprint] = useState(null)
  const [hashError, setHashError] = useState(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(blank)
  const [message, setMessage] = useState('')
  const [timed, setTimed] = useState(false)
  const timer = useRef(null)
  const firstField = useRef(null)
  useEffect(() => {
    let current = true
    setFingerprint(null); setHashError(false); setTimed(false); timer.current = null
    setDraft(blank()); setMessage('')
    fingerprintRecommendation(seed).then(value => { if (current) setFingerprint(value) }).catch(() => { if (current) setHashError(true) })
    return () => { current = false }
  }, [seed])
  useEffect(() => {
    const markInterrupted = () => { if (timer.current && document.hidden) timer.current.interrupted = true }
    document.addEventListener('visibilitychange', markInterrupted)
    return () => document.removeEventListener('visibilitychange', markInterrupted)
  }, [])
  useEffect(() => { if (open) firstField.current?.focus() }, [open])
  const status = recommendationReviewStatus(latest, fingerprint)
  const start = contest => {
    setDraft({ ...blank(), action: contest ? 'contested' : 'unresolved', reviewer: latest?.reviewer || blank().reviewer })
    setMessage(''); setTimed(false); timer.current = null; setOpen(true)
  }
  const close = () => { setOpen(false); setTimed(false); timer.current = null }
  const limit = records.length >= MAX_REVIEWS
  const canSave = fingerprint && !limit && draft.reviewer.label.trim().length >= 2
    && (!['accepted', 'rejected'].includes(draft.action) || draft.checks.length === REVIEW_CHECKS.length)
    && (draft.reason !== 'other' || draft.note.trim().length >= 5)
  const save = event => {
    event.preventDefault()
    if (!canSave) return
    try {
      const elapsed = timer.current ? performance.now() - timer.current.start : null
      const timing = elapsed !== null && elapsed <= 3600000 ? { consented: true, elapsedMs: elapsed, interrupted: timer.current.interrupted } : null
      onSave(createRecommendationReview({ descriptor, fingerprint, draft, timing, previousId: latest?.id || null }))
      close(); setMessage(t(lang, 'سُجلت مراجعتك محليًا. لم تُرسل إلى أحد ولم تتغير أدلة قدراتك.', 'Your review was recorded locally. Nothing was sent and your capability evidence did not change.'))
    } catch { setMessage(t(lang, 'تعذر تسجيل المراجعة. راجع الحقول وحدّ السجل ثم حاول مجددًا.', 'Could not record the review. Check the fields and history limit, then retry.')) }
  }
  const withdraw = () => {
    if (!latest || limit) return
    onSave(withdrawRecommendationReview(latest)); close()
    setMessage(t(lang, 'سُحب القرار. يبقى الحدث السابق في سجل المراجعة، ويمكنك بدء مراجعة جديدة.', 'Decision withdrawn. The earlier event remains in review history; you can start a new review.'))
  }
  return <section className="recommendation-review" data-review-key={descriptor.key} aria-label={t(lang, `مراجعة توصية ${item.title.ar}`, `Review recommendation: ${item.title.en}`)}>
    <div className="review-heading"><ClipboardCheck size={18}/><strong>{t(lang, 'قرارك ومراجعتك', 'Your decision & review')}</strong></div>
    <p className="review-status">{label(actions, status, lang)}</p>
    <div className="review-actions">
      <button type="button" className="text-button" aria-expanded={open} aria-controls={`${id}-form`} onClick={() => start(false)}>{t(lang, 'راجع هذا الحكم', 'Review this judgment')}</button>
      <button type="button" className="text-button" aria-expanded={open} aria-controls={`${id}-form`} onClick={() => start(true)}><MessageSquareWarning size={16}/>{t(lang, 'أعترض على هذا الحكم', 'Contest this judgment')}</button>
      {latest && latest.action !== 'withdrawn' && <button type="button" className="text-button" disabled={limit} onClick={withdraw}><Undo2 size={16}/>{t(lang, 'اسحب قراري', 'Withdraw my decision')}</button>}
    </div>
    {open && <form id={`${id}-form`} className="review-form" onSubmit={save}>
      <h4 ref={firstField} tabIndex={-1}>{t(lang, 'ما الذي يلزم قبل قبول هذه الخطوة؟', 'What should I check before accepting this step?')}</h4>
      <p>{t(lang, 'راجع أدلة هذه التوصية وفجواتها أعلاه. غياب الدليل لا يعني غياب القدرة. الاعتراض يبقى على جهازك ولا يُرسل إلى مستشار أو فريق كامن.', 'Review this recommendation’s evidence and gaps above. Missing evidence does not mean missing ability. A contest stays on your device; it is not sent to an advisor or the Kamin team.')}</p>
      <div className="review-requirements">{descriptor.requirements.length ? descriptor.requirements.map(r => <span key={r.id}>{skills[r.id]?.labels?.[lang] || r.id}: {r.supported ? t(lang, 'له مسار دليل', 'evidence path present') : t(lang, 'دليله مفقود', 'evidence missing')}</span>) : <span>{t(lang, 'لا متطلب قدرة مسبق في هذا المثال؛ تحقق من شروط الجهة.', 'No capability prerequisite in this example; check the provider’s conditions.')}</span>}</div>
      <p><a href={descriptor.source?.url || pageHref('mapping.html', lang)} target="_blank" rel="noreferrer">{t(lang, 'راجع المصدر وحدود الربط', 'Review the source and mapping limits')}</a> · <span>{descriptor.ruleVersion}</span></p>
      <fieldset><legend>{t(lang, 'معايير قبول هذه التوصية', 'Acceptance checks for this recommendation')}</legend>{REVIEW_CHECKS.map(check => <label className="review-check" key={check}><input type="checkbox" checked={draft.checks.includes(check)} onChange={e => setDraft(d => ({ ...d, checks: e.target.checked ? [...d.checks, check] : d.checks.filter(c => c !== check) }))}/><span>{label(checks, check, lang)}</span></label>)}</fieldset>
      <label htmlFor={`${id}-decision`}>{t(lang, 'قراري الآن', 'My decision now')}</label><select id={`${id}-decision`} value={draft.action} onChange={e => setDraft(d => ({ ...d, action: e.target.value, reason: e.target.value === 'accepted' ? 'reviewed' : 'unclear-explanation' }))}>{['unresolved', 'accepted', 'rejected', 'contested'].map(action => <option key={action} value={action}>{label(actions, action, lang)}</option>)}</select>
      <label htmlFor={`${id}-reason`}>{t(lang, 'سبب القرار أو الاعتراض', 'Reason for the decision or contest')}</label><select id={`${id}-reason`} value={draft.reason} onChange={e => setDraft(d => ({ ...d, reason: e.target.value }))}>{Object.keys(reasons).filter(r => r !== 'reviewed' || draft.action === 'accepted').map(reason => <option key={reason} value={reason}>{label(reasons, reason, lang)}</option>)}</select>
      <label htmlFor={`${id}-note`}>{t(lang, 'ملاحظة محلية — اختيارية إلا عند اختيار «سبب آخر»', 'Local note — optional except for “Other”')}</label><textarea id={`${id}-note`} rows={3} maxLength={600} value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} placeholder={t(lang, 'تجنب الأرقام الجامعية والدرجات والمعلومات الحساسة.', 'Avoid student IDs, grades and sensitive information.')}/>
      <label htmlFor={`${id}-reviewer`}>{t(lang, 'اسم المراجع أو اسمه المستعار — محلي', 'Reviewer name or alias — local')}</label><input id={`${id}-reviewer`} minLength={2} maxLength={60} required autoComplete="off" value={draft.reviewer.label} onChange={e => setDraft(d => ({ ...d, reviewer: { ...d.reviewer, label: e.target.value } }))}/>
      <label htmlFor={`${id}-role`}>{t(lang, 'صفة المراجع المصرّح بها', 'Self-declared reviewer role')}</label><select id={`${id}-role`} value={draft.reviewer.role} onChange={e => setDraft(d => ({ ...d, reviewer: { ...d.reviewer, role: e.target.value } }))}><option value="student">{t(lang, 'الطالب / صاحب الملف', 'Student / profile owner')}</option><option value="advisor">{t(lang, 'مستشار يراجع معي على هذا الجهاز', 'Advisor reviewing with me on this device')}</option></select>
      <p className="review-note">{t(lang, 'الاسم والصفة إقرار محلي، وليسا هوية موثّقة أو اعتمادًا مؤسسيًا.', 'The name and role are local declarations, not verified identity or institutional approval.')}</p>
      <label htmlFor={`${id}-confidence`}>{t(lang, 'ثقتي في قراري', 'Confidence in my decision')}</label><select id={`${id}-confidence`} value={draft.confidence} onChange={e => setDraft(d => ({ ...d, confidence: e.target.value }))}><option value="unsure">{t(lang, 'غير واثق', 'Unsure')}</option><option value="partly">{t(lang, 'واثق جزئيًا', 'Partly confident')}</option><option value="confident">{t(lang, 'واثق وأستطيع شرح السبب', 'Confident and able to explain why')}</option></select>
      <label className="review-check"><input type="checkbox" checked={timed} onChange={e => { setTimed(e.target.checked); timer.current = e.target.checked ? { start: performance.now(), interrupted: document.hidden } : null }}/><span>{t(lang, 'ابدأ قياس وقت هذه المراجعة — اختياري ومحلي، من هذه اللحظة حتى حفظ القرار.', 'Start timing this review — optional and local, from this moment until saving the decision.')}</span></label>
      {timed && <p className="review-note">{t(lang, 'بدأ القياس. مغادرة تبويب المتصفح تعلّم المحاولة كمنقطعة. الوقت إشارة وصفية، وليس نتيجة دراسة أو إثبات جودة.', 'Timing started. Leaving this browser tab marks an interruption. Time is descriptive, not a study result or proof of quality.')}</p>}
      <p className="review-note">{t(lang, 'القبول والرفض يتطلبان مراجعة المعايير الثلاثة. تستطيع تسجيل اعتراض أو ترك النتيجة غير محسومة دون استكمالها.', 'Acceptance and rejection require all three checks. You can contest or leave the result unresolved without completing them.')}</p>
      {hashError && <p role="alert">{t(lang, 'تعذر ربط المراجعة بنسخة التوصية. أعد فتح الشاشة للمحاولة.', 'Could not bind this review to the recommendation version. Reopen this screen to retry.')}</p>}
      {limit && <p role="alert">{t(lang, 'وصل السجل إلى 200 حدث. صدّر نسخة مشفّرة ثم امسح المراجعات من الخصوصية للمتابعة.', 'History reached 200 events. Export an encrypted backup, then clear reviews in Privacy to continue.')}</p>}
      <div className="review-actions"><button className="button primary" type="submit" disabled={!canSave}>{t(lang, 'احفظ المراجعة محليًا', 'Save review locally')}</button><button className="button secondary" type="button" onClick={close}>{t(lang, 'إلغاء', 'Cancel')}</button></div>
    </form>}
    {latest?.action === 'contested' && <div className="review-candidate"><p>{t(lang, 'اعتراضك حالة غير مؤكدة. يمكنك تنزيل مرشح فحص يحتوي رمز المسار والقاعدة ونوع المشكلة فقط، دون الاسم أو الملاحظة أو بيانات الملف. لا يُرسل تلقائيًا.', 'Your contest is unverified. Download a test candidate with the target, rule and issue type only, excluding names, notes and profile data. It is not submitted automatically.')}</p><button type="button" className="text-button" onClick={() => { try { exportCandidate(latest) } catch { setMessage(t(lang, 'تعذر التنزيل. حاول مرة أخرى.', 'Download failed. Please retry.')) } }}><Download size={16}/>{t(lang, 'صدّر مرشح فحص بلا بيانات الملف', 'Export test candidate without profile data')}</button></div>}
    {message && <p role="status">{message}</p>}
  </section>
}

export function RecommendationReviewHistory({ records, lang }) {
  return <section className="panel review-history"><h3>{t(lang, 'سجل مراجعة التوصيات', 'Recommendation review history')}</h3><p>{t(lang, 'أحداث محلية تاريخية، وليست أدلة مهارة. افتح التوصية لمعرفة صلاحية آخر قرار لمدخلاتك الحالية. تشملها النسخة المشفّرة؛ لا تدخل رابط مشاركة القدرات أو الرسم المعرفي.', 'Historical local events, not skill evidence. Open the recommendation to see whether the latest decision applies to your current inputs. Included in the encrypted backup; excluded from capability-sharing links and the knowledge graph.')}</p>{records.length ? <ol>{records.map(r => <li key={r.id}><h4>{r.title[lang]}</h4><p>{label(actions, r.action, lang)} · {r.reviewer.label} · {t(lang, r.reviewer.role === 'advisor' ? 'صفة مستشار مصرح بها' : 'صاحب الملف', r.reviewer.role === 'advisor' ? 'self-declared advisor' : 'profile owner')}</p><p>{label(reasons, r.reason, lang)}{r.note ? ` — ${r.note}` : ''}</p><small>{new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', {dateStyle:'medium',timeStyle:'short'}).format(new Date(r.createdAt))}{r.imported && t(lang, ' · مستعاد، يحتاج مراجعة جديدة', ' · restored, needs fresh review')}{r.timing && t(lang, ` · ${Math.round(r.timing.elapsedMs/1000)} ثانية${r.timing.interrupted?' · محاولة منقطعة':''}`, ` · ${Math.round(r.timing.elapsedMs/1000)} seconds${r.timing.interrupted?' · interrupted attempt':''}`)}</small></li>)}</ol> : <p>{t(lang, 'لا توجد مراجعات مسجلة بعد.', 'No reviews recorded yet.')}</p>}</section>
}
