// Task 20 · the app remembers where you are: Back, refresh and links.
// The app keeps its view in one URL parameter (?app=<view>) and adds one browser history entry per view change,
// so Back and Forward move between views and a refresh or a shared link opens the same view.
// Only the view id goes into the URL. Never personal data (see the snapshot rule in src/main.jsx).
// Task 70: the old interface's window (usePageHistory, consumeEntryParams) and its view table (src/navigation.js)
// are deleted; the interface (src/ui2) passes its own view ids (src/ui2/views.js).
import { useEffect, useRef } from 'react'

export const APP_PARAM = 'app'

// How many app entries lie above the first one. null: opened by a link or a refresh.
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

// One entry per view. `toParam` / `fromParam` translate between views and the address (src/ui2/views.js). The first
// view is written into the address the page was opened with (the interface is the page itself).
export function useAppHistory({ view, setView, getState, toParam, fromParam }) {
  const viewRef = useRef(view)
  viewRef.current = view
  const mounted = useRef(false), fromHistory = useRef(false), replaceNext = useRef(false)
  useEffect(() => {
    const want = toParam(view)
    if (!want) return
    const current = appParamInUrl()
    if (!mounted.current) {
      mounted.current = true
      replaceUrl(urlWithApp(want))
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
  // page opened): change the address without a new entry.
  return {
    replaceView(next) {
      if (next === viewRef.current) return
      replaceNext.current = true
      setView(next)
    },
  }
}
