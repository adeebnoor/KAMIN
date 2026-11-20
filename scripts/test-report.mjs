// Task 17 · `npm run test:report`: writes public/tests.html from the last real test runs.
// Inputs: reports/vitest.json (written by `npm test`) and reports/playwright.json (written by `npm run e2e`),
// eval/project-suggest/results/*.json (Task 07) and `git log` since the ref in scripts/test-report.config.json.
// Flags:
//   --check-committed  fail if the committed page claims a different number of test files/tests than this run,
//                      and (Task 48) on main, fail if any browser test passed only on the retry (names printed)
//   --allow-partial    write the page even if not every test file ran (the page then says "partial run")
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { REPORT_FILE, summarizeVitest, summarizePlaywright, latestEvaluation, renderTestsPage, readPageCounts, isSuiteSpecFile, isMainBranch, flakyGate } from './test-report-lib.mjs'
import { PROJECT_SUGGEST_METHOD } from '../src/ai/suggestSettings.js'

const config = JSON.parse(await readFile(new URL('./test-report.config.json', import.meta.url), 'utf8'))
const git = (...args) => { try { return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return null } }
const readJson = async file => existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : null
const listFiles = async (dir, test) => (await readdir(dir, { recursive: true })).map(f => `${dir}/${f.replaceAll('\\', '/')}`).filter(test).sort()

// Only an https URL without credentials is ever printed on the page.
export function publicRepositoryUrl(remote) {
  if (!remote) return null
  const ssh = remote.match(/^git@([^:]+):(.+?)(?:\.git)?$/)
  try {
    const url = new URL(ssh ? `https://${ssh[1]}/${ssh[2]}` : remote)
    if (url.protocol !== 'https:') return null
    url.username = ''; url.password = ''
    return url.toString().replace(/\.git$/, '').replace(/\/$/, '')
  } catch { return null }
}

export function readChanges(since) {
  if (!since || git('rev-parse', '--verify', '--quiet', `${since}^{commit}`) === null) return null
  const out = git('log', '--no-merges', '--date=short', '--format=%h%x1f%ad%x1f%s', `${since}..HEAD`)
  if (out === null) return null
  return out ? out.split('\n').map(line => { const [sha, date, subject] = line.split('\x1f'); return { sha, date, subject } }) : []
}

async function main(argv) {
  const flags = new Set(argv)
  const unitFiles = await listFiles('tests', f => f.endsWith('.test.js'))
  const e2eFiles = await listFiles('e2e', isSuiteSpecFile)
  const unit = summarizeVitest(await readJson(config.vitestJson), unitFiles)
  const e2e = summarizePlaywright(await readJson(config.playwrightJson), e2eFiles)
  if (!unit) throw new Error(`${config.vitestJson} not found: run \`npm test\` first.`)
  if (!e2e) throw new Error(`${config.playwrightJson} not found: run \`npm run e2e\` first.`)
  for (const [name, s] of [['unit', unit], ['e2e', e2e]]) if (s.partial && !flags.has('--allow-partial'))
    throw new Error(`The ${name} run is partial (missing: ${[...s.missingFiles, ...(s.missingProjects || [])].join(', ')}). Run the whole suite, or pass --allow-partial.`)

  const resultsDir = 'eval/project-suggest/results'
  const results = existsSync(resultsDir) ? await Promise.all((await readdir(resultsDir)).filter(f => /^\d{4}-\d{2}-\d{2}-.*\.json$/.test(f)).map(f => readJson(path.join(resultsDir, f)))) : []
  const head = git('rev-parse', '--short', 'HEAD')
  const dirty = Boolean(git('status', '--porcelain', '--untracked-files=no', '--', '.', `:(exclude)${REPORT_FILE}`))
  const data = {
    generatedAt: new Date().toISOString(), commit: head || 'unknown', dirty,
    repository: config.repository || publicRepositoryUrl(git('remote', 'get-url', 'origin')),
    unit, e2e, evaluation: latestEvaluation(results), appMethod: PROJECT_SUGGEST_METHOD,
    changesSince: config.changesSince, changes: readChanges(config.changesSince),
  }

  if (flags.has('--check-committed')) {
    const committed = git('show', `HEAD:${REPORT_FILE}`)
    const claimed = committed ? readPageCounts(committed) : null
    const now = { unitFiles: unit.files, unitTests: unit.tests, e2eTests: e2e.tests }
    const stale = !claimed || Object.entries(now).some(([k, v]) => claimed[k] !== v)
    if (stale) { await writeFile(REPORT_FILE, renderTestsPage(data)); throw new Error(`${REPORT_FILE} in git is out of date: it claims ${JSON.stringify(claimed)}, this run has ${JSON.stringify(now)}. Run npm test, npm run e2e and npm run test:report, then commit ${REPORT_FILE}.`) }
    const flaky = flakyGate(e2e, isMainBranch({ env: process.env, gitBranch: git('branch', '--show-current') }))
    if (flaky) { await writeFile(REPORT_FILE, renderTestsPage(data)); throw new Error(flaky) }
  }
  await writeFile(REPORT_FILE, renderTestsPage(data))
  console.log(`Wrote ${REPORT_FILE}: unit ${unit.passed}/${unit.tests} passed (${unit.failed} failed) in ${unit.files} files · browser ${e2e.passed}/${e2e.tests} passed (${e2e.failed} failed, ${e2e.flaky} on retry) · evaluation ${data.evaluation ? data.evaluation.date : 'not measured yet'} · ${data.changes?.length ?? 'no'} changes · commit ${data.commit}${dirty ? ' (uncommitted changes)' : ''}`)
  if (unit.failed || e2e.failed) console.log('Note: the page shows failing tests.')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exit(1) })
