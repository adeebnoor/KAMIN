// Task 22 · a review screen you can read and check, phone first. Runs on the desktop and phone projects.
import { test, expect } from './fixtures.js'
import AxeBuilder from '@axe-core/playwright'
import { copy, fill } from '../src/i18n.js'
import { COLLEGE_COPY } from '../src/content/collegeCopy.js'
import { approveSample, loadSample, openAppView, openAppWindow } from './nav.js'

const R = { ar: copy.ar.screens.review, en: copy.en.screens.review }
const FCIT = { ar: 'كلية الحاسبات وتقنية المعلومات', en: 'Faculty of Computing and Information Technology' }
const A = { ar: copy.ar.app, en: copy.en.app }
const list = page => page.getByTestId('review-courses')
const rows = page => list(page).locator('tbody tr')
const bar = page => page.getByTestId('review-approve')
const approveButton = (page, lang) => bar(page).getByRole('button', { name: A[lang].approve })
const upload = (page, name, text) => page.locator('#kamin-transcript-file').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') })
const MAPPED = 'CPIT-240 Databases (I) B\nCPIT-251 Software Engineering (I) B+\nCPIT-250 Systems Analysis and Design C'

// Nothing in the list is wider than its box, and every code and name shows all its text.
const readable = page => page.evaluate(() => {
  const wrap = document.querySelector('[data-testid="review-courses"], [data-testid="my-data-courses"]')
  const box = wrap.closest('.course-list-wrap')
  const wide = [box, ...box.querySelectorAll('*')].filter(el => el.getClientRects().length && el.clientWidth > 1 && !el.matches('input,textarea') && el.scrollWidth > el.clientWidth + 1).map(el => `${el.tagName}.${el.className} ${el.scrollWidth}>${el.clientWidth}`)
  const fields = [...box.querySelectorAll('input.course-code, textarea.course-name, input.course-grade')].filter(el => el.getClientRects().length)
  const cut = fields.filter(el => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight + 2).map(el => `${el.getAttribute('aria-label')} ${el.scrollWidth}x${el.scrollHeight}>${el.clientWidth}x${el.clientHeight}`)
  return { wide, cut, fields: fields.length, pageWide: document.documentElement.scrollWidth > innerWidth }
})

