// Task 17 · the public test results page (public/tests.html) shows real numbers only.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseFragment } from 'parse5'
import {
  summarizeVitest, summarizePlaywright, latestEvaluation, coverage, COVERAGE_AREAS, renderTestsPage, renderSection,
  readPageCounts, buildStamp, repoPath, NOT_MEASURED, REPORT_FILE, flakyName, flakyGate, isMainBranch, isSuiteSpecFile,
} from '../scripts/test-report-lib.mjs'
import { publicRepositoryUrl } from '../scripts/test-report.mjs'
import { footerItems } from '../public/site-content.js'

const vitestJson = ({ failOne = false, loadError = false } = {}) => ({
  startTime: Date.UTC(2026, 10, 11, 9, 30),
  testResults: [
    { name: 'C:\\work\\KAMIN\\tests\\evidenceLevels.test.js', status: failOne ? 'failed' : 'passed', assertionResults: [{ status: 'passed' }, { status: failOne ? 'failed' : 'passed' }, { status: 'skipped' }] },
    { name: '/home/runner/work/KAMIN/tests/recompute.test.js', status: loadError ? 'failed' : 'passed', assertionResults: loadError ? [] : [{ status: 'passed' }, { status: 'todo' }] },
  ],
})
const pwTest = (projectName, status) => ({ projectName, status })
const playwrightJson = ({ dropMobile = false } = {}) => ({
  config: { projects: [{ name: 'desktop-chromium' }, { name: 'mobile-chromium' }] },
  stats: { startTime: '2026-11-11T09:40:00.000Z' },
  suites: [
    { file: 'evidence-levels.spec.js', specs: [{ file: 'evidence-levels.spec.js', tests: [pwTest('desktop-chromium', 'expected'), ...(dropMobile ? [] : [pwTest('mobile-chromium', 'unexpected')])] }],
      suites: [{ title: 'nested', file: 'evidence-levels.spec.js', specs: [{ file: 'evidence-levels.spec.js', tests: [pwTest('desktop-chromium', 'flaky'), pwTest('desktop-chromium', 'skipped')] }] }] },
    { file: 'usability-journeys.spec.js', specs: [{ file: 'usability-journeys.spec.js', tests: [pwTest('desktop-chromium', 'expected'), pwTest('mobile-chromium', 'expected')] }] },
  ],
})
const evalRun = (set, method, date, extra = {}) => ({ meta: { method, methodVersion: `${method}-v1`, commit: 'abc1234', set, setSha256: set === 'testset.json' ? 'f'.repeat(64) : 'a'.repeat(64), frozenAt: '2026-10-25T18:05:04.280Z', threshold: null, date, ...extra }, metrics: { all: { cases: 40, precision: 0.9, recall: 0.5, f1: 0.64 } } })
const baseData = over => ({ generatedAt: '2026-11-11T10:00:00.000Z', commit: 'abc1234', dirty: false, repository: 'https://github.com/example/kamin', appMethod: 'lexicon', changesSince: 'start00', changes: [{ sha: 'abc1234', date: '2026-11-11', subject: 'Task 17: <test> page' }], unit: summarizeVitest(vitestJson()), e2e: summarizePlaywright(playwrightJson()), evaluation: latestEvaluation([evalRun('testset.json', 'lexicon', '2026-11-10')]), ...over })
const textOf = html => { const walk = n => n.nodeName === '#text' ? n.value : (n.childNodes || []).map(walk).join(' '); return walk(parseFragment(html)).replace(/\s+/g, ' ') }
const metric = (html, name) => html.match(new RegExp(`data-metric="${name}"><th scope="row">[^<]*</th><td>(\\d+)</td>`))?.[1]

