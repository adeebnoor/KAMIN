// Task 31 · checks a returned department review sheet. Changes nothing.
//   npm run review:check -- review/fcit-map-review-2026-11-17.csv
//   npm run review:check -- --college SCI review/sci-map-review-<date>.csv   (Task 37: another college's map)
// Exit 0: the sheet is complete and valid. Exit 1: problems (listed). Exit 2: no file given or unreadable,
// or the college is unknown, has no map file, or its map file is incomplete.
import { readFileSync } from 'node:fs'
import { PROBLEM_TYPES, checkSheet, countByType, loadCollegeMap, parseKitArgs } from './lib.mjs'

const args = parseKitArgs(process.argv.slice(2))
if (args.error) {
  console.error(args.error)
  process.exit(2)
}
const file = args.rest[0]
if (!file) {
  console.error('Usage: npm run review:check -- [--college <ID>] <filled sheet.csv>')
  process.exit(2)
}
const map = loadCollegeMap(args.college)
if (map.error) {
  console.error(map.error)
  process.exit(2)
}
let text
try { text = readFileSync(file, 'utf8') } catch (error) {
  console.error(`Cannot read ${file}: ${error.message}`)
  process.exit(2)
}

const { problems } = checkSheet(text, map.catalog)
if (!problems.length) {
  console.log(`${file}: OK. Every course and link has a valid decision and the reviewer header is complete.`)
  process.exit(0)
}

for (const problem of problems) console.log(`- ${problem.message}`)
console.log('')
console.log(`${file}: ${problems.length} problem(s). Nothing was changed.`)
for (const [type, count] of Object.entries(countByType(problems))) console.log(`  ${count} × ${PROBLEM_TYPES[type]}`)
process.exit(1)
