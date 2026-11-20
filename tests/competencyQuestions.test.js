import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import oxigraph from 'oxigraph'
import { buildWorkspaceDataset, courseCatalogNodes } from '../src/knowledge/workspace.js'
import { executeReadOnlyQuery } from '../src/knowledge/queryPolicy.js'
import { demoCourses } from '../src/data.js'
import { inferSkills } from '../src/utils/engine.js'
import { limitingReasons } from '../src/evidence/levels.js'
import { limitLine } from '../src/content/levelReasons.js'
import { recomputeProfile } from '../src/evidence/recompute.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { catalogCourses } from '../src/catalog/fcit.js'
import { JSON_LD_CONTEXT } from '../src/ontology/registry.js'

const dataset = buildWorkspaceDataset('demo')
const run = query => executeReadOnlyQuery(oxigraph.Store, dataset, query)
const values = (rows, key) => rows.map(row => row[key].value)
const PREFIX = 'PREFIX k: <urn:kamin:>\n'
const PROFILE = '<urn:kamin:graph:profile-input>'
const REFERENCE = '<urn:kamin:graph:reference>'

// Task 01 chain checks: course the student took → learning outcome → possible capability.
describe('Task 01 · course → learning outcome → capability chain over the demo graph', () => {
  it('"course taken → capability" returns rows', () => {
    const { rows } = run(`${PREFIX}SELECT DISTINCT ?course ?capability WHERE {
      GRAPH ${PROFILE} { ?person k:studied ?course }
      GRAPH ${REFERENCE} { ?course k:mapsToCapability ?capability }
    }`)
    expect(rows.length).toBeGreaterThan(0)
    const pairs = rows.map(r => `${r.course.value} ${r.capability.value}`)
    expect(pairs).toContain('urn:kamin:course:CPIT-240 urn:kamin:skill:database')
    expect(values(rows, 'course')).not.toContain('urn:kamin:course:CPIT-260')
  })

  it('every link in the chain carries its source, mapping version and review status', () => {
    const { rows } = run(`${PREFIX}SELECT ?course ?lo ?capability ?source ?version ?status WHERE {
      GRAPH ${PROFILE} { ?person k:studied ?course }
      GRAPH ${REFERENCE} {
        ?course k:hasLearningOutcome ?lo .
        ?lo k:supportsCapability ?capability ; k:catalogSource ?source ; k:mappingVersion ?version ; k:reviewStatus ?status .
      }
    }`)
    expect(rows.length).toBeGreaterThan(0)
    expect(new Set(values(rows, 'source'))).toEqual(new Set(['FCIT Catalog 2024-25']))
    expect(new Set(values(rows, 'version'))).toEqual(new Set(['fcit-map-v1']))
    expect(new Set(values(rows, 'status'))).toEqual(new Set(['proposed']))
  })

  it('an unmapped course the student took yields no capability (insufficient evidence → infer nothing)', () => {
    expect(run(`${PREFIX}ASK { GRAPH ${PROFILE} { ?person k:studied <urn:kamin:course:CPIT-260> } }`).value).toBe(true)
    expect(run(`${PREFIX}SELECT ?capability WHERE { <urn:kamin:course:CPIT-260> k:mapsToCapability ?capability }`).rows).toEqual([])
    expect(run(`${PREFIX}SELECT ?capability WHERE { <urn:kamin:course:CPIT-260> k:hasLearningOutcome ?lo . ?lo k:supportsCapability ?capability }`).rows).toEqual([])
    const { rows } = run(`${PREFIX}SELECT DISTINCT ?course WHERE {
      GRAPH ${PROFILE} { ?person k:studied ?course }
      FILTER NOT EXISTS { ?course k:mapsToCapability ?capability }
    }`)
    expect(values(rows, 'course')).toEqual(['urn:kamin:course:CPIT-260'])
  })

  it('every knowledge-graph and course-map relation keeps its source, decision role and review state (cq10)', () => {
    // Filtered per source/subject so the workspace's 100-row display cap cannot hide rows.
    const relation = (source, subject = '?s') => run(`${PREFIX}PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT ?s ?p ?o ?role ?reviewed ?status WHERE { GRAPH ${REFERENCE} {
        ?edge rdf:subject ?s ; rdf:predicate ?p ; rdf:object ?o ; k:sourceId "${source}" ; k:decisionRole ?role .
        ${subject === '?s' ? '' : `FILTER(?s = ${subject})`}
        OPTIONAL { ?edge k:reviewedAt ?reviewed } OPTIONAL { ?edge k:reviewStatus ?status } } }`).rows
    const esco = relation('source-esco-1.2.1')
    expect(esco.length).toBeGreaterThan(0)
    expect(esco.every(r => r.reviewed?.value === '2026-09-27')).toBe(true)
    expect(relation('source-onet-31.0').length).toBeGreaterThan(0)
    const db = relation('source-fcit-catalog-2024-25', '<urn:kamin:course:CPIT-240>').filter(r => r.p.value === 'urn:kamin:mapsToCapability')
    expect(db.map(r => [r.o.value, r.role.value, r.status.value])).toEqual([['urn:kamin:skill:database', 'academic-course-mapping', 'proposed']])
    // Not reviewed by the department yet, so no review date is claimed.
    expect(db[0].reviewed).toBeUndefined()
  })

  it('a course that is not in the catalog has no node to infer from', () => {
    expect(run(`${PREFIX}ASK { <urn:kamin:course:STAT-201> ?p ?o }`).value).toBe(false)
    expect(run(`${PREFIX}ASK { ?s ?p ?o FILTER(STRSTARTS(STR(?s), "urn:kamin:course-template:")) }`).value).toBe(false)
  })
})

