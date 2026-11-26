// Task 67 · Settings in the new interface (?ui=next). With the synthetic example: every row is at most two taps from
// Profile and opens its sub-page at ?app=settings#<section> (Back returns to the list, a refresh keeps the section, the
// fragment never follows to another view); Consents names each consent word for word (src/i18n.js), says what
// withdrawing would remove, and withdrawing the transcript analysis removes the courses, collegeRaw and major and keeps
// the interests; Delete everything lists what goes, then the device is checked clear and only the language, the
// interface and the theme stay; a backup made here restores on another device; My courses edits a grade and undoes it,
// and "Update transcript" opens step 1 in edit mode; no data control on Home, step 1 or the feed; the list fits in 1.2
// screens of a 390×844 phone; no sideways scroll at 360px; axe in both themes. Arabic and English, desktop and phone.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { NEXT_COPY } from '../src/ui2/copy.js'
import { VIEW_TEXT, SETTINGS_SECTIONS } from '../src/ui2/views.js'
import { copy } from '../src/i18n.js'
import { withdrawConsent } from '../src/utils/dataControl.js'
import { DECLARED_PREFERENCE_SCHEMES } from '../src/insight.js'
import { demoCourses, demoCollegeRaw } from '../src/data.js'
import { KAMIN_LOCAL_DB, KAMIN_LOCAL_KEY, KAMIN_LOCAL_STORE } from '../src/utils/localProfileStore.js'
import { LANGS, kamin } from './roles.js'

const PHONE = { width: 390, height: 844 }
const NARROW = { width: 360, height: 780 }
const W = lang => NEXT_COPY[lang].settings
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SESSION_KEY = 'kamin-session-v3'
const INTEREST = DECLARED_PREFERENCE_SCHEMES.careerInterest.options[1]
const stored = page => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || 'null'), SESSION_KEY)
const row = (app, id) => app.main().getByRole('button', { name: new RegExp(`^${escape(W(app.lang).rows[id])}`) })

async function onSettings(page, lang) {
  const app = kamin(page, { ui: 'new', lang })
  await app.sample()
  await app.goToView('settings')
  return app
}

