import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { copy, fill } from '../src/i18n.js'
import { PLAIN_TERMS, TECHNICAL_TERMS, plain, INTEREST_AREAS, SCREEN_JARGON, jargonIn } from '../src/content/plainTerms.js'
import { COURSE_EVIDENCE_PRINCIPLE } from '../src/content/trustCopy.js'
import { DECLARED_PREFERENCE_SCHEMES, emptyInsightState, setDeclaredPreference } from '../src/insight.js'
import { PSYCHOMETRIC_INSTRUMENTS } from '../src/psychometrics/registry.js'
import { buildRelationshipNetwork } from '../src/network/relationships.js'
import { demoCourses } from '../src/data.js'
import { inferSkills } from '../src/utils/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'

// Task 12 · student screens speak the student's language; technical terms only in "Technical details".
// Task 28 adds Interests & goal (insight), Show connections (studio) and Matches.
const SCREENS = ['start', 'review', 'dashboard', 'myData', 'insight', 'studio', 'matches']
const words = text => String(text).trim().split(/\s+/).filter(Boolean).length
// every string under a screen, with its key path; strings under a `technical` key are skipped
function strings(value, path = []) {
  if (typeof value === 'string') return [[path.join('.'), value]]
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([k, v]) => k === 'technical' ? [] : strings(v, [...path, k]))
}

describe('plain copy on the four student screens', () => {
  for (const lang of ['ar', 'en']) {
    it(`${lang}: no technical term outside "technical" keys`, () => {
      for (const screen of SCREENS) {
        for (const [key, text] of strings(copy[lang].screens[screen], [screen])) {
          for (const term of TECHNICAL_TERMS) expect(text, `${lang}.${key} contains "${term}"`).not.toContain(term)
        }
      }
    })

    it(`${lang}: titles have at most 6 words and intros one sentence of at most 20 words`, () => {
      for (const screen of SCREENS) {
        const s = copy[lang].screens[screen]
        for (const key of Object.keys(s).filter(k => /title$/i.test(k))) expect(words(s[key]), `${lang}.${screen}.${key}`).toBeLessThanOrEqual(6)
        for (const key of Object.keys(s).filter(k => /intro$/i.test(k))) {
          expect(words(s[key]), `${lang}.${screen}.${key}`).toBeLessThanOrEqual(20)
          expect(s[key].split(/[.!?؟](?:\s|$)/).filter(x => x.trim()).length, `${lang}.${screen}.${key} sentences`).toBeLessThanOrEqual(2)
        }
      }
    })

    it(`${lang}: every technical explanation exists in the other language too`, () => {
      const other = lang === 'ar' ? 'en' : 'ar'
      for (const screen of SCREENS) {
        const tech = copy[lang].screens[screen].technical || copy[lang].screens[screen].deleted?.technical
        if (tech && typeof tech === 'object') expect(Object.keys(tech).sort()).toEqual(Object.keys(copy[other].screens[screen].technical).sort())
      }
    })
  }

  it('the plain-terms dictionary covers the terms students used to see, in both languages', () => {
    for (const term of ['IndexedDB', 'CLR 2.0 export', 'governed mapping', 'explained judgment', 'JSON-LD', 'AES-GCM', 'OCR', 'SASCED']) {
      expect(PLAIN_TERMS[term]?.ar, term).toBeTruthy()
      expect(PLAIN_TERMS[term]?.en, term).toBeTruthy()
    }
    expect(plain('IndexedDB', 'en')).toBe('on this device')
    expect(plain('unknown-term', 'ar')).toBe('unknown-term')
  })

  it('fills placeholders', () => {
    expect(fill(copy.en.screens.dashboard.approvedSkills, { n: 5 })).toMatch(/^5 capability/)
    expect(fill('{n} of {total}', { n: 1 })).toBe('1 of {total}')
  })

  it('keeps the Task 03 wording and the consent sentence unchanged', () => {
    expect(COURSE_EVIDENCE_PRINCIPLE.ar).toBe('درجة المقرر قرينة على مخرج تعلم متوقع، وليست ضمانًا لإتقانه. يختلف مستوى الدليل حسب الدرجة ونوع التقييم.')
    expect(copy.ar.screens.review.consent).toBe('أوافق صراحةً على تحليل هذا السجل لبناء ملف مهاراتي بعد مراجعتي له.')
    expect(copy.en.screens.review.consent).toBe('I explicitly consent to analyzing this record to build my skills profile after reviewing it.')
  })

  // Task 70: src/App.jsx is deleted; the strings must not come back anywhere in the app's code.
  it('the app no longer holds the moved review-screen strings', () => {
    const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : /\.(jsx?)$/.test(e.name) ? [`${dir}/${e.name}`] : [])
    const app = files('src').map(f => readFileSync(f, 'utf8')).join('\n')
    for (const gone of ['courses currently have governed capability mappings', 'Current governed skill mapping', 'Unsigned CLR 2.0-shaped portable export created', 'Technology extracts; you approve']) expect(app).not.toContain(gone)
  })
})

