import { describe, it, expect } from 'vitest'
import { FCIT_CATALOG, catalogCourses, catalogCourse, courseMappingStatus, deriveCourseSkillMap, mappingReviewStatus } from '../src/catalog/fcit.js'
import { courseSkillMap, demoCourses, skills } from '../src/data.js'
import { inferSkills } from '../src/utils/engine.js'
import { reviewProfileQuality } from '../src/utils/profileQuality.js'
import { canonicalCourseCode, courseIri, learningOutcomeIri } from '../src/ontology/registry.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { buildReferenceDataset } from '../src/knowledge/workspace.js'
import { ictKnowledgeGraph, ICT_KG_IDS } from '../src/knowledge/ictKgV1.js'
import { mappingGovernance } from '../src/catalog/governance.js'

const ids = courses => inferSkills(courses).map(s => s.id)

describe('Task 01 · official FCIT course map (FCIT Catalog 2024-25)', () => {
  it('no longer reads CPIT-260 (Operating Systems) as Databases', () => {
    expect(ids([{ code: 'CPIT-260', grade: 'A', source: 'pdf' }])).not.toContain('database')
    expect(ids([{ code: 'CPIT-260', grade: 'A', source: 'pdf' }])).toEqual([])
    expect(catalogCourse('CPIT-260').title.en).toBe('Operating Systems')
  })

  it('reads CPIT-240 (Database I) as Databases', () => {
    expect(ids([{ code: 'CPIT-240', grade: 'A', source: 'pdf' }])).toContain('database')
    expect(ids([{ code: 'cpit 240', grade: 'A', source: 'pdf' }])).toContain('database')
  })

  it('uses the official codes, titles and pages from the FCIT Catalog 2024-25', () => {
    const expected = {
      'CPIT-240': ['Databases (I)', 60],
      'CPIT-250': ['System Analysis & Design', 60],
      'CPIT-251': ['Software Engineering (I)', 60],
      'CPIT-252': ['Software Design Patterns', 60],
      'CPIT-260': ['Operating Systems', 60],
      'CPIT-305': ['Advanced Programming', 61],
      'CPIS-334': ['Introduction to Software Project Management', 43],
      'STAT-110': ['General Statistics (1)', 10],
      'STAT-210': ['Probability Theory', 10],
      'CPIT-499': ['Senior Project (II)', 64],
    }
    for (const [code, [title, page]] of Object.entries(expected)) {
      expect(catalogCourse(code)?.title.en).toBe(title)
      expect(catalogCourse(code)?.catalogPage).toBe(page)
    }
    expect(catalogCourse('STAT-201')).toBeNull()
  })

  it('maps the corrected courses as the catalog descriptions support', () => {
    const caps = code => catalogCourse(code).capabilities
    expect(caps('CPIT-240')).toEqual(['database'])
    expect(caps('CPIT-250')).toEqual(['requirements'])
    expect(caps('CPIT-252')).toEqual(['software'])
    expect(caps('CPIT-260')).toEqual([])
    expect(caps('CPIT-305')).toEqual([])
    expect(caps('CPIS-334')).toEqual(['project'])
    // Senior Project (II): "detail design, coding, testing, and project implementation".
    expect([...caps('CPIT-499')].sort()).toEqual(['project', 'software'])
    expect(catalogCourse('CPIT-499').evidenceType).toBe('applied')
  })

  it('covers all three FCIT programmes without granting specialist capabilities', () => {
    const prefixes = new Set(catalogCourses.map(c => c.code.split('-')[0]))
    for (const prefix of ['CPIT', 'CPCS', 'CPIS', 'STAT']) expect(prefixes.has(prefix)).toBe(true)
    for (const course of catalogCourses) for (const id of ['testing', 'db-operations', 'web-development', 'systems-analysis']) expect(course.capabilities).not.toContain(id)
  })

  it('creates no capability for a course missing from the map, and reports it as not mapped', () => {
    for (const code of ['ZZZZ-999', 'STAT-201', 'CPIT-260', 'CPIT-305']) {
      expect(ids([{ code, grade: 'A', source: 'pdf' }])).toEqual([])
      expect(courseSkillMap[code]).toBeUndefined()
      expect(reviewProfileQuality([{ code, name: 'x', grade: 'A' }]).mapped).toBe(0)
    }
    expect(courseMappingStatus('ZZZZ-999')).toBe('not-in-catalog')
    expect(courseMappingStatus('CPIT-260')).toBe('official-unmapped')
    expect(courseMappingStatus('CPIT-240')).toBe('mapped')
  })

  it('gives every entry a catalog, mapping version, proposed outcomes and an existing capability', () => {
    expect(catalogCourses.length).toBeGreaterThanOrEqual(6)
    const codes = new Set()
    for (const course of catalogCourses) {
      expect(course.code).toBe(canonicalCourseCode(course.code))
      expect(codes.has(course.code)).toBe(false)
      codes.add(course.code)
      expect(course.catalog).toBe('FCIT Catalog 2024-25')
      expect(course.college).toBe('FCIT')
      expect(course.mappingVersion).toBe('fcit-map-v1')
      expect(['exam', 'project', 'lab', 'mixed', 'unknown']).toContain(course.assessment)
      expect(course.learningOutcomes.length).toBeGreaterThan(0)
      for (const lo of course.learningOutcomes) {
        expect(lo.id.startsWith(`${course.code}-LO`)).toBe(true)
        expect(lo.ar && lo.en).toBeTruthy()
        expect(lo.status).toBe('proposed')
      }
      // No new capabilities in this task.
      for (const id of course.capabilities) expect(skills[id]).toBeTruthy()
      // Nothing is reviewed until a named reviewer and a date are recorded.
      expect(mappingReviewStatus(course)).toBe(course.reviewedBy && course.reviewedAt ? 'reviewed' : 'proposed')
      // Checked against the 70-page catalog PDF; the catalog is English-only, so no invented Arabic title.
      expect(course.verification).toBe('checked-against-catalog')
      expect(Number.isInteger(course.catalogPage) && course.catalogPage >= 1 && course.catalogPage <= 70).toBe(true)
      expect(course.title.en).toBeTruthy()
      expect(course.title.ar).toBeNull()
      expect(['knowledge', 'applied']).toContain(course.evidenceType)
    }
  })

  it('keeps courseSkillMap as a derived export in the published schema shape', () => {
    expect(courseSkillMap).toEqual(deriveCourseSkillMap())
    for (const mapping of Object.values(courseSkillMap)) {
      expect(Object.keys(mapping).sort()).toEqual(['evidenceType', 'learningOutcome', 'skills'])
      expect(mapping.skills.length).toBeGreaterThan(0)
      expect(Object.keys(mapping.learningOutcome).sort()).toEqual(['ar', 'en'])
    }
    expect(mappingGovernance('CPIT-240')).toMatchObject({ version: 'fcit-map-v1', reviewStatus: 'proposed', source: { title: 'FCIT Catalog 2024-25' } })
  })

  it('uses only official codes in the demo, including one deliberately unmapped course', () => {
    for (const course of demoCourses) expect(catalogCourse(course.code)).toBeTruthy()
    expect(demoCourses.filter(c => !courseSkillMap[c.code]).map(c => c.code)).toEqual(['CPIT-260'])
    expect(ids(demoCourses).sort()).toEqual(['database', 'project', 'requirements', 'software', 'statistics'])
  })
})

