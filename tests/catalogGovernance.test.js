import { describe, it, expect } from 'vitest'
import { catalogGovernanceReport, relationGovernance, mappingGovernance, governanceLine } from '../src/catalog/governance.js'
import { targetProfiles } from '../src/matching/targets.js'
import { validateOpportunity, activeOpportunities, opportunityStatus, localOpportunities } from '../src/market/localOpportunities.js'
import { matchTargets, buildMatchingProfile } from '../src/matching/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'

describe('catalog governance', () => {
  it('every pathway relation and course mapping carries source, version, review date, owner and validity scope', () => {
    const report = catalogGovernanceReport()
    expect(report.incomplete).toEqual([])
    expect(report.relations.length).toBe(targetProfiles.length)
    expect(report.mappings.length).toBeGreaterThan(0)
    for (const g of [...report.relations, ...report.mappings]) {
      expect(g.reviewOwner.ar.length).toBeGreaterThan(3)
      expect(g.validityScope.en).toMatch(/KAU-FCIT/)
    }
  })

  it('keeps SSCO unresolved without a reviewed match and labels ESCO and O*NET roles', () => {
    const data = relationGovernance(targetProfiles.find(t => t.id === 'job-data-analyst'))
    expect(data.esco).toMatchObject({ id: '2511.3' })
    expect(data.esco.role.en).toMatch(/not evidence of Saudi demand/)
    expect(data.ssco).toMatchObject({ code: null, status: 'unresolved' })
    expect(relationGovernance({ id: 'x', occupationCodes: { ssco: '2511' }, source: { checked: '2026-09-30' } }).ssco.status).toBe('pending-code-and-meaning-review')
    expect(governanceLine(data, 'ar')).toContain('SSCO: غير محسوم')
    expect(mappingGovernance('CPIT-260').validityScope.en).toMatch(/course codes only/)
    expect(mappingGovernance('ZZZZ-999')).toBeNull()
  })

  it('never produces a verified skill from a course title that merely resembles a capability', () => {
    const state = { courses: [{ code: 'ZZZZ-101', name: 'Database Systems and SQL', grade: 'A', source: 'pdf' }], approved: true, goal: 'data' }
    const matches = matchTargets(buildMatchingProfile({ graph: projectStateToPerson360({ state, skills: [] }) }), { lang: 'en' })
    const analyst = matches.find(m => m.id === 'job-data-analyst')
    expect(analyst.missingSkills).toEqual(expect.arrayContaining(['database']))
  })
})

describe('local opportunities', () => {
  const valid = { id: 'opp-1', title: 'Junior data analyst (synthetic)', region: 'Jeddah', verifiedAt: '2026-09-30', expiresAt: '2026-12-31', source: { name: 'Example portal', url: 'https://example.sa/jobs/1', licence: 'permitted-for-pilot' }, pathwayIds: ['job-data-analyst'] }
  it('ships empty and requires region, dates and a licensed https source for every entry', () => {
    expect(localOpportunities).toEqual([])
    expect(validateOpportunity(valid).valid).toBe(true)
    expect(validateOpportunity({ ...valid, region: undefined }).errors).toContain('missing:region')
    expect(validateOpportunity({ ...valid, verifiedAt: 'yesterday' }).errors).toContain('invalid:verifiedAt')
    expect(validateOpportunity({ ...valid, source: { name: 'x', url: 'http://insecure', licence: 'y' } }).errors).toContain('invalid:source')
    expect(activeOpportunities([valid, { ...valid, id: 'opp-2', expiresAt: '2026-01-01' }], new Date('2026-10-01'))).toHaveLength(1)
    const status = opportunityStatus()
    expect(status.loaded).toBe(0)
    expect(status.note.ar).toMatch(/لا بيانات فرص محلية/)
    expect(opportunityStatus([valid], new Date('2026-10-01')).note.en).toMatch(/does not indicate demand/)
  })
})
