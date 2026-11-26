// The knowledge explorer (KnowledgeWorkspace.jsx, unchanged). Task 70: the old landing page's "Explore further" search
// box and the old menu's knowledge view are deleted; the tool is Help → Reviewer tools → the knowledge explorer
// (?app=help#knowledge, Task 68), where these run. The personal-profile test builds its profile on the interface
// (step 3's consent, a goal on My plan).
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { kamin } from './roles.js'

async function openLab(page, lang = 'ar') {
  await page.goto(`/${lang}/?app=help#knowledge`)
  await page.getByRole('tab', { name: lang === 'ar' ? 'مختبر SPARQL' : 'SPARQL lab', exact: true }).click()
}
async function run(page) { await page.getByRole('button', { name: 'شغّل الاستعلام', exact: true }).click(); await expect(page.getByRole('heading', { name: 'نتيجة الاستعلام', exact: true })).toBeVisible({ timeout: 20000 }) }

test('reference search and real browser SPARQL work without a student profile', async ({ page }) => {
  await openLab(page)
  await expect(page.getByLabel('نطاق البيانات')).toHaveValue('reference')
  await run(page)
  await expect(page.locator('.query-table [title="urn:kamin:skill:database"]').first()).toBeVisible()
  await page.getByLabel('استعلام SPARQL — قابل للتعديل', { exact: true }).fill('ASK { GRAPH <urn:kamin:graph:reference> { ?s <urn:kamin:requiresCapability> ?o } }')
  await expect(page.locator('.query-table')).toHaveCount(0)
  await run(page)
  await expect(page.locator('.query-answer')).toContainText('نعم')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3') || '{}').courses || [])).toEqual([])
})

test('synthetic profile queries and JSON export are explicitly scoped and do not populate the student file', async ({ page }) => {
  await openLab(page)
  await page.getByLabel('ابدأ بسؤال جاهز').selectOption('inferred')
  await run(page)
  await expect(page.locator('.query-results')).toContainText('لا توجد نتائج')
  await page.getByLabel('نطاق البيانات').selectOption('demo')
  await run(page)
  await expect(page.locator('.query-table [title="urn:kamin:hasInterestContextFor"]').first()).toBeVisible()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'تنزيل النتائج JSON', exact: true }).click()
  expect((await pending).suggestedFilename()).toBe('kamin-query-results.json')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3') || '{}').courses || [])).toEqual([])
})

test('SERVICE and updates are blocked before any external request', async ({ page }) => {
  await openLab(page)
  const outbound = []; page.on('request', r => { if (r.url().includes('query-private.invalid')) outbound.push(r.url()) })
  await page.locator('#sparql-query').fill('SELECT * WHERE { OPTIONAL { SERVICE <https://query-private.invalid> { ?s ?p ?o } } }')
  await page.getByRole('button', { name: 'شغّل الاستعلام', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('SERVICE وFROM غير متاحين', { timeout: 20000 })
  expect(outbound).toEqual([])
  await page.locator('#sparql-query').fill('DELETE WHERE { ?s ?p ?o }')
  await page.getByRole('button', { name: 'شغّل الاستعلام', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('للقراءة فقط')
})

test('personal queries require fresh local permission and clearing it removes the visible results', async ({ page }) => {
  const app = kamin(page, { ui: 'new', lang: 'ar' })
  await app.goToView('interests')
  await app.click(app.interestsConsent(), 'interests consent')
  // Task 76: the goal is chosen on My plan's chips, so it is stored as a pathway id (job-data-analyst), as students save
  // it. Task 70 had to use an old direction here: R2's premise "the pathway supports the goal" had no object for a
  // pathway id ({"@id": null}) and the query failed. The engine now names the goal node (log/task-76.md).
  await app.openGoals()
  await app.chooseGoal('data')
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('kamin-session-v3')).goal)).toBe('job-data-analyst')
  await openLab(page)
  await page.getByLabel('نطاق البيانات').selectOption('personal')
  await expect(page.getByRole('button', { name: 'شغّل الاستعلام', exact: true })).toBeDisabled()
  const consent = page.getByRole('checkbox', { name: /أسمح بقراءة ملفي محليًا/ })
  await consent.check()
  await page.getByLabel('ابدأ بسؤال جاهز').selectOption('inferred')
  await run(page)
  await expect(page.locator('.query-table [title="urn:kamin:hasGoalContextFor"]').first()).toBeVisible()
  await consent.uncheck()
  await expect(page.locator('.query-results')).toBeEmpty()
  await expect(page.getByRole('button', { name: 'شغّل الاستعلام', exact: true })).toBeDisabled()
  const state = await page.evaluate(() => sessionStorage.getItem('kamin-session-v3'))
  expect(state).not.toContain('SELECT')
  expect(state).not.toContain('allowPersonal')
})

test('knowledge tools remain accessible and fit mobile and English layouts', async ({ page }) => {
  await openLab(page, 'en')
  await page.getByRole('button', { name: 'Run query', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Query result', exact: true })).toBeVisible({ timeout: 20000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const a = await new AxeBuilder({ page }).analyze()
  expect(a.violations.filter(v => ['serious', 'critical'].includes(v.impact)), JSON.stringify(a.violations)).toEqual([])
})
