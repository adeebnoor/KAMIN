// Task 20 · the app remembers where you are: Back, refresh and links (?app=<view>).
// Runs on the desktop and phone projects. e2e/page-length.spec.js (Task 30) checks Back in Arabic as well.
import { test, expect } from './fixtures.js'
import AxeBuilder from '@axe-core/playwright'
import { TABS, pageName, sectionOf } from '../src/navigation.js'
import { APP_VIEWS, approveSample, loadSample, openAppView, openAppWindow, INSIGHT_CONSENT } from './nav.js'
import { kamin } from './roles.js'

const OPEN = { ar: /افتح مساحة العمل/, en: /Open workspace/ }
const CLOSE = { ar: 'إغلاق', en: 'Close' }
const tabLabel = (view, lang) => Object.values(TABS).flat().find(tab => tab.view === view).labels[lang]
const appParam = page => new URL(page.url()).searchParams.get('app')
const dialog = page => page.getByRole('dialog')

// Like openAppView, but clicks only what changes the view: clicking the tab that is already open is
// not a view change, and focus rightly stays on that tab.
async function goTo(page, view, lang) {
  const section = page.locator(`nav button[data-section="${sectionOf(view)}"]:visible`).first()
  if ((await section.getAttribute('aria-current')) !== 'page') await section.click()
  const tab = TABS[sectionOf(view)]?.find(item => item.view === view)
  if (!tab) return
  const button = page.getByRole('tab', { name: tab.labels[lang], exact: true })
  if ((await button.getAttribute('aria-selected')) !== 'true') await button.click()
}