for (const lang of ['ar', 'en']) {
  for (const [width, height] of [[360, 640], [390, 844]]) {
    test(`${width}x${height}: every course is readable, nothing scrolls sideways: ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await openAppWindow(page, lang)
      await loadSample(page, lang)
      await expect(rows(page)).toHaveCount(7)
      // Phones show cards: no table header, one bordered card per course.
      await expect(list(page).locator('thead')).toBeHidden()
      const result = await readable(page)
      expect(result).toEqual({ wide: [], cut: [], fields: 21, pageWide: false })
      // The full name is in the field, not a shortened copy.
      await expect(page.getByLabel(`${A[lang].courseName} 4`, { exact: true })).toHaveValue(lang === 'ar' ? 'مقدمة في إدارة مشاريع البرمجيات' : 'Introduction to Software Project Management')
    })
  }

  test(`desktop 1366x768: one heading, the first row and the approve button are visible without scrolling: ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await openAppWindow(page, lang)
    await loadSample(page, lang)
    await expect(rows(page).first()).toBeVisible()
    await expect(page.locator('.app-overlay h2')).toHaveCount(1)
    expect((await page.locator('.app-content').innerText()).split(R[lang].title).length - 1).toBe(1)
    const at = async () => page.evaluate(() => {
      const wrap = document.querySelector('.app-content-wrap').getBoundingClientRect()
      const row = document.querySelector('[data-testid="review-courses"] tbody tr').getBoundingClientRect()
      const b = document.querySelector('[data-testid="review-approve"]').getBoundingClientRect()
      return { rowTop: row.top, rowBottom: row.bottom, barTop: b.top, barBottom: b.bottom, wrapTop: wrap.top, wrapBottom: wrap.bottom }
    })
    const first = await at()
    expect(first.rowTop).toBeGreaterThanOrEqual(first.wrapTop)
    expect(first.rowBottom, 'the first row is above the approve bar').toBeLessThanOrEqual(first.barTop)
    expect(first.barBottom).toBeLessThanOrEqual(first.wrapBottom + 1)
    // Sticky: halfway down the list the approve bar is still on screen.
    await page.locator('.app-content-wrap').evaluate(el => { el.scrollTop = el.scrollHeight / 3 })
    await expect(approveButton(page, lang)).toBeInViewport()
    const later = await at()
    expect(later.barBottom).toBeLessThanOrEqual(later.wrapBottom + 1)
    expect(later.barTop).toBeGreaterThan(later.wrapTop)
  })

  test(`the row that needs a look is listed first with its reason; an edited grade says why on its row: ${lang}`, async ({ page }) => {
    await openAppWindow(page, lang)
    await loadSample(page, lang)
    // The example has one course not linked to a capability yet (CPIT-260).
    await expect(rows(page).first()).toHaveAttribute('data-course', 'CPIT-260')
    await expect(rows(page).first().getByTestId('course-reason')).toHaveText(R[lang].notLinkedReason)
    await expect(page.getByTestId('review-attention')).toHaveText(`${fill(R[lang].extractedCount, { n: 7 })} · ${R[lang].needsLookOne}`)
    // A document upload: raise one grade. The row keeps its place while the student types, and says why.
    await openAppView(page, 'start', lang)
    await upload(page, 'record.txt', MAPPED)
    await expect(rows(page)).toHaveCount(3)
    expect(await rows(page).evaluateAll(trs => trs.map(tr => tr.dataset.course))).toEqual(['CPIT-240', 'CPIT-251', 'CPIT-250'])
    const grade = page.getByLabel(`${A[lang].grade} 3`, { exact: true })
    await grade.fill('A')
    const edited = rows(page).filter({ has: page.locator('input[value="CPIT-250"]') })
    await expect(edited.getByTestId('course-reason')).toContainText(lang === 'ar' ? 'رفعت درجة CPIT-250 من C إلى A' : 'You raised the grade of CPIT-250 from C to A')
    await expect(edited).toHaveAttribute('data-attention', 'true')
    expect(await rows(page).evaluateAll(trs => trs.map(tr => tr.dataset.course))).toEqual(['CPIT-240', 'CPIT-251', 'CPIT-250'])
    // When the list is set again (a row removed), the edited row comes first.
    await rows(page).filter({ has: page.locator('input[value="CPIT-251"]') }).getByRole('button', { name: lang === 'ar' ? 'حذف CPIT-251' : 'Delete CPIT-251' }).click()
    expect(await rows(page).evaluateAll(trs => trs.map(tr => tr.dataset.course))).toEqual(['CPIT-250', 'CPIT-240'])
  })

  test(`the college comes first; the approve bar says why it is disabled; approving works: ${lang}`, async ({ page }) => {
    await openAppWindow(page, lang)
    // The example comes with its college: one line with "Not right?", which shows the one-tap list (Task 55: no dropdown).
    await loadSample(page, lang)
    await expect(page.getByTestId('college-current')).toContainText(lang === 'ar' ? 'كلية الحاسبات وتقنية المعلومات' : 'Faculty of Computing and Information Technology')
    await expect(page.getByTestId('college-fix')).toHaveCount(0)
    await page.getByTestId('college-current').getByRole('button', { name: COLLEGE_COPY[lang].notRight }).click()
    await expect(page.getByTestId('college-fix').getByRole('button', { name: FCIT[lang] })).toHaveAttribute('aria-pressed', 'true')
    await openAppView(page, 'start', lang)
    await upload(page, 'record.txt', MAPPED)
    await expect(rows(page)).toHaveCount(3)
    // A plain list prints no college: the note with its Fix is the first thing on the summary card (after what was read).
    const card = page.getByTestId('review-summary')
    const order = await card.evaluate(el => [...el.children].map(c => c.dataset.testid || c.className))
    expect(order.indexOf('college-note')).toBeGreaterThanOrEqual(0)
    expect(order.indexOf('college-note')).toBeLessThan(order.indexOf('review-facts-row'))
    await expect(approveButton(page, lang)).toBeDisabled()
    await expect(page.getByTestId('approve-reason')).toHaveText(R[lang].tickConsent)
    await page.getByLabel(`${A[lang].grade} 1`, { exact: true }).fill('AAA')
    await expect(page.getByTestId('approve-reason')).toHaveText(R[lang].fixFirstOne)
    await expect(rows(page).first().getByTestId('course-reason').first()).toHaveText(R[lang].badGrade)
    await page.getByLabel(`${A[lang].grade} 1`, { exact: true }).fill('B')
    await bar(page).getByRole('checkbox').check()
    await expect(page.getByTestId('approve-reason')).toHaveCount(0)
    await card.getByTestId('college-note').getByRole('button', { name: COLLEGE_COPY[lang].fix }).click()
    await card.getByTestId('college-fix').getByRole('button', { name: FCIT[lang] }).click()
    await approveButton(page, lang).click()
    await expect(page.locator('.capability-list')).toBeVisible()
  })

  test(`more than 8 rows: "show only the ones that need a look" filters the list: ${lang}`, async ({ page }) => {
    await openAppWindow(page, lang)
    const lines = ['CPIT-240 Databases (I) B', 'CPIT-251 Software Engineering (I) B+', 'CPIT-250 Systems Analysis and Design C', 'STAT-110 General Statistics (1) B', 'CPIS-334 Introduction to Software Project Management A', 'CPIT-499 Senior Project A', 'CPIT-221 Data Structures B', 'GEN-901 Seminar One A', 'GEN-902 Seminar Two B']
    await upload(page, 'long.txt', lines.join('\n'))
    await expect(rows(page)).toHaveCount(9)
    const needing = await rows(page).evaluateAll(trs => trs.filter(tr => tr.dataset.attention).length)
    expect(needing).toBeGreaterThanOrEqual(2)
    await page.getByRole('checkbox', { name: R[lang].onlyAttention }).check()
    await expect(rows(page)).toHaveCount(needing)
    expect(await rows(page).evaluateAll(trs => trs.every(tr => tr.dataset.attention === 'true'))).toBe(true)
    await page.getByRole('checkbox', { name: R[lang].onlyAttention }).uncheck()
    await expect(rows(page)).toHaveCount(9)
  })

  test(`My data shows the courses the same way, readable at 360px: ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await openAppWindow(page, lang)
    await loadSample(page, lang)
    await approveSample(page, lang)
    await openAppView(page, 'mydata', lang)
    const mine = page.getByTestId('my-data-courses')
    await expect(mine.locator('tbody tr')).toHaveCount(7)
    await expect(mine.locator('tbody tr').first().locator('textarea.course-name')).toBeVisible()
    await expect(mine.locator('tbody tr').first().locator('.mapping-badge')).toBeVisible()
    expect(await readable(page)).toEqual({ wide: [], cut: [], fields: 21, pageWide: false })
    // Still named by course code, as before.
    await expect(page.getByLabel(lang === 'ar' ? 'درجة CPIT-240' : 'Grade CPIT-240', { exact: true })).toHaveValue('B')
  })

  test(`axe: the review screen with a problem row and the sticky bar has no violations: ${lang}`, async ({ page }) => {
    await openAppWindow(page, lang)
    await upload(page, 'record.txt', MAPPED)
    await page.getByLabel(`${A[lang].grade} 1`, { exact: true }).fill('AAA')
    await expect(page.getByTestId('approve-reason')).toBeVisible()
    const violations = (await new AxeBuilder({ page }).include('.app-content').analyze()).violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')}`)
    expect(violations).toEqual([])
  })
}
