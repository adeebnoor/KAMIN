import {test,expect} from './fixtures.js'
import AxeBuilder from '@axe-core/playwright'
import { copy, fill } from '../src/i18n.js'
import { approveSample, loadSample, openAppView, openOtherOptions } from './nav.js'

// Task 10: one clear decision on the start screen — upload your transcript, or try the synthetic
// example; everything else is under "Other options".
async function openStart(page,lang='ar'){
 await page.goto(`/${lang}/`)
 await page.getByRole('button',{name:lang==='ar'?/افتح مساحة العمل/:/Open workspace/}).first().click()
 await expect(page.locator('.onboarding')).toBeVisible()
}

test('first view: exactly two visible buttons plus a collapsed "Other options"',async({page})=>{
 await openStart(page)
 const visible=page.locator('.onboarding button:visible')
 await expect(visible).toHaveCount(2)
 await expect(visible.nth(0)).toContainText('ارفع كشف الدرجات')
 await expect(visible.nth(1)).toHaveText('جرّب المثال التوضيحي')
 const more=page.getByTestId('start-more')
 await expect(more.locator('summary')).toHaveText('خيارات أخرى')
 expect(await more.evaluate(el=>el.open)).toBe(false)
 // one trust line under the primary action, with a "How?" link
 await expect(page.getByTestId('start-trust')).toContainText('يُقرأ ملفك على جهازك فقط ولا يُرفع إلى أي خادم.')
 await expect(page.getByTestId('start-trust').getByRole('link',{name:'كيف؟'})).toHaveAttribute('href',/privacy/)
 // title and one sentence
 await expect(page.locator('.start-title p')).toHaveCount(1)
})

