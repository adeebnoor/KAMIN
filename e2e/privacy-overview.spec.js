import { test, expect } from './fixtures.js'
import AxeBuilder from '@axe-core/playwright'
import { copy } from '../src/i18n.js'
import { openAppWindow, loadSample, approveSample, openAppView, openSection, openTab, settle, openPrivacySection, forEachPrivacySection, PRIVACY_SECTION_IDS } from './nav.js'
import { pageLength, sidewaysScroll, cutOffInputs } from './usability-lib.js'

// Task 27 · "Consent, saving & deletion" as a short overview: a status card, then five sections
// (<details>) with a status line each. Permissions opens by default; at most two are open; the
// address can open one (?app=privacy#backup), as do the My data shortcuts and the save chip.
// Before Task 27 the page was 6.2 / 6.5 screens on desktop and 6.8 / 7.6 on the phone (ar / en,
// measured on Windows from main at cf13604; budget 6.3 / 6.6 / 7.1 / 7.9 on Linux).
const LANGS = ['ar', 'en']
const P = lang => copy[lang].screens.privacy
const KEEP = { ar: 'الاحتفاظ بملفي على هذا الجهاز', en: 'Keep my profile on this device' }
const PASS = { ar: 'عبارة المرور', en: 'Passphrase' }
const CONFIRM = { ar: /تأكيد العبارة/, en: /Confirm — export only/ }
const DOWNLOAD = { ar: /تنزيل نسخة مشفّرة/, en: /Download encrypted backup/ }
const CONSENTS_SHORTCUT = { ar: 'الموافقات والنسخ الاحتياطي', en: 'Consents and backup' }
const MYDATA_TAB = { ar: 'مراجعة وتصحيح', en: 'Review & correct' }
const AUDIT_TAB = { ar: 'سجل الاستخدام', en: 'Usage log' }
// The page may be this many screens long with the sections that open by default (the task's limit).
const LIMIT = { 'desktop-chromium': 2, 'mobile-chromium': 3 }

const section = (page, id) => page.locator(`[data-privacy-section="${id}"]`)
const status = (page, id) => page.getByTestId(`privacy-status-${id}`)
const isOpen = (page, id) => section(page, id).evaluate(el => el.open)
const openIds = page => page.locator('[data-privacy-section]').evaluateAll(els => els.filter(el => el.open).map(el => el.dataset.privacySection))
const hash = page => new URL(page.url()).hash
const appParam = page => new URL(page.url()).searchParams.get('app')
const consentBox = (page, lang, key) => page.locator('.consents label', { hasText: copy[lang].app.consentItems[key] }).locator('input[type="checkbox"]')
async function approved(page, lang) { await openAppWindow(page, lang); await loadSample(page, lang); await approveSample(page, lang) }
async function privacy(page, lang) { await approved(page, lang); await openAppView(page, 'privacy', lang); await section(page, 'permissions').waitFor() }

for (const lang of LANGS) test(`with the synthetic profile the page fits 2 screens on desktop and 3 on the phone (${lang})`, async ({ page }, info) => {
  await privacy(page, lang)
  await settle(page)
  expect(await openIds(page)).toEqual(['permissions'])
  const m = await pageLength(page)
  await info.attach(`privacy-length.${lang}.json`, { body: JSON.stringify(m), contentType: 'application/json' })
  expect(m.scrollHeight / m.clientHeight, `${m.scrollHeight}px in a ${m.clientHeight}px window`).toBeLessThanOrEqual(LIMIT[info.project.name])
})

