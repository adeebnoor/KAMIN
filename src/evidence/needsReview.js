// Task 04: "needs review" flags for derived items (recommendation reviews, tasks, projects) that
// relied on a capability which lost its evidence. Items are flagged, never deleted. A flag stays
// while one of its capabilities still has no evidence and clears when the evidence comes back.
// Kept separate from recompute.js so the initial bundle can normalise saved state without it.
const KINDS = ['recommendation-review', 'task', 'project']

export function mergeNeedsReview(existing, staleDerived = [], skills = [], now = new Date().toISOString()) {
  const present = new Set((skills || []).map(s => s.id))
  const key = item => `${item.kind}:${item.id}`
  const map = new Map()
  for (const item of [...(Array.isArray(existing) ? existing : []), ...(staleDerived || []).map(item => ({ ...item, flaggedAt: now }))]) {
    if (!item || !KINDS.includes(item.kind) || typeof item.id !== 'string') continue
    const skillIds = (Array.isArray(item.skillIds) ? item.skillIds : []).filter(id => typeof id === 'string' && !present.has(id))
    if (!skillIds.length) { map.delete(key(item)); continue }
    map.set(key(item), { kind: item.kind, id: item.id.slice(0, 100), targetId: item.targetId || null, title: { ar: String(item.title?.ar || '').slice(0, 160), en: String(item.title?.en || '').slice(0, 160) }, skillIds, status: 'needs-review', flaggedAt: item.flaggedAt || now })
  }
  return [...map.values()].slice(0, 200)
}
