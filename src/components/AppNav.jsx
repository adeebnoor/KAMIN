import { useEffect, useRef } from 'react'
import { Fingerprint, LayoutDashboard, LockKeyhole, UploadCloud, SearchCheck } from 'lucide-react'
import { SECTIONS, TABS, sectionOf } from '../navigation.js'

// Task 09 · the same four sections in the desktop sidebar and the mobile bottom bar. No item is
// ever disabled and there is no "More" menu.
const ICONS = { home: LayoutDashboard, next: SearchCheck, insight: Fingerprint, 'my-data': LockKeyhole }

export default function AppNav({ lang, view, onNavigate, variant = 'sidebar' }) {
  const current = sectionOf(view)
  const label = variant === 'bottom' ? (lang === 'ar' ? 'تنقل التطبيق على الجوال' : 'Mobile app navigation') : (lang === 'ar' ? 'أقسام كامن' : 'Kamin sections')
  return <nav className={variant === 'bottom' ? 'bottom-nav' : 'app-nav'} aria-label={label}>
    {SECTIONS.map(section => {
      const Icon = ICONS[section.id]
      return <button key={section.id} type="button" className={current === section.id ? 'active' : ''} aria-current={current === section.id ? 'page' : undefined} onClick={() => onNavigate(section.id)} data-section={section.id}>
        <Icon size={18}/><span className="nav-copy"><span>{section.labels[lang]}</span></span>
      </button>
    })}
  </nav>
}

// Small tabs inside "My next step" and "My data". Task 23: on phones they stay on one line; if they do
// not fit, the tab bar itself scrolls (never the page) and the active tab is scrolled into view.
export function SectionTabs({ lang, view, onNavigate }) {
  const section = sectionOf(view)
  const tabs = TABS[section]
  const barRef = useRef(null)
  useEffect(() => { barRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }) }, [view])
  if (!tabs) return null
  return <div className="section-tabs" ref={barRef} data-scroll-x role="tablist" aria-label={SECTIONS.find(s => s.id === section).labels[lang]}>
    {tabs.map(tab => <button key={tab.view} type="button" role="tab" id={`tab-${tab.view}`} aria-selected={view === tab.view} tabIndex={view === tab.view ? 0 : -1}
      onClick={() => onNavigate(tab.view)}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const i = tabs.findIndex(t => t.view === view)
        const rtl = document.documentElement.dir === 'rtl'
        const step = (event.key === 'ArrowRight') !== rtl ? 1 : -1
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + step + tabs.length) % tabs.length
        onNavigate(tabs[next].view)
        requestAnimationFrame(() => document.getElementById(`tab-${tabs[next].view}`)?.focus())
      }}>{tab.labels[lang]}</button>)}
  </div>
}

// Empty state for a page that needs an approved record: what is missing, and one action.
export function NeedsRecord({ lang, onAdd }) {
  return <div className="panel needs-record" data-testid="needs-record" role="note">
    <UploadCloud size={26}/>
    <div><h3>{lang === 'ar' ? 'يحتاج هذا القسم إلى سجلك الدراسي' : 'This section needs your academic record'}</h3>
      <p>{lang === 'ar' ? 'أضف كشف درجاتك وراجعه، أو جرّب المثال التوضيحي. يمكنك أيضًا البدء باهتماماتك من «اهتماماتي وهدفي».' : 'Add and review your transcript, or try the synthetic example. You can also start with your interests in “Interests & goal”.'}</p>
      <button type="button" className="button primary" onClick={onAdd}>{lang === 'ar' ? 'أضف سجلك الدراسي' : 'Add your transcript'}</button></div>
  </div>
}
