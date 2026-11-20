// Task 17 · the public test results page, as the supervisor opens it from a link.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { renderTestsPage } from '../scripts/test-report-lib.mjs'

// Commit titles are printed as written in git. Some have no place to break a line:
// 9f9b024 joins page names with commas and no spaces (211 characters).
const LONG_TITLE = 'Propose visual baselines for 404,about,admin,advisor,business-model,capstone,catalog,changelog,contact,faq,guide,index,interoperability,mapping,methodology,privacy,sample-report,services,stories,trust,validation'
const ONE_WORD = `Rename_${'x'.repeat(160)}`

for (const lang of ['ar', 'en']) {
  test(`test results page shows measured numbers, the version and the changes: ${lang}`, async ({ page }) => {
    await page.goto(`/${lang}/tests.html`)
    await expect(page.locator('h1:visible')).toHaveText(lang === 'ar' ? 'نتائج الاختبارات والتغييرات' : 'Test results and changes')
    // The build says which version the site comes from, compared with where the tests ran.
    await expect(page.locator('[data-build-stamp]')).toHaveText(lang === 'ar' ? /النسخة/ : /version/)
    for (const name of ['unit-files', 'unit-tests', 'unit-passed', 'unit-failed', 'e2e-tests', 'e2e-passed', 'e2e-failed'])
      await expect(page.locator(`[data-metric="${name}"] td`)).toHaveText(/^\d+$/)
    for (const id of ['summary', 'coverage', 'evaluation', 'not-measured', 'changes'])
      await expect(page.locator(`#${id}`)).toBeVisible()
    await expect(page.locator('[data-area="network-guard"]')).toBeVisible()
    await expect(page.locator('#evaluation [data-method="lexicon"]')).toBeVisible()
    await expect(page.locator('[data-pending]')).toHaveCount(3)
    for (const item of await page.locator('[data-pending]').all())
      await expect(item).toContainText(lang === 'ar' ? 'لم يُقَس بعد' : 'Not measured yet')
    expect(await page.locator('#changes li').count()).toBeGreaterThan(0)
    // No technical IDs visible.
    expect(await page.locator('main').innerText()).not.toContain('urn:kamin:')
  })

  test(`test results page is linked from the footer, fits 360px and passes axe: ${lang}`, async ({ page }) => {
    await page.goto(`/${lang}/privacy.html`)
    await page.locator('.k-site-footer a[href*="tests"]').click()
    await expect(page).toHaveURL(new RegExp(`/${lang}/tests(\\.html)?$`))
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto(`/${lang}/tests.html`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const report = await new AxeBuilder({ page }).analyze()
    expect(report.violations.filter(v => ['serious', 'critical'].includes(v.impact)), JSON.stringify(report.violations)).toEqual([])
  })

  test(`a long commit title with no spaces wraps inside the list at 360px: ${lang}`, async ({ page }) => {
    // The page is made by the real renderer and served at its real address, so the real stylesheets apply.
    const html = renderTestsPage({
      generatedAt: '2026-11-14T00:00:00.000Z', commit: 'abcdef1', dirty: false, repository: 'https://github.com/example/kamin',
      unit: null, e2e: null, evaluation: null, appMethod: null, changesSince: '89ec64f',
      changes: [{ sha: 'abcdef1', date: '2026-11-12', subject: LONG_TITLE }, { sha: 'abcdef2', date: '2026-11-12', subject: ONE_WORD }],
    })
    await page.route(new RegExp(`/${lang}/tests(\\.html)?$`), route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }))
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto(`/${lang}/tests.html`)
    const items = page.locator(`section[data-kamin-lang="${lang}"] #changes li`)
    await expect(items).toHaveCount(2)
    await expect(items.first()).toBeVisible()
    await expect(items.first()).toContainText(LONG_TITLE)
    await expect(items.last()).toContainText(ONE_WORD)
    // Measured on each item, not only on the page: in Arabic the page is right-to-left and the list left-to-right,
    // so a title running off the right side does not make the page scroll and the page check alone misses it.
    for (const item of await items.all()) {
      const box = await item.evaluate(el => { const r = el.getBoundingClientRect(); return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, left: r.left, right: r.right } })
      expect(box.scrollWidth, 'the title runs past the end of its line').toBeLessThanOrEqual(box.clientWidth)
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(360)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
