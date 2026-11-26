// Task 40 · regression guard: npm test fails as soon as the lexicon or the improved engine scores lower
// on a frozen test set than the floors in eval/project-suggest/score-floors.json.
// Everything runs in memory through the harness library; no file is written, no model is loaded.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { HARNESS_VERSION, assertLockMatches, fileSha256, loadSet, readLock, score } from '../eval/project-suggest/lib.mjs'
import { lexicon, improved } from '../eval/project-suggest/methods.mjs'

const DIR = 'eval/project-suggest'
const FLOORS_FILE = `${DIR}/score-floors.json`
const floors = JSON.parse(readFileSync(FLOORS_FILE, 'utf8'))
const METHODS = { lexicon, improved }
const LANGS = ['ar', 'en', 'all']
const METRICS = ['precision', 'recall', 'f1']
// Only these sets may ever have floors. testset-v2.json joins once it is frozen (Task 38). Claude-drafted
// sets (testset-ai-v3.json, Task 38b) and diagnostic sets (Task 38c) never enter a floor. Task 80 adds Task 77's
// workflow set and its own dialect set (written by Claude, approved by team and supervisor, stated by Amjd 2026-11-18).
const APPROVED_SETS = ['testset.json', 'testset-ai-v2.json', 'testset-v2.json', 'testset-workflow.json', 'testset-dialect.json']
// Task 80: a set whose cases carry a variety also has floors per variety (byVariety).
const VARIETIES = ['dialect', 'msa', 'en', 'mixed']
const groupsOf = langs => [...LANGS.map(lang => [lang, langs[lang]]), ...Object.entries(langs.byVariety || {}).map(([v, counts]) => [`variety ${v}`, counts])]

