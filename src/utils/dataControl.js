// Task 06 · clear, provable deletion and consent withdrawal.
// Supervisor (31 Oct, 10 Nov): show how a student deletes data and withdraws consent; consent is
// per purpose and revocable; evidence without a source must drop.
//
// Pure functions: each returns the next state plus a summary that names what was deleted, which
// capabilities dropped, which judgments were recomputed and what stayed. Every operation goes
// through recomputeProfile (Task 04). The audit line holds only the operation type and counts,
// never the deleted content. Loaded lazily (Privacy / My data chunks).
import { recomputeProfile, describeDiff } from '../evidence/recompute.js'
import { mergeNeedsReview } from '../evidence/needsReview.js'
import { profileSkills } from './engine.js'
import { canonicalCourseCode } from '../ontology/registry.js'
import { emptyInsightState, preferenceCount } from '../insight.js'
import { normalizeFreeInterests } from '../interests/freeInterestState.js'
import { DIGITAL_TOPICS, emptyDigitalInterests, normalizeDigitalInterests, removeDigitalInterest } from '../digitalInterests.js'
import { projectStateToPerson360 } from '../ontology/projector.js'
import { sweepOrphans } from '../person360.js'
import { buildMatchingProfile, matchTargets } from '../matching/engine.js'
import { inferTranscriptSsces } from '../reference/ssce.js'
import { KAMIN_LOCAL_DB, KAMIN_LOCAL_STORE, KAMIN_LOCAL_KEY } from './localProfileStore.js'
import { cleanAuditEntries } from './auditPrivacy.js'
import { normalizePlan, removeFromPlan } from '../plan/plan.js'
import { planItemTitle } from '../plan/catalogCheck.js'
import { copy } from '../i18n.js'

export const DATA_CONTROL_VERSION = 'kamin-data-control-v1'
const both = (ar, en) => ({ ar, en })
const list = (items, lang) => items.join(lang === 'ar' ? '، ' : ', ')
const quote = (text, lang) => lang === 'ar' ? `«${text}»` : `“${text}”`
const label = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.ar || value?.en || ''

const KIND = {
  course: both('مقرر', 'course'),
  project: both('دليل تطبيقي مصرّح', 'self-declared project'),
  credential: both('اعتماد مستورد', 'imported credential'),
  interest: both('اهتمام رقمي مؤكد', 'confirmed digital interest'),
  'free-interest': both('اهتمام بكلماتك', 'interest in your own words'),
  'plan-item': both('خطوة محفوظة في خطتي', 'saved step in My plan'),
}
const PURPOSE = {
  analyze: both('تحليل السجل وبناء ملف المهارات', 'transcript analysis and skills profile'),
  insight: both('ملف القدرات 360° (الاهتمامات والتفضيلات والهدف)', 'Capability Profile 360° (interests, preferences and goal)'),
  digital: both('تحليل النشاط الرقمي لاقتراح الاهتمامات', 'digital-activity analysis for interest suggestions'),
  advisor: both('المشاركة مع المرشد (عرض تجريبي)', 'advisor sharing (demonstration)'),
  research: both('المشاركة البحثية (عرض تجريبي)', 'research sharing (demonstration)'),
}
const REGRANT = both('إن منحت الموافقة مجددًا فلن تعود البيانات المحذوفة؛ ستضيفها من جديد إن أردت.', 'If you grant consent again, the deleted data does not come back; you would add it again yourself.')

// Fit judgments before and after, so the summary can say which ones were recomputed and changed.
function judgments(state) {
  const skills = profileSkills(state)
  const graph = projectStateToPerson360({ state, skills, educationClassification: state?.approved ? inferTranscriptSsces(state.courses || []) : { primary: null } })
  return new Map(matchTargets(buildMatchingProfile({ graph }), { lang: 'ar' }).map(m => [m.id, { judgment: m.judgment, title: m.title }]))
}
function judgmentChanges(prev, next) {
  const before = judgments(prev), after = judgments(next)
  const changed = [...after].filter(([id, j]) => before.get(id)?.judgment !== j.judgment).map(([, j]) => j.title)
  return { total: after.size, changed }
}
function judgmentSentence(j, lang) {
  if (!j.changed.length) return lang === 'ar' ? `أُعيد حساب ${j.total} حكم ملاءمة، ولم يتغير أي حكم.` : `${j.total} fit judgments were recomputed; none changed.`
  const names = list(j.changed.slice(0, 5).map(t => quote(label(t, lang), lang)), lang)
  const more = j.changed.length > 5 ? (lang === 'ar' ? ` و${j.changed.length - 5} غيرها` : ` and ${j.changed.length - 5} more`) : ''
  return lang === 'ar' ? `أُعيد حساب ${j.total} حكم ملاءمة؛ تغيّر حكم: ${names}${more}.` : `${j.total} fit judgments were recomputed; changed: ${names}${more}.`
}

