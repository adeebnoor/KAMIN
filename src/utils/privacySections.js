// Task 27 · "Consent, saving & deletion" as a short overview: one status card, then five sections
// (<details>) with a status line each. These helpers hold the rules without React so unit tests can
// read them: which sections exist, which open first, how many may be open, and what the summary says.

// In page order. The id is also the address: ?app=privacy#backup opens "Back up and restore".
export const PRIVACY_SECTIONS = Object.freeze(['permissions', 'save', 'backup', 'share', 'delete'])

// "Only one or two sections are open at a time."
export const MAX_OPEN = 2

// The section named in an address fragment ("#backup"), or null for anything else (for example the
// "#payload=…" of a shared snapshot link, which src/App.jsx reads on its own).
export function sectionFromHash(hash) {
  const id = String(hash || '').replace(/^#/, '')
  return PRIVACY_SECTIONS.includes(id) ? id : null
}

// Open when the page opens: the section a link or shortcut asked for; otherwise Permissions. With no
// approved record, "Back up and restore" opens too: restoring a backup is the likely reason to come
// here with an empty profile, and it keeps the restore route at 2 clicks (e2e/usability-budget.json).
export function initialOpen({ target = null, approved = false } = {}) {
  if (target && PRIVACY_SECTIONS.includes(target)) return [target]
  return approved ? ['permissions'] : ['permissions', 'backup']
}

// The open sections, oldest first. Opening one keeps at most MAX_OPEN open: the one opened longest
// ago closes. Opening an open section or closing a closed one changes nothing (same array back).
export function toggleOpen(list, id, open) {
  if (!PRIVACY_SECTIONS.includes(id)) return list
  if (open) return list.includes(id) ? list : [...list, id].slice(-MAX_OPEN)
  return list.includes(id) ? list.filter(x => x !== id) : list
}

// "1 of 4 on": every consent in state.consents counts, whatever its purpose.
export function permissionsOn(consents) {
  const keys = Object.keys(consents || {})
  return { on: keys.filter(key => consents[key]).length, total: keys.length }
}

// What the status card lists after "Stored:", in the order of the old count tiles. Only counts above
// zero are listed; `rest` says whether some kinds hold nothing ("Nothing else").
// Task 58: plan (saved steps of My plan) and notForMe ("not for me" marks); goal counts every chosen goal.
// Task 79: roadmap (ticked roadmap items).
export function storedCounts({ courses = 0, projects = 0, tasks = 0, credentials = 0, digital = 0, preferences = 0, goal = 0, plan = 0, notForMe = 0, roadmap = 0 }) {
  const all = [['courses', courses], ['projects', projects], ['tasks', tasks], ['credentials', credentials], ['digital', digital], ['preferences', preferences], ['goal', goal], ['plan', plan], ['notForMe', notForMe], ['roadmap', roadmap]]
  const listed = all.filter(([, count]) => count > 0).map(([key, count]) => ({ key, count }))
  return { listed, rest: listed.length < all.length }
}
