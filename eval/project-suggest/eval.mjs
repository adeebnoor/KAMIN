#!/usr/bin/env node
// Task 07 · evaluation harness (local only). Commands:
//   check  <set.json> [--v2]           validate structure (v2: human-written, two reviewers, agreement)
//   freeze <set.json>                  write <set>.lock.json with the sha256; the set may never be tuned on
//   tune   <dev-set.json> [more dev sets] [--method hybrid] [--fallback v1]  choose the embedding (or hybrid) threshold on development sets only
//          (Task 80: hybrid v2 = one threshold per variety, on dev-set.json + dev-set-workflow.json + dev-set-dialect.json)
//   run    <set.json> [--method lexicon|embedding|improved|hybrid|all]   (all = the first three)
//   compare <set.json> [more sets]    baseline vs MiniLM vs improved → results/<date>-comparison.md
//   hybrid <set.json> [more sets]     Task 43: improved vs hybrid with bootstrap 95% CIs → results/<date>-hybrid.md
//   workflow <set.json>... --label before|after   Task 77 report → results/<date>-workflow.md
//   dialect <set.json>... --label before|after    Task 80 report per variety → results/<date>-dialect.md
// Task 38 · the human test-set kit (see eval/project-suggest/v2-kit/GUIDE.md):
//   labels-sheet <cases.csv> <out.csv>  a blank labels sheet (ids + texts) for one reviewer
//   coverage <cases.csv | set.json>     live coverage: cases per language/category, cases per capability
//   import-v2 <cases.csv> <labelsA.csv> <labelsB.csv> --reviewer-a <role> --reviewer-b <role> [--set <file>] [--report <md>] [--replace]
//   resolve-v2 <resolved.csv> [--set <file>] [--report <md>]
// Task 38b · Claude-drafted cases, reviewed by two people (see eval/project-suggest/ai-drafts/README.md):
//   check-drafts                        mechanical checks of ai-drafts/drafts.json and Claude's proposed labels
//   ai-review-sheet <out.csv>           a blank review sheet (id + text only) for one reviewer
//   import-ai-review <reviewA.csv> <reviewB.csv> --reviewer-a <role> --reviewer-b <role> [--set <file>] [--report <md>]
//   unseal-proposed [set.json] [--out <dir>]  restore Claude's sealed labels and self-review (only after import-ai-review)
//   resolve-ai-review <resolved.csv> [--set <file>] [--report <md>]   (needs the unsealed proposed labels)
// Output of run: eval/project-suggest/results/<date>-<method>.{json,csv,md}
// No external APIs, no network calls: methods use the browser's own modules and the pinned
// local model files. See docs/EVALUATION_PROTOCOL.md.
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { AI_SET_VERSION, BOOTSTRAP, HARNESS_VERSION, aiReviewSheet, bootstrapInterval, withInterval, assertLockMatches, assertNotFrozen, casesFromCsv, checkDrafts, checkSet, checkSetAiReviewed, checkSetV2, coverageReport, disagreementsMarkdown, fileSha256, importAiReview, importV2, labelsSheet, loadSet, lockPathFor, readLock, resolveAiReview, resolveV2, score, sha256, toCsv, toMarkdown } from './lib.mjs'
import { embedding, fallback, hybrid, improved, lexicon, pickAbove, sentenceScores } from './methods.mjs'
import { EMBEDDING_THRESHOLD, FALLBACK_DEFAULT, HYBRID_FALLBACK_V1, HYBRID_FALLBACK_V2, VARIETIES as FALLBACK_VARIETIES, pickFallback } from '../../src/ai/hybridFallback.js'
import { detectVariety } from '../../src/ai/projectSuggestImproved.js'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const CONFIG = path.join(HERE, 'config.json')
const RESULTS = path.join(HERE, 'results')
const [command, file, ...rest] = process.argv.slice(2)
// Flags may also come first when a command has no file argument (e.g. unseal-proposed --set <file>).
const flag = (name, fallback) => { const args = [file, ...rest], i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] ?? true : fallback }
const today = () => flag('date', new Date().toISOString().slice(0, 10))
const config = () => existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, 'utf8')) : {}
const commit = () => { try { const head = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); const dirty = execSync('git status --porcelain -- src eval ":(exclude)eval/project-suggest/results"', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); return dirty ? `${head}-dirty` : head } catch { return 'unknown' } }
const fail = message => { console.error(message); process.exit(1) }

async function predictAll(method, cases) {
  const predictions = new Map()
  for (const c of cases) predictions.set(c.id, await method.predict(c.text))
  return predictions
}

let frozenLock = null
function methodFor(name) {
  if (name === 'lexicon') return lexicon
  if (name === 'embedding') {
    const c = config().embedding || {}
    if (frozenLock && c.tunedOnSha256 === frozenLock.sha256) throw new Error('REFUSED: the threshold was tuned on this test set itself.')
    return Object.assign(embedding({ threshold: c.threshold }), { tunedOn: c.tunedOn, tunedOnSha256: c.tunedOnSha256 }) }
  if (name === 'improved') return improved
  // Task 80: 'hybrid' is the app's fallback version (FALLBACK_DEFAULT); 'hybrid-v1' / 'hybrid-v2' name one.
  if (/^hybrid(-v[12])?$/.test(name)) {
    const version = name === 'hybrid' ? FALLBACK_DEFAULT : name.slice(-2)
    const c = (version === 'v2' ? config().hybridV2 : config().hybrid) || {}
    const shas = c.tunedOnSha256 && typeof c.tunedOnSha256 === 'object' ? Object.values(c.tunedOnSha256) : [c.tunedOnSha256]
    if (frozenLock && shas.includes(frozenLock.sha256)) throw new Error('REFUSED: the hybrid threshold was tuned on this test set itself.')
    return Object.assign(hybrid(version === 'v2' ? { thresholds: c.thresholds } : { threshold: c.threshold }), { tunedOn: c.tunedOn, tunedOnSha256: c.tunedOnSha256 }) }
  throw new Error(`Unknown method "${name}" (lexicon | embedding | improved | hybrid | all)`)
}

