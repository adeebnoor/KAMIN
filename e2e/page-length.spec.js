import { test, expect } from './fixtures.js'
import { readFileSync } from 'node:fs'
import { pageLength, sidewaysScroll, cutOffInputs, messagesOverHeading, screensAllowed, writeResults, documentLength, visibleDocumentChoices, settleDocument } from './usability-lib.js'
import { APP_VIEWS, walkAppViews, openAppWindow, loadSample, approveSample, openAppView } from './nav.js'
import { LEGACY_VIEWS } from '../src/navigation.js'
import { NEW_APP_VIEWS, kamin } from './roles.js'
import { VIEW_TEXT } from '../src/ui2/views.js'

// Task 30 · guards so the app stays short and readable (extends Task 15, which counts clicks and
// choices). Every app view is opened with the synthetic example, in Arabic and English, on the
// desktop and phone projects:
//   1. page length in screens, against e2e/usability-budget.json "screens";
//   2. at 360px: nothing scrolls sideways, and no text field cuts its text;
//   3. Back goes to the previous app screen and then closes the app;
//   4. after approval no message lies on top of the page heading.
// Problems measured on 2026-11-12 are listed in the budget file ("knownProblems", and budgets
// above zero), never skipped: each check runs and is recorded, and fails if its screen gets worse.
// Results: test-results/usability.json. Before/after table: docs/USABILITY_BASELINE.md.
// Task 69: these walk the old interface (?ui=old, e2e/fixtures.js) until Task 70 deletes it; the last block measures
// every view of the new interface, now the default, against its own budgets.
const BUDGET = JSON.parse(readFileSync(new URL('./usability-budget.json', import.meta.url), 'utf8'))
const LANGS = ['ar', 'en']
const results = {}
const known = (id, project) => !!BUDGET.knownProblems[id]?.projects.includes(project)

test('every view in src/navigation.js is in the list these checks walk', () => {
  // "skills" is the dashboard scrolled to its capability list, not a page of its own.
  expect([...APP_VIEWS].sort()).toEqual(Object.keys(LEGACY_VIEWS).filter(view => view !== 'skills').sort())
})

for (const lang of LANGS) test(`page length: no app view is longer than its budget (${lang})`, async ({ page }, info) => {
  test.setTimeout(90_000)
  const budget = BUDGET.screens[info.project.name][lang]
  const measured = {}
  await walkAppViews(page, lang, async view => { measured[view] = await pageLength(page) })
  results[`page-length.${lang}`] = measured
  // In CI, test-results/ is emptied by the later `npm run visual` step, but reports/playwright.json
  // (the test-results-page artifact) keeps this attachment: the numbers measured on Linux.
  await info.attach(`page-length.${lang}.json`, { body: JSON.stringify(measured), contentType: 'application/json' })
  for (const [view, m] of Object.entries(measured)) {
    expect.soft(m.screens, `${view} (${lang}) is ${m.screens} screens long (${m.scrollHeight}px in a ${m.clientHeight}px window). Budget: ${budget[view]} screens, plus the allowance.`).toBeLessThanOrEqual(screensAllowed(budget[view]))
  }
})

test.describe('on a 360px screen', () => {
  test.use({ viewport: { width: 360, height: 740 } })
  for (const lang of LANGS) test(`360px: nothing scrolls sideways and no text field cuts its text (${lang})`, async ({ page }, info) => {
    test.setTimeout(90_000)
    const sideways = {}, cut = {}
    await walkAppViews(page, lang, async view => { sideways[view] = await sidewaysScroll(page); cut[view] = await cutOffInputs(page) })
    results[`sideways-scroll-360.${lang}`] = sideways
    results[`cut-off-inputs-360.${lang}`] = cut
    await info.attach(`layout-360.${lang}.json`, { body: JSON.stringify({ sideways, cut }), contentType: 'application/json' })
    for (const view of APP_VIEWS) {
      expect.soft(sideways[view].length, `${view} (${lang}) has content wider than its box: ${sideways[view].join(' | ')}`).toBeLessThanOrEqual(BUDGET.sidewaysScroll360[view] ?? 0)
      expect.soft(cut[view].length, `${view} (${lang}) has text fields that cut their text: ${cut[view].join(' | ')}`).toBeLessThanOrEqual(BUDGET.cutOffInputs360[view]?.[lang] ?? 0)
    }
  })
})

test('Back goes to the previous app screen, then closes the app', async ({ page }, info) => {
  const where = () => page.evaluate(() => {
    const visible = el => !!el && el.getClientRects().length > 0
    const app = visible(document.querySelector('.app-overlay'))
    return {
      path: location.pathname,
      app,
      section: app ? [...document.querySelectorAll('nav button[aria-current=page]')].find(visible)?.dataset.section ?? null : null,
      tab: app ? [...document.querySelectorAll('.app-overlay [role=tab][aria-selected=true]')].find(visible)?.id ?? null : null,
    }
  })
  await openAppWindow(page, 'ar')
  const steps = { opened: await where() }
  await openAppView(page, 'matches', 'ar')
  await openAppView(page, 'compare', 'ar')
  steps.twoTabsLater = await where()
  for (const press of ['back1', 'back2', 'back3']) {
    await page.goBack().catch(() => null)
    await page.waitForTimeout(200)
    steps[press] = await where()
  }
  const wanted = {
    back1: { path: '/ar/', app: true, section: 'next', tab: 'tab-matches' },
    back2: steps.opened,
    back3: { path: '/ar/', app: false, section: null, tab: null },
  }
  const ok = Object.entries(wanted).every(([press, want]) => JSON.stringify(steps[press]) === JSON.stringify(want))
  results['back-button'] = { ok, steps }
  expect(steps.twoTabsLater, 'the route itself works').toEqual({ path: '/ar/', app: true, section: 'next', tab: 'tab-compare' })
  if (!ok && !known('back-button', info.project.name)) expect({ back1: steps.back1, back2: steps.back2, back3: steps.back3 }, 'Back must stay in KAMIN: previous tab, then the first screen, then close the app').toEqual(wanted)
})