for (const lang of LANGS) test.describe(`Settings (${lang})`, () => {
  test('every row is at most two taps from Profile; each opens its sub-page in the address; Back returns to the row', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    await app.goToView('profile')
    await app.main().getByRole('button', { name: VIEW_TEXT.settings.title[lang], exact: true }).click()
    await expect(app.heading('settings')).toBeVisible()
    await expect(app.tabLink('profile')).toHaveAttribute('aria-current', 'true')
    await expect(app.main().getByTestId('save-status'), 'Save on this device is on the list itself (one tap from Profile)').toHaveText(copy[lang].app.sessionOnly)
    for (const id of SETTINGS_SECTIONS) {
      await row(app, id).click()
      await expect(app.sectionHeading(id), `${id}: the second tap from Profile`).toBeVisible()
      await expect(app.sectionHeading(id)).toBeFocused()
      expect(new URL(page.url()).hash).toBe(`#${id}`)
      expect(new URL(page.url()).searchParams.get('app')).toBe('settings')
      await page.goBack()
      await expect(app.heading('settings')).toBeVisible()
      await expect(row(app, id), 'focus is back on the row').toBeFocused()
      expect(new URL(page.url()).hash).toBe('')
    }
    // A refresh and a link keep the section; "Back to Settings" returns to the list.
    await row(app, 'backup').click()
    await page.reload()
    await expect(app.sectionHeading('backup')).toBeVisible()
    await app.main().getByRole('button', { name: W(lang).back, exact: true }).click()
    await expect(app.heading('settings')).toBeVisible()
    expect(new URL(page.url()).hash).toBe('')
    await page.goto(`/${lang}/?app=settings#log`)
    await expect(app.sectionHeading('log')).toBeVisible()
    await expect(app.main().getByText(copy[lang].screens.myData.auditIntro, { exact: true })).toBeVisible()
    // The fragment never follows the student to another view.
    await app.tab('home')
    await expect(app.heading('home')).toBeVisible()
    expect(new URL(page.url()).hash).toBe('')
  })

  test('Consents: each consent word for word, what withdrawing removes; withdrawing the transcript keeps the interests', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    // An interest first (step 3: the interests consent and one chip).
    await app.goToView('interests')
    await app.interestsConsent().click()
    await app.interestChip('careerInterest', INTEREST.id).click()
    await expect(app.interestChip('careerInterest', INTEREST.id)).toHaveAttribute('aria-pressed', 'true')
    const before = await stored(page)
    expect(before.collegeRaw).toBe(demoCollegeRaw)
    await page.goto(`/${lang}/?app=settings#consents`)
    await expect(app.sectionHeading('consents')).toBeVisible()
    await expect(app.main().getByText(copy[lang].screens.myData.privacyIntro, { exact: true })).toBeVisible()
    for (const key of ['analyze', 'insight', 'advisor', 'research']) await expect(app.consent(key), `the "${copy[lang].app.consentItems[key]}" consent, word for word`).toBeVisible()
    await expect(app.consent('analyze')).toBeChecked()
    // What withdrawing the transcript analysis would remove: dataControl's own summary of this profile.
    const preview = app.main().getByTestId('ui2-withdraw-preview')
    await preview.getByText(copy[lang].app.consentItems.analyze, { exact: true }).click()
    const expected = withdrawConsent(before, 'analyze', { lang }).summary.sentences[lang]
    await expect(preview.getByRole('listitem').first()).toHaveText(expected[0])
    await expect(preview.getByRole('listitem').filter({ hasText: demoCourses[0].code }).first()).toBeVisible()
    expect(await stored(page), 'opening the preview changes nothing').toEqual(before)
    await app.consent('analyze').uncheck()
    await expect(app.changeSummary(lang === 'ar' ? 'ما الذي تغيّر بعد سحب موافقة السجل؟' : 'What changed after transcript-consent withdrawal?')).toBeVisible()
    await expect(app.consent('analyze')).not.toBeChecked()
    const after = await stored(page)
    expect(after.courses).toEqual([])
    expect(after.approved).toBe(false)
    expect(after.collegeRaw).toBeNull()
    expect(after.major).toBeNull()
    expect(after.insight.declaredPreferences.careerInterest, 'the interest stays (Task 78: stored as a list)').toEqual([INTEREST.id])
    expect(after.consents.insight).toBe(true)
    await app.goToView('profile')
    await expect(app.capabilityRows()).toHaveCount(0)
    await expect(app.main().getByTestId('ui2-profile-interests')).toContainText(INTEREST.label[lang])
  })

  test('Delete everything: the list first, then the device is checked clear; language, interface and theme stay', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await page.goto(`/${lang}/`)
    await page.evaluate(() => localStorage.setItem('kamin-theme', 'dark'))
    await app.sample()
    await app.goToView('settings')
    // Kept on this device first, so the device copy (IndexedDB) is there to delete.
    await app.keepOnDevice()
    await expect(app.saveStatus()).toHaveText(copy[lang].app.savedOnDevice)
    await row(app, 'delete').click()
    const confirm = app.main().getByRole('alertdialog', { name: lang === 'ar' ? 'سيُحذف من هذا الجهاز:' : 'This will be deleted from this device:' })
    await expect(confirm).toBeVisible()
    await expect(confirm.getByRole('listitem').filter({ hasText: `${demoCourses.length} ` }).first(), 'it counts what will be deleted').toBeVisible()
    await app.confirmDeleteEverything()
    const done = app.deletedConfirmation()
    const d = copy[lang].screens.start.deleted
    await expect(done.getByText(d.title, { exact: true })).toBeVisible()
    await expect(done.getByText(`${d.text} ${d.outside}`, { exact: true }), 'the device was checked and is clear').toBeVisible()
    const left = await page.evaluate(async ({ db, store, key, session }) => {
      const local = Object.keys(localStorage).filter(name => name.startsWith('kamin-')).sort()
      const inDb = await new Promise(resolve => {
        const request = indexedDB.open(db)
        request.onupgradeneeded = () => request.transaction.abort()
        request.onerror = () => resolve(false)
        request.onsuccess = () => {
          const opened = request.result
          if (!opened.objectStoreNames.contains(store)) { opened.close(); resolve(false); return }
          const get = opened.transaction(store).objectStore(store).get(key)
          get.onsuccess = () => { opened.close(); resolve(!!get.result) }
          get.onerror = () => { opened.close(); resolve(false) }
        }
      })
      return { local, theme: localStorage.getItem('kamin-theme'), lang: localStorage.getItem('kamin-lang'), session: sessionStorage.getItem(session), inDb, dataTheme: document.documentElement.dataset.theme }
    }, { db: KAMIN_LOCAL_DB, store: KAMIN_LOCAL_STORE, key: KAMIN_LOCAL_KEY, session: SESSION_KEY })
    expect(left.local.every(name => ['kamin-lang', 'kamin-ui', 'kamin-theme'].includes(name)), left.local.join(', ')).toBe(true)
    expect(left).toMatchObject({ theme: 'dark', lang, session: null, inDb: false, dataTheme: 'dark' })
    // Nothing comes back after a refresh.
    await app.goToView('profile')
    await expect(app.capabilityRows()).toHaveCount(0)
  })

  test('a backup made in Settings restores on another device (wrong passphrase first)', async ({ page, browser, baseURL }, info) => {
    const app = await onSettings(page, lang)
    const passphrase = 'made-up passphrase for tests'
    const download = await app.downloadBackup(passphrase)
    const file = await download.path()
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = info.project.use
    const device = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL })
    const other = kamin(await device.newPage(), { ui: 'new', lang })
    await other.home()
    await other.restoreBackup(file, 'a wrong made-up passphrase')
    await expect(other.main().getByRole('alert')).toHaveText(lang === 'ar' ? 'تعذر فتح النسخة: عبارة المرور خاطئة أو الملف عُدّل/تلف.' : 'Could not open the backup: wrong passphrase or the file was modified/corrupted.')
    await other.main().getByLabel(lang === 'ar' ? 'عبارة مرور النسخة المستعادة' : 'Passphrase of the backup to restore', { exact: true }).fill(passphrase)
    const chooser = other.page.waitForEvent('filechooser')
    await other.main().getByRole('button', { name: lang === 'ar' ? 'اختر ملف النسخة واستعدها' : 'Choose the backup file and restore' }).click()
    await (await chooser).setFiles(file)
    await expect(other.notices()).toHaveText(W(lang).restored)
    await expect(other.heading('profile')).toBeVisible()
    await other.main().getByRole('button', { name: NEXT_COPY[lang].profile.correct, exact: true }).click()
    for (const course of demoCourses) await expect(other.myGrade(course.code)).toHaveValue(course.grade)
    await device.close()
  })

  test('My courses: one tap from Profile; change a grade, confirm, undo; Update transcript opens step 1 in edit mode', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    await app.goToView('profile')
    await app.openMyData()
    expect(app.clicks, 'My courses is one tap from Profile').toBe(2)
    const grade = app.myGrade(demoCourses[0].code)
    const original = await grade.inputValue()
    await grade.fill('C')
    await app.saveMyData()
    await app.confirmMyData()
    await expect(app.changeSummary(lang === 'ar' ? 'ما الذي تغيّر بعد التعديل؟' : 'What changed after your edit?')).toBeVisible()
    await expect(app.myGrade(demoCourses[0].code)).toHaveValue('C')
    await app.undo()
    await expect(app.myGrade(demoCourses[0].code)).toHaveValue(original)
    await app.main().getByRole('button', { name: NEXT_COPY[lang].profile.update, exact: true }).click()
    await expect(app.heading('upload')).toBeVisible()
    await expect(app.main().getByTestId('ui2-step'), 'step 1 in edit mode: no step chip').toHaveCount(0)
  })

  test('no data control on Home, step 1 or the feed', async ({ page }) => {
    const app = kamin(page, { ui: 'new', lang })
    await app.sample()
    const controls = new RegExp([...Object.values(W(lang).rows), W(lang).stopSaving, copy[lang].app.delete, lang === 'ar' ? 'تنزيل نسخة مشفّرة' : 'Download encrypted backup', copy[lang].screens.myData.exportFile].map(escape).join('|'))
    for (const view of ['home', 'upload', 'next']) {
      await app.goToView(view)
      for (const role of ['button', 'checkbox', 'link']) await expect(app.main().getByRole(role, { name: controls }), `${view}: no ${role} of Settings`).toHaveCount(0)
    }
  })

  test('the list is at most 1.2 screens on a 390×844 phone; no sideways scroll at 360px on the list or any sub-page', async ({ page }) => {
    await page.setViewportSize(PHONE)
    const app = await onSettings(page, lang)
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    test.info().annotations.push({ type: 'Settings height at 390×844 (px)', description: String(height) })
    expect(height, 'Settings ≤ 1.2 screens').toBeLessThanOrEqual(1.2 * PHONE.height)
    await page.setViewportSize(NARROW)
    const wide = []
    const check = async label => { const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (overflow > 0) wide.push(`${label}: ${overflow}px`) }
    await check('list')
    for (const id of SETTINGS_SECTIONS) {
      await row(app, id).click()
      await expect(app.sectionHeading(id)).toBeVisible()
      if (id === 'consents') await app.main().getByTestId('ui2-withdraw-preview').getByText(copy[lang].app.consentItems.analyze, { exact: true }).click()
      await check(id)
      await page.goBack()
      await expect(app.heading('settings')).toBeVisible()
    }
    expect(wide).toEqual([])
  })

  for (const theme of ['light', 'dark']) test(`axe (${theme}): 0 violations on the list and every sub-page`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ colorScheme: theme })
    const app = await onSettings(page, lang)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toContain(theme)
    const found = {}
    const check = async label => {
      await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity))
      const report = await new AxeBuilder({ page }).analyze()
      if (report.violations.length) found[label] = report.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(node => node.target.join(' ')).join(', ')}`)
    }
    await check('list')
    for (const id of SETTINGS_SECTIONS) {
      await row(app, id).click()
      await expect(app.sectionHeading(id)).toBeVisible()
      if (id === 'courses') await expect(app.myGrade(demoCourses[0].code)).toBeVisible()
      if (id === 'consents') await app.main().getByTestId('ui2-withdraw-preview').getByText(copy[lang].app.consentItems.analyze, { exact: true }).click()
      if (id === 'share') await expect(app.main().getByRole('group', { name: lang === 'ar' ? 'القدرات التي ستظهر' : 'Capabilities to include' })).toBeVisible()
      if (id === 'delete') await expect(app.main().getByRole('alertdialog')).toBeVisible()
      await check(id)
      await page.goBack()
      await expect(app.heading('settings')).toBeVisible()
    }
    expect(found).toEqual({})
  })
})
