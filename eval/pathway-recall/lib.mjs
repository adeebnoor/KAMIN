// Task 42 · evaluation of the in-app "search pathways by meaning" feature (SemanticRecall).
// Pure helpers shared by eval.mjs and tests/pathwayRecallEval.test.js. Node-only, for measurement;
// nothing in the product imports this folder. No network access of any kind.
import { readFileSync } from 'node:fs'
import { targetProfiles } from '../../src/matching/targets.js'
import { skills } from '../../src/data.js'
import { LANGS, loadSet, orthographic } from '../project-suggest/lib.mjs'

export const HARNESS_VERSION = 'kamin-eval-pathway-recall-v1'
export const PATHWAY_IDS = targetProfiles.map(t => t.id)
export const PROVENANCE = 'Written by Claude, approved by the team and the supervisor (stated by Amjd, 2026-11-18)'

// The app's values in src/semantic/catalog.js (rankSemanticCandidates). Reported, never changed here.
export const APP_VALUES = Object.freeze({ minScore: 0.25, window: 0.12, limit: 3 })

// Set rules (brief + Amjd's 2026-11-18 rules for the test set).
export const SET_RULES = Object.freeze({ test: { minPerLanguage: 30, minDialect: 10, minNothing: 5 }, dev: { minPerLanguage: 10, minDialect: 1, minNothing: 2 } })

export function checkSet(set, role = set.meta?.role) {
  const problems = [], seen = new Set(), rules = SET_RULES[role] || SET_RULES.test
  for (const c of set.cases) {
    const where = c.id || '(no id)'
    if (!c.id) problems.push(`${where}: id is empty`)
    if (seen.has(c.id)) problems.push(`${where}: duplicate id`)
    seen.add(c.id)
    if (!LANGS.includes(c.lang)) problems.push(`${where}: lang must be ar or en`)
    if (typeof c.query !== 'string' || !c.query.trim() || c.query.length > 300) problems.push(`${where}: query must be 1–300 characters (the app's input limit)`)
    if (typeof c.dialect !== 'boolean') problems.push(`${where}: dialect must be true or false`)
    if (!Array.isArray(c.expected)) problems.push(`${where}: expected must be a list ([] = should find nothing)`)
    else for (const id of c.expected) if (!PATHWAY_IDS.includes(id)) problems.push(`${where}: unknown pathway "${id}"`)
  }
  for (const lang of LANGS) {
    const cases = set.cases.filter(c => c.lang === lang)
    if (cases.length < rules.minPerLanguage) problems.push(`${lang}: ${cases.length} queries, at least ${rules.minPerLanguage} needed`)
  }
  const dialect = set.cases.filter(c => c.lang === 'ar' && c.dialect).length
  if (dialect < rules.minDialect) problems.push(`Saudi dialect: ${dialect} queries, at least ${rules.minDialect} needed`)
  const nothing = set.cases.filter(c => Array.isArray(c.expected) && !c.expected.length).length
  if (nothing < rules.minNothing) problems.push(`should find nothing: ${nothing} queries, at least ${rules.minNothing} needed`)
  if (set.meta?.provenance !== PROVENANCE) problems.push('provenance statement missing or changed')
  return problems
}

export const readSet = file => loadSet(file)

// --- the app's ranking, with the two numbers as parameters (for tuning on the dev set) ---------
// Mirrors rankSemanticCandidates: cosine per index item, best score per pathway over both
// languages, keep score ≥ minScore and ≥ best − window, sort by score then id, top `limit`.
// tests/pathwayRecallEval.test.js checks it returns exactly what rankSemanticCandidates returns for
// the app's values.
export function pathwayScores(vector, index) {
  const scores = new Map()
  const norm = Math.hypot(...vector)
  for (const item of index) {
    let dot = 0
    for (let i = 0; i < vector.length; i++) dot += vector[i] * item.vector[i]
    const denominator = norm * Math.hypot(...item.vector)
    const score = denominator ? dot / denominator : 0
    scores.set(item.id, Math.max(scores.get(item.id) ?? -1, score))
  }
  return scores
}
export function filterScores(scores, { minScore = APP_VALUES.minScore, window = APP_VALUES.window, limit = APP_VALUES.limit } = {}) {
  const best = Math.max(...scores.values())
  return [...scores].map(([id, score]) => ({ id, score }))
    .filter(r => r.score >= minScore && r.score >= best - window)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
}

// --- lexicon baseline: words of the pathway title and of its skill labels, both languages --------
const STOP = new Set(['and', 'the', 'for', 'with', 'how', 'want', 'work', 'job', 'jobs', 'career', 'path', 'become', 'learn', 'like', 'what', 'should', 'something', 'from', 'into', 'about', 'practice', 'project', 'lab',
  'في', 'من', 'على', 'الى', 'الي', 'عن', 'مع', 'او', 'اللي', 'التي', 'الذي', 'ابي', 'ابغي', 'ودي', 'اريد', 'ارغب', 'كيف', 'اصير', 'اكون', 'اشتغل', 'العمل', 'عمل', 'وظيفة', 'مشروع', 'تطبيقي', 'مختبر', 'مبتدئ'])
