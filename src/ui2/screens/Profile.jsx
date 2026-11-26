// Task 66 · Profile (the "Profile" tab). Loads on its own (lazy, from AppNext.jsx).
// At the top, once, the "what changed" summary after an approval or a recompute (Task 25's rule: one message at a time;
// "Got it" hides it, and so does leaving Profile once it was shown, AppNext.jsx). Then the college and major read from
// the transcript, and the transcript line ("42 courses · approved on <date>") with "Update transcript". Then
// My capabilities: compact rows, each a name and a level word (CapabilityRow.jsx), the "because" line once above them
// when every capability shares it (Task 29), and "What do the levels mean?". A tap on a row opens a sheet: why this
// level (src/content/levelReasons.js), the courses, projects and credentials behind it (the old dashboard's card,
// Dashboard.jsx SkillCard, unchanged), and the level meanings with the "clue, not a guarantee" sentence.
// Then My projects, My interests and My goals, each with Edit: it opens step 2, 3 or 4 in edit mode (no transcript
// upload; "Back to Profile" instead of Next). Then More: "Add a verified credential" (CredentialImport.jsx), "Practice
// tasks" (TaskLoop.jsx) and "More ways to add interests" (DigitalInterests.jsx, after the interests consent, as in the
// old interface), each the old component unchanged and loaded only when opened. Then Settings (Task 67) and Help
// (Task 68). Nothing here changes evidence; a level is a word, never a number.
// Task 67: "Correct a course" on the transcript line (and the "because" line's "Review my data") opens Settings → My courses.
// Task 74: "My map" under the capabilities opens a map in place, loaded only then. Task 75 (Amjd, 2026-11-19): the map is
// the old interface's "Show connections" graph, reused as it was (src/ui2/components/ConnectionsMap.jsx, the shared
// src/components/ShowConnections.jsx); a tap on a capability node opens this page's own reasons sheet.
import { Suspense, lazy, useEffect, useId, useRef, useState } from 'react'
import { BadgeCheck, ClipboardCheck, FileText, GraduationCap, Info, LockKeyhole, MessageSquareText, Pencil, RefreshCw, UploadCloud, Waypoints } from 'lucide-react'
import { copy } from '../../i18n.js'
import { levelLabel } from '../../evidence/levels.js'
import { ACTION_LABELS, LEVEL_MEANINGS, limitLine, sharedLimitLine } from '../../content/levelReasons.js'
import { courseEvidencePrinciple } from '../../content/trustCopy.js'
import { collegeHasMap, collegeLabel } from '../../catalog/colleges.js'
import { DECLARED_PREFERENCE_SCHEMES, preferenceValues } from '../../insight.js'
import { normalizeFreeInterests } from '../../interests/freeInterestState.js'
import { normalizeDigitalInterests } from '../../digitalInterests.js'
import { normalizePlan } from '../../plan/plan.js'
import { targetProfiles } from '../../matching/targets.js'
import { projectsForSkill } from '../../utils/projectEvidence.js'
import { verifiedSkillIds } from '../../credentials/records.js'
import { AwaitingEvidence, SkillCard } from '../../components/Dashboard.jsx'
import { awaitingEvidence } from '../../utils/engine.js'
import { VIEW_TEXT } from '../views.js'
import { fillIn, nextCopy } from '../copy.js'
import Sheet from '../Sheet.jsx'
import CapabilityRow from '../components/CapabilityRow.jsx'
import HelpPageLink from '../HelpPageLink.jsx'
import { CHIP_QUESTIONS, grantInterests } from '../interestsConsent.js'
import '../profile.css'

const WhatChanged = lazy(() => import('../../components/WhatChanged.jsx'))
// The college note and its one-tap fix (Task 55), only when the college has no approved course map.
const CollegeNote = lazy(() => import('../../components/CollegeFix.jsx').then(m => ({ default: m.DashboardCollegeNote })))
// More: the old interface's components, unchanged, each loaded when the student opens it.
const CredentialImport = lazy(() => import('../../components/CredentialImport.jsx'))
const TaskLoop = lazy(() => import('../../components/TaskLoop.jsx'))
const DigitalInterests = lazy(() => import('../../components/DigitalInterests.jsx'))
// Task 74, Task 75: My map (the old "Show connections" graph), loaded only when the student opens it.
const ConnectionsMap = lazy(() => import('../components/ConnectionsMap.jsx'))

const LEVELS = ['none', 'limited', 'moderate', 'strong']
const L = lang => (lang === 'ar' ? 'ar' : 'en')
const list = (items, lang) => items.join(lang === 'ar' ? '، ' : ', ')

