import { describe, it, expect } from 'vitest'
import { createRecommendationReview, normalizeRecommendationReviews, recommendationReviewStatus } from '../src/review/recommendations.js'
import { attachTaskOutput, recordLocalTaskReview, taskProof } from '../src/tasks/progress.js'
import { buildCapabilitySnapshot, validateSnapshot } from '../src/utils/capabilitySnapshot.js'
import { normalizeCredentialRecords } from '../src/credentials/records.js'
import { inferSkills } from '../src/utils/engine.js'
import { skillProvenance } from '../src/utils/provenance.js'

// Priority 4 acceptance: no student can approve their own evidence under an advisor's name,
// and sharing never exceeds the elements the student chose.
describe('advisor separation in the public release', () => {
  it('a locally declared "advisor" review never changes evidence, level or Fit inputs', () => {
    const rows = [{ code: 'CPIT-260', name: 'Database Systems', grade: 'B', source: 'pdf' }]
    const before = skillProvenance(inferSkills(rows)[0])
    const descriptor = { key: 'pathway:job-data-analyst', kind: 'pathway', targetId: 'job-data-analyst', title: { ar: 'x', en: 'x' }, judgment: 'conditional', ruleVersion: 'kamin-graph-fit-v1', catalogVersion: 'kamin-targets-v2-20260930', requirements: [], source: null }
    const review = createRecommendationReview({ descriptor, fingerprint: 'a'.repeat(64), draft: { action: 'accepted', reason: 'reviewed', note: '', reviewer: { label: 'Dean of Students', role: 'advisor' }, confidence: 'confident', checks: ['evidence', 'goal', 'limits'] } })
    expect(review.reviewer.role).toBe('advisor')
    expect(recommendationReviewStatus(review, 'a'.repeat(64))).toBe('accepted')
    expect(skillProvenance(inferSkills(rows)[0])).toEqual(before)
    expect(Object.keys(review)).not.toContain('evidenceLevel')
    const restored = normalizeRecommendationReviews([review], { imported: true })[0]
    expect(recommendationReviewStatus(restored, 'a'.repeat(64))).toBe('imported')
  })

  it('a task reviewed under an advisor alias stays declared and reports no issuer verification', () => {
    let records = attachTaskOutput([], 'task-sql-analysis', { note: 'Queries with results and checks.' })
    records = recordLocalTaskReview(records, 'task-sql-analysis', { reviewerLabel: 'Prof. Advisor', role: 'advisor', decision: 'reviewed' })
    expect(taskProof(records[0])).toMatchObject({ evaluation: 'local-declared-review', issuerVerification: 'none', evidenceLevel: 'declared-applied' })
    expect(records[0].reviews[0].level).toBe('declared')
  })

  it('a shared snapshot contains only the chosen capabilities and goal, with levels bound to them', () => {
    const snapshot = buildCapabilitySnapshot({ skillIds: ['database'], goal: 'data', levels: { database: 'edited', statistics: 'document' } })
    expect(snapshot.capabilities).toEqual(['database'])
    expect(snapshot.levels).toEqual({ database: 'edited' })
    expect(() => validateSnapshot({ ...snapshot, reviewer: 'advisor' })).toThrow('INVALID_SNAPSHOT')
    expect(() => validateSnapshot({ ...snapshot, capabilities: ['database', 'database'] })).toThrow('INVALID_SNAPSHOT')
  })

  it('only a trusted-issuer verification is honoured as institution-verified', () => {
    const [record] = normalizeCredentialRecords([{ id: 'credential-abcdef', outcome: 'verified', issuerTrusted: false, issuerId: 'did:example:x', importedAt: '2026-09-30T00:00:00Z', achievements: [{ id: 'urn:kamin:skill:database', name: 'DB' }] }])
    expect(record.outcome).toBe('unverified')
    expect(record.evidenceLevel).toBe('declared')
  })
})
