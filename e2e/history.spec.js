// Task 20 · the app remembers where you are: Back, refresh and links (?app=<view>). Task 70: the old interface's window
// (opened over the landing page, closed with × or Escape, its tab list and its page-name announcer) is deleted, and so
// are its tests; Back, Forward, a refresh, a link and the heading's focus on the interface are e2e/next-shell.spec.js's
// and keep-test K32's (mapping in log/task-70.md). What stays: every old address still lands on the nearest view.
import { test, expect } from '@playwright/test'
import { kamin } from './roles.js'

// The old interface's view ids (its src/navigation.js, deleted in Task 70), which old links and bookmarks still carry.
const appParam = page => new URL(page.url()).searchParams.get('app')
const APP_VIEWS = ['start', 'review', 'dashboard', 'matches', 'courses', 'compare', 'studio', 'insight', 'mydata', 'privacy', 'audit']

// ---------- Task 69 · the same old addresses on the new interface, now the default ----------
// Every address the old tests opened (and every old view id of the old src/navigation.js, with Task 27's #section) lands on
// the nearest view of the new interface, with the Settings section or Help tool that holds what the old view showed
// (src/ui2/views.js, OLD_VIEW_ADDRESSES). Entry links are read once and leave the address; only the view id and the
// section stay in it. The table is in log/task-69.md.
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
