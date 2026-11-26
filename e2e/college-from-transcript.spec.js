// Task 55 · the college comes from the transcript; there is no college dropdown anywhere.
// Uses the made-up KAU fixtures (Task 50): science-2p (Science, no approved course map yet) and unknown-college (a
// college KAMIN does not know). Task 70: rewritten on the interface (step 1's result card, Profile's college note,
// Settings → My courses). The FCIT fixtures' one line and the click budget are e2e/next-upload.spec.js's tests (the
// mapping is in log/task-70.md).
import { test, expect } from '@playwright/test'
import { COLLEGE_COPY } from '../src/content/collegeCopy.js'
import { COLLEGES } from '../src/catalog/colleges.js'
import { CHANGE_REASONS } from '../src/evidence/recompute.js'
import { copy } from '../src/i18n.js'
import { LANGS, NEW_APP_VIEWS, kamin } from './roles.js'

const KAU_PDF = name => `tests/fixtures/transcripts/${name}.pdf`
const C = lang => COLLEGE_COPY[lang]
const label = (id, lang) => COLLEGES.find(c => c.id === id).labels[lang]
const fileInput = page => page.locator('#ui2-transcript-file')

async function uploadKau(page, lang, name) {
  const app = kamin(page, { ui: 'new', lang })
  await app.goToView('upload')
  await fileInput(page).setInputFiles(KAU_PDF(name))
  await expect(app.resultLine()).toBeVisible()
  return app
}
// Selects whose label (or name) speaks of a college: there must be none.
const collegeSelects = page => page.evaluate(() => [...document.querySelectorAll('select')].filter(select => {
  const text = [select.getAttribute('aria-label'), select.name, select.id, select.closest('label')?.textContent, ...[...(select.labels || [])].map(l => l.textContent)].join(' ')
  return /college|faculty|كلية|كليت/i.test(text)
}).length)

for (const lang of LANGS) {
  test(`science-2p: Faculty of Science and its major, the "no approved map yet" note, no list; approval works; Profile says why there is no capability: ${lang}`, async ({ page }) => {
    const app = await uploadKau(page, lang, 'science-2p')
    await expect(app.resultLine()).toContainText(label('SCI', lang))
    await expect(app.resultLine()).toContainText('MATHEMATICS')
    await expect(page.getByTestId('college-no-map')).toHaveText(C(lang).noMap)
    await expect(page.getByTestId('college-fix')).toHaveCount(0)
    expect(await collegeSelects(page)).toBe(0)
    await app.approve()
    await expect(app.heading('projects')).toBeVisible()
    await app.goToView('profile')
    const prompt = page.getByTestId('college-prompt')
    await expect(prompt).toContainText(C(lang).saved)
    await expect(prompt).toContainText(label('SCI', lang))
    await expect(app.capabilityRows()).toHaveCount(0)
    // No horizontal page scroll at the phone's width either (the mobile project runs this too).
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test(`unknown-college approved without a fix: Profile's note with the printed text; one tap fixes it and recomputes: ${lang}`, async ({ page }) => {
    const app = await uploadKau(page, lang, 'unknown-college')
    await expect(page.getByTestId('college-note')).toContainText(C(lang).unrecognised.replace('{raw}', 'FACULTY OF ECONOMICS & ADMIN.'))
    // Approve without fixing it: the college never blocks approval.
    await app.approve()
    await expect(app.heading('projects')).toBeVisible()
    await app.goToView('profile')
    const prompt = page.getByTestId('college-prompt')
    await expect(prompt).toContainText('FACULTY OF ECONOMICS & ADMIN.')
    await expect(prompt).toContainText(C(lang).saved)
    await expect(app.capabilityRows()).toHaveCount(0)
    // Profile's fix: open, one tap on FCIT; capabilities are recomputed and "what changed" says why.
    await prompt.getByRole('button', { name: C(lang).fix }).click()
    await page.getByTestId('college-fix-dashboard').getByRole('button', { name: label('FCIT', lang) }).click()
    await expect(page.getByTestId('what-changed')).toContainText(CHANGE_REASONS['college-changed'][lang])
    await expect(app.capabilityRows().first()).toBeVisible()
    await expect(page.getByTestId('college-prompt')).toHaveCount(0)
    expect(await collegeSelects(page)).toBe(0)
  })

  test(`no college <select> on any view (Task 55): ${lang}`, async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.goToView('upload')
    expect(await collegeSelects(page), 'step 1').toBe(0)
    // The fix opens buttons, not a dropdown (step 1 offers it for a college it could not recognise).
    await fileInput(page).setInputFiles(KAU_PDF('unknown-college'))
    await page.getByTestId('college-note').getByTestId('college-fix-open').click()
    await expect(page.getByTestId('college-fix').getByRole('button')).toHaveCount(COLLEGES.length)
    expect(await collegeSelects(page), 'step 1, list open').toBe(0)
    await page.goto(`/${lang}/?start=sample`)
    await expect(app.resultLine()).toContainText(label('FCIT', lang))
    await app.reviewConsent().check()
    await app.approveButton().click()
    await expect(app.approvedView()).toBeVisible()
    const seen = []
    await app.walkViews(async view => { expect(await collegeSelects(page), view).toBe(0); seen.push(view) })
    expect(seen).toEqual(NEW_APP_VIEWS)
    // My courses shows the college read from the transcript, with no way to pick another there.
    await app.openMyData()
    await expect(page.getByTestId('my-data-college')).toHaveText(label('FCIT', lang))
    await expect(page.getByTestId('my-data').getByTestId('college-fix')).toHaveCount(0)
  })

  test(`manual entry: "Which college are these courses from?" once at the top; one tap chooses: ${lang}`, async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.goToView('upload')
    // Manual entry is offered when a file cannot be read.
    await fileInput(page).setInputFiles({ name: 'not-a-transcript.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([0, 1, 2, 3]) })
    await page.getByRole('button', { name: copy[lang].screens.start.retry.manual, exact: true }).click()
    const question = page.getByTestId('college-question')
    await expect(question).toContainText(C(lang).which)
    await question.getByRole('button', { name: label('FCIT', lang) }).click()
    await expect(page.getByTestId('college-question')).toHaveCount(0)
    expect(await collegeSelects(page)).toBe(0)
  })
}
