// Task 60 · the new interface's frame (the only interface since Task 70): one interface, the slim top bar (exactly five controls),
// three tabs (bottom bar on phones, side rail on desktop), the sheet by keyboard, Back/refresh/links, no
// sideways scroll at 360px and axe clean, in Arabic and English. Elements are found through e2e/roles.js.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { LANGS, NEW_APP_VIEWS, kamin } from './roles.js'
import { VIEW_TEXT } from '../src/ui2/views.js'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1366, height: 768 }
const NARROW = { width: 360, height: 780 }
const words = (lang, ar, en) => (lang === 'ar' ? ar : en)
// A made-up approved record (no personal data), as the profile hook keeps it in this tab's session.
const APPROVED = JSON.stringify({ approved: true, courses: [{ code: 'CPIT-110', grade: 'A', source: 'manual' }], consents: { analyze: true } })

// Task 70: the old interface and its address switch are deleted. The retired addresses (old or next) and a device that
// still holds the old interface's setting all open this interface; nothing is stored for it.
const retired = value => `?${new URLSearchParams({ ui: value })}`
test.describe('one interface', () => {
  test('the retired switch addresses open this interface, and the old one is never loaded', async ({ page }) => {
    const requests = []
    page.on('request', request => requests.push(request.url()))
    for (const lang of LANGS) {
      const app = kamin(page, { ui: 'new', lang })
      await page.goto(`/${lang}/`)
      await expect(app.heading('home')).toBeVisible()
      await expect(app.topBar()).toBeVisible()
      // There is no old window: the interface is a full page, not a dialog.
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect.poll(() => new URL(page.url()).search, 'only the view goes into the address').toBe('?app=home')
      for (const value of ['old', 'next']) {
        await page.goto(`/${lang}/${retired(value)}`)
        await expect(app.heading('home')).toBeVisible()
        await expect(page.getByRole('button', { name: words(lang, 'افتح مساحة العمل', 'Open workspace'), exact: true })).toHaveCount(0)
        await expect.poll(() => new URL(page.url()).searchParams.get('app'), 'the parameter is ignored; the view is in the address').toBe('home')
      }
    }
    expect(await page.evaluate(() => localStorage.getItem('kamin-ui')), 'nothing is stored').toBe(null)
    expect(requests.filter(url => /\/(App|LandingExperience|StartScreen)-[\w-]+\.js/.test(url)), 'no old-interface chunk').toEqual([])
  })

  test("a device that kept the old interface's setting opens this interface", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('kamin-ui', 'old'))
    for (const lang of LANGS) {
      await page.goto(`/${lang}/`)
      await expect(kamin(page, { ui: 'new', lang }).heading('home')).toBeVisible()
      await expect(page.getByRole('button', { name: words(lang, 'افتح مساحة العمل', 'Open workspace'), exact: true })).toHaveCount(0)
    }
  })
})

