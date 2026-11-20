// Task 61 · the theme toggle in the top bar. The choice is kept in localStorage 'kamin-theme' (not personal data;
// "delete everything" keeps it) and applied to <html data-theme> at once; src/main.jsx applies the saved choice before
// the first render, so a reload never flashes the other theme.
// Task 75 (Amjd, 2026-11-19: "the theme button needs two clicks"): one tap always switches to the opposite of the theme
// shown now, Light ↔ Dark, and saves it. "Follow the device" (System) is only the first-visit default: with nothing saved
// the page follows the device, and the button's name says so. The icon shows the theme shown (src/ui2/scheme.js).
import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { applyTheme, readTheme, saveTheme } from '../themeChoice.js'
import { markScheme, oppositeTheme, shownTheme, useShownTheme } from './scheme.js'

const ICONS = { light: Sun, dark: Moon }
const NAMES = {
  ar: { light: 'فاتح', dark: 'داكن', device: ' (حسب جهازك)' },
  en: { light: 'Light', dark: 'Dark', device: ' (follows your device)' },
}
const NEXT_NAMES = { ar: { light: 'الفاتح', dark: 'الداكن' }, en: { light: 'Light', dark: 'Dark' } }

/** "Theme: Light (follows your device). Tap to switch to Dark": the theme shown, whether it follows the device, the tap. */
export const themeLabel = (shown, lang, followsDevice = false) => {
  const n = NAMES[lang === 'ar' ? 'ar' : 'en']
  const now = `${n[shown]}${followsDevice ? n.device : ''}`
  return lang === 'ar'
    ? `المظهر: ${now}. اضغط للتبديل إلى ${NEXT_NAMES.ar[oppositeTheme(shown)]}`
    : `Theme: ${now}. Tap to switch to ${NEXT_NAMES.en[oppositeTheme(shown)]}`
}

// The theme shown is on <html data-scheme> as soon as the new interface loads, before its first render.
markScheme(shownTheme(readTheme()))

export default function ThemeToggle({ lang }) {
  const [choice, setChoice] = useState(readTheme)
  const shown = useShownTheme(choice)
  const Icon = ICONS[shown]
  const label = themeLabel(shown, lang, choice === 'system')
  const change = () => {
    const next = oppositeTheme(shown)
    saveTheme(next)
    applyTheme(next)
    markScheme(next)
    setChoice(next)
  }
  return <button type="button" className="ui2-btn ui2-icon-btn" aria-label={label} title={label} data-testid="ui2-theme" data-theme-choice={choice} data-theme-shown={shown} onClick={change}>
    <Icon size={18} aria-hidden="true"/>
  </button>
}
