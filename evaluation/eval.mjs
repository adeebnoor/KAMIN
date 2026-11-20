// Capability-suggestion evaluation tool (KAMIN, AI & Evaluation track)
// Fully local: check/freeze/tune/run never send any text off this computer. (The external-model mode used in the
// standalone copy was removed here: KAMIN uses no external AI service.)
// Usage (from inside the evaluation folder):
//   node eval.mjs check  <set.json>          validate a case file
//   node eval.mjs freeze <testset.json>      freeze the test set (SHA-256 fingerprint + date)
//   node eval.mjs tune   <devset.json>       pick the model threshold on the dev set only
//   node eval.mjs run    <set.json>          measure lexicon and model on the same set
// KAMIN repo path: KAMIN_DIR env var, defaults to the repository root (the parent of this folder)
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const KAMIN = path.resolve(process.env.KAMIN_DIR || path.resolve(HERE, '..'))
const MODEL_REVISION = '2c4055b12046f11709e9df2c122e59ffbdc2f900'
// Optional: EMBED_MODEL_DIR points to another browser model (e.g. multilingual-e5-small); EMBED_PREFIX adds e5's "query: " prefix
const MODEL_DIR = path.resolve(process.env.EMBED_MODEL_DIR || path.join(KAMIN, '.model-cache', MODEL_REVISION))
const EMBED_PREFIX = process.env.EMBED_PREFIX || ''
const MODEL_TAG = process.env.EMBED_MODEL_DIR ? path.basename(MODEL_DIR).replace(/[^\w.-]/g, '_') : ''
// Mode: "examples" also compares each sentence with the example sentences in skill-examples.json;
// "hybrid" = lexicon suggestions first, then add what the examples model finds above its own threshold
const MODE = ['tune', 'run'].includes(process.argv[2]) && ['examples', 'hybrid'].includes(process.argv[4]) ? process.argv[4] : 'basic'
// LEXICON: lexicon (KAMIN baseline) | improved (KAMIN's improved engine) | improved-v2 (experimental copy in eval/experimental, with per-capability thresholds)
const LEXICON = ['improved', 'improved-v2'].includes(process.env.LEXICON) ? process.env.LEXICON : 'lexicon'
const PER_CAP = LEXICON === 'improved-v2'
const SPLIT = process.env.EMBED_SPLIT === 'phrases' ? 'phrases' : 'sentences'
const SUFFIX = (MODE !== 'basic' ? '-' + MODE : '') + (MODEL_TAG ? '-' + MODEL_TAG : '') + (LEXICON !== 'lexicon' ? '-' + LEXICON : '') + (SPLIT === 'phrases' ? '-phrases' : '')
const CONFIG = path.join(HERE, `config${SUFFIX}.json`)
const METHOD_VERSION = { basic: 'eval-embed-sentence-v1', examples: 'eval-embed-examples-v1', hybrid: 'eval-lexicon+examples-v1' }[MODE] + (LEXICON !== 'lexicon' ? '+' + LEXICON : '') + (PER_CAP ? '+percap' : '') + (SPLIT === 'phrases' ? '+phrases' : '')

