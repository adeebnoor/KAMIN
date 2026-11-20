import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { suggestCapabilities, normaliseText, PROJECT_SUGGEST_IMPROVED_VERSION } from '../src/ai/projectSuggestImproved.js'
import { suggestForProject, PROJECT_SUGGEST_METHOD } from '../src/ai/suggestSettings.js'
import { skills } from '../src/data.js'

// Task 08 · improved local matching (no API). Interface is the same as projectSuggest.js.
const ids = text => suggestCapabilities(text).suggestions.map(s => s.skillId)
const lexicon = JSON.parse(readFileSync('src/ai/lexicon/capabilities.json', 'utf8'))

describe('improved project-suggestion engine', () => {
  it('one generic word alone suggests nothing: "Implemented the login" / «نفذت صفحة الدخول»', () => {
    expect(ids('Implemented the login.')).toEqual([])
    expect(ids('نفذت صفحة الدخول.')).toEqual([])
    expect(ids('Called the weather API.')).toEqual([])
    expect(suggestCapabilities('Implemented the login.')).toMatchObject({ version: PROJECT_SUGGEST_IMPROVED_VERSION, abstained: true })
  })

  it('"secured endpoints with JWT" suggests cyber and quotes that sentence (English and Arabic)', () => {
    const en = suggestCapabilities('Built the mobile app. Secured endpoints with JWT.')
    expect(en.suggestions).toEqual([expect.objectContaining({ skillId: 'cyber', snippet: 'Secured endpoints with JWT.', method: 'lexicon-v2' })])
    const ar = suggestCapabilities('بنيت تطبيق الجوال. أمّنت نقاط النهاية باستخدام JWT.')
    expect(ar.suggestions).toEqual([expect.objectContaining({ skillId: 'cyber', snippet: 'أمّنت نقاط النهاية باستخدام JWT.' })])
  })

  it('a text only about meetings and coordination abstains (English and Arabic)', () => {
    expect(suggestCapabilities('Coordinated meetings with the sponsor and followed up with the team.')).toMatchObject({ suggestions: [], abstained: true })
    expect(suggestCapabilities('نسقت الاجتماعات مع الراعي وتابعت مع الفريق.')).toMatchObject({ suggestions: [], abstained: true })
  })

  it('two weak terms of the same capability in one sentence are enough; split across sentences they are not', () => {
    expect(ids('Implemented a parser module.')).toEqual(['software'])
    expect(ids('Implemented it. The module was reviewed.')).toEqual([])
  })

  it('normalises Arabic forms, English inflection and Arabic-Indic digits', () => {
    expect(normaliseText('أُمِّنَتْ الـبيانات ١٢٣')).toBe('امنت البيانات 123')
    expect(ids('كتبتُ اختباراتِ وحدةٍ للتطبيق.')).toEqual(['testing'])
    expect(ids('Wrote several unit tests and tested the edge cases.')).toEqual(['testing'])
    expect(ids('وصممت جداول قاعدة البيانات.')).toEqual(['database'])
    // a single attached letter is tried, not forced: «وثيقة» is not a capability term
    expect(ids('كتبت وثيقة.')).toEqual([])
  })

  it('every snippet is verbatim in the input', () => {
    const texts = [
      'Built a responsive web page in React. Wrote SQL queries for the report!\nThen ran a regression on the survey.',
      'صممت قاعدة بيانات، وكتبت استعلامات. ثم حللت البيانات بالانحدار؟ وأخيرًا كتبت متطلبات النظام.',
    ]
    for (const text of texts) {
      const { suggestions } = suggestCapabilities(text)
      expect(suggestions.length).toBeGreaterThan(1)
      for (const s of suggestions) expect(text.includes(s.snippet), s.snippet).toBe(true)
    }
  })

  it('the lexicon only uses catalog capabilities and gives a reason for every term', () => {
    for (const [id, entry] of Object.entries(lexicon.capabilities)) {
      expect(skills[id], id).toBeTruthy()
      for (const term of [...entry.strong, ...entry.weak]) expect(term.why, `${id}: ${term.t}`).toBeTruthy()
    }
  })

  it('stays local: no fetch, no external host, no model download in the engine or its lexicon', () => {
    const files = ['src/ai/projectSuggestImproved.js', 'src/ai/suggestSettings.js', 'src/ai/lexicon/capabilities.json']
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/fetch\(|https?:\/\/|transformers|XMLHttpRequest/)
    }
    expect(readdirSync('src/ai/lexicon')).toEqual(['capabilities.json'])
  })

  // Changed on 2026-11-11: the supervisor approved the comparison, so the app now uses the improved
  // engine. The lexicon stays available by name as the measured baseline.
  it('the UI uses the improved engine since the supervisor approved the comparison; the lexicon stays selectable', async () => {
    expect(PROJECT_SUGGEST_METHOD).toBe('improved')
    expect((await suggestForProject('Wrote SQL queries.')).version).toBe(PROJECT_SUGGEST_IMPROVED_VERSION)
    expect((await suggestForProject('Wrote SQL queries.', 'lexicon')).version).toBe('kamin-project-suggest-lexicon-v1')
  })
})