test('at 360px the primary button is visible without scrolling',async({page})=>{
 await page.setViewportSize({width:360,height:740})
 await openStart(page)
 const primary=page.locator('.onboarding-upload')
 await expect(primary).toBeInViewport()
 const box=await primary.boundingBox()
 expect(box.y+box.height).toBeLessThanOrEqual(740)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('all six old paths still work: upload, camera, demo, manual, restore, interests',async({page})=>{
 // upload (the primary button opens the file chooser)
 await openStart(page)
 const chooser=page.waitForEvent('filechooser')
 await page.locator('.onboarding-upload').click()
 expect((await chooser).isMultiple()).toBe(false)
 await expect(page.locator('#kamin-transcript-file')).toHaveAttribute('accept',/image\/jpeg/)
 // camera (separate capture input, under Other options)
 await openOtherOptions(page)
 await expect(page.locator('#kamin-transcript-camera')).toHaveAttribute('capture','environment')
 const camera=page.waitForEvent('filechooser')
 await page.getByTestId('start-more').getByRole('button',{name:'صوّر كشف الدرجات بالكاميرا'}).click()
 await camera
 // manual
 await page.getByRole('button',{name:'أدخل المقررات يدويًا'}).click()
 await expect(page.getByRole('button',{name:/إضافة مقرر يدويًا/})).toBeVisible()
 // demo
 await openStart(page)
 await page.getByRole('button',{name:'جرّب المثال التوضيحي'}).click()
 await expect(page.getByText(/7 مقررات مستخرجة/)).toBeVisible()
 // restore
 await openStart(page)
 await openOtherOptions(page)
 await page.getByRole('button',{name:'استعد ملفك المحفوظ'}).click()
 await expect(page.getByLabel('عبارة مرور النسخة المستعادة',{exact:true})).toBeVisible()
 // interests
 await openStart(page)
 await openOtherOptions(page)
 await page.getByRole('button',{name:'ابدأ باهتماماتك دون كشف درجات'}).click()
 await expect(page.locator('nav button[data-section="insight"]:visible')).toHaveAttribute('aria-current','page')
})

test('English start screen has the same single decision',async({page})=>{
 await openStart(page,'en')
 await expect(page.locator('.onboarding button:visible')).toHaveCount(2)
 await expect(page.locator('.onboarding-upload')).toContainText('Upload your transcript')
 await expect(page.getByTestId('start-trust')).toContainText('Your file is read on your device only and is not uploaded to any server.')
 await expect(page.getByTestId('start-more').locator('summary')).toHaveText('Other options')
})

// ---------- Task 21 · a forgiving upload, with a 3-step progress bar ----------
const S = { ar: copy.ar.screens.start, en: copy.en.screens.start }
const REVIEW_TITLE = { ar: copy.ar.screens.review.title, en: copy.en.screens.review.title }
const ERRORS = {
 corrupt: { ar: 'تعذر فتح ملف PDF أو أنه تالف.', en: 'The PDF could not be opened or is corrupt.' },
 unsupported: { ar: 'نوع الملف غير مدعوم. استخدم PDF أو صورة أو TXT.', en: 'Unsupported file type. Use PDF, image, or TXT.' },
}
const GOOD_TXT = 'CPIT-260 Database Systems B\nSTAT-201 Statistics B+'
// A one-page text PDF with the given lines (the same builder as e2e/no-external-requests.spec.js).
function syntheticPdf(lines){
 const text=lines.map((l,i)=>`BT /F1 11 Tf 50 ${760-i*18} Td (${l.replace(/[()\\]/g,'\\$&')}) Tj ET`).join('\n')
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`]
 let pdf='%PDF-1.4\n';const offsets=[]
 objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`})
 const xref=Buffer.byteLength(pdf)
 pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
 return Buffer.from(pdf,'latin1')
}
const SYNTHETIC_PDF = { name: 'synthetic-transcript.pdf', mimeType: 'application/pdf', buffer: syntheticPdf(['Synthetic transcript - not a real student', 'CPIT 240 Databases 3 A', 'CPIT 251 Software Engineering 3 B+', 'STAT 110 Introduction to Statistics 3 B']) }
const fileInput = page => page.locator('#kamin-transcript-file')
const zone = page => page.getByTestId('upload-drop-zone')
const uploadError = page => page.getByTestId('upload-error')
const appParam = page => new URL(page.url()).searchParams.get('app')
const reviewCodes = async page => { await page.locator('.app-overlay table input').first().waitFor({ timeout: 30_000 }); return page.locator('.app-overlay table tbody tr td:first-child input').evaluateAll(inputs => inputs.map(i => i.value)) }
// A DataTransfer holding one file, built in the page (as a real drag from the desktop would carry).
const dataTransfer = (page, { name, mimeType, buffer }) => page.evaluateHandle(({ name, mimeType, bytes }) => {
 const d = new DataTransfer(); d.items.add(new File([new Uint8Array(bytes)], name, { type: mimeType })); return d
}, { name, mimeType, bytes: [...buffer] })
// Still on the start screen: no review heading or table, the address says start.
async function staysOnStart(page, lang) {
 await expect(page.locator('.onboarding')).toBeVisible()
 await expect(page.getByRole('heading', { name: REVIEW_TITLE[lang] })).toHaveCount(0)
 await expect(page.locator('.app-overlay table')).toHaveCount(0)
 await expect.poll(() => appParam(page)).toBe('start')
}
async function errorWithThreeActions(page, lang, text) {
 await expect(uploadError(page)).toContainText(text)
 await expect(uploadError(page)).toHaveAttribute('role', 'alert')
 await expect(uploadError(page)).toBeFocused()
 for (const name of [S[lang].retry.another, S[lang].retry.manual, S[lang].retry.demo]) await expect(uploadError(page).getByRole('button', { name, exact: true })).toBeVisible()
 await staysOnStart(page, lang)
}

