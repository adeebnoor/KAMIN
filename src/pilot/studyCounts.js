// Task 44 · how students use the suggestions during the trial: counts only, never text.
// Seven events, each with a whole number and the version of the method that made the suggestion, and nothing else:
//   suggest_shown          skills the project engine suggested in one project form (counted when the project is saved)
//   suggest_kept           of those, still ticked when the project was saved
//   suggest_unticked       of those, not ticked when the project was saved
//   suggest_added_by_hand  skills saved with the project that the engine did not suggest (and the project did not have)
//   step_taken             "Take this course" / "Get this certificate" in step 4 (count 1)
//   step_not_for_me        "Not for me" in step 4 (count 1)
//   step_removed           "Remove" in My plan (count 1)
// Undo takes the last step event of that kind back. A project form that is cancelled records nothing.
// Never the description, the snippet, the title, a skill, a course or an item: the functions here take ids only to
// count them, and what they store is { event, at, count, engine }.
// Recorded only for an enrolled participant whose consent names these counts (COUNTS_CONSENT_VERSIONS); someone who
// agreed to the first consent text (pilot-consent-v1-2026-11-11) records none of them. The queue is the study record
// of src/utils/pilotAnalytics.js, so finishing the session or withdrawing deletes the counts with everything else.
// This module loads with the new interface's screens (and the study file), never with the startup bundle.
import { MAX_EVENTS, defaultStorage, readStudy, roundToMinute, writeStudy } from '../utils/pilotAnalytics.js'

export const SUGGEST_EVENTS = Object.freeze(['suggest_shown', 'suggest_kept', 'suggest_unticked', 'suggest_added_by_hand'])
export const STEP_EVENTS = Object.freeze(['step_taken', 'step_not_for_me', 'step_removed'])
export const COUNT_EVENTS = Object.freeze([...SUGGEST_EVENTS, ...STEP_EVENTS])
// The consent texts (src/content/pilotConsent.js) that tell the participant these counts are in the file.
export const COUNTS_CONSENT_VERSIONS = Object.freeze(['pilot-consent-v2-2026-11-19'])
export const MAX_COUNT = 50
// An engine version is a fixed identifier such as kamin-project-suggest-improved-v1 or kamin-next-steps-v1.
export const ENGINE_PATTERN = /^kamin-[a-z0-9-]{1,60}$/

export const countsAllowed = study => Boolean(study) && COUNTS_CONSENT_VERSIONS.includes(study.consentVersion)

function check(event, count, engine) {
  if (!COUNT_EVENTS.includes(event)) throw new Error('PILOT_EVENT_NOT_ALLOWED')
  if (!Number.isInteger(count) || count < 0 || count > MAX_COUNT) throw new Error('PILOT_COUNT_INVALID')
  if (typeof engine !== 'string' || !ENGINE_PATTERN.test(engine)) throw new Error('PILOT_ENGINE_INVALID')
}

// Adds { event, at, count, engine } to the queue. A count of 0 adds nothing. Never throws on storage problems.
export function recordCount(event, count, engine, { now = new Date(), storage = defaultStorage() } = {}) {
  check(event, count, engine)
  const study = readStudy(storage)
  if (!countsAllowed(study) || count === 0) return { recorded: false, record: null }
  const record = { event, at: roundToMinute(now), count, engine }
  try { writeStudy({ ...study, events: [...study.events, record].slice(-MAX_EVENTS) }, storage) } catch { return { recorded: false, record: null } }
  return { recorded: true, record }
}

// The four numbers for one saved project. `suggested`: every skill id the engine suggested in this form;
// `saved`: the skill ids saved; `before`: the ids an edited project already had (not "added by hand" again).
export function projectSuggestionCounts({ suggested = [], saved = [], before = [] } = {}) {
  const shown = new Set(suggested)
  const kept = new Set(saved.filter(id => shown.has(id))).size
  const added = new Set(saved.filter(id => !shown.has(id) && !before.includes(id))).size
  return { shown: shown.size, kept, unticked: shown.size - kept, addedByHand: added }
}

export function recordProjectSuggestions({ suggested, saved, before, engine }, options) {
  const counts = projectSuggestionCounts({ suggested, saved, before })
  recordCount('suggest_shown', counts.shown, engine, options)
  recordCount('suggest_kept', counts.kept, engine, options)
  recordCount('suggest_unticked', counts.unticked, engine, options)
  recordCount('suggest_added_by_hand', counts.addedByHand, engine, options)
  return counts
}

// A step-4 or My plan button: one event with the count 1.
export function recordStepChoice(event, engine, options) {
  if (!STEP_EVENTS.includes(event)) throw new Error('PILOT_EVENT_NOT_ALLOWED')
  return recordCount(event, 1, engine, options)
}

// Undo: the last event of that kind leaves the queue again.
export function takeBackStepChoice(event, { storage = defaultStorage() } = {}) {
  if (!STEP_EVENTS.includes(event)) throw new Error('PILOT_EVENT_NOT_ALLOWED')
  const study = readStudy(storage)
  if (!countsAllowed(study)) return false
  const index = study.events.map(e => e.event).lastIndexOf(event)
  if (index < 0) return false
  try { writeStudy({ ...study, events: study.events.filter((_, i) => i !== index) }, storage) } catch { return false }
  return true
}

// A count event exactly as the study file carries it, or null when anything about it is wrong.
export function cleanCountEvent(e) {
  if (!e || !COUNT_EVENTS.includes(e.event) || !Number.isInteger(e.count) || e.count < 1 || e.count > MAX_COUNT) return null
  if (typeof e.engine !== 'string' || !ENGINE_PATTERN.test(e.engine)) return null
  return { event: e.event, at: roundToMinute(e.at), count: e.count, engine: e.engine }
}

const ratio = (part, whole) => (whole ? Math.round((part / whole) * 100) / 100 : null)

// The study file's summary: kept / shown, unticked / shown, added by hand / saved (saved = kept + added by hand,
// the skills saved with projects), and the step choices. A share is null when there is nothing to divide by.
export function summarizeCounts(events = []) {
  const counted = events.map(cleanCountEvent).filter(Boolean)
  const sum = name => counted.filter(e => e.event === name).reduce((n, e) => n + e.count, 0)
  const shown = sum('suggest_shown'), kept = sum('suggest_kept'), unticked = sum('suggest_unticked'), addedByHand = sum('suggest_added_by_hand')
  const saved = kept + addedByHand
  return {
    engines: [...new Set(counted.map(e => e.engine))].sort(),
    shown, kept, unticked, addedByHand, saved,
    keptOfShown: ratio(kept, shown),
    untickedOfShown: ratio(unticked, shown),
    addedByHandOfSaved: ratio(addedByHand, saved),
    stepsTaken: sum('step_taken'),
    stepsNotForMe: sum('step_not_for_me'),
    stepsRemoved: sum('step_removed'),
  }
}
