// Task 18 · the trial with FCIT students, browser-only: consent first, the synthetic transcript from a
// local fixture, the end-of-session form, the anonymous study file (downloaded, never sent), withdrawal,
// and no change at all for normal users. Task 70: the routes are the interface's (the trial transcript opens on step 1
// right after joining; approving opens step 2; "delete everything" is Settings'); the trial layer is the same component.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { kamin } from './roles.js'
import { validate } from '../tests/helpers/miniJsonSchema.js'

const schema = JSON.parse(readFileSync('src/pilot/study-file.schema.json', 'utf8'))
const fixture = JSON.parse(readFileSync('src/pilot/synthetic-transcripts.json', 'utf8')).transcripts[0]
const STUDY_KEY = 'kamin-pilot-study-v1'
const L = {
  ar: { agree: /أوافق على المشاركة/, start: 'ابدأ الجلسة', demo: 'جرّب المثال التوضيحي', consent: /أوافق صراحةً/, approve: /أعتمد السجل/, finish: 'إنهاء الجلسة', withdraw: 'الانسحاب من الدراسة', withdrawYes: 'نعم، انسحب واحذف', download: 'نزّل ملف الدراسة المجهول', end: 'احذف بيانات الجلسة من هذا الجهاز', decline: /لا، أريد استخدام كامن/ },
  en: { agree: /agree to take part/, start: 'Start the session', demo: 'Try synthetic demo', consent: /I explicitly consent/, approve: /Approve transcript/, finish: 'Finish the session', withdraw: 'Withdraw from the study', withdrawYes: 'Yes, withdraw and delete', download: 'Download my anonymous study file', end: 'Delete the session data from this device', decline: /No, I want to use Kamin/ },
}

function watchNetwork(page, baseURL) {
  const own = new URL(baseURL).origin, outside = []
  page.context().on('request', request => { const url = request.url(); if (/^(data|blob):/.test(url)) return; if (new URL(url).origin !== own) outside.push(url) })
  return outside
}
const study = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), STUDY_KEY)

async function joinAndLoad(page, lang) {
  const l = L[lang]
  await page.goto(`/${lang}/?pilot=1`)
  const consent = page.getByRole('dialog', { name: lang === 'ar' ? 'المشاركة في تجربة كامن' : 'Taking part in the Kamin trial' })
  await expect(consent).toBeVisible()
  await expect(consent.getByRole('button', { name: l.start })).toBeDisabled()
  await consent.getByRole('checkbox', { name: l.agree }).check()
  await consent.getByRole('button', { name: l.start }).click()
  await expect(page.getByTestId('pilot-bar')).toBeVisible()
  // The trial transcript comes from the local fixture (CPIT-425 is only in the fixture, not in the normal demo).
  const app = kamin(page, { ui: 'new', lang })
  await expect(app.resultLine()).toBeVisible()
  await app.showReadRows()
  await expect(app.fixSheet().locator('table input[value="CPIT-425"]').first()).toBeVisible()
  await app.hideReadRows()
  return app
}

