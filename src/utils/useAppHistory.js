// Task 20 · the app remembers where you are: Back, refresh and links.
// The app window keeps its view in one URL parameter (?app=<view>, src/navigation.js) and adds one
// browser history entry per view change, so Back and Forward move between views, a refresh or a
// shared link opens the same view, and Back from the first view closes the window.
// Only the view id goes into the URL. Never personal data (see the snapshot rule in src/main.jsx).
import { useEffect, useRef } from 'react'
import { APP_PARAM, paramToView, viewToParam } from '../navigation.js'

// How many app entries lie above the landing page entry the app was opened from. null: the app was
// opened by a link or a refresh, so there is no landing entry of ours below it.
const DEPTH = 'kaminAppDepth'
const historyState = () => (history.state && typeof history.state === 'object' ? history.state : {})
const depthNow = () => { const d = historyState()[DEPTH]; return Number.isInteger(d) ? d : null }

export const appParamInUrl = () => new URLSearchParams(location.search).get(APP_PARAM)

// The current address with ?app set to `param` (or removed when param is null). Other parameters
// (pilot=1, lang) and the language path stay as they are.
export function urlWithApp(param, { keepHash = true } = {}) {
  const url = new URL(location.href)
  if (param) url.searchParams.set(APP_PARAM, param)
  else url.searchParams.delete(APP_PARAM)
  return url.pathname + url.search + (keepHash ? url.hash : '')
}

// Replace the address without adding an entry, keeping the history state (the app depth).
export const replaceUrl = href => history.replaceState(history.state, '', href)

// One-time entry links (start=sample, start=profile, view=knowledge) are read once and removed, so a
// refresh never repeats them. Returns the entry to open, or null.
export function consumeEntryParams() {
  const url = new URL(location.href)
  const start = url.searchParams.get('start'), view = url.searchParams.get('view')
  const entry = view === 'knowledge' ? 'knowledge' : start === 'sample' ? 'sample' : start === 'profile' ? 'insight' : null
  let changed = false
  if (['sample', 'profile'].includes(start)) { url.searchParams.delete('start'); changed = true }
  if (view === 'knowledge') { url.searchParams.delete('view'); changed = true }
  if (changed) replaceUrl(url.pathname + url.search + url.hash)
  return entry
}

// ---------- The page (App): open, close, and Back past the first view ----------
// openApp(entry) opens the window; finishClose() closes it and gives focus back to the opener.
export function usePageHistory({ appOpen, openApp, finishClose }) {
  const openRef = useRef(appOpen)
  openRef.current = appOpen
  const actions = useRef({ openApp, finishClose })
  actions.current = { openApp, finishClose }
  useEffect(() => {
    const onPop = () => {
      const linked = appParamInUrl()
      if (!linked && openRef.current) actions.current.finishClose()
      else if (linked && !openRef.current) actions.current.openApp(linked)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // The close button and Escape: go back to the landing entry the app was opened from, so no app
  // entry is left behind and Back after closing does not reopen the window. Opened by a link or a
  // refresh (no landing entry of ours): remove ?app from the address instead.
  return function closeApp() {
    const depth = depthNow()
    if (appParamInUrl() && depth > 0) { history.go(-depth); return }
    if (appParamInUrl()) replaceUrl(urlWithApp(null))
    actions.current.finishClose()
  }
}

// ---------- The app window (KaminApp): one entry per view ----------
// Task 60: the new interface (src/ui2) uses the same rule with its own view ids: `toParam` / `fromParam`
// translate between views and the address (default: the old interface's, src/navigation.js), and
// `firstEntry: 'replace'` writes the first view into the address the page was opened with, because the new
// interface is the page itself, not a window opened over the landing page.
export function useAppHistory({ view, setView, getState, toParam = viewToParam, fromParam = paramToView, firstEntry = 'push' }) {
  const viewRef = useRef(view)
  viewRef.current = view
  const mounted = useRef(false), fromHistory = useRef(false), replaceNext = useRef(false)
  useEffect(() => {
    const want = toParam(view)
    if (!want) return
    const current = appParamInUrl()
    if (!mounted.current) {
      mounted.current = true
      // Opened from the page: one new entry. Opened by a link, a refresh or Forward: the address
      // already names a view; only write the view that really opened (e.g. review -> start).
      if (current || firstEntry === 'replace') replaceUrl(urlWithApp(want))
      else history.pushState({ ...historyState(), [DEPTH]: 1 }, '', urlWithApp(want))
      return
    }
    if (fromHistory.current) { fromHistory.current = false; return }
    if (replaceNext.current) { replaceNext.current = false; replaceUrl(urlWithApp(want)); return }
    if (current === want) return
    const depth = depthNow()
    history.pushState({ ...historyState(), [DEPTH]: depth === null ? null : depth + 1 }, '', urlWithApp(want))
  }, [view])
  useEffect(() => {
    const onPop = () => {
      const next = fromParam(appParamInUrl(), getState())
      if (!next || next === viewRef.current) return
      fromHistory.current = true
      setView(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // A view change that is not a step of the student's own (the saved profile was restored after the
  // window opened): change the address without a new entry.
  return {
    replaceView(next) {
      if (next === viewRef.current) return
      replaceNext.current = true
      setView(next)
    },
  }
}
