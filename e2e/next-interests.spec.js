// Task 64 · step 3 of the new interface (?ui=next): interests as quick chips plus the student's own words.
// The consent is the approved sentence (src/i18n.js) and nothing is saved before it; two chips and one made-up
// sentence take at most 5 taps after consent; the sentence's chips appear (Arabic and English sentences), one is
// removed and the sentence is kept; edit, delete with Undo; every capability and its level stays exactly as before;
// the chips appear in under 1 s on a mid-range phone profile (CPU ×4) once the engine has loaded, with a skeleton
// while it loads; Next and "Skip for now" open step 4; no sideways scroll at 360px; axe in both themes.
// Arabic and English, on the desktop and phone projects.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { NEXT_COPY, fillIn } from '../src/ui2/copy.js'
import { copy } from '../src/i18n.js'
import { STORAGE_KEY } from '../src/state/profileState.js'
import { LANGS, kamin } from './roles.js'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1366, height: 768 }
const NARROW = { width: 360, height: 780 }
const PERCENT = /\d\s?[%٪]|[%٪]\s?\d/
const W = lang => NEXT_COPY[lang].interests
// Made-up interests (no person). Each language's test adds one sentence in Arabic and one in English.
const ARABIC = 'أحب تصميم تطبيقات تساعد المرضى'
const ENGLISH = 'I want to analyse data and build dashboards'
const EDITED = 'I like designing websites for small shops'
const stored = page => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), STORAGE_KEY)
const primaries = app => app.main().locator('.ui2-btn-primary').filter({ visible: true })

// The approved synthetic example, on step 3 (by its address, as the step chip or a link would open it).
async function onStep3(page, lang) {
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  await app.goToView('interests')
  return app
}
async function addSentence(app, lang, text) {
  const before = await app.freeInterestCards().count()
  await app.freeInterestBox().fill(text)
  await app.main().getByRole('button', { name: W(lang).add, exact: true }).click()
  await expect(app.freeInterestCards()).toHaveCount(before + 1)
  await expect(app.freeInterestBox()).toHaveValue('')
  return app.freeInterestCards().nth(before)
}

