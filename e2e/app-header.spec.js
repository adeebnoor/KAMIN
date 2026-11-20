// Task 26 · the app top bar: where am I (section title), is my profile saved (chip), switch language.
// Runs on the desktop and phone projects.
import { test, expect } from './fixtures.js'
import AxeBuilder from '@axe-core/playwright'
import { SECTIONS, TABS, sectionOf } from '../src/navigation.js'
import { copy } from '../src/i18n.js'
import { APP_VIEWS, approveSample, loadSample, openAppView, openAppWindow, openDashboardMore, openView, walkAppViews } from './nav.js'

const OTHER = { ar: 'en', en: 'ar' }
const LANG_BUTTON = { ar: 'English', en: 'العربية' }
const CLOSE = { ar: 'إغلاق', en: 'Close' }
const REVIEW = { ar: 'راجع سجلك', en: 'Review your record' }
const SAVED = { ar: 'محفوظ على هذا الجهاز', en: 'Saved on this device' }
const SESSION = { ar: 'لهذه الجلسة فقط', en: 'This session only' }
const KEEP = { ar: 'نعم، احتفظ بملفي', en: 'Yes, keep my profile' }
const PRIVACY_TAB = lang => TABS['my-data'].find(tab => tab.view === 'privacy').labels[lang]
const sectionLabel = (view, lang) => SECTIONS.find(s => s.id === sectionOf(view)).labels[lang]

const title = page => page.getByTestId('app-topbar-title')
const chip = page => page.getByTestId('save-status')
const langButton = page => page.getByTestId('app-language')
const appParam = page => new URL(page.url()).searchParams.get('app')
const htmlLang = page => page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }))
const DIR = { ar: 'rtl', en: 'ltr' }