// Derived items may only point at things that still exist: drop "needs review" flags for a
// deleted project and keep the rest consistent with the remaining capabilities.
function tidy(state, skills) {
  const projectIds = new Set((state.projects || []).map(p => p.id))
  const needsReview = mergeNeedsReview((state.needsReview || []).filter(item => item.kind !== 'project' || projectIds.has(item.id)), [], skills)
  return { ...state, needsReview }
}

function finish(prev, nextRaw, { operation, removedLines, keptLines, audit, extraLines = [], lang = 'ar' }) {
  const result = recomputeProfile(prev, nextRaw)
  const state = tidy({ ...nextRaw, needsReview: mergeNeedsReview(nextRaw.needsReview, result.diff.staleDerived, result.skills) }, result.skills)
  const j = judgmentChanges(prev, state)
  const capability = { ...result.diff, droppedEvidence: result.diff.droppedEvidence.filter(d => !result.diff.removed.some(r => r.skillId === d.skillId)) }
  const sentences = {}
  for (const lang of ['ar', 'en']) {
    sentences[lang] = [...removedLines[lang], ...extraLines.map(l => l[lang]), ...describeDiff(capability, lang), judgmentSentence(j, lang), ...keptLines[lang]]
  }
  const ts = Date.now()
  return {
    // Task 46: delete and withdraw also remove older usage-log lines that named what was deleted (the old
    // upload and project lines copied a file name or a project title; today's lines never do).
    state: { ...state, audit: [{ label: audit[lang] || audit.ar, ts }, ...cleanAuditEntries(state.audit, 99)] },
    diff: result.diff,
    summary: { operation, version: DATA_CONTROL_VERSION, droppedCapabilities: result.diff.removed.map(r => r.labels), judgments: j, sentences, audit },
  }
}

/**
 * Delete one item (course, project, credential, confirmed digital interest, interest in the
 * student's own words, or a saved step of My plan).
 * @param {object} state
 * @param {{kind:'course'|'project'|'credential'|'interest'|'free-interest'|'plan-item', id:string}} item
 */
