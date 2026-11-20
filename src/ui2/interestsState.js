// Task 64 · step 3's changes to the profile, as pure functions applied with actions.setState (the shared hook,
// src/state/useKaminProfile.js, is not changed). They load with step 3's lazy chunk only.
// The interests consent and the chosen chips keep today's stored shape: consents.insight, and
// insight.declaredPreferences.careerInterest / .workValue with the same option ids as the old screen
// (src/insight.js; one choice per question). Interests in the student's own words keep Task 56's shape
// (src/interests/freeInterestState.js); understanding a sentence needs the local engine
// (src/interests/freeText.js), which step 3 loads only when the student presses Add.
// Nothing here touches courses, projects, capabilities or evidence: an interest is a goal signal, never evidence.
import { INSIGHT_VERSION, setDeclaredPreference } from '../insight.js'
import { FREE_INTEREST_METHOD, normalizeFreeInterests } from '../interests/freeInterestState.js'
// Task 66: the consent and the two chip questions live in interestsConsent.js (Profile asks for the same consent).
import { CHIP_QUESTIONS, grantInterests, insightOf } from './interestsConsent.js'

export { CHIP_QUESTIONS, grantInterests }

const stamp = (state, insight) => ({ ...state, insight: { ...insight, version: INSIGHT_VERSION, updatedAt: new Date().toISOString() } })
const withFree = (state, freeInterests) => stamp(state, { ...insightOf(state), freeInterests: normalizeFreeInterests(freeInterests) })

// Tap a chip: choose it (it replaces the other choice of the same question), or tap the chosen one to remove it.
// Nothing is saved without the interests consent.
export function tapPreference(state, schemeId, optionId) {
  if (!state?.consents?.insight) return state
  const insight = insightOf(state)
  if (insight.declaredPreferences?.[schemeId] === optionId) {
    const declaredPreferences = { ...insight.declaredPreferences }
    delete declaredPreferences[schemeId]
    return stamp(state, { ...insight, declaredPreferences })
  }
  return { ...state, insight: setDeclaredPreference(insight, schemeId, optionId) }
}

// Turn one understood chip off (it stays listed, so it can be turned back on) or on again. The sentence and the
// other chips stay. The same change as Task 56's setChipRemoved, without loading the engine.
export function toggleFreeChip(state, entryId, kind, chipId) {
  const current = normalizeFreeInterests(state?.insight?.freeInterests)
  if (!current.some(e => e.id === entryId && e.understood.some(c => c.kind === kind && c.id === chipId))) throw new Error('ITEM_NOT_FOUND')
  return withFree(state, current.map(e => e.id !== entryId ? e : {
    ...e,
    understood: e.understood.map(c => c.kind === kind && c.id === chipId ? { ...c, removed: !c.removed } : c),
  }))
}

// A new sentence, already checked and understood by Task 56's addFreeInterest, goes at the end.
export function appendFreeInterest(state, entry) {
  const current = normalizeFreeInterests(state?.insight?.freeInterests)
  if (!state?.consents?.insight || current.some(e => e.id === entry.id)) return state
  return withFree(state, [...current, entry])
}

// An edited sentence: the new text and what the engine understood from it (`result`, from understandInterest), in
// the same place, with the same id and date. A chip the student had turned off stays off if it is understood again.
export function replaceFreeInterest(state, entryId, text, result) {
  const current = normalizeFreeInterests(state?.insight?.freeInterests)
  const old = current.find(e => e.id === entryId)
  if (!old) throw new Error('ITEM_NOT_FOUND')
  const off = new Set(old.understood.filter(c => c.removed).map(c => `${c.kind}:${c.id}`))
  const understood = [
    ...result.capabilities.map(id => ({ kind: 'capability', id })),
    ...result.pathways.map(id => ({ kind: 'pathway', id })),
    ...result.topics.map(id => ({ kind: 'topic', id })),
  ].map(chip => ({ ...chip, removed: off.has(`${chip.kind}:${chip.id}`) }))
  return withFree(state, current.map(e => (e.id === entryId ? { ...e, text, understood, method: FREE_INTEREST_METHOD } : e)))
}

// Undo a deletion: the sentence comes back at its place (never twice), with its chips as they were.
export function restoreFreeInterest(state, entry, index) {
  const current = normalizeFreeInterests(state?.insight?.freeInterests)
  if (!state?.consents?.insight || current.some(e => e.id === entry.id)) return state
  const at = Math.max(0, Math.min(index, current.length))
  return withFree(state, [...current.slice(0, at), entry, ...current.slice(at)])
}

// Whether the student has chosen or written anything on step 3.
export function hasInterests(state) {
  const prefs = state?.insight?.declaredPreferences || {}
  return CHIP_QUESTIONS.some(id => prefs[id]) || normalizeFreeInterests(state?.insight?.freeInterests).length > 0
}
