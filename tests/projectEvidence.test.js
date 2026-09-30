import { describe, it, expect } from 'vitest'
import { createProjectEvidence, normalizeProjectEvidence, projectsForSkill, PROJECT_EVIDENCE_LEVEL } from '../src/utils/projectEvidence.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { inferSkills } from '../src/utils/engine.js'
import { matchTargets, buildMatchingProfile } from '../src/matching/engine.js'
import { buildPortableProfile, normalizePortableState } from '../src/utils/portableProfile.js'

const draft = { title: 'Sales dashboard with SQL and Power BI', kind: 'project', url: 'https://github.com/example/sales-dashboard', description: 'Built the queries and the dashboard myself.', skillIds: ['database', 'statistics'] }

describe('self-declared applied evidence', () => {
  it('records a declaration at the declared-applied level and never above it', () => {
    const record = createProjectEvidence(draft, new Date('2026-09-30T10:00:00Z'))
    expect(record).toMatchObject({ title: draft.title, kind: 'project', level: PROJECT_EVIDENCE_LEVEL, reviewStatus: 'unreviewed', skillIds: ['database', 'statistics'] })
    expect(record.url).toBe('https://github.com/example/sales-dashboard')
    expect(normalizeProjectEvidence([{ ...record, level: 'verified', reviewStatus: 'accepted' }])[0]).toMatchObject({ level: PROJECT_EVIDENCE_LEVEL, reviewStatus: 'unreviewed' })
  })

  it('rejects unsafe links, unknown capabilities and malformed records', () => {
    expect(() => createProjectEvidence({ ...draft, url: 'javascript:alert(1)' })).toThrow('PROJECT_URL_MUST_BE_HTTPS')
    expect(() => createProjectEvidence({ ...draft, url: 'http://insecure.example' })).toThrow('PROJECT_URL_MUST_BE_HTTPS')
    expect(() => createProjectEvidence({ ...draft, skillIds: ['hacking'] })).toThrow('INVALID_PROJECT_EVIDENCE')
    expect(() => createProjectEvidence({ ...draft, title: 'ab' })).toThrow('INVALID_PROJECT_EVIDENCE')
    expect(normalizeProjectEvidence([{ id: 'x', title: 'Fake', skillIds: ['database'], createdAt: 'now' }, null, 'text'])).toEqual([])
    const record = createProjectEvidence(draft)
    expect(normalizeProjectEvidence([record, record])).toHaveLength(1)
  })

  it('does not create capabilities or move Fit', () => {
    const record = createProjectEvidence(draft)
    const state = { courses: [], approved: false, goal: 'data', projects: [record], consents: { analyze: false, insight: false } }
    expect(inferSkills(state.courses)).toEqual([])
    const withoutProjects = matchTargets(buildMatchingProfile({ graph: projectStateToPerson360({ state: { ...state, projects: [] }, skills: [] }) }), { lang: 'en' })
    const withProjects = matchTargets(buildMatchingProfile({ graph: projectStateToPerson360({ state, skills: [] }) }), { lang: 'en' })
    expect(withProjects.map(m => [m.id, m.judgment, m.missingSkills])).toEqual(withoutProjects.map(m => [m.id, m.judgment, m.missingSkills]))
    expect(projectsForSkill([record], 'database')).toHaveLength(1)
    expect(projectsForSkill([record], 'cyber')).toHaveLength(0)
  })

  it('exports declarations as review-required evidence and survives a portable round trip', () => {
    const record = createProjectEvidence(draft)
    const state = { courses: [], approved: false, goal: null, projects: [record], consents: {}, audit: [], recommendationReviews: [] }
    const graph = projectStateToPerson360({ state, skills: [] })
    const claims = graph.claims.filter(c => c.predicate === 'kamin:declaresEvidenceFor')
    expect(claims).toHaveLength(2)
    expect(claims[0]).toMatchObject({ evidenceStrength: 'declared-applied', metadata: { affectsFit: false, reviewRequired: true } })
    expect(graph.entities.find(e => e['@id'] === `urn:kamin:evidence:project:${record.id}`)).toMatchObject({ provenanceLevel: 'declared-applied', reviewStatus: 'unreviewed' })
    const portable = buildPortableProfile({ state, person360: graph })
    expect(portable.state.projects).toHaveLength(1)
    expect(normalizePortableState(portable).projects[0]).toMatchObject({ id: record.id, level: PROJECT_EVIDENCE_LEVEL })
  })
})
