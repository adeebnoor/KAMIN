// Task 60 · the new interface's views, its three tabs and its address rule.
// The address keeps Task 20's rule: one parameter, ?app=<view>, so Back, Forward, a refresh and a shared
// link open the same view. Only the view id goes into the address, never personal data.
// Pure data and functions (no React): the e2e helpers (e2e/roles.js) read the same lists.

// Every view of the new interface. Tasks 62–68 fill them; in Task 60 each one is a placeholder.
export const NEXT_VIEWS = Object.freeze(['home', 'upload', 'projects', 'interests', 'next', 'plan', 'profile', 'settings', 'help'])

// The three tabs: a bottom bar on phones, a side rail from 760px. Settings and Help are not tabs: they are
// reached from Profile (and from the footer, Task 68).
export const NEXT_TABS = Object.freeze([
  { id: 'home', labels: { ar: 'الرئيسية', en: 'Home' } },
  { id: 'plan', labels: { ar: 'خطتي', en: 'My plan' } },
  { id: 'profile', labels: { ar: 'ملفي', en: 'Profile' } },
])

// The four steps of the flow, in order, all under the Home tab.
export const FLOW = Object.freeze(['upload', 'projects', 'interests', 'next'])

// The tab that is selected while a view is open.
export const tabOf = view => (view === 'plan' ? 'plan' : ['profile', 'settings', 'help'].includes(view) ? 'profile' : 'home')

// Heading and one sentence per view (the placeholders of Task 60). Task 62: Home's sentence is the whole of Home
// (≤ 12 words); it is Home's heading, and `title` names the view in the tab and the page title.
export const VIEW_TEXT = Object.freeze({
  home: { title: { ar: 'الرئيسية', en: 'Home' }, line: { ar: 'حوّل كشف درجاتك إلى خطوة تالية واضحة.', en: 'Turn your transcript into a clear next step.' } },
  upload: { title: { ar: 'كشف درجاتك', en: 'Your transcript' }, line: { ar: 'ارفع كشف درجاتك وأكّد ما قُرئ منه. يُقرأ على هذا الجهاز.', en: 'Upload your transcript and confirm what was read. It is read on this device.' } },
  projects: { title: { ar: 'مشاريعك', en: 'Your projects' }, line: { ar: 'أضف مشاريع عملت عليها؛ فهي تُظهر ما طبّقته.', en: 'Add projects you worked on; they show what you have applied.' } },
  interests: { title: { ar: 'اهتماماتك', en: 'Your interests' }, line: { ar: 'اختر ما يهمّك، أو اكتبه بكلماتك.', en: 'Pick what interests you, or say it in your own words.' } },
  next: { title: { ar: 'خطواتك التالية', en: 'Your next steps' }, line: { ar: 'اقتراحات تقرّبك من هدفك انطلاقًا من سجلك.', en: 'Suggestions that bring you closer to your goal, starting from your record.' } },
  plan: { title: { ar: 'خطتي', en: 'My plan' }, line: { ar: 'الخطوات التي اخترتها في مكان واحد.', en: 'The steps you chose, in one place.' } },
  profile: { title: { ar: 'ملفي', en: 'Profile' }, line: { ar: 'قدراتك، ومع كل قدرة سببها.', en: 'Your capabilities, each with its reason.' } },
  settings: { title: { ar: 'الإعدادات', en: 'Settings' }, line: { ar: 'بياناتك على هذا الجهاز: اعرضها واحفظها واحذفها.', en: 'Your data on this device: see it, save it, delete it.' } },
  help: { title: { ar: 'المساعدة', en: 'Help' }, line: { ar: 'إجابات قصيرة عن طريقة عمل كامن.', en: 'Short answers about how KAMIN works.' } },
})

