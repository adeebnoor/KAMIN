// Task 36 · writes the learning-path review sheet: one row per item still shown (retired items are not
// reviewed), two empty reviewer columns and an agreement column (an Excel formula; check.mjs works
// agreement out itself).
//   npm run path-review:export                        → review/learning-path-review-<today>.csv
//   npm run path-review:export -- --date 2026-11-18   → a fixed date in the file name and header
//   npm run path-review:export -- --out <folder>      → another folder (tests use a temporary one)
// Reads src/catalog/learning-opportunities.json and never writes to it. review/ is git-ignored.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { REVIEW_DIR, loadList, reviewableItems, sheetFileName, sheetRows, today, toCsvText } from './lib.mjs'

const argv = process.argv.slice(2)
const option = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : undefined }
const date = option('--date') || today()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`--date must be YYYY-MM-DD, got "${date}"`)
  process.exit(2)
}
const list = loadList()
const dir = path.resolve(option('--out') || REVIEW_DIR)
mkdirSync(dir, { recursive: true })
const file = path.join(dir, sheetFileName(date))
writeFileSync(file, toCsvText(sheetRows(list, date)), 'utf8')

const shown = path.relative(process.cwd(), file)
const retired = list.items.length - reviewableItems(list).length
console.log(`Wrote ${shown.startsWith('..') ? file : shown}`)
console.log(`${list.version} · ${reviewableItems(list).length} items to review (${retired} retired, not in the sheet)`)
console.log('Give it to the two reviewers the supervisor names, with docs/LEARNING_PATH.md. When it comes back: npm run path-review:check -- <file>')
