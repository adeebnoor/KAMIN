// Task 63 · step 2 of 4: your projects, and nothing else. Loads on its own (lazy, from AppNext.jsx).
// One sentence, the self-declared rule (the old panel's words, src/content/projectCopy.js), then one main action
// at a time: "Add project" (or Next once a project is saved), then the form's Save. The form asks for a title, a
// short description and an optional https link; "Suggest skills" runs the improved local engine
// (src/ai/suggestSettings.js, unchanged: nothing leaves the browser) and shows its skills as chips the student can
// tap off. How the suggestions are made is behind "Why?" (a sheet). Saved projects are compact cards with Edit and
// Delete (Undo in the one message, Task 25). Next and "Skip for now" both open step 3.
// The evidence rule is today's: a project is recorded as self-declared and changes no capability or level
// (src/utils/projectEvidence.js); saving uses the hook's saveProject, deleting its removeProject (deleteItem).
// ProjectForm and the cards are exported so Profile (Task 66) can edit a project without a new upload.
// Task 44: in the trial, saving the form records how the suggestions were used, as four counts and the engine's
// version (src/pilot/studyCounts.js): shown, kept, unticked, added by hand. Never the text, a skill or the title;
// nothing outside an enrolled trial session, nothing when the form is cancelled or Suggest was not pressed.
// Task 43: with the hybrid method (not the default; ?suggest=hybrid, restored by Task 80b), an abstention offers "Look deeper"
// (components/LookDeeper.jsx): after consent, the local MiniLM model may add ONE skill, whose chip says
// "found by meaning, please check". It is a suggestion like the others (counted the same way in the trial).
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Plus, Sparkles } from 'lucide-react'
import { copy } from '../../i18n.js'
import { skills as catalog } from '../../data.js'
import { MAX_PROJECTS } from '../../utils/projectEvidence.js'
import { PROJECT_SUGGEST_METHOD, suggestForProject } from '../../ai/suggestSettings.js'
import { activeSuggestMethod, firstEngine, offersLookDeeper } from '../../ai/activeSuggestMethod.js'
import LookDeeper from '../components/LookDeeper.jsx'
import { projectCopy } from '../../content/projectCopy.js'
import { VIEW_TEXT } from '../views.js'
import { fillIn, nextCopy } from '../copy.js'
import StepChip from '../StepChip.jsx'
import Sheet from '../Sheet.jsx'
import Chip from '../Chip.jsx'
import HelpPageLink from '../HelpPageLink.jsx'
import ProjectCard, { skillName } from '../components/ProjectCard.jsx'
import { projectFromDraft, replaceProject, restoreProject } from '../projectsState.js'
import { recordProjectSuggestions } from '../../pilot/studyCounts.js'
import '../projects.css'

const SKILL_IDS = Object.values(catalog).map(skill => skill.id)
// The same limits as the old panel and the record (src/utils/projectEvidence.js keeps at most 5 skills).
export const MAX_PROJECT_SKILLS = 5
export const MIN_DESCRIPTION = 10
const BLANK = Object.freeze({ title: '', description: '', url: '', skillIds: [] })

// Why Save cannot be pressed yet, or '' when it can.
export function saveBlock(draft, { lang, full = false }) {
  const w = nextCopy(lang).projects
  if (full) return projectCopy(lang).limit(MAX_PROJECTS)
  if (draft.title.trim().length < 3) return w.needTitle
  if (!draft.skillIds.length) return w.needSkill
  return ''
}

