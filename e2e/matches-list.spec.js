// Task 23 · My next step → Matches as a short list you can scan. Runs on the desktop and phone projects.
import { test, expect } from './fixtures.js'
import AxeBuilder from '@axe-core/playwright'
import { copy, fill } from '../src/i18n.js'
import { approveSample, loadSample, openAppView, openAppWindow, openMatch } from './nav.js'
import { visibleChoices } from './usability-lib.js'

const S = { ar: copy.ar.screens.matches, en: copy.en.screens.matches }
const GOALS = { ar: copy.ar.app.goals, en: copy.en.app.goals }
const rows = page => page.locator('.match-row:visible')
const group = (page, id) => page.locator(`[data-group="${id}"]`)
const screens = page => page.locator('.app-content-wrap').evaluate(el => ({ screens: el.scrollHeight / el.clientHeight, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }))

async function matches(page, lang) {
  await openAppWindow(page, lang)
  await loadSample(page, lang)
  await approveSample(page, lang)
  await openAppView(page, 'matches', lang)
  await expect(page.locator('.match-row').first()).toBeVisible()
}

for (const lang of ['ar', 'en']) {
  for (const [width, height, limit] of [[1366, 768, 2.5], [390, 844, 4]]) {
    test(`${width}x${height}: short page, few controls, the first row on the first screen, no percentage: ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await matches(page, lang)
      const m = await screens(page)
      test.info().annotations.push({ type: 'matches-length', description: `${lang} ${width}x${height}: ${m.scrollHeight}/${m.clientHeight}px = ${m.screens.toFixed(2)} screens` })
      expect(m.screens, `${m.scrollHeight}px in a ${m.clientHeight}px window`).toBeLessThanOrEqual(limit)
      expect(await visibleChoices(page)).toBeLessThanOrEqual(30)
      const first = await page.evaluate(() => {
        const wrap = document.querySelector('.app-content-wrap').getBoundingClientRect(), row = document.querySelector('.match-row').getBoundingClientRect()
        return row.top >= wrap.top && row.bottom <= wrap.bottom
      })
      expect(first, 'the first pathway row is visible without scrolling').toBe(true)
      await expect(page.locator('.app-content')).not.toContainText(/\d+\s*%/)
    })
  }

  test(`three groups in order, three rows each then "Show N more", one specific reason per row: ${lang}`, async ({ page }) => {
    await matches(page, lang)
    // The synthetic profile without a goal: 14 fit, 5 fit with conditions, none "not for now".
    expect(await page.locator('[data-group]').evaluateAll(sections => sections.map(s => s.dataset.group))).toEqual(['fits', 'conditional'])
    await expect(group(page, 'fits').locator('h3')).toHaveText(`${S[lang].groups.fits} (14)`)
    await expect(group(page, 'conditional').locator('h3')).toHaveText(`${S[lang].groups.conditional} (5)`)
    await expect(group(page, 'fits').locator('.match-row:visible')).toHaveCount(3)
    // Jobs before training inside a group.
    expect(await group(page, 'fits').locator('.match-row .match-type').allTextContents()).toEqual([...Array(4).fill(S[lang].type.job), ...Array(10).fill(S[lang].type.training)])
    await group(page, 'fits').getByRole('button', { name: fill(S[lang].showMore, { n: 11 }) }).click()
    await expect(group(page, 'fits').locator('.match-row:visible')).toHaveCount(14)
    // Reasons are specific: a missing capability for conditional rows, the supporting course for others.
    const reasons = await page.locator('.match-row:visible .match-reason').allTextContents()
    expect(new Set(reasons).size).toBeGreaterThan(5)
    await expect(page.locator('[data-match-id="job-cyber-analyst"] .match-reason')).toHaveText(fill(S[lang].reasonMissing, { skill: lang === 'ar' ? 'أساسيات الأمن السيبراني' : 'Cybersecurity fundamentals' }))
    await expect(page.locator('[data-match-id="job-data-analyst"] .match-reason')).toContainText('CPIT-240')
    await expect(page.locator('[data-match-id="training-ai-work"] .match-reason')).toHaveText(S[lang].reasonNoPrerequisite)
    // The opportunity note is one line at the bottom, after the groups.
    expect(await page.locator('.match-list').evaluate(el => [...el.children].map(c => c.dataset.testid || c.dataset.group || c.className).indexOf('opportunity-status') > [...el.children].findIndex(c => c.dataset.group === 'conditional'))).toBe(true)
  })

  test(`goal first: chips, then "Your goal · Change"; outside-goal pathways go to "Not for now", collapsed: ${lang}`, async ({ page }) => {
    await matches(page, lang)
    const goal = page.getByTestId('match-goal')
    await expect(goal.getByRole('button')).toHaveCount(4)
    await goal.getByRole('button', { name: GOALS[lang].data }).click()
    await expect(goal).toContainText(fill(S[lang].goalCurrent, { goal: GOALS[lang].data }))
    const later = group(page, 'later')
    const toggle = later.getByRole('button', { name: new RegExp(S[lang].groups.later) })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(later.locator('.match-row:visible')).toHaveCount(0)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(later.locator('.match-row:visible').first().locator('.match-reason')).toHaveText(S[lang].reasonOutside)
    await expect(later.locator('.match-row:visible').first().locator('.status')).toHaveText(lang === 'ar' ? 'استكشافي' : 'Exploratory')
    // Change shows the chips again, with the current goal pressed.
    await goal.getByRole('button', { name: S[lang].changeGoal }).click()
    await expect(page.getByTestId('match-goal').getByRole('button', { name: GOALS[lang].data })).toHaveAttribute('aria-pressed', 'true')
  })

  test(`a row opens in place (one at a time) with the full explanation, sources, plan and Review / Contest: ${lang}`, async ({ page }) => {
    await matches(page, lang)
    const data = page.locator('[data-match-id="job-data-analyst"]'), coordinator = page.locator('[data-match-id="job-project-coordinator"]')
    await expect(data.locator('.match-row-panel')).toBeHidden()
    await data.locator('.match-toggle').click()
    await expect(data.locator('.match-toggle')).toHaveAttribute('aria-expanded', 'true')
    const panel = data.locator('.match-row-panel')
    await expect(panel.getByTestId('match-evidence')).toBeVisible()
    // Task 28: plain heading (was "Evidence paths in the graph").
    await expect(panel).toContainText(lang === 'ar' ? 'كيف تقود مقرراتك إلى هنا' : 'How your courses lead here')
    await expect(panel).toContainText('STAT-110')
    // Task 28: version, review owner and scope moved under "Technical details", one click away.
    await expect(panel.locator('.match-governance')).toBeHidden()
    await panel.locator('.match-technical > summary').click()
    await expect(panel.locator('.match-governance')).toBeVisible()
    await expect(panel.getByRole('button', { name: lang === 'ar' ? 'افتح خطة هذا المسار' : 'Open this pathway’s plan' })).toBeVisible()
    await expect(panel.getByRole('button', { name: lang === 'ar' ? 'راجع هذا الحكم' : 'Review this judgment', exact: true })).toBeVisible()
    await expect(panel.getByRole('button', { name: lang === 'ar' ? 'أعترض على هذا الحكم' : 'Contest this judgment', exact: true })).toBeVisible()
    // One at a time.
    await coordinator.locator('.match-toggle').click()
    await expect(coordinator.locator('.match-row-panel')).toBeVisible()
    await expect(panel).toBeHidden()
    await expect(data.locator('.match-toggle')).toHaveAttribute('aria-expanded', 'false')
    const result = await new AxeBuilder({ page }).include('.match-list').analyze()
    expect(result.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([])
  })

  test(`"Add to compare" from rows, "Compare (n)" opens the Compare tab with pathways above courses: ${lang}`, async ({ page }) => {
    await matches(page, lang)
    await expect(page.getByTestId('open-compare')).toHaveCount(0)
    for (const id of ['job-data-analyst', 'job-business-analyst']) {
      await openMatch(page, id)
      await page.locator(`[data-match-id="${id}"]`).getByRole('button', { name: S[lang].addCompare }).click()
      await expect(page.locator(`[data-match-id="${id}"]`).getByRole('button', { name: S[lang].inCompare })).toHaveAttribute('aria-pressed', 'true')
    }
    await page.getByTestId('open-compare').click()
    await expect(page.getByRole('tab', { name: lang === 'ar' ? 'المقارنة' : 'Compare', exact: true })).toHaveAttribute('aria-selected', 'true')
    const compare = page.getByTestId('pathway-compare')
    await expect(compare.getByRole('heading', { name: S[lang].comparePathways })).toBeVisible()
    await expect(page.getByRole('heading', { name: S[lang].compareCourses })).toBeVisible()
    await expect(compare.locator('thead th')).toHaveCount(3)
    await expect(compare.locator('thead')).toContainText(lang === 'ar' ? 'محلل بيانات' : 'Data Analyst')
    await expect(compare.locator('thead')).toContainText(lang === 'ar' ? 'محلل أعمال' : 'Business Analyst')
    // At most three: a fourth pathway cannot be added.
    await openAppView(page, 'matches', lang)
    await openMatch(page, 'job-software-engineer')
    await page.locator('[data-match-id="job-software-engineer"]').getByRole('button', { name: S[lang].addCompare }).click()
    await openMatch(page, 'job-project-coordinator')
    await expect(page.locator('[data-match-id="job-project-coordinator"] .match-compare-toggle')).toBeDisabled()
    await expect(page.getByTestId('open-compare')).toHaveText(fill(S[lang].openCompare, { n: 3 }))
  })

  test(`phones at 360px: the four tabs stay on one line and the page does not scroll sideways: ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await matches(page, lang)
    const tabs = await page.locator('.section-tabs').evaluate(bar => ({ lines: new Set([...bar.querySelectorAll('[role=tab]')].map(t => Math.round(t.getBoundingClientRect().top))).size, active: (() => { const a = bar.querySelector('[aria-selected="true"]').getBoundingClientRect(), b = bar.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1 })() }))
    expect(tabs).toEqual({ lines: 1, active: true })
    await openAppView(page, 'studio', lang)
    const studio = await page.locator('.section-tabs').evaluate(bar => { const a = bar.querySelector('[aria-selected="true"]').getBoundingClientRect(), b = bar.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1 })
    expect(studio, 'the active tab is scrolled into view').toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
