// Task 24 · plain helpers for the course cards (unit-tested): the result groups in order, whether a course
// is an illustrative example, and the capabilities a course would close for this record.
import { skills as skillCatalog } from '../data.js'

export const COURSE_GROUPS = Object.freeze(['yes', 'conditional', 'no'])
export const isIllustrative = item => /Illustrative pilot/.test(item?.provider || '')
const skillLabel = (id, lang) => skillCatalog[id]?.labels?.[lang] || Object.values(skillCatalog).find(s => s.id === id)?.labels?.[lang] || id

// Fits → fits with conditions → not yet, each in the engine's order.
export const groupCourses = recs => Object.fromEntries(COURSE_GROUPS.map(g => [g, recs.filter(r => r.status === g)]))

// What the course would close: the capabilities it teaches that the record does not show yet. Empty when
// it teaches nothing new (the card then shows the gap type: repetition, a formal gate, …).
export function courseCloses(item, skills = [], lang = 'en') {
  const have = new Set(skills.map(s => s.id))
  return (item.teaches || []).filter(id => !have.has(id)).map(id => skillLabel(id, lang))
}