for (const lang of LANGS) test(`a status card, five sections with live status lines, no duplicate My data button (${lang})`, async ({ page }) => {
  await privacy(page, lang)
  const p = P(lang)
  expect(await page.locator('[data-privacy-section]').evaluateAll(els => els.map(el => el.dataset.privacySection))).toEqual([...PRIVACY_SECTION_IDS])
  for (const id of PRIVACY_SECTION_IDS) await expect(section(page, id).locator(':scope > summary h3')).toHaveText(p.sections[id])
  await expect(page.getByTestId('open-my-data-privacy')).toHaveCount(0)
  // The status card: permissions on, and only what is stored (the synthetic profile: 7 courses).
  await expect(page.getByTestId('privacy-permissions-on')).toContainText(`1 ${p.of} 4`)
  await expect(page.getByTestId('privacy-stored')).toContainText(lang === 'ar' ? '7 سجلات مقررات' : '7 course records')
  await expect(page.getByTestId('privacy-stored')).toContainText(p.nothingElse)
  await expect(page.getByTestId('privacy-stored')).not.toContainText(lang === 'ar' ? 'هدف/مسار مختار' : 'selected target/goal')
  // Granting a consent changes the Permissions line and the card at once.
  await expect(status(page, 'permissions')).toHaveText(p.onCount(1, 4))
  await consentBox(page, lang, 'insight').check()
  await expect(status(page, 'permissions')).toHaveText(p.onCount(2, 4))
  await expect(page.getByTestId('privacy-permissions-on')).toContainText(`2 ${p.of} 4`)
  await consentBox(page, lang, 'insight').uncheck()
  await expect(status(page, 'permissions')).toHaveText(p.onCount(1, 4))
  // Save on this device: Off, then On, without opening anything else.
  await expect(status(page, 'save')).toHaveText(p.saveOff)
  await openPrivacySection(page, 'save')
  await section(page, 'save').getByRole('button', { name: KEEP[lang], exact: true }).click()
  await expect(status(page, 'save')).toHaveText(p.saveOn)
  await expect(page.locator('.ownership-panel .status.yes')).toBeVisible()
  await expect(status(page, 'share')).toHaveText(p.noLink)
  await expect(status(page, 'delete')).toHaveText(p.deleteStatus)
  // No backup made yet in this session: the Back up section shows its title only.
  await expect(status(page, 'backup')).toHaveCount(0)
})

