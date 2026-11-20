// Task 63 · step 2 of the new interface (?ui=next): your projects, and nothing else. Add a project with a made-up
// description, the local engine's skills appear as chips, tap one off, save; every capability and its level stays
// exactly as before (compared on the rows the student reads). Also: Skip for now and Next open step 3, delete with
// Undo, edit in place, "Why?" with the method and the sentence each skill comes from, a description with no cue,
// one main action at a time, ≤ 1.5 screens on a 390×844 phone with two projects, no sideways scroll at 360px, no
// percentage, and axe in both themes. Arabic and English, on the desktop and phone projects.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PROJECT_COPY } from '../src/content/projectCopy.js'
import { NEXT_COPY, fillIn } from '../src/ui2/copy.js'
import { skills as catalog } from '../src/data.js'
import { STORAGE_KEY } from '../src/state/profileState.js'
import { LANGS, kamin } from './roles.js'
// Task 44: the trial's counts, checked in the downloaded study file.
import { readFileSync } from 'node:fs'
import { validate } from '../tests/helpers/miniJsonSchema.js'
import { PILOT_COPY } from '../src/content/pilotConsent.js'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1366, height: 768 }
const NARROW = { width: 360, height: 780 }
const PERCENT = /\d\s?[%٪]|[%٪]\s?\d/
const W = lang => NEXT_COPY[lang].projects
const P = lang => PROJECT_COPY[lang]
const skill = (id, lang) => Object.values(catalog).find(s => s.id === id).labels[lang]
const tr = (lang, ar, en) => (lang === 'ar' ? ar : en)
// Made-up projects (no person, no real work). The first description gives two skills (web development, databases).
const STUDY_ROOMS = lang => ({
  title: tr(lang, 'تطبيق لحجز قاعات المذاكرة (مثال مختلق)', 'Study room booking app (made up)'),
  description: tr(lang, 'بنيت تطبيق ويب بواجهة أمامية لحجز قاعات المذاكرة مع قاعدة بيانات.', 'A web app to book study rooms with a database.'),
})
const SURVEY = lang => ({
  title: tr(lang, 'لوحة نتائج استبيان المقررات (مثال مختلق)', 'Course survey dashboard (made up)'),
  description: tr(lang, 'حللت بيانات استبيان بالإحصاء الوصفي ورسمت النتائج.', 'I analysed survey data with descriptive statistics and charted the results.'),
})
// Words with no skill cue at all: the engine says so and suggests nothing.
const NO_CUE = lang => tr(lang, 'رتبت رحلة قصيرة مع زملائي في نهاية الفصل.', 'I organised a short trip with my classmates at the end of term.')

const primaries = app => app.main().locator('.ui2-btn-primary').filter({ visible: true })

// The approved synthetic example, on step 2 (approving step 1 opens it).
async function onStep2(page, lang) {
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  await expect(app.heading('projects')).toBeVisible()
  return app
}
async function startProject(app, lang, { title, description }) {
  const w = W(lang)
  await app.main().getByRole('button', { name: (await app.projectCards().count()) ? w.addAnother : w.add, exact: true }).click()
  await expect(app.projectForm()).toBeVisible()
  await expect(app.projectForm().getByLabel(w.title, { exact: true }), 'the title field takes focus').toBeFocused()
  await app.projectForm().getByLabel(w.title, { exact: true }).fill(title)
  await app.projectForm().getByLabel(w.description, { exact: true }).fill(description)
  await app.projectForm().getByRole('button', { name: w.suggest, exact: true }).click()
}
async function addProject(app, lang, project) {
  await startProject(app, lang, project)
  await expect(app.projectChips().first()).toBeVisible()
  await app.projectForm().getByRole('button', { name: W(lang).save, exact: true }).click()
  await expect(app.projectForm()).toHaveCount(0)
}

