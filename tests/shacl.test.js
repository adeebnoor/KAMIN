// Task 33 · the SHACL shapes are run, not decoration. Every `npm test` validates, against
// ontology/kamin-shapes.ttl, with a local pinned validator (rdf-validate-shacl, dev dependency only):
//   - the demo knowledge-workspace graph (buildWorkspaceDataset('demo')),
//   - the frozen demo profile fixture (tests/fixtures/shacl/demo-profile.jsonld, the hand check),
//   - the graph of every synthetic KAU transcript (Task 50) after approval.
// It also proves the shapes catch what they must: a kamin:demonstrates claim without evidenceLevel
// gives exactly one violation, on that claim.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describeViolations, jsonLdQuads, validateGraph } from './helpers/shacl.js'
import { readPdf } from './helpers/readPdfText.js'
import { buildWorkspaceDataset } from '../src/knowledge/workspace.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { readTranscriptPages } from '../src/utils/transcript.js'
import { canonicalCourseCode } from '../src/utils/profileQuality.js'
import { profileSkills } from '../src/utils/engine.js'
import { FIXTURES, FIXTURE_DIR } from '../scripts/make-transcript-fixtures.mjs'
import { compareTerms, coverageGraph } from '../scripts/ontology-terms.mjs'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'
import { buildInferenceDataset } from '../src/ontology/rdf.js'
import { JSON_LD_CONTEXT } from '../src/ontology/registry.js'

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
const K = 'urn:kamin:'
const clone = value => JSON.parse(JSON.stringify(value))
const expectConforms = async (document, where) => {
  const { conforms, violations } = await validateGraph(document)
  expect(violations, `${where}:\n${describeViolations(violations)}`).toEqual([])
  expect(conforms).toBe(true)
}
// How many nodes each shape really looks at, so "0 violations" cannot come from an empty target.
const targets = document => {
  const quads = jsonLdQuads(document)
  const claims = new Set(quads.filter(q => q.predicate.value === RDF_TYPE && q.object.value === `${K}Claim`).map(q => q.subject.value))
  const demonstrates = new Set(quads.filter(q => claims.has(q.subject.value) && q.predicate.value === `${K}predicate` && q.object.value === `${K}demonstrates`).map(q => q.subject.value))
  const mappings = new Set(quads.filter(q => [`${K}mapsToCapability`, `${K}hasLearningOutcome`, `${K}supportsCapability`].includes(q.predicate.value)).map(q => q.subject.value))
  return { claims: claims.size, demonstrates: demonstrates.size, mappings: mappings.size }
}
const profileOf = dataset => dataset['@graph'].find(g => g['@id'] === 'urn:kamin:graph:profile-input')['@graph'][0]
const referenceOf = dataset => dataset['@graph'].find(g => g['@id'] === 'urn:kamin:graph:reference')['@graph']

describe('Task 33 · SHACL on the demo knowledge-workspace graph', () => {
  const demo = buildWorkspaceDataset('demo')

  it('has claims, kamin:demonstrates claims and course mappings for the shapes to check', () => {
    const count = targets(demo)
    expect(count.claims).toBeGreaterThan(10)
    expect(count.demonstrates).toBeGreaterThan(0)
    expect(count.mappings).toBeGreaterThan(40)
  })

  it('validates with 0 violations', async () => {
    await expectConforms(demo, 'demo workspace graph')
  })

  it('a kamin:demonstrates claim with no evidenceLevel gives exactly one violation, on that claim', async () => {
    const broken = clone(demo)
    const claim = profileOf(broken).claims.find(c => c.predicate === 'kamin:demonstrates')
    delete claim.evidenceLevel
    const { conforms, violations } = await validateGraph(broken)
    expect(conforms).toBe(false)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ focusNode: claim['@id'], shape: 'kamin:EvidenceClaimShape' })
    expect(describeViolations(violations)).toContain(claim['@id'])
  })

  it('an evidence level outside none, limited, moderate, strong, a missing basis or rule version is a violation', async () => {
    for (const [key, value] of [['evidenceLevel', 'high'], ['evidenceBasis', undefined], ['evidenceLevelsVersion', undefined]]) {
      const broken = clone(demo)
      const claim = profileOf(broken).claims.find(c => c.predicate === 'kamin:demonstrates')
      if (value === undefined) delete claim[key]; else claim[key] = value
      const { violations } = await validateGraph(broken)
      expect(violations.map(v => [v.focusNode, v.shape]), key).toEqual([[claim['@id'], 'kamin:EvidenceClaimShape']])
    }
  })

  it('other claims do not need an evidence level: the demo graph conforms although its studied-course claims have none', () => {
    const studied = profileOf(demo).claims.filter(c => c.predicate === 'kamin:studied')
    expect(studied.length).toBeGreaterThan(0)
    expect(studied.every(c => c.evidenceLevel === undefined)).toBe(true)
  })

  it('a course mapping needs one mapping version, one review status (proposed or reviewed) and its catalog source', async () => {
    const cases = [
      ['kamin:catalogSource', undefined, 'urn:kamin:catalogSource'],
      ['kamin:mappingVersion', undefined, 'urn:kamin:mappingVersion'],
      ['kamin:reviewStatus', 'approved', 'urn:kamin:reviewStatus'],
      ['kamin:reviewStatus', ['proposed', 'reviewed'], 'urn:kamin:reviewStatus'],
    ]
    for (const [key, value, pathIri] of cases) {
      const broken = clone(demo)
      const course = referenceOf(broken).find(n => n['@type'] === 'Course' && n['kamin:mapsToCapability']?.length)
      if (value === undefined) delete course[key]; else course[key] = value
      const { violations } = await validateGraph(broken)
      expect(violations.map(v => [v.focusNode, v.path]), `${key} = ${JSON.stringify(value)}`).toEqual([[course['@id'], pathIri]])
    }
  })

  it('a claim without its source, activity or time breaks the claim shape', async () => {
    const broken = clone(demo)
    const claim = profileOf(broken).claims.find(c => c.predicate === 'kamin:studied')
    delete claim.generatedAtTime
    const { violations } = await validateGraph(broken)
    expect(violations.map(v => [v.focusNode, v.path])).toEqual([[claim['@id'], 'http://www.w3.org/ns/prov#generatedAtTime']])
  })
})