async function run() {
  if (!file) fail('usage: eval.mjs run <set.json> [--method lexicon|embedding|improved|all]')
  const lock = assertLockMatches(file)
  frozenLock = lock
  const { cases } = loadSet(file)
  const check = checkSet(cases)
  if (check.errors.length) fail(`Set has structural errors:\n- ${check.errors.join('\n- ')}`)
  const names = flag('method', 'lexicon') === 'all' ? ['lexicon', 'embedding', 'improved'] : [flag('method', 'lexicon')]
  mkdirSync(RESULTS, { recursive: true })
  for (const name of names) {
    const method = methodFor(name)
    const { metrics, rows } = score(cases, await predictAll(method, cases))
    const meta = { harness: HARNESS_VERSION, method: name, methodVersion: method.version, commit: commit(), set: path.basename(file), setSha256: fileSha256(file),
      frozen: !!lock, frozenAt: lock?.frozenAt || null, threshold: method.threshold ?? null, tunedOn: method.tunedOn || null, tunedOnSha256: method.tunedOnSha256 || null, date: today() }
    const result = { meta, metrics, rows }
    const base = path.join(RESULTS, `${meta.date}-${path.basename(file, '.json')}-${name}`)
    writeFileSync(`${base}.json`, JSON.stringify(result, null, 2) + '\n')
    writeFileSync(`${base}.csv`, toCsv(rows))
    writeFileSync(`${base}.md`, toMarkdown(result))
    const pct = v => v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`
    for (const lang of ['ar', 'en', 'all']) {
      const m = metrics[lang]
      console.log(`${name.padEnd(9)} ${lang.padEnd(3)} cases=${m.cases} precision=${pct(m.precision)} recall=${pct(m.recall)} f1=${pct(m.f1)} unsupported=${m.unsupported} correct-abstentions=${m.correctAbstentions}/${m.shouldAbstainCases} wrong-abstentions=${m.wrongAbstentions}`)
    }
    console.log(`→ ${path.relative('.', base)}.{json,csv,md}`)
  }
}

// compare <set.json>... : baseline vs MiniLM vs improved on each frozen set, one Markdown report.
async function compare() {
  const files = [file, ...rest.filter(a => a.endsWith('.json'))].filter(Boolean)
  if (!files.length) fail('usage: eval.mjs compare <set.json> [more sets]')
  const names = ['lexicon', 'embedding', 'improved']
  const pct = v => v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`
  const lines = ['# Capability-suggestion comparison: baseline vs MiniLM vs improved', '', `Generated by \`npm run eval:compare\` · harness \`${HARNESS_VERSION}\` · commit \`${commit()}\` · date ${today()}.`, 'Only numbers produced by this run are reported. Rule: a suggestion whose supporting text is not verbatim in the description is a false positive.', '']
  mkdirSync(RESULTS, { recursive: true })
  for (const setFile of files) {
    const lock = assertLockMatches(setFile)
    if (!lock) fail(`REFUSED: ${path.basename(setFile)} is not frozen; compare runs on frozen sets only.`)
    frozenLock = lock
    const set = loadSet(setFile)
    const results = {}
    for (const name of names) {
      const method = methodFor(name)
      results[name] = { method, ...score(set.cases, await predictAll(method, set.cases)) }
      const meta = { harness: HARNESS_VERSION, method: name, methodVersion: method.version, commit: commit(), set: path.basename(setFile), setSha256: fileSha256(setFile), frozen: true, frozenAt: lock.frozenAt, threshold: method.threshold ?? null, tunedOn: method.tunedOn || null, tunedOnSha256: method.tunedOnSha256 || null, date: today() }
      const base = path.join(RESULTS, `${meta.date}-${path.basename(setFile, '.json')}-${name}`)
      writeFileSync(`${base}.json`, JSON.stringify({ meta, metrics: results[name].metrics, rows: results[name].rows }, null, 2) + '\n')
      writeFileSync(`${base}.csv`, toCsv(results[name].rows))
    }
    lines.push(`## ${path.basename(setFile)}`, '', `${set.cases.length} cases · sha256 \`${lock.sha256}\` · frozen ${lock.frozenAt}${set.meta?.writtenBy ? ` · written by: **${set.meta.writtenBy}**` : ''}`)
    if (set.meta?.disclosure) lines.push('', `> ${set.meta.disclosure}`)
    if (/^testset\.json$/.test(path.basename(setFile))) lines.push('', '> v1 set: AI-written on 25 Oct and its errors have been seen; a baseline only, not a fair test of later improvements.')
    lines.push('', '| Method | Version | Language | Precision | Recall | F1 | Unsupported | Correct abstentions | Wrong abstentions | False-alarm cases |', '|---|---|---|---|---|---|---|---|---|---|')
    for (const name of names) for (const [lang, label] of [['ar', 'Arabic'], ['en', 'English'], ['all', 'All']]) {
      const m = results[name].metrics[lang]
      lines.push(`| ${name}${name === 'embedding' ? ` (${results[name].method.threshold})` : ''} | \`${results[name].method.version}\` | ${label} | ${pct(m.precision)} | ${pct(m.recall)} | ${pct(m.f1)} | ${m.unsupported} | ${m.correctAbstentions}/${m.shouldAbstainCases} | ${m.wrongAbstentions} | ${m.falseAlarmCases} |`)
    }
    const categories = [...new Set(set.cases.map(c => c.category || c.type).filter(Boolean))]
    if (categories.length) {
      lines.push('', 'Cases fully correct (no false positive, no miss), by category:', '', `| Category | Cases | ${names.join(' | ')} |`, `|---|---|${names.map(() => '---').join('|')}|`)
      for (const cat of categories) {
        const ids = new Set(set.cases.filter(c => (c.category || c.type) === cat).map(c => c.id))
        lines.push(`| ${cat} | ${ids.size} | ${names.map(n => results[n].rows.filter(r => ids.has(r.id) && !r.fp && !r.fn).length).join(' | ')} |`)
      }
    }
    lines.push('', 'Error examples (improved method):', '')
    const text = new Map(set.cases.map(c => [c.id, c.text]))
    const errors = results.improved.rows.filter(r => r.fp || r.fn)
    for (const r of errors.slice(0, 8)) {
      const got = r.predicted.map(p => p.skillId + (p.supported ? '' : ' (unsupported)'))
      lines.push(`- \`${r.id}\` “${text.get(r.id)}” — expected: ${r.expected.join(', ') || 'none'}; suggested: ${got.join(', ') || 'none'}`)
    }
    if (!errors.length) lines.push('- none')
    lines.push('')
  }
  lines.push('## How to read these numbers', '',
    '- **testset-ai-v2.json was written and labelled by the same AI that built the improved method** (frozen in its own commit before the method existed, single labeller, no human review). Expect its numbers for the improved method to be optimistic — compare the synonym rows of the two sets.',
    '- **testset.json (v1)** was AI-written on 25 Oct and its errors were seen before Task 08; it shows the baseline, not a fair test of later work.',
    '- **The official comparison requires the human-written, two-reviewer `testset-v2.json`** (docs/EVALUATION_PROTOCOL.md). Until it is frozen and measured, these results are preliminary.',
    '- The improved method is lexicon-only; the optional MiniLM rerank of weak-term sentences was not built. The app keeps the current lexicon engine by default (src/ai/suggestSettings.js) until the supervisor reviews this report.',
    '')
  const out = path.join(RESULTS, `${today()}-comparison.md`)
  writeFileSync(out, lines.join('\n'))
  console.log(lines.filter(l => l.startsWith('| ') && /(Arabic|English|All) \|/.test(l)).join('\n'))
  console.log(`→ ${path.relative('.', out)}`)
}

async function tune() {
  if (!file) fail('usage: eval.mjs tune <dev-set.json>')
  for (const f of [file, ...rest.filter(a => a.endsWith('.json'))]) {
    assertNotFrozen(f)
    if (/testset/i.test(path.basename(f))) fail('REFUSED: tuning is allowed on the development set only.')
  }
  if (flag('method', 'embedding') === 'hybrid') return flag('fallback', 'v2') === 'v1' ? tuneHybrid() : tuneHybridV2()
  const { cases } = loadSet(file)
  const scored = new Map()
  for (const c of cases) scored.set(c.id, await sentenceScores(c.text))
  let best = null
  for (let t = 20; t <= 80; t++) {
    const threshold = t / 100
    const { metrics } = score(cases, new Map(cases.map(c => [c.id, { suggestions: pickAbove(scored.get(c.id), threshold) }])))
    const macroF1 = (( metrics.ar.f1 ?? 0) + (metrics.en.f1 ?? 0)) / 2
    if (!best || macroF1 > best.macroF1) best = { threshold, macroF1 }
  }
  const next = { ...config(), embedding: { method: 'nazeh-embed-sentence-v1', threshold: best.threshold, tunedOn: path.basename(file), tunedOnSha256: fileSha256(file), objective: 'mean of per-language F1 (Arabic, English); first best threshold wins', sweep: '0.20–0.80 step 0.01', tunedAt: today(), devMacroF1: Number(best.macroF1.toFixed(4)) } }
  writeFileSync(CONFIG, JSON.stringify(next, null, 2) + '\n')
  console.log(`embedding threshold ${best.threshold} (dev mean F1 ${(best.macroF1 * 100).toFixed(1)}%) → ${path.relative('.', CONFIG)}`)
}

// Task 43 · the hybrid's threshold, on the development set only. Sweep 0.53–0.80 (always stricter than the
// embedding method's 0.52).
//  1. Objective: mean of per-language F1 of the whole hybrid (improved + fallback) on dev.
//  2. Ties in 1 (the improved engine's lexicon was built on dev, so it rarely abstains there and 1 is often
//     flat) are decided by the fallback ALONE, run on every dev case as if improved had abstained, top 1:
//     the LOWEST threshold at which it makes no false positive on dev (precision 100%). If none does, the
//     highest tied threshold. This rule was written before any number of the sweep was seen.
const HYBRID_SWEEP = { from: 53, to: 80 }
async function tuneHybrid() {
  const { cases } = loadSet(file)
  const first = new Map(), scored = new Map()
  for (const c of cases) {
    first.set(c.id, await improved.predict(c.text))
    scored.set(c.id, await fallback('v1').scores(c.text))
  }
  const abstained = new Set(cases.filter(c => !first.get(c.id).suggestions.length).map(c => c.id))
  const top1 = (id, threshold) => ({ suggestions: pickFallback(scored.get(id), threshold).map(s => ({ skillId: s.skillId, support: s.snippet })) })
  const sweep = []
  for (let t = HYBRID_SWEEP.from; t <= HYBRID_SWEEP.to; t++) {
    const threshold = t / 100
    if (!(threshold > EMBEDDING_THRESHOLD)) continue
    const { metrics } = score(cases, new Map(cases.map(c => [c.id, abstained.has(c.id) ? top1(c.id, threshold) : first.get(c.id)])))
    const alone = score(cases, new Map(cases.map(c => [c.id, top1(c.id, threshold)]))).metrics.all
    sweep.push({ threshold, macroF1: Number((((metrics.ar.f1 ?? 0) + (metrics.en.f1 ?? 0)) / 2).toFixed(4)), tp: metrics.all.tp, fp: metrics.all.fp, aloneTp: alone.tp, aloneFp: alone.fp })
  }
  const top = Math.max(...sweep.map(r => r.macroF1))
  const tied = sweep.filter(r => r.macroF1 === top)
  const best = tied.length === 1 ? tied[0] : tied.find(r => r.aloneFp === 0) || tied[tied.length - 1]
  const none = score(cases, first).metrics
  const next = { ...config(), hybrid: { method: HYBRID_FALLBACK_V1, threshold: best.threshold, max: 1, tunedOn: path.basename(file), tunedOnSha256: fileSha256(file),
    objective: 'mean of per-language F1 (Arabic, English) of improved + fallback; ties: the lowest threshold at which the fallback alone (top 1, every dev case) has no false positive on dev, else the highest tied',
    sweep: `${HYBRID_SWEEP.from / 100}–${HYBRID_SWEEP.to / 100} step 0.01 (always above the embedding threshold ${EMBEDDING_THRESHOLD})`,
    tunedAt: today(), devMacroF1: best.macroF1, devImprovedMacroF1: Number((((none.ar.f1 ?? 0) + (none.en.f1 ?? 0)) / 2).toFixed(4)), devTiedThresholds: tied.length,
    devFallbackAloneTp: best.aloneTp, devFallbackAloneFp: best.aloneFp, devCases: cases.length, devFallbackCases: abstained.size } }
  writeFileSync(CONFIG, JSON.stringify(next, null, 2) + '\n')
  for (const row of sweep) console.log(`  ${row.threshold.toFixed(2)} hybrid dev mean F1 ${(row.macroF1 * 100).toFixed(1)}% (tp ${row.tp}, fp ${row.fp}) · fallback alone tp ${row.aloneTp} fp ${row.aloneFp}`)
  console.log(`hybrid threshold ${best.threshold} (dev mean F1 ${(best.macroF1 * 100).toFixed(1)}%, improved alone ${(next.hybrid.devImprovedMacroF1 * 100).toFixed(1)}%; ${tied.length} thresholds tied; fallback alone at ${best.threshold}: tp ${best.aloneTp}, fp ${best.aloneFp}; fallback ran on ${abstained.size} of ${cases.length} dev cases) → ${path.relative('.', CONFIG)}`)
}

// Task 80 · hybrid v2: one threshold per variety (dialect, msa, en, mixed), on development sets only (the rule was
// written in the task file before any run). For each variety v, over the dev cases of v (a case's `variety`, else
// detectVariety): sweep 0.53–0.80; objective F1 of improved + fallback v2; ties: the lowest threshold at which the
// fallback ALONE (top 1, every dev case of v) makes no false positive, else the highest tied (Task 43's rule).
async function tuneHybridV2() {
  const files = [file, ...rest.filter(a => a.endsWith('.json'))]
  const cases = files.flatMap(f => loadSet(f).cases.map(c => ({ ...c, id: `${path.basename(f)}#${c.id}`, variety: c.variety || detectVariety(c.text) })))
  const first = new Map(), scored = new Map()
  for (const c of cases) { first.set(c.id, await improved.predict(c.text)); scored.set(c.id, await fallback('v2').scores(c.text)) }
  const top1 = (id, threshold) => ({ suggestions: pickFallback(scored.get(id), threshold).map(s => ({ skillId: s.skillId, support: s.snippet })) })
  const thresholds = {}, details = {}
  for (const v of FALLBACK_VARIETIES) {
    const mine = cases.filter(c => c.variety === v)
    const abstained = new Set(mine.filter(c => !first.get(c.id).suggestions.length).map(c => c.id))
    const sweep = []
    for (let t = HYBRID_SWEEP.from; t <= HYBRID_SWEEP.to; t++) {
      const threshold = t / 100
      if (!(threshold > EMBEDDING_THRESHOLD)) continue
      const all = score(mine, new Map(mine.map(c => [c.id, abstained.has(c.id) ? top1(c.id, threshold) : first.get(c.id)]))).metrics.all
      const alone = score(mine, new Map(mine.map(c => [c.id, top1(c.id, threshold)]))).metrics.all
      sweep.push({ threshold, f1: Number((all.f1 ?? 0).toFixed(4)), tp: all.tp, fp: all.fp, aloneTp: alone.tp, aloneFp: alone.fp })
    }
    const top = Math.max(...sweep.map(r => r.f1)), tied = sweep.filter(r => r.f1 === top)
    const best = tied.length === 1 ? tied[0] : tied.find(r => r.aloneFp === 0) || tied[tied.length - 1]
    thresholds[v] = best.threshold
    details[v] = { devCases: mine.length, fallbackCases: abstained.size, devF1: best.f1, tiedThresholds: tied.length, fallbackAloneTp: best.aloneTp, fallbackAloneFp: best.aloneFp }
    for (const r of sweep) console.log(`  ${v} ${r.threshold.toFixed(2)} F1 ${(r.f1 * 100).toFixed(1)}% (tp ${r.tp}, fp ${r.fp}) · fallback alone tp ${r.aloneTp} fp ${r.aloneFp}`)
    console.log(`${v}: threshold ${best.threshold} (dev F1 ${(best.f1 * 100).toFixed(1)}%, ${tied.length} tied; ${mine.length} dev cases, fallback ran on ${abstained.size}; fallback alone tp ${best.aloneTp} fp ${best.aloneFp})`)
  }
  const next = { ...config(), hybridV2: { method: HYBRID_FALLBACK_V2, thresholds, max: 1, tunedOn: files.map(f => path.basename(f)), tunedOnSha256: Object.fromEntries(files.map(f => [path.basename(f), fileSha256(f)])),
    objective: "per variety (a case's variety label, else detectVariety): F1 of improved + fallback v2 on the dev cases of that variety; ties: the lowest threshold at which the fallback alone (top 1, every dev case of that variety) has no false positive, else the highest tied",
    sweep: `${HYBRID_SWEEP.from / 100}–${HYBRID_SWEEP.to / 100} step 0.01 (always above the embedding threshold ${EMBEDDING_THRESHOLD})`, tunedAt: today(), byVariety: details } }
  writeFileSync(CONFIG, JSON.stringify(next, null, 2) + '\n')
  console.log(`hybrid v2 thresholds ${JSON.stringify(thresholds)} → ${path.relative('.', CONFIG)}`)
}

// Task 43 · hybrid <set.json>... : improved vs hybrid on each frozen set, with bootstrap 95% intervals, the
// true and false positives the fallback added, every fallback suggestion, and the ship rule. A set with 0 cases
// (testset-v2.json today) is listed as not measurable. Writes results/<date>-hybrid.md and, per set,
// results/<date>-hybrid/<set>-hybrid.{json,csv}.
async function hybridReport() {
  const files = [file, ...rest.filter(a => a.endsWith('.json'))].filter(Boolean)
  if (!files.length) fail('usage: eval.mjs hybrid <set.json> [more sets] [--date YYYY-MM-DD]')
  const c = config().hybrid
  if (!c) fail('No hybrid threshold yet: run "eval.mjs tune eval/project-suggest/dev-set.json --method hybrid" first.')
  const pct = v => v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`
  const lines = ['# MiniLM fallback only when the improved engine abstains (hybrid, Task 43)', '',
    `Generated by \`npm run eval:hybrid\` · harness \`${HARNESS_VERSION}\` · commit \`${commit()}\` · date ${today()}.`,
    `Hybrid = \`improved\`; only when it abstains, MiniLM sentence-vs-capability (\`${HYBRID_FALLBACK_V1}\`, the embedding method's prototypes) at **${c.threshold}** (embedding method: ${EMBEDDING_THRESHOLD}), at most ${c.max} suggestion, quoting the student's sentence verbatim.`,
    `Threshold tuned on \`${c.tunedOn}\` only (sha256 \`${c.tunedOnSha256}\`, ${c.devCases} cases, fallback ran on ${c.devFallbackCases}); objective: ${c.objective}; sweep ${c.sweep}; dev mean F1 ${pct(c.devMacroF1)} (improved alone ${pct(c.devImprovedMacroF1)}).`,
    `Uncertainty: bootstrap over cases, ${BOOTSTRAP.draws} draws, seed ${BOOTSTRAP.seed}, ${BOOTSTRAP.level * 100}% percentile interval; improved and hybrid are resampled with the same draws.`,
    'Rule: a suggestion whose supporting text is not verbatim in the description is a false positive.', '']
  mkdirSync(RESULTS, { recursive: true })
  const verdicts = []
  for (const setFile of files) {
    const set = loadSet(setFile), name = path.basename(setFile)
    const lock = assertLockMatches(setFile)
    if (!set.cases.length) { lines.push(`## ${name}`, '', `**0 cases: not measurable.**${set.meta?.writtenBy ? ` Written by: ${set.meta.writtenBy}.` : ''} Not frozen. The ship rule is judged on this set, so no ship decision can be made yet.`, ''); verdicts.push({ name, measurable: false }); continue }
    if (!lock) fail(`REFUSED: ${name} is not frozen; the hybrid report runs on frozen sets only.`)
    frozenLock = lock
    const method = methodFor('hybrid-v1')
    const base = score(set.cases, await predictAll(improved, set.cases))
    const predictions = await predictAll(method, set.cases)
    const hyb = score(set.cases, predictions)
    const meta = { harness: HARNESS_VERSION, method: 'hybrid', methodVersion: method.version, commit: commit(), set: name, setSha256: fileSha256(setFile), frozen: true, frozenAt: lock.frozenAt, threshold: method.threshold, tunedOn: method.tunedOn, tunedOnSha256: method.tunedOnSha256, date: today() }
    // In a folder of its own: the tests page reads results/*.json as the app's Task 07 runs, and hybrid is not in the app.
    mkdirSync(path.join(RESULTS, `${meta.date}-hybrid`), { recursive: true })
    const out = path.join(RESULTS, `${meta.date}-hybrid`, `${path.basename(setFile, '.json')}-hybrid`)
    writeFileSync(`${out}.json`, JSON.stringify({ meta, metrics: hyb.metrics, rows: hyb.rows }, null, 2) + '\n')
    writeFileSync(`${out}.csv`, toCsv(hyb.rows))
    lines.push(`## ${name}`, '', `${set.cases.length} cases · sha256 \`${lock.sha256}\` · frozen ${lock.frozenAt}${set.meta?.writtenBy ? ` · written by: **${set.meta.writtenBy}**` : ''}`)
    if (name === 'testset.json') lines.push('', '> v1 set: AI-written on 25 Oct and its errors have been seen; context only.')
    if (name === 'testset-ai-v2.json') lines.push('', '> ai-v2: written and labelled by the AI that built the improved method; preliminary, context only.')
    lines.push('', '| Method | Language | Precision | Recall | F1 | Unsupported | Wrong abstentions | False-alarm cases |', '|---|---|---|---|---|---|---|---|')
    const ci = {}
    for (const [label, result] of [['improved', base], ['hybrid', hyb]]) for (const [lang, langLabel] of [['ar', 'Arabic'], ['en', 'English'], ['all', 'All']]) {
      const b = bootstrapInterval(result.rows, { lang }), m = result.metrics[lang]
      ci[`${label}-${lang}`] = b
      lines.push(`| ${label}${label === 'hybrid' ? ` (${method.threshold})` : ''} | ${langLabel} | ${withInterval(b.precision)} | ${withInterval(b.recall)} | ${withInterval(b.f1)} | ${m.unsupported} | ${m.wrongAbstentions} | ${m.falseAlarmCases} |`)
    }
    // What the fallback added: it runs only where improved abstained, so every fallback suggestion is new.
    const text = new Map(set.cases.map(x => [x.id, x.text]))
    const fired = set.cases.filter(x => predictions.get(x.id).suggestions.some(s => s.fallback))
    const ran = set.cases.filter(x => !base.rows.find(r => r.id === x.id).predicted.length)
    lines.push('', 'What the fallback added (it runs only where `improved` abstained):', '', '| Language | Improved abstained | Fallback suggested | Added true positives | Added false positives | Should-abstain cases it broke |', '|---|---|---|---|---|---|')
    for (const [lang, langLabel] of [['ar', 'Arabic'], ['en', 'English'], ['all', 'All']]) {
      const inLang = list => list.filter(x => lang === 'all' || x.lang === lang)
      const rows = inLang(fired).map(x => hyb.rows.find(r => r.id === x.id))
      lines.push(`| ${langLabel} | ${inLang(ran).length} | ${rows.length} | ${rows.reduce((s, r) => s + r.tp, 0)} | ${rows.reduce((s, r) => s + r.fp, 0)} | ${rows.filter(r => r.falseAlarm).length} |`)
    }
    // Why the fallback did or did not fire: its best score on each case where it ran (no student sees a score).
    const peaks = []
    for (const x of ran) { const [skillId, r] = [...(await fallback('v1').scores(x.text))].sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]))[0] || []; if (skillId) peaks.push({ x, skillId, score: r.score }) }
    const peakOf = list => list.length ? list.reduce((a, b) => (b.score > a.score ? b : a)) : null
    const shouldFind = peaks.filter(p => p.x.expected?.length), shouldNot = peaks.filter(p => !p.x.expected?.length)
    const fmt = p => p ? `${p.score.toFixed(3)} (\`${p.x.id}\`, ${p.skillId})` : 'n/a'
    lines.push('', `Highest MiniLM score where \`improved\` abstained (threshold ${method.threshold}): cases with an expected capability ${fmt(peakOf(shouldFind))}; should-abstain cases ${fmt(peakOf(shouldNot))}. The top-ranked capability was an expected one in ${shouldFind.filter(p => p.x.expected.includes(p.skillId)).length} of ${shouldFind.length} cases with an expected capability.`)
    lines.push('', 'Every fallback suggestion:', '')
    for (const x of fired) {
      const r = hyb.rows.find(row => row.id === x.id), s = predictions.get(x.id).suggestions[0]
      lines.push(`- \`${x.id}\` (${x.lang}) → **${s.skillId}** ${r.tp ? '✓ correct' : '✗ wrong'} · expected: ${r.expected.join(', ') || 'none'} · sentence: “${s.support}”`)
    }
    if (!fired.length) lines.push('- none')
    const recallRule = ci['hybrid-all'].recall.low != null && base.metrics.all.recall != null && ci['hybrid-all'].recall.low > base.metrics.all.recall
    const precisionRule = hyb.metrics.all.precision != null && ci['improved-all'].precision.low != null && hyb.metrics.all.precision >= ci['improved-all'].precision.low
    lines.push('', `Ship rule on this set (context only; the rule is judged on v2): hybrid recall CI lower bound ${pct(ci['hybrid-all'].recall.low)} ${recallRule ? '>' : '≤'} improved recall ${pct(base.metrics.all.recall)} → **${recallRule ? 'met' : 'not met'}**; hybrid precision ${pct(hyb.metrics.all.precision)} ${precisionRule ? '≥' : '<'} improved precision CI lower bound ${pct(ci['improved-all'].precision.low)} → **${precisionRule ? 'met' : 'not met'}**.`, '')
    verdicts.push({ name, measurable: true, recallRule, precisionRule })
    console.log(`${name}: improved P ${pct(base.metrics.all.precision)} R ${pct(base.metrics.all.recall)} · hybrid P ${pct(hyb.metrics.all.precision)} R ${pct(hyb.metrics.all.recall)} (R CI low ${pct(ci['hybrid-all'].recall.low)}) · fallback fired ${fired.length}/${ran.length} · added TP ${fired.reduce((s, x) => s + hyb.rows.find(r => r.id === x.id).tp, 0)} FP ${fired.reduce((s, x) => s + hyb.rows.find(r => r.id === x.id).fp, 0)}`)
  }
  const v2 = verdicts.find(v => v.name === 'testset-v2.json')
  const shipped = v2?.measurable && v2.recallRule && v2.precisionRule
  lines.push('## Ship decision', '',
    '- **Rule (Task 43):** ship only if, on `testset-v2.json` (human-written, two reviewers), hybrid recall\'s CI lower bound is above improved\'s recall and hybrid precision does not fall below improved\'s precision CI lower bound.',
    `- **Result:** ${!v2 ? 'testset-v2.json was not in this run: no decision.' : !v2.measurable ? 'testset-v2.json has 0 cases: **not decided**.' : shipped ? '**rule met on v2**; shipping still needs the supervisor\'s approval.' : '**rule not met on v2: do not ship.**'} The app keeps \`PROJECT_SUGGEST_METHOD = 'improved'\` (src/ai/suggestSettings.js); \`hybrid\` is opt-in for reviewers and needs the supervisor\'s approval to become the default.`,
    '- v1 and ai-v2 are AI-written and preliminary; they are context, never the decision.', '')
  const report = path.join(RESULTS, `${today()}-hybrid.md`)
  writeFileSync(report, lines.join('\n'))
  console.log(`→ ${path.relative('.', report)}`)
}

