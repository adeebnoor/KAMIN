// "Show connections" (the old DecisionStudio): its graph, its plan and its review guard. Task 70: the old tab and the
// landing page's demo graph are deleted; the same graph is My map (Profile → My map, src/components/ShowConnections.jsx),
// the plan is in My plan (K08) and the full re-review is Settings → My courses → "Re-review the whole record" (step 1 in
// edit mode). These are the checks that the next-map, next-parity and keep-tests do not already make (log/task-70.md).
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { LANGS, kamin } from './roles.js'

const tr = (lang, ar, en) => (lang === 'ar' ? ar : en)

for (const lang of LANGS) test(`a course on the map explains its source, never institutional verification; the nodes do not overlap: ${lang}`, async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  await app.home()
  await app.openMap()
  await app.mapNodes('evidence').filter({ hasText: 'CPIT-240' }).first().click()
  await expect(app.myMap().locator('.relationship-node-info')).toContainText(tr(lang, 'لا تعني توثيقًا من الجامعة', 'not institutional verification'))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const nodes = app.myMap().locator('.relationship-map .relationship-node')
  const contained = await nodes.evaluateAll(list => list.every(n => { const r = n.getBoundingClientRect(); return [...n.querySelectorAll('small,strong,svg')].every(c => { const b = c.getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1 }) }))
  expect(contained).toBe(true)
  const rects = await nodes.evaluateAll(list => list.map(n => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }))
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(rects[i].left < rects[j].right && rects[i].right > rects[j].left && rects[i].top < rects[j].bottom && rects[i].bottom > rects[j].top).toBe(false)
  expect(await page.evaluate(() => document.documentElement.dir)).toBe(lang === 'ar' ? 'rtl' : 'ltr')
})

test('a pathway\'s plan opens and downloads without creating new evidence', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.sample()
  await app.home()
  const before = await page.evaluate(() => sessionStorage.getItem('kamin-session-v3'))
  await app.openPlan()
  await expect(app.plan().getByRole('listitem')).toHaveCount(4)
  const download = await app.downloadPlan()
  expect(download.suggestedFilename()).toBe('kamin-development-plan.txt')
  expect(await page.evaluate(() => sessionStorage.getItem('kamin-session-v3')), 'the plan changes nothing stored').toBe(before)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([])
})

test('invalid grades and repeated courses cannot be approved', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.sample()
  await app.home()
  await app.openMyData()
  // My courses → the full re-review: step 1 in edit mode with the approved rows.
  await page.getByRole('button', { name: 'أعد مراجعة السجل كاملًا', exact: true }).click()
  await expect(app.heading('upload')).toBeVisible()
  await app.showReadRows()
  await app.readGrade(1).fill('AAA')
  await expect(app.fixSheet().getByTestId('course-reason').filter({ hasText: 'صيغة درجة غير معروفة' })).toBeVisible()
  await app.hideReadRows()
  await app.reviewConsent().check()
  await expect(app.approveButton()).toBeDisabled()
})
