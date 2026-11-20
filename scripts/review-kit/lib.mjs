// Task 31 · department review kit. Builds the review sheet from a college's course map (FCIT by
// default) and checks a returned sheet. Read-only: nothing here writes to src/catalog/; loading answers
// is Task 32. No network: the catalog is read from disk, the capability labels from src/data.js.
// Task 37: `--college <ID>` picks the map file the generic loader (src/catalog/courseMaps.js) registers
// for that college, so the same flow works for any college once its map exists.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { skills } from '../../src/data.js'
import { COLLEGE_IDS } from '../../src/catalog/colleges.js'
import { registeredMapFiles } from '../../src/catalog/courseMaps.js'
import { validateCourseMap } from '../../src/catalog/courseMapSchema.js'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const CATALOG_FILE = path.join(ROOT, 'src/catalog/fcit-2024-25.json')
export const REVIEW_DIR = path.join(ROOT, 'review')
export const KIT_VERSION = 'kamin-fcit-review-v1'
export const DEFAULT_COLLEGE = 'FCIT'
export const kitVersion = college => `kamin-${String(college || DEFAULT_COLLEGE).toLowerCase()}-review-v1`

export const loadCatalog = (file = CATALOG_FILE) => JSON.parse(readFileSync(file, 'utf8'))

// The map file of a college, or a reason it has none. { college, file } or { error }.
export function collegeMapFile(value = DEFAULT_COLLEGE) {
  const college = String(value ?? '').trim().toUpperCase()
  if (!COLLEGE_IDS.includes(college)) return { error: `Unknown college "${value}". Known colleges: ${COLLEGE_IDS.join(', ')}.` }
  const fileName = registeredMapFiles()[college]
  if (!fileName) return { error: `${college} has no course map file yet, so there is nothing to review. A map may only be built from that college's own official catalog after the supervisor approves it: see docs/decisions/2026-11-other-college-catalogs.md.` }
  return { college, file: path.join(ROOT, 'src/catalog', fileName) }
}

// A college's map, read from disk and checked against the map schema before any sheet is built from it
// or checked against it. { college, file, catalog } or { error }.
export function loadCollegeMap(value = DEFAULT_COLLEGE) {
  const found = collegeMapFile(value)
  if (found.error) return found
  const catalog = loadCatalog(found.file)
  const problems = validateCourseMap(catalog, { college: found.college, fileName: path.basename(found.file) })
  if (problems.length) return { error: `${path.basename(found.file)} is not a complete course map:\n- ${problems.join('\n- ')}` }
  return { ...found, catalog }
}

// `--college <ID>` from a command line (FCIT when absent), and the other arguments in order.
export function parseKitArgs(argv) {
  const rest = []
  let college = DEFAULT_COLLEGE, error = null
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--college') {
      college = argv[++i]
      if (college === undefined) error = '--college needs a college id, for example --college FCIT'
    } else rest.push(argv[i])
  }
  return { college, rest, error }
}

export const COURSE_COLUMNS = Object.freeze([
  'code', 'title_en', 'catalog_page', 'learning_outcome_en', 'learning_outcome_ar',
  'capability_id', 'capability_label_en', 'capability_label_ar',
])
export const REVIEWER_COLUMNS = Object.freeze([
  'decision', 'corrected_outcome_en', 'corrected_outcome_ar', 'assessment', 'title_ar_official', 'note',
])
export const COLUMNS = Object.freeze([...COURSE_COLUMNS, ...REVIEWER_COLUMNS])
export const DECISIONS = Object.freeze(['approve', 'reject', 'change'])
export const ASSESSMENTS = Object.freeze(['exam', 'project', 'lab', 'mixed', 'unknown'])
export const REVIEWER_FIELDS = Object.freeze(['reviewer_name', 'reviewer_role', 'review_date'])

// The header block above the table: one "key,value" row each. The first four are filled by the
// export; the reviewer fills the last three.
export const HEADER_KEYS = Object.freeze(['kit', 'catalog', 'mapping_version', 'export_date', ...REVIEWER_FIELDS])

export const INSTRUCTIONS = 'Read docs/DEPARTMENT_REVIEW.md first. Fill reviewer_name, reviewer_role and review_date (YYYY-MM-DD) below, then a decision on every row. اقرأ الدليل أولًا، واملأ بيانات المراجع ثم قرارًا في كل سطر.'

// One problem type per check, so a test can name exactly which check fired.
export const PROBLEM_TYPES = Object.freeze({
  'not-a-sheet': 'not a review sheet',
  'not-utf8': 'file is not UTF-8, so Arabic text was lost (in Excel: Save As → "CSV UTF-8")',
  'missing-header': 'reviewer field missing in the header',
  'wrong-catalog': 'sheet made from another catalog or map version',
  'missing-column': 'column missing',
  'unknown-code': 'unknown course code',
  'unknown-link': 'capability not proposed for this course',
  'duplicate-row': 'row appears twice',
  'missing-code': 'course missing from the sheet',
  'missing-link': 'capability link missing from the sheet',
  'empty-decision': 'empty decision',
  'bad-decision': 'decision outside approve / reject / change',
  'change-without-text': 'change without a corrected outcome',
  'bad-assessment': 'assessment outside exam / project / lab / mixed / unknown',
  'arabic-title-without-reviewer': 'Arabic title given without the reviewer name',
})

const outcomeText = (course, lang) => course.learningOutcomes.map(lo => lo[lang] || '').filter(Boolean).join(' | ')
const label = (id, lang) => skills[id]?.labels?.[lang] || ''

