import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SECTIONS, TABS, LEGACY_VIEWS, sectionOf, defaultView, resolveView, viewToParam, paramToView, pageName, topbarTitle, APP_PARAM } from '../src/navigation.js'
import { copy } from '../src/i18n.js'

// Task 09 · four sections; every older view id still resolves to its section and tab.
describe('navigation', () => {
  it('has exactly four sections, in the agreed order, labelled in Arabic and English', () => {
    expect(SECTIONS.map(s => s.id)).toEqual(['home', 'next', 'insight', 'my-data'])
    for (const s of SECTIONS) { expect(s.labels.ar).toBeTruthy(); expect(s.labels.en).toBeTruthy() }
  })

  it('maps every old view to a section, and old next-step and data views to a tab', () => {
    const old = ['dashboard', 'skills', 'start', 'review', 'studio', 'matches', 'courses', 'compare', 'insight', 'privacy', 'audit', 'mydata']
    for (const view of old) expect(sectionOf(view), view).toBeTruthy()
    expect(sectionOf('matches')).toBe('next')
    expect(sectionOf('skills')).toBe('home')
    expect(sectionOf('privacy')).toBe('my-data')
    expect(sectionOf('knowledge')).toBe(null)
    expect(TABS.next.map(t => t.view)).toEqual(['matches', 'courses', 'compare', 'studio'])
    expect(TABS['my-data'].map(t => t.view)).toEqual(['mydata', 'privacy', 'audit'])
    expect(Object.keys(LEGACY_VIEWS).sort()).toEqual([...old].sort())
  })

  it('opens each section on a page that works with or without an approved record', () => {
    expect(resolveView('home', { approved: false })).toBe('start')
    expect(resolveView('home', { approved: true })).toBe('dashboard')
    expect(resolveView('my-data', { approved: false })).toBe('privacy')
    expect(resolveView('my-data', { approved: true })).toBe('mydata')
    expect(resolveView('next', {})).toBe('matches')
    expect(resolveView('matches', {})).toBe('matches')
    expect(resolveView('knowledge', {})).toBe('knowledge')
    expect(resolveView('nonsense', { approved: true })).toBe('dashboard')
    expect(defaultView('insight')).toBe('insight')
  })

  it('the app has no disabled menu items and no "More" menu', () => {
    const app = readFileSync('src/App.jsx', 'utf8')
    expect(app).not.toMatch(/isLocked|mobile-more-tools|setMoreTools|student-journey/)
    expect(readFileSync('src/components/AppNav.jsx', 'utf8')).not.toMatch(/disabled=/)
  })
})

// Task 20 · the app view in the URL (?app=<view>): Back, refresh and links.
describe('app view in the URL', () => {
  const views = [...Object.keys(LEGACY_VIEWS), 'knowledge']

  it('puts only the view id in the URL, and nothing that is not a view', () => {
    expect(APP_PARAM).toBe('app')
    for (const view of views) expect(viewToParam(view), view).toBe(view)
    for (const value of [null, undefined, '', 'home', 'my-data', 'urn:kamin:x', 'CPIT-251', '<script>']) expect(viewToParam(value), String(value)).toBe(null)
  })

  it('opens the view a URL names, with the same rules as resolveView', () => {
    for (const view of views.filter(v => v !== 'review')) expect(paramToView(viewToParam(view), { approved: true }), view).toBe(view)
    expect(paramToView('privacy', { approved: false })).toBe('privacy')
    // Views that need a record still open: the view shows its NeedsRecord empty state.
    expect(paramToView('compare', { approved: false })).toBe('compare')
    // Section ids open the section's first page.
    expect(paramToView('next', {})).toBe('matches')
    expect(paramToView('my-data', { approved: false })).toBe('privacy')
    // Unknown values fall back to resolveView's default.
    expect(paramToView('nonsense', { approved: true })).toBe('dashboard')
    expect(paramToView('nonsense', { approved: false })).toBe('start')
    // No value: the app is not open.
    expect(paramToView(null, {})).toBe(null)
    expect(paramToView('', {})).toBe(null)
  })

  it('a link or refresh to the review screen opens the start screen (the draft is never in the URL or storage)', () => {
    expect(paramToView('review', { approved: false })).toBe('start')
    expect(paramToView('review', { approved: true })).toBe('start')
  })

  it('names every page for the announcement after a view change, in Arabic and English', () => {
    expect(pageName('privacy', 'en')).toBe('My data: Consent, saving & deletion')
    expect(pageName('privacy', 'ar')).toBe('بياناتي: الموافقات والحفظ والحذف')
    expect(pageName('compare', 'en')).toBe('My next step: Compare')
    expect(pageName('dashboard', 'en')).toBe('My capabilities')
    expect(pageName('insight', 'ar')).toBe('اهتماماتي وهدفي')
    expect(pageName('knowledge', 'en')).toBe('Knowledge explorer')
    for (const view of views) for (const lang of ['ar', 'en']) expect(pageName(view, lang), `${view} ${lang}`).toBeTruthy()
  })
})

// Task 26 · the app top bar: section title, save status chip, language button.
describe('app top bar', () => {
  const views = [...Object.keys(LEGACY_VIEWS), 'knowledge']

  it('the title is the active section label; review and the knowledge explorer have their own names', () => {
    for (const lang of ['ar', 'en']) for (const view of views.filter(v => !['review', 'knowledge'].includes(v))) {
      expect(topbarTitle(view, lang), `${view} ${lang}`).toBe(SECTIONS.find(s => s.id === sectionOf(view)).labels[lang])
    }
    expect(topbarTitle('review', 'en')).toBe('Review your record')
    expect(topbarTitle('review', 'ar')).toBe('راجع سجلك')
    expect(topbarTitle('knowledge', 'en')).toBe('Knowledge explorer')
    expect(topbarTitle('mydata', 'ar')).toBe('بياناتي')
    expect(topbarTitle('nonsense', 'en')).toBe('')
  })

  it('the save chip has its words in both languages, and the old top bar texts are gone', () => {
    expect(copy.en.app.savedOnDevice).toBe('Saved on this device')
    expect(copy.en.app.sessionOnly).toBe('This session only')
    expect(copy.ar.app.savedOnDevice).toBe('محفوظ على هذا الجهاز')
    expect(copy.ar.app.sessionOnly).toBe('لهذه الجلسة فقط')
    const app = readFileSync('src/App.jsx', 'utf8')
    expect(app).not.toMatch(/Student-reviewed profile|'Public release'|ملف راجعته أنت|'إصدار عام'/)
    // The sidebar keeps its line about local processing.
    expect(app).toContain('Local processing in public release')
  })

  it('the language button uses the same setLang as the site header, and the app is not remounted by a language change', () => {
    const app = readFileSync('src/App.jsx', 'utf8')
    expect(app).toMatch(/<KaminApp lang=\{lang\} setLang=\{setLang\}/)
    expect(app).toMatch(/<SiteHeader lang=\{lang\} setLang=\{setLang\}/)
    // No key that changes with the language on the app window (a remount would lose the review draft).
    expect(app).not.toMatch(/<(KaminApp|AppErrorBoundary)[^>]*key=/)
    // The close button gets focus once, when the window opens, not on every App render.
    expect(app).toContain('useEffect(()=>{closeButtonRef.current?.focus()},[])')
  })
})
