// Task 60 · the interface (src/ui2), its views and address rule, the Start/Continue button, and the rule that it
// stays out of the startup bundle. Task 70: the old interface and its switch (src/uiSwitch.js, ?ui=old / ?ui=next,
// the device's 'kamin-ui') are deleted; the interface is the only one.
import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { NEXT_VIEWS, NEXT_TABS, FLOW, VIEW_TEXT, tabOf, nextViewToParam, paramToNextView, resumeView, mainAction, OLD_VIEW_ADDRESSES, OLD_PRIVACY_SECTIONS, SETTINGS_SECTIONS, HELP_SECTIONS, oldAddress, translateOldAddress } from '../src/ui2/views.js'
import { blankState, hasMeaningfulProfileState } from '../src/state/profileState.js'
import { KEPT_INTERFACE_KEYS, RETIRED_UI_KEY, verifyDeviceCleared } from '../src/utils/dataControl.js'

// Task 70: the old interface's view ids and menu section ids (its src/navigation.js LEGACY_VIEWS and SECTIONS at
// b443bad). Old bookmarks and links still use them, so each keeps a destination (Task 69).
const OLD_VIEW_IDS = ['dashboard', 'skills', 'start', 'review', 'matches', 'courses', 'compare', 'studio', 'insight', 'mydata', 'privacy', 'audit']
const OLD_SECTION_IDS = ['home', 'next', 'insight', 'my-data']

