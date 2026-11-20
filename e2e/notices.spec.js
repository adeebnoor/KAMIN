// Task 25 · one message at a time: no toast after approval, messages in the page flow (never on top of
// the page), long enough to read, paused while pointed at or focused, closed with ×.
// Runs on the desktop and phone projects.
import { test, expect } from './fixtures.js'
import AxeBuilder from '@axe-core/playwright'
import { noticeDuration } from '../src/components/Notice.jsx'
import { approveSample, loadSample, openAppView, openAppWindow, openOtherOptions, openPrivacySection, reloadLanding } from './nav.js'
import { messagesOverHeading } from './usability-lib.js'

const KEEP = { ar: 'نعم، احتفظ بملفي', en: 'Yes, keep my profile' }
const GOT_IT = { ar: 'فهمت', en: 'Got it' }
const SAVED = { ar: 'حُفظ ملفك على هذا الجهاز. احتفظ أيضًا بنسخة احتياطية مشفّرة.', en: 'Your profile was saved on this device. Keep an encrypted backup too.' }
const RESTORED = { ar: 'تمت استعادة ملفك محليًا. أُعيد حساب النتائج من الأدلة، ولم تُفعّل موافقات المشاركة الخارجية.', en: 'Your profile was restored locally. Derived results were recomputed from evidence; external sharing consents remain off.' }
const notice = page => page.getByTestId('notice')
const alertBox = page => page.getByTestId('dashboard-alert')

async function approved(page, lang) {
  await openAppWindow(page, lang)
  await loadSample(page, lang)
  await approveSample(page, lang)
}
// Saving on this device shows a message (the save offer is inside the dashboard's alert).
async function showSavedNotice(page, lang) {
  await alertBox(page).getByRole('button', { name: KEEP[lang], exact: true }).click()
  await expect(notice(page)).toHaveText(SAVED[lang])
}
// Real time runs until the message is on screen; then the page clock stops (250 ms ahead, so the
// target is not already past when it arrives) and the test moves it. Margins below are 1 second.
async function pauseClock(page) {
  await page.mouse.move(1, 1)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 250))
}
const box = locator => locator.evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width } })
const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0

for (const lang of ['ar', 'en']) {
  test(`after approval exactly one message: the dashboard alert, no toast: ${lang}`, async ({ page }) => {
    await approved(page, lang)
    // Read once, right after approval: a retrying check would simply wait out a toast that hides itself.
    const right = await page.evaluate(() => ({
      toasts: document.querySelectorAll('.app-overlay .toast').length,
      notices: document.querySelectorAll('.app-overlay [data-testid=notice]').length,
      messages: [...document.querySelectorAll('.app-overlay [role=status], .app-overlay [role=alert]')]
        .filter(el => el.getClientRects().length > 0 && el.textContent.trim()).map(el => el.className || el.tagName),
    }))
    const covering = await messagesOverHeading(page)
    expect(right).toEqual({ toasts: 0, notices: 0, messages: [] })
    expect(covering).toEqual([])
    await expect(alertBox(page)).toHaveCount(1)
    await expect(alertBox(page).getByTestId('what-changed')).toBeVisible()
    await expect(alertBox(page).getByRole('button', { name: KEEP[lang], exact: true })).toBeVisible()
  })

  test(`a message sits in the page flow and covers nothing: ${lang}`, async ({ page }) => {
    await approved(page, lang)
    await showSavedNotice(page, lang)
    const n = await box(notice(page))
    for (const [name, other] of [['page heading', page.locator('.app-content h2').first()], ['first panel', alertBox(page)], ['capability list', page.locator('.capability-list')]]) {
      expect(overlap(n, await box(other)), `the message overlaps the ${name}`).toBe(false)
    }
    // Above the scrolling content, not over it.
    expect(n.bottom).toBeLessThanOrEqual((await box(page.locator('.app-content-wrap'))).top + 0.5)
    expect(await messagesOverHeading(page)).toEqual([])
    // Polite status, no focus taken.
    await expect(page.locator('.notice-slot[role=status][aria-live=polite]')).toContainText(SAVED[lang])
    expect(await notice(page).evaluate(el => el.contains(document.activeElement))).toBe(false)
    const report = await new AxeBuilder({ page }).include('.app-overlay').analyze()
    expect(report.violations.filter(v => ['serious', 'critical'].includes(v.impact)), JSON.stringify(report.violations)).toEqual([])
  })
}

