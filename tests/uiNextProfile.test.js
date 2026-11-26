// Task 66 · Profile in the new interface (src/ui2/screens/Profile.jsx, src/ui2/components/CapabilityRow.jsx).
// The header holds the college and major from the transcript and the transcript line ("N courses · approved on <date>")
// with Update transcript; My capabilities shows a name and a level word per row (never a number), the source in the
// row's name, the "because" line once when every capability shares it, and "What do the levels mean?" word for word;
// the reasons of a level are the evidence rules' own sentences; My projects, My interests and My goals each say what is
// there (names, never ids) and have Edit; More offers the credential import, practice tasks and more ways to add
// interests (the old components, loaded only when opened); Settings and Help follow. Steps 1–4 opened from Profile's
// Edit show "Back to Profile" instead of the step chip and Next. The old parts keep brand.css's light values in both
// themes. Profile, its row and its CSS load on their own; nothing new enters the startup modules.
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Profile, { APPROVAL_LOG, approvedAt, levelReason, sectionSummaries, transcriptLine } from '../src/ui2/screens/Profile.jsx'
import CapabilityRow, { capabilitySource } from '../src/ui2/components/CapabilityRow.jsx'
import Projects from '../src/ui2/screens/Projects.jsx'
import Interests from '../src/ui2/screens/Interests.jsx'
import NextSteps from '../src/ui2/screens/NextSteps.jsx'
import Upload from '../src/ui2/screens/Upload.jsx'
import { CHIP_QUESTIONS, grantInterests } from '../src/ui2/interestsConsent.js'
import * as interestsState from '../src/ui2/interestsState.js'
import { profileSkills } from '../src/utils/engine.js'
import { levelLabel } from '../src/evidence/levels.js'
import { LEVEL_MEANINGS, limitLine, sharedLimitLine } from '../src/content/levelReasons.js'
import { COURSE_EVIDENCE_PRINCIPLE } from '../src/content/trustCopy.js'
import { DECLARED_PREFERENCE_SCHEMES, emptyInsightState } from '../src/insight.js'
import { FREE_INTEREST_METHOD } from '../src/interests/freeInterestState.js'
import { collegeLabel } from '../src/catalog/colleges.js'
import { targetProfiles } from '../src/matching/targets.js'
import { demoCourses } from '../src/data.js'
import { copy } from '../src/i18n.js'
import { NEXT_COPY, fillIn } from '../src/ui2/copy.js'
import { VIEW_TEXT } from '../src/ui2/views.js'

const LANGS = ['ar', 'en']
const read = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const sourceFiles = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? sourceFiles(p) : [p] })
const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
const noop = () => {}
const PERCENT = /\d\s?[%٪]|[%٪]\s?\d/
const W = lang => NEXT_COPY[lang].profile
const APPROVED_TS = Date.parse('2026-11-19T09:00:00.000Z')
// The app's synthetic example, approved (made-up rows, no person), with the approval line the hook writes.
const SAMPLE = { approved: true, courses: demoCourses.map(row => ({ ...row })), college: 'FCIT', collegeRaw: 'FACULTY OF COMPUTING AND INFORMATION TECHNOLOGY', major: 'INFORMATION SYSTEMS', projects: [], tasks: [], credentials: [], insight: emptyInsightState(), consents: { analyze: true }, goals: [], plan: [], notForMe: [], audit: [{ label: APPROVAL_LOG[1], ts: APPROVED_TS }] }
const EMPTY = { approved: false, courses: [], college: null, projects: [], tasks: [], credentials: [], insight: emptyInsightState(), consents: {}, goals: [], plan: [], notForMe: [], audit: [] }
const profileOf = state => ({ state, derived: { skills: profileSkills(state), matches: [] }, actions: { setState: noop, log: noop, changeCollege: noop, saveCredential: noop, removeCredential: noop, updateTasks: noop } })
const page = (lang, state, extra = {}) => renderToStaticMarkup(createElement(Profile, { lang, profile: profileOf(state), focusHeading: false, onNavigate: noop, onEdit: noop, ...extra }))
const rowsOf = html => [...html.matchAll(/<button type="button" class="ui2-cap"[^>]*>([\s\S]*?)<\/button>/g)].map(m => textOf(m[1]))

