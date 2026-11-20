// Task 60 · the three tabs (Home, My plan, Profile): a bottom bar under 760px (icons and short labels, 44px
// targets, above the phone's safe area), a side rail from 760px. Each tab is a real link to ?app=<view>, so
// it can be opened in a new tab; a plain click changes the view in place (one history entry, Task 20).
// Task 75: the old sidebar's icons where the old interface had the same place (AppNav.jsx): My plan is the old "My next
// step" (SearchCheck), Profile the old "My capabilities" (LayoutDashboard). Home keeps House (the old app had no Home).
import { House, LayoutDashboard, SearchCheck } from 'lucide-react'
import { urlWithApp } from '../utils/useAppHistory.js'
import { NEXT_TABS, tabOf } from './views.js'

const ICONS = { home: House, plan: SearchCheck, profile: LayoutDashboard }

// A plain left click follows the link in the page; with a modifier key the browser opens it as usual.
export function followLink(event, go) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  go()
}

export default function NavTabs({ lang, view, onNavigate }) {
  const current = tabOf(view)
  return <nav className="ui2-tabs" aria-label={lang === 'ar' ? 'الأقسام' : 'Sections'} data-testid="ui2-tabs">
    <ul>
      {NEXT_TABS.map(tab => {
        const Icon = ICONS[tab.id]
        return <li key={tab.id}>
          <a className="ui2-tab" href={urlWithApp(tab.id)} aria-current={tab.id === current ? (tab.id === view ? 'page' : 'true') : undefined} onClick={event => followLink(event, () => onNavigate(tab.id))}>
            <Icon size={22} aria-hidden="true"/><span>{tab.labels[lang]}</span>
          </a>
        </li>
      })}
    </ul>
  </nav>
}