const kaminImport = rel => import(pathToFileURL(path.join(KAMIN, rel)).href)
const baseLex = await kaminImport('src/ai/projectSuggest.js')
let suggestCapabilities = baseLex.suggestCapabilities, PROJECT_SUGGEST_VERSION = baseLex.PROJECT_SUGGEST_VERSION
if (LEXICON !== 'lexicon') {
  const imp = LEXICON === 'improved-v2'
    ? await import(pathToFileURL(path.join(HERE, 'experimental', 'projectSuggestImproved-v2.js')).href)
    : await kaminImport('src/ai/projectSuggestImproved.js')
  const fn = imp.suggestCapabilities || imp.suggestCapabilitiesImproved || imp.default || Object.values(imp).find(v => typeof v === 'function' && /suggest/i.test(v.name))
  if (typeof fn !== 'function') { console.error('No suggest function exported by projectSuggestImproved.js. Exports: ' + Object.keys(imp).join(', ')); process.exit(1) }
  suggestCapabilities = t => { const r = fn(t); return Array.isArray(r) ? { suggestions: r } : r }
  PROJECT_SUGGEST_VERSION = Object.entries(imp).find(([k, v]) => /VERSION/.test(k) && typeof v === 'string')?.[1] || 'improved'
}
const { skills } = await kaminImport('src/data.js')
const SKILL_IDS = Object.keys(skills)

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex')
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''))
// Arabic normalisation (same as KAMIN's lexicon): strip diacritics/tatweel, unify alef forms and alef maqsura; split on Latin and Arabic punctuation
const normalise = t => String(t || '').replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim()
const sentences = t => {
  const out = normalise(t).split(/(?<=[.!?؟؛])\s+|\n+/).map(s => s.trim()).filter(s => s.length >= 3)
  if (SPLIT !== 'phrases') return out
  return out.flatMap(s => s.split(/,\s+|:\s+|;\s+|\s+Topics include\s+|،\s*/).map(x => x.trim()).filter(x => x.length >= 3))
}
const commit = () => { try { return execSync('git rev-parse --short HEAD', { cwd: KAMIN }).toString().trim() } catch { return 'unknown' } }
const lockPath = f => f.replace(/\.json$/i, '.lock.json')

function loadSet(file) {
  const cases = readJson(file)
  const errors = []
  if (!Array.isArray(cases)) errors.push('the file must be a JSON array [ ... ]')
  const ids = new Set()
  for (const [i, c] of (cases || []).entries()) {
    const where = `case #${i + 1} (${c?.id ?? 'no id'})`
    if (!c.id) errors.push(`${where}: missing id`)
    else if (ids.has(c.id)) errors.push(`${where}: duplicate id`)
    ids.add(c.id)
    if (!['ar', 'en'].includes(c.lang)) errors.push(`${where}: lang must be ar or en`)
    if (!c.text || String(c.text).trim().length < 3) errors.push(`${where}: text is empty`)
    if (!Array.isArray(c.expected)) errors.push(`${where}: expected must be an array (use [] for none)`)
    else for (const id of c.expected) if (!SKILL_IDS.includes(id)) errors.push(`${where}: capability not in catalog: ${id}`)
  }
  if (errors.length) { console.error('Errors in file:\n- ' + errors.join('\n- ')); process.exit(1) }
  return cases
}

// ---------- Method 2: local embedding model (multilingual MiniLM, the same model KAMIN ships) ----------
let extractor = null
async function getExtractor() {
  if (extractor) return extractor
  if (!fs.existsSync(path.join(MODEL_DIR, 'onnx', 'model_quantized.onnx'))) {
    console.error(`Model not found in ${MODEL_DIR}\nRun first: npm.cmd run build inside the KAMIN folder`); process.exit(1)
  }
  const require = createRequire(path.join(KAMIN, 'package.json'))
  const entry = require.resolve('@huggingface/transformers')
  const { pipeline, env } = await import(pathToFileURL(entry).href)
  env.allowRemoteModels = false; env.allowLocalModels = true; env.useFSCache = false
  extractor = await pipeline('feature-extraction', MODEL_DIR + '/', { dtype: 'q8', device: 'cpu', local_files_only: true })
  return extractor
}
const embedCache = new Map()
async function embed(text) {
  if (embedCache.has(text)) return embedCache.get(text)
  const ex = await getExtractor()
  const v = Array.from((await ex(EMBED_PREFIX + text, { pooling: 'mean', normalize: true })).data)
  embedCache.set(text, v); return v
}
const cos = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)

