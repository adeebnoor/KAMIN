// Task 60 · the slim top bar (sticky, 56px). Only five controls: the logo (goes Home), the main button
// (Start with no profile yet, Continue where the flow stopped), Profile, the language switch and the theme
// toggle (Task 61: System, Light, Dark; src/ui2/ThemeToggle.jsx). Nothing else goes here.
// Task 75: the logo is the old interface's brand (its sidebar's .app-brand): the "ك" mark, then "Kamin" and the tagline
// from src/i18n.js (name, tagline; in the startup bundle already). The link's name stays "KAMIN: Home". Profile has the
// icon of the old "My capabilities" (LayoutDashboard, AppNav.jsx), like its tab.
import { ArrowLeft, ArrowRight, LayoutDashboard } from 'lucide-react'
import { copy } from '../i18n.js'
import { urlWithApp } from '../utils/useAppHistory.js'
import { VIEW_TEXT } from './views.js'
import { followLink } from './NavTabs.jsx'
import ThemeToggle from './ThemeToggle.jsx'

const WORDS = {
  ar: { home: 'كامن: الرئيسية', logo: 'شعار كامن', start: 'ابدأ', continue: 'تابع', other: 'English', otherShort: 'EN', otherLang: 'en' },
  en: { home: 'KAMIN: Home', logo: 'KAMIN logo', start: 'Start', continue: 'Continue', other: 'العربية', otherShort: 'ع', otherLang: 'ar' },
}

export default function TopBar({ lang, action, view, onNavigate, onLanguage }) {
  const w = WORDS[lang]
  const Forward = lang === 'ar' ? ArrowLeft : ArrowRight
  return <header className="ui2-topbar" data-testid="ui2-topbar">
    <a className="ui2-logo" href={urlWithApp('home')} aria-label={w.home} onClick={event => followLink(event, () => onNavigate('home'))}>
      <span className="ui2-mark" aria-hidden="true">ك</span>
      <span className="ui2-brand" aria-hidden="true"><strong>{copy[lang].name}</strong><small>{copy[lang].tagline}</small></span>
    </a>
    <div className="ui2-topbar-actions">
      <button type="button" className="ui2-btn ui2-btn-primary" data-testid="ui2-main-action" data-kind={action.kind} onClick={() => onNavigate(action.view)}>
        {action.kind === 'start' ? w.start : w.continue}<Forward size={18} aria-hidden="true"/>
      </button>
      <button type="button" className="ui2-btn ui2-icon-btn" aria-current={view === 'profile' ? 'page' : undefined} onClick={() => onNavigate('profile')}>
        <LayoutDashboard size={18} aria-hidden="true"/><span className="ui2-label-wide">{VIEW_TEXT.profile.title[lang]}</span>
      </button>
      <button type="button" className="ui2-btn ui2-icon-btn" lang={w.otherLang} aria-label={w.other} onClick={onLanguage}>{w.otherShort}</button>
      <ThemeToggle lang={lang}/>
    </div>
  </header>
}
