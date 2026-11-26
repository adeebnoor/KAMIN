// Interests from my digital activity (DigitalInterests.jsx, unchanged). Task 70: the old interests page is deleted; the
// panel is Profile → More → "More ways to add interests" (K36), its withdrawal is Settings → Consents, and its graph is
// My map's inference proof. Keep-test K36 checks the consent, a suggestion and a confirmation; these check the privacy
// rules around them: the sample adds nothing, raw text is never stored or sent, a separate permission decides whether a
// confirmed topic is used in explanations, and withdrawing removes the topics from this device's copy and the graph.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { kamin } from './roles.js'

const readState = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3')))
async function open(page, lang = 'ar') {
  const app = kamin(page, { ui: 'new', lang })
  await app.home()
  await app.openDigitalInterests()
  return app
}
async function enable(app) {
  await app.check(app.digitalConsent(), 'consent to the analysis')
  await app.click(app.main().getByRole('button', { name: app.t('فعّل التحليل الاختياري', 'Enable optional analysis'), exact: true }), 'enable')
}

test('sample is disposable and no consent or profile topic is silently added', async ({ page }) => {
  const app = await open(page)
  await page.getByRole('button', { name: 'جرّب مثالًا دون بياناتك', exact: true }).click()
  await expect(page.locator('.digital-candidates')).toContainText('تحليل البيانات')
  await expect(page.locator('#digital-posts')).toHaveCount(0)
  const add = page.getByRole('button', { name: 'يمثلني — أضفه', exact: true })
  for (const button of await add.all()) await expect(button).toBeDisabled()
  expect((await readState(page)).insight.digitalInterests.analysisConsent).toBe(false)
  expect((await readState(page)).insight.digitalInterests.confirmed).toEqual([])
  await expect(app.heading('profile')).toBeVisible()
})

test('review and a separate purpose permission gate semantic inference without posting or storing raw text', async ({ page }) => {
  const app = await open(page)
  await enable(app)
  const requests = []
  page.on('request', request => requests.push(`${request.method()} ${request.url()} ${request.postData() || ''}`))
  await page.getByLabel('نصوص اخترتها عن التعلم أو العمل', { exact: true }).fill('SYNTHETIC-PRIVATE-POST-731 أستمتع بتحليل البيانات وSQL.')
  expect(JSON.stringify(await readState(page))).not.toContain('SYNTHETIC-PRIVATE')
  await page.getByRole('button', { name: 'اقترح اهتمامات لأراجعها', exact: true }).click()
  await expect(page.locator('#digital-posts')).toHaveValue('')
  expect((await readState(page)).insight.digitalInterests.confirmed).toEqual([])
  await page.getByRole('button', { name: 'يمثلني — أضفه', exact: true }).click()
  const state = await readState(page)
  expect(state.insight.digitalInterests.confirmed).toHaveLength(1)
  expect(state.insight.digitalInterests.contextConsent).toBe(false)
  expect(JSON.stringify(state)).not.toContain('SYNTHETIC-PRIVATE')
  expect(requests.some(request => request.includes('SYNTHETIC-PRIVATE') || request.startsWith('POST'))).toBe(false)
  // Without the second permission the confirmed topic is not used in the map's explanation (rule R4).
  await app.openMap()
  await expect(app.myMap().locator('.inference-proof')).not.toContainText('R4')
  // Back to the panel (once the analysis is on, it opens without "Explore this source").
  await app.tab('profile')
  const permission = page.getByRole('checkbox', { name: /أسمح باستخدام اهتماماتي المؤكدة/ })
  if (!(await permission.count())) await app.openMore(app.wpr.moreInterests)
  const explore = app.main().getByRole('button', { name: 'استكشف هذا المصدر', exact: true })
  if (await explore.count()) await explore.click()
  await permission.check()
  if (!(await app.myMap().count())) await app.openMap() // "My map" is a toggle; it may still be open
  await expect(app.myMap().locator('.inference-proof')).toContainText('R4')
  await expect(app.myMap().locator('.inference-limits')).toContainText('لا يوجد في هذا الملف دليل')
})

test('privacy withdrawal removes confirmed topics from persistent storage and the graph', async ({ page }) => {
  const app = await open(page)
  await enable(app)
  await page.locator('#digital-posts').fill('أتعلم SQL وتحليل البيانات.')
  await page.getByRole('button', { name: 'اقترح اهتمامات لأراجعها', exact: true }).click()
  await page.getByRole('button', { name: 'يمثلني — أضفه', exact: true }).click()
  await page.getByRole('checkbox', { name: /أسمح باستخدام اهتماماتي المؤكدة/ }).check()
  // Keep the profile on this device, then withdraw from Settings → Consents.
  await app.openSaveOffer()
  await app.keepOnDevice()
  await app.openConsents()
  const control = page.locator('.digital-privacy-control')
  await control.locator('summary').click()
  await control.getByRole('button', { name: 'اسحب الموافقة واحذف الاهتمامات الرقمية', exact: true }).click()
  await expect(control).toContainText('التحليل: غير مفعّل')
  const persisted = () => page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('kamin-local-profile-v1'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const value = await new Promise((resolve, reject) => { const request = db.transaction('profiles').objectStore('profiles').get('current'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    db.close(); return value?.state?.insight?.digitalInterests
  })
  await expect.poll(async () => (await persisted())?.analysisConsent).toBe(false)
  expect((await persisted()).confirmed).toEqual([])
  // A new visit (the profile comes back from this device): no topic in the graph.
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await app.openMap()
  await expect(app.myMap().locator('.inference-proof')).not.toContainText('R4')
})

test('English consent and review controls are accessible with no sensitive-source forms', async ({ page }) => {
  const app = await open(page, 'en')
  await expect(page.getByRole('button', { name: 'Enable optional analysis', exact: true })).toBeDisabled()
  await enable(app)
  await page.getByLabel('Selected text about learning or work', { exact: true }).fill('I like UX and Figma.')
  await page.getByRole('button', { name: 'Suggest interests for review', exact: true }).click()
  await expect(page.locator('.digital-candidates')).toContainText('Product design & user experience')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations.filter(item => ['serious', 'critical'].includes(item.impact)), JSON.stringify(accessibility.violations)).toEqual([])
  await page.getByRole('button', { name: 'Does not reflect me', exact: true }).click()
  expect((await readState(page)).insight.digitalInterests.confirmed).toEqual([])
  await expect(page.locator('input[type=password]')).toHaveCount(0)
})