for (const lang of LANGS) test.describe(`Step 2: projects (${lang})`, () => {
  test('add a made-up project: chips appear, tap one off, save; every capability and level stays the same; Next opens step 3', async ({ page }) => {
    const w = W(lang)
    const app = await onStep2(page, lang)
    // The step indicator, the one sentence, the self-declared rule word for word; "Add project" is the one main action.
    await expect(app.main().getByRole('button', { name: fillIn(NEXT_COPY[lang].steps.step, { n: 2, of: 4 }), exact: true })).toBeVisible()
    await expect(app.main().getByText(w.line, { exact: true })).toBeVisible()
    await expect(app.main().getByText(P(lang).rule, { exact: true })).toBeVisible()
    await expect(primaries(app)).toHaveCount(1)
    await expect(primaries(app)).toHaveText(w.add)
    await expect(app.main().getByRole('button', { name: w.skip, exact: true })).toBeVisible()
    await expect(app.main().getByRole('button', { name: w.next, exact: true })).toHaveCount(0)
    const before = await app.capabilityLevels()
    expect(before.length).toBeGreaterThan(0)

    await startProject(app, lang, STUDY_ROOMS(lang))
    // While the form is open, Save is the one main action (Next and Add wait until it is closed).
    await expect(primaries(app)).toHaveCount(1)
    await expect(primaries(app)).toHaveText(w.save)
    const chips = app.projectChips()
    // The engine's order (strongest first) can differ between the languages; the two skills are the same.
    await expect(chips).toHaveCount(2)
    expect((await chips.allInnerTexts()).sort()).toEqual([skill('web-development', lang), skill('database', lang)].sort())
    for (const chip of await chips.all()) await expect(chip).toHaveAttribute('aria-pressed', 'true')
    // Tap one off: it stays visible (so it can be tapped back on) and is not saved.
    const web = chips.filter({ hasText: skill('web-development', lang) })
    await web.click()
    await expect(web).toHaveAttribute('aria-pressed', 'false')
    await app.projectForm().getByRole('button', { name: w.save, exact: true }).click()
    await expect(app.projectForm()).toHaveCount(0)

    // The saved message is the old panel's, word for word, in the one message; the card says "self-declared".
    await expect(page.getByTestId('notice')).toHaveText(P(lang).saved)
    const card = app.projectCards()
    await expect(card).toHaveCount(1)
    await expect(card).toContainText(STUDY_ROOMS(lang).title)
    await expect(card).toContainText(P(lang).badge)
    await expect(card).toContainText(skill('database', lang))
    await expect(card).not.toContainText(skill('web-development', lang))
    // Focus goes to the one main action, which is now Next.
    await expect(primaries(app)).toHaveCount(1)
    await expect(app.main().getByRole('button', { name: w.next, exact: true })).toBeFocused()
    expect(await app.main().innerText(), 'no percentage').not.toMatch(PERCENT)

    // The record in this tab's session: self-declared, unreviewed, only the skill left on.
    const stored = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), STORAGE_KEY)
    expect(stored.projects).toEqual([expect.objectContaining({ title: STUDY_ROOMS(lang).title, skillIds: ['database'], level: 'declared-applied', reviewStatus: 'unreviewed' })])

    expect(await app.capabilityLevels(), 'a self-declared project changes no capability or level').toEqual(before)
    await expect(app.projectCards()).toHaveCount(1)
    await app.main().getByRole('button', { name: w.next, exact: true }).click()
    await expect(app.heading('interests')).toBeFocused()
    await expect(page).toHaveURL(/[?&]app=interests(&|$)/)
  })

  test('"Skip for now" opens step 3 and saves nothing', async ({ page }) => {
    const app = await onStep2(page, lang)
    await app.main().getByRole('button', { name: W(lang).skip, exact: true }).click()
    await expect(app.heading('interests')).toBeFocused()
    await expect(page).toHaveURL(/[?&]app=interests(&|$)/)
    expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).projects, STORAGE_KEY)).toEqual([])
  })

  test('delete with Undo, delete for good (stays deleted after a refresh), and edit in place', async ({ page }) => {
    const w = W(lang)
    const app = await onStep2(page, lang)
    await addProject(app, lang, STUDY_ROOMS(lang))
    await addProject(app, lang, SURVEY(lang))
    const titles = () => app.projectCards().getByRole('heading', { level: 2 }).allInnerTexts()
    expect(await titles()).toEqual([SURVEY(lang).title, STUDY_ROOMS(lang).title])

    // Delete the second card, then Undo: it comes back in its place.
    await app.main().getByRole('button', { name: `${w.remove}: ${STUDY_ROOMS(lang).title}`, exact: true }).click()
    await expect(app.projectCards()).toHaveCount(1)
    const notice = page.getByTestId('notice')
    await expect(notice).toContainText(w.deleted)
    await notice.getByRole('button', { name: w.undo, exact: true }).click()
    await expect(app.projectCards()).toHaveCount(2)
    expect(await titles()).toEqual([SURVEY(lang).title, STUDY_ROOMS(lang).title])

    // Edit the first one: the title changes where it is, the self-declared badge stays.
    const edited = tr(lang, 'لوحة الاستبيان، النسخة الثانية (مثال مختلق)', 'Course survey dashboard, second version (made up)')
    await app.main().getByRole('button', { name: `${w.edit}: ${SURVEY(lang).title}`, exact: true }).click()
    await expect(app.projectForm().getByRole('heading', { name: w.editTitle, exact: true })).toBeVisible()
    await expect(app.projectForm().getByLabel(w.title, { exact: true })).toHaveValue(SURVEY(lang).title)
    await app.projectForm().getByLabel(w.title, { exact: true }).fill(edited)
    await app.projectForm().getByRole('button', { name: w.save, exact: true }).click()
    await expect(app.projectForm()).toHaveCount(0)
    expect(await titles()).toEqual([edited, STUDY_ROOMS(lang).title])
    await expect(app.projectCards().first()).toContainText(P(lang).badge)

    // Delete for good: after a refresh it is still gone.
    await app.main().getByRole('button', { name: `${w.remove}: ${edited}`, exact: true }).click()
    await expect(app.projectCards()).toHaveCount(1)
    await page.reload()
    await expect(app.heading('projects')).toBeVisible()
    expect(await titles()).toEqual([STUDY_ROOMS(lang).title])
  })

  test('"Why?" explains how skills are suggested; a description with no cue says so and lets the student choose', async ({ page }) => {
    const w = W(lang)
    const app = await onStep2(page, lang)
    await startProject(app, lang, STUDY_ROOMS(lang))
    await expect(app.projectChips().first()).toBeVisible()
    await app.main().getByRole('button', { name: w.why, exact: true }).click()
    const sheet = app.sheet(w.whyTitle)
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText(P(lang).suggestNote, { exact: true })).toBeVisible()
    await expect(sheet.getByText(STUDY_ROOMS(lang).description, { exact: true }).first(), 'each skill names the sentence it comes from').toBeVisible()
    // The engine's id is a technical detail: hidden until "Technical details" is opened.
    await expect(sheet.getByText(/kamin-project-suggest-improved-v1/)).toBeHidden()
    await sheet.getByText(w.technical, { exact: true }).click()
    await expect(sheet.getByText(/kamin-project-suggest-improved-v1/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    // The form kept what was typed.
    await expect(app.projectForm().getByLabel(w.title, { exact: true })).toHaveValue(STUDY_ROOMS(lang).title)
    await app.projectForm().getByRole('button', { name: w.cancel, exact: true }).click()
    await expect(app.projectForm()).toHaveCount(0)
    await expect(app.projectCards()).toHaveCount(0)

    // No cue: the old panel's "Unresolved" sentence, no chip, Save waits and says why; then choose a skill yourself.
    await startProject(app, lang, { title: tr(lang, 'رحلة الفصل (مثال مختلق)', 'End-of-term trip (made up)'), description: NO_CUE(lang) })
    await expect(app.projectForm().getByText(P(lang).abstain, { exact: true })).toBeVisible()
    await expect(app.projectForm().getByRole('group')).toHaveCount(0)
    await expect(app.projectForm().getByRole('button', { name: w.save, exact: true })).toBeDisabled()
    await expect(page.getByTestId('project-save-reason')).toHaveText(w.needSkill)
    await app.projectForm().getByRole('button', { name: w.chooseSelf, exact: true }).click()
    const all = app.projectForm().getByRole('group', { name: w.allSkills, exact: true }).getByRole('button')
    await expect(all).toHaveCount(Object.keys(catalog).length)
    await all.filter({ hasText: skill('project', lang) }).click()
    await app.projectForm().getByRole('button', { name: w.save, exact: true }).click()
    await expect(app.projectCards()).toHaveCount(1)
    await expect(app.projectCards()).toContainText(skill('project', lang))
  })

  test('a link must be https; the form says so and saves nothing', async ({ page }) => {
    const w = W(lang)
    const app = await onStep2(page, lang)
    await startProject(app, lang, STUDY_ROOMS(lang))
    await expect(app.projectChips().first()).toBeVisible()
    await app.projectForm().getByLabel(w.link, { exact: true }).fill('http://example.org/made-up')
    await app.projectForm().getByRole('button', { name: w.save, exact: true }).click()
    await expect(app.projectForm().getByRole('alert')).toHaveText(P(lang).urlError)
    await app.projectForm().getByLabel(w.link, { exact: true }).fill('https://example.org/made-up')
    await app.projectForm().getByRole('button', { name: w.save, exact: true }).click()
    await expect(app.projectCards().getByRole('link', { name: P(lang).openLink })).toHaveAttribute('href', 'https://example.org/made-up')
  })

  test('two projects fit in 1.5 screens on a 390×844 phone; no sideways scroll at 360px with the form, the cards and the sheet', async ({ page }) => {
    await page.setViewportSize(PHONE)
    const app = await onStep2(page, lang)
    await addProject(app, lang, STUDY_ROOMS(lang))
    await addProject(app, lang, SURVEY(lang))
    await page.getByTestId('notice').getByRole('button').last().click()
    await expect(page.getByTestId('notice')).toHaveCount(0)
    const length = await page.evaluate(() => document.scrollingElement.scrollHeight / innerHeight)
    expect(length, 'page length in screens with two projects').toBeLessThanOrEqual(1.5)

    await page.setViewportSize(NARROW)
    const wide = []
    const measure = async where => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (overflow > 0) wide.push(`${where}: the page is ${overflow}px too wide`)
    }
    await measure('two cards')
    await app.main().getByRole('button', { name: W(lang).addAnother, exact: true }).click()
    await app.projectForm().getByLabel(W(lang).description, { exact: true }).fill(STUDY_ROOMS(lang).description)
    await app.projectForm().getByRole('button', { name: W(lang).suggest, exact: true }).click()
    await app.projectForm().getByRole('button', { name: W(lang).chooseSelf, exact: true }).click()
    await measure('the form with every skill')
    await app.main().getByRole('button', { name: W(lang).why, exact: true }).click()
    await measure('the Why? sheet')
    expect(wide).toEqual([])
  })

  for (const theme of ['light', 'dark']) test(`axe: 0 violations on every state of step 2 (${theme} theme)`, async ({ page }, info) => {
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
    const app = await onStep2(page, lang)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toContain(theme)
    await check('step 2, no project')
    await startProject(app, lang, STUDY_ROOMS(lang))
    await expect(app.projectChips().first()).toBeVisible()
    await check('the form with its chips')
    await app.projectChips().first().click()
    await app.projectForm().getByLabel(W(lang).title, { exact: true }).fill('')
    await check('the form with a reason under Save')
    await app.main().getByRole('button', { name: W(lang).why, exact: true }).click()
    await expect(app.sheet(W(lang).whyTitle)).toBeVisible()
    await check('the Why? sheet')
    await page.keyboard.press('Escape')
    await app.projectForm().getByRole('button', { name: W(lang).cancel, exact: true }).click()
    await addProject(app, lang, STUDY_ROOMS(lang))
    await addProject(app, lang, SURVEY(lang))
    await check('two cards and the saved message')
    await app.main().getByRole('button', { name: `${W(lang).remove}: ${SURVEY(lang).title}`, exact: true }).click()
    await expect(page.getByTestId('notice')).toContainText(W(lang).deleted)
    await check('the deleted message with Undo')
    expect(found).toEqual({})
  })
})

