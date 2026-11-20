import { ChevronDown } from 'lucide-react'

// Task 27 · one section of "Consent, saving & deletion": a <details> whose summary is the heading and
// a one-line status, so the student sees the state without opening it. `open` is controlled by
// Privacy.jsx (at most two open); the browser's own toggle is reported through onToggle.
export default function PrivacySection({ id, title, status, open, onToggle, children }) {
  return <details className="panel privacy-section" id={`privacy-${id}`} data-privacy-section={id} open={open}
    onToggle={event => onToggle(id, event.currentTarget.open)}>
    <summary>
      <span className="privacy-section-head"><h3>{title}</h3>{status && <span className="privacy-section-status" data-testid={`privacy-status-${id}`}>{status}</span>}</span>
      <ChevronDown size={18} aria-hidden="true" className="privacy-section-chevron"/>
    </summary>
    <div className="privacy-section-body">{children}</div>
  </details>
}