// The usage-log line the profile hook writes when the transcript is first approved (src/state/useKaminProfile.js), in
// either language: its time is the approval date. The newest one counts.
export const APPROVAL_LOG = Object.freeze(['منح موافقة تحليل السجل واعتماده', 'Transcript analysis consent granted and record approved'])
export const approvedAt = state => (state?.audit || []).find(entry => APPROVAL_LOG.includes(entry?.label))?.ts ?? null
const dateText = (ts, lang) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium' }).format(new Date(ts))

/** "42 courses · approved on 19 Nov 2026" (or "· approved" when the usage log no longer holds the approval). */
export function transcriptLine(state, lang) {
  const w = nextCopy(lang).profile
  const ts = approvedAt(state)
  return `${w.courses(state?.courses?.length || 0).join('')} · ${ts ? fillIn(w.approvedOn, { date: dateText(ts, lang) }) : w.approved}`
}

// A goal's name: a pathway's title, or one of the old interface's four directions (its label), never an id.
const goalLabel = (id, lang) => targetProfiles.find(target => target.id === id)?.title?.[lang] || copy[lang].app.goals[id] || null

/** One line per section: the projects' titles, the chosen interests, the goals (names, never ids). */
export function sectionSummaries(state, lang) {
  const w = nextCopy(lang).profile
  const projects = (state?.projects || []).map(project => project.title)
  const consent = Boolean(state?.consents?.insight)
  const prefs = state?.insight?.declaredPreferences || {}
  // Task 78: every chosen chip of both questions (up to 3 each), in the order chosen.
  const chips = consent ? CHIP_QUESTIONS.flatMap(scheme => preferenceValues(prefs, scheme).map(optionId => DECLARED_PREFERENCE_SCHEMES[scheme].options.find(option => option.id === optionId)?.label[lang])).filter(Boolean) : []
  const words = consent ? normalizeFreeInterests(state?.insight?.freeInterests).length : 0
  const digital = consent ? normalizeDigitalInterests(state?.insight?.digitalInterests).confirmed.length : 0
  const interests = [...chips, ...(words ? [fillIn(w.ownWords, { n: words })] : []), ...(digital ? [fillIn(w.digital, { n: digital })] : [])]
  const goals = normalizePlan(state).goals.map(id => goalLabel(id, lang)).filter(Boolean)
  return {
    projects: projects.length ? list(projects, lang) : w.noProjects,
    interests: interests.length ? list(interests, lang) : w.noInterests,
    goals: goals.length ? list(goals, lang) : w.noGoals,
  }
}

// The reason for one capability's level: the "because" line of its own course, the shared line, or (nothing limits it)
// what its level means.
export function levelReason(skill, skills, lang) {
  const own = limitLine(skill, lang, { code: (skill.evidence.find(e => e.reasons === skill.reasons) || skill.evidence[0])?.code })
  return own || sharedLimitLine(skills, lang) || { text: LEVEL_MEANINGS[L(lang)][skill.evidenceLevel || 'limited'], action: null }
}

// "What do the levels mean?" (Task 29's words, src/content/levelReasons.js), with the "clue, not a guarantee" sentence.
function LevelLegend({ lang, testId }) {
  const m = LEVEL_MEANINGS[L(lang)]
  return <details className="ui2-legend" data-testid={testId}>
    <summary>{m.title}</summary>
    <ul>{LEVELS.map(level => <li key={level} data-level={level}>{m[level]}</li>)}</ul>
    <p>{m.rule}</p>
    <p>{courseEvidencePrinciple(lang)}</p>
  </details>
}

// A "because" line with the one thing the student can do about it (none when only the department can change it).
function WhyLine({ why, lang, actions, testId, id }) {
  const act = why.action && actions[why.action]
  return <p className="ui2-why-line" data-testid={testId} id={id}>{why.text}{act && <> <button type="button" className="ui2-text-btn" onClick={act}>{ACTION_LABELS[L(lang)][why.action]}</button></>}</p>
}

function Section({ title, summary, testId, onEdit, lang }) {
  const id = useId()
  const w = nextCopy(lang).profile
  return <section className="ui2-profile-section" aria-labelledby={id} data-testid={testId}>
    <div className="ui2-profile-section-head">
      <h2 id={id}>{title}</h2>
      <button type="button" className="ui2-text-btn" aria-label={fillIn(w.editOf, { section: title })} onClick={onEdit}><Pencil size={16} aria-hidden="true"/>{w.edit}</button>
    </div>
    <p className="ui2-profile-summary">{summary}</p>
  </section>
}

