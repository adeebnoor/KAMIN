// Runs every browser model combined with the lexicon (hybrid) on the test set and the dialect set, then prints one summary table.
// Usage (inside evaluation/):  node run-all.mjs
// Optional env: EVAL_SETS (comma list, default testset.json,dialect-set.json), EVAL_DEV (default dev-set.json), EVAL_TAG,
//               LEXICON=improved (KAMIN's improved local engine), EMBED_SPLIT=phrases (embed phrases instead of whole sentences)
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
// KAMIN's own model is Xenova/paraphrase-multilingual-MiniLM-L12-v2 (src/semantic/config.js), so the first row is that L12 model.
const MODELS = [
  { name: 'MiniLM (current in KAMIN)', repo: null, prefix: '' },
  { name: 'multilingual-e5-small', repo: 'Xenova/multilingual-e5-small', prefix: 'query: ' },
  { name: 'multilingual-e5-base', repo: 'Xenova/multilingual-e5-base', prefix: 'query: ' },
  { name: 'paraphrase-multilingual-mpnet', repo: 'Xenova/paraphrase-multilingual-mpnet-base-v2', prefix: '' },
]
const SETS = (process.env.EVAL_SETS || 'testset.json,dialect-set.json').split(',').map(s => s.trim()).filter(Boolean)
const DEV = process.env.EVAL_DEV || 'dev-set.json'
const TAG = process.env.EVAL_TAG ? '-' + process.env.EVAL_TAG : ''
const VARIANT = (['improved', 'improved-v2'].includes(process.env.LEXICON) ? '-' + process.env.LEXICON : '') + (process.env.EMBED_SPLIT === 'phrases' ? '-phrases' : '')
const node = (args, env = {}) => spawnSync(process.execPath, args, { cwd: HERE, stdio: 'inherit', env: { ...process.env, ...env } }).status === 0
const newest = prefix => {
  const dir = path.join(HERE, 'results')
  const f = fs.readdirSync(dir).filter(n => n.startsWith(prefix) && /^\d{4}-\d{2}-\d{2}\.json$/.test(n.slice(prefix.length)))
    .map(n => path.join(dir, n)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]
  return f ? JSON.parse(fs.readFileSync(f, 'utf8')) : null
}
const pct = x => x == null ? '—' : (x * 100).toFixed(1) + '%'
const rows = []
let lexicon = {}

for (const m of MODELS) {
  console.log(`\n================ ${m.name} ================`)
  let env = {}, tag = ''
  if (m.repo) {
    if (!node(['download-model.mjs', m.repo])) { rows.push({ model: m.name, error: 'download failed' }); continue }
    const dir = path.join('models', m.repo.split('/').pop())
    env = { EMBED_MODEL_DIR: dir, EMBED_PREFIX: m.prefix }
    tag = '-' + path.basename(dir).replace(/[^\w.-]/g, '_')
  }
  if (!node(['eval.mjs', 'tune', DEV, 'hybrid'], env)) { rows.push({ model: m.name, error: 'tune failed' }); continue }
  const row = { model: m.name }
  for (const set of SETS) {
    if (!node(['eval.mjs', 'run', set, 'hybrid'], env)) { row[set] = null; continue }
    const r = newest(`${path.basename(set, '.json')}-hybrid${tag}${VARIANT}-`)
    row[set] = r?.embedding; row.threshold = r?.embedding?.threshold
    if (r && !lexicon[set]) lexicon[set] = r.lexicon.metrics
  }
  rows.push(row)
}

// Generic summary: one F1 column per (set, language present in that set), then unsupported claims and threshold.
const LANG_ORDER = ['ar', 'en']
const cols = []
for (const set of SETS) {
  const langs = new Set([...Object.keys(lexicon[set] || {}), ...rows.flatMap(r => Object.keys(r[set]?.metrics || {}))])
  for (const lang of LANG_ORDER.filter(l => langs.has(l))) cols.push({ set, lang })
}
const unsupported = metricsBySet => cols.reduce((s, c) => s + (metricsBySet[c.set]?.[c.lang]?.unsupportedClaims ?? 0), 0)
const line = (name, metricsBySet, threshold) =>
  `| ${name} | ${cols.map(c => pct(metricsBySet[c.set]?.[c.lang]?.f1)).join(' | ')} | ${unsupported(metricsBySet)} | ${threshold ?? '—'} |`
const header = `| Method | ${cols.map(c => `${path.basename(c.set, '.json')} ${c.lang.toUpperCase()} F1`).join(' | ')} | Unsupported claims | Threshold |`
const sep = '|' + Array(cols.length + 3).fill('---').join('|') + '|'
const baseLabel = { improved: 'Improved local engine only', 'improved-v2': 'Improved engine v2 (experimental) only' }[process.env.LEXICON] || 'Lexicon only'
const plusLabel = { improved: 'improved engine', 'improved-v2': 'improved engine v2' }[process.env.LEXICON] || 'lexicon'
const out = [header, sep,
  line(`${baseLabel} (baseline)`, lexicon, '—'),
  ...rows.map(r => r.error
    ? `| ${r.model} + ${plusLabel} | ${r.error} |${' |'.repeat(cols.length + 1)}`
    : line(`${r.model} + ${plusLabel}`, Object.fromEntries(SETS.map(s => [s, r[s]?.metrics])), r.threshold))]
const date = new Date().toISOString().slice(0, 10)
const split = process.env.EMBED_SPLIT === 'phrases' ? 'phrases' : 'sentences'
const md = `# Browser models + ${plusLabel} (${date})\n\nSets: ${SETS.join(', ')} · threshold tuned on ${DEV} only · split: ${split}\n\n${out.join('\n')}\n`
const file = `summary${TAG}${VARIANT}-${date}.md`
fs.writeFileSync(path.join(HERE, 'results', file), md)
console.log('\n' + md + `\nSaved in results\\${file}. Copy the table above and send it.`)