// Task 28 · Interests & goal, Show connections, Matches and Courses in plain words.
describe('plain copy on the remaining screens (Task 28)', () => {
  const synthetic = (interest = 'investigative') => {
    const state = { approved: true, courses: demoCourses, goal: 'data', consents: { insight: true }, insight: { declaredPreferences: { careerInterest: interest } } }
    const graph = projectStateToPerson360({ state, skills: inferSkills(state.courses) })
    return { state, graph }
  }

  it('finds the Task 28 words, and only them', () => {
    for (const text of ['my Person 360 profile', '360°', 'R1 · kamin-relations-v2', 'Inspect RDF / JSON-LD', 'What did Kamin infer?', 'TRACEABLE SEMANTIC INFERENCE', 'Realistic / hands-on', 'Conventional / structured', 'Multi-dimensional matching', 'استدلال دلالي', 'R3 · x'])
      expect(jargonIn(text), text).not.toEqual([])
    for (const text of ['Your interests and goal', 'Building and fixing things', 'information', 'R10 room', 'inferred from a small set', 'What did KAMIN connect?', 'اهتماماتك وهدفك'])
      expect(jargonIn(text), text).toEqual([])
    expect(SCREEN_JARGON).toEqual(expect.arrayContaining(['360', 'Person 360', 'RDF', 'JSON-LD', 'kamin-relations', 'inference', 'semantic', 'Realistic', 'Conventional']))
  })

  it('the dictionary has a plain word for every new term, in both languages', () => {
    for (const term of ['Person 360', '360°', 'inference', 'rule R1', 'kamin-relations', 'semantic', 'multi-dimensional', 'RDF', 'JSON-LD']) {
      for (const lang of ['ar', 'en']) {
        expect(PLAIN_TERMS[term]?.[lang], `${term} ${lang}`).toBeTruthy()
        expect(jargonIn(PLAIN_TERMS[term][lang]), `${term} ${lang}`).toEqual([])
      }
    }
    expect(plain('Person 360', 'en')).toBe('your profile')
    expect(plain('Person 360', 'ar')).toBe('ملفك')
  })

  for (const lang of ['ar', 'en']) {
    it(`${lang}: Interests, Show connections and Matches copy has none of the Task 28 words outside "technical"`, () => {
      for (const screen of ['insight', 'studio', 'matches'])
        for (const [key, text] of strings(copy[lang].screens[screen], [screen])) expect(jargonIn(text), `${lang}.${key}`).toEqual([])
    })
    it(`${lang}: the technical explanations keep the technical words for reviewers`, () => {
      expect(copy[lang].screens.studio.technical.download).toContain('JSON-LD')
      expect(copy[lang].screens.studio.technical.rule).toContain('{rule}')
      expect(copy[lang].screens.insight.technical.interests).toContain('RIASEC')
    })
  }

  it('the interest choices are plain activity words; ids (stored data) are the RIASEC names as before', () => {
    const options = DECLARED_PREFERENCE_SCHEMES.careerInterest.options
    expect(options.map(o => o.id)).toEqual(['realistic', 'investigative', 'artistic', 'social', 'enterprising', 'conventional'])
    expect(Object.keys(INTEREST_AREAS)).toEqual(options.map(o => o.id))
    expect(Object.values(INTEREST_AREAS).map(a => a.code).join('')).toBe('RIASEC')
    expect(options.map(o => o.label.en)).toEqual(['Building and fixing things', 'Solving problems and analysing', 'Creating and designing', 'Helping and teaching', 'Leading and persuading', 'Organising and keeping order'])
    for (const option of options) for (const lang of ['ar', 'en']) {
      expect(option.label[lang]).toBe(INTEREST_AREAS[option.id][lang])
      expect(jargonIn(option.label[lang]), `${option.id} ${lang}`).toEqual([])
    }
  })

  it('a profile saved before Task 28 loads the same: same ids, new words', () => {
    const saved = { ...emptyInsightState(), declaredPreferences: { careerInterest: 'realistic', workStructure: 'balanced' } }
    expect(setDeclaredPreference(saved, 'careerInterest', 'conventional').declaredPreferences).toEqual({ careerInterest: 'conventional', workStructure: 'balanced' })
    const { graph } = synthetic('realistic')
    expect(JSON.stringify(graph)).toContain('realistic')
    expect(DECLARED_PREFERENCE_SCHEMES.careerInterest.options.find(o => o.id === saved.declaredPreferences.careerInterest).label.en).toBe('Building and fixing things')
  })

  it('the Interests consent keeps its meaning in plain words: what, from what, where, withdraw, delete (supervisor approval)', () => {
    expect(copy.en.screens.insight.consent).toBe('I agree that KAMIN builds my interests profile from my choices, here in this browser. I can withdraw this consent and delete my choices later.')
    expect(copy.ar.screens.insight.consent).toBe('أوافق على أن يبني كامن ملف اهتماماتي من اختياراتي، هنا في هذا المتصفح، ويمكنني سحب موافقتي وحذف اختياراتي لاحقًا.')
    for (const lang of ['ar', 'en']) expect(jargonIn(copy[lang].screens.insight.consentGranted)).toEqual([])
  })

  it('the research notes shown on Interests & goal are in plain words', () => {
    for (const inst of Object.values(PSYCHOMETRIC_INSTRUMENTS)) for (const lang of ['ar', 'en']) expect(jargonIn(inst.notes[lang]), `${inst.id} ${lang}`).toEqual([])
  })

  for (const lang of ['ar', 'en']) {
    it(`${lang}: matching reasons and the connections map say what they mean; the rule id stays in "technical"`, () => {
      const { state, graph } = synthetic()
      const matches = matchTargets(buildMatchingProfile({ graph }), { lang })
      for (const m of matches) for (const text of [...m.supportingMechanisms, ...m.limitingMechanisms]) expect(jargonIn(text), `${m.id}: ${text}`).toEqual([])
      const match = matches.find(m => m.id === 'job-data-analyst')
      const network = buildRelationshipNetwork({ state, match })
      for (const e of network.edges) for (const text of [e.title[lang], e.source[lang]]) expect(jargonIn(text), `${e.id}: ${text}`).toEqual([])
      for (const route of Object.values(network.routes)) for (const text of [route.title[lang], route.explanation[lang]]) expect(jargonIn(text), text).toEqual([])
      expect(network.edges.find(e => e.id === 'inference').technical).toMatch(/^R1 · kamin-relations-v\d+$/)
    })
  }
})
