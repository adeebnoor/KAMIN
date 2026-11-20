import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  understandInterest, checkInterestText, addFreeInterest, setChipRemoved, freeInterestGoalPathways,
  FREE_INTEREST_MESSAGES, FREE_INTEREST_METHOD,
} from '../src/interests/freeText.js'
import { INTEREST_VOCABULARY_VERSION } from '../src/interests/vocabulary.js'
import { emptyInsightState } from '../src/insight.js'
import { normalizeFreeInterests } from '../src/interests/freeInterestState.js'
import { PROJECT_SUGGEST_IMPROVED_VERSION } from '../src/ai/projectSuggestImproved.js'
import { profileSkills, inferSkills } from '../src/utils/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'
import { deleteItem, withdrawConsent, deleteEverythingPreview } from '../src/utils/dataControl.js'
import { buildPortableProfile, normalizePortableState, encryptPortableProfile, decryptPortableProfile } from '../src/utils/portableProfile.js'
import { targetProfiles } from '../src/matching/targets.js'
import { normalizeDigitalInterests } from '../src/digitalInterests.js'
import { cleanAuditEntries } from '../src/utils/auditPrivacy.js'
import { normalizeRecommendationReviews } from '../src/review/recommendations.js'
import { normalizeProjectEvidence } from '../src/utils/projectEvidence.js'
import { normalizeTaskProgress } from '../src/tasks/progress.js'
import { normalizeCredentialRecords } from '../src/credentials/records.js'
import { normalizeCollege, cleanTranscriptText } from '../src/catalog/colleges.js'
import { mergeNeedsReview } from '../src/evidence/needsReview.js'
import * as appProfileState from '../src/state/profileState.js' // Task 59: the app's own state helpers
import { normalizePlan } from '../src/plan/plan.js'

// Task 56 · interests in the student's own words: understood locally, shown as chips the student can
// remove, the sentence always kept, never evidence. Every sentence below is made up.

// The ten made-up sentences of the acceptance criteria (5 Arabic, 5 English) and the chips the
// approved local engine (kamin-project-suggest-improved-v1), the topic terms and (since the Task 57
// follow-up) the interest vocabulary (src/interests/vocabulary.js) give today. The capability column
// is the engine's alone and is unchanged since Task 56. The vocabulary added topic chips to 8 rows,
// a pathway to row 1 (the engine abstained there, so it had no chips at all) and to row 8 ("data").
const TABLE = [
  ['en', 'I want to build apps that help hospitals', [], ['job-software-engineer'], ['apps', 'health']],
  ['en', 'I enjoy data analysis with SQL and statistics', ['database', 'statistics'], ['job-data-analyst', 'training-data-portfolio', 'training-sql-analytics', 'training-python-analytics'], ['data']],
  ['en', 'I love designing user experience and gathering requirements from users', ['requirements'], ['job-business-analyst', 'training-product-discovery'], ['design']],
  ['en', 'analysing systems and documenting stakeholder requirements', ['systems-analysis', 'requirements'], ['job-systems-analyst'], []],
  ['en', 'machine learning for medical images', ['ai-work'], ['training-ai-work'], ['ai', 'health']],
  ['ar', 'أحب تحليل البيانات والإحصاء', ['statistics'], ['job-data-analyst', 'training-data-portfolio', 'training-sql-analytics', 'training-python-analytics'], ['data']],
  ['ar', 'أريد أن أعمل في الأمن السيبراني وحماية الشبكات', ['cyber'], ['job-cyber-analyst'], ['security']],
  ['ar', 'بناء قواعد البيانات والنسخ الاحتياطي', ['database', 'db-operations'], ['job-database-administrator', 'job-data-analyst'], ['data']],
  ['ar', 'أحب الذكاء الاصطناعي وتعلم الآلة', ['ai-work'], ['training-ai-work'], ['ai']],
  ['ar', 'أحب تطوير تطبيقات الجوال واختبارها', [], ['job-software-engineer'], ['apps']],
]