test('pilot mode: consent first, synthetic transcript, form, review and a valid anonymous study file, with no outside request', async ({ page, baseURL }) => {
  test.setTimeout(120_000)
  const outside = watchNetwork(page, baseURL)
  // As in Task 16 (e2e/no-external-requests.spec.js): a blocked outside call never shows up as a request, so CSP violations are watched too.
  await page.addInitScript(() => { window.__cspViolations = []; document.addEventListener('securitypolicyviolation', e => window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`)) })
  const l = L.en
  const app = await joinAndLoad(page, 'en')
  await app.approve()
  await expect(app.heading('projects')).toBeVisible()

  await page.getByTestId('pilot-bar').getByRole('button', { name: l.finish }).click()
  const form = page.getByRole('dialog', { name: 'End of the session' })
  for (const task of ['build-profile', 'find-evidence', 'understand-recommendation', 'choose-learning-step', 'save-and-restore'])
    await form.locator(`[data-task="${task}"]`).getByLabel('Done alone').check()
  await form.locator('[data-task="correct-withdraw-delete"]').getByLabel('With help').check()
  await form.getByLabel('4', { exact: true }).check()
  const comment = form.getByLabel(/Comment \(optional\)/)
  await comment.fill('Write to me at student@example.com')
  await expect(form.getByRole('alert')).toContainText('email address or a long number')
  await expect(form.getByRole('button', { name: l.download })).toBeDisabled()
  await comment.fill('The comparison button was hard to find.')
  await form.getByRole('button', { name: 'Save the answers' }).click()
  await expect(form.getByTestId('pilot-file-preview')).toContainText('"choose-learning-step": "success"')

  const axe = await new AxeBuilder({ page }).include('.pilot-dialog').analyze()
  expect(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact)), JSON.stringify(axe.violations)).toEqual([])

  const downloading = page.waitForEvent('download')
  await form.getByRole('button', { name: l.download }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^kamin-study-K-[A-Z2-9]{6}\.json$/)
  const file = JSON.parse(readFileSync(await download.path(), 'utf8'))
  expect(validate(file, schema)).toEqual([])
  expect(file).toMatchObject({ transcript: fixture.id, clarity: 4, comment: 'The comparison button was hard to find.', tasks: { 'correct-withdraw-delete': 'with-help' } })
  expect(file.events.map(e => e.event)).toEqual(expect.arrayContaining(['study_joined', 'synthetic_transcript_loaded', 'profile_completed', 'feedback_submitted']))
  const text = JSON.stringify(file)
  for (const course of fixture.courses) for (const value of [course.code, course.name.en, course.name.ar]) expect(text).not.toContain(value)

  await form.getByRole('button', { name: l.end }).click()
  await expect(page.getByTestId('notice') /* the interface's one message (pilot-notice in the old) */).toContainText('deleted from this device')
  await expect(page.getByTestId('pilot-bar')).toHaveCount(0)
  expect(await study(page)).toBeNull()
  expect(outside).toEqual([])
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([])
})

test('withdrawing from the study deletes the local queue at once (Arabic)', async ({ page }) => {
  const l = L.ar
  await joinAndLoad(page, 'ar')
  expect((await study(page)).events.map(e => e.event)).toEqual(expect.arrayContaining(['study_joined', 'synthetic_transcript_loaded']))
  await page.getByTestId('pilot-bar').getByRole('button', { name: l.withdraw }).click()
  await page.getByRole('dialog', { name: l.withdraw }).getByRole('button', { name: l.withdrawYes }).click()
  await expect(page.getByTestId('notice') /* the interface's one message (pilot-notice in the old) */).toContainText('انسحبت من الدراسة')
  expect(await study(page)).toBeNull()
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('kamin-pilot')))).toEqual([])
  await page.goto('/ar/')
  await expect(page.getByTestId('pilot-bar')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'المشاركة في تجربة كامن' })).toHaveCount(0)
})

test('"delete everything" during the trial removes the profile, keeps the study file and says so', async ({ page }) => {
  const l = L.ar
  const app = await joinAndLoad(page, 'ar')
  await app.approve()
  await expect(app.heading('projects')).toBeVisible()
  // Task 44: a saved project's counts in the queue (as the project form records them); "delete everything" removes them.
  await page.evaluate(key => {
    const s = JSON.parse(localStorage.getItem(key))
    s.events.push({ event: 'suggest_shown', at: s.joinedAt, count: 3, engine: 'kamin-project-suggest-improved-v1' }, { event: 'suggest_kept', at: s.joinedAt, count: 2, engine: 'kamin-project-suggest-improved-v1' })
    localStorage.setItem(key, JSON.stringify(s))
  }, STUDY_KEY)
  await app.askDeleteEverything()
  await expect(page.getByTestId('delete-study-kept')).toContainText('يبقى ملف الدراسة المجهول')
  await app.confirmDeleteEverything()
  const done = page.getByTestId('deleted-confirmation')
  await expect(done).toContainText('حُذفت بياناتك من هذا الجهاز')
  await expect(done.getByTestId('study-kept')).toBeVisible()
  const kept = await study(page)
  expect(kept).not.toBeNull()
  expect(JSON.stringify(kept)).not.toMatch(/CPIT-|STAT-110/)
  expect(kept.events.filter(e => /^(suggest|step)_/.test(e.event))).toEqual([])
  expect(kept.events.map(e => e.event)).toContain('study_joined')
  expect(await page.evaluate(() => sessionStorage.getItem('kamin-session-v3'))).toBeNull()
})

test('declining the trial leaves Kamin as usual and records nothing', async ({ page }) => {
  await page.goto('/en/?pilot=1')
  await page.getByRole('button', { name: L.en.decline }).click()
  await expect(page.getByTestId('pilot-bar')).toHaveCount(0)
  expect(new URL(page.url()).searchParams.has('pilot')).toBe(false)
  expect(await study(page)).toBeNull()
})

for (const lang of ['ar', 'en']) test(`outside pilot mode nothing changes: no consent screen, no bar, the usual demo, nothing stored: ${lang}`, async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang })
  await page.goto(`/${lang}/?start=sample`)
  await app.showReadRows()
  await expect(app.fixSheet().locator('table input[value="CPIT-499"]').first()).toBeVisible()
  await expect(app.fixSheet().locator('table input[value="CPIT-425"]')).toHaveCount(0)
  await expect(page.getByTestId('pilot-bar')).toHaveCount(0)
  await expect(page.locator('.pilot-dialog')).toHaveCount(0)
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('kamin-pilot')))).toEqual([])
})

test('the approved consent screen shows no draft notice, passes axe and fits 360px in Arabic', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/ar/?pilot=1')
  await expect(page.locator('.pilot-consent')).toBeVisible()
  await expect(page.getByTestId('pilot-draft-notice')).toHaveCount(0) // approved by the supervisor (2026-11-11)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const axe = await new AxeBuilder({ page }).include('.pilot-dialog').analyze()
  expect(axe.violations.filter(v => ['serious', 'critical'].includes(v.impact)), JSON.stringify(axe.violations)).toEqual([])
})
