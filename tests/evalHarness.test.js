import { describe, it, expect } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { assertLockMatches, assertNotFrozen, agreement, closestText, fileSha256, checkSet, checkSetV2, isSupported, loadSet, lockPathFor, score, toCsv, toMarkdown } from '../eval/project-suggest/lib.mjs'
import { AI_REVIEW_COLUMNS, AI_SET_VERSION, BLIND_ROW_ID, BLIND_STATEMENT, aiReviewSheet, checkDrafts, checkSetAiReviewed, importAiReview, resolveAiReview, sha256 } from '../eval/project-suggest/lib.mjs'
import { CAPABILITY_IDS, CASE_COLUMNS, LABEL_COLUMNS, capabilityCoverage, casesFromCsv, closestText, coverageReport, disagreementsMarkdown, importV2, labelsSheet, languageProblem, loadSet, parseCsv, resolveV2, toCsvText } from '../eval/project-suggest/lib.mjs'
import { lexicon } from '../eval/project-suggest/methods.mjs'
import { BOOTSTRAP, bootstrapInterval, seededRandom, withInterval } from '../eval/project-suggest/lib.mjs'
import { evaluateSuggestions } from '../src/ai/projectSuggest.js'

// Task 07 · the evaluation harness enforces its rules and never calls an outside service.
const tempSet = (cases, { frozen = false } = {}) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kamin-eval-'))
  const file = path.join(dir, 'testset.json')
  writeFileSync(file, JSON.stringify(cases))
  if (frozen) writeFileSync(lockPathFor(file), JSON.stringify({ file: 'testset.json', sha256: 'will-be-replaced' }))
  return { dir, file }
}
const freezeFor = file => writeFileSync(lockPathFor(file), JSON.stringify({ file: path.basename(file), sha256: fileSha256(file), frozenAt: '2026-11-10' }))

describe('frozen sets', () => {
  it('refuses tuning on a frozen set, in the library and from the command line', () => {
    const { file } = tempSet([{ id: 'x', lang: 'en', text: 'Wrote SQL queries.', expected: ['database'] }], { frozen: true })
    expect(() => assertNotFrozen(file)).toThrow(/REFUSED: testset\.json is frozen/)
    const cli = spawnSync(process.execPath, ['eval/project-suggest/eval.mjs', 'tune', file], { encoding: 'utf8' })
    expect(cli.status).toBe(1)
    expect(cli.stderr).toMatch(/REFUSED/)
  })

  it('refuses to run a frozen set whose sha256 changed', () => {
    const { file } = tempSet([{ id: 'x', lang: 'en', text: 'Wrote SQL queries.', expected: ['database'] }])
    freezeFor(file)
    expect(() => assertLockMatches(file)).not.toThrow()
    writeFileSync(file, JSON.stringify([{ id: 'x', lang: 'en', text: 'Wrote SQL queries!', expected: ['database'] }]))
    expect(() => assertLockMatches(file)).toThrow(/changed after it was frozen/)
  })
})

// Task 43 · uncertainty for the hybrid report (Task 39's rule: 2,000 draws, fixed seed, cases resampled).
describe('bootstrap intervals (Task 43)', () => {
  const rows = [
    { id: 'a', lang: 'en', tp: 2, fp: 0, fn: 0 }, { id: 'b', lang: 'en', tp: 1, fp: 1, fn: 1 }, { id: 'c', lang: 'ar', tp: 0, fp: 0, fn: 2 },
    { id: 'd', lang: 'ar', tp: 1, fp: 0, fn: 0 }, { id: 'e', lang: 'en', tp: 0, fp: 1, fn: 0 }, { id: 'f', lang: 'ar', tp: 3, fp: 0, fn: 1 },
  ]
  it('uses 2,000 draws and a fixed seed, so two runs give identical numbers', () => {
    expect(BOOTSTRAP).toEqual({ draws: 2000, seed: 43, level: 0.95 })
    const a = seededRandom(43), b = seededRandom(43)
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b))
    expect(bootstrapInterval(rows)).toEqual(bootstrapInterval(rows))
  })
  it('gives the point value inside its interval, per language, and the printed form "88.1% (95% CI a–b)"', () => {
    for (const lang of ['ar', 'en', 'all']) {
      const ci = bootstrapInterval(rows, { lang })
      for (const key of ['precision', 'recall', 'f1']) {
        expect(ci[key].low, `${lang} ${key}`).toBeLessThanOrEqual(ci[key].value)
        expect(ci[key].high, `${lang} ${key}`).toBeGreaterThanOrEqual(ci[key].value)
      }
    }
    expect(bootstrapInterval(rows).precision.value).toBeCloseTo(7 / 9)
    expect(bootstrapInterval([{ lang: 'en', tp: 3, fp: 0, fn: 0 }, { lang: 'en', tp: 1, fp: 0, fn: 0 }]).recall).toEqual({ value: 1, low: 1, high: 1 })
    expect(withInterval({ value: 0.881, low: 0.786, high: 0.951 })).toBe('88.1% (95% CI 78.6–95.1)')
    expect(withInterval({ value: null })).toBe('n/a')
  })
  it('refuses to tune the hybrid threshold on a test set', () => {
    const cli = spawnSync(process.execPath, ['eval/project-suggest/eval.mjs', 'tune', 'eval/project-suggest/testset.json', '--method', 'hybrid'], { encoding: 'utf8' })
    expect(cli.status).toBe(1)
    expect(cli.stderr).toMatch(/REFUSED/)
  })
  it('the committed hybrid report names the dev-only threshold, both frozen sets and an undecided ship rule (v2 has 0 cases)', () => {
    const report = readFileSync('eval/project-suggest/results/2026-11-21-hybrid.md', 'utf8')
    const config = JSON.parse(readFileSync('eval/project-suggest/config.json', 'utf8'))
    expect(report).toContain(`at **${config.hybrid.threshold}**`)
    expect(report).toContain(`Threshold tuned on \`dev-set.json\` only (sha256 \`${config.hybrid.tunedOnSha256}\``)
    const text = report.replace(/\r\n/g, '\n')
    for (const set of ['testset.json', 'testset-ai-v2.json']) expect(text).toContain(`## ${set}\n\n`)
    expect(text).toContain('## testset-v2.json\n\n**0 cases: not measurable.**')
    expect(report).toContain('testset-v2.json has 0 cases: **not decided**')
    // v1 numbers of the improved engine are unchanged (Task 08: 97.4 / 80.4 / 88.1)
    expect(report).toContain('| improved | All | 97.4% (95% CI ')
    expect(report).toMatch(/\| improved \| All \| 97\.4% \(95% CI [\d.–]+\) \| 80\.4% \(95% CI [\d.–]+\) \| 88\.1% /)
  })
})

describe('repository sets', () => {
  it('the v1 test set is the frozen 40-case set (sha256 f63fc3b1…186e) and tuning used the development set only', () => {
    const lock = assertLockMatches('eval/project-suggest/testset.json')
    expect(lock.sha256).toBe('f63fc3b1dc54c03479d92fa155ff95d08384229e61a5841c59e8d2947f99186e')
    expect(lock.cases).toBe(40)
    const config = JSON.parse(readFileSync('eval/project-suggest/config.json', 'utf8')).embedding
    expect(config).toMatchObject({ threshold: 0.52, tunedOn: 'dev-set.json', tunedOnSha256: fileSha256('eval/project-suggest/dev-set.json') })
    expect(config.tunedOnSha256).not.toBe(lock.sha256)
    expect(() => assertNotFrozen('eval/project-suggest/testset.json')).toThrow(/REFUSED/)
    expect(() => assertNotFrozen('eval/project-suggest/dev-set.json')).not.toThrow()
  })
})

