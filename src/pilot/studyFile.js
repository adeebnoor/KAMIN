// Task 18 · joining the trial, the end-of-session form, the anonymous study file and withdrawal.
// Task 44: moved here from src/utils/pilotAnalytics.js (unchanged, except that the file now carries the suggestion
// counts and their summary) so that only the trial layer (src/components/PilotStudy.jsx, loaded in pilot mode) loads
// it; the startup bundle keeps only the record itself. Nothing is sent anywhere: no endpoint, no network call.
import { PILOT_EVENT_NAMES, STUDY_KEY, LEGACY_PILOT_KEYS, STUDY_SCHEMA, clearPilotLocalData, defaultStorage, readStudy, roundToMinute, trackPilotEvent, writeStudy } from '../utils/pilotAnalytics.js'
import { cleanCountEvent, countsAllowed, summarizeCounts } from './studyCounts.js'

export const MAX_COMMENT = 600

// The six usability tasks (Task 15, docs/USABILITY_PROTOCOL.md). Labels are in src/content/pilotConsent.js.
export const STUDY_TASKS = Object.freeze(['build-profile', 'find-evidence', 'understand-recommendation', 'choose-learning-step', 'save-and-restore', 'correct-withdraw-delete'])
export const TASK_OUTCOMES = Object.freeze(['success', 'with-help', 'failed'])

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function newStudyCode(random = globalThis.crypto) {
  const bytes = new Uint8Array(6)
  if (random?.getRandomValues) random.getRandomValues(bytes); else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return `K-${[...bytes].map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')}`
}

export function joinStudy({ consent, consentVersion, lang = 'ar', now = new Date(), storage = defaultStorage() } = {}) {
  if (consent !== true) throw new Error('STUDY_CONSENT_REQUIRED')
  if (!consentVersion) throw new Error('STUDY_CONSENT_VERSION_REQUIRED')
  const existing = readStudy(storage)
  if (existing) return existing
  const record = writeStudy({ schema: STUDY_SCHEMA, consent: true, consentVersion, studyCode: newStudyCode(), language: lang === 'en' ? 'en' : 'ar', joinedAt: roundToMinute(now), transcript: null, events: [], tasks: Object.fromEntries(STUDY_TASKS.map(id => [id, null])), clarity: null, comment: '' }, storage)
  trackPilotEvent('study_joined', { now, storage })
  return readStudy(storage) || record
}

// A comment may not look like an email address, a phone number or a student ID (6+ digits in a row).
export function personalDataInComment(text) {
  const s = String(text || '')
  const found = []
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(s)) found.push('email')
  if (/(?:\d[\s-]?){6,}/.test(s)) found.push('number')
  return found
}

export function saveStudyFeedback({ tasks = {}, clarity = null, comment = '' } = {}, { now = new Date(), storage = defaultStorage() } = {}) {
  const study = readStudy(storage)
  if (!study) throw new Error('STUDY_CONSENT_REQUIRED')
  const cleanTasks = Object.fromEntries(STUDY_TASKS.map(id => [id, TASK_OUTCOMES.includes(tasks[id]) ? tasks[id] : null]))
  if (clarity !== null && !(Number.isInteger(clarity) && clarity >= 1 && clarity <= 5)) throw new Error('STUDY_CLARITY_INVALID')
  const cleanComment = String(comment || '').trim().slice(0, MAX_COMMENT)
  if (personalDataInComment(cleanComment).length) throw new Error('STUDY_COMMENT_PERSONAL_DATA')
  writeStudy({ ...study, tasks: cleanTasks, clarity, comment: cleanComment }, storage)
  trackPilotEvent('feedback_submitted', { now, storage })
  return readStudy(storage)
}

// Exactly what the downloaded file contains. Built from named fields only, so nothing else can slip in.
// Task 44: a count event keeps its count and engine version (src/pilot/studyCounts.js) and the file adds the summary
// `suggestions`; both only when the participant's consent names them, otherwise no count event and `suggestions: null`.
export function buildStudyFile({ now = new Date(), storage = defaultStorage() } = {}) {
  const study = readStudy(storage)
  if (!study) throw new Error('STUDY_CONSENT_REQUIRED')
  const funnel = new Set(PILOT_EVENT_NAMES), counts = countsAllowed(study)
  const events = study.events.map(e => (funnel.has(e?.event) ? { event: e.event, at: roundToMinute(e.at) } : counts ? cleanCountEvent(e) : null)).filter(Boolean)
  return {
    schema: STUDY_SCHEMA,
    studyCode: study.studyCode,
    consentVersion: study.consentVersion,
    language: study.language,
    joinedAt: study.joinedAt,
    exportedAt: roundToMinute(now),
    transcript: study.transcript,
    events,
    suggestions: counts ? summarizeCounts(events) : null,
    tasks: Object.fromEntries(STUDY_TASKS.map(id => [id, TASK_OUTCOMES.includes(study.tasks?.[id]) ? study.tasks[id] : null])),
    clarity: Number.isInteger(study.clarity) ? study.clarity : null,
    comment: String(study.comment || '').slice(0, MAX_COMMENT),
  }
}
export const studyFileName = file => `kamin-study-${file.studyCode}.json`

export function withdrawFromStudy({ storage = defaultStorage() } = {}) {
  clearPilotLocalData({ storage })
  let left = []
  try { left = [STUDY_KEY, ...LEGACY_PILOT_KEYS].filter(key => storage?.getItem(key) !== null) } catch { left = ['unreadable'] }
  return { withdrawn: left.length === 0, left }
}