export function deleteItem(state, { kind, id } = {}, { lang = 'ar' } = {}) {
  const prev = state || {}
  if (kind === 'plan-item') return deletePlanItem(prev, id, lang)
  let next = prev, name = ''
  if (kind === 'course') {
    const code = canonicalCourseCode(id)
    const row = (prev.courses || []).find(c => canonicalCourseCode(c.code) === code)
    if (!row) throw new Error('ITEM_NOT_FOUND')
    name = code
    next = { ...prev, courses: prev.courses.filter(c => c !== row) }
  } else if (kind === 'project') {
    const project = (prev.projects || []).find(p => p.id === id)
    if (!project) throw new Error('ITEM_NOT_FOUND')
    name = project.title
    next = { ...prev, projects: prev.projects.filter(p => p !== project) }
  } else if (kind === 'credential') {
    const credential = (prev.credentials || []).find(c => c.id === id)
    if (!credential) throw new Error('ITEM_NOT_FOUND')
    name = credential.achievements?.[0]?.name || credential.issuerName || ''
    next = { ...prev, credentials: prev.credentials.filter(c => c !== credential) }
  } else if (kind === 'interest') {
    const digital = normalizeDigitalInterests(prev.insight?.digitalInterests)
    const item = digital.confirmed.find(i => i.topicId === id)
    if (!item) throw new Error('ITEM_NOT_FOUND')
    const topic = DIGITAL_TOPICS.find(t => t.id === id)
    name = topic?.label || id
    next = { ...prev, insight: { ...(prev.insight || emptyInsightState()), digitalInterests: removeDigitalInterest(digital, id) } }
  } else if (kind === 'free-interest') {
    // Task 56: the entry goes with its text and all its chips.
    const free = normalizeFreeInterests(prev.insight?.freeInterests)
    const entry = free.find(e => e.id === id)
    if (!entry) throw new Error('ITEM_NOT_FOUND')
    const text = entry.text.trim()
    name = [...text].length > 60 ? `${[...text].slice(0, 60).join('')}…` : text
    next = { ...prev, insight: { ...(prev.insight || emptyInsightState()), freeInterests: free.filter(e => e !== entry) } }
  } else throw new Error('UNKNOWN_ITEM_KIND')

  const kept = {
    course: both('بقيت مقرراتك الأخرى واهتماماتك وهدفك كما هي.', 'Your other courses, interests and goal stayed as they were.'),
    project: both('بقيت مقرراتك وقدراتك الأكاديمية كما هي؛ الدليل المصرّح لم يكن يغيّر مستوى الدليل.', 'Your courses and academic capabilities stayed; a self-declared project never changed an evidence level.'),
    credential: both('بقيت مقرراتك وقدراتك الأكاديمية كما هي.', 'Your courses and academic capabilities stayed as they were.'),
    interest: both('بقيت أدلتك الأكاديمية وقدراتك كما هي؛ الاهتمام كان سياقًا للشرح فقط.', 'Your academic evidence and capabilities stayed; an interest was only context for explanations.'),
    'free-interest': both('بقيت أدلتك الأكاديمية وقدراتك كما هي؛ كلماتك كانت توجّه الاقتراحات فقط ولم تُحتسب دليلًا.', 'Your academic evidence and capabilities stayed; your words only guided suggestions and were never counted as evidence.'),
  }[kind]
  const what = typeof name === 'object' ? name : both(name, name)
  return finish(prev, next, {
    operation: 'delete-item',
    removedLines: {
      ar: [`حُذف ${KIND[kind].ar} ${quote(label(what, 'ar'), 'ar')} من هذا الجهاز.`],
      en: [`Deleted the ${KIND[kind].en} ${quote(label(what, 'en'), 'en')} from this device.`],
    },
    keptLines: { ar: [kept.ar], en: [kept.en] },
    lang,
    audit: both(`حذف عنصر: ${KIND[kind].ar} (1)`, `Item deleted: ${KIND[kind].en} (1)`),
  })
}

// Task 58: a saved step is the student's own choice, never evidence, so removing it recomputes nothing
// (no capability or fit judgment can change). The summary names the step for the student; the usage-log
// line is "Next step removed", without its title.
function deletePlanItem(prev, itemId, lang) {
  const plan = normalizePlan(prev).plan
  if (!plan.some(p => p.itemId === itemId)) throw new Error('ITEM_NOT_FOUND')
  const title = planItemTitle(itemId)
  const audit = both(copy.ar.plan.removed, copy.en.plan.removed)
  const next = removeFromPlan(prev, itemId, { lang })
  const sentences = {}
  for (const l of ['ar', 'en']) {
    const removed = title
      ? (l === 'ar' ? `حُذفت ${KIND['plan-item'].ar} ${quote(title.ar, 'ar')} من هذا الجهاز.` : `Deleted the ${KIND['plan-item'].en} ${quote(title.en, 'en')} from this device.`)
      : (l === 'ar' ? `حُذفت ${KIND['plan-item'].ar} من هذا الجهاز.` : `Deleted a ${KIND['plan-item'].en} from this device.`)
    const kept = l === 'ar'
      ? 'بقيت أدلتك الأكاديمية وقدراتك وأهدافك كما هي؛ الخطوة المحفوظة كانت اختيارك ولم تُحتسب دليلًا، فلم يُعَد حساب شيء.'
      : 'Your academic evidence, capabilities and goals stayed; a saved step was your own choice and never counted as evidence, so nothing was recomputed.'
    sentences[l] = [removed, kept]
  }
  return {
    state: { ...next, audit: [{ label: audit[lang] || audit.ar, ts: Date.now() }, ...cleanAuditEntries(prev.audit, 99)] },
    diff: { added: [], removed: [], changed: [], droppedEvidence: [], staleDerived: [] },
    summary: { operation: 'delete-item', version: DATA_CONTROL_VERSION, droppedCapabilities: [], judgments: { total: 0, changed: [] }, sentences, audit },
  }
}

