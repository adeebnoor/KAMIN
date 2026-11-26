// Task 57 · next-step items that say which capabilities they support, which pathway they improve and
// which gap they close; the next-steps feed built from the gap of the chosen goal(s). No score.
// Every profile below is made up (the synthetic example is src/data.js demoCourses).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { validate } from './helpers/miniJsonSchema.js'
import { nextStepFeed, feedGoals, NO_GOAL_REASON, NEXT_STEPS_VERSION } from '../src/path/nextSteps.js'
import { suggestPath, LEARNING_CATALOG, byWrittenRules } from '../src/path/suggest.js'
import { computeGap, PATH_FIELDS } from '../src/path/gap.js'
import { targetProfiles } from '../src/matching/targets.js'
import { demoCourses, skills as skillCatalog } from '../src/data.js'
import { inferSkills } from '../src/utils/engine.js'
import { addFreeInterest, setChipRemoved } from '../src/interests/freeText.js'
import { emptyInsightState } from '../src/insight.js'

const schema = JSON.parse(readFileSync('src/catalog/learning-opportunities.schema.json', 'utf8'))
const fcit = JSON.parse(readFileSync('src/catalog/fcit-2024-25.json', 'utf8'))
const catalog = LEARNING_CATALOG
const items = catalog.items
const skill = (id, evidenceLevel) => ({ id, evidenceLevel })
const demoSkills = inferSkills(demoCourses)
const taken = demoCourses.map(c => c.code)
const ids = feed => feed.cards.map(c => c.itemId)
const KAU_NOTE = 'Official KAU course; capabilities from Kamin’s official course map.'
const ILL_NOTE = 'Invented example; there is no real provider.'
const PMI_NOTE = 'Real PMI certificate; shown as an illustrative example until the team reviews it.'
const kau = (code, page) => ({ type: 'kau-catalog', ref: `${code} · FCIT Catalog 2024-25, p. ${page}`, note: KAU_NOTE })
// Task 36: an invented source is named "invented" (it was "illustrative" in Task 57) and its item is retired.
const invented = { type: 'invented', ref: null, note: ILL_NOTE }