for (const lang of ['ar', 'en']) {
 test(`a dropped transcript works the same as a chosen one: ${lang}`, async ({ page }) => {
  await openStart(page, lang)
  const dt = await dataTransfer(page, SYNTHETIC_PDF)
  await zone(page).dispatchEvent('dragenter', { dataTransfer: dt })
  await expect(zone(page)).toHaveClass(/is-dragging/)
  await expect(zone(page)).toContainText(S[lang].drop)
  await zone(page).dispatchEvent('drop', { dataTransfer: dt })
  const dropped = await reviewCodes(page)
  expect(dropped.length).toBeGreaterThan(0)
  await openStart(page, lang)
  await fileInput(page).setInputFiles(SYNTHETIC_PDF)
  expect(await reviewCodes(page)).toEqual(dropped)
 })

 test(`a corrupt file and a file with no courses stay on the start screen with three ways forward: ${lang}`, async ({ page }) => {
  await openStart(page, lang)
  await fileInput(page).setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('this is not a pdf at all') })
  await errorWithThreeActions(page, lang, ERRORS.corrupt[lang])
  await fileInput(page).setInputFiles({ name: 'not-a-transcript.txt', mimeType: 'text/plain', buffer: Buffer.from('hello world') })
  await expect(uploadError(page)).toContainText(S[lang].noCourses)
  await errorWithThreeActions(page, lang, S[lang].noCourses)
  // A dropped file of another type gets the same treatment as the picker's types.
  const dt = await dataTransfer(page, { name: 'anim.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') })
  await zone(page).dispatchEvent('drop', { dataTransfer: dt })
  await errorWithThreeActions(page, lang, ERRORS.unsupported[lang])
  // axe: the error block and the step bar add no violation.
  const violations = (await new AxeBuilder({ page }).include('.onboarding').analyze()).violations.map(v => `${v.id}: ${v.nodes.length}`)
  expect(violations).toEqual([])
 })

 test(`each of the three actions under the error works: ${lang}`, async ({ page }) => {
  const fail = async () => { await openStart(page, lang); await fileInput(page).setInputFiles({ name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.from('hello world') }); await expect(uploadError(page)).toBeVisible() }
  await fail()
  const chooser = page.waitForEvent('filechooser')
  await uploadError(page).getByRole('button', { name: S[lang].retry.another, exact: true }).click()
  await (await chooser).setFiles({ name: 'record.txt', mimeType: 'text/plain', buffer: Buffer.from(GOOD_TXT) })
  expect(await reviewCodes(page)).toEqual(['CPIT-260', 'STAT-201'])
  await fail()
  await uploadError(page).getByRole('button', { name: S[lang].retry.manual, exact: true }).click()
  await expect(page.getByRole('heading', { name: REVIEW_TITLE[lang] })).toBeVisible()
  await expect(page.getByRole('button', { name: copy[lang].app.addRow })).toBeVisible()
  await fail()
  await uploadError(page).getByRole('button', { name: S[lang].retry.demo, exact: true }).click()
  expect((await reviewCodes(page)).length).toBe(7)
  // Leaving the start screen cleared the error.
  await openAppView(page, 'start', lang)
  await expect(uploadError(page)).toHaveCount(0)
 })

 test(`the step bar shows steps 1, 2, 3 on the first run and is gone on the next dashboard visit: ${lang}`, async ({ page }) => {
  const bar = page.getByTestId('step-bar')
  const current = () => bar.locator('li[aria-current="step"] .step-name')
  await openStart(page, lang)
  await expect(bar).toHaveAttribute('data-step', '1')
  await expect(current()).toHaveText(S[lang].steps.upload)
  await expect(bar.locator('li')).toHaveCount(3)
  // The bare "01" / "02" labels are gone.
  await expect(page.locator('.app-title > small').filter({ hasText: /^0[12]$/ })).toHaveCount(0)
  await loadSample(page, lang)
  await expect(bar).toHaveAttribute('data-step', '2')
  await expect(current()).toHaveText(S[lang].steps.review)
  await approveSample(page, lang)
  await expect(bar).toHaveAttribute('data-step', '3')
  await expect(current()).toHaveText(S[lang].steps.capabilities)
  await openAppView(page, 'matches', lang)
  await openAppView(page, 'dashboard', lang)
  await expect(page.locator('.capability-list')).toBeVisible()
  await expect(bar).toHaveCount(0)
  // Reviewing the record again after approval is not onboarding: no step bar.
  await openAppView(page, 'mydata', lang)
  await page.getByRole('button', { name: lang === 'ar' ? 'أعد مراجعة السجل كاملًا' : 'Re-review the whole record' }).click()
  await expect(page.getByRole('heading', { name: REVIEW_TITLE[lang] })).toBeVisible()
  await expect(bar).toHaveCount(0)
 })

 test(`phones: the step bar is one line and the upload button stays above the fold at 360x640: ${lang}`, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await openStart(page, lang)
  const bar = page.getByTestId('step-bar')
  // innerText: only what is shown (the other two steps are hidden on phones).
  await expect.poll(() => bar.evaluate(el => el.innerText.replace(/\s+/g, ' ').trim())).toBe(`${lang === 'ar' ? 'الخطوة 1 من 3' : 'Step 1 of 3'} · ${S[lang].steps.upload}`)
  // One visible step, on one line: all its text boxes start within a few pixels of each other (a second
  // line would start a full line lower).
  const spread = await bar.locator('li:visible').evaluateAll(items => items.map(li => { const r = document.createRange(); r.selectNodeContents(li); const tops = [...r.getClientRects()].map(x => x.top); return Math.max(...tops) - Math.min(...tops) }))
  expect(spread).toHaveLength(1)
  expect(spread[0]).toBeLessThan(8)
  const box = await zone(page).boundingBox()
  expect(box.y + box.height).toBeLessThanOrEqual(640)
  await expect(zone(page)).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
 })

 test(`partial success: the review screen says how many courses were found and how many lines need a look: ${lang}`, async ({ page }) => {
  await openStart(page, lang)
  await fileInput(page).setInputFiles({ name: 'partial.txt', mimeType: 'text/plain', buffer: Buffer.from(`${GOOD_TXT}\nCPIT-499 Senior Project 120`) })
  expect(await reviewCodes(page)).toEqual(['CPIT-260', 'STAT-201'])
  await expect(page.getByTestId('review-found')).toHaveText(fill(S[lang].found, { n: 2, m: 1 }))
  // A clean file has no such line.
  await openStart(page, lang)
  await fileInput(page).setInputFiles({ name: 'clean.txt', mimeType: 'text/plain', buffer: Buffer.from(GOOD_TXT) })
  await reviewCodes(page)
  await expect(page.getByTestId('review-found')).toHaveCount(0)
 })

 test.describe(() => {
  // The service worker answers page requests itself, out of page.route's reach; this test holds one.
  test.use({ serviceWorkers: 'block' })
 test(`Cancel while reading returns to the start screen and the late result is ignored: ${lang}`, async ({ page }) => {
  await openStart(page, lang)
  // Hold the reader (loaded on the first upload) so the reading is still going when Cancel is pressed.
  let release
  const held = new Promise(resolve => { release = resolve })
  await page.route('**/assets/transcript-*.js', async route => { await held; await route.continue() })
  await fileInput(page).setInputFiles({ name: 'late-result.txt', mimeType: 'text/plain', buffer: Buffer.from(GOOD_TXT) })
  await expect(page.getByTestId('reading-stage')).toHaveText(S[lang].stages.open)
  await page.getByTestId('cancel-reading').click()
  await expect(page.getByTestId('processing')).toHaveCount(0)
  await expect(zone(page)).toBeFocused()
  const loaded = page.waitForResponse(/\/assets\/transcript-[^/]*\.js/)
  release()
  await loaded
  await page.waitForTimeout(1500)
  await staysOnStart(page, lang)
  await expect(uploadError(page)).toHaveCount(0)
  // Nothing from the file reached the profile: not even the "file read" line in the usage log.
  await openAppView(page, 'audit', lang)
  await expect(page.locator('.audit-list')).toBeVisible()
  await expect(page.locator('.audit-list')).not.toContainText('late-result.txt')
  // The next file is read as usual.
  await openAppView(page, 'start', lang)
  await fileInput(page).setInputFiles({ name: 'record.txt', mimeType: 'text/plain', buffer: Buffer.from(GOOD_TXT) })
  expect(await reviewCodes(page)).toEqual(['CPIT-260', 'STAT-201'])
 })
 })
}

