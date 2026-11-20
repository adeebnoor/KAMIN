// MiniLM-L12 (KAMIN) vs paraphrase-multilingual-mpnet, each + engine v2 (experimental), hybrid, sentences split.
// Runs mpnet + v2 on testset.json and dialect-set.json (tuned on dev-set.json); reuses the other v2 results of the same day.
// Usage (inside evaluation/):  node experimental/models-l12-vs-mpnet.mjs     (KAMIN_DIR defaults to the repository root)
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const EVAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const KAMIN = path.resolve(process.env.KAMIN_DIR || path.resolve(EVAL, '..'))
const date = process.env.RESULT_DATE || new Date().toISOString().slice(0, 10)
const MODELS = [
  { key: 'L12', name: 'paraphrase-multilingual-MiniLM-L12-v2 (KAMIN)', tag: '', dir: path.join(KAMIN, '.model-cache', '2c4055b12046f11709e9df2c122e59ffbdc2f900'), env: {} },
  { key: 'mpnet', name: 'paraphrase-multilingual-mpnet-base-v2', tag: '-paraphrase-multilingual-mpnet-base-v2', dir: path.join(EVAL, 'models', 'paraphrase-multilingual-mpnet-base-v2'),
    env: { EMBED_MODEL_DIR: path.join('models', 'paraphrase-multilingual-mpnet-base-v2'), EMBED_PREFIX: '' } },
]
const SETS = [
  { file: 'course-testset-v2.json', label: 'course-testset-v2 (held-out, 12 courses)', dev: 'course-dev-set.json' },
  { file: 'course-testset.json', label: 'course-testset (seen set, not proof, 25 courses)', dev: 'course-dev-set.json' },
  { file: 'testset.json', label: 'testset (project descriptions)', dev: 'dev-set.json' },
  { file: 'dialect-set.json', label: 'dialect-set (Saudi dialect)', dev: 'dev-set.json' },
]
const env = m => ({ ...process.env, ...m.env, LEXICON: 'improved-v2', EMBED_SPLIT: 'sentences' })
const node = (args, m) => { if (spawnSync(process.execPath, args, { cwd: EVAL, stdio: 'inherit', env: env(m) }).status !== 0) throw new Error('failed: ' + args.join(' ')) }
const resultFile = (set, m) => path.join(EVAL, 'results', `${path.basename(set, '.json')}-hybrid${m.tag}-improved-v2-${date}.json`)

// 1. mpnet + v2 on the old sets (tuned on dev-set.json)
const mp = MODELS[1]
node(['eval.mjs', 'tune', 'dev-set.json', 'hybrid'], mp)
for (const set of ['testset.json', 'dialect-set.json']) node(['eval.mjs', 'run', set, 'hybrid'], mp)

// 2. tables
const pct = x => x == null ? '—' : (x * 100).toFixed(1) + '%'
const thr = e => {
  if (!e.thresholds) return String(e.threshold)
  const d = Object.entries(e.thresholds).filter(([, t]) => t !== e.threshold)
  return d.length ? `${e.threshold} (per-cap: ${d.map(([k, t]) => k + ' ' + t).join(', ')})` : `${e.threshold} (per-capability pass: all equal)`
}
let md = `# MiniLM-L12 (KAMIN) vs mpnet · both with engine v2 (experimental) · ${date}\n\nHybrid (engine v2 first, then the model above its threshold), sentences split. Thresholds tuned only on course-dev-set.json (course sets) or dev-set.json (testset, dialect-set). Measured locally on Windows (CPU). "Median ms" is the model's embedding time per text; the engine alone is under 1 ms.\n`
for (const s of SETS) {
  const per = MODELS.map(m => ({ m, r: JSON.parse(fs.readFileSync(resultFile(s.file, m), 'utf8')) }))
  const langs = Object.keys(per[0].r.embedding.metrics)
  for (const lang of langs) {
    md += `\n## ${s.label}${langs.length > 1 ? ' · ' + lang.toUpperCase() : ''}\n\nTuned on ${s.dev}. Cases: ${per[0].r.embedding.metrics[lang].cases}\n\n| Method | Precision | Recall | F1 | TP / FP / FN | Unsupported claims | Abstention rate | Correct abstentions / negatives | Median ms per text | Threshold |\n|---|---|---|---|---|---|---|---|---|---|\n`
    const row = (name, x, t) => `| ${name} | ${pct(x.precision)} | ${pct(x.recall)} | ${pct(x.f1)} | ${x.tp} / ${x.fp} / ${x.fn} | ${x.unsupportedClaims} | ${pct(x.abstentionRate)} | ${x.correctAbstentions} / ${x.negatives} | ${x.medianMs.toFixed(1)} | ${t} |\n`
    md += row('Engine v2 only (no model)', per[0].r.lexicon.metrics[lang], '—')
    for (const { m, r } of per) md += row(`${m.key} + engine v2`, r.embedding.metrics[lang], thr(r.embedding))
  }
}

// 3. sizes
const dirSize = d => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? dirSize(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0)
const mb = b => (b / 1024 / 1024).toFixed(1) + ' MB'
md += `\n## Model size\n\n| Model | q8 ONNX file | Whole model folder | Embedding dimension | Layers | Vocabulary | Folder |\n|---|---|---|---|---|---|---|\n`
for (const m of MODELS) {
  const cfg = JSON.parse(fs.readFileSync(path.join(m.dir, 'config.json'), 'utf8'))
  const onnx = fs.statSync(path.join(m.dir, 'onnx', 'model_quantized.onnx')).size
  md += `| ${m.name} | ${mb(onnx)} (${onnx.toLocaleString('en')} B) | ${mb(dirSize(m.dir))} | ${cfg.hidden_size} | ${cfg.num_hidden_layers} | ${cfg.vocab_size?.toLocaleString('en')} | ${path.relative(KAMIN, m.dir).startsWith('..') ? path.basename(m.dir) : path.relative(KAMIN, m.dir).split(path.sep).join('/')} |\n`
}
md += `\nKAMIN's folder also holds catalog-index-v1.json (KAMIN's own precomputed catalog vectors), which is counted in its folder size.\n`
const out = path.join(EVAL, 'results', `models-L12-vs-mpnet-v2-${date}.md`)
fs.writeFileSync(out, md)
console.log('\n' + md + `\nSaved in ${out}`)
