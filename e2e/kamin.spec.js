import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('Arabic core journey is usable and explainable', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('قيمتك')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()
  await expect(page.getByText(/مقررات مستخرجة/)).toBeVisible()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page.getByText(/هذه قدراتك/)).toBeVisible()
  await page.getByRole('button', { name: /الدورات/ }).first().click()
  await expect(page.getByText(/لا نرتب الدورات فقط/)).toBeVisible()
  await expect(page.getByText(/PMP/).first()).toBeVisible()
  await expect(page.getByText(/لا تناسبك الآن/).first()).toBeVisible()
})

test('language switch sets LTR English experience', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('h1')).toContainText('not your GPA alone')
})

test('public landing has no serious or critical axe violations', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter(v => ['serious', 'critical'].includes(v.impact))
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
})


test('launch metadata and public technical assets are present', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /كامن/)
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest$/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /kamin/)
  await expect(page.locator('img[alt="شعار كامن"]').first()).toBeVisible()

  for (const path of ['/favicon.ico','/favicon.svg','/manifest.webmanifest','/robots.txt','/sitemap.xml','/privacy.html']) {
    const response = await request.get(path)
    expect(response.ok(), `${path} should return 2xx`).toBeTruthy()
  }
})

test('approved pilot session gives explicit local-save confirmation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()
  await page.getByRole('checkbox', { name: /أوافق صراحةً/ }).check()
  await page.getByRole('button', { name: /أعتمد السجل/ }).click()
  await expect(page.getByRole('status')).toContainText(/تم اعتماد السجل/)
  const saved = await page.evaluate(() => localStorage.getItem('kamin-pilot-v1'))
  expect(saved).toContain('"approved":true')
})

test('value-first landing includes an explicitly fictional example', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /شاهد مثال/ }).click()
  await expect(page.locator('#example')).toContainText('من سطر في السيرة إلى قيمة لها دليل')
  await expect(page.locator('#example')).toContainText('مثال توضيحي لطالبة افتراضية')
  await expect(page.locator('#example')).toContainText('PMP')
  await expect(page.locator('#example')).toContainText('بعدها ستستطيع')
})

test('analysis consent is off by default and gates approval', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await page.getByRole('button', { name: /استخدم بيانات تجريبية/ }).click()
  const consent=page.getByRole('checkbox', { name: /أوافق صراحةً/ })
  await expect(consent).not.toBeChecked()
  await expect(page.getByRole('button', { name: /أعتمد السجل/ })).toBeDisabled()
  await consent.check()
  await expect(page.getByRole('button', { name: /أعتمد السجل/ })).toBeEnabled()
})

test('app dialog supports Escape and mobile usage log navigation', async ({ page }) => {
  await page.setViewportSize({width:390,height:844})
  await page.goto('/')
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: /اكتشف لحظة كامن/ }).first().click()
  await expect(page.getByRole('button', { name: /سجل الاستخدام/ })).toBeVisible()
})
