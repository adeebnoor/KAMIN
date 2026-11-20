// Task 25 · one message at a time. A short message about what just happened (profile restored,
// saved on this device, ...), shown in the page flow under the top bar so it never covers the page,
// long enough to read, paused while the student points at it or is inside it, and closed with ×.
import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleAlert, Check, Info, X } from 'lucide-react'

export const NOTICE_MIN_MS = 6000
export const NOTICE_MS_PER_CHAR = 60

// How long a message stays: max(6 s, 60 ms per character). Error messages stay until closed (null).
export function noticeDuration(message, tone = 'success') {
  if (tone === 'error') return null
  return Math.max(NOTICE_MIN_MS, NOTICE_MS_PER_CHAR * [...String(message ?? '')].length)
}

// One message at a time: show() replaces whatever is on screen.
export function useNotice() {
  const [notice, setNotice] = useState(null)
  const next = useRef(0)
  const show = useCallback((message, { tone = 'success', action = null } = {}) => setNotice({ id: ++next.current, message, tone, action }), [])
  const hide = useCallback(() => setNotice(null), [])
  return { notice, show, hide }
}

const ICONS = { success: Check, info: Info, error: CircleAlert }

function NoticeMessage({ notice, onClose, lang }) {
  const { message, tone, action } = notice
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const remaining = useRef(noticeDuration(message, tone))
  const close = useRef(onClose)
  close.current = onClose
  // The clock runs only while the student is neither pointing at the message nor inside it; a pause
  // keeps the time that was left.
  useEffect(() => {
    if (remaining.current === null || hovered || focused) return undefined
    const started = Date.now()
    const timer = setTimeout(() => close.current(), remaining.current)
    return () => { clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - started)) }
  }, [hovered, focused])
  const Icon = ICONS[tone] || Check
  return <div className={`notice notice-${tone}`} data-testid="notice" data-tone={tone}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <Icon size={18} aria-hidden="true"/>
    <span className="notice-text">{message}</span>
    {action && <button type="button" className="button secondary notice-action" onClick={() => { action.onClick(); close.current() }}>{action.label}</button>}
    <button type="button" className="icon-button notice-close" onClick={() => close.current()} aria-label={lang === 'ar' ? 'إغلاق الرسالة' : 'Close message'}><X size={16}/></button>
  </div>
}

// A message is a polite status (role="status", aria-live="polite"); an error is role="alert". Focus never
// moves to it. The region exists only while there is a message, as the old toast did, so the page
// has no extra empty status region the rest of the time.
export default function Notice({ notice, onClose, lang }) {
  if (!notice) return null
  const error = notice.tone === 'error'
  return <div className="notice-slot" role={error ? 'alert' : 'status'} aria-live={error ? undefined : 'polite'}>
    <NoticeMessage key={notice.id} notice={notice} onClose={onClose} lang={lang}/>
  </div>
}