describe('Task 33 · SHACL on the frozen demo profile (the hand check)', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/shacl/demo-profile.jsonld', import.meta.url), 'utf8'))

  it('has kamin:demonstrates claims to check', () => {
    expect(fixture['@context']).toBe('/ontology/kamin-context.jsonld')
    expect(targets(fixture).demonstrates).toBeGreaterThan(0)
  })

  it('validates with 0 violations (delete an evidenceLevel in the fixture and this test names the claim)', async () => {
    await expectConforms(fixture, 'tests/fixtures/shacl/demo-profile.jsonld')
  })
})

describe('Task 33 · SHACL on each synthetic KAU transcript after approval', () => {
  const graphs = Promise.all(FIXTURES.filter(def => !def.scanned).map(async def => {
    const pdf = await readPdf(path.join(FIXTURE_DIR, `${def.name}.pdf`))
    const result = readTranscriptPages(pdf.pages)
    // App.jsx upload → review → approve: the rows the student approved, and the college read from the transcript.
    const courses = result.courses.map(row => ({ ...row, code: canonicalCourseCode(row.code), source: row.source || 'pdf' }))
    const state = { approved: true, courses, college: result.student.collegeId, consents: { analyze: true } }
    const person = projectStateToPerson360({ state, skills: profileSkills(state) })
    return { name: def.name, courses, person, dataset: buildWorkspaceDataset('personal', { personalGraph: person, allowPersonal: true }) }
  }))

  it.each(FIXTURES.filter(def => !def.scanned).map(def => def.name))('%s: the workspace graph validates with 0 violations and uses only declared terms', async name => {
    const { courses, person, dataset } = (await graphs).find(g => g.name === name)
    expect(courses.length).toBeGreaterThan(0)
    expect(person.claims.filter(c => c.predicate === 'kamin:studied').length).toBe(new Set(courses.map(c => c.code)).size)
    expect(targets(dataset).claims).toBeGreaterThan(0)
    await expectConforms(dataset, `${name} after approval`)
    expect(compareTerms({ documents: [{ name, document: dataset }] }).undeclared).toEqual([])
  })

  it('at least one transcript yields kamin:demonstrates claims, so the evidence shape is exercised', async () => {
    const counts = (await graphs).map(g => targets(g.dataset).demonstrates)
    expect(Math.max(...counts)).toBeGreaterThan(0)
  })
})

// Task 78: the coverage profile of scripts/ontology-terms.mjs now holds three goals (one kamin:pursuesGoal claim each) and
// three interest areas and three work values (one kamin:prefers:<scheme> claim each). Its workspace graph, with the
// inference graph of every pathway, validates and uses only declared terms.
describe('Task 78 · SHACL on a profile with 3 goals, 3 interest areas and 3 work values', () => {
  const person = coverageGraph()
  const dataset = buildWorkspaceDataset('personal', { personalGraph: person, allowPersonal: true })

  it('the profile holds the claims the shapes must see: 3 goal claims and 3 + 3 preference claims', () => {
    expect(person.claims.filter(c => c.predicate === 'kamin:pursuesGoal')).toHaveLength(3)
    expect(person.claims.filter(c => c.predicate === 'kamin:prefers:careerInterest')).toHaveLength(3)
    expect(person.claims.filter(c => c.predicate === 'kamin:prefers:workValue')).toHaveLength(3)
    expect(targets(dataset).claims).toBeGreaterThan(10)
  })

  it('the workspace graph validates with 0 violations and uses only declared terms', async () => {
    await expectConforms(dataset, 'coverage profile with several goals and values')
    expect(compareTerms({ documents: [{ name: 'task-78', document: dataset }] }).undeclared).toEqual([])
  })

  it('the inference graph of every pathway validates with 0 violations', async () => {
    const matches = matchTargets(buildMatchingProfile({ graph: person }), { lang: 'en' })
    const inference = { '@context': JSON_LD_CONTEXT, '@graph': matches.flatMap(match => buildInferenceDataset(person, match)['@graph']) }
    expect(matches.flatMap(m => m.inferences).filter(i => i.ruleId === 'R3').length).toBeGreaterThan(matches.length)
    await expectConforms(inference, 'inference graph with several goals and values')
  })
})
