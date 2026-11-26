// Task 64 · step 3 of the new interface (src/ui2/screens/Interests.jsx): the interests consent is the approved
// sentence, byte for byte (both interfaces are rendered here), nothing is saved before it, the chips keep today's
// options and ids, interests in the student's own words use Task 56's functions (add, understand, remove a chip,
// edit, delete with Undo), withdrawing the consent removes them, no interest changes a capability or its level,
// and step 3 loads on its own (the engine only on Add).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Interests from '../src/ui2/screens/Interests.jsx'
import FreeInterestCard, { chipName } from '../src/ui2/components/FreeInterestCard.jsx'
// Task 70: the old interests screen (src/components/StudentInsight.jsx) is deleted.
import { appendFreeInterest, chosenOf, grantInterests, hasInterests, questionFull, replaceFreeInterest, restoreFreeInterest, tapPreference, toggleFreeChip } from '../src/ui2/interestsState.js'
import { addFreeInterest, freeInterestGoalPathways, setChipRemoved, understandInterest } from '../src/interests/freeText.js'
import { DECLARED_PREFERENCE_SCHEMES, emptyInsightState, normalizeDeclaredPreferences, preferenceCount } from '../src/insight.js'
import { normalizeState } from '../src/state/profileState.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { EVIDENCE_PREDICATES } from '../src/person360.js'
import { withdrawConsent } from '../src/utils/dataControl.js'
import { NEXT_COPY } from '../src/ui2/copy.js'
import { VIEW_TEXT } from '../src/ui2/views.js'
import { profileSkills } from '../src/utils/engine.js'
import { demoCourses } from '../src/data.js'
import { copy } from '../src/i18n.js'

const LANGS = ['ar', 'en']
const read = file => readFileSync(file, 'utf8')
const sourceFiles = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? sourceFiles(p) : [p] })
const textOf = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
const noop = () => {}
const tr = (lang, ar, en) => (lang === 'ar' ? ar : en)
// Made-up interests (no person). Both give pathway and topic chips with the local engine and vocabulary.
const SENTENCE = lang => tr(lang, 'أحب تصميم تطبيقات تساعد المرضى', 'I like designing apps that help patients')
const DATA = lang => tr(lang, 'أبغى أحلل بيانات وأسوي لوحات', 'I want to analyse data and build dashboards')
// The approved synthetic example (FCIT), as the keep-tests use it.
const SAMPLE = { approved: true, courses: demoCourses.map(row => ({ ...row })), college: 'FCIT', projects: [], tasks: [], credentials: [], insight: emptyInsightState(), consents: { analyze: true }, audit: [] }
const consented = state => grantInterests(state, 'granted')
const levels = state => JSON.parse(JSON.stringify(profileSkills(state)))
const page = (lang, state) => renderToStaticMarkup(createElement(Interests, { lang, profile: { state, actions: { setState: noop, log: noop, deleteOne: noop } }, focusHeading: false, onNavigate: noop, notify: noop }))
const withoutTime = state => ({ ...state, insight: { ...state.insight, updatedAt: null } })