// One row of More: a button that shows its panel below it (loaded when opened).
function MoreRow({ id, icon: Icon, label, open, onToggle, children, lang }) {
  return <li className="ui2-more-item">
    <button type="button" className="ui2-more-toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}><Icon size={18} aria-hidden="true"/><span>{label}</span></button>
    {open && <div className="ui2-more-panel ui2-legacy" id={id}>
      <Suspense fallback={<p role="status">{nextCopy(lang).profile.loading}</p>}>{children}</Suspense>
    </div>}
  </li>
}

export default function Profile({ lang, profile, focusHeading, onNavigate, onEdit, onCourses, change = null, onChangeShown, onDismissChange }) {
  const w = nextCopy(lang).profile
  const S = copy[lang].screens.insight
  const id = useId()
  const { state, actions, derived } = profile
  const skills = derived.skills
  const [opened, setOpened] = useState(null)
  const [more, setMore] = useState(null)
  const [map, setMap] = useState(false)
  const heading = useRef(null)
  useEffect(() => { if (focusHeading) heading.current?.focus() }, [focusHeading])
  // The summary counts as seen once it was on screen (AppNext.jsx hides it after the student leaves Profile).
  useEffect(() => { if (change) onChangeShown?.(change.ts) }, [change?.ts]) // eslint-disable-line react-hooks/exhaustive-deps

  const approved = Boolean(state.approved)
  const college = collegeLabel(state.college, lang)
  const shared = sharedLimitLine(skills, lang)
  // Task 67: "Review my data" and "Correct a course" open Settings → My courses.
  const openCourses = () => (onCourses ? onCourses() : onNavigate('settings'))
  const why = { upload: () => onEdit('upload'), review: openCourses }
  const verified = verifiedSkillIds(state.credentials)
  const summaries = sectionSummaries(state, lang)
  const skill = opened && skills.find(s => s.id === opened)
  const consent = Boolean(state.consents?.insight)
  const toggleMore = key => setMore(open => (open === key ? null : key))
  const grant = event => { if (event.target.checked) actions.setState(s => grantInterests(s, S.consentGranted)) }

  return <section className="ui2-page ui2-profile" aria-labelledby="ui2-page-title" data-view="profile" data-testid="ui2-page">
    <h1 id="ui2-page-title" tabIndex={-1} ref={heading}>{VIEW_TEXT.profile.title[lang]}</h1>
    {change && <div className="ui2-profile-change ui2-legacy"><Suspense fallback={null}><WhatChanged change={change} lang={lang} dismiss={{ label: w.gotIt, onClick: onDismissChange }}/></Suspense></div>}

    <div className="ui2-profile-head" data-testid="ui2-profile-head">
      {approved ? <>
        {(college || state.collegeRaw || state.major) && <p className="ui2-profile-who"><GraduationCap size={18} aria-hidden="true"/>
          <span>{college || <bdi>{state.collegeRaw}</bdi>}{(college || state.collegeRaw) && state.major && ' · '}{state.major && <bdi>{state.major}</bdi>}</span></p>}
        <p className="ui2-profile-record"><FileText size={18} aria-hidden="true"/><span data-testid="ui2-transcript-line">{transcriptLine(state, lang)}</span>
          <button type="button" className="ui2-text-btn" onClick={() => onEdit('upload')}><RefreshCw size={16} aria-hidden="true"/>{w.update}</button>
          {/* Task 67: Settings → My courses in one tap (edit a row, delete one, undo). */}
          <button type="button" className="ui2-text-btn" onClick={openCourses}><Pencil size={16} aria-hidden="true"/>{w.correct}</button></p>
      </> : <div className="ui2-profile-empty">
        <p>{w.noTranscript}</p>
        <button type="button" className="ui2-btn ui2-btn-primary" onClick={() => onEdit('upload')}><UploadCloud size={18} aria-hidden="true"/>{w.upload}</button>
      </div>}
    </div>

    <section className="ui2-profile-caps" aria-labelledby={`${id}-caps`} data-testid="ui2-capabilities">
      <h2 id={`${id}-caps`}>{w.capabilities}</h2>
      {shared && <WhyLine why={shared} lang={lang} actions={why} testId="capability-why-all" id={`${id}-why`}/>}
      {approved && !collegeHasMap(state.college) && <div className="ui2-legacy ui2-profile-college"><Suspense fallback={null}><CollegeNote lang={lang} college={state.college} collegeRaw={state.collegeRaw} onChoose={actions.changeCollege}/></Suspense></div>}
      {skills.length
        ? <ul className="ui2-cap-list">{skills.map(s => <li key={s.id}><CapabilityRow lang={lang} skill={s} describedBy={shared ? `${id}-why` : undefined} onOpen={() => setOpened(s.id)}/></li>)}</ul>
        : <p className="ui2-profile-summary">{w.noCapabilities}</p>}
      {skills.length > 0 && <LevelLegend lang={lang} testId="level-legend"/>}
      {/* Task 70: hand-typed courses that match a mapped course wait for a document and never count as evidence (the old
          dashboard's note, unchanged; inventory K10). "Upload your record" opens step 1, as "Update transcript" does. */}
      {approved && <div className="ui2-legacy"><AwaitingEvidence lang={lang} rows={awaitingEvidence(state.courses, { college: state.college })} onUpload={() => onEdit('upload')}/></div>}
    </section>

    <section className="ui2-profile-map" aria-label={w.map} data-testid="ui2-profile-map">
      <button type="button" className="ui2-more-toggle" aria-expanded={map} aria-controls={`${id}-map`} onClick={() => setMap(open => !open)}><Waypoints size={18} aria-hidden="true"/><span>{w.map}</span></button>
      {map && <div id={`${id}-map`}>
        <Suspense fallback={<p role="status">{w.loading}</p>}>
          <ConnectionsMap lang={lang} state={state} matches={derived.matches} graph={derived.personGraph} skills={skills} onCapability={skillId => setOpened(skillId)} onGoal={() => onEdit('interests')}/>
        </Suspense>
      </div>}
    </section>

    <Section lang={lang} title={w.projects} summary={summaries.projects} testId="ui2-profile-projects" onEdit={() => onEdit('projects')}/>
    <Section lang={lang} title={w.interests} summary={summaries.interests} testId="ui2-profile-interests" onEdit={() => onEdit('interests')}/>
    <Section lang={lang} title={w.goals} summary={summaries.goals} testId="ui2-profile-goals" onEdit={() => onEdit('next')}/>

    <section className="ui2-profile-more" aria-labelledby={`${id}-more`} data-testid="ui2-profile-more">
      <h2 id={`${id}-more`}>{w.more}</h2>
      <ul className="ui2-more-list">
        <MoreRow id={`${id}-credential`} icon={BadgeCheck} label={w.credential} open={more === 'credential'} onToggle={() => toggleMore('credential')} lang={lang}>
          <CredentialImport lang={lang} records={state.credentials || []} onSave={actions.saveCredential} onRemove={actions.removeCredential}/>
        </MoreRow>
        <MoreRow id={`${id}-tasks`} icon={ClipboardCheck} label={w.tasks} open={more === 'tasks'} onToggle={() => toggleMore('tasks')} lang={lang}>
          <TaskLoop lang={lang} state={state} matches={derived.matches} onUpdate={actions.updateTasks}/>
        </MoreRow>
        <MoreRow id={`${id}-interests`} icon={MessageSquareText} label={w.moreInterests} open={more === 'interests'} onToggle={() => toggleMore('interests')} lang={lang}>
          {consent
            ? <DigitalInterests lang={lang} state={state} setState={actions.setState} onSkip={() => setMore(null)}/>
            : <div className="ui2-profile-consent" data-testid="ui2-profile-interests-consent">
              <p>{w.needConsent}</p>
              <label><input type="checkbox" checked={false} onChange={grant}/><span>{S.consent}</span></label>
            </div>}
        </MoreRow>
      </ul>
    </section>

    <ul className="ui2-profile-links">
      <li><button type="button" className="ui2-more-toggle" onClick={() => onNavigate('settings')}><LockKeyhole size={18} aria-hidden="true"/><span>{VIEW_TEXT.settings.title[lang]}</span></button></li>
      <li><button type="button" className="ui2-more-toggle" onClick={() => onNavigate('help')}><Info size={18} aria-hidden="true"/><span>{VIEW_TEXT.help.title[lang]}</span></button></li>
    </ul>

    <Sheet open={Boolean(skill)} onClose={() => setOpened(null)} title={skill ? skill.labels[lang] : ''} lang={lang}>
      {skill && <div className="ui2-cap-details" data-testid="ui2-capability-details">
        <p className="ui2-cap-details-level"><strong>{levelLabel(skill.evidenceLevel || 'limited', lang)}</strong></p>
        <h3>{w.whyLevel}</h3>
        <WhyLine why={levelReason(skill, skills, lang)} lang={lang} actions={{ upload: () => { setOpened(null); onEdit('upload') }, review: () => { setOpened(null); openCourses() } }} testId="capability-why"/>
        <h3>{w.sources}</h3>
        <div className="ui2-legacy"><SkillCard skill={skill} lang={lang} projects={projectsForSkill(state.projects, skill.id)} verified={verified.has(skill.id)}/></div>
        <LevelLegend lang={lang} testId="level-legend-sheet"/>
        {/* Task 68: the matching Help page. */}
        <HelpPageLink lang={lang} page="guide"/>
      </div>}
    </Sheet>
  </section>
}