describe('Task 66 · Profile: the header and the transcript line', () => {
  for (const lang of LANGS) it(`${lang}: the college and major read from the transcript, "N courses · approved on <date>" and Update transcript`, () => {
    const text = textOf(page(lang, SAMPLE))
    expect(text).toContain(VIEW_TEXT.profile.title[lang])
    expect(text).toContain(collegeLabel('FCIT', lang))
    expect(text).toContain(SAMPLE.major)
    expect(text).toContain(transcriptLine(SAMPLE, lang))
    expect(transcriptLine(SAMPLE, lang)).toContain(W(lang).courses(demoCourses.length).join(''))
    expect(transcriptLine(SAMPLE, lang)).toContain(fillIn(W(lang).approvedOn, { date: '' }).trim().split(' ')[0])
    expect(text).toContain(W(lang).update)
    expect(text).not.toMatch(PERCENT)
  })

  it('the approval date is the newest approval line of the usage log (either language); without it the line says "approved"', () => {
    expect(approvedAt(SAMPLE)).toBe(APPROVED_TS)
    expect(approvedAt({ audit: [{ label: 'Goal changed', ts: 5 }, { label: APPROVAL_LOG[0], ts: 4 }, { label: APPROVAL_LOG[1], ts: 3 }] })).toBe(4)
    expect(transcriptLine(SAMPLE, 'en')).toBe(`${demoCourses.length} courses · approved on 19 Nov 2026`)
    expect(transcriptLine({ ...SAMPLE, audit: [] }, 'en')).toBe(`${demoCourses.length} courses · approved`)
    expect(transcriptLine({ ...SAMPLE, audit: [] }, 'ar')).toBe(`${demoCourses.length} مقررات · معتمد`)
  })

  it('the approval lines are the very ones the profile hook writes', () => {
    const hook = read('src/state/useKaminProfile.js')
    for (const label of APPROVAL_LOG) expect(hook).toContain(`'${label}'`)
  })

  it('"N courses" takes the right Arabic noun form', () => {
    const ar = n => NEXT_COPY.ar.profile.courses(n).join('')
    expect([ar(1), ar(2), ar(3), ar(10), ar(11), ar(42)]).toEqual(['مقرر واحد', 'مقرران', '3 مقررات', '10 مقررات', '11 مقررًا', '42 مقررًا'])
    expect(NEXT_COPY.en.profile.courses(1).join('')).toBe('1 course')
    expect(NEXT_COPY.en.profile.courses(42).join('')).toBe('42 courses')
  })

  for (const lang of LANGS) it(`${lang}: no transcript yet: the way to upload it, no capability, and the rest of Profile still there`, () => {
    const text = textOf(page(lang, EMPTY))
    for (const words of [W(lang).noTranscript, W(lang).upload, W(lang).noCapabilities, W(lang).projects, W(lang).interests, W(lang).goals, W(lang).more, W(lang).credential, W(lang).tasks, W(lang).moreInterests, VIEW_TEXT.settings.title[lang], VIEW_TEXT.help.title[lang]]) expect(text).toContain(words)
    expect(text).not.toContain(W(lang).update)
  })
})

