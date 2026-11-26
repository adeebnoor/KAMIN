// Task 65 · step 4 of the new interface (the next-steps feed, src/ui2/screens/NextSteps.jsx) and My plan
// (src/ui2/screens/Plan.jsx). Every card has a gap reason (all cards of 3 synthetic profiles, every pathway as the goal);
// a card is four short lines (kind and title, Builds, Improves, Why) with Take/Get, Not for me and Details; Details
// carries the outcome, level, prerequisites, gap, evidence sources, the item's source and the "clue, not a guarantee"
// sentence word for word; no score, percentage, rank or technical id; Take, Not for me and their Undo, goals (at most
// 3) and the plan's changes are Task 58's functions and never touch evidence; the shared sentences (the order rule,
// the learning list, the pathway sentences, the save offer) come from one place for both interfaces; a pathway goal
// aligns with its pathway in matching while the old four directions match exactly as before; and both screens load on
// their own (the feed and the learning list only on demand), with no change to the startup modules beyond the
// matching rule.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import NextSteps from '../src/ui2/screens/NextSteps.jsx'
import Plan, { compareStart } from '../src/ui2/screens/Plan.jsx'
import GoalPicker, { goalName } from '../src/ui2/components/GoalPicker.jsx'
import StepCard, { StepDetails, CHIPS_PER_LINE } from '../src/ui2/components/StepCard.jsx'
import * as engine from '../src/ui2/stepsEngine.js'
import { actionFor, dropStep, feedInput, firstSentence, hideStep, restoreStep, takeStep, toggleGoal, unhideStep, wordPathways } from '../src/ui2/nextState.js'
import { feedGoals, nextStepFeed } from '../src/path/nextSteps.js'
import { normalizePlan } from '../src/plan/plan.js'
import { addToPlan } from '../src/plan/planEdits.js'
import { targetProfiles } from '../src/matching/targets.js'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { profileSkills } from '../src/utils/engine.js'
import { emptyInsightState } from '../src/insight.js'
import { FREE_INTEREST_METHOD } from '../src/interests/freeInterestState.js'
import { syntheticTranscript } from '../src/pilot/syntheticTranscripts.js'
import { demoCourses } from '../src/data.js'
import { copy } from '../src/i18n.js'
import { NEXT_COPY } from '../src/ui2/copy.js'
import { VIEW_TEXT } from '../src/ui2/views.js'
import { COURSE_EVIDENCE_PRINCIPLE } from '../src/content/trustCopy.js'
import { LEARNING_PATH_COPY } from '../src/content/learningPathCopy.js'
import { PATHWAY_COPY } from '../src/content/pathwayCopy.js'
import { SAVE_OFFER, saveOffer } from '../src/content/saveOfferCopy.js'
// Task 79
import Roadmap from '../src/ui2/components/Roadmap.jsx'
import { loadRoadmaps } from '../src/ui2/useRoadmaps.js'
import { loadStepsEngine } from '../src/ui2/useStepsEngine.js'
import { capabilityName } from '../src/ui2/capabilityName.js'
import { fillIn } from '../src/ui2/copy.js'
import { goalLabelOf } from '../src/components/ShowConnections.jsx'
import { blankState, hasMeaningfulProfileState, normalizeState } from '../src/state/profileState.js'
import { buildPortableProfile, normalizePortableState } from '../src/utils/portableProfile.js'
import { deleteEverythingPreview, withdrawConsent } from '../src/utils/dataControl.js'
import { skills as skillCatalog } from '../src/data.js'

const LANGS = ['ar', 'en']
const read = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const sourceFiles = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? sourceFiles(p) : [p] })
const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
const noop = () => {}
const PERCENT = /\d\s?[%٪]|[%٪]\s?\d/
const NOW = Date.parse('2026-11-19T09:00:00.000Z')
const base = courses => ({ approved: true, courses, college: 'FCIT', projects: [], tasks: [], credentials: [], insight: emptyInsightState(), consents: { analyze: true }, goals: [], plan: [], notForMe: [], audit: [] })
// Three synthetic, made-up profiles (no person): the app's example, the trial's synthetic transcript, and the rows of
// the synthetic KAU fixture "fcit-is-3p" (Task 50), as the reader hands rows over (source 'pdf').
const fixtureRows = JSON.parse(read('tests/fixtures/transcripts/fcit-is-3p.expected.json')).rows
const PROFILES = {
  sample: base(demoCourses.map(row => ({ ...row }))),
  trial: base(syntheticTranscript().courses.map(row => ({ ...row }))),
  'fcit-is-3p': base(fixtureRows.filter(row => row.letter).map(row => ({ code: row.code, name: { ar: row.code, en: row.code }, grade: row.letter, source: 'pdf' }))),
}
const SAMPLE = PROFILES.sample
const skillsOf = state => profileSkills(state)
const feedFor = (state, goals) => nextStepFeed(feedInput(normalizePlan({ ...state, goals }), skillsOf(state)))
const JOBS = targetProfiles.map(target => target.id)
const firstCard = (goal = 'job-data-analyst', state = SAMPLE) => feedFor(state, [goal]).cards[0]
const card = (lang, c, extra = {}) => renderToStaticMarkup(createElement(StepCard, { lang, card: c, item: engine.catalogItem(c.itemId), goals: [], onTake: noop, onHide: noop, onDetails: noop, ...extra }))
const derivedFor = state => {
  const skills = skillsOf(state)
  const graph = projectStateToPerson360({ state, skills })
  const matchProfile = buildMatchingProfile({ graph, goals: state.goals })
  return { skills, matches: matchTargets(matchProfile, { lang: 'en' }), matchProfile }
}
const screen = (Component, lang, state) => renderToStaticMarkup(createElement(Component, { lang, profile: { state, actions: { setState: noop, log: noop, changePersistence: noop }, derived: derivedFor(state) }, focusHeading: false, onNavigate: noop, notify: noop }))

describe('Task 65 · no card without a gap reason (3 synthetic profiles, every pathway as the goal)', () => {
  for (const [name, state] of Object.entries(PROFILES)) it(`${name}: every card names the gap it closes, in both languages, in one sentence on the card`, () => {
    const skills = skillsOf(state)
    expect(skills.length, `${name} has capabilities`).toBeGreaterThan(0)
    let cards = 0
    for (const goal of JOBS) for (const c of feedFor(state, [goal]).cards) {
      cards++
      expect(c.gapCapabilities.length, `${goal}/${c.itemId}`).toBeGreaterThan(0)
      for (const lang of LANGS) {
        expect(c.why[lang].trim(), `${goal}/${c.itemId} ${lang}`).not.toBe('')
        const shown = firstSentence(c.why[lang])
        expect(shown.length).toBeGreaterThan(10)
        expect(c.why[lang].startsWith(shown)).toBe(true)
        expect(textOf(card(lang, c))).toContain(shown)
      }
    }
    expect(cards, `${name} has cards for some goal`).toBeGreaterThan(0)
    // With three goals at once, too.
    for (const c of feedFor(state, ['job-data-analyst', 'job-cyber-analyst', 'job-project-coordinator']).cards) expect(c.why.en).toMatch(/requires/)
  })

  it('the first sentence of a reason ends at the first full stop (Arabic and English)', () => {
    expect(firstSentence('The field "Data Analyst" requires Databases, and your evidence for it is limited. The field "X" requires Y.')).toBe('The field "Data Analyst" requires Databases, and your evidence for it is limited.')
    expect(firstSentence('مجال «محلل بيانات» يتطلب قواعد البيانات، ودليلك عليها محدود. مجال آخر.')).toBe('مجال «محلل بيانات» يتطلب قواعد البيانات، ودليلك عليها محدود.')
    expect(firstSentence('no stop')).toBe('no stop')
  })
})