for (const lang of LANGS) test(`after approval no message covers the page heading (${lang})`, async ({ page }, info) => {
  await openAppWindow(page, lang)
  await loadSample(page, lang)
  await approveSample(page, lang)
  const covering = await messagesOverHeading(page)
  results[`message-covers-heading.${lang}`] = covering
  expect(covering, 'the dashboard has a page heading to measure against').not.toBeNull()
  if (!known('message-covers-heading', info.project.name)) expect(covering, 'a message lies on top of the page heading').toEqual([])
})

// ---------- Task 69 · the new interface (the default): page length, visible controls and clicks for every view ----------
// Every view of src/ui2/views.js, reached from Home by the shortest route a student takes (e2e/roles.js counts every
// click): Home and step 1 before a record, the other views with the approved synthetic example. The new interface is a
// full page, so its length is the document's (screens = scrollHeight / window height) and its controls are every
// visible control of the page (top bar, tabs and footer included). Budgets: e2e/usability-budget.json "newInterface";
// screens per project and language with the allowance above, choices and clicks one number per view (they may only go
// down). Results: test-results/usability.json ("new-interface.ar", "new-interface.en").
const NEW = BUDGET.newInterface
const NEW_ROUTES = {
  projects: app => app.openProjects(),
  interests: async app => {
    await app.openProjects()
    await app.click(app.main().getByRole('button', { name: app.wp.skip, exact: true }), 'skip for now')
  },
  next: async app => { await app.openGoals(); await app.openGoalElsewhere() },
  plan: app => app.openGoals(),
  profile: app => app.tab('profile'),
  settings: app => app.openSettings(),
  help: app => app.click(app.footerLink(VIEW_TEXT.help.title[app.lang]), 'help in the footer'),
}

test('every view of the new interface has a route here and its three budgets', () => {
  expect(['home', 'upload', ...Object.keys(NEW_ROUTES)].sort()).toEqual([...NEW_APP_VIEWS].sort())
  for (const view of NEW_APP_VIEWS) {
    expect(NEW.clicks[view], `clicks budget for ${view}`).toEqual(expect.any(Number))
    expect(NEW.choices[view], `choices budget for ${view}`).toEqual(expect.any(Number))
    for (const project of ['desktop-chromium', 'mobile-chromium']) for (const lang of LANGS)
      expect(NEW.screens[project][lang][view], `screens budget for ${view} (${project}, ${lang})`).toEqual(expect.any(Number))
  }
})

test.describe('the new interface (the default)', () => {
  test.use({ kaminUi: 'new' })
  for (const lang of LANGS) test(`new interface: page length, visible controls and clicks from Home for every view (${lang})`, async ({ page }, info) => {
    test.setTimeout(120_000)
    const measured = {}
    const measure = async (view, app) => {
      await expect(app.heading(view)).toBeVisible()
      await settleDocument(page)
      const length = await documentLength(page)
      measured[view] = { screens: length.screens, scrollHeight: length.scrollHeight, clientHeight: length.clientHeight, choices: await visibleDocumentChoices(page), clicks: app.clicks, route: [...app.steps] }
    }
    // Before a record: Home, then "Start" opens step 1.
    const first = kamin(page, { ui: 'new', lang })
    await first.home()
    await measure('home', first)
    await first.openUpload()
    await measure('upload', first)
    // With the approved synthetic example (set-up, not counted): every other view from Home.
    await first.sample()
    for (const [view, route] of Object.entries(NEW_ROUTES)) {
      const app = kamin(page, { ui: 'new', lang })
      await app.home()
      await route(app)
      await measure(view, app)
    }
    results[`new-interface.${lang}`] = measured
    await info.attach(`new-interface.${lang}.json`, { body: JSON.stringify(measured), contentType: 'application/json' })
    const screens = NEW.screens[info.project.name][lang]
    for (const view of NEW_APP_VIEWS) {
      const m = measured[view]
      expect.soft(m.screens, `${view} (${lang}) is ${m.screens} screens long (${m.scrollHeight}px in a ${m.clientHeight}px window). Budget: ${screens[view]} screens, plus the allowance.`).toBeLessThanOrEqual(screensAllowed(screens[view]))
      expect.soft(m.choices, `${view} (${lang}): visible controls`).toBeLessThanOrEqual(NEW.choices[view])
      expect.soft(m.clicks, `${view} (${lang}) from Home: ${m.route.join(' → ') || 'no click'}`).toBeLessThanOrEqual(NEW.clicks[view])
    }
  })
})

test.afterAll(async ({}, info) => { writeResults(info.project.name, results) })
