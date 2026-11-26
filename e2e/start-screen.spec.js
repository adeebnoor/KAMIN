import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { copy, fill } from '../src/i18n.js'
import { kamin } from './roles.js'

// Tasks 10, 21 and 52: reading a transcript — errors keep the student on the page with ways forward, the picker opens
// from the keyboard, and KAU rows (terms, retakes, transfers, letter codes) are read through to approval. Task 70: the
// old start screen, its "Other options", camera input, demo button and step bar are deleted; these run on step 1 (the
// result card and its "Fix something" sheet). The old screen's own tests are mapped in log/task-70.md.

const S = { ar: copy.ar.screens.start, en: copy.en.screens.start }
const RV = { ar: copy.ar.screens.review, en: copy.en.screens.review }
const ERRORS = {
  corrupt: { ar: 'تعذر فتح ملف PDF أو أنه تالف.', en: 'The PDF could not be opened or is corrupt.' },
  unsupported: { ar: 'نوع الملف غير مدعوم. استخدم PDF أو صورة أو TXT.', en: 'Unsupported file type. Use PDF, image, or TXT.' },
}
const GOOD_TXT = 'CPIT-260 Database Systems B\nSTAT-201 Statistics B+'
const fileInput = page => page.locator('#ui2-transcript-file')
const uploadError = page => page.getByTestId('upload-error')
async function openStep1(page, lang) {
  const app = kamin(page, { ui: 'new', lang })
  await app.goToView('upload')
  await expect(fileInput(page)).toBeAttached()
  return app
}
// The codes read, from the Fix sheet (the sheet is closed again afterwards).
async function readCodes(app) {
  await expect(app.resultLine()).toBeVisible({ timeout: 30_000 })
  await app.showReadRows()
  const codes = await app.fixSheet().locator('table tbody tr td:first-child input').evaluateAll(inputs => inputs.map(i => i.value))
  await app.hideReadRows()
  return codes
}
// The error and its ways forward (Task 21): another file, or enter the courses by hand. (The old third way, the
// synthetic example, is dropped from the student flow: inventory D01.)
async function errorWithWaysForward(page, lang, text) {
  await expect(uploadError(page)).toContainText(text)
  for (const name of [S[lang].retry.another, S[lang].retry.manual]) await expect(uploadError(page).getByRole('button', { name, exact: true })).toBeVisible()
}

for (const lang of ['ar', 'en']) {
  test(`a corrupt file and a file with no courses stay on step 1 with their ways forward: ${lang}`, async ({ page }) => {
    const app = await openStep1(page, lang)
    await fileInput(page).setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('this is not a pdf at all') })
    await errorWithWaysForward(page, lang, ERRORS.corrupt[lang])
    await fileInput(page).setInputFiles({ name: 'not-a-transcript.txt', mimeType: 'text/plain', buffer: Buffer.from('hello world') })
    await errorWithWaysForward(page, lang, S[lang].noCourses)
    await expect(app.resultLine()).toHaveCount(0)
    const violations = (await new AxeBuilder({ page }).include('main').analyze()).violations.map(v => `${v.id}: ${v.nodes.length}`)
    expect(violations).toEqual([])
  })

  test(`each way forward under the error works: ${lang}`, async ({ page }) => {
    const app = await openStep1(page, lang)
    const fail = async () => { await fileInput(page).setInputFiles({ name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.from('hello world') }); await expect(uploadError(page)).toBeVisible() }
    await fail()
    const chooser = page.waitForEvent('filechooser')
    await uploadError(page).getByRole('button', { name: S[lang].retry.another, exact: true }).click()
    await (await chooser).setFiles({ name: 'record.txt', mimeType: 'text/plain', buffer: Buffer.from(GOOD_TXT) })
    expect(await readCodes(app)).toEqual(['CPIT-260', 'STAT-201'])
    await app.goToView('upload')
    await fail()
    await uploadError(page).getByRole('button', { name: S[lang].retry.manual, exact: true }).click()
    await expect(uploadError(page)).toHaveCount(0)
    await page.getByTestId('ui2-fix-open').click()
    await expect(app.fixSheet().getByRole('button', { name: copy[lang].app.addRow })).toBeVisible()
  })

  test(`partial success: step 1 says how many courses were found and how many lines need a look: ${lang}`, async ({ page }) => {
    const app = await openStep1(page, lang)
    await fileInput(page).setInputFiles({ name: 'partial.txt', mimeType: 'text/plain', buffer: Buffer.from(`${GOOD_TXT}\nCPIT-499 Senior Project 120`) })
    expect(await readCodes(app)).toEqual(['CPIT-260', 'STAT-201'])
    await expect(page.getByTestId('review-found')).toHaveText(fill(S[lang].found, { n: 2, m: 1 }))
    // A clean file has no such line.
    await app.goToView('upload')
    await fileInput(page).setInputFiles({ name: 'clean.txt', mimeType: 'text/plain', buffer: Buffer.from(GOOD_TXT) })
    expect(await readCodes(app)).toEqual(['CPIT-260', 'STAT-201'])
    await expect(page.getByTestId('review-found')).toHaveCount(0)
  })
}

