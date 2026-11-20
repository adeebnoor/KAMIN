import { test, expect } from './fixtures.js'
import AxeBuilder from '@axe-core/playwright'
import { writeResults } from './usability-lib.js'
import { walkAppViews } from './nav.js'

// Task 30 · axe on every app view, in Arabic and English, on the desktop and phone projects.
// Earlier specs run axe on the screens they happen to test; this one walks the whole list in
// e2e/nav.js (APP_VIEWS), so a new or changed view cannot be missed. Only serious and critical
// violations fail, as in the other specs.
const results = {}

for (const lang of ['ar', 'en']) test(`axe: no serious or critical violation on any app view (${lang})`, async ({ page }) => {
  test.setTimeout(120_000)
  const found = {}
  await walkAppViews(page, lang, async view => {
    const report = await new AxeBuilder({ page }).analyze()
    found[view] = report.violations.filter(v => ['serious', 'critical'].includes(v.impact))
      .map(v => `${v.id} (${v.impact}): ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)
  })
  results[`axe.${lang}`] = found
  for (const [view, violations] of Object.entries(found)) expect.soft(violations, `${view} (${lang})`).toEqual([])
})

test.afterAll(async ({}, info) => { writeResults(info.project.name, results) })
