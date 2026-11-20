import { Suspense, lazy, useEffect, useState } from 'react'
import { BookOpen, ChevronDown, FolderGit2, LockKeyhole, PencilLine, SearchCheck, ShieldCheck } from 'lucide-react'
import GoalChips from './GoalChips.jsx'
import { copy, fill } from '../i18n.js'
import TechDetails from './TechDetails.jsx'
import { levelLabel, basisLabel, evidenceSentence } from '../evidence/levels.js'
import { rowProvenance, skillProvenance, provenanceLabel } from '../utils/provenance.js'
import { courseEvidencePrinciple } from '../content/trustCopy.js'
import { ACTION_LABELS, LEVEL_MEANINGS, limitLine, sharedLimitLine } from '../content/levelReasons.js'
import { collegeHasMap } from '../catalog/colleges.js'
import { skills as skillsCatalog } from '../data.js'
import { ssceReference } from '../reference/ssce.js'
// Task 65: the save offer's words are shared with the new interface's My plan (unchanged).
import { saveOffer } from '../content/saveOfferCopy.js'

// Task 11 · a compact "My capabilities" page: one alert at most, the capability list and the
// next-step card above the fold; tasks, the full next decision, the network and the education
// classification folded under "More" (loaded only when opened).
const WhatChanged = lazy(() => import('./WhatChanged.jsx'))
const NeedsReview = lazy(() => import('./NeedsReview.jsx'))
// Task 55: no college dropdown; when the college has no approved map, a note with the one-tap fix (lazy).
const CollegeNote = lazy(() => import('./CollegeFix.jsx').then(m => ({ default: m.DashboardCollegeNote })))
const DashboardMore = lazy(() => import('./DashboardMore.jsx'))
const tr = (lang, ar, en) => lang === 'ar' ? ar : en
export const localized = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.ar || value?.en || ''

export function SkillCard({ skill, lang, projects = [], verified = false }) {
  const t = copy[lang].app
  const level = skill.evidenceLevel || 'limited'
  const strength = levelLabel(level, lang)
  const applied = skill.evidence?.some(e => e.evidenceType === 'applied')
  const provenance = skillProvenance(skill)
  const practical = skill.practicalEvidence || []
  return <article className="skill-card" data-provenance={provenance.level} data-evidence-level={level}>
    <div className="skill-top"><div><small>{tr(lang, 'مستوى الدليل — قرينة لا ضمان', 'Evidence level — a clue, not a guarantee')}</small><h3>{skill.labels[lang]}</h3></div><strong>{strength}</strong></div>
    <div className="evidence-level-row"><span>{basisLabel('academic', lang)}</span><b>{skill.evidence.length ? levelLabel(skill.academicLevel, lang) : tr(lang, 'لا يوجد', 'None')} · {provenanceLabel(provenance.level, lang)}</b>{applied && <em>{tr(lang, 'يتضمن مشروعًا تطبيقيًا', 'includes a project course')}</em>}{provenance.gradeRaised && <em className="provenance-warning">{tr(lang, 'تتضمن درجة رُفعت يدويًا بعد الاستخراج', 'includes a grade raised by hand after extraction')}</em>}{verified && <em className="verified-badge" data-testid="verified-badge">{tr(lang, 'موثّق من جهة إصدار معتمدة', 'verified by a trusted issuer')}</em>}</div>
    <div className="evidence-level-row" data-testid="practical-basis"><span>{basisLabel('practical', lang)}</span><b>{practical.length ? levelLabel(skill.practicalLevel, lang) : tr(lang, 'لا دليل عملي مُراجَع بعد', 'No reviewed practical evidence yet')}</b></div>
    <div className="meter categorical" role="img" aria-label={`${tr(lang, 'مستوى الدليل', 'Evidence level')}: ${strength}`}><i className={level}/></div>
    <div className="evidence"><small>{t.evidence}</small>{skill.evidence.map((e, i) => { const p = rowProvenance(e); return <div key={i} className="evidence-item"><p><BookOpen size={15}/><span>{e.code} · {localized(e.name, lang)}{p.level !== 'document' && p.level !== 'synthetic' && <i className="evidence-origin"> — {provenanceLabel(p.level, lang)}</i>}</span><b>{e.grade}</b></p>{e.learningOutcome && <small className="evidence-outcome">{tr(lang, 'مخرج التعلم: ', 'Learning outcome: ')}{localized(e.learningOutcome, lang)}</small>}{e.reasons && <small className="evidence-why">{evidenceSentence({ level: e.evidenceLevel, reasons: e.reasons }, lang)}</small>}</div> })}{practical.map((e, i) => <div key={`p${i}`} className="evidence-item"><p><ShieldCheck size={15}/><span>{e.name || e.credentialId} · {e.issuerName || ''}</span></p><small className="evidence-why">{evidenceSentence({ level: e.evidenceLevel, reasons: e.reasons }, lang)}</small></div>)}</div>
    {skill.evidence.length > 0 && <small className="evidence-principle" data-testid="course-evidence-principle">{courseEvidencePrinciple(lang)}</small>}
    {projects.length > 0 && <div className="skill-projects"><small>{tr(lang, 'أدلة تطبيقية مصرّح بها — بانتظار مراجعة، لا تغيّر قوة الدليل', 'Self-declared applied evidence — awaiting review, does not change evidence strength')}</small>{projects.map(p => <p key={p.id}><FolderGit2 size={14}/><span>{p.title}</span></p>)}</div>}
  </article>
}

