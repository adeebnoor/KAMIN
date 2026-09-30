// Student-declared applied evidence (projects, certificates, internships).
//
// Closes the loop from "missing evidence" to "evidence a reviewer can look at".
// A declaration never creates a capability, never changes Fit and never rises above
// the self-declared level until a reviewer confirms it outside this public release.
import { skills as catalog } from '../data.js'

export const PROJECT_KINDS = ['project', 'certificate', 'internship', 'other']
export const PROJECT_EVIDENCE_LEVEL = 'declared-applied'
export const MAX_PROJECTS = 50
const SKILL_IDS = new Set(Object.values(catalog).map(skill => skill.id))
const clean = (value, max) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''

export function safeProjectUrl(value) {
  const text = clean(value, 300)
  if (!text) return null
  try { const url = new URL(text); return url.protocol === 'https:' ? url.toString() : null } catch { return null }
}

export function normalizeProjectEvidence(list) {
  if (!Array.isArray(list)) return []
  const ids = new Set()
  return list.slice(0, MAX_PROJECTS).flatMap(record => {
    if (!record || typeof record !== 'object') return []
    const id = clean(record.id, 100)
    if (!/^project-[a-zA-Z0-9-]{4,90}$/.test(id) || ids.has(id)) return []
    const title = clean(record.title, 120)
    if (title.length < 3) return []
    const kind = PROJECT_KINDS.includes(record.kind) ? record.kind : 'other'
    const skillIds = Array.isArray(record.skillIds) ? [...new Set(record.skillIds.filter(s => SKILL_IDS.has(s)))].slice(0, 5) : []
    if (!skillIds.length) return []
    if (!Number.isFinite(Date.parse(record.createdAt))) return []
    ids.add(id)
    return [{
      id, title, kind, skillIds,
      url: safeProjectUrl(record.url),
      description: clean(record.description, 400),
      createdAt: new Date(record.createdAt).toISOString(),
      level: PROJECT_EVIDENCE_LEVEL,
      reviewStatus: 'unreviewed',
    }]
  })
}

export function createProjectEvidence(draft, now = new Date()) {
  const candidate = {
    id: `project-${globalThis.crypto.randomUUID()}`,
    title: draft.title, kind: draft.kind, url: draft.url, description: draft.description,
    skillIds: draft.skillIds, createdAt: now.toISOString(),
  }
  const record = normalizeProjectEvidence([candidate])[0]
  if (!record) throw new Error('INVALID_PROJECT_EVIDENCE')
  if (clean(draft.url, 300) && !record.url) throw new Error('PROJECT_URL_MUST_BE_HTTPS')
  return record
}

export const projectsForSkill = (projects, skillId) => (projects || []).filter(p => p.skillIds.includes(skillId))
