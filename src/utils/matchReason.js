// Task 23 · My next step → Matches as a short list. Plain functions (unit-tested): which group a pathway
// goes in, the order inside a group, and its one-line reason. Built only from what the match already
// carries (judgment, missingSkills, limitingMechanisms, semanticPaths, requiredSkills); never a score.
import { copy, fill } from '../i18n.js'
import { skills as skillCatalog } from '../data.js'

export const MATCH_GROUPS = Object.freeze(['fits', 'conditional', 'later'])
// "Not for now" holds pathways that are not yet reachable and those outside the chosen goal
// (judgment "exploratory": nothing is missing, but the pathway does not serve the goal now).
export const groupOf = item => item.judgment === 'fits' ? 'fits' : item.judgment === 'conditional' ? 'conditional' : 'later'

const localized = (value, lang) => typeof value === 'string' ? value : value?.[lang] || value?.ar || value?.en || ''
const skillLabel = (id, lang) => skillCatalog[id]?.labels?.[lang] || Object.values(skillCatalog).find(s => s.id === id)?.labels?.[lang] || id

// Groups in order; inside a group jobs before training, then the catalog order the engine returns.
export function groupMatches(matches = []) {
  const byGroup = Object.fromEntries(MATCH_GROUPS.map(g => [g, []]))
  for (const item of matches) byGroup[groupOf(item)].push(item)
  for (const g of MATCH_GROUPS) byGroup[g] = [...byGroup[g].filter(m => m.type === 'job'), ...byGroup[g].filter(m => m.type !== 'job')]
  return byGroup
}

// One specific line per pathway, in this order of preference:
// 1. what stands in the way: the first missing required capability, a hard gate, or "outside your goal";
// 2. the evidence that supports it (a course linked to a required capability);
// 3. the goal or preference link used before Task 23, or "no academic prerequisite", or the catalog line.
export function matchReason(item, lang) {
  const S = copy[lang].screens.matches
  const missing = item.missingSkills || []
  if (missing.length) return { kind: 'missing', text: fill(S.reasonMissing, { skill: skillLabel(missing[0], lang) }) }
  if ((item.hardGates || []).length && item.limitingMechanisms?.[0]) return { kind: 'gate', text: item.limitingMechanisms[0] }
  if (item.judgment === 'exploratory') return { kind: 'outside-goal', text: S.reasonOutside }
  const evidence = (item.semanticPaths || []).find(p => p.kind === 'capability-match' && p.courseCode)
  if (evidence) return { kind: 'evidence', text: fill(S.reasonEvidence, { course: evidence.courseCode, capability: localized(evidence.capabilityLabel, lang) || skillLabel(evidence.capabilityKey, lang) }) }
  const paths = item.semanticPaths || []
  if (paths.some(p => p.kind === 'goal-alignment' && p.status === 'supported')) return { kind: 'goal', text: S.reasonGoal }
  if (paths.some(p => p.kind === 'preference-alignment' && p.status === 'supported')) return { kind: 'preference', text: S.reasonPreference }
  if (!(item.requiredSkills || []).length) return { kind: 'no-prerequisite', text: S.reasonNoPrerequisite }
  return { kind: 'catalog', text: S.reasonCatalog }
}