test('on a phone the message is full width; at 360px nothing scrolls sideways', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await approved(page, 'ar')
  await showSavedNotice(page, 'ar')
  const n = await box(notice(page)), main = await box(page.locator('.app-main'))
  expect(Math.abs(n.width - main.width), `${info.project.name}: message ${n.width}px, app ${main.width}px`).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await notice(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
})

test('a short message stays 6 seconds, then hides by itself', async ({ page }) => {
  await page.clock.install()
  await approved(page, 'en')
  await showSavedNotice(page, 'en')
  expect(noticeDuration(SAVED.en)).toBe(6000)
  await pauseClock(page)
  await page.clock.runFor(5000)
  await expect(notice(page)).toBeVisible()
  await page.clock.runFor(1500)
  await expect(notice(page)).toHaveCount(0)
})

test('pointing at a message pauses its clock; moving away lets it finish', async ({ page }) => {
  await page.clock.install()
  await approved(page, 'en')
  await showSavedNotice(page, 'en')
  await pauseClock(page)
  await notice(page).hover()
  await page.clock.runFor(20_000)
  await expect(notice(page)).toBeVisible()
  await page.mouse.move(1, 1)
  await page.clock.runFor(6500)
  await expect(notice(page)).toHaveCount(0)
})

test('keyboard focus inside a message pauses it; the close button hides it at once', async ({ page }) => {
  await page.clock.install()
  await approved(page, 'en')
  await showSavedNotice(page, 'en')
  await pauseClock(page)
  const close = notice(page).getByRole('button', { name: 'Close message', exact: true })
  await close.focus()
  await page.clock.runFor(20_000)
  await expect(notice(page)).toBeVisible()
  await close.press('Enter')
  await expect(notice(page)).toHaveCount(0)
})

test('restore from backup shows its message exactly as before, for 60 ms per character (over 6 s)', async ({ page }) => {
  test.setTimeout(90_000)
  await page.clock.install()
  await approved(page, 'en')
  await openAppView(page, 'privacy', 'en')
  await openPrivacySection(page, 'backup') // Task 27
  const pass = 'correct horse battery staple'
  await page.getByLabel('Passphrase', { exact: true }).fill(pass)
  await page.getByLabel(/Confirm — export only/).fill(pass)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Download encrypted backup/ }).click()
  const backup = await (await download).path()
  await page.evaluate(() => sessionStorage.clear())
  await reloadLanding(page)
  await page.getByRole('button', { name: /Open workspace/ }).first().click()
  await openOtherOptions(page)
  await page.getByRole('button', { name: /Restore your saved profile/ }).click()
  await page.getByLabel('Passphrase of the backup to restore', { exact: true }).fill(pass)
  await page.locator('input[type="file"][accept*=".kamin"]').setInputFiles(backup)
  await expect(notice(page)).toHaveText(RESTORED.en)
  const duration = noticeDuration(RESTORED.en)
  expect(duration).toBeGreaterThan(7000)
  await pauseClock(page)
  await page.clock.runFor(6000)
  await expect(notice(page), 'still there after 6 seconds').toBeVisible()
  await page.clock.runFor(duration - 6000 + 1000)
  await expect(notice(page)).toHaveCount(0)
})

for (const lang of ['ar', 'en']) test(`"Got it" hides "What changed" for that change, also after leaving the dashboard and coming back: ${lang}`, async ({ page }) => {
  await approved(page, lang)
  await alertBox(page).getByRole('button', { name: GOT_IT[lang], exact: true }).click()
  await expect(alertBox(page).getByTestId('what-changed')).toHaveCount(0)
  // The save offer stays: still one alert.
  await expect(alertBox(page)).toHaveCount(1)
  await openAppView(page, 'matches', lang)
  await openAppView(page, 'dashboard', lang)
  await expect(page.locator('.capability-list')).toBeVisible()
  await expect(page.getByTestId('what-changed')).toHaveCount(0)
  // Back (Task 20) to the dashboard: still hidden.
  await openAppView(page, 'matches', lang)
  await page.goBack()
  await expect(page.locator('.capability-list')).toBeVisible()
  await expect(page.getByTestId('what-changed')).toHaveCount(0)
})

test('with reduced motion the message appears without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await approved(page, 'en')
  await showSavedNotice(page, 'en')
  expect(await notice(page).evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  expect(await notice(page).evaluate(el => getComputedStyle(el).animationName)).toBe('notice-in')
})
