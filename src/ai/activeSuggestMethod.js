// Task 43 · the project engine this page load uses: PROJECT_SUGGEST_METHOD (src/ai/suggestSettings.js), or
// 'hybrid' when the address says ?suggest=hybrid, so a reviewer can try the MiniLM fallback without changing
// the default. Nothing is remembered, and no other value is accepted. Even then the model downloads only after
// the student ticks the consent box and presses "Look deeper". Imported by the new interface's lazy Projects
// chunk only. Task 80 made 'hybrid' the default and added ?suggest=improved; Task 80b (team decision 2026-11-22)
// restored this Task 43 switch exactly: the default is 'improved' again and ?suggest=hybrid is the only switch.
import { PROJECT_SUGGEST_METHOD } from './suggestSettings.js'

export const activeSuggestMethod = (search = globalThis.location?.search || '') =>
  new URLSearchParams(search).get('suggest') === 'hybrid' ? 'hybrid' : PROJECT_SUGGEST_METHOD

// The engine that answers "Suggest skills": hybrid starts with the improved engine.
export const firstEngine = method => (method === 'hybrid' ? 'improved' : method)

// Offer "Look deeper" only with the hybrid method, and only when the improved engine abstained.
export const offersLookDeeper = (method, result) => method === 'hybrid' && !!result?.abstained
