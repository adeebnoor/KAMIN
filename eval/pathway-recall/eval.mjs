// Task 42 · measure the in-app MiniLM pathway search ("search pathways by meaning").
//   node eval/pathway-recall/eval.mjs tune [dev-set.json]                 choose minScore and the window on the dev set only → config.json
//   node eval/pathway-recall/eval.mjs run  [testset.json] [--date YYYY-MM-DD]   app values, dev-tuned values and the lexicon baseline → results/
// Measurement only: the app's values in src/semantic/catalog.js are reported, never changed.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rankSemanticCandidates } from '../../src/semantic/catalog.js'
import { EMBEDDING_MODEL } from '../../src/semantic/config.js'
import { assertLockMatches, assertNotFrozen, fileSha256, toCsvText } from '../project-suggest/lib.mjs'
import {
  APP_VALUES, BOOTSTRAP, GRID, HARNESS_VERSION, PROVENANCE, caseOutcome, checkSet, filterScores, lexiconIndex, lexiconRank,
  metric, pathwayScores, pct, readJson, readSet, round, summarise, tune, withCi,
} from './lib.mjs'
import { buildIndex, dispose, embed } from './minilm.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CONFIG = path.join(HERE, 'config.json')
const rel = file => path.relative(path.resolve(HERE, '../..'), file).split(path.sep).join('/')
const flag = (name, fallback) => { const at = process.argv.indexOf(`--${name}`); return at > 0 ? process.argv[at + 1] : fallback }
const fail = message => { console.error(message); process.exit(1) }
const today = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const commit = () => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim() } catch { return 'unknown' } }

function load(file, role) {
  const set = readSet(file)
  const problems = checkSet(set, role)
  if (problems.length) fail(`${rel(file)} fails the set rules:\n- ${problems.join('\n- ')}`)
  return set
}

async function scoresFor(cases) {
  const { index, shipped, catalogSha256, texts } = await buildIndex()
  const vectors = []
  for (const c of cases) vectors.push(await embed(c.query))
  return { index, shipped, catalogSha256, texts, vectors, scores: vectors.map(v => pathwayScores(v, index)) }
}

async function cmdTune(file = path.join(HERE, 'dev-set.json')) {
  assertNotFrozen(file)
  const set = load(file, 'dev')
  const { scores } = await scoresFor(set.cases)
  await dispose()
  const best = tune(set.cases, scores)
  const app = set.cases.map((c, i) => caseOutcome(c, filterScores(scores[i], APP_VALUES)))
  const config = {
    harness: HARNESS_VERSION, tunedOn: path.basename(file), tunedOnSha256: fileSha256(file), cases: set.cases.length,
    objective: 'case accuracy on the dev set (positive: an expected pathway in the top 3; should-find-nothing: an empty list); ties → higher MRR, then closest to the app values',
    grid: { minScore: [GRID.minScore[0], GRID.minScore.at(-1), 0.025], window: [GRID.window[0], GRID.window.at(-2), 0.02, 'and 1 (no window)'] },
    appValues: APP_VALUES, tuned: { minScore: best.minScore, window: best.window },
    dev: { app: { accuracy: round(metric(app, 'accuracy')), mrr: round(metric(app, 'mrr')) }, tuned: { accuracy: best.accuracy, mrr: best.mrr } },
    note: 'Reported only. The app keeps minScore 0.25 and window 0.12 until a separate decision changes them.',
  }
  writeFileSync(CONFIG, JSON.stringify(config, null, 2) + '\n')
  console.log(`Tuned on ${rel(file)} (${set.cases.length} cases, sha256 ${config.tunedOnSha256.slice(0, 12)}…)`)
  console.log(`  app   minScore ${APP_VALUES.minScore} window ${APP_VALUES.window}: accuracy ${pct(config.dev.app.accuracy)}, MRR ${config.dev.app.mrr}`)
  console.log(`  tuned minScore ${best.minScore} window ${best.window}: accuracy ${pct(best.accuracy)}, MRR ${best.mrr}`)
  console.log(`Wrote ${rel(CONFIG)}`)
}