// Task 77 · workflow <set.json>... --label before|after: the improved engine on each set, saved per label in
// results/<date>-workflow/ (a folder of its own: the tests page reads results/*.json as the app's Task 07 runs).
// When both labels exist for every set, writes results/<date>-workflow.md: before vs after with Task 43's
// bootstrap (same draws for both, so the intervals are paired). Frozen sets must match their lock; a set
// without a lock is reported as a development set (tuned on). For v1 and ai-v2 the report lists case ids only.
// The engine is src/: "as committed at <head>" when src/ has no local change, else "<head> plus local changes".
const engineState = () => { try { const head = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); const dirty = execSync('git status --porcelain -- src', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); return dirty ? `\`${head}\` plus local changes` : `as committed at \`${head}\`` } catch { return 'unknown' } }
const WORKFLOW_SEEN = { 'testset.json': 'v1: AI-written on 25 Oct, errors seen before Task 08 and in Task 43; context only, never tuned on.', 'testset-ai-v2.json': 'ai-v2: written by the AI that built the improved method, seen in Task 43; context only, never tuned on.' }
async function workflowReport() {
  const files = [file, ...rest.filter(a => a.endsWith('.json'))].filter(Boolean)
  const label = flag('label')
  if (!files.length || !['before', 'after'].includes(label)) fail('usage: eval.mjs workflow <set.json> [more sets] --label before|after [--date YYYY-MM-DD]')
  const dir = path.join(RESULTS, `${today()}-workflow`)
  mkdirSync(dir, { recursive: true })
  for (const setFile of files) {
    const set = loadSet(setFile), lock = assertLockMatches(setFile)
    const { metrics, rows } = score(set.cases, await predictAll(improved, set.cases))
    const meta = { harness: HARNESS_VERSION, method: 'improved', methodVersion: improved.version, label, commit: commit(), engine: engineState(), set: path.basename(setFile), setSha256: fileSha256(setFile), frozen: !!lock, frozenAt: lock?.frozenAt || null, date: today() }
    writeFileSync(path.join(dir, `${label}-${path.basename(setFile, '.json')}.json`), JSON.stringify({ meta, metrics, rows }, null, 2) + '\n')
    const pct = v => v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`
    console.log(`${label} ${meta.set}: P ${pct(metrics.all.precision)} R ${pct(metrics.all.recall)} F1 ${pct(metrics.all.f1)} unsupported ${metrics.all.unsupported}`)
  }
  const saved = name => { const f = path.join(dir, `${name}.json`); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null }
  const pairs = files.map(f => ({ setFile: f, before: saved(`before-${path.basename(f, '.json')}`), after: saved(`after-${path.basename(f, '.json')}`) }))
  if (pairs.some(p => !p.before || !p.after)) { console.log('report waits for both labels (before, after) on every set'); return }
  const lines = ['# Plain descriptions of what a system does: before and after (Task 77)', '',
    `Generated by \`npm run eval:workflow\` · harness \`${HARNESS_VERSION}\` · date ${today()} · method \`improved\` (the app's engine).`,
    `Before: \`${pairs[0].before.meta.methodVersion}\`, engine (src/) ${pairs[0].before.meta.engine}. After: \`${pairs[0].after.meta.methodVersion}\`, engine (src/) ${pairs[0].after.meta.engine}.`,
    `Uncertainty: Task 43's bootstrap over cases, ${BOOTSTRAP.draws} draws, seed ${BOOTSTRAP.seed}, ${BOOTSTRAP.level * 100}% percentile interval; before and after are resampled with the same draws.`,
    'Rule: a suggestion whose supporting text is not verbatim in the description is unsupported and counts as a false positive.', '']
  for (const { setFile, before, after } of pairs) {
    const set = loadSet(setFile), name = path.basename(setFile)
    if (before.meta.setSha256 !== after.meta.setSha256) fail(`REFUSED: ${name} changed between the before and after runs.`)
    lines.push(`## ${name}`, '', `${set.cases.length} cases · sha256 \`${after.meta.setSha256}\` · ${after.meta.frozen ? `frozen ${after.meta.frozenAt}` : '**development set: the rules were tuned on it**'}${set.meta?.writtenBy ? ` · written by: **${set.meta.writtenBy}**` : ''}`)
    if (set.meta?.provenance) lines.push('', `> ${set.meta.provenance}.`)
    if (WORKFLOW_SEEN[name]) lines.push('', `> ${WORKFLOW_SEEN[name]}`)
    lines.push('', '| Engine | Language | Precision | Recall | F1 | TP | FP | FN | Unsupported | Correct abstentions | False-alarm cases |', '|---|---|---|---|---|---|---|---|---|---|---|')
    for (const [tag, result] of [['before', before], ['after', after]]) for (const [lang, langLabel] of [['ar', 'Arabic'], ['en', 'English'], ['all', 'All']]) {
      const b = bootstrapInterval(result.rows, { lang }), m = result.metrics[lang]
      lines.push(`| ${tag} | ${langLabel} | ${withInterval(b.precision)} | ${withInterval(b.recall)} | ${withInterval(b.f1)} | ${m.tp} | ${m.fp} | ${m.fn} | ${m.unsupported} | ${m.correctAbstentions}/${m.shouldAbstainCases} | ${m.falseAlarmCases} |`)
    }
    const text = new Map(set.cases.map(c => [c.id, c.text]))
    const ids = r => r.predicted.map(p => p.skillId + (p.supported ? '' : ' (unsupported)'))
    const changed = after.rows.filter(r => { const was = before.rows.find(x => x.id === r.id); return ids(was).sort().join() !== ids(r).sort().join() })
    lines.push('', 'Cases whose suggestions changed:', '')
    for (const r of changed) {
      const was = ids(before.rows.find(x => x.id === r.id))
      const added = ids(r).filter(x => !was.includes(x)), removed = was.filter(x => !ids(r).includes(x))
      lines.push(`- \`${r.id}\` (${r.lang})${added.length ? ` added ${added.map(a => `**${a}**${r.expected.includes(a) ? ' ✓' : ' ✗'}`).join(', ')}` : ''}${removed.length ? ` removed ${removed.join(', ')}` : ''} · expected: ${r.expected.join(', ') || 'none'}${WORKFLOW_SEEN[name] ? '' : ` · “${text.get(r.id)}”`}`)
    }
    if (!changed.length) lines.push('- none')
    const misses = after.rows.filter(r => r.fp || r.fn)
    lines.push('', 'Remaining errors after:', '')
    for (const r of misses) lines.push(`- \`${r.id}\` (${r.lang}) suggested: ${ids(r).join(', ') || 'none'} · expected: ${r.expected.join(', ') || 'none'}`)
    if (!misses.length) lines.push('- none')
    lines.push('')
  }
  const report = path.join(RESULTS, `${today()}-workflow.md`)
  writeFileSync(report, lines.join('\n'))
  console.log(`→ ${path.relative('.', report)}`)
}

