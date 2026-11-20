// Task 08 · which local engine the project assistant uses.
// 'improved' = src/ai/projectSuggestImproved.js (kamin-project-suggest-improved-v1), the default since
//              the supervisor approved eval/project-suggest/results/2026-11-10-comparison.md
//              (approval recorded 2026-11-11). It loads on demand, outside the initial bundle.
// 'lexicon'  = src/ai/projectSuggest.js (kamin-project-suggest-lexicon-v1), the earlier engine, kept as
//              the measured baseline and still selectable here.
// Both engines are local; neither downloads a model.
import { suggestCapabilities as lexiconSuggest } from './projectSuggest.js'

export const PROJECT_SUGGEST_METHOD = 'improved'

export function suggestForProject(description, method = PROJECT_SUGGEST_METHOD) {
  if (method === 'improved') return import('./projectSuggestImproved.js').then(m => m.suggestCapabilities(description))
  return Promise.resolve(lexiconSuggest(description))
}
