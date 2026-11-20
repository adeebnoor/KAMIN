// Task 09 · the app has four sections (My capabilities, My next step, Interests & goal, My data).
// Older menu names now live in a section, sometimes on a tab. Tests use these helpers instead of
// clicking menu labels, so a label change touches one file.
import { TABS, sectionOf } from '../src/navigation.js'

const PLACES = {
  'مهاراتي': ['home'], 'My skills': ['home'], 'لوحة قدراتي': ['home'], 'Capability dashboard': ['home'], 'قدراتي': ['home'], 'My capabilities': ['home'],
  'فرصي': ['next', 'فرصي'], 'Matches': ['next', 'Matches'],
  'الدورات': ['next', 'الدورات'], 'Courses': ['next', 'Courses'],
  'المقارنة': ['next', 'المقارنة'], 'Compare': ['next', 'Compare'],
  'شبكتي ومساعدي': ['next', 'اعرض الروابط'], 'My network & guide': ['next', 'Show connections'],
  'اهتماماتي وهدفي': ['insight'], 'Interests & goal': ['insight'],
  'الخصوصية': ['my-data', 'الموافقات والحفظ والحذف'], 'Privacy': ['my-data', 'Consent, saving & deletion'],
  'سجل الاستخدام': ['my-data', 'سجل الاستخدام'], 'Usage log': ['my-data', 'Usage log'],
  'بياناتي': ['my-data', 'مراجعة وتصحيح'], 'My data': ['my-data', 'Review & correct'],
}

// Click a section in whichever navigation is visible (sidebar on desktop, bottom bar on mobile).
export async function openSection(page, id) {
  await page.locator(`nav button[data-section="${id}"]:visible`).first().click()
}

export async function openTab(page, name) {
  await page.getByRole('tab', { name, exact: true }).click()
}

// Open a place by the name students used before Task 09.
export async function openView(page, oldName) {
  if (/^(مستكشف المعرفة|Knowledge explorer)$/.test(oldName)) {
    const sidebar = page.getByTestId('open-knowledge')
    if (await sidebar.isVisible()) return sidebar.click()
    await openSection(page, 'my-data')
    return page.getByTestId('open-knowledge-data').click()
  }
  const place = PLACES[oldName]
  if (!place) throw new Error(`e2e/nav.js: unknown place "${oldName}"`)
  await openSection(page, place[0])
  if (place[1]) await openTab(page, place[1])
  // Task 11: "My skills" is the capability list with every capability's evidence open.
  if (/^(مهاراتي|My skills)$/.test(oldName)) {
    const all = page.getByTestId('expand-all-capabilities')
    if (await all.count() && (await all.getAttribute('aria-expanded')) !== 'true') await all.click()
  }
}

// Task 10: manual entry, interests, restore, camera and the sample report sit under "Other options".
export async function openOtherOptions(page) {
  const more = page.getByTestId('start-more')
  if (!(await more.evaluate(el => el.open))) await more.locator('summary').click()
}

// Task 11: tasks, the full next decision, the network link and the national classification are
// folded under "More" on the dashboard.
export async function openDashboardMore(page) {
  const more = page.getByTestId('dashboard-more')
  if (!(await more.evaluate(el => el.open))) await more.locator('summary').click()
}

// Task 27: "Consent, saving & deletion" is a status card and five sections (<details>); Permissions
// starts open (and, before a record is approved, Back up and restore too). Open one by its id:
// permissions, save, backup, share, delete. At most two stay open, so open a section right before using it.
export async function openPrivacySection(page, id) {
  const section = page.locator(`[data-privacy-section="${id}"]`)
  if (!(await section.evaluate(el => el.open))) await section.locator(':scope > summary').click()
  await section.locator(':scope > .privacy-section-body').waitFor()
}

// Checks that read the whole page (plain words, axe): open each section in turn and run the check on
// what the student then sees. Opening them all at once is not possible: at most two stay open.
export const PRIVACY_SECTION_IDS = Object.freeze(['permissions', 'save', 'backup', 'share', 'delete'])
export async function forEachPrivacySection(page, check) {
  for (const id of PRIVACY_SECTION_IDS) { await openPrivacySection(page, id); await check(id) }
}

