import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { courseMapFor, courseSkillMapFor, registeredCourseMap, registeredMapColleges, registeredMapFiles } from '../src/catalog/courseMaps.js'
import { MAP_FILE_PATTERN, VERIFICATIONS, loadCourseMap, validateCourseMap } from '../src/catalog/courseMapSchema.js'
import { FCIT_CATALOG, catalogCourses, deriveCourseSkillMap } from '../src/catalog/fcit.js'
import { COLLEGES, COLLEGE_IDS, collegeHasMap } from '../src/catalog/colleges.js'
import { courseSkillMap } from '../src/data.js'
import { awaitingEvidence, inferSkills, profileSkills, rowEvidence } from '../src/utils/engine.js'
import { recomputeProfile, changeReasonText } from '../src/evidence/recompute.js'
import { courseStatus } from '../src/utils/courseStatus.js'
import { copy } from '../src/i18n.js'
import { COLLEGE_COPY } from '../src/content/collegeCopy.js'

// Task 37 · Science and Medicine: one loader for every college's map, an incomplete map never loads,
// and no map is invented for a college that has none.

const ROOT = path.resolve(import.meta.dirname, '..')
const CATALOG_DIR = path.join(ROOT, 'src/catalog')
const mapFilesOnDisk = () => readdirSync(CATALOG_DIR).filter(name => MAP_FILE_PATTERN.test(name)).sort()
// What the test does with a map file: read it and refuse it on any problem (file name included).
const checkMapFile = file => validateCourseMap(JSON.parse(readFileSync(file, 'utf8')), { fileName: path.basename(file) })
const fcitCopy = () => JSON.parse(JSON.stringify(FCIT_CATALOG))
const row = (code, grade = 'A') => ({ code, name: code, grade, source: 'pdf' })
const base = (courses, extra = {}) => ({ approved: true, consents: { analyze: true }, college: 'FCIT', courses, credentials: [], recommendationReviews: [], tasks: [], projects: [], ...extra })

describe('Task 37 · every course map file in src/catalog/', () => {
  it('is named <college>-<year>.json, registered with the loader, and passes the schema check', () => {
    const onDisk = mapFilesOnDisk()
    expect(onDisk).toEqual(Object.values(registeredMapFiles()).sort())
    expect(onDisk.length).toBeGreaterThan(0)
    for (const name of onDisk) expect(checkMapFile(path.join(CATALOG_DIR, name)), name).toEqual([])
    // Other JSON files in the folder are not maps.
    expect(MAP_FILE_PATTERN.test('learning-opportunities.json')).toBe(false)
  })

  it('today holds only the FCIT map: no placeholder for Science or Medicine', () => {
    expect(mapFilesOnDisk()).toEqual(['fcit-2024-25.json'])
    expect(registeredMapColleges()).toEqual(['FCIT'])
    for (const id of ['SCI', 'MED']) {
      expect(readdirSync(CATALOG_DIR).filter(name => name.toLowerCase().startsWith(`${id.toLowerCase()}-`)), id).toEqual([])
      expect(registeredCourseMap(id)).toBeNull()
    }
  })

  it('every college with hasApprovedMap: true has a registered map of its own college; SCI and MED stay false', () => {
    for (const college of COLLEGES) {
      if (college.hasApprovedMap) expect(registeredCourseMap(college.id)?.college, college.id).toBe(college.id)
    }
    expect(COLLEGES.filter(c => c.hasApprovedMap).map(c => c.id)).toEqual(['FCIT'])
    expect(collegeHasMap('SCI')).toBe(false)
    expect(collegeHasMap('MED')).toBe(false)
  })
})