/**
 * Withdraw consent for one purpose. 'analyze' removes the record and everything built on it;
 * 'insight' removes interests, preferences and goal; advisor/research are demonstration switches.
 */
export function withdrawConsent(state, purpose, { lang = 'ar' } = {}) {
  const prev = state || {}
  if (!PURPOSE[purpose]) throw new Error('UNKNOWN_PURPOSE')
  if (purpose === 'analyze') {
    const courses = (prev.courses || []).map(c => canonicalCourseCode(c.code))
    const projects = (prev.projects || []).map(p => p.title)
    const n = { reviews: (prev.recommendationReviews || []).length, tasks: (prev.tasks || []).length, credentials: (prev.credentials || []).length }
    const skillCount = profileSkills(prev).length
    // Task 55: the college and major printed on the transcript go with it.
    const next = { ...prev, courses: [], approved: false, collegeRaw: null, major: null, recommendationReviews: [], projects: [], tasks: [], credentials: [], needsReview: [], consents: { ...prev.consents, analyze: false } }
    return finish(prev, next, {
      operation: 'withdraw-analyze',
      removedLines: {
        ar: [`أزيل ${courses.length} مقررًا و${skillCount} قدرة مشتقة من السجل من الحساب الحالي.`, ...(courses.length ? [`المقررات المحذوفة: ${list(courses, 'ar')}.`] : []), `حُذف معها: ${projects.length} دليل تطبيقي مصرّح${projects.length ? ` (${list(projects.map(t => quote(t, 'ar')), 'ar')})` : ''}، ${n.tasks} سجل مهام، ${n.credentials} اعتماد مستورد، ${n.reviews} مراجعة توصيات.`],
        en: [`${courses.length} course(s) and ${skillCount} derived capability/capabilities were removed from the current calculation.`, ...(courses.length ? [`Deleted courses: ${list(courses, 'en')}.`] : []), `Removed with it: ${projects.length} self-declared project(s)${projects.length ? ` (${list(projects.map(t => quote(t, 'en')), 'en')})` : ''}, ${n.tasks} task record(s), ${n.credentials} imported credential(s), ${n.reviews} recommendation review(s).`],
      },
      keptLines: { ar: ['بقي كما هو: اهتماماتك وتفضيلاتك وهدفك واختيار الحفظ على هذا الجهاز. يمكنك رفع سجلك من جديد في أي وقت.', REGRANT.ar], en: ['Kept as they were: your interests, preferences, goal and device-saving choice. You can upload your record again at any time.', REGRANT.en] },
      lang,
      audit: both(`سحب موافقة تحليل السجل: حُذف ${courses.length} مقرر، ${projects.length} دليل تطبيقي، ${n.tasks} مهمة، ${n.credentials} اعتماد، ${n.reviews} مراجعة`, `Transcript-analysis consent withdrawn: ${courses.length} course(s), ${projects.length} project(s), ${n.tasks} task(s), ${n.credentials} credential(s), ${n.reviews} review(s) deleted`),
    })
  }
  if (purpose === 'insight') {
    const preferences = preferenceCount(prev.insight?.declaredPreferences) // Task 78: each chosen chip counts
    const interests = normalizeDigitalInterests(prev.insight?.digitalInterests).confirmed.map(i => DIGITAL_TOPICS.find(t => t.id === i.topicId)?.label).filter(Boolean)
    const free = normalizeFreeInterests(prev.insight?.freeInterests).length // Task 56: emptyInsightState() removes them too
    const reviews = (prev.recommendationReviews || []).length
    const goal = !!prev.goal
    // Task 58: the goals, the saved steps of My plan and the "not for me" marks go with this consent.
    const { goals, plan, notForMe: marks, roadmapDone } = normalizePlan(prev)
    // Task 79: the ticked roadmap items go with the plan.
    const next = { ...prev, goal: null, goals: [], plan: [], notForMe: [], planDropped: 0, roadmapDone: [], insight: emptyInsightState(), recommendationReviews: [], consents: { ...prev.consents, insight: false } }
    return finish(prev, next, {
      operation: 'withdraw-insight',
      removedLines: {
        ar: [`أزيلت ${preferences} تفضيلات مصرح بها${goal ? ' وأُلغي الهدف المختار' : ''} من ملفك.`, ...(interests.length ? [`الاهتمامات الرقمية المحذوفة: ${list(interests.map(t => quote(t.ar, 'ar')), 'ar')}.`] : []), ...(free ? [`حُذف ${free} اهتمام كتبته بكلماتك مع كل ما فهمه كامن منه.`] : []), ...(goals.length > 1 ? [`أُلغيت ${goals.length} أهداف مختارة.`] : []), ...(plan.length ? [`حُذفت ${plan.length} خطوة محفوظة من خطتي.`] : []), ...(marks.length ? [`أُزيلت ${marks.length} علامة «ليس لي».`] : []), ...(roadmapDone.length ? [`أُزيلت ${roadmapDone.length} علامة إنجاز من خرائط الطريق.`] : []), ...(reviews ? [`حُذفت ${reviews} مراجعة توصيات مبنية على هذا السياق.`] : [])],
        en: [`${preferences} declared preference(s)${goal ? ' and the selected goal' : ''} were removed from your profile.`, ...(interests.length ? [`Deleted digital interests: ${list(interests.map(t => quote(t.en, 'en')), 'en')}.`] : []), ...(free ? [`${free} interest(s) in your own words were deleted, with everything KAMIN understood from them.`] : []), ...(goals.length > 1 ? [`${goals.length} selected goals were removed.`] : []), ...(plan.length ? [`${plan.length} saved step(s) in My plan were deleted.`] : []), ...(marks.length ? [`${marks.length} “not for me” mark(s) were removed.`] : []), ...(roadmapDone.length ? [`${roadmapDone.length} roadmap tick(s) were removed.`] : []), ...(reviews ? [`${reviews} recommendation review(s) built on this context were deleted.`] : [])],
      },
      keptLines: { ar: ['الأدلة الأكاديمية بقيت كما هي؛ الذي تغير هو سياق التخصيص فقط.', REGRANT.ar], en: ['Academic evidence remains unchanged; only personalization context changed.', REGRANT.en] },
      lang,
      audit: both(`سحب موافقة ملف القدرات 360°: حُذف ${preferences} تفضيل، ${interests.length} اهتمام، ${free} اهتمام بكلماتك، ${goals.length} هدف، ${plan.length} خطوة محفوظة، ${marks.length} علامة «ليس لي»، ${roadmapDone.length ? `${roadmapDone.length} علامة إنجاز في خرائط الطريق، ` : ''}${reviews} مراجعة`, `Capability Profile 360° consent withdrawn: ${preferences} preference(s), ${interests.length} interest(s), ${free} free-text interest(s), ${goals.length} goal(s), ${plan.length} saved step(s), ${marks.length} not-for-me mark(s), ${roadmapDone.length ? `${roadmapDone.length} roadmap tick(s), ` : ''}${reviews} review(s) deleted`),
    })
  }
  if (purpose === 'digital') {
    const interests = normalizeDigitalInterests(prev.insight?.digitalInterests).confirmed.map(i => DIGITAL_TOPICS.find(t => t.id === i.topicId)?.label).filter(Boolean)
    const next = { ...prev, insight: { ...(prev.insight || emptyInsightState()), digitalInterests: emptyDigitalInterests() } }
    const named = l => interests.length ? `: ${list(interests.map(t => quote(t[l], l)), l)}` : ''
    return finish(prev, next, {
      operation: 'withdraw-digital',
      removedLines: {
        ar: [`أُوقف تحليل النشاط الرقمي وحُذف ${interests.length} اهتمام مؤكد${named('ar')}.`],
        en: [`Digital-activity analysis stopped and ${interests.length} confirmed interest(s) deleted${named('en')}.`],
      },
      keptLines: { ar: ['بقيت أدلتك الأكاديمية وتفضيلاتك وهدفك كما هي.', REGRANT.ar], en: ['Your academic evidence, preferences and goal stayed as they were.', REGRANT.en] },
      lang,
      audit: both(`سحب موافقة تحليل النشاط الرقمي: حُذف ${interests.length} اهتمام`, `Digital-analysis consent withdrawn: ${interests.length} interest(s) deleted`),
    })
  }
  const next = { ...prev, consents: { ...prev.consents, [purpose]: false } }
  return finish(prev, next, {
    operation: `withdraw-${purpose}`,
    removedLines: { ar: [`أُوقف إذن ${PURPOSE[purpose].ar}. لم تكن هناك مشاركة فعلية في النسخة العامة.`], en: [`Permission for ${PURPOSE[purpose].en} switched off. No real sharing happens in the public release.`] },
    keptLines: { ar: ['بقيت بياناتك كما هي.'], en: ['Your data stayed as it was.'] },
    lang,
    audit: both(`سحب موافقة: ${PURPOSE[purpose].ar}`, `Consent withdrawn: ${PURPOSE[purpose].en}`),
  })
}