test('at most two sections are open; closing one keeps what was typed in it; the keyboard opens them', async ({ page }) => {
  await privacy(page, 'en')
  await openPrivacySection(page, 'backup')
  expect(await openIds(page)).toEqual(['permissions', 'backup'])
  await section(page, 'backup').getByLabel('Passphrase', { exact: true }).fill('typed before closing')
  await openPrivacySection(page, 'share')
  await expect.poll(() => openIds(page)).toEqual(['backup', 'share'])
  await openPrivacySection(page, 'delete')
  await expect.poll(() => openIds(page)).toEqual(['share', 'delete'])
  await openPrivacySection(page, 'backup')
  await expect(section(page, 'backup').getByLabel('Passphrase', { exact: true })).toHaveValue('typed before closing')
  // A summary is a button for the keyboard: Enter opens and closes it.
  const summary = section(page, 'save').locator(':scope > summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => isOpen(page, 'save')).toBe(true)
  await page.keyboard.press('Enter')
  await expect.poll(() => isOpen(page, 'save')).toBe(false)
})

test('the section the student opens is in the address; Back brings it back; leaving the page drops it', async ({ page }) => {
  await privacy(page, 'en')
  // The default (Permissions) is not written into the address.
  expect(hash(page)).toBe('')
  await openPrivacySection(page, 'share')
  await expect.poll(() => hash(page)).toBe('#share')
  await expect.poll(() => appParam(page)).toBe('privacy')
  await openTab(page, AUDIT_TAB.en)
  await expect.poll(() => appParam(page)).toBe('audit')
  // Task 55: every address read waits for the address (as Task 48 did); the expected values are unchanged.
  await expect.poll(() => hash(page)).toBe('')
  await page.goBack()
  await expect.poll(() => appParam(page)).toBe('privacy')
  await expect.poll(() => openIds(page)).toEqual(['share'])
  await expect.poll(() => hash(page)).toBe('#share')
  // Closing the app leaves no section in the landing page's address.
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect.poll(() => appParam(page)).toBeNull()
  await expect.poll(() => hash(page)).toBe('')
})

for (const lang of LANGS) test(`a link opens one section directly: ?app=privacy#backup (${lang})`, async ({ page }) => {
  await page.goto(`/${lang}/?app=privacy#backup`)
  await expect(section(page, 'backup')).toBeVisible()
  await expect.poll(() => openIds(page)).toEqual(['backup'])
  await expect(section(page, 'backup').getByTestId('restore-backup')).toBeInViewport()
  expect(hash(page)).toBe('#backup')
  // #delete opens the Delete section; only the shortcut in My data starts with the confirmation.
  // (Loaded fresh: a change of the # part alone does not reload the page.)
  await page.goto(`/${lang}/`)
  await page.goto(`/${lang}/?app=privacy#delete`)
  await expect.poll(() => openIds(page)).toEqual(['delete'])
  await expect(page.getByTestId('delete-everything-confirm')).toHaveCount(0)
  await expect(section(page, 'delete').getByRole('button', { name: copy[lang].app.delete })).toBeVisible()
})

for (const lang of LANGS) test(`My data shortcuts and the save chip open their section (${lang})`, async ({ page }) => {
  await approved(page, lang)
  await openAppView(page, 'mydata', lang)
  await page.getByRole('button', { name: CONSENTS_SHORTCUT[lang], exact: true }).click()
  await expect.poll(() => openIds(page)).toEqual(['permissions'])
  await expect.poll(() => hash(page)).toBe('#permissions')
  await expect(consentBox(page, lang, 'analyze')).toBeInViewport()
  // Task 15's startWithDeleteConfirm: Delete opens with the confirmation shown and in view.
  await openTab(page, MYDATA_TAB[lang])
  await page.getByTestId('delete-all-shortcut').click()
  await expect.poll(() => openIds(page)).toEqual(['delete'])
  await expect(page.getByTestId('delete-everything-confirm')).toBeInViewport()
  await expect.poll(() => hash(page)).toBe('#delete')
  // The save chip in the top bar (Task 26), while this page is already open.
  await page.getByTestId('save-status').click()
  await expect.poll(() => isOpen(page, 'save')).toBe(true)
  await expect(section(page, 'save').getByRole('button', { name: KEEP[lang], exact: true })).toBeInViewport()
  await expect.poll(() => hash(page)).toBe('#save')
})

test('before a record is approved, Back up and restore is open too, so restoring takes no extra click', async ({ page }) => {
  await openAppWindow(page, 'ar')
  await openSection(page, 'my-data')
  await expect.poll(() => openIds(page)).toEqual(['permissions', 'backup'])
  await expect(page.getByLabel('عبارة مرور النسخة المستعادة', { exact: true })).toBeVisible()
})

for (const lang of LANGS) test(`the Back up and Share lines say what happened in this session (${lang})`, async ({ page }) => {
  await privacy(page, lang)
  await openPrivacySection(page, 'backup')
  const pass = 'correct horse battery staple'
  await page.getByLabel(PASS[lang], { exact: true }).fill(pass)
  await page.getByLabel(CONFIRM[lang]).fill(pass)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: DOWNLOAD[lang] }).click()
  await download
  await expect(status(page, 'backup')).toContainText(P(lang).lastBackup('').split('(')[0].trim())
  await openPrivacySection(page, 'share')
  const share = page.locator('.snapshot-share')
  await share.locator('.snapshot-option input[type="checkbox"]').first().check()
  await share.locator('.snapshot-option input[type="checkbox"]').last().check()
  await share.getByRole('button', { name: lang === 'ar' ? 'إنشاء رابط مشفّر' : 'Create encrypted link', exact: true }).click()
  await expect(share.locator('textarea')).toHaveValue(/#payload=/)
  await expect(status(page, 'share')).toHaveText(P(lang).linkMade)
  // Nothing about it is stored: the session copy holds no backup time or link flag.
  const saved = await page.evaluate(() => sessionStorage.getItem('kamin-session-v3') || '')
  expect(saved).not.toMatch(/backupAt|linkCreated/)
})

test.describe('on a 360px screen', () => {
  test.use({ viewport: { width: 360, height: 740 } })
  for (const lang of LANGS) test(`every section, opened in turn: axe, no sideways scroll, no cut-off field (${lang})`, async ({ page }) => {
    test.setTimeout(90_000)
    await privacy(page, lang)
    const found = {}
    await forEachPrivacySection(page, async id => {
      await settle(page)
      const report = await new AxeBuilder({ page }).include('.app-content').analyze()
      found[id] = {
        axe: report.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`),
        sideways: await sidewaysScroll(page),
        cut: await cutOffInputs(page),
      }
    })
    for (const [id, f] of Object.entries(found)) expect.soft(f, id).toEqual({ axe: [], sideways: [], cut: [] })
  })
})
