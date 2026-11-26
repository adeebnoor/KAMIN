// Task 61 · the theme choice (System, Light, Dark): saved on this device, applied before the first render,
// kept by "delete everything", and only for the new interface (the old one stays light only).
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { THEME_KEY, THEMES, readTheme, saveTheme, applyTheme } from '../src/themeChoice.js'
import { oppositeTheme, shownTheme, markScheme } from '../src/ui2/scheme.js'
import { themeLabel } from '../src/ui2/ThemeToggle.jsx'
import { KEPT_INTERFACE_KEYS, verifyDeviceCleared } from '../src/utils/dataControl.js'

const read = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
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
const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
const fakeRoot = () => { const attrs = {}; return { setAttribute: (name, value) => { attrs[name] = value }, attrs } }

describe('Task 61 · the theme choice (src/themeChoice.js)', () => {
  it('System is the default; Light and Dark are read back; anything else is System', () => {
    expect(THEME_KEY).toBe('kamin-theme')
    expect(THEMES).toEqual(['system', 'light', 'dark'])
    expect(readTheme(memoryStorage())).toBe('system')
    expect(readTheme(memoryStorage({ 'kamin-theme': 'light' }))).toBe('light')
    expect(readTheme(memoryStorage({ 'kamin-theme': 'dark' }))).toBe('dark')
    expect(readTheme(memoryStorage({ 'kamin-theme': 'purple' }))).toBe('system')
    expect(readTheme(null)).toBe('system')
    expect(readTheme(blocked)).toBe('system')
  })

  it('Light and Dark are saved; choosing System removes the saved value; blocked storage never throws', () => {
    const storage = memoryStorage()
    saveTheme('light', storage)
    expect(storage.dump()).toEqual({ 'kamin-theme': 'light' })
    saveTheme('dark', storage)
    expect(storage.dump()).toEqual({ 'kamin-theme': 'dark' })
    saveTheme('system', storage)
    expect(storage.dump()).toEqual({})
    expect(() => saveTheme('dark', blocked)).not.toThrow()
  })

  it('applies the choice to <html data-theme>; an unknown value applies System', () => {
    for (const choice of THEMES) { const root = fakeRoot(); applyTheme(choice, root); expect(root.attrs).toEqual({ 'data-theme': choice }) }
    const root = fakeRoot(); applyTheme('neon', root); expect(root.attrs).toEqual({ 'data-theme': 'system' })
  })

  // Task 75 (Amjd, 2026-11-19): Task 61's cycle System → Light → Dark → System needed two taps on a light device (System →
  // Light changed nothing on screen). The toggle now switches the theme shown; this test replaces the cycle test.
  it('Task 75 · one tap switches to the opposite of the theme shown; System (nothing saved) follows the device', () => {
    expect([shownTheme('system', false), shownTheme('system', true)]).toEqual(['light', 'dark'])
    expect([shownTheme('light', true), shownTheme('dark', false)]).toEqual(['light', 'dark'])
    expect([oppositeTheme('light'), oppositeTheme('dark')]).toEqual(['dark', 'light'])
    // Every starting point changes the screen with one tap, and the tap saves Light or Dark (never System again).
    for (const choice of THEMES) for (const dark of [false, true]) {
      const before = shownTheme(choice, dark)
      const next = oppositeTheme(before)
      expect(['light', 'dark']).toContain(next)
      expect(shownTheme(next, dark), `${choice} on a ${dark ? 'dark' : 'light'} device`).not.toBe(before)
    }
    const root = fakeRoot(); markScheme('dark', root); expect(root.attrs).toEqual({ 'data-scheme': 'dark' })
    expect(read('src/themeChoice.js')).not.toMatch(/nextTheme/)
    expect(read('src/ui2/ThemeToggle.jsx')).toMatch(/const next = oppositeTheme\(shown\)/)
  })

  it('Task 75 · the name says the theme shown, whether it follows the device, and what a tap does', () => {
    expect(themeLabel('light', 'en', true)).toBe('Theme: Light (follows your device). Tap to switch to Dark')
    expect(themeLabel('dark', 'en', true)).toBe('Theme: Dark (follows your device). Tap to switch to Light')
    expect(themeLabel('light', 'en')).toBe('Theme: Light. Tap to switch to Dark')
    expect(themeLabel('dark', 'en')).toBe('Theme: Dark. Tap to switch to Light')
    expect(themeLabel('light', 'ar', true)).toBe('المظهر: فاتح (حسب جهازك). اضغط للتبديل إلى الداكن')
    expect(themeLabel('light', 'ar')).toBe('المظهر: فاتح. اضغط للتبديل إلى الداكن')
    expect(themeLabel('dark', 'ar')).toBe('المظهر: داكن. اضغط للتبديل إلى الفاتح')
  })
})

