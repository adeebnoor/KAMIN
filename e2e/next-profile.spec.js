// Task 66 · Profile in the new interface (?ui=next). With the synthetic example: the college, major and transcript line;
// every capability a name and a level word (no number), and one tap opens its reasons sheet with the "because" line, the
// courses behind it, the "clue, not a guarantee" sentence and the level meanings; Edit on goals and interests opens
// step 4 and step 3 in edit mode and the feed changes at once, with no file chooser and no request leaving the page;
// "Update transcript" reads a new (made-up) transcript and comes back to Profile, where "What changed" shows once;
// credential import and practice tasks are one tap from Profile; Profile fits in two screens of a 390×844 phone; no
// sideways scroll at 360px; axe in both themes. Arabic and English, on the desktop and phone projects.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { NEXT_COPY, fillIn } from '../src/ui2/copy.js'
import { copy } from '../src/i18n.js'
import { levelLabel } from '../src/evidence/levels.js'
import { LEVEL_MEANINGS, limitLine, sharedLimitLine } from '../src/content/levelReasons.js'
import { COURSE_EVIDENCE_PRINCIPLE } from '../src/content/trustCopy.js'
import { collegeLabel } from '../src/catalog/colleges.js'
import { targetProfiles } from '../src/matching/targets.js'
import { profileSkills } from '../src/utils/engine.js'
import { demoCourses } from '../src/data.js'
import { LANGS, kamin } from './roles.js'

const PHONE = { width: 390, height: 844 }
const NARROW = { width: 360, height: 780 }
const PERCENT = /\d\s?[%٪]|[%٪]\s?\d/
const W = lang => NEXT_COPY[lang].profile
// The approved synthetic example, computed with the app's own engine.
const SAMPLE = profileSkills({ approved: true, courses: demoCourses.map(row => ({ ...row })), college: 'FCIT', projects: [], tasks: [], credentials: [], insight: {}, consents: { analyze: true } })
// The reason a capability's sheet gives: its own course's "because" line, else the shared one (Profile.jsx levelReason).
const reasonOf = (skill, lang) => (limitLine(skill, lang, { code: (skill.evidence.find(e => e.reasons === skill.reasons) || skill.evidence[0])?.code }) || sharedLimitLine(SAMPLE, lang)).text
const pathway = (id, lang) => targetProfiles.find(t => t.id === id).title[lang]
// A made-up transcript (no person, no real record), as a plain text file.
const TRANSCRIPT = { name: 'made-up-transcript.txt', mimeType: 'text/plain', buffer: Buffer.from('CPIT-240 Database Systems B+\nCPIT-250 Systems Analysis and Design A-\nSTAT-110 Statistics B\n', 'utf8') }
const SENTENCE = 'I want to analyse data and build dashboards'
const card = (app, id) => app.main().locator(`[data-testid="ui2-step-card"][data-item="${id}"]`)
const editButton = (app, lang, section) => app.main().getByRole('button', { name: fillIn(W(lang).editOf, { section: W(lang)[section] }), exact: true })
const backButton = (app, lang) => app.main().getByRole('button', { name: W(lang).backToProfile, exact: true })
const noPercent = async (page, what) => expect(await page.locator('body').innerText(), `${what}: no percentage`).not.toMatch(PERCENT)

async function onProfile(page, lang) {
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  await app.goToView('profile')
  return app
}

