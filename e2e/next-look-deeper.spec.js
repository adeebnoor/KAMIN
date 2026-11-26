// Task 43 · "Look deeper" on step 2 (hybrid method, not the default; Task 80 made it the default, Task 80b put it back
// behind the reviewer switch, team decision 2026-11-22). Without ?suggest=hybrid nothing changes and no
// model file is requested. With it, the button appears only after the improved engine abstained, stays disabled
// until the consent box is ticked, and no model file is requested until it is pressed. Pressed, the local MiniLM
// model loads from this site, and at most one skill is added, its chip labelled "found by meaning, please check";
// the description never appears in any request and every request stays on this site. Arabic and English.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PROJECT_COPY } from '../src/content/projectCopy.js'
import { NEXT_COPY } from '../src/ui2/copy.js'
import { skills as catalog } from '../src/data.js'
import { LANGS, kamin } from './roles.js'

const W = lang => NEXT_COPY[lang].projects
const D = lang => NEXT_COPY[lang].projects.deeper
const skill = (id, lang) => Object.values(catalog).find(s => s.id === id).labels[lang]
const tr = (lang, ar, en) => (lang === 'ar' ? ar : en)
const MODEL = /\/(models|ai-runtime)\//
// Made-up projects. No word of the improved engine's list in either: it abstains on both.
// The English one is close in meaning to "cyber security" (the fallback finds it); the Arabic one is not close enough.
const PROTECTED = 'Protected the accounts from attackers.'
const PROTECTED_AR = 'حميت الحسابات من المهاجمين.'
const NO_CUE = lang => tr(lang, 'رتبت رحلة قصيرة مع زملائي في نهاية الفصل.', 'I organised a short trip with my classmates at the end of term.')
const CUE = lang => tr(lang, 'بنيت تطبيق ويب بواجهة أمامية لحجز قاعات المذاكرة مع قاعدة بيانات.', 'A web app to book study rooms with a database.')

function watch(page) {
  const requests = []
  page.context().on('request', request => requests.push({ url: request.url(), body: request.postData() || '' }))
  return requests
}
// The approved synthetic example, on step 2; `hybrid` adds the reviewer switch to the address.
async function onStep2(page, lang, { hybrid }) {
  const app = kamin(page, { ui: 'new', lang })
  await page.goto(`/${lang}/?start=sample${hybrid ? '&suggest=hybrid' : ''}`)
  await app.reviewConsent().check()
  await app.approveButton().click()
  await expect(app.heading('projects')).toBeVisible()
  return app
}
async function describeProject(app, lang, description) {
  const w = W(lang), form = app.projectForm()
  if (!(await form.count())) await app.main().getByRole('button', { name: w.add, exact: true }).click()
  await form.getByLabel(w.title, { exact: true }).fill(tr(lang, 'حماية الحسابات (مثال مختلق)', 'Account protection (made up)'))
  await form.getByLabel(w.description, { exact: true }).fill(description)
  await form.getByRole('button', { name: w.suggest, exact: true }).click()
}
const lookDeeper = (app, lang) => app.projectForm().getByRole('button', { name: D(lang).button, exact: true })

