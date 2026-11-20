// Task 61 · the new interface's theme: System (the default: follows the device), Light or Dark.
// The choice is kept on this device in localStorage 'kamin-theme'. It is an interface preference, not
// personal data, so "delete everything" keeps it, like the language ('kamin-lang', src/utils/dataControl.js).
// src/main.jsx calls applyTheme() before the first render of the new interface, so the page never paints in
// the wrong theme first. The old interface never gets a data-theme and stays light only (src/styles.css).
// This file is in the startup bundle, so it stays tiny; the theme's colours load with src/ui2 (theme.css).
export const THEME_KEY = 'kamin-theme'
// The three saved choices (System = nothing saved). Task 75: the toggle no longer cycles through them; it switches the
// theme shown (src/ui2/scheme.js), so System is only the first-visit default.
export const THEMES = Object.freeze(['system', 'light', 'dark'])

const deviceStorage = () => { try { return globalThis.localStorage ?? null } catch { return null } }

// The saved choice, or 'system' when none is saved, the value is unknown or storage is blocked.
export function readTheme(storage = deviceStorage()) {
  try {
    const saved = storage?.getItem(THEME_KEY)
    return THEMES.includes(saved) ? saved : 'system'
  } catch { return 'system' }
}

// Saves Light or Dark; System is the default, so choosing it removes the saved value.
export function saveTheme(choice, storage = deviceStorage()) {
  try {
    if (choice === 'light' || choice === 'dark') storage?.setItem(THEME_KEY, choice)
    else storage?.removeItem(THEME_KEY)
  } catch { /* blocked storage: the choice still applies to this page */ }
}

// <html data-theme="system|light|dark">: theme.css reads it (dark tokens under "dark", or under the
// device's dark setting unless "light"), and src/styles.css sets color-scheme from it.
export function applyTheme(choice, root = globalThis.document?.documentElement) {
  root?.setAttribute('data-theme', THEMES.includes(choice) ? choice : 'system')
}
