import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { suggestCapabilities, evaluateSuggestions, PROJECT_SUGGEST_VERSION } from '../src/ai/projectSuggest.js'
import { skills } from '../src/data.js'

const labelled = JSON.parse(readFileSync(new URL('./fixtures/project-suggest-labelled.json', import.meta.url), 'utf8'))
const skillIds = new Set(Object.values(skills).map(s => s.id))

describe('project description → capability suggestion (measured)', () => {
  it('quotes the supporting sentence for every suggestion and abstains without one', () => {
    const result = suggestCapabilities('Built a sales dashboard. Wrote SQL queries joining two tables.\nThen presented it to the team.')
    expect(result.version).toBe(PROJECT_SUGGEST_VERSION)
    expect(result.suggestions[0]).toMatchObject({ skillId: 'database', snippet: 'Wrote SQL queries joining two tables.' })
    expect(result.suggestions[0].matches.length).toBeGreaterThan(0)
    expect(suggestCapabilities('نظمت رحلة الكلية.')).toMatchObject({ suggestions: [], abstained: true })
    expect(suggestCapabilities('')).toMatchObject({ abstained: true })
    for (const s of result.suggestions) expect(skillIds.has(s.skillId)).toBe(true)
  })

  it('meets the pre-registered engineering thresholds on the frozen labelled set, per language', () => {
    const report = evaluateSuggestions(labelled)
    for (const lang of ['ar', 'en']) {
      expect(report[lang].cases).toBeGreaterThanOrEqual(12)
      expect(report[lang].precision, `${lang} precision`).toBeGreaterThanOrEqual(0.8)
      expect(report[lang].recall, `${lang} recall`).toBeGreaterThanOrEqual(0.75)
      expect(report[lang].abstentionRate, `${lang} abstention`).toBeGreaterThan(0)
    }
    // Every expected id in the fixture must be a catalog capability (frozen set integrity).
    for (const item of labelled) for (const id of item.expected) expect(skillIds.has(id)).toBe(true)
  })

  it('never changes evidence levels: a suggestion is only a checkbox the student must tick', () => {
    const result = suggestCapabilities('Wrote SQL queries and unit tests.')
    expect(result.suggestions.every(s => !('level' in s) && !('evidenceStrength' in s))).toBe(true)
  })
})
