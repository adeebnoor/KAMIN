// Task 70 · the storage alert the old interface showed (src/App.jsx until Task 70, word for word): when the browser
// cannot save the session or the device copy, or could not finish deleting the device copy, the page says so and
// stays until the problem is gone (the profile hook clears status.storageError after the next successful write).
// It is an alert in the page flow, under the one message, never over the page. "Open saving & backup options" opens
// Settings → Back up and restore (an encrypted backup before leaving); "Recovery steps" opens the guide's section.
import { pageHref } from '../../public/site-content.js'
import { nextCopy } from './copy.js'

export default function StorageAlert({ lang, code, onBackup }) {
  if (!code) return null
  const w = nextCopy(lang).storage
  return <div className="ui2-notice">
    <div className="notice-slot" role="alert">
      <div className="notice notice-error ui2-storage-alert" data-testid="storage-alert" data-code={code}>
        <span className="notice-text"><strong>{code === 'delete' ? w.deleteTitle : w.title}</strong> {w.line}</span>
        <button type="button" className="button secondary notice-action" onClick={onBackup}>{w.open}</button>
        <a className="notice-action" href={pageHref('guide.html#recovery', lang)} target="_blank" rel="noreferrer">{w.recovery}</a>
      </div>
    </div>
  </div>
}
