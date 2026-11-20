// Task 31 · writes the department review sheet for a college's course map (FCIT by default).
//   npm run review:export                       → review/fcit-map-review-<today>.csv
//   npm run review:export -- --date 2026-11-17  → a fixed date in the file name and header
//   npm run review:export -- --out <folder>     → another folder (tests use a temporary one)
//   npm run review:export -- --college SCI      → Task 37: another college's map, review/sci-map-review-<today>.csv.
//                                                 Exits 2 while that college has no map file.
// Reads the map file (src/catalog/<college>-<year>.json) and never writes to it. review/ is git-ignored:
// a filled sheet holds the reviewer's name.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { REVIEW_DIR, loadCollegeMap, parseKitArgs, sheetDataRows, sheetFileName, sheetRows, today, toCsvText } from './lib.mjs'

const args = parseKitArgs(process.argv.slice(2))
function option(name) {
  const at = args.rest.indexOf(name)
  return at >= 0 ? args.rest[at + 1] : undefined
}

if (args.error) {
  console.error(args.error)
  process.exit(2)
}
const map = loadCollegeMap(args.college)
if (map.error) {
  console.error(map.error)
  process.exit(2)
}
const date = option('--date') || today()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`--date must be YYYY-MM-DD, got "${date}"`)
  process.exit(2)
}
const dir = path.resolve(option('--out') || REVIEW_DIR)
const { catalog } = map
const data = sheetDataRows(catalog)
const linkRows = data.filter(row => row[5]).length

mkdirSync(dir, { recursive: true })
const file = path.join(dir, sheetFileName(date, map.college))
writeFileSync(file, toCsvText(sheetRows(catalog, date)), 'utf8')

const shown = path.relative(process.cwd(), file)
console.log(`Wrote ${shown.startsWith('..') ? file : shown}`)
console.log(`${catalog.catalog} · ${catalog.mappingVersion} · ${catalog.courses.length} courses · ${data.length} rows (${linkRows} capability links, ${data.length - linkRows} courses with no capability)`)
console.log(`Send it to the department reviewer with docs/DEPARTMENT_REVIEW.md. When it comes back: npm run review:check -- ${map.college === 'FCIT' ? '' : `--college ${map.college} `}<file>`)
