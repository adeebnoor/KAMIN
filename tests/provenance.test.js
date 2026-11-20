import { describe, it, expect } from 'vitest'
import { editCourseRow, rowProvenance, skillProvenance, provenanceSignals, provenanceStrength } from '../src/utils/provenance.js'
import { reviewProfileQuality } from '../src/utils/profileQuality.js'
import { courseStatus, issuesByRow, attentionOrder, isMappedCourse } from '../src/utils/courseStatus.js'
import { inferSkills } from '../src/utils/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { buildCapabilitySnapshot, validateSnapshot } from '../src/utils/capabilitySnapshot.js'

const extracted = { code: 'CPIT-240', name: 'Database (I)', grade: 'B', source: 'pdf' }

describe('field-level provenance', () => {
  it('keeps the extracted value when a student edits a field and forgets it when restored', () => {
    const edited = editCourseRow(extracted, 'grade', 'A')
    expect(edited.edits).toEqual({ grade: 'B' })
    expect(edited.source).toBe('manual')
    expect(edited.originalSource).toBe('pdf')
    const restored = editCourseRow(edited, 'grade', 'B')
    expect(restored.edits).toEqual({})
    expect(restored.source).toBe('pdf')
  })

  it('names a raised grade as self-declared instead of document evidence', () => {
    const raised = editCourseRow(extracted, 'grade', 'A+')
    expect(rowProvenance(raised)).toMatchObject({ level: 'edited', gradeRaised: true, edits: ['grade'] })
    const lowered = editCourseRow(extracted, 'grade', 'C')
    expect(rowProvenance(lowered)).toMatchObject({ level: 'edited', gradeRaised: false })
    expect(rowProvenance(extracted)).toMatchObject({ level: 'document', gradeRaised: false })
    expect(rowProvenance({ code: 'CPIT-251', name: 'x', grade: 'A', source: 'manual' }).level).toBe('declared')
    expect(rowProvenance({ code: 'CPIT-251', name: 'x', grade: 'A', source: 'demo' }).level).toBe('synthetic')
  })

  it('reports raised grades as visible, non-blocking review signals', () => {
    const rows = [editCourseRow(extracted, 'grade', 'A'), { code: 'STAT-201', name: 'Statistics', grade: 'B+', source: 'pdf' }]
    const quality = reviewProfileQuality(rows)
    expect(quality.canApprove).toBe(true)
    expect(quality.signals).toEqual([{ index: 0, code: 'CPIT-240', kind: 'grade-raised', from: 'B', to: 'A' }])
    expect(provenanceSignals([editCourseRow(extracted, 'name', 'Databases')])).toEqual([{ index: 0, code: 'CPIT-240', kind: 'edited', fields: ['name'] }])
  })

  it('aggregates the weakest row into the capability level', () => {
    const documentOnly = inferSkills([extracted])
    expect(skillProvenance(documentOnly[0]).level).toBe('document')
    const edited = inferSkills([editCourseRow(extracted, 'grade', 'A')])
    expect(skillProvenance(edited[0])).toMatchObject({ level: 'edited', gradeRaised: true })
    // Task 02: a hand-typed (declared) row is no longer evidence, so it cannot join the capability.
    const withManual = inferSkills([extracted, { code: 'CPIT-240', name: 'Databases', grade: 'A', source: 'manual', hours: 3 }])
    expect(withManual[0].evidence).toHaveLength(1)
    expect(skillProvenance(withManual[0]).level).toBe('document')
    const mixed = inferSkills([extracted, editCourseRow(extracted, 'name', 'Databases')])
    expect(skillProvenance(mixed[0]).level).toBe('mixed')
    expect(skillProvenance(inferSkills([{ ...extracted, source: 'demo' }])[0]).level).toBe('synthetic')
  })

  it('exports the provenance level with every studied claim in Person 360', () => {
    const state = { courses: [editCourseRow(extracted, 'grade', 'A'), extracted.code === 'CPIT-240' ? { code: 'CPIT-251', name: 'Systems', grade: 'A', source: 'manual' } : null].filter(Boolean), approved: true }
    const graph = projectStateToPerson360({ state, skills: inferSkills(state.courses) })
    const strengths = graph.claims.filter(c => c.predicate === 'kamin:studied').map(c => c.evidenceStrength).sort()
    expect(strengths).toEqual(['declared', 'edited-declared'])
    const evidence = graph.entities.find(e => e['@id'] === 'urn:kamin:evidence:course:cpit-240')
    expect(evidence).toMatchObject({ provenanceLevel: 'edited', editedFields: ['grade'], gradeRaisedByStudent: true })
    expect(provenanceStrength('document')).toBe('document-derived')
  })

  it('carries evidence levels inside shared snapshots and rejects unknown ones', () => {
    const snapshot = buildCapabilitySnapshot({ skillIds: ['database'], goal: null, levels: { database: 'edited', other: 'document' } })
    expect(snapshot.levels).toEqual({ database: 'edited' })
    expect(() => validateSnapshot({ ...snapshot, levels: { database: 'verified' } })).toThrow('INVALID_SNAPSHOT')
    expect(() => validateSnapshot({ ...snapshot, levels: { statistics: 'document' } })).toThrow('INVALID_SNAPSHOT')
    expect(buildCapabilitySnapshot({ skillIds: ['database'], goal: null }).levels).toBeUndefined()
  })
})