// ---------- Task 51 · a scanned PDF (no text layer) says so; OCR runs only when the student asks ----------
// The Task 50 fixture: one grey picture of a page, made up, no text layer.
const SCANNED_PDF = 'tests/fixtures/transcripts/scanned.pdf'
test.describe(() => {
 // Requests the service worker would answer are out of page.on('request')'s reach; this test watches them.
 test.use({ serviceWorkers: 'block' })
 for (const lang of ['ar', 'en']) {
  test(`a scanned PDF shows one clear message and two choices; OCR starts only after "Try reading the picture": ${lang}`, async ({ page }) => {
   const ocr = []
   page.on('request', request => { if (/\/ocr\//.test(request.url())) ocr.push(request.url()) })
   page.on('worker', worker => { if (/\/ocr\//.test(worker.url())) ocr.push(worker.url()) })
   const scanned = page.getByTestId('scanned-pdf')
   const expectScannedNotice = async () => {
    await expect(scanned).toContainText(S[lang].scanned.message)
    await expect(scanned).toHaveAttribute('role', 'alert')
    await expect(scanned).toBeFocused()
    await expect(scanned.getByRole('button')).toHaveText([S[lang].scanned.another, S[lang].scanned.readPicture])
    await expect(uploadError(page)).toHaveCount(0)
    await staysOnStart(page, lang)
   }
   await openStart(page, lang)
   await fileInput(page).setInputFiles(SCANNED_PDF)
   await expectScannedNotice()
   // Nothing reads the picture on its own.
   await page.waitForTimeout(1000)
   expect(ocr).toEqual([])
   const violations = (await new AxeBuilder({ page }).include('.onboarding').analyze()).violations.map(v => `${v.id}: ${v.nodes.length}`)
   expect(violations).toEqual([])

   // "Choose another file" opens the picker; a readable file then goes to the review screen as usual.
   const chooser = page.waitForEvent('filechooser')
   await scanned.getByRole('button', { name: S[lang].scanned.another, exact: true }).click()
   await (await chooser).setFiles({ name: 'record.txt', mimeType: 'text/plain', buffer: Buffer.from(GOOD_TXT) })
   expect(await reviewCodes(page)).toEqual(['CPIT-260', 'STAT-201'])
   expect(ocr).toEqual([])

   // "Try reading the picture" starts the (slower) picture reading; Cancel stops waiting for it.
   await openStart(page, lang)
   await fileInput(page).setInputFiles(SCANNED_PDF)
   await expectScannedNotice()
   expect(ocr).toEqual([])
   await scanned.getByRole('button', { name: S[lang].scanned.readPicture, exact: true }).click()
   await expect(page.getByTestId('processing')).toBeVisible()
   await expect(scanned).toHaveCount(0)
   await expect.poll(() => ocr.length, { timeout: 30_000 }).toBeGreaterThan(0)
   await page.getByTestId('cancel-reading').click()
   await staysOnStart(page, lang)
   await expect(scanned).toHaveCount(0)
  })
 }
})

test('the upload area still opens the file picker from the keyboard', async ({ page }) => {
 await openStart(page, 'en')
 await zone(page).focus()
 const chooser = page.waitForEvent('filechooser')
 await page.keyboard.press('Enter')
 expect((await chooser).isMultiple()).toBe(false)
})

// ---------- Task 52 · KAU transcripts: terms, retakes, transfers and letter codes, through to approval ----------
// The Task 50 fixtures (synthetic, made up).
const KAU_PDF = name => `tests/fixtures/transcripts/${name}.pdf`
const RV = { ar: copy.ar.screens.review, en: copy.en.screens.review }
const courseRow = (page, code) => page.locator(`.app-overlay tr.course-row[data-course="${code}"]`)
const term = (lang, season, year) => `${RV[lang].seasons[season]} ${year}`
async function approveReview(page, lang) {
 const box = page.getByTestId('review-approve')
 // Nothing to fix: the only thing left is the consent box.
 await expect(page.getByTestId('approve-reason')).toHaveText(RV[lang].tickConsent)
 await box.getByRole('checkbox').check()
 await expect(box.getByRole('button')).toBeEnabled()
 await box.getByRole('button').click()
 await expect.poll(() => appParam(page)).toBe('dashboard')
}
for (const lang of ['ar', 'en']) {
 test(`a retaken course shows its latest attempt once, with the earlier one under Details, and can be approved: ${lang}`, async ({ page }) => {
  await openStart(page, lang)
  await fileInput(page).setInputFiles(KAU_PDF('retake'))
  const codes = await reviewCodes(page)
  expect(codes).toHaveLength(9)
  expect(codes.filter(code => code === 'CPIT-240')).toHaveLength(1)
  const row = courseRow(page, 'CPIT-240')
  await expect(row.locator('.course-grade')).toHaveValue('B+')
  await expect(row.getByTestId('course-term')).toHaveText(term(lang, 'FALL', '2022/2023'))
  await expect(row.getByTestId('course-retaken')).toHaveText(RV[lang].retaken)
  await row.locator('.course-attempts summary').click()
  await expect(row.locator('.course-attempts li')).toHaveText([fill(RV[lang].attemptLine, { term: term(lang, 'FALL', '2021/2022'), grade: 'F' })])
  await expect(courseRow(page, 'ELI-101').getByTestId('course-term')).toHaveText(term(lang, 'FALL', '2021/2022'))
  await approveReview(page, lang)
 })

 test(`transfer (TR) rows are read under "equivalent courses" and do not block approval: ${lang}`, async ({ page }) => {
  await openStart(page, lang)
  await fileInput(page).setInputFiles(KAU_PDF('transfer-tr'))
  expect(await reviewCodes(page)).toHaveLength(15)
  const row = courseRow(page, 'ELI-101')
  await expect(row.locator('.course-grade')).toHaveValue('TR')
  await expect(row.getByTestId('course-term')).toHaveText(RV[lang].equivalentTerm)
  await expect(page.locator('.app-overlay [data-testid="course-reason"]').filter({ hasText: RV[lang].badGrade })).toHaveCount(0)
  await approveReview(page, lang)
 })

 test(`every letter code is read; 0 credits and NP kept, the unknown code flagged on its row, and Approve works: ${lang}`, async ({ page }) => {
  await openStart(page, lang)
  await fileInput(page).setInputFiles(KAU_PDF('codes-mix'))
  expect(await reviewCodes(page)).toHaveLength(16)
  for (const [code, grade] of [['CPIT-290', 'NP'], ['MATH-110', 'W'], ['STAT-110', 'WF'], ['PHYS-110', 'DN'], ['CPIT-240', 'NF'], ['CPIS-334', 'IC'], ['COMM-101', 'P'], ['CPIT-251', 'IP'], ['CPIT-250', 'ZZ']]) await expect(courseRow(page, code).locator('.course-grade'), code).toHaveValue(grade)
  await expect(courseRow(page, 'CPIT-290').getByTestId('course-term')).toHaveText(term(lang, 'SUMMER', '2021/2022'))
  await expect(courseRow(page, 'CPIT-250').getByTestId('course-reason').first()).toHaveText(fill(RV[lang].unknownLetter, { letter: 'ZZ' }))
  // The transcript GPA is only under Technical details, as printed.
  const gpa = page.getByTestId('transcript-gpa')
  await expect(gpa).toBeHidden()
  await page.getByTestId('review-summary').locator('.tech-details').filter({ has: gpa }).locator('summary').click()
  await expect(gpa).toHaveText(fill(RV[lang].transcriptGpa, { gpa: '2.94' }))
  await approveReview(page, lang)
 })
}
