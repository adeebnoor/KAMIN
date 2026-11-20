// Task 62 · Home and step 1 of the new interface (?ui=next). Home is one sentence and one button. Step 1: upload a
// made-up KAU transcript (Task 50 fixtures), one line confirms what was read, "Fix something" opens the review's rows
// in a sheet, the consent is word for word, Approve opens step 2. Also: a scanned and an unsupported file, reading
// with a skeleton and Cancel, the college note and its one-tap fix, ?start=sample, pilot mode, the click budget, no
// percentage, axe in both themes and no sideways scroll at 360px. Arabic and English, on the desktop and phone projects.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { copy, fill } from '../src/i18n.js'
import { COURSE_EVIDENCE_PRINCIPLE } from '../src/content/trustCopy.js'
import { COLLEGES } from '../src/catalog/colleges.js'
import { COLLEGE_COPY } from '../src/content/collegeCopy.js'
import { PILOT_COPY } from '../src/content/pilotConsent.js'
import { TRANSCRIPT_ACCEPT } from '../src/utils/transcriptAccept.js'
import { isMappedCourse } from '../src/utils/courseStatus.js'
import { demoCourses } from '../src/data.js'
import { NEXT_COPY, fillIn } from '../src/ui2/copy.js'
import { VIEW_TEXT } from '../src/ui2/views.js'
import { LANGS, kamin } from './roles.js'

const BUDGET = JSON.parse(readFileSync(new URL('./usability-budget.json', import.meta.url), 'utf8'))
const PDF = name => `tests/fixtures/transcripts/${name}.pdf`
const EXPECTED = name => JSON.parse(readFileSync(`tests/fixtures/transcripts/${name}.expected.json`, 'utf8'))
const PILOT_FIXTURE = JSON.parse(readFileSync('src/pilot/synthetic-transcripts.json', 'utf8')).transcripts[0]
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1366, height: 768 }
const NARROW = { width: 360, height: 780 }
// A percentage written with a digit, in either script (%, ٪).
const PERCENT = /\d\s?[%٪]|[%٪]\s?\d/
const OFFERS_EXAMPLE = /demo|synthetic|example|تجريبي|توضيحي|وهمي/i
const W = lang => NEXT_COPY[lang]
const R = lang => copy[lang].screens.review
const S = lang => copy[lang].screens.start
const collegeName = (id, lang) => COLLEGES.find(c => c.id === id).labels[lang]
const readLine = (lang, n) => W(lang).result.read(n).join('')
const fileInput = page => page.locator('#ui2-transcript-file')
const noPercent = async (scope, what) => expect(await scope.innerText(), `${what}: no percentage may be shown`).not.toMatch(PERCENT)

async function openStep1(page, lang) {
  const app = kamin(page, { ui: 'new', lang })
  await app.home()
  await app.homeAction().click()
  await expect(app.uploadControl()).toBeVisible()
  return app
}
async function choose(page, app, file) {
  await fileInput(page).setInputFiles(file)
  await expect(app.resultLine()).toBeVisible()
}

