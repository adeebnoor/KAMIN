// Task 22 · a review you can read and check, phone first. Runs on the desktop and phone projects. Task 70: the old
// review screen is deleted; its course list lives on unchanged in step 1's "Fix something" sheet and in Settings → My
// courses, where these run. The old screen's desktop layout, college line, approve bar and axe tests are mapped in
// log/task-70.md (e2e/next-upload.spec.js, keep-test K02). The old header's "show only the ones that need a look" filter is
// not in the Fix sheet (Task 62 lists the rows that need a look first instead: the second test below).
import { test, expect } from '@playwright/test'
import { copy } from '../src/i18n.js'
import { kamin } from './roles.js'

const R = { ar: copy.ar.screens.review, en: copy.en.screens.review }
const A = { ar: copy.ar.app, en: copy.en.app }
const list = page => page.getByTestId('review-courses')
const rows = page => list(page).locator('tbody tr')
const upload = (page, name, text) => page.locator('#ui2-transcript-file').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') })
const MAPPED = 'CPIT-240 Databases (I) B\nCPIT-251 Software Engineering (I) B+\nCPIT-250 Systems Analysis and Design C'
const order = page => rows(page).evaluateAll(trs => trs.map(tr => tr.dataset.course))

// Nothing in the list is wider than its box, and every code and name shows all its text.
const readable = page => page.evaluate(() => {
  const wrap = document.querySelector('[data-testid="review-courses"], [data-testid="my-data-courses"]')
  const box = wrap.closest('.course-list-wrap')
  const wide = [box, ...box.querySelectorAll('*')].filter(el => el.getClientRects().length && el.clientWidth > 1 && !el.matches('input,textarea') && el.scrollWidth > el.clientWidth + 1).map(el => `${el.className} ${el.scrollWidth}>${el.clientWidth}`)
  const fields = [...box.querySelectorAll('input.course-code, textarea.course-name, input.course-grade')].filter(el => el.getClientRects().length)
  const cut = fields.filter(el => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight + 2).map(el => `${el.getAttribute('aria-label')} ${el.scrollWidth}x${el.scrollHeight}>${el.clientWidth}x${el.clientHeight}`)
  return { wide, cut, fields: fields.length, pageWide: document.documentElement.scrollWidth > innerWidth }
})
async function sampleRows(page, lang) {
  const app = kamin(page, { ui: 'new', lang })
  await page.goto(`/${lang}/?start=sample`)
  await app.showReadRows()
  return app
}

for (const lang of ['ar', 'en']) {
  for (const [width, height] of [[360, 640], [390, 844]]) {
    test(`${width}x${height}: every course is readable, nothing scrolls sideways: ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await sampleRows(page, lang)
      await expect(rows(page)).toHaveCount(7)
      // Phones show cards: no table header, one bordered card per course.
      await expect(list(page).locator('thead')).toBeHidden()
      expect(await readable(page)).toEqual({ wide: [], cut: [], fields: 21, pageWide: false })
      // The full name is in the field, not a shortened copy.
      await expect(page.getByLabel(`${A[lang].courseName} 4`, { exact: true })).toHaveValue(lang === 'ar' ? 'مقدمة في إدارة مشاريع البرمجيات' : 'Introduction to Software Project Management')
    })
  }

  test(`the row that needs a look is listed first with its reason; an edited grade says why on its row: ${lang}`, async ({ page }) => {
    const app = await sampleRows(page, lang)
    // The example has one course not linked to a capability yet (CPIT-260).
    await expect(rows(page).first()).toHaveAttribute('data-course', 'CPIT-260')
    await expect(rows(page).first().getByTestId('course-reason')).toHaveText(R[lang].notLinkedReason)
    await app.hideReadRows()
    await expect(page.getByTestId('review-attention')).toHaveText(R[lang].needsLookOne)
    // A document upload: raise one grade. The row keeps its place while the student types, and says why.
    await app.goToView('upload')
    await upload(page, 'record.txt', MAPPED)
    await app.showReadRows()
    await expect(rows(page)).toHaveCount(3)
    expect(await order(page)).toEqual(['CPIT-240', 'CPIT-251', 'CPIT-250'])
    await page.getByLabel(`${A[lang].grade} 3`, { exact: true }).fill('A')
    const edited = rows(page).filter({ has: page.locator('input[value="CPIT-250"]') })
    await expect(edited.getByTestId('course-reason')).toContainText(lang === 'ar' ? 'رفعت درجة CPIT-250 من C إلى A' : 'You raised the grade of CPIT-250 from C to A')
    await expect(edited).toHaveAttribute('data-attention', 'true')
    expect(await order(page)).toEqual(['CPIT-240', 'CPIT-251', 'CPIT-250'])
    // When the list is set again (a row removed), the edited row comes first.
    await rows(page).filter({ has: page.locator('input[value="CPIT-251"]') }).getByRole('button', { name: lang === 'ar' ? 'حذف CPIT-251' : 'Delete CPIT-251' }).click()
    expect(await order(page)).toEqual(['CPIT-250', 'CPIT-240'])
  })

  test(`My courses shows the courses the same way, readable at 360px: ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    await app.home()
    await app.openMyData()
    const mine = page.getByTestId('my-data-courses')
    await expect(mine.locator('tbody tr')).toHaveCount(7)
    await expect(mine.locator('tbody tr').first().locator('textarea.course-name')).toBeVisible()
    await expect(mine.locator('tbody tr').first().locator('.mapping-badge')).toBeVisible()
    expect(await readable(page)).toEqual({ wide: [], cut: [], fields: 21, pageWide: false })
    // Still named by course code, as before.
    await expect(page.getByLabel(lang === 'ar' ? 'درجة CPIT-240' : 'Grade CPIT-240', { exact: true })).toHaveValue('B')
  })
}
