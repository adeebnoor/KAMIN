import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import {parseSnapshotFragment} from './utils/capabilitySnapshot.js'
import '../public/brand.css'
import './styles.css'
import './experience.css'
import './digital-interests.css'
import './knowledge-workspace.css'
import './relationship-network.css'
import './semantic-tools.css'
import '../public/site-layout.css'

// Read once before React StrictMode initialisation. Never put the secret back
// in URLs, storage, logs or navigation state. HTTP requests omit fragments.
const incomingSnapshot=parseSnapshotFragment(location.hash)
if(incomingSnapshot)history.replaceState(null,'',location.pathname+location.search)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App incomingSnapshot={incomingSnapshot}/>
  </StrictMode>,
)


if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