let skillVectors = null
async function getSkillVectors() {
  if (skillVectors) return skillVectors
  const desc = readJson(path.join(HERE, 'skill-descriptions.json'))
  skillVectors = []
  for (const id of SKILL_IDS) for (const lang of ['ar', 'en']) {
    const text = [skills[id].labels[lang], desc[id]?.[lang]].filter(Boolean).join('. ')
    skillVectors.push({ id, vector: await embed(text) })
  }
  if (MODE !== 'basic') {
    const ex = readJson(path.join(HERE, 'skill-examples.json'))
    for (const id of SKILL_IDS) for (const e of ex[id] || []) skillVectors.push({ id, vector: await embed(normalise(e)) })
  }
  return skillVectors
}
// For each capability, keep the best-matching sentence; suggest it if its score passes the threshold, quoting that sentence
async function scoreText(text) {
  const vectors = await getSkillVectors()
  const best = new Map()
  for (const s of sentences(text)) {
    const v = await embed(s)
    for (const sk of vectors) {
      const score = cos(v, sk.vector)
      if (!best.has(sk.id) || score > best.get(sk.id).score) best.set(sk.id, { score, snippet: s })
    }
  }
  return best
}
// Per-capability thresholds (improved-v2 only): set from the config; null = one global threshold for every capability
let CAP_T = null
function embeddingSuggest(scores, threshold, max = 4, text = null) {
  if (MODE === 'hybrid' && text != null) {
    const lex = suggestCapabilities(text).suggestions
    const have = new Set(lex.map(p => p.skillId))
    return [...lex, ...embeddingSuggest(scores, threshold, max).filter(p => !have.has(p.skillId))].slice(0, max)
  }
  return [...scores].filter(([id, r]) => r.score >= (CAP_T?.[id] ?? threshold)).sort((a, b) => b[1].score - a[1].score).slice(0, max)
    .map(([skillId, r]) => ({ skillId, snippet: r.snippet, score: +r.score.toFixed(4) }))
}