describe('scoring rules', () => {
  const cases = [
    { id: 'a', lang: 'en', text: 'Wrote SQL queries. Planned milestones.', expected: ['database'] },
    { id: 'b', lang: 'en', text: 'Organised the college trip.', expected: [] },
    { id: 'c', lang: 'ar', text: 'كتبتُ استعلامات على قاعدة البيانات.', expected: ['database'] },
  ]
  it('counts a suggestion without verbatim supporting text as an error, even when the label is right', () => {
    const predictions = new Map([
      ['a', { suggestions: [{ skillId: 'database', support: 'Wrote SQL queries.' }, { skillId: 'project', support: 'Planned milestones.' }] }],
      ['b', { suggestions: [] }],
      ['c', { suggestions: [{ skillId: 'database', support: 'استخدمت قواعد البيانات' }] }],
    ])
    const { metrics, rows } = score(cases, predictions)
    expect(rows[0]).toMatchObject({ tp: 1, fp: 1, fn: 0, unsupported: 0 })
    expect(rows[2]).toMatchObject({ tp: 0, fp: 1, fn: 1, unsupported: 1 })
    expect(metrics.ar).toMatchObject({ tp: 0, fp: 1, fn: 1, unsupported: 1, precision: 0, recall: 0 })
    expect(metrics.all.unsupported).toBe(1)
  })

  it('reports correct abstentions separately and never counts them in precision or recall', () => {
    const { metrics, rows } = score(cases, new Map([['a', { suggestions: [] }], ['b', { suggestions: [] }], ['c', { suggestions: [] }]]))
    expect(rows[1]).toMatchObject({ abstained: true, correctAbstention: true })
    expect(rows[0]).toMatchObject({ wrongAbstention: true })
    expect(metrics.en).toMatchObject({ correctAbstentions: 1, shouldAbstainCases: 1, wrongAbstentions: 1, tp: 0, fp: 0, precision: null, recall: 0 })
    expect(toCsv(rows).split('\n')[0]).toContain('correct_abstention')
  })

  it('treats Arabic orthographic variants as the same words, but not a paraphrase', () => {
    expect(isSupported('كتبتُ استعلامات على قاعدة البيانات.', 'كتبت استعلامات على قاعدة البيانات.')).toBe(true)
    expect(isSupported('أنشأت جداول الإحصاء.', 'انشات جداول الاحصاء.')).toBe(true)
    expect(isSupported('Wrote   SQL\nqueries.', 'Wrote SQL queries.')).toBe(true)
    expect(isSupported('Wrote SQL queries.', 'Wrote database queries.')).toBe(false)
    expect(isSupported('Wrote SQL queries.', '')).toBe(false)
  })

  it('the lexicon method through the harness reproduces the engine’s own evaluation, deterministically', async () => {
    const labelled = JSON.parse(readFileSync('tests/fixtures/project-suggest-labelled.json', 'utf8'))
    const predict = async () => new Map(await Promise.all(labelled.map(async c => [c.id, await lexicon.predict(c.text)])))
    const first = score(labelled, await predict()).metrics, second = score(labelled, await predict()).metrics
    expect(second).toEqual(first)
    const engine = evaluateSuggestions(labelled)
    for (const lang of ['ar', 'en']) {
      expect(first[lang].precision).toBeCloseTo(engine[lang].precision, 10)
      expect(first[lang].recall).toBeCloseTo(engine[lang].recall, 10)
    }
    const md = toMarkdown({ meta: { method: 'lexicon', set: 'x.json', harness: 'h', methodVersion: 'v', commit: 'c', setSha256: 's', frozen: false, threshold: null, date: 'd' }, metrics: first })
    expect(md).toContain('| Arabic | 12 |')
  })
})

describe('test-set checks', () => {
  it('v1 check catches unknown capabilities and duplicates', () => {
    const { errors } = checkSet([{ id: 'a', lang: 'en', text: 'x yz', expected: ['nope'] }, { id: 'a', lang: 'fr', text: 'x yz', expected: [] }])
    expect(errors.join(' ')).toMatch(/unknown capability "nope"/)
    expect(errors.join(' ')).toMatch(/duplicate id/)
    expect(errors.join(' ')).toMatch(/lang must be ar or en/)
  })

  it('agreement: Cohen’s kappa on case × capability decisions', () => {
    const perfect = agreement([{ labels: { reviewerA: ['database'], reviewerB: ['database'] } }, { labels: { reviewerA: [], reviewerB: [] } }])
    expect(perfect.observed).toBe(1)
    expect(perfect.kappa).toBe(1)
    const split = agreement([{ labels: { reviewerA: ['database'], reviewerB: ['statistics'] } }])
    expect(split.exactCaseAgreement).toBe(0)
    expect(split.kappa).toBeLessThan(0.1)
  })

  it('v2 check requires human-written texts, two reviewers, enough Arabic/English, synonym, dialect and should-abstain cases, and recorded agreement', () => {
    const set = JSON.parse(readFileSync('eval/project-suggest/testset-v2.json', 'utf8'))
    expect(set).toMatchObject({ version: 'testset-v2', writtenBy: 'human' })
    // The real set (written and labelled by the team, frozen 2026-11-24) passes; the empty set it started as fails for every reason.
    expect(checkSetV2({ meta: set, cases: set.cases }).errors).toEqual([])
    const empty = { ...set, status: 'collecting', reviewers: { A: '', B: '' }, agreement: null, cases: [] }
    const { errors } = checkSetV2({ meta: empty, cases: empty.cases })
    const all = errors.join('\n')
    for (const needed of ['two different reviewers', 'ar has 0 cases', 'en has 0 cases', 'synonym', 'should-abstain', 'dialect', 'agreement must be recorded']) expect(all).toContain(needed)
    const bad = checkSetV2({ meta: { writtenBy: 'human', reviewers: { A: 'r1', B: 'r2' }, agreement: { observed: 1, kappa: 1 } }, cases: [
      { id: 'e1', lang: 'en', category: 'should-abstain', writtenBy: 'ai', author: 'x', text: 'Organised the trip.', labels: { reviewerA: ['project'], reviewerB: [], agreed: ['project'] }, expected: ['project'] },
    ] }, { otherTexts: ['Organised the trip.'] })
    const message = bad.errors.join('\n')
    expect(message).toContain('writtenBy must be "human"')
    expect(message).toContain('reviewers disagree; record labels.adjudication')
    expect(message).toContain('should-abstain case must have expected []')
    expect(message).toContain('also appears in the development or v1 set')
  })
})