test('the upload button opens the file picker from the keyboard', async ({ page }) => {
  const app = await openStep1(page, 'en')
  await app.uploadControl().focus()
  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  expect((await chooser).isMultiple()).toBe(false)
})

// ---------- Task 52 · KAU transcripts: terms, retakes, transfers and letter codes, through to approval ----------
// The Task 50 fixtures (synthetic, made up).
const KAU_PDF = name => `tests/fixtures/transcripts/${name}.pdf`
const term = (lang, season, year) => `${RV[lang].seasons[season]} ${year}`
async function readKau(app, name) {
  await fileInput(app.page).setInputFiles(KAU_PDF(name))
  const codes = await readCodes(app)
  await app.showReadRows()
  return codes
}
const courseRow = (app, code) => app.fixSheet().locator(`tr.course-row[data-course="${code}"]`)
async function approve(app) {
  await app.hideReadRows()
  await app.reviewConsent().check()
  await expect(app.approveButton()).toBeEnabled()
  await app.approveButton().click()
  await expect(app.heading('projects')).toBeVisible()
}
for (const lang of ['ar', 'en']) {
  test(`a retaken course shows its latest attempt once, with the earlier one under Details, and can be approved: ${lang}`, async ({ page }) => {
    const app = await openStep1(page, lang)
    const codes = await readKau(app, 'retake')
    expect(codes).toHaveLength(9)
    expect(codes.filter(code => code === 'CPIT-240')).toHaveLength(1)
    const row = courseRow(app, 'CPIT-240')
    await expect(row.locator('.course-grade')).toHaveValue('B+')
    await expect(row.getByTestId('course-term')).toHaveText(term(lang, 'FALL', '2022/2023'))
    await expect(row.getByTestId('course-retaken')).toHaveText(RV[lang].retaken)
    await row.locator('.course-attempts summary').click()
    await expect(row.locator('.course-attempts li')).toHaveText([fill(RV[lang].attemptLine, { term: term(lang, 'FALL', '2021/2022'), grade: 'F' })])
    await expect(courseRow(app, 'ELI-101').getByTestId('course-term')).toHaveText(term(lang, 'FALL', '2021/2022'))
    await approve(app)
  })

  test(`transfer (TR) rows are read under "equivalent courses" and do not block approval: ${lang}`, async ({ page }) => {
    const app = await openStep1(page, lang)
    expect(await readKau(app, 'transfer-tr')).toHaveLength(15)
    const row = courseRow(app, 'ELI-101')
    await expect(row.locator('.course-grade')).toHaveValue('TR')
    await expect(row.getByTestId('course-term')).toHaveText(RV[lang].equivalentTerm)
    await expect(app.fixSheet().getByTestId('course-reason').filter({ hasText: RV[lang].badGrade })).toHaveCount(0)
    await approve(app)
  })

  test(`every letter code is read; 0 credits and NP kept, the unknown code flagged on its row, and Approve works: ${lang}`, async ({ page }) => {
    const app = await openStep1(page, lang)
    expect(await readKau(app, 'codes-mix')).toHaveLength(16)
    for (const [code, grade] of [['CPIT-290', 'NP'], ['MATH-110', 'W'], ['STAT-110', 'WF'], ['PHYS-110', 'DN'], ['CPIT-240', 'NF'], ['CPIS-334', 'IC'], ['COMM-101', 'P'], ['CPIT-251', 'IP'], ['CPIT-250', 'ZZ']])
      await expect(courseRow(app, code).locator('.course-grade'), code).toHaveValue(grade)
    await expect(courseRow(app, 'CPIT-290').getByTestId('course-term')).toHaveText(term(lang, 'SUMMER', '2021/2022'))
    await expect(courseRow(app, 'CPIT-250').getByTestId('course-reason').first()).toHaveText(fill(RV[lang].unknownLetter, { letter: 'ZZ' }))
    await approve(app)
  })
}
