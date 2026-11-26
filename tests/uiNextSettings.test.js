// Task 67 · Settings in the new interface (src/ui2/screens/Settings.jsx, src/ui2/components/SettingsRow.jsx).
// Three groups of rows reached from Profile (never from Home): My courses and Usage log; Save on this device (a switch
// with the dashboard's sentence), Backup and restore, Share a snapshot link and Export; Consents and Delete everything.
// Each row opens a sub-page at ?app=settings#<section> that is the old interface's own component, unchanged and loaded
// when opened, so every consent, saving, backup and deletion sentence stays word for word (Task 27's list of sentences in
// tests/dataControl.test.js still checks the components themselves). The five sentences the new page writes itself are
// the old interface's own, found here in their old files. "What does withdrawing remove?" is dataControl's own summary.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Settings, { DeletedConfirmation, SETTINGS_GROUPS, rowStatus, withdrawPreview, withdrawable } from '../src/ui2/screens/Settings.jsx'
import SettingsRow from '../src/ui2/components/SettingsRow.jsx'
import PermissionsSection from '../src/components/privacy/PermissionsSection.jsx'
import * as Privacy from '../src/components/Privacy.jsx'
import { SETTINGS_SECTIONS, VIEW_TEXT, settingsSectionFromHash } from '../src/ui2/views.js'
import { withdrawConsent } from '../src/utils/dataControl.js'
import { saveOffer } from '../src/content/saveOfferCopy.js'
import { emptyInsightState } from '../src/insight.js'
import { profileSkills } from '../src/utils/engine.js'
import { demoCourses } from '../src/data.js'
import { copy } from '../src/i18n.js'
import { NEXT_COPY } from '../src/ui2/copy.js'
import { FileText } from 'lucide-react'

const LANGS = ['ar', 'en']
const read = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const sourceFiles = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? sourceFiles(p) : [p] })
const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
const noop = () => {}
const PERCENT = /\d\s?[%٪]|[%٪]\s?\d/
const W = lang => NEXT_COPY[lang].settings
const APPROVED_TS = Date.parse('2026-11-19T09:00:00.000Z')
// The app's synthetic example, approved (made-up rows, no person), with an interest chosen and the approval line.
const SAMPLE = {
  approved: true, courses: demoCourses.map(row => ({ ...row })), college: 'FCIT', collegeRaw: 'FACULTY OF COMPUTING AND INFORMATION TECHNOLOGY', major: 'INFORMATION SYSTEMS',
  projects: [], tasks: [], credentials: [], recommendationReviews: [], needsReview: [], goal: null, goals: [], plan: [], notForMe: [],
  insight: { ...emptyInsightState(), declaredPreferences: { careerInterest: 'data' } },
  consents: { analyze: true, insight: true, advisor: false, research: false }, localPersistence: false,
  audit: [{ label: 'Transcript analysis consent granted and record approved', ts: APPROVED_TS }],
}
const EMPTY = { approved: false, courses: [], college: null, projects: [], tasks: [], credentials: [], recommendationReviews: [], insight: emptyInsightState(), consents: { analyze: false, insight: false, advisor: false, research: false }, goals: [], plan: [], notForMe: [], audit: [] }
const profileOf = state => ({ state, derived: { skills: profileSkills(state), matches: [] }, status: { changeSummary: null, canUndo: false, myDataVersion: 0 }, actions: {} })
const page = (lang, state, extra = {}) => renderToStaticMarkup(createElement(Settings, { lang, profile: profileOf(state), focusHeading: false, onNavigate: noop, onEdit: noop, onReview: noop, notify: noop, ...extra }))
const rowsOf = html => [...html.matchAll(/<button type="button" class="ui2-settings-row" data-section="(\w+)"[^>]*>([\s\S]*?)<\/button>/g)].map(m => ({ section: m[1], text: textOf(m[2]) }))

