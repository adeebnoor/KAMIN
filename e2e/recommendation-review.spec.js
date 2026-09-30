import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile, mkdir } from 'node:fs/promises'

const text = (lang, ar, en) => lang === 'ar' ? ar : en
const saved = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3')))
const reviews = async page => (await saved(page))?.recommendationReviews || []
const card = page => page.locator('[data-review-key="pathway:job-data-analyst"]')
async function click(page, name) {
  const target = page.getByRole('button', { name, exact: true }).filter({ visible: true }).first()
  if (!(await target.count())) {
    const more = page.locator('.bottom-nav').getByRole('button', { name: /^(المزيد|More)$/ })
    if (await more.isVisible()) await more.click()
  }
  await target.click()
}
async function openSample(page, lang) {
  await page.goto(`/${lang}/`)
  await page.getByRole('button', { name: text(lang, /افتح مساحة العمل/, /Open workspace/) }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: text(lang, 'جرّب المثال التوضيحي', 'Try synthetic demo'), exact: true }).click()
  await page.getByRole('checkbox', { name: text(lang, /أوافق صراحةً/, /I explicitly consent/) }).check()
  await click(page, text(lang, 'أعتمد السجل', 'Approve transcript'))
  await click(page, text(lang, 'فرصي', 'Matches'))
  await expect(card(page)).toBeVisible()
}
async function saveContest(page, lang, note = 'PRIVATE synthetic reviewer note') {
  const review = card(page)
  await review.getByRole('button', { name: text(lang, 'أعترض على هذا الحكم', 'Contest this judgment'), exact: true }).click()
  await review.getByLabel(text(lang, 'اسم المراجع أو اسمه المستعار — محلي', 'Reviewer name or alias — local')).fill('PRIVATE synthetic reviewer')
  await review.getByLabel(text(lang, /ملاحظة محلية/, /Local note/)).fill(note)
  await review.getByRole('button', { name: text(lang, 'احفظ المراجعة محليًا', 'Save review locally') }).click()
  await expect.poll(async () => (await reviews(page)).length).toBe(1)
}

for (const lang of ['ar', 'en']) {
  test(`${lang}: contest is local, export omits personal data, and review form is accessible`, async ({ page }, testInfo) => {
    const errors = []; const outbound = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') outbound.push(request.url()) })
    await openSample(page, lang)
    const before = await saved(page)
    const markup = '<img src=x onerror=window.__reviewPwned=1>'
    await saveContest(page, lang, markup)
    const record = (await reviews(page))[0]
    expect(record).toMatchObject({ action: 'contested', checks: [], timing: null, imported: false, note: markup })
    expect((await saved(page)).courses).toEqual(before.courses)
    expect((await saved(page)).approved).toBe(before.approved)
    const download = page.waitForEvent('download')
    await card(page).getByRole('button', { name: text(lang, 'صدّر مرشح فحص بلا بيانات الملف', 'Export test candidate without profile data') }).click()
    const candidate = JSON.parse(await readFile(await (await download).path(), 'utf8'))
    expect(candidate).toMatchObject({ status: 'unverified-candidate', automaticSubmission: false, confirmedDefect: false, target: { id: 'job-data-analyst' } })
    expect(JSON.stringify(candidate)).not.toContain('PRIVATE')
    expect(JSON.stringify(candidate)).not.toContain(markup)
    expect(candidate).not.toHaveProperty('fingerprint')
    await card(page).getByRole('button', { name: text(lang, 'راجع هذا الحكم', 'Review this judgment'), exact: true }).click()
    const result = await new AxeBuilder({ page }).include('.recommendation-review').analyze()
    expect(result.violations.filter(v => ['serious', 'critical'].includes(v.impact))).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const screenshotDir = `review-candidates/${testInfo.project.name}/${lang}`
    await mkdir(screenshotDir, { recursive: true })
    await card(page).screenshot({ path: `${screenshotDir}/review-form.png` })
    await click(page, text(lang, 'سجل الاستخدام', 'Usage log'))
    await expect(page.locator('.review-history')).toContainText(markup)
    expect(await page.evaluate(() => window.__reviewPwned)).toBeUndefined()
    await expect(page.locator('.review-history img')).toHaveCount(0)
    expect(errors).toEqual([])
    expect(outbound).toEqual([])
  })

  test(`${lang}: acceptance is gated, survives reload, can be withdrawn and cleared`, async ({ page }) => {
    await openSample(page, lang)
    const before = await saved(page)
    const review = card(page)
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
    await page.reload()
    await page.getByRole('button', { name: text(lang, /افتح مساحة العمل/, /Open workspace/) }).first().click()
    await click(page, text(lang, 'فرصي', 'Matches'))
    await expect(review.locator('.review-status')).toHaveText(text(lang, 'أقبلها كخطوة استكشافية', 'Accept as an exploratory step'))
    await review.getByRole('button', { name: text(lang, 'اسحب قراري', 'Withdraw my decision') }).click()
    expect((await reviews(page)).map(r => r.action)).toEqual(['withdrawn', 'accepted'])
    expect((await saved(page)).courses).toEqual(before.courses)
    await click(page, text(lang, 'الخصوصية', 'Privacy'))
    await click(page, text(lang, 'احذف مراجعات التوصيات', 'Delete recommendation reviews'))
    await click(page, text(lang, 'نعم، احذف المراجعات', 'Yes, delete reviews'))
    await expect.poll(async () => (await reviews(page)).length).toBe(0)
    expect((await saved(page)).courses).toEqual(before.courses)
    expect((await saved(page)).approved).toBe(true)
  })

  test(`${lang}: encrypted restore keeps reviews historical and consent withdrawal clears them`, async ({ page }) => {
    await openSample(page, lang)
    await saveContest(page, lang)
    await click(page, text(lang, 'الخصوصية', 'Privacy'))
    const pass = 'synthetic review backup passphrase'
    await page.getByLabel(text(lang, 'عبارة المرور', 'Passphrase'), { exact: true }).fill(pass)
    await page.getByLabel(text(lang, /تأكيد العبارة/, /Confirm — export only/)).fill(pass)
    const download = page.waitForEvent('download')
    await click(page, text(lang, 'تنزيل نسخة مشفّرة', 'Download encrypted backup'))
    const backup = await (await download).path()
    expect(await readFile(backup, 'utf8')).not.toContain('PRIVATE')
    await page.evaluate(() => sessionStorage.clear())
    await page.reload()
    await page.getByRole('button', { name: text(lang, /افتح مساحة العمل/, /Open workspace/) }).first().click()
    await click(page, text(lang, 'استعد ملفك', 'Restore your profile'))
    await page.getByLabel(text(lang, 'عبارة المرور', 'Passphrase'), { exact: true }).fill(pass)
    await page.locator('input[type="file"][accept*=".kamin"]').setInputFiles(backup)
    await expect.poll(async () => (await reviews(page))[0]?.imported).toBe(true)
    await click(page, text(lang, 'فرصي', 'Matches'))
    await expect(card(page).locator('.review-status')).toHaveText(text(lang, 'مراجعة مستعادة؛ يلزم تأكيد جديد', 'Restored review; fresh confirmation needed'))
    await click(page, text(lang, 'الخصوصية', 'Privacy'))
    await page.locator('.consents label').first().getByRole('checkbox').uncheck()
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