// Task 44 ("How to verify by hand"): join the trial, add a project, Suggest, untick one, save, export. The file has the
// counts and the method's version only: never the title, the description or a skill.
test('Task 44: in the trial, a saved project gives counts only in the anonymous study file (en)', async ({ page }) => {
  test.setTimeout(120_000)
  const lang = 'en', w = W(lang)
  const app = kamin(page, { ui: 'new', lang })
  await app.openPilot()
  await app.joinPilot()
  await expect(app.pilotBar()).toBeVisible()
  await app.sample()
  await startProject(app, lang, STUDY_ROOMS(lang))
  await expect(app.projectChips()).toHaveCount(2)
  await app.projectChips().filter({ hasText: skill('web-development', lang) }).click()
  await app.projectForm().getByRole('button', { name: w.save, exact: true }).click()
  await expect(app.projectForm()).toHaveCount(0)

  await app.pilotBar().getByRole('button', { name: PILOT_COPY[lang].finish }).click()
  const form = page.getByRole('dialog', { name: 'End of the session' })
  await form.getByRole('button', { name: 'Save the answers' }).click()
  await expect(form.getByTestId('pilot-file-preview')).toContainText('"suggestions"')
  const downloading = page.waitForEvent('download')
  await form.getByRole('button', { name: 'Download my anonymous study file' }).click()
  const file = JSON.parse(readFileSync(await (await downloading).path(), 'utf8'))
  expect(validate(file, JSON.parse(readFileSync('src/pilot/study-file.schema.json', 'utf8')))).toEqual([])
  expect(file.consentVersion).toBe('pilot-consent-v2-2026-11-19')
  expect(file.suggestions).toMatchObject({ shown: 2, kept: 1, unticked: 1, addedByHand: 0, saved: 1, keptOfShown: 0.5, untickedOfShown: 0.5, addedByHandOfSaved: 0 })
  const counts = file.events.filter(e => e.count !== undefined)
  expect(counts.map(e => [e.event, e.count]).sort()).toEqual([['suggest_kept', 1], ['suggest_shown', 2], ['suggest_unticked', 1]])
  for (const e of counts) expect(Object.keys(e).sort()).toEqual(['at', 'count', 'engine', 'event'])
  const text = JSON.stringify(file)
  for (const word of [STUDY_ROOMS(lang).title, STUDY_ROOMS(lang).description, 'study rooms', skill('web-development', lang), skill('database', lang), 'web-development', 'database'])
    expect(text, word).not.toContain(word)
})
