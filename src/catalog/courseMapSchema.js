// Task 37 · the schema check for a course map file (src/catalog/<college>-<year>.json). Kept apart from
// the loader (./courseMaps.js) so its messages do not ship in the browser bundle: tests/courseMaps.test.js
// runs it on every map file in src/catalog/, and the review kit runs it before exporting or checking a sheet.
import { canonicalCourseCode } from '../ontology/registry.js'
import { COLLEGE_IDS } from './colleges.js'
import { buildCourseMap } from './courseMaps.js'

export const MAP_FILE_PATTERN = /^([a-z]+)-(\d{4}-\d{2})\.json$/
export const VERIFICATIONS = Object.freeze(['checked-against-catalog'])

const text = value => typeof value === 'string' && value.trim() !== ''

// Every problem that stops a map from being used, as plain sentences. Empty array = valid.
// Required: the catalog name on the map and on every course (the same one, so catalogs are never mixed),
// the college, a mapping version, and per course a code, an English title, a 1-based catalogPage,
// a verification, learning outcomes and a capabilities list.
export function validateCourseMap(map, { college = null, fileName = null } = {}) {
  const problems = []
  if (!map || typeof map !== 'object' || Array.isArray(map)) return ['the map is not a JSON object']
  if (!text(map.catalog)) problems.push('map: catalog is missing')
  if (!text(map.college)) problems.push('map: college is missing')
  else if (!COLLEGE_IDS.includes(map.college)) problems.push(`map: unknown college "${map.college}"`)
  if (college && map.college !== college) problems.push(`map: college "${map.college}" is filed under ${college}`)
  if (fileName) {
    const match = MAP_FILE_PATTERN.exec(fileName)
    if (!match) problems.push(`map: file name "${fileName}" is not <college>-<year>.json`)
    else if (text(map.college) && match[1] !== map.college.toLowerCase()) problems.push(`map: file name "${fileName}" does not start with ${map.college.toLowerCase()}-`)
  }
  if (!text(map.mappingVersion)) problems.push('map: mappingVersion is missing')
  if (!Array.isArray(map.courses) || !map.courses.length) {
    problems.push('map: courses is missing or empty')
    return problems
  }
  const seen = new Set()
  map.courses.forEach((course, index) => {
    const where = `course ${index + 1} (${course?.code || 'no code'})`
    if (!course || typeof course !== 'object') { problems.push(`${where}: not an object`); return }
    if (!text(course.code)) problems.push(`${where}: code is missing`)
    else {
      const code = canonicalCourseCode(course.code)
      if (seen.has(code)) problems.push(`${where}: code appears twice`)
      seen.add(code)
    }
    if (!text(course.title?.en)) problems.push(`${where}: title.en is missing`)
    if (!text(course.catalog)) problems.push(`${where}: catalog is missing`)
    else if (text(map.catalog) && course.catalog !== map.catalog) problems.push(`${where}: catalog "${course.catalog}" is not the map's catalog "${map.catalog}"`)
    if (text(map.college) && course.college !== map.college) problems.push(`${where}: college "${course.college ?? ''}" is not ${map.college}`)
    if (!Number.isInteger(course.catalogPage) || course.catalogPage < 1) problems.push(`${where}: catalogPage is missing (the 1-based page of the official catalog)`)
    if (!text(course.verification)) problems.push(`${where}: verification is missing`)
    else if (!VERIFICATIONS.includes(course.verification)) problems.push(`${where}: verification "${course.verification}" is not one of ${VERIFICATIONS.join(', ')}`)
    if (!Array.isArray(course.capabilities)) problems.push(`${where}: capabilities is not a list`)
    if (!Array.isArray(course.learningOutcomes) || !course.learningOutcomes.length) problems.push(`${where}: learningOutcomes is missing`)
  })
  return problems
}

// Checks a map and builds its lookups. Throws on any problem, so an incomplete map never loads.
export function loadCourseMap(map, options = {}) {
  const problems = validateCourseMap(map, options)
  if (problems.length) throw new Error(`Course map${options.fileName ? ` ${options.fileName}` : ''} refused:\n- ${problems.join('\n- ')}`)
  return buildCourseMap(map, options)
}
