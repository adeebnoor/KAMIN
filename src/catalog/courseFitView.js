// Task 36 · the old course-fit cards (src/data.js `opportunities`) need only the items of the learning
// list that have a `goals` list, and only the fields those cards used before Task 19. That view is
// stored in course-fit-cards.json, which is all the startup bundle holds of the list; the full list
// (learning-opportunities.json) loads with the Courses view. One function makes the view: the script
// (npm run catalog:course-fit) writes the file with it and tests/learningPath.test.js checks the file
// still equals it. Not imported by the app.
export const LEGACY_FIT_FIELDS = Object.freeze(['id', 'title', 'provider', 'duration', 'cost', 'goals', 'requires', 'teaches', 'outcome', 'formalGate'])

export function courseFitView(list) {
  return {
    note: 'Generated from learning-opportunities.json by npm run catalog:course-fit (Task 36): the old course-fit cards only. Do not edit by hand.',
    source: list.version,
    items: list.items
      .filter(item => Array.isArray(item.goals))
      .map(item => Object.fromEntries(LEGACY_FIT_FIELDS.filter(key => key in item).map(key => [key, item[key]]))),
  }
}
