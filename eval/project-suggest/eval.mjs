#!/usr/bin/env node
// Task 07 · evaluation harness (local only). Commands:
//   check  <set.json> [--v2]           validate structure (v2: human-written, two reviewers, agreement)
//   freeze <set.json>                  write <set>.lock.json with the sha256; the set may never be tuned on
//   tune   <dev-set.json>              choose the embedding threshold on the development set only
//   run    <set.json> [--method lexicon|embedding|improved|all]
//   compare <set.json> [more sets]    baseline vs MiniLM vs improved → results/<date>-comparison.md
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
import { AI_SET_VERSION, HARNESS_VERSION, aiReviewSheet, assertLockMatches, assertNotFrozen, casesFromCsv, checkDrafts, checkSet, checkSetAiReviewed, checkSetV2, coverageReport, disagreementsMarkdown, fileSha256, importAiReview, importV2, labelsSheet, loadSet, lockPathFor, readLock, resolveAiReview, resolveV2, score, sha256, toCsv, toMarkdown } from './lib.mjs'
import { embedding, improved, lexicon, pickAbove, sentenceScores } from './methods.mjs'

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
  throw new Error(`Unknown method "${name}" (lexicon | embedding | improved | all)`)
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
  assertNotFrozen(file)
  if (/testset/i.test(path.basename(file))) fail('REFUSED: tuning is allowed on the development set only.')
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
const OTHER_SETS = ['dev-set.json', 'testset.json', 'testset-ai-v2.json']
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
