// The help pages. Task 70: the old landing page's site header and its "Explore further" demo network (with its synthetic
// people and projects, its evidence switch and pathway picker) are deleted with it (inventory D01); the network's three
// tests are mapped in log/task-70.md (My map: e2e/next-map.spec.js). The help pages are opened directly.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('home navigation opens bilingual guide and service pages with accurate status', async ({ page }) => {
  await page.goto('/ar/guide.html')
  await expect(page.locator('h1:visible')).toHaveText('دليل الاستخدام')
  await expect(page.getByRole('main')).toContainText('احفظ ملفك وعد إليه')
  const publicMenu = page.locator('.k-menu'); if (await publicMenu.isVisible()) await publicMenu.click()
  await page.getByRole('link', { name: 'الخدمات والميزات', exact: true }).click()
  await expect(page.locator('h1:visible')).toHaveText('الخدمات والميزات')
  const ai = page.locator('article:visible').filter({ hasText: 'اكتشاف المسارات والذكاء الاصطناعي' })
  await expect(ai).toContainText('تجربة عاملة + تطوير مخطط')
  await expect(ai).toContainText('GraphRAG')
  await page.locator('[data-language-toggle]').click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('h1:visible')).toHaveText('Services & features')
  const englishAi = page.locator('article:visible').filter({ hasText: 'Pathway discovery & AI' })
  await expect(englishAi).toContainText('Working pilot + planned extensions')
  await expect(englishAi).toContainText('remain planned and require evaluation')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const a = await new AxeBuilder({ page }).analyze(); expect(a.violations.filter(v => ['serious', 'critical'].includes(v.impact)), JSON.stringify(a.violations)).toEqual([])
})

