// Task 19 · suggested learning path: gap first, suggestions only from the gap, each with its reason,
// from a local list the team reviews. No score, no fetch.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { computeGap, statusForLevel, PATH_FIELDS, SUFFICIENT_FROM } from '../src/path/gap.js'
import { suggestPath, uncoveredGaps, LEARNING_CATALOG, catalogItem } from '../src/path/suggest.js'
import { skills as skillCatalog, opportunities, courseSkillMap, demoCourses } from '../src/data.js'
import { catalogCourse } from '../src/catalog/fcit.js'
import { inferSkills } from '../src/utils/engine.js'
import { RUNTIME_MANIFEST } from '../src/content/runtimeManifest.js'

const skill = (id, evidenceLevel) => ({ id, evidenceLevel })
const items = LEARNING_CATALOG.items

describe('gap first', () => {
  it('uses the Task 02 levels: strong or moderate is sufficient, limited is limited, none is missing', () => {
    expect(SUFFICIENT_FROM).toBe('moderate')
    expect(['strong', 'moderate', 'limited', 'none', undefined].map(statusForLevel)).toEqual(['sufficient', 'sufficient', 'limited', 'missing', 'missing'])
    const gap = computeGap([skill('database', 'strong'), skill('statistics', 'limited')], 'job-data-analyst')
    expect(gap.requirements.map(r => [r.capability, r.status])).toEqual([['database', 'sufficient'], ['statistics', 'limited']])
    expect(gap.hasGap).toBe(true)
    expect(() => computeGap([], 'no-such-field')).toThrow('PATH_TARGET_NOT_FOUND')
  })
  it('the fields are the reference job profiles', () => {
    expect(PATH_FIELDS.length).toBeGreaterThanOrEqual(5)
    expect(PATH_FIELDS.every(f => f.type === 'job' && f.requiredSkills.length > 0)).toBe(true)
  })
})