// Task 80 · dialect <set.json>... --label before|after: the app's engine (`improved`) and the chosen combination
// (`hybrid` = improved + the MiniLM fallback where it abstains) on each set, saved per label in
// results/<date>-dialect/. When both labels exist for every set, writes results/<date>-dialect.md: before vs after
// per variety (dialect / MSA / English / mixed, from each case's `variety`; sets without it: Arabic / English),
// with Task 43's bootstrap (same seed and draws for before and after, so the intervals are paired). Frozen sets
// must match their lock. Sets seen before (v1, ai-v2, Task 77's workflow set) are listed by case id only.
const VARIETIES = Object.freeze([['dialect', 'Saudi dialect'], ['msa', 'Standard Arabic'], ['en', 'English'], ['mixed', 'Mixed Arabic-English']])
const DIALECT_SEEN = { ...WORKFLOW_SEEN, 'testset-workflow.json': 'Task 77 workflow set: frozen 2026-11-21, its errors listed in Task 77; context only, never tuned on.' }
const groupsOf = cases => cases.some(c => c.variety) ? [...VARIETIES, ['all', 'All']] : [['ar', 'Arabic'], ['en', 'English'], ['all', 'All']]
const groupRows = (rows, cases, group) => {
  const variety = new Map(cases.map(c => [c.id, c.variety]))
  return rows.filter(r => group === 'all' || r.lang === group && !variety.get(r.id) || variety.get(r.id) === group).map(r => ({ ...r, lang: 'x' }))
}
const sumRows = rows => rows.reduce((s, r) => ({ tp: s.tp + r.tp, fp: s.fp + r.fp, fn: s.fn + r.fn, unsupported: s.unsupported + r.unsupported, cases: s.cases + 1, falseAlarmCases: s.falseAlarmCases + (r.falseAlarm ? 1 : 0), shouldAbstainCases: s.shouldAbstainCases + (r.expected.length ? 0 : 1), correctAbstentions: s.correctAbstentions + (r.correctAbstention ? 1 : 0) }), { tp: 0, fp: 0, fn: 0, unsupported: 0, cases: 0, falseAlarmCases: 0, shouldAbstainCases: 0, correctAbstentions: 0 })
async function dialectReport() {
  const files = [file, ...rest.filter(a => a.endsWith('.json'))].filter(Boolean)
  const label = flag('label')
  if (!files.length || !['before', 'after'].includes(label)) fail('usage: eval.mjs dialect <set.json> [more sets] --label before|after [--date YYYY-MM-DD]')
  const dir = path.join(RESULTS, `${today()}-dialect`)
  mkdirSync(dir, { recursive: true })
  const pct = v => v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`
  for (const setFile of files) {
    const set = loadSet(setFile), lock = assertLockMatches(setFile)
    frozenLock = lock
    for (const [setup, method] of [['engine', improved], ['combination', methodFor('hybrid')]]) {
      const predictions = await predictAll(method, set.cases)
      const { metrics, rows } = score(set.cases, predictions)
      for (const r of rows) { const s = predictions.get(r.id).suggestions; r.support = Object.fromEntries(s.map(x => [x.skillId, x.support])); r.fallback = s.filter(x => x.fallback).map(x => x.skillId) }
      const meta = { harness: HARNESS_VERSION, setup, method: method.name, methodVersion: method.version, thresholds: method.thresholds ?? method.threshold ?? null, label, commit: commit(), engine: engineState(), set: path.basename(setFile), setSha256: fileSha256(setFile), frozen: !!lock, frozenAt: lock?.frozenAt || null, date: today() }
      writeFileSync(path.join(dir, `${label}-${path.basename(setFile, '.json')}-${setup}.json`), JSON.stringify({ meta, metrics, rows }, null, 2) + '\n')
      console.log(`${label} ${setup} ${meta.set}: P ${pct(metrics.all.precision)} R ${pct(metrics.all.recall)} F1 ${pct(metrics.all.f1)} unsupported ${metrics.all.unsupported}`)
    }
  }
  frozenLock = null
  const saved = name => { const f = path.join(dir, `${name}.json`); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null }
  const runs = files.map(f => { const base = path.basename(f, '.json'); return { setFile: f, ...Object.fromEntries(['before', 'after'].flatMap(l => ['engine', 'combination'].map(s => [`${l}-${s}`, saved(`${l}-${base}-${s}`)]))) } })
  if (runs.some(r => ['before-engine', 'before-combination', 'after-engine', 'after-combination'].some(k => !r[k]))) { console.log('report waits for both labels (before, after) on every set'); return }
  const first = runs[0]
  const lines = ['# Saudi dialect, standard Arabic, English and mixed sentences: before and after (Task 80)', '',
    `Generated by \`npm run eval:dialect\` · harness \`${HARNESS_VERSION}\` · date ${today()}.`,
    `- **Engine** = what every student gets from "Suggest skills" (\`improved\`). Before: \`${first['before-engine'].meta.methodVersion}\`, src/ ${first['before-engine'].meta.engine}. After: \`${first['after-engine'].meta.methodVersion}\`, src/ ${first['after-engine'].meta.engine}.`,
    `- **Combination** = the engine, and only where it abstains the MiniLM fallback ("Look deeper", \`hybrid\`), counted as if the student pressed it. Before: \`${first['before-combination'].meta.methodVersion}\` at ${JSON.stringify(first['before-combination'].meta.thresholds)}. After: \`${first['after-combination'].meta.methodVersion}\` at ${JSON.stringify(first['after-combination'].meta.thresholds)}.`,
    `- Uncertainty: Task 43's bootstrap over cases, ${BOOTSTRAP.draws} draws, seed ${BOOTSTRAP.seed}, ${BOOTSTRAP.level * 100}% percentile interval, per variety; before and after are resampled with the same draws.`,
    '- Rule: a suggestion whose supporting text is not verbatim in the description is unsupported and counts as a false positive.', '']
  const decision = {}
  for (const run of runs) {
    const set = loadSet(run.setFile), name = path.basename(run.setFile), after = run['after-engine']
    for (const k of ['before-engine', 'before-combination', 'after-combination']) if (run[k].meta.setSha256 !== after.meta.setSha256) fail(`REFUSED: ${name} changed between runs.`)
    lines.push(`## ${name}`, '', `${set.cases.length} cases · sha256 \`${after.meta.setSha256}\` · ${after.meta.frozen ? `frozen ${after.meta.frozenAt}, never tuned on` : '**development set: tuned on**'}${set.meta?.provenance ? ` · ${set.meta.provenance}` : ''}`)
    if (DIALECT_SEEN[name]) lines.push('', `> ${DIALECT_SEEN[name]}`)
    lines.push('', '| Setup | Variety | Cases | Precision | Recall | F1 | TP | FP | FN | Unsupported | False-alarm cases |', '|---|---|---|---|---|---|---|---|---|---|---|')
    for (const setup of ['engine', 'combination']) for (const [group, groupLabel] of groupsOf(set.cases)) for (const tag of ['before', 'after']) {
      const rows = groupRows(run[`${tag}-${setup}`].rows, set.cases, group)
      if (!rows.length) continue
      const b = bootstrapInterval(rows, { lang: 'x' }), m = sumRows(rows)
      if (name === 'testset-dialect.json') (decision[setup] ??= {})[`${tag}-${group}`] = { f1: b.f1.value, unsupported: m.unsupported }
      lines.push(`| ${setup} ${tag} | ${groupLabel} | ${m.cases} | ${withInterval(b.precision)} | ${withInterval(b.recall)} | ${withInterval(b.f1)} | ${m.tp} | ${m.fp} | ${m.fn} | ${m.unsupported} | ${m.falseAlarmCases} |`)
    }
    const text = new Map(set.cases.map(c => [c.id, c.text]))
    for (const setup of ['engine', 'combination']) {
      const ids = r => r.predicted.map(p => p.skillId + (p.supported ? '' : ' (unsupported)'))
      const before = run[`before-${setup}`], now = run[`after-${setup}`]
      const changed = now.rows.filter(r => ids(before.rows.find(x => x.id === r.id)).sort().join() !== ids(r).sort().join())
      lines.push('', `Cases whose ${setup} suggestions changed:`, '')
      for (const r of changed) {
        const was = ids(before.rows.find(x => x.id === r.id)), is = ids(r)
        const added = is.filter(x => !was.includes(x)), removed = was.filter(x => !is.includes(x))
        lines.push(`- \`${r.id}\` (${set.cases.find(c => c.id === r.id).variety || r.lang})${added.length ? ` added ${added.map(a => `**${a}**${r.expected.includes(a) ? ' ✓' : ' ✗'}`).join(', ')}` : ''}${removed.length ? ` removed ${removed.join(', ')}` : ''} · expected: ${r.expected.join(', ') || 'none'}${DIALECT_SEEN[name] ? '' : ` · “${text.get(r.id)}”`}`)
      }
      if (!changed.length) lines.push('- none')
    }
    const misses = run['after-engine'].rows.filter(r => r.fp || r.fn)
    lines.push('', 'Remaining engine errors after:', '')
    for (const r of misses) lines.push(`- \`${r.id}\` (${set.cases.find(c => c.id === r.id).variety || r.lang}) suggested: ${r.predicted.map(p => p.skillId).join(', ') || 'none'} · expected: ${r.expected.join(', ') || 'none'}`)
    if (!misses.length) lines.push('- none')
    lines.push('')
  }
  if (decision.engine) {
    const rule = (d, from, to) => {
      const groups = [...VARIETIES.map(([g]) => g), 'all']
      const up = d[`${to}-dialect`].f1 > d[`${from}-dialect`].f1
      const drops = groups.filter(g => d[`${to}-${g}`] && d[`${from}-${g}`] && (d[`${to}-${g}`].f1 ?? 0) < (d[`${from}-${g}`].f1 ?? 0))
      const unsupported = groups.reduce((s, g) => s + (g === 'all' ? 0 : d[`${to}-${g}`]?.unsupported ?? 0), 0)
      return { met: up && !drops.length && unsupported === 0, up, drops, unsupported }
    }
    const e = rule(decision.engine, 'before', 'after')
    const mixed = { ...Object.fromEntries(Object.entries(decision.engine).filter(([k]) => k.startsWith('after-')).map(([k, v]) => [k.replace('after-', 'engine-'), v])), ...Object.fromEntries(Object.entries(decision.combination).filter(([k]) => k.startsWith('after-')).map(([k, v]) => [k.replace('after-', 'hybrid-'), v])) }
    const h = rule(mixed, 'engine', 'hybrid')
    const fb = rule(decision.combination, 'before', 'after')
    const say = r => `dialect F1 ${r.up ? 'up' : 'not up'}; varieties that drop: ${r.drops.join(', ') || 'none'}; unsupported ${r.unsupported}`
    lines.push('## Default decision (Task 80 rule 7, judged on testset-dialect.json only)', '',
      `- **Engine v3 vs v2:** ${say(e)} → **${e.met ? 'met: v3 becomes the default engine' : 'not met: v2 stays the default; v3 behind ?suggest=dialect'}**.`,
      `- **"Look deeper" by default (combination after vs engine after):** ${say(h)} → **${h.met ? 'met' : 'not met: hybrid stays behind ?suggest=hybrid'}**.`,
      `- **Fallback v2 vs v1 behind the switch (combination after vs before):** varieties that drop: ${fb.drops.join(', ') || 'none'}; unsupported ${fb.unsupported} → **${!fb.drops.length && fb.unsupported === 0 ? 'v2 replaces v1 behind ?suggest=hybrid' : 'v1 stays'}**.`, '')
  }
  const report = path.join(RESULTS, `${today()}-dialect.md`)
  writeFileSync(report, lines.join('\n'))
  console.log(`→ ${path.relative('.', report)}`)
}

