import { describe, it, expect } from 'vitest'
import { taskCatalog, TASK_GOVERNANCE } from '../src/tasks/catalog.js'
import { startTask, attachTaskOutput, selfAssessTask, recordLocalTaskReview, normalizeTaskProgress, taskProof, recommendTask, taskWorkHours, TASK_EVIDENCE_LEVEL } from '../src/tasks/progress.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { buildPortableProfile, normalizePortableState } from '../src/utils/portableProfile.js'
import { skills } from '../src/data.js'

const skillIds = new Set(Object.values(skills).map(s => s.id))
const now = new Date('2026-09-30T10:00:00Z')

describe('task catalog (design proposal)', () => {
  it('offers six tasks across three pathways, each with a rubric, deliverables, synthetic data and a review scope', () => {
    expect(taskCatalog).toHaveLength(6)
    expect(new Set(taskCatalog.flatMap(t => t.pathwayIds)).size).toBe(3)
    for (const task of taskCatalog) {
      expect(task.rubric.length).toBeGreaterThanOrEqual(3)
      expect(task.deliverables.length).toBeGreaterThan(0)
      expect(task.steps.length).toBeGreaterThanOrEqual(3)
      expect(task.syntheticData.ar).toMatch(/وهمي|تدريبية/)
      expect(task.reviewScope.en.length).toBeGreaterThan(10)
      expect(task.skillIds.every(id => skillIds.has(id))).toBe(true)
      expect(task.hours).toBeGreaterThan(0)
    }
    expect(TASK_GOVERNANCE.reviewedAt).toBeNull()
    expect(TASK_GOVERNANCE.reviewOwner).toMatch(/pending/)
  })
})

describe('task progress', () => {
  it('saves and reopens progress through the allowed transitions', () => {
    let records = startTask([], 'task-backup-restore', now)
    expect(records[0]).toMatchObject({ status: 'in-progress', startedAt: now.toISOString() })
    expect(() => recordLocalTaskReview(records, 'task-backup-restore', { reviewerLabel: 'x', role: 'peer', decision: 'reviewed' })).toThrow('TASK_OUTPUT_REQUIRED')
    expect(() => attachTaskOutput(records, 'task-backup-restore', { url: 'javascript:alert(1)', note: 'commands and log' })).toThrow('TASK_OUTPUT_URL_MUST_BE_HTTPS')
    records = attachTaskOutput(records, 'task-backup-restore', { url: 'https://example.com/backup-log', note: 'Backup, damage, restore, verified row counts.' }, now)
    expect(records[0].status).toBe('output-attached')
    records = selfAssessTask(records, 'task-backup-restore', { restore: 'meets', log: 'needs-improvement' }, now)
    expect(taskProof(records[0])).toEqual({ completion: true, evaluation: 'self-assessment', issuerVerification: 'none', evidenceLevel: TASK_EVIDENCE_LEVEL })
    const reopened = normalizeTaskProgress(JSON.parse(JSON.stringify(records)))
    expect(reopened).toEqual(records)
  })

  it('keeps completion, evaluation and issuer verification as separate claims and never upgrades the level', () => {
    let records = attachTaskOutput([], 'task-sql-analysis', { note: 'Five queries with results and checks.' }, now)
    records = recordLocalTaskReview(records, 'task-sql-analysis', { reviewerLabel: 'Dr. Advisor', role: 'advisor', scope: 'SQL correctness', decision: 'reviewed', note: 'Good.' }, now)
    expect(records[0].status).toBe('reviewed')
    expect(records[0].reviews[0]).toMatchObject({ role: 'advisor', level: 'declared' })
    expect(taskProof(records[0])).toMatchObject({ completion: true, evaluation: 'local-declared-review', issuerVerification: 'none', evidenceLevel: 'declared-applied' })
    // A record that claims a higher level or verification is normalised back down.
    const tampered = normalizeTaskProgress([{ ...records[0], level: 'institution-verified', issuerVerification: 'verified' }])
    expect(tampered[0].level).toBe(TASK_EVIDENCE_LEVEL)
    expect(taskProof(tampered[0]).issuerVerification).toBe('none')
    // "needs improvement" sends the task back to in-progress, not to not-started.
    records = recordLocalTaskReview(records, 'task-sql-analysis', { reviewerLabel: 'Peer', role: 'peer', decision: 'needs-improvement' }, now)
    expect(records[0].status).toBe('needs-improvement')
    expect(startTask(records, 'task-sql-analysis', now)[0].status).toBe('in-progress')
    expect(normalizeTaskProgress([{ taskId: 'task-sql-analysis', status: 'reviewed', outputs: [], reviews: [] }])).toEqual([])
  })

  it('recommends the open task first, then a task for the first missing capability', () => {
    expect(recommendTask({ missingSkills: ['statistics', 'database'], records: [] })).toMatchObject({ task: { id: 'task-stats-summary' }, reason: 'gap' })
    const open = startTask([], 'task-module-tests', now)
    expect(recommendTask({ missingSkills: ['statistics'], records: open })).toMatchObject({ task: { id: 'task-module-tests' }, reason: 'continue' })
    expect(recommendTask({ missingSkills: [], records: [] })).toBeNull()
    expect(taskWorkHours(['db-operations', 'database'])).toBe(4 + 3 + 6)
  })

  it('exports task outputs as review-required evidence and survives a portable round trip', () => {
    const records = attachTaskOutput([], 'task-access-review', { note: 'Permissions table before/after with reasons.' }, now)
    const state = { courses: [], approved: false, goal: 'data', projects: [], tasks: records, consents: {}, audit: [], recommendationReviews: [] }
    const graph = projectStateToPerson360({ state, skills: [] })
    const claims = graph.claims.filter(c => c.sourceType === 'task-output-declaration')
    expect(claims.map(c => c.object).sort()).toEqual(['urn:kamin:skill:database', 'urn:kamin:skill:db-operations'])
    expect(claims[0]).toMatchObject({ evidenceStrength: 'declared-applied', metadata: { affectsFit: false, reviewRequired: true } })
    expect(graph.entities.find(e => e['@id'] === 'urn:kamin:evidence:task:task-access-review')).toMatchObject({ issuerVerification: 'none' })
    const portable = buildPortableProfile({ state, person360: graph })
    expect(normalizePortableState(portable).tasks[0]).toMatchObject({ taskId: 'task-access-review', status: 'output-attached' })
  })
})
