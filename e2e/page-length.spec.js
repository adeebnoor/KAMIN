import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { cutOffInputs, screensAllowed, writeResults, documentLength, visibleDocumentChoices, settleDocument } from './usability-lib.js'
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
// Task 69 walked the old interface until Task 70 deleted it; the interface's views are measured below against their
// own budgets.
const BUDGET = JSON.parse(readFileSync(new URL('./usability-budget.json', import.meta.url), 'utf8'))
const LANGS = ['ar', 'en']
const results = {}

// Task 70: the old interface's walks (its page-length budgets, its Back test and its dashboard heading) are deleted with it;
// mapped in log/task-70.md. Its two layout rules run on every view of the interface below: at 360px no element of the
// page is wider than its box (a region that scrolls on purpose is marked and reachable by keyboard: data-scroll-x, or
// role="region" with tabindex="0") and no text field cuts its text; after approval no message lies on top of the
// page heading.
const allViews = async (app, visit) => {
  await app.home(); await visit('home')
  await app.goToView('upload'); await visit('upload')
  await app.sample()
  for (const view of NEW_APP_VIEWS.filter(v => !['home', 'upload'].includes(v))) { await app.goToView(view); await visit(view) }
}
const contentWider = page => page.evaluate(() => {
  const root = document.querySelector('.ui2-main')
  if (!root) return null
  const name = el => el.tagName.toLowerCase() + (el.dataset.testid ? `[data-testid="${el.dataset.testid}"]` : [...el.classList].map(c => '.' + c).join(''))
  return [root, ...root.querySelectorAll('*')]
    .filter(el => el instanceof HTMLElement && !el.matches('input, textarea, select') && !el.closest('[data-scroll-x], [role=region][tabindex="0"]')
      && el.getClientRects().length > 0 && el.clientWidth > 1 && el.scrollWidth > el.clientWidth + 1)
    .map(el => `${name(el)} ${el.scrollWidth}>${el.clientWidth}`)
})

test.describe('on a 360px screen', () => {
  test.use({ viewport: { width: 360, height: 740 } })
  for (const lang of LANGS) test(`360px: nothing scrolls sideways and no text field cuts its text, on every view (${lang})`, async ({ page }, info) => {
    test.setTimeout(120_000)
    const sideways = {}, cut = {}
    const app = kamin(page, { ui: 'new', lang })
    await allViews(app, async view => { await settleDocument(page); sideways[view] = await contentWider(page); cut[view] = await cutOffInputs(page, '.ui2-main') })
    results[`sideways-scroll-360.${lang}`] = sideways
    results[`cut-off-inputs-360.${lang}`] = cut
    await info.attach(`layout-360.${lang}.json`, { body: JSON.stringify({ sideways, cut }), contentType: 'application/json' })
    for (const view of NEW_APP_VIEWS) {
      expect.soft(sideways[view], `${view} (${lang}) has content wider than its box`).toEqual([])
      expect.soft(cut[view], `${view} (${lang}) has text fields that cut their text`).toEqual([])
    }
  })
})

for (const lang of LANGS) test(`after approval no message covers the page heading (${lang})`, async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang })
  await page.goto(`/${lang}/?start=sample`)
  await app.approve()
  await expect(app.heading('projects')).toBeVisible()
  const covering = await page.evaluate(() => {
    const h = document.querySelector('#ui2-page-title').getBoundingClientRect()
    return [...document.querySelectorAll('.ui2 [role=status], .ui2 [role=alert]')].filter(el => el.getClientRects().length > 0).flatMap(el => {
      const m = el.getBoundingClientRect()
      const width = Math.min(m.right, h.right) - Math.max(m.left, h.left), height = Math.min(m.bottom, h.bottom) - Math.max(m.top, h.top)
      return width > 0 && height > 0 ? [`${el.className || el.tagName} covers ${Math.round(width)}x${Math.round(height)}px of the heading`] : []
    })
  })
  results[`message-covers-heading.${lang}`] = covering
  expect(covering, 'a message lies on top of the page heading').toEqual([])
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