// Task 22 · the review screen's row status and "attention first" order (src/utils/courseStatus.js).
describe('review rows: status and attention first', () => {
  const mapped = { code: 'CPIT-240', name: 'Database (I)', grade: 'B', source: 'pdf' }
  const unmapped = { code: 'GEN-999', name: 'Seminar', grade: 'A', source: 'pdf' }
  it('a linked document row needs no look; an unlinked row and an edited grade do, with the reason on the row', () => {
    expect(courseStatus(mapped, { lang: 'en' })).toMatchObject({ attention: false, reasons: [], mapping: { kind: 'mapped' }, tone: 'mapped' })
    const u = courseStatus(unmapped, { lang: 'en' })
    expect(u).toMatchObject({ attention: true, mapping: { kind: 'unmapped' } })
    expect(u.reasons.map(r => r.text)).toEqual(['Not linked to a capability yet: it stays in your record but creates no capability.'])
    const raised = courseStatus(editCourseRow(mapped, 'grade', 'A'), { lang: 'en' })
    expect(raised.attention).toBe(true)
    expect(raised.reasons[0]).toMatchObject({ tone: 'edited' })
    expect(raised.reasons[0].text).toContain('You raised the grade of CPIT-240 from B to A')
    expect(courseStatus(editCourseRow(mapped, 'grade', 'A'), { lang: 'ar' }).reasons[0].text).toContain('رفعت درجة CPIT-240 من B إلى A')
  })
  it('problems from reviewProfileQuality are named on the row; a college without a map unlinks every course', () => {
    const rows = [mapped, { ...mapped }, { code: 'STAT-110', name: 'Statistics', grade: 'AAA', source: 'pdf' }]
    expect(issuesByRow(rows)).toEqual({ 1: 'duplicate', 2: 'grade' })
    expect(courseStatus(rows[2], { lang: 'en', issue: 'grade' }).reasons[0]).toMatchObject({ tone: 'issue', text: expect.stringContaining('Unrecognized grade') })
    const sci = courseStatus(mapped, { lang: 'en', college: 'SCI' })
    expect(sci.mapping).toMatchObject({ kind: 'unmapped', text: 'No approved map for your college yet' })
    expect(sci.reasons.map(r => r.text)).toEqual(['Your college has no approved course map yet, so this course creates no capability.'])
    expect(courseStatus(mapped, { lang: 'en', college: 'FCIT' }).attention).toBe(false)
  })
  it('lists the rows that need a look first, each group in transcript order', () => {
    const rows = [mapped, unmapped, { code: 'CPIT-251', name: 'Software Engineering', grade: 'B+', source: 'pdf' }, editCourseRow({ code: 'CPIT-250', name: 'Systems Analysis', grade: 'C', source: 'pdf' }, 'grade', 'B')]
    expect(attentionOrder(rows)).toEqual([1, 3, 0, 2])
    expect(attentionOrder([mapped])).toEqual([0])
    expect(attentionOrder([])).toEqual([])
  })
  it('a manually typed course on the approved map is linked but waits for a document', () => {
    expect(courseStatus({ code: 'CPIT-240', name: 'Databases', grade: 'A', source: 'manual' }, { lang: 'ar' }).mapping).toMatchObject({ kind: 'pending', text: expect.stringContaining('بانتظار مستند أو مراجعة') })
    expect(isMappedCourse('cpit 240')).toBe(true)
    expect(isMappedCourse('GEN-999')).toBe(false)
  })
})