describe('suggest only from the gap', () => {
  it('no database evidence for a field that requires it: an item teaching databases, with a reason naming the field and the capability', () => {
    const gap = computeGap([skill('statistics', 'strong')], 'job-data-analyst')
    const suggestions = suggestPath(gap)
    const db = suggestions.filter(s => s.closes.includes('database'))
    expect(db.length).toBeGreaterThan(0)
    for (const s of db) {
      expect(catalogItem(s.itemId).teaches).toContain('database')
      expect(s.reason.en).toContain('"Data Analyst"')
      expect(s.reason.en).toContain('Databases')
      expect(s.reason.en).toContain('no evidence')
      expect(s.reason.ar).toContain('محلل بيانات')
      expect(s.reason.ar).toContain('قواعد البيانات')
    }
    expect(suggestions.some(s => s.closes.includes('statistics'))).toBe(false)
  })
  it('strong evidence for everything the field requires: no visible gap and no suggestions', () => {
    for (const field of PATH_FIELDS) {
      const all = field.requiredSkills.map(id => skill(id, 'strong'))
      const gap = computeGap(all, field.id)
      expect(gap.hasGap, field.id).toBe(false)
      expect(suggestPath(gap, items, { skills: all }), field.id).toEqual([])
    }
  })
  it('never a suggestion without a reason and a non-empty "closes"; never one that closes something already sufficient', () => {
    const profiles = [[], ['strong'], ['limited'], ['moderate'], ['none']]
    for (const field of PATH_FIELDS) for (const [lvl] of profiles.map(p => p.length ? p : [null])) {
      const owned = lvl ? field.requiredSkills.slice(0, 1).map(id => skill(id, lvl)) : []
      const gap = computeGap(owned, field.id)
      for (const s of suggestPath(gap, items, { skills: owned })) {
        expect(s.closes.length, `${field.id}/${s.itemId}`).toBeGreaterThan(0)
        expect(s.reason.ar.trim() && s.reason.en.trim(), `${field.id}/${s.itemId}`).toBeTruthy()
        for (const id of s.closes) expect(gap.requirements.find(r => r.capability === id)?.status).not.toBe('sufficient')
      }
    }
  })
  it('limited evidence is named as limited in the reason', () => {
    const gap = computeGap([skill('cyber', 'limited')], 'job-cyber-analyst')
    const [first] = suggestPath(gap)
    expect(first.reason.en).toContain('is limited')
    expect(first.reason.ar).toContain('محدود')
  })
  it('written ordering rules: prerequisites met first, then lower level; no score is produced', () => {
    const gap = computeGap([], 'job-data-analyst')
    const ids = suggestPath(gap).map(s => s.itemId)
    expect(ids.indexOf('fcit-cpit-240')).toBeLessThan(ids.indexOf('fcit-cpit-340')) // CPIT-340 needs databases first
    const s340 = suggestPath(gap).find(s => s.itemId === 'fcit-cpit-340')
    expect(s340).toMatchObject({ prerequisitesMet: false, missingPrerequisites: ['database'] })
    for (const s of suggestPath(gap)) {
      expect(Object.keys(s).sort()).toEqual(['closes', 'itemId', 'missingPrerequisites', 'prerequisitesMet', 'reason', 'status'])
      expect(JSON.stringify(s)).not.toMatch(/score|weight|percent/i)
    }
  })
  it('a university course already on the record is not suggested again', () => {
    const skills = inferSkills(demoCourses)
    const gap = computeGap(skills, 'job-data-analyst')
    const ids = suggestPath(gap, items, { skills, takenCourses: demoCourses.map(c => c.code) }).map(s => s.itemId)
    expect(ids).not.toContain('fcit-cpit-240')
    expect(ids).not.toContain('fcit-stat-110')
    expect(ids).toContain('fcit-cpit-340')
  })
  it('a gap the list cannot close yet is reported, not hidden', () => {
    const gap = computeGap([skill('requirements', 'strong')], 'job-systems-analyst')
    const suggestions = suggestPath(gap)
    expect(uncoveredGaps(gap, suggestions).map(r => r.capability)).toEqual(['systems-analysis'])
  })
})