describe('Task 65 · a card: four short lines, three actions, no score', () => {
  for (const lang of LANGS) it(`${lang}: kind and title, Builds, Improves, Why; Take this course / Get this certificate, Not for me, Details`, () => {
    const w = NEXT_COPY[lang].next
    const c = firstCard('job-data-analyst')
    const html = card(lang, c)
    const text = textOf(html)
    expect(html.match(/<h3/g)).toHaveLength(1)
    // The text before the actions is four rows: the top row (kind and title) and three lines.
    expect(html.match(/class="ui2-step-top"/g)).toHaveLength(1)
    expect(html.match(/class="ui2-step-line[^"]*"/g)).toHaveLength(3)
    expect(text).toContain(LEARNING_PATH_COPY[lang].kind['university-course'])
    expect(text).toContain(engine.catalogItem(c.itemId).title[lang])
    for (const label of [w.builds, w.improves, w.why, w.take, w.notForMe, w.details]) expect(text).toContain(label)
    expect(text).not.toContain(w.get)
    // At most two chips per line, the rest as "+n" whose name lists them.
    const improves = html.match(/data-testid="ui2-step-improves">([\s\S]*?)<\/p>/)[1]
    expect(c.improves.length).toBeGreaterThan(CHIPS_PER_LINE)
    expect(improves.match(/class="ui2-chip"/g)).toHaveLength(CHIPS_PER_LINE + 1)
    expect(textOf(improves)).toContain(`+${c.improves.length - CHIPS_PER_LINE}`)
    expect(text).not.toMatch(PERCENT)
    expect(text).not.toMatch(/urn:kamin|job-data-analyst|fcit-cpit/)
    expect(html).not.toMatch(/score|rank|درجة الملاءمة/i)
  })

  it('a certificate says "Get this certificate", and an illustrative item says so', () => {
    const c = firstCard('job-project-coordinator')
    expect(c.kind).toBe('certificate')
    expect(c.illustrative).toBe(true)
    for (const lang of LANGS) {
      const text = textOf(card(lang, c))
      expect(text).toContain(NEXT_COPY[lang].next.get)
      expect(text).toContain(LEARNING_PATH_COPY[lang].illustrative)
    }
    expect(actionFor('certificate')).toBe('get-certificate')
    expect(actionFor('course')).toBe('take-course')
    expect(actionFor('university-course')).toBe('take-course')
  })

  it('Improves lists the student\'s goals first', () => {
    const c = firstCard('job-data-analyst')
    const goal = c.improves.at(-1)
    const html = card('en', c, { goals: [goal] })
    const first = html.match(/data-testid="ui2-step-improves">[\s\S]*?class="ui2-chip">([^<]*)</)[1]
    expect(first).toBe(targetProfiles.find(t => t.id === goal).title.en)
  })
})

describe('Task 65 · Details: outcome, level, prerequisites, gap, evidence sources, source and the clue sentence', () => {
  const details = (lang, c) => renderToStaticMarkup(createElement(StepDetails, { lang, card: c, item: engine.catalogItem(c.itemId), skills: skillsOf(SAMPLE), reviewed: engine.LIST_REVIEWED, gaps: c.forGoals.map(goal => engine.computeGap(skillsOf(SAMPLE), goal)) }))
  for (const lang of LANGS) it(`${lang}: everything the brief lists, the clue sentence and the learning list's sentence word for word`, () => {
    const w = NEXT_COPY[lang].next
    const T = LEARNING_PATH_COPY[lang]
    const course = firstCard('job-data-analyst')
    const html = details(lang, course)
    const text = textOf(html)
    for (const heading of [w.levelTitle, w.prerequisites, w.gapTitle, w.evidenceTitle, T.source]) expect(text).toContain(heading)
    expect(text).toContain(T.level[engine.catalogItem(course.itemId).level])
    expect(text).toContain(COURSE_EVIDENCE_PRINCIPLE[lang])
    expect(text).toContain(engine.LIST_REVIEWED ? T.introReviewed : T.intro)
    expect(text).toContain(`${T.closes}:`)
    expect(text).toContain(course.why[lang])
    // Where the evidence comes from: the student's own course codes behind the capability.
    const skill = skillsOf(SAMPLE).find(s => s.id === course.supports[0])
    for (const row of skill.evidence) expect(text).toContain(row.code)
    expect(html).toMatch(/data-testid="ui2-step-gap"/)
    expect(text).toContain(engine.catalogItem(course.itemId).source.ref)
    // A certificate shows its outcome; a missing capability says there is no evidence.
    const cert = firstCard('job-project-coordinator')
    const certText = textOf(details(lang, cert))
    expect(certText).toContain(engine.catalogItem(cert.itemId).outcome[lang])
    const cyber = firstCard('job-cyber-analyst')
    expect(textOf(details(lang, cyber))).toContain(T.status.missing)
    for (const t of [text, certText]) expect(t).not.toMatch(PERCENT)
  })
})

describe("Task 65 · the student's choices: goals, Take, Not for me, Undo, My plan (Task 58's functions)", () => {
  it('goals: a tap adds, a second tap removes, at most 3, the first is the main goal', () => {
    let s = toggleGoal(SAMPLE, 'job-cyber-analyst')
    s = toggleGoal(s, 'job-data-analyst')
    expect(s.goals).toEqual(['job-cyber-analyst', 'job-data-analyst'])
    expect(s.goal).toBe('job-cyber-analyst')
    s = toggleGoal(toggleGoal(s, 'job-web-developer'), 'job-qa-tester')
    expect(s.goals).toHaveLength(3)
    s = toggleGoal(s, 'job-cyber-analyst')
    expect(s.goals).toEqual(['job-data-analyst', 'job-web-developer'])
    expect(s.goal).toBe('job-data-analyst')
  })

  it('Take puts the item in My plan with the right action and a title-free log line; Undo takes it out; the card leaves the feed', () => {
    const s0 = normalizePlan({ ...SAMPLE, goals: ['job-data-analyst', 'job-project-coordinator'] })
    const [course, cert] = [firstCard('job-data-analyst'), firstCard('job-project-coordinator')]
    let s = takeStep(s0, course, { lang: 'en', now: NOW })
    s = takeStep(s, cert, { lang: 'en', now: NOW })
    expect(s.plan.map(p => [p.itemId, p.action, p.status])).toEqual([[course.itemId, 'take-course', 'planned'], [cert.itemId, 'get-certificate', 'planned']])
    expect(s.audit.slice(0, 2).map(a => a.label)).toEqual(['Next step saved', 'Next step saved'])
    expect(nextStepFeed(feedInput(s, skillsOf(s))).cards.map(c => c.itemId)).not.toContain(course.itemId)
    // Exactly Task 58's addToPlan.
    expect(takeStep(s0, course, { lang: 'en', now: NOW })).toEqual(addToPlan(s0, { itemId: course.itemId, action: 'take-course' }, { lang: 'en', now: NOW }))
    const undone = dropStep(s, course.itemId, { lang: 'en', now: NOW })
    expect(undone.plan.map(p => p.itemId)).toEqual([cert.itemId])
    expect(undone.audit[0].label).toBe('Next step removed')
    expect(nextStepFeed(feedInput(undone, skillsOf(undone))).cards.map(c => c.itemId)).toContain(course.itemId)
    for (const line of s.audit) expect(JSON.stringify(line)).not.toMatch(/Database|Information|CAPM|cpit/i)
  })

  it('Remove in My plan and its Undo put the step back in its place, with its date and status', () => {
    let s = normalizePlan(SAMPLE)
    for (const itemId of ['capm', 'fcit-cpit-340', 'fcit-cpit-425']) s = addToPlan(s, { itemId, action: itemId === 'capm' ? 'get-certificate' : 'take-course' }, { now: NOW })
    const entry = s.plan[1]
    const back = restoreStep(dropStep(s, entry.itemId), entry, 1)
    expect(back.plan).toEqual(s.plan)
    expect(restoreStep(back, entry, 0).plan).toEqual(s.plan)
  })

  it('Not for me hides the item from the feed; Undo shows it again', () => {
    const s0 = normalizePlan({ ...SAMPLE, goals: ['job-data-analyst'] })
    const c = firstCard('job-data-analyst')
    const hidden = hideStep(s0, c.itemId)
    expect(hidden.notForMe).toEqual([c.itemId])
    expect(nextStepFeed(feedInput(hidden, skillsOf(hidden))).cards).toEqual([])
    expect(nextStepFeed(feedInput(unhideStep(hidden, c.itemId), skillsOf(SAMPLE))).cards.map(x => x.itemId)).toEqual([c.itemId])
  })

  it('no choice here changes a capability, a level or its evidence', () => {
    const before = JSON.stringify(skillsOf(SAMPLE))
    let s = toggleGoal(toggleGoal(SAMPLE, 'job-data-analyst'), 'job-cyber-analyst')
    s = hideStep(takeStep(s, firstCard('job-data-analyst'), { now: NOW }), 'capm')
    expect(JSON.stringify(skillsOf(s))).toBe(before)
    expect(s.courses).toEqual(SAMPLE.courses)
  })

  it('pathways from the student\'s own words guide the feed only with the interests consent (the feed\'s own rule)', () => {
    const words = { ...emptyInsightState(), freeInterests: [{ id: 'fi-1', text: 'made up', lang: 'en', createdAt: '2026-11-19T09:00:00.000Z', method: FREE_INTEREST_METHOD, understood: [{ kind: 'pathway', id: 'job-cyber-analyst', removed: false }, { kind: 'pathway', id: 'job-web-developer', removed: true }] }] }
    const off = { ...SAMPLE, insight: words }
    const on = { ...off, consents: { ...off.consents, insight: true } }
    expect(wordPathways(off)).toEqual([])
    expect(feedInput(off, []).freeInterests).toEqual([])
    expect(wordPathways(on)).toEqual(['job-cyber-analyst'])
    expect(wordPathways(on)).toEqual(feedGoals([], feedInput(on, []).freeInterests))
  })

  it('My plan\'s comparison starts from the goals (two or three), or one goal and the first other job', () => {
    const { matches } = derivedFor(SAMPLE)
    expect(compareStart([], matches)).toBeNull()
    expect(compareStart(['data'], matches)).toBeNull()
    expect(compareStart(['job-cyber-analyst', 'job-data-analyst'], matches)).toEqual(['job-cyber-analyst', 'job-data-analyst'])
    const one = compareStart(['job-cyber-analyst'], matches)
    expect(one).toHaveLength(2)
    expect(one[0]).toBe('job-cyber-analyst')
    expect(matches.find(m => m.id === one[1]).type).toBe('job')
  })
})

describe('Task 65 · the screens', () => {
  for (const lang of LANGS) it(`${lang}: step 4 without a goal: "Where do you want to go?" with every pathway as a chip (matching's order), and the skeleton while the feed loads`, () => {
    const w = NEXT_COPY[lang].next
    const html = screen(NextSteps, lang, SAMPLE)
    const text = textOf(html)
    expect(text).toContain(VIEW_TEXT.next.title[lang])
    expect(text).toContain(fillStep(lang))
    expect(text).toContain(w.where)
    expect(text).toContain(w.aboutPaths)
    const chips = [...html.matchAll(/<button type="button" class="ui2-chip" aria-pressed="false"[^>]*>([^<]*)<\/button>/g)].map(m => textOf(m[1]))
    expect(chips).toEqual(derivedFor(SAMPLE).matches.map(m => goalName(m.id, lang)))
    expect(html).toContain('data-testid="ui2-skeleton"')
    expect(text).not.toMatch(PERCENT)
  })

  for (const lang of LANGS) it(`${lang}: My plan: goals, the empty plan's way to step 4, Compare paths, and the dashboard's save offer word for word`, () => {
    const w = NEXT_COPY[lang].plan
    const text = textOf(screen(Plan, lang, { ...SAMPLE, goals: ['job-data-analyst'] }))
    for (const words of [w.planned, w.empty, w.seeSteps, w.compare, w.savedSession, NEXT_COPY[lang].next.yourGoals]) expect(text).toContain(words)
    expect(text).toContain(goalName('job-data-analyst', lang))
    for (const key of ['question', 'detail', 'keep', 'notNow']) expect(text).toContain(saveOffer(key, lang))
    const kept = textOf(screen(Plan, lang, { ...SAMPLE, localPersistence: true }))
    expect(kept).toContain(saveOffer('savedNote', lang))
    expect(kept).not.toContain(saveOffer('question', lang))
  })

  it('a goal from the old interface (one of the four directions) is named by its label, never by its id', () => {
    for (const lang of LANGS) {
      const html = renderToStaticMarkup(createElement(GoalPicker, { lang, state: { ...SAMPLE, goals: ['data'] }, matches: derivedFor(SAMPLE).matches, onToggle: noop }))
      expect(textOf(html)).toContain(copy[lang].app.goals.data)
      expect(textOf(html)).not.toMatch(/(^|\s)data(\s|$)/)
    }
  })
})

describe('Task 65 · a pathway goal in matching; the four directions unchanged', () => {
  const judge = (goals, goal = goals[0] ?? null) => {
    const state = normalizePlan({ ...SAMPLE, goals, goal })
    return Object.fromEntries(derivedFor(state).matches.map(m => [m.id, m.judgment]))
  }
  it('the chosen pathway is not "outside your goal"; another pathway is', () => {
    const j = judge(['job-data-analyst'])
    expect(j['job-data-analyst']).not.toBe('exploratory')
    const d = derivedFor(normalizePlan({ ...SAMPLE, goals: ['job-data-analyst'] })).matches
    expect(d.find(m => m.id === 'job-data-analyst').supportingMechanisms.join(' ')).toMatch(/goal/)
    expect(d.find(m => m.id === 'job-business-analyst').limitingMechanisms.join(' ')).toMatch(/outside your current goal/)
  })
  it('every chosen goal counts, not only the first', () => {
    const j = judge(['job-cyber-analyst', 'job-data-analyst'])
    expect(j['job-data-analyst']).not.toBe('exploratory')
    expect(j['job-cyber-analyst']).not.toBe('exploratory')
  })
  it('one of the old directions gives exactly the old result (goals list or not)', () => {
    const skills = skillsOf(SAMPLE)
    const state = normalizePlan({ ...SAMPLE, goals: ['data'] })
    const graph = projectStateToPerson360({ state, skills })
    const old = matchTargets(buildMatchingProfile({ graph }), { lang: 'en' })
    const now = matchTargets(buildMatchingProfile({ graph, goals: ['data'] }), { lang: 'en' })
    expect(now).toEqual(old)
    expect(old.filter(m => m.judgment === 'exploratory').map(m => m.id).sort()).toEqual(targetProfiles.filter(t => !(t.goals || []).includes('data') && !(t.requiredSkills || []).some(id => !skills.some(s => s.id === id))).map(t => t.id).sort())
  })
})

describe('Task 65 · shared sentences live in one place for both interfaces', () => {
  // Task 70: the old app (src/App.jsx) is deleted; My plan and Settings say "kept" through the same file.
  it('the save offer: the dashboard, My plan and Settings read src/content/saveOfferCopy.js; nobody holds a copy', () => {
    expect(read('src/components/Dashboard.jsx')).toMatch(/saveOffer\('question', lang\)/)
    expect(read('src/ui2/screens/Plan.jsx')).toMatch(/saveOffer\('question', lang\)/)
    for (const file of ['src/ui2/screens/Plan.jsx', 'src/ui2/screens/Settings.jsx']) expect(read(file), file).toMatch(/saveOffer\('kept', lang\)/)
    // ("Not now" and "Yes, keep my profile" are short words other screens use too; the four sentences are checked.)
    const sentences = ['question', 'detail', 'kept', 'savedNote'].map(key => SAVE_OFFER[key])
    for (const file of sourceFiles('src').filter(f => !f.endsWith('saveOfferCopy.js'))) for (const [ar, en] of sentences) {
      expect(read(file), `${file}`).not.toContain(en)
      expect(read(file), `${file}`).not.toContain(ar)
    }
  })
  // Task 70: the old MatchList.jsx and LearningPath.jsx are deleted; step 4 still reads the two shared files.
  it('the pathway sentences and the learning list\'s words: step 4 imports the shared files and nobody holds a copy', () => {
    expect(read('src/ui2/components/GoalPicker.jsx')).toMatch(/PATHWAY_COPY\.provisional\[lang\]/)
    expect(read('src/ui2/components/StepCard.jsx')).toMatch(/LEARNING_PATH_COPY\[lang\]/)
    for (const file of sourceFiles('src').filter(f => !/(pathwayCopy|learningPathCopy)\.js$/.test(f))) for (const lang of LANGS) {
      expect(read(file), file).not.toContain(PATHWAY_COPY.provisional[lang])
      expect(read(file), file).not.toContain(LEARNING_PATH_COPY[lang].intro)
    }
  })
  it('the order rule and the clue sentence are read, not copied, by step 4', () => {
    expect(read('src/ui2/screens/NextSteps.jsx')).toMatch(/\{T\.rule\}/)
    for (const file of sourceFiles('src/ui2')) for (const lang of LANGS) {
      expect(read(file), file).not.toContain(copy[lang].screens.courses.rule)
      expect(read(file), file).not.toContain(COURSE_EVIDENCE_PRINCIPLE[lang])
    }
  })
  it('the new words: the same keys in both languages, no percentage', () => {
    for (const key of ['next', 'plan']) {
      expect(Object.keys(NEXT_COPY.ar[key])).toEqual(Object.keys(NEXT_COPY.en[key]))
      for (const lang of LANGS) expect(JSON.stringify(NEXT_COPY[lang][key])).not.toMatch(PERCENT)
    }
    expect(NEXT_COPY.en.plan.savedSession).toBe('Your plan is saved on this device for this session.')
  })
})

describe('Task 65 · step 4 and My plan load on their own; the startup modules stay as they were', () => {
  const app = read('src/ui2/AppNext.jsx')
  it('AppNext loads both screens with lazy(import()) only', () => {
    expect(app).toMatch(/const NextSteps = lazy\(\(\) => import\('\.\/screens\/NextSteps\.jsx'\)\)/)
    expect(app).toMatch(/const Plan = lazy\(\(\) => import\('\.\/screens\/Plan\.jsx'\)\)/)
    expect(app).not.toMatch(/^import[^\n]*(NextSteps|screens\/Plan|GoalPicker|StepCard|nextState|next\.css)/m)
  })
  it('the feed and the learning list load only on demand (stepsEngine.js through import())', () => {
    const files = sourceFiles('src').map(f => f.split(path.sep).join('/'))
    const staticImporters = pattern => files.filter(f => /\.(jsx?|mjs)$/.test(f) && new RegExp(`^import[^\\n]*${pattern}`, 'm').test(read(f)))
    expect(staticImporters("stepsEngine\\.js'")).toEqual([])
    expect(read('src/ui2/useStepsEngine.js')).toContain("import('./stepsEngine.js')")
    for (const f of files.filter(f => f.startsWith('src/ui2/') && f !== 'src/ui2/stepsEngine.js')) expect(read(f), f).not.toMatch(/^import[^\n]*(path\/nextSteps|path\/suggest|learning-opportunities)/m)
    expect(staticImporters("next\\.css'")).toEqual(['src/ui2/screens/NextSteps.jsx', 'src/ui2/screens/Plan.jsx'])
    expect(staticImporters("components/(StepCard|GoalPicker)\\.jsx'").sort()).toEqual(['src/ui2/screens/NextSteps.jsx', 'src/ui2/screens/Plan.jsx'])
  })
  it('the startup modules never import planEdits.js (it loads with the screens)', () => {
    for (const file of ['src/plan/plan.js', 'src/state/profileState.js', 'src/state/useKaminProfile.js', 'src/main.jsx']) expect(read(file).replace(/^\s*\/\/.*$/gm, ''), file).not.toContain('planEdits')
  })
  // Task 70: the old interface (src/App.jsx, which passed no starting choice) is deleted; My plan is the one user.
  it('the old pathway comparison is reused unchanged; My plan passes its starting choice', () => {
    const users = sourceFiles('src').map(f => f.split(path.sep).join('/')).filter(f => /<PathwayCompare\b/.test(read(f)))
    expect(users).toEqual(['src/ui2/screens/Plan.jsx'])
    expect(read('src/ui2/screens/Plan.jsx')).toMatch(/<PathwayCompare [^>]*initial=\{compareStart\(goals, derived\.matches\)\}/)
  })
  // Task 44 landed: the hook comments Task 65 left are wired. The buttons record one count each through
  // src/pilot/studyCounts.js (never trackPilotEvent, never the card, the item or a goal), and Undo takes it back.
  it('Task 44: "Take this course", "Not for me" and Remove count once each, Undo takes it back, and nothing about the item is passed', () => {
    const next = read('src/ui2/screens/NextSteps.jsx'), plan = read('src/ui2/screens/Plan.jsx')
    for (const [file, source] of [['NextSteps.jsx', next], ['Plan.jsx', plan]]) {
      expect(source, file).not.toContain('once that task lands')
      expect(source, file).not.toMatch(/trackPilotEvent/)
      for (const call of source.match(/(recordStepChoice|takeBackStepChoice)\([^)]*\)/g)) expect(call, `${file}: ${call}`).not.toMatch(/card|item|entry|goal|title/i)
    }
    expect(next).toMatch(/recordStepChoice\(event, engine\.NEXT_STEPS_VERSION\)/)
    expect(next).toMatch(/onClick: \(\) => \{ actions\.setState\(undo\); takeBackStepChoice\(event\) \}/)
    expect(next).toMatch(/w\.taken, s => dropStep\(s, card\.itemId, \{ lang \}\), 'step_taken'\)/)
    expect(next).toMatch(/w\.hidden, s => unhideStep\(s, card\.itemId\), 'step_not_for_me'\)/)
    expect(plan).toMatch(/if \(engine\) recordStepChoice\('step_removed', engine\.NEXT_STEPS_VERSION\)/)
    expect(plan).toMatch(/restoreStep\(s, entry, index\)\); takeBackStepChoice\('step_removed'\)/)
    // Restoring a "Not for me" item is the student's own choice again, not a suggestion: it records nothing.
    expect(plan.slice(plan.indexOf('const restore = '), plan.indexOf('const keep = '))).not.toMatch(/recordStepChoice|takeBackStepChoice/)
  })
})

