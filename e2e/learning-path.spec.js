// Task 19 · "Suggested learning path" (planned feature) on the Courses tab: gap first, then only items
// that close it, each with "Why is this here?", labelled planned and illustrative.
import { test, expect } from './fixtures.js'
import AxeBuilder from '@axe-core/playwright'
import { openView } from './nav.js'

const L = {
  ar: { open: /افتح مساحة العمل/, demo: 'جرّب المثال التوضيحي', consent: /أوافق صراحةً/, approve: /أعتمد السجل/, courses: 'الدورات', cyber: 'محلل أمن سيبراني مبتدئ', data: 'محلل بيانات', why: 'لماذا يظهر هذا؟', planned: 'ميزة مخطط لها', illustrative: 'مثال توضيحي', missing: 'لا يوجد دليل في سجلك' },
  en: { open: /Open workspace/, demo: 'Try synthetic demo', consent: /I explicitly consent/, approve: /Approve transcript/, courses: 'Courses', cyber: 'Junior Cybersecurity Analyst', data: 'Data Analyst', why: 'Why is this here?', planned: 'Planned feature', illustrative: 'Illustrative example', missing: 'No evidence in your record' },
}

async function approveDemo(page, lang) {
  const l = L[lang]
  await page.goto(`/${lang}/`)
  await page.getByRole('button', { name: l.open }).first().click()
  await page.locator('.app-overlay').getByRole('button', { name: l.demo, exact: true }).click()
  await page.getByRole('checkbox', { name: l.consent }).check()
  await page.getByRole('button', { name: l.approve }).last().click()
  await expect(page.locator('.capability-list')).toBeVisible()
  await openView(page, l.courses)
  // Task 24: the path starts as a one-line summary (with its "planned" label); open it.
  await expect(page.getByTestId('learning-path').getByTestId('path-planned')).toBeVisible()
  await page.getByTestId('learning-path-details').locator(':scope > summary').click()
}

for (const lang of ['ar', 'en']) {
  test(`learning path shows the gap first, then suggestions that close it, with the reason: ${lang}`, async ({ page }) => {
    const l = L[lang]
    await approveDemo(page, lang)
    const path = page.getByTestId('learning-path')
    await expect(path.getByTestId('path-planned')).toHaveText(l.planned)
    await path.getByTestId('path-field').selectOption({ label: l.cyber })
    // The synthetic record has no cybersecurity course: the gap says so.
    await expect(path.locator('[data-capability="cyber"]')).toHaveAttribute('data-status', 'missing')
    await expect(path.locator('[data-capability="cyber"]')).toContainText(l.missing)
    const suggestions = path.getByTestId('path-suggestion')
    expect(await suggestions.count()).toBeGreaterThan(0)
    for (const s of await suggestions.all()) await expect(s).toContainText(l.illustrative)
    const first = suggestions.first()
    await first.getByText(l.why).click()
    await expect(first.locator('details p').first()).toContainText(l.cyber)
    // No score or percentage anywhere in the path.
    expect(await path.innerText()).not.toMatch(/\d+\s*%|score\s*[:=]?\s*\d|\d+\s*\/\s*100/i)
    expect(await path.innerText()).not.toContain('urn:kamin')
  })
}

// Task 36: each suggestion shows its source and either "Planned feature" (with "Illustrative example")
// or "Reviewed by the department"; retired items (invented providers) are never suggested.
for (const lang of ['ar', 'en']) {
  test(`each suggestion shows its source and its review label; retired items never appear: ${lang}`, async ({ page }) => {
    const l = L[lang]
    await approveDemo(page, lang)
    const path = page.getByTestId('learning-path')
    await expect(path.getByTestId('path-planned')).toHaveText(l.planned)
    await path.getByTestId('path-field').selectOption({ label: l.cyber })
    const item = path.locator('[data-item="fcit-cpit-425"]')
    await expect(item).toContainText(l.illustrative)
    await item.getByText(l.why).click()
    await expect(item.locator('.path-source')).toContainText('CPIT-425 · FCIT Catalog 2024-25, p. 62')
    for (const id of ['ba', 'sql', 'cyber-foundations', 'illustrative-testing-basics', 'illustrative-web-basics', 'illustrative-db-operations']) {
      await expect(path.locator(`[data-item="${id}"]`)).toHaveCount(0)
    }
  })
}

test('courses already on the record are not suggested again', async ({ page }) => {
  await approveDemo(page, 'en')
  const path = page.getByTestId('learning-path')
  await path.getByTestId('path-field').selectOption({ label: L.en.data })
  await expect(path.locator('[data-item="fcit-cpit-340"]')).toBeVisible()
  await expect(path.locator('[data-item="fcit-cpit-240"]')).toHaveCount(0) // CPIT-240 is in the synthetic record
  await expect(path.locator('[data-item="fcit-stat-110"]')).toHaveCount(0)
})

test('learning path passes axe and fits 360px (Arabic)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await approveDemo(page, 'ar')
  const path = page.getByTestId('learning-path')
  await path.getByTestId('path-field').selectOption({ label: L.ar.cyber })
  await path.getByTestId('path-suggestion').first().getByText(L.ar.why).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await path.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  const axe = await new AxeBuilder({ page }).include('[data-testid="learning-path"]').analyze()
  expect(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact)), JSON.stringify(axe.violations)).toEqual([])
})
