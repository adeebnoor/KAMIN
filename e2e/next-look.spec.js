// Task 75 · Amjd's feedback of 2026-11-19 after using the new interface. Desktop and phone projects, Arabic and English.
// 1. Look: in the light theme the new interface wears the old interface's colours. Until Task 70 each value was read from
//    the old interface with the same approved example; it is deleted, so the values it gave (OLD_LOOK) are kept here: the working surface, the cards and their line, the top bar and its line,
//    the sidebar and its current item (desktop) or the bottom bar and its current item (phone), the main button and the
//    old 7px corners, and the "ك" brand.
// 2. Home: the sentence, KAMIN's idea in three short lines, one button, nothing else in the page.
// 3. One tap on the theme button always switches what is shown (light ↔ dark); the first visit follows the device.
// 4. Dark theme: every old part the new interface reuses (Settings' seven sections, Profile's "what changed", reasons
//    sheet, More and My map, Help's two tools, My plan's development plan, step 4's review, the snapshot reader) has no
//    light surface, no light border and no low-contrast text (e2e/legacyScan.js), and axe finds no colour-contrast
//    violation. In the light theme they look as before.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { NEXT_COPY } from '../src/ui2/copy.js'
import { VIEW_TEXT } from '../src/ui2/views.js'
import { buildCapabilitySnapshot, encryptSnapshot, snapshotFragment } from '../src/utils/capabilitySnapshot.js'
import { profileSkills } from '../src/utils/engine.js'
import { demoCourses } from '../src/data.js'
import { LANGS, kamin } from './roles.js'
import { scanLegacy } from './legacyScan.js'

const tr = (lang, ar, en) => (lang === 'ar' ? ar : en)
const SAMPLE = profileSkills({ approved: true, courses: demoCourses.map(row => ({ ...row })), college: 'FCIT', projects: [], tasks: [], credentials: [], insight: {}, consents: { analyze: true } })
const style = (locator, props) => locator.first().evaluate((el, names) => Object.fromEntries(names.map(name => [name, getComputedStyle(el)[name]])), props)
const isPhone = page => page.viewportSize().width < 760
// The old interface's light colours, as Task 75's test read them from it (the same on both languages); Task 70 deleted
// it, so they are kept as numbers. Phone: the bottom bar and its current item; desktop: the side bar and its current item.
const OLD_LOOK = {
  page: { backgroundColor: 'rgb(244, 240, 230)' },
  card: { backgroundColor: 'rgb(255, 253, 248)', borderTopColor: 'rgb(217, 208, 189)' },
  bar: { backgroundColor: 'rgb(255, 255, 255)', borderBottomColor: 'rgb(216, 208, 189)' },
  button: { backgroundColor: 'rgb(8, 117, 110)', borderTopLeftRadius: '7px' },
}
const OLD_NAV = {
  phone: { nav: { backgroundColor: 'rgb(255, 255, 255)' }, current: { backgroundColor: 'rgb(243, 247, 251)' } },
  desktop: { nav: { backgroundColor: 'rgb(8, 45, 58)' }, current: { backgroundColor: 'rgb(22, 85, 101)', boxShadow: 'rgb(163, 226, 214) 3px 0px 0px 0px inset' } },
}

