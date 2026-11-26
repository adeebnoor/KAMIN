import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import {parseSnapshotFragment} from './utils/snapshotLink.js'
import { applyTheme, readTheme } from './themeChoice.js'
import '../public/brand.css'
import './tokens.css'
import './cards.css'
import './styles.css'
import './experience.css'
import './digital-interests.css'
import './knowledge-workspace.css'
import './relationship-network.css'
import './semantic-tools.css'
import '../public/site-layout.css'
import './redesign.css'

// Task 70: the interface (src/ui2) is the only one; the old interface and its address switch are deleted. Any ?ui=
// value is ignored. The interface stays one lazy chunk, so the startup bundle does not carry it. The stylesheets
// above serve the old components the interface reuses (in .ui2-legacy), the error screen and the empty page.
const AppNext = lazy(() => import('./ui2/AppNext.jsx'))

// Read once before React StrictMode initialisation. Never put the secret back
// in URLs, storage, logs or navigation state. HTTP requests omit fragments.
const incomingSnapshot=parseSnapshotFragment(location.hash)
if(incomingSnapshot)history.replaceState(null,'',location.pathname+location.search)
// Task 61: the theme (System, Light or Dark) goes on <html data-theme> before the first render, so the page never
// paints in the other theme first.
applyTheme(readTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={null}><AppNext incomingSnapshot={incomingSnapshot}/></Suspense>
  </StrictMode>,
)


if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