describe('Task 67 · the address of a section (?app=settings#<section>)', () => {
  it('seven sections; a fragment names one, anything else (a snapshot link, the old #save) names none', () => {
    expect(SETTINGS_SECTIONS).toEqual(['courses', 'backup', 'share', 'export', 'consents', 'delete', 'log'])
    for (const id of SETTINGS_SECTIONS) expect(settingsSectionFromHash(`#${id}`)).toBe(id)
    expect(settingsSectionFromHash('backup')).toBe('backup')
    for (const hash of ['', '#', '#payload=abc&key=def', '#Backup', '#save', '#privacy-backup', undefined, null]) expect(settingsSectionFromHash(hash)).toBeNull()
  })
  it('the groups hold every section once, plus the "Save on this device" switch, in the brief\'s order', () => {
    const rows = SETTINGS_GROUPS.flatMap(([, ids]) => ids)
    expect(SETTINGS_GROUPS.map(([group]) => group)).toEqual(['record', 'keep', 'control'])
    expect(rows.filter(id => id !== 'save').sort()).toEqual([...SETTINGS_SECTIONS].sort())
    expect(rows).toEqual(['courses', 'log', 'save', 'backup', 'share', 'export', 'consents', 'delete'])
  })
})

describe('Task 67 · the Settings list', () => {
  for (const lang of LANGS) it(`(${lang}) the heading, its sentence, three groups and a row per section with its status`, () => {
    const html = page(lang, SAMPLE)
    const text = textOf(html)
    expect(html).toContain(`<h1 id="ui2-page-title" tabindex="-1">${VIEW_TEXT.settings.title[lang]}</h1>`)
    expect(text).toContain(VIEW_TEXT.settings.line[lang])
    for (const group of ['record', 'keep', 'control']) expect(html).toContain(`>${W(lang).groups[group]}</h2>`)
    const rows = rowsOf(html)
    expect(rows.map(row => row.section)).toEqual(['courses', 'log', 'backup', 'share', 'export', 'consents', 'delete'])
    for (const row of rows) expect(row.text.startsWith(W(lang).rows[row.section]), row.section).toBe(true)
    const status = rowStatus(SAMPLE, lang)
    expect(rows.find(row => row.section === 'courses').text).toBe(`${W(lang).rows.courses} ${NEXT_COPY[lang].profile.courses(demoCourses.length).join('')}`)
    expect(rows.find(row => row.section === 'log').text).toBe(`${W(lang).rows.log} ${status.log}`)
    expect(rows.find(row => row.section === 'consents').text).toBe(`${W(lang).rows.consents} ${copy[lang].screens.privacy.onCount(2, 4)}`)
    expect(text).not.toMatch(PERCENT)
  })
  it('row statuses: no transcript yet, the event count in words (Arabic noun forms), the consents that are on', () => {
    expect(rowStatus(EMPTY, 'en')).toEqual({ courses: 'No transcript yet', log: 'No events', consents: '0 of 4 on' })
    expect(rowStatus(SAMPLE, 'en').log).toBe('1 event')
    expect([0, 1, 2, 3, 10, 11, 100].map(n => W('ar').events(n).join(''))).toEqual(['لا أحداث', 'حدث واحد', 'حدثان', '3 أحداث', '10 أحداث', '11 حدثًا', '100 حدثًا'])
    expect([0, 1, 2, 12].map(n => W('en').events(n).join(''))).toEqual(['No events', '1 event', '2 events', '12 events'])
  })
  it('a row is a button named by its label and status (SettingsRow)', () => {
    const html = renderToStaticMarkup(createElement(SettingsRow, { icon: FileText, label: 'My courses', status: '7 courses', section: 'courses', onOpen: noop }))
    expect(html).toMatch(/^<button type="button" class="ui2-settings-row" data-section="courses">/)
    expect(textOf(html)).toBe('My courses 7 courses')
    expect(html).toContain('aria-hidden="true"')
  })
})

