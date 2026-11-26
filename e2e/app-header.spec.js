// Task 26 · the app top bar: where am I, switch language. Task 70: the old interface's top bar (its section title, save
// chip, close button and 64px desktop bar) is deleted with it; those tests are mapped in log/task-70.md to
// e2e/next-shell.spec.js and the keep-tests. The three rules below still hold on the interface and run on its top bar:
// a language switch keeps the student's unapproved draft, leaves open sections open (the page is not remounted), and
// Back after a switch keeps the new language in the address. Desktop and phone projects.
import { test, expect } from '@playwright/test'
import { LANGS, kamin } from './roles.js'

const OTHER = { ar: 'en', en: 'ar' }
const DIR = { ar: 'rtl', en: 'ltr' }
const appParam = page => new URL(page.url()).searchParams.get('app')
const htmlLang = page => page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }))

for (const lang of LANGS) {
  test(`switching language keeps the step, the edited grade and the ticked consent of an unapproved draft: ${lang}`, async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await page.goto(`/${lang}/?start=sample`)
    await app.showReadRows()
    const grade = app.readGrade(1)
    const edited = (await grade.inputValue()) === 'C' ? 'D' : 'C'
    await grade.fill(edited)
    await app.hideReadRows()
    await app.reviewConsent().check()
    await expect.poll(() => appParam(page)).toBe('upload')
    expect(await htmlLang(page)).toEqual({ lang, dir: DIR[lang] })

    // Keyboard: focus the language button and press Enter.
    await app.languageButton().focus()
    await page.keyboard.press('Enter')
    app.lang = OTHER[lang]
    await expect.poll(() => htmlLang(page)).toEqual({ lang: OTHER[lang], dir: DIR[OTHER[lang]] })
    expect(new URL(page.url()).pathname).toBe(`/${OTHER[lang]}/`)
    await expect.poll(() => appParam(page)).toBe('upload')
    // Focus stays on the button the student used (it now offers the first language back).
    await expect(app.languageButton()).toBeFocused()
    // The draft is the same: the consent is still ticked and the grade still edited; nothing was approved.
    await expect(app.reviewConsent()).toBeChecked()
    await app.showReadRows()
    await expect(app.readGrade(1)).toHaveValue(edited)
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3') || '{}').approved || false)).toBe(false)
  })

  test(`open sections survive a language switch (the page is not remounted): ${lang}`, async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    await app.openCapabilities()
    const legend = page.getByTestId('level-legend')
    await legend.locator('summary').click()
    await expect(legend).toHaveJSProperty('open', true)
    await app.switchLanguage()
    await expect.poll(() => htmlLang(page)).toEqual({ lang: OTHER[lang], dir: DIR[OTHER[lang]] })
    await expect(page.getByTestId('level-legend')).toHaveJSProperty('open', true)
    await expect.poll(() => appParam(page)).toBe('profile')
  })

  test(`Back after a switch keeps the new language in the address: ${lang}`, async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    await app.goToView('plan')
    await app.tab('profile')
    await expect.poll(() => appParam(page)).toBe('profile')
    await app.switchLanguage()
    const other = OTHER[lang]
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/${other}/`)
    await page.goBack()
    await expect.poll(() => appParam(page)).toBe('plan')
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/${other}/`)
    await expect(app.heading('plan')).toBeVisible()
    expect(await htmlLang(page)).toEqual({ lang: other, dir: DIR[other] })
  })
}