describe('reading the test runs', () => {
  it('counts unit test files, tests, failures and skips; paths are repo-relative on any machine', () => {
    const s = summarizeVitest(vitestJson())
    expect(s).toMatchObject({ files: 2, tests: 5, passed: 3, failed: 0, skipped: 2, failedFiles: 0, partial: false, startedAt: '2026-11-11T09:30:00.000Z' })
    expect(s.byFile.map(f => f.file)).toEqual(['tests/evidenceLevels.test.js', 'tests/recompute.test.js'])
    expect(repoPath('D:/a/KAMIN/e2e/x.spec.js', 'e2e')).toBe('e2e/x.spec.js')
    expect(repoPath('x.spec.js', 'e2e')).toBe('e2e/x.spec.js')
  })
  it('one broken unit test shows as 1 failed; a file that fails to load counts as failed too', () => {
    expect(summarizeVitest(vitestJson({ failOne: true }))).toMatchObject({ failed: 1, passed: 2, failedFiles: 1 })
    expect(summarizeVitest(vitestJson({ loadError: true }))).toMatchObject({ failed: 1, failedFiles: 1 })
  })
  it('a run that skipped test files is marked partial', () => {
    const s = summarizeVitest(vitestJson(), ['tests/evidenceLevels.test.js', 'tests/recompute.test.js', 'tests/networkGuard.test.js'])
    expect(s.partial).toBe(true)
    expect(s.missingFiles).toEqual(['tests/networkGuard.test.js'])
  })
  it('browser tests: passed, failed, passed on retry and skipped, across nested suites and both devices', () => {
    const s = summarizePlaywright(playwrightJson(), ['e2e/evidence-levels.spec.js', 'e2e/usability-journeys.spec.js'])
    expect(s).toMatchObject({ tests: 6, passed: 4, failed: 1, flaky: 1, skipped: 1, files: 2, partial: false })
    expect(s.projects.sort()).toEqual(['desktop-chromium', 'mobile-chromium'])
  })
  it('a browser run without one of the configured devices, or without a spec file, is partial', () => {
    expect(summarizePlaywright(playwrightJson()).partial).toBe(false)
    const noPhone = summarizePlaywright({ ...playwrightJson(), suites: playwrightJson().suites.map(s => ({ ...s, specs: s.specs.map(sp => ({ ...sp, tests: sp.tests.filter(t => t.projectName !== 'mobile-chromium') })), suites: [] })) })
    expect(noPhone.missingProjects).toEqual(['mobile-chromium'])
    expect(noPhone.partial).toBe(true)
    expect(summarizePlaywright(playwrightJson(), ['e2e/evidence-levels.spec.js', 'e2e/usability-journeys.spec.js', 'e2e/my-data.spec.js']).missingFiles).toEqual(['e2e/my-data.spec.js'])
  })
  it('no run at all gives null, never zeros', () => {
    expect(summarizeVitest(null)).toBeNull()
    expect(summarizePlaywright(undefined)).toBeNull()
  })
})

