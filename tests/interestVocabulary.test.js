// Follow-up to Task 56 (done with Task 57): the interest vocabulary (src/interests/vocabulary.js)
// understands everyday goals in English, Arabic and Saudi dialect ("apps", "تطبيقات", "قيمز", "صحة").
// Goals only: it gives topic and pathway chips, never a capability, never evidence, and it is not part
// of src/ai/lexicon, so project suggestions stay exactly as they were. Every sentence is made up.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { INTEREST_TOPICS, INTEREST_VOCABULARY_VERSION, matchInterestVocabulary, normalize, interestTopic } from '../src/interests/vocabulary.js'
import { understandInterest, addFreeInterest, setChipRemoved, freeInterestGoalPathways } from '../src/interests/freeText.js'
import { normalizeFreeInterests } from '../src/interests/freeInterestState.js'
import { suggestCapabilities } from '../src/ai/projectSuggestImproved.js'
import { emptyInsightState } from '../src/insight.js'
import { targetProfiles } from '../src/matching/targets.js'
import { profileSkills } from '../src/utils/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'

const HOSPITAL = 'I want to build apps that help hospitals'

// Five made-up sentences in Saudi dialect: [sentence, topics, pathways].
const DIALECT = [
  ['ابغى اسوي تطبيقات للمستشفيات', ['apps', 'health'], ['job-software-engineer']],
  ['ودي اشتغل هكر وأتعلم الاختراق', ['security'], ['job-cyber-analyst']],
  ['نفسي اصمم مواقع حلوة', ['websites', 'design'], ['job-web-developer', 'training-web-developer']],
  ['ابي اسوي قيمز مع ربعي', ['games'], ['job-software-engineer']],
  ['حاب اشتغل بالداتا والذكاء الاصطناعي', ['ai', 'data'], ['training-ai-work', 'job-data-analyst']],
]

// Every topic in English and in Arabic (standard), as the student might write it.
const EACH_TOPIC = [
  ['apps', 'I want to make mobile apps', 'أحب برمجة التطبيقات'],
  ['websites', 'building websites for small shops', 'أريد تطوير المواقع الإلكترونية'],
  ['games', 'I love video games and want to make one', 'أحب تصميم الألعاب'],
  ['security', 'ethical hacking and security', 'أهتم بأمن المعلومات'],
  ['ai', 'artificial intelligence', 'الذكاء الاصطناعي'],
  ['data', 'working with data', 'تحليل البيانات'],
  ['design', 'UX and visual design', 'تصميم الواجهات'],
  ['health', 'technology for healthcare', 'التقنية في الصحة'],
]

const base = () => ({ approved: true, college: 'FCIT', consents: { analyze: true, insight: true }, courses: [{ code: 'CPIT-240', name: 'CPIT-240', grade: 'B', source: 'pdf' }], projects: [], tasks: [], credentials: [], insight: emptyInsightState() })

describe('the interest vocabulary understands everyday goals', () => {
  it('"I want to build apps that help hospitals" now gives chips (it gave none in Task 56)', () => {
    expect(matchInterestVocabulary(HOSPITAL)).toEqual({ topics: ['apps', 'health'], pathways: ['job-software-engineer'] })
    expect(understandInterest(HOSPITAL)).toMatchObject({ capabilities: [], pathways: ['job-software-engineer'], topics: ['apps', 'health'] })
    const entry = addFreeInterest(base(), HOSPITAL, { id: 'free-h' }).insight.freeInterests[0]
    expect(entry.understood).toEqual([
      { kind: 'pathway', id: 'job-software-engineer', removed: false },
      { kind: 'topic', id: 'apps', removed: false },
      { kind: 'topic', id: 'health', removed: false },
    ])
    expect(entry.text).toBe(HOSPITAL)
  })

  it.each(DIALECT)('Saudi dialect: %s', (sentence, topics, pathways) => {
    expect(matchInterestVocabulary(sentence)).toEqual({ topics, pathways })
    const result = understandInterest(sentence, 'ar')
    expect(result.topics).toEqual(topics)
    for (const id of pathways) expect(result.pathways).toContain(id)
  })

  it.each(EACH_TOPIC)('topic %s in English and Arabic', (id, en, ar) => {
    expect(matchInterestVocabulary(en).topics, en).toContain(id)
    expect(matchInterestVocabulary(ar).topics, ar).toContain(id)
  })

  it('reads Arabic spelling variants, prefixes and endings', () => {
    expect(normalize('الصِّحَّة إلى آمِن مؤسسة')).toBe('الصحه الي امن موسسه')
    for (const text of ['صحة', 'الصحة', 'بالصحه', 'والصحة', 'للصحة', 'صحتي'.replace('تي', 'ة'), 'مستشفى', 'المستشفيات', 'تطبيقاتي', 'وتطبيقات']) {
      expect(matchInterestVocabulary(text).topics.length, text).toBeGreaterThan(0)
    }
  })

  it('finds nothing in sentences about other things, and does not take every short word', () => {
    for (const text of ['I like cooking and football', 'أحب الطبخ وكرة القدم', 'أبي شغل آمن وقريب من بيتي', 'القيم والأخلاق مهمة لي', 'happy to help my team', 'I prefer remote work']) {
      expect(matchInterestVocabulary(text), text).toEqual({ topics: [], pathways: [] })
    }
  })

  it('is deterministic and keeps the vocabulary order; at most 4 topics in a saved interest', () => {
    const long = 'apps, websites, games, hacking, AI, data, design and hospitals'
    expect(matchInterestVocabulary(long).topics).toEqual(['apps', 'websites', 'games', 'security', 'ai', 'data', 'design', 'health'])
    expect(understandInterest(long).topics).toEqual(['apps', 'websites', 'games', 'security'])
    expect(understandInterest(long)).toEqual(understandInterest(long))
  })

  it('every topic has Arabic and English labels; every pathway is a known target; ids are unique', () => {
    const targets = new Set(targetProfiles.map(t => t.id))
    expect(new Set(INTEREST_TOPICS.map(t => t.id)).size).toBe(INTEREST_TOPICS.length)
    for (const topic of INTEREST_TOPICS) {
      expect(topic.labels.ar).toMatch(/[؀-ۿ]/)
      expect(topic.labels.en).toMatch(/^[A-Z]/)
      for (const id of topic.pathways) expect(targets.has(id), `${topic.id}: ${id}`).toBe(true)
      for (const word of topic.words) expect(normalize(word), word).toBe(word) // written normalised
    }
    expect(interestTopic('health').labels).toEqual({ ar: 'الصحة', en: 'Health' })
    expect(INTEREST_VOCABULARY_VERSION).toBe('kamin-interest-vocabulary-v1')
  })
})

