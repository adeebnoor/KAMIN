// Task 36 · writes src/catalog/course-fit-cards.json (the old course-fit cards' view of the learning
// list) so the full list stays out of the startup bundle. Run after editing learning-opportunities.json:
//   npm run catalog:course-fit
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { courseFitView } from '../../src/catalog/courseFitView.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const list = JSON.parse(readFileSync(path.join(ROOT, 'src/catalog/learning-opportunities.json'), 'utf8'))
const out = path.join(ROOT, 'src/catalog/course-fit-cards.json')
const view = courseFitView(list)
writeFileSync(out, `${JSON.stringify(view, null, 2)}\n`, 'utf8')
console.log(`Wrote src/catalog/course-fit-cards.json: ${view.items.length} course-fit cards from ${list.version}`)
