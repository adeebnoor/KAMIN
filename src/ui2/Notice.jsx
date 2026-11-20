// Task 60 · messages in the new interface keep Task 25's rule unchanged (src/components/Notice.jsx): one
// message at a time, in the page flow so it never covers the page, long enough to read, paused while the
// student points at it or is inside it, closed with ×, a polite status (an error is an alert), focus never
// moves to it. Only the place on the page is the new interface's.
import Notice, { useNotice, noticeDuration } from '../components/Notice.jsx'

export { useNotice, noticeDuration }

export default function NextNotice({ notice, onClose, lang }) {
  if (!notice) return null
  return <div className="ui2-notice"><Notice notice={notice} onClose={onClose} lang={lang}/></div>
}