const row = (code, grade) => ({ code, name: code, grade, source: 'pdf' })
const base = (insight = emptyInsightState()) => ({
  approved: true, college: 'FCIT', goal: 'data', consents: { analyze: true, insight: true, advisor: false, research: false },
  courses: [row('CPIT-240', 'B'), row('CPCS-241', 'A'), row('STAT-110', 'A'), row('CPIT-250', 'A')],
  projects: [], tasks: [], credentials: [], recommendationReviews: [], needsReview: [], audit: [], insight,
})
// A profile with two saved free-text interests, ids fixed so the tests are deterministic.
const withTwo = () => {
  const at = new Date('2026-11-18T09:00:00.000Z')
  let s = addFreeInterest(base(), 'I enjoy data analysis with SQL and statistics', { id: 'free-a', now: at })
  s = addFreeInterest(s, 'أريد أن أعمل في الأمن السيبراني وحماية الشبكات', { lang: 'ar', id: 'free-b', now: at })
  return s
}

afterEach(() => vi.useRealTimers())

describe('Task 56: understandInterest gives the chips in the table', () => {
  it.each(TABLE)('%s: %s', (lang, sentence, capabilities, pathways, topics) => {
    expect(understandInterest(sentence, lang)).toEqual({ capabilities, pathways, topics, method: 'kamin-free-interest-v1', engine: PROJECT_SUGGEST_IMPROVED_VERSION, vocabulary: INTEREST_VOCABULARY_VERSION })
  })

  it('the table has 5 Arabic and 5 English sentences, and every chip is a known capability or pathway', () => {
    expect(TABLE.filter(r => r[0] === 'ar')).toHaveLength(5)
    expect(TABLE.filter(r => r[0] === 'en')).toHaveLength(5)
    const lexicon = JSON.parse(readFileSync('src/ai/lexicon/capabilities.json', 'utf8'))
    const targets = new Set(targetProfiles.map(t => t.id))
    for (const [, , caps, paths] of TABLE) {
      for (const id of caps) expect(Object.keys(lexicon.capabilities)).toContain(id)
      for (const id of paths) expect(targets.has(id)).toBe(true)
    }
  })

  it('is deterministic, gives at most 4 of each, and never a score', () => {
    const long = 'I enjoy data analysis with SQL, statistics, databases, cybersecurity, software testing, requirements, web development and project management.'
    const first = understandInterest(long), second = understandInterest(long)
    expect(second).toEqual(first)
    expect(first.capabilities.length).toBeLessThanOrEqual(4)
    expect(first.pathways.length).toBeLessThanOrEqual(4)
    expect(first.topics.length).toBeLessThanOrEqual(4)
    expect(Object.keys(first).sort()).toEqual(['capabilities', 'engine', 'method', 'pathways', 'topics', 'vocabulary'])
    expect(JSON.stringify(first)).not.toMatch(/score|confidence|percent|\d%/i)
  })

  it('a pathway needs two understood capabilities among its required skills, or a matched topic', () => {
    // systems-analysis + requirements are the two required skills of the systems-analyst pathway.
    expect(understandInterest('analysing systems and documenting stakeholder requirements').pathways).toContain('job-systems-analyst')
    // one of its two required skills is not enough on its own
    expect(understandInterest('gathering user requirements')).toMatchObject({ capabilities: ['requirements'], pathways: [] })
  })
})

describe('Task 56: the text the student types', () => {
  it('accepts 3 to 500 characters and rejects the rest with a message in the student’s language', () => {
    expect(checkInterestText('abc')).toBe('abc')
    expect(checkInterestText('x'.repeat(500))).toHaveLength(500)
    for (const [text, code] of [['ab', 'too-short'], ['   ', 'too-short'], ['x'.repeat(501), 'too-long']]) {
      for (const lang of ['ar', 'en']) {
        let error
        try { understandInterest(text, lang) } catch (e) { error = e }
        expect(error?.code).toBe(code)
        expect(error.message).toBe(FREE_INTEREST_MESSAGES[code][lang])
      }
    }
  })

  it('removes control characters and keeps everything else exactly as typed', () => {
    const typed = '  أحبّ  تحليل\u0000 البيانات\u0007 — "SQL" & statistics!\n(2026)  '
    const s = addFreeInterest(base(), typed, { id: 'free-x' })
    expect(s.insight.freeInterests[0].text).toBe('  أحبّ  تحليل البيانات — "SQL" & statistics!\n(2026)  ')
  })

  it('is covered by the existing interests consent: without it nothing is saved and no new consent is asked', () => {
    const off = { ...base(), consents: { ...base().consents, insight: false } }
    expect(() => addFreeInterest(off, 'I enjoy data analysis')).toThrow(FREE_INTEREST_MESSAGES.consent.en)
    expect(Object.keys(withTwo().consents).sort()).toEqual(['advisor', 'analyze', 'insight', 'research'])
  })

  it('keeps at most 5 entries', () => {
    let s = base()
    for (let i = 0; i < 5; i++) s = addFreeInterest(s, `I enjoy data analysis, idea ${i}`, { id: `free-${i}` })
    expect(s.insight.freeInterests).toHaveLength(5)
    expect(() => addFreeInterest(s, 'one more interest', { lang: 'ar' })).toThrow(FREE_INTEREST_MESSAGES.limit.ar)
  })
})

