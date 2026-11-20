// Task 58 · saved steps and "not for me" marks may only point at items the learning list still offers.
// Loaded on demand (App.jsx imports it only when the plan or the marks hold something), so the
// learning list stays out of the startup bundle (Task 36). An item is still offered when it is in
// the list and not retired (retired items are kept for history and never suggested).
import learningCatalog from '../catalog/learning-opportunities.json' with { type: 'json' }
import { isShown } from '../path/review.js'
import { dropMissingItems } from './plan.js'

export const offeredItemIds = (items = learningCatalog.items) => new Set(items.filter(isShown).map(item => item.id))

/** The state without steps whose item left the list (same object when nothing changed). */
export const checkPlanItems = (state, items) => dropMissingItems(state, offeredItemIds(items))

/** The item's title ({ ar, en }) for the student's own summaries, or null once it left the list. Never for the usage log. */
export const planItemTitle = (itemId, items = learningCatalog.items) => items.find(item => item.id === itemId)?.title || null
