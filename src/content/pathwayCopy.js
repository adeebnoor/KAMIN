// Task 65 · the pathway sentences of "My next step → Matches" (src/components/MatchList.jsx), moved here unchanged so
// the new interface's pathway list (step 4 and My plan, src/ui2/components/GoalPicker.jsx) shows them word for word.
export const PATHWAY_COPY = Object.freeze({
  // The judgment of a pathway, in words (never a score).
  judgment: Object.freeze({
    fits: Object.freeze({ ar: 'تناسبك', en: 'Fits' }),
    conditional: Object.freeze({ ar: 'تناسبك بشروط', en: 'Fits with conditions' }),
    exploratory: Object.freeze({ ar: 'استكشافي', en: 'Exploratory' }),
    'not-yet': Object.freeze({ ar: 'ليس الآن', en: 'Not yet' }),
  }),
  details: Object.freeze({ ar: 'الأدلة والفجوات والتفسير الكامل', en: 'Evidence, gaps and full explanation' }),
  reference: Object.freeze({ ar: 'مرجع المسار', en: 'Pathway reference' }),
  provisional: Object.freeze({ ar: 'متطلبات كامن تجريبية؛ ليست تحققًا مؤسسيًا أو معيار أهلية كاملًا.', en: 'Kamin requirements are provisional; not institutional verification or a complete eligibility standard.' }),
  limits: Object.freeze({ ar: 'فجوات أو حدود', en: 'Gaps / limits' }),
})