async function cmdRun(file = path.join(HERE, 'testset.json')) {
  const lock = assertLockMatches(file)
  const set = load(file, lock ? 'test' : undefined)
  if (!existsSync(CONFIG)) fail('No config.json: run "eval.mjs tune" on the dev set first.')
  const config = readJson(CONFIG)
  const devFile = path.join(HERE, config.tunedOn)
  if (!existsSync(devFile) || fileSha256(devFile) !== config.tunedOnSha256) fail('config.json was tuned on a dev set that has changed since: run "eval.mjs tune" again.')
  if (path.resolve(devFile) === path.resolve(file)) fail('REFUSED: this is the set the values were tuned on; run on the test set.')
  const date = flag('date', today())

  const { index, shipped, catalogSha256, texts, vectors, scores } = await scoresFor(set.cases)
  await dispose()
  const lex = lexiconIndex()
  const methods = {
    'minilm-app': { label: `MiniLM, app values (minScore ${APP_VALUES.minScore}, window ${APP_VALUES.window})`, rank: i => filterScores(scores[i], APP_VALUES) },
    'minilm-tuned': { label: `MiniLM, dev-tuned values (minScore ${config.tuned.minScore}, window ${config.tuned.window}); reported only`, rank: i => filterScores(scores[i], config.tuned) },
    'minilm-top3': { label: 'MiniLM, top 3 with no cut-off (ranking only; never says "nothing")', rank: i => filterScores(scores[i], { minScore: -Infinity, window: Infinity }) },
    lexicon: { label: 'Lexicon baseline (words of the pathway title and skill labels)', rank: i => lexiconRank(set.cases[i].query, lex) },
  }
  // The harness ranking must be exactly the app's: same function on the same vectors.
  set.cases.forEach((c, i) => {
    const app = rankSemanticCandidates(vectors[i], index).map(r => r.id).join(',')
    const ours = methods['minilm-app'].rank(i).map(r => r.id).join(',')
    if (app !== ours) fail(`Harness and app ranking differ on ${c.id}: app ${app} vs harness ${ours}`)
  })

  const results = {}, rows = set.cases.map(c => ({ id: c.id, lang: c.lang, dialect: c.dialect, query: c.query, expected: c.expected.join(' ') }))
  for (const [name, m] of Object.entries(methods)) {
    const lists = set.cases.map((_, i) => m.rank(i))
    const outcomes = set.cases.map((c, i) => caseOutcome(c, lists[i]))
    results[name] = { label: m.label, summary: summarise(set.cases, outcomes) }
    lists.forEach((list, i) => {
      rows[i][name] = list.map(r => `${r.id}${name === 'lexicon' ? '' : `:${r.score.toFixed(3)}`}`).join(' ')
      rows[i][`${name}-ok`] = outcomes[i].kind === 'positive' ? (outcomes[i].hit3 ? (outcomes[i].hit1 ? 'hit@1' : 'hit@3') : 'miss') : (outcomes[i].nothingOk ? 'nothing-ok' : 'false-alarm')
    })
  }

  const report = {
    harness: HARNESS_VERSION, date, kaminCommit: commit(), provenance: PROVENANCE,
    set: { file: rel(file), sha256: fileSha256(file), frozen: Boolean(lock), cases: set.cases.length,
      perLanguage: { ar: set.cases.filter(c => c.lang === 'ar').length, en: set.cases.filter(c => c.lang === 'en').length },
      dialect: set.cases.filter(c => c.dialect).length, shouldFindNothing: set.cases.filter(c => !c.expected.length).length },
    devSet: { file: rel(devFile), sha256: config.tunedOnSha256, cases: config.cases },
    model: { id: EMBEDDING_MODEL.id, revision: EMBEDDING_MODEL.revision, sha256: EMBEDDING_MODEL.sha256, index: { texts, catalogSha256, comparedWithShippedIndex: shipped } },
    appValues: APP_VALUES, tunedValues: config.tuned, appValuesChanged: false, bootstrap: BOOTSTRAP,
    methods: results,
  }
  const outDir = path.join(HERE, 'results'), base = `${date}-${path.basename(file, '.json')}`
  mkdirSync(outDir, { recursive: true })
  writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(report, null, 2) + '\n')
  const columns = ['id', 'lang', 'dialect', 'query', 'expected', ...Object.keys(methods).flatMap(n => [n, `${n}-ok`])]
  writeFileSync(path.join(outDir, `${base}-cases.csv`), toCsvText([columns, ...rows.map(r => columns.map(c => r[c]))]).replace(/\r\n/g, '\n'))
  writeFileSync(path.join(outDir, `${base}.md`), markdown(report))
  for (const [name, r] of Object.entries(results)) {
    const s = r.summary
    console.log(`${name.padEnd(13)} ${['ar', 'en', 'all'].map(g => `${g}: hit@1 ${pct(s[g].metrics.hit1.value)} hit@3 ${pct(s[g].metrics.hit3.value)} MRR ${s[g].metrics.mrr.value} nothing ${pct(s[g].metrics.nothingCorrect.value)}`).join(' | ')}`)
  }
  console.log(`Wrote ${rel(path.join(outDir, base))}.{json,md} and -cases.csv`)
}