test('Back walks back through the app views, then closes the window and gives focus back to the opener', async ({ page }) => {
  await page.goto('/en/')
  const opener = page.getByRole('button', { name: OPEN.en }).first()
  await opener.click()
  await expect(dialog(page)).toBeVisible()
  await expect.poll(() => appParam(page)).toBe('start')
  await openAppView(page, 'matches', 'en')
  await expect.poll(() => appParam(page)).toBe('matches')
  await openAppView(page, 'compare', 'en')
  await expect.poll(() => appParam(page)).toBe('compare')

  await page.goBack()
  await expect(page.getByRole('tab', { name: 'Matches', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => appParam(page)).toBe('matches')
  await page.goBack()
  await expect(page.getByTestId('start-more')).toBeVisible()
  await expect.poll(() => appParam(page)).toBe('start')
  await page.goBack()
  await expect(dialog(page)).toHaveCount(0)
  await expect.poll(() => appParam(page)).toBe(null)
  expect(new URL(page.url()).pathname).toBe('/en/')
  await expect(opener).toBeFocused()
})

for (const lang of ['ar', 'en']) test(`a link to ?app=privacy opens My data on "Consent, saving & deletion": ${lang}`, async ({ page }) => {
  await page.goto(`/${lang}/?app=privacy`)
  await expect(dialog(page)).toBeVisible()
  await expect(page.getByRole('tab', { name: tabLabel('privacy', lang), exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('nav button[data-section="my-data"]:visible').first()).toHaveAttribute('aria-current', 'page')
  await expect.poll(() => appParam(page)).toBe('privacy')
  // Opened by a link: the close button keeps focus, as on every first open.
  await expect(page.getByRole('button', { name: CLOSE[lang], exact: true })).toBeFocused()
})

test('unknown values fall back to the default view; a link to the review screen opens the start screen', async ({ page }) => {
  for (const value of ['nonsense', 'review']) {
    await page.goto(`/en/?app=${value}`)
    await expect(page.getByTestId('start-more')).toBeVisible()
    await expect(page.locator('.approval-consent')).toHaveCount(0)
    await expect.poll(() => appParam(page)).toBe('start')
  }
})

test('a view that needs a record opens with its empty state when there is none', async ({ page }) => {
  await page.goto('/en/?app=compare')
  await expect(page.getByRole('tab', { name: 'Compare', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('needs-record')).toBeVisible()
})

test('?start=sample is used once: after approving, a refresh shows the dashboard, not the sample review', async ({ page }) => {
  await page.goto('/en/?start=sample')
  await page.locator('.approval-consent').waitFor()
  expect(new URL(page.url()).searchParams.has('start')).toBe(false)
  await expect.poll(() => appParam(page)).toBe('review')
  await approveSample(page, 'en')
  await expect.poll(() => appParam(page)).toBe('dashboard')
  await page.reload()
  await expect(page.locator('.capability-list')).toBeVisible()
  await expect(page.locator('.approval-consent')).toHaveCount(0)
  expect(page.url()).not.toContain('start=')
  // Never personal data in the URL: only the view id.
  expect([...new URL(page.url()).searchParams.keys()]).toEqual(['app'])
})

test('start=profile and view=knowledge are used once and removed from the URL', async ({ page }) => {
  await page.goto('/en/?start=profile')
  await expect(page.getByRole('checkbox', { name: INSIGHT_CONSENT.en })).toBeVisible()
  expect(new URL(page.url()).searchParams.has('start')).toBe(false)
  await expect.poll(() => appParam(page)).toBe('insight')
  await page.goto('/en/?view=knowledge')
  await expect(page.getByRole('tab', { name: 'SPARQL lab', exact: true })).toBeVisible()
  expect(new URL(page.url()).searchParams.has('view')).toBe(false)
  await expect.poll(() => appParam(page)).toBe('knowledge')
})

test('a refresh keeps the view, and Back still goes to the previous view', async ({ page }) => {
  await openAppWindow(page, 'en')
  await openAppView(page, 'matches', 'en')
  await openAppView(page, 'compare', 'en')
  await expect.poll(() => appParam(page)).toBe('compare')
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Compare', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.goBack()
  await expect(page.getByRole('tab', { name: 'Matches', exact: true })).toHaveAttribute('aria-selected', 'true')
})

for (const how of ['close button', 'Escape']) test(`the ${how} closes the window, removes ?app and leaves no app entry for Back`, async ({ page }) => {
  await page.goto('/en/privacy.html')
  await page.goto('/en/')
  const opener = page.getByRole('button', { name: OPEN.en }).first()
  await opener.click()
  await openAppView(page, 'matches', 'en')
  await openAppView(page, 'compare', 'en')
  await expect.poll(() => appParam(page)).toBe('compare')
  if (how === 'Escape') await page.keyboard.press('Escape')
  else await page.getByRole('button', { name: CLOSE.en, exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect.poll(() => appParam(page)).toBe(null)
  expect(new URL(page.url()).pathname).toBe('/en/')
  await expect(opener).toBeFocused()
  // Back now leaves the landing page for the page before it; it does not reopen the app.
  await page.goBack()
  await expect(page).toHaveURL(/\/en\/privacy(\.html)?$/)
})

for (const lang of ['ar', 'en']) test(`after a view change focus is on the page heading and the page name is read out: ${lang}`, async ({ page }) => {
  await openAppWindow(page, lang)
  const announce = page.getByTestId('view-announcement')
  await expect(page.getByRole('button', { name: CLOSE[lang], exact: true })).toBeFocused()
  await expect(announce).toHaveText('')
  for (const view of ['privacy', 'audit', 'matches']) {
    await goTo(page, view, lang)
    await expect(page.locator('.app-content h2').first()).toBeFocused()
    await expect(announce).toHaveText(pageName(view, lang))
  }
  // Back is a view change too.
  await page.goBack()
  await expect(page.locator('.app-content h2').first()).toBeFocused()
  await expect(announce).toHaveText(pageName('audit', lang))
  const report = await new AxeBuilder({ page }).include('.app-overlay').analyze()
  expect(report.violations.filter(v => ['serious', 'critical'].includes(v.impact)), JSON.stringify(report.violations)).toEqual([])
})

test('every app view has a page heading that takes focus after the change (approved sample)', async ({ page }) => {
  test.setTimeout(90_000)
  await openAppWindow(page, 'ar')
  await loadSample(page, 'ar')
  await approveSample(page, 'ar')
  for (const view of APP_VIEWS.slice(3)) {
    await goTo(page, view, 'ar')
    await expect(page.locator('.app-content h2').first(), view).toBeFocused()
    await expect(page.getByTestId('view-announcement')).toHaveText(pageName(view, 'ar'))
    await expect.poll(() => appParam(page)).toBe(view)
  }
})

test('arrow keys in the tab list keep focus on the tabs (the tab pattern), and still add history', async ({ page }) => {
  await openAppWindow(page, 'en')
  await openAppView(page, 'matches', 'en')
  await page.getByRole('tab', { name: 'Matches', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  const courses = page.getByRole('tab', { name: 'Courses', exact: true })
  await expect(courses).toHaveAttribute('aria-selected', 'true')
  await expect(courses).toBeFocused()
  await expect.poll(() => appParam(page)).toBe('courses')
  await page.goBack()
  await expect(page.getByRole('tab', { name: 'Matches', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test('pilot mode keeps pilot=1 in the URL next to app', async ({ page }) => {
  await page.goto('/en/?pilot=1')
  const consent = page.getByRole('dialog', { name: 'Taking part in the Kamin trial' })
  await consent.getByRole('checkbox', { name: /agree to take part/ }).check()
  await consent.getByRole('button', { name: 'Start the session' }).click()
  await expect(page.getByTestId('pilot-bar')).toBeVisible()
  await openAppView(page, 'privacy', 'en')
  await expect.poll(() => appParam(page)).toBe('privacy')
  expect(new URL(page.url()).searchParams.get('pilot')).toBe('1')
  await page.goBack()
  await expect.poll(() => new URL(page.url()).searchParams.get('pilot')).toBe('1')
  await expect(page.getByTestId('pilot-bar')).toBeVisible()
})

// ---------- Task 69 · the same old addresses on the new interface, now the default ----------
// Every address the tests above open (and every old view id of src/navigation.js, with Task 27's #section) lands on
// the nearest view of the new interface, with the Settings section or Help tool that holds what the old view showed
// (src/ui2/views.js, OLD_VIEW_ADDRESSES). Entry links are read once and leave the address; only the view id and the
// section stay in it.
const OLD_ADDRESSES = [
  // [old address, new view, section in the address (#…) or null]
  ['', 'home', null],
  ['?app=start', 'upload', null],
  ['?app=review', 'upload', null],
  ['?app=nonsense', 'home', null],
  ['?app=dashboard', 'profile', null],
  ['?app=skills', 'profile', null],
  ['?app=matches', 'next', null],
  ['?app=courses', 'next', null],
  ['?app=compare', 'plan', null],
  ['?app=studio', 'plan', null],
  ['?app=insight', 'interests', null],
  ['?app=mydata', 'settings', 'courses'],
  ['?app=privacy', 'settings', null],
  ['?app=privacy#permissions', 'settings', 'consents'],
  ['?app=privacy#save', 'settings', null],
  ['?app=privacy#backup', 'settings', 'backup'],
  ['?app=privacy#share', 'settings', 'share'],
  ['?app=privacy#delete', 'settings', 'delete'],
  ['?app=audit', 'settings', 'log'],
  ['?app=knowledge', 'help', 'knowledge'],
  ['?app=home', 'home', null],
  ['?app=next', 'next', null],
  ['?app=my-data', 'settings', null],
  ['?start=profile', 'interests', null],
  ['?view=knowledge', 'help', 'knowledge'],
]

test.describe('Task 69 · old addresses on the new interface (the default)', () => {
  test.use({ kaminUi: 'new' })

  test('the table covers every old view id', () => {
    const covered = new Set(OLD_ADDRESSES.map(([address]) => new URLSearchParams(address.split('#')[0]).get('app')).filter(Boolean))
    for (const view of [...APP_VIEWS, 'skills', 'knowledge']) expect(covered.has(view), `?app=${view} is in the table`).toBe(true)
  })

  for (const lang of ['ar', 'en']) test(`every old address lands on a sensible view: ${lang}`, async ({ page }) => {
    test.setTimeout(120_000)
    const app = kamin(page, { ui: 'new', lang })
    for (const [address, view, section] of OLD_ADDRESSES) {
      await page.goto(`/${lang}/${address}`)
      await expect(app.heading(view), `${address || '/'} opens ${view}`).toBeVisible()
      if (view === 'settings' && section) await expect(app.sectionHeading(section), `${address} opens Settings → ${section}`).toBeVisible()
      if (view === 'help' && section) await expect(app.knowledgeExplorer(), `${address} opens the knowledge explorer`).toBeVisible()
      const url = new URL(page.url())
      expect(url.pathname).toBe(`/${lang}/`)
      // The entry links are gone; only the view id (and its section) is in the address.
      await expect.poll(() => [...new URL(page.url()).searchParams.entries()].map(pair => pair.join('=')), address || '/').toEqual([`app=${view}`])
      expect(url.hash, `${address}: the section in the address`).toBe(section ? `#${section}` : '')
    }
  })

  test('?start=sample opens step 1 with the synthetic example, once; ?pilot=1 opens the trial consent and stays next to app', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang: 'en' })
    await page.goto('/en/?start=sample')
    await expect(app.resultLine()).toBeVisible()
    await expect.poll(() => appParam(page)).toBe('upload')
    expect(new URL(page.url()).searchParams.has('start')).toBe(false)
    await page.reload()
    await expect(app.heading('upload')).toBeVisible()
    await page.goto('/en/?pilot=1')
    await expect(app.pilotConsent()).toBeVisible()
    await app.joinPilot()
    await expect(app.pilotBar()).toBeVisible()
    await app.tab('plan')
    await expect.poll(() => appParam(page)).toBe('plan')
    expect(new URL(page.url()).searchParams.get('pilot')).toBe('1')
  })

  test('a public page and Back: /en/privacy.html, then /en/ opens the new Home and Back returns to the page', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang: 'en' })
    await page.goto('/en/privacy.html')
    await page.goto('/en/')
    await expect(app.heading('home')).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/en\/privacy(\.html)?$/)
  })
})
