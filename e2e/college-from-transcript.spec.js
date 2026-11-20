// Task 55 · the college comes from the transcript; there is no college dropdown anywhere.
// Uses the made-up KAU fixtures (Task 50): fcit-cs-1p and fcit-it-2p (FCIT), science-2p (Science, no approved
// course map yet) and unknown-college (a college KAMIN does not know).
import { test, expect } from './fixtures.js'
import { readFileSync } from 'node:fs'
import { COLLEGE_COPY } from '../src/content/collegeCopy.js'
import { COLLEGES } from '../src/catalog/colleges.js'
import { CHANGE_REASONS } from '../src/evidence/recompute.js'
import { APP_VIEWS, openAppWindow, loadSample, approveSample, openAppView } from './nav.js'
import { Journey } from './usability-lib.js'
import { viewToParam } from '../src/navigation.js'

const BUDGET = JSON.parse(readFileSync(new URL('./usability-budget.json', import.meta.url), 'utf8'))

const LANGS = ['ar', 'en']
const KAU_PDF = name => `tests/fixtures/transcripts/${name}.pdf`
const C = lang => COLLEGE_COPY[lang]
const label = (id, lang) => COLLEGES.find(c => c.id === id).labels[lang]
const appParam = page => new URL(page.url()).searchParams.get('app')
const fileInput = page => page.locator('#kamin-transcript-file')

async function uploadKau(page, lang, name) {
  await openAppWindow(page, lang)
  await fileInput(page).setInputFiles(KAU_PDF(name))
  await expect(page.getByTestId('review-summary')).toBeVisible()
}
async function approve(page, lang) {
  const box = page.getByTestId('review-approve')
  await box.getByRole('checkbox').check()
  await box.getByRole('button').click()
  await expect.poll(() => appParam(page)).toBe('dashboard')
}
// Selects whose label (or name) speaks of a college: there must be none.
const collegeSelects = page => page.evaluate(() => [...document.querySelectorAll('select')].filter(select => {
  const text = [select.getAttribute('aria-label'), select.name, select.id, select.closest('label')?.textContent, ...[...(select.labels || [])].map(l => l.textContent)].join(' ')
  return /college|faculty|كلية|كليت/i.test(text)
}).length)