// Task 28: the Interests & goal consent checkbox, by its accessible name. One place, so the consent
// sentence (which needs supervisor approval to change) is changed or reverted in one commit.
export const INSIGHT_CONSENT = Object.freeze({ ar: /أوافق على أن يبني كامن ملف اهتماماتي/, en: /I agree that KAMIN builds my interests profile/ })

// ---------- Task 30 · every app view, for checks that must cover all of them ----------
const WORDS = {
  ar: { open: /افتح مساحة العمل/, demo: 'جرّب المثال التوضيحي', consent: /أوافق صراحةً/, approve: /أعتمد السجل/ },
  en: { open: /Open workspace/, demo: 'Try synthetic demo', consent: /I explicitly consent/, approve: /Approve transcript/ },
}

// In walking order. The start screen and the sample review come before approval; the rest are
// opened with the approved synthetic example. A new view must be added here to be checked.
export const APP_VIEWS = Object.freeze(['start', 'review', 'dashboard', 'matches', 'courses', 'compare', 'studio', 'insight', 'mydata', 'privacy', 'audit'])

export async function openAppWindow(page, lang = 'ar') {
  await page.goto(`/${lang}/`)
  await page.getByRole('button', { name: WORDS[lang].open }).first().click()
  await page.getByRole('dialog').waitFor()
}

export async function loadSample(page, lang = 'ar') {
  await page.getByRole('dialog').getByRole('button', { name: WORDS[lang].demo, exact: true }).click()
  await page.locator('.approval-consent').waitFor()
}

export async function approveSample(page, lang = 'ar') {
  await page.getByRole('checkbox', { name: WORDS[lang].consent }).check()
  await page.getByRole('button', { name: WORDS[lang].approve }).last().click()
  await page.locator('.capability-list').waitFor()
}

// Open a view by its id (src/navigation.js): its section, then its tab if it has one.
export async function openAppView(page, view, lang = 'ar') {
  const section = sectionOf(view)
  await openSection(page, section)
  const tab = TABS[section]?.find(item => item.view === view)
  if (tab) await openTab(page, tab.labels[lang])
}

// Task 20: a refresh now reopens the app on the view it showed (?app=<view>). Tests that model a
// student coming back to the site and opening the workspace again load the landing page itself:
// the same full page load as page.reload() (session and device storage untouched), without ?app,
// as a bookmark or a typed address would. e2e/history.spec.js checks what a refresh does.
export async function reloadLanding(page) {
  const url = new URL(page.url())
  url.searchParams.delete('app')
  await page.goto(url.pathname + url.search + url.hash)
}

// Wait until the fonts are loaded and the view has stopped changing height (lazy parts are in).
export async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    const wrap = document.querySelector('.app-content-wrap')
    for (let i = 0, last = -1, same = 0; i < 40 && same < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 100))
      const height = wrap ? wrap.scrollHeight : 0
      same = height === last ? same + 1 : 0
      last = height
    }
  })
}

// Task 23: Matches is a short list; a pathway's full explanation, plan button and Review/Contest are in its
// opened row. Open a row by pathway id: expand its group if it is collapsed ("Not for now"), show the rest
// of the group if the row is beyond the first three, then open the row.
export async function openMatch(page, id) {
  const row = page.locator(`[data-match-id="${id}"]`)
  await row.waitFor({ state: 'attached' })
  const group = row.locator('xpath=ancestor::section[contains(@class,"match-group")]')
  const groupToggle = group.locator('.match-group-toggle')
  if (await groupToggle.count() && (await groupToggle.getAttribute('aria-expanded')) === 'false') await groupToggle.click()
  if (await row.evaluate(el => el.hidden)) await group.locator('.match-more').click()
  const toggle = row.locator('.match-toggle')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await row.locator('.match-row-panel').waitFor()
}

// Walk every app view once with the synthetic example and call visit(view) on each one.
export async function walkAppViews(page, lang, visit) {
  const stop = async view => { await settle(page); await visit(view) }
  await openAppWindow(page, lang); await stop('start')
  await loadSample(page, lang); await stop('review')
  await approveSample(page, lang); await stop('dashboard')
  for (const view of APP_VIEWS.slice(3)) { await openAppView(page, view, lang); await stop(view) }
}