for (const lang of ['ar', 'en']) {
  test(`the top bar title is the active section's label on every view: ${lang}`, async ({ page }) => {
    const seen = []
    await walkAppViews(page, lang, async view => {
      const want = view === 'review' ? REVIEW[lang] : sectionLabel(view, lang)
      await expect(title(page), view).toHaveText(want)
      // The same words as the section the navigation marks as current (sidebar on desktop, bottom bar on phones).
      if (view !== 'review') await expect(page.locator('nav button[aria-current="page"]:visible')).toHaveText(want)
      seen.push(view)
    })
    expect(seen).toEqual(APP_VIEWS)
    // The reviewer tool outside the four sections has its own name.
    await openView(page, lang === 'ar' ? 'مستكشف المعرفة' : 'Knowledge explorer')
    await expect(title(page)).toHaveText(lang === 'ar' ? 'مستكشف المعرفة' : 'Knowledge explorer')
    // The old texts are gone from the top bar.
    await expect(page.locator('.app-topbar')).not.toContainText(/Try Kamin|Public release|Student-reviewed profile|تجربة كامن|إصدار عام|ملف راجعته أنت/)
  })

  test(`switching language keeps the app open, the view and an edited grade: ${lang}`, async ({ page }) => {
    await openAppWindow(page, lang)
    await loadSample(page, lang)
    const grade = page.getByLabel(`${copy[lang].app.grade} 1`, { exact: true })
    const edited = (await grade.inputValue()) === 'C' ? 'D' : 'C'
    await grade.fill(edited)
    const consent = page.locator('.approval-consent input[type=checkbox]')
    await consent.check()
    await expect.poll(() => appParam(page)).toBe('review')
    expect(await htmlLang(page)).toEqual({ lang, dir: DIR[lang] })

    // Keyboard: focus the language button and press Enter.
    await langButton(page).focus()
    await page.keyboard.press('Enter')
    const other = OTHER[lang]
    await expect.poll(() => htmlLang(page)).toEqual({ lang: other, dir: DIR[other] })
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(title(page)).toHaveText(REVIEW[other])
    await expect(page.getByLabel(`${copy[other].app.grade} 1`, { exact: true })).toHaveValue(edited)
    await expect(consent).toBeChecked()
    await expect.poll(() => appParam(page)).toBe('review')
    expect(new URL(page.url()).pathname).toBe(`/${other}/`)
    // Focus stays on the button the student used (it now offers the first language back).
    await expect(langButton(page)).toBeFocused()
    await expect(langButton(page)).toHaveText(LANG_BUTTON[other])

    // And back again: still the same draft.
    await langButton(page).click()
    await expect.poll(() => htmlLang(page)).toEqual({ lang, dir: DIR[lang] })
    await expect(grade).toHaveValue(edited)
    await expect(title(page)).toHaveText(REVIEW[lang])
    // Escape still closes the window after a switch.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test(`open accordions survive a language switch (the app is not remounted): ${lang}`, async ({ page }) => {
    await openAppWindow(page, lang)
    await loadSample(page, lang)
    await approveSample(page, lang)
    await openDashboardMore(page)
    const row = page.locator('.capability-row').first()
    await row.click()
    await expect(row).toHaveAttribute('aria-expanded', 'true')
    await langButton(page).click()
    await expect.poll(() => htmlLang(page)).toEqual({ lang: OTHER[lang], dir: DIR[OTHER[lang]] })
    await expect(page.getByTestId('dashboard-more')).toHaveJSProperty('open', true)
    await expect(page.locator('.capability-row').first()).toHaveAttribute('aria-expanded', 'true')
    await expect(title(page)).toHaveText(sectionLabel('dashboard', OTHER[lang]))
    await expect.poll(() => appParam(page)).toBe('dashboard')
  })

  test(`the save chip follows localPersistence and opens the privacy tab in one click: ${lang}`, async ({ page }) => {
    await openAppWindow(page, lang)
    // Before any data exists there is nothing to save: no chip.
    await expect(page.getByTestId('start-more')).toBeVisible()
    await expect(chip(page)).toHaveCount(0)

    await loadSample(page, lang)
    await expect(chip(page)).toHaveText(SESSION[lang])
    await expect(chip(page)).toHaveAttribute('data-saved', 'false')
    await chip(page).click()
    await expect(page.getByRole('tab', { name: PRIVACY_TAB(lang), exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect.poll(() => appParam(page)).toBe('privacy')
    // The privacy badge says the same thing.
    await expect(page.locator('.app-content .status.conditional', { hasText: lang === 'ar' ? 'جلسة مؤقتة' : 'Session only' })).toBeVisible()

    await openAppView(page, 'start', lang)
    await loadSample(page, lang)
    await approveSample(page, lang)
    await page.getByTestId('dashboard-alert').getByRole('button', { name: KEEP[lang], exact: true }).click()
    await expect(chip(page)).toHaveText(SAVED[lang])
    await expect(chip(page)).toHaveAttribute('data-saved', 'true')
    await chip(page).click()
    await expect(page.getByRole('tab', { name: PRIVACY_TAB(lang), exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.app-content .status.yes', { hasText: SAVED[lang] })).toBeVisible()
  })

  test(`the close button keeps initial focus; the top bar passes axe: ${lang}`, async ({ page }) => {
    await openAppWindow(page, lang)
    await expect(page.getByRole('button', { name: CLOSE[lang], exact: true })).toBeFocused()
    // The language button is named by its visible text, in its own language.
    await expect(page.getByRole('button', { name: LANG_BUTTON[lang], exact: true })).toHaveCount(1)
    await expect(langButton(page).locator(`span[lang="${OTHER[lang]}"]`)).toHaveText(LANG_BUTTON[lang])
    const scan = async () => (await new AxeBuilder({ page }).include('.app-topbar').analyze()).violations.map(v => `${v.id}: ${v.nodes.length}`)
    expect(await scan(), 'start').toEqual([])
    await loadSample(page, lang)
    await approveSample(page, lang)
    await expect(chip(page)).toBeVisible()
    expect(await scan(), 'dashboard with the chip').toEqual([])
    // Keyboard order follows the reading order: chip, language, close.
    await chip(page).focus()
    await page.keyboard.press('Tab')
    await expect(langButton(page)).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: CLOSE[lang], exact: true })).toBeFocused()
  })

  for (const width of [360, 390]) {
    test(`phone ${width}px: top bar at most 56px, title readable, nothing sideways: ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await openAppWindow(page, lang)
      await loadSample(page, lang)
      await approveSample(page, lang)
      for (const view of ['dashboard', 'matches', 'insight', 'privacy']) {
        await openAppView(page, view, lang)
        await expect(title(page)).toHaveText(sectionLabel(view, lang))
        const bar = await page.evaluate(() => {
          const el = document.querySelector('.app-topbar'), t = el.querySelector('.app-topbar-title')
          const box = t.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(t)
          const rects = [...range.getClientRects()]
          return {
            height: el.getBoundingClientRect().height,
            sideways: el.scrollWidth > el.clientWidth || document.documentElement.scrollWidth > innerWidth,
            titleLines: new Set(rects.map(r => Math.round(r.top))).size,
            titleInside: rects.every(r => r.left >= box.left - 1 && r.right <= box.right + 1),
            controlsVisible: [...el.querySelectorAll('button')].every(b => { const r = b.getBoundingClientRect(); return r.width >= 40 && r.left >= 0 && r.right <= innerWidth }),
          }
        })
        expect(bar.height, view).toBeLessThanOrEqual(56)
        expect(bar, view).toMatchObject({ sideways: false, titleInside: true, controlsVisible: true })
        expect(bar.titleLines, view).toBeLessThanOrEqual(2)
      }
    })
  }

  test(`Back after a switch keeps the new language in the address: ${lang}`, async ({ page }) => {
    await openAppWindow(page, lang)
    await loadSample(page, lang)
    await approveSample(page, lang)
    await openAppView(page, 'matches', lang)
    await expect.poll(() => appParam(page)).toBe('matches')
    const other = OTHER[lang]
    await langButton(page).click()
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/${other}/`)
    await expect.poll(() => appParam(page)).toBe('matches')

    await page.goBack()
    await expect(title(page)).toHaveText(sectionLabel('dashboard', other))
    await expect.poll(() => appParam(page)).toBe('dashboard')
    expect(new URL(page.url()).pathname).toBe(`/${other}/`)
    expect(await htmlLang(page)).toEqual({ lang: other, dir: DIR[other] })
    // A refresh now stays in the language on screen.
    await page.reload()
    await expect(title(page)).toHaveText(sectionLabel('dashboard', other))
    expect(await htmlLang(page)).toEqual({ lang: other, dir: DIR[other] })

    await page.goForward()
    await expect(title(page)).toHaveText(sectionLabel('matches', other))
    expect(new URL(page.url()).pathname).toBe(`/${other}/`)
  })
}

test('desktop layout: the top bar is 64px and has no brand text (the sidebar names Kamin)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await openAppWindow(page, 'en')
  expect(await page.locator('.app-topbar').evaluate(el => el.getBoundingClientRect().height)).toBe(64)
  await expect(page.locator('.app-sidebar .app-brand')).toBeVisible()
  await expect(page.locator('.app-sidebar')).toContainText('Local processing in public release')
})