// Granting consent again never restores what was deleted.
export const regrantNotice = (purpose, lang = 'ar') => lang === 'ar'
  ? `مُنحت موافقة ${PURPOSE[purpose]?.ar || ''}. ${REGRANT.ar}`
  : `Consent granted for ${PURPOSE[purpose]?.en || ''}. ${REGRANT.en}`

// What "delete everything" will remove from this device, listed before the student confirms.
export function deleteEverythingPreview(state, lang = 'ar', { studyKept = false } = {}) {
  const s = state || {}
  const digital = normalizeDigitalInterests(s.insight?.digitalInterests)
  const plan = normalizePlan(s)
  const rows = [
    [both('مقررات', 'courses'), (s.courses || []).length],
    [both('قدرات مشتقة', 'derived capabilities'), profileSkills(s).length],
    [both('أدلة تطبيقية مصرّح بها', 'self-declared projects'), (s.projects || []).length],
    [both('سجلات مهام', 'task records'), (s.tasks || []).length],
    [both('اعتمادات مستوردة', 'imported credentials'), (s.credentials || []).length],
    [both('مراجعات توصيات', 'recommendation reviews'), (s.recommendationReviews || []).length],
    [both('تفضيلات مصرح بها', 'declared preferences'), preferenceCount(s.insight?.declaredPreferences)],
    [both('اهتمامات رقمية مؤكدة', 'confirmed digital interests'), digital.confirmed.length],
    [both('اهتمامات بكلماتك', 'interests in your own words'), normalizeFreeInterests(s.insight?.freeInterests).length],
    // Task 58: every chosen goal (goals; goal is goals[0]), the saved steps and the "not for me" marks.
    [both('أهداف مختارة', 'selected goals'), plan.goals.length],
    [both('خطوات محفوظة في خطتي', 'saved steps in My plan'), plan.plan.length],
    [both('عناصر عُلّمت «ليس لي»', 'items marked “not for me”'), plan.notForMe.length],
    // Task 79
    [both('علامات إنجاز في خرائط الطريق', 'ticked roadmap items'), plan.roadmapDone.length],
    [both('أحداث في سجل الاستخدام', 'usage-log events'), (s.audit || []).length],
  ]
  return {
    items: rows.map(([name, count]) => ({ label: name[lang], count })),
    stores: lang === 'ar' ? ['تخزين الجلسة في هذا المتصفح', 'النسخة المحفوظة على هذا الجهاز في تخزين هذا المتصفح', 'بيانات التجربة المحلية (التخزين المحلي)'] : ['this browser session’s storage', 'the copy saved on this device, in this browser’s storage', 'local pilot data in this browser’s storage'],
    // Task 76: the list above is in plain words; the browser's technical names are kept for "Technical details" only.
    storesTechnical: lang === 'ar' ? 'الأسماء التقنية: sessionStorage (تخزين الجلسة)، IndexedDB (النسخة المحفوظة على هذا الجهاز)، localStorage (بيانات التجربة المحلية).' : 'Technical names: sessionStorage (this session’s storage), IndexedDB (the copy saved on this device), localStorage (local pilot data).',
    // Task 18: a trial participant's anonymous study file stays until they finish or withdraw.
    kept: studyKept ? (lang === 'ar' ? 'يبقى ملف الدراسة المجهول حتى تُنهي الجلسة أو تنسحب من الدراسة.' : 'Your anonymous study file stays until you finish the session or withdraw from the study.') : null,
    outside: lang === 'ar' ? 'خارج سيطرة كامن: النسخ المشفّرة التي نزّلتها سابقًا، وروابط المشاركة التي أرسلتها؛ احذفها بنفسك إن أردت.' : 'Outside KAMIN’s control: encrypted backups you downloaded earlier and share links you already sent; delete those yourself if you want.',
  }
}

