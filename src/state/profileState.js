// Task 59: the pure helpers of the student profile, moved unchanged out of src/App.jsx so that the old
// interface and the new one (src/ui2, behind ?ui=next) read and save the same state the same way.
import { courseSkillMap } from '../data.js'
import { emptyInsightState } from '../insight.js'
import { normalizePlan } from '../plan/plan.js'
import { normalizeDigitalInterests } from '../digitalInterests.js'
import { cleanAuditEntries } from '../utils/auditPrivacy.js'
import { normalizeRecommendationReviews } from '../review/recommendations.js'
import { normalizeProjectEvidence } from '../utils/projectEvidence.js'
import { normalizeTaskProgress } from '../tasks/progress.js'
import { normalizeCredentialRecords } from '../credentials/records.js'
import { normalizeCollege, cleanTranscriptText } from '../catalog/colleges.js'
import { mergeNeedsReview } from '../evidence/needsReview.js'

export const STORAGE_KEY = 'kamin-session-v3'
export const LEGACY_SESSION_KEY = 'kamin-pilot-session-v2'
export const LEGACY_STORAGE_KEY = 'kamin-pilot-v1'
export const blankState = {
  courses: [],
  approved: false,
  goal: null,
  // Task 58: goal stays equal to goals[0] (the old interface's one goal); plan and "not for me" are the
  // student's own choices (src/plan/plan.js), covered by the interests consent, never evidence.
  goals: [],
  plan: [],
  notForMe: [],
  planDropped: 0,
  consents: { analyze: false, insight: false, advisor: false, research: false },
  insight: emptyInsightState(),
  audit: [],
  recommendationReviews: [],
  projects: [],
  tasks: [],
  credentials: [],
  college: null,
  // Task 55: the college and major as printed on the transcript (free text). Removed with the transcript.
  collegeRaw: null,
  major: null,
  needsReview: [],
  localPersistence: false,
}

export const normalizeState = parsed => {
  if(!parsed || typeof parsed!=='object') return {...blankState,consents:{...blankState.consents},insight:emptyInsightState(),audit:[]}
  return normalizePlan({
    ...blankState,
    ...parsed,
    localPersistence:!!parsed.localPersistence,
    consents:{...blankState.consents,...(parsed.consents||{})},
    insight:{...emptyInsightState(),...(parsed.insight||{}),responses:{...(parsed.insight?.responses||{})},digitalInterests:normalizeDigitalInterests(parsed.insight?.digitalInterests),freeInterests:Array.isArray(parsed.insight?.freeInterests)?parsed.insight.freeInterests:[]},
    audit:cleanAuditEntries(parsed.audit), // Task 46: drops old lines that copied a file name or project title
    recommendationReviews:normalizeRecommendationReviews(parsed.recommendationReviews),
    projects:normalizeProjectEvidence(parsed.projects),
    tasks:normalizeTaskProgress(parsed.tasks),
    credentials:normalizeCredentialRecords(parsed.credentials),
    // Task 04: old profiles have no college; null means "not chosen" (ask, never assume FCIT).
    college:normalizeCollege(parsed.college),
    collegeRaw:cleanTranscriptText(parsed.collegeRaw),
    major:cleanTranscriptText(parsed.major),
    needsReview:mergeNeedsReview(parsed.needsReview,[],[]),
  })
}

export const hasMeaningfulProfileState = state => !!(
  state?.approved ||
  state?.courses?.length ||
  state?.projects?.length ||
  state?.tasks?.length ||
  state?.credentials?.length ||
  state?.goal ||
  state?.goals?.length || state?.plan?.length || state?.notForMe?.length ||
  state?.localPersistence ||
  state?.consents?.insight ||
  Object.keys(state?.insight?.declaredPreferences||{}).length ||
  state?.audit?.length || state?.recommendationReviews?.length
)

export const getSaved = () => {
  try {
    let raw=sessionStorage.getItem(STORAGE_KEY)
    if(!raw){
      const legacySession=sessionStorage.getItem(LEGACY_SESSION_KEY)
      const legacyLocal=localStorage.getItem(LEGACY_STORAGE_KEY)
      const legacy=legacySession||legacyLocal
      if(legacy){
        raw=legacy
        sessionStorage.setItem(STORAGE_KEY,legacy)
        sessionStorage.removeItem(LEGACY_SESSION_KEY)
        localStorage.removeItem(LEGACY_STORAGE_KEY)
      }
    }
    const parsed=JSON.parse(raw||'null')
    return normalizeState(parsed)
  } catch {
    return blankState
  }
}

// Was there a session copy when the app opened? Then the device copy is not read over it.
export const hasSessionCopy = () => { try { return Boolean(sessionStorage.getItem(STORAGE_KEY)||sessionStorage.getItem(LEGACY_SESSION_KEY)) } catch { return false } }

export const normalizeCourseCode = (code) => String(code||'').trim().toUpperCase().replace(/\s+/g,'-').replace(/^([A-Z]{2,8})-?(\d{2,4})$/,'$1-$2')
export const isMappedCourse = (code) => !!courseSkillMap[normalizeCourseCode(code)]