const stemAr = word => word.replace(/^و(?=ال)/, '').replace(/^(ال|بال|لل|وال)(?=..)/, '')
const stemEn = word => word.replace(/'s$/, '').replace(/(?<=..)s$/, '')
export function words(text) {
  return orthographic(String(text ?? '')).toLowerCase().replace(/ة/g, 'ه').split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean).map(w => (/[؀-ۿ]/.test(w) ? stemAr(w) : stemEn(w))).filter(w => w.length >= 3 && !STOP.has(w))
}
export function lexiconIndex(targets = targetProfiles) {
  return targets.map(t => {
    const skillIds = [...(t.requiredSkills || []), ...(t.teachesSkills || [])]
    const text = LANGS.flatMap(lang => [t.title[lang], ...skillIds.map(id => skills[id]?.labels?.[lang] || '')]).join(' ')
    return { id: t.id, words: new Set(words(text)) }
  })
}
// Score = number of distinct query words found in the pathway's words; nothing found when no word matches.
export function lexiconRank(query, index = lexiconIndex(), { limit = 3 } = {}) {
  const q = new Set(words(query))
  return index.map(p => ({ id: p.id, score: [...q].filter(w => p.words.has(w)).length }))
    .filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit)
}

// --- metrics ----------------------------------------------------------------------------------
// Per case, from the list the student would see (at most 3):
//   positive case (expected not empty): hit1, hit3, rr = 1 / rank of the first expected pathway (0 if none)
//   should-find-nothing case: nothingOk = the list is empty
export function caseOutcome(c, results) {
  const ids = results.map(r => r.id)
  if (!c.expected.length) return { kind: 'nothing', nothingOk: ids.length === 0, ids }
  const rank = ids.findIndex(id => c.expected.includes(id)) + 1
  return { kind: 'positive', hit1: rank === 1, hit3: rank >= 1 && rank <= 3, rr: rank ? 1 / rank : 0, empty: ids.length === 0, ids }
}
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
export const METRICS = Object.freeze({
  hit1: { of: 'positive', value: o => (o.hit1 ? 1 : 0) },
  hit3: { of: 'positive', value: o => (o.hit3 ? 1 : 0) },
  mrr: { of: 'positive', value: o => o.rr },
  nothingCorrect: { of: 'nothing', value: o => (o.nothingOk ? 1 : 0) },
  // One number for tuning: a case is right if a positive has a hit in the top 3, or a should-find-nothing case shows nothing.
  accuracy: { of: 'all', value: o => (o.kind === 'positive' ? (o.hit3 ? 1 : 0) : (o.nothingOk ? 1 : 0)) },
})
export function metric(outcomes, name) {
  const m = METRICS[name]
  return mean(outcomes.filter(o => m.of === 'all' || o.kind === m.of).map(m.value))
}

// Task 39 rule: bootstrap 95% interval, resampling cases, 2,000 draws, fixed seed. Percentile method.
export const BOOTSTRAP = Object.freeze({ draws: 2000, seed: 20261118, level: 0.95 })
export function seededRandom(seed) {
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export function bootstrapInterval(outcomes, name, { draws = BOOTSTRAP.draws, seed = BOOTSTRAP.seed, level = BOOTSTRAP.level } = {}) {
  const m = METRICS[name]
  const pool = outcomes.filter(o => m.of === 'all' || o.kind === m.of).map(m.value)
  if (!pool.length) return null
  const random = seededRandom(seed), values = []
  for (let d = 0; d < draws; d++) {
    let sum = 0
    for (let i = 0; i < pool.length; i++) sum += pool[Math.floor(random() * pool.length)]
    values.push(sum / pool.length)
  }
  values.sort((a, b) => a - b)
  const at = q => values[Math.min(values.length - 1, Math.max(0, Math.floor(q * values.length)))]
  return [at((1 - level) / 2), at(1 - (1 - level) / 2)]
}

export function summarise(cases, outcomes) {
  const groups = { all: cases.map((_, i) => i), ar: [], en: [], dialect: [] }
  cases.forEach((c, i) => { groups[c.lang].push(i); if (c.dialect) groups.dialect.push(i) })
  const out = {}
  for (const [group, idx] of Object.entries(groups)) {
    const os = idx.map(i => outcomes[i])
    out[group] = {
      cases: os.length, positives: os.filter(o => o.kind === 'positive').length, nothing: os.filter(o => o.kind === 'nothing').length,
      emptyOnPositive: os.filter(o => o.kind === 'positive' && o.empty).length,
      metrics: Object.fromEntries(Object.keys(METRICS).map(name => [name, { value: round(metric(os, name)), ci: bootstrapInterval(os, name)?.map(round) ?? null }])),
    }
  }
  return out
}
export const round = x => (x == null ? null : Math.round(x * 10000) / 10000)
export const pct = x => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
export const withCi = ({ value, ci }) => (value == null ? '—' : `${pct(value)} (95% CI ${pct(ci[0])}–${pct(ci[1])})`)

// Dev-set grid for the two app numbers. Ties: higher MRR, then the values closest to the app's.
export const GRID = Object.freeze({
  minScore: Array.from({ length: 25 }, (_, i) => round(0.15 + i * 0.025)),
  window: [...Array.from({ length: 15 }, (_, i) => round(0.02 + i * 0.02)), 1],
})
export function tune(cases, scoresPerCase) {
  let best = null
  for (const minScore of GRID.minScore) for (const window of GRID.window) {
    const outcomes = cases.map((c, i) => caseOutcome(c, filterScores(scoresPerCase[i], { minScore, window })))
    const row = { minScore, window, accuracy: round(metric(outcomes, 'accuracy')), mrr: round(metric(outcomes, 'mrr')),
      distance: round(Math.abs(minScore - APP_VALUES.minScore) + Math.abs(window - APP_VALUES.window)) }
    if (!best || row.accuracy > best.accuracy || (row.accuracy === best.accuracy && (row.mrr > best.mrr || (row.mrr === best.mrr && row.distance < best.distance)))) best = row
  }
  return best
}

export const readJson = file => JSON.parse(readFileSync(file, 'utf8'))
