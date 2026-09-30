import { describe, it, expect } from 'vitest'
import { editCourseRow, rowProvenance, skillProvenance, provenanceSignals, provenanceStrength } from '../src/utils/provenance.js'
import { reviewProfileQuality } from '../src/utils/profileQuality.js'
import { inferSkills } from '../src/utils/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { buildCapabilitySnapshot, validateSnapshot } from '../src/utils/capabilitySnapshot.js'

const extracted = { code: 'CPIT-260', name: 'Database Systems', grade: 'B', source: 'pdf' }

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
    expect(quality.signals).toEqual([{ index: 0, code: 'CPIT-260', kind: 'grade-raised', from: 'B', to: 'A' }])
    expect(provenanceSignals([editCourseRow(extracted, 'name', 'Databases')])).toEqual([{ index: 0, code: 'CPIT-260', kind: 'edited', fields: ['name'] }])
  })

  it('aggregates the weakest row into the capability level', () => {
    const documentOnly = inferSkills([extracted])
    expect(skillProvenance(documentOnly[0]).level).toBe('document')
    const edited = inferSkills([editCourseRow(extracted, 'grade', 'A')])
    expect(skillProvenance(edited[0])).toMatchObject({ level: 'edited', gradeRaised: true })
    const mixed = inferSkills([extracted, { code: 'CPIT-260', name: 'Databases', grade: 'A', source: 'manual', hours: 3 }])
    expect(skillProvenance(mixed[0]).level).toBe('mixed')
    expect(skillProvenance(inferSkills([{ ...extracted, source: 'demo' }])[0]).level).toBe('synthetic')
  })

  it('exports the provenance level with every studied claim in Person 360', () => {
    const state = { courses: [editCourseRow(extracted, 'grade', 'A'), extracted.code === 'CPIT-260' ? { code: 'CPIT-251', name: 'Systems', grade: 'A', source: 'manual' } : null].filter(Boolean), approved: true }
    const graph = projectStateToPerson360({ state, skills: inferSkills(state.courses) })
    const strengths = graph.claims.filter(c => c.predicate === 'kamin:studied').map(c => c.evidenceStrength).sort()
    expect(strengths).toEqual(['declared', 'edited-declared'])
    const evidence = graph.entities.find(e => e['@id'] === 'urn:kamin:evidence:course:cpit-260')
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
