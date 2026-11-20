// Task 75 · the theme SHOWN on screen (light or dark), as opposed to the saved choice (System, Light or Dark,
// src/themeChoice.js). With System (nothing saved: the first visit) the device decides. Loads with the new interface only.
// - The theme button (ThemeToggle.jsx) switches to the opposite of the theme shown, so one tap always changes the screen
//   (Task 61's cycle System → Light → Dark needed two taps on a light device: System → Light changed nothing).
// - <html data-scheme="light|dark"> mirrors the theme shown, so a rule can name the dark theme once (src/ui2/legacy-dark.css)
//   instead of twice (data-theme="dark" and the device's dark setting, as src/ui2/theme.css must for the tokens).
import { useEffect, useSyncExternalStore } from 'react'

const QUERY = '(prefers-color-scheme: dark)'
const media = () => { try { return globalThis.matchMedia?.(QUERY) ?? null } catch { return null } }

/** True when the device asks for dark. */
export const deviceDark = () => media()?.matches === true

/** The theme shown for a saved choice: Dark is dark, Light is light, System follows the device. */
export const shownTheme = (choice, dark = deviceDark()) => (choice === 'dark' || (choice !== 'light' && dark) ? 'dark' : 'light')

/** What one tap on the theme button chooses: the opposite of what is shown now. */
export const oppositeTheme = shown => (shown === 'dark' ? 'light' : 'dark')

/** Puts the theme shown on <html data-scheme>. */
export function markScheme(shown, root = globalThis.document?.documentElement) {
  root?.setAttribute('data-scheme', shown === 'dark' ? 'dark' : 'light')
}

const subscribe = onChange => {
  const list = media()
  list?.addEventListener?.('change', onChange)
  return () => list?.removeEventListener?.('change', onChange)
}

/** The theme shown for a choice, following the device's setting while it changes (System only). */
export function useShownTheme(choice) {
  const dark = useSyncExternalStore(subscribe, deviceDark, () => false)
  const shown = shownTheme(choice, dark)
  useEffect(() => { markScheme(shown) }, [shown])
  return shown
}