for (const lang of LANGS) test.describe(`Task 75 · look (${lang})`, () => {
  test.use({ colorScheme: 'light' })

  test('light theme: the same colours, card, top bar, side bar or bottom bar, main button and corners as the old interface', async ({ page }) => {
    const phone = isPhone(page)
    const before = { ...OLD_LOOK, ...OLD_NAV[phone ? 'phone' : 'desktop'] }
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    await app.goToView('profile')
    const after = {
      page: await style(page.locator('.ui2'), ['backgroundColor']),
      card: await style(page.getByTestId('ui2-capabilities'), ['backgroundColor', 'borderTopColor']),
      bar: await style(app.topBar(), ['backgroundColor', 'borderBottomColor']),
      nav: await style(page.getByTestId('ui2-tabs'), ['backgroundColor']),
      current: await style(page.getByTestId('ui2-tabs').locator('[aria-current]'), phone ? ['backgroundColor'] : ['backgroundColor', 'boxShadow']),
      button: await style(app.topBar().getByTestId('ui2-main-action'), ['backgroundColor', 'borderTopLeftRadius']),
    }
    expect(after).toEqual({ page: before.page, card: before.card, bar: before.bar, nav: before.nav, current: before.current, button: before.button })
    expect(before.page.backgroundColor, 'the old cream working surface').toBe('rgb(244, 240, 230)')
    expect(before.button.backgroundColor, 'the old teal main button').toBe('rgb(8, 117, 110)')
    // The old brand: the "ك" mark (brand navy and gold), then the name and the tagline.
    const mark = app.topBar().locator('.ui2-mark')
    await expect(mark).toHaveText('ك')
    expect(await style(mark, ['backgroundColor', 'color'])).toEqual({ backgroundColor: 'rgb(11, 47, 91)', color: 'rgb(234, 211, 152)' })
    await expect(app.topBar().getByRole('link', { name: tr(lang, 'كامن: الرئيسية', 'KAMIN: Home'), exact: true })).toBeVisible()
    if (!phone) await expect(app.topBar().locator('.ui2-brand strong')).toHaveText(tr(lang, 'كامن', 'Kamin'))
    await expect(app.topBar().locator('img'), 'no new logo image').toHaveCount(0)
  })

  test('Home: the old hero, the sentence, KAMIN\'s idea in three short lines and one button, nothing else', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.home()
    const home = app.main().locator('[data-view="home"]')
    await expect(home.getByRole('heading', { level: 1 })).toHaveText(VIEW_TEXT.home.line[lang])
    const lines = home.getByTestId('ui2-home-idea').getByRole('listitem')
    await expect(lines).toHaveText([...NEXT_COPY[lang].home.idea])
    for (const line of NEXT_COPY[lang].home.idea) expect(line.split(/\s+/).length, `"${line}" is short`).toBeLessThanOrEqual(16)
    await expect(home.getByRole('button')).toHaveCount(1)
    await expect(home.getByRole('button')).toHaveText(NEXT_COPY[lang].home.start)
    await expect(home.getByRole('link')).toHaveCount(0)
    expect(await home.evaluate(el => [...el.children].map(child => child.tagName))).toEqual(['H1', 'UL', 'BUTTON'])
    // The old landing hero's gradient behind them.
    expect((await style(home, ['backgroundImage'])).backgroundImage).toMatch(/^linear-gradient\(135deg, rgb\(251, 248, 240\) 0%, rgb\(244, 239, 226\) 55%, rgb\(237, 244, 239\) 100%\)$/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})

for (const lang of LANGS) test.describe(`Task 75 · one tap switches the theme (${lang})`, () => {
  for (const device of ['light', 'dark']) test(`device ${device}: the first visit follows it; each tap shows the other theme, and it stays after a reload`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: device })
    const app = kamin(page, { ui: 'new', lang })
    await app.home()
    const shown = () => page.evaluate(() => ({ choice: document.documentElement.getAttribute('data-theme'), shown: document.documentElement.getAttribute('data-scheme'), scheme: getComputedStyle(document.documentElement).colorScheme }))
    expect(await shown()).toEqual({ choice: 'system', shown: device, scheme: 'light dark' })
    const other = device === 'light' ? 'dark' : 'light'
    await expect(app.themeButton()).toHaveAccessibleName(tr(lang,
      `المظهر: ${device === 'light' ? 'فاتح' : 'داكن'} (حسب جهازك). اضغط للتبديل إلى ${other === 'light' ? 'الفاتح' : 'الداكن'}`,
      `Theme: ${device === 'light' ? 'Light' : 'Dark'} (follows your device). Tap to switch to ${other === 'light' ? 'Light' : 'Dark'}`))
    const page0 = await style(page.locator('.ui2'), ['backgroundColor'])
    await app.themeButton().click()
    expect(await shown(), 'one tap: the other theme').toEqual({ choice: other, shown: other, scheme: other })
    expect(await style(page.locator('.ui2'), ['backgroundColor']), 'the page changed').not.toEqual(page0)
    expect(await page.evaluate(() => localStorage.getItem('kamin-theme'))).toBe(other)
    await app.themeButton().click()
    expect(await shown(), 'a second tap: back').toEqual({ choice: device, shown: device, scheme: device })
    expect(await style(page.locator('.ui2'), ['backgroundColor'])).toEqual(page0)
    await app.themeButton().click()
    await page.reload()
    await expect(app.heading('home')).toBeVisible()
    expect(await shown(), 'kept after a reload').toEqual({ choice: other, shown: other, scheme: other })
    await expect(app.themeButton()).toHaveAccessibleName(tr(lang,
      `المظهر: ${other === 'light' ? 'فاتح' : 'داكن'}. اضغط للتبديل إلى ${device === 'light' ? 'الفاتح' : 'الداكن'}`,
      `Theme: ${other === 'light' ? 'Light' : 'Dark'}. Tap to switch to ${device === 'light' ? 'Light' : 'Dark'}`))
  })
})

// ----- 4. The old parts in the dark theme -----
async function check(page, found, label) {
  await page.waitForFunction(() => document.querySelector('.ui2-legacy'))
  await page.waitForTimeout(200)
  const problems = await page.evaluate(scanLegacy)
  const axe = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  const contrast = axe.violations.flatMap(v => v.nodes.map(node => `axe ${v.id}: ${node.target.join(' ')}`))
  if (problems.length || contrast.length) found[label] = [...problems, ...contrast]
}
const legacyBackground = page => page.locator('.ui2-legacy').first().evaluate(el => getComputedStyle(el).backgroundColor)

