import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { rankSemanticCandidates } from '../src/semantic/catalog.js'
import { targetProfiles } from '../src/matching/targets.js'
import { assertLockMatches, assertNotFrozen, fileSha256, normaliseText } from '../eval/project-suggest/lib.mjs'
import {
  APP_VALUES, BOOTSTRAP, GRID, PATHWAY_IDS, PROVENANCE, bootstrapInterval, caseOutcome, checkSet, filterScores, lexiconIndex,
  lexiconRank, metric, pathwayScores, readSet, seededRandom, summarise, tune, words,
} from '../eval/pathway-recall/lib.mjs'

// Task 42 · measurement of the in-app MiniLM pathway search. These tests need no model: the model
// run itself is `node eval/pathway-recall/eval.mjs run` (see log/task-42.md for two identical runs).

const ROOT = path.resolve(import.meta.dirname, '..')
const DIR = path.join(ROOT, 'eval/pathway-recall')
const TEST = path.join(DIR, 'testset.json'), DEV = path.join(DIR, 'dev-set.json')
const test = readSet(TEST), dev = readSet(DEV)
const json = file => JSON.parse(readFileSync(file, 'utf8'))
const run = (...args) => spawnSync(process.execPath, [path.join(DIR, 'eval.mjs'), ...args], { cwd: ROOT, encoding: 'utf8' })