describe('Task 66 · My capabilities: level words, sources, the reasons', () => {
  const skills = profileSkills(SAMPLE)
  for (const lang of LANGS) it(`${lang}: one row per capability, a name and a level word, the source in its name; no number`, () => {
    const html = page(lang, SAMPLE)
    const rows = rowsOf(html)
    expect(rows).toHaveLength(skills.length)
    skills.forEach((skill, i) => {
      expect(rows[i]).toContain(skill.labels[lang])
      expect(rows[i]).toContain(levelLabel(skill.evidenceLevel, lang))
      expect(rows[i]).toContain(`${W(lang).source}${capabilitySource(skill, lang).text}`)
      expect(rows[i], 'a level is a word, never a number').not.toMatch(/\d/)
    })
    expect((html.match(/data-testid="capability-row"/g) || []).length).toBe(skills.length)
    expect((html.match(/aria-haspopup="dialog"/g) || []).length).toBeGreaterThanOrEqual(skills.length)
  })

  for (const lang of LANGS) it(`${lang}: the shared "because" line once above the rows, and "What do the levels mean?" word for word`, () => {
    const html = page(lang, SAMPLE)
    const text = textOf(html)
    const shared = sharedLimitLine(skills, lang)
    expect(shared, 'the example shares one reason').not.toBe(null)
    expect(text.split(shared.text)).toHaveLength(2)
    const m = LEVEL_MEANINGS[lang]
    for (const sentence of [m.title, m.none, m.limited, m.moderate, m.strong, m.rule, COURSE_EVIDENCE_PRINCIPLE[lang]]) expect(text).toContain(sentence)
  })

  it('a level\'s reason is the evidence rules\' own sentence: the course\'s line, else the shared line, else what the level means', () => {
    const ownLine = (skill, lang) => limitLine(skill, lang, { code: (skill.evidence.find(e => e.reasons === skill.reasons) || skill.evidence[0])?.code })
    for (const lang of LANGS) {
      // In the sheet each capability says its own course's line (the shared line above the rows says it once for all).
      for (const skill of skills) expect(levelReason(skill, skills, lang).text).toBe(ownLine(skill, lang).text)
      // Without a line of its own, the shared line.
      const bare = { ...skills[0], reasons: [], evidence: skills[0].evidence.map(e => ({ ...e, reasons: [] })) }
      expect(ownLine(bare, lang)).toBe(null)
      expect(levelReason(bare, skills, lang).text).toBe(sharedLimitLine(skills, lang).text)
      // A made-up D grade in one course: that capability's own line names the grade.
      const low = profileSkills({ ...SAMPLE, courses: SAMPLE.courses.map((row, i) => (i === 0 ? { ...row, grade: 'D' } : row)) })
      const own = low.find(skill => limitLine(skill, lang))
      expect(levelReason(own, low, lang).text).toBe(ownLine(own, lang).text)
      const strong = { id: 'x', labels: { ar: 'س', en: 'X' }, evidenceLevel: 'strong', reasons: [], evidence: [] }
      expect(levelReason(strong, [strong], lang).text).toBe(LEVEL_MEANINGS[lang].strong)
    }
  })

  it('a row on its own: name, level word, the source for screen readers, a dialog opener', () => {
    const skill = skills[0]
    const html = renderToStaticMarkup(createElement(CapabilityRow, { lang: 'en', skill, onOpen: noop }))
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain(`data-level="${skill.evidenceLevel}"`)
    expect(textOf(html)).toBe(`${skill.labels.en} ${levelLabel(skill.evidenceLevel, 'en')} Source: ${capabilitySource(skill, 'en').text}`)
    // A capability backed by a verified credential says so.
    expect(capabilitySource({ ...skill, practicalEvidence: [{}] }, 'en').text).toBe('verified credential')
  })
})

describe('Task 66 · My projects, My interests, My goals, More, Settings and Help', () => {
  const withAll = {
    ...SAMPLE,
    projects: [{ id: 'p1', title: 'Study room booking app (made up)', skillIds: ['database'] }],
    consents: { analyze: true, insight: true },
    insight: { ...emptyInsightState(), declaredPreferences: { careerInterest: DECLARED_PREFERENCE_SCHEMES.careerInterest.options[1].id }, freeInterests: [{ id: 'fi-made-up-1', text: 'I want to analyse data', understood: [], method: FREE_INTEREST_METHOD, createdAt: '2026-11-19T09:00:00.000Z' }] },
    goals: ['job-data-analyst', 'data'],
  }
  for (const lang of LANGS) it(`${lang}: each section says what is there, by name (never an id), with Edit`, () => {
    const s = sectionSummaries(withAll, lang)
    expect(s.projects).toBe('Study room booking app (made up)')
    expect(s.interests).toContain(DECLARED_PREFERENCE_SCHEMES.careerInterest.options[1].label[lang])
    expect(s.interests).toContain(fillIn(W(lang).ownWords, { n: 1 }))
    expect(s.goals).toContain(targetProfiles.find(t => t.id === 'job-data-analyst').title[lang])
    expect(s.goals).toContain(copy[lang].app.goals.data)
    expect(JSON.stringify(s)).not.toMatch(/job-data-analyst|careerInterest|\bdata\b(?! )/)
    const text = textOf(page(lang, withAll))
    for (const section of [W(lang).projects, W(lang).interests, W(lang).goals]) expect(page(lang, withAll)).toContain(`aria-label="${fillIn(W(lang).editOf, { section })}"`)
    expect(text).toContain(s.interests)
  })

  it('interests count only with the interests consent; empty sections say so', () => {
    for (const lang of LANGS) {
      const s = sectionSummaries({ ...withAll, consents: { analyze: true } }, lang)
      expect(s.interests).toBe(W(lang).noInterests)
      const e = sectionSummaries(EMPTY, lang)
      expect([e.projects, e.interests, e.goals]).toEqual([W(lang).noProjects, W(lang).noInterests, W(lang).noGoals])
    }
  })

  for (const lang of LANGS) it(`${lang}: More's three rows are closed buttons; Settings and Help are named by their titles`, () => {
    const html = page(lang, SAMPLE)
    for (const label of [W(lang).credential, W(lang).tasks, W(lang).moreInterests]) expect(html).toMatch(new RegExp(`<button type="button" class="ui2-more-toggle" aria-expanded="false"[^>]*>.*?<span>${label}</span></button>`))
    for (const view of ['settings', 'help']) expect(html).toContain(`<span>${VIEW_TEXT[view].title[lang]}</span></button>`)
    // Closed: none of the old components is on the page yet.
    expect(html).not.toMatch(/credential-import|task-loop|digital-interests/)
  })

  it('the "what changed" summary shows only when AppNext hands it over (one message at a time), with "Got it"', () => {
    for (const lang of LANGS) {
      expect(page(lang, SAMPLE)).not.toContain('ui2-profile-change')
      const html = page(lang, SAMPLE, { change: { type: 'recompute', sentences: { ar: ['جملة'], en: ['A sentence.'] }, ts: 1 } })
      expect(html).toContain('ui2-profile-change')
    }
  })
})