// The ten official competency questions (cq01..cq10*.rq) from the project library, and the four
// evidence and review questions of Task 34 (cq11..cq14). Drop them in
// tests/fixtures/competency-questions/ with an expected.json; each file then becomes a test automatically.
const CQ_DIR = new URL('./fixtures/competency-questions/', import.meta.url)
const cqFiles = existsSync(CQ_DIR) ? readdirSync(CQ_DIR).filter(f => /^cq\d{2}.*\.rq$/i.test(f)).sort() : []
const expectedPath = new URL('expected.json', CQ_DIR)
const expected = existsSync(expectedPath) ? JSON.parse(readFileSync(expectedPath, 'utf8')) : {}

describe('Task 01 · ten SPARQL competency questions (+ Task 34: cq11..cq14)', () => {
  if (!cqFiles.length) {
    it.todo('cq01..cq10 — waiting for the .rq files from kamin/competency-questions/queries/')
    return
  }
  // Task 34 adds cq11..cq14, so the file count goes from 10 to 14; the ten originals are still checked by name.
  it('has all fourteen questions (the ten from Task 01 and four from Task 34)', () => {
    expect(cqFiles).toHaveLength(14)
    expect(cqFiles.filter(f => /^cq(0\d|10)-/.test(f))).toHaveLength(10)
    expect(cqFiles.filter(f => /^cq1[1-4]-/.test(f))).toHaveLength(4)
  })
  for (const file of cqFiles) {
    it(`${file} answers as expected`, () => {
      const result = run(readFileSync(new URL(file, CQ_DIR), 'utf8'))
      const spec = expected[file]
      expect(spec, `add an entry for ${file} in expected.json`).toBeTruthy()
      if (result.kind === 'ask') return expect(result.value).toBe(spec.ask)
      if ('rows' in spec) expect(result.rows.length).toBe(spec.rows)
      if ('minRows' in spec) expect(result.rows.length).toBeGreaterThanOrEqual(spec.minRows)
      for (const [variable, list] of Object.entries(spec.contains || {})) expect(values(result.rows.filter(r => r[variable]), variable)).toEqual(expect.arrayContaining(list))
      for (const [variable, list] of Object.entries(spec.excludes || {})) for (const value of list) expect(values(result.rows.filter(r => r[variable]), variable)).not.toContain(value)
    })
  }
})