describe('Task 56: chips the student can remove', () => {
  it('stores the sentence next to the understood chips', () => {
    const [entry] = withTwo().insight.freeInterests
    expect(entry).toEqual({
      id: 'free-a', text: 'I enjoy data analysis with SQL and statistics', method: FREE_INTEREST_METHOD, createdAt: '2026-11-18T09:00:00.000Z',
      understood: [
        { kind: 'capability', id: 'database', removed: false }, { kind: 'capability', id: 'statistics', removed: false },
        ...['job-data-analyst', 'training-data-portfolio', 'training-sql-analytics', 'training-python-analytics'].map(id => ({ kind: 'pathway', id, removed: false })),
        { kind: 'topic', id: 'data', removed: false },
      ],
    })
  })

  it('removing a chip keeps the text and the other chips; it can be brought back', () => {
    const before = withTwo()
    const after = setChipRemoved(before, 'free-a', 'pathway', 'job-data-analyst')
    const a = after.insight.freeInterests[0], b = before.insight.freeInterests[0]
    expect(a.text).toBe(b.text)
    expect(a.understood.filter(c => c.removed)).toEqual([{ kind: 'pathway', id: 'job-data-analyst', removed: true }])
    expect(a.understood.map(c => c.id)).toEqual(b.understood.map(c => c.id))
    expect(after.insight.freeInterests[1]).toEqual(before.insight.freeInterests[1])
    expect(setChipRemoved(after, 'free-a', 'pathway', 'job-data-analyst', false).insight.freeInterests).toEqual(before.insight.freeInterests)
    expect(() => setChipRemoved(before, 'free-a', 'pathway', 'job-cyber-analyst')).toThrow('ITEM_NOT_FOUND')
  })

  it('only kept pathway chips are a declared goal signal; capability chips never are', () => {
    const s = setChipRemoved(withTwo(), 'free-a', 'pathway', 'training-sql-analytics')
    expect(freeInterestGoalPathways(s)).toEqual(['job-data-analyst', 'training-data-portfolio', 'training-python-analytics', 'job-cyber-analyst'])
    expect(freeInterestGoalPathways(s)).not.toContain('database')
    expect(freeInterestGoalPathways({ ...s, consents: { ...s.consents, insight: false } })).toEqual([])
  })
})