function freeze() {
  if (!file) fail('usage: eval.mjs freeze <set.json>')
  if (readLock(file)) fail(`${path.basename(file)} is already frozen; a frozen set is never edited or re-frozen.`)
  const set = loadSet(file)
  const check = set.meta?.version === AI_SET_VERSION ? checkSetAiReviewed(set, { otherTexts: otherTexts(file), ...draftsFor(set.meta) })
    : rest.includes('--v2') || set.meta?.version === 'testset-v2' ? checkSetV2(set, { otherTexts: otherTexts(file) }) : checkSet(set.cases)
  if (check.errors.length) fail(`Cannot freeze: fix these first:\n- ${check.errors.join('\n- ')}`)
  const lock = { file: path.basename(file), sha256: fileSha256(file), frozenAt: today(), cases: set.cases.length, byLanguage: check.counts, harness: HARNESS_VERSION }
  writeFileSync(lockPathFor(file), JSON.stringify(lock, null, 2) + '\n')
  console.log(`frozen ${lock.file} sha256 ${lock.sha256} → ${path.relative('.', lockPathFor(file))}`)
}

// Texts a set must not copy, read from the harness folder (where the sets live) whichever file is
// checked. The human v2 set must not copy the dev, v1 or ai-v2 sets (Task 38) or a Claude draft (38b);
// the reviewed AI set and the drafts must not copy those sets or the human v2 set.
const OTHER_SETS = ['dev-set.json', 'testset.json', 'testset-ai-v2.json', 'dev-set-workflow.json', 'testset-workflow.json', 'dev-set-dialect.json', 'testset-dialect.json']  // Task 77 adds the workflow sets, Task 80 the dialect sets
const DRAFTS = 'ai-drafts/drafts.json'
const PROPOSED = 'ai-drafts/sealed/proposed-labels.json'  // restored by unseal-proposed; git-ignored
const othersFor = file => {
  const name = path.basename(file || '')
  if (name === 'testset-v2.json' || loadSafe(file)?.meta?.version === 'testset-v2') return [...OTHER_SETS, DRAFTS]
  return [...OTHER_SETS, 'testset-v2.json']
}
const loadSafe = f => { try { return f && existsSync(f) ? loadSet(f) : null } catch { return null } }
function otherTexts(file) {
  const out = []
  for (const name of othersFor(file)) {
    const other = path.join(HERE, name)
    if (existsSync(other) && path.resolve(other) !== path.resolve(file || '')) out.push(...loadSet(other).cases.map(c => ({ set: name, id: c.id, text: c.text })))
  }
  return out
}