describe('the local list (src/catalog/learning-opportunities.json)', () => {
  // Task 36: "reviewedBy" (names) became "reviewers" (two roles, never names).
  const REQUIRED = ['id', 'kind', 'title', 'provider', 'providerUrl', 'teaches', 'requires', 'level', 'language', 'status', 'addedBy', 'reviewers', 'reviewedAt', 'sourceNote']
  it('every item has the required fields with valid values', () => {
    const ids = items.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of items) {
      for (const key of REQUIRED) expect(item, `${item.id}.${key}`).toHaveProperty(key)
      expect(['course', 'certificate', 'university-course']).toContain(item.kind)
      expect(['intro', 'intermediate', 'advanced']).toContain(item.level)
      expect(['illustrative', 'reviewed', 'retired']).toContain(item.status) // Task 36: 'retired'
      expect(item.title.ar?.trim() && item.title.en?.trim(), item.id).toBeTruthy()
      expect(item.language.length).toBeGreaterThan(0)
      expect(item.language.every(l => ['ar', 'en'].includes(l))).toBe(true)
      expect(item.providerUrl === null || /^https:\/\/[^\s]+$/.test(item.providerUrl), item.id).toBe(true)
      expect(item.sourceNote.trim().length, item.id).toBeGreaterThan(10)
      if (item.status === 'reviewed') {
        expect(Array.isArray(item.reviewers) && item.reviewers.length === 2, `${item.id}: two reviewers`).toBe(true)
        expect(item.reviewedAt, item.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      } else expect(item.reviewers, item.id).toBeNull()
    }
  })
  it('the source note students see has no file paths or technical IDs', () => {
    for (const item of items) expect(item.sourceNote, item.id).not.toMatch(/src\/|\.js\b|\.json\b|urn:kamin/)
  })
  it('a prerequisite asks for a basis (any evidence), not the level a field requires', () => {
    // Task 36 retired "ba" (invented provider); the rule is checked on the same item, put back in a test list.
    const ba = [{ ...items.find(i => i.id === 'ba'), status: 'illustrative' }]
    const limited = [skill('requirements', 'limited')]
    expect(suggestPath(computeGap(limited, 'job-business-analyst'), ba, { skills: limited }).find(s => s.itemId === 'ba')).toMatchObject({ prerequisitesMet: true, missingPrerequisites: [] })
    expect(suggestPath(computeGap([], 'job-business-analyst'), ba).find(s => s.itemId === 'ba')).toMatchObject({ prerequisitesMet: false, missingPrerequisites: ['requirements'] })
    expect(suggestPath(computeGap([], 'job-data-analyst')).find(s => s.itemId === 'fcit-cpit-340')).toMatchObject({ prerequisitesMet: false, missingPrerequisites: ['database'] })
    const someDb = [skill('database', 'limited')]
    expect(suggestPath(computeGap(someDb, 'job-data-analyst'), items, { skills: someDb }).find(s => s.itemId === 'fcit-cpit-340').prerequisitesMet).toBe(true)
  })
  it('"teaches" and "requires" use capabilities that exist in the catalog', () => {
    for (const item of items) for (const id of [...item.teaches, ...item.requires]) expect(skillCatalog[id], `${item.id}: ${id}`).toBeTruthy()
  })
  it('university courses are real FCIT catalog courses and teach exactly what the Task 01 map says', () => {
    for (const item of items.filter(i => i.kind === 'university-course')) {
      expect(catalogCourse(item.courseCode), item.id).not.toBeNull()
      expect([...item.teaches].sort(), item.id).toEqual([...courseSkillMap[item.courseCode].skills].sort())
    }
  })
  it('in this phase (CPIT-498) every item is still illustrative; the UI labels them', () => {
    // Task 36: the six invented items are retired (never shown); every item still shown is illustrative.
    expect(items.filter(i => i.status !== 'retired').every(i => i.status === 'illustrative')).toBe(true)
    expect(items.filter(i => i.status === 'retired').map(i => i.id)).toEqual(['ba', 'sql', 'cyber-foundations', 'illustrative-testing-basics', 'illustrative-web-basics', 'illustrative-db-operations'])
    // Task 65: the component's words moved unchanged to src/content/learningPathCopy.js, which it imports.
    const component = readFileSync('src/components/LearningPath.jsx', 'utf8')
    expect(component).toMatch(/^import \{ LEARNING_PATH_COPY \} from '\.\.\/content\/learningPathCopy\.js'$/m)
    const ui = component + readFileSync('src/content/learningPathCopy.js', 'utf8')
    expect(ui).toContain("'Illustrative example'")
    expect(ui).toContain("'Planned feature'")
  })
  it('the course-fit cards keep exactly the five items and fields they had', () => {
    expect(opportunities.map(o => o.id)).toEqual(['ba', 'sql', 'capm', 'pmp', 'cyber-foundations'])
    for (const o of opportunities) for (const key of ['status', 'kind', 'reviewedBy', 'sourceNote', 'providerUrl']) expect(o).not.toHaveProperty(key)
  })
})

describe('no network', () => {
  const files = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? files(p) : [p] })
  it('no fetch or other network call in src/path/ or src/catalog/', () => {
    for (const file of [...files('src/path'), ...files('src/catalog'), 'src/components/LearningPath.jsx']) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|\bimport\s*\(\s*['"`]https?:/)
    }
  })
  it('the feature is listed in "What runs where" as running in the browser', () => {
    expect(RUNTIME_MANIFEST.find(f => f.id === 'learning-path')).toMatchObject({ runsIn: 'browser', storedIn: 'nowhere', network: null })
  })
})
