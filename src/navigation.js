// Task 09 · four sections instead of ten. Every older view id still works: it opens its section
// on the right tab (legacy links, `entry`, and components that call setView('matches') etc.).
export const SECTIONS = Object.freeze([
  { id: 'home', views: ['dashboard', 'skills', 'start', 'review'], labels: { ar: 'قدراتي', en: 'My capabilities' } },
  { id: 'next', views: ['matches', 'courses', 'compare', 'studio'], labels: { ar: 'خطوتي التالية', en: 'My next step' } },
  { id: 'insight', views: ['insight'], labels: { ar: 'اهتماماتي وهدفي', en: 'Interests & goal' } },
  { id: 'my-data', views: ['mydata', 'privacy', 'audit'], labels: { ar: 'بياناتي', en: 'My data' } },
])

// Tabs inside a section (role="tablist"); labels keep the names students already know.
export const TABS = Object.freeze({
  next: [
    { view: 'matches', labels: { ar: 'فرصي', en: 'Matches' } },
    { view: 'courses', labels: { ar: 'الدورات', en: 'Courses' } },
    { view: 'compare', labels: { ar: 'المقارنة', en: 'Compare' } },
    { view: 'studio', labels: { ar: 'اعرض الروابط', en: 'Show connections' } },
  ],
  'my-data': [
    { view: 'mydata', labels: { ar: 'مراجعة وتصحيح', en: 'Review & correct' } },
    { view: 'privacy', labels: { ar: 'الموافقات والحفظ والحذف', en: 'Consent, saving & deletion' } },
    { view: 'audit', labels: { ar: 'سجل الاستخدام', en: 'Usage log' } },
  ],
})

// Old view id → section (the knowledge explorer is a reviewer tool outside the student menu).
export const LEGACY_VIEWS = Object.freeze(Object.fromEntries(SECTIONS.flatMap(s => s.views.map(v => [v, s.id]))))

export const sectionOf = view => LEGACY_VIEWS[view] || null

// Where a section opens: the record-based pages need an approved record; before that the
// section opens on a page that works without one.
export function defaultView(section, state) {
  if (section === 'home') return state?.approved ? 'dashboard' : 'start'
  if (section === 'next') return 'matches'
  if (section === 'insight') return 'insight'
  if (section === 'my-data') return state?.approved ? 'mydata' : 'privacy'
  return null
}

// Accepts a section id or any old view id.
export function resolveView(id, state) {
  if (SECTIONS.some(s => s.id === id)) return defaultView(id, state)
  if (id === 'knowledge' || LEGACY_VIEWS[id]) return id
  return defaultView('home', state)
}

// Views that show their content only after a transcript is approved; before that they show an
// empty state with one action instead of a disabled menu item.
export const NEEDS_RECORD = Object.freeze(['dashboard', 'skills', 'courses', 'compare', 'mydata'])

// ---------- Task 20 · the app view in the URL (?app=<view>) ----------
// Only the view id ever goes into the URL: never personal data.
export const APP_PARAM = 'app'

// The URL value for a view: the view id itself, or null for anything that is not a view.
export const viewToParam = view => (view === 'knowledge' || LEGACY_VIEWS[view]) ? view : null

// The view to open for a URL value (a link, a refresh, Back/Forward). Unknown values fall back to
// resolveView's default. "review" shows a transcript that is being checked; it lives only in memory
// (never in the URL or in storage), so a link or refresh to it opens the start screen instead of an
// empty review table.
export function paramToView(value, state) {
  if (!value) return null
  if (value === 'review') return 'start'
  return resolveView(value, state)
}

const KNOWLEDGE_LABELS = { ar: 'مستكشف المعرفة', en: 'Knowledge explorer' }

// The page name read out after a view change: "My data: Consent, saving & deletion".
export function pageName(view, lang) {
  if (view === 'knowledge') return KNOWLEDGE_LABELS[lang]
  const section = SECTIONS.find(s => s.id === sectionOf(view))
  if (!section) return ''
  const tab = TABS[section.id]?.find(item => item.view === view)
  return tab ? `${section.labels[lang]}: ${tab.labels[lang]}` : section.labels[lang]
}

// ---------- Task 26 · the app top bar names where the student is ----------
const REVIEW_LABELS = { ar: 'راجع سجلك', en: 'Review your record' }

// The top bar title: the active section's label. The review screen and the reviewer-only knowledge
// explorer (outside the four sections) have their own names.
export function topbarTitle(view, lang) {
  if (view === 'review') return REVIEW_LABELS[lang]
  if (view === 'knowledge') return KNOWLEDGE_LABELS[lang]
  return SECTIONS.find(s => s.id === sectionOf(view))?.labels[lang] || ''
}
