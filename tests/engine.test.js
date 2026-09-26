import { describe, expect, it } from 'vitest'
import { demoCourses, opportunities } from '../src/data.js'
import {
  inferSkills,
  judgeOpportunities,
  mappingCoverage,
  normalizeGrade,
} from '../src/utils/engine.js'
import { parseTranscriptText } from '../src/utils/transcript.js'

describe('Kamin deterministic evidence engine', () => {
  it('uses exact demo mappings and separates applied from studied evidence', () => {
    const skills = inferSkills(demoCourses)
    const requirements = skills.find((s) => s.id === 'requirements')
    expect(requirements).toBeTruthy()
    expect(requirements.appliedEvidence.some((e) => e.code === 'CPIT-499')).toBe(true)
    expect(requirements.knowledgeEvidence.some((e) => e.code === 'CPIT-251')).toBe(true)
    expect(skills.every((s) => s.evidence.length > 0)).toBe(true)
    expect(skills.every((s) => s.calibrated === false)).toBe(true)
    expect(skills.every((s) => Number.isFinite(s.confidence))).toBe(true)
    expect(skills.every((s) => s.confidence >= 0 && s.confidence <= 100)).toBe(true)
  })

  it('never treats failed, withdrawn or incomplete courses as evidence', () => {
    const rows = [
      { code: 'CPIT-251', name: 'Systems Analysis', grade: 'F', source: 'demo' },
      { code: 'CPIT-252', name: 'Software Engineering', grade: 'W', source: 'demo' },
      { code: 'CPIT-260', name: 'Database Systems', grade: 'I', source: 'demo' },
    ]
    expect(inferSkills(rows)).toEqual([])
    const coverage = mappingCoverage(rows)
    expect(coverage.failed).toHaveLength(3)
  })

  it('does not infer skills from course-title keywords', () => {
    const rows = [
      { code: 'MATH-333', name: 'Real Analysis', grade: 'A', source: 'demo' },
      { code: 'EE-210', name: 'Electrical Engineering Fundamentals', grade: 'A', source: 'demo' },
      { code: 'BUS-101', name: 'Introduction to Management', grade: 'A', source: 'demo' },
      { code: 'ISL-100', name: 'الأمن الفكري', grade: 'A', source: 'demo' },
      { code: 'CPIT-999', name: 'Introduction to AI', grade: 'A', source: 'demo' },
    ]
    expect(inferSkills(rows)).toEqual([])
    expect(mappingCoverage(rows).unmapped).toHaveLength(rows.length)
  })

  it('does not apply demo-only mappings to uploaded or manual records', () => {
    const uploaded = [{ code: 'CPIT-251', name: 'Systems Analysis', grade: 'A', source: 'pdf' }]
    expect(inferSkills(uploaded)).toEqual([])
    expect(mappingCoverage(uploaded).unmapped).toHaveLength(1)
  })

  it('keeps PMP as not-yet with formal source and alternative path', () => {
    const skills = inferSkills(demoCourses)
    const pmp = judgeOpportunities(skills, 'management', 'en').find((r) => r.id === 'pmp')
    expect(pmp.status).toBe('no')
    expect(pmp.noType).toBe('not-now')
    expect(pmp.formalGate.sourceUrl).toMatch(/^https:\/\/www\.pmi\.org\//)
    expect(pmp.becomes).toMatch(/business analysis|CAPM|Scrum/i)
  })

  it('returns a bridgeable gap rather than a positive fit when core evidence is absent', () => {
    const cyber = judgeOpportunities([], 'cyber', 'en').find((r) => r.id === 'cyber-foundations')
    expect(cyber.status).toBe('no')
    expect(cyber.noType).toBe('bridgeable-gap')
  })

  it('classifies a course as duplication when it teaches what evidence already supports', () => {
    const skills = inferSkills(demoCourses)
    const sql = judgeOpportunities(skills, 'data', 'en').find((r) => r.id === 'sql')
    expect(sql.status).toBe('no')
    expect(sql.noType).toBe('duplication')
  })

  it('does not issue a goal-based judgment before the student selects a goal', () => {
    const skills = inferSkills(demoCourses)
    const recs = judgeOpportunities(skills, null, 'en')
    expect(recs.every((r) => r.status === 'explore')).toBe(true)
    expect(recs.every((r) => r.score === null)).toBe(true)
  })

  it('keeps commercial fields isolated from the judgment', () => {
    const skills = inferSkills(demoCourses)
    const before = judgeOpportunities(skills, 'management', 'en').map(({ id, status, score, gapType, becomes, reasons }) => ({ id, status, score, gapType, becomes, reasons }))
    opportunities.forEach((opp) => {
      opp.commission = 999999
      opp.sponsored = true
    })
    const after = judgeOpportunities(skills, 'management', 'en').map(({ id, status, score, gapType, becomes, reasons }) => ({ id, status, score, gapType, becomes, reasons }))
    expect(after).toEqual(before)
    opportunities.forEach((opp) => {
      delete opp.commission
      delete opp.sponsored
    })
  })

  it('normalizes Arabic grades and rejects unknown grades', () => {
    expect(normalizeGrade('أ+')).toBe('A+')
    expect(normalizeGrade('ب')).toBe('B')
    expect(normalizeGrade('ح')).toBe('W')
    expect(normalizeGrade('م')).toBe('I')
    expect(normalizeGrade('XYZ')).toBeNull()
  })

  it('parses a transcript line by columns instead of using the last number as the grade', () => {
    const rows = parseTranscriptText('CPIT 251 Systems Analysis and Design 3 A 15.00', 'pdf')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      code: 'CPIT-251',
      name: 'Systems Analysis and Design',
      hours: 3,
      grade: 'A',
      points: 15,
      reviewRequired: false,
    })
  })

  it('parses Arabic letter grades', () => {
    const rows = parseTranscriptText('CPIT 251 تحليل وتصميم النظم 3 أ+ 15.00\nSTAT 201 الإحصاء التطبيقي 3 ب 12.00', 'pdf')
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.grade)).toEqual(['A+', 'B'])
  })

  it('marks unreadable grade rows for student review instead of silently guessing', () => {
    const rows = parseTranscriptText('CPIT 251 Systems Analysis and Design PASS?', 'pdf')
    expect(rows).toHaveLength(1)
    expect(rows[0].reviewRequired).toBe(true)
    expect(rows[0].grade).toBe('')
  })

  it('requires an outcome statement on every catalog item', () => {
    expect(opportunities.every((opp) => opp.outcome?.ar && opp.outcome?.en)).toBe(true)
  })
})