function check() {
  if (!file) fail('usage: eval.mjs check <set.json> [--v2]')
  if (!existsSync(file)) fail(`${file} does not exist yet.`)
  const set = loadSet(file)
  const v2 = rest.includes('--v2') || set.meta?.version === 'testset-v2'
  const ai = set.meta?.version === AI_SET_VERSION
  const result = ai ? checkSetAiReviewed(set, { otherTexts: otherTexts(file), ...draftsFor(set.meta) }) : v2 ? checkSetV2(set, { otherTexts: otherTexts(file) }) : checkSet(set.cases)
  const lock = readLock(file)
  console.log(`${path.basename(file)}: ${set.cases.length} cases (ar ${result.counts.ar}, en ${result.counts.en}) · sha256 ${fileSha256(file)} · ${lock ? `frozen ${lock.frozenAt}${lock.sha256 === fileSha256(file) ? '' : ' — CHANGED SINCE FREEZE'}` : 'not frozen'}`)
  if (result.agreement) console.log(`agreement: observed ${result.agreement.observed == null ? 'n/a' : result.agreement.observed.toFixed(3)}, Cohen's kappa ${result.agreement.kappa == null ? 'n/a' : result.agreement.kappa.toFixed(3)}, exact-case ${result.agreement.exactCaseAgreement == null ? 'n/a' : result.agreement.exactCaseAgreement.toFixed(3)}`)
  if (result.warnings?.length) console.log(`${result.warnings.length} warning(s) (they do not block freezing):\n- ${result.warnings.join('\n- ')}`)
  if (result.errors.length) fail(`${result.errors.length} problem(s):\n- ${result.errors.join('\n- ')}`)
  console.log('OK')
}

