// Task 66 · one capability on Profile, as a compact row: its name, its level as a word (never a number) and an icon for
// where it comes from (the source is named for screen readers, as on the old dashboard's rows, Dashboard.jsx). A tap
// opens the reasons sheet (Profile.jsx): why this level, the courses, projects and credentials behind it, and what the
// levels mean. The row is a button named by what it shows, so "Source: …" is part of its accessible name.
import { BookOpen, ChevronDown, PencilLine, ShieldCheck } from 'lucide-react'
import { levelLabel } from '../../evidence/levels.js'
import { provenanceLabel, skillProvenance } from '../../utils/provenance.js'
import { nextCopy } from '../copy.js'

const SOURCE_ICON = { document: BookOpen, synthetic: BookOpen, mixed: BookOpen, edited: PencilLine, declared: PencilLine }

// Where a capability comes from, in words: a verified credential, or the provenance of its courses (the old rows' rule).
export function capabilitySource(skill, lang) {
  const practical = (skill.practicalEvidence || []).length > 0
  const provenance = skillProvenance(skill).level
  return { practical, provenance, text: practical ? nextCopy(lang).profile.verified : provenanceLabel(provenance, lang) }
}

export default function CapabilityRow({ lang, skill, describedBy, onOpen }) {
  const w = nextCopy(lang).profile
  const level = skill.evidenceLevel || 'limited'
  const source = capabilitySource(skill, lang)
  const Icon = source.practical ? ShieldCheck : SOURCE_ICON[source.provenance] || BookOpen
  return <button type="button" className="ui2-cap" data-testid="capability-row" data-skill={skill.id} data-level={level} aria-haspopup="dialog" aria-describedby={describedBy} onClick={onOpen}>
    <span className="ui2-cap-name">{skill.labels[lang]}</span>
    <span className="ui2-cap-level">{levelLabel(level, lang)}</span>
    <span className="ui2-cap-source" title={source.text}><Icon size={16} aria-hidden="true"/><span className="ui2-vh">{w.source}{source.text}</span></span>
    <ChevronDown size={16} className="ui2-cap-open" aria-hidden="true"/>
  </button>
}