describe('Task 67 · Save on this device: the dashboard\'s sentence, the status, one button', () => {
  for (const lang of LANGS) it(`(${lang}) session only: the question, the detail and "Yes, keep my profile"; saved: the note and Stop`, () => {
    const off = page(lang, SAMPLE)
    expect(off).toMatch(new RegExp(`data-testid="save-status" data-saved="false">${copy[lang].app.sessionOnly}<`))
    for (const key of ['question', 'detail', 'keep']) expect(textOf(off)).toContain(saveOffer(key, lang))
    expect(textOf(off)).not.toContain(W(lang).stopSaving)
    const on = page(lang, { ...SAMPLE, localPersistence: true })
    expect(on).toMatch(new RegExp(`data-testid="save-status" data-saved="true">${copy[lang].app.savedOnDevice}<`))
    expect(textOf(on)).toContain(saveOffer('savedNote', lang))
    expect(textOf(on)).toContain(W(lang).stopSaving)
    expect(textOf(on)).not.toContain(saveOffer('keep', lang))
  })
  // Task 70: src/App.jsx is deleted. Its four sentences (read from the file at b443bad, word for word) stay as they were.
  const OLD_APP_SENTENCES = {
    ar: { savingOff: 'أُوقف الحفظ الدائم؛ بقيت الجلسة الحالية.', restored: 'تمت استعادة ملفك محليًا. أُعيد حساب النتائج من الأدلة، ولم تُفعّل موافقات المشاركة الخارجية.', noEvents: 'لا توجد أحداث بعد.', studyKept: 'بقي ملف الدراسة المجهول فقط؛ يُحذف عند إنهاء الجلسة أو الانسحاب من الدراسة.' },
    en: { savingOff: 'Persistent saving is off; the current session remains.', restored: 'Your profile was restored locally. Derived results were recomputed from evidence; external sharing consents remain off.', noEvents: 'No events yet.', studyKept: 'Only the anonymous study file is kept; it is deleted when you finish the session or withdraw from the study.' },
  }
  it('the sentences the page writes itself are the old interface\'s own, word for word', () => {
    const privacy = read('src/components/Privacy.jsx')
    for (const lang of LANGS) {
      expect(privacy, `stopSaving (${lang})`).toContain(`'${W(lang).stopSaving}'`)
      for (const key of ['savingOff', 'restored', 'noEvents', 'studyKept']) expect(W(lang)[key], `${key} (${lang})`).toBe(OLD_APP_SENTENCES[lang][key])
    }
  })
})

describe('Task 67 · Consents: word for word from the reused component, and what withdrawing removes', () => {
  it('no consent, saving or deletion sentence is copied into the new interface: they come from the reused components', () => {
    const ui2 = sourceFiles('src/ui2').map(read).join('\n')
    for (const lang of LANGS) {
      const c = copy[lang]
      for (const sentence of [...Object.values(c.app.consentItems), c.app.privacyNote, c.screens.myData.backup, c.screens.myData.share, c.screens.start.deleted.text, c.screens.start.deleted.outside,
        lang === 'ar' ? 'نعم، احذف كل شيء من هذا الجهاز' : 'Yes, delete everything from this device', lang === 'ar' ? 'ضروري فقط بعد اعتماد السجل' : 'Required only after transcript approval']) expect(ui2, sentence).not.toContain(sentence)
    }
  })
  for (const lang of LANGS) it(`(${lang}) each consent is named by the i18n string, the one Task 27 keeps unchanged`, () => {
    const html = renderToStaticMarkup(createElement(PermissionsSection, { lang, state: SAMPLE, setState: noop, log: noop, onChangeSummary: noop, onClearReviews: noop }))
    const labels = [...html.matchAll(/<label><span><strong>([^<]*)<\/strong>/g)].map(m => m[1].replace(/&amp;/g, '&'))
    expect(labels).toEqual(Object.keys(SAMPLE.consents).map(key => copy[lang].app.consentItems[key]))
  })
  it('Settings loads the old Permissions list, status card, backup and delete sections through Privacy.jsx (same modules)', async () => {
    const [perm, status, backup, del] = await Promise.all(['PermissionsSection', 'StatusSummary', 'BackupSection', 'DeleteSection'].map(name => import(`../src/components/privacy/${name}.jsx`)))
    expect(Privacy.PermissionsSection).toBe(perm.default)
    expect(Privacy.StatusSummary).toBe(status.default)
    expect(Privacy.BackupSection).toBe(backup.default)
    expect(Privacy.DeleteSection).toBe(del.default)
    const settings = read('src/ui2/screens/Settings.jsx')
    expect(settings).toContain("const privacyPart = name => lazy(() => import('../../components/Privacy.jsx').then(m => ({ default: m[name] })))")
    for (const name of ['BackupSection', 'PermissionsSection', 'StatusSummary', 'DeleteSection']) expect(settings).toContain(`const ${name} = privacyPart('${name}')`)
    for (const file of ['MyData.jsx', 'WhatChanged.jsx', 'CapabilitySnapshot.jsx']) expect(settings).toContain(`lazy(() => import('../../components/${file}'))`)
  })
  it('the consents whose withdrawal goes through dataControl: those that are on, the transcript only once approved', () => {
    expect(withdrawable(SAMPLE)).toEqual(['analyze', 'insight'])
    expect(withdrawable({ ...SAMPLE, approved: false })).toEqual(['insight'])
    expect(withdrawable({ ...SAMPLE, consents: { ...SAMPLE.consents, advisor: true } })).toEqual(['analyze', 'insight', 'advisor'])
    expect(withdrawable(EMPTY)).toEqual([])
  })
  for (const lang of LANGS) it(`(${lang}) "What does withdrawing remove?" is dataControl's own summary, computed and never applied`, () => {
    const before = JSON.stringify(SAMPLE)
    for (const key of ['analyze', 'insight']) expect(withdrawPreview(SAMPLE, key, lang)).toEqual(withdrawConsent(SAMPLE, key, { lang }).summary.sentences[lang])
    expect(JSON.stringify(SAMPLE), 'the profile is unchanged').toBe(before)
    expect(withdrawPreview(SAMPLE, 'analyze', lang).join(' ')).toContain(demoCourses[0].code)
    const html = page(lang, SAMPLE, { entry: 'consents' })
    expect(html).toContain(`>${W(lang).previewTitle}</h3>`)
    expect([...html.matchAll(/<details class="ui2-settings-preview-item" data-consent="(\w+)"><summary>([^<]*)<\/summary>/g)].map(m => [m[1], m[2]]))
      .toEqual(['analyze', 'insight'].map(key => [key, copy[lang].app.consentItems[key]]))
    expect(textOf(page(lang, EMPTY, { entry: 'consents' }))).toContain(W(lang).previewNone)
  })
  it('withdrawing the transcript analysis removes the courses, collegeRaw and major (Task 55) and keeps the interests', () => {
    const { state } = withdrawConsent(SAMPLE, 'analyze', { lang: 'en' })
    expect(state.courses).toEqual([])
    expect(state.approved).toBe(false)
    expect(state.collegeRaw).toBeNull()
    expect(state.major).toBeNull()
    expect(state.consents.analyze).toBe(false)
    expect(state.insight.declaredPreferences).toEqual({ careerInterest: 'data' })
    expect(state.consents.insight).toBe(true)
    expect(profileSkills(state)).toEqual([])
  })
})