describe('Task 37 · the loader picks the map by college', () => {
  it('FCIT gets the same map as before (fcit.js and data.js are views of the loader)', () => {
    const fcit = courseMapFor('FCIT')
    expect(fcit.courses).toBe(catalogCourses)
    expect(fcit.data).toBe(FCIT_CATALOG)
    expect(fcit.catalog).toBe('FCIT Catalog 2024-25')
    expect(fcit.course('cpit 240').title.en).toBe('Databases (I)')
    expect(fcit.course('ZZZZ-999')).toBeNull()
    expect(courseSkillMapFor('FCIT')).toEqual(courseSkillMap)
    expect(courseSkillMapFor('FCIT')).toEqual(deriveCourseSkillMap())
  })

  it('Science, Medicine, "not chosen" and an unknown college get no map', () => {
    for (const college of ['SCI', 'MED', null, undefined, 'XYZ']) {
      expect(courseMapFor(college), String(college)).toBeNull()
      expect(courseSkillMapFor(college), String(college)).toBeNull()
    }
  })

  it('a row is judged against its own college\'s map: an FCIT course has no mapping for a Science student', () => {
    expect(rowEvidence(row('CPIT-240')).factors.mapping).toBe('limited')
    expect(rowEvidence(row('CPIT-240'), { college: 'FCIT' })).toEqual(rowEvidence(row('CPIT-240')))
    const sci = rowEvidence(row('CPIT-240'), { college: 'SCI' })
    expect(sci.level).toBe('none')
    expect(sci.reasons.map(r => r.code)).toContain('mapping-missing')
  })
})

describe('Task 37 · a Science profile still creates no capability and says why', () => {
  const courses = [row('CPIT-240'), row('CPIT-250', 'B'), row('STAT-110')]

  it('no capability from courses, nothing waiting for evidence', () => {
    expect(profileSkills(base(courses))).not.toEqual([])
    for (const college of ['SCI', 'MED']) {
      expect(profileSkills(base(courses, { college }))).toEqual([])
      expect(inferSkills(courses, { college })).toEqual([])
      expect(awaitingEvidence(courses.map(c => ({ ...c, source: 'manual' })), { college })).toEqual([])
    }
  })

  it('each course row on the review screen says the college has no approved map yet', () => {
    for (const lang of ['ar', 'en']) {
      const status = courseStatus(row('CPIT-240'), { lang, college: 'SCI' })
      expect(status.mapping).toEqual({ kind: 'unmapped', text: copy[lang].screens.review.noMap })
      expect(status.reasons.map(r => r.text)).toContain(copy[lang].screens.review.noMapReason)
    }
    expect(copy.en.screens.review.noMapReason).toBe('Your college has no approved course map yet, so this course creates no capability.')
    expect(COLLEGE_COPY.en.noMap).toBe('This college has no approved course map yet, so its courses create no capability.')
  })

  it('switching FCIT → Science names the reason for every dropped capability', () => {
    const prev = base(courses)
    const { diff } = recomputeProfile(prev, { ...prev, college: 'SCI' })
    expect(diff.removed.length).toBeGreaterThan(0)
    expect(diff.removed.every(r => r.reason === 'college-changed-no-map')).toBe(true)
    expect(changeReasonText('college-changed-no-map', 'en')).toBe('your college has no approved course map yet')
  })
})