for (const lang of LANGS) test.describe(`Step 3: interests (${lang})`, () => {
  test('consent first; two chips and a sentence in ≤ 5 taps; Arabic and English sentences give chips; remove one; levels unchanged; Next opens step 4', async ({ page }) => {
    const w = W(lang)
    const app = await onStep3(page, lang)
    await expect(app.main().getByRole('button', { name: fillIn(NEXT_COPY[lang].steps.step, { n: 3, of: 4 }), exact: true })).toBeVisible()
    const before = await app.capabilityLevels()
    expect(before.length).toBeGreaterThan(0)

    // The consent, word for word, not ticked; every chip and the text box wait for it and say why.
    await expect(app.interestsConsent()).toBeVisible()
    await expect(app.interestsConsent()).not.toBeChecked()
    await expect(page.getByTestId('ui2-interests-consent')).toHaveText(copy[lang].screens.insight.consent)
    await expect(app.main().getByText(w.needConsent, { exact: true })).toBeVisible()
    await expect(app.interestChip('careerInterest', 'investigative')).toBeDisabled()
    await expect(app.interestChip('workValue', 'achievement')).toBeDisabled()
    await expect(app.freeInterestBox()).toBeDisabled()
    await expect(app.main().getByRole('button', { name: w.skip, exact: true })).toBeVisible()
    expect((await stored(page)).consents.insight, 'nothing saved before consent').toBeFalsy()

    // Tick: the consent is given once (the checkbox is replaced by a line) and focus moves to the first chip.
    await app.interestsConsent().click()
    await expect(app.interestsConsent()).toHaveCount(0)
    await expect(page.getByTestId('ui2-interests-consent-given')).toHaveText(w.consentGiven)
    await expect(app.interestChip('careerInterest', 'realistic')).toBeFocused()
    expect((await stored(page)).consents.insight).toBe(true)

    // After consent: two chips and one sentence, counting every tap.
    let taps = 0
    const tap = async locator => { taps += 1; await locator.click() }
    await tap(app.interestChip('careerInterest', 'investigative'))
    await tap(app.interestChip('workValue', 'achievement'))
    await tap(app.freeInterestBox())
    await app.freeInterestBox().fill(lang === 'ar' ? ARABIC : ENGLISH)
    await tap(app.main().getByRole('button', { name: w.add, exact: true }))
    const first = app.freeInterestCards().first()
    await expect(app.freeInterestChips(first).first()).toBeVisible()
    expect(taps, 'two chips and one sentence after consent').toBeLessThanOrEqual(5)
    await expect(app.interestChip('careerInterest', 'investigative')).toHaveAttribute('aria-pressed', 'true')
    await expect(app.interestChip('workValue', 'achievement')).toHaveAttribute('aria-pressed', 'true')
    // A tap on another option of the same question moves the choice; a second tap on it removes it.
    await app.interestChip('careerInterest', 'artistic').click()
    await expect(app.interestChip('careerInterest', 'artistic')).toHaveAttribute('aria-pressed', 'true')
    await expect(app.interestChip('careerInterest', 'investigative')).toHaveAttribute('aria-pressed', 'false')
    await app.interestChip('careerInterest', 'artistic').click()
    await expect(app.interestChip('careerInterest', 'artistic')).toHaveAttribute('aria-pressed', 'false')
    await app.interestChip('careerInterest', 'investigative').click()

    // The other language's sentence gives chips too.
    const second = await addSentence(app, lang, lang === 'ar' ? ENGLISH : ARABIC)
    await expect(app.freeInterestChips(second).first()).toBeVisible()
    for (const card of [first, second]) for (const chip of await app.freeInterestChips(card).all()) await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await expect(first.getByTestId('ui2-free-interest-text')).toHaveText(lang === 'ar' ? ARABIC : ENGLISH)
    await expect(second.getByTestId('ui2-free-interest-text')).toHaveText(lang === 'ar' ? ENGLISH : ARABIC)
    await expect(first.getByRole('group').first()).toBeVisible()
    await expect(app.main().getByText(w.words, { exact: true })).toBeVisible()

    // Remove one chip: it stays listed, turned off; the sentence is kept exactly as written.
    const removed = app.freeInterestChips(first).first()
    const removedName = await removed.innerText()
    await removed.click()
    await expect(removed).toHaveAttribute('aria-pressed', 'false')
    await expect(removed).toHaveText(removedName)
    await expect(first.getByTestId('ui2-free-interest-text')).toHaveText(lang === 'ar' ? ARABIC : ENGLISH)
    const saved = await stored(page)
    expect(saved.insight.declaredPreferences).toEqual({ careerInterest: 'investigative', workValue: 'achievement' })
    expect(saved.insight.freeInterests.map(e => e.text)).toEqual(lang === 'ar' ? [ARABIC, ENGLISH] : [ENGLISH, ARABIC])
    expect(saved.insight.freeInterests[0].understood.filter(c => c.removed)).toHaveLength(1)
    expect(await app.main().innerText(), 'no percentage').not.toMatch(PERCENT)

    // No interest changes any capability or its level (the rows the student reads).
    expect(await app.capabilityLevels(), 'interests change no capability or level').toEqual(before)
    await expect(app.freeInterestCards()).toHaveCount(2)
    await expect(primaries(app)).toHaveCount(1)
    await app.main().getByRole('button', { name: w.next, exact: true }).click()
    await expect(app.heading('next')).toBeFocused()
    await expect(page).toHaveURL(/[?&]app=next(&|$)/)
  })

  test('"Skip for now" opens step 4 and saves nothing', async ({ page }) => {
    const app = await onStep3(page, lang)
    await app.main().getByRole('button', { name: W(lang).skip, exact: true }).click()
    await expect(app.heading('next')).toBeFocused()
    await expect(page).toHaveURL(/[?&]app=next(&|$)/)
    const saved = await stored(page)
    expect(saved.consents.insight).toBeFalsy()
    expect(saved.insight.freeInterests || []).toEqual([])
  })

  test('edit a sentence in place; delete with Undo; delete for good (still gone after a refresh)', async ({ page }) => {
    const w = W(lang)
    const app = await onStep3(page, lang)
    await app.interestsConsent().click()
    await addSentence(app, lang, ARABIC)
    await addSentence(app, lang, ENGLISH)
    const texts = () => app.freeInterestCards().getByTestId('ui2-free-interest-text').allInnerTexts()
    expect(await texts()).toEqual([ARABIC, ENGLISH])

    // Edit the second one: the new sentence is read again, in the same place.
    await app.freeInterestCards().nth(1).getByRole('button', { name: new RegExp(`^${w.edit}: `) }).click()
    const box = app.freeInterestCards().nth(1).getByRole('textbox', { name: w.sentence, exact: true })
    await expect(box).toBeFocused()
    await expect(box).toHaveValue(ENGLISH)
    await box.fill(EDITED)
    await app.freeInterestCards().nth(1).getByRole('button', { name: w.save, exact: true }).click()
    expect(await texts()).toEqual([ARABIC, EDITED])
    await expect(app.freeInterestChips(app.freeInterestCards().nth(1)).first()).toBeVisible()

    // Delete the first, then Undo: it comes back in its place.
    await app.freeInterestCards().first().getByRole('button', { name: new RegExp(`^${w.remove}: `) }).click()
    await expect(app.freeInterestCards()).toHaveCount(1)
    const notice = page.getByTestId('notice')
    await expect(notice).toContainText(w.deleted)
    await notice.getByRole('button', { name: w.undo, exact: true }).click()
    await expect(app.freeInterestCards()).toHaveCount(2)
    expect(await texts()).toEqual([ARABIC, EDITED])

    // Delete for good: after a refresh it is still gone.
    await app.freeInterestCards().first().getByRole('button', { name: new RegExp(`^${w.remove}: `) }).click()
    await expect(app.freeInterestCards()).toHaveCount(1)
    await page.reload()
    await expect(app.heading('interests')).toBeVisible()
    expect(await texts()).toEqual([EDITED])
  })

  test('a skeleton shows while the engine loads; after that the chips appear in under 1 s with the CPU slowed ×4', async ({ page }) => {
    const app = await onStep3(page, lang)
    await app.interestsConsent().click()
    // Hold the engine's files back a little, as a slow network would. The page itself notes when the skeleton is on
    // screen (polling from the test could miss it if the files still arrive quickly).
    const engineFiles = /\/assets\/(freeText|vocabulary|projectSuggestImproved|digitalInterests)[\w-]*\.js$/
    await page.route(engineFiles, async route => { await new Promise(done => setTimeout(done, 800)); await route.continue() })
    await page.evaluate(() => {
      window.__skeletonSeen = false
      const main = document.querySelector('main')
      new MutationObserver(() => { if (main.querySelector('[data-testid="ui2-skeleton"]')) window.__skeletonSeen = true }).observe(main, { childList: true, subtree: true })
    })
    await app.freeInterestBox().fill(ARABIC)
    await app.main().getByRole('button', { name: W(lang).add, exact: true }).click()
    await expect(app.freeInterestCards()).toHaveCount(1)
    expect(await page.evaluate(() => window.__skeletonSeen), 'a skeleton showed while the engine loaded').toBe(true)
    await expect(app.main().getByTestId('ui2-skeleton')).toHaveCount(0)
    await page.unroute(engineFiles)

    // A mid-range phone: the CPU four times slower. Time from the tap on Add to the card with its chips on screen.
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.evaluate(() => {
      window.__interestTiming = {}
      document.addEventListener('click', event => { if (event.target.closest('button[type="submit"]')) window.__interestTiming.tap = performance.now() }, true)
      new MutationObserver(() => {
        const cards = document.querySelectorAll('[data-testid="ui2-free-interest"]')
        if (cards.length >= 2 && cards[1].querySelector('[role="group"] button') && !window.__interestTiming.shown) window.__interestTiming.shown = performance.now()
      }).observe(document.body, { childList: true, subtree: true })
    })
    await app.freeInterestBox().fill(ENGLISH)
    await app.main().getByRole('button', { name: W(lang).add, exact: true }).click()
    await expect(app.freeInterestChips(app.freeInterestCards().nth(1)).first()).toBeVisible()
    const { tap, shown } = await page.evaluate(() => window.__interestTiming)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    test.info().annotations.push({ type: 'ms from Add to the chips, CPU ×4', description: String(Math.round(shown - tap)) })
    expect(shown - tap, 'ms from Add to the chips, CPU ×4').toBeLessThan(1000)
  })

  test('no sideways scroll at 360px with the chips, two cards and an edit open', async ({ page }) => {
    await page.setViewportSize(NARROW)
    const app = await onStep3(page, lang)
    const wide = []
    const measure = async where => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (overflow > 0) wide.push(`${where}: the page is ${overflow}px too wide`)
    }
    await measure('before consent')
    await app.interestsConsent().click()
    await app.interestChip('careerInterest', 'investigative').click()
    await addSentence(app, lang, ARABIC)
    await addSentence(app, lang, ENGLISH)
    await measure('two cards')
    await app.freeInterestCards().first().getByRole('button', { name: new RegExp(`^${W(lang).edit}: `) }).click()
    await measure('a card being edited')
    expect(wide).toEqual([])
  })

  for (const theme of ['light', 'dark']) test(`axe: 0 violations on every state of step 3 (${theme} theme)`, async ({ page }, info) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ colorScheme: theme })
    await page.setViewportSize(info.project.name === 'mobile-chromium' ? PHONE : DESKTOP)
    const found = {}
    const check = async where => {
      // The message fades in (0.2 s, Task 25); axe reads colours once it has finished, as a student sees them.
      await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity))
      const report = await new AxeBuilder({ page }).analyze()
      if (report.violations.length) found[where] = report.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)
    }
    const app = await onStep3(page, lang)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toContain(theme)
    await check('before consent, chips disabled')
    await app.interestsConsent().click()
    await app.interestChip('careerInterest', 'investigative').click()
    await app.interestChip('workValue', 'achievement').click()
    await check('two chips chosen')
    const card = await addSentence(app, lang, ARABIC)
    await app.freeInterestChips(card).first().click()
    await check('a card with one chip removed')
    await card.getByRole('button', { name: new RegExp(`^${W(lang).edit}: `) }).click()
    await check('a card being edited')
    await card.getByRole('button', { name: W(lang).cancel, exact: true }).click()
    await card.getByRole('button', { name: new RegExp(`^${W(lang).remove}: `) }).click()
    await expect(page.getByTestId('notice')).toContainText(W(lang).deleted)
    await check('the deleted message with Undo')
    expect(found).toEqual({})
  })
})
