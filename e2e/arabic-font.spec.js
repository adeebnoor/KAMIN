import { test, expect } from '@playwright/test'

test('Arabic font asset and privacy page are available', async ({ page, request }) => {
  const fontResponse = await request.get('/fonts/noto-sans-arabic.woff2')
  expect(fontResponse.ok()).toBeTruthy()

  const privacyResponse = await request.get('/privacy.html')
  expect(privacyResponse.status()).toBe(200)

  await page.goto('/?lang=ar')
  await page.evaluate(() => document.fonts.ready)
  const loaded = await page.evaluate(() => document.fonts.check('16px "Noto Sans Arabic Variable"'))
  expect(loaded).toBe(true)
  await expect(page.locator('h1')).toContainText('افهم قدراتك.')
})

test('Arabic language label remains readable in English mode', async ({ page }) => {
  await page.goto('/?lang=en')
  const label = page.locator('.language-button span[lang="ar"]')
  await expect(label).toHaveText('العربية')
  const family = await label.evaluate(el => getComputedStyle(el).fontFamily)
  expect(family).toMatch(/Noto Sans Arabic Variable/)
})