// ---------- Scoring ----------
// Supervisor's rule: any suggested capability without verbatim supporting text in the description = false positive
function supported(snippet, text) { return !!snippet && normalise(text).includes(normalise(snippet)) }
function score(cases, predict) {
  const per = {}
  const rows = []
  for (const c of cases) {
    const b = per[c.lang] ||= { cases: 0, tp: 0, fp: 0, fn: 0, unsupported: 0, abstained: 0, negatives: 0, correctAbstain: 0, ms: [] }
    const t0 = performance.now()
    const preds = predict(c)
    b.ms.push(performance.now() - t0)
    b.cases++
    const want = new Set(c.expected)
    const got = new Set()
    for (const p of preds) {
      if (!supported(p.snippet, c.text)) { b.fp++; b.unsupported++; continue }
      got.add(p.skillId)
    }
    for (const id of got) want.has(id) ? b.tp++ : b.fp++
    for (const id of want) if (!got.has(id)) b.fn++
    if (!preds.length) b.abstained++
    if (!want.size) { b.negatives++; if (!preds.length) b.correctAbstain++ }
    const fp = [...got].filter(id => !want.has(id)), fn = [...want].filter(id => !got.has(id))
    rows.push({ id: c.id, lang: c.lang, expected: [...want].join('|'), predicted: preds.map(p => p.skillId).join('|'), falsePositives: fp.join('|'), missed: fn.join('|'), ok: !fp.length && !fn.length })
  }
  const out = {}
  for (const [lang, b] of Object.entries(per)) {
    const precision = b.tp + b.fp ? b.tp / (b.tp + b.fp) : null
    const recall = b.tp + b.fn ? b.tp / (b.tp + b.fn) : null
    const f1 = precision != null && recall != null && precision + recall ? 2 * precision * recall / (precision + recall) : null
    const ms = b.ms.sort((x, y) => x - y)
    out[lang] = { cases: b.cases, tp: b.tp, fp: b.fp, fn: b.fn, precision, recall, f1, unsupportedClaims: b.unsupported, abstentionRate: b.abstained / b.cases, negatives: b.negatives, correctAbstentions: b.correctAbstain, medianMs: ms[Math.floor(ms.length / 2)] }
  }
  return { metrics: out, rows }
}
const pct = x => x == null ? '—' : (x * 100).toFixed(1) + '%'
function printTable(name, m) {
  console.log(`\n## ${name}`)
  console.log('Lang | Cases | Precision | Recall | F1 | Unsupported claims | Abstention rate | Correct abstentions | Median latency')
  for (const [lang, r] of Object.entries(m)) console.log(`${lang} | ${r.cases} | ${pct(r.precision)} | ${pct(r.recall)} | ${pct(r.f1)} | ${r.unsupportedClaims} | ${pct(r.abstentionRate)} | ${r.correctAbstentions}/${r.negatives} | ${r.medianMs.toFixed(1)}ms`)
}
const toCsv = rows => '﻿' + ['id,lang,expected,predicted,falsePositives,missed,ok', ...rows.map(r => [r.id, r.lang, r.expected, r.predicted, r.falsePositives, r.missed, r.ok].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')

async function precompute(cases) { const m = new Map(); for (const c of cases) m.set(c.id, await scoreText(c.text)); return m }

const [cmd, file] = process.argv.slice(2)
if (!cmd || !file) { console.log('Usage: node eval.mjs <check|freeze|tune|run> <file.json> [examples | hybrid]'); process.exit(1) }
const fileAbs = path.resolve(file)

if (cmd === 'check') {
  const cases = loadSet(fileAbs)
  const by = l => cases.filter(c => c.lang === l).length
  console.log(`✓ File is valid: ${cases.length} cases (Arabic ${by('ar')}, English ${by('en')}), no-capability cases: ${cases.filter(c => !c.expected.length).length}`)
}
else if (cmd === 'freeze') {
  const cases = loadSet(fileAbs)
  const lock = { file: path.basename(fileAbs), sha256: sha(fs.readFileSync(fileAbs)), frozenAt: new Date().toISOString(), cases: cases.length, kaminCommit: commit(), note: 'Frozen test set: no edits and no threshold tuning on it. Any change = a new version with a new date.' }
  fs.writeFileSync(lockPath(fileAbs), JSON.stringify(lock, null, 2))
  console.log(`✓ Froze ${lock.file}: ${lock.cases} cases\nSHA-256: ${lock.sha256}`)
}
else if (cmd === 'tune') {
  if (fs.existsSync(lockPath(fileAbs))) { console.error('✗ This file is frozen (test set). The threshold may only be tuned on the dev set.'); process.exit(1) }
  const cases = loadSet(fileAbs)
  console.log('Loading model and computing similarities...')
  const pre = await precompute(cases)
  let best = null
  for (let t = 0.20; t <= 0.95001; t += 0.01) {
    const { metrics } = score(cases, c => embeddingSuggest(pre.get(c.id), t, 4, c.text))
    const f1s = Object.values(metrics).map(m => m.f1 ?? 0)
    const avg = f1s.reduce((a, b) => a + b, 0) / f1s.length
    if (!best || avg > best.avg) best = { t: +t.toFixed(2), avg }
  }
  // improved-v2: one coordinate pass per capability within [global, 0.95]; a higher threshold is kept only if it strictly raises dev F1
  let thresholds = null
  if (PER_CAP) {
    const devF1 = () => { const f = Object.values(score(cases, c => embeddingSuggest(pre.get(c.id), best.t, 4, c.text)).metrics).map(m => m.f1 ?? 0); return f.reduce((a, b) => a + b, 0) / f.length }
    CAP_T = Object.fromEntries(SKILL_IDS.map(id => [id, best.t]))
    let cur = devF1()
    for (const id of SKILL_IDS) {
      let keep = CAP_T[id]
      for (let t = best.t + 0.01; t <= 0.95001; t += 0.01) {
        CAP_T[id] = +t.toFixed(2)
        const f = devF1()
        if (f > cur + 1e-9) { cur = f; keep = CAP_T[id] }
      }
      CAP_T[id] = keep
    }
    thresholds = { ...CAP_T }
    console.log(`Per-capability thresholds (dev mean F1 ${pct(best.avg)} → ${pct(cur)}): ${JSON.stringify(thresholds)}`)
    best.avg = cur
  }
  const cfg = { method: METHOD_VERSION, model: path.basename(MODEL_DIR), prefix: EMBED_PREFIX, threshold: best.t, ...(thresholds ? { thresholds } : {}), tunedOn: path.basename(fileAbs), tunedOnSha256: sha(fs.readFileSync(fileAbs)), tunedAt: new Date().toISOString(), devMacroF1: +best.avg.toFixed(4) }
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2))
  console.log(`✓ Threshold selected on the dev set: ${cfg.threshold} (mean F1 = ${pct(best.avg)})\nSaved to ${path.basename(CONFIG)}`)
}
else if (cmd === 'run') {
  const cases = loadSet(fileAbs)
  const lp = lockPath(fileAbs)
  let frozen = null
  if (fs.existsSync(lp)) {
    frozen = readJson(lp)
    if (frozen.sha256 !== sha(fs.readFileSync(fileAbs))) { console.error('✗ The file changed after freezing! Restore it or freeze a new version.'); process.exit(1) }
    console.log(`Frozen set, frozen at ${frozen.frozenAt} ✓`)
  } else console.log('Note: this file is not frozen (normal for the dev set).')
  if (!fs.existsSync(CONFIG)) { console.error(`✗ ${path.basename(CONFIG)} not found. Run first: node eval.mjs tune dev-set.json${MODE === 'examples' ? ' examples' : ''}`); process.exit(1) }
  const cfg = readJson(CONFIG)
  if (frozen && cfg.tunedOnSha256 === frozen.sha256) { console.error('✗ The threshold was tuned on this test set itself. Not allowed.'); process.exit(1) }
  if (!!cfg.thresholds !== PER_CAP) { console.error(`✗ ${path.basename(CONFIG)} does not match LEXICON=${LEXICON}. Tune again.`); process.exit(1) }
  CAP_T = cfg.thresholds || null

  const lex = score(cases, c => suggestCapabilities(c.text).suggestions)
  console.log('Loading model...')
  await getSkillVectors()
  const pre = new Map(); const embedMs = []
  for (const c of cases) { const t0 = performance.now(); pre.set(c.id, await scoreText(c.text)); embedMs.push(performance.now() - t0) }
  const emb = score(cases, c => embeddingSuggest(pre.get(c.id), cfg.threshold, 4, c.text))
  embedMs.sort((a, b) => a - b)
  for (const lang of Object.keys(emb.metrics)) {
    const ms = cases.map((c, i) => c.lang === lang ? embedMs[i] : null).filter(x => x != null).sort((a, b) => a - b)
    emb.metrics[lang].medianMs = ms[Math.floor(ms.length / 2)]
  }
  printTable(`1) Baseline: lexicon (${PROJECT_SUGGEST_VERSION})`, lex.metrics)
  printTable(`2) Local model (${METHOD_VERSION}, threshold ${cfg.threshold})`, emb.metrics)
  console.log('\nCost: SAR 0 per request for both methods (fully local, no external provider).')

  const stamp = new Date().toISOString().slice(0, 10)
  const name = path.basename(fileAbs, '.json') + SUFFIX
  fs.mkdirSync(path.join(HERE, 'results'), { recursive: true })
  const report = { set: path.basename(fileAbs), setSha256: sha(fs.readFileSync(fileAbs)), frozenAt: frozen?.frozenAt || null, ranAt: new Date().toISOString(), kaminCommit: commit(), node: process.version,
    rule: 'Any suggested capability without verbatim supporting text in the description counts as a false positive.',
    lexicon: { version: PROJECT_SUGGEST_VERSION, metrics: lex.metrics }, embedding: { ...cfg, modelDir: path.basename(MODEL_DIR), prefix: EMBED_PREFIX, metrics: emb.metrics } }
  fs.writeFileSync(path.join(HERE, 'results', `${name}-${stamp}.json`), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(HERE, 'results', `${name}-${stamp}-lexicon-cases.csv`), toCsv(lex.rows))
  fs.writeFileSync(path.join(HERE, 'results', `${name}-${stamp}-embedding-cases.csv`), toCsv(emb.rows))
  console.log(`\n✓ Results saved in the results folder (JSON + two per-case CSV files: expected, predicted, errors)`)
}
else { console.error('Unknown command'); process.exit(1) }