const PROFILE_KEYS = { session: ['kamin-session-v3', 'kamin-pilot-session-v2'], local: ['kamin-pilot-v1', 'kamin-pilot-events-v1', 'kamin-pilot-feedback-v1', 'kamin-pilot-anon-v1', 'kamin-pilot-study-v1'] }
// After "delete everything": check in code that nothing personal remains on this device. Only the
// interface choices are not personal data and are kept: the language ('kamin-lang') and, from Task 61, the theme
// ('kamin-theme': System, Light or Dark, src/themeChoice.js). Task 70: 'kamin-ui' (which interface opened)
// is gone with the old interface; "delete everything" removes a leftover one (RETIRED_UI_KEY).
export const KEPT_INTERFACE_KEYS = Object.freeze(['kamin-lang', 'kamin-theme'])
export const RETIRED_UI_KEY = 'kamin-ui'
// Task 18: `keep` names keys that were kept on purpose (a trial participant's anonymous study queue,
// which is deleted when they finish the session or withdraw). They are reported as kept, not as leftovers.
export async function verifyDeviceCleared({ keep = [] } = {}) {
  const leftovers = []
  try { for (const key of PROFILE_KEYS.session) if (sessionStorage.getItem(key) !== null) leftovers.push(`session:${key}`) } catch { leftovers.push('session:unreadable') }
  try {
    for (const key of PROFILE_KEYS.local) if (localStorage.getItem(key) !== null) leftovers.push(`local:${key}`)
    for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key?.startsWith('kamin-') && !KEPT_INTERFACE_KEYS.includes(key) && !PROFILE_KEYS.local.includes(key)) leftovers.push(`local:${key}`) }
  } catch { leftovers.push('local:unreadable') }
  try { if (await profileDbHasData()) leftovers.push('indexeddb:profile') } catch { leftovers.push('indexeddb:unreadable') }
  const kept = keep.filter(key => leftovers.includes(`local:${key}`))
  const rest = leftovers.filter(item => !kept.some(key => item === `local:${key}`))
  return { clean: rest.length === 0, leftovers: rest, kept, checkedAt: new Date().toISOString() }
}