describe('evaluation summary (Task 07)', () => {
  it('takes the latest run per method on the frozen v1 set and ignores the AI-written set', () => {
    const e = latestEvaluation([evalRun('testset.json', 'lexicon', '2026-10-25'), evalRun('testset.json', 'lexicon', '2026-11-10', { commit: 'def5678' }), evalRun('testset.json', 'improved', '2026-11-10'), evalRun('testset-ai-v2.json', 'lexicon', '2026-11-12')])
    expect(e.methods.map(m => [m.method, m.date, m.commit])).toEqual([['lexicon', '2026-11-10', 'def5678'], ['improved', '2026-11-10', 'abc1234']])
    expect(e).toMatchObject({ set: 'testset.json', setSha256: 'f'.repeat(64), date: '2026-11-10' })
  })
  it('no run on the frozen set means "not measured yet" on the page', () => {
    expect(latestEvaluation([evalRun('testset-ai-v2.json', 'lexicon', '2026-11-10')])).toBeNull()
    expect(latestEvaluation([])).toBeNull()
    const html = renderSection('en', baseData({ evaluation: null }))[2]
    const evalCard = html.slice(html.indexOf('id="evaluation"'), html.indexOf('id="not-measured"'))
    expect(evalCard).toContain(NOT_MEASURED.en)
    expect(evalCard).not.toMatch(/\d+(\.\d+)?%/)
  })
  it('reads the results that are in the repo: date, commit and set hash', () => {
    const dir = 'eval/project-suggest/results'
    const runs = readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}-.*\.json$/.test(f)).map(f => JSON.parse(readFileSync(path.join(dir, f), 'utf8')))
    const e = latestEvaluation(runs)
    const lock = JSON.parse(readFileSync('eval/project-suggest/testset.lock.json', 'utf8'))
    expect(e.setSha256).toBe(lock.sha256)
    expect(e.methods.map(m => m.method)).toEqual(['lexicon', 'embedding', 'improved'])
    expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('the page', () => {
  it('has Arabic and English, the date, the commit and the numbers of the run', () => {
    const html = renderTestsPage(baseData({ unit: summarizeVitest(vitestJson({ failOne: true })) }))
    expect(html).toContain('<section data-kamin-lang="ar">')
    expect(html).toContain('<section data-kamin-lang="en" hidden>')
    expect(html).toContain('<span dir="ltr">2026-11-11 09:30 UTC</span>')
    expect(html).toContain('https://github.com/example/kamin/commit/abc1234')
    expect(metric(html, 'unit-tests')).toBe('5')
    expect(metric(html, 'unit-failed')).toBe('1')
    expect(metric(html, 'e2e-tests')).toBe('6')
    expect(metric(html, 'e2e-failed')).toBe('1')
    expect(metric(html, 'e2e-flaky')).toBe('1')
    expect(readPageCounts(html)).toEqual({ commit: 'abc1234', unitFiles: 2, unitTests: 5, e2eTests: 6 })
  })
  it('a missing browser run says "not measured yet" instead of showing zeros', () => {
    for (const lang of ['ar', 'en']) {
      const body = renderSection(lang, baseData({ e2e: null }))[2]
      expect(body).not.toContain('data-metric="e2e-')
      expect(body).toContain(NOT_MEASURED[lang])
    }
  })
  it('a partial run is labelled as partial', () => {
    const body = renderSection('en', baseData({ unit: summarizeVitest(vitestJson(), ['tests/a.test.js']) }))[2]
    expect(body).toContain('data-partial-run')
  })
  it('things that have not happened show no number, and targets are never shown as results', () => {
    for (const lang of ['ar', 'en']) {
      const body = renderSection(lang, baseData())[2]
      const pending = [...body.matchAll(/<li data-pending="([^"]+)">(.*?)<\/li>/g)]
      expect(pending.map(m => m[1])).toEqual(['usability-study', 'human-test-set', 'pilot'])
      for (const [, , li] of pending) {
        expect(li).toContain(NOT_MEASURED[lang])
        expect(textOf(li).replace(/\b5\b/, '')).not.toMatch(/\d/) // "5 or more" is the protocol's minimum, not a count
      }
    }
    const en = textOf(renderSection('en', baseData())[2])
    expect(en.replaceAll('targets, not results', '').replaceAll('Validation plan (targets)', '')).not.toMatch(/target/i)
    expect(en).not.toMatch(/participants: \d/i)
  })
  it('percentages appear only in the evaluation table, never as a student-facing score', () => {
    const body = renderSection('en', baseData())[2]
    const outside = body.slice(0, body.indexOf('id="evaluation"')) + body.slice(body.indexOf('id="not-measured"'))
    expect(outside).not.toMatch(/\d%/)
    expect(body).toContain('Lexicon (used in the app now)')
  })
  it('lists the changes, escaped, or says the list is not available', () => {
    const body = renderSection('en', baseData())[2]
    expect(body).toContain('id="changes"')
    expect(body).toContain('Task 17: &lt;test&gt; page')
    expect(body).not.toContain('<test>')
    expect(renderSection('en', baseData({ changes: null }))[2]).toContain('not available in this build')
    expect(renderSection('ar', baseData({ changes: [] }))[2]).toContain('id="changes"')
  })
  it('coverage per area is counted from the run; an area without a run says "not measured yet"', () => {
    const rows = coverage(summarizeVitest(vitestJson()), summarizePlaywright(playwrightJson()))
    expect(rows.find(r => r.id === 'evidence-levels')).toMatchObject({ unitResult: { tests: 3, failed: 0 }, e2eResult: { tests: 4, failed: 1 } })
    expect(rows.find(r => r.id === 'deletion').unitResult).toEqual({ tests: null })
    expect(rows.find(r => r.id === 'usability-budget').unitResult).toBeNull()
  })
  it('every file named in the coverage list exists, so the list cannot silently rot', () => {
    for (const area of COVERAGE_AREAS) for (const file of [...area.unit, ...area.e2e]) expect(existsSync(file), `${area.id}: ${file}`).toBe(true)
    expect(COVERAGE_AREAS.map(a => a.id)).toEqual(expect.arrayContaining(['evidence-levels', 'recompute', 'deletion', 'network-guard', 'usability-budget']))
  })
})

describe('build stamp', () => {
  it('says whether the built version is the one the tests ran on', () => {
    expect(buildStamp('en', { measuredCommit: 'abc1234', buildCommit: 'abc1234' })).toContain('the same version the tests ran on')
    expect(buildStamp('en', { measuredCommit: 'abc1234', buildCommit: 'def5678', sameCode: true })).toContain('only this page changed since')
    expect(buildStamp('en', { measuredCommit: 'abc1234', buildCommit: 'def5678', sameCode: false })).toContain('not covered by these numbers')
    expect(buildStamp('en', { measuredCommit: 'abc1234', measuredDirty: true, buildCommit: 'abc1234' })).toContain('uncommitted changes')
    expect(buildStamp('en', { measuredCommit: 'abc1234', buildCommit: null })).toContain('unknown')
    expect(buildStamp('ar', { measuredCommit: null, buildCommit: 'abc1234' })).toContain('لم تُشغَّل')
  })
})

describe('repository link', () => {
  it('is https only and never carries credentials', () => {
    expect(publicRepositoryUrl('https://user:secret@github.com/team/KAMIN.git')).toBe('https://github.com/team/KAMIN')
    expect(publicRepositoryUrl('git@github.com:team/KAMIN.git')).toBe('https://github.com/team/KAMIN')
    expect(publicRepositoryUrl('http://example.com/x')).toBeNull()
    expect(publicRepositoryUrl(null)).toBeNull()
  })
})

describe('the committed page', () => {
  const page = () => readFileSync(REPORT_FILE, 'utf8')
  it('is generated by npm run test:report and linked from the footer and README', () => {
    expect(page()).toContain('Generated by `npm run test:report`')
    expect(footerItems.map(([file]) => file)).toContain('tests.html')
    expect(readFileSync('README.md', 'utf8')).toContain('/tests.html')
  })
  it('counts every unit test file in the repo (regenerate it after adding a test file)', () => {
    const onDisk = readdirSync('tests', { recursive: true }).filter(f => String(f).endsWith('.test.js')).length
    expect(readPageCounts(page()).unitFiles, 'run npm test, npm run e2e and npm run test:report, then commit public/tests.html').toBe(onDisk)
    expect(readPageCounts(page()).commit).toMatch(/^[0-9a-f]{7,}$/)
  })
})

// Task 48: retries stay at 1, but a test that passed only on the retry is named, and is not a green run on main.
describe('tests that passed only on the retry (Task 48)', () => {
  const flakyRun = () => ({
    config: { projects: [{ name: 'desktop-chromium' }, { name: 'mobile-chromium' }] },
    stats: { startTime: '2026-11-17T09:40:00.000Z' },
    suites: [{ title: 'history.spec.js', file: 'history.spec.js', specs: [{ title: 'Back <closes> the sheet', file: 'history.spec.js', tests: [pwTest('desktop-chromium', 'expected'), pwTest('mobile-chromium', 'flaky')] }],
      suites: [{ title: 'refresh', file: 'history.spec.js', specs: [{ title: 'keeps the view', file: 'history.spec.js', tests: [pwTest('desktop-chromium', 'flaky'), pwTest('mobile-chromium', 'expected')] }] }] }],
  })
  it('names each one with its file, describe titles, test title and device', () => {
    const s = summarizePlaywright(flakyRun())
    expect(s.flaky).toBe(2)
    expect(s.flakyTests).toEqual([
      { file: 'e2e/history.spec.js', title: 'Back <closes> the sheet', project: 'mobile-chromium' },
      { file: 'e2e/history.spec.js', title: 'refresh › keeps the view', project: 'desktop-chromium' },
    ])
    expect(flakyName(s.flakyTests[1])).toBe('e2e/history.spec.js › refresh › keeps the view [desktop-chromium]')
  })
  it('the page shows the count and the names (escaped) in both languages; none when no test needed the retry', () => {
    const html = renderTestsPage(baseData({ e2e: summarizePlaywright(flakyRun()) }))
    expect(metric(html, 'e2e-flaky')).toBe('2')
    expect(html).toContain('data-e2e-flaky="2"')
    expect(html.match(/data-flaky-tests/g)).toHaveLength(2)
    expect(textOf(html)).toContain('These tests passed only on the second try:')
    expect(html).toContain('<li>e2e/history.spec.js › Back &lt;closes&gt; the sheet [mobile-chromium]</li>')
    expect(html).not.toContain('Back <closes>')
    const steady = { ...playwrightJson(), suites: [{ file: 'a.spec.js', specs: [{ title: 'ok', file: 'a.spec.js', tests: [pwTest('desktop-chromium', 'expected'), pwTest('mobile-chromium', 'expected')] }] }] }
    const clean = renderTestsPage(baseData({ e2e: summarizePlaywright(steady) }))
    expect(metric(clean, 'e2e-flaky')).toBe('0')
    expect(clean).not.toContain('data-flaky-tests')
  })
  it('--check-committed fails on main with the names, and only on main', () => {
    const e2e = summarizePlaywright(flakyRun())
    const message = flakyGate(e2e, true)
    expect(message).toContain('2 browser tests passed only on the retry on main')
    expect(message).toContain('- e2e/history.spec.js › Back <closes> the sheet [mobile-chromium]')
    expect(message).toContain('- e2e/history.spec.js › refresh › keeps the view [desktop-chromium]')
    expect(flakyGate(e2e, false)).toBeNull()
    expect(flakyGate(summarizePlaywright({ ...flakyRun(), suites: [] }), true)).toBeNull()
    expect(flakyGate(null, true)).toBeNull()
  })
  it('main is the pushed main branch on CI, or the checked-out main branch locally; a PR run is not main', () => {
    expect(isMainBranch({ env: { GITHUB_REF_NAME: 'main' } })).toBe(true)
    expect(isMainBranch({ env: { GITHUB_REF_NAME: '41/merge' }, gitBranch: 'main' })).toBe(false)
    expect(isMainBranch({ env: { GITHUB_REF_NAME: 'chore/repo-hygiene' } })).toBe(false)
    expect(isMainBranch({ env: {}, gitBranch: 'main' })).toBe(true)
    expect(isMainBranch({ env: {}, gitBranch: 'chore/repo-hygiene' })).toBe(false)
    expect(isMainBranch({ env: {}, gitBranch: null })).toBe(false)
  })
  it('local probes (zz-*.spec.js) and the visual config are never counted as missing suite files', () => {
    expect(isSuiteSpecFile('e2e/history.spec.js')).toBe(true)
    expect(isSuiteSpecFile('C:\\work\\KAMIN\\e2e\\history.spec.js')).toBe(true)
    expect(isSuiteSpecFile('e2e/zz-probe.spec.js')).toBe(false)
    expect(isSuiteSpecFile('e2e/visual.spec.js')).toBe(false)
    expect(isSuiteSpecFile('e2e/nav.js')).toBe(false)
  })
})

// Task 48: git status stays clean after npm test, npm run build and npm run e2e, and tests wait for the screen.
describe('repository hygiene (Task 48)', () => {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })
  const e2eSources = readdirSync('e2e').filter(f => f.endsWith('.js')).map(f => ({ f, text: readFileSync(`e2e/${f}`, 'utf8') }))
  it('generated screenshots are not in Git and are ignored', () => {
    expect(git('ls-files', 'undefined', 'design-review').trim()).toBe('')
    const ignore = readFileSync('.gitignore', 'utf8').split(/\r?\n/)
    for (const line of ['undefined/', 'design-review/', 'e2e/zz-*.spec.js', 'test-results/']) expect(ignore).toContain(line)
    // Task 70: e2e/redesign.spec.js (the spec that saved review screenshots) is deleted with the old interface; any spec
    // that saves a screenshot to a written path still saves it under test-results/.
    const shots = e2eSources.flatMap(({ text }) => [...text.matchAll(/screenshot\(\{path:`([^`]+)`/g)].map(m => m[1]))
    for (const shot of shots) expect(shot.startsWith('test-results/')).toBe(true)
  })
  it('local probes e2e/zz-*.spec.js never run with the suite', () => {
    expect(readFileSync('playwright.config.js', 'utf8')).toMatch(/testIgnore:\s*\[[^\]]*'\*\*\/zz-\*\.spec\.js'/)
  })
  it('no browser test waits a fixed 150 ms before measuring, and no address is read only once after an action', () => {
    for (const { f, text } of e2eSources) {
      expect(text, f).not.toContain('waitForTimeout(150)')
      expect(text, f).not.toMatch(/(?<!poll\(\(\) => )expect\(appParam\(/)
    }
  })
  it('every text file has LF in Git, and images and PDFs are binary', () => {
    const attributes = readFileSync('.gitattributes', 'utf8').split(/\r?\n/)
    for (const line of ['* text=auto eol=lf', '*.png binary', '*.webp binary', '*.pdf binary']) expect(attributes).toContain(line)
    const crlf = git('ls-files', '--eol').split('\n').filter(line => /^i\/(crlf|mixed)\b/.test(line))
    expect(crlf).toEqual([])
  })
})