describe('the interest vocabulary is goals only, never evidence (guard)', () => {
  it('it never gives a capability: the capability chips are the approved engine’s alone', () => {
    for (const [sentence] of [[HOSPITAL], ...DIALECT]) {
      expect(Object.keys(matchInterestVocabulary(sentence)).sort()).toEqual(['pathways', 'topics'])
      expect(understandInterest(sentence).capabilities).toEqual(suggestCapabilities(sentence, { max: 4 }).suggestions.map(s => s.skillId))
    }
  })

  it('project suggestions are unchanged: the approved engine still abstains on the hospital sentence', () => {
    expect(suggestCapabilities(HOSPITAL).suggestions).toEqual([])
    expect(suggestCapabilities('ابغى اسوي تطبيقات للمستشفيات').suggestions).toEqual([])
  })

  it('the engine and its lexicon never read the vocabulary, and the vocabulary never reads them', () => {
    const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`])
    for (const file of walk('src/ai')) expect(readFileSync(file, 'utf8'), file).not.toMatch(/interests\/|vocabulary\.js|INTEREST_TOPICS|matchInterestVocabulary/)
    expect(readFileSync('src/interests/vocabulary.js', 'utf8')).not.toMatch(/^\s*import\s/m)
    for (const file of ['src/utils/engine.js', 'src/ontology/projector.js', 'src/person360.js', 'src/matching/engine.js', 'src/evidence/levels.js', 'src/evidence/recompute.js']) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/vocabulary|topic chip/i)
    }
  })

  it('topic chips change no capability and nothing in the person graph', () => {
    let s = base()
    s = addFreeInterest(s, HOSPITAL, { id: 'free-1' })
    s = addFreeInterest(s, 'ودي اشتغل هكر وأتعلم الاختراق', { id: 'free-2' })
    const without = { ...s, insight: { ...s.insight, freeInterests: [] } }
    expect(profileSkills(s)).toEqual(profileSkills(without))
    const graph = state => JSON.stringify(projectStateToPerson360({ state, skills: profileSkills(state), now: '2026-11-18T10:00:00.000Z' }))
    expect(graph(s)).not.toMatch(/free-1|free-2|hospital|"apps"|"health"|kamin-interest-vocabulary/)
  })

  it('topic chips are stored, kept by the allowlist, removable, and never a goal pathway', () => {
    let s = addFreeInterest(base(), HOSPITAL, { id: 'free-1' })
    expect(normalizeFreeInterests(s.insight.freeInterests)).toEqual(s.insight.freeInterests)
    expect(freeInterestGoalPathways(s)).toEqual(['job-software-engineer'])
    s = setChipRemoved(s, 'free-1', 'topic', 'health')
    expect(s.insight.freeInterests[0].understood.find(c => c.id === 'health')).toEqual({ kind: 'topic', id: 'health', removed: true })
    expect(s.insight.freeInterests[0].text).toBe(HOSPITAL)
    expect(freeInterestGoalPathways(s)).toEqual(['job-software-engineer'])
    // 4 chips of each of the three kinds fit; a fifth topic or an unknown kind does not.
    const chips = kind => Array.from({ length: 5 }, (_, i) => ({ kind, id: `${kind}-${i}`, removed: false }))
    const entry = { ...s.insight.freeInterests[0], understood: [...chips('capability').slice(0, 4), ...chips('pathway').slice(0, 4), ...chips('topic'), { kind: 'claim', id: 'x' }] }
    expect(normalizeFreeInterests([entry])[0].understood.map(c => c.kind)).toEqual([...Array(4).fill('capability'), ...Array(4).fill('pathway'), ...Array(4).fill('topic')])
  })
})
