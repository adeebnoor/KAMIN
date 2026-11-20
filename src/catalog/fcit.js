// Official FCIT course map (FCIT Catalog 2024-25). Task 37: the file is loaded and checked by the
// generic per-college loader (src/catalog/courseMaps.js); this module is the FCIT view of it, with the
// same exports as before, so existing imports keep working. `courseSkillMap` in data.js is derived
// from it.
//
// fcit-2024-25.json rules (the JSON ships in the initial bundle, so notes live here):
// - Single allowed source: the official FCIT Catalog 2024-25 (docs/sources/FCITCatalog24-25.pdf).
//   Code, English title and catalogPage (1-based PDF page of the course description, or of the
//   study plan when the catalog has no description) are checked against it
//   (verification 'checked-against-catalog'). The catalog is English-only, so title.ar stays
//   null until the department supplies the official Arabic title.
// - Capabilities follow the draft matrix (docs/sources/مصفوفة-مقررات-الحاسبات.xlsx), limited to
//   capabilities that already exist in data.js and are not specialist ones
//   (testing, db-operations, web-development, systems-analysis need a supervisor decision).
// - Learning outcomes are not in the catalog: each is written from the official title and
//   description and stays status 'proposed' until a department reviewer approves it.
// - An empty capabilities list means a known official course that deliberately maps to nothing.
import { courseSkillMapOf, registeredCourseMap } from './courseMaps.js'

const fcit = registeredCourseMap('FCIT')

export const FCIT_CATALOG = fcit.data
export const FCIT_CATALOG_NAME = fcit.catalog
export const FCIT_MAPPING_VERSION = fcit.mappingVersion
export const catalogCourses = fcit.courses

export const catalogCourse = code => fcit.course(code)

// A mapping is only 'reviewed' once a named reviewer and a date are recorded.
export const mappingReviewStatus = course => (course?.reviewedBy && course?.reviewedAt ? 'reviewed' : 'proposed')

// 'mapped'                → official course with at least one approved-for-pilot capability link
// 'official-unmapped'     → official course that deliberately maps to no capability
// 'not-in-catalog'        → unknown code; never creates a capability
export function courseMappingStatus(code) {
  const course = catalogCourse(code)
  if (!course) return 'not-in-catalog'
  return course.capabilities.length ? 'mapped' : 'official-unmapped'
}

// Legacy shape consumed by the inference engine, governance report and the public
// mapping JSON (public/mapping/course-skill-map.schema.json allows exactly these keys).
// Courses that map to no capability are left out, so they stay "not mapped".
export const deriveCourseSkillMap = (courses = fcit.courses) => courseSkillMapOf(courses)
