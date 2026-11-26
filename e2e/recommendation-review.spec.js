import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { kamin } from './roles.js'

// Reviewing or contesting a recommendation (RecommendationReview.jsx, unchanged): local only, the test candidate carries
// no profile data, acceptance is gated, a restored review needs a fresh confirmation, withdrawal clears reviews.
// Task 70: rewritten on the interface: the review is in a next step's Details sheet (step 4, keep-test K37); the
// history is Settings → Usage log; "Delete recommendation reviews" and the consents are Settings → Consents. (The old
// interface reviewed a pathway on Matches; the interface reviews a next step, so the target is the step's item.)

const text = (lang, ar, en) => lang === 'ar' ? ar : en
const saved = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3')))
const reviews = async page => (await saved(page))?.recommendationReviews || []
async function openSample(page, lang) {
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  await app.home()
  await app.openRecommendation()
  await expect(app.review()).toBeVisible()
  return app
}
async function saveContest(app, lang, note = 'PRIVATE synthetic reviewer note') {
  const review = app.review()
  await review.getByRole('button', { name: text(lang, 'أعترض على هذا الحكم', 'Contest this judgment'), exact: true }).click()
  await review.getByLabel(text(lang, 'اسم المراجع أو اسمه المستعار — محلي', 'Reviewer name or alias — local')).fill('PRIVATE synthetic reviewer')
  await review.getByLabel(text(lang, /ملاحظة محلية/, /Local note/)).fill(note)
  await review.getByRole('button', { name: text(lang, 'احفظ المراجعة محليًا', 'Save review locally') }).click()
  await expect.poll(async () => (await reviews(app.page)).length).toBe(1)
}

