// Task progress: saved locally, reopened later, never a capability by itself.
//
// Three separate claims are tracked and never merged:
//   completion   — the student attached an output (self-declared)
//   evaluation   — a self-assessment or a locally declared reviewer opinion (self-declared)
//   verification — an authorized issuer verified the record (never set here)
// No client action, alias or declared role can raise the evidence level above declared.
import { taskById, taskCatalog } from './catalog.js'
import { safeProjectUrl } from '../utils/projectEvidence.js'

export const TASK_STATUSES = ['not-started', 'in-progress', 'output-attached', 'needs-improvement', 'reviewed']
export const TASK_EVIDENCE_LEVEL = 'declared-applied'
export const REVIEWER_ROLES = ['student', 'peer', 'advisor']
export const REVIEW_DECISIONS = ['reviewed', 'needs-improvement']
export const MAX_TASK_RECORDS = 100
const TRANSITIONS = {
  'not-started': ['in-progress'],
  'in-progress': ['output-attached'],
  'output-attached': ['reviewed', 'needs-improvement', 'output-attached'],
  'needs-improvement': ['in-progress', 'output-attached'],
  'reviewed': ['output-attached'],
}
const clean = (value, max) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''
const iso = value => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null

export function normalizeTaskProgress(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  return list.slice(0, MAX_TASK_RECORDS).flatMap(record => {
    const task = record && taskById(record.taskId)
    if (!task || seen.has(task.id) || !TASK_STATUSES.includes(record.status)) return []
    const outputs = (Array.isArray(record.outputs) ? record.outputs : []).slice(0, 20).flatMap(o => {
      const note = clean(o?.note, 400), url = safeProjectUrl(o?.url), at = iso(o?.at)
      return (note || url) && at ? [{ url, note, at }] : []
    })
    const selfAssessment = Object.fromEntries(task.rubric.filter(c => ['meets', 'needs-improvement'].includes(record.selfAssessment?.[c.id])).map(c => [c.id, record.selfAssessment[c.id]]))
    const reviews = (Array.isArray(record.reviews) ? record.reviews : []).slice(0, 20).flatMap(r => {
      const reviewerLabel = clean(r?.reviewerLabel, 60), scope = clean(r?.scope, 160), note = clean(r?.note, 400), at = iso(r?.at)
      if (reviewerLabel.length < 2 || !REVIEWER_ROLES.includes(r?.role) || !REVIEW_DECISIONS.includes(r?.decision) || !at) return []
      return [{ reviewerLabel, role: r.role, scope, decision: r.decision, note, at, level: 'declared' }]
    })
    if (record.status === 'output-attached' || record.status === 'reviewed' || record.status === 'needs-improvement') { if (!outputs.length) return [] }
    if (record.status === 'reviewed' && !reviews.length) return []
    seen.add(task.id)
    return [{ taskId: task.id, status: record.status, startedAt: iso(record.startedAt), updatedAt: iso(record.updatedAt) || new Date().toISOString(), outputs, selfAssessment, reviews, level: TASK_EVIDENCE_LEVEL }]
  })
}

const upsert = (records, next) => normalizeTaskProgress([next, ...normalizeTaskProgress(records).filter(r => r.taskId !== next.taskId)])
const current = (records, taskId) => normalizeTaskProgress(records).find(r => r.taskId === taskId) || { taskId, status: 'not-started', startedAt: null, updatedAt: null, outputs: [], selfAssessment: {}, reviews: [], level: TASK_EVIDENCE_LEVEL }
const move = (record, status, now) => {
  if (!TRANSITIONS[record.status]?.includes(status)) throw new Error(`TASK_TRANSITION_NOT_ALLOWED:${record.status}->${status}`)
  return { ...record, status, updatedAt: now.toISOString() }
}

export function startTask(records, taskId, now = new Date()) {
  const record = current(records, taskId)
  const next = record.status === 'needs-improvement' ? move(record, 'in-progress', now) : move(record, 'in-progress', now)
  return upsert(records, { ...next, startedAt: record.startedAt || now.toISOString() })
}

export function attachTaskOutput(records, taskId, { url = '', note = '' }, now = new Date()) {
  const record = current(records, taskId)
  const safeUrl = safeProjectUrl(url)
  if (clean(url, 300) && !safeUrl) throw new Error('TASK_OUTPUT_URL_MUST_BE_HTTPS')
  if (!safeUrl && clean(note, 400).length < 10) throw new Error('TASK_OUTPUT_REQUIRED')
  const base = record.status === 'not-started' ? { ...record, status: 'in-progress', startedAt: now.toISOString() } : record
  const next = move(base, 'output-attached', now)
  return upsert(records, { ...next, outputs: [{ url: safeUrl, note: clean(note, 400), at: now.toISOString() }, ...record.outputs] })
}

export function selfAssessTask(records, taskId, assessment, now = new Date()) {
  const record = current(records, taskId)
  if (!record.outputs.length) throw new Error('TASK_OUTPUT_REQUIRED')
  return upsert(records, { ...record, selfAssessment: { ...record.selfAssessment, ...assessment }, updatedAt: now.toISOString() })
}

export function recordLocalTaskReview(records, taskId, { reviewerLabel, role, scope = '', decision, note = '' }, now = new Date()) {
  const record = current(records, taskId)
  if (!record.outputs.length) throw new Error('TASK_OUTPUT_REQUIRED')
  if (clean(reviewerLabel, 60).length < 2 || !REVIEWER_ROLES.includes(role) || !REVIEW_DECISIONS.includes(decision)) throw new Error('INVALID_TASK_REVIEW')
  const next = move(record.status === 'reviewed' || record.status === 'needs-improvement' ? { ...record, status: 'output-attached' } : record, decision, now)
  return upsert(records, { ...next, reviews: [{ reviewerLabel: clean(reviewerLabel, 60), role, scope: clean(scope, 160), decision, note: clean(note, 400), at: now.toISOString(), level: 'declared' }, ...record.reviews] })
}

// The three claims, reported separately. Verification is never produced by this module.
export function taskProof(record) {
  const completion = ['output-attached', 'needs-improvement', 'reviewed'].includes(record?.status || 'not-started')
  const evaluation = record?.reviews?.length ? 'local-declared-review' : Object.keys(record?.selfAssessment || {}).length ? 'self-assessment' : 'none'
  return { completion, evaluation, issuerVerification: 'none', evidenceLevel: TASK_EVIDENCE_LEVEL }
}

export function recommendTask({ missingSkills = [], records = [] }) {
  const progress = normalizeTaskProgress(records)
  const open = progress.find(r => ['in-progress', 'needs-improvement'].includes(r.status))
  if (open) return { task: taskById(open.taskId), record: open, reason: 'continue' }
  for (const skillId of missingSkills) {
    const task = taskCatalog.find(candidate => candidate.skillIds.includes(skillId) && !progress.some(r => r.taskId === candidate.id && r.status === 'reviewed'))
    if (task) return { task, record: progress.find(r => r.taskId === task.id) || null, reason: 'gap' }
  }
  return null
}

export const taskWorkHours = skillIds => [...new Set(skillIds.flatMap(id => taskCatalog.filter(task => task.skillIds.includes(id)).map(task => task.id)))].reduce((sum, id) => sum + taskById(id).hours, 0)