describe('Task 67 · the sub-pages', () => {
  for (const lang of LANGS) it(`(${lang}) each opens with its name as the title (h2 under the page heading "Settings") and "Back to Settings"; the list is gone`, () => {
    for (const section of SETTINGS_SECTIONS) {
      const html = page(lang, SAMPLE, { entry: section })
      expect(html, section).toContain(`<h1 id="ui2-page-title" tabindex="-1" class="ui2-vh">${VIEW_TEXT.settings.title[lang]}</h1>`)
      expect(html, section).toMatch(new RegExp(`<h2 id="[^"]+-title" class="ui2-settings-title" tabindex="-1">${W(lang).rows[section].replace(/[()]/g, '\\$&')}</h2>`))
      expect(html).toContain(`data-section="${section}"`)
      expect(textOf(html)).toContain(W(lang).back)
      expect(rowsOf(html)).toEqual([])
      expect(textOf(html)).not.toMatch(PERCENT)
    }
  })
  for (const lang of LANGS) it(`(${lang}) My courses, Usage log, Export and Consents say what they hold`, () => {
    const c = copy[lang]
    expect(textOf(page(lang, SAMPLE, { entry: 'courses' }))).toContain(NEXT_COPY[lang].profile.update)
    const empty = textOf(page(lang, EMPTY, { entry: 'courses' }))
    expect(empty).toContain(NEXT_COPY[lang].profile.upload)
    expect(empty).toContain(NEXT_COPY[lang].profile.noTranscript)
    const log = textOf(page(lang, SAMPLE, { entry: 'log' }))
    expect(log).toContain(c.screens.myData.auditIntro)
    expect(log).toContain(SAMPLE.audit[0].label)
    expect(textOf(page(lang, EMPTY, { entry: 'log' }))).toContain(W(lang).noEvents)
    const exp = page(lang, SAMPLE, { entry: 'export' })
    expect(textOf(exp)).toContain(W(lang).exportLine)
    expect(exp).toMatch(new RegExp(`data-testid="export-clr"[^>]*>.*${c.screens.myData.exportFile.replace(/[()]/g, '\\$&')}</button>`))
    expect(page(lang, EMPTY, { entry: 'export' })).toMatch(/data-testid="export-clr" disabled=""/)
    expect(textOf(page(lang, SAMPLE, { entry: 'consents' }))).toContain(c.screens.myData.privacyIntro)
  })
  for (const lang of LANGS) it(`(${lang}) after "Delete everything": the old confirmation, the device check, and what stays`, () => {
    const d = copy[lang].screens.start.deleted
    const clean = renderToStaticMarkup(createElement(DeletedConfirmation, { lang, deletion: { clean: true, studyKept: false } }))
    expect(clean).toMatch(/^<div class="deleted-confirmation" data-testid="deleted-confirmation" role="status">/)
    expect(textOf(clean)).toContain(`${d.title} ${d.text} ${d.outside}`)
    expect(textOf(clean)).toContain(d.technical)
    const incomplete = textOf(renderToStaticMarkup(createElement(DeletedConfirmation, { lang, deletion: { clean: false, studyKept: true } })))
    expect(incomplete).toContain(`${d.incompleteTitle} ${d.incompleteText}`)
    expect(incomplete).toContain(W(lang).studyKept)
  })
})

