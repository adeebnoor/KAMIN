// Task 60 · details that slide up: a bottom sheet on phones, a side panel from 760px (the CSS decides).
// A modal dialog (aria-modal, named by its title): the page behind it is inert, Tab stays inside it,
// Esc, the close button, a tap outside it or a swipe down closes it, and focus goes back to what opened it.
// It sits on the inline end, so it follows the page direction (right in English, left in Arabic).
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
// How far (px) a swipe down must go before the sheet closes.
export const SWIPE_CLOSE_PX = 80

export default function Sheet({ open, onClose, title, lang = 'ar', children }) {
  const titleId = useId()
  const panel = useRef(null)
  const close = useRef(onClose)
  close.current = onClose
  const [drag, setDrag] = useState(0)
  const dragStart = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const opener = document.activeElement
    const page = document.getElementById('root')
    page?.setAttribute('inert', '')
    const first = panel.current?.querySelector(FOCUSABLE)
    ;(first || panel.current)?.focus()
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll(FOCUSABLE)]
      if (!items.length) { event.preventDefault(); return }
      const [firstItem, lastItem] = [items[0], items[items.length - 1]]
      if (event.shiftKey && (document.activeElement === firstItem || !panel.current.contains(document.activeElement))) { event.preventDefault(); lastItem.focus() }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      page?.removeAttribute('inert')
      if (opener?.isConnected) opener.focus?.()
    }
  }, [open])

  if (!open) return null
  // Swipe down on the handle or the title row (phones; touch, pen or mouse).
  const swipe = {
    onPointerDown: event => { if (event.target.closest?.('button')) return; dragStart.current = event.clientY; event.currentTarget.setPointerCapture?.(event.pointerId) },
    onPointerMove: event => { if (dragStart.current !== null) setDrag(Math.max(0, event.clientY - dragStart.current)) },
    onPointerUp: event => { const moved = dragStart.current === null ? 0 : event.clientY - dragStart.current; dragStart.current = null; setDrag(0); if (moved > SWIPE_CLOSE_PX) close.current() },
    onPointerCancel: () => { dragStart.current = null; setDrag(0) },
  }
  return createPortal(<div className="ui2-sheet-layer" data-testid="ui2-sheet-layer">
    <div className="ui2-sheet-backdrop" aria-hidden="true" onClick={() => close.current()}/>
    <div className="ui2-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panel}
      style={drag ? { transform: `translateY(${drag}px)` } : undefined}>
      <div className="ui2-sheet-handle" aria-hidden="true" {...swipe}><span/></div>
      <div className="ui2-sheet-head" {...swipe}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="ui2-btn ui2-icon-btn" onClick={() => close.current()} aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}><X size={18} aria-hidden="true"/></button>
      </div>
      <div className="ui2-sheet-body">{children}</div>
    </div>
  </div>, document.body)
}