export function ProjectForm({ lang, editing = null, full = false, onSave, onCancel, onSuggested }) {
  const P = projectCopy(lang)
  const w = nextCopy(lang).projects
  const id = useId()
  const [draft, setDraft] = useState(() => (editing ? { title: editing.title, description: editing.description || '', url: editing.url || '', skillIds: editing.skillIds } : BLANK))
  // The skills shown as chips: the suggested ones (and an edited project's own), or every skill on request.
  const [shown, setShown] = useState(() => (editing ? editing.skillIds : []))
  const [all, setAll] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Task 43: the engine for this page load, whether "Look deeper" is offered (and for which Suggest press), and
  // the skills the fallback found.
  const [method] = useState(() => activeSuggestMethod())
  const [deeper, setDeeper] = useState(null)
  const [byMeaning, setByMeaning] = useState(() => new Set())
  const titleRef = useRef(null), chipsRef = useRef(null)
  // Task 44: every skill the engine suggested in this form, and the engine's version (for the trial's counts).
  const suggested = useRef({ ids: new Set(), engine: null })
  useEffect(() => { titleRef.current?.focus() }, [])
  const set = key => event => { const value = event.target.value; setError(''); setDraft(d => ({ ...d, [key]: value })) }
  const toggle = skillId => setDraft(d => ({ ...d, skillIds: d.skillIds.includes(skillId) ? d.skillIds.filter(s => s !== skillId) : d.skillIds.length >= MAX_PROJECT_SKILLS ? d.skillIds : [...d.skillIds, skillId] }))
  const shortDescription = draft.description.trim().length < MIN_DESCRIPTION
  const suggest = async () => {
    setBusy(true)
    try {
      const result = await suggestForProject(draft.description, firstEngine(method))
      show(result)
      setDeeper(offersLookDeeper(method, result) ? { key: Date.now() } : null)
      requestAnimationFrame(() => chipsRef.current?.querySelector('button')?.focus())
    } finally { setBusy(false) }
  }
  function show(result) {
    const ids = result.suggestions.map(s => s.skillId)
    setSuggestion(result); onSuggested?.(result)
    for (const skillId of ids) suggested.current.ids.add(skillId)
    suggested.current.engine = result.version
    setShown(prev => [...new Set([...ids, ...prev])])
    setDraft(d => ({ ...d, skillIds: [...new Set([...d.skillIds, ...ids])].slice(0, MAX_PROJECT_SKILLS) }))
  }
  const foundByMeaning = result => { setByMeaning(prev => new Set([...prev, ...result.suggestions.map(s => s.skillId)])); show(result) }
  const reason = saveBlock(draft, { lang, full: full && !editing })
  const save = event => {
    event.preventDefault()
    if (reason) return
    try { onSave(projectFromDraft(draft, editing)) } catch (failure) { setError(failure.message === 'PROJECT_URL_MUST_BE_HTTPS' ? P.urlError : P.invalid); return }
    const { ids, engine } = suggested.current
    if (engine) recordProjectSuggestions({ suggested: [...ids], saved: draft.skillIds, before: editing?.skillIds || [], engine })
  }
  const chips = all ? SKILL_IDS : shown
  return <form className="ui2-project-form" aria-labelledby={`${id}-head`} onSubmit={save} noValidate data-testid="ui2-project-form">
    <h2 className="ui2-project-form-title" id={`${id}-head`}>{editing ? w.editTitle : w.newTitle}</h2>
    <label htmlFor={`${id}-title`}>{w.title}</label>
    <input id={`${id}-title`} ref={titleRef} maxLength={120} autoComplete="off" value={draft.title} onChange={set('title')}/>
    <label htmlFor={`${id}-description`}>{w.description}</label>
    <textarea id={`${id}-description`} rows={3} maxLength={400} value={draft.description} onChange={set('description')} aria-describedby={shortDescription ? `${id}-hint` : undefined}/>
    <label htmlFor={`${id}-url`}>{w.link}</label>
    <input id={`${id}-url`} dir="ltr" inputMode="url" maxLength={300} autoComplete="off" placeholder="https://" value={draft.url} onChange={set('url')} aria-describedby={`${id}-url-note`}/>
    <p className="ui2-project-hint" id={`${id}-url-note`} data-testid="project-link-note">{w.linkNote}</p>
    <div className="ui2-project-suggest">
      <button type="button" className="ui2-btn" disabled={shortDescription || busy} onClick={suggest}><Sparkles size={16} aria-hidden="true"/>{w.suggest}</button>
      {shortDescription && <span className="ui2-project-hint" id={`${id}-hint`}>{w.suggestHint}</span>}
    </div>
    {suggestion?.abstained && <p className="ui2-project-abstain" role="status">{P.abstain}</p>}
    {deeper && <LookDeeper key={deeper.key} lang={lang} description={draft.description} onFound={foundByMeaning}/>}
    {chips.length > 0 && <fieldset className="ui2-project-chips">
      <legend>{all ? w.allSkills : w.chips}</legend>
      <div ref={chipsRef}>{chips.map(skillId => <Chip key={skillId} selected={draft.skillIds.includes(skillId)} onClick={() => toggle(skillId)}>{skillName(skillId, lang)}{byMeaning.has(skillId) && <small className="ui2-by-meaning"> · {w.deeper.byMeaning}</small>}</Chip>)}</div>
    </fieldset>}
    {(suggestion || editing) && !all && <button type="button" className="ui2-text-btn" onClick={() => setAll(true)}>{w.chooseSelf}</button>}
    {error && <p className="ui2-project-reason" role="alert">{error}</p>}
    <div className="ui2-project-form-actions">
      {reason && <p className="ui2-project-reason" data-testid="project-save-reason">{reason}</p>}
      <button type="button" className="ui2-btn" onClick={onCancel}>{w.cancel}</button>
      <button type="submit" className="ui2-btn ui2-btn-primary" disabled={!!reason}>{w.save}</button>
    </div>
  </form>
}

