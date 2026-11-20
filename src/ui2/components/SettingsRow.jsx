// Task 67 · one row of Settings: an icon, the section's name, a one-line status when there is one (e.g. "7 courses",
// "2 of 4 on") and a chevron. A tap opens the section's sub-page (?app=settings#<section>). The row is a button named by
// what it shows, so the status is part of its accessible name.
import { ChevronDown } from 'lucide-react'

export default function SettingsRow({ icon: Icon, label, status, section, onOpen }) {
  return <button type="button" className="ui2-settings-row" data-section={section} onClick={onOpen}>
    <Icon size={18} aria-hidden="true"/>
    <span className="ui2-settings-row-label">{label}</span>
    {status && <span className="ui2-settings-row-status">{status}</span>}
    <ChevronDown size={16} className="ui2-settings-row-open" aria-hidden="true"/>
  </button>
}
