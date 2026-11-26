// Task 65 · step 4 of the new interface (?ui=next): the feed of next steps and My plan. With the synthetic example and a
// goal, cards show Builds / Improves / Why in four short lines; "Take this course" / "Get this certificate" puts the item
// in My plan (≤ 3 taps from the end of step 3 without a goal, ≤ 2 with one); "Not for me" hides it and Undo brings it
// back; Details shows the evidence sources, the item's source and the "clue, not a guarantee" sentence; an empty feed
// says why; My plan marks done, removes with Undo, shows the "Not for me" list and compares the goals; keeping the
// profile on this device keeps the plan after a reload; a skeleton shows while the feed loads; no percentage anywhere;
// no sideways scroll at 360px; axe in both themes. Arabic and English, on the desktop and phone projects.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { NEXT_COPY, fillIn } from '../src/ui2/copy.js'
import { copy } from '../src/i18n.js'
import { COURSE_EVIDENCE_PRINCIPLE } from '../src/content/trustCopy.js'
import { LEARNING_PATH_COPY } from '../src/content/learningPathCopy.js'
import { saveOffer } from '../src/content/saveOfferCopy.js'
import { STORAGE_KEY } from '../src/state/profileState.js'
import { catalogItem } from '../src/path/suggest.js'
import { NO_GOAL_REASON } from '../src/path/nextSteps.js'
import { LANGS, kamin } from './roles.js'

const NARROW = { width: 360, height: 780 }
const PERCENT = /\d\s?[%٪]|[%٪]\s?\d/
const W = lang => NEXT_COPY[lang].next
const P = lang => NEXT_COPY[lang].plan
const stored = page => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), STORAGE_KEY)
// The items the synthetic example gets (src/catalog/learning-opportunities.json): Data Analyst → Database (II), a
// university course; IT Project Coordinator → CAPM, a certificate; Junior Cybersecurity Analyst → Information Security.
const DATA = 'job-data-analyst', COORDINATOR = 'job-project-coordinator', CYBER = 'job-cyber-analyst'
const title = (id, lang) => catalogItem(id).title[lang]
const DATA_NAME = { ar: 'محلل بيانات', en: 'Data Analyst' }

// Counts the taps a student makes (set-up steps are not counted).
function tapper() {
  const taps = []
  return { taps, tap: async (locator, what) => { await locator.click(); taps.push(what) } }
}
async function onStep(page, lang, view, goals = []) {
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  if (goals.length) {
    await app.goToView('plan')
    for (const goal of goals) await app.goalChip(goal).click()
  }
  await app.goToView(view)
  return app
}
const cards = app => app.stepCards()
const card = (app, id) => app.main().locator(`[data-testid="ui2-step-card"][data-item="${id}"]`)
const noPercent = async (page, what) => expect(await page.locator('body').innerText(), `${what}: no percentage`).not.toMatch(PERCENT)