// Hand-typed rows that match a mapped course: visible, but never counted as evidence.
export function AwaitingEvidence({ lang, rows, onUpload }) {
  if (!rows.length) return null
  const names = id => localized(skillsCatalog[id]?.labels, lang) || id
  return <div className="mapping-note awaiting-evidence" data-testid="awaiting-evidence" role="note"><SearchCheck size={17}/><div><strong>{tr(lang, 'دليل بانتظار مستند أو مراجعة', 'Evidence waiting for a document or review')}</strong><p>{tr(lang, 'هذه المقررات أُدخلت يدويًا، لذلك لا تُنشئ قدرة حتى ترفع سجلًا رسميًا يتضمنها أو تُراجَع:', 'These courses were typed by hand, so they create no capability until an official record containing them is uploaded or they are reviewed:')}</p><ul>{rows.map(r => { const why = limitLine({ level: 'none', reasons: r.reasons }, lang, { code: r.code }); return <li key={r.code}>{r.code} · {localized(r.name, lang)} → {r.skills.map(names).join(tr(lang, '، ', ', '))}{why && <WhyLine why={why} lang={lang} onAction={{ upload: onUpload }} testId="awaiting-why"/>}</li> })}</ul></div></div>
}

export function EducationClassificationCard({ lang, classification }) {
  const primary = classification?.primary
  if (!primary) return null
  return <div className="panel ssce-card">
    <div className="panel-head"><div><small>{tr(lang, 'مرجع وطني للتخصص', 'National education reference')}</small><h3>{ssceReference.name[lang]}</h3></div><span className="ssce-code">{primary.code}</span></div>
    <div className="ssce-hierarchy">
      <span><b>06</b>{primary.broad.labels[lang]}</span>
      <span><b>061</b>{primary.narrow.labels[lang]}</span>
      {primary.detailed && <span><b>{primary.detailed.code}</b>{primary.detailed.labels?.[lang]}</span>}
      <span className="current"><b>{primary.code}</b>{primary.labels[lang]}</span>
    </div>
    <p>{fill(copy[lang].screens.dashboard.nationalNote,{n:primary.count,total:classification.totalCourses})}</p><TechDetails lang={lang}>{copy[lang].screens.dashboard.technical.national}</TechDetails>
    {classification.isMixed && <p className="ssce-warning">{tr(lang, 'السجل يحتوي أكثر من سياق تخصصي؛ اعتمد التصنيف المؤسسي قبل الاستخدام الرسمي.', 'The record contains more than one programme context; confirm the institutional classification before formal use.')}</p>}
    <div className="ssce-links"><a href={ssceReference.sourceUrl} target="_blank" rel="noreferrer">{tr(lang, 'دليل التصنيف الوطني', 'National classification guide')}</a><a href={primary.mappingSourceUrl} target="_blank" rel="noreferrer">{tr(lang, 'مصدر ربط رمز البرنامج', 'Programme-code mapping source')}</a></div>
  </div>
}

// At most one message: what changed (with the save offer inside it), otherwise items that need
// review, otherwise the save offer. The session banner and the save box are one message.
function AlertSlot({ lang, change, needsReview, offerSave, onKeep, onNotNow, onDismissChange }) {
  const save = offerSave && <div className="alert-save"><LockKeyhole size={18}/><span><strong>{saveOffer('question', lang)}</strong><small>{saveOffer('detail', lang)}</small></span><span className="alert-actions"><button type="button" className="button primary" onClick={onKeep}>{saveOffer('keep', lang)}</button><button type="button" className="button secondary" onClick={onNotNow}>{saveOffer('notNow', lang)}</button></span></div>
  let body = null
  // Task 25: "Got it" (in the title row of "What changed") hides it for this change; the app remembers
  // it by the change's ts. It replaces the ×, so the dashboard keeps its 22 choices
  // (e2e/usability-budget.json), and it sits in the title row so the page grows as little as possible.
  if (change) body = <><Suspense fallback={null}><WhatChanged change={change} lang={lang} dismiss={{ label: tr(lang, 'فهمت', 'Got it'), onClick: onDismissChange }}/></Suspense>{save}</>
  else if (needsReview?.length) body = <Suspense fallback={null}><NeedsReview lang={lang} items={needsReview}/></Suspense>
  else if (offerSave) body = save
  if (!body) return null
  return <div className="dashboard-alert" data-testid="dashboard-alert">{body}</div>
}

