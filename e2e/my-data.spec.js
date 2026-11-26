import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { settle } from './nav.js'
import { kamin } from './roles.js'

// Task 05: "My data": review and correct everything after approval, see what changed, undo; no technical IDs on any
// screen. Task 70: rewritten on the interface (Settings → My courses, the old MyData.jsx unchanged; Profile; Usage log).
// Deleting a row and withdrawing the transcript consent are e2e/data-control.spec.js's tests now (mapping in
// log/task-70.md).

async function approved(page, lang = 'ar') {
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  await app.home()
  return app
}
const capabilityNames = async app => { await app.openCapabilities(); return app.main().locator('.ui2-cap-name').allInnerTexts() }

test('"My data" is one tap from Profile and lists everything entered with its source', async ({ page }) => {
  const app = await approved(page)
  await app.openMyData()
  const myData = page.getByTestId('my-data')
  await expect(myData.getByRole('heading', { name: 'بياناتي: مراجعة وتصحيح' })).toBeVisible()
  await expect(myData.locator('tbody tr')).toHaveCount(7)
  await expect(myData.locator('tr[data-course="CPIT-240"] .provenance-badge')).toHaveText('مثال وهمي')
  await expect(myData).toContainText('كلية الحاسبات وتقنية المعلومات')
  await expect(myData).toContainText('أدلة تطبيقية مصرّح بها')
  await expect(myData).toContainText('اعتمادات مستوردة')
  await expect(myData).toContainText('الاهتمامات والتفضيلات')
  const results = await new AxeBuilder({ page }).include('[data-testid="my-data"]').analyze()
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('changing a grade to F drops the capability with its reason, and undo restores it', async ({ page }) => {
  const app = await approved(page)
  expect(await capabilityNames(app)).toContain('قواعد البيانات')
  await app.openMyData()
  await app.myGrade('CPIT-240').fill('F')
  await app.saveMyData()
  await app.confirmMyData()
  const changed = page.getByTestId('what-changed')
  await expect(changed).toContainText('أُزيلت قدرة «قواعد البيانات»')
  await expect(changed).toContainText('أصبحت الدرجة لا تُعد دليلًا')
  await expect(app.myGrade('CPIT-240')).toHaveValue('F')
  await page.getByTestId('undo-last-change').click()
  await expect(changed).toContainText('أُضيفت قدرة «قواعد البيانات»')
  await expect(page.getByTestId('undo-last-change')).toHaveCount(0)
  await expect(app.myGrade('CPIT-240')).toHaveValue('B')
  expect(await capabilityNames(app)).toContain('قواعد البيانات')
  await app.openUsageLog()
  await expect(page.locator('.audit-list')).toContainText('CPIT-240: تغيير الدرجة من «B» إلى «F»')
  await expect(page.locator('.audit-list')).toContainText('التراجع عن آخر تغيير في بياناتي')
})

test('urn:kamin never appears in the visible text of any screen', async ({ page }) => {
  const app = await approved(page)
  await app.walkViews(async view => { await settle(page); expect(await page.innerText('body'), view).not.toContain('urn:kamin') })
  await app.openMyData()
  await expect(page.getByTestId('my-data')).toBeVisible()
  expect(await page.innerText('body')).not.toContain('urn:kamin')
  await app.openMap()
  expect(await page.innerText('body'), 'my map').not.toContain('urn:kamin')
})

test('English: My data saves an edit and explains it in English', async ({ page }) => {
  const app = await approved(page, 'en')
  await app.openMyData()
  await app.myGrade('STAT-110').fill('W')
  await app.saveMyData()
  await app.confirmMyData()
  await expect(page.getByTestId('what-changed')).toContainText('Removed “Quantitative analysis” — because the grade no longer counts as evidence')
})

// e2e/next-settings.spec.js checks the wrong-passphrase message on another device; this checks the field itself: it is
// separate from the backup's, starts empty, is marked invalid with the error tied to it, and the right one restores.
test('restore uses its own passphrase field and shows an error under it on a wrong passphrase', async ({ page }) => {
  const app = await approved(page)
  await app.openSettingsSection('backup')
  const pass = 'correct horse battery staple'
  await page.getByLabel('عبارة المرور', { exact: true }).fill(pass)
  await page.getByLabel(/تأكيد العبارة/).fill(pass)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /تنزيل نسخة مشفّرة/ }).click()
  const backup = await (await download).path()
  // export clears its own fields; the restore field is separate and empty
  const restore = page.getByTestId('restore-backup')
  const field = restore.getByLabel('عبارة مرور النسخة المستعادة', { exact: true })
  await expect(field).toHaveValue('')
  await field.fill('a wrong passphrase!!')
  await page.locator('input[type="file"][accept*=".kamin"]').setInputFiles(backup)
  const error = restore.getByRole('alert')
  await expect(error).toContainText('عبارة المرور خاطئة')
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(field).toHaveAttribute('aria-describedby', 'kamin-restore-error')
  // the right passphrase restores (Task 67: a restore opens Profile)
  await field.fill(pass)
  await page.locator('input[type="file"][accept*=".kamin"]').setInputFiles(backup)
  await expect(app.heading('profile')).toBeVisible()
})
