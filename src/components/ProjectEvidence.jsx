import { useId, useState } from 'react'
import { FolderGit2, Trash2, ExternalLink, Sparkles } from 'lucide-react'
import { skills as catalog } from '../data.js'
import { PROJECT_KINDS, MAX_PROJECTS, createProjectEvidence } from '../utils/projectEvidence.js'
import { suggestForProject } from '../ai/suggestSettings.js'
// Task 63: the self-declared sentences live in src/content/projectCopy.js (the new interface's step 2 shows the same words).
import { projectCopy } from '../content/projectCopy.js'

const tr = (lang, ar, en) => lang === 'ar' ? ar : en
const kinds = {
  project: ['مشروع تطبيقي', 'Applied project'],
  certificate: ['شهادة أو دورة مكتملة', 'Certificate or completed course'],
  internship: ['تدريب أو عمل', 'Internship or work'],
  other: ['أخرى', 'Other'],
}
const skillList = Object.values(catalog)
const blank = suggested => ({ title: '', kind: 'project', url: '', description: '', skillIds: suggested.slice(0, 3) })

export function ProjectEvidenceList({ lang, projects, onRemove }) {
  if (!projects?.length) return null
  const P = projectCopy(lang)
  return <ul className="project-evidence-list">{projects.map(project => <li key={project.id}>
    <div><strong>{project.title}</strong><span className="provenance-badge declared">{P.badge}</span></div>
    <small>{kinds[project.kind][lang === 'ar' ? 0 : 1]} · {project.skillIds.map(id => catalog[Object.keys(catalog).find(k => catalog[k].id === id)]?.labels[lang] || id).join(tr(lang, '، ', ', '))}</small>
    {project.description && <p>{project.description}</p>}
    <div className="project-evidence-actions">
      {project.url && <a href={project.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>{P.openLink}</a>}
      {onRemove && <button type="button" className="text-button" onClick={() => onRemove(project.id)}><Trash2 size={14}/>{tr(lang, 'حذف', 'Remove')}</button>}
    </div>
  </li>)}</ul>
}

export default function ProjectEvidencePanel({ lang, projects = [], onSave, onRemove, suggestedSkillIds = [], compact = false }) {
  const id = useId()
  const P = projectCopy(lang)
  const [open, setOpen] = useState(compact ? false : projects.length === 0)
  const [draft, setDraft] = useState(() => blank(suggestedSkillIds))
  const [message, setMessage] = useState('')
  const [suggestion, setSuggestion] = useState(null)
  const limit = projects.length >= MAX_PROJECTS
  const toggleSkill = skillId => setDraft(d => ({ ...d, skillIds: d.skillIds.includes(skillId) ? d.skillIds.filter(s => s !== skillId) : [...d.skillIds, skillId].slice(0, 5) }))
  const canSave = draft.title.trim().length >= 3 && draft.skillIds.length > 0 && !limit
  const save = event => {
    event.preventDefault()
    if (!canSave) return
    try {
      onSave(createProjectEvidence(draft))
      setDraft(blank(suggestedSkillIds)); setOpen(false)
      setMessage(P.saved)
    } catch (error) {
      setMessage(error.message === 'PROJECT_URL_MUST_BE_HTTPS'
        ? P.urlError
        : P.invalid)
    }
  }
  return <section className={`panel project-evidence ${compact ? 'compact' : ''}`} aria-label={tr(lang, 'أدلة تطبيقية مصرّح بها', 'Self-declared applied evidence')} data-testid="project-evidence">
    <div className="panel-head"><div><small>{tr(lang, 'من الفجوة إلى الدليل', 'FROM GAP TO EVIDENCE')}</small><h3><FolderGit2 size={18}/> {tr(lang, 'أدلة تطبيقية مصرّح بها', 'Self-declared applied evidence')}</h3></div>
      <button type="button" className="text-button" aria-expanded={open} aria-controls={`${id}-form`} onClick={() => setOpen(v => !v)}>{open ? tr(lang, 'إغلاق النموذج', 'Close form') : tr(lang, 'أضف دليل مشروع', 'Add project evidence')}</button></div>
    <p>{P.rule}</p>
    {open && <form id={`${id}-form`} className="project-evidence-form" onSubmit={save}>
      <label htmlFor={`${id}-title`}>{tr(lang, 'عنوان الدليل', 'Evidence title')}</label><input id={`${id}-title`} maxLength={120} required value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder={tr(lang, 'مثال: لوحة تحليل مبيعات بـ SQL وPower BI', 'Example: Sales analytics dashboard with SQL and Power BI')}/>
      <label htmlFor={`${id}-kind`}>{tr(lang, 'النوع', 'Kind')}</label><select id={`${id}-kind`} value={draft.kind} onChange={e => setDraft(d => ({ ...d, kind: e.target.value }))}>{PROJECT_KINDS.map(kind => <option key={kind} value={kind}>{kinds[kind][lang === 'ar' ? 0 : 1]}</option>)}</select>
      <label htmlFor={`${id}-url`}>{tr(lang, 'رابط https — اختياري (مستودع، ملف عام، شهادة)', 'https link — optional (repository, public file, certificate)')}</label><input id={`${id}-url`} dir="ltr" inputMode="url" maxLength={300} value={draft.url} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))} placeholder="https://"/>
      <label htmlFor={`${id}-description`}>{tr(lang, 'ما الذي أنجزته بنفسك؟ — بلا معلومات حساسة', 'What did you do yourself? — no sensitive information')}</label><textarea id={`${id}-description`} rows={3} maxLength={400} value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}/>
      <div className="suggest-block" data-testid="capability-suggestions">
        <button type="button" className="text-button" disabled={draft.description.trim().length < 10} onClick={() => suggestForProject(draft.description).then(setSuggestion)}><Sparkles size={15}/>{tr(lang, 'اقترح القدرات من الوصف — محليًا', 'Suggest capabilities from the description — locally')}</button>
        {suggestion && (suggestion.abstained
          ? <p className="suggest-abstain">{P.abstain}</p>
          : <ul className="suggest-list">{suggestion.suggestions.map(s => <li key={s.skillId}><label className="choice-chip"><input type="checkbox" checked={draft.skillIds.includes(s.skillId)} onChange={() => toggleSkill(s.skillId)}/><span>{skillList.find(k => k.id === s.skillId)?.labels[lang] || s.skillId}</span></label><q>{s.snippet}</q><small>{tr(lang, 'الكلمات الدالة: ', 'Cues: ')}{s.matches.join(tr(lang, '، ', ', '))} · {s.confidence === 'multiple-cues' ? tr(lang, 'أكثر من إشارة', 'multiple cues') : tr(lang, 'إشارة واحدة', 'single cue')}</small></li>)}</ul>)}
        {suggestion && <small className="suggest-note">{P.suggestNote}</small>}
      </div>
      <fieldset><legend>{tr(lang, 'القدرات التي يخدمها هذا الدليل', 'Capabilities this evidence addresses')}</legend>
        <div className="project-skill-options">{skillList.map(skill => <label key={skill.id} className={`choice-chip ${suggestedSkillIds.includes(skill.id) ? 'suggested' : ''}`}><input type="checkbox" checked={draft.skillIds.includes(skill.id)} onChange={() => toggleSkill(skill.id)}/><span>{skill.labels[lang]}{suggestedSkillIds.includes(skill.id) && <small> · {tr(lang, 'فجوة حالية', 'current gap')}</small>}</span></label>)}</div>
      </fieldset>
      {limit && <p role="alert">{P.limit(MAX_PROJECTS)}</p>}
      <div className="review-actions"><button className="button primary" type="submit" disabled={!canSave}>{tr(lang, 'سجّل الدليل محليًا', 'Record evidence locally')}</button><button className="button secondary" type="button" onClick={() => setOpen(false)}>{tr(lang, 'إلغاء', 'Cancel')}</button></div>
    </form>}
    <ProjectEvidenceList lang={lang} projects={projects} onRemove={onRemove}/>
    {message && <p role="status">{message}</p>}
  </section>
}
