import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import {parseSnapshotFragment} from './utils/capabilitySnapshot.js'
import { chooseUi } from './uiSwitch.js'
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

// Task 60: the new interface (src/ui2) is one lazy chunk, so the startup bundle does not carry it. Task 69: it is
// the default; ?ui=old (or the remembered choice) opens the old interface, which Task 70 deletes.
const AppNext = lazy(() => import('./ui2/AppNext.jsx'))

// Read once before React StrictMode initialisation. Never put the secret back
// in URLs, storage, logs or navigation state. HTTP requests omit fragments.
const incomingSnapshot=parseSnapshotFragment(location.hash)
if(incomingSnapshot)history.replaceState(null,'',location.pathname+location.search)
// Task 74: a shared snapshot link opens in the interface the switch chooses; both hold the snapshot reader.
const ui=chooseUi()==='old'?'old':'next'
// Task 61: the new interface's theme (System, Light or Dark) goes on <html data-theme> before the first
// render, so the page never paints in the other theme first. The old interface gets no data-theme: light only.
if(ui==='next')applyTheme(readTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {ui==='next'
      ? <Suspense fallback={null}><AppNext incomingSnapshot={incomingSnapshot}/></Suspense>
      : <App incomingSnapshot={incomingSnapshot}/>}
  </StrictMode>,
)


if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