// ---- Task 38 · the v2 kit ----------------------------------------------------------------------
const V2_SET = path.join(HERE, 'testset-v2.json')
const REPORT = path.join(HERE, 'v2-kit', 'disagreements.md')
const readText = f => { if (!f || !existsSync(f)) fail(`${f || 'a file'} does not exist.`); return readFileSync(f, 'utf8') }
const refuseFrozen = f => { if (readLock(f)) fail(`REFUSED: ${path.basename(f)} is frozen; a frozen set is never edited.`) }
const positional = () => { const out = []; for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) { if (!['--replace'].includes(rest[i])) i++; continue } out.push(rest[i]) } return out }
const textFlag = name => { const v = flag(name, ''); return v === true ? '' : v }
function summary(set, target) {
  const result = checkSetV2({ meta: set, cases: set.cases }, { otherTexts: otherTexts(target) })
  const a = set.agreement || {}
  console.log(`agreement: ${a.decisions} case × capability decisions, observed ${a.observed}, Cohen's kappa ${a.kappa}, exact-case ${a.exactCaseAgreement}`)
  console.log(coverageReport(set.cases).text)
  if (result.warnings.length) console.log(`\n${result.warnings.length} warning(s):\n- ${result.warnings.join('\n- ')}`)
  console.log(result.errors.length ? `\ncheck --v2: ${result.errors.length} problem(s) before it can be frozen:\n- ${result.errors.join('\n- ')}` : '\ncheck --v2: OK. Ready to freeze (eval.mjs freeze).')
}

function labelsSheetCommand() {
  const [out] = positional()
  if (!file || !out) fail('usage: eval.mjs labels-sheet <cases.csv> <out.csv>')
  if (existsSync(out)) fail(`${out} exists; choose a new file name (a reviewer's sheet is never overwritten).`)
  const { cases, errors } = casesFromCsv(readText(file))
  if (errors.length) fail(`${errors.length} problem(s) in the cases sheet:\n- ${errors.join('\n- ')}`)
  writeFileSync(out, labelsSheet(cases))
  console.log(`labels sheet with ${cases.length} cases → ${out}`)
}

function coverageCommand() {
  if (!file) fail('usage: eval.mjs coverage <cases.csv | set.json>')
  if (file.endsWith('.json')) { console.log(coverageReport(loadSet(file).cases).text); return }
  const { cases, targets, errors } = casesFromCsv(readText(file))
  if (errors.length) console.log(`${errors.length} problem(s) in the cases sheet:\n- ${errors.join('\n- ')}\n`)
  console.log(coverageReport(cases, { targets }).text)
}

function importCommand() {
  const [labelsA, labelsB] = positional()
  if (!file || !labelsA || !labelsB) fail('usage: eval.mjs import-v2 <cases.csv> <labelsA.csv> <labelsB.csv> --reviewer-a <role> --reviewer-b <role> [--set <file>] [--report <md>] [--replace]')
  const target = flag('set', V2_SET), report = flag('report', REPORT)
  refuseFrozen(target)
  const previous = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : {}
  if ((previous.cases || []).some(c => c.labels?.adjudication) && !rest.includes('--replace')) fail(`REFUSED: ${path.basename(target)} already has resolved labels; importing again would lose them. Add --replace if that is intended.`)
  const { cases: _cases, ...base } = previous
  const draftTexts = existsSync(path.join(HERE, DRAFTS)) ? loadSet(path.join(HERE, DRAFTS)).cases.map(c => c.text) : []
  const { set, errors, warnings } = importV2({ casesCsv: readText(file), labelsACsv: readText(labelsA), labelsBCsv: readText(labelsB), reviewers: { A: textFlag('reviewer-a'), B: textFlag('reviewer-b') }, base, forbiddenTexts: draftTexts })
  for (const w of warnings) console.log(`warning: ${w}`)
  if (errors.length) fail(`Nothing written: ${errors.length} problem(s):\n- ${errors.join('\n- ')}`)
  writeFileSync(target, JSON.stringify(set, null, 2) + '\n')
  mkdirSync(path.dirname(report), { recursive: true })
  writeFileSync(report, disagreementsMarkdown(set, { date: today() }) + '\n')
  console.log(`imported ${set.cases.length} cases → ${path.relative('.', target)}; disagreements → ${path.relative('.', report)}`)
  summary(set, target)
}

function resolveCommand() {
  if (!file) fail('usage: eval.mjs resolve-v2 <resolved.csv> [--set <file>] [--report <md>]')
  const target = flag('set', V2_SET), report = flag('report', REPORT)
  refuseFrozen(target)
  const current = JSON.parse(readText(target))
  if (!current.cases?.length) fail(`${path.basename(target)} has no cases; run import-v2 first.`)
  const { set, errors } = resolveV2(current, readText(file))
  if (errors.length) fail(`Nothing written: ${errors.length} problem(s):\n- ${errors.join('\n- ')}`)
  writeFileSync(target, JSON.stringify(set, null, 2) + '\n')
  mkdirSync(path.dirname(report), { recursive: true })
  writeFileSync(report, disagreementsMarkdown(set, { date: today() }) + '\n')
  console.log(`resolved → ${path.relative('.', target)}; disagreements → ${path.relative('.', report)}`)
  summary(set, target)
}

// ---- Task 38b · Claude-drafted cases, reviewed by two people ----------------------------------
const AI_SET = path.join(HERE, 'testset-ai-v3.json')
const AI_REPORT = path.join(HERE, 'ai-drafts', 'disagreements.md')
const SEALED_DIR = path.join(HERE, 'ai-drafts', 'sealed')
const draftsFile = () => flag('drafts', path.join(HERE, DRAFTS))
const proposedFile = () => flag('proposed', path.join(HERE, PROPOSED))
// The drafts file a reviewed set is verified against: --drafts, or the file the set records.
function draftsFor(meta) {
  const f = rest.includes('--drafts') ? draftsFile() : path.join(HERE, meta?.drafts?.file || DRAFTS)
  return existsSync(f) ? { drafts: loadSet(f), draftsSha256: fileSha256(f) } : {}
}
// The drafts' "others": every other set, the human v2 set included.
const draftOthers = () => [...OTHER_SETS, 'testset-v2.json'].flatMap(name => existsSync(path.join(HERE, name)) ? loadSet(path.join(HERE, name)).cases.map(c => ({ set: name, id: c.id, text: c.text })) : [])
const readProposed = () => existsSync(proposedFile()) ? { proposed: JSON.parse(readFileSync(proposedFile(), 'utf8')), proposedSha256: fileSha256(proposedFile()) } : {}

