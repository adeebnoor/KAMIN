// Methods under evaluation. Each takes a description and returns
// { version, suggestions:[{skillId, support}] } where `support` is the text that justifies the
// suggestion. They call the exact modules and pinned model files the browser uses.
// No network: the embedding model loads only from the local, hash-checked .model-cache folder.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { suggestCapabilities, PROJECT_SUGGEST_VERSION } from '../../src/ai/projectSuggest.js'
import { suggestCapabilities as suggestImproved, PROJECT_SUGGEST_IMPROVED_VERSION } from '../../src/ai/projectSuggestImproved.js'
import { EMBEDDING_MODEL } from '../../src/semantic/config.js'
import { HYBRID_FALLBACK_V1, HYBRID_FALLBACK_V2, createFallback } from '../../src/ai/hybridFallback.js'
import { skills } from '../../src/data.js'
import { sha256 } from './lib.mjs'

// Current engine (baseline): deterministic lexicon, quotes the sentence it matched.
export const lexicon = {
  name: 'lexicon',
  version: PROJECT_SUGGEST_VERSION,
  async predict(text) {
    const result = suggestCapabilities(text)
    return { suggestions: result.suggestions.map(s => ({ skillId: s.skillId, support: s.snippet })) }
  },
}

// Sentences on the same normalised text the lexicon uses (diacritics, tatweel, alef forms,
// final ya); the quoted sentence is checked against the description with the same normalisation.
const normalise = text => String(text || '').replace(/[\u064B-\u0652\u0640]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim()
export const splitSentences = text => normalise(text).split(/(?<=[.!?؟؛])\s+|\n+/).map(s => s.trim()).filter(s => s.length >= 3)

let extractorPromise = null
async function extractor() {
  if (!extractorPromise) extractorPromise = (async () => {
    const root = path.resolve('.model-cache', EMBEDDING_MODEL.revision)
    const modelFile = path.join(root, EMBEDDING_MODEL.filename)
    if (!existsSync(modelFile)) throw new Error(`MODEL_NOT_CACHED: run "npm run build" once (scripts/prepare-semantic.mjs fills ${path.relative('.', root)})`)
    const bytes = readFileSync(modelFile)
    if (bytes.length !== EMBEDDING_MODEL.bytes || sha256(bytes) !== EMBEDDING_MODEL.sha256) throw new Error('MODEL_INTEGRITY_FAILED: the cached model does not match the pinned sha256')
    const { pipeline, env } = await import('@huggingface/transformers')
    env.allowRemoteModels = false; env.allowLocalModels = true; env.useFSCache = false
    return pipeline('feature-extraction', root + '/', { dtype: 'q8', device: 'cpu', local_files_only: true })
  })()
  return extractorPromise
}
const memo = new Map()
async function embed(text) {
  if (memo.has(text)) return memo.get(text)
  const vector = Array.from((await (await extractor())(text, { pooling: 'mean', normalize: true })).data)
  memo.set(text, vector)
  return vector
}
const cosine = (a, b) => { let dot = 0; for (let i = 0; i < a.length; i++) dot += a[i] * b[i]; return dot }
const DESCRIPTIONS = JSON.parse(readFileSync(new URL('./skill-descriptions.json', import.meta.url), 'utf8'))
let prototypes = null
async function capabilityVectors() {
  if (prototypes) return prototypes
  prototypes = []
  for (const id of Object.keys(skills)) for (const lang of ['ar', 'en']) prototypes.push({ id, vector: await embed([skills[id].labels[lang], DESCRIPTIONS[id]?.[lang]].filter(Boolean).join('. ')) })
  return prototypes
}
// Best sentence per capability: Map(skillId → {score, sentence}).
export async function sentenceScores(text) {
  const vectors = await capabilityVectors()
  const best = new Map()
  for (const sentence of splitSentences(text)) {
    const v = await embed(sentence)
    for (const p of vectors) { const score = cosine(v, p.vector); if (!best.has(p.id) || score > best.get(p.id).score) best.set(p.id, { score, sentence }) }
  }
  return best
}
export const pickAbove = (scores, threshold, max = 4) => [...scores].filter(([, r]) => r.score >= threshold).sort((a, b) => b[1].score - a[1].score).slice(0, max)
  .map(([skillId, r]) => ({ skillId, support: r.sentence, score: Number(r.score.toFixed(4)) }))

// Local MiniLM (nazeh-embed-sentence-v1, the method measured on 25 Oct): each sentence is compared
// with every capability's label and short description in Arabic and English; a capability is
// suggested when its best sentence reaches the threshold, quoting that sentence. The threshold is
// tuned on the development set only (eval.mjs tune).
export function embedding({ threshold }) {
  if (typeof threshold !== 'number') throw new Error('EMBEDDING_THRESHOLD_REQUIRED: run "tune" on the development set first')
  return {
    name: 'embedding',
    version: `nazeh-embed-sentence-v1+${EMBEDDING_MODEL.revision.slice(0, 7)}`,
    threshold,
    scores: sentenceScores,
    async predict(text) { return { suggestions: pickAbove(await sentenceScores(text), threshold) } },
  }
}

// Improved method (Task 08): stronger normalisation + strong/weak synonym lexicon, quoting the
// student's original sentence. Lexicon built on dev-set.json only.
export const improved = {
  name: 'improved',
  version: PROJECT_SUGGEST_IMPROVED_VERSION,
  async predict(text) {
    const result = suggestImproved(text)
    return { suggestions: result.suggestions.map(s => ({ skillId: s.skillId, support: s.snippet })) }
  },
}

// Task 43 · hybrid: `improved` first; only if it abstains, the MiniLM fallback of src/ai/hybridFallback.js (the
// module the browser runs) with a stricter threshold tuned on dev-set.json only, at most 1 suggestion, quoting
// the student's original sentence. `fallback: true` marks the suggestions the fallback added.
// Task 80: fallback v2 (dialect and mixed examples, one threshold per variety: `thresholds`); v1 with `threshold`.
const fallbackModels = {}
export const fallback = (version = 'v2') => (fallbackModels[version] ||= createFallback(embed, { version }))
export function hybrid({ threshold, thresholds }) {
  const version = thresholds ? 'v2' : 'v1'
  if (version === 'v1' ? typeof threshold !== 'number' : Object.values(thresholds).some(t => typeof t !== 'number')) throw new Error('HYBRID_THRESHOLD_REQUIRED: run "tune --method hybrid" on the development set first')
  return {
    name: 'hybrid',
    version: `${version === 'v2' ? HYBRID_FALLBACK_V2 : HYBRID_FALLBACK_V1}+${EMBEDDING_MODEL.revision.slice(0, 7)}`,
    threshold: version === 'v1' ? threshold : undefined,
    thresholds,
    async predict(text) {
      const first = await improved.predict(text)
      if (first.suggestions.length) return first
      const result = await fallback(version).suggest(text, version === 'v1' ? { threshold } : { thresholds })
      return { suggestions: result.suggestions.map(s => ({ skillId: s.skillId, support: s.snippet, score: Number(s.score.toFixed(4)), fallback: true })) }
    },
  }
}