describe('Task 56: stored, restored, exported and deleted like the other interests', () => {
  it('the normaliser keeps only well-formed entries (strict allowlist)', () => {
    const good = withTwo().insight.freeInterests[0]
    const kept = normalizeFreeInterests([
      { ...good, extra: 'dropped', understood: [...good.understood, { kind: 'capability', id: 'database' }, { kind: 'claim', id: 'x' }, { kind: 'pathway', id: 'urn:kamin:x' }] },
      { ...good }, // same id twice
      { ...good, id: 'free-m', method: 'other-method' },
      { ...good, id: 'free-t', text: 'x'.repeat(501) },
      { ...good, id: 'free-d', createdAt: 'yesterday' },
      { ...good, id: 'bad id!' },
      null, 'text',
    ])
    expect(kept).toEqual([good])
    expect(normalizeFreeInterests(undefined)).toEqual([])
    expect(normalizeFreeInterests(Array.from({ length: 7 }, (_, i) => ({ ...good, id: `free-${i}` })))).toHaveLength(5)
    expect(emptyInsightState().freeInterests).toEqual([])
  })

  it('two entries may understand the same chip; each keeps its own', () => {
    let s = addFreeInterest(base(), 'I enjoy data analysis with SQL and statistics', { id: 'free-1' })
    s = addFreeInterest(s, 'أحب تحليل البيانات والإحصاء', { id: 'free-2' })
    const restored = normalizeFreeInterests(JSON.parse(JSON.stringify(s.insight.freeInterests)))
    expect(restored.map(e => e.understood.some(c => c.id === 'statistics'))).toEqual([true, true])
    expect(restored).toEqual(s.insight.freeInterests)
  })

  it("the app's own normalizeState restores them from the session; every reader applies the allowlist", () => {
    // The app's real normalizeState (Task 59: moved from src/App.jsx to src/state/profileState.js, which exports it).
    const { normalizeState } = appProfileState
    const saved = withTwo()
    const restored = normalizeState(JSON.parse(JSON.stringify(saved)))
    expect(restored.insight.freeInterests).toEqual(saved.insight.freeInterests)
    expect(normalizeState(null).insight.freeInterests).toEqual([])
    expect(normalizeState({ insight: { freeInterests: 'not a list' } }).insight.freeInterests).toEqual([])
    expect(normalizeState({ insight: {} }).insight.freeInterests).toEqual([])
    // The strict allowlist stays out of the initial bundle (Task 56 bundle budget): the session copy is
    // only ever written by the app, and every reader, export and delete normalises it first.
    const bad = { id: 'free-z', text: 'tampered text', understood: [{ kind: 'claim', id: 'x' }], method: 'other', createdAt: 'no' }
    const broken = normalizeState({ ...saved, insight: { ...saved.insight, freeInterests: [...saved.insight.freeInterests, bad] } })
    expect(deleteEverythingPreview(broken, 'en').items.find(i => i.label === 'interests in your own words').count).toBe(2)
    expect(buildPortableProfile({ state: broken }).state.insight.freeInterests).toEqual(saved.insight.freeInterests)
    expect(freeInterestGoalPathways(broken)).toEqual(freeInterestGoalPathways(saved))
    expect(setChipRemoved(broken, 'free-a', 'capability', 'database').insight.freeInterests.map(e => e.id)).toEqual(['free-a', 'free-b'])
    expect(() => deleteItem(broken, { kind: 'free-interest', id: 'free-z' })).toThrow('ITEM_NOT_FOUND')
    expect(withdrawConsent(broken, 'insight').summary.audit.en).toContain('2 free-text interest(s)')
  })

  it('backup round-trip keeps the text and the removed chips; nothing is exported without the interests consent', async () => {
    const s = setChipRemoved(withTwo(), 'free-b', 'capability', 'cyber')
    const payload = buildPortableProfile({ state: s })
    expect(payload.state.insight.freeInterests).toEqual(s.insight.freeInterests)
    const restored = normalizePortableState(JSON.parse(JSON.stringify(payload)))
    expect(restored.insight.freeInterests).toEqual(s.insight.freeInterests)

    const envelope = await encryptPortableProfile(payload, 'a long test passphrase')
    expect(JSON.stringify(envelope)).not.toContain('statistics')
    const decrypted = normalizePortableState(await decryptPortableProfile(envelope, 'a long test passphrase'))
    expect(decrypted.insight.freeInterests).toEqual(s.insight.freeInterests)

    const off = buildPortableProfile({ state: { ...s, consents: { ...s.consents, insight: false } } })
    expect(off.state.insight.freeInterests).toBeUndefined()
    const tampered = { ...payload, state: { ...payload.state, insight: { ...payload.state.insight, freeInterests: [{ id: 'free-z', text: 'x', understood: [], method: FREE_INTEREST_METHOD, createdAt: '2026-11-18T00:00:00.000Z' }] } } }
    expect(normalizePortableState(tampered).insight.freeInterests).toEqual([])
  })

  it("withdrawing the interests consent removes every entry, its text and its chips", () => {
    const { state, summary } = withdrawConsent(withTwo(), 'insight', { lang: 'en' })
    expect(state.insight.freeInterests).toEqual([])
    expect(state.consents.insight).toBe(false)
    expect(JSON.stringify(state)).not.toMatch(/SQL and statistics|السيبراني/)
    expect(summary.sentences.en.join(' ')).toContain('2 interest(s) in your own words were deleted')
    expect(summary.sentences.ar.join(' ')).toContain('حُذف 2 اهتمام كتبته بكلماتك')
    expect(summary.audit.en).toContain('2 free-text interest(s)')
    expect(state.audit[0].label).not.toMatch(/SQL|السيبراني/) // the usage log holds counts, never the text
  })

  it("deleteItem kind 'free-interest' removes one entry and keeps the others", () => {
    const { state, summary } = deleteItem(withTwo(), { kind: 'free-interest', id: 'free-a' }, { lang: 'en' })
    expect(state.insight.freeInterests.map(e => e.id)).toEqual(['free-b'])
    expect(summary.sentences.en[0]).toBe('Deleted the interest in your own words “I enjoy data analysis with SQL and statistics” from this device.')
    expect(summary.sentences.en.join(' ')).toContain('never counted as evidence')
    expect(summary.audit.en).toBe('Item deleted: interest in your own words (1)')
    expect(state.audit[0].label).toBe('Item deleted: interest in your own words (1)')
    expect(() => deleteItem(withTwo(), { kind: 'free-interest', id: 'free-z' })).toThrow('ITEM_NOT_FOUND')
  })

  it('the delete-everything summary counts them', () => {
    const items = deleteEverythingPreview(withTwo(), 'en').items
    expect(items.find(i => i.label === 'interests in your own words').count).toBe(2)
    expect(deleteEverythingPreview(withTwo(), 'ar').items.find(i => i.label === 'اهتمامات بكلماتك').count).toBe(2)
  })
})