function markdown(r) {
  const groups = [['ar', 'Arabic'], ['en', 'English'], ['dialect', 'Saudi dialect (Arabic)'], ['all', 'All']]
  const lines = [
    `# Pathway search (MiniLM) on ${r.set.file}, ${r.date}`, '',
    `${r.provenance}.`, '',
    `- **Set:** ${r.set.cases} queries (${r.set.perLanguage.ar} Arabic, ${r.set.perLanguage.en} English; ${r.set.dialect} in Saudi dialect; ${r.set.shouldFindNothing} should find nothing). sha256 \`${r.set.sha256}\`${r.set.frozen ? ', frozen (testset.lock.json) before the first run' : ''}.`,
    `- **Dev set (tuning only):** ${r.devSet.file}, ${r.devSet.cases} queries, sha256 \`${r.devSet.sha256}\`.`,
    `- **Model:** \`${r.model.id}\` revision \`${r.model.revision.slice(0, 7)}\`, q8 ONNX sha256 \`${r.model.sha256.slice(0, 12)}…\`, loaded from the local pinned files. Index: ${r.model.index.texts} texts from \`src/semantic/catalog.js\`; compared with the index the build ships: **${r.model.index.comparedWithShippedIndex}**.`,
    `- **App values (not changed):** minScore ${r.appValues.minScore}, window ${r.appValues.window}, top ${r.appValues.limit}. The harness checks that its ranking equals \`rankSemanticCandidates\` on every query.`,
    `- **Dev-tuned values (reported only):** minScore ${r.tunedValues.minScore}, window ${r.tunedValues.window}.`,
    `- **Metrics:** for queries with an expected pathway, hit@1, hit@3 and mean reciprocal rank over the list the student sees (at most 3); for should-find-nothing queries, the share that show nothing. 95% bootstrap interval: ${r.bootstrap.draws} draws, seed ${r.bootstrap.seed}, cases resampled.`,
    `- Commit \`${r.kaminCommit}\`, harness \`${r.harness}\`.`, '',
  ]
  for (const [name, m] of Object.entries(r.methods)) {
    lines.push(`## ${m.label}`, '', '| Group | Queries (with a pathway / nothing) | hit@1 | hit@3 | MRR | Correct "nothing found" | Empty list on a query with a pathway |', '|---|---|---|---|---|---|---|')
    for (const [g, label] of groups) {
      const s = m.summary[g]
      lines.push(`| ${label} | ${s.cases} (${s.positives} / ${s.nothing}) | ${withCi(s.metrics.hit1)} | ${withCi(s.metrics.hit3)} | ${s.metrics.mrr.value == null ? '—' : `${s.metrics.mrr.value.toFixed(3)} (${s.metrics.mrr.ci[0].toFixed(3)}–${s.metrics.mrr.ci[1].toFixed(3)})`} | ${withCi(s.metrics.nothingCorrect)} | ${s.emptyOnPositive} |`)
    }
    lines.push('')
  }
  lines.push('Per-query lists and scores: the `-cases.csv` file next to this report.', '')
  return lines.join('\n')
}

const [command, file] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').startsWith('--'))
if (command === 'tune') await cmdTune(file && path.resolve(file))
else if (command === 'run') await cmdRun(file && path.resolve(file))
else fail('usage: eval.mjs tune [dev-set.json] | run [testset.json] [--date YYYY-MM-DD]')