describe('Task 01 · one course IRI across every graph', () => {
  it('builds upper-case course IRIs from the canonical code', () => {
    expect(courseIri('cpit 240')).toBe('urn:kamin:course:CPIT-240')
    expect(courseIri('CPIT240')).toBe('urn:kamin:course:CPIT-240')
    expect(learningOutcomeIri('cpit-240-lo1')).toBe('urn:kamin:learning-outcome:CPIT-240-LO1')
  })

  it('uses the same IRI in the personal graph, the reference graph and the ICT knowledge graph', () => {
    const graph = projectStateToPerson360({ state: { courses: [{ code: 'cpit 240', name: 'Database', grade: 'A', source: 'pdf' }] }, skills: [] })
    const studied = graph.claims.find(c => c.predicate === 'kamin:studied')
    expect(studied.object).toBe('urn:kamin:course:CPIT-240')
    const reference = buildReferenceDataset()['@graph'][0]['@graph']
    expect(reference.some(n => n['@id'] === 'urn:kamin:course:CPIT-240')).toBe(true)
    expect(ICT_KG_IDS.courseDb).toBe('urn:kamin:course:CPIT-240')
    expect(JSON.stringify(ictKnowledgeGraph)).not.toContain('course-template')
    expect(JSON.stringify(reference)).not.toMatch(/urn:kamin:course:[a-z]/)
  })

  it('emits course → learning outcome → capability with mapping version and review status', () => {
    const nodes = buildReferenceDataset()['@graph'][0]['@graph']
    // Several JSON-LD nodes may share one IRI (catalog entry + ICT knowledge graph); RDF merges them.
    const reference = [...nodes.reduce((byId, n) => byId.set(n['@id'], { ...byId.get(n['@id']), ...n }), new Map()).values()]
    const course = reference.find(n => n['@id'] === courseIri('CPIT-240'))
    expect(course['kamin:developsCapability']).toEqual({ '@id': 'urn:kamin:skill:database' })
    expect(course['kamin:hasLearningOutcome']).toEqual([{ '@id': learningOutcomeIri('CPIT-240-LO1') }])
    expect(course['kamin:mappingVersion']).toBe('fcit-map-v1')
    expect(course['kamin:reviewStatus']).toBe('proposed')
    const lo = reference.find(n => n['@id'] === learningOutcomeIri('CPIT-240-LO1'))
    expect(lo['kamin:supportsCapability']).toEqual([{ '@id': 'urn:kamin:skill:database' }])
    expect(lo['kamin:reviewStatus']).toBe('proposed')
    const os = reference.find(n => n['@id'] === courseIri('CPIT-260'))
    expect(os['kamin:mapsToCapability']).toEqual([])
  })
})

describe('Task 01 · catalog file metadata', () => {
  it('names a single source', () => {
    expect(FCIT_CATALOG.catalog).toBe('FCIT Catalog 2024-25')
    expect(FCIT_CATALOG.mappingVersion).toBe('fcit-map-v1')
  })
})
