// v1 (KAMIN's improved engine) vs v2 (experimental copy in this folder) with the browser models, hybrid, sentences split.
// Thresholds are tuned only on the dev sets: course-dev-set.json for the course sets, dev-set.json for the old sets.
// Usage (inside evaluation/):  node experimental/run-v2.mjs      (KAMIN_DIR defaults to the repository root)
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const EVAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MODELS = {
  L12: { name: 'MiniLM-L12 (KAMIN)', env: {}, tag: '' },
  mpnet: { name: 'mpnet', env: { EMBED_MODEL_DIR: path.join('models', 'paraphrase-multilingual-mpnet-base-v2'), EMBED_PREFIX: '' }, tag: '-paraphrase-multilingual-mpnet-base-v2' },
}
const GROUPS = [
  { dev: 'course-dev-set.json', sets: [['course-testset-v2.json', 'held-out, clean result'], ['course-testset.json', 'seen set, not proof']], models: ['L12', 'mpnet'] },
  { dev: 'dev-set.json', sets: [['testset.json', 'regression check'], ['dialect-set.json', 'regression check']], models: ['L12'] },
]
const LEXICONS = [['improved', 'v1'], ['improved-v2', 'v2']]
const date = new Date().toISOString().slice(0, 10)
const node = (args, env) => {
  const r = spawnSync(process.execPath, args, { cwd: EVAL, stdio: 'inherit', env: { ...process.env, EMBED_SPLIT: 'sentences', ...env } })
  if (r.status !== 0) throw new Error(`failed: node ${args.join(' ')} ${JSON.stringify(env)}`)
}
const pct = x => x == null ? '—' : (x * 100).toFixed(1) + '%'
const t0 = Date.now()
const results = {}

for (const g of GROUPS) for (const m of g.models) for (const [lex, label] of LEXICONS) {
  const env = { ...MODELS[m].env, LEXICON: lex }
  console.log(`\n######## ${label} + ${MODELS[m].name} · tune on ${g.dev} ########`)
  node(['eval.mjs', 'tune', g.dev, 'hybrid'], env)
  for (const [set] of g.sets) {
    node(['eval.mjs', 'run', set, 'hybrid'], env)
    const f = path.join(EVAL, 'results', `${path.basename(set, '.json')}-hybrid${MODELS[m].tag}-${lex}-${date}.json`)
    results[`${set}|${m}|${lex}`] = JSON.parse(fs.readFileSync(f, 'utf8'))
  }
}

const thr = e => {
  if (!e.thresholds) return String(e.threshold)
  const diff = Object.entries(e.thresholds).filter(([, t]) => t !== e.threshold).map(([id, t]) => `${id} ${t}`)
  return `${e.threshold}${diff.length ? ' (per-cap: ' + diff.join(', ') + ')' : ''}`
}
let md = `# v1 vs v2 (experimental) · ${date}\n\nHybrid, sentences split. v1 = KAMIN's improved engine (src/ai/projectSuggestImproved.js, read-only). v2 = eval/experimental/projectSuggestImproved-v2.js + per-capability thresholds. Thresholds tuned on the dev sets only.\n`
for (const g of GROUPS) for (const [set, note] of g.sets) {
  const langs = Object.keys(results[`${set}|L12|improved`].lexicon.metrics)
  md += `\n## ${set} — ${note}\n\nTuned on ${g.dev}. Cases: ${langs.map(l => `${l} ${results[`${set}|L12|improved`].lexicon.metrics[l].cases}`).join(', ')}\n\n`
  md += `| Method | ${langs.map(l => `${l.toUpperCase()} F1 | ${l.toUpperCase()} P | ${l.toUpperCase()} R`).join(' | ')} | Unsupported claims | Threshold |\n|${Array(langs.length * 3 + 3).fill('---').join('|')}|\n`
  const row = (name, metrics, t) => `| ${name} | ${langs.map(l => `${pct(metrics[l]?.f1)} | ${pct(metrics[l]?.precision)} | ${pct(metrics[l]?.recall)}`).join(' | ')} | ${langs.reduce((s, l) => s + (metrics[l]?.unsupportedClaims ?? 0), 0)} | ${t} |\n`
  for (const [lex, label] of LEXICONS) {
    md += row(`${label} engine only`, results[`${set}|L12|${lex}`].lexicon.metrics, '—')
    for (const m of g.models) { const e = results[`${set}|${m}|${lex}`].embedding; md += row(`${label} + ${MODELS[m].name}`, e.metrics, thr(e)) }
  }
}
const csv = path.join(EVAL, 'results', `course-testset-v2-hybrid-improved-v2-${date}-embedding-cases.csv`)
const bad = fs.readFileSync(csv, 'utf8').replace(/^﻿/, '').split('\n').slice(1).filter(l => l.endsWith('"false"'))
md += `\n## ok=false rows · v2 + MiniLM-L12 on course-testset-v2.json\n\n\`\`\`\nid,lang,expected,predicted,falsePositives,missed,ok\n${bad.join('\n') || '(none)'}\n\`\`\`\n\nRun time: ${((Date.now() - t0) / 1000).toFixed(0)} s\n`
const out = path.join(EVAL, 'results', `compare-v1-v2-${date}.md`)
fs.writeFileSync(out, md)
console.log('\n' + md + `\nSaved in ${out}`)
