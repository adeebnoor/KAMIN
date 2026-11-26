// The Arabic font is shipped and used. Task 70: the old landing page (its h1 "أشخاص. اهتمامات. …" and the site header's
// language label .k-language) is deleted; the same checks run on the interface's Home and on its top bar's language button.
import { test, expect } from '@playwright/test'
import { VIEW_TEXT } from '../src/ui2/views.js'

test('Arabic font asset and privacy page are available', async ({ page, request }) => {
  const fontResponse = await request.get('/fonts/noto-sans-arabic.woff2')
  expect(fontResponse.ok()).toBeTruthy()

  const privacyResponse = await request.get('/privacy.html')
  expect(privacyResponse.status()).toBe(200)

  await page.goto('/?lang=ar')
  await expect(page.locator('h1')).toHaveText(VIEW_TEXT.home.line.ar)
  await page.evaluate(() => document.fonts.ready)
  const loaded = await page.evaluate(() => document.fonts.check('16px "Noto Sans Arabic Variable"'))
  expect(loaded).toBe(true)
})

test('Arabic language label remains readable in English mode', async ({ page }) => {
  await page.goto('/?lang=en')
  // The top bar's language button (src/ui2/TopBar.jsx): lang="ar", named "العربية", showing "ع".
  const label = page.getByRole('button', { name: 'العربية', exact: true })
  await expect(label).toHaveText('ع')
  await expect(label).toHaveAttribute('lang', 'ar')
  const family = await label.evaluate(el => getComputedStyle(el).fontFamily)
  expect(family).toMatch(/Noto Sans Arabic Variable/)
})