// ---------- Task 67 · Settings' sections (?app=settings#<section>, as Task 27's ?app=privacy#backup) ----------
// Each section is a sub-page of Settings; "Save on this device" is a switch on Settings itself, not a section.
// The fragment holds only the section id, never personal data.
export const SETTINGS_SECTIONS = Object.freeze(['courses', 'backup', 'share', 'export', 'consents', 'delete', 'log'])
// The section named in an address fragment ("#backup"), or null for anything else.
export function settingsSectionFromHash(hash) {
  const id = String(hash || '').replace(/^#/, '')
  return SETTINGS_SECTIONS.includes(id) ? id : null
}

// ---------- Task 68 · Help's links and its reviewer tools (?app=help#<tool>) ----------
// The public pages Help and the footer link to, in the brief's order: [id, file]. Each link is written with pageHref
// (public/site-content.js), so it opens the page in the interface's language (/ar/privacy.html, /en/privacy.html).
export const HELP_PAGES = Object.freeze([
  Object.freeze(['guide', 'guide.html']),
  Object.freeze(['about', 'about.html']),
  Object.freeze(['privacy', 'privacy.html']),
  Object.freeze(['runs-where', 'runs-where.html']),
  Object.freeze(['tests', 'tests.html']),
  Object.freeze(['contact', 'contact.html']),
])
// The reviewer tools, each a sub-page of Help (the old interface's component, unchanged): the knowledge explorer
// (KnowledgeWorkspace.jsx) and the pathway search by meaning with the local MiniLM model (SemanticRecall.jsx).
export const HELP_SECTIONS = Object.freeze(['knowledge', 'pathways'])
// The reviewer tool named in an address fragment ("#knowledge"), or null for anything else.
export function helpSectionFromHash(hash) {
  const id = String(hash || '').replace(/^#/, '')
  return HELP_SECTIONS.includes(id) ? id : null
}
// The sub-page a view's address fragment names (Settings' sections, Help's reviewer tools), or null.
export const sectionFromHash = (view, hash) => (view === 'settings' ? settingsSectionFromHash(hash) : view === 'help' ? helpSectionFromHash(hash) : null)

// ---------- The address (?app=<view>) ----------
// The address value for a view: the view id itself, or null for anything that is not a view.
export const nextViewToParam = view => (NEXT_VIEWS.includes(view) ? view : null)
// The view for an address value: no value gives null (nothing to open); an old interface's view id opens its
// nearest view (Task 69, below); anything else (a typo) opens Home.
export const paramToNextView = value => (!value ? null : NEXT_VIEWS.includes(value) ? value : oldAddress(value)?.view || 'home')

// ---------- Task 69 · old addresses still land on a sensible view ----------
// The old interface's view ids (src/navigation.js, ?app=<view>) and its menu's section ids, each with the nearest
// view of this interface and, where the old view showed one part of it, the Settings section or Help tool that holds
// that part. A bookmark, a shared link or a page the student had open keeps working after the default changed.
export const OLD_VIEW_ADDRESSES = Object.freeze({
  start: 'upload', review: 'upload',
  dashboard: 'profile', skills: 'profile',
  matches: 'next', courses: 'next',
  compare: 'plan', studio: 'plan',
  insight: 'interests',
  mydata: 'settings#courses', privacy: 'settings', audit: 'settings#log', 'my-data': 'settings',
  knowledge: 'help#knowledge',
})
// Task 27's sections of "Consent, saving & deletion" (?app=privacy#backup) and their Settings sections. "save" is
// the switch on Settings itself, so it has no section.
export const OLD_PRIVACY_SECTIONS = Object.freeze({ permissions: 'consents', backup: 'backup', share: 'share', delete: 'delete' })
const own = (table, key) => (Object.hasOwn(table, key) ? table[key] : undefined)
// { view, section } for an old view id (section: a Settings section or Help tool, or null); null for anything else.
export function oldAddress(value, hash = '') {
  const target = own(OLD_VIEW_ADDRESSES, value)
  if (!target) return null
  const [view, section = null] = target.split('#')
  return { view, section: value === 'privacy' ? own(OLD_PRIVACY_SECTIONS, String(hash || '').replace(/^#/, '')) || null : section }
}
// The old interface's entry links, read once and replaced (Task 20's rule, so a refresh does not repeat them):
// ?view=knowledge opens Help's knowledge explorer, ?start=profile opens step 3 (it opened "Interests & goal"), and an
// old ?app=<view> (with Task 27's #section) becomes the new view and its section. ?start=sample and ?pilot=1 are the
// new interface's own (Task 62). Returns the address to write instead (path, query and fragment), or null.
export function translateOldAddress(href) {
  const url = new URL(href)
  const params = url.searchParams
  let target = oldAddress(params.get('app'), url.hash)
  if (params.get('start') === 'profile') { params.delete('start'); target = { view: 'interests', section: null } }
  if (params.get('view') === 'knowledge') { params.delete('view'); target = { view: 'help', section: 'knowledge' } }
  if (!target) return null
  params.set('app', target.view)
  url.hash = target.section ? `#${target.section}` : ''
  return url.pathname + url.search + url.hash
}

// ---------- The top bar's main button: Start or Continue ----------
// Where the flow stopped: the step after the furthest one done. Nothing counts before the transcript is
// approved; then projects, then interests (the interests consent), then the next steps.
export function resumeView(state) {
  if (!state?.approved) return 'upload'
  if (state.consents?.insight) return 'next'
  if (state.projects?.length) return 'interests'
  return 'projects'
}

// `started`: the student has a profile (src/state/profileState.js, hasMeaningfulProfileState). No profile
// yet: "Start" opens step 1. Otherwise "Continue" opens the step where the flow stopped.
export const mainAction = (state, started) => (started ? { kind: 'continue', view: resumeView(state) } : { kind: 'start', view: 'upload' })
