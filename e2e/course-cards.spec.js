// Task 24 · clear course cards in My next step → Courses. Runs on the desktop and phone projects.
import { test, expect } from './fixtures.js'
import AxeBuilder from '@axe-core/playwright'
import { copy, fill } from '../src/i18n.js'
import { approveSample, loadSample, openAppView, openAppWindow } from './nav.js'

const C = { ar: copy.ar.screens.courses, en: copy.en.screens.courses }
const A = { ar: copy.ar.app, en: copy.en.app }
const S = { ar: copy.ar.screens.matches, en: copy.en.screens.matches }
const RANK = { yes: 0, conditional: 1, no: 2 }
const cards = page => page.locator('.course-card')

async function courses(page, lang) {
  await openAppWindow(page, lang)
  await loadSample(page, lang)
  await approveSample(page, lang)
  await openAppView(page, 'courses', lang)
  await expect(cards(page).first()).toBeVisible()
}

for (const lang of ['ar', 'en']) {
  test(`390x844: title and one sentence, the first card on the first screen, the rule said once, no percentage: ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await courses(page, lang)
    await expect(page.locator('.app-content h2')).toHaveText(C[lang].title)
    await expect(page.locator('.course-cards > .app-title > p')).toHaveText(C[lang].intro)
    const first = await page.evaluate(() => {
      const wrap = document.querySelector('.app-content-wrap').getBoundingClientRect(), title = document.querySelector('.course-card h3').getBoundingClientRect()
      return title.top >= wrap.top && title.bottom <= wrap.bottom
    })
    expect(first, 'the first course title is visible without scrolling').toBe(true)
    await expect(page.getByTestId('course-rule')).toContainText(C[lang].rule)
    const text = await page.locator('.app-content').textContent()
    expect((text.match(/percentage hidden|percentage is hidden|النسبة مخفية/g) || []).length).toBeLessThanOrEqual(1)
    await expect(page.locator('.fit-score')).toHaveCount(0)
    await expect(page.locator('.app-content')).not.toContainText(/\d+\s*%/)
    // One goal control (the chips), no separate <select>.
    await expect(page.locator('.app-content select[aria-label]')).toHaveCount(0)
    await expect(page.getByTestId('course-goal').locator('.goal-options button')).toHaveCount(4)
  })

  test(`cards are ordered fits → conditional → not yet; "not for now" is behind one button: ${lang}`, async ({ page }) => {
    await courses(page, lang)
    // The synthetic profile without a goal: one course with conditions, four not for now.
    await expect(page.locator('.course-card:visible')).toHaveCount(1)
    const toggle = page.getByRole('button', { name: fill(C[lang].showLater, { n: 4 }) })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(page.locator('.course-card:visible')).toHaveCount(5)
    const statuses = await cards(page).evaluateAll(list => list.map(c => [...c.classList].find(x => x.startsWith('status-')).slice(7)))
    expect(statuses).toEqual([...statuses].sort((a, b) => RANK[a] - RANK[b]))
    await expect(page.locator('.course-group-later .course-card .status').first()).toHaveText(A[lang].fit.no)
  })

  test(`a card: provider, title, judgment, "Closes", duration · cost · Illustrative, one reason; Details holds the rest: ${lang}`, async ({ page }) => {
    await courses(page, lang)
    const card = page.locator('[data-course-id="cyber-foundations"]')
    await expect(card.locator('.fit-head small')).toHaveText(C[lang].noProvider)
    await expect(card.locator('.status')).toHaveText(A[lang].fit.conditional)
    await expect(card.getByTestId('course-closes')).toHaveText(fill(C[lang].closes, { gap: lang === 'ar' ? 'أساسيات الأمن السيبراني' : 'Cybersecurity fundamentals' }))
    await expect(card.locator('.course-tag')).toHaveText(C[lang].illustrative)
    await expect(card.getByTestId('course-why')).not.toBeEmpty()
    const details = card.getByRole('button', { name: C[lang].details })
    await expect(card.locator('.course-details')).toBeHidden()
    await details.click()
    await expect(details).toHaveAttribute('aria-expanded', 'true')
    await expect(card.locator('.course-details')).toContainText(A[lang].becomes)
    await expect(card.getByRole('button', { name: lang === 'ar' ? 'أعترض على هذا الحكم' : 'Contest this judgment', exact: true })).toBeVisible()
    const result = await new AxeBuilder({ page }).include('.course-cards').analyze()
    expect(result.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([])
  })

  test(`one goal: a chip chosen on Courses shows on the dashboard, Matches and Interests & goal at once: ${lang}`, async ({ page }) => {
    await courses(page, lang)
    await page.getByTestId('course-goal').getByRole('button', { name: A[lang].goals.data }).click()
    await expect(page.getByTestId('course-goal')).toContainText(fill(S[lang].goalCurrent, { goal: A[lang].goals.data }))
    await openAppView(page, 'matches', lang)
    await expect(page.getByTestId('match-goal')).toContainText(fill(S[lang].goalCurrent, { goal: A[lang].goals.data }))
    await openAppView(page, 'dashboard', lang)
    await expect(page.getByTestId('next-step-card').getByRole('button', { name: A[lang].goals.data })).toHaveAttribute('aria-pressed', 'true')
    await openAppView(page, 'insight', lang)
    await page.locator('.insight-consent input[type=checkbox]').check()
    await page.getByRole('button', { name: lang === 'ar' ? 'ابدأ بصمتي' : 'Start my profile' }).click()
    await expect(page.locator('input[name="goal"][value="data"]')).toBeChecked()
  })

  test(`the learning path starts as one line with its "planned" label and opens unchanged: ${lang}`, async ({ page }) => {
    await courses(page, lang)
    const path = page.getByTestId('learning-path')
    await expect(path.getByTestId('path-planned')).toBeVisible()
    await expect(path.getByTestId('path-summary')).toBeVisible()
    await expect(path.getByTestId('path-field')).toBeHidden()
    await page.getByTestId('learning-path-details').locator(':scope > summary').click()
    await expect(path.getByTestId('path-field')).toBeVisible()
    await expect(path.getByTestId('path-gap')).toBeVisible()
  })

  test(`"Add to compare" on cards, the sticky "Compare (n)" opens the Compare tab; at most three: ${lang}`, async ({ page }) => {
    await courses(page, lang)
    await expect(page.getByTestId('open-course-compare')).toHaveCount(0)
    await page.getByRole('button', { name: fill(C[lang].showLater, { n: 4 }) }).click()
    for (const id of ['cyber-foundations', 'sql', 'ba']) await page.locator(`[data-course-id="${id}"]`).getByRole('button', { name: C[lang].addCompare }).click()
    await expect(page.locator('[data-course-id="capm"]').locator('.compare-button')).toBeDisabled()
    await expect(page.locator('[data-course-id="sql"]').locator('.compare-button')).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('open-course-compare').click()
    await expect(page.getByRole('tab', { name: A[lang].compare, exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.compare-courses .compare-table thead th')).toHaveCount(4)
  })
}
