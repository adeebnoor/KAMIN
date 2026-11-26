// Task 43 · MiniLM only where the rule engine says nothing ("hybrid", not the default: behind ?suggest=hybrid since Task 80b).
// The improved engine (projectSuggestImproved.js) runs first. Only when it abstains, the local MiniLM model
// compares each sentence of the description with each capability's label and short description (the
// harness's `embedding` method, nazeh-embed-sentence-v1) and keeps AT MOST ONE capability whose best sentence
// reaches a STRICTER threshold than the embedding method's 0.52, tuned on dev-set.json only
// (eval/project-suggest/config.json → hybrid). The quoted snippet is the student's own sentence, verbatim.
// This file holds no model: the caller passes an async `embed(text) → number[384]` (the harness: Node, the
// browser: src/semantic/recall.worker.js, after the student pressed "Look deeper"). No network here.
// Task 80 (v2): the model also compares each sentence with three Saudi-dialect and two mixed Arabic-English example
// sentences per capability (src/ai/lexicon/capability-examples.json), reads the sentence through the engine's dialect
// layer first, skips a sentence that only states a wish, and uses one threshold per variety of the description
// (dialect, MSA, English, mixed: detectVariety), each tuned on the development sets only. v1 stays reproducible.
import { skills } from '../data.js'
import { detectVariety, dialectRewrite, isWish, sentences } from './projectSuggestImproved.js'
import DESCRIPTIONS from '../../eval/project-suggest/skill-descriptions.json' with { type: 'json' }
import EXAMPLES from './lexicon/capability-examples.json' with { type: 'json' }

export const HYBRID_FALLBACK_V1 = 'kamin-project-suggest-hybrid-v1'
export const HYBRID_FALLBACK_V2 = 'kamin-project-suggest-hybrid-v2'
// Task 80 rule 7: the version "Look deeper" uses (log/task-80.md); since Task 80b only behind ?suggest=hybrid.
export const FALLBACK_DEFAULT = 'v2'
export const HYBRID_FALLBACK_VERSION = FALLBACK_DEFAULT === 'v2' ? HYBRID_FALLBACK_V2 : HYBRID_FALLBACK_V1
// v1: tuned on eval/project-suggest/dev-set.json only (Task 43). v2: one per variety, tuned on dev-set.json,
// dev-set-workflow.json and dev-set-dialect.json only (eval.mjs tune --method hybrid). tests/projectSuggestImproved.test.js
// checks both equal config.json, so the app and the measured method cannot drift apart.
export const HYBRID_THRESHOLD = 0.53
export const HYBRID_THRESHOLDS = Object.freeze({ dialect: 0.53, msa: 0.58, en: 0.53, mixed: 0.53 })
export const VARIETIES = Object.freeze(['dialect', 'msa', 'en', 'mixed'])
export const HYBRID_MAX = 1
// The embedding method's threshold; the fallback's must be stricter (higher).
export const EMBEDDING_THRESHOLD = 0.52

// The same orthographic normalisation the embedding method embeds (eval/project-suggest/methods.mjs).
export const normaliseForEmbedding = text => String(text || '').replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim()

// One text per capability and language: label + short description (as the embedding method); v2 adds the
// capability's dialect and mixed example sentences.
export const capabilityPrototypes = ({ version = 'v1' } = {}) => Object.keys(skills).flatMap(id => [
  ...['ar', 'en'].map(lang => ({ id, lang, text: [skills[id].labels[lang], DESCRIPTIONS[id]?.[lang]].filter(Boolean).join('. ') })),
  ...(version === 'v2' ? ['dialect', 'mixed'].flatMap(lang => (EXAMPLES.examples[id]?.[lang] || []).map(text => ({ id, lang, text }))) : []),
])

const cosine = (a, b) => { let dot = 0; for (let i = 0; i < a.length; i++) dot += a[i] * b[i]; return dot }

// Best (score, original sentence) per capability. `vectors` are the prototypes' embeddings, same order.
export function bestPerCapability(sentenceVectors, prototypes, vectors) {
  const best = new Map()
  for (const { sentence, vector } of sentenceVectors) prototypes.forEach((p, i) => {
    const score = cosine(vector, vectors[i])
    if (!best.has(p.id) || score > best.get(p.id).score) best.set(p.id, { score, sentence })
  })
  return best
}

// At most HYBRID_MAX capabilities at or above the threshold, best first (ties: capability id).
export function pickFallback(best, threshold = HYBRID_THRESHOLD, max = HYBRID_MAX) {
  if (!(threshold > EMBEDDING_THRESHOLD)) throw new Error('HYBRID_THRESHOLD_NOT_STRICTER')
  return [...best].filter(([, r]) => r.score >= threshold).sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0])).slice(0, max)
    .map(([skillId, r]) => ({ skillId, snippet: r.sentence, score: r.score }))
}

// v2: the threshold for this description's variety.
export const thresholdFor = (description, thresholds = HYBRID_THRESHOLDS) => thresholds[detectVariety(description)]

// The fallback itself. `embed` is memoised by the caller or not at all; prototypes are embedded once.
export function createFallback(embed, { version = FALLBACK_DEFAULT } = {}) {
  const prototypes = capabilityPrototypes({ version })
  let vectors = null
  // v2 reads the sentence through the dialect layer; the snippet stays the student's original sentence.
  const input = sentence => normaliseForEmbedding(version === 'v2' ? dialectRewrite(sentence) : sentence)
  async function scores(description) {
    if (!vectors) { vectors = []; for (const p of prototypes) vectors.push(await embed(p.text)) }
    const sentenceVectors = []
    for (const sentence of sentences(description)) {
      if (version === 'v2' && isWish(sentence)) continue
      sentenceVectors.push({ sentence, vector: await embed(input(sentence)) })
    }
    return bestPerCapability(sentenceVectors, prototypes, vectors)
  }
  return {
    version: version === 'v2' ? HYBRID_FALLBACK_V2 : HYBRID_FALLBACK_V1,
    scores,
    async suggest(description, { threshold, thresholds = HYBRID_THRESHOLDS } = {}) {
      const t = threshold ?? (version === 'v2' ? thresholdFor(description, thresholds) : HYBRID_THRESHOLD)
      const suggestions = pickFallback(await scores(description), t)
        .map(({ skillId, snippet, score }) => ({ skillId, snippet, score, method: 'minilm-fallback', confidence: 'by-meaning' }))
      return { version: version === 'v2' ? HYBRID_FALLBACK_V2 : HYBRID_FALLBACK_V1, suggestions, abstained: suggestions.length === 0 }
    },
  }
}