for (const lang of LANGS) test.describe(`Home and step 1 (${lang})`, () => {
  test('Home: the one sentence and one button, at most one screen at 1366×768 and 390×844; Start opens step 1', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    for (const size of [DESKTOP, PHONE]) {
      await page.setViewportSize(size)
      await app.home()
      await expect(app.heading('home')).toHaveText(VIEW_TEXT.home.line[lang])
      // Exactly one control on the page besides the top bar and the tabs (the footer comes with Task 68).
      const controls = app.main().locator('a[href], button, input, select, textarea, summary, [tabindex="0"]')
      await expect(controls).toHaveCount(1)
      await expect(controls.first()).toHaveText(W(lang).home.start)
      const length = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollHeight, view: innerHeight }))
      expect(length.scroll, `Home is one screen at ${size.width}×${size.height}`).toBeLessThanOrEqual(length.view)
      await noPercent(app.main(), 'Home')
      expect(await app.main().innerText(), 'no demo, example, tour or FAQ on Home').not.toMatch(OFFERS_EXAMPLE)
    }
    await app.homeAction().click()
    await expect(app.heading('upload')).toBeFocused()
    await expect(page).toHaveURL(/[?&]app=upload(&|$)/)
    // Step 1: the step indicator, one area to choose or drop the file (images too, so a phone offers its camera),
    // the privacy promise with "Why?", and nothing that offers the example.
    await expect(app.main().getByRole('button', { name: fillIn(W(lang).steps.step, { n: 1, of: 4 }), exact: true })).toBeVisible()
    await expect(app.uploadControl()).toContainText(W(lang).upload.hint)
    await expect(fileInput(page)).toHaveAttribute('accept', TRANSCRIPT_ACCEPT)
    await expect(app.main().getByText(W(lang).upload.privacy, { exact: true })).toBeVisible()
    expect(await app.main().innerText()).not.toMatch(OFFERS_EXAMPLE)
    await noPercent(app.main(), 'step 1')
    const why = app.main().getByRole('button', { name: W(lang).upload.why, exact: true })
    await why.click()
    const sheet = app.sheet(W(lang).upload.whyTitle)
    await expect(sheet).toBeVisible()
    for (const line of W(lang).upload.whyText) await expect(sheet.getByText(line, { exact: true })).toBeVisible()
    await expect(sheet.getByRole('link', { name: W(lang).upload.privacyPage })).toHaveAttribute('href', new RegExp(`privacy\\.html`))
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(why).toBeFocused()
  })

  test('fcit-it-2p: one line with the count, college and major; the Fix sheet edits a grade; consent word for word; Approve opens step 2', async ({ page }) => {
    const expected = EXPECTED('fcit-it-2p')
    const app = await openStep1(page, lang)
    await choose(page, app, PDF('fcit-it-2p'))
    await expect(app.resultLine()).toHaveText(`${readLine(lang, expected.rows.length)} · ${collegeName('FCIT', lang)} · ${expected.student.majorRaw}`)
    await expect(app.resultLine(), 'the line takes focus once the file is read').toBeFocused()
    await expect(page.getByTestId('college-note')).toHaveCount(0)
    await expect(page.getByTestId('college-no-map')).toHaveCount(0)
    // The flagged rows (Task 22's rule): courses outside the course map ("Not in the course map"), and courses in it
    // that are not linked to a capability yet (CPIT-260 and CPIT-305 in this fixture).
    const flagged = expected.rows.filter(row => !row.inCourseMap || !isMappedCourse(row.code)).length
    await expect(page.getByTestId('review-attention')).toHaveText(fill(R(lang).needsLook, { n: flagged }))
    // The clue sentence on the card and the approval consent, word for word; Approve waits and says why.
    await expect(page.getByTestId('ui2-result').getByText(COURSE_EVIDENCE_PRINCIPLE[lang], { exact: true })).toBeVisible()
    expect(await page.getByTestId('review-approve').locator('label').innerText()).toBe(R(lang).consent)
    await expect(app.reviewConsent()).not.toBeChecked()
    await expect(app.approveButton()).toBeDisabled()
    await expect(app.approveReason()).toHaveText(R(lang).tickConsent)
    await noPercent(app.main(), 'result card')

    // Fix something: the review's own rows, attention first, with the term and the "Not in the course map" reason.
    await app.showReadRows()
    const sheet = app.fixSheet()
    await expect(app.readCodes()).toHaveCount(expected.rows.length)
    const rows = sheet.locator('tr.course-row')
    await expect(rows.first()).toHaveAttribute('data-attention', 'true')
    await expect(rows.first().getByTestId('course-reason')).toHaveText(R(lang).notInCourseMap)
    await expect(rows.nth(flagged)).not.toHaveAttribute('data-attention', /.*/)
    await expect(sheet.getByTestId('course-term').first()).toBeVisible()
    const row = sheet.locator('tr[data-course="CPIT-250"]')
    const grade = row.getByRole('textbox', { name: new RegExp(`^${copy[lang].app.grade} \\d+$`) })
    await expect(grade).toHaveValue('B+')
    await grade.fill('A')
    await expect(grade).toHaveValue('A')
    // A raised grade is said on its row and stays where it is while being corrected.
    await expect(row).toHaveAttribute('data-attention', 'true')
    await expect(row.getByTestId('course-reason')).toContainText('CPIT-250')
    await noPercent(sheet, 'the Fix sheet')
    await app.hideReadRows()
    await expect(app.main().getByRole('button', { name: W(lang).result.fix, exact: true }), 'focus goes back to "Fix something"').toBeFocused()
    await expect(page.getByTestId('review-attention')).toHaveText(fill(R(lang).needsLook, { n: flagged + 1 }))

    // Tick and Approve: step 2.
    await app.approve()
    await expect(app.heading('projects')).toBeFocused()
    await expect(page).toHaveURL(/[?&]app=projects(&|$)/)
    const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3')))
    expect(saved).toMatchObject({ approved: true, college: 'FCIT', major: expected.student.majorRaw })
    expect(saved.courses).toHaveLength(expected.rows.length)
    expect(saved.courses.find(course => course.code === 'CPIT-250').grade).toBe('A')
    // Home now offers Continue, with the one-line summary.
    await app.logo().click()
    await expect(app.homeAction()).toHaveText(W(lang).home.continue)
    await expect(page.getByTestId('ui2-home-summary')).toHaveText(`${fillIn(W(lang).home.approvedCourses, { n: expected.rows.length })} · ${fillIn(W(lang).home.nextStep, { step: VIEW_TEXT.projects.title[lang] })}`)
  })

  test('unknown-college: the short note with the printed text and one Fix; one tap chooses; approval is never blocked by it', async ({ page }) => {
    const expected = EXPECTED('unknown-college')
    const app = await openStep1(page, lang)
    await choose(page, app, PDF('unknown-college'))
    await expect(app.resultLine()).toHaveText(`${readLine(lang, expected.rows.length)} · ${expected.student.majorRaw}`)
    const note = page.getByTestId('college-note')
    await expect(note).toContainText(COLLEGE_COPY[lang].unrecognised.replace('{raw}', expected.student.collegeRaw))
    await expect(page.locator('select')).toHaveCount(0)
    await note.getByRole('button', { name: COLLEGE_COPY[lang].fix, exact: true }).click()
    await page.getByTestId('college-fix').getByRole('button', { name: collegeName('FCIT', lang) }).click()
    await expect(page.getByTestId('college-note')).toHaveCount(0)
    await expect(app.resultLine()).toHaveText(`${readLine(lang, expected.rows.length)} · ${collegeName('FCIT', lang)} · ${expected.student.majorRaw}`)
    await app.approve()
    await expect(app.heading('projects')).toBeVisible()
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3')).college)).toBe('FCIT')
  })

  test('a scanned PDF and an unsupported file stay on step 1 with their messages and their ways forward', async ({ page }) => {
    const app = await openStep1(page, lang)
    await fileInput(page).setInputFiles(PDF('scanned'))
    const scanned = page.getByTestId('scanned-pdf')
    await expect(scanned).toHaveAttribute('role', 'alert')
    await expect(scanned).toContainText(S(lang).scanned.message)
    await expect(scanned).toBeFocused()
    await expect(scanned.getByRole('button')).toHaveText([S(lang).scanned.another, S(lang).scanned.readPicture])
    await expect(app.heading('upload')).toBeVisible()
    await expect(app.uploadControl()).toBeVisible()
    await expect(app.resultLine()).toHaveCount(0)
    await noPercent(app.main(), 'the scanned-PDF message')
    // A file of another type, chosen in the picker, then one dropped on the area.
    await fileInput(page).setInputFiles({ name: 'notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('PK made up') })
    const error = page.getByTestId('upload-error')
    await expect(error).toContainText(W(lang).upload.errors.UNSUPPORTED_FILE_TYPE)
    await expect(page.getByTestId('scanned-pdf')).toHaveCount(0)
    // Its ways forward: another file, or the courses by hand. The example is never offered on step 1.
    await expect(error.getByRole('button')).toHaveText([S(lang).retry.another, S(lang).retry.manual])
    const gif = await page.evaluateHandle(() => { const d = new DataTransfer(); d.items.add(new File(['GIF89a'], 'anim.gif', { type: 'image/gif' })); return d })
    await app.uploadControl().dispatchEvent('drop', { dataTransfer: gif })
    await expect(page.getByTestId('upload-error')).toContainText(W(lang).upload.errors.UNSUPPORTED_FILE_TYPE)
    expect(await app.main().innerText()).not.toMatch(OFFERS_EXAMPLE)
    // "Enter courses manually": the card asks for the courses, and for the college once.
    await page.getByTestId('upload-error').getByRole('button', { name: S(lang).retry.manual }).click()
    await expect(app.resultLine()).toHaveText(fillIn(W(lang).result.added, { n: 0 }))
    await expect(page.getByTestId('college-question')).toBeVisible()
    await expect(app.approveReason()).toHaveText(R(lang).addOne)
  })

  test('a dropped transcript is read like a chosen one', async ({ page }) => {
    const app = await openStep1(page, lang)
    const bytes = [...readFileSync(PDF('fcit-cs-1p'))]
    const dt = await page.evaluateHandle(data => { const d = new DataTransfer(); d.items.add(new File([new Uint8Array(data)], 'made-up.pdf', { type: 'application/pdf' })); return d }, bytes)
    // While a file is over it, the area says "Drop your file here" (so its name changes: found by its test id).
    const zone = page.getByTestId('upload-drop-zone')
    await zone.dispatchEvent('dragenter', { dataTransfer: dt })
    await expect(zone).toContainText(S(lang).drop)
    await zone.dispatchEvent('drop', { dataTransfer: dt })
    await expect(app.resultLine()).toHaveText(`${readLine(lang, EXPECTED('fcit-cs-1p').rows.length)} · ${collegeName('FCIT', lang)} · COMPUTER SCIENCE`)
  })

  test.describe(() => {
    // The service worker answers page requests itself, out of page.route's reach; this test holds one.
    test.use({ serviceWorkers: 'block' })
    test('while the file is read: a skeleton of the result card and the stage, no percentage; Cancel goes back to the area', async ({ page }) => {
      const app = await openStep1(page, lang)
      let release
      const held = new Promise(resolve => { release = resolve })
      await page.route('**/assets/transcript-*.js', async route => { await held; await route.continue() })
      await fileInput(page).setInputFiles({ name: 'made-up.txt', mimeType: 'text/plain', buffer: Buffer.from('CPIT-240 Database Systems B+\nSTAT-110 Statistics B\n') })
      await expect(page.getByTestId('ui2-result-skeleton')).toBeVisible()
      await expect(page.getByTestId('reading-stage')).toHaveText(S(lang).stages.open)
      await noPercent(app.main(), 'reading')
      await expect(page.getByRole('progressbar')).toHaveCount(0)
      await page.getByTestId('cancel-reading').click()
      await expect(page.getByTestId('processing')).toHaveCount(0)
      await expect(app.uploadControl()).toBeFocused()
      const loaded = page.waitForResponse(/\/assets\/transcript-[^/]*\.js/)
      release()
      await loaded
      await page.waitForTimeout(1000)
      // The late result is ignored.
      await expect(app.resultLine()).toHaveCount(0)
      await expect(app.uploadControl()).toBeVisible()
    })

    test('a scanned PDF: the picture is never read on its own; "Choose another file" opens the picker; "Try reading the picture" starts it, and Cancel stops waiting', async ({ page }) => {
      const ocr = []
      page.on('request', request => { if (/\/ocr\//.test(request.url())) ocr.push(request.url()) })
      page.on('worker', worker => { if (/\/ocr\//.test(worker.url())) ocr.push(worker.url()) })
      const app = await openStep1(page, lang)
      const scanned = page.getByTestId('scanned-pdf')
      await fileInput(page).setInputFiles(PDF('scanned'))
      await expect(scanned).toBeFocused()
      await page.waitForTimeout(1000)
      expect(ocr, 'nothing reads the picture on its own').toEqual([])
      const chooser = page.waitForEvent('filechooser')
      await scanned.getByRole('button', { name: S(lang).scanned.another, exact: true }).click()
      await (await chooser).setFiles(PDF('fcit-cs-1p'))
      await expect(app.resultLine()).toContainText(collegeName('FCIT', lang))
      expect(ocr).toEqual([])
      await fileInput(page).setInputFiles(PDF('scanned'))
      await expect(scanned).toBeVisible()
      await scanned.getByRole('button', { name: S(lang).scanned.readPicture, exact: true }).click()
      await expect(page.getByTestId('processing')).toBeVisible()
      await expect(scanned).toHaveCount(0)
      await expect.poll(() => ocr.length, { timeout: 30_000 }).toBeGreaterThan(0)
      await page.getByTestId('cancel-reading').click()
      await expect(page.getByTestId('processing')).toHaveCount(0)
      await expect(app.uploadControl()).toBeFocused()
    })
  })

  test('from Home to an approved clean transcript within the build-profile click budget', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.home()
    await app.click(app.homeAction(), 'start')
    // Choosing the file in the system picker is not a click, as e2e/college-from-transcript.spec.js counts its
    // build-profile journey with an upload.
    await choose(page, app, PDF('fcit-cs-1p'))
    await app.approve()
    await expect(app.heading('projects')).toBeVisible()
    expect(app.clicks, app.steps.join(' → ')).toBeLessThanOrEqual(BUDGET.clicks['build-profile'])
  })

  test('?start=sample opens step 1 with the synthetic example, once; it is never offered on Home or step 1', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await page.goto(`/${lang}/?start=sample`)
    await expect(app.heading('upload')).toBeVisible()
    await expect(app.resultLine()).toHaveText(`${readLine(lang, demoCourses.length)} · ${collegeName('FCIT', lang)}`)
    await expect(page.getByTestId('ui2-synthetic')).toHaveText(W(lang).result.synthetic)
    const url = new URL(page.url())
    expect(url.searchParams.get('start'), 'the entry link is read once').toBe(null)
    expect(url.searchParams.get('app')).toBe('upload')
    await page.reload()
    await expect(app.uploadControl()).toBeVisible()
    await expect(app.resultLine()).toHaveCount(0)
    for (const view of ['home', 'upload']) {
      await app.goToView(view)
      expect(await app.main().innerText(), view).not.toMatch(OFFERS_EXAMPLE)
    }
  })

  test('pilot mode (?pilot=1): consent first, the trial bar, the trial transcript on step 1, Approve opens step 2; withdrawing deletes', async ({ page, baseURL }) => {
    const own = new URL(baseURL).origin, outside = []
    page.context().on('request', request => { const url = request.url(); if (!/^(data|blob):/.test(url) && new URL(url).origin !== own) outside.push(url) })
    const app = kamin(page, { ui: 'new', lang })
    await app.openPilot()
    await expect(app.pilotConsent()).toBeVisible()
    await expect(page.getByTestId('ui2-topbar').locator('xpath=..'), 'the page behind the trial consent is inert').toHaveAttribute('inert', '')
    await app.joinPilot()
    await expect(app.pilotBar()).toBeVisible()
    await expect(page.getByTestId('ui2-topbar').locator('xpath=..')).not.toHaveAttribute('inert', /.*/)
    // The trial's own synthetic transcript opens on step 1 (CPIT-425 is only in the trial fixture).
    await expect(app.heading('upload')).toBeVisible()
    await expect(app.resultLine()).toHaveText(`${readLine(lang, PILOT_FIXTURE.courses.length)} · ${collegeName(PILOT_FIXTURE.college, lang)}`)
    await expect(page.getByTestId('ui2-synthetic')).toBeVisible()
    await app.showReadRows()
    await expect(app.fixSheet().locator('tr[data-course="CPIT-425"]')).toBeVisible()
    await app.hideReadRows()
    await app.approve()
    await expect(app.heading('projects')).toBeVisible()
    const study = await page.evaluate(() => JSON.parse(localStorage.getItem('kamin-pilot-study-v1')))
    expect(study.transcript).toBe(PILOT_FIXTURE.id)
    expect(study.events.map(e => e.event)).toEqual(expect.arrayContaining(['study_joined', 'landing', 'synthetic_transcript_loaded', 'profile_completed']))
    await app.withdrawFromPilot()
    await expect(app.pilotNotice()).toContainText(PILOT_COPY[lang].withdrawn)
    await expect(app.pilotBar()).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('kamin-pilot-study-v1'))).toBe(null)
    expect(outside, 'no outside request').toEqual([])
  })

  test('no sideways scroll at 360px: Home, step 1, the result card, the Fix sheet and a message; no code or grade is cut', async ({ page }) => {
    await page.setViewportSize(NARROW)
    const app = kamin(page, { ui: 'new', lang })
    const wide = []
    const measure = async where => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (overflow > 0) wide.push(`${where}: the page is ${overflow}px too wide`)
      // Nothing inside an open sheet is wider than its box either (fields are checked below).
      const inSheet = await page.evaluate(() => [...document.querySelectorAll('.ui2-sheet-body, .ui2-sheet-body *')]
        .filter(el => el instanceof HTMLElement && !el.matches('input, textarea') && el.getClientRects().length > 0 && el.clientWidth > 1 && el.scrollWidth > el.clientWidth + 1)
        .map(el => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.scrollWidth}>${el.clientWidth}`))
      if (inSheet.length) wide.push(`${where}: ${inSheet.join(', ')}`)
    }
    await app.home(); await measure('Home')
    await app.homeAction().click(); await expect(app.uploadControl()).toBeVisible(); await measure('step 1')
    await choose(page, app, PDF('fcit-it-2p')); await measure('result card')
    await app.showReadRows(); await measure('Fix sheet')
    const cut = await page.evaluate(() => [...document.querySelectorAll('.ui2-sheet-body input')]
      .filter(el => el.getClientRects().length > 0 && el.scrollWidth > el.clientWidth).map(el => el.getAttribute('aria-label')))
    expect(cut, 'codes and grades are never cut').toEqual([])
    await app.hideReadRows()
    await fileInput(page).setInputFiles(PDF('scanned')); await expect(page.getByTestId('scanned-pdf')).toBeVisible(); await measure('scanned message')
    expect(wide).toEqual([])
  })

  for (const theme of ['light', 'dark']) test(`axe: 0 violations on Home and every state of step 1, and with the trial layer (${theme} theme)`, async ({ page }, info) => {
    test.setTimeout(150_000)
    await page.emulateMedia({ colorScheme: theme })
    await page.setViewportSize(info.project.name === 'mobile-chromium' ? PHONE : DESKTOP)
    const app = kamin(page, { ui: 'new', lang })
    const found = {}
    const check = async where => {
      const report = await new AxeBuilder({ page }).analyze()
      if (report.violations.length) found[where] = report.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)
    }
    await app.home()
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toContain(theme)
    await check('Home')
    await app.homeAction().click(); await expect(app.uploadControl()).toBeVisible(); await check('step 1')
    await app.main().getByRole('button', { name: W(lang).upload.why, exact: true }).click()
    await expect(app.sheet(W(lang).upload.whyTitle)).toBeVisible(); await check('step 1 + the Why? sheet')
    await page.keyboard.press('Escape')
    await choose(page, app, PDF('unknown-college'))
    await page.getByTestId('college-fix-open').click(); await expect(page.getByTestId('college-fix')).toBeVisible()
    await check('result card + the college fix')
    await app.showReadRows(); await check('the Fix sheet')
    await app.fixSheet().getByRole('button', { name: copy[lang].app.addRow }).click()
    await expect(app.fixSheet().getByRole('textbox', { name: copy[lang].app.courseName, exact: true })).toBeVisible()
    await check('the Fix sheet + the add-a-course form')
    await app.hideReadRows()
    await fileInput(page).setInputFiles(PDF('scanned')); await expect(page.getByTestId('scanned-pdf')).toBeVisible(); await check('the scanned-PDF message')
    await app.openPilot(); await expect(app.pilotConsent()).toBeVisible(); await check('the trial consent')
    await app.joinPilot(); await expect(app.pilotBar()).toBeVisible(); await expect(app.resultLine()).toBeVisible(); await check('the trial bar + step 1')
    expect(found).toEqual({})
  })
})