describe('Task 57: the item schema', () => {
  it('every item validates against src/catalog/learning-opportunities.schema.json', () => {
    expect(validate(catalog, schema)).toEqual([])
    expect(items).toHaveLength(14) // the 13 items of Task 19 + fcit-cpit-250 (Task 57)
  })

  it('the schema really rejects a broken item (it is not a schema that accepts anything)', () => {
    const good = items.find(i => i.id === 'fcit-cpit-240')
    const broken = [
      { ...good, source: { type: 'web', ref: 'x', note: 'x' } },
      { ...good, improves: ['urn:kamin:x'] },
      { ...good, providerUrl: 'http://example.com' },
      { ...good, extra: true },
      Object.fromEntries(Object.entries(good).filter(([k]) => k !== 'supports')),
    ]
    for (const item of broken) expect(validate({ ...catalog, items: [item] }, schema).length, JSON.stringify(item).slice(0, 80)).toBeGreaterThan(0)
  })

  it('"supports" equals "teaches" (kept as an alias for one release); both use known capabilities', () => {
    for (const item of items) {
      expect(item.supports, item.id).toEqual(item.teaches)
      for (const id of item.supports) expect(skillCatalog[id] || id === 'cyber', `${item.id}: ${id}`).toBeTruthy()
    }
  })

  it('"improves" lists exactly the pathways and professions that require a capability the item supports', () => {
    for (const item of items) {
      const expected = targetProfiles.filter(t => (t.requiredSkills || []).some(id => item.supports.includes(id))).map(t => t.id)
      expect(item.improves, item.id).toEqual(expected)
    }
    expect(items.find(i => i.id === 'cyber-foundations').improves).toEqual(['job-cyber-analyst'])
  })

  it('every KAU item is a university course with a catalogue reference; every non-KAU item is illustrative (or retired)', () => {
    for (const item of items) {
      if (item.source.type === 'kau-catalog') {
        const course = fcit.courses.find(c => c.code === item.courseCode)
        expect(item.kind, item.id).toBe('university-course')
        expect(course, item.id).toBeTruthy()
        expect(item.source).toEqual(kau(item.courseCode, course.catalogPage))
      } else {
        expect(item.kind, item.id).not.toBe('university-course')
        if (item.provider === 'PMI') {
          // The two real PMI certificates of the pilot list (Task 19): a real provider, so not "invented".
          // Task 36: their source is the provider's own page.
          expect(item.status, item.id).toBe('illustrative')
          expect(item.source, item.id).toEqual({ type: 'provider-page', ref: item.providerUrl, note: PMI_NOTE })
          expect(item.providerUrl, item.id).toMatch(/^https:\/\/www\.pmi\.org\//)
        } else {
          expect(item.status, item.id).toBe('retired') // Task 36
          expect(item.source, item.id).toEqual(invented)
          expect(item.providerUrl, item.id).toBeNull()
          expect(item.provider, item.id).toMatch(/Illustrative pilot/)
        }
      }
    }
    expect(items.filter(i => i.kind === 'university-course').every(i => i.source.type === 'kau-catalog')).toBe(true)
    expect(items.filter(i => i.provider === 'PMI').map(i => i.id)).toEqual(['capm', 'pmp'])
    expect(items.filter(i => i.providerUrl).every(i => i.addedBy === 'kamin-pilot-catalog-2026-09')).toBe(true) // no URL added in Task 57
  })

  it('the item added in Task 57 is a real FCIT course, with the capabilities of the official course map', () => {
    const added = items.filter(i => i.addedBy === 'task-57')
    expect(added.map(i => [i.id, i.courseCode, i.source.ref, i.supports])).toEqual([
      ['fcit-cpit-250', 'CPIT-250', 'CPIT-250 · FCIT Catalog 2024-25, p. 60', ['requirements']],
    ])
    expect(fcit.courses.find(c => c.code === 'CPIT-250')).toMatchObject({ title: { en: 'System Analysis & Design' }, catalogPage: 60, capabilities: ['requirements'] })
  })

  it('the schema is for tests only: no app file imports it', () => {
    const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`])
    for (const file of walk('src').filter(f => /\.(js|jsx)$/.test(f))) expect(readFileSync(file, 'utf8'), file).not.toMatch(/learning-opportunities\.schema/)
  })
})

describe('Task 57: the next-steps feed', () => {
  it('synthetic example, goal "Junior Cybersecurity Analyst": the exact feed, every card names a gap', () => {
    const feed = nextStepFeed({ skills: demoSkills, goalIds: ['job-cyber-analyst'], takenCourses: taken })
    const why = {
      ar: 'مجال «محلل أمن سيبراني مبتدئ» يتطلب أساسيات الأمن السيبراني، ولا يوجد في سجلك دليل عليها.',
      en: 'The field "Junior Cybersecurity Analyst" requires Cybersecurity fundamentals, and your record has no evidence for it.',
    }
    const card = (itemId, kind, source) => ({
      itemId, kind, supports: ['cyber'], improves: ['job-cyber-analyst'], why, gapCapabilities: ['cyber'], forGoals: ['job-cyber-analyst'],
      prerequisitesMet: true, missingPrerequisites: [], status: 'illustrative', source, illustrative: source.type === 'invented',
    })
    // Task 36 retired cyber-foundations (invented provider); the KAU course remains.
    expect(feed).toEqual({
      version: NEXT_STEPS_VERSION, goals: ['job-cyber-analyst'], uncovered: [], handled: 0, reason: null,
      cards: [card('fcit-cpit-425', 'university-course', kau('CPIT-425', 62))],
    })
    console.log(`\nFeed, synthetic example, goal job-cyber-analyst:\n${feed.cards.map(c => `  ${c.itemId}${c.illustrative ? ' (illustrative example)' : ` (${c.source.ref})`}: ${c.why.en}`).join('\n')}`)
  })

  it('synthetic example, goal "Data Analyst": the exact feed; a gap no item can close is reported', () => {
    const feed = nextStepFeed({ skills: demoSkills, goalIds: ['job-data-analyst'], takenCourses: taken })
    // Task 36 retired sql (invented provider).
    expect(feed.cards.map(c => [c.itemId, c.gapCapabilities, c.illustrative, c.why.en])).toEqual([
      ['fcit-cpit-340', ['database'], false, 'The field "Data Analyst" requires Databases, and your evidence for it is limited.'],
    ])
    // STAT-110 is on the record, so the only item for statistics is not suggested again.
    expect(feed.uncovered).toEqual([{ goalId: 'job-data-analyst', capabilities: ['statistics'] }])
    console.log(`\nFeed, synthetic example, goal job-data-analyst:\n${feed.cards.map(c => `  ${c.itemId}${c.illustrative ? ' (illustrative example)' : ` (${c.source.ref})`}: ${c.why.en}`).join('\n')}\n  not covered yet: statistics`)
  })

  it('two goals: one card per item, "why" names each goal’s gap, written order across both', () => {
    const skills = [skill('requirements', 'limited')]
    const feed = nextStepFeed({ skills, goalIds: ['job-business-analyst', 'job-systems-analyst'] })
    const both = feed.cards.find(c => c.itemId === 'fcit-cpit-250') // Task 36: "ba" is retired; CPIT-250 helps both goals too
    expect(both.forGoals).toEqual(['job-business-analyst', 'job-systems-analyst'])
    expect(both.why.en).toBe('The field "Business Analyst" requires Requirements analysis, and your evidence for it is limited. The field "Computer Systems Analyst" requires Requirements analysis, and your evidence for it is limited.')
    expect(ids(feed)).toEqual(['fcit-cpit-250', 'fcit-cpit-251'])
    expect(feed.uncovered).toEqual([{ goalId: 'job-systems-analyst', capabilities: ['systems-analysis'] }])
  })

  it('without a goal the feed is empty with the reason "Choose a goal first"; unknown goals are ignored', () => {
    for (const goalIds of [[], undefined, ['no-such-target'], 'job-cyber-analyst']) {
      expect(nextStepFeed({ skills: demoSkills, goalIds })).toEqual({ version: NEXT_STEPS_VERSION, goals: [], cards: [], uncovered: [], handled: 0, reason: NO_GOAL_REASON })
    }
    expect(NO_GOAL_REASON).toEqual({ ar: 'اختر هدفًا أولًا.', en: 'Choose a goal first.' })
    expect(nextStepFeed()).toMatchObject({ cards: [], reason: NO_GOAL_REASON })
  })

  it('an item never appears without a gap (every goal, three profiles)', () => {
    const allStrong = Object.keys(skillCatalog).concat('cyber').map(id => skill(id, 'strong'))
    for (const skills of [[], demoSkills, allStrong]) {
      for (const target of targetProfiles) {
        const feed = nextStepFeed({ skills, goalIds: [target.id] })
        const gap = computeGap(skills, target.id)
        for (const card of feed.cards) {
          expect(card.gapCapabilities.length, card.itemId).toBeGreaterThan(0)
          for (const id of card.gapCapabilities) expect(gap.gaps.map(r => r.capability), `${target.id}/${card.itemId}`).toContain(id)
          expect(card.why.en).toMatch(/requires .+ (no evidence|limited)/)
          expect(card.improves, card.itemId).toContain(target.id)
        }
        if (!gap.hasGap) expect(feed.cards, target.id).toEqual([])
      }
    }
  })

  it('illustrative items carry the flag; KAU catalogue items do not', () => {
    const feed = nextStepFeed({ skills: [], goalIds: PATH_FIELDS.map(f => f.id) })
    expect(feed.cards.length).toBeGreaterThan(5)
    for (const card of feed.cards) expect(card.illustrative, card.itemId).toBe(card.status !== 'reviewed' && !['kau-catalog', 'department-offer'].includes(card.source.type)) // Task 36: not yet reviewed and not from an official source
    // Task 36: the invented items are retired, so the only illustrative card left is a real, not yet reviewed certificate.
    expect(feed.cards.filter(c => c.illustrative).map(c => c.itemId)).toEqual(['capm'])
    expect(feed.cards.every(c => items.find(i => i.id === c.itemId).status !== 'retired')).toBe(true)
    expect(feed.cards.filter(c => !c.illustrative).every(c => c.kind === 'university-course' && c.source.ref)).toBe(true)
  })

  it('removing a goal empties its items; the other goal’s cards stay the same', () => {
    // Task 36: the web-development item was retired, so the second goal is Data Analyst.
    const both = nextStepFeed({ skills: demoSkills, goalIds: ['job-cyber-analyst', 'job-data-analyst'], takenCourses: taken })
    const cyber = nextStepFeed({ skills: demoSkills, goalIds: ['job-cyber-analyst'], takenCourses: taken })
    expect(ids(both)).toEqual(['fcit-cpit-425', 'fcit-cpit-340'])
    expect(ids(cyber)).toEqual(['fcit-cpit-425'])
    expect(cyber.cards).toEqual(both.cards.filter(c => c.forGoals.includes('job-cyber-analyst')))
    expect(nextStepFeed({ skills: demoSkills, goalIds: [], takenCourses: taken }).cards).toEqual([])
  })

  it('items already in the plan or marked "not for me" are left out (ids or { itemId })', () => {
    const goalIds = ['job-cyber-analyst', 'job-data-analyst'] // Task 36: two goals, since cyber-foundations is retired
    expect(ids(nextStepFeed({ skills: demoSkills, goalIds, takenCourses: taken, plan: ['fcit-cpit-340'] }))).toEqual(['fcit-cpit-425'])
    expect(ids(nextStepFeed({ skills: demoSkills, goalIds, takenCourses: taken, plan: [{ itemId: 'fcit-cpit-425' }] }))).toEqual(['fcit-cpit-340'])
    expect(ids(nextStepFeed({ skills: demoSkills, goalIds, takenCourses: taken, notForMe: ['fcit-cpit-340', 'fcit-cpit-425'] }))).toEqual([])
  })

  it('a university course already on the record is never suggested (existing rule)', () => {
    const goalIds = ['job-data-analyst']
    expect(ids(nextStepFeed({ skills: [], goalIds }))).toEqual(['fcit-cpit-240', 'fcit-stat-110', 'fcit-cpit-340']) // Task 36: sql retired
    expect(ids(nextStepFeed({ skills: [], goalIds, takenCourses: ['CPIT-240', 'STAT 110'] }))).toEqual(['fcit-cpit-340'])
  })

  it('kept free-interest pathway chips count as goals; removed chips and capability or topic chips never do', () => {
    const base = { approved: true, consents: { analyze: true, insight: true }, insight: emptyInsightState() }
    let s = addFreeInterest(base, 'أريد أن أعمل في الأمن السيبراني وحماية الشبكات', { lang: 'ar', id: 'free-a' })
    s = addFreeInterest(s, 'I want to build apps that help hospitals', { id: 'free-b' })
    const free = s.insight.freeInterests
    expect(feedGoals([], free)).toEqual(['job-cyber-analyst', 'job-software-engineer'])
    expect(feedGoals(['job-data-analyst', 'job-cyber-analyst'], free)).toEqual(['job-data-analyst', 'job-cyber-analyst', 'job-software-engineer'])
    const feed = nextStepFeed({ skills: [], freeInterests: free })
    expect(feed.goals).toEqual(['job-cyber-analyst', 'job-software-engineer'])
    expect(ids(feed)).toEqual(['fcit-cpit-251', 'fcit-cpit-425']) // Task 36: cyber-foundations retired
    const removed = setChipRemoved(setChipRemoved(s, 'free-a', 'pathway', 'job-cyber-analyst'), 'free-b', 'pathway', 'job-software-engineer')
    expect(nextStepFeed({ skills: [], freeInterests: removed.insight.freeInterests })).toMatchObject({ goals: [], cards: [], reason: NO_GOAL_REASON })
  })

  it('orders with the written rules shared with suggest.js: one goal gives the same order and wording as suggestPath', () => {
    for (const skills of [[], demoSkills, [skill('database', 'limited')]]) {
      for (const target of PATH_FIELDS) {
        const feed = nextStepFeed({ skills, goalIds: [target.id] })
        const path = suggestPath(computeGap(skills, target.id), items, { skills })
        expect(ids(feed), target.id).toEqual(path.map(s => s.itemId))
        expect(feed.cards.map(c => c.why), target.id).toEqual(path.map(s => s.reason))
      }
    }
    expect(readFileSync('src/path/nextSteps.js', 'utf8')).not.toMatch(/LEVEL_ORDER|KIND_ORDER|localeCompare/)
    expect(byWrittenRules({ itemId: 'b', prerequisitesMet: true, closesMissing: false, level: 'advanced', kind: 'certificate' }, { itemId: 'a', prerequisitesMet: false, closesMissing: true, level: 'intro', kind: 'course' })).toBeLessThan(0)
  })

  it('no score: the card fields are exactly these, and nothing numeric is produced', () => {
    const feed = nextStepFeed({ skills: [], goalIds: PATH_FIELDS.map(f => f.id) })
    for (const card of feed.cards) {
      expect(Object.keys(card).sort()).toEqual(['forGoals', 'gapCapabilities', 'illustrative', 'improves', 'itemId', 'kind', 'missingPrerequisites', 'prerequisitesMet', 'source', 'status', 'supports', 'why'])
    }
    expect(JSON.stringify(feed)).not.toMatch(/score|confidence|percent|\d%|"rank"/i)
  })

  it('"supports" and "improves" are labels (ids), not sentences; "why" is the sentence', () => {
    const feed = nextStepFeed({ skills: [], goalIds: PATH_FIELDS.map(f => f.id) })
    for (const card of feed.cards) {
      for (const id of [...card.supports, ...card.improves]) expect(id).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(card.why.ar).toMatch(/^مجال «/)
      expect(card.why.en).toMatch(/^The field "/)
    }
  })
})

describe('Task 57: the extended items keep the learning list working (the old Courses tab until Task 70, now step 4)', () => {
  // Task 70: the old Courses tab (src/components/LearningPath.jsx) is deleted; step 4's feed is the one reader.
  it('the step 4 feed reads suggestPath, and suggestPath gives the same suggestions from "supports" as from "teaches"', () => {
    expect(readFileSync('src/path/nextSteps.js', 'utf8')).toMatch(/suggestPath\(gap, catalog, \{ skills, takenCourses \}\)/)
    const teachesOnly = items.map(({ supports, ...rest }) => rest)
    for (const target of PATH_FIELDS) {
      const gap = computeGap(demoSkills, target.id)
      expect(suggestPath(gap, teachesOnly, { skills: demoSkills, takenCourses: taken }), target.id).toEqual(suggestPath(gap, items, { skills: demoSkills, takenCourses: taken }))
    }
  })

  it('the synthetic example’s Courses tab default field (Data Analyst) still lists its cards', () => {
    const gap = computeGap(demoSkills, 'job-data-analyst')
    expect(suggestPath(gap, undefined, { skills: demoSkills, takenCourses: taken }).map(s => s.itemId)).toEqual(['fcit-cpit-340']) // Task 36: sql retired
  })
})
