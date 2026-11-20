// Task 36 · the review rules of the learning-path list, in one place: used by the app (suggest.js,
// LearningPath.jsx), the tests, and the review kit (scripts/path-review). Pure, no imports.
//
// - status: 'illustrative' (not yet reviewed), 'reviewed' (two department reviewers approved it),
//   'retired' (kept in the list for history, never suggested).
// - reviewers: the two reviewers' roles (never names), only on a reviewed item; reviewedAt its date.
// - source.type: 'kau-catalog' (an official catalogue page), 'department-offer' (the department's own
//   offer), 'provider-page' (a real provider's own page), 'invented' (no real provider). An item with an
//   invented source is never shown: it must be retired.
// - The two reviewers decide 'approve', 'reject' or 'retire' independently. Only when both say the same
//   does it count: both approve → reviewed, both retire → retired. Any disagreement (or both reject)
//   keeps the item illustrative.
export const ITEM_STATUSES = Object.freeze(['illustrative', 'reviewed', 'retired'])
export const SOURCE_TYPES = Object.freeze(['kau-catalog', 'department-offer', 'provider-page', 'invented'])
export const REVIEW_DECISIONS = Object.freeze(['approve', 'reject', 'retire'])

const DATE = /^\d{4}-\d{2}-\d{2}$/
const role = value => typeof value === 'string' && value.trim().length > 1

export const isShown = item => !!item && item.status !== 'retired'

/** Every rule an item breaks, as short codes (empty when it is fine). */
export function reviewProblems(item) {
  const problems = []
  if (!ITEM_STATUSES.includes(item?.status)) problems.push('bad-status')
  if (!SOURCE_TYPES.includes(item?.source?.type)) problems.push('bad-source')
  if (item?.source?.type === 'invented' && item.status !== 'retired') problems.push('invented-source-shown')
  if (item?.status === 'reviewed') {
    const r = item.reviewers
    if (!Array.isArray(r) || r.length !== 2 || !r.every(role) || r[0].trim() === r[1].trim()) problems.push('needs-two-reviewers')
    if (!DATE.test(item.reviewedAt || '')) problems.push('needs-review-date')
  } else if (item?.reviewers != null || item?.reviewedAt != null) problems.push('reviewers-without-review')
  if (item?.status === 'retired' && !DATE.test(item.retiredAt || '')) problems.push('needs-retired-date')
  if (item?.status !== 'retired' && item?.retiredAt != null) problems.push('retired-date-without-retiring')
  return problems
}

/** What two independent decisions mean for an item. */
export function reviewOutcome(decisionA, decisionB) {
  const a = String(decisionA || '').trim().toLowerCase(), b = String(decisionB || '').trim().toLowerCase()
  if (!REVIEW_DECISIONS.includes(a) || !REVIEW_DECISIONS.includes(b) || a !== b) return 'illustrative'
  return a === 'approve' ? 'reviewed' : a === 'retire' ? 'retired' : 'illustrative'
}

/**
 * The "Planned feature" label stays until every capability a university course links to (in the
 * official course map) has at least one reviewed item that supports it.
 * @returns {{ complete: boolean, missing: string[] }} missing: capabilities without a reviewed item
 */
export function pathReviewStatus(items, courseCapabilities) {
  const reviewed = new Set((items || []).filter(i => i.status === 'reviewed').flatMap(i => i.supports || i.teaches || []))
  const missing = [...new Set(courseCapabilities || [])].filter(id => !reviewed.has(id))
  return { complete: missing.length === 0 && (courseCapabilities || []).length > 0, missing }
}
