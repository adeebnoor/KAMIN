// Task 63 · step 2's two changes to the profile that the shared hook (src/state/useKaminProfile.js) does not have:
// edit a project where it is, and put a deleted project back (Undo). Pure functions of the state, applied with
// actions.setState, so they load with the new interface's lazy chunk and the startup bundle never carries them.
// Saving a new project and deleting one use the hook's own saveProject and removeProject (deleteItem, Task 46).
// Every record goes through normalizeProjectEvidence (src/utils/projectEvidence.js, unchanged): a project stays
// self-declared ('declared-applied', unreviewed) and never touches courses, capabilities or evidence levels.
import { createProjectEvidence, normalizeProjectEvidence } from '../utils/projectEvidence.js'

// The record for the form's draft. A new project gets a new id; an edited one keeps its id, kind and date.
export function projectFromDraft(draft, editing = null, now = new Date()) {
  const record = createProjectEvidence({ title: draft.title, kind: editing?.kind || 'project', url: draft.url, description: draft.description, skillIds: draft.skillIds }, now)
  return editing ? { ...record, id: editing.id, createdAt: editing.createdAt } : record
}

// The edited project replaces the old one in its place (the list keeps its order). Unknown id: added first.
export function replaceProject(state, record) {
  const list = state.projects || []
  const next = list.some(p => p.id === record.id) ? list.map(p => (p.id === record.id ? record : p)) : [record, ...list]
  return { ...state, projects: normalizeProjectEvidence(next) }
}

// Undo a delete: the project goes back where it was, with a usage-log line that names no title (Task 46: the
// label is the hook's own "Project evidence added").
export function restoreProject(state, record, index, auditLabel) {
  const list = (state.projects || []).filter(p => p.id !== record.id)
  list.splice(Math.max(0, Math.min(Number.isInteger(index) ? index : 0, list.length)), 0, record)
  const audit = auditLabel ? [{ label: auditLabel, ts: Date.now() }, ...(state.audit || [])].slice(0, 100) : state.audit
  return { ...state, projects: normalizeProjectEvidence(list), audit }
}
