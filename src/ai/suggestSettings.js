// Task 08 · which local engine the project assistant uses.
// 'improved' = src/ai/projectSuggestImproved.js (kamin-project-suggest-improved-v2 since Task 77; v1 before), the default since
//              the supervisor approved eval/project-suggest/results/2026-11-10-comparison.md
//              (approval recorded 2026-11-11). It loads on demand, outside the initial bundle.
// 'lexicon'  = src/ai/projectSuggest.js (kamin-project-suggest-lexicon-v1), the earlier engine, kept as
//              the measured baseline and still selectable here.
// 'hybrid'   = Task 43, NOT the default: 'improved' first; only when it abstains, the new interface offers
//              "Look deeper", which downloads the local MiniLM model after the student's consent and keeps at most one
//              suggestion (src/ai/hybridFallback.js v2, src/ui2/components/LookDeeper.jsx). Reviewers can try it on
//              one page load with ?suggest=hybrid (src/ai/activeSuggestMethod.js). Task 80 made it the default; Task 80b
//              put it back behind that switch (team decision 2026-11-22: the dialect gain, 88.5 → 89.2 F1, is within
//              noise, three per-variety thresholds sit at the 0.53 floor, and it suggests skills from ordinary
//              sentences). Engine v3 stays the default engine. This file is in the lazy Projects chunk only.
// No engine downloads a model on its own.
import { suggestCapabilities as lexiconSuggest } from './projectSuggest.js'

export const PROJECT_SUGGEST_METHOD = 'improved'

export function suggestForProject(description, method = PROJECT_SUGGEST_METHOD) {
  // 'hybrid' starts with the improved engine; the model runs only from "Look deeper".
  if (method === 'improved' || method === 'hybrid') return import('./projectSuggestImproved.js').then(m => m.suggestCapabilities(description))
  return Promise.resolve(lexiconSuggest(description))
}