describe('Task 66 · steps 1–4 opened from Profile\'s Edit', () => {
  const props = (lang, state, editMode) => ({ lang, profile: { state, derived: { skills: profileSkills(state), matches: [] }, actions: { setState: noop, log: noop, deleteOne: noop, saveProject: noop, removeProject: noop, changePersistence: noop, clearDraft: noop }, status: { processing: false }, draft: { rows: [], validation: null } }, focusHeading: false, onNavigate: noop, notify: noop, onApprove: noop, editMode })
  for (const lang of LANGS) it(`${lang}: "Back to Profile" instead of the step chip and Next; without edit mode, as before`, () => {
    const back = W(lang).backToProfile
    const steps = [[Projects, 2], [Interests, 3], [NextSteps, 4], [Upload, 1]]
    for (const [Screen, n] of steps) {
      const chip = fillIn(NEXT_COPY[lang].steps.step, { n, of: 4 })
      const edit = textOf(renderToStaticMarkup(createElement(Screen, props(lang, SAMPLE, true))))
      const flow = textOf(renderToStaticMarkup(createElement(Screen, props(lang, SAMPLE, false))))
      expect(edit, `step ${n} in edit mode`).not.toContain(chip)
      expect(flow, `step ${n} in the flow`).toContain(chip)
      expect(flow).not.toContain(back)
      if (n > 1) expect(edit, `step ${n}: Back to Profile`).toContain(back)
    }
  })

  it('AppNext: Edit opens the step in edit mode; approving step 1 opened from Profile comes back to Profile', () => {
    const app = read('src/ui2/AppNext.jsx')
    expect(app).toMatch(/const openEdit = step => \{ if \(step === 'upload'\) actions\.clearDraft\(\); navigate\(step, \{ edit: true \}\) \}/)
    expect(app).toMatch(/navigate\(back \? 'profile' : 'projects'\)/)
    expect(app).toMatch(/<Profile key="profile"[^>]*onEdit=\{openEdit\}/)
    expect(app).toMatch(/change=\{notice \? null : summary\}/)
  })
})

describe('Task 66 · the interests consent on Profile is step 3\'s, word for word', () => {
  it('one function for both screens; step 3 still reads it through interestsState.js', () => {
    expect(interestsState.grantInterests).toBe(grantInterests)
    expect(interestsState.CHIP_QUESTIONS).toBe(CHIP_QUESTIONS)
    const granted = grantInterests(EMPTY, 'Interests profile consent granted')
    expect(granted.consents.insight).toBe(true)
    expect(granted.audit[0].label).toBe('Interests profile consent granted')
    expect(grantInterests(granted, 'again')).toBe(granted)
    const profile = read('src/ui2/screens/Profile.jsx')
    expect(profile).toContain('{S.consent}')
    expect(profile).toContain('grantInterests(s, S.consentGranted)')
  })
})