for (const lang of ['ar', 'en']) {
  test(`${lang}: contest is local, export omits personal data, and review form is accessible`, async ({ page }) => {
    const errors = []; const outbound = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (!/^(data|blob):/.test(request.url()) && new URL(request.url()).origin !== 'http://127.0.0.1:4173') outbound.push(request.url()) })
    const app = await openSample(page, lang)
    const before = await saved(page)
    const markup = '<img src=x onerror=window.__reviewPwned=1>'
    await saveContest(app, lang, markup)
    const record = (await reviews(page))[0]
    expect(record).toMatchObject({ action: 'contested', checks: [], timing: null, imported: false, note: markup })
    expect((await saved(page)).courses).toEqual(before.courses)
    expect((await saved(page)).approved).toBe(before.approved)
    const download = page.waitForEvent('download')
    await app.review().getByRole('button', { name: text(lang, 'صدّر مرشح فحص بلا بيانات الملف', 'Export test candidate without profile data') }).click()
    const candidate = JSON.parse(await readFile(await (await download).path(), 'utf8'))
    expect(candidate).toMatchObject({ status: 'unverified-candidate', automaticSubmission: false, confirmedDefect: false })
    expect(candidate.target.id).toBeTruthy()
    expect(JSON.stringify(candidate)).not.toContain('PRIVATE')
    expect(JSON.stringify(candidate)).not.toContain(markup)
    expect(candidate).not.toHaveProperty('fingerprint')
    await app.review().getByRole('button', { name: text(lang, 'راجع هذا الحكم', 'Review this judgment'), exact: true }).click()
    const result = await new AxeBuilder({ page }).include('.recommendation-review').analyze()
    expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.keyboard.press('Escape')
    await app.openUsageLog()
    await expect(page.locator('.review-history')).toContainText(markup)
    expect(await page.evaluate(() => window.__reviewPwned)).toBeUndefined()
    await expect(page.locator('.review-history img')).toHaveCount(0)
    expect(errors).toEqual([])
    expect(outbound).toEqual([])
  })

  test(`${lang}: acceptance is gated, survives reload, can be withdrawn and cleared`, async ({ page }) => {
    const app = await openSample(page, lang)
    const before = await saved(page)
    const review = app.review()
    await review.getByRole('button', { name: text(lang, 'راجع هذا الحكم', 'Review this judgment'), exact: true }).click()
    await review.getByLabel(text(lang, 'قراري الآن', 'My decision now')).selectOption('accepted')
    await review.getByLabel(text(lang, 'اسم المراجع أو اسمه المستعار — محلي', 'Reviewer name or alias — local')).fill('Synthetic reviewer')
    const save = review.getByRole('button', { name: text(lang, 'احفظ المراجعة محليًا', 'Save review locally') })
    await expect(save).toBeDisabled()
    for (const checkbox of await review.locator('fieldset input[type="checkbox"]').all()) await checkbox.check()
    await review.getByLabel(text(lang, 'ثقتي في قراري', 'Confidence in my decision')).selectOption('confident')
    await review.getByRole('checkbox', { name: text(lang, /ابدأ قياس وقت/, /Start timing/) }).check()
    await expect(save).toBeEnabled()
    await save.click()
    await expect.poll(async () => (await reviews(page))[0]?.action).toBe('accepted')
    expect((await reviews(page))[0].timing).toMatchObject({ consented: true, interrupted: false })
    // A reload: the same step's review says it was accepted.
    await page.reload()
    // (the goal chosen on the way in stays chosen: step 4 opens on it)
    await app.goToView('next')
    await app.openLearningPath()
    await expect(app.review().locator('.review-status')).toHaveText(text(lang, 'أقبلها كخطوة استكشافية', 'Accept as an exploratory step'))
    await app.review().getByRole('button', { name: text(lang, 'اسحب قراري', 'Withdraw my decision') }).click()
    expect((await reviews(page)).map(r => r.action)).toEqual(['withdrawn', 'accepted'])
    expect((await saved(page)).courses).toEqual(before.courses)
    await page.keyboard.press('Escape')
    await app.openConsents()
    const actions = page.locator('.review-privacy-actions')
    await actions.locator('summary').click()
    await actions.getByRole('button', { name: text(lang, 'احذف مراجعات التوصيات', 'Delete recommendation reviews'), exact: true }).click()
    await page.getByRole('button', { name: text(lang, 'نعم، احذف المراجعات', 'Yes, delete reviews'), exact: true }).click()
    await expect.poll(async () => (await reviews(page)).length).toBe(0)
    expect((await saved(page)).courses).toEqual(before.courses)
    expect((await saved(page)).approved).toBe(true)
  })

  test(`${lang}: encrypted restore keeps reviews historical and consent withdrawal clears them`, async ({ page }) => {
    const app = await openSample(page, lang)
    await saveContest(app, lang)
    await page.keyboard.press('Escape')
    const pass = 'synthetic review backup passphrase'
    const backup = await (await app.downloadBackup(pass)).path()
    expect(await readFile(backup, 'utf8')).not.toContain('PRIVATE')
    await page.evaluate(() => sessionStorage.clear())
    await page.goto(`/${lang}/`)
    await app.restoreBackup(backup, pass)
    await expect.poll(async () => (await reviews(page))[0]?.imported).toBe(true)
    await app.goToView('next')
    await app.openLearningPath()
    await expect(app.review().locator('.review-status')).toHaveText(text(lang, 'مراجعة مستعادة؛ يلزم تأكيد جديد', 'Restored review; fresh confirmation needed'))
    await page.keyboard.press('Escape')
    await app.openConsents()
    await app.consent('analyze').uncheck()
    await expect.poll(async () => (await reviews(page)).length).toBe(0)
    expect((await saved(page)).approved).toBe(false)
  })

  test(`${lang}: public governance and study metrics state what is implemented`, async ({ page }) => {
    await page.goto(`/${lang}/methodology.html`)
    await expect(page.locator('#recommendation-governance li')).toHaveCount(7)
    await page.locator('#recommendation-governance a').click()
    await expect(page.locator('#review-metrics')).toContainText(text(lang, 'لا نتائج ميدانية منشورة', 'no published field results'))
    await expect(page.locator('#review-metrics')).toContainText('≤120')
    await expect(page.locator('#review-metrics')).toContainText('≤5%')
  })
}
