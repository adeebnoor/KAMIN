// Task 37 · one loader for every college's course map. Each map is src/catalog/<college>-<year>.json
// (lower-case college id, catalog year), with the schema of fcit-2024-25.json, and is built only from
// that college's own official catalog: one catalog per college, never mixed.
//
// Only FCIT has a map today. Science and Medicine have none: no placeholder file is added and their
// `hasApprovedMap` stays false (src/catalog/colleges.js). Adding a college later is two steps, after the
// supervisor has approved its catalog as a source (docs/decisions/2026-11-other-college-catalogs.md):
//   1. add src/catalog/<college>-<year>.json and one import + one MAP_FILES line below;
//   2. set `hasApprovedMap: true` only once the department has reviewed it (npm run review:export -- --college <ID>).
// A registered map whose college is not approved is loaded, but never used for a student. The schema
// check (validateCourseMap) lives in ./courseMapSchema.js; tests run it on every map file.
//
// Static imports on purpose: the same module runs in the browser bundle and in plain Node scripts.
import fcit202425 from './fcit-2024-25.json' with { type: 'json' }
import { canonicalCourseCode } from '../ontology/registry.js'
import { collegeHasMap } from './colleges.js'

// college id → [file name, parsed JSON]
const MAP_FILES = Object.freeze({
  FCIT: ['fcit-2024-25.json', fcit202425],
})

// The lookups of one map. No checks here, so the check's messages stay out of the browser bundle: every
// map file is checked by tests/courseMaps.test.js (validateCourseMap in ./courseMapSchema.js), and the
// review kit checks it again before export.
export function buildCourseMap(map, { fileName = null } = {}) {
  const byCode = new Map(map.courses.map(course => [canonicalCourseCode(course.code), course]))
  return Object.freeze({
    college: map.college,
    fileName,
    data: map,
    catalog: map.catalog,
    mappingVersion: map.mappingVersion,
    courses: map.courses,
    course: code => byCode.get(canonicalCourseCode(code)) || null,
  })
}

const LOADED = new Map(Object.entries(MAP_FILES).map(([college, [fileName, map]]) => [college, buildCourseMap(map, { fileName })]))

// The college ids that have a map file, approved or not.
export const registeredMapColleges = () => [...LOADED.keys()]
export const registeredMapFiles = () => Object.fromEntries(Object.entries(MAP_FILES).map(([college, [fileName]]) => [college, fileName]))

// The map file of a college whether or not it is approved for students: for the review kit and tests.
export const registeredCourseMap = college => LOADED.get(college) || null

// The map used for a student of this college: only when the college has an approved map. Science and
// Medicine (no map, hasApprovedMap false) and "not chosen" (null) get null, so their courses create no
// capability.
export const courseMapFor = college => (collegeHasMap(college) ? registeredCourseMap(college) : null)

// The legacy { code: { evidenceType, skills, learningOutcome } } shape (public/mapping schema) for a
// list of courses. Courses that map to no capability are left out, so they stay "not mapped".
export function courseSkillMapOf(courses) {
  const map = {}
  for (const course of courses) {
    if (!course.capabilities.length) continue
    const [outcome] = course.learningOutcomes
    map[canonicalCourseCode(course.code)] = {
      evidenceType: course.evidenceType,
      skills: [...course.capabilities],
      learningOutcome: { ar: outcome.ar, en: outcome.en },
    }
  }
  return map
}

const SKILL_MAPS = new Map()
// The course → capability lookup a student of this college gets, or null when the college has no
// approved map. Built once per college.
export function courseSkillMapFor(college) {
  const map = courseMapFor(college)
  if (!map) return null
  if (!SKILL_MAPS.has(college)) SKILL_MAPS.set(college, courseSkillMapOf(map.courses))
  return SKILL_MAPS.get(college)
}
