import { useId, useState } from 'react'
import { FolderGit2, Trash2, ExternalLink } from 'lucide-react'
import { skills as catalog } from '../data.js'
import { PROJECT_KINDS, MAX_PROJECTS, createProjectEvidence } from '../utils/projectEvidence.js'

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
  return <ul className="project-evidence-list">{projects.map(project => <li key={project.id}>
    <div><strong>{project.title}</strong><span className="provenance-badge declared">{tr(lang, 'تصريح ذاتي · بانتظار مراجعة', 'Self-declared · awaiting review')}</span></div>
    <small>{kinds[project.kind][lang === 'ar' ? 0 : 1]} · {project.skillIds.map(id => catalog[Object.keys(catalog).find(k => catalog[k].id === id)]?.labels[lang] || id).join(tr(lang, '، ', ', '))}</small>
    {project.description && <p>{project.description}</p>}
    <div className="project-evidence-actions">
      {project.url && <a href={project.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>{tr(lang, 'فتح الرابط', 'Open link')}</a>}
      {onRemove && <button type="button" className="text-button" onClick={() => onRemove(project.id)}><Trash2 size={14}/>{tr(lang, 'حذف', 'Remove')}</button>}
    </div>
  </li>)}</ul>
}

export default function ProjectEvidencePanel({ lang, projects = [], onSave, onRemove, suggestedSkillIds = [], compact = false }) {
  const id = useId()
  const [open, setOpen] = useState(compact ? false : projects.length === 0)
  const [draft, setDraft] = useState(() => blank(suggestedSkillIds))
  const [message, setMessage] = useState('')
  const limit = projects.length >= MAX_PROJECTS
  const toggleSkill = skillId => setDraft(d => ({ ...d, skillIds: d.skillIds.includes(skillId) ? d.skillIds.filter(s => s !== skillId) : [...d.skillIds, skillId].slice(0, 5) }))
  const canSave = draft.title.trim().length >= 3 && draft.skillIds.length > 0 && !limit
  const save = event => {
    event.preventDefault()
    if (!canSave) return
    try {
      onSave(createProjectEvidence(draft))
      setDraft(blank(suggestedSkillIds)); setOpen(false)
      setMessage(tr(lang, 'سُجّل الدليل محليًا كتصريح ذاتي. لم يُضف قدرة ولم يتغيّر أي حكم؛ يرتفع مستواه فقط بعد مراجعة مستشار أو جهة معتمدة.', 'Recorded locally as self-declared evidence. No capability was added and no judgment changed; the level rises only after an advisor or authorized issuer reviews it.'))
    } catch (error) {
      setMessage(error.message === 'PROJECT_URL_MUST_BE_HTTPS'
        ? tr(lang, 'الرابط يجب أن يبدأ بـ https://، أو اتركه فارغًا.', 'The link must start with https://, or leave it empty.')
        : tr(lang, 'تعذر تسجيل الدليل. أكمل العنوان واختر قدرة واحدة على الأقل.', 'Could not record the evidence. Complete the title and choose at least one capability.'))
    }
  }
  return <section className={`panel project-evidence ${compact ? 'compact' : ''}`} aria-label={tr(lang, 'أدلة تطبيقية مصرّح بها', 'Self-declared applied evidence')} data-testid="project-evidence">
    <div className="panel-head"><div><small>{tr(lang, 'من الفجوة إلى الدليل', 'FROM GAP TO EVIDENCE')}</small><h3><FolderGit2 size={18}/> {tr(lang, 'أدلة تطبيقية مصرّح بها', 'Self-declared applied evidence')}</h3></div>
      <button type="button" className="text-button" aria-expanded={open} aria-controls={`${id}-form`} onClick={() => setOpen(v => !v)}>{open ? tr(lang, 'إغلاق النموذج', 'Close form') : tr(lang, 'أضف دليل مشروع', 'Add project evidence')}</button></div>
    <p>{tr(lang, 'مشروع أو شهادة أو تدريب يغطي فجوة في ملفك. يُسجَّل كتصريح ذاتي بمستوى «تطبيقي مصرّح»، ولا يصبح قدرة أو يغيّر الملاءمة حتى يراجعه مستشار أو تتحقق منه جهة معتمدة.', 'A project, certificate or internship that covers a gap in your profile. It is recorded as self-declared "applied" evidence and never becomes a capability or changes Fit until an advisor reviews it or an authorized issuer verifies it.')}</p>
    {open && <form id={`${id}-form`} className="project-evidence-form" onSubmit={save}>
      <label htmlFor={`${id}-title`}>{tr(lang, 'عنوان الدليل', 'Evidence title')}</label><input id={`${id}-title`} maxLength={120} required value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder={tr(lang, 'مثال: لوحة تحليل مبيعات بـ SQL وPower BI', 'Example: Sales analytics dashboard with SQL and Power BI')}/>
      <label htmlFor={`${id}-kind`}>{tr(lang, 'النوع', 'Kind')}</label><select id={`${id}-kind`} value={draft.kind} onChange={e => setDraft(d => ({ ...d, kind: e.target.value }))}>{PROJECT_KINDS.map(kind => <option key={kind} value={kind}>{kinds[kind][lang === 'ar' ? 0 : 1]}</option>)}</select>
      <label htmlFor={`${id}-url`}>{tr(lang, 'رابط https — اختياري (مستودع، ملف عام، شهادة)', 'https link — optional (repository, public file, certificate)')}</label><input id={`${id}-url`} dir="ltr" inputMode="url" maxLength={300} value={draft.url} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))} placeholder="https://"/>
      <label htmlFor={`${id}-description`}>{tr(lang, 'ما الذي أنجزته بنفسك؟ — بلا معلومات حساسة', 'What did you do yourself? — no sensitive information')}</label><textarea id={`${id}-description`} rows={3} maxLength={400} value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}/>
      <fieldset><legend>{tr(lang, 'القدرات التي يخدمها هذا الدليل', 'Capabilities this evidence addresses')}</legend>
        <div className="project-skill-options">{skillList.map(skill => <label key={skill.id} className={`choice-chip ${suggestedSkillIds.includes(skill.id) ? 'suggested' : ''}`}><input type="checkbox" checked={draft.skillIds.includes(skill.id)} onChange={() => toggleSkill(skill.id)}/><span>{skill.labels[lang]}{suggestedSkillIds.includes(skill.id) && <small> · {tr(lang, 'فجوة حالية', 'current gap')}</small>}</span></label>)}</div>
      </fieldset>
      {limit && <p role="alert">{tr(lang, `وصل السجل إلى ${MAX_PROJECTS} دليلًا. احذف دليلًا قديمًا للمتابعة.`, `The record holds ${MAX_PROJECTS} entries. Remove an older one to continue.`)}</p>}
      <div className="review-actions"><button className="button primary" type="submit" disabled={!canSave}>{tr(lang, 'سجّل الدليل محليًا', 'Record evidence locally')}</button><button className="button secondary" type="button" onClick={() => setOpen(false)}>{tr(lang, 'إلغاء', 'Cancel')}</button></div>
    </form>}
    <ProjectEvidenceList lang={lang} projects={projects} onRemove={onRemove}/>
    {message && <p role="status">{message}</p>}
  </section>
}
