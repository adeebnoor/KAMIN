import { describe, it, expect } from 'vitest'
import { buildClrExport, CLR_CONTEXT, clrExportFilename } from '../src/utils/clrExport.js'
import { inferSkills } from '../src/utils/engine.js'
import { editCourseRow } from '../src/utils/provenance.js'
import { createProjectEvidence } from '../src/utils/projectEvidence.js'

const extracted = { code: 'CPIT-260', name: 'Database Systems', grade: 'B', source: 'pdf' }
const now = new Date('2026-09-30T12:00:00Z')

describe('CLR 2.0-shaped portable export', () => {
  it('is an unsigned, self-asserted credential with one achievement per evidenced capability', () => {
    const courses = [editCourseRow(extracted, 'grade', 'A'), { code: 'STAT-201', name: 'Statistics', grade: 'B+', source: 'pdf' }, { code: 'ZZZZ-999', name: 'Unmapped', grade: 'A', source: 'manual' }]
    const project = createProjectEvidence({ title: 'SQL lab', kind: 'project', url: 'https://example.com/lab', description: '', skillIds: ['database'] }, now)
    const state = { courses, approved: true, goal: 'data', projects: [project] }
    const skills = inferSkills(courses)
    const doc = buildClrExport({ state, skills, lang: 'en', now })
    expect(doc['@context']).toEqual(CLR_CONTEXT)
    expect(doc.type).toEqual(['VerifiableCredential', 'ClrCredential'])
    expect(doc.proof).toBeUndefined()
    expect(doc['kamin:verificationStatus']).toBe('self-asserted')
    expect(doc.issuer.id).toBe('urn:kamin:issuer:self')
    const achievements = doc.credentialSubject.verifiableCredential
    expect(achievements).toHaveLength(skills.length)
    const database = achievements.find(a => a.credentialSubject.achievement.id.endsWith('database'))
    expect(database['kamin:provenanceLevel']).toBe('edited')
    expect(database.credentialSubject.result[0]).toMatchObject({ value: 'A', 'kamin:provenanceLevel': 'edited', 'kamin:editedFields': ['grade'], 'kamin:gradeRaisedByStudent': true })
    expect(database.evidence).toEqual([expect.objectContaining({ id: 'https://example.com/lab', 'kamin:reviewStatus': 'unreviewed' })])
    expect(achievements.every(a => a.proof === undefined && a['kamin:verificationStatus'] === 'self-asserted')).toBe(true)
    expect(doc.credentialSubject['kamin:unmappedCourses'].map(r => r['kamin:course'].code)).toEqual(['ZZZZ-999'])
    expect(doc.credentialSubject['kamin:goal']).toBe('Data analytics')
    expect(clrExportFilename(now)).toBe('kamin-clr-export-2026-09-30.jsonld')
  })

  it('serialises cleanly and rejects a missing state', () => {
    expect(() => buildClrExport({ state: null })).toThrow('PROFILE_STATE_REQUIRED')
    const doc = buildClrExport({ state: { courses: [], projects: [] }, skills: [], lang: 'ar', now })
    expect(JSON.parse(JSON.stringify(doc)).credentialSubject.verifiableCredential).toEqual([])
    expect(doc.name).toContain('غير موقّع')
  })
})
