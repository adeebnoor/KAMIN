// Task 64 · one interest in the student's own words, as a card: the sentence exactly as written, then what KAMIN
// understood from it as chips ("Pathways: …", "Skills: …", "Topics: …"). A tap turns a chip off (it stays listed,
// so a second tap brings it back); the sentence is always kept. Edit changes the sentence in place, Delete
// removes it with its chips. Used by step 3 (src/ui2/screens/Interests.jsx); Profile (Task 66) can list the same
// cards. Names only, never ids: pathways from src/matching/targets.js, skills from the catalogue, topics from the
// interest vocabulary (src/interests/vocabulary.js).
import { useEffect, useId, useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { targetProfiles } from '../../matching/targets.js'
import { INTEREST_TOPICS } from '../../interests/vocabulary.js'
import { nextCopy } from '../copy.js'
import { skills as catalog } from '../../data.js'
import Chip from '../Chip.jsx'

// A skill's name in the student's language (as step 2's card does; not imported from it, so step 3's chunk does
// not carry step 2's card).
const SKILLS = Object.values(catalog)
const skillName = (id, lang) => SKILLS.find(skill => skill.id === id)?.labels[lang] || id

// The three kinds of understood chips, in the order the card shows them.
export const CHIP_KINDS = Object.freeze(['pathway', 'capability', 'topic'])
const HEADING = { pathway: 'pathways', capability: 'skills', topic: 'topics' }
export function chipName(kind, id, lang) {
  if (kind === 'capability') return skillName(id, lang)
  if (kind === 'pathway') return targetProfiles.find(t => t.id === id)?.title?.[lang] || id
  return INTEREST_TOPICS.find(t => t.id === id)?.labels?.[lang] || id
}

export const MIN_INTEREST = 3, MAX_INTEREST = 500
export const longEnough = text => text.trim().length >= MIN_INTEREST

function EditForm({ lang, entry, busy, error, onSave, onCancel }) {
  const w = nextCopy(lang).interests
  const id = useId()
  const [text, setText] = useState(entry.text)
  const box = useRef(null)
  useEffect(() => { box.current?.focus() }, [])
  return <form className="ui2-interest-edit" onSubmit={event => { event.preventDefault(); if (longEnough(text) && !busy) onSave(text) }}>
    <label htmlFor={`${id}-text`}>{w.sentence}</label>
    <textarea id={`${id}-text`} ref={box} rows={2} maxLength={MAX_INTEREST} value={text} onChange={event => setText(event.target.value)}/>
    {error && <p className="ui2-interest-error" role="alert">{error}</p>}
    <div className="ui2-interest-actions">
      <button type="button" className="ui2-btn" onClick={onCancel}>{w.cancel}</button>
      <button type="submit" className="ui2-btn" disabled={!longEnough(text) || busy}>{w.save}</button>
    </div>
  </form>
}

export default function FreeInterestCard({ lang, entry, editing = false, busy = false, error = '', onToggle, onEdit, onSave, onCancel, onDelete }) {
  const w = nextCopy(lang).interests
  const id = useId()
  const groups = CHIP_KINDS.map(kind => [kind, entry.understood.filter(chip => chip.kind === kind)]).filter(([, chips]) => chips.length)
  const short = [...entry.text.trim()].length > 40 ? `${[...entry.text.trim()].slice(0, 40).join('')}…` : entry.text.trim()
  return <article className="ui2-interest" aria-labelledby={`${id}-label`} data-testid="ui2-free-interest">
    <p className="ui2-interest-label" id={`${id}-label`}>{w.yourWords}</p>
    {editing
      ? <EditForm lang={lang} entry={entry} busy={busy} error={error} onSave={onSave} onCancel={onCancel}/>
      : <blockquote className="ui2-interest-text" data-testid="ui2-free-interest-text">{entry.text}</blockquote>}
    {groups.length
      ? <>
        {groups.map(([kind, chips]) => <div className="ui2-interest-chips" role="group" aria-labelledby={`${id}-${kind}`} key={kind}>
          <span id={`${id}-${kind}`}>{w[HEADING[kind]]}</span>
          {chips.map(chip => <Chip key={chip.id} selected={!chip.removed} disabled={editing} onClick={() => onToggle(kind, chip.id)}>{chipName(kind, chip.id, lang)}</Chip>)}
        </div>)}
        <p className="ui2-interest-hint">{w.chipsHint}</p>
      </>
      : <p className="ui2-interest-hint" data-testid="ui2-free-interest-nothing">{w.nothing}</p>}
    {!editing && <div className="ui2-interest-actions">
      <button type="button" className="ui2-text-btn" aria-label={`${w.edit}: ${short}`} onClick={onEdit}><Pencil size={16} aria-hidden="true"/>{w.edit}</button>
      <button type="button" className="ui2-text-btn" aria-label={`${w.remove}: ${short}`} onClick={onDelete}><Trash2 size={16} aria-hidden="true"/>{w.remove}</button>
    </div>}
  </article>
}