describe('Task 37 · an incomplete map is refused', () => {
  it('the FCIT map passes; the allowed verification is the one FCIT uses', () => {
    expect(validateCourseMap(FCIT_CATALOG, { college: 'FCIT', fileName: 'fcit-2024-25.json' })).toEqual([])
    expect(VERIFICATIONS).toEqual(['checked-against-catalog'])
  })

  const broken = {
    'no catalog on the map': m => { delete m.catalog },
    'no catalog on a course': m => { delete m.courses[3].catalog },
    'a course from another catalog (mixed)': m => { m.courses[3].catalog = 'Faculty of Science Catalog 2025-26' },
    'no catalogPage on a course': m => { delete m.courses[3].catalogPage },
    'catalogPage 0': m => { m.courses[3].catalogPage = 0 },
    'catalogPage as text': m => { m.courses[3].catalogPage = '60' },
    'no verification on a course': m => { delete m.courses[3].verification },
    'an unknown verification': m => { m.courses[3].verification = 'from-a-website' },
    'a course of another college': m => { m.courses[3].college = 'SCI' },
    'no mapping version': m => { delete m.mappingVersion },
    'no courses': m => { m.courses = [] },
    'a code twice': m => { m.courses.push({ ...m.courses[3] }) },
    'no learning outcome': m => { m.courses[3].learningOutcomes = [] },
  }
  it.each(Object.keys(broken))('refuses a map with %s', name => {
    const map = fcitCopy()
    broken[name](map)
    expect(validateCourseMap(map, { college: 'FCIT' }).length, name).toBeGreaterThan(0)
    expect(() => loadCourseMap(map, { college: 'FCIT' }), name).toThrow(/refused/)
  })

  it('names the course and the field that is missing', () => {
    const map = fcitCopy()
    delete map.courses[3].catalogPage
    delete map.courses[5].verification
    expect(validateCourseMap(map)).toEqual([
      `course 4 (${map.courses[3].code}): catalogPage is missing (the 1-based page of the official catalog)`,
      `course 6 (${map.courses[5].code}): verification is missing`,
    ])
  })

  it('refuses a map filed under the wrong college or with a wrong file name', () => {
    expect(validateCourseMap(FCIT_CATALOG, { college: 'SCI' })).toEqual(['map: college "FCIT" is filed under SCI'])
    expect(validateCourseMap(FCIT_CATALOG, { fileName: 'fcit.json' })).toEqual(['map: file name "fcit.json" is not <college>-<year>.json'])
    expect(validateCourseMap(FCIT_CATALOG, { fileName: 'sci-2024-25.json' })).toEqual(['map: file name "sci-2024-25.json" does not start with fcit-'])
    expect(validateCourseMap(null)).toEqual(['the map is not a JSON object'])
  })

  describe('as a file on disk', () => {
    let tmp
    beforeAll(() => { tmp = mkdtempSync(path.join(os.tmpdir(), 'kamin-course-maps-')) })
    afterAll(() => { if (tmp) rmSync(tmp, { recursive: true, force: true }) })

    it('a map file missing catalogPage fails; the untouched copy passes', () => {
      const good = path.join(tmp, 'fcit-2024-25.json')
      writeFileSync(good, JSON.stringify(fcitCopy()), 'utf8')
      expect(checkMapFile(good)).toEqual([])
      const map = fcitCopy()
      for (const course of map.courses) delete course.catalogPage
      const bad = path.join(tmp, 'fcit-2025-26.json')
      writeFileSync(bad, JSON.stringify(map), 'utf8')
      const problems = checkMapFile(bad)
      expect(problems).toHaveLength(map.courses.length)
      expect(problems.every(p => /catalogPage is missing/.test(p))).toBe(true)
    })
  })

  it('the loader source registers maps statically and calls nothing outside', () => {
    for (const name of ['courseMaps.js', 'courseMapSchema.js']) {
      const source = readFileSync(path.join(CATALOG_DIR, name), 'utf8')
      expect(source, name).not.toMatch(/\bfetch\w*\s*\(|XMLHttpRequest|WebSocket|https?:\/\//)
      expect(source, name).not.toMatch(/import\.meta\.glob/)
    }
    expect(COLLEGE_IDS).toEqual(['FCIT', 'SCI', 'MED'])
  })

  it('the schema check stays out of the app: only tests and the review kit import it', () => {
    const importers = []
    const walk = dir => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(file)
        else if (/\.(m?js|jsx)$/.test(entry.name) && /from\s+['"][^'"]*courseMapSchema/.test(readFileSync(file, 'utf8'))) importers.push(path.relative(ROOT, file).replace(/\\/g, '/'))
      }
    }
    walk(path.join(ROOT, 'src'))
    expect(importers).toEqual([])
    expect(readFileSync(path.join(ROOT, 'scripts/review-kit/lib.mjs'), 'utf8')).toMatch(/from '..\/..\/src\/catalog\/courseMapSchema.js'/)
  })
})