describe('Task 64 · the interests consent: the approved sentence, shown once, nothing saved before it', () => {
  for (const lang of LANGS) it(`${lang}: step 3 shows the consent from src/i18n.js word for word, as the old screen does`, () => {
    const consent = copy[lang].screens.insight.consent
    const now = page(lang, SAMPLE)
    // Task 70: the old interests screen (StudentInsight.jsx), which showed the same sentence, is deleted.
    expect(consent.length).toBeGreaterThan(40)
    // The checkbox's label is exactly the sentence, and the box is not ticked.
    const label = now.match(/<label[^>]*ui2-interests-consent[^>]*>[\s\S]*?<\/label>/)[0]
    expect(textOf(label)).toBe(consent)
    expect(label).toMatch(/type="checkbox"/)
    expect(label).not.toMatch(/checked=""/)
    // Once given, the checkbox is gone and a short line says so.
    const after = page(lang, consented(SAMPLE))
    expect(after).not.toContain('type="checkbox"')
    expect(textOf(after)).not.toContain(consent)
    expect(textOf(after)).toContain(NEXT_COPY[lang].interests.consentGiven)
  })

  it('src/ui2 never copies the consent: it reads screens.insight.consent', () => {
    for (const file of sourceFiles('src/ui2')) for (const lang of LANGS) expect(read(file), `${file} holds a copy`).not.toContain(copy[lang].screens.insight.consent)
    expect(read('src/ui2/screens/Interests.jsx')).toMatch(/\{S\.consent\}/)
  })

  for (const lang of LANGS) it(`${lang}: without consent every chip and the text box are disabled, with the reason; nothing can be saved`, () => {
    const w = NEXT_COPY[lang].interests
    const html = page(lang, SAMPLE)
    const chips = html.match(/<button[^>]*data-option="[^"]+"[^>]*>/g)
    expect(chips).toHaveLength(12)
    for (const chip of chips) expect(chip).toMatch(/disabled=""/)
    expect(html).toMatch(/<textarea[^>]*disabled=""/)
    expect(textOf(html)).toContain(w.needConsent)
    expect(tapPreference(SAMPLE, 'careerInterest', 'investigative')).toBe(SAMPLE)
    expect(appendFreeInterest(SAMPLE, { id: 'free-x', text: 'made up', understood: [], method: 'kamin-free-interest-v1', createdAt: new Date().toISOString() })).toBe(SAMPLE)
    expect(() => addFreeInterest(SAMPLE, SENTENCE(lang), { lang })).toThrow()
    // Skip for now is there; there is no Next yet.
    expect(textOf(html)).toContain(w.skip)
    expect(html).not.toMatch(/ui2-btn-primary/)
  })

  it('ticking the consent grants it as the old screen does: the flag, an insight record and one usage-log line', () => {
    const label = copy.en.screens.insight.consentGranted
    const next = grantInterests(SAMPLE, label)
    expect(next.consents).toEqual({ analyze: true, insight: true })
    expect(next.audit[0].label).toBe(label)
    expect(next.insight.freeInterests).toEqual([])
    expect(next.courses).toBe(SAMPLE.courses)
    expect(grantInterests(next, label), 'granted once').toBe(next)
  })
})

