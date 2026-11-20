// Task 36 · checks a returned learning-path review sheet and shows what merging it would do.
//   npm run path-review:check -- review/learning-path-review-2026-11-18.csv
//   npm run path-review:check -- <file> --apply            → merge into src/catalog/learning-opportunities.json
//   npm run path-review:check -- <file> --apply --list <f>  → merge into another copy (tests)
// Without --apply nothing is changed. --apply works only when the sheet has no problem. Both reviewers
// approve → reviewed (with their two roles and the later date); both retire → retired; any disagreement,
// or both reject → stays illustrative. After a merge, run npm run catalog:course-fit and npm test.
// Exit 0: valid (and merged with --apply). Exit 1: problems (listed). Exit 2: no file given or unreadable.
import { readFileSync, writeFileSync } from 'node:fs'
import { LIST_FILE, PROBLEM_TYPES, applyReview, checkSheet, countByType, loadList, outcomeCounts } from './lib.mjs'

const argv = process.argv.slice(2)
const listAt = argv.indexOf('--list')
const listFile = listAt >= 0 ? argv[listAt + 1] : LIST_FILE
const apply = argv.includes('--apply')
const file = argv.find((arg, i) => !arg.startsWith('--') && argv[i - 1] !== '--list')
if (!file || (listAt >= 0 && !listFile)) {
  console.error('Usage: npm run path-review:check -- <filled sheet.csv> [--apply] [--list <learning-opportunities.json>]')
  process.exit(2)
}
let text, list
try { text = readFileSync(file, 'utf8') } catch (error) {
  console.error(`Cannot read ${file}: ${error.message}`)
  process.exit(2)
}
try { list = loadList(listFile) } catch (error) {
  console.error(`Cannot read the list ${listFile}: ${error.message}`)
  process.exit(2)
}

const { problems, results } = checkSheet(text, list)
if (problems.length) {
  for (const problem of problems) console.log(`- ${problem.message}`)
  console.log('')
  console.log(`${file}: ${problems.length} problem(s). Nothing was changed.`)
  for (const [type, count] of Object.entries(countByType(problems))) console.log(`  ${count} × ${PROBLEM_TYPES[type]}`)
  process.exit(1)
}

for (const r of results) console.log(`  ${r.id}: A ${r.a}, B ${r.b} → ${r.agreement === 'agree' ? '' : 'DISAGREE, '}${r.outcome}`)
const counts = outcomeCounts(results)
console.log(`${file}: OK. ${results.length} items: ${counts.reviewed || 0} reviewed, ${counts.illustrative || 0} stay illustrative, ${counts.retired || 0} retired; ${results.filter(r => r.agreement === 'disagree').length} disagreement(s).`)
if (!apply) {
  console.log('Nothing was changed. Add --apply to merge it into the list.')
  process.exit(0)
}
const merged = applyReview(list, text)
writeFileSync(listFile, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
console.log(`Merged into ${listFile}. Next: npm run catalog:course-fit, then npm test.`)