for (const lang of LANGS) {
  test.describe(`Look deeper (${lang})`, () => {
    test('default engine: an abstention shows no "Look deeper" and no model file is requested', async ({ page }) => {
      const requests = watch(page)
      const app = await onStep2(page, lang, { hybrid: false })
      await describeProject(app, lang, NO_CUE(lang))
      await expect(app.projectForm().getByText(PROJECT_COPY[lang].abstain, { exact: true })).toBeVisible()
      await expect(app.projectForm().getByTestId('look-deeper')).toHaveCount(0)
      await expect(lookDeeper(app, lang)).toHaveCount(0)
      expect(requests.filter(r => MODEL.test(r.url))).toEqual([])
    })

    test('hybrid: offered only after an abstention, disabled until consent, no model file before the button; axe and 360px', async ({ page }) => {
      const requests = watch(page)
      const app = await onStep2(page, lang, { hybrid: true })
      // The engine found skills: nothing more is offered.
      await describeProject(app, lang, CUE(lang))
      await expect(app.projectChips().first()).toBeVisible()
      await expect(app.projectForm().getByTestId('look-deeper')).toHaveCount(0)
      // It abstains: "Look deeper" appears, disabled until the box is ticked.
      await describeProject(app, lang, NO_CUE(lang))
      const panel = app.projectForm().getByTestId('look-deeper')
      await expect(panel).toBeVisible()
      await expect(panel).toContainText(D(lang).line)
      await expect(panel).toContainText(D(lang).details)
      await expect(lookDeeper(app, lang)).toBeDisabled()
      await panel.getByRole('checkbox', { name: D(lang).consent, exact: true }).check()
      await expect(lookDeeper(app, lang)).toBeEnabled()
      await page.waitForTimeout(500)
      expect(requests.filter(r => MODEL.test(r.url)), 'no model file before "Look deeper" is pressed').toEqual([])
      const report = await new AxeBuilder({ page }).include('[data-testid="ui2-project-form"]').analyze()
      expect(report.violations.filter(v => ['serious', 'critical'].includes(v.impact)), JSON.stringify(report.violations, null, 1)).toEqual([])
      await page.setViewportSize({ width: 360, height: 780 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll at 360px').toBe(true)
    })
  })
}

test('hybrid, English: "Look deeper" loads the local model and adds one skill marked "found by meaning, please check"', async ({ page }) => {
  test.setTimeout(240000)
  const lang = 'en', d = D(lang)
  const requests = watch(page)
  const app = await onStep2(page, lang, { hybrid: true })
  await describeProject(app, lang, PROTECTED)
  await expect(app.projectForm().getByText(PROJECT_COPY[lang].abstain, { exact: true })).toBeVisible()
  const panel = app.projectForm().getByTestId('look-deeper')
  await panel.getByRole('checkbox', { name: d.consent, exact: true }).check()
  expect(requests.filter(r => MODEL.test(r.url))).toEqual([])
  await lookDeeper(app, lang).click()
  await expect(panel.getByTestId('look-deeper-result')).toHaveText(d.found, { timeout: 200000 })
  expect(requests.some(r => MODEL.test(r.url)), 'the model came from this site').toBe(true)
  // One skill, labelled, ticked, and only one.
  const byMeaning = app.projectChips().filter({ hasText: d.byMeaning })
  await expect(byMeaning).toHaveCount(1)
  await expect(byMeaning).toHaveText(`${skill('cyber', lang)} · ${d.byMeaning}`)
  await expect(byMeaning).toHaveAttribute('aria-pressed', 'true')
  await expect(app.projectChips()).toHaveCount(1)
  await expect(app.projectForm().getByText(PROJECT_COPY[lang].abstain, { exact: true })).toHaveCount(0)
  await expect(lookDeeper(app, lang)).toBeDisabled()
  // The description stays on the device; every request goes to this site.
  expect(JSON.stringify(requests)).not.toContain(PROTECTED)
  expect(JSON.stringify(requests)).not.toContain(encodeURIComponent(PROTECTED))
  expect(requests.filter(r => new URL(r.url).origin !== new URL(page.url()).origin)).toEqual([])
  // No score or percentage in the form once it is done.
  await expect(app.projectForm()).not.toContainText(/\d\s?%|score/i)
  const report = await new AxeBuilder({ page }).include('[data-testid="ui2-project-form"]').analyze()
  expect(report.violations.filter(v => ['serious', 'critical'].includes(v.impact)), JSON.stringify(report.violations, null, 1)).toEqual([])
  // "Stop and delete model files" removes the cached files.
  await panel.getByRole('button', { name: d.remove, exact: true }).click()
  await expect(panel.getByText(d.removed, { exact: true })).toBeVisible()
  expect(await page.evaluate(() => caches.keys())).not.toContain('kamin-embedding-model-v1')
  // The skill is still a normal suggestion: Save keeps it.
  await app.projectForm().getByRole('button', { name: W(lang).save, exact: true }).click()
  await expect(app.projectCards()).toHaveCount(1)
  await expect(app.projectCards().first()).toContainText(skill('cyber', lang))
})

test('hybrid, Arabic: when nothing is close enough in meaning, it says so and adds no skill', async ({ page }) => {
  test.setTimeout(240000)
  const lang = 'ar', d = D(lang)
  const requests = watch(page)
  const app = await onStep2(page, lang, { hybrid: true })
  await describeProject(app, lang, PROTECTED_AR)
  const panel = app.projectForm().getByTestId('look-deeper')
  await panel.getByRole('checkbox', { name: d.consent, exact: true }).check()
  await lookDeeper(app, lang).click()
  await expect(panel.getByTestId('look-deeper-result')).toHaveText(d.nothing, { timeout: 200000 })
  await expect(app.projectForm().getByRole('group', { name: W(lang).chips, exact: true })).toHaveCount(0)
  await expect(app.projectForm().getByText(PROJECT_COPY[lang].abstain, { exact: true })).toBeVisible()
  expect(JSON.stringify(requests)).not.toContain(PROTECTED_AR)
  expect(requests.filter(r => new URL(r.url).origin !== new URL(page.url()).origin)).toEqual([])
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl')
})
