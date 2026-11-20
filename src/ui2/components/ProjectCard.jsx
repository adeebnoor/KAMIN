// Task 63 · one saved project, as a compact card: its title, the self-declared badge (the old panel's words,
// src/content/projectCopy.js), the skills it shows (names, never ids), its link if any, Edit and Delete.
// Used by step 2 (src/ui2/screens/Projects.jsx); Profile (Task 66) can list the same cards.
import { ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { skills as catalog } from '../../data.js'
import { projectCopy } from '../../content/projectCopy.js'
import { nextCopy } from '../copy.js'

const SKILLS = Object.values(catalog)
// A skill's name in the student's language (the id only if the catalogue ever lost it).
export const skillName = (id, lang) => SKILLS.find(skill => skill.id === id)?.labels[lang] || id

export default function ProjectCard({ lang, project, onEdit, onDelete }) {
  const P = projectCopy(lang)
  const w = nextCopy(lang).projects
  const titleId = `ui2-project-${project.id}`
  return <article className="ui2-project" aria-labelledby={titleId} data-testid="ui2-project">
    <div className="ui2-project-head">
      <h2 className="ui2-project-title" id={titleId}>{project.title}</h2>
      <span className="ui2-project-badge">{P.badge}</span>
    </div>
    <p className="ui2-project-skills">{project.skillIds.map(id => skillName(id, lang)).join(lang === 'ar' ? '، ' : ', ')}</p>
    <div className="ui2-project-actions">
      {project.url && <a href={project.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true"/>{P.openLink}</a>}
      {onEdit && <button type="button" className="ui2-text-btn" aria-label={`${w.edit}: ${project.title}`} onClick={() => onEdit(project)}><Pencil size={16} aria-hidden="true"/>{w.edit}</button>}
      {onDelete && <button type="button" className="ui2-text-btn" aria-label={`${w.remove}: ${project.title}`} onClick={() => onDelete(project)}><Trash2 size={16} aria-hidden="true"/>{w.remove}</button>}
    </div>
  </article>
}