// "Why?": how the skills are suggested. The old panel's method sentence word for word, the sentence each suggested
// skill comes from, and the engine under "Technical details".
function WhySuggestions({ lang, suggestion }) {
  const P = projectCopy(lang)
  const w = nextCopy(lang).projects
  return <div className="ui2-project-why">
    {w.whyLines.map(line => <p key={line}>{line}</p>)}
    <p>{P.suggestNote}</p>
    {suggestion?.suggestions?.length > 0 && <ul>{suggestion.suggestions.map(s => <li key={s.skillId}><strong>{skillName(s.skillId, lang)}</strong>{' · '}{w.because} <q>{s.snippet}</q></li>)}</ul>}
    <details>
      <summary>{w.technical}</summary>
      <p dir="ltr">{fillIn(w.engine, { engine: suggestion?.version || PROJECT_SUGGEST_METHOD })}</p>
    </details>
    {/* Task 68: the matching Help page. */}
    <HelpPageLink lang={lang} page="guide"/>
  </div>
}

export default function Projects({ lang, profile, focusHeading, onNavigate, notify, editMode = false }) {
  const P = projectCopy(lang)
  const w = nextCopy(lang).projects
  const { state, actions } = profile
  const projects = state.projects || []
  const full = projects.length >= MAX_PROJECTS
  // null while the form is closed; { editing: null } adds a project, { editing: project } edits that one.
  const [form, setForm] = useState(null)
  const [whyOpen, setWhyOpen] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [focusMain, setFocusMain] = useState(false)
  const heading = useRef(null), mainButton = useRef(null)
  useEffect(() => { if (focusHeading) heading.current?.focus() }, [focusHeading])
  // After Save, Cancel or Delete, focus goes to the page's one main button (Next, or Add project).
  useEffect(() => { if (focusMain && !form) { mainButton.current?.focus(); setFocusMain(false) } }, [focusMain, form])

  const openForm = editing => { setSuggestion(null); setForm({ editing, key: Date.now() }) }
  const closeForm = () => { setForm(null); setFocusMain(true) }
  const save = record => {
    if (form?.editing) actions.setState(s => replaceProject(s, record))
    else actions.saveProject(record)
    closeForm()
    notify(P.saved)
  }
  const remove = project => {
    const index = projects.findIndex(p => p.id === project.id)
    if (form?.editing?.id === project.id) setForm(null)
    actions.removeProject(project.id)
    setFocusMain(true)
    notify(w.deleted, { action: { label: w.undo, onClick: () => actions.setState(s => restoreProject(s, project, index, copy[lang].screens.myData.auditProject)) } })
  }
  // Task 66: opened from Profile's Edit, the step's way on is "Back to Profile".
  const toNext = () => onNavigate(editMode ? 'profile' : 'interests')
  const Forward = lang === 'ar' ? ArrowLeft : ArrowRight
  const formFor = editing => <ProjectForm key={form.key} lang={lang} editing={editing} full={full} onSave={save} onCancel={closeForm} onSuggested={setSuggestion}/>

  return <section className="ui2-page ui2-projects" aria-labelledby="ui2-page-title" data-view="projects" data-testid="ui2-page">
    {!editMode && <StepChip view="projects" lang={lang} onNavigate={onNavigate}/>}
    <h1 id="ui2-page-title" tabIndex={-1} ref={heading}>{VIEW_TEXT.projects.title[lang]}</h1>
    <p className="ui2-projects-line"><span>{w.line}</span><button type="button" className="ui2-text-btn" aria-haspopup="dialog" onClick={() => setWhyOpen(true)}>{w.why}</button></p>
    <p className="ui2-projects-rule" data-testid="project-rule">{P.rule}</p>

    {form && !form.editing && formFor(null)}
    {projects.length > 0 && <ul className="ui2-project-list">{projects.map(project => <li key={project.id}>
      {form?.editing?.id === project.id ? formFor(project) : <ProjectCard lang={lang} project={project} onEdit={openForm} onDelete={remove}/>}
    </li>)}</ul>}

    {!form && <div className="ui2-projects-actions">
      {projects.length > 0
        ? <>
          <button type="button" ref={mainButton} className="ui2-btn ui2-btn-primary" onClick={toNext}>{editMode ? nextCopy(lang).profile.backToProfile : <>{w.next}<Forward size={18} aria-hidden="true"/></>}</button>
          {!full && <button type="button" className="ui2-btn" onClick={() => openForm(null)}><Plus size={18} aria-hidden="true"/>{w.addAnother}</button>}
        </>
        : <>
          <button type="button" ref={mainButton} className="ui2-btn ui2-btn-primary" onClick={() => openForm(null)}><Plus size={18} aria-hidden="true"/>{w.add}</button>
          <button type="button" className="ui2-text-btn" onClick={toNext}>{editMode ? nextCopy(lang).profile.backToProfile : w.skip}</button>
        </>}
    </div>}
    {!form && full && <p className="ui2-projects-rule" role="status">{P.limit(MAX_PROJECTS)}</p>}

    <Sheet open={whyOpen} onClose={() => setWhyOpen(false)} title={w.whyTitle} lang={lang}>
      <WhySuggestions lang={lang} suggestion={suggestion}/>
    </Sheet>
  </section>
}
