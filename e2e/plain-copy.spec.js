import { test, expect } from '@playwright/test'
import { settle } from './nav.js'
import { TECHNICAL_TERMS, jargonIn } from '../src/content/plainTerms.js'
import { kamin } from './roles.js'

// Tasks 12 and 28: the screens show no developer terms outside a "Technical details" block. Every <details> that is not
// "Technical details" is opened first, so what a student can reach in one click is checked too; only text inside
// .tech-details may use the words. Task 70: rewritten on the interface: every view before a record, step 1 with the
// example, then every view with the approved example, My map and every Settings section. (The old screens' own checks,
// e.g. the interests page's icon row and Matches' rows, are mapped in log/task-70.md.)

async function plainText(page, { open = true, skip = [] } = {}) {
  await settle(page)
  return page.evaluate(({ open, skip }) => {
    const root = document.querySelector('.ui2-main')
    if (open) root.querySelectorAll('details:not(.tech-details)').forEach(d => { d.open = true })
    const clone = root.cloneNode(true)
    if (!open) clone.querySelectorAll('details:not([open])').forEach(d => { [...d.children].filter(c => c.tagName !== 'SUMMARY').forEach(c => c.remove()) })
    clone.querySelectorAll(['.tech-details', ...skip].join(',')).forEach(el => el.remove())
    clone.style.position = 'absolute'; document.body.appendChild(clone)
    const text = clone.innerText; clone.remove(); return text
  }, { open, skip })
}
// Task 76 (team decision 2026-11-21): no exceptions any more. Settings' "Export (CLR JSON)" row is "Download my
// capabilities file", the delete list names "this browser's storage" (the browser's technical names are in its
// "Technical details"), and the consents' note says "guessing your personality", so every Settings section is read
// like every other screen: each closed <details> that is not "Technical details" opened, the delete confirmation's
// list included.
async function expectNoJargon(page, label, options) {
  const text = await plainText(page, options)
  expect(text.length, `${label}: read some text`).toBeGreaterThan(20)
  const found = text.split('\n').flatMap(line => [...jargonIn(line), ...TECHNICAL_TERMS.filter(term => line.includes(term))].map(term => `"${term}" in: ${line.trim().slice(0, 160)}`))
  expect(found, label).toEqual([])
}
const SETTINGS = ['courses', 'backup', 'share', 'export', 'consents', 'delete', 'log']

for (const lang of ['ar', 'en']) test(`${lang}: every screen speaks plainly; technical terms only inside "Technical details"`, async ({ page }) => {
  test.setTimeout(150_000)
  const app = kamin(page, { ui: 'new', lang })
  // Before a record.
  for (const view of ['home', 'upload', 'projects', 'interests', 'next', 'plan', 'profile', 'settings', 'help']) {
    await app.goToView(view)
    await expectNoJargon(page, `${view} (no record)`)
  }
  // Step 1 with the example, before approval (the Fix sheet is read too).
  await page.goto(`/${lang}/?start=sample`)
  await expect(app.resultLine()).toBeVisible()
  await expectNoJargon(page, 'step 1 with the example')
  await app.reviewConsent().check()
  await app.approveButton().click()
  await expect(app.approvedView()).toBeVisible()
  await app.walkViews(async view => expectNoJargon(page, view))
  await app.openMap()
  await expectNoJargon(page, 'my map')
  // the technical explanation is still there, one click away
  const technical = app.myMap().locator('.inference-proof .inference-technical')
  await technical.locator(':scope > summary').click()
  await expect(technical).toContainText(/R\d · kamin-relations-v\d/)
  for (const section of SETTINGS) {
    await page.goto(`/${lang}/?app=settings#${section}`)
    await expect(app.sectionHeading(section)).toBeVisible()
    await expectNoJargon(page, `settings: ${section}`)
  }
})
