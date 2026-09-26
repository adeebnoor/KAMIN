import { describe, expect, it } from 'vitest'
import { demoCourses } from '../src/data.js'
import { inferSkills, judgeOpportunities } from '../src/utils/engine.js'
import { parseTranscriptText } from '../src/utils/transcript.js'

describe('Kamin deterministic engine', () => {
  it('infers evidence-backed skills from demo courses', () => {
    const skills = inferSkills(demoCourses)
    expect(skills.some((s) => s.id === 'requirements')).toBe(true)
    expect(skills.every((s) => s.evidence.length > 0)).toBe(true)
  })

  it('keeps PMP as not-yet because of the formal gate', () => {
    const skills = inferSkills(demoCourses)
    const recs = judgeOpportunities(skills, 'management', 'en')
    const pmp = recs.find((r) => r.id === 'pmp')
    expect(pmp.status).toBe('no')
    expect(pmp.score).toBeLessThanOrEqual(48)
  })

  it('parses common transcript lines', () => {
    const text = 'CPIT-251 Systems Analysis and Design A\nSTAT 201 Applied Statistics B+'
    const rows = parseTranscriptText(text)
    expect(rows).toHaveLength(2)
    expect(rows[0].code).toBe('CPIT-251')
  })
})