// Looks inside the profile database without creating it: opening a missing database would
// otherwise create an empty one, so the upgrade is aborted and the check reports "nothing stored".
function profileDbHasData() {
  const api = globalThis.indexedDB
  if (!api) return Promise.resolve(false)
  return new Promise(resolve => {
    const request = api.open(KAMIN_LOCAL_DB)
    request.onupgradeneeded = () => request.transaction.abort()
    request.onerror = () => resolve(false)
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(KAMIN_LOCAL_STORE)) { db.close(); resolve(false); return }
      const get = db.transaction(KAMIN_LOCAL_STORE).objectStore(KAMIN_LOCAL_STORE).get(KAMIN_LOCAL_KEY)
      get.onsuccess = () => { db.close(); resolve(!!get.result) }
      get.onerror = () => { db.close(); resolve(false) }
    }
  })
}

// "No leftovers": no evidence claim in the projected graph points at something that is gone.
export function orphanCheck(state) {
  const graph = projectStateToPerson360({ state, skills: profileSkills(state) })
  const ids = new Set(graph.entities.map(e => e['@id']))
  const dangling = graph.claims.filter(c => c.source?.startsWith('urn:kamin:evidence:course:') && !ids.has(c.source))
  return { removed: sweepOrphans(graph).removed, dangling }
}