for (const lang of LANGS) test.describe(`frame (${lang})`, () => {
  test('the top bar holds exactly the five controls, is at most 56px high and sticky', async ({ page }) => {
    await page.setViewportSize(PHONE)
    const app = kamin(page, { ui: 'new', lang })
    await app.home()
    const controls = app.topBar().locator('a[href], button, input, select, summary')
    await expect(controls).toHaveCount(5)
    // In order: logo (Home), Start/Continue, Profile, AR/EN, theme.
    await expect(controls.nth(0)).toHaveAccessibleName(words(lang, 'كامن: الرئيسية', 'KAMIN: Home'))
    await expect(controls.nth(1)).toHaveText(words(lang, 'ابدأ', 'Start'))
    await expect(controls.nth(2)).toHaveAccessibleName(VIEW_TEXT.profile.title[lang])
    await expect(controls.nth(3)).toHaveAccessibleName(words(lang, 'English', 'العربية'))
    // Task 61: the theme toggle is real now (it was a disabled placeholder in Task 60); System is the default.
    // Task 75: its name says the theme shown (here the device's light) and that one tap shows Dark.
    await expect(controls.nth(4)).toHaveAccessibleName(words(lang, 'المظهر: فاتح (حسب جهازك). اضغط للتبديل إلى الداكن', 'Theme: Light (follows your device). Tap to switch to Dark'))
    await expect(app.themeButton()).not.toHaveAttribute('aria-disabled', /.*/)
    for (const size of [PHONE, DESKTOP, NARROW]) {
      await page.setViewportSize(size)
      const box = await app.topBar().boundingBox()
      expect(box.height, `top bar height at ${size.width}px`).toBeLessThanOrEqual(56)
      expect(box.y).toBe(0)
      for (let i = 0; i < 5; i++) await expect(controls.nth(i), `control ${i} visible at ${size.width}px`).toBeInViewport()
    }
    expect(await app.topBar().evaluate(el => getComputedStyle(el).position)).toBe('sticky')
    // The logo goes Home.
    await app.goToView('help')
    await app.logo().click()
    await expect(app.heading('home')).toBeVisible()
    await expect(page).toHaveURL(/[?&]app=home(&|$)/)
  })

  test('three tabs: a bottom bar at 390px (44px targets), a side rail at 1366px', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await page.setViewportSize(PHONE)
    await app.home()
    const links = app.tabs().getByRole('link')
    await expect(links).toHaveCount(3)
    await expect(links).toHaveText([words(lang, 'الرئيسية', 'Home'), words(lang, 'خطتي', 'My plan'), words(lang, 'ملفي', 'Profile')])
    await expect(app.tabLink('home')).toHaveAttribute('aria-current', 'page')
    let nav = await app.tabs().boundingBox()
    expect(Math.round(nav.y + nav.height), 'bottom bar touches the bottom').toBe(PHONE.height)
    expect(Math.round(nav.width)).toBe(PHONE.width)
    for (let i = 0; i < 3; i++) {
      const box = await links.nth(i).boundingBox()
      expect(box.width, `tab ${i} width`).toBeGreaterThanOrEqual(44)
      expect(box.height, `tab ${i} height`).toBeGreaterThanOrEqual(44)
    }
    await page.setViewportSize(DESKTOP)
    nav = await app.tabs().boundingBox()
    expect(nav.height, 'a rail is tall').toBeGreaterThan(nav.width)
    expect(nav.y).toBeGreaterThanOrEqual(55)
    // The rail is on the inline start: left in English, right in Arabic.
    if (lang === 'en') expect(Math.round(nav.x)).toBe(0)
    else expect(Math.round(nav.x + nav.width)).toBe(DESKTOP.width)
    const tops = await Promise.all([0, 1, 2].map(i => links.nth(i).boundingBox().then(box => box.y)))
    expect(tops[0]).toBeLessThan(tops[1]); expect(tops[1]).toBeLessThan(tops[2])
  })

  test('tabs, Profile → Settings, Back, Forward, a refresh and a link keep the view in the address', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.home()
    await expect(page).toHaveURL(/[?&]app=home(&|$)/)
    await app.tab('plan')
    await expect(app.heading('plan')).toBeVisible()
    await expect(app.heading('plan')).toBeFocused()
    await expect(page).toHaveURL(/[?&]app=plan(&|$)/)
    await expect(app.tabLink('plan')).toHaveAttribute('aria-current', 'page')
    await app.profileButton().click()
    await expect(app.heading('profile')).toBeVisible()
    await app.main().getByRole('button', { name: VIEW_TEXT.settings.title[lang], exact: true }).click()
    await expect(app.heading('settings')).toBeVisible()
    await expect(app.tabLink('profile')).toHaveAttribute('aria-current', 'true')
    const url = new URL(page.url())
    expect([...url.searchParams.keys()].sort(), 'only the view in the address').toEqual(['app'])
    await page.goBack(); await expect(app.heading('profile')).toBeVisible()
    await page.goBack(); await expect(app.heading('plan')).toBeVisible()
    await page.goBack(); await expect(app.heading('home')).toBeVisible()
    await page.goForward(); await expect(app.heading('plan')).toBeVisible()
    await page.reload(); await expect(app.heading('plan')).toBeVisible()
    // A link to a view opens it; an unknown view opens Home. Task 69: an old interface's view id opens its nearest
    // view (dashboard → Profile; every old address: e2e/history.spec.js).
    await page.goto(`/${lang}/?app=help`)
    await expect(app.heading('help')).toBeVisible()
    await page.goto(`/${lang}/?app=nonsense`)
    await expect(app.heading('home')).toBeVisible()
    await page.goto(`/${lang}/?app=dashboard`)
    await expect(app.heading('profile')).toBeVisible()
  })

  test('Start opens step 1; with a profile the button says Continue and resumes where the flow stopped', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.home()
    await expect(app.mainAction()).toHaveText(words(lang, 'ابدأ', 'Start'))
    await app.mainAction().click()
    await expect(app.heading('upload')).toBeVisible()
    await expect(app.main().getByText(words(lang, 'الخطوة 1 من 4', 'Step 1 of 4'), { exact: true })).toBeVisible()
    await page.evaluate(record => sessionStorage.setItem('kamin-session-v3', record), APPROVED)
    await app.home()
    await expect(app.mainAction()).toHaveText(words(lang, 'تابع', 'Continue'))
    await app.mainAction().click()
    await expect(app.heading('projects')).toBeVisible()
  })

  test('the sheet opens and closes by keyboard, keeps focus inside and gives it back', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await page.setViewportSize(DESKTOP)
    // Task 62: Home is one sentence and one button; the four steps open from each step's indicator (`Step 1 of 4`).
    await app.goToView('upload')
    const opener = app.main().getByRole('button', { name: words(lang, 'الخطوة 1 من 4', 'Step 1 of 4'), exact: true })
    await opener.focus()
    await page.keyboard.press('Enter')
    const sheet = app.sheet(words(lang, 'الخطوات الأربع', 'The four steps'))
    await expect(sheet).toBeVisible()
    await expect(sheet).toHaveAttribute('aria-modal', 'true')
    expect(await sheet.evaluate(el => el.contains(document.activeElement))).toBe(true)
    // Tab and Shift+Tab never leave the sheet.
    for (let i = 0; i < 7; i++) { await page.keyboard.press('Tab'); expect(await sheet.evaluate(el => el.contains(document.activeElement)), `Tab ${i}`).toBe(true) }
    for (let i = 0; i < 7; i++) { await page.keyboard.press('Shift+Tab'); expect(await sheet.evaluate(el => el.contains(document.activeElement)), `Shift+Tab ${i}`).toBe(true) }
    // A side panel on the inline end at 1366px: right in English, left in Arabic, full height.
    const box = await sheet.boundingBox()
    if (lang === 'en') expect(Math.round(box.x + box.width)).toBe(DESKTOP.width)
    else expect(Math.round(box.x)).toBe(0)
    expect(Math.round(box.height)).toBe(DESKTOP.height)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(opener).toBeFocused()
    // The close button by keyboard.
    await page.keyboard.press('Enter')
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: words(lang, 'إغلاق', 'Close'), exact: true }).press('Enter')
    await expect(sheet).toHaveCount(0)
    await expect(opener).toBeFocused()
    // A step in the sheet opens that step.
    await page.keyboard.press('Enter')
    await sheet.getByRole('button', { name: VIEW_TEXT.interests.title[lang], exact: true }).press('Enter')
    await expect(sheet).toHaveCount(0)
    await expect(app.heading('interests')).toBeFocused()
  })

  test('on a phone the sheet comes up from the bottom and a swipe down closes it', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await page.setViewportSize(PHONE)
    // Task 62: Home is one sentence and one button; the four steps open from each step's indicator (`Step 1 of 4`).
    await app.goToView('upload')
    const opener = app.main().getByRole('button', { name: words(lang, 'الخطوة 1 من 4', 'Step 1 of 4'), exact: true })
    await opener.click()
    const sheet = app.sheet(words(lang, 'الخطوات الأربع', 'The four steps'))
    await expect(sheet).toBeVisible()
    const box = await sheet.boundingBox()
    expect(Math.round(box.y + box.height)).toBe(PHONE.height)
    expect(Math.round(box.width)).toBe(PHONE.width)
    const head = sheet.getByRole('heading', { level: 2 })
    const start = await head.boundingBox()
    await page.mouse.move(start.x + 10, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(start.x + 10, start.y + 60, { steps: 4 })
    await page.mouse.move(start.x + 10, start.y + 160, { steps: 4 })
    await page.mouse.up()
    await expect(sheet).toHaveCount(0)
    await expect(opener).toBeFocused()
    // A short drag does not close it.
    await opener.click()
    await expect(sheet).toBeVisible()
    await page.mouse.move(start.x + 10, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(start.x + 10, start.y + 30, { steps: 3 })
    await page.mouse.up()
    await expect(sheet).toBeVisible()
  })

  test('the language switch changes the language, the direction and the address, and keeps the view', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.goToView('plan')
    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
    await app.switchLanguage()
    const other = app.lang
    await expect(page.locator('html')).toHaveAttribute('lang', other)
    await expect(page.locator('html')).toHaveAttribute('dir', other === 'ar' ? 'rtl' : 'ltr')
    await expect(app.heading('plan')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/${other}/\\?.*app=plan`))
    expect(await page.evaluate(() => localStorage.getItem('kamin-lang'))).toBe(other)
  })

  test('no sideways scroll at 360px on any view', async ({ page }) => {
    await page.setViewportSize(NARROW)
    const app = kamin(page, { ui: 'new', lang })
    const wide = []
    await app.walkViews(async view => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (overflow > 0) wide.push(`${view}: ${overflow}px`)
    })
    expect(wide).toEqual([])
  })

  for (const [name, size] of [['phone', PHONE], ['desktop', DESKTOP]]) test(`axe: 0 violations on every view and with the sheet open (${name})`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(size)
    const app = kamin(page, { ui: 'new', lang })
    const found = {}
    const check = async label => {
      const report = await new AxeBuilder({ page }).analyze()
      if (report.violations.length) found[label] = report.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)
    }
    await app.walkViews(check)
    // Task 62: the four steps open from step 1's indicator (Home is one sentence and one button).
    await app.goToView('upload')
    await app.main().getByRole('button', { name: words(lang, 'الخطوة 1 من 4', 'Step 1 of 4'), exact: true }).click()
    await expect(app.sheet(words(lang, 'الخطوات الأربع', 'The four steps'))).toBeVisible()
    await check('step 1 + sheet')
    expect(found).toEqual({})
    expect(NEW_APP_VIEWS).toHaveLength(9)
  })
})

// ---------- Task 61 · light and dark theme ----------
// Colours as the browser computes them (public/brand.css light, src/ui2/theme.css dark).
// Task 75: the light page is the old interface's cream working surface (#f4f0e6); the top bar is the old white top bar.
const SOFT = { light: 'rgb(244, 240, 230)', dark: 'rgb(10, 28, 54)' }
const PAPER = { light: 'rgb(255, 255, 255)', dark: 'rgb(16, 40, 74)' }
// Task 75: the name says the theme shown, "(follows your device)" while nothing is saved, and what one tap does (the other
// theme). Task 61's names (System → Light → Dark) are replaced, with the owner's decision of 2026-11-19.
const themeName = (lang, shown, follows = false) => {
  const other = shown === 'dark' ? 'light' : 'dark'
  return words(lang, `المظهر: ${shown === 'dark' ? 'داكن' : 'فاتح'}${follows ? ' (حسب جهازك)' : ''}. اضغط للتبديل إلى ${other === 'dark' ? 'الداكن' : 'الفاتح'}`,
    `Theme: ${shown === 'dark' ? 'Dark' : 'Light'}${follows ? ' (follows your device)' : ''}. Tap to switch to ${other === 'dark' ? 'Dark' : 'Light'}`)
}
const pageColours = page => page.evaluate(() => ({
  theme: document.documentElement.getAttribute('data-theme'),
  scheme: getComputedStyle(document.documentElement).colorScheme,
  page: getComputedStyle(document.querySelector('.ui2')).backgroundColor,
  bar: getComputedStyle(document.querySelector('.ui2-topbar')).backgroundColor,
  body: getComputedStyle(document.body).backgroundColor,
}))

for (const lang of LANGS) test.describe(`theme (${lang})`, () => {
  test.describe('device in dark mode', () => {
    test.use({ colorScheme: 'dark' })

    test('with no choice saved, the new interface opens dark (System follows the device)', async ({ page }) => {
      const app = kamin(page, { ui: 'new', lang })
      await app.home()
      expect(await pageColours(page)).toEqual({ theme: 'system', scheme: 'light dark', page: SOFT.dark, bar: PAPER.dark, body: SOFT.dark })
      await expect(app.themeButton()).toHaveAccessibleName(themeName(lang, 'dark', true))
      expect(await page.evaluate(() => localStorage.getItem('kamin-theme'))).toBe(null)
      // Task 75: the brand is the old "ك" mark (brand navy with the gold letter), the same in both themes.
      expect(await app.logo().locator('.ui2-mark').evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color])).toEqual(['rgb(11, 47, 91)', 'rgb(234, 211, 152)'])
      // While nothing is saved, the page follows the device as it changes, without a reload.
      await page.emulateMedia({ colorScheme: 'light' })
      expect(await pageColours(page)).toMatchObject({ theme: 'system', page: SOFT.light, bar: PAPER.light })
      await expect(app.themeButton()).toHaveAccessibleName(themeName(lang, 'light', true))
      await page.emulateMedia({ colorScheme: 'dark' })
      expect(await pageColours(page)).toMatchObject({ theme: 'system', page: SOFT.dark, bar: PAPER.dark })
    })

    // Task 75: one tap always shows the other theme (Task 61 cycled System → Light → Dark → System).
    test('one tap shows Light, and it stays after a reload; Enter and Space switch again, keeping focus', async ({ page }) => {
      const app = kamin(page, { ui: 'new', lang })
      await app.home()
      await app.themeButton().click()
      await expect(app.themeButton()).toHaveAccessibleName(themeName(lang, 'light'))
      expect(await pageColours(page)).toMatchObject({ theme: 'light', scheme: 'light', page: SOFT.light, bar: PAPER.light })
      expect(await page.evaluate(() => localStorage.getItem('kamin-theme'))).toBe('light')
      await page.reload()
      await expect(app.heading('home')).toBeVisible()
      await expect(app.themeButton()).toHaveAccessibleName(themeName(lang, 'light'))
      expect(await pageColours(page)).toMatchObject({ theme: 'light', page: SOFT.light, bar: PAPER.light })
      // The toggle works by keyboard and keeps focus.
      await app.themeButton().focus()
      await page.keyboard.press('Enter')
      await expect(app.themeButton()).toHaveAccessibleName(themeName(lang, 'dark'))
      await expect(app.themeButton()).toBeFocused()
      expect(await pageColours(page)).toMatchObject({ theme: 'dark', scheme: 'dark', page: SOFT.dark })
      expect(await page.evaluate(() => localStorage.getItem('kamin-theme'))).toBe('dark')
      await page.keyboard.press('Space')
      await expect(app.themeButton()).toHaveAccessibleName(themeName(lang, 'light'))
      expect(await page.evaluate(() => localStorage.getItem('kamin-theme'))).toBe('light')
      expect(await pageColours(page)).toMatchObject({ theme: 'light', page: SOFT.light })
      // A saved choice no longer follows the device.
      await page.emulateMedia({ colorScheme: 'dark' })
      expect(await pageColours(page)).toMatchObject({ theme: 'light', page: SOFT.light })
    })

    test('no flash: the theme is on the page before the new interface has loaded', async ({ page }) => {
      let release
      const gate = new Promise(resolve => { release = resolve })
      await page.route(/AppNext-[^/]*\.(js|css)$/, async route => { await gate; await route.continue() })
      await page.goto(`/${lang}/`, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'system')
      await expect(page.getByTestId('ui2-topbar')).toHaveCount(0)
      // While the chunk loads, the empty page is already dark (no white flash).
      const [r, g, b] = (await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).match(/\d+/g).map(Number)
      expect(Math.max(r, g, b), 'page colour while loading').toBeLessThan(60)
      release()
      await expect(kamin(page, { ui: 'new', lang }).heading('home')).toBeVisible()
      expect(await pageColours(page)).toMatchObject({ page: SOFT.dark })
    })

    // Task 70: the old interface (light only) is deleted; its retired address opens this one, in the saved theme.
    test('the retired old-interface address opens this interface in the saved dark theme', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('kamin-theme', 'dark'))
      await page.goto(`/${lang}/${retired('old')}`)
      await expect(kamin(page, { ui: 'new', lang }).heading('home')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')
      expect(await pageColours(page)).toMatchObject({ page: SOFT.dark })
    })

    for (const [name, size] of [['phone', PHONE], ['desktop', DESKTOP]]) test(`axe in the dark theme (colour contrast included): 0 violations on every view and with the sheet open (${name})`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize(size)
      const app = kamin(page, { ui: 'new', lang })
      const found = {}
      const check = async label => {
        expect(await page.evaluate(() => getComputedStyle(document.querySelector('.ui2')).backgroundColor), `${label} is dark`).toBe(SOFT.dark)
        const report = await new AxeBuilder({ page }).analyze()
        if (report.violations.length) found[label] = report.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)
      }
      await app.walkViews(check)
      // Task 62: the four steps open from step 1's indicator (Home is one sentence and one button).
      await app.goToView('upload')
      await app.main().getByRole('button', { name: words(lang, 'الخطوة 1 من 4', 'Step 1 of 4'), exact: true }).click()
      await expect(app.sheet(words(lang, 'الخطوات الأربع', 'The four steps'))).toBeVisible()
      await check('step 1 + sheet')
      expect(found).toEqual({})
    })
  })

  test('device in light mode with Dark saved: dark; with Light saved: light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('kamin-theme', 'dark'); sessionStorage.setItem('seeded', '1') } })
    const app = kamin(page, { ui: 'new', lang })
    await app.home()
    expect(await pageColours(page)).toMatchObject({ theme: 'dark', scheme: 'dark', page: SOFT.dark, bar: PAPER.dark })
    await expect(app.themeButton()).toHaveAccessibleName(themeName(lang, 'dark'))
    await page.evaluate(() => localStorage.setItem('kamin-theme', 'light'))
    await page.reload()
    await expect(app.heading('home')).toBeVisible()
    expect(await pageColours(page)).toMatchObject({ theme: 'light', scheme: 'light', page: SOFT.light, bar: PAPER.light })
  })
})