function checkDraftsCommand() {
  const drafts = loadSet(draftsFile())
  const result = checkDrafts(drafts, { ...readProposed(), otherTexts: draftOthers() })
  console.log(`${path.basename(draftsFile())}: ${drafts.cases.length} drafts (ar ${drafts.cases.filter(c => c.lang === 'ar').length}, en ${drafts.cases.filter(c => c.lang === 'en').length}) · model ${drafts.meta.generation?.model} · sha256 ${fileSha256(draftsFile())} · Claude's labels ${existsSync(proposedFile()) ? 'unsealed and checked' : 'sealed (not checked here)'}`)
  if (result.warnings.length) console.log(`${result.warnings.length} warning(s):\n- ${result.warnings.join('\n- ')}`)
  if (result.errors.length) fail(`${result.errors.length} problem(s):\n- ${result.errors.join('\n- ')}`)
  console.log('OK')
}

function aiReviewSheetCommand() {
  const out = file
  if (!out) fail('usage: eval.mjs ai-review-sheet <out.csv> [--drafts <drafts.json>]')
  if (existsSync(out)) fail(`${out} exists; choose a new file name (a reviewer's sheet is never overwritten).`)
  const drafts = loadSet(draftsFile())
  writeFileSync(out, aiReviewSheet(drafts.cases))
  console.log(`review sheet with ${drafts.cases.length} drafts (id and text only; first row: the blindness confirmation) → ${out}`)
}

function aiSummary(set, target) {
  const result = checkSetAiReviewed({ meta: set, cases: set.cases }, { otherTexts: otherTexts(target), ...draftsFor(set) })
  const a = set.agreement || {}
  console.log(`reviewer confirmations (did not open Claude's labels): A ${set.reviewerConfirmations?.A?.confirmed === true}, B ${set.reviewerConfirmations?.B?.confirmed === true}`)
  console.log(`reviewer decisions: A ${JSON.stringify(set.reviewerDecisions?.A)}, B ${JSON.stringify(set.reviewerDecisions?.B)}`)
  console.log(`agreement on the ${a.cases} drafts neither rejected: ${a.decisions} case × capability decisions, observed ${a.observed}, Cohen's kappa ${a.kappa}, exact-case ${a.exactCaseAgreement}`)
  if (set.counts) console.log(`final: kept ${set.counts.kept}, edited ${set.counts.edited}, rejected ${set.counts.rejected}`)
  if (set.claudeVsHuman) console.log(`Claude's proposed labels vs the final labels: observed ${set.claudeVsHuman.observed}, kappa ${set.claudeVsHuman.kappa}, exact-case ${set.claudeVsHuman.exactCaseAgreement}`)
  if (result.warnings.length) console.log(`\n${result.warnings.length} warning(s):\n- ${result.warnings.join('\n- ')}`)
  console.log(result.errors.length ? `\ncheck: ${result.errors.length} problem(s) before it can be frozen:\n- ${result.errors.join('\n- ')}` : '\ncheck: OK. Ready to freeze (eval.mjs freeze).')
}

function importAiCommand() {
  const [reviewB] = positional()
  const reviewA = file
  if (!reviewA || !reviewB) fail('usage: eval.mjs import-ai-review <reviewA.csv> <reviewB.csv> --reviewer-a <role> --reviewer-b <role> [--set <file>] [--report <md>] [--drafts <drafts.json>]')
  const target = flag('set', AI_SET), report = flag('report', AI_REPORT)
  refuseFrozen(target)
  if (path.basename(target) === 'testset-v2.json' || (existsSync(target) && loadSet(target).meta?.version === 'testset-v2')) fail('REFUSED: Claude-drafted cases never go into the human set testset-v2.json.')
  if (existsSync(target) && JSON.parse(readFileSync(target, 'utf8')).status === 'resolved' && !rest.includes('--replace')) fail(`REFUSED: ${path.basename(target)} is already resolved; importing again would lose the resolutions. Add --replace if that is intended.`)
  const drafts = loadSet(draftsFile())
  const { set, errors } = importAiReview({ drafts, draftsSha256: fileSha256(draftsFile()), reviewACsv: readText(reviewA), reviewBCsv: readText(reviewB), reviewers: { A: textFlag('reviewer-a'), B: textFlag('reviewer-b') } })
  if (errors.length) fail(`Nothing written: ${errors.length} problem(s):\n- ${errors.join('\n- ')}`)
  writeFileSync(target, JSON.stringify(set, null, 2) + '\n')
  mkdirSync(path.dirname(report), { recursive: true })
  writeFileSync(report, disagreementsMarkdown(set, { date: today() }) + '\n')
  console.log(`imported ${set.cases.length} reviewed drafts → ${path.relative('.', target)}; disagreements → ${path.relative('.', report)}`)
  aiSummary(set, target)
}

// Restore Claude's sealed labels and self-review from git history, only once both reviewers' sheets
// (with their blindness confirmations) are imported, and only if their sha256 matches the commitment.
function unsealCommand() {
  const target = file && !file.startsWith('--') ? file : flag('set', AI_SET)
  if (!existsSync(target)) fail(`REFUSED: ${path.basename(target)} does not exist; Claude's labels stay sealed until both reviewers' sheets are imported (import-ai-review).`)
  const set = JSON.parse(readFileSync(target, 'utf8'))
  if (set.version !== AI_SET_VERSION || set.reviewerConfirmations?.A?.confirmed !== true || set.reviewerConfirmations?.B?.confirmed !== true) fail('REFUSED: both reviewers\' confirmed sheets must be imported before Claude\'s labels are unsealed.')
  const drafts = loadSet(draftsFile())
  const outDir = flag('out', SEALED_DIR)
  mkdirSync(outDir, { recursive: true })
  for (const key of ['proposedLabels', 'selfReview']) {
    const seal = drafts.meta.sealed?.[key]
    if (!seal) fail(`drafts: no sealed ${key}`)
    let bytes
    try { bytes = execSync(`git show ${seal.commit}:${seal.path}`, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 }) } catch { fail(`Cannot read ${seal.path} at ${seal.commit} from git history (a full clone is needed: git fetch --unshallow).`) }
    const actual = sha256(bytes)
    if (actual !== seal.sha256) fail(`REFUSED: ${seal.path} at ${seal.commit} has sha256 ${actual}, not the sealed ${seal.sha256}.`)
    const out = path.join(outDir, path.basename(seal.path))
    writeFileSync(out, bytes)
    console.log(`unsealed ${seal.path} (sha256 ${actual}, matches the commitment) → ${path.relative('.', out)}`)
  }
}

function resolveAiCommand() {
  if (!file) fail('usage: eval.mjs resolve-ai-review <resolved.csv> [--set <file>] [--report <md>] [--proposed <file>]')
  const target = flag('set', AI_SET), report = flag('report', AI_REPORT)
  refuseFrozen(target)
  const current = JSON.parse(readText(target))
  if (current.version !== AI_SET_VERSION) fail(`${path.basename(target)} is not a reviewed AI set (${AI_SET_VERSION}).`)
  const { set, errors } = resolveAiReview(current, readText(file), readProposed())
  if (errors.length) fail(`Nothing written: ${errors.length} problem(s):\n- ${errors.join('\n- ')}`)
  writeFileSync(target, JSON.stringify(set, null, 2) + '\n')
  mkdirSync(path.dirname(report), { recursive: true })
  writeFileSync(report, disagreementsMarkdown(set, { date: today() }) + '\n')
  console.log(`resolved → ${path.relative('.', target)}; disagreements → ${path.relative('.', report)}`)
  aiSummary(set, target)
}

try {
  if (command === 'run') await run()
  else if (command === 'compare') await compare()
  else if (command === 'hybrid') await hybridReport()
  else if (command === 'workflow') await workflowReport()
  else if (command === 'dialect') await dialectReport()
  else if (command === 'tune') await tune()
  else if (command === 'freeze') freeze()
  else if (command === 'check') check()
  else if (command === 'labels-sheet') labelsSheetCommand()
  else if (command === 'coverage') coverageCommand()
  else if (command === 'import-v2') importCommand()
  else if (command === 'resolve-v2') resolveCommand()
  else if (command === 'check-drafts') checkDraftsCommand()
  else if (command === 'ai-review-sheet') aiReviewSheetCommand()
  else if (command === 'import-ai-review') importAiCommand()
  else if (command === 'unseal-proposed') unsealCommand()
  else if (command === 'resolve-ai-review') resolveAiCommand()
  else fail('usage: eval.mjs check|freeze|tune|run|compare|labels-sheet|coverage|import-v2|resolve-v2|check-drafts|ai-review-sheet|import-ai-review|unseal-proposed|resolve-ai-review <file> [options]')
} catch (error) { fail(error.message) }