describe('Task 66 · the old parts keep brand.css\'s light values; everything loads on its own', () => {
  // Task 75 (Amjd, 2026-11-19): only in the light theme (<html data-scheme="light">, the theme shown); in the dark theme the
  // dark tokens apply inside .ui2-legacy too (src/ui2/legacy-dark.css). The values themselves are unchanged.
  it('inside .ui2-legacy every brand colour token has public/brand.css\'s own value (light theme)', () => {
    const decl = body => Object.fromEntries(body.replace(/\/\*[\s\S]*?\*\//g, '').split(';').map(p => p.trim()).filter(Boolean).map(p => [p.slice(0, p.indexOf(':')).trim(), p.slice(p.indexOf(':') + 1).trim()]))
    const brand = decl(read('public/brand.css').match(/:root\{([^}]*)\}/)[1])
    expect(read('src/ui2/theme.css')).not.toMatch(/:root\[data-theme\] \.ui2-legacy\{/)
    const legacy = decl(read('src/ui2/theme.css').match(/:root\[data-scheme="light"\] \.ui2-legacy\{([^}]*)\}/)[1])
    const colours = Object.keys(brand).filter(name => /^#|^var\(|rgb\(/.test(brand[name]) && !/radius|font/.test(name))
    expect(colours.length).toBeGreaterThanOrEqual(20)
    for (const name of colours) expect(legacy[name], name).toBe(brand[name])
  })

  it('AppNext loads Profile with lazy(import()); only Profile imports its row and its CSS; the old components load when opened', () => {
    const app = read('src/ui2/AppNext.jsx')
    expect(app).toMatch(/const Profile = lazy\(\(\) => import\('\.\/screens\/Profile\.jsx'\)\)/)
    expect(app).not.toMatch(/^import[^\n]*(screens\/Profile|CapabilityRow|profile\.css)/m)
    const files = sourceFiles('src').map(f => f.split(path.sep).join('/'))
    const importers = pattern => files.filter(f => /\.(jsx?|mjs)$/.test(f) && new RegExp(`^import[^\\n]*${pattern}`, 'm').test(read(f)))
    expect(importers("profile\\.css'")).toEqual(['src/ui2/screens/Profile.jsx'])
    expect(importers("CapabilityRow\\.jsx'")).toEqual(['src/ui2/screens/Profile.jsx'])
    expect(importers("interestsConsent\\.js'").sort()).toEqual(['src/ui2/interestsState.js', 'src/ui2/screens/Profile.jsx'])
    const profile = read('src/ui2/screens/Profile.jsx')
    for (const name of ['CredentialImport', 'TaskLoop', 'DigitalInterests', 'WhatChanged', 'CollegeFix']) {
      expect(profile).toMatch(new RegExp(`lazy\\(\\(\\) => import\\('\\.\\./\\.\\./components/${name}\\.jsx'\\)`))
      expect(profile).not.toMatch(new RegExp(`^import[^\\n]*components/${name}\\.jsx'`, 'm'))
    }
    expect(read('src/main.jsx')).not.toMatch(/Profile/)
  })

  // Task 70: the old interface (src/App.jsx, StudentInsight.jsx) is deleted; the reused components stay as they were.
  it('the components Profile reuses keep their files as they were used', () => {
    for (const gone of ['src/App.jsx', 'src/components/StudentInsight.jsx']) expect(existsSync(gone), gone).toBe(false)
    expect(read('src/components/DashboardMore.jsx')).toMatch(/import TaskLoop, \{ TodayStrip \} from '\.\/TaskLoop\.jsx'/)
    for (const name of ['CredentialImport', 'TaskLoop', 'DigitalInterests']) expect(existsSync(`src/components/${name}.jsx`), name).toBe(true)
  })

  it('the new words: the same keys in both languages, no percentage', () => {
    expect(Object.keys(NEXT_COPY.ar.profile)).toEqual(Object.keys(NEXT_COPY.en.profile))
    for (const lang of LANGS) expect(JSON.stringify(NEXT_COPY[lang].profile)).not.toMatch(PERCENT)
    // The empty-list sentence is the old dashboard's, word for word.
    for (const lang of LANGS) expect(read('src/components/Dashboard.jsx')).toContain(NEXT_COPY[lang].profile.noCapabilities)
  })
})

// ---------- Task 74 · My map; Task 75 · it is the old "Show connections" graph ----------
// Amjd, 2026-11-19: Task 74's layered map "is not acceptable"; My map is the old interface's "Show connections" graph (the
// supervisor's map), reused as it was. Task 74's layered map (MyMap.jsx, personMap.js, map.css) and its 11 tests are gone with
// it; these tests check the old graph in its new place.
describe('Task 75 · My map is the old "Show connections" graph, shared with the old interface', async () => {
  const { default: ConnectionsMap, firstPathway, DEFAULT_PATHWAY } = await import('../src/ui2/components/ConnectionsMap.jsx')
  const { projectStateToPerson360 } = await import('../src/ontology/projector.js')
  const { buildMatchingProfile, matchTargets } = await import('../src/matching/engine.js')
  const files = sourceFiles('src').map(f => f.split(path.sep).join('/'))
  const importers = pattern => files.filter(f => /\.(jsx?|mjs)$/.test(f) && new RegExp(`^import[^\\n]*${pattern}`, 'm').test(read(f)))
  const derivedOf = state => {
    const skills = profileSkills(state)
    const graph = projectStateToPerson360({ state, skills })
    return { skills, graph, matches: matchTargets(buildMatchingProfile({ graph, goals: state.goals }), { type: 'job', lang: 'en' }) }
  }
  const render = (lang, state) => { const d = derivedOf(state); return renderToStaticMarkup(createElement(ConnectionsMap, { lang, state, matches: d.matches, graph: d.graph, skills: d.skills, onCapability: noop, onGoal: noop })) }

  it("Task 74's layered map is deleted: no file, no import, no words", () => {
    for (const file of ['src/ui2/components/MyMap.jsx', 'src/ui2/personMap.js', 'src/ui2/map.css']) expect(() => statSync(file), file).toThrow()
    expect(importers('(MyMap|personMap|map\\.css)')).toEqual([])
    for (const lang of LANGS) expect(NEXT_COPY[lang].map, "the layered map's words are gone").toBeUndefined()
    expect(W('ar').map).toBe('خريطتي')
    expect(W('en').map).toBe('My map')
  })

  // Task 70: the old "Show connections" tab (src/components/DecisionStudio.jsx) is deleted; My map is the one user of
  // ShowConnections.jsx, which still holds the old words (one copy).
  it('one copy of the old tab: My map imports ShowConnections.jsx, which holds the old words', () => {
    const shared = read('src/components/ShowConnections.jsx')
    expect(existsSync('src/components/DecisionStudio.jsx')).toBe(false)
    for (const words of ['Pathway to explore', 'My profile dimensions', 'Edit my interests & goal', 'Academic evidence path to the opportunity', 'This is your personal information network.']) {
      expect(shared, words).toContain(words)
      expect(read('src/ui2/components/ConnectionsMap.jsx').replace(/^\s*\/\/.*$/gm, ''), `"${words}" is not copied into ConnectionsMap.jsx`).not.toContain(words)
    }
    expect(importers("ShowConnections\\.jsx'").sort()).toEqual(['src/ui2/components/ConnectionsMap.jsx'])
  })

  it('Profile lazy-loads the map; only Profile loads it; nothing new enters the startup modules', () => {
    const profile = read('src/ui2/screens/Profile.jsx')
    expect(profile).toMatch(/const ConnectionsMap = lazy\(\(\) => import\('\.\.\/components\/ConnectionsMap\.jsx'\)\)/)
    expect(profile).toMatch(/<ConnectionsMap lang=\{lang\} state=\{state\} matches=\{derived\.matches\} graph=\{derived\.personGraph\} skills=\{skills\} onCapability=\{skillId => setOpened\(skillId\)\} onGoal=\{\(\) => onEdit\('interests'\)\}\/>/)
    expect(importers("ConnectionsMap\\.jsx'")).toEqual([])
    expect(read('src/main.jsx')).not.toMatch(/ConnectionsMap/) // Task 70: src/App.jsx is deleted
  })

  it('the rendered map is the old graph: "Pathway to explore", the heading, the questions, the nodes, the legend and the two details', () => {
    for (const lang of LANGS) {
      const html = render(lang, SAMPLE)
      const text = textOf(html)
      expect(html).toContain('data-testid="ui2-map"')
      expect(html).toMatch(/class="ui2-legacy ui2-connections"/)
      expect(text).toContain(lang === 'ar' ? 'المسار الذي أريد استكشافه' : 'Pathway to explore')
      expect(text).toContain(lang === 'ar' ? 'أشخاص. اهتمامات. قدرات. فرص.' : 'People. Interests. Capabilities. Opportunities.')
      for (const question of lang === 'ar' ? ['كيف يرتبط المسار بأدلتي؟', 'ما خطوة التعلم المرتبطة؟'] : ['How does this pathway connect to my evidence?', 'What learning step connects?']) expect(text).toContain(question)
      for (const kind of ['person', 'evidence', 'skill', 'job']) expect(html, kind).toMatch(new RegExp(`class="relationship-node relationship-${kind}`))
      expect(text).toContain(lang === 'ar' ? 'دليل مُراجع' : 'Reviewed evidence')
      expect(text).toContain(lang === 'ar' ? 'تفاصيل أبعاد ملفي' : 'My profile dimensions')
      expect(text).toContain(lang === 'ar' ? 'مسار الدليل الأكاديمي إلى الفرصة' : 'Academic evidence path to the opportunity')
      expect(text).not.toMatch(PERCENT)
      // The reviewed course of the example is on the map with its code.
      expect(text).toMatch(/CPIT-\d{3}/)
    }
  })

  it("the pathway: the first chosen goal that is a pathway, else the old studio's default", () => {
    const { matches } = derivedOf(SAMPLE)
    expect(DEFAULT_PATHWAY).toBe('job-data-analyst')
    expect(firstPathway(SAMPLE, matches)).toBe('job-data-analyst')
    expect(firstPathway({ ...SAMPLE, goals: ['data', 'job-software-engineer'] }, matches)).toBe('job-software-engineer')
    expect(firstPathway({ ...SAMPLE, goals: ['no-such-pathway'] }, matches)).toBe('job-data-analyst')
    expect(render('en', { ...SAMPLE, goals: ['job-software-engineer'] })).toMatch(/<option value="job-software-engineer" selected="">/)
  })

  it("a tap on a capability node hands over its id only for the student's own capabilities; the old graph still selects it", () => {
    const network = read('src/components/RelationshipNetwork.jsx')
    expect(network).toMatch(/onClick=\{\(\)=>\{setSelected\(n\.id\);if\(onCapability&&n\.kind==='skill'&&n\.iri\)onCapability\(n\.iri\.slice\(16\)\)\}\}/)
    expect('urn:kamin:skill:databases'.slice(16)).toBe('databases')
    expect(read('src/ui2/components/ConnectionsMap.jsx')).toMatch(/const openCapability = id => \{ if \(mine\.has\(id\)\) onCapability\(id\) \}/)
    // Building the map changes nothing in the profile.
    const before = JSON.stringify(SAMPLE)
    render('en', SAMPLE)
    expect(JSON.stringify(SAMPLE)).toBe(before)
  })
})

// Task 70 · the old dashboard's note for hand-typed courses ("evidence awaiting a document"), found missing while the
// browser tests were rewritten: Profile shows it under My capabilities, and only for courses typed by hand.
describe('Task 70 · courses awaiting a document', () => {
  it('Profile lists a hand-typed linked course as awaiting a document; a transcript course is not listed', () => {
    for (const lang of ['ar', 'en']) {
      const typed = { ...SAMPLE, courses: [...SAMPLE.courses.map(row => ({ ...row, source: 'pdf' })), { code: 'CPIT-240', name: 'Databases', grade: 'A', source: 'manual' }] }
      const html = page(lang, typed)
      expect(html).toContain('data-testid="awaiting-evidence"')
      expect(textOf(html.slice(html.indexOf('data-testid="awaiting-evidence"')))).toContain('CPIT-240')
      expect(page(lang, { ...SAMPLE, courses: SAMPLE.courses.map(row => ({ ...row, source: 'pdf' })) })).not.toContain('data-testid="awaiting-evidence"')
    }
  })
})

// Task 78: up to 3 interest areas and 3 work values. Profile's line, My map's interest node and the profile network read
// every chosen value; one value reads as before.
describe('Task 78 · Profile and My map show every chosen interest area and work value', () => {
  const prefs = { careerInterest: ['social', 'artistic', 'investigative'], workValue: ['support', 'achievement'] }
  const stateWith = declaredPreferences => ({ approved: true, courses: [], consents: { insight: true }, insight: { ...emptyInsightState(), declaredPreferences } })
  const name = (scheme, id, lang) => DECLARED_PREFERENCE_SCHEMES[scheme].options.find(o => o.id === id).label[lang]

  for (const lang of ['ar', 'en']) it(`${lang}: Profile's interests line names all 5 chips in the order chosen; one old value still reads`, () => {
    const line = sectionSummaries(stateWith(prefs), lang).interests
    const names = [...prefs.careerInterest.map(id => name('careerInterest', id, lang)), ...prefs.workValue.map(id => name('workValue', id, lang))]
    let at = -1
    for (const n of names) { const next = line.indexOf(n); expect(next, n).toBeGreaterThan(at); at = next }
    expect(sectionSummaries(stateWith({ careerInterest: 'social' }), lang).interests).toBe(sectionSummaries(stateWith({ careerInterest: ['social'] }), lang).interests)
  })

  it('the profile network lists every value; one value reads as before', async () => {
    const { preferenceLabel } = await import('../src/components/ProfileNetwork.jsx')
    expect(preferenceLabel(prefs, 'careerInterest', 'en')).toBe(prefs.careerInterest.map(id => name('careerInterest', id, 'en')).join(', '))
    expect(preferenceLabel({ careerInterest: 'social' }, 'careerInterest', 'en')).toBe(name('careerInterest', 'social', 'en'))
    expect(preferenceLabel(prefs, 'workValue', 'ar')).toBe(prefs.workValue.map(id => name('workValue', id, 'ar')).join('، '))
  })

  it('My map\'s interest node shows the area the pathway fits (its R3), or every chosen area when none fits', async () => {
    const { buildRelationshipNetwork } = await import('../src/network/relationships.js')
    const { buildMatchingProfile, matchTargets } = await import('../src/matching/engine.js')
    const { projectStateToPerson360 } = await import('../src/ontology/projector.js')
    const state = stateWith(prefs)
    const matches = matchTargets(buildMatchingProfile({ graph: projectStateToPerson360({ state, skills: [] }) }), { lang: 'en' })
    const fits = buildRelationshipNetwork({ state, match: matches.find(m => m.id === 'job-data-analyst') })
    const interest = fits.nodes.find(n => n.id === 'interest')
    expect(interest.title.en).toBe(name('careerInterest', 'investigative', 'en'))
    expect(interest.iri).toBe('urn:kamin:preference:careerinterest:investigative')
    expect(fits.routes.interests.supported).toBe(true)
    // Creating and building fit none of the project coordinator's areas (leading, organising, helping).
    const other = stateWith({ careerInterest: ['artistic', 'realistic'] })
    const otherMatches = matchTargets(buildMatchingProfile({ graph: projectStateToPerson360({ state: other, skills: [] }) }), { lang: 'en' })
    const none = buildRelationshipNetwork({ state: other, match: otherMatches.find(m => m.id === 'job-project-coordinator') })
    expect(none.nodes.find(n => n.id === 'interest').title.en).toBe(['artistic', 'realistic'].map(id => name('careerInterest', id, 'en')).join(', '))
    expect(none.routes.interests.supported).toBe(false)
    const goal = buildRelationshipNetwork({ state: { ...state, goal: 'job-data-analyst' }, match: matches[0] }).nodes.find(n => n.id === 'goal')
    expect(goal.title.en, 'a pathway goal is named by its title').toBe('Data Analyst')
  })

  it('the connection picker names each chosen value when a scheme has several connections, and a pathway goal by its title', async () => {
    const { InferenceProof } = await import('../src/components/InferenceExplorer.jsx')
    const { buildMatchingProfile, matchTargets } = await import('../src/matching/engine.js')
    const { projectStateToPerson360 } = await import('../src/ontology/projector.js')
    const state = { ...stateWith({ careerInterest: ['social', 'investigative', 'conventional'] }), goal: 'job-data-analyst', goals: ['job-data-analyst'] }
    const graph = projectStateToPerson360({ state, skills: [] })
    const match = matchTargets(buildMatchingProfile({ graph, goals: state.goals }), { lang: 'en' }).find(m => m.id === 'job-data-analyst')
    const options = [...renderToStaticMarkup(createElement(InferenceProof, { match, graph, lang: 'en' })).matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map(m => m[1])
    const scheme = DECLARED_PREFERENCE_SCHEMES.careerInterest.label.en
    expect(options).toContain(`${scheme} · ${name('careerInterest', 'investigative', 'en')}`)
    expect(options).toContain(`${scheme} · ${name('careerInterest', 'conventional', 'en')}`)
    const html = renderToStaticMarkup(createElement(InferenceProof, { match: { ...match, inferences: match.inferences.filter(i => i.ruleId === 'R2') }, graph, lang: 'en' }))
    expect(html).toContain('declares goal · Data Analyst')
    expect(html).not.toContain('declares goal · job-data-analyst')
  })
})
