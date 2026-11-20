// Task 65 · what step 4 and My plan compute with, loaded on demand (import()) so the learning list stays out of the
// new interface's first chunk: the feed (Task 57), the gap (Task 19), the list's items and whether two department
// reviewers have checked the list (Task 36, the same rule as src/components/LearningPath.jsx).
import { LEARNING_CATALOG, catalogItem } from '../path/suggest.js'
import { pathReviewStatus } from '../path/review.js'
import { catalogCourses } from '../catalog/fcit.js'

export { nextStepFeed, NEXT_STEPS_VERSION } from '../path/nextSteps.js'
export { computeGap } from '../path/gap.js'
export { catalogItem }
export const LIST_REVIEWED = pathReviewStatus(LEARNING_CATALOG.items, [...new Set(catalogCourses.flatMap(course => course.capabilities))]).complete

