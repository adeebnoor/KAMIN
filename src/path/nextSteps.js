// Task 57 · the next-steps feed: short cards of courses and certificates, each saying which of the
// student's capabilities it supports, which pathway or profession it improves, and which gap of theirs
// it closes. Pure and local; no screen uses it yet (the new feed is Task 65).
//
// Written rules (no score is produced or shown):
// - Goals are the targets the student chose (goalIds) plus the pathway chips they kept on their
//   interests in their own words (Task 56). Free interests are a goal signal only, never evidence:
//   capability chips are ignored here. Without a goal the feed is empty, with the reason
//   "Choose a goal first". The caller passes freeInterests only when the interests consent is on.
// - Per goal, the gap comes from computeGap and the items from suggestPath (src/path/suggest.js),
//   so an item appears only if it closes a "limited" or "missing" capability of a chosen goal, and a
//   university course already on the record is never suggested (the existing rule).
// - Items already in the plan or marked "not for me" are left out.
// - An item that closes gaps for several goals is one card; its "why" names each goal's gap.
// - Order: the same written rules as suggest.js (byWrittenRules), shared, not copied.
import { computeGap } from './gap.js'
import { suggestPath, uncoveredGaps, byWrittenRules, closesMissing, supportsOf, LEARNING_CATALOG } from './suggest.js'
import { targetProfiles } from '../matching/targets.js'
import { normalizeFreeInterests } from '../interests/freeInterestState.js'

export const NEXT_STEPS_VERSION = 'kamin-next-steps-v1'
const OFFICIAL_SOURCES = ['kau-catalog', 'department-offer']
export const NO_GOAL_REASON = Object.freeze({ ar: 'اختر هدفًا أولًا.', en: 'Choose a goal first.' })

const KNOWN_TARGETS = new Set(targetProfiles.map(t => t.id))
const itemIds = list => new Set((Array.isArray(list) ? list : []).map(x => (typeof x === 'string' ? x : x?.itemId)).filter(Boolean))

/** The goals the feed is built for: chosen goals first, then kept free-interest pathway chips; known targets only. */
export function feedGoals(goalIds = [], freeInterests = []) {
  const fromFree = normalizeFreeInterests(freeInterests)
    .flatMap(entry => entry.understood.filter(chip => chip.kind === 'pathway' && !chip.removed).map(chip => chip.id))
  return [...new Set([...(Array.isArray(goalIds) ? goalIds : []), ...fromFree])].filter(id => KNOWN_TARGETS.has(id))
}

/**
 * @returns {{ version: string, goals: string[], cards: object[], uncovered: {goalId:string, capabilities:string[]}[], reason: {ar:string,en:string}|null }}
 * Each card: { itemId, kind, supports, improves, why: {ar,en}, gapCapabilities, forGoals,
 * prerequisitesMet, missingPrerequisites, status, source, illustrative }.
 */
export function nextStepFeed({ skills = [], goalIds = [], freeInterests = [], plan = [], notForMe = [], takenCourses = [], catalog = LEARNING_CATALOG.items } = {}) {
  const goals = feedGoals(goalIds, freeInterests)
  if (!goals.length) return { version: NEXT_STEPS_VERSION, goals: [], cards: [], uncovered: [], reason: NO_GOAL_REASON }
  const hidden = new Set([...itemIds(plan), ...itemIds(notForMe)])
  const byItem = new Map()
  const uncovered = []
  for (const goalId of goals) {
    const gap = computeGap(skills, goalId)
    const suggestions = suggestPath(gap, catalog, { skills, takenCourses })
    const left = uncoveredGaps(gap, suggestions).map(r => r.capability)
    if (left.length) uncovered.push({ goalId, capabilities: left })
    for (const s of suggestions) {
      if (hidden.has(s.itemId)) continue
      const item = catalog.find(i => i.id === s.itemId)
      const card = byItem.get(s.itemId)
      if (!card) {
        byItem.set(s.itemId, {
          itemId: item.id,
          kind: item.kind,
          supports: [...supportsOf(item)],
          improves: [...(item.improves || [])],
          why: { ...s.reason },
          gapCapabilities: [...s.closes],
          forGoals: [goalId],
          prerequisitesMet: s.prerequisitesMet,
          missingPrerequisites: [...s.missingPrerequisites],
          status: item.status,
          source: item.source ? { ...item.source } : { type: 'invented', ref: null, note: '' },
          // Task 36: an "illustrative example" until two reviewers approve it, unless it comes from the
          // official catalogue or the department's own offer.
          illustrative: item.status !== 'reviewed' && !OFFICIAL_SOURCES.includes(item.source?.type),
          _closesMissing: closesMissing(gap, s.closes),
          _level: item.level,
        })
      } else {
        card.why = { ar: `${card.why.ar} ${s.reason.ar}`, en: `${card.why.en} ${s.reason.en}` }
        card.gapCapabilities = [...new Set([...card.gapCapabilities, ...s.closes])]
        card.forGoals.push(goalId)
        card._closesMissing = card._closesMissing || closesMissing(gap, s.closes)
      }
    }
  }
  const cards = [...byItem.values()]
    .sort((a, b) => byWrittenRules(
      { itemId: a.itemId, prerequisitesMet: a.prerequisitesMet, closesMissing: a._closesMissing, level: a._level, kind: a.kind },
      { itemId: b.itemId, prerequisitesMet: b.prerequisitesMet, closesMissing: b._closesMissing, level: b._level, kind: b.kind }))
    .map(({ _closesMissing, _level, ...card }) => card)
  return { version: NEXT_STEPS_VERSION, goals, cards, uncovered, reason: null }
}
