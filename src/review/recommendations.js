import { TARGET_CATALOG_VERSION } from '../matching/targets.js'
import { inferSkills } from '../utils/engine.js'

export const REVIEW_VERSION = 'kamin-human-review-v1'
export const MAX_REVIEWS = 200
export const REVIEW_CHECKS = ['evidence', 'goal', 'limits']
export const REVIEW_ACTIONS = ['accepted', 'rejected', 'contested', 'unresolved', 'withdrawn']
export const REVIEW_REASONS = ['reviewed', 'wrong-evidence', 'wrong-mapping', 'missing-evidence', 'outdated-source', 'unclear-explanation', 'goal-mismatch', 'other']
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const identifiers = value => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string' && /^[a-z0-9-]{1,100}$/.test(x)))].sort().slice(0, 100) : []
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v)

// This is a review reference, never a capability claim or proof of identity.
export function describeRecommendation(item, kind, state) {
  const required = identifiers(kind === 'course' ? item.requires : item.requiredSkills)
  const supported = new Set(kind === 'course'
    ? (state.approved ? inferSkills(state.courses).map(s => s.id) : [])
    : (item.semanticPaths || []).filter(p => p.kind === 'capability-match').map(p => p.capabilityKey))
  return {
    key: `${kind}:${item.id}`, kind, targetId: item.id,
    title: { ar: item.title.ar, en: item.title.en },
    judgment: kind === 'course' ? item.status : item.judgment,
    ruleVersion: item.ruleVersion || 'kamin-course-fit-v1',
    catalogVersion: TARGET_CATALOG_VERSION,
    requirements: required.map(id => ({ id, supported: supported.has(id) })),
    source: item.source || item.formalSource || null,
  }
}

export function recommendationSeed(item, kind, state) {
  return stable({
    version: REVIEW_VERSION,
    recommendation: describeRecommendation(item, kind, state),
    target: {
      goals: item.goals, teaches: item.teaches, formalGate: item.formalGate,
      preferredInterests: item.preferredInterests, preferredValues: item.preferredValues,
      preferredWorkStructure: item.preferredWorkStructure, preferredCollaboration: item.preferredCollaboration,
      semanticMatchingVersion: item.semanticMatchingVersion, graphTrace: item.graphTrace,
    },
    // No timestamps, audit events, review decisions or UI language in this input.
    inputs: { courses: state.courses || [], approved: !!state.approved, goal: state.goal || null,
      analyze: !!state.consents?.analyze, insightConsent: !!state.consents?.insight,
      insight: state.insight || {} },
  })
}

export async function fingerprintRecommendation(seed) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed))
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('')
}

export function normalizeRecommendationReviews(value, { imported = false } = {}) {
  if (!Array.isArray(value)) return []
  const ids = new Set()
  return value.slice(0, MAX_REVIEWS).flatMap(record => {
    if (!record || record.version !== REVIEW_VERSION || !REVIEW_ACTIONS.includes(record.action)) return []
    const targetId = clean(record.targetId, 100)
    if (!/^[a-z0-9-]{1,100}$/.test(targetId) || !['pathway', 'course'].includes(record.kind)) return []
    if (!/^[a-f0-9]{64}$/.test(record.fingerprint || '')) return []
    const id = clean(record.id, 100)
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(id) || ids.has(id)) return []
    if (!Number.isFinite(Date.parse(record.createdAt))) return []
    const reviewer = { label: clean(record.reviewer?.label, 60), role: record.reviewer?.role }
    if (reviewer.label.length < 2 || !['student', 'advisor'].includes(reviewer.role)) return []
    if (!REVIEW_REASONS.includes(record.reason) || !['unsure', 'partly', 'confident'].includes(record.confidence)) return []
    const checks = Array.isArray(record.checks) ? REVIEW_CHECKS.filter(c => record.checks.includes(c)) : []
    if (['accepted', 'rejected'].includes(record.action) && checks.length !== REVIEW_CHECKS.length) return []
    const ms = record.timing?.elapsedMs
    const timing = Number.isFinite(ms) && ms >= 0 && ms <= 3600000 && record.timing?.consented === true
      ? { elapsedMs: Math.round(ms), consented: true, interrupted: !!record.timing.interrupted, start: 'explicit-local-timer-v1' } : null
    ids.add(id)
    return [{ version: REVIEW_VERSION, id, key: `${record.kind}:${targetId}`, targetId, kind: record.kind,
      title: { ar: clean(record.title?.ar, 160), en: clean(record.title?.en, 160) },
      fingerprint: record.fingerprint, ruleVersion: clean(record.ruleVersion, 100), catalogVersion: clean(record.catalogVersion, 100),
      judgment: clean(record.judgment, 40), action: record.action, reason: record.reason, note: clean(record.note, 600),
      checks, reviewer, confidence: record.confidence, timing, imported: imported || record.imported === true,
      createdAt: new Date(record.createdAt).toISOString(), previousId: clean(record.previousId, 100) || null,
    }]
  })
}