describe('Task 61 · "delete everything" keeps the theme, like the language', () => {
  const saved = { sessionStorage: globalThis.sessionStorage, localStorage: globalThis.localStorage }
  afterEach(() => { Object.assign(globalThis, saved) })

  it('kamin-theme is a kept interface key, and the comment says so', async () => {
    expect(KEPT_INTERFACE_KEYS).toContain('kamin-theme')
    // Task 70: 'kamin-ui' (the old interface switch) is no longer kept; "delete everything" removes it (tests/uiNext.test.js).
    Object.assign(globalThis, { sessionStorage: memoryStorage(), localStorage: memoryStorage({ 'kamin-lang': 'en', 'kamin-theme': 'dark' }) })
    expect((await verifyDeviceCleared()).leftovers).toEqual([])
    Object.assign(globalThis, { localStorage: memoryStorage({ 'kamin-theme': 'dark', 'kamin-pilot-v1': '{}' }) })
    expect((await verifyDeviceCleared()).leftovers).toEqual(['local:kamin-pilot-v1'])
    expect(read('src/utils/dataControl.js')).toMatch(/Task 61, the theme\n\/\/ \('kamin-theme'/)
  })
})

describe('Task 61 · applied early, new interface only, theme code stays lazy', () => {
  // Task 70: the interface is the only one, so the theme is applied unconditionally (no interface switch any more).
  it('src/main.jsx applies the saved theme before the first render', () => {
    const main = read('src/main.jsx')
    expect(main).toMatch(/^import \{ applyTheme, readTheme \} from '\.\/themeChoice\.js'$/m)
    const apply = main.indexOf("applyTheme(readTheme())")
    expect(apply).toBeGreaterThan(main.indexOf("const incomingSnapshot="))
    expect(apply).toBeLessThan(main.indexOf('createRoot('))
    expect(main.match(/applyTheme\(/g)).toHaveLength(1)
  })

  it('src/themeChoice.js is tiny and imports nothing (it is in the startup bundle)', () => {
    const source = read('src/themeChoice.js')
    expect(source).not.toMatch(/^import /m)
    expect(Buffer.byteLength(source)).toBeLessThan(3000)
  })

  it('the colours load with the new interface only: theme.css is imported by AppNext and nowhere else', () => {
    expect(read('src/ui2/AppNext.jsx')).toMatch(/^import '\.\/theme\.css'$/m)
    expect(read('src/main.jsx')).not.toMatch(/theme\.css/)
    expect(read('src/ui2/TopBar.jsx')).toMatch(/^import ThemeToggle from '\.\/ThemeToggle\.jsx'$/m)
    expect(read('src/ui2/TopBar.jsx')).toMatch(/<ThemeToggle lang=\{lang\}\/>/)
  })

  it('index.html allows both schemes; the old interface stays light only (src/styles.css)', () => {
    expect(read('index.html')).toContain('<meta name="color-scheme" content="light dark" />')
    const styles = read('src/styles.css')
    expect(styles).toMatch(/^:root\{color-scheme:light\}$/m)
    expect(styles).toMatch(/^:root\[data-theme\]\{color-scheme:light dark;background:Canvas\}$/m)
    expect(styles).toMatch(/^:root\[data-theme="light"\]\{color-scheme:light\}$/m)
    expect(styles).toMatch(/^:root\[data-theme="dark"\]\{color-scheme:dark\}$/m)
    // Task 70: the old interface's code (src/App.jsx, which never set a theme) is deleted.
  })
})
