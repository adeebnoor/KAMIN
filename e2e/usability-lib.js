// Task 15 · counting helpers for the usability journeys (shared by the current spec and the
// baseline spec in docs/usability/). Each journey starts with the app already open and counts
// every click (including checkboxes and confirmations), every typed input, the distinct screens
// passed through, and how many controls the student sees when the journey starts.
import { mkdirSync, readFileSync, rmdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export class Journey {
  constructor(page, id) { Object.assign(this, { page, id, clicks: 0, inputs: 0, screens: new Set(), steps: [] }) }
  async screen() {
    this.screens.add(await this.page.evaluate(() => {
      const visible = el => !!el && el.getClientRects().length > 0
      const tab = [...document.querySelectorAll('.app-overlay [role=tab][aria-selected=true]')].find(visible)
      const h = [...document.querySelectorAll('.app-overlay .app-content-wrap h2, .app-overlay h2')].find(visible)
      return `${tab ? tab.textContent.trim() + ' | ' : ''}${h ? h.textContent.trim() : ''}`
    }))
  }
  async start() { await this.screen(); this.choicesAtStart = await visibleChoices(this.page) }
  async click(locator, label) { await locator.click(); return this.after(label) }
  async check(locator, label) { await locator.check(); return this.after(label) }
  async uncheck(locator, label) { await locator.uncheck(); return this.after(label) }
  async fill(locator, value, label) { await locator.fill(value); this.inputs++; this.steps.push(`type: ${label}`) }
  async after(label) { this.clicks++; this.steps.push(label); await this.page.waitForTimeout(60); await this.screen() }
  result() { return { clicks: this.clicks, inputs: this.inputs, screens: this.screens.size, choicesAtStart: this.choicesAtStart ?? null, steps: this.steps } }
}

// Controls a student can act on inside the app window right now.
export const visibleChoices = page => page.evaluate(() => [...document.querySelectorAll('.app-overlay button, .app-overlay a[href], .app-overlay input:not([type=hidden]):not([type=file]), .app-overlay select, .app-overlay summary')]
  .filter(el => el.getClientRects().length > 0 && !el.closest('details:not([open]) > :not(summary)')).length)

// Task 45 · the same two numbers for Home (the landing page, app window closed): controls in the whole
// document, and its length in screens (the page scrolls, not an app content area).
export const visibleDocumentChoices = page => page.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]):not([type=file]), select, summary')]
  .filter(el => el.getClientRects().length > 0 && !el.closest('details:not([open]) > :not(summary)')).length)
export const documentLength = page => page.evaluate(() => {
  const scroller = document.scrollingElement || document.documentElement
  return { screens: Math.round(scroller.scrollHeight / innerHeight * 10) / 10, scrollHeight: scroller.scrollHeight, clientHeight: innerHeight }
})

// Task 69 · wait until the whole document stops growing (fonts loaded, lazy screens rendered): the new interface is
// a full page, so its length is the document's (e2e/nav.js settle() waits on the old app window's content area).
export const settleDocument = page => page.evaluate(async () => {
  await document.fonts.ready
  const scroller = document.scrollingElement || document.documentElement
  for (let i = 0, last = -1, same = 0; i < 40 && same < 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 100))
    same = scroller.scrollHeight === last ? same + 1 : 0
    last = scroller.scrollHeight
  }
})

// ---------- Task 30 · page length, sideways scroll, cut-off text, covered heading ----------
// These read the page as the student sees it now; none of them changes it.

// How many screens long the open app view is: the height of everything in the scrolling area
// divided by the height the student sees at once.
export const pageLength = page => page.evaluate(() => {
  const wrap = document.querySelector('.app-content-wrap')
  if (!wrap) return null
  return { screens: Math.round(wrap.scrollHeight / wrap.clientHeight * 10) / 10, scrollHeight: wrap.scrollHeight, clientHeight: wrap.clientHeight }
})

// Elements inside the app view whose content is wider than their box: they scroll sideways or
// cut their content. `data-scroll-x` marks sideways scroll that was chosen on purpose. Form
// fields are left to cutOffInputs. Inline, hidden and screen-reader-only elements have no box
// to overflow.
// Task 70: `root` is the page's content box: the old app's .app-content-wrap by default, the interface's .ui2-main.
export const sidewaysScroll = (page, root = '.app-content-wrap') => page.evaluate(root => {
  const wrap = document.querySelector(root)
  if (!wrap) return null
  const name = el => el.tagName.toLowerCase() + (el.dataset.testid ? `[data-testid="${el.dataset.testid}"]` : [...el.classList].map(c => '.' + c).join(''))
  return [wrap, ...wrap.querySelectorAll('*')]
    .filter(el => el instanceof HTMLElement && !el.matches('input, textarea, select') && !el.closest('[data-scroll-x]')
      && el.getClientRects().length > 0 && el.clientWidth > 1 && el.scrollWidth > el.clientWidth + 1)
    .map(el => `${name(el)} ${el.scrollWidth}>${el.clientWidth}`)
}, root)

// Text fields that show only part of what is in them (a long course name in a narrow box).
export const cutOffInputs = (page, root = '.app-content-wrap') => page.evaluate(root => [...document.querySelectorAll(`${root} input, ${root} textarea`)]
  .filter(el => el.getClientRects().length > 0 && ['text', 'search', 'email', 'url', 'tel', 'number', 'textarea'].includes(el.type) && el.scrollWidth > el.clientWidth)
  .map(el => `${el.getAttribute('aria-label') || el.name || el.type} ${el.scrollWidth}>${el.clientWidth}`), root)

// Visible messages (role=status / role=alert) in the app window that lie on top of the page
// heading. An empty list means nothing covers it.
export const messagesOverHeading = page => page.evaluate(() => {
  const visible = el => el.getClientRects().length > 0
  const heading = [...document.querySelectorAll('.app-overlay .app-content-wrap h2')].find(visible)
  if (!heading) return null
  const h = heading.getBoundingClientRect()
  return [...document.querySelectorAll('.app-overlay [role=status], .app-overlay [role=alert]')].filter(visible).flatMap(el => {
    const m = el.getBoundingClientRect()
    const width = Math.min(m.right, h.right) - Math.max(m.left, h.left), height = Math.min(m.bottom, h.bottom) - Math.max(m.top, h.top)
    return width > 0 && height > 0 ? [`${[...el.classList].map(c => '.' + c).join('') || el.tagName.toLowerCase()} covers ${Math.round(width)}x${Math.round(height)}px of the heading`] : []
  })
})

// A page-length budget has a small allowance, because the same page comes out a few pixels
// longer or shorter with another machine's fonts: 3% of the budget, never less than a tenth of
// a screen.
export const screensAllowed = budget => Math.round((budget + Math.max(0.1, budget * 0.03)) * 10) / 10

// Merge this project's numbers into test-results/usability.json (one key per browser project).
// Task 30: more than one spec file writes here, sometimes at the same moment from two workers,
// so the file is locked while it is read and rewritten, and keys from another spec are kept.
export function writeResults(project, results, file = 'test-results/usability.json') {
  mkdirSync(path.dirname(file), { recursive: true })
  const lock = `${file}.lock`
  const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
  for (let attempt = 0; attempt < 100; attempt++) { try { mkdirSync(lock); break } catch { pause(50) } }
  try {
    let all = {}
    try { all = JSON.parse(readFileSync(file, 'utf8')) } catch {}
    all[project] = { ...all[project], ...results }
    writeFileSync(file, JSON.stringify(all, null, 2) + '\n')
  } finally { try { rmdirSync(lock) } catch {} }
}