for (const lang of LANGS) test.describe(`Step 4 and My plan (${lang})`, () => {
  test('no goal: from the end of step 3, "Skip for now", a goal, "Take this course" = 3 taps; the card reads Builds / Improves / Why in four lines; it is in My plan', async ({ page }) => {
    const w = W(lang)
    const app = await onStep(page, lang, 'interests')
    const { taps, tap } = tapper()
    await tap(app.main().getByRole('button', { name: NEXT_COPY[lang].interests.skip, exact: true }), 'skip for now')
    await expect(app.heading('next')).toBeVisible()
    await expect(app.main().getByRole('button', { name: fillIn(NEXT_COPY[lang].steps.step, { n: 4, of: 4 }), exact: true })).toBeVisible()
    // Without a goal: the question, the chips, and the reason the feed is empty.
    await expect(app.goals().getByText(w.where, { exact: true })).toBeVisible()
    await expect(page.getByTestId('ui2-feed-empty')).toContainText(NO_GOAL_REASON[lang])
    await expect(page.getByTestId('ui2-feed-empty')).toContainText(w.noGoalHint)
    await tap(app.goalChip(DATA), 'choose Data Analyst')
    await expect(app.goalChip(DATA)).toHaveAttribute('aria-pressed', 'true')
    await expect(app.currentGoal(DATA)).toBeVisible()
    const first = card(app, 'fcit-cpit-340')
    await expect(first).toBeVisible()
    // The card: kind and title on one row, then Builds, Improves, Why: four short lines before the actions.
    await expect(first.getByTestId('ui2-step-kind')).toHaveText(LEARNING_PATH_COPY[lang].kind['university-course'])
    await expect(first.getByRole('heading', { level: 3 })).toHaveText(title('fcit-cpit-340', lang))
    await expect(first.getByTestId('ui2-step-builds')).toContainText(w.builds)
    await expect(first.getByTestId('ui2-step-improves')).toContainText(w.improves)
    await expect(first.getByTestId('ui2-step-why')).toContainText(w.why)
    await expect(first.getByTestId('ui2-step-why')).toContainText(lang === 'ar' ? 'يتطلب' : 'requires')
    // Before the actions: the top row and exactly three lines; on the desktop each of the four fits on one line.
    const rows = await first.evaluate(node => [node.querySelector('.ui2-step-top'), ...node.querySelectorAll('.ui2-step-line')].map(el => {
      const lineHeight = parseFloat(getComputedStyle(el.querySelector('h3') || el).lineHeight)
      return Math.round(el.getBoundingClientRect().height / lineHeight)
    }))
    expect(rows).toHaveLength(4)
    if ((page.viewportSize()?.width || 0) >= 1000) for (const height of rows) expect(height, `rows ${rows.join(', ')}`).toBeLessThanOrEqual(2)
    await expect(app.main().getByText(copy[lang].screens.courses.rule, { exact: true })).toBeVisible()
    await noPercent(page, 'step 4')
    await tap(first.getByRole('button', { name: w.take, exact: true }), 'take this course')
    // Instant feedback: the card leaves the feed, the one message says so with Undo, focus does not get lost.
    await expect(first).toHaveCount(0)
    await expect(page.getByTestId('notice')).toContainText(w.taken)
    await expect(page.getByTestId('notice').getByRole('button', { name: w.undo, exact: true })).toBeVisible()
    await expect(page.locator(':focus')).toHaveCount(1)
    expect(await page.evaluate(() => document.activeElement === document.body), 'focus moved to the feed').toBe(false)
    expect((await stored(page)).plan.map(p => [p.itemId, p.action, p.status])).toEqual([['fcit-cpit-340', 'take-course', 'planned']])
    expect(taps, taps.join(' → ')).toHaveLength(3)
    // My plan lists it.
    await app.tab('plan')
    const item = app.main().getByTestId('ui2-plan-item')
    await expect(item).toHaveCount(1)
    await expect(item).toContainText(title('fcit-cpit-340', lang))
    await expect(item).toContainText(P(lang).action['take-course'])
    await expect(item.getByTestId('ui2-plan-status')).toHaveText(P(lang).status.planned)
  })

  test('with a goal: from the end of step 3, "Skip for now" and "Get this certificate" = 2 taps; Undo takes it out again', async ({ page }) => {
    const w = W(lang)
    const app = await onStep(page, lang, 'interests', [COORDINATOR])
    const { taps, tap } = tapper()
    await tap(app.main().getByRole('button', { name: NEXT_COPY[lang].interests.skip, exact: true }), 'skip for now')
    const capm = card(app, 'capm')
    await expect(capm.getByTestId('ui2-step-illustrative')).toHaveText(LEARNING_PATH_COPY[lang].illustrative)
    await expect(capm.getByRole('button', { name: w.take, exact: true })).toHaveCount(0)
    await tap(capm.getByRole('button', { name: w.get, exact: true }), 'get this certificate')
    expect(taps).toHaveLength(2)
    expect((await stored(page)).plan.map(p => [p.itemId, p.action])).toEqual([['capm', 'get-certificate']])
    await expect(capm).toHaveCount(0)
    // The feed is empty now and says why. Task 79: the real reason, every suggestion handled, never "No gap".
    await expect(page.getByTestId('ui2-feed-empty')).toHaveAttribute('data-reason', 'handled')
    await expect(page.getByTestId('ui2-feed-empty')).toContainText(w.handled)
    await expect(page.getByTestId('ui2-feed-empty')).not.toContainText(w.noGap)
    await page.getByTestId('notice').getByRole('button', { name: w.undo, exact: true }).click()
    await expect(card(app, 'capm')).toBeVisible()
    expect((await stored(page)).plan).toEqual([])
  })

  // Task 79 · the roadmap: from step 4 in a sheet and in My plan; a tick is saved with the plan, can be unticked and is
  // never evidence; the empty feed never says "No gap" when the list has nothing yet.
  test('Task 79: no "No gap" when the list has nothing yet; the roadmap from step 4 and My plan; tick, untick, never evidence', async ({ page }) => {
    const w = W(lang), r = NEXT_COPY[lang].roadmap
    const app = await onStep(page, lang, 'next', ['job-business-analyst'])
    const empty = page.getByTestId('ui2-feed-empty')
    await expect(empty).toHaveAttribute('data-reason', 'list-empty')
    await expect(empty).toContainText(w.listEmptyHint)
    await expect(empty).not.toContainText(w.noGap)
    // Data Analyst as well: its roadmap from step 4.
    await app.goals().getByRole('button', { name: w.changeGoals, exact: true }).click()
    await app.goalChip(DATA).click()
    await expect(card(app, 'fcit-cpit-340')).toBeVisible()
    const before = await stored(page)
    await app.main().getByRole('button', { name: fillIn(w.seeRoadmap, { path: DATA_NAME[lang] }), exact: true }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText(fillIn(r.title, { path: DATA_NAME[lang] }))
    await expect(sheet.getByTestId('ui2-roadmap-stage')).toHaveCount(5)
    await expect(sheet.getByTestId('ui2-roadmap-cert').first()).toBeVisible()
    for (const link of await sheet.locator('a').all()) {
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    const first = sheet.getByTestId('ui2-roadmap-item').first()
    const key = await first.getAttribute('data-key')
    await first.getByRole('checkbox').check()
    await expect(first).toHaveAttribute('data-done', 'true')
    const after = await stored(page)
    expect(after.roadmapDone).toEqual([key])
    // Never evidence: the record, the approval and the consents are as they were.
    for (const field of ['courses', 'approved', 'projects', 'credentials', 'consents']) expect(after[field], field).toEqual(before[field])
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    // My plan: the same roadmap, the tick kept; untick it.
    await app.tab('plan')
    const box = app.main().locator(`[data-testid="ui2-plan-roadmap"][data-goal="${DATA}"]`)
    await box.getByRole('button', { name: fillIn(r.show, { path: DATA_NAME[lang] }), exact: true }).click()
    const ticked = box.locator(`[data-testid="ui2-roadmap-item"][data-key="${key}"]`).getByRole('checkbox')
    await expect(ticked).toBeChecked()
    await ticked.uncheck()
    expect((await stored(page)).roadmapDone).toEqual([])
    await noPercent(page, 'my plan with a roadmap')
  })

  test('Task 79: the roadmap at 360px has no sideways scroll, and axe finds nothing in either theme', async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(NARROW)
    const r = NEXT_COPY[lang].roadmap
    const app = await onStep(page, lang, 'next', [CYBER])
    const wide = [], found = {}
    const check = async label => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (overflow > 0) wide.push(`${label}: ${overflow}px`)
      await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity))
      const report = await new AxeBuilder({ page }).analyze()
      if (report.violations.length) found[label] = report.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)
    }
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme })
      await app.goToView('next')
      await app.main().getByTestId('ui2-feed-roadmaps').getByRole('button').first().click()
      await expect(page.getByRole('dialog').getByTestId('ui2-roadmap-stage')).toHaveCount(5)
      await page.getByRole('dialog').getByRole('checkbox').first().check()
      await check(`${theme}: step 4 roadmap sheet`)
      await page.keyboard.press('Escape')
      await app.tab('plan')
      await app.main().getByTestId('ui2-plan-roadmap').getByRole('heading').getByRole('button').click()
      await expect(app.main().getByTestId('ui2-roadmap')).toBeVisible()
      await check(`${theme}: my plan roadmap`)
      await app.main().getByTestId('ui2-roadmap').getByRole('checkbox').first().uncheck()
    }
    expect(wide).toEqual([])
    expect(found).toEqual({})
    expect(r.neverEvidence).toBeTruthy()
  })

  test('"Not for me" hides a card and Undo brings it back; hidden again, it is listed in My plan and "Show again" returns it', async ({ page }) => {
    const w = W(lang)
    const app = await onStep(page, lang, 'next', [DATA, CYBER])
    await expect(cards(app)).toHaveCount(2)
    const security = card(app, 'fcit-cpit-425')
    const name = fillIn(w.notForMeOf, { title: title('fcit-cpit-425', lang) })
    await security.getByRole('button', { name, exact: true }).click()
    await expect(security).toHaveCount(0)
    await expect(page.getByTestId('notice')).toContainText(w.hidden)
    // Focus goes to the card that took its place.
    await expect(card(app, 'fcit-cpit-340').getByRole('heading', { level: 3 })).toBeFocused()
    await page.getByTestId('notice').getByRole('button', { name: w.undo, exact: true }).click()
    await expect(card(app, 'fcit-cpit-425')).toBeVisible()
    expect((await stored(page)).notForMe).toEqual([])
    await card(app, 'fcit-cpit-425').getByRole('button', { name, exact: true }).click()
    expect((await stored(page)).notForMe).toEqual(['fcit-cpit-425'])
    await app.tab('plan')
    const hidden = app.main().getByTestId('ui2-plan-hidden')
    await expect(hidden.getByRole('heading', { name: P(lang).hiddenTitle })).toBeVisible()
    await hidden.getByRole('button', { name: fillIn(P(lang).restoreOf, { title: title('fcit-cpit-425', lang) }), exact: true }).click()
    await expect(page.getByTestId('notice')).toContainText(P(lang).restored)
    await expect(hidden).toHaveCount(0)
    await app.goToView('next')
    await expect(card(app, 'fcit-cpit-425')).toBeVisible()
  })

  test('Details: outcome, level, prerequisites, the gap it closes, where the evidence comes from, the source and the clue sentence; Esc closes and focus returns', async ({ page }) => {
    const w = W(lang)
    const T = LEARNING_PATH_COPY[lang]
    const app = await onStep(page, lang, 'next', [DATA, COORDINATOR])
    const opener = card(app, 'fcit-cpit-340').getByRole('button', { name: fillIn(w.detailsOf, { title: title('fcit-cpit-340', lang) }), exact: true })
    await opener.click()
    const sheet = app.sheet(title('fcit-cpit-340', lang))
    await expect(sheet).toBeVisible()
    for (const heading of [w.levelTitle, w.prerequisites, w.gapTitle, w.evidenceTitle, T.source]) await expect(sheet.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(sheet.getByTestId('ui2-step-evidence')).toContainText('CPIT-240')
    await expect(sheet.getByTestId('ui2-step-clue')).toHaveText(COURSE_EVIDENCE_PRINCIPLE[lang])
    await expect(sheet.getByTestId('ui2-step-closes')).toContainText(`${T.closes}:`)
    await expect(sheet).toContainText(catalogItem('fcit-cpit-340').source.ref)
    await expect(sheet.getByTestId('ui2-step-list-note')).toHaveText(T.intro)
    await expect(sheet.getByRole('button', { name: w.take, exact: true })).toBeVisible()
    await noPercent(page, 'Details')
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(opener).toBeFocused()
    // A certificate's Details show its outcome.
    await card(app, 'capm').getByRole('button', { name: `${w.details}: ${title('capm', lang)}`, exact: true }).click()
    const capm = app.sheet(title('capm', lang))
    await expect(capm.getByTestId('ui2-step-outcome')).toHaveText(catalogItem('capm').outcome[lang])
    // Deciding from Details: "Get this certificate" saves it, closes the sheet and the card leaves the feed.
    await capm.getByRole('button', { name: w.get, exact: true }).click()
    await expect(capm).toHaveCount(0)
    await expect(card(app, 'capm')).toHaveCount(0)
    expect((await stored(page)).plan.map(p => p.itemId)).toEqual(['capm'])
    await expect(page.locator(':focus')).toHaveCount(1)
  })

  test('My plan: goals are editable, a step is marked done and removed with Undo, Compare paths starts from the goals, no percentage', async ({ page }) => {
    const p = P(lang)
    const app = await onStep(page, lang, 'next', [DATA, CYBER])
    await card(app, 'fcit-cpit-340').getByRole('button', { name: W(lang).take, exact: true }).click()
    await card(app, 'fcit-cpit-425').getByRole('button', { name: W(lang).take, exact: true }).click()
    await app.tab('plan')
    const items = app.main().getByTestId('ui2-plan-item')
    await expect(items).toHaveCount(2)
    const done = app.main().getByRole('checkbox', { name: fillIn(p.markDone, { title: title('fcit-cpit-340', lang) }), exact: true })
    await done.check()
    await expect(items.first()).toHaveAttribute('data-status', 'done')
    await expect(items.first().getByTestId('ui2-plan-status')).toHaveText(p.status.done)
    expect((await stored(page)).plan[0].status).toBe('done')
    await app.main().getByRole('button', { name: fillIn(p.removeOf, { title: title('fcit-cpit-340', lang) }), exact: true }).click()
    await expect(items).toHaveCount(1)
    await expect(page.getByTestId('notice')).toContainText(p.removed)
    await page.getByTestId('notice').getByRole('button', { name: p.undo, exact: true }).click()
    await expect(items).toHaveCount(2)
    await expect(items.first()).toHaveAttribute('data-item', 'fcit-cpit-340')
    await expect(items.first()).toHaveAttribute('data-status', 'done')
    // Goals: remove one with its chip; "Change goals" brings the chips back.
    await app.currentGoal(CYBER).click()
    await expect(app.currentGoal(CYBER)).toHaveCount(0)
    expect((await stored(page)).goals).toEqual([DATA])
    await app.goals().getByRole('button', { name: W(lang).changeGoals, exact: true }).click()
    await app.goalChip(CYBER).click()
    expect((await stored(page)).goals).toEqual([DATA, CYBER])
    // Compare paths: the old comparison, starting from the two goals.
    await app.main().getByRole('button', { name: p.compare, exact: true }).click()
    const compare = app.pathwayComparison()
    await expect(compare.getByRole('table')).toBeVisible()
    for (const goal of [DATA, CYBER]) await expect(compare.getByRole('columnheader', { name: app.goalPathwayName(goal), exact: true })).toBeVisible()
    await noPercent(page, 'My plan and Compare paths')
  })

  test('keeping the profile on this device (the dashboard\'s offer, word for word) keeps the plan after a reload', async ({ page, context }) => {
    const app = await onStep(page, lang, 'next', [COORDINATOR])
    await card(app, 'capm').getByRole('button', { name: W(lang).get, exact: true }).click()
    await app.tab('plan')
    const offer = page.getByTestId('ui2-save-offer')
    await expect(page.getByTestId('ui2-plan-save')).toContainText(P(lang).savedSession)
    await expect(offer).toContainText(saveOffer('question', lang))
    await expect(offer).toContainText(saveOffer('detail', lang))
    await offer.getByRole('button', { name: saveOffer('keep', lang), exact: true }).click()
    await expect(page.getByTestId('notice')).toHaveText(saveOffer('kept', lang))
    await expect(page.getByTestId('ui2-plan-save')).toContainText(saveOffer('savedNote', lang))
    await page.reload()
    await expect(app.main().getByTestId('ui2-plan-item')).toHaveCount(1)
    // Another tab on this device (its session is empty): the plan is there too.
    const other = await context.newPage()
    const again = kamin(other, { ui: 'new', lang })
    await again.goToView('plan')
    await expect(again.main().getByTestId('ui2-plan-item')).toContainText(title('capm', lang))
    await expect(again.currentGoal(COORDINATOR)).toBeVisible()
  })

  test.describe(() => {
  // The service worker answers page requests itself, out of page.route's reach (as in e2e/next-upload.spec.js).
  test.use({ serviceWorkers: 'block' })
  test('a skeleton shows while the feed and the learning list load', async ({ page }) => {
    const app = await onStep(page, lang, 'plan', [DATA])
    let release
    const held = new Promise(resolve => { release = resolve })
    await page.route('**/assets/stepsEngine-*.js', async route => { await held; await route.continue() })
    await page.goto(`/${lang}/?app=next`)
    await expect(app.heading('next')).toBeVisible()
    await expect(page.getByTestId('ui2-feed').getByTestId('ui2-skeleton')).toBeVisible()
    await expect(page.getByTestId('ui2-feed')).toHaveAttribute('aria-busy', 'true')
    release()
    await expect(card(app, 'fcit-cpit-340')).toBeVisible()
    await expect(page.getByTestId('ui2-feed').getByTestId('ui2-skeleton')).toHaveCount(0)
  })
  })

  test('no sideways scroll at 360px: the feed, Details, the paths, My plan and Compare paths', async ({ page }) => {
    await page.setViewportSize(NARROW)
    const app = await onStep(page, lang, 'next', [DATA, CYBER, COORDINATOR])
    const wide = []
    const check = async label => { const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (overflow > 0) wide.push(`${label}: ${overflow}px`) }
    await expect(cards(app)).toHaveCount(3)
    await check('feed')
    await card(app, 'fcit-cpit-340').getByRole('button', { name: `${W(lang).details}: ${title('fcit-cpit-340', lang)}`, exact: true }).click()
    await check('details')
    await page.keyboard.press('Escape')
    await app.goals().getByRole('button', { name: W(lang).aboutPaths, exact: true }).click()
    await app.pathway(0).getByRole('heading').getByRole('button').click()
    await check('paths')
    await page.keyboard.press('Escape')
    await card(app, 'capm').getByRole('button', { name: W(lang).get, exact: true }).click()
    await card(app, 'fcit-cpit-425').getByRole('button', { name: `${W(lang).notForMe}: ${title('fcit-cpit-425', lang)}`, exact: true }).click()
    await app.tab('plan')
    await expect(app.main().getByTestId('ui2-plan-item')).toHaveCount(1)
    await check('plan')
    await app.main().getByRole('button', { name: P(lang).compare, exact: true }).click()
    await expect(app.pathwayComparison()).toBeVisible()
    await check('compare')
    expect(wide).toEqual([])
  })

  for (const theme of ['light', 'dark']) test(`axe (${theme}): 0 violations on the feed, Details, the paths, My plan and Compare paths`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ colorScheme: theme })
    const app = await onStep(page, lang, 'next', [DATA, CYBER])
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toContain(theme)
    const found = {}
    const check = async label => {
      // The message fades in (0.2 s, Task 25); axe reads colours once it has finished, as a student sees them.
      await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity))
      const report = await new AxeBuilder({ page }).analyze()
      if (report.violations.length) found[label] = report.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)
    }
    await expect(cards(app)).toHaveCount(2)
    await check('feed with goals and cards')
    await card(app, 'fcit-cpit-340').getByRole('button', { name: `${W(lang).details}: ${title('fcit-cpit-340', lang)}`, exact: true }).click()
    await check('details')
    await page.keyboard.press('Escape')
    await app.goals().getByRole('button', { name: W(lang).aboutPaths, exact: true }).click()
    await app.pathway(0).getByRole('heading').getByRole('button').click()
    await check('paths with one open')
    await page.keyboard.press('Escape')
    await card(app, 'fcit-cpit-340').getByRole('button', { name: W(lang).take, exact: true }).click()
    await card(app, 'fcit-cpit-425').getByRole('button', { name: `${W(lang).notForMe}: ${title('fcit-cpit-425', lang)}`, exact: true }).click()
    await check('empty feed with the message')
    await app.tab('plan')
    await expect(app.main().getByTestId('ui2-plan-item')).toHaveCount(1)
    await check('my plan with a step, a hidden item and the save offer')
    await app.main().getByRole('button', { name: P(lang).compare, exact: true }).click()
    await expect(app.pathwayComparison().getByRole('table')).toBeVisible()
    await check('compare paths')
    expect(found).toEqual({})
  })
})