for (const lang of LANGS) test.describe(`Task 75 · reused old parts in the dark theme (${lang})`, () => {
  test.use({ colorScheme: 'dark' })

  test('Settings: My courses, Backup and restore, Share, Export, Consents, Delete everything, Usage log', async ({ page }) => {
    test.setTimeout(150_000)
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    const found = {}
    for (const section of ['courses', 'backup', 'share', 'export', 'consents', 'log', 'delete']) {
      await page.goto(`/${lang}/?app=settings#${section}`)
      await expect(app.sectionHeading(section)).toBeVisible()
      expect(await legacyBackground(page), `${section}: the dark --paper`).toBe('rgb(16, 40, 74)')
      await check(page, found, section)
    }
    // Delete everything (its list of what goes is open above), then the "deleted" confirmation and its device check.
    await app.confirmDeleteEverything()
    await expect(app.deletedConfirmation()).toBeVisible()
    await check(page, found, 'deleted')
    expect(found).toEqual({})
  })

  test('Profile: what changed, a capability\'s reasons, More (credential, practice tasks, more ways to add interests), My map', async ({ page }) => {
    test.setTimeout(150_000)
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    const found = {}
    // After the approval Profile shows the "what changed" summary once (the old WhatChanged.jsx).
    await app.tab('profile')
    await expect(page.locator('.ui2-profile-change')).toBeVisible()
    await check(page, found, 'what changed')
    await app.openCapability(0)
    await check(page, found, 'reasons sheet')
    await page.keyboard.press('Escape')
    await app.openCredentials(); await check(page, found, 'credential')
    await app.openTasks(); await app.startFirstTask(); await check(page, found, 'practice tasks')
    await app.openDigitalInterests(); await check(page, found, 'more ways to add interests')
    await app.openMap(); await check(page, found, 'my map')
    await app.mapNodes('evidence').first().click()
    await app.myMap().getByText(tr(lang, 'تفاصيل أبعاد ملفي', 'My profile dimensions'), { exact: true }).click()
    await app.myMap().getByText(tr(lang, 'مسار الدليل الأكاديمي إلى الفرصة', 'Academic evidence path to the opportunity'), { exact: true }).click()
    await check(page, found, 'my map: details open')
    expect(found).toEqual({})
  })

  test('Help tools, My plan\'s development plan, step 4\'s review, the snapshot reader', async ({ page }) => {
    test.setTimeout(150_000)
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    const found = {}
    for (const tool of ['knowledge', 'pathways']) {
      await page.goto(`/${lang}/?app=help#${tool}`)
      await expect(app.main().locator('.ui2-legacy')).toBeVisible()
      await page.waitForTimeout(800)
      await check(page, found, `help ${tool}`)
    }
    await app.goToView('plan')
    await app.openPlan()
    await check(page, found, 'development plan')
    await page.keyboard.press('Escape')
    await app.openRecommendation()
    await app.contestRecommendation(tr(lang, 'اسم مستعار للاختبار', 'Test alias'))
    await check(page, found, 'step 4 review')
    const skill = SAMPLE[0]
    const fragment = snapshotFragment(await encryptSnapshot(buildCapabilitySnapshot({ skillIds: [skill.id], goal: null, levels: { [skill.id]: 'synthetic' } })))
    await page.goto(`/${lang}/${fragment}`)
    await expect(app.snapshotHeading()).toBeVisible()
    await check(page, found, 'snapshot reader')
    await app.openSnapshot()
    await check(page, found, 'snapshot open')
    expect(found).toEqual({})
  })
})

test.describe('Task 75 · reused old parts in the light theme look as before', () => {
  test.use({ colorScheme: 'light' })
  test('the light reset still applies: white fields, the old panel, the old navy main button', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang: 'en' })
    await app.sample()
    await page.goto('/en/?app=settings#backup')
    await expect(app.sectionHeading('backup')).toBeVisible()
    const legacy = page.locator('.ui2-legacy').first()
    expect(await legacy.evaluate(el => getComputedStyle(el).getPropertyValue('--paper').trim())).toBe('#fff')
    expect(await style(legacy.locator('.panel'), ['backgroundColor', 'borderTopColor'])).toEqual({ backgroundColor: 'rgb(255, 253, 248)', borderTopColor: 'rgb(217, 208, 189)' })
    expect(await style(legacy.locator('input:not([type=file]):not(.sr-only)'), ['backgroundColor'])).toEqual({ backgroundColor: 'rgb(255, 255, 255)' })
    expect(await style(legacy.locator('.button.primary'), ['backgroundColor'])).toEqual({ backgroundColor: 'rgb(11, 47, 91)' })
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-scheme'))).toBe('light')
  })
})