describe('Task 67 · where Settings is, and what loads when', () => {
  it('reached from Profile (its Settings row and "Correct a course"), never from Home, step 1, the feed or the top bar', () => {
    const profile = read('src/ui2/screens/Profile.jsx')
    expect(profile).toContain("onClick={() => onNavigate('settings')}")
    expect(profile).toContain('{w.correct}')
    const app = read('src/ui2/AppNext.jsx')
    expect(app).toContain("onCourses={() => openSettings('courses')}")
    for (const file of ['src/ui2/screens/Home.jsx', 'src/ui2/screens/Upload.jsx', 'src/ui2/screens/NextSteps.jsx', 'src/ui2/components/StepCard.jsx', 'src/ui2/components/ResultCard.jsx', 'src/ui2/TopBar.jsx', 'src/ui2/NavTabs.jsx']) {
      const source = read(file)
      expect(source, `${file}: no way to Settings`).not.toMatch(/'settings'|screens\/Settings/)
      expect(source, `${file}: no data control`).not.toMatch(/deleteAll|withdrawConsent|changePersistence|exportProfile|importProfile|exportClr|saveMyData|undoMyData|clearRecommendationReviews|dataControl/)
    }
  })
  it('Settings is lazy(import()) in AppNext; only Settings imports its row and its CSS; Privacy is loaded lazily only', () => {
    const app = read('src/ui2/AppNext.jsx')
    expect(app).toContain("const Settings = lazy(() => import('./screens/Settings.jsx'))")
    expect(app).not.toMatch(/^import[^\n]*screens\/Settings/m)
    const importers = needle => sourceFiles('src').filter(file => read(file).includes(needle)).map(file => file.split(path.sep).join('/'))
    expect(importers("components/SettingsRow.jsx'")).toEqual(['src/ui2/screens/Settings.jsx'])
    expect(importers("settings.css'")).toEqual(['src/ui2/screens/Settings.jsx'])
    // Task 70: the old interface (src/App.jsx) is deleted; nothing imports Privacy.jsx statically.
    for (const file of sourceFiles('src')) expect(read(file), file).not.toMatch(/^import[^\n]*components\/Privacy\.jsx'/m)
    expect(read('src/components/Privacy.jsx')).toMatch(/^export \{ StatusSummary, PermissionsSection, BackupSection, DeleteSection \}$/m)
  })
  it('the new words: the same keys in both languages, no percentage, the brief\'s row names', () => {
    const keys = value => (value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keys(v).map(sub => `${k}.${sub}`)]) : [])
    expect(keys(W('ar'))).toEqual(keys(W('en')))
    expect(JSON.stringify(W('ar')) + JSON.stringify(W('en'))).not.toMatch(/[%٪]/)
    expect(W('en').rows).toEqual({ courses: 'My courses', log: 'Usage log', save: 'Save on this device', backup: 'Backup and restore', share: 'Share a snapshot link', export: 'Download my capabilities file', consents: 'Consents', delete: 'Delete everything' })
    // Task 76 (team decision 2026-11-21): the brief's "Export (CLR JSON)" row is now plain words in both languages.
    expect(W('ar').rows.export).toBe('نزّل ملف قدراتي')
    expect(JSON.stringify(W('ar').rows) + JSON.stringify(W('en').rows)).not.toMatch(/CLR|JSON/)
  })
})