function fillStep(lang) { return NEXT_COPY[lang].steps.step.replace('{n}', '4').replace('{of}', '4') }

// ---------- Task 74 · the development plan in My plan (K08) and the review in step 4's Details (K37) ----------
describe('Task 74 · K08: one development plan for both interfaces, inside My plan', () => {
  // Task 70: "Show connections" (src/components/DecisionStudio.jsx) is deleted; My plan's goal picker (the plan) and My map
  // (its status line, planStatus) are the users.
  it('the plan code and words live in src/plan/developmentPlan.jsx; only My plan\'s goal picker imports it and nobody holds a copy', async () => {
    const shared = await import('../src/plan/developmentPlan.jsx')
    expect(typeof shared.buildDevelopmentPlan).toBe('function')
    const files = sourceFiles('src').map(f => f.split(path.sep).join('/'))
    expect(files.filter(f => /^import[^\n]*plan\/developmentPlan\.jsx'/m.test(read(f)))).toEqual(['src/ui2/components/ConnectionsMap.jsx', 'src/ui2/components/GoalPicker.jsx'])
    for (const file of files.filter(f => f !== 'src/plan/developmentPlan.jsx')) for (const words of ['The plan does not change skills or matching results', 'kamin-development-plan.txt', 'Review your starting point', 'This plan does not change profile evidence or fit judgments.'])
      expect(read(file), `"${words}" is not copied into ${file}`).not.toContain(words)
  })

  it('four steps for every pathway of the example, in both languages, with the sentences of the old plan', async () => {
    const { buildDevelopmentPlan, planStatus } = await import('../src/plan/developmentPlan.jsx')
    const { matches } = derivedFor(SAMPLE)
    expect(matches.length).toBeGreaterThan(3)
    for (const match of matches) for (const lang of LANGS) {
      const plan = buildDevelopmentPlan(match, lang)
      expect(plan.map(step => step.title)).toEqual(lang === 'ar' ? ['راجع نقطة البداية', 'اختر تجربة تطبيقية واحدة', 'وثّق ما فعلته بنفسك', 'راجع الدليل مع مرشد'] : ['Review your starting point', 'Choose one applied exercise', 'Document your own contribution', 'Review the evidence with an advisor'])
      expect(JSON.stringify(plan)).not.toMatch(PERCENT)
    }
    expect(planStatus(SAMPLE, 'en'), 'the example is synthetic').toBe('Profile includes synthetic data · demo only')
    expect(planStatus(PROFILES['fcit-is-3p'], 'en')).toBe('Preliminary exploration · reference catalog')
    expect(planStatus({ courses: [{ source: 'demo' }] }, 'ar')).toBe('ملف يتضمن بيانات وهمية · تجربة فقط')
  })

  it('My plan asks for the plan in "Why these paths?"; step 4 does not; the words are the old interface\'s', () => {
    expect(read('src/ui2/screens/Plan.jsx')).toMatch(/<GoalPicker [^>]*withPlan\/>/)
    expect(read('src/ui2/screens/NextSteps.jsx')).not.toMatch(/withPlan/)
    const picker = read('src/ui2/components/GoalPicker.jsx')
    expect(picker).toMatch(/import \{ DevelopmentPlanPanel \} from '\.\.\/\.\.\/plan\/developmentPlan\.jsx'/)
    expect(picker).toMatch(/planState=\{withPlan \? state : null\}/)
    // Task 70: the old Matches row (MatchList.jsx) and "Show connections" tab (DecisionStudio.jsx) are deleted; their words,
    // read from those files at b443bad, stay word for word.
    expect([NEXT_COPY.ar.next.openPlan, NEXT_COPY.en.next.openPlan], 'a Matches row\'s link').toEqual(['افتح خطة هذا المسار', 'Open this pathway’s plan'])
    expect([NEXT_COPY.ar.next.planTitle, NEXT_COPY.en.next.planTitle], '"Show connections"\' tab').toEqual(['خطة التطوير', 'Development plan'])
    // My plan's page itself gets no new control (its budget of visible controls stays 33).
    const budget = JSON.parse(read('e2e/usability-budget.json')).newInterface.choices
    expect(budget.plan).toBe(33)
  })
})

describe('Task 74 · K37: review or contest a next step in its Details sheet', () => {
  it('the old RecommendationReview.jsx, unchanged, reviews a next step as a course and saves it with the profile hook', () => {
    const next = read('src/ui2/screens/NextSteps.jsx')
    expect(next).toMatch(/^import RecommendationReview from '\.\.\/\.\.\/components\/RecommendationReview\.jsx'$/m)
    expect(next).toMatch(/<RecommendationReview key=\{opened\.itemId\} item=\{openedItem\} kind="course" state=\{state\} lang=\{lang\} onSave=\{actions\.saveRecommendationReview\}\/>/)
    expect(read('src/state/useKaminProfile.js')).toMatch(/saveRecommendationReview, clearRecommendationReviews,/)
    // "See my review history" closes the sheet and opens Settings → Usage log.
    expect(next).toMatch(/onClick=\{\(\) => \{ setDetails\(null\); onReviewHistory\(\) \}\}>\{w\.reviewHistory\}/)
    expect(read('src/ui2/AppNext.jsx')).toMatch(/onReviewHistory=\{\(\) => openSettings\('log'\)\}/)
  })

  it('a next step\'s review names the item and its prerequisites, and is a review reference, never evidence', async () => {
    const { describeRecommendation } = await import('../src/review/recommendations.js')
    const first = firstCard()
    const item = engine.catalogItem(first.itemId)
    const descriptor = describeRecommendation(item, 'course', SAMPLE)
    expect(descriptor.key).toBe(`course:${item.id}`)
    expect(descriptor.title).toEqual({ ar: item.title.ar, en: item.title.en })
    expect(descriptor.requirements.map(r => r.id)).toEqual([...new Set(item.requires || [])].sort())
    expect(Object.keys(descriptor)).not.toContain('evidenceLevel')
  })

  it('the new words: the same keys in both languages, no percentage', () => {
    expect(Object.keys(NEXT_COPY.ar.next)).toEqual(Object.keys(NEXT_COPY.en.next))
    for (const lang of LANGS) for (const key of ['openPlan', 'planTitle', 'reviewHistory']) expect(NEXT_COPY[lang].next[key]).toBeTruthy()
  })
})

// ---------- Task 79 · a roadmap and certifications per pathway; step 4 never says "No gap" when the list is empty ----------
// (Added to this file, not a new one, so the tests page's file count stays the same.)
describe('Task 79 · roadmaps', () => {
  const ROADMAPS = JSON.parse(read('src/catalog/roadmaps.json'))
  const NOTE = 'written by Claude, approved by team and supervisor (stated by Amjd 2026-11-18)'
  const RESOURCES = new Map(ROADMAPS.resources.map(r => [r.id, r]))
  const CERTS = new Map(ROADMAPS.certifications.map(c => [c.id, c]))
  const SKILL_IDS = new Set(Object.keys(skillCatalog))
  const ARABIC = /[؀-ۿ]/
  const bilingual = (value, where) => {
    for (const lang of LANGS) expect(String(value?.[lang] || '').trim(), `${where} ${lang}`).not.toBe('')
    expect(value.ar, `${where} ar is Arabic`).toMatch(ARABIC)
  }
  let roadmap, loaded
  beforeAll(async () => {
    roadmap = await import('../src/roadmap/roadmap.js')
    loaded = await loadRoadmaps()
    await loadStepsEngine()
  })

  describe('the data (src/catalog/roadmaps.json)', () => {
    it('one roadmap for every pathway the app has, and none for anything else', () => {
      expect(ROADMAPS.version).toBe('kamin-roadmaps-v1')
      expect(ROADMAPS.roadmaps.map(r => r.pathwayId).sort()).toEqual(targetProfiles.map(t => t.id).sort())
    })
    it('stages: ordered 1..n, 3 to 6 of them, each with what to learn and why in both languages, known capabilities and 2-4 distinct free resources', () => {
      for (const r of ROADMAPS.roadmaps) {
        expect(r.stages.length, r.pathwayId).toBeGreaterThanOrEqual(3)
        expect(r.stages.length, r.pathwayId).toBeLessThanOrEqual(6)
        expect(r.stages.map(s => s.order), r.pathwayId).toEqual(r.stages.map((_, i) => i + 1))
        expect(new Set(r.stages.map(s => s.id)).size, r.pathwayId).toBe(r.stages.length)
        for (const s of r.stages) {
          const where = `${r.pathwayId}/${s.id}`
          expect(s.id, where).toMatch(/^[\w-]{1,32}$/)
          for (const field of ['title', 'learn', 'why']) bilingual(s[field], `${where} ${field}`)
          for (const cap of s.capabilities) expect(SKILL_IDS.has(cap), `${where} capability ${cap}`).toBe(true)
          expect(s.resources.length, where).toBeGreaterThanOrEqual(2)
          expect(s.resources.length, where).toBeLessThanOrEqual(4)
          expect(new Set(s.resources).size, where).toBe(s.resources.length)
          for (const id of s.resources) expect(RESOURCES.has(id), `${where} resource ${id}`).toBe(true)
        }
        // Every roadmap builds at least one capability.
        expect(r.stages.flatMap(s => s.capabilities).length, r.pathwayId).toBeGreaterThan(0)
      }
    })
    it('certifications: the most important ones per pathway, each known, with why, take it / optional / later, and when', () => {
      for (const r of ROADMAPS.roadmaps) {
        expect(r.certifications.length, r.pathwayId).toBeGreaterThan(0)
        expect(new Set(r.certifications.map(c => c.id)).size, r.pathwayId).toBe(r.certifications.length)
        for (const c of r.certifications) {
          expect(CERTS.has(c.id), `${r.pathwayId} ${c.id}`).toBe(true)
          expect(roadmap.RECOMMENDATIONS, `${r.pathwayId} ${c.id}`).toContain(c.recommendation)
          bilingual(c.why, `${r.pathwayId}/${c.id} why`)
          bilingual(c.when, `${r.pathwayId}/${c.id} when`)
        }
      }
      for (const c of ROADMAPS.certifications) {
        expect(c.issuer.trim(), c.id).not.toBe('')
        bilingual(c.name, `${c.id} name`)
      }
    })
    it('every entry has source, language, "proposed" and the note; resources are free, https, of a known kind; YouTube only as channels or playlists', () => {
      const kinds = Object.keys(NEXT_COPY.en.roadmap.kind)
      for (const entry of [...ROADMAPS.resources, ...ROADMAPS.certifications, ...ROADMAPS.roadmaps]) {
        const id = entry.id || entry.pathwayId
        expect(entry.status, id).toBe('proposed')
        expect(entry.note, id).toBe(NOTE)
        expect(String(entry.source || '').trim(), id).not.toBe('')
        for (const lang of [entry.language].flat()) expect(LANGS, id).toContain(lang)
      }
      for (const r of ROADMAPS.resources) {
        expect(r.free, r.id).toBe(true)
        expect(kinds, r.id).toContain(r.kind)
        bilingual(r.title, `${r.id} title`)
        if (/youtube\.com/.test(r.url)) { expect(r.kind, r.id).toMatch(/^youtube-(channel|playlist)$/); expect(r.url, r.id).not.toMatch(/watch\?v=(?!.*list=)/) }
      }
      for (const entry of [...ROADMAPS.resources, ...ROADMAPS.certifications]) expect(entry.url, entry.id).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/)
      expect(ROADMAPS.status).toBe('proposed')
      expect(ROADMAPS.note).toBe(NOTE)
    })
    it('every resource and certification is used by a roadmap; no price anywhere', () => {
      const usedResources = new Set(ROADMAPS.roadmaps.flatMap(r => r.stages.flatMap(s => s.resources)))
      const usedCerts = new Set(ROADMAPS.roadmaps.flatMap(r => r.certifications.map(c => c.id)))
      expect([...RESOURCES.keys()].filter(id => !usedResources.has(id))).toEqual([])
      expect([...CERTS.keys()].filter(id => !usedCerts.has(id))).toEqual([])
      const text = JSON.stringify({ ...ROADMAPS, rules: '' }).replace(/https:\/\/[^"]+/g, '')
      // («رسوم» is left out: it also means "charts", which the data analyst stages use.)
      expect(text).not.toMatch(/[$€£]|\b(USD|SAR|EUR|price|prices|cost|fee|fees)\b|ريال|دولار|سعر|أسعار|تكلفة/i)
      for (const lang of LANGS) expect(JSON.stringify(NEXT_COPY[lang].roadmap)).not.toMatch(/[$€£]|\bUSD\b|\bSAR\b|ريال|دولار/)
    })
    it('the links were checked from a laptop with scripts/check-roadmap-links.mjs: none dead', () => {
      expect(ROADMAPS.linksChecked.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(ROADMAPS.linksChecked.dead).toBe(0)
      expect(ROADMAPS.linksChecked.total).toBe(new Set([...ROADMAPS.resources, ...ROADMAPS.certifications].map(e => e.url)).size)
    })
  })

  describe('ticks: saved with the plan, untickable, removed with the consent and by Delete everything, never evidence', () => {
    const KEY = 'job-data-analyst:basics:khan-stats'
    it('an old profile without the field loads with no ticks; malformed keys are dropped; at most 300', () => {
      expect(normalizePlan({}).roadmapDone).toEqual([])
      expect(normalizeState({ courses: [], goal: 'job-data-analyst' }).roadmapDone).toEqual([])
      expect(normalizePlan({ roadmapDone: [KEY, KEY, 'nope', 42, 'a:b', 'x:y:z<script>'] }).roadmapDone).toEqual([KEY])
      expect(normalizePlan({ roadmapDone: Array.from({ length: 400 }, (_, i) => `p:s:r${i}`) }).roadmapDone).toHaveLength(300)
      expect(blankState.roadmapDone).toEqual([])
      expect(hasMeaningfulProfileState({ roadmapDone: [KEY] })).toBe(true)
    })
    it('tick and untick are pure; ticking twice keeps one; the progress is a count', () => {
      const ticked = roadmap.tickRoadmapItem(SAMPLE, KEY, true)
      expect(ticked.roadmapDone).toEqual([KEY])
      expect(roadmap.tickRoadmapItem(ticked, KEY, true).roadmapDone).toEqual([KEY])
      expect(roadmap.isTicked(ticked, KEY)).toBe(true)
      expect(roadmap.tickRoadmapItem(ticked, KEY, false).roadmapDone).toEqual([])
      expect(SAMPLE.roadmapDone).toBeUndefined()
      const r = roadmap.roadmapFor(loaded, 'job-data-analyst')
      const progress = roadmap.roadmapProgress(r, ticked)
      expect(progress.done).toBe(1)
      expect(progress.total).toBe(r.stages.reduce((n, s) => n + s.items.length, 0))
      expect(progress.stages.basics).toEqual({ done: 1, total: r.stages[0].items.length })
      expect(roadmap.roadmapFor(loaded, 'no-such-pathway')).toBeNull()
    })
    it('a backup keeps the ticks; an older backup without them restores with none', () => {
      const state = { ...roadmap.tickRoadmapItem(SAMPLE, KEY, true), consents: { analyze: true, insight: true } }
      const restored = normalizePortableState(JSON.parse(JSON.stringify(buildPortableProfile({ state }))))
      expect(restored.roadmapDone).toEqual([KEY])
      const old = buildPortableProfile({ state })
      delete old.state.roadmapDone
      expect(normalizePortableState(old).roadmapDone).toEqual([])
    })
    it('withdrawing the interests consent removes every tick and says so; Delete everything lists them and leaves none', () => {
      for (const lang of LANGS) {
        const state = roadmap.tickRoadmapItem(roadmap.tickRoadmapItem({ ...SAMPLE, consents: { analyze: true, insight: true } }, KEY, true), 'job-data-analyst:core:cs50sql', true)
        const result = withdrawConsent(state, 'insight', { lang })
        expect(result.state.roadmapDone).toEqual([])
        expect(result.summary.sentences[lang].join(' ')).toMatch(lang === 'ar' ? /أُزيلت 2 علامة إنجاز من خرائط الطريق/ : /2 roadmap tick\(s\) were removed/)
        const preview = deleteEverythingPreview(state, lang)
        expect(preview.items).toContainEqual({ label: lang === 'ar' ? 'علامات إنجاز في خرائط الطريق' : 'ticked roadmap items', count: 2 })
      }
      // "Delete everything" resets the profile to the blank state (src/state/useKaminProfile.js).
      expect(read('src/state/useKaminProfile.js')).toContain('setState(normalizeState(blankState))')
      expect(normalizeState(blankState).roadmapDone).toEqual([])
    })
    it('never evidence: ticking every item of every roadmap changes no capability, level, graph claim or match', () => {
      let all = SAMPLE
      for (const r of ROADMAPS.roadmaps) for (const s of r.stages) for (const id of s.resources) all = { ...all, roadmapDone: [...(all.roadmapDone || []), roadmap.itemKey(r.pathwayId, s.id, id)] }
      const ticked = normalizeState(all), plain = normalizeState(SAMPLE)
      expect(ticked.roadmapDone.length).toBeGreaterThan(200)
      expect(profileSkills(ticked)).toEqual(profileSkills(plain))
      // The whole person graph without its clock times (updatedAt and an approval's generatedAtTime are "now" at each
      // call, so even the same state gives different values there).
      const graph = state => JSON.stringify(projectStateToPerson360({ state, skills: profileSkills(state) }), (key, value) => (key === 'updatedAt' || key === 'generatedAtTime' ? undefined : value))
      expect(graph(plain)).toContain('"claims"')
      expect(graph(ticked)).toEqual(graph(plain))
      expect(derivedFor(ticked).matches).toEqual(derivedFor(plain).matches)
      // Only the plan, the roadmap, the data controls, the stored-counts card and the saved-state shape read the ticks.
      const readers = sourceFiles('src').map(f => f.split(path.sep).join('/')).filter(f => /\.(jsx?|mjs)$/.test(f) && /roadmapDone/.test(read(f))).sort()
      expect(readers).toEqual(['src/components/privacy/StatusSummary.jsx', 'src/plan/plan.js', 'src/roadmap/roadmap.js', 'src/state/profileState.js', 'src/ui2/components/Roadmap.jsx', 'src/utils/dataControl.js'])
    })
  })

  describe('the screens', () => {
    const roadmapHtml = (lang, state = SAMPLE, pathwayId = 'job-data-analyst') => renderToStaticMarkup(createElement(Roadmap, { lang, data: loaded, pathwayId, state, onTick: noop, level: 3 }))
    for (const lang of LANGS) it(`${lang}: a roadmap shows its stages in order, capabilities by name, free links in a new tab, ticks, the certifications and the never-evidence line`, () => {
      const r = NEXT_COPY[lang].roadmap
      const state = roadmap.tickRoadmapItem(SAMPLE, 'job-data-analyst:core:cs50sql', true)
      const html = roadmapHtml(lang, state)
      const text = textOf(html)
      const data = ROADMAPS.roadmaps.find(x => x.pathwayId === 'job-data-analyst')
      const items = data.stages.reduce((n, s) => n + s.resources.length, 0)
      const stages = [...html.matchAll(/data-stage="([^"]+)"/g)].map(m => m[1])
      expect(stages).toEqual(data.stages.map(s => s.id))
      for (const s of data.stages) { expect(text).toContain(`${fillIn(r.stage, { n: s.order })} · ${s.title[lang]}`); expect(text).toContain(s.learn[lang]); expect(text).toContain(s.why[lang]) }
      expect(text).toContain(capabilityName('database', lang))
      const links = [...html.matchAll(/<a [^>]*>/g)].map(m => m[0])
      expect(links.length).toBe(items + data.certifications.length)
      for (const a of links) { expect(a).toContain('target="_blank"'); expect(a).toContain('rel="noopener noreferrer"') }
      expect(html).toContain('data-key="job-data-analyst:core:cs50sql" data-done="true"')
      expect((html.match(/type="checkbox"/g) || []).length).toBe(items)
      expect((html.match(/checked=""/g) || []).length).toBe(1)
      expect(text).toContain(fillIn(r.progress, { done: 1, total: items }))
      for (const c of data.certifications) { expect(html).toContain(`data-cert="${c.id}" data-recommendation="${c.recommendation}"`); expect(text).toContain(c.when[lang]); expect(text).toContain(CERTS.get(c.id).issuer) }
      for (const words of [r.certsTitle, r.noPrices, r.neverEvidence, r.offline, fillIn(r.provenance, { date: ROADMAPS.linksChecked.date })]) expect(text).toContain(words)
      expect(text).not.toMatch(PERCENT)
    })
    for (const lang of LANGS) it(`${lang}: step 4 never says "No gap" when the list has nothing yet: it names the gap and offers the roadmap`, () => {
      const w = NEXT_COPY[lang].next
      // The synthetic example's Business Analyst: a gap in requirements analysis, and nothing in the list closes it.
      const html = screen(NextSteps, lang, { ...SAMPLE, goals: ['job-business-analyst'] })
      const text = textOf(html)
      expect(html).toContain('data-reason="list-empty"')
      expect(text).toContain(fillIn(w.listEmpty, { capabilities: capabilityName('requirements', lang) }))
      expect(text).toContain(w.listEmptyHint)
      expect(text).not.toContain(w.noGap)
      expect(html).not.toContain('data-testid="ui2-feed-uncovered"')
      expect(text).toContain(fillIn(w.seeRoadmap, { path: goalName('job-business-analyst', lang) }))
    })
    for (const lang of LANGS) it(`${lang}: pathways only from the student's own words: one-tap "Make it my goal" chips; every suggestion handled says so`, () => {
      const w = NEXT_COPY[lang].next
      const words = { ...emptyInsightState(), freeInterests: [{ id: 'fi-1', text: 'made up', lang: 'en', createdAt: '2026-11-19T09:00:00.000Z', method: FREE_INTEREST_METHOD, understood: [{ kind: 'pathway', id: 'job-business-analyst', removed: false }] }] }
      const html = screen(NextSteps, lang, { ...SAMPLE, insight: words, consents: { analyze: true, insight: true } })
      expect(html).toContain('data-testid="ui2-feed-words"')
      expect(textOf(html)).toContain(fillIn(w.makeGoal, { path: goalName('job-business-analyst', lang) }))
      expect(textOf(html)).not.toContain(w.noGap)
      // Every suggestion for Junior Cybersecurity Analyst (the list covers its whole gap) already in My plan: "handled", not "No gap".
      const handled = screen(NextSteps, lang, { ...SAMPLE, goals: ['job-cyber-analyst'], plan: [{ itemId: 'fcit-cpit-425', action: 'take-course', addedAt: '2026-11-19T09:00:00.000Z', status: 'planned' }] })
      expect(handled).toContain('data-reason="handled"')
      expect(textOf(handled)).toContain(w.handled)
      expect(textOf(handled)).not.toContain(w.noGap)
      // Data Analyst with its one step saved: the list still has nothing for quantitative analysis, so that is said first,
      // and the handled line follows.
      const both = textOf(screen(NextSteps, lang, { ...SAMPLE, goals: ['job-data-analyst'], plan: [{ itemId: 'fcit-cpit-340', action: 'take-course', addedAt: '2026-11-19T09:00:00.000Z', status: 'planned' }] }))
      expect(both).toContain(fillIn(w.listEmpty, { capabilities: capabilityName('statistics', lang) }))
      expect(both).toContain(w.handledHint)
      expect(both).not.toContain(w.noGap)
      // A "Make it my goal" chip makes that pathway a goal (the same toggle as the goal chips).
      expect(toggleGoal(normalizePlan(SAMPLE), 'job-business-analyst').goals).toEqual(['job-business-analyst'])
    })
    for (const lang of LANGS) it(`${lang}: My plan: "Roadmaps for my goals" with one button per pathway goal, nothing without a goal`, () => {
      const r = NEXT_COPY[lang].roadmap
      const html = screen(Plan, lang, { ...SAMPLE, goals: ['job-data-analyst', 'job-cyber-analyst'] })
      expect(textOf(html)).toContain(r.planTitle)
      for (const goal of ['job-data-analyst', 'job-cyber-analyst']) expect(textOf(html)).toContain(fillIn(r.show, { path: goalName(goal, lang) }))
      expect((html.match(/data-testid="ui2-plan-roadmap"/g) || []).length).toBe(2)
      expect(screen(Plan, lang, SAMPLE)).not.toContain('ui2-plan-roadmaps')
    })
    it('the words: the same keys in both languages; kinds cover every resource', () => {
      expect(Object.keys(NEXT_COPY.ar.roadmap)).toEqual(Object.keys(NEXT_COPY.en.roadmap))
      expect(Object.keys(NEXT_COPY.ar.roadmap.kind)).toEqual(Object.keys(NEXT_COPY.en.roadmap.kind))
    })
  })

  describe('lazy loading, the K08 plan and My map', () => {
    it('the roadmap data loads only on demand; no startup module imports the roadmap', () => {
      const files = sourceFiles('src').map(f => f.split(path.sep).join('/')).filter(f => /\.(jsx?|mjs)$/.test(f))
      expect(files.filter(f => /^import[^\n]*roadmaps\.json/m.test(read(f)))).toEqual([])
      expect(read('src/ui2/useRoadmaps.js')).toContain("import('../catalog/roadmaps.json')")
      for (const file of ['src/main.jsx', 'src/plan/plan.js', 'src/state/profileState.js', 'src/state/useKaminProfile.js', 'src/ui2/AppNext.jsx']) expect(read(file).replace(/^\s*\/\/.*$/gm, ''), file).not.toMatch(/roadmap\/roadmap|Roadmap\.jsx|useRoadmaps|roadmaps\.json/)
    })
    it('K08 is kept as it was: the development plan still opens from "Why these paths?" in My plan', () => {
      expect(read('src/ui2/components/GoalPicker.jsx')).toContain('<DevelopmentPlanPanel lang={lang} match={item} state={planState}/>')
      expect(read('src/ui2/screens/Plan.jsx')).toMatch(/<GoalPicker [^>]*withPlan\/>/)
    })
    it('My map: "Academic evidence path to the opportunity" names a pathway goal by its title, an old direction by its label', () => {
      expect(goalLabelOf('job-data-analyst', 'en')).toBe('Data Analyst')
      expect(goalLabelOf('job-data-analyst', 'ar')).toBe('محلل بيانات')
      expect(goalLabelOf('data', 'en')).toBe(copy.en.app.goals.data)
      expect(goalLabelOf(null, 'en')).toBeUndefined()
      expect(goalLabelOf('no-such-goal', 'en')).toBeUndefined()
      expect(read('src/components/ShowConnections.jsx')).toContain('goalLabel={goalLabelOf(state.goal, lang)}')
    })
    it('the link checker is a developer tool: it sorts answers into ok / blocked / dead and lists each link once', async () => {
      const { classify, roadmapLinks } = await import('../scripts/check-roadmap-links.mjs')
      expect([200, 204, 403, 429, 404, 410, 500].map(classify)).toEqual(['ok', 'ok', 'blocked', 'blocked', 'dead', 'dead', 'dead'])
      const links = roadmapLinks(ROADMAPS)
      expect(new Set(links.map(l => l.url)).size).toBe(links.length)
      expect(read('package.json')).not.toContain('check-roadmap-links')
      for (const file of readdirSync('.github/workflows')) expect(read(`.github/workflows/${file}`), file).not.toContain('check-roadmap-links')
    })
  })
})