export function createRecommendationReview({ descriptor, fingerprint, draft, timing = null, previousId = null, now = new Date() }) {
  const candidate = {
    ...descriptor, version: REVIEW_VERSION, fingerprint,
    id: `review-${globalThis.crypto.randomUUID()}`, createdAt: now.toISOString(),
    action: draft.action, reason: draft.reason, note: draft.note, reviewer: draft.reviewer,
    confidence: draft.confidence, checks: draft.checks, timing, previousId,
  }
  const normalized = normalizeRecommendationReviews([candidate])[0]
  if (!normalized || normalized.action === 'withdrawn') throw new Error('INVALID_REVIEW')
  if (normalized.reason === 'reviewed' && ['rejected', 'contested', 'unresolved'].includes(normalized.action)) throw new Error('REVIEW_REASON_REQUIRED')
  if (normalized.reason === 'other' && normalized.note.length < 5) throw new Error('REVIEW_NOTE_REQUIRED')
  return normalized
}

export function appendRecommendationReview(records, record) {
  const prior = normalizeRecommendationReviews(records)
  if (prior.length >= MAX_REVIEWS) throw new Error('REVIEW_LIMIT_REACHED')
  if (prior.some(r => r.id === record.id)) return prior
  const valid = normalizeRecommendationReviews([record])[0]
  if (!valid) throw new Error('INVALID_REVIEW')
  return [valid, ...prior]
}

export function withdrawRecommendationReview(record) {
  return { ...record, id: `review-${globalThis.crypto.randomUUID()}`, previousId: record.id,
    createdAt: new Date().toISOString(), action: 'withdrawn', timing: null, note: '', imported: false }
}

export function recommendationReviewStatus(record, fingerprint) {
  if (!record) return 'unreviewed'
  if (record.action === 'withdrawn') return 'withdrawn'
  if (record.imported) return 'imported'
  if (!fingerprint || record.fingerprint !== fingerprint) return 'outdated'
  return record.action
}

// Deliberate allowlist: no reviewer, free text, grades, evidence, times or profile fingerprint.
export function buildRedTeamCandidate(record) {
  if (record.action !== 'contested') throw new Error('CONTEST_REQUIRED')
  return {
    format: 'kamin-red-team-candidate', version: 1, status: 'unverified-candidate',
    target: { kind: record.kind, id: record.targetId }, ruleVersion: record.ruleVersion,
    catalogVersion: record.catalogVersion, reason: record.reason,
    reproduction: 'Create a synthetic reproduction; no personal evidence is included.',
    acceptance: ['Independent reviewer confirms the defect against cited evidence.',
      'Add a failing regression test using synthetic inputs before fixing the defect.',
      'Preserve missing-evidence, consent and human-review boundaries.'],
    automaticSubmission: false, confirmedDefect: false,
  }
}