// A small Storage stand-in (Map-backed, with key(i) and length, as the device check reads them).
function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries))
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)) },
    removeItem: key => { map.delete(key) },
    key: i => [...map.keys()][i] ?? null,
    get length() { return map.size },
    dump: () => Object.fromEntries(map),
  }
}
// Task 70 replaces Task 60's and 69's switch tests (?ui=old opened and remembered the old interface, ?ui=next forgot it,
// blocked storage fell back to the address): there is nothing left to switch. These check that no switch remains.
describe('Task 70 · one interface: no ?ui= switch, nothing remembered', () => {
  const sources = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? sources(p) : /\.(jsx?|mjs)$/.test(name) ? [p] : [] })

  it('the switch, the old root and the old view table are gone', () => {
    for (const gone of ['src/uiSwitch.js', 'src/App.jsx', 'src/navigation.js']) expect(existsSync(gone), gone).toBe(false)
  })

  it('src/main.jsx always renders the interface (lazy); any ?ui= value is ignored because nothing reads it', () => {
    const main = readFileSync('src/main.jsx', 'utf8')
    expect(main).not.toMatch(/chooseUi|uiSwitch|<App\b|ui==='/)
    expect(main).toMatch(/<Suspense fallback=\{null\}><AppNext incomingSnapshot=\{incomingSnapshot\}\/><\/Suspense>/)
    expect(main.match(/<AppNext\b/g)).toHaveLength(1)
    for (const file of sources('src')) {
      const code = readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '')
      expect(code, file).not.toMatch(/\.get\(\s*['"]ui['"]\s*\)|['"]kamin-ui['"]\s*,\s*['"]old/)
    }
  })

  // Task 74 (team decision 2026-11-19): the snapshot reader moved into the new interface; Task 70: it is the only one.
  it('a shared snapshot link opens in the interface, which reads it', () => {
    const main = readFileSync('src/main.jsx', 'utf8')
    expect(main).not.toMatch(/\|\|incomingSnapshot/)
    expect(main).toMatch(/<AppNext incomingSnapshot=\{incomingSnapshot\}\/>/)
  })

  it('Task 74 · the new interface shows the old snapshot reader, loaded only for a snapshot link, and reads a link opened later', () => {
    const app = readFileSync('src/ui2/AppNext.jsx', 'utf8').replace(/\r\n/g, '\n')
    expect(app).toMatch(/const SnapshotReceiver = lazy\(\(\) => import\('\.\.\/components\/CapabilitySnapshot\.jsx'\)\.then\(m => \(\{ default: m\.SnapshotReceiver \}\)\)\)/)
    expect(app).not.toMatch(/^import[^\n]*CapabilitySnapshot\.jsx'/m)
    expect(app).toMatch(/export default function AppNext\(\{ incomingSnapshot = null \}\)/)
    expect(app).toMatch(/window\.addEventListener\('hashchange', receive\)/)
    // The secret leaves the address at once, before anything else (CapabilitySnapshot's own promise).
    expect(app).toMatch(/const packet = parseSnapshotFragment\(location\.hash\)\n\s+if \(!packet\) return\n\s+replaceUrl\(location\.pathname \+ location\.search\)/)
    expect(app).toMatch(/<SnapshotReceiver key=\{snapshot\.version\} lang=\{lang\} packet=\{snapshot\.packet\} onClose=\{\(\) => setSnapshot\(null\)\}\/>/)
  })
})

describe('Task 69 · old addresses open the nearest view of the new interface (src/ui2/views.js)', () => {
  const at = path => translateOldAddress(`https://kamin.example${path}`)

  it('every old view id and old section id has a view of the new interface; no old id opens Home by accident', () => {
    for (const id of [...OLD_VIEW_IDS, 'knowledge']) {
      const target = oldAddress(id)
      expect(target, id).not.toBe(null)
      expect(NEXT_VIEWS, id).toContain(target.view)
      expect(paramToNextView(id), id).toBe(target.view)
    }
    for (const section of OLD_SECTION_IDS) expect(NEXT_VIEWS, section).toContain(paramToNextView(section))
    expect({ ...OLD_VIEW_ADDRESSES }).toEqual({
      start: 'upload', review: 'upload', dashboard: 'profile', skills: 'profile', matches: 'next', courses: 'next', compare: 'plan', studio: 'plan',
      insight: 'interests', mydata: 'settings#courses', privacy: 'settings', audit: 'settings#log', 'my-data': 'settings', knowledge: 'help#knowledge',
    })
    // Every section named is a real Settings section or Help tool.
    for (const target of Object.values(OLD_VIEW_ADDRESSES).filter(t => t.includes('#'))) {
      const [view, section] = target.split('#')
      expect(view === 'settings' ? SETTINGS_SECTIONS : HELP_SECTIONS, target).toContain(section)
    }
    for (const section of Object.values(OLD_PRIVACY_SECTIONS)) expect(SETTINGS_SECTIONS).toContain(section)
  })

  it('a new view id, no value or anything unknown is not an old address', () => {
    for (const value of [...NEXT_VIEWS, null, '', 'nonsense', '<script>', 'toString', '__proto__', 'constructor']) expect(oldAddress(value), String(value)).toBe(null)
    expect(paramToNextView('toString')).toBe('home')
    expect(paramToNextView('constructor')).toBe('home')
  })

  it('rewrites an old address once: the view, its section, and the other parameters kept', () => {
    expect(at('/en/?app=mydata')).toBe('/en/?app=settings#courses')
    expect(at('/ar/?app=audit&pilot=1')).toBe('/ar/?app=settings&pilot=1#log')
    expect(at('/en/?app=dashboard')).toBe('/en/?app=profile')
    expect(at('/en/?app=matches')).toBe('/en/?app=next')
    // Task 27's sections of "Consent, saving & deletion".
    expect(at('/en/?app=privacy')).toBe('/en/?app=settings')
    expect(at('/en/?app=privacy#backup')).toBe('/en/?app=settings#backup')
    expect(at('/en/?app=privacy#permissions')).toBe('/en/?app=settings#consents')
    expect(at('/en/?app=privacy#save')).toBe('/en/?app=settings')
    expect(at('/en/?app=privacy#nonsense')).toBe('/en/?app=settings')
    // Entry links are read once and leave the address.
    expect(at('/en/?start=profile')).toBe('/en/?app=interests')
    expect(at('/en/?view=knowledge')).toBe('/en/?app=help#knowledge')
    expect(at('/ar/?view=knowledge&app=dashboard')).toBe('/ar/?app=help#knowledge')
  })

  it('leaves new addresses and the entry links of the new interface (start=sample, pilot=1) alone', () => {
    for (const path of ['/en/', '/en/?app=settings#backup', '/ar/?app=help#pathways', '/en/?start=sample', '/en/?pilot=1', '/en/?app=nonsense', '/en/?view=other', '/en/?start=other'])
      expect(at(path), path).toBe(null)
  })

  it('the old-address table loads with the new interface, not in the startup bundle', () => {
    expect(readFileSync('src/utils/useAppHistory.js', 'utf8')).not.toMatch(/OLD_VIEW_ADDRESSES|translateOldAddress/)
    expect(readFileSync('src/ui2/AppNext.jsx', 'utf8')).toMatch(/translateOldAddress\(location\.href\)/)
  })
})

// Task 60 kept the interface choice like the language; Task 70: the choice ('kamin-ui') is retired with the old
// interface, so "delete everything" removes a leftover one and the device check would report it.
describe('Task 70 · "delete everything" keeps the language and the theme, and removes the retired interface choice', () => {
  const saved = { sessionStorage: globalThis.sessionStorage, localStorage: globalThis.localStorage }
  afterEach(() => { Object.assign(globalThis, saved) })

  it('kamin-lang and kamin-theme are not leftovers; kamin-ui and a personal key are', async () => {
    expect(KEPT_INTERFACE_KEYS).toEqual(['kamin-lang', 'kamin-theme'])
    expect(RETIRED_UI_KEY).toBe('kamin-ui')
    Object.assign(globalThis, { sessionStorage: memoryStorage(), localStorage: memoryStorage({ 'kamin-lang': 'ar', 'kamin-theme': 'dark' }) })
    expect((await verifyDeviceCleared()).leftovers).toEqual([])
    Object.assign(globalThis, { localStorage: memoryStorage({ [RETIRED_UI_KEY]: 'old', 'kamin-pilot-v1': '{}' }) })
    const check = await verifyDeviceCleared()
    expect(check.clean).toBe(false)
    expect(check.leftovers.sort()).toEqual(['local:kamin-pilot-v1', 'local:kamin-ui'])
  })

  it('the hook\'s "delete everything" removes the retired kamin-ui before the device check', () => {
    const hook = readFileSync('src/state/useKaminProfile.js', 'utf8')
    const remove = hook.indexOf("localStorage.removeItem('kamin-ui')")
    expect(remove).toBeGreaterThan(hook.indexOf('const deleteAll = async () => {'))
    expect(remove).toBeLessThan(hook.indexOf('await verifyDeviceCleared('))
  })
})

describe('Task 60 · views, tabs and the address (src/ui2/views.js)', () => {
  it('has the nine views of the brief, three tabs and the four steps', () => {
    expect(NEXT_VIEWS).toEqual(['home', 'upload', 'projects', 'interests', 'next', 'plan', 'profile', 'settings', 'help'])
    expect(NEXT_TABS.map(tab => tab.id)).toEqual(['home', 'plan', 'profile'])
    expect(NEXT_TABS.map(tab => tab.labels.en)).toEqual(['Home', 'My plan', 'Profile'])
    expect(FLOW).toEqual(['upload', 'projects', 'interests', 'next'])
    // Settings and Help are reached from Profile, not tabs.
    expect(NEXT_TABS.map(tab => tab.id)).not.toContain('settings')
    expect(NEXT_TABS.map(tab => tab.id)).not.toContain('help')
  })

  it('every view has a heading and one sentence in Arabic and English, and belongs to one tab', () => {
    expect(Object.keys(VIEW_TEXT).sort()).toEqual([...NEXT_VIEWS].sort())
    for (const view of NEXT_VIEWS) {
      for (const lang of ['ar', 'en']) {
        expect(VIEW_TEXT[view].title[lang], `${view} ${lang}`).toBeTruthy()
        const line = VIEW_TEXT[view].line[lang]
        expect(line.split(/[.؛!?]\s/).length, `${view} ${lang}: one sentence`).toBeLessThanOrEqual(2)
        expect(line.length, `${view} ${lang}: short`).toBeLessThanOrEqual(90)
      }
      expect(NEXT_TABS.map(tab => tab.id)).toContain(tabOf(view))
    }
    expect(Object.fromEntries(NEXT_VIEWS.map(view => [view, tabOf(view)]))).toEqual({
      home: 'home', upload: 'home', projects: 'home', interests: 'home', next: 'home', plan: 'plan', profile: 'profile', settings: 'profile', help: 'profile',
    })
  })

  it('only a view id goes into the address; an unknown value opens Home, no value opens nothing', () => {
    for (const view of NEXT_VIEWS) { expect(nextViewToParam(view)).toBe(view); expect(paramToNextView(view)).toBe(view) }
    expect(nextViewToParam('dashboard')).toBe(null)
    expect(nextViewToParam({ name: 'x' })).toBe(null)
    // Task 69: an old interface's view id opens its nearest view (it opened Home before); a typo still opens Home.
    expect(paramToNextView('dashboard')).toBe('profile')
    expect(paramToNextView('nonsense')).toBe('home')
    expect(paramToNextView('<script>')).toBe('home')
    expect(paramToNextView(null)).toBe(null)
    expect(paramToNextView('')).toBe(null)
  })

  it('the main button says Start with no profile and Continue where the flow stopped', () => {
    const blank = { ...blankState }
    expect(mainAction(blank, hasMeaningfulProfileState(blank))).toEqual({ kind: 'start', view: 'upload' })
    // A transcript in review but not approved yet: continue at step 1.
    const drafted = { ...blankState, courses: [{ code: 'CPIT-110', grade: 'A' }] }
    expect(mainAction(drafted, hasMeaningfulProfileState(drafted))).toEqual({ kind: 'continue', view: 'upload' })
    const approved = { ...blankState, approved: true, courses: drafted.courses }
    expect(mainAction(approved, hasMeaningfulProfileState(approved))).toEqual({ kind: 'continue', view: 'projects' })
    const withProject = { ...approved, projects: [{ id: 'p1' }] }
    expect(resumeView(withProject)).toBe('interests')
    const withInterests = { ...approved, consents: { ...blankState.consents, analyze: true, insight: true } }
    expect(resumeView(withInterests)).toBe('next')
    // Interests given before any transcript: the flow still stops at step 1.
    expect(resumeView({ ...blankState, consents: { ...blankState.consents, insight: true } })).toBe('upload')
    expect(resumeView(undefined)).toBe('upload')
  })
})

describe('Task 60 · the new interface stays out of the startup bundle', () => {
  const sourceFiles = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? sourceFiles(p) : /\.(jsx?|css)$/.test(name) ? [p] : [] })

  it('src/main.jsx loads src/ui2 only with lazy(() => import(\'./ui2/AppNext.jsx\'))', () => {
    const main = readFileSync('src/main.jsx', 'utf8')
    expect(main).toContain("const AppNext = lazy(() => import('./ui2/AppNext.jsx'))")
    // Task 74: the interface takes the shared snapshot link too. Task 70: no switch; the interface is always rendered.
    expect(main).toMatch(/<Suspense fallback=\{null\}><AppNext incomingSnapshot=\{incomingSnapshot\}\/><\/Suspense>/)
    expect(main).not.toMatch(/^import[^\n]*['"]\.\/ui2\//m)
  })

  it('no file outside src/ui2 imports from it statically', () => {
    const offenders = sourceFiles('src').filter(file => !file.split(path.sep).includes('ui2'))
      .filter(file => /(?:^|\n)\s*import[^\n]*from\s*['"][^'"]*\/ui2\//.test(readFileSync(file, 'utf8')) || /(?:^|\n)\s*import\s*['"][^'"]*\/ui2\//.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('the new interface reuses the shared profile hook, Task 20\'s address rule and Task 25\'s message rule', () => {
    const app = readFileSync('src/ui2/AppNext.jsx', 'utf8')
    expect(app).toMatch(/useKaminProfile\(/)
    expect(app).toMatch(/useAppHistory\(\{[^}]*toParam: nextViewToParam, fromParam: paramToNextView \}\)/)
    expect(readFileSync('src/ui2/Notice.jsx', 'utf8')).toMatch(/from '\.\.\/components\/Notice\.jsx'/)
    const history = readFileSync('src/utils/useAppHistory.js', 'utf8')
    // Task 70: the old interface's defaults (its view table) and its 'push' first entry are gone; the interface passes its own.
    expect(history).toMatch(/export function useAppHistory\(\{ view, setView, getState, toParam, fromParam \}\)/)
    expect(history.replace(/^\s*\/\/.*$/gm, '')).not.toMatch(/usePageHistory|consumeEntryParams|navigation\.js'/)
  })

  it('ui2.css uses the brand and spacing tokens only: no colour literals', () => {
    const css = readFileSync('src/ui2/ui2.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi)).toBe(null)
    expect(css).toMatch(/var\(--navy\)/)
    expect(css).toMatch(/var\(--space-4\)/)
  })
})