for (const lang of LANGS) test.describe(`Profile (${lang})`, () => {
  test('the header, and every capability a level word; one tap opens why, the courses, the clue sentence and the level meanings', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    await app.home()
    await app.openCapabilities()
    expect(app.clicks, 'Profile is one tap from Home').toBe(1)
    await expect(page.getByTestId('ui2-profile-head')).toContainText(collegeLabel('FCIT', lang))
    await expect(page.getByTestId('ui2-transcript-line')).toContainText(`${W(lang).courses(demoCourses.length).join('')} · `)
    await expect(app.main().getByRole('button', { name: W(lang).update, exact: true })).toBeVisible()
    const rows = app.capabilityRows()
    await expect(rows).toHaveCount(SAMPLE.length)
    await expect(app.main().getByTestId('capability-why-all')).toHaveText(sharedLimitLine(SAMPLE, lang).text)
    for (const [i, skill] of SAMPLE.entries()) {
      const row = rows.nth(i)
      await expect(row).toContainText(skill.labels[lang])
      await expect(row, 'a level word').toContainText(levelLabel(skill.evidenceLevel, lang))
      expect(await row.innerText(), 'never a number').not.toMatch(/\d/)
      await expect(row).toHaveAccessibleName(new RegExp(W(lang).source))
      // One tap: the reasons sheet.
      await row.click()
      const sheet = app.capabilitySheet()
      await expect(sheet).toBeVisible()
      await expect(sheet.getByRole('heading', { level: 2, name: skill.labels[lang], exact: true })).toBeVisible()
      await expect(sheet.getByTestId('capability-why')).toHaveText(reasonOf(skill, lang))
      for (const evidence of skill.evidence) await expect(sheet, 'the course behind it').toContainText(evidence.code)
      await expect(sheet.getByText(COURSE_EVIDENCE_PRINCIPLE[lang], { exact: true }).filter({ visible: true }).first(), 'the clue sentence').toBeVisible()
      await sheet.getByText(LEVEL_MEANINGS[lang].title, { exact: true }).click()
      for (const level of ['none', 'limited', 'moderate', 'strong', 'rule']) await expect(sheet.getByText(LEVEL_MEANINGS[lang][level], { exact: true })).toBeVisible()
      expect(await sheet.innerText(), 'no percentage in the sheet').not.toMatch(PERCENT)
      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)
      await expect(row, 'focus goes back to the row').toBeFocused()
    }
    await noPercent(page, 'Profile')
  })

  test('Edit goals and interests: steps 4 and 3 in edit mode, the feed changes at once; no file chooser, no request leaves the page', async ({ page, baseURL }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    // Set-up: the interests consent and one made-up sentence in the student's own words (step 3, by its address).
    await app.goToView('interests')
    await app.interestsConsent().click()
    await app.freeInterestBox().fill(SENTENCE)
    await app.main().getByRole('button', { name: NEXT_COPY[lang].interests.add, exact: true }).click()
    await expect(app.freeInterestCards()).toHaveCount(1)
    await app.goToView('profile')
    await expect(page.getByTestId('ui2-profile-interests')).toContainText(fillIn(W(lang).ownWords, { n: 1 }))
    await expect(page.getByTestId('ui2-profile-goals')).toContainText(W(lang).noGoals)

    const choosers = [], requests = []
    page.on('filechooser', chooser => choosers.push(chooser))
    page.on('request', request => requests.push(request))
    const origin = new URL(baseURL).origin

    // Goals: step 4 in edit mode. The feed already follows the sentence (Data Analyst); a goal adds its card at once.
    await editButton(app, lang, 'goals').click()
    await expect(app.heading('next')).toBeVisible()
    await expect(app.main().getByTestId('ui2-step'), 'no step chip in edit mode').toHaveCount(0)
    await expect(card(app, 'fcit-cpit-340')).toBeVisible()
    await expect(card(app, 'fcit-cpit-425')).toHaveCount(0)
    // With a pathway from the student's words at the top, the chips open with "Change goals" (GoalPicker.jsx).
    await app.goals().getByRole('button', { name: NEXT_COPY[lang].next.changeGoals, exact: true }).click()
    await app.goalChip('cyber').click()
    await expect(card(app, 'fcit-cpit-425'), 'the feed changes at once').toBeVisible()
    await backButton(app, lang).click()
    await expect(app.heading('profile')).toBeVisible()
    await expect(page.getByTestId('ui2-profile-goals')).toContainText(pathway('job-cyber-analyst', lang))

    // Interests: step 3 in edit mode; turn off the sentence's Data Analyst chip.
    await editButton(app, lang, 'interests').click()
    await expect(app.heading('interests')).toBeVisible()
    await expect(app.main().getByTestId('ui2-step')).toHaveCount(0)
    const chip = app.freeInterestChips(app.freeInterestCards().first()).filter({ hasText: pathway('job-data-analyst', lang) })
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
    await backButton(app, lang).click()
    await expect(app.heading('profile')).toBeVisible()
    // The feed of My plan's goals no longer carries the sentence's pathway; the chosen goal's card stays.
    await editButton(app, lang, 'goals').click()
    await expect(card(app, 'fcit-cpit-425')).toBeVisible()
    await expect(card(app, 'fcit-cpit-340'), 'the feed changed').toHaveCount(0)
    await backButton(app, lang).click()
    await expect(app.heading('profile')).toBeVisible()

    expect(choosers, 'no file chooser was opened').toEqual([])
    const away = requests.filter(request => new URL(request.url()).origin !== origin || request.method() !== 'GET').map(request => `${request.method()} ${request.url()}`)
    expect(away, 'nothing was sent anywhere').toEqual([])
  })

  test('Update transcript reads a new transcript and comes back to Profile; "What changed" shows once, at the top', async ({ page }) => {
    const app = await onProfile(page, lang)
    await app.main().getByRole('button', { name: W(lang).update, exact: true }).click()
    await expect(app.heading('upload')).toBeVisible()
    await expect(app.main().getByTestId('ui2-step'), 'no step chip in edit mode').toHaveCount(0)
    await app.chooseTranscript(TRANSCRIPT)
    await app.approve()
    await expect(app.heading('profile'), 'approving comes back to Profile').toBeVisible()
    // WhatChanged.jsx's title after a recompute.
    const summary = app.main().getByRole('region', { name: lang === 'ar' ? 'ما الذي تغيّر بعد التعديل؟' : 'What changed after your edit?' })
    await expect(summary).toBeVisible()
    // At the top: right under the page heading, above the header box.
    const [top, head] = await Promise.all([summary.boundingBox(), page.getByTestId('ui2-profile-head').boundingBox()])
    expect(top.y).toBeLessThan(head.y)
    await expect(page.getByTestId('ui2-transcript-line')).toContainText(W(lang).courses(3).join(''))
    // Once: leave Profile and come back, it is gone.
    await app.tab('home')
    await app.tab('profile')
    await expect(app.heading('profile')).toBeVisible()
    await expect(summary).toHaveCount(0)
  })

  test('"Got it" hides the summary for good', async ({ page }) => {
    const app = await onProfile(page, lang)
    await app.main().getByRole('button', { name: W(lang).update, exact: true }).click()
    await app.chooseTranscript(TRANSCRIPT)
    await app.approve()
    await expect(page.getByTestId('what-changed')).toBeVisible()
    await page.getByTestId('what-changed-got-it').click()
    await expect(page.getByTestId('what-changed')).toHaveCount(0)
  })

  test('credential import and practice tasks are one tap from Profile, and close again', async ({ page }) => {
    const app = await onProfile(page, lang)
    const credential = app.main().getByRole('button', { name: W(lang).credential, exact: true })
    await credential.click()
    await expect(credential).toHaveAttribute('aria-expanded', 'true')
    await expect(app.credentials()).toBeVisible()
    await expect(app.credentials().getByText(copy[lang].screens.myData.credential, { exact: true })).toBeVisible()
    const tasks = app.main().getByRole('button', { name: W(lang).tasks, exact: true })
    await tasks.click()
    await expect(app.tasks()).toBeVisible()
    await expect(app.credentials(), 'one panel at a time').toHaveCount(0)
    await tasks.click()
    await expect(app.tasks()).toHaveCount(0)
    // More ways to add interests asks for the interests consent first, word for word.
    await app.main().getByRole('button', { name: W(lang).moreInterests, exact: true }).click()
    await expect(app.main().getByRole('checkbox', { name: copy[lang].screens.insight.consent, exact: true })).not.toBeChecked()
    await expect(app.main().getByText(W(lang).needConsent, { exact: true })).toBeVisible()
  })

  test('two screens at most on a 390×844 phone with the example (details closed); no sideways scroll at 360px', async ({ page }) => {
    await page.setViewportSize(PHONE)
    const app = await onProfile(page, lang)
    await expect(app.capabilityRows()).toHaveCount(SAMPLE.length)
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    test.info().annotations.push({ type: 'Profile height at 390×844 (px)', description: String(height) })
    expect(height, 'Profile ≤ 2 screens').toBeLessThanOrEqual(2 * PHONE.height)
    await page.setViewportSize(NARROW)
    const wide = []
    const check = async label => { const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (overflow > 0) wide.push(`${label}: ${overflow}px`) }
    await check('profile')
    await app.capabilityRows().first().click()
    await app.capabilitySheet().getByText(LEVEL_MEANINGS[lang].title, { exact: true }).click()
    await check('reasons sheet')
    await page.keyboard.press('Escape')
    for (const label of [W(lang).credential, W(lang).tasks, W(lang).moreInterests]) {
      await app.main().getByRole('button', { name: label, exact: true }).click()
      await expect(app.main().getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-expanded', 'true')
      await check(label)
    }
    expect(wide).toEqual([])
  })

  for (const theme of ['light', 'dark']) test(`axe (${theme}): 0 violations on Profile, the reasons sheet and More's panels`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ colorScheme: theme })
    const app = await onProfile(page, lang)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toContain(theme)
    const found = {}
    const check = async label => {
      await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity))
      const report = await new AxeBuilder({ page }).analyze()
      if (report.violations.length) found[label] = report.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)
    }
    await expect(app.capabilityRows()).toHaveCount(SAMPLE.length)
    await app.main().getByText(LEVEL_MEANINGS[lang].title, { exact: true }).click()
    await check('profile with the level meanings open')
    await app.capabilityRows().first().click()
    await expect(app.capabilitySheet()).toBeVisible()
    await check('reasons sheet')
    await page.keyboard.press('Escape')
    await app.main().getByRole('button', { name: W(lang).credential, exact: true }).click()
    await expect(app.credentials()).toBeVisible()
    await check('credential import')
    await app.main().getByRole('button', { name: W(lang).tasks, exact: true }).click()
    await expect(app.tasks()).toBeVisible()
    await check('practice tasks')
    await app.main().getByRole('button', { name: W(lang).moreInterests, exact: true }).click()
    await app.main().getByRole('checkbox', { name: copy[lang].screens.insight.consent, exact: true }).click()
    await expect(app.main().getByRole('region', { name: lang === 'ar' ? 'اهتمامات من نشاطك الرقمي' : 'Interests from your digital activity' })).toBeVisible()
    await check('more ways to add interests')
    expect(found).toEqual({})
  })
})