const ratio = (a, b) => b ? a / b : null
function metricsFromCounts({ tp, fp, fn }) {
  const precision = ratio(tp, tp + fp), recall = ratio(tp, tp + fn)
  return { precision, recall, f1: precision != null && recall != null && precision + recall ? 2 * precision * recall / (precision + recall) : null }
}
const pct = v => v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`
// Exact comparison of ratios; the tolerance only absorbs floating-point noise, never a real case.
const EPSILON = 1e-9

// measured: { [set]: { [method]: { [lang]: {tp, fp, fn, unsupported} } } }. Returns every drop and rise.
function compareWithFloors(measured, floorSets) {
  const drops = [], rises = [], unsupported = []
  for (const [set, entry] of Object.entries(floorSets)) for (const [method, langs] of Object.entries(entry.methods)) for (const [lang, floor] of groupsOf(langs)) {
    const now = lang.startsWith('variety ') ? measured[set]?.[method]?.byVariety?.[lang.slice(8)] : measured[set]?.[method]?.[lang]
    if (!now) { drops.push(`${set} · ${method} · ${lang}: not measured`); continue }
    if (now.unsupported) unsupported.push(`${set} · ${method} · ${lang}: ${now.unsupported} unsupported suggestion(s)`)
    const a = metricsFromCounts(now), f = metricsFromCounts(floor)
    for (const metric of METRICS) {
      const line = `${set} · ${method} · ${lang} · ${metric}: ${pct(a[metric])} (floor ${pct(f[metric])})`
      if (a[metric] == null || a[metric] < f[metric] - EPSILON) drops.push(line)
      else if (a[metric] > f[metric] + EPSILON) rises.push(line)
    }
  }
  return { drops, rises, unsupported }
}

async function measure(set) {
  const { cases } = loadSet(path.join(DIR, set))
  const out = {}
  for (const [name, method] of Object.entries(METHODS)) {
    const predictions = new Map()
    for (const c of cases) predictions.set(c.id, await method.predict(c.text))
    const { metrics, rows } = score(cases, predictions)
    out[name] = Object.fromEntries(LANGS.map(lang => [lang, { tp: metrics[lang].tp, fp: metrics[lang].fp, fn: metrics[lang].fn, unsupported: metrics[lang].unsupported }]))
    if (cases.some(c => c.variety)) out[name].byVariety = Object.fromEntries(VARIETIES.map(v => {
      const ids = new Set(cases.filter(c => c.variety === v).map(c => c.id))
      return [v, rows.filter(r => ids.has(r.id)).reduce((s, r) => ({ tp: s.tp + r.tp, fp: s.fp + r.fp, fn: s.fn + r.fn, unsupported: s.unsupported + r.unsupported }), { tp: 0, fp: 0, fn: 0, unsupported: 0 })]
    }))
  }
  return out
}

describe('engine score floors (Task 40)', () => {
  it('floors exist only for approved, frozen sets, bound to the exact frozen file', () => {
    const sets = Object.keys(floors.sets)
    expect(sets.sort()).toEqual(['testset-ai-v2.json', 'testset-dialect.json', 'testset-workflow.json', 'testset.json'])
    expect(floors.harness).toBe(HARNESS_VERSION)
    for (const set of sets) {
      expect(APPROVED_SETS, `${set} is not an approved set for floors`).toContain(set)
      expect(set).not.toMatch(/ai-v3|ai-drafts|diagnostic/)
      const file = path.join(DIR, set)
      expect(readLock(file), `${set} must be frozen (lock file)`).not.toBeNull()
      expect(() => assertLockMatches(file)).not.toThrow()
      expect(fileSha256(file), `${set} changed since its floors were measured`).toBe(floors.sets[set].sha256)
      expect(loadSet(file).cases).toHaveLength(floors.sets[set].cases)
      expect(Object.keys(floors.sets[set].methods).sort()).toEqual(['improved', 'lexicon'])
    }
    // testset-v2.json gets floors only once frozen; until then it has no lock and no floors.
    if (!existsSync(path.join(DIR, 'testset-v2.lock.json'))) expect(floors.sets['testset-v2.json']).toBeUndefined()
  })

  it('the percentages written in the floors file are the stored counts, rounded', () => {
    for (const [set, entry] of Object.entries(floors.sets)) for (const [method, langs] of Object.entries(entry.methods)) for (const [lang, floor] of groupsOf(langs)) {
      const exact = metricsFromCounts(floor)
      for (const metric of METRICS) expect(floor[metric], `${set} · ${method} · ${lang} · ${metric}`).toBe(Math.round(exact[metric] * 1000) / 10)
    }
    // Task 80: the dialect set has floors per variety; the new sets' floors equal the committed dialect report.
    expect(Object.keys(floors.sets['testset-dialect.json'].methods.improved.byVariety).sort()).toEqual([...VARIETIES].sort())
    expect(floors.sets['testset-dialect.json'].methods.improved.byVariety.dialect).toMatchObject({ tp: 27, fp: 1, fn: 6, f1: 88.5 })
    expect(floors.sets['testset-dialect.json'].methods.improved.all).toMatchObject({ precision: 94.2, recall: 80.3, f1: 86.7 })
    expect(floors.sets['testset-workflow.json'].methods.improved.all).toMatchObject({ precision: 96, recall: 82.8, f1: 88.9 })
    expect(floors.sets['testset.json'].methods.improved.all).toMatchObject({ precision: 97.4, recall: 80.4, f1: 88.1 })
    expect(floors.sets['testset-ai-v2.json'].methods.improved.all).toMatchObject({ precision: 93.2, recall: 85.4, f1: 89.1 })
  })

  it('a drop names the set, method, language and metric; a rise passes; an unsupported suggestion is reported', () => {
    const floorSets = { 'x.json': { methods: { improved: { ar: { tp: 9, fp: 1, fn: 1 }, en: { tp: 9, fp: 1, fn: 1 }, all: { tp: 18, fp: 2, fn: 2 } } } } }
    const same = { 'x.json': { improved: { ar: { tp: 9, fp: 1, fn: 1, unsupported: 0 }, en: { tp: 9, fp: 1, fn: 1, unsupported: 0 }, all: { tp: 18, fp: 2, fn: 2, unsupported: 0 } } } }
    expect(compareWithFloors(same, floorSets)).toEqual({ drops: [], rises: [], unsupported: [] })
    const worse = structuredClone(same); worse['x.json'].improved.ar = { tp: 8, fp: 1, fn: 2, unsupported: 0 }; worse['x.json'].improved.all = { tp: 17, fp: 2, fn: 3, unsupported: 0 }
    const { drops } = compareWithFloors(worse, floorSets)
    expect(drops).toContain('x.json · improved · ar · recall: 80.0% (floor 90.0%)')
    expect(drops.some(d => d.startsWith('x.json · improved · all · f1:'))).toBe(true)
    expect(drops.some(d => d.includes('· en ·'))).toBe(false)
    // Task 80: a floor per variety drops on its own, named "variety <v>".
    const withVariety = { 'x.json': { methods: { improved: { ...floorSets['x.json'].methods.improved, byVariety: { dialect: { tp: 5, fp: 0, fn: 1 } } } } } }
    const dialectDrop = structuredClone(same); dialectDrop['x.json'].improved.byVariety = { dialect: { tp: 4, fp: 0, fn: 2, unsupported: 0 } }
    expect(compareWithFloors(dialectDrop, withVariety).drops).toContain('x.json · improved · variety dialect · recall: 66.7% (floor 83.3%)')
    const better = structuredClone(same); better['x.json'].improved.en = { tp: 10, fp: 0, fn: 0, unsupported: 0 }
    const r = compareWithFloors(better, floorSets)
    expect(r.drops).toEqual([])
    expect(r.rises).toContain('x.json · improved · en · precision: 100.0% (floor 90.0%)')
    const unsupported = structuredClone(same); unsupported['x.json'].improved.en.unsupported = 1
    expect(compareWithFloors(unsupported, floorSets).unsupported).toEqual(['x.json · improved · en: 1 unsupported suggestion(s)'])
    expect(compareWithFloors({}, floorSets).drops).toContain('x.json · improved · ar: not measured')
  })

  it('lexicon and improved score at or above every floor on every frozen set, with 0 unsupported suggestions', async () => {
    const measured = {}
    for (const set of Object.keys(floors.sets)) measured[set] = await measure(set)
    const { drops, rises, unsupported } = compareWithFloors(measured, floors.sets)
    if (rises.length) console.info(`Scores rose above the floors: update the floors in ${FLOORS_FILE} (in a PR that names the reason).\n${rises.join('\n')}`)
    expect(unsupported, 'every suggestion must quote text from the description').toEqual([])
    expect(drops, `Lower than the floors in ${FLOORS_FILE}`).toEqual([])
    // Deterministic: a second run gives exactly the same counts.
    const again = {}
    for (const set of Object.keys(floors.sets)) again[set] = await measure(set)
    expect(again).toEqual(measured)
  })
})