describe('Task 64 · the chips: today\'s options and ids, tap to choose, tap again to remove', () => {
  for (const lang of LANGS) it(`${lang}: the six interest areas and the six work values, with the old screen's labels and ids`, () => {
    const html = page(lang, consented(SAMPLE))
    for (const scheme of ['careerInterest', 'workValue']) for (const option of DECLARED_PREFERENCE_SCHEMES[scheme].options) {
      expect(html).toContain(`data-option="${option.id}"`)
      expect(textOf(html)).toContain(option.label[lang])
    }
    expect(html.match(/<button[^>]*data-option="[^"]+"[^>]*>/g).filter(chip => /disabled=""/.test(chip))).toHaveLength(0)
    const w = NEXT_COPY[lang].interests
    expect(textOf(html)).toContain(w.areas)
    expect(textOf(html)).toContain(w.values)
    expect(textOf(html)).toContain(VIEW_TEXT.interests.title[lang])
  })

  // Task 78 (Amjd, 2026-11-21): up to 3 choices per question, stored as lists. This replaces Task 64's check that a
  // tap replaced the other choice of the question ("one choice per question"), which the decision changes.
  it('Task 78: up to 3 choices per question, stored as lists in the order chosen; a second tap removes one; a 4th does nothing', () => {
    const start = consented(SAMPLE)
    const one = tapPreference(start, 'careerInterest', 'investigative')
    expect(one.insight.declaredPreferences).toEqual({ careerInterest: ['investigative'] })
    const three = ['artistic', 'social'].reduce((s, id) => tapPreference(s, 'careerInterest', id), one)
    expect(three.insight.declaredPreferences.careerInterest).toEqual(['investigative', 'artistic', 'social'])
    expect(questionFull(three, 'careerInterest')).toBe(true)
    expect(questionFull(three, 'workValue')).toBe(false)
    expect(tapPreference(three, 'careerInterest', 'realistic'), 'a 4th choice changes nothing').toBe(three)
    const both = ['achievement', 'support', 'independence'].reduce((s, id) => tapPreference(s, 'workValue', id), three)
    expect(both.insight.declaredPreferences).toEqual({ careerInterest: ['investigative', 'artistic', 'social'], workValue: ['achievement', 'support', 'independence'] })
    expect(tapPreference(both, 'careerInterest', 'artistic').insight.declaredPreferences.careerInterest, 'tap again removes it').toEqual(['investigative', 'social'])
    const none = ['investigative', 'artistic', 'social'].reduce((s, id) => tapPreference(s, 'careerInterest', id), both)
    expect(none.insight.declaredPreferences, 'an empty question is not stored').toEqual({ workValue: ['achievement', 'support', 'independence'] })
    expect(() => tapPreference(start, 'careerInterest', 'not-an-option')).toThrow('UNKNOWN_PREFERENCE_OPTION')
    expect(tapPreference(SAMPLE, 'careerInterest', 'investigative'), 'nothing is saved without the consent').toBe(SAMPLE)
    expect(hasInterests(start)).toBe(false)
    expect(hasInterests(one)).toBe(true)
  })

  it('Task 78: a profile saved with one value per question loads as a one-item list; a tap adds to it', () => {
    const saved = { insight: { declaredPreferences: { careerInterest: 'investigative', workValue: 'achievement', workStructure: 'balanced' } } }
    expect(normalizeState(saved).insight.declaredPreferences).toEqual({ careerInterest: ['investigative'], workValue: ['achievement'], workStructure: 'balanced' })
    const old = { ...consented(SAMPLE), insight: { ...emptyInsightState(), ...saved.insight } }
    expect(chosenOf(old, 'careerInterest')).toEqual(['investigative'])
    expect(tapPreference(old, 'careerInterest', 'artistic').insight.declaredPreferences).toEqual({ careerInterest: ['investigative', 'artistic'], workValue: ['achievement'], workStructure: 'balanced' })
    // Repeats, unknown ids and a 4th value are dropped; an empty list and a non-string are not stored.
    expect(normalizeDeclaredPreferences({ careerInterest: ['social', 'social', 'nope', 'artistic', 'realistic', 'enterprising'], workValue: [], pace: 7 })).toEqual({ careerInterest: ['social', 'artistic', 'realistic'] })
    expect(normalizeDeclaredPreferences(null)).toEqual({})
    expect(preferenceCount({ careerInterest: ['social', 'artistic'], workValue: 'achievement' })).toBe(3)
  })

  for (const lang of LANGS) it(`${lang} · Task 78: the hint says "choose up to 3"; with 3 chosen it says how to change; every chosen chip is pressed`, () => {
    const w = NEXT_COPY[lang].interests
    expect(w.pickUpTo).toMatch(lang === 'ar' ? /حتى 3/ : /up to 3/)
    expect(w).not.toHaveProperty('pickOne')
    expect(textOf(page(lang, consented(SAMPLE))).split(w.pickUpTo).length - 1, 'both questions').toBe(2)
    const full = ['investigative', 'artistic', 'social'].reduce((s, id) => tapPreference(s, 'careerInterest', id), consented(SAMPLE))
    const html = page(lang, tapPreference(full, 'workValue', 'support'))
    expect(textOf(html)).toContain(w.pickFull)
    expect(textOf(html).split(w.pickUpTo).length - 1, 'the other question still says up to 3').toBe(1)
    expect(html.match(/<button[^>]*aria-pressed="true"[^>]*data-option="[^"]+"|<button[^>]*data-option="[^"]+"[^>]*aria-pressed="true"/g)).toHaveLength(4)
    expect(html).toMatch(/aria-live="polite"[^>]*data-testid="ui2-interests-hint-careerInterest"|data-testid="ui2-interests-hint-careerInterest"[^>]*aria-live="polite"/)
  })

  for (const lang of LANGS) it(`${lang}: a choice makes "Next" the one main button; the chosen chips are pressed`, () => {
    const html = page(lang, tapPreference(tapPreference(consented(SAMPLE), 'careerInterest', 'investigative'), 'workValue', 'achievement'))
    expect(html.match(/ui2-btn-primary/g)).toHaveLength(1)
    expect(textOf(html.match(/<button[^>]*ui2-btn-primary[^>]*>[\s\S]*?<\/button>/)[0])).toBe(NEXT_COPY[lang].interests.next)
    expect(html.match(/<button[^>]*aria-pressed="true"[^>]*data-option="[^"]+"|<button[^>]*data-option="[^"]+"[^>]*aria-pressed="true"/g)).toHaveLength(2)
    expect(textOf(html)).not.toContain(NEXT_COPY[lang].interests.skip)
  })
})

describe('Task 64 · interests in the student\'s own words (Task 56\'s functions)', () => {
  for (const lang of LANGS) it(`${lang}: a made-up sentence becomes chips; removing one keeps the sentence; the card shows names, never ids`, () => {
    const start = consented(SAMPLE)
    const entry = addFreeInterest(start, SENTENCE(lang), { lang }).insight.freeInterests[0]
    expect(entry.understood.length).toBeGreaterThan(0)
    const state = appendFreeInterest(start, entry)
    expect(state.insight.freeInterests).toEqual([entry])
    expect(appendFreeInterest(state, entry), 'never twice').toBe(state)
    const chip = entry.understood[0]
    const off = toggleFreeChip(state, entry.id, chip.kind, chip.id)
    expect(withoutTime(off)).toEqual(withoutTime(setChipRemoved(state, entry.id, chip.kind, chip.id, true)))
    expect(off.insight.freeInterests[0].text, 'the original sentence is kept').toBe(SENTENCE(lang))
    expect(off.insight.freeInterests[0].understood.find(c => c.id === chip.id && c.kind === chip.kind).removed).toBe(true)
    expect(toggleFreeChip(off, entry.id, chip.kind, chip.id).insight.freeInterests[0].understood).toEqual(entry.understood)

    const card = renderToStaticMarkup(createElement(FreeInterestCard, { lang, entry: off.insight.freeInterests[0], onToggle: noop, onEdit: noop, onSave: noop, onCancel: noop, onDelete: noop }))
    expect(textOf(card)).toContain(SENTENCE(lang))
    for (const c of entry.understood) {
      expect(textOf(card)).toContain(chipName(c.kind, c.id, lang))
      // The chips' part of the card (the sentence itself may hold an everyday word such as "apps").
      expect(textOf(card).replace(SENTENCE(lang), ''), 'no technical id').not.toMatch(new RegExp(`\\b${c.id}\\b`))
    }
    expect(card).toContain('aria-pressed="false"')
    const w = NEXT_COPY[lang].interests
    const kinds = new Set(entry.understood.map(c => c.kind))
    if (kinds.has('pathway')) expect(textOf(card)).toContain(w.pathways)
    if (kinds.has('capability')) expect(textOf(card)).toContain(w.skills)
  })

  it('a removed pathway chip no longer guides suggestions; the sentence stays', () => {
    const start = consented(SAMPLE)
    const entry = addFreeInterest(start, DATA('en'), { lang: 'en' }).insight.freeInterests[0]
    const pathway = entry.understood.find(c => c.kind === 'pathway')
    expect(pathway, 'the sentence gives a pathway').toBeTruthy()
    const state = appendFreeInterest(start, entry)
    expect(freeInterestGoalPathways(state)).toContain(pathway.id)
    const off = toggleFreeChip(state, entry.id, 'pathway', pathway.id)
    expect(freeInterestGoalPathways(off)).not.toContain(pathway.id)
    expect(off.insight.freeInterests[0].text).toBe(DATA('en'))
  })

  it('editing a sentence keeps its place, id and date, re-reads it, and keeps a chip off that comes back', () => {
    const start = consented(SAMPLE)
    const a = addFreeInterest(start, SENTENCE('en'), { lang: 'en', id: 'free-a' }).insight.freeInterests[0]
    const b = addFreeInterest(start, DATA('en'), { lang: 'en', id: 'free-b' }).insight.freeInterests[0]
    let state = appendFreeInterest(appendFreeInterest(start, a), b)
    const topic = a.understood.find(c => c.kind === 'topic')
    state = toggleFreeChip(state, 'free-a', 'topic', topic.id)
    const text = 'I like designing apps that help patients and analysing their data'
    const next = replaceFreeInterest(state, 'free-a', text, understandInterest(text, 'en'))
    const edited = next.insight.freeInterests[0]
    expect(next.insight.freeInterests.map(e => e.id)).toEqual(['free-a', 'free-b'])
    expect(edited).toMatchObject({ id: 'free-a', text, createdAt: a.createdAt })
    expect(edited.understood.find(c => c.kind === 'topic' && c.id === topic.id)?.removed).toBe(true)
    expect(edited.understood.some(c => c.kind === 'topic' && c.id === 'data' && !c.removed)).toBe(true)
    expect(next.insight.freeInterests[1]).toEqual(b)
    expect(() => replaceFreeInterest(state, 'free-none', text, understandInterest(text, 'en'))).toThrow('ITEM_NOT_FOUND')
  })

  it('Undo puts a deleted sentence back where it was, never twice', () => {
    const start = consented(SAMPLE)
    const a = addFreeInterest(start, SENTENCE('en'), { lang: 'en', id: 'free-a' }).insight.freeInterests[0]
    const b = addFreeInterest(start, DATA('en'), { lang: 'en', id: 'free-b' }).insight.freeInterests[0]
    const afterDelete = appendFreeInterest(start, b)
    const back = restoreFreeInterest(afterDelete, a, 0)
    expect(back.insight.freeInterests.map(e => e.id)).toEqual(['free-a', 'free-b'])
    expect(restoreFreeInterest(afterDelete, a, 9).insight.freeInterests.map(e => e.id)).toEqual(['free-b', 'free-a'])
    expect(restoreFreeInterest(back, a, 0)).toBe(back)
  })

  it('withdrawing the interests consent removes the chips, the sentences and what was understood from them', () => {
    let state = consented(SAMPLE)
    state = tapPreference(tapPreference(state, 'careerInterest', 'investigative'), 'workValue', 'achievement')
    // Task 78: every chosen value goes (3 areas and 2 values here).
    state = tapPreference(tapPreference(tapPreference(state, 'careerInterest', 'artistic'), 'careerInterest', 'social'), 'workValue', 'support')
    for (const lang of LANGS) state = appendFreeInterest(state, addFreeInterest(state, SENTENCE(lang), { lang }).insight.freeInterests.at(-1))
    expect(state.insight.freeInterests).toHaveLength(2)
    const { state: after, summary } = withdrawConsent(state, 'insight', { lang: 'en' })
    expect(after.consents.insight).toBe(false)
    expect(after.insight.freeInterests).toEqual([])
    expect(after.insight.declaredPreferences).toEqual({})
    expect(freeInterestGoalPathways(after)).toEqual([])
    expect(summary.sentences.en.join(' ')).toContain('2 interest(s) in your own words were deleted')
    expect(after.audit[0].label).toMatch(/: 5 preference\(s\)/)
    expect(hasInterests(after)).toBe(false)
  })
})

describe('Task 64 · no interest changes any capability or its level', () => {
  it('the example\'s capabilities, compared whole, are identical with chips and sentences chosen', () => {
    const before = levels(SAMPLE)
    expect(before.length).toBeGreaterThan(0)
    let state = consented(SAMPLE)
    state = tapPreference(tapPreference(state, 'careerInterest', 'investigative'), 'workValue', 'achievement')
    // A sentence that names capabilities the example already has (databases, data analysis).
    for (const text of ['I like building databases and analysing data with statistics', SENTENCE('ar'), DATA('ar')]) state = appendFreeInterest(state, addFreeInterest(state, text, { lang: 'en' }).insight.freeInterests.at(-1))
    expect(state.insight.freeInterests.flatMap(e => e.understood).some(c => c.kind === 'capability'), 'a capability chip was understood').toBe(true)
    expect(levels(state)).toEqual(before)
  })

  it('Task 78: 3 areas and 3 values change no capability, no level and no evidence claim of the graph', () => {
    const graphOf = state => projectStateToPerson360({ state, skills: profileSkills(state) })
    const evidence = graph => JSON.parse(JSON.stringify(graph.claims.filter(c => EVIDENCE_PREDICATES.includes(c.predicate)).map(({ generatedAtTime, ...c }) => c)))
    let state = consented(SAMPLE)
    for (const id of ['investigative', 'realistic', 'conventional']) state = tapPreference(state, 'careerInterest', id)
    for (const id of ['achievement', 'independence', 'support']) state = tapPreference(state, 'workValue', id)
    expect(levels(state)).toEqual(levels(SAMPLE))
    expect(evidence(graphOf(state))).toEqual(evidence(graphOf(SAMPLE)))
    expect(evidence(graphOf(state)).length).toBeGreaterThan(0)
    const prefers = graphOf(state).claims.filter(c => c.predicate.startsWith('kamin:prefers:'))
    expect(prefers).toHaveLength(6)
    expect(prefers.every(c => c.evidenceStrength === 'self-reported' && c.sourceType === 'self-declared')).toBe(true)
  })
})

describe('Task 64 · step 3\'s words', () => {
  it('Arabic and English have the same keys, no percentage; the free-text line is the brief\'s sentence', () => {
    const keys = lang => Object.keys(NEXT_COPY[lang].interests).sort()
    expect(keys('ar')).toEqual(keys('en'))
    for (const lang of LANGS) expect(JSON.stringify(NEXT_COPY[lang].interests)).not.toMatch(/\d\s?[%٪]|[%٪]\s?\d/)
    expect(NEXT_COPY.en.interests.words).toBe('Your words guide your suggestions; they are never counted as evidence.')
    for (const lang of LANGS) expect(textOf(page(lang, consented(SAMPLE)))).toContain(NEXT_COPY[lang].interests.words)
  })
})

describe('Task 64 · step 3 loads on its own; the engine only when the student adds a sentence', () => {
  it('AppNext loads step 3 with lazy(import()); nothing else imports the screen, its card, its state or its CSS', () => {
    const app = read('src/ui2/AppNext.jsx')
    expect(app).toMatch(/const Interests = lazy\(\(\) => import\('\.\/screens\/Interests\.jsx'\)\)/)
    expect(app).not.toMatch(/^import .*Interests\.jsx/m)
    const importers = name => sourceFiles('src').filter(file => new RegExp(`from '[./]+(?:[\\w/]+/)?${name}'|import '[./]+(?:[\\w/]+/)?${name}'`).test(read(file))).map(file => file.split(path.sep).join('/'))
    expect(importers('interests\\.css')).toEqual(['src/ui2/screens/Interests.jsx'])
    expect(importers('interestsState\\.js')).toEqual(['src/ui2/screens/Interests.jsx'])
    expect(importers('FreeInterestCard\\.jsx')).toEqual(['src/ui2/screens/Interests.jsx'])
    expect(read('src/main.jsx')).not.toMatch(/Interests/)
  })

  it('the free-text engine is loaded with import() on Add, never imported by step 3 or its card', () => {
    const screen = read('src/ui2/screens/Interests.jsx')
    expect(screen).toMatch(/import\('\.\.\/\.\.\/interests\/freeText\.js'\)/)
    for (const file of ['src/ui2/screens/Interests.jsx', 'src/ui2/components/FreeInterestCard.jsx', 'src/ui2/interestsState.js']) {
      expect(read(file), file).not.toMatch(/from '[./]+interests\/freeText\.js'|projectSuggestImproved/)
    }
  })
})