describe('Task 56: never evidence (guard)', () => {
  // A sentence that names capabilities the student has NO course evidence for.
  const loud = () => {
    let s = base()
    s = addFreeInterest(s, 'I love cybersecurity, penetration testing and network security', { id: 'free-1' })
    s = addFreeInterest(s, 'بناء قواعد البيانات والنسخ الاحتياطي', { id: 'free-2' })
    return s
  }
  const without = s => ({ ...s, insight: { ...s.insight, freeInterests: [] } })

  it('profileSkills(state) is identical with and without free interests', () => {
    const s = loud()
    expect(s.insight.freeInterests.flatMap(e => e.understood).some(c => c.kind === 'capability')).toBe(true)
    expect(profileSkills(s)).toEqual(profileSkills(without(s)))
    expect(profileSkills(s).map(x => x.id)).not.toContain('cyber')
    expect(inferSkills(s.courses, { college: 'FCIT' })).toEqual(profileSkills(without(s)))
  })

  it('the person graph and every fit judgment are identical with and without free interests', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T10:00:00.000Z'))
    const s = loud()
    const graph = state => projectStateToPerson360({ state, skills: profileSkills(state) })
    const a = graph(s), b = graph(without(s))
    expect(a).toEqual(b)
    expect(JSON.stringify(a)).not.toMatch(/free-1|free-2|penetration|kamin-free-interest/)
    expect(matchTargets(buildMatchingProfile({ graph: a }), { lang: 'en' })).toEqual(matchTargets(buildMatchingProfile({ graph: b }), { lang: 'en' }))
  })

  it('nothing in the evidence, ontology or matching code reads freeInterests', () => {
    for (const file of ['src/utils/engine.js', 'src/ontology/projector.js', 'src/person360.js', 'src/matching/engine.js', 'src/evidence/levels.js', 'src/evidence/recompute.js']) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/freeInterests|interests\/freeText/)
    }
  })
})

describe('Task 56: the module is lazy', () => {
  // Static imports reachable from the entry point form the initial bundle; import() does not.
  const staticImports = file => {
    const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    return [...code.matchAll(/^\s*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1])
  }
  const resolveFile = (from, spec) => {
    if (!spec.startsWith('.')) return null
    const raw = resolve(dirname(from), spec)
    return [raw, `${raw}.js`, `${raw}.jsx`, `${raw}/index.js`].find(p => existsSync(p) && !p.endsWith('.json') && !p.endsWith('.css')) || null
  }
  const initialGraph = () => {
    const seen = new Set(), queue = [resolve('src/main.jsx')]
    while (queue.length) {
      const file = queue.pop()
      if (seen.has(file)) continue
      seen.add(file)
      for (const spec of staticImports(file)) { const next = resolveFile(file, spec); if (next) queue.push(next) }
    }
    return seen
  }

  it('src/interests/freeText.js, its state module and the improved engine are not in the initial bundle', () => {
    const graph = initialGraph()
    expect(graph.size).toBeGreaterThan(20) // the walk really follows the app's imports
    expect(graph.has(resolve('src/App.jsx'))).toBe(true)
    expect(graph.has(resolve('src/insight.js'))).toBe(true)
    expect(graph.has(resolve('src/interests/freeText.js'))).toBe(false)
    expect(graph.has(resolve('src/interests/freeInterestState.js'))).toBe(false)
    expect(graph.has(resolve('src/interests/vocabulary.js'))).toBe(false) // Task 57 follow-up: the interest vocabulary
    expect(graph.has(resolve('src/ai/projectSuggestImproved.js'))).toBe(false)
  })
})
