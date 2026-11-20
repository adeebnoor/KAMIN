// Task 18 · the trial with FCIT students, browser-only.
// Nothing is sent anywhere: there is no endpoint and no network call in this file. A participant who
// agreed to take part builds a small local queue (allowlisted events, times rounded to the minute,
// the six task outcomes and the feedback form). At the end they review it and download it as
// "my anonymous study file", which they hand to the team themselves. Withdrawing deletes the queue.
// The consent text is in src/content/pilotConsent.js; it needs the supervisor's approval.
// Task 44: this file is in the startup bundle, so it keeps only what every page needs (the record, pilot mode,
// the funnel events, clearing). Joining, the end-of-session form, the study file and withdrawal moved to
// src/pilot/studyFile.js, and the suggestion counts to src/pilot/studyCounts.js; both load with the screens.

const EVENT_ALLOWLIST = new Set([
  'landing',
  'sample_report_viewed',
  'upload_started',
  'upload_completed',
  'profile_returned_to',
  'profile_completed',
  'feedback_submitted',
  'study_joined',
  'synthetic_transcript_loaded',
])

export const STUDY_KEY = 'kamin-pilot-study-v1'
export const STUDY_SCHEMA = 'kamin-pilot-study-v1'
// Keys from the earlier (server-based) pilot code. They are still removed so no old copy is left.
export const LEGACY_PILOT_KEYS = Object.freeze(['kamin-pilot-events-v1', 'kamin-pilot-feedback-v1', 'kamin-pilot-anon-v1'])
export const MAX_EVENTS = 200

// Pilot mode is on with ?pilot=1, with the build flag VITE_PILOT_MODE=true, or while a participant is enrolled.
export const PILOT_BUILD_ENABLED = String(import.meta.env?.VITE_PILOT_MODE || '').toLowerCase() === 'true'
// Kept for older imports: true only when the pilot build flag is set. Off in the public build.
export const PILOT_ANALYTICS_ENABLED = PILOT_BUILD_ENABLED

export const defaultStorage = () => { try { return globalThis.localStorage || null } catch { return null } }

export const roundToMinute = (date = new Date()) => { const d = new Date(date); d.setUTCSeconds(0, 0); return d.toISOString() }

export function readStudy(storage = defaultStorage()) {
  try {
    const record = JSON.parse(storage?.getItem(STUDY_KEY) || 'null')
    return record?.schema === STUDY_SCHEMA && record.consent === true ? record : null
  } catch { return null }
}
export const writeStudy = (record, storage) => { storage?.setItem(STUDY_KEY, JSON.stringify(record)); return record }

export const pilotRequested = (search = globalThis.location?.search || '') => new URLSearchParams(search).get('pilot') === '1'
export const pilotModeOn = ({ search, storage = defaultStorage() } = {}) => PILOT_BUILD_ENABLED || pilotRequested(search) || readStudy(storage) !== null

// Records an allowlisted event, only for an enrolled participant. Never throws on storage problems.
export function trackPilotEvent(event, { now = new Date(), storage = defaultStorage() } = {}) {
  if (!EVENT_ALLOWLIST.has(event)) throw new Error('PILOT_EVENT_NOT_ALLOWED')
  const study = readStudy(storage)
  if (!study) return { recorded: false, record: null }
  const record = { event, at: roundToMinute(now) }
  try { writeStudy({ ...study, events: [...study.events, record].slice(-MAX_EVENTS) }, storage) } catch { return { recorded: false, record: null } }
  return { recorded: true, record }
}

export function noteSyntheticTranscript(id, { now, storage = defaultStorage() } = {}) {
  const study = readStudy(storage)
  if (!study) return false
  if (!/^[a-z0-9-]{1,60}$/.test(String(id))) throw new Error('STUDY_TRANSCRIPT_ID_INVALID')
  writeStudy({ ...study, transcript: id }, storage)
  trackPilotEvent('synthetic_transcript_loaded', { now, storage })
  return true
}

// Withdrawing (or ending the session after the file is handed over) deletes every pilot key
// (withdrawFromStudy in src/pilot/studyFile.js checks that nothing is left).
// "Delete everything" (Task 06) keeps the study record (keepStudy) until the session ends, but Task 44: it still
// removes the suggestion and step counts (src/pilot/studyCounts.js), which describe the profile being deleted. Only
// the funnel events stay.
export function clearPilotLocalData({ keepStudy = false, storage = defaultStorage() } = {}) {
  try {
    for (const key of LEGACY_PILOT_KEYS) storage?.removeItem(key)
    if (!keepStudy) { storage?.removeItem(STUDY_KEY); return }
    const study = readStudy(storage)
    if (study && study.events.some(e => !EVENT_ALLOWLIST.has(e?.event))) writeStudy({ ...study, events: study.events.filter(e => EVENT_ALLOWLIST.has(e?.event)) }, storage)
  } catch {}
}

export const PILOT_EVENT_NAMES = Object.freeze([...EVENT_ALLOWLIST])