describe('the sets', () => {
  it('both pass the set rules (format, known pathway ids, sizes, provenance)', () => {
    expect(checkSet(test, 'test')).toEqual([])
    expect(checkSet(dev, 'dev')).toEqual([])
  })

  it('test set: ≥ 30 queries per language, ≥ 10 in Saudi dialect, ≥ 5 that should find nothing', () => {
    const count = f => test.cases.filter(f).length
    expect(count(c => c.lang === 'ar')).toBeGreaterThanOrEqual(30)
    expect(count(c => c.lang === 'en')).toBeGreaterThanOrEqual(30)
    expect(count(c => c.lang === 'ar' && c.dialect)).toBeGreaterThanOrEqual(10)
    expect(count(c => !c.expected.length)).toBeGreaterThanOrEqual(5)
    expect([test.cases.length, count(c => c.lang === 'ar'), count(c => c.dialect), count(c => !c.expected.length)]).toEqual([70, 35, 12, 28])
  })

  it('carries the approval statement in both files and in the lock', () => {
    expect(PROVENANCE).toBe('Written by Claude, approved by the team and the supervisor (stated by Amjd, 2026-11-18)')
    expect(test.meta.provenance).toBe(PROVENANCE)
    expect(dev.meta.provenance).toBe(PROVENANCE)
    expect(json(path.join(DIR, 'testset.lock.json')).provenance).toBe(PROVENANCE)
  })

  it('the test set is frozen: its sha256 matches the lock, and it cannot be used for tuning', () => {
    const lock = assertLockMatches(TEST)
    expect(lock.sha256).toBe(fileSha256(TEST))
    expect(lock.sha256).toBe('273a966ce29fb59ce453b51c25d52ccf0b299d79de7f2629281c0d68087488a2')
    expect(lock.cases).toBe(test.cases.length)
    expect(() => assertNotFrozen(TEST)).toThrow(/frozen/)
    expect(() => assertNotFrozen(DEV)).not.toThrow()
  })

  it('no query is in both sets, and no id repeats', () => {
    const devTexts = new Set(dev.cases.map(c => normaliseText(c.query)))
    expect(test.cases.filter(c => devTexts.has(normaliseText(c.query))).map(c => c.id)).toEqual([])
    const ids = [...test.cases, ...dev.cases].map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('checkSet catches an unknown pathway, a missing expected list and a too-small set', () => {
    const broken = { meta: { provenance: PROVENANCE }, cases: [{ id: 'x', lang: 'ar', query: 'شيء', dialect: false, expected: ['job-astronaut'] }, { id: 'y', lang: 'en', query: 'thing', dialect: false }] }
    const problems = checkSet(broken, 'test')
    expect(problems).toContain('x: unknown pathway "job-astronaut"')
    expect(problems).toContain('y: expected must be a list ([] = should find nothing)')
    expect(problems.some(p => p.startsWith('ar: 1 queries'))).toBe(true)
  })
})

describe('the harness ranks exactly like the app', () => {
  const random = seededRandom(7)
  const vec = () => Array.from({ length: 384 }, () => random() * 2 - 1)
  const index = targetProfiles.flatMap(t => ['ar', 'en'].map(lang => ({ id: t.id, lang, vector: vec() })))

  it('filterScores with the app values returns what rankSemanticCandidates returns (200 random queries)', () => {
    let windowCut = 0, scoreCut = 0
    for (let n = 0; n < 200; n++) {
      // A query mixed from 2–4 pathway vectors with random weights: several pathways score between
      // 0.1 and 0.9 with random gaps, so both the 0.25 cut-off and the 0.12 window decide the list.
      const parts = Array.from({ length: 2 + (n % 3) }, () => ({ v: index[Math.floor(random() * index.length)].vector, w: random() }))
      const query = parts.reduce((sum, { v, w }) => sum.map((x, i) => x + w * v[i]), vec().map(x => x * (n % 4) * 0.6))
      const scores = pathwayScores(query, index)
      const best = Math.max(...scores.values())
      if ([...scores.values()].some(s => s >= 0.25 && s < best - 0.12)) windowCut++
      if ([...scores.values()].some(s => s < 0.25 && s >= best - 0.12)) scoreCut++
      expect(filterScores(scores, APP_VALUES)).toEqual(rankSemanticCandidates(query, index))
    }
    // The sample really exercises both rules.
    expect(windowCut).toBeGreaterThan(20)
    expect(scoreCut).toBeGreaterThan(5)
  })

  it('takes the best of the Arabic and English text of a pathway, and the app values are 0.25 / 0.12 / top 3', () => {
    const scores = pathwayScores(index[0].vector, index)
    expect(scores.get(index[0].id)).toBeCloseTo(1, 10)
    expect(scores.size).toBe(PATHWAY_IDS.length)
    expect(APP_VALUES).toEqual({ minScore: 0.25, window: 0.12, limit: 3 })
  })

  it('the app still uses 0.25 and 0.12 (this task reports tuned values but never changes the app)', () => {
    const source = readFileSync(path.join(ROOT, 'src/semantic/catalog.js'), 'utf8')
    expect(source).toContain('{limit=3,minScore=.25}={}')
    expect(source).toContain('r.score>=best-.12')
  })
})

describe('metrics', () => {
  const pos = { expected: ['a', 'b'] }, none = { expected: [] }
  const r = (...ids) => ids.map(id => ({ id, score: 1 }))

  it('hit@1, hit@3 and reciprocal rank come from the list the student sees; nothing-found is an empty list', () => {
    expect(caseOutcome(pos, r('a', 'x'))).toMatchObject({ kind: 'positive', hit1: true, hit3: true, rr: 1 })
    expect(caseOutcome(pos, r('x', 'y', 'b'))).toMatchObject({ hit1: false, hit3: true, rr: 1 / 3 })
    expect(caseOutcome(pos, r())).toMatchObject({ hit1: false, hit3: false, rr: 0, empty: true })
    expect(caseOutcome(none, r())).toMatchObject({ kind: 'nothing', nothingOk: true })
    expect(caseOutcome(none, r('a'))).toMatchObject({ nothingOk: false })
  })

  it('each metric averages over its own cases; accuracy counts both kinds', () => {
    const outcomes = [caseOutcome(pos, r('a')), caseOutcome(pos, r('x', 'b')), caseOutcome(none, r()), caseOutcome(none, r('a'))]
    expect(metric(outcomes, 'hit1')).toBe(0.5)
    expect(metric(outcomes, 'hit3')).toBe(1)
    expect(metric(outcomes, 'mrr')).toBe(0.75)
    expect(metric(outcomes, 'nothingCorrect')).toBe(0.5)
    expect(metric(outcomes, 'accuracy')).toBe(0.75)
  })

  it('bootstrap: 2,000 draws, fixed seed, same interval every time, and the interval holds the value', () => {
    expect(BOOTSTRAP).toEqual({ draws: 2000, seed: 20261118, level: 0.95 })
    const outcomes = Array.from({ length: 30 }, (_, i) => caseOutcome(pos, i % 3 ? r('a') : r('x')))
    const a = bootstrapInterval(outcomes, 'hit1'), b = bootstrapInterval(outcomes, 'hit1')
    expect(a).toEqual(b)
    expect(a[0]).toBeLessThan(metric(outcomes, 'hit1'))
    expect(a[1]).toBeGreaterThan(metric(outcomes, 'hit1'))
    expect(bootstrapInterval(outcomes, 'nothingCorrect')).toBeNull()
    expect(bootstrapInterval(Array(10).fill(caseOutcome(pos, r('a'))), 'hit1')).toEqual([1, 1])
  })

  it('summaries are per language, Saudi dialect and all', () => {
    const cases = [{ lang: 'ar', dialect: true, expected: ['a'] }, { lang: 'en', dialect: false, expected: [] }]
    const s = summarise(cases, [caseOutcome(cases[0], r('a')), caseOutcome(cases[1], r())])
    expect(Object.keys(s)).toEqual(['all', 'ar', 'en', 'dialect'])
    expect(s.ar.metrics.hit1.value).toBe(1)
    expect(s.en.metrics.nothingCorrect.value).toBe(1)
    expect(s.dialect.cases).toBe(1)
  })

  it('tuning picks from the grid; ties go to higher MRR, then to the app values', () => {
    const cases = [{ expected: ['a'] }, { expected: [] }]
    const scores = [new Map([['a', 0.6], ['b', 0.3]]), new Map([['a', 0.4], ['b', 0.35]])]
    const best = tune(cases, scores)
    expect(GRID.minScore).toContain(best.minScore)
    expect(GRID.window).toContain(best.window)
    expect(best.accuracy).toBe(1)
    expect(best.minScore).toBeGreaterThan(0.4)
    expect(best.minScore).toBeLessThanOrEqual(0.6)
  })
})

describe('lexicon baseline', () => {
  const index = lexiconIndex()
  it('matches words of the pathway title and skill labels in both languages', () => {
    expect(lexiconRank('web developer', index)[0].id).toMatch(/web-developer/)
    expect(lexiconRank('مطور ويب', index)[0].id).toMatch(/web-developer/)
    expect(lexiconRank('best pizza dough recipe', index)).toEqual([])
    expect(lexiconRank('database administrator', index).map(r => r.id)).toContain('job-database-administrator')
  })
  it('normalises Arabic (alef forms, ta marbuta, the article) and English plurals', () => {
    expect(words('البيانات')).toEqual(words('بيانات'))
    expect(words('أمن')).toEqual(words('امن'))
    expect(words('databases')).toEqual(words('database'))
  })
})

describe('the committed results', () => {
  const resultsDir = path.join(DIR, 'results')
  const reports = readdirSync(resultsDir).filter(f => /^\d{4}-\d{2}-\d{2}-testset\.json$/.test(f))
  const report = json(path.join(resultsDir, reports.sort().at(-1)))
  const config = json(path.join(DIR, 'config.json'))

  it('name the set size, the sha256 and that the app values were not changed', () => {
    expect(report.set).toMatchObject({ file: 'eval/pathway-recall/testset.json', sha256: fileSha256(TEST), frozen: true, cases: 70, perLanguage: { ar: 35, en: 35 }, dialect: 12, shouldFindNothing: 28 })
    expect(report.appValues).toEqual(APP_VALUES)
    expect(report.appValuesChanged).toBe(false)
    expect(report.provenance).toBe(PROVENANCE)
    const md = readFileSync(path.join(resultsDir, reports.sort().at(-1).replace('.json', '.md')), 'utf8')
    expect(md).toContain(report.set.sha256)
    expect(md).toContain('App values (not changed):** minScore 0.25, window 0.12')
  })

  it('the tuned values came from the dev set as it is now, and the model index equals the shipped one', () => {
    expect(config.tunedOn).toBe('dev-set.json')
    expect(config.tunedOnSha256).toBe(fileSha256(DEV))
    expect(report.devSet.sha256).toBe(fileSha256(DEV))
    expect(report.tunedValues).toEqual(config.tuned)
    expect(report.model.index).toMatchObject({ texts: 38, comparedWithShippedIndex: 'identical' })
  })

  it('report MiniLM (app values), dev-tuned values, top 3 and the lexicon baseline, with intervals', () => {
    expect(Object.keys(report.methods)).toEqual(['minilm-app', 'minilm-tuned', 'minilm-top3', 'lexicon'])
    for (const m of Object.values(report.methods)) for (const group of ['ar', 'en', 'dialect', 'all']) {
      const { hit1, hit3, mrr, nothingCorrect } = m.summary[group].metrics
      for (const x of [hit1, hit3, mrr, nothingCorrect]) {
        expect(x.value).toBeGreaterThanOrEqual(x.ci[0])
        expect(x.value).toBeLessThanOrEqual(x.ci[1])
      }
    }
  })
})

describe('the command line refuses to tune on the test set or to report on the dev set', () => {
  it('tune on the frozen test set is refused', () => {
    const result = run('tune', 'eval/pathway-recall/testset.json')
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/REFUSED: testset\.json is frozen/)
  })
  it('run on the dev set is refused', () => {
    const result = run('run', 'eval/pathway-recall/dev-set.json')
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/REFUSED: this is the set the values were tuned on/)
  })
  it('the harness has no network call and loads the model only from the local pinned files', () => {
    for (const name of ['lib.mjs', 'minilm.mjs', 'eval.mjs']) {
      const source = readFileSync(path.join(DIR, name), 'utf8')
      expect(source, name).not.toMatch(/\bfetch\w*\s*\(|XMLHttpRequest|WebSocket|https?:\/\//)
    }
    const minilm = readFileSync(path.join(DIR, 'minilm.mjs'), 'utf8')
    expect(minilm).toContain('env.allowRemoteModels = false')
    expect(minilm).toContain('local_files_only: true')
    expect(minilm).toContain('EMBEDDING_MODEL.sha256')
  })
})
