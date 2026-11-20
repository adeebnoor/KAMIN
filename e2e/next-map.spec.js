// Task 74 added My map to Profile; Task 75 (Amjd, 2026-11-19: Task 74's layered map "is not acceptable") makes it the old
// interface's "Show connections" graph, the supervisor's map, reused as it was (src/components/ShowConnections.jsx, shared
// with the old interface; src/ui2/components/ConnectionsMap.jsx, lazy). With the approved synthetic example: loaded only
// when opened; "Pathway to explore", the old heading, the four questions, the nodes, the legend and the inspector, the
// inference proof and the two old details; a tap on a capability node selects it, as in the old graph, and opens Profile's
// reasons sheet; a tap on another node only selects it; a goal chosen in My plan is the map's pathway; "Edit my interests &
// goal" opens step 3 in edit mode; at 360px the page never scrolls sideways (the map scrolls in its own labelled region, as
// before); Arabic right to left; axe 0 violations in light and dark. Desktop and phone projects.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { targetProfiles } from '../src/matching/targets.js'
import { VIEW_TEXT } from '../src/ui2/views.js'
import { LANGS, kamin } from './roles.js'

const NARROW = { width: 360, height: 780 }
const PERCENT = /\d\s?[%٪]|[%٪]\s?\d/
const tr = (lang, ar, en) => (lang === 'ar' ? ar : en)
const HEADING = { ar: 'أشخاص. اهتمامات. قدرات. فرص.', en: 'People. Interests. Capabilities. Opportunities.' }
const QUESTIONS = { ar: ['كيف يرتبط المسار بأدلتي؟', 'أين تقودني اهتماماتي؟', 'مع من يمكنني التعاون؟', 'ما خطوة التعلم المرتبطة؟'], en: ['How does this pathway connect to my evidence?', 'Where can my interests lead?', 'Who could I collaborate with?', 'What learning step connects?'] }

async function onMap(page, lang) {
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  await app.home()
  await app.openMap()
  return app
}

