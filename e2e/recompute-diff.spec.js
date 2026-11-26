import { test, expect } from '@playwright/test'
import { kamin } from './roles.js'

// Task 04: after the record changes, capabilities are recomputed and the student sees which capability was added,
// dropped or changed, and why. Task 70: rewritten on the interface (Settings → My courses, then Profile). The old
// interface's college switch of an approved record is gone (a college read from the transcript is not offered for
// change; an unrecognised one has its one-tap fix and recompute: e2e/college-from-transcript.spec.js); mapping in
// log/task-70.md.

test('editing a grade in an approved record names the dropped capability and the reason', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.sample()
  await app.home()
  await app.openMyData()
  await app.myGrade('CPIT-240').fill('F')
  await app.saveMyData()
  await app.confirmMyData()
  const panel = page.getByTestId('what-changed')
  await expect(panel).toContainText('ما الذي تغيّر بعد التعديل؟')
  await expect(panel).toContainText('أُزيلت قدرة «قواعد البيانات»')
  await expect(panel).toContainText('أصبحت الدرجة لا تُعد دليلًا')
  await expect(panel).not.toContainText('urn:kamin')
  // The capability is gone from Profile.
  await app.openCapabilities()
  await expect(app.capabilityRows().filter({ hasText: 'قواعد البيانات' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('an English student sees the change and its reason in English', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'en' })
  await app.sample()
  await app.home()
  await app.openMyData()
  await app.askDeleteCourse('STAT-110')
  await app.confirmDeleteOne()
  const panel = page.getByTestId('what-changed')
  await expect(panel).toContainText('Removed “Quantitative analysis”')
  await expect(panel).toContainText('the course was removed from your record')
})