// Task 29 · one "because" line naming only what limits the level, and the one thing the student can
// do about it (no button when only the department or the KAMIN team can change it).
function WhyLine({ why, lang, onAction = {}, testId, className = '', id }) {
  const act = why.action && onAction[why.action]
  return <p className={`capability-why ${className}`.trim()} data-testid={testId} id={id}>{why.text}{act && <> <button type="button" className="text-button" data-testid={`${testId}-action`} onClick={act}>{ACTION_LABELS[lang === 'ar' ? 'ar' : 'en'][why.action]}</button></>}</p>
}

function LevelLegend({ lang }) {
  const m = LEVEL_MEANINGS[lang === 'ar' ? 'ar' : 'en']
  return <details className="level-legend" data-testid="level-legend"><summary>{m.title}</summary>
    <ul>{['none', 'limited', 'moderate', 'strong'].map(level => <li key={level} data-level={level}>{m[level]}</li>)}</ul>
    <p>{m.rule}</p><p data-testid="level-legend-principle">{courseEvidencePrinciple(lang)}</p>
  </details>
}

const SOURCE_ICON = { document: BookOpen, synthetic: BookOpen, mixed: BookOpen, edited: PencilLine, declared: PencilLine }
function CapabilityList({ lang, state, skills, expandAll, onOpenMyData, onUpload, onCollege, projectsFor, verifiedIds }) {
  const [open, setOpen] = useState(() => new Set())
  useEffect(() => { if (expandAll) setOpen(new Set(skills.map(s => s.id))) }, [expandAll, skills])
  const allOpen = skills.length > 0 && skills.every(s => open.has(s.id))
  const toggle = id => setOpen(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  // Task 29: the same reason on every capability is said once above the list, not on every row.
  const shared = sharedLimitLine(skills, lang)
  const actions = { review: onOpenMyData, upload: onUpload }
  return <section className="panel capability-list" aria-labelledby="capability-list-title" id="my-skills">
    {/* Task 29: the legend sits next to the heading, where the line has room, so the list still fits at 1366×768. */}
    <div className="panel-head"><h3 id="capability-list-title">{tr(lang, 'قدراتي', 'My capabilities')}</h3>{skills.length > 0 && <LevelLegend lang={lang}/>}
      <span className="capability-list-links"><button type="button" className="text-button" data-testid="open-my-data" onClick={onOpenMyData}>{tr(lang, 'راجع وصحح بياناتي', 'Review and correct my data')}</button>
        {skills.length > 0 && <button type="button" className="text-button" data-testid="expand-all-capabilities" aria-expanded={allOpen} onClick={() => setOpen(allOpen ? new Set() : new Set(skills.map(s => s.id)))}>{allOpen ? tr(lang, 'إخفاء الأدلة', 'Hide evidence') : tr(lang, 'اعرض كل الأدلة', 'Show all evidence')}</button>}</span>
    </div>
    {shared && <WhyLine why={shared} lang={lang} onAction={actions} testId="capability-why-all" className="shared" id="capability-why-all"/>}
    {!collegeHasMap(state.college) && <Suspense fallback={null}><CollegeNote lang={lang} college={state.college} collegeRaw={state.collegeRaw} onChoose={onCollege}/></Suspense>}
    {!skills.length && <p className="capability-empty">{tr(lang, 'لا توجد قدرة مدعومة بالدليل بعد. القدرات تأتي من مقررات مربوطة ربطًا معتمدًا في سجلك.', 'No evidence-backed capability yet. Capabilities come from courses with an approved mapping in your record.')}</p>}
    <ul className="capability-rows">{skills.map(skill => {
      const level = skill.evidenceLevel || 'limited'
      const provenance = skillProvenance(skill).level
      const practical = (skill.practicalEvidence || []).length > 0
      const Icon = practical ? ShieldCheck : SOURCE_ICON[provenance] || BookOpen
      const source = practical ? tr(lang, 'اعتماد موثّق', 'verified credential') : provenanceLabel(provenance, lang)
      const expanded = open.has(skill.id)
      const why = !shared && limitLine(skill, lang, { code: (skill.evidence.find(e => e.reasons === skill.reasons) || skill.evidence[0])?.code })
      return <li key={skill.id} data-skill={skill.id}>
        <button type="button" className="skill-row capability-row" data-testid="capability-row" aria-expanded={expanded} aria-controls={`capability-${skill.id}`} aria-describedby={why ? `capability-why-${skill.id}` : shared ? 'capability-why-all' : undefined} onClick={() => toggle(skill.id)}>
          <span className="capability-name">{skill.labels[lang]}</span>
          <span className={`capability-level ${level}`}>{levelLabel(level, lang)}</span>
          <span className="capability-source" title={source}><Icon size={15} aria-hidden="true"/><span className="sr-only">{tr(lang, 'المصدر: ', 'Source: ')}{source}</span></span>
          <ChevronDown size={16} className="capability-chevron" aria-hidden="true"/>
        </button>
        {why && <WhyLine why={why} lang={lang} onAction={actions} testId="capability-why" id={`capability-why-${skill.id}`}/>}
        {expanded && <div id={`capability-${skill.id}`} className="capability-detail"><SkillCard skill={skill} lang={lang} projects={projectsFor(skill.id)} verified={verifiedIds.has(skill.id)}/></div>}
      </li>
    })}</ul>
    {state.localPersistence && <p className="saved-note" data-testid="saved-note"><LockKeyhole size={14} aria-hidden="true"/>{saveOffer('savedNote', lang)}</p>}
  </section>
}

function NextStepCard({ lang, state, matches, onChooseGoal, onOpen }) {
  const t = copy[lang].app
  const goalLabel = state.goal ? t.goals[state.goal] : null
  const relevant = (matches || []).filter(m => !state.goal || (m.goals || []).includes(state.goal))
  const gapMatch = relevant.find(m => (m.missingSkills || []).length) || null
  const gapId = gapMatch?.missingSkills?.[0]
  const gap = gapId ? (localized(skillsCatalog[gapId]?.labels, lang) || gapId) : null
  return <section className="panel next-step-card" aria-labelledby="next-step-title" data-testid="next-step-card">
    <small>{tr(lang, 'خطوتك التالية', 'Your next step')}</small>
    <h3 id="next-step-title">{tr(lang, 'ما الذي تريد الوصول إليه؟', 'Where do you want to go?')}</h3>
    <GoalChips lang={lang} goal={state.goal} onChoose={onChooseGoal}/>
    {goalLabel && <p className="next-step-goal">{tr(lang, `هدفك: ${goalLabel}`, `Your goal: ${goalLabel}`)}</p>}
    <p className="next-step-gap" data-testid="next-step-gap">{gap ? tr(lang, `أهم فجوة: «${gap}» لمسار «${localized(gapMatch.title, lang)}».`, `Most important gap: “${gap}” for “${localized(gapMatch.title, lang)}”.`) : tr(lang, 'لا فجوة في المتطلبات الأساسية للمسارات المعروضة حاليًا.', 'No gap in the basic requirements of the pathways shown now.')}</p>
    <button type="button" className="button primary" onClick={onOpen}>{tr(lang, 'افتح خطوتي التالية', 'Open my next step')}</button>
  </section>
}

export default function Dashboard(props) {
  const { lang, state, skills, matches, change, offerSave, onKeep, onNotNow, onDismissChange, expandAll, onOpenMyData, onUpload, onCollege, onChooseGoal, onOpenNext, projectsFor, verifiedIds, awaiting, projectPanel, moreProps } = props
  const [moreOpen, setMoreOpen] = useState(false)
  return <>
    <div className="app-title dashboard-title"><small>{tr(lang, 'قدراتي', 'My capabilities')}</small><h2>{copy[lang].screens.dashboard.title}</h2></div>
    <AlertSlot lang={lang} change={change} needsReview={state.needsReview} offerSave={offerSave} onKeep={onKeep} onNotNow={onNotNow} onDismissChange={onDismissChange}/>
    <div className="dashboard-main">
      <CapabilityList lang={lang} state={state} skills={skills} expandAll={expandAll} onOpenMyData={onOpenMyData} onUpload={onUpload} onCollege={onCollege} projectsFor={projectsFor} verifiedIds={verifiedIds}/>
      <NextStepCard lang={lang} state={state} matches={matches} onChooseGoal={onChooseGoal} onOpen={onOpenNext}/>
    </div>
    <AwaitingEvidence lang={lang} rows={awaiting} onUpload={onUpload}/>
    {projectPanel}
    <details className="dashboard-more" data-testid="dashboard-more" open={moreOpen} onToggle={e => setMoreOpen(e.currentTarget.open)}>
      <summary>{tr(lang, 'المزيد: المهام، القرار التالي، الروابط، التصنيف الوطني', 'More: tasks, next decision, connections, national classification')}</summary>
      {moreOpen && <Suspense fallback={<p role="status">{tr(lang, 'جارٍ التحميل…', 'Loading…')}</p>}><DashboardMore {...moreProps}/></Suspense>}
    </details>
  </>
}
