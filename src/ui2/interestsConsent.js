// Task 66 · the interests consent and the two chip questions, shared by step 3 (src/ui2/screens/Interests.jsx, through
// src/ui2/interestsState.js) and Profile → "More ways to add interests" (src/ui2/screens/Profile.jsx), which asks for
// the same consent before the digital-interests paste flow, as the old interface does. Moved here unchanged from
// interestsState.js (Task 64) so that Profile does not load step 3's other changes; both screens are lazy.
import { emptyInsightState } from '../insight.js'

// The two questions step 3 asks as chips: the six interest areas and the six work values of the old screen.
export const CHIP_QUESTIONS = Object.freeze(['careerInterest', 'workValue'])

export const insightOf = state => ({ ...emptyInsightState(), ...(state?.insight || {}) })

// The interests consent, as the old screen grants it (src/components/StudentInsight.jsx): the consent flag, an
// insight record, and one usage-log line (`label`, copy[lang].screens.insight.consentGranted).
export function grantInterests(state, label) {
  if (state?.consents?.insight) return state
  return { ...state, consents: { ...state.consents, insight: true }, insight: insightOf(state), audit: [{ label, ts: Date.now() }, ...(state.audit || [])].slice(0, 100) }
}