for (const lang of LANGS) {
  test(`fcit-cs-1p: one line with the college and the major, no list; capabilities right after approval: ${lang}`, async ({ page }) => {
    await uploadKau(page, lang, 'fcit-cs-1p')
    const line = page.getByTestId('college-current')
    await expect(line).toContainText(`${C(lang).college}: ${label('FCIT', lang)}`)
    await expect(line).toContainText(`${C(lang).major}: COMPUTER SCIENCE`)
    await expect(line.getByRole('button', { name: C(lang).notRight })).toBeVisible()
    await expect(page.getByTestId('college-fix')).toHaveCount(0)
    await expect(page.getByTestId('college-no-map')).toHaveCount(0)
    expect(await collegeSelects(page)).toBe(0)
    await approve(page, lang)
    await expect(page.locator('.capability-row').first()).toBeVisible()
    await expect(page.getByTestId('college-prompt')).toHaveCount(0)
  })

  test(`first visit, fcit-it-2p: capabilities with no college step, within the click budget: ${lang}`, async ({ page }) => {
    await openAppWindow(page, lang)
    const j = new Journey(page, 'build-profile-upload'); await j.start()
    await fileInput(page).setInputFiles(KAU_PDF('fcit-it-2p'))
    await expect(page.getByTestId('college-current')).toContainText(label('FCIT', lang))
    const box = page.getByTestId('review-approve')
    await j.check(box.getByRole('checkbox'), 'consent')
    await j.click(box.getByRole('button'), 'approve')
    await expect(page.locator('.capability-row').first()).toBeVisible()
    expect(j.result().clicks).toBeLessThanOrEqual(BUDGET.clicks['build-profile'])
  })

  test(`science-2p: Faculty of Science and its major, the "no approved map yet" note, no list; approval works: ${lang}`, async ({ page }) => {
    await uploadKau(page, lang, 'science-2p')
    const line = page.getByTestId('college-current')
    await expect(line).toContainText(`${C(lang).college}: ${label('SCI', lang)}`)
    await expect(line).toContainText(`${C(lang).major}: MATHEMATICS`)
    await expect(page.getByTestId('college-no-map')).toHaveText(C(lang).noMap)
    await expect(page.getByTestId('college-fix')).toHaveCount(0)
    expect(await collegeSelects(page)).toBe(0)
    await approve(page, lang)
    const prompt = page.getByTestId('college-prompt')
    await expect(prompt).toContainText(C(lang).saved)
    await expect(prompt).toContainText(label('SCI', lang))
    await expect(page.locator('.capability-row')).toHaveCount(0)
    // No horizontal page scroll at the phone's width either (the mobile project runs this too).
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test(`unknown-college: the note with the printed text and one Fix; approval works; the fix is one tap and recomputes: ${lang}`, async ({ page }) => {
    await uploadKau(page, lang, 'unknown-college')
    const note = page.getByTestId('college-note')
    await expect(note).toContainText(C(lang).unrecognised.replace('{raw}', 'FACULTY OF ECONOMICS & ADMIN.'))
    await expect(note.getByRole('button', { name: C(lang).fix })).toBeVisible()
    await expect(page.getByTestId('college-fix')).toHaveCount(0)
    // The review screen's fix: open, then one tap on the college.
    await note.getByRole('button', { name: C(lang).fix }).click()
    await page.getByTestId('college-fix').getByRole('button', { name: label('MED', lang) }).click()
    await expect(page.getByTestId('college-current')).toContainText(label('MED', lang))
    await expect(page.getByTestId('college-current')).toContainText(`${C(lang).major}: ACCOUNTING`)
    // The same file again (from the start screen): the transcript's unrecognised college is read again.
    // Approve without fixing it: the college never blocks approval.
    await openAppView(page, 'start', lang)
    await fileInput(page).setInputFiles(KAU_PDF('unknown-college'))
    await expect(page.getByTestId('college-note')).toBeVisible()
    await approve(page, lang)
    const prompt = page.getByTestId('college-prompt')
    await expect(prompt).toContainText('FACULTY OF ECONOMICS & ADMIN.')
    await expect(prompt).toContainText(C(lang).saved)
    await expect(page.locator('.capability-row')).toHaveCount(0)
    // The dashboard's fix: open, one tap on FCIT; capabilities are recomputed and "what changed" says why.
    await prompt.getByRole('button', { name: C(lang).fix }).click()
    await page.getByTestId('college-fix-dashboard').getByRole('button', { name: label('FCIT', lang) }).click()
    const panel = page.getByTestId('what-changed')
    await expect(panel).toContainText(CHANGE_REASONS['college-changed'][lang])
    await expect(page.locator('.capability-row').first()).toBeVisible()
    await expect(page.getByTestId('college-prompt')).toHaveCount(0)
    expect(await collegeSelects(page)).toBe(0)
  })

  test(`no college <select> on any view (Task 55): ${lang}`, async ({ page }) => {
    await openAppWindow(page, lang)
    const seen = []
    expect(await collegeSelects(page), 'start').toBe(0); seen.push('start')
    await loadSample(page, lang)
    await expect(page.getByTestId('college-current')).toContainText(label('FCIT', lang))
    expect(await collegeSelects(page), 'review').toBe(0); seen.push('review')
    // "Not right?" opens buttons, not a dropdown.
    await page.getByTestId('college-current').getByRole('button', { name: C(lang).notRight }).click()
    await expect(page.getByTestId('college-fix').getByRole('button')).toHaveCount(COLLEGES.length)
    await expect(page.getByTestId('college-fix').getByRole('button', { name: label('FCIT', lang) })).toHaveAttribute('aria-pressed', 'true')
    expect(await collegeSelects(page), 'review, list open').toBe(0)
    await approveSample(page, lang)
    for (const view of APP_VIEWS.filter(v => !['start', 'review'].includes(v))) {
      await openAppView(page, view, lang)
      await expect.poll(() => appParam(page)).toBe(viewToParam(view))
      await expect(page.getByTestId('view-loading')).toHaveCount(0)
      expect(await collegeSelects(page), view).toBe(0)
      seen.push(view)
    }
    expect(seen).toEqual(APP_VIEWS)
    // My data shows the college read from the transcript, with no way to pick another there.
    await openAppView(page, 'mydata', lang)
    await expect(page.getByTestId('my-data-college')).toHaveText(label('FCIT', lang))
    await expect(page.getByTestId('my-data').getByTestId('college-fix')).toHaveCount(0)
  })

  test(`manual entry: "Which college are these courses from?" once at the top; one tap chooses: ${lang}`, async ({ page }) => {
    await openAppWindow(page, lang)
    await page.getByTestId('start-more').locator('summary').click()
    await page.getByRole('button', { name: lang === 'ar' ? 'أدخل المقررات يدويًا' : 'Enter courses manually' }).click()
    const question = page.getByTestId('college-question')
    await expect(question).toContainText(C(lang).which)
    await question.getByRole('button', { name: label('FCIT', lang) }).click()
    await expect(page.getByTestId('college-question')).toHaveCount(0)
    await expect(page.getByTestId('college-current')).toContainText(label('FCIT', lang))
    expect(await collegeSelects(page)).toBe(0)
  })
}
