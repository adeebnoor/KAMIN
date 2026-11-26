// Task 56 · interests in the student's own words ("I like building apps for hospitals").
// Pure and fully local; loaded on demand (import('./interests/freeText.js')), never in the initial
// bundle. The text is understood with the approved improved engine and lexicon
// (kamin-project-suggest-improved-v2 since Task 77), the digital-interest topic terms and the interest vocabulary
// (src/interests/vocabulary.js: everyday goals such as apps, websites, games, health, in English,
// Arabic and Saudi dialect), and shown back as chips the student can remove; the original sentence is
// always kept.
//
// Never evidence: the result is a declared goal signal only. It never becomes a capability claim,
// never changes an evidence level, and nothing here writes to the person graph or the ontology
// (src/ontology/projector.js does not read freeInterests). No score is produced or shown.
import { suggestCapabilities, PROJECT_SUGGEST_IMPROVED_VERSION } from '../ai/projectSuggestImproved.js'
import { DIGITAL_TOPICS, matchDigitalTopics } from '../digitalInterests.js'
import { targetProfiles } from '../matching/targets.js'
import { INSIGHT_VERSION, emptyInsightState } from '../insight.js'
import { FREE_INTEREST_MAX, FREE_INTEREST_MAX_CHIPS, FREE_INTEREST_METHOD, normalizeFreeInterests } from './freeInterestState.js'
import { INTEREST_VOCABULARY_VERSION, matchInterestVocabulary } from './vocabulary.js'

export { FREE_INTEREST_MAX, FREE_INTEREST_MAX_CHIPS, FREE_INTEREST_METHOD, normalizeFreeInterests }

export const FREE_INTEREST_MESSAGES = {
  'too-short': { ar: 'اكتب اهتمامك في 3 أحرف على الأقل.', en: 'Write your interest in at least 3 characters.' },
  'too-long': { ar: 'اختصر اهتمامك إلى 500 حرف أو أقل.', en: 'Please shorten your interest to 500 characters or fewer.' },
  limit: { ar: 'يمكنك حفظ 5 اهتمامات بكلماتك كحد أقصى؛ احذف واحدًا لتضيف غيره.', en: 'You can keep up to 5 interests in your own words; delete one to add another.' },
  consent: { ar: 'فعّل موافقة الاهتمامات أولًا.', en: 'Turn on the interests permission first.' },
}

function fail(code, lang) {
  const error = new Error(FREE_INTEREST_MESSAGES[code][lang === 'ar' ? 'ar' : 'en'])
  error.code = code
  return error
}

// Control characters go (line breaks and tabs stay); everything else is kept exactly as typed.
export const cleanInterestText = value => typeof value === 'string' ? value.replace(/[\0-\x08\x0b-\x1f\x7f-\x9f]/g, '') : ''

/**
 * The text as it will be stored (control characters removed), or an error with a message in `lang`:
 * 'too-short' under 3 characters once the spaces at both ends are ignored, 'too-long' over 500.
 */
export function checkInterestText(text, lang = 'en') {
  const clean = cleanInterestText(text)
  if (!/\S[^]+\S/u.test(clean)) throw fail('too-short', lang)
  if ([...clean].length > 500) throw fail('too-long', lang)
  return clean
}

const TARGET_ORDER = targetProfiles.map(t => t.id)
const DIGITAL_TARGETS = new Map(DIGITAL_TOPICS.map(topic => [topic.id, topic.targets]))

/**
 * What KAMIN understood from a sentence. Deterministic; at most 4 capabilities, 4 pathways and 4 topics.
 * Capabilities come from the improved local engine only. Pathways come from (1) pathways whose required
 * skills include at least two of the understood capabilities (the more specific signal, listed
 * first), then (2) the target pathways of matched digital-interest topics, then (3) the pathways of
 * matched interest-vocabulary topics. Topics come from the interest vocabulary (goals only).
 * @returns {{capabilities:string[], pathways:string[], topics:string[], method:string, engine:string, vocabulary:string}}
 */
export function understandInterest(text, lang = 'en') {
  const clean = checkInterestText(text, lang)
  const capabilities = suggestCapabilities(clean, { max: FREE_INTEREST_MAX_CHIPS, keepWishes: true }).suggestions.map(s => s.skillId)
  const bySkills = targetProfiles
    .filter(t => (t.requiredSkills || []).filter(id => capabilities.includes(id)).length >= 2)
    .map(t => t.id)
  const byTopic = matchDigitalTopics(clean).flatMap(m => DIGITAL_TARGETS.get(m.topicId) || [])
  const vocabulary = matchInterestVocabulary(clean)
  const pathways = [...new Set([...bySkills, ...byTopic, ...vocabulary.pathways])].filter(id => TARGET_ORDER.includes(id)).slice(0, FREE_INTEREST_MAX_CHIPS)
  const topics = vocabulary.topics.slice(0, FREE_INTEREST_MAX_CHIPS)
  return { capabilities, pathways, topics, method: FREE_INTEREST_METHOD, engine: PROJECT_SUGGEST_IMPROVED_VERSION, vocabulary: INTEREST_VOCABULARY_VERSION }
}

const newId = () => `free-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`

const withFree = (state, freeInterests) => ({
  ...state,
  insight: { ...emptyInsightState(), ...(state.insight || {}), version: INSIGHT_VERSION, freeInterests, updatedAt: new Date().toISOString() },
})

/**
 * Save a new interest in the student's own words. Covered by the existing interests consent
 * (state.consents.insight); never asks again. The text is stored exactly as typed (control
 * characters removed) next to the chips KAMIN understood from it.
 */
export function addFreeInterest(state, text, { lang = 'en', id = newId(), now = new Date() } = {}) {
  if (!state?.consents?.insight) throw fail('consent', lang)
  const current = normalizeFreeInterests(state.insight?.freeInterests)
  if (current.length >= FREE_INTEREST_MAX) throw fail('limit', lang)
  const result = understandInterest(text, lang)
  const entry = {
    id,
    text: cleanInterestText(text),
    understood: [
      ...result.capabilities.map(chipId => ({ kind: 'capability', id: chipId, removed: false })),
      ...result.pathways.map(chipId => ({ kind: 'pathway', id: chipId, removed: false })),
      ...result.topics.map(chipId => ({ kind: 'topic', id: chipId, removed: false })),
    ],
    method: FREE_INTEREST_METHOD,
    createdAt: now.toISOString(),
  }
  return withFree(state, normalizeFreeInterests([...current, entry]))
}

/** Remove (or bring back) one chip. The sentence and the other chips stay. */
export function setChipRemoved(state, entryId, kind, chipId, removed = true) {
  const current = normalizeFreeInterests(state?.insight?.freeInterests)
  if (!current.some(e => e.id === entryId && e.understood.some(c => c.kind === kind && c.id === chipId))) throw new Error('ITEM_NOT_FOUND')
  return withFree(state, current.map(e => e.id !== entryId ? e : {
    ...e,
    understood: e.understood.map(c => c.kind === kind && c.id === chipId ? { ...c, removed: !!removed } : c),
  }))
}

/**
 * The pathways the student kept, as a declared goal signal for suggestions (Task 57 / 65). Never a
 * capability and never evidence; empty without the interests consent.
 */
export function freeInterestGoalPathways(state) {
  if (!state?.consents?.insight) return []
  return [...new Set(normalizeFreeInterests(state.insight?.freeInterests)
    .flatMap(e => e.understood.filter(c => c.kind === 'pathway' && !c.removed).map(c => c.id)))]
}