// Task 34 · the evidence rules (Task 02) and the recompute rule (Task 04) asked of the graph.
describe('Task 34 · competency questions about evidence and review', () => {
  const cq = file => readFileSync(new URL(file, CQ_DIR), 'utf8')
  const runOn = (data, file) => executeReadOnlyQuery(oxigraph.Store, data, cq(file))
  // cq11 rows → { capability IRI: sorted factor codes }
  const factorsByCap = rows => {
    const map = {}
    for (const row of rows) (map[row.cap.value] ||= []).push(row.factor.value)
    for (const list of Object.values(map)) list.sort()
    return map
  }
  // What the dashboard's "Why is this level limited?" line names for each capability.
  const dashboardCodes = skills => Object.fromEntries(skills.filter(s => s.evidenceLevel !== 'strong').map(s => {
    const code = (s.evidence.find(e => e.reasons === s.reasons) || s.evidence[0])?.code
    return [`urn:kamin:skill:${s.id}`, [...limitLine(s, 'en', { code }).codes].sort()]
  }))
  const state = courses => ({ approved: true, college: 'FCIT', consents: { analyze: true }, courses })
  const personal = (profile, skills) => buildWorkspaceDataset('personal', { allowPersonal: true, personalGraph: projectStateToPerson360({ state: profile, skills }) })
  const withGrade = (code, grade) => demoCourses.map(c => (c.code === code ? { ...c, grade } : c))

  it('cq11: every capability of the demo person that is not strong, with the dashboard\'s limiting factors', () => {
    const { rows, truncated } = run(cq('cq11-limited-and-why.rq'))
    expect(truncated).toBe(false)
    expect(rows.every(r => r.level.value !== 'strong')).toBe(true)
    const skills = inferSkills(demoCourses)
    expect(skills.length).toBeGreaterThan(0)
    expect(factorsByCap(rows)).toEqual(dashboardCodes(skills))
    // and the same codes limitingReasons() gives in code
    for (const skill of skills) expect(factorsByCap(rows)[`urn:kamin:skill:${skill.id}`]).toEqual([...new Set(limitingReasons(skill).map(r => r.code))].sort())
    // today every demo capability is limited because the course links are still proposed
    expect(new Set(rows.map(r => r.factor.value))).toContain('mapping-proposed')
  })

  it('cq11: a low grade shows up as its own factor, matching the dashboard line', () => {
    const profile = state(withGrade('CPIT-240', 'D'))
    const skills = recomputeProfile(state(demoCourses), profile).skills
    const map = factorsByCap(runOn(personal(profile, skills), 'cq11-limited-and-why.rq').rows)
    expect(map['urn:kamin:skill:database']).toEqual(['assessment-unknown', 'grade-low', 'mapping-proposed'])
    expect(map).toEqual(dashboardCodes(skills))
  })

  it('cq12: 46 course → capability links are still "proposed" (30×1 + 8×2), under the 100-row cap', () => {
    const { rows, truncated } = run(cq('cq12-unreviewed-mappings.rq'))
    expect(truncated).toBe(false)
    expect(rows).toHaveLength(46)
    const expectedLinks = catalogCourses.filter(c => !(c.reviewedBy && c.reviewedAt)).reduce((n, c) => n + c.capabilities.length, 0)
    expect(expectedLinks).toBe(46)
    expect(rows.map(r => `${r.course.value} ${r.cap.value}`)).toContain('urn:kamin:course:CPIT-240 urn:kamin:skill:database')
  })

  it('cq12: 0 rows once every course mapping is reviewed (the shape of Task 32\'s "all approved" catalogue)', () => {
    const reviewed = catalogCourses.map(c => ({ ...c, reviewedBy: 'department (test fixture)', reviewedAt: '2026-11-18' }))
    const data = { '@context': JSON_LD_CONTEXT, '@graph': [{ '@id': 'urn:kamin:graph:reference', '@graph': courseCatalogNodes(reviewed) }] }
    expect(runOn(data, 'cq12-unreviewed-mappings.rq').rows).toEqual([])
    // the same nodes with the real catalogue give the 46 again, so the 0 is not an empty graph
    expect(runOn({ ...data, '@graph': [{ '@id': 'urn:kamin:graph:reference', '@graph': courseCatalogNodes(catalogCourses) }] }, 'cq12-unreviewed-mappings.rq').rows).toHaveLength(46)
  })

  it('cq13: no kamin:demonstrates claim without prov:wasDerivedFrom; the question would catch one', () => {
    expect(run(cq('cq13-no-claim-without-evidence.rq')).value).toBe(false)
    const broken = JSON.parse(JSON.stringify(dataset))
    const profile = broken['@graph'].find(g => g['@id'] === 'urn:kamin:graph:profile-input')['@graph'].find(n => Array.isArray(n.claims))
    delete profile.claims.find(c => c.predicate === 'kamin:demonstrates').source
    expect(runOn(broken, 'cq13-no-claim-without-evidence.rq').value).toBe(true)
  })

  it('cq14: no academic capability rests on a hand-typed row; the question would catch one', () => {
    expect(run(cq('cq14-self-report-stays-self-report.rq')).rows).toEqual([])
    // A typed row creates no capability (inferSkills skips it), so force one into the projector to
    // show the query is not blind: the evidence entity of a manual row says provenanceLevel "declared".
    const typed = { code: 'CPIT-240', name: 'Databases', grade: 'A', source: 'manual' }
    expect(inferSkills([typed])).toEqual([])
    const forced = [{ id: 'database', labels: { en: 'Database' }, evidence: [{ code: 'CPIT-240', evidenceLevel: 'limited', basis: 'academic' }] }]
    const rows = runOn(personal(state([typed]), forced), 'cq14-self-report-stays-self-report.rq').rows
    expect(rows.map(r => r.evidence.value)).toEqual(['urn:kamin:evidence:course:cpit-240'])
  })

  it('cq11–cq14 after a recompute (grade A → F on CPIT-250): cq13 stays false and no claim keeps the failed row', () => {
    const before = state(demoCourses)
    const after = state(withGrade('CPIT-250', 'F'))
    const { skills, diff } = recomputeProfile(before, after)
    expect(diff.droppedEvidence.map(d => [d.courseCode, d.skillId, d.reason])).toEqual([['CPIT-250', 'requirements', 'grade-now-non-evidence']])
    const data = personal(after, skills)
    const graph = data['@graph'].find(g => g['@id'] === 'urn:kamin:graph:profile-input')['@graph'].find(n => Array.isArray(n.claims))
    expect(graph.claims.filter(c => c.predicate === 'kamin:demonstrates').map(c => c.source)).not.toContain('urn:kamin:evidence:course:cpit-250')

    expect(runOn(data, 'cq13-no-claim-without-evidence.rq').value).toBe(false)
    expect(runOn(data, 'cq14-self-report-stays-self-report.rq').rows).toEqual([])
    expect(runOn(data, 'cq12-unreviewed-mappings.rq').rows).toHaveLength(46)
    const map = factorsByCap(runOn(data, 'cq11-limited-and-why.rq').rows)
    expect(map['urn:kamin:skill:requirements']).toEqual(['assessment-unknown', 'mapping-proposed'])
    expect(map).toEqual(dashboardCodes(skills))
  })
})
