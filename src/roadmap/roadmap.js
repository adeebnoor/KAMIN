// Task 79 · a roadmap per pathway (src/catalog/roadmaps.json): ordered stages, each with what to learn and why, the
// KAMIN capabilities it builds and 2-4 free resources; then the certifications that matter for the pathway.
//
// Pure functions over the roadmap data and the profile state. The data is loaded on demand (src/ui2/useRoadmaps.js),
// never at startup. A tick is the student's own record of what they did (state.roadmapDone, src/plan/plan.js): it is
// saved with the plan, can be unticked, goes with the interests consent and with "Delete everything", and is NEVER
// evidence. Nothing here reads courses, capabilities, levels or the person graph, and nothing that computes them reads
// state.roadmapDone.
import { normalizePlan, ROADMAP_DONE_MAX } from '../plan/plan.js'

export const ROADMAP_VERSION = 'kamin-roadmaps-v1'
export const RECOMMENDATIONS = Object.freeze(['take', 'optional', 'later'])

/** The key of one ticked item: '<pathway>:<stage>:<resource>'. */
export const itemKey = (pathwayId, stageId, resourceId) => `${pathwayId}:${stageId}:${resourceId}`

/**
 * A pathway's roadmap with its resources and certifications filled in, or null when the pathway has none.
 * { pathwayId, stages: [{ id, order, title, learn, why, capabilities, items: [{ key, resource }] }],
 *   certifications: [{ id, name, issuer, url, language, recommendation, when, why }], status, note, source }
 */
export function roadmapFor(data, pathwayId) {
  const entry = data?.roadmaps?.find(r => r.pathwayId === pathwayId)
  if (!entry) return null
  const resources = new Map((data.resources || []).map(r => [r.id, r]))
  const certifications = new Map((data.certifications || []).map(c => [c.id, c]))
  return {
    pathwayId,
    status: entry.status,
    note: entry.note,
    source: entry.source,
    stages: [...entry.stages].sort((a, b) => a.order - b.order).map(stage => ({
      ...stage,
      items: stage.resources.filter(id => resources.has(id)).map(id => ({ key: itemKey(pathwayId, stage.id, id), resource: resources.get(id) })),
    })),
    certifications: (entry.certifications || []).filter(c => certifications.has(c.id)).map(c => ({ ...certifications.get(c.id), ...c })),
  }
}

export const isTicked = (state, key) => normalizePlan(state).roadmapDone.includes(key)

/** Tick (done = true) or untick an item. Ticking an item already ticked, or unticking one that is not: unchanged. */
export function tickRoadmapItem(state, key, done = true) {
  const s = normalizePlan(state)
  const ticked = s.roadmapDone.includes(key)
  if (done === ticked) return s
  const roadmapDone = done ? [...s.roadmapDone, key].slice(-ROADMAP_DONE_MAX) : s.roadmapDone.filter(k => k !== key)
  return normalizePlan({ ...s, roadmapDone })
}

/** How many items of a roadmap (and of each stage) are ticked. A count, never a score. */
export function roadmapProgress(roadmap, state) {
  const done = new Set(normalizePlan(state).roadmapDone)
  const stages = Object.fromEntries((roadmap?.stages || []).map(stage => [stage.id, { done: stage.items.filter(i => done.has(i.key)).length, total: stage.items.length }]))
  const all = Object.values(stages)
  return { done: all.reduce((n, s) => n + s.done, 0), total: all.reduce((n, s) => n + s.total, 0), stages }
}