for (const lang of LANGS) test.describe(`My map (${lang})`, () => {
  test('loads only when opened; the old "Show connections" graph, its controls and its parts, as in the old interface', async ({ page }) => {
    const chunks = []
    page.on('request', request => { if (/\/assets\/ConnectionsMap-[^/]+\.js$/.test(new URL(request.url()).pathname)) chunks.push(request.url()) })
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    await app.goToView('profile')
    await expect(app.capabilityRows().first()).toBeVisible()
    expect(chunks, 'the map is not loaded before it is opened').toEqual([])
    await app.openMap()
    expect(chunks.length, 'its own chunk, loaded on opening').toBeGreaterThan(0)
    const map = app.myMap()
    await expect(map.getByLabel(tr(lang, 'المسار الذي أريد استكشافه', 'Pathway to explore'))).toHaveValue('job-data-analyst')
    await expect(map.getByRole('heading', { level: 2, name: HEADING[lang], exact: true })).toBeVisible()
    for (const question of QUESTIONS[lang]) await expect(map.getByRole('button', { name: question, exact: true })).toBeVisible()
    await expect(map.getByRole('region', { name: tr(lang, 'شبكة العلاقات التفاعلية؛ يمكن تمريرها أفقيًا', 'Interactive relationship network; horizontally scrollable') })).toBeVisible()
    await expect(app.mapNodes('person')).toHaveCount(1)
    await expect(app.mapNodes('evidence').first(), 'a reviewed course of the example').toBeVisible()
    await expect(app.mapNodes('skill').first()).toBeVisible()
    await expect(app.mapNodes('job').first()).toContainText(targetProfiles.find(t => t.id === 'job-data-analyst').title[lang])
    await expect(map.locator('.relationship-legend')).toContainText(tr(lang, 'دليل مُراجع', 'Reviewed evidence'))
    await expect(map.getByText(tr(lang, 'اختر أي عقدة لتكشف علاقاتها', 'SELECT ANY NODE TO INSPECT ITS LINKS'), { exact: true })).toBeVisible()
    for (const summary of [tr(lang, 'تفاصيل أبعاد ملفي', 'My profile dimensions'), tr(lang, 'مسار الدليل الأكاديمي إلى الفرصة', 'Academic evidence path to the opportunity')]) await expect(map.getByText(summary, { exact: true })).toBeVisible()
    // The question buttons work as before.
    await map.getByRole('button', { name: QUESTIONS[lang][3], exact: true }).click()
    await expect(map.getByRole('button', { name: QUESTIONS[lang][3], exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(PERCENT.test(await map.innerText()), 'no percentage').toBe(false)
  })

  test('a tap on a capability node selects it and opens Profile\'s reasons sheet; focus returns; another node only selects', async ({ page }) => {
    const app = await onMap(page, lang)
    const node = app.mapNodes('skill').first()
    const name = (await node.locator('strong').innerText()).trim()
    await node.click()
    const sheet = app.capabilitySheet()
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('heading', { level: 2, name, exact: true })).toBeVisible()
    await expect(sheet.getByTestId('capability-why')).not.toBeEmpty()
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(node).toBeFocused()
    await expect(node, 'selected, as in the old graph').toHaveAttribute('aria-pressed', 'true')
    await expect(app.myMap().locator('.relationship-node-info h3')).toHaveText(name)
    // A course: selected, no sheet.
    await app.mapNodes('evidence').first().click()
    await expect(app.mapNodes('evidence').first()).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('the pathway is the goal chosen in My plan; "Edit my interests & goal" opens step 3 in edit mode', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    const goal = targetProfiles.find(t => t.id === 'job-software-engineer')
    await page.evaluate(id => { const key = 'kamin-session-v3'; const s = JSON.parse(sessionStorage.getItem(key)); s.goals = [id]; sessionStorage.setItem(key, JSON.stringify(s)) }, goal.id)
    await app.goToView('profile')
    await app.click(app.main().getByRole('button', { name: app.w.profile.map, exact: true }), 'my map')
    await expect(app.myMap().getByLabel(tr(lang, 'المسار الذي أريد استكشافه', 'Pathway to explore'))).toHaveValue(goal.id)
    await expect(app.mapNodes('job').first()).toContainText(goal.title[lang])
    await app.myMap().getByRole('button', { name: tr(lang, 'عدّل اهتماماتي وهدفي', 'Edit my interests & goal'), exact: true }).click()
    await expect(app.heading('interests')).toBeVisible()
    await expect(app.main().getByRole('button', { name: app.w.profile.backToProfile, exact: true }), 'edit mode: back to Profile').toBeVisible()
  })

  test('360px: the page never scrolls sideways (the map scrolls inside its own region); Arabic reads right to left', async ({ page }) => {
    await page.setViewportSize(NARROW)
    const app = await onMap(page, lang)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    const scroller = app.myMap().locator('.relationship-map-scroll')
    expect(await scroller.evaluate(el => el.scrollWidth > el.clientWidth), 'the map itself scrolls, as in the old interface').toBe(true)
    await expect(scroller).toHaveAttribute('tabindex', '0')
    expect(await page.evaluate(() => document.documentElement.dir)).toBe(lang === 'ar' ? 'rtl' : 'ltr')
  })

  for (const theme of ['light', 'dark']) test(`axe (${theme}): 0 violations with the map open and a node selected`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.emulateMedia({ colorScheme: theme })
    const app = await onMap(page, lang)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toContain(theme)
    const run = async () => (await new AxeBuilder({ page }).analyze()).violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)
    expect(await run(), 'the map open').toEqual([])
    await app.mapNodes('evidence').first().click()
    expect(await run(), 'a course selected').toEqual([])
    await app.myMap().getByText(tr(lang, 'تفاصيل أبعاد ملفي', 'My profile dimensions'), { exact: true }).click()
    await app.myMap().getByText(tr(lang, 'مسار الدليل الأكاديمي إلى الفرصة', 'Academic evidence path to the opportunity'), { exact: true }).click()
    expect(await run(), 'both details open').toEqual([])
    await expect(app.heading('profile')).toHaveText(VIEW_TEXT.profile.title[lang])
  })
})