// One row per course × capability link, and one row (empty capability cells) per course that maps
// to nothing on purpose. Catalog order.
export function sheetDataRows(catalog) {
  const rows = []
  for (const course of catalog.courses) {
    const base = [course.code, course.title.en, String(course.catalogPage ?? ''), outcomeText(course, 'en'), outcomeText(course, 'ar')]
    const links = course.capabilities.length ? course.capabilities : [null]
    for (const id of links) rows.push([...base, id || '', id ? label(id, 'en') : '', id ? label(id, 'ar') : '', ...REVIEWER_COLUMNS.map(() => '')])
  }
  return rows
}

export function sheetRows(catalog, date) {
  return [
    ['kit', kitVersion(catalog.college)],
    ['instructions', INSTRUCTIONS],
    ['catalog', catalog.catalog],
    ['mapping_version', catalog.mappingVersion],
    ['export_date', date],
    ['reviewer_name', ''],
    ['reviewer_role', ''],
    ['review_date', ''],
    [],
    [...COLUMNS],
    ...sheetDataRows(catalog),
  ]
}

export const sheetFileName = (date, college = DEFAULT_COLLEGE) => `${String(college).toLowerCase()}-map-review-${date}.csv`

// RFC 4180 CSV: quotes, doubled quotes, commas and line breaks inside quotes; a UTF-8 BOM is ignored.
// Blank rows are kept so the header block keeps its shape; the checker skips them.
export function parseCsv(text) {
  const rows = [], src = String(text).replace(/^﻿/, '')
  let row = [], cell = '', quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}
const csvField = value => { const text = String(value ?? ''); return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text }
// UTF-8 with BOM so Excel shows Arabic; CRLF line ends as Excel writes them.
export const toCsvText = rows => '﻿' + rows.map(r => r.map(csvField).join(',')).join('\r\n') + '\r\n'

const isBlank = row => row.every(cell => String(cell).trim() === '')

// Validates a returned sheet against the catalog. Never changes anything. Returns every problem
// found ({ type, where, message }) and the reviewer header.
export function checkSheet(text, catalog = loadCatalog()) {
  const problems = []
  const add = (type, where, detail = '') => problems.push({ type, where, message: `${where}: ${PROBLEM_TYPES[type]}${detail ? ` (${detail})` : ''}` })
  if (String(text).includes('�')) add('not-utf8', 'file')
  const rows = parseCsv(text)
  const headerAt = rows.findIndex(row => String(row[0] ?? '').trim() === 'code')
  if (headerAt < 0) {
    add('not-a-sheet', 'sheet', 'no table header row starting with "code"; export a fresh sheet with npm run review:export')
    return { problems, header: {} }
  }

  // Header block: key,value rows above the table.
  const header = {}
  for (const row of rows.slice(0, headerAt)) {
    const key = String(row[0] ?? '').trim()
    if (key) header[key] = String(row[1] ?? '').trim()
  }
  for (const field of REVIEWER_FIELDS) if (!header[field]) add('missing-header', 'header', `${field} is empty or missing`)
  if (header.catalog !== catalog.catalog || header.mapping_version !== catalog.mappingVersion) {
    add('wrong-catalog', 'header', `sheet: ${header.catalog || '?'} ${header.mapping_version || '?'}; repository: ${catalog.catalog} ${catalog.mappingVersion}`)
  }

  const columns = rows[headerAt].map(cell => String(cell).trim())
  const missingColumns = COLUMNS.filter(col => !columns.includes(col))
  for (const col of missingColumns) add('missing-column', 'table', col)
  if (missingColumns.includes('code') || missingColumns.includes('capability_id') || missingColumns.includes('decision')) return { problems, header }

  const known = new Map(catalog.courses.map(course => [course.code, course]))
  const seenCodes = new Set(), seenLinks = new Set()
  rows.forEach((cells, index) => {
    if (index <= headerAt || isBlank(cells)) return
    const get = col => columns.includes(col) ? String(cells[columns.indexOf(col)] ?? '').trim() : ''
    const code = get('code').toUpperCase(), capability = get('capability_id')
    const where = `line ${index + 1} (${code || 'no code'}${capability ? ` → ${capability}` : ''})`
    const course = known.get(code)
    if (!course) add('unknown-code', where)
    else {
      seenCodes.add(code)
      const proposed = course.capabilities.length ? course.capabilities : ['']
      if (!proposed.includes(capability)) add('unknown-link', where, `proposed: ${course.capabilities.join(', ') || 'none'}`)
      const link = `${code}|${capability}`
      if (seenLinks.has(link)) add('duplicate-row', where)
      seenLinks.add(link)
    }
    const decision = get('decision')
    if (!decision) add('empty-decision', where)
    else if (!DECISIONS.includes(decision.toLowerCase())) add('bad-decision', where, `"${decision}"`)
    else if (decision.toLowerCase() === 'change' && !get('corrected_outcome_en') && !get('corrected_outcome_ar')) add('change-without-text', where)
    const assessment = get('assessment')
    if (assessment && !ASSESSMENTS.includes(assessment.toLowerCase())) add('bad-assessment', where, `"${assessment}"`)
    if (get('title_ar_official') && !header.reviewer_name) add('arabic-title-without-reviewer', where)
  })

  for (const course of catalog.courses) {
    if (!seenCodes.has(course.code)) { add('missing-code', course.code); continue }
    for (const id of course.capabilities) if (!seenLinks.has(`${course.code}|${id}`)) add('missing-link', `${course.code} → ${id}`)
  }
  return { problems, header }
}

export function countByType(problems) {
  const counts = {}
  for (const { type } of problems) counts[type] = (counts[type] || 0) + 1
  return counts
}

// Local date as YYYY-MM-DD (the reviewer's day, not UTC).
export function today(now = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
