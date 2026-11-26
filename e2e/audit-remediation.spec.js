// Task 70: the old interface is deleted. The public-page tests stay as they were; three app tests are rewritten on the
// interface (below); the network tour (inventory D01), the course comparison (D03) and the Matches row's plan button
// (K08, e2e/next-parity.spec.js) are deleted, mapped in log/task-70.md.
import {test,expect} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { LANGS, kamin } from './roles.js'
const publicPages=['catalog','capstone','pdpl','runs-where','tests','services','guide','privacy','trust','methodology','faq','validation','stories','about','contact','business-model','changelog','interoperability','mapping','sample-report','advisor','admin']
for(const lang of ['ar','en']){
 test(`shared public navigation and single-language content: ${lang}`,async({page,request})=>{
  test.setTimeout(120_000)
  for(const file of publicPages){
   const path=`/${lang}/${file}.html`
   const response=await request.get(path);expect(response.ok(),path).toBeTruthy()
   const source=await response.text()
   expect(source).not.toContain(`data-kamin-lang="${lang==='ar'?'en':'ar'}"`)
   expect(source).toContain(`hreflang="${lang==='ar'?'en':'ar-SA'}"`)
   await page.goto(path)
   await expect(page.locator('h1:visible')).toHaveCount(1)
   await expect(page.locator('.k-site-header')).toHaveCount(1)
   await expect(page.locator('.k-site-footer')).toHaveCount(1)
   const toggle=page.locator('.k-menu');if(await toggle.isVisible())await toggle.click()
   const nav=page.getByRole('navigation',{name:lang==='ar'?'التنقل الرئيسي':'Main navigation',exact:true})
   await expect(nav.getByRole('link',{name:lang==='ar'?'الخدمات والميزات':'Services & features',exact:true})).toBeVisible()
   await expect(nav.getByRole('link',{name:lang==='ar'?'دليل الاستخدام':'User guide',exact:true})).toBeVisible()
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path).toBe(true)
  }
 })
}
test('static content exposes security headers and English metadata without running JavaScript',async({request})=>{
 const response=await request.get('/en/guide.html'),headers=response.headers(),html=await response.text()
 expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
 expect(headers['content-security-policy'].split('script-src')[1].split(';')[0]).not.toContain('unsafe-inline')
 expect(headers['x-frame-options']).toBe('DENY')
 expect(html).toContain('<title>User guide | Kamin</title>')
 expect(html).toContain('og-kamin-en.jpg')
 expect(html).not.toContain('data-kamin-lang="ar"')
})
test("published team plan and AI status match the released baseline",async({page})=>{
 await page.goto("/en/capstone.html")
 await expect(page.getByRole("main")).toContainText("three-college")
 await expect(page.getByRole("main")).toContainText("two HR managers")
 const report=await new AxeBuilder({page}).analyze()
 expect(report.violations.filter(v=>["serious","critical"].includes(v.impact)),JSON.stringify(report.violations)).toEqual([])
 await page.goto("/en/services.html")
 const card=page.locator("article").filter({has:page.getByRole("heading",{name:"Pathway discovery & AI",exact:true})})
 await expect(card).toContainText("Working pilot + planned extensions")
 await expect(card).toContainText("runs locally")
 await page.goto("/ar/services.html")
 await expect(page.getByRole("main")).toContainText("تجربة عاملة + تطوير مخطط")
})

// ---------- Task 70: rewritten on the interface (the old start screen, interests page and saving panel are deleted) ----------
// No automatic consent: the skip link speaks the page's language; step 3's interests consent starts unticked; ticking it
// gives the interests consent only (transcript analysis, advisor sharing and research stay off) and adds no course.
for (const lang of LANGS) test(`localized entry, choices and no automatic consent: ${lang}`, async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang })
  await app.home()
  await expect(page.locator('.skip-link')).toHaveText(lang === 'ar' ? 'تجاوز إلى المحتوى' : 'Skip to content')
  await app.goToView('interests')
  await expect(app.interestsConsent()).not.toBeChecked()
  await app.click(app.interestsConsent(), 'interests consent')
  await app.click(app.interestChip('careerInterest', 'investigative'), 'a chip')
  await expect(app.interestChip('careerInterest', 'investigative')).toHaveAttribute('aria-pressed', 'true')
  const s = await page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3')))
  expect(s.consents).toMatchObject({ insight: true, analyze: false, advisor: false, research: false })
  expect(s.courses).toEqual([])
  const report = await new AxeBuilder({ page }).analyze()
  expect(report.violations.filter(v => ['serious', 'critical'].includes(v.impact)), JSON.stringify(report.violations)).toEqual([])
})

// The session cannot be saved (storage full): the interface says so in an alert that stays, and its button opens
// Settings → Back up and restore. The words are the old interface's (src/ui2/StorageAlert.jsx).
test('storage quota failure is visible and does not crash the profile', async ({ page }) => {
  await page.addInitScript(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key === 'kamin-session-v3') throw new DOMException('Storage full', 'QuotaExceededError'); return original.call(this, key, value) } })
  const app = kamin(page, { ui: 'new', lang: 'en' })
  await app.goToView('interests')
  await app.click(app.interestsConsent(), 'interests consent')
  const alert = page.getByTestId('storage-alert')
  await expect(alert).toContainText('could not be saved')
  await expect(page.getByRole('alert').filter({ has: alert })).toBeVisible()
  await expect(app.interestChip('careerInterest', 'investigative'), 'the page still works').toBeEnabled()
  await alert.getByRole('button', { name: 'Open saving & backup options', exact: true }).click()
  await expect(app.sectionHeading('backup')).toBeVisible()
})

// The device store is blocked: keeping the profile on this device fails with the alert, and no false "saved".
test('device storage failure is reported without a false saved confirmation', async ({ page }) => {
  await page.addInitScript(() => { IDBFactory.prototype.open = function () { throw new DOMException('Storage blocked', 'SecurityError') } })
  const app = kamin(page, { ui: 'new', lang: 'en' })
  await app.sample()
  await app.home()
  await app.openSaveOffer()
  await app.keepOnDevice()
  await expect(page.getByTestId('storage-alert')).toContainText('Storage is unavailable')
  await expect(app.saveStatus()).not.toHaveAttribute('data-saved', 'true')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3')).localPersistence)).toBe(false)
})