// Task 38 · the v2 kit: spreadsheets in, testset-v2 JSON out, with the mechanical checks. Fixtures in
// tests/fixtures/v2-kit are clearly fake ("Fixture case …"); no real description is used here.
describe('v2 kit (Task 38)', () => {
  const FX = 'tests/fixtures/v2-kit'
  const fx = name => readFileSync(path.join(FX, name), 'utf8')
  const KIT = 'eval/project-suggest/v2-kit'
  const reviewers = { A: 'Fixture reviewer A', B: 'Fixture reviewer B' }
  const imported = () => importV2({ casesCsv: fx('cases.csv'), labelsACsv: fx('labels-a.csv'), labelsBCsv: fx('labels-b.csv'), reviewers })
  const resolved = () => resolveV2(imported().set, fx('resolved.csv')).set
  const v2 = set => checkSetV2({ meta: set, cases: set.cases })
  const capabilityCoverageOf = set => capabilityCoverage(set.cases)

  it('templates: UTF-8 with BOM, the agreed columns, every capability with its Arabic and English label', () => {
    for (const name of ['cases-template.csv', 'labels-template.csv', 'coverage-quota.csv']) expect(readFileSync(path.join(KIT, name), 'utf8').charCodeAt(0), name).toBe(0xFEFF)
    expect(parseCsv(readFileSync(path.join(KIT, 'cases-template.csv'), 'utf8'))).toEqual([[...CASE_COLUMNS]])
    const [labelsHeader] = parseCsv(readFileSync(path.join(KIT, 'labels-template.csv'), 'utf8'))
    expect(labelsHeader).toEqual([...LABEL_COLUMNS])
    expect(labelsHeader.slice(2, -1).map(h => h.split(' ')[0])).toEqual(CAPABILITY_IDS)
    expect(labelsHeader).toContain('database (قواعد البيانات / Databases)')
    const quota = parseCsv(readFileSync(path.join(KIT, 'coverage-quota.csv'), 'utf8'))
    for (const id of CAPABILITY_IDS) expect(quota.find(r => r[0] === `capability:${id}`)?.[3], id).toBe('3')
    expect(quota.find(r => r[0] === 'cases-ar')[3]).toBe('20')
  })

  it('the GUIDE is bilingual, names every capability and the rules (people write, no AI tools, no copying, label alone)', () => {
    const guide = readFileSync(path.join(KIT, 'GUIDE.md'), 'utf8')
    for (const id of CAPABILITY_IDS) expect(guide, id).toContain(`\`${id}\``)
    for (const text of ['People write every text', 'يكتب الناس كل النصوص', 'Each reviewer labels alone', 'كل مراجع يصنّف وحده', 'Do not copy or rephrase', 'Nobody runs any method on the set before it is frozen', 'at least 3 positive cases', 'final agreed labels', 'approved by the supervisor', 'معتمدة من المشرف', 'indicative']) expect(guide).toContain(text)
  })

  it('parses spreadsheet CSV: BOM, quotes, commas and line breaks inside a cell, CRLF', () => {
    expect(parseCsv('﻿id,text\r\n1,"a, ""b""\nc"\r\n\r\n2,d')).toEqual([['id', 'text'], ['1', 'a, "b"\nc'], ['2', 'd']])
    const round = toCsvText([['id', 'text'], ['x', 'قال، "نعم"']])
    expect(parseCsv(round)).toEqual([['id', 'text'], ['x', 'قال، "نعم"']])
  })

  it('import: both reviewers\' labels, Cohen\'s kappa and the disagreements; the writers\' target is not stored', () => {
    const { set, errors } = imported()
    expect(errors).toEqual([])
    expect(set).toMatchObject({ version: 'testset-v2', writtenBy: 'human', status: 'labelled', reviewers })
    expect(set.cases).toHaveLength(44)
    expect(set.agreement.kappa).toBeGreaterThan(0.9)
    expect(set.agreement.kappa).toBeLessThan(1)
    expect(set.agreement.decisions).toBe(44 * 11)
    for (const c of set.cases) { expect(c.writtenBy).toBe('human'); expect(c).not.toHaveProperty('target'); expect(c.expected).toEqual(c.labels.agreed) }
    const result = v2(set)
    expect(result.errors.sort()).toEqual(['ar-02: reviewers disagree; record labels.adjudication', 'en-03: reviewers disagree; record labels.adjudication', 'en-18: reviewers disagree; record labels.adjudication'])
    const md = disagreementsMarkdown(set)
    for (const id of ['ar-02', 'en-03', 'en-18']) expect(md).toContain(`## ${id}`)
    expect(md).toContain('disagreements: 3 · resolved: 0')
    expect(md).toContain('Not resolved yet')
  })

  it('resolve: the agreed labels and the reason; the fixture set then passes check --v2', () => {
    const set = resolved()
    expect(set.status).toBe('resolved')
    const en18 = set.cases.find(c => c.id === 'en-18')
    expect(en18.labels).toMatchObject({ reviewerA: [], reviewerB: ['statistics'], agreed: [], adjudication: 'Fixture resolution: nothing to suggest.' })
    expect(en18.expected).toEqual([])
    const result = v2(set)
    expect(result.errors).toEqual([])
    expect(result.agreement.kappa).toBeCloseTo(set.agreement.kappa, 3)
    expect(disagreementsMarkdown(set)).toContain('resolved: 3')
    // a resolved sheet that leaves a disagreement open is refused
    const partial = resolveV2(imported().set, fx('resolved-incomplete.csv'))
    expect(partial.set).toBeNull()
    expect(partial.errors.join('\n')).toMatch(/ar-02: reviewers disagree and the resolved sheet has no row/)
    expect(partial.errors.join('\n')).toMatch(/en-18: reviewers disagree and the resolved sheet has no row/)
  })

  it('refuses a reviewer sheet with a missing case, an unknown capability or a value other than 1', () => {
    const run = labels => importV2({ casesCsv: fx('cases.csv'), labelsACsv: fx('labels-a.csv'), labelsBCsv: fx(labels), reviewers })
    const missing = run('labels-b-missing-case.csv')
    expect(missing.set).toBeNull()
    expect(missing.errors).toContain('reviewer B sheet has no row for case en-05')
    const unknown = run('labels-b-unknown-capability.csv')
    expect(unknown.set).toBeNull()
    expect(unknown.errors.join('\n')).toMatch(/column "blockchain \(.*\)" is not a capability id/)
    const value = run('labels-b-bad-value.csv')
    expect(value.set).toBeNull()
    expect(value.errors.join('\n')).toMatch(/\(ar-05\): "yes" under .*use 1 or leave it empty/)
    expect(importV2({ casesCsv: fx('cases.csv'), labelsACsv: fx('labels-a.csv'), labelsBCsv: fx('labels-b.csv'), reviewers: { A: 'same', B: 'same' } }).errors).toContain('reviewer A and reviewer B must be different people')
  })

  it('a blank labels sheet has every id and text and nothing of the writers\' targets', () => {
    const { cases } = casesFromCsv(fx('cases.csv'))
    const rows = parseCsv(labelsSheet(cases))
    expect(rows[0]).toEqual([...LABEL_COLUMNS])
    expect(rows).toHaveLength(45)
    expect(rows.slice(1).every(r => r.slice(2).every(v => v === ''))).toBe(true)
  })

  it('language, copy and coverage checks', () => {
    const base = resolved()
    const withCase = (id, patch) => ({ ...base, cases: base.cases.map(c => c.id === id ? { ...c, ...patch } : c) })
    // wrong language blocks; tool names in Latin letters inside an Arabic case do not
    expect(languageProblem({ lang: 'ar', text: 'Wrote the SQL queries for the clinic.' })).toMatch(/marked Arabic/)
    expect(languageProblem({ lang: 'en', text: 'كتبت استعلامات قاعدة البيانات للعيادة.' })).toMatch(/marked English/)
    expect(languageProblem({ lang: 'ar', text: 'استخدمت SQL و Figma في المشروع.' })).toBeNull()
    expect(v2(withCase('ar-01', { text: 'Fixture case ar-01 in the wrong script.' })).errors).toContain('ar-01: marked Arabic but 100% of its letters are Latin')
    // copied from the v1, ai-v2 or development set (after normalising) blocks; close only warns
    const others = [
      ...loadSet('eval/project-suggest/testset.json').cases.map(c => ({ set: 'testset.json', id: c.id, text: c.text })),
      ...loadSet('eval/project-suggest/testset-ai-v2.json').cases.map(c => ({ set: 'testset-ai-v2.json', id: c.id, text: c.text })),
      ...loadSet('eval/project-suggest/dev-set.json').cases.map(c => ({ set: 'dev-set.json', id: c.id, text: c.text })),
    ]
    const aiCase = loadSet('eval/project-suggest/testset-ai-v2.json').cases.find(c => c.lang === 'en')
    const copied = checkSetV2({ meta: base, cases: withCase('en-01', { text: `${aiCase.text.toUpperCase()}!!` }).cases }, { otherTexts: others })
    expect(copied.errors.join('\n')).toContain(`en-01: text also appears in the development or v1 set or the ai-v2 set (testset-ai-v2.json ${aiCase.id})`)
    const words = aiCase.text.split(' ')
    const close = checkSetV2({ meta: base, cases: withCase('en-01', { text: [...words.slice(0, -1), 'quickly.'].join(' ') }).cases }, { otherTexts: others })
    expect(close.errors.join('\n')).not.toContain('en-01:')
    expect(close.warnings.join('\n')).toMatch(new RegExp(`en-01: close to testset-ai-v2.json ${aiCase.id}`))
    expect(closestText('Fixture case en-01: placeholder text, not a real description.', others)).toBeNull()
    // every capability needs 3 positive cases (both languages together); 1 per language is only a warning
    const short = { ...base, cases: base.cases.map(c => { const keep = c.expected.filter(id => id !== 'ai-work'); return { ...c, expected: keep, labels: { ...c.labels, agreed: keep } } }) }
    expect(v2(short).errors).toContain('set: capability "ai-work" has 0 positive case(s), needs at least 3 (both languages together)')
    // cyber only in English (3 cases): enough in total, so only a warning about Arabic
    const label = (c, ids) => ({ ...c, expected: ids, labels: { ...c.labels, agreed: ids } })
    const oneLanguage = { ...base, cases: base.cases.map(c => c.lang === 'ar' && c.expected.includes('cyber') ? label(c, c.expected.filter(id => id !== 'cyber')) : c.id === 'en-01' ? label(c, [...c.expected, 'cyber']) : c) }
    expect(capabilityCoverageOf(oneLanguage).cyber).toEqual({ ar: 0, en: 3, total: 3 })
    const capped = v2(oneLanguage)
    expect(capped.errors.join('\n')).not.toMatch(/"cyber"/)
    expect(capped.warnings).toContain('set: capability "cyber" has no Arabic positive case (aim for at least 1 per language)')
  })

  it('the 3-case minimum counts POSITIVE cases only: final agreed labels, once per case', () => {
    const base = resolved()
    const asCase = (id, text, labels, extra = {}) => ({ id, lang: 'en', category: 'direct', writtenBy: 'human', author: 'FX', text, labels: { reviewerA: labels.a, reviewerB: labels.b, agreed: labels.agreed, ...(labels.adjudication ? { adjudication: labels.adjudication } : {}) }, expected: labels.agreed, ...extra })
    const without = (c, cap) => ({ ...c, expected: c.expected.filter(id => id !== cap), labels: { ...c.labels, reviewerA: c.labels.reviewerA.filter(id => id !== cap), reviewerB: c.labels.reviewerB.filter(id => id !== cap), agreed: c.labels.agreed.filter(id => id !== cap) } })
    // ai-work is taken off every fixture case; then only cases that must NOT count are added
    const notPositive = [
      asCase('en-90', 'Fixture case en-90 mentions ai-work twice (ai-work) but is labelled database.', { a: ['database'], b: ['database'], agreed: ['database'] }),
      asCase('en-91', 'Fixture case en-91: only reviewer A labelled ai-work; resolved without it.', { a: ['ai-work'], b: [], agreed: [], adjudication: 'Fixture: not shown in the text.' }, { category: 'should-abstain' }),
      asCase('en-92', 'Fixture case en-92: reviewers disagree on ai-work; not resolved yet.', { a: ['ai-work', 'database'], b: ['database'], agreed: [] }),
    ]
    const set = { ...base, cases: [...base.cases.map(c => without(c, 'ai-work')), ...notPositive] }
    expect(capabilityCoverage(set.cases)['ai-work']).toEqual({ ar: 0, en: 0, total: 0 })
    expect(v2(set).errors).toContain('set: capability "ai-work" has 0 positive case(s), needs at least 3 (both languages together)')
    // the same capability twice in one case counts once
    const agreeOn = (c, ids, adjudication) => ({ ...c, expected: ids, labels: { ...c.labels, reviewerA: ids, reviewerB: ids, agreed: ids, ...(adjudication ? { adjudication } : {}) } })
    const twice = { ...set, cases: set.cases.map(c => c.id === 'en-90' ? agreeOn(c, ['database', 'ai-work', 'ai-work']) : c) }
    expect(capabilityCoverage(twice.cases)['ai-work']).toEqual({ ar: 0, en: 1, total: 1 })
    // three agreed positive cases meet the rule (a disagreement counts once it is resolved with the capability)
    const resolvedWith = c => ({ ...c, expected: ['database', 'ai-work'], labels: { ...c.labels, agreed: ['database', 'ai-work'], adjudication: 'Fixture: agreed after discussion.' } })
    const three = { ...set, cases: set.cases.map(c => c.id === 'en-90' ? agreeOn(c, ['database', 'ai-work']) : c.id === 'en-92' ? resolvedWith(c) : c.id === 'ar-01' ? agreeOn(c, [...c.expected, 'ai-work']) : c) }
    expect(capabilityCoverage(three.cases)['ai-work']).toEqual({ ar: 1, en: 2, total: 3 })
    expect(v2(three).errors.join('\n')).not.toMatch(/"ai-work"/)
    // a writer's target is never stored in the set, so it cannot count in check or freeze
    expect(imported().set.cases.every(c => !('target' in c))).toBe(true)
  })

  it('live coverage: from the writers\' targets before labelling, from the agreed labels after', () => {
    const { cases, targets } = casesFromCsv(fx('cases.csv'))
    const planned = coverageReport(cases, { targets })
    expect(planned.perCapability.cyber).toEqual({ ar: 2, en: 2, total: 4 })
    expect(planned.byCategory.dialect).toEqual({ ar: 2, en: 0 })
    expect(planned.gaps).toEqual([])
    expect(planned.text).toContain('Quota met.')
    const few = coverageReport(cases.slice(0, 5), { targets })
    expect(few.gaps).toContain('ar: 5 of 20 cases')
    expect(few.gaps.some(g => /^cyber: \d of 3 planned positive cases$/.test(g))).toBe(true)
    expect(few.text).toContain('planned cases; need ≥3 total')
    // after labelling: positive cases from the final agreed labels
    const after = coverageReport(resolved().cases)
    expect(after.perCapability.project.total).toBe(4)
    expect(after.text).toContain('positive cases; need ≥3 total')
    expect(after.text).toContain('final agreed labels only')
  })

  it('command line: import-v2 → resolve-v2 → check --v2 on a copy; the repository v2 set is never touched', () => {
    const repoSet = 'eval/project-suggest/testset-v2.json', before = fileSha256(repoSet)
    const dir = mkdtempSync(path.join(tmpdir(), 'kamin-v2kit-'))
    const set = path.join(dir, 'v2.json'), report = path.join(dir, 'disagreements.md')
    const cli = (...args) => spawnSync(process.execPath, ['eval/project-suggest/eval.mjs', ...args], { encoding: 'utf8' })
    const imp = cli('import-v2', `${FX}/cases.csv`, `${FX}/labels-a.csv`, `${FX}/labels-b.csv`, '--reviewer-a', reviewers.A, '--reviewer-b', reviewers.B, '--set', set, '--report', report)
    expect(imp.status, imp.stderr).toBe(0)
    expect(imp.stdout).toMatch(/Cohen's kappa 0\.9\d+/)
    expect(imp.stdout).toContain('3 problem(s) before it can be frozen')
    expect(readFileSync(report, 'utf8')).toContain('## en-03')
    const res = cli('resolve-v2', `${FX}/resolved.csv`, '--set', set, '--report', report)
    expect(res.status, res.stderr).toBe(0)
    expect(res.stdout).toContain('check --v2: OK')
    const check = cli('check', set, '--v2')
    expect(check.status, check.stderr).toBe(0)
    // importing again would lose the resolutions: refused without --replace
    const again = cli('import-v2', `${FX}/cases.csv`, `${FX}/labels-a.csv`, `${FX}/labels-b.csv`, '--reviewer-a', reviewers.A, '--reviewer-b', reviewers.B, '--set', set, '--report', report)
    expect(again.status).toBe(1)
    expect(again.stderr).toMatch(/already has resolved labels/)
    // a frozen set is never written
    writeFileSync(lockPathFor(set), JSON.stringify({ file: 'v2.json', sha256: fileSha256(set) }))
    const frozen = cli('resolve-v2', `${FX}/resolved.csv`, '--set', set, '--report', report)
    expect(frozen.status).toBe(1)
    expect(frozen.stderr).toMatch(/REFUSED: v2\.json is frozen/)
    // a broken reviewer sheet writes nothing
    const bad = cli('import-v2', `${FX}/cases.csv`, `${FX}/labels-a.csv`, `${FX}/labels-b-missing-case.csv`, '--reviewer-a', 'a', '--reviewer-b', 'b', '--set', path.join(dir, 'other.json'), '--report', report)
    expect(bad.status).toBe(1)
    expect(bad.stderr).toMatch(/Nothing written/)
    expect(() => readFileSync(path.join(dir, 'other.json'))).toThrow()
    expect(fileSha256(repoSet)).toBe(before)
  })
})

// Task 38b · Claude-drafted cases: kept apart from the human set, reviewed blind by two people.
describe('Claude-drafted cases (Task 38b)', () => {
  const AI = 'eval/project-suggest/ai-drafts'
  const FX = 'tests/fixtures/ai-review'
  const fx = name => readFileSync(path.join(FX, name), 'utf8')
  const fxDrafts = () => loadSet(path.join(FX, 'drafts.json'))
  const fxDraftsSha = () => fileSha256(path.join(FX, 'drafts.json'))
  const fxProposed = () => ({ proposed: JSON.parse(fx('proposed-labels.json')), proposedSha256: fileSha256(path.join(FX, 'proposed-labels.json')) })
  const reviewers = { A: 'Fixture A', B: 'Fixture B' }
  const imported = () => importAiReview({ drafts: fxDrafts(), draftsSha256: fxDraftsSha(), reviewACsv: fx('review-a.csv'), reviewBCsv: fx('review-b.csv'), reviewers }).set
  const resolved = () => resolveAiReview(imported(), fx('resolved.csv'), fxProposed()).set
  const verify = set => checkSetAiReviewed({ meta: set, cases: set.cases }, { drafts: fxDrafts(), draftsSha256: fxDraftsSha() })
  const otherSets = () => ['dev-set.json', 'testset.json', 'testset-ai-v2.json', 'testset-v2.json'].flatMap(f => loadSet(`eval/project-suggest/${f}`).cases.map(c => ({ set: f, id: c.id, text: c.text })))
  const gitShow = (commit, file) => spawnSync('git', ['show', `${commit}:${file}`], { maxBuffer: 1 << 26 })
  const cli = (...args) => spawnSync(process.execPath, ['eval/project-suggest/eval.mjs', ...args], { encoding: 'utf8' })

  it('the repository drafts: 40 (20 ar, 20 en), AI origin on every case, no labels inside, all checks clean, LF bytes', () => {
    const drafts = loadSet(`${AI}/drafts.json`)
    expect(drafts.cases).toHaveLength(40)
    expect(drafts.cases.filter(c => c.lang === 'ar')).toHaveLength(20)
    expect(drafts.meta).toMatchObject({ version: 'ai-drafts-v1', writtenBy: 'ai', generation: { model: 'claude-opus-5-5' } })
    expect(drafts.meta.generation.method).toMatch(/Not opened while drafting/)
    for (const c of drafts.cases) { expect(c).toMatchObject({ writtenBy: 'ai', model: 'claude-opus-5-5' }); expect(c).not.toHaveProperty('expected'); expect(c).not.toHaveProperty('labels') }
    const result = checkDrafts(drafts, { otherTexts: otherSets() })
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(readFileSync(`${AI}/drafts.json`).includes(0x0d)).toBe(false)
    expect(readFileSync('.gitattributes', 'utf8')).toContain('eval/project-suggest/ai-drafts/*.json text eol=lf')
  })

  it('Claude\'s labels and self-review are sealed: out of the tree, committed by sha256, and that commitment matches git history', () => {
    const { sealed } = loadSet(`${AI}/drafts.json`).meta
    for (const key of ['proposedLabels', 'selfReview']) {
      expect(existsSync(sealed[key].path), `${sealed[key].path} must not be in the working tree`).toBe(false)
      const blob = gitShow(sealed[key].commit, sealed[key].path)
      expect(blob.status, `git show ${sealed[key].commit}:${sealed[key].path}`).toBe(0)
      expect(sha256(blob.stdout)).toBe(sealed[key].sha256)
    }
    // the sealed proposals are complete, consistent with the categories and meet the coverage aim
    const drafts = loadSet(`${AI}/drafts.json`)
    const blob = gitShow(sealed.proposedLabels.commit, sealed.proposedLabels.path).stdout
    const proposed = JSON.parse(blob.toString('utf8'))
    const checked = checkDrafts(drafts, { proposed, proposedSha256: sha256(blob), otherTexts: otherSets() })
    expect(checked.errors).toEqual([])
    const cov = capabilityCoverage(drafts.cases.map(c => ({ lang: c.lang, expected: proposed.labels[c.id].labels })))
    for (const id of CAPABILITY_IDS) { expect(cov[id].total, id).toBeGreaterThanOrEqual(3); expect(cov[id].ar, id).toBeGreaterThanOrEqual(1); expect(cov[id].en, id).toBeGreaterThanOrEqual(1) }
    // a commitment that does not match is reported
    expect(checkDrafts(drafts, { proposed, proposedSha256: 'a'.repeat(64) }).errors.join('\n')).toMatch(/does not match the sealed commitment/)
    // the reviewer-facing summary names no proposed capability
    const summary = readFileSync(`${AI}/self-review-summary.md`, 'utf8')
    for (const id of CAPABILITY_IDS) expect(summary, id).not.toContain(`\`${id}\``)
    expect(summary).toContain(sealed.selfReview.sha256)
    expect(readFileSync(`${AI}/README.md`, 'utf8')).toMatch(/cannot erase|does not erase/)
  })

  it('the human set is protected: human-only, frozen, no Claude draft in it, and refuses any Claude draft', () => {
    const v2 = JSON.parse(readFileSync('eval/project-suggest/testset-v2.json', 'utf8'))
    expect(v2).toMatchObject({ version: 'testset-v2', writtenBy: 'human' })
    expect(assertLockMatches('eval/project-suggest/testset-v2.json').sha256).toBe(fileSha256('eval/project-suggest/testset-v2.json'))
    const draftTexts = new Set(loadSet(`${AI}/drafts.json`).cases.map(c => c.text.trim()))
    expect(v2.cases.filter(c => draftTexts.has(c.text.trim())).map(c => c.id)).toEqual([])
    expect(existsSync('eval/project-suggest/testset-ai-v3.json')).toBe(false)
    const draft = loadSet(`${AI}/drafts.json`).cases[0]
    const casesCsv = toCsvText([[...CASE_COLUMNS], [draft.id.replace('aid-', ''), draft.lang, draft.category, `  ${draft.text.toUpperCase()} `, 'student', 'X', '']])
    const labels = toCsvText([[...LABEL_COLUMNS], [draft.id.replace('aid-', ''), draft.text, ...CAPABILITY_IDS.map(() => ''), '']])
    const refused = importV2({ casesCsv, labelsACsv: labels, labelsBCsv: labels, reviewers: { A: 'a', B: 'b' }, forbiddenTexts: [draft.text] })
    expect(refused.set).toBeNull()
    expect(refused.errors.join('\n')).toMatch(/is a Claude-drafted case .* can never enter the human set/)
    const asV2 = checkSetV2({ meta: { writtenBy: 'human' }, cases: [{ id: 'x', lang: draft.lang, category: 'direct', writtenBy: 'human', author: 'X', text: draft.text, labels: { reviewerA: [], reviewerB: [], agreed: [] }, expected: [] }] }, { otherTexts: [{ set: 'ai-drafts/drafts.json', id: draft.id, text: draft.text }] })
    expect(asV2.errors.join('\n')).toContain(`x: text also appears in the development or v1 set or the ai-v2 set (ai-drafts/drafts.json ${draft.id})`)
  })

  it('reviewers see the text only, after a blindness confirmation row: no category, no proposed labels', () => {
    const rows = parseCsv(aiReviewSheet(fxDrafts().cases))
    expect(rows[0]).toEqual([...AI_REVIEW_COLUMNS])
    expect(rows[0]).not.toContain('category')
    expect(rows[1].slice(0, 3)).toEqual([BLIND_ROW_ID, BLIND_STATEMENT, ''])
    expect(rows.slice(2).map(r => r.slice(2).every(v => v === ''))).toEqual(Array(6).fill(true))
    expect(aiReviewSheet(fxDrafts().cases)).not.toMatch(/should-abstain|direct/)
  })

  it('import: both confirmations stored, each reviewer\'s decisions, kappa on the drafts neither rejected; only both-keep-same-labels is settled', () => {
    const set = imported()
    expect(set).toMatchObject({ version: AI_SET_VERSION, writtenBy: 'ai', humanReviewed: true, reviewers, reviewerDecisions: { A: { keep: 4, edit: 1, reject: 1 }, B: { keep: 6, edit: 0, reject: 0 } } })
    expect(set.reviewerConfirmations.A).toEqual({ confirmed: true, statement: BLIND_STATEMENT, note: 'Fixture reviewer A' })
    expect(set.reviewerConfirmations.B.confirmed).toBe(true)
    expect(set.proposedLabels).toMatchObject({ sealedSha256: fxDrafts().meta.sealed.proposedLabels.sha256, verified: false })
    expect(set.agreement).toMatchObject({ cases: 5, decisions: 55 })
    expect(set.cases.filter(c => c.settled).map(c => c.id)).toEqual(['aid-en-01', 'aid-ar-02', 'aid-ar-03'])
    for (const c of set.cases) { expect(c.origin).toMatchObject({ model: 'fixture-model', draftId: c.id }); expect(c).not.toHaveProperty('claudeProposed') }
    expect(verify(set).errors).toContain('aid-en-02: not settled by the reviews; resolve it (resolve-ai-review)')
    const md = disagreementsMarkdown(set)
    expect(md).toContain('Reviewer A: **edit** → “')
    expect(md).toContain('Reviewer A: **reject**')
  })

  it('import refuses: no blindness confirmation, unknown decision, a rejected draft with labels, an edit without text, a missing draft, one person twice, no sealed commitment', () => {
    const run = (b, extra = {}) => importAiReview({ drafts: fxDrafts(), draftsSha256: fxDraftsSha(), reviewACsv: fx('review-a.csv'), reviewBCsv: fx(b), reviewers, ...extra })
    const unconfirmed = run('review-b-unconfirmed.csv')
    expect(unconfirmed.set).toBeNull()
    expect(unconfirmed.errors.join('\n')).toMatch(/reviewer B sheet: the reviewer must confirm blindness/)
    const bad = run('review-b-bad.csv')
    expect(bad.set).toBeNull()
    const all = bad.errors.join('\n')
    expect(all).toContain('reviewer B sheet (aid-en-02): decision must be keep, edit or reject')
    expect(all).toContain('reviewer B sheet (aid-en-03): a rejected draft has no labels')
    expect(all).toContain('reviewer B sheet (aid-ar-01): "edit" needs the edited text in edited_text')
    expect(all).toContain('reviewer B sheet has no row for draft aid-ar-03')
    expect(run('review-b.csv', { reviewers: { A: 's', B: 's' } }).errors).toContain('reviewer A and reviewer B must be different people')
    const noSeal = fxDrafts(); delete noSeal.meta.sealed
    expect(importAiReview({ drafts: noSeal, draftsSha256: 'x', reviewACsv: fx('review-a.csv'), reviewBCsv: fx('review-b.csv'), reviewers }).errors).toContain('drafts: no sealed commitment to Claude\'s proposed labels')
  })

  it('resolve needs Claude\'s original labels matching the seal, and keeps them on every draft, rejected ones included', () => {
    const missing = resolveAiReview(imported(), fx('resolved.csv'), {})
    expect(missing.set).toBeNull()
    expect(missing.errors.join('\n')).toMatch(/proposed labels are required to resolve/)
    const changed = fxProposed(); changed.proposed.labels['aid-en-01'].labels = ['software']
    const modified = resolveAiReview(imported(), fx('resolved.csv'), { proposed: changed.proposed, proposedSha256: sha256(JSON.stringify(changed.proposed)) })
    expect(modified.set).toBeNull()
    expect(modified.errors.join('\n')).toMatch(/do not match the sealed commitment/)
    const set = resolved()
    expect(set.status).toBe('resolved')
    expect(set.proposedLabels).toMatchObject({ verified: true, sha256: set.proposedLabels.sealedSha256 })
    expect(set.counts).toEqual({ kept: 4, edited: 1, rejected: 1 })
    expect(set.cases.map(c => c.id)).not.toContain('aid-en-03')
    expect(set.rejected).toEqual([expect.objectContaining({ id: 'aid-en-03', claudeProposed: ['project'], labels: { reviewerA: [], reviewerB: [] }, reason: 'Fixture resolution: not realistic.' })])
    expect(Object.fromEntries(set.cases.map(c => [c.id, c.claudeProposed]))).toEqual({ 'aid-en-01': ['database'], 'aid-en-02': ['testing'], 'aid-ar-01': ['software', 'project'], 'aid-ar-02': ['cyber'], 'aid-ar-03': [] })
    const edited = set.cases.find(c => c.id === 'aid-ar-01')
    expect(edited).toMatchObject({ humanEdited: true, finalDecision: 'edit', writtenBy: 'ai', expected: ['software'] })
    expect(edited.text).not.toBe(edited.origin.draftText)
    expect(set.claudeVsHuman.exactCaseAgreement).toBeCloseTo(0.8, 5)
    expect(verify(set).errors).toEqual([])
    const partial = resolveAiReview(imported(), toCsvText([[...AI_REVIEW_COLUMNS]]), fxProposed())
    expect(partial.set).toBeNull()
    expect(partial.errors.join('\n')).toMatch(/aid-en-02: not settled/)
  })

  it('the check recomputes everything: tampered flags, kappa, counts, Claude comparison, missing or duplicate drafts, hash and origin mismatches', () => {
    const errorsOf = mutate => { const set = structuredClone(resolved()); mutate(set); return verify(set).errors.join('\n') }
    // a stored "settled" flag that the reviews do not support (and the adjudication that resolved it removed)
    expect(errorsOf(s => { const c = s.cases.find(c => c.id === 'aid-en-02'); delete c.labels.adjudication })).toMatch(/aid-en-02: not settled by the reviews/)
    expect(errorsOf(s => { s.cases.find(c => c.id === 'aid-en-01').settled = false })).toMatch(/aid-en-01: stored "settled" \(false\) does not match the reviews \(true\)/)
    // agreed labels changed without a resolution
    expect(errorsOf(s => { const c = s.cases.find(c => c.id === 'aid-en-01'); c.labels.agreed = ['cyber']; c.expected = ['cyber'] })).toMatch(/aid-en-01: agreed labels differ from both reviewers' labels without a resolution/)
    // recorded kappa that does not match the labels
    expect(errorsOf(s => { s.agreement.kappa = 0.99 })).toMatch(/recorded agreement \(kappa 0\.99 on 5 drafts\) does not match the reviews/)
    // a draft missing from the set, or present twice
    expect(errorsOf(s => { s.cases = s.cases.filter(c => c.id !== 'aid-ar-03'); s.counts.kept-- })).toMatch(/aid-ar-03: draft is missing from the set/)
    expect(errorsOf(s => { s.rejected.push({ ...s.rejected[0], id: 'aid-en-01' }); s.counts.rejected++ })).toMatch(/aid-en-01: appears 2 times across cases and rejected/)
    // counts, Claude comparison and Claude's labels
    expect(errorsOf(s => { s.counts.kept = 5 })).toMatch(/recorded counts .* do not match the cases/)
    expect(errorsOf(s => { s.claudeVsHuman.observed = 1 })).toMatch(/recorded Claude-vs-human agreement does not match/)
    expect(errorsOf(s => { delete s.rejected[0].claudeProposed })).toMatch(/aid-en-03: Claude's original proposed labels \(claudeProposed\) are missing/)
    expect(errorsOf(s => { s.proposedLabels.verified = false })).toMatch(/were not verified against the sealed commitment/)
    // confirmations, origin, text and hashes
    expect(errorsOf(s => { s.reviewerConfirmations.B.confirmed = false })).toMatch(/reviewer B's blindness confirmation is missing/)
    expect(errorsOf(s => { s.cases[0].origin.draftText = 'Fixture draft changed: placeholder text here.' })).toMatch(/aid-en-01: origin does not match the drafts file/)
    expect(errorsOf(s => { s.cases[0].text = 'Fixture draft aid-en-01: quietly changed text.' })).toMatch(/aid-en-01: text does not match the final decision \(keep\)/)
    expect(errorsOf(s => { s.drafts.sha256 = 'a'.repeat(64) })).toMatch(/drafts sha256 a+ does not match the drafts file/)
    expect(errorsOf(s => { s.proposedLabels.sealedSha256 = 'b'.repeat(64); s.proposedLabels.sha256 = 'b'.repeat(64) })).toMatch(/proposed-labels commitment does not match the drafts file/)
    // without the drafts file nothing can be verified
    expect(checkSetAiReviewed({ meta: resolved(), cases: resolved().cases }).errors).toContain('set: the drafts file is needed to verify the set (ai-drafts/drafts.json)')
  })

  it('the reviewed AI set must keep its origin; it can never pose as the human set', () => {
    const set = resolved()
    expect(checkSetV2({ meta: set, cases: set.cases }).errors.join('\n')).toMatch(/writtenBy must be "human"/)
    const stripped = { ...set, writtenBy: 'human', cases: set.cases.map(({ origin, ...c }) => ({ ...c, writtenBy: 'human' })) }
    const result = checkSetAiReviewed({ meta: stripped, cases: stripped.cases }, { drafts: fxDrafts(), draftsSha256: fxDraftsSha() }).errors.join('\n')
    expect(result).toContain('set: writtenBy must be "ai" with humanReviewed true')
    expect(result).toMatch(/writtenBy "ai" and origin \(model, draftId\) are required/)
  })

  it('command line on a copy: sheet, import, unseal gate, resolve, check, freeze gate; never into testset-v2.json', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'kamin-ai-review-'))
    const set = path.join(dir, 'ai.json'), report = path.join(dir, 'd.md')
    expect(cli('ai-review-sheet', path.join(dir, 'sheet.csv'), '--drafts', `${FX}/drafts.json`).status).toBe(0)
    expect(parseCsv(readFileSync(path.join(dir, 'sheet.csv'), 'utf8'))).toHaveLength(8)
    // Claude's labels stay sealed until both confirmed sheets are imported
    const early = cli('unseal-proposed', set, '--out', path.join(dir, 'sealed'))
    expect(early.status).toBe(1)
    expect(early.stderr).toMatch(/stay sealed until both reviewers' sheets are imported/)
    const common = ['--drafts', `${FX}/drafts.json`, '--report', report]
    expect(cli('import-ai-review', `${FX}/review-a.csv`, `${FX}/review-b-unconfirmed.csv`, '--reviewer-a', 'A', '--reviewer-b', 'B', '--set', set, ...common).status).toBe(1)
    const imp = cli('import-ai-review', `${FX}/review-a.csv`, `${FX}/review-b.csv`, '--reviewer-a', 'A', '--reviewer-b', 'B', '--set', set, ...common)
    expect(imp.status, imp.stderr).toBe(0)
    expect(imp.stdout).toContain('reviewer confirmations (did not open Claude\'s labels): A true, B true')
    // frozen only after resolution
    const tooEarly = cli('freeze', set, '--drafts', `${FX}/drafts.json`)
    expect(tooEarly.status).toBe(1)
    expect(tooEarly.stderr).toMatch(/Cannot freeze/)
    // the real sealed labels unseal from git history and match their commitment
    const unsealed = cli('unseal-proposed', set, '--out', path.join(dir, 'sealed'))
    expect(unsealed.status, unsealed.stderr).toBe(0)
    expect(unsealed.stdout).toMatch(/proposed-labels\.json \(sha256 [0-9a-f]{64}, matches the commitment\)/)
    // resolve refuses without Claude's labels, then succeeds with the matching fixture file
    const noProposed = cli('resolve-ai-review', `${FX}/resolved.csv`, '--set', set, '--proposed', path.join(dir, 'none.json'), ...common)
    expect(noProposed.status).toBe(1)
    expect(noProposed.stderr).toMatch(/proposed labels are required to resolve/)
    const res = cli('resolve-ai-review', `${FX}/resolved.csv`, '--set', set, '--proposed', `${FX}/proposed-labels.json`, ...common)
    expect(res.status, res.stderr).toBe(0)
    expect(res.stdout).toContain('final: kept 4, edited 1, rejected 1')
    expect(res.stdout).toContain('check: OK')
    expect(cli('check', set, '--drafts', `${FX}/drafts.json`).status).toBe(0)
    const before = fileSha256('eval/project-suggest/testset-v2.json')
    const intoHuman = cli('import-ai-review', `${FX}/review-a.csv`, `${FX}/review-b.csv`, '--reviewer-a', 'A', '--reviewer-b', 'B', '--set', 'eval/project-suggest/testset-v2.json', ...common)
    expect(intoHuman.status).toBe(1)
    // Refused either way: Claude's cases never go into the human set, and the human set is now frozen.
    expect(intoHuman.stderr).toMatch(/never go into the human set|is frozen/)
    expect(fileSha256('eval/project-suggest/testset-v2.json')).toBe(before)
  })
})

describe('no outside network', () => {
  const files = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? (name === 'results' ? [] : files(p)) : [p] })
  it('eval/ contains no external API endpoints, keys or fetch calls', () => {
    for (const file of files('eval')) {
      const text = readFileSync(file, 'utf8')
      for (const banned of ['api.openai.com', 'generativelanguage', 'x-goog-api-key', 'LLM_PRICES', 'geminiSuggest', 'fetch(']) expect(text, `${file} contains ${banned}`).not.toContain(banned)
      expect(text, `${file} contains a URL`).not.toMatch(/https?:\/\//)
    }
  })
})

// Task 77 · the workflow sets: a development set (tuned on) and a test set written by Claude, frozen by sha256
// before any method ran on it, never tuned on. Neither copies another set.
describe('Task 77 · workflow sets', () => {
  const DIR = 'eval/project-suggest'
  const PROVENANCE = 'Written by Claude, approved by team and supervisor (stated by Amjd 2026-11-18)'
  it('the test set is frozen (40 cases, sha256 7ef9ae73…738e), labelled with its provenance, and cannot be tuned on', () => {
    const lock = assertLockMatches(`${DIR}/testset-workflow.json`)
    expect(lock).toMatchObject({ sha256: '7ef9ae73f26d4e0158cbfc556bb7d1c5937cd1e1a01780d3f686f3e67e62738e', cases: 40 })
    const set = loadSet(`${DIR}/testset-workflow.json`)
    expect(set.meta).toMatchObject({ provenance: PROVENANCE, writtenBy: 'ai', status: 'frozen-before-method' })
    expect(checkSet(set.cases).errors).toEqual([])
    expect(set.cases.length).toBeGreaterThanOrEqual(30)
    for (const lang of ['ar', 'en']) expect(set.cases.filter(c => c.lang === lang && !c.expected.length).length, lang).toBeGreaterThanOrEqual(5)
    expect(() => assertNotFrozen(`${DIR}/testset-workflow.json`)).toThrow(/REFUSED/)
  })
  it('the development set has 20+ new cases in Arabic and English, is not frozen, and shares no text with any other set', () => {
    const dev = loadSet(`${DIR}/dev-set-workflow.json`)
    expect(dev.meta.provenance).toBe(PROVENANCE)
    expect(checkSet(dev.cases).errors).toEqual([])
    expect(dev.cases.length).toBeGreaterThanOrEqual(20)
    for (const lang of ['ar', 'en']) expect(dev.cases.filter(c => c.lang === lang).length, lang).toBeGreaterThanOrEqual(10)
    expect(() => assertNotFrozen(`${DIR}/dev-set-workflow.json`)).not.toThrow()
    const sets = ['dev-set.json', 'testset.json', 'testset-ai-v2.json', 'ai-drafts/drafts.json', 'dev-set-workflow.json', 'testset-workflow.json']
    const all = sets.flatMap(set => loadSet(`${DIR}/${set}`).cases.map(c => ({ set, id: c.id, text: c.text })))
    for (const set of ['dev-set-workflow.json', 'testset-workflow.json']) for (const c of all.filter(x => x.set === set)) {
      expect(closestText(c.text, all.filter(x => x.set !== set)), `${set} ${c.id}`).toBeNull()
    }
  })
  it('the report on the frozen set shows before and after with bootstrap intervals and no unsupported suggestion', () => {
    const report = readFileSync(`${DIR}/results/2026-11-22-workflow.md`, 'utf8')
    for (const set of ['testset-workflow.json', 'dev-set-workflow.json', 'dev-set.json', 'testset.json', 'testset-ai-v2.json']) expect(report).toContain(`## ${set}\n\n`)
    expect(report).toContain('2000 draws, seed 43, 95% percentile interval')
    const after = JSON.parse(readFileSync(`${DIR}/results/2026-11-22-workflow/after-testset-workflow.json`, 'utf8'))
    expect(after.meta).toMatchObject({ methodVersion: 'kamin-project-suggest-improved-v2', setSha256: '7ef9ae73f26d4e0158cbfc556bb7d1c5937cd1e1a01780d3f686f3e67e62738e' })
    expect(after.metrics.all.unsupported).toBe(0)
  })
})

// Task 80 · the dialect sets: a development set (tuned on) and a test set written by Claude, frozen by sha256 and
// committed on its own before any method ran on it, never tuned on. Results per variety (dialect, MSA, English, mixed).
describe('Task 80 · dialect sets', () => {
  const DIR = 'eval/project-suggest'
  const PROVENANCE = 'Written by Claude, approved by team and supervisor (stated by Amjd 2026-11-18)'
  const SHA = '67010db0ecb5794fceab0313621bc61d831076ac7ee6b2e26bd50fbe9c2681bc'
  const count = (cases, v, neg) => cases.filter(c => c.variety === v && (neg === undefined || !c.expected.length === neg)).length
  it('the test set is frozen (66 cases), at least half dialect, every variety with should-abstain cases, every capability 4+ times', () => {
    expect(assertLockMatches(`${DIR}/testset-dialect.json`)).toMatchObject({ sha256: SHA, cases: 66 })
    const set = loadSet(`${DIR}/testset-dialect.json`)
    expect(set.meta).toMatchObject({ provenance: PROVENANCE, writtenBy: 'ai', status: 'frozen-before-method' })
    expect(checkSet(set.cases).errors).toEqual([])
    expect(set.cases.length).toBeGreaterThanOrEqual(60)
    expect(count(set.cases, 'dialect') * 2).toBeGreaterThanOrEqual(set.cases.length)
    for (const v of ['dialect', 'msa', 'en', 'mixed']) { expect(count(set.cases, v), v).toBeGreaterThanOrEqual(10); expect(count(set.cases, v, true), v).toBeGreaterThanOrEqual(2) }
    for (const c of set.cases) { expect(c.variety === 'en' ? 'en' : 'ar', c.id).toBe(c.lang); if (c.variety !== 'en') expect(/[A-Za-z]{2,}/.test(c.text), c.id).toBe(c.variety === 'mixed') }
    for (const id of CAPABILITY_IDS) expect(set.cases.filter(c => c.expected.includes(id)).length, id).toBeGreaterThanOrEqual(4)
    expect(() => assertNotFrozen(`${DIR}/testset-dialect.json`)).toThrow(/REFUSED/)
  })
  it('the development set has 40+ cases, mostly dialect, is not frozen, and neither set shares a text with any other set', () => {
    const dev = loadSet(`${DIR}/dev-set-dialect.json`)
    expect(dev.meta.provenance).toBe(PROVENANCE)
    expect(checkSet(dev.cases).errors).toEqual([])
    expect(dev.cases.length).toBeGreaterThanOrEqual(40)
    expect(count(dev.cases, 'dialect') * 2).toBeGreaterThan(dev.cases.length)
    expect(() => assertNotFrozen(`${DIR}/dev-set-dialect.json`)).not.toThrow()
    const sets = ['dev-set.json', 'testset.json', 'testset-ai-v2.json', 'ai-drafts/drafts.json', 'dev-set-workflow.json', 'testset-workflow.json', 'dev-set-dialect.json', 'testset-dialect.json']
    const all = sets.flatMap(set => loadSet(`${DIR}/${set}`).cases.map(c => ({ set, id: c.id, text: c.text })))
    for (const set of ['dev-set-dialect.json', 'testset-dialect.json']) for (const c of all.filter(x => x.set === set)) {
      expect(closestText(c.text, all.filter(x => x.set !== set)), `${set} ${c.id}`).toBeNull()
    }
  })
  it('refuses to tune the per-variety thresholds when any file given is a test set', () => {
    const cli = spawnSync(process.execPath, ['eval/project-suggest/eval.mjs', 'tune', 'eval/project-suggest/dev-set.json', 'eval/project-suggest/testset-dialect.json', '--method', 'hybrid'], { encoding: 'utf8' })
    expect(cli.status).toBe(1)
    expect(cli.stderr).toMatch(/REFUSED/)
  })
  it('the report shows every set before and after per variety with bootstrap intervals, the engine commit, and no unsupported suggestion', () => {
    const report = readFileSync(`${DIR}/results/2026-11-22-dialect.md`, 'utf8')
    for (const set of ['testset-dialect.json', 'dev-set-dialect.json', 'dev-set.json', 'dev-set-workflow.json', 'testset.json', 'testset-ai-v2.json', 'testset-workflow.json']) expect(report).toContain(`## ${set}\n\n`)
    expect(report).toContain('2000 draws, seed 43, 95% percentile interval, per variety')
    for (const v of ['Saudi dialect', 'Standard Arabic', 'English', 'Mixed Arabic-English']) expect(report).toContain(`| engine after | ${v} |`)
    for (const [label, version] of [['before', 'kamin-project-suggest-improved-v2'], ['after', 'kamin-project-suggest-improved-v3']]) {
      const run = JSON.parse(readFileSync(`${DIR}/results/2026-11-22-dialect/${label}-testset-dialect-engine.json`, 'utf8'))
      expect(run.meta).toMatchObject({ methodVersion: version, setSha256: SHA })
      expect(run.metrics.all.unsupported).toBe(0)
    }
    expect(JSON.parse(readFileSync(`${DIR}/results/2026-11-22-dialect/before-testset-dialect-engine.json`, 'utf8')).meta.engine).toMatch(/^as committed at `/)
  })
})
