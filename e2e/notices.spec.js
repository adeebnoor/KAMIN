// Task 25 · one message at a time: messages in the page flow (never on top of the page), long enough to read, paused
// while pointed at or focused, closed with ×. Task 70: rewritten on the interface, which shows the same Notice
// component in its own place (src/ui2/Notice.jsx). The message is the one after "Yes, keep my profile" (Settings) and
// after a restore (Settings → Back up and restore). The old dashboard's alert tests are mapped in log/task-70.md
// (K33, next-profile). Runs on the desktop and phone projects.
import { test, expect } from '@playwright/test'
import { noticeDuration } from '../src/components/Notice.jsx'
import { kamin } from './roles.js'

const SAVED = { ar: 'حُفظ ملفك على هذا الجهاز. احتفظ أيضًا بنسخة احتياطية مشفّرة.', en: 'Your profile was saved on this device. Keep an encrypted backup too.' }
const RESTORED = { en: 'Your profile was restored locally. Derived results were recomputed from evidence; external sharing consents remain off.' }
const notice = page => page.getByTestId('notice')

async function approved(page, lang) {
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  await app.home()
  return app
}
async function showSavedNotice(app, lang) {
  await app.openSaveOffer()
  await app.keepOnDevice()
  await expect(notice(app.page)).toHaveText(SAVED[lang])
}
// Real time runs until the message is on screen; then the page clock stops (250 ms ahead, so the target is not already
// past when it arrives) and the test moves it. Margins below are 1 second.
async function pauseClock(page) {
  await page.mouse.move(1, 1)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 250))
}
const box = locator => locator.evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width } })
const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0

for (const lang of ['ar', 'en']) test(`a message sits in the page flow and covers nothing: ${lang}`, async ({ page }) => {
  const app = await approved(page, lang)
  await showSavedNotice(app, lang)
  expect(await notice(page).evaluate(el => { for (let n = el; n; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'absolute') return p } return 'static' })).toBe('static')
  const n = await box(notice(page))
  for (const [name, other] of [['page heading', app.main().locator('h1').first()], ['Settings list', app.main().getByTestId('save-status')]]) {
    expect(overlap(n, await box(other)), `the message covers the ${name}`).toBe(false)
  }
})

test('on a phone the message is full width; at 360px nothing scrolls sideways', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 740 })
  const app = await approved(page, 'ar')
  await showSavedNotice(app, 'ar')
  const n = await box(notice(page)), main = await box(page.locator('.ui2-main'))
  const padding = await page.locator('.ui2-main').evaluate(el => parseFloat(getComputedStyle(el).paddingLeft) + parseFloat(getComputedStyle(el).paddingRight))
  expect(Math.abs(n.width - (main.width - padding)), `${info.project.name}: message ${n.width}px, page ${main.width}px`).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await notice(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
})

test('a short message stays 6 seconds, then hides by itself', async ({ page }) => {
  await page.clock.install()
  const app = await approved(page, 'en')
  await showSavedNotice(app, 'en')
  expect(noticeDuration(SAVED.en)).toBe(6000)
  await pauseClock(page)
  await page.clock.runFor(5000)
  await expect(notice(page)).toBeVisible()
  await page.clock.runFor(1500)
  await expect(notice(page)).toHaveCount(0)
})

test('pointing at a message pauses its clock; moving away lets it finish', async ({ page }) => {
  await page.clock.install()
  const app = await approved(page, 'en')
  await showSavedNotice(app, 'en')
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
  const app = await approved(page, 'en')
  await showSavedNotice(app, 'en')
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
  const app = await approved(page, 'en')
  const pass = 'correct horse battery staple'
  const backup = await (await app.downloadBackup(pass)).path()
  await page.evaluate(() => sessionStorage.clear())
  await page.goto('/en/')
  await app.restoreBackup(backup, pass)
  await expect(notice(page)).toHaveText(RESTORED.en)
  const duration = noticeDuration(RESTORED.en)
  expect(duration).toBeGreaterThan(7000)
  await pauseClock(page)
  await page.clock.runFor(6000)
  await expect(notice(page), 'still there after 6 seconds').toBeVisible()
  await page.clock.runFor(duration - 6000 + 1000)
  await expect(notice(page)).toHaveCount(0)
})

test('with reduced motion the message appears without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const app = await approved(page, 'en')
  await showSavedNotice(app, 'en')
  expect(await notice(page).evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  expect(await notice(page).evaluate(el => getComputedStyle(el).animationName)).toBe('notice-in')
})
