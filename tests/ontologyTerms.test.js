// Task 33 · every kamin: term the app writes is declared in ontology/kamin-core.ttl.
// "Written" is measured on the graphs the app really builds (scripts/ontology-terms.mjs), not by grep.
// If a new predicate, class or JSON key (the context's @vocab turns every key into a kamin: term)
// appears without a declaration, the first test fails and lists it.
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import oxigraph from 'oxigraph'
import { compareTerms, declaredTerms, emittedDocuments, KAMIN } from '../scripts/ontology-terms.mjs'
import { KAMIN_ONTOLOGY_VERSION } from '../src/ontology/registry.js'
import { DECLARED_PREFERENCE_SCHEMES } from '../src/insight.js'
import { emptyPerson360 } from '../src/person360.js'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const CORE = read('ontology/kamin-core.ttl')
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#'
const OWL = 'http://www.w3.org/2002/07/owl#'
const SCHEMA = 'https://schema.org/'
const quads = turtle => {
  const store = new oxigraph.Store()
  try { store.load(turtle, { format: 'text/turtle' }); return store.match() } finally { store.free() }
}
const coreQuads = quads(CORE)
const objects = (subject, predicate) => coreQuads.filter(q => q.subject.value === subject && q.predicate.value === predicate).map(q => q.object)
const short = iri => iri.replace(KAMIN, 'kamin:')

const documents = emittedDocuments()
const report = compareTerms({ documents })

describe('Task 33 · used kamin: terms are declared', () => {
  it('0 used-but-undeclared terms over every graph the app builds', () => {
    expect(report.graphs).toEqual(['workspace-demo', 'coverage-profile', 'coverage-inference', 'coverage-workspace', 'ict-kg'])
    expect(report.used.length).toBeGreaterThan(100)
    expect(report.undeclared.map(short), 'declare these in ontology/kamin-core.ttl').toEqual([])
  })

  it('node scripts/ontology-terms.mjs reports 0 and exits 0', () => {
    const out = execFileSync(process.execPath, ['scripts/ontology-terms.mjs'], { encoding: 'utf8' })
    expect(out).toContain('Used but undeclared (0):')
  })

  it('a new undeclared term is caught: a claim with an invented predicate and an invented JSON key', () => {
    const person = emptyPerson360()
    person.claims.push({ '@id': 'urn:kamin:claim:test', '@type': 'Claim', subject: person['@id'], predicate: 'kamin:inventedRelation', object: 'urn:kamin:skill:database', inventedKey: 'x' })
    const result = compareTerms({ documents: [...documents, { name: 'test', document: person }] })
    expect(result.undeclared.map(short)).toEqual(['kamin:inventedKey', 'kamin:inventedRelation'])
  })

  it('the coverage graph reaches every projector branch, so the check is not blind to one', () => {
    for (const term of ['studied', 'demonstrates', 'verifiedBy', 'declaresEvidenceFor', 'academicContext', 'pursuesGoal', 'hasConfirmedInterest', 'hours', 'editedFields', 'localReviews', 'outputs', 'issuerTrusted', 'Consent'])
      expect(report.used, term).toContain(`${KAMIN}${term}`)
    for (const scheme of Object.keys(DECLARED_PREFERENCE_SCHEMES)) expect(report.used, `prefers:${scheme}`).toContain(`${KAMIN}prefers:${scheme}`)
  })
})

describe('Task 33 · every declared term is documented', () => {
  const terms = declaredTerms(CORE)

  it('has an Arabic and an English label, a comment, a domain and a range', () => {
    const missing = []
    for (const term of terms) {
      const labels = objects(term, `${RDFS}label`).map(o => o.language)
      const isClass = objects(term, `${RDF}type`).some(o => o.value === `${OWL}Class`)
      if (!labels.includes('ar')) missing.push(`${short(term)}: rdfs:label @ar`)
      if (!labels.includes('en')) missing.push(`${short(term)}: rdfs:label @en`)
      if (!objects(term, `${RDFS}comment`).length) missing.push(`${short(term)}: rdfs:comment`)
      if (isClass) continue
      if (!objects(term, `${RDFS}domain`).length && !objects(term, `${SCHEMA}domainIncludes`).length) missing.push(`${short(term)}: domain`)
      if (!objects(term, `${RDFS}range`).length && !objects(term, `${SCHEMA}rangeIncludes`).length) missing.push(`${short(term)}: range`)
    }
    expect(missing).toEqual([])
  })

  it('every kamin:prefers:<scheme> is a sub-property of kamin:prefers, one per declared-preference scheme', () => {
    for (const scheme of Object.keys(DECLARED_PREFERENCE_SCHEMES))
      expect(objects(`${KAMIN}prefers:${scheme}`, `${RDFS}subPropertyOf`).map(o => o.value), scheme).toEqual([`${KAMIN}prefers`])
  })
})

describe('Task 33 · version 0.4.0, published, and no 0.3.0 term dropped', () => {
  it('the code, the ontology header and the person graph say 0.4.0', () => {
    expect(KAMIN_ONTOLOGY_VERSION).toBe('0.4.0')
    expect(objects(`${KAMIN}ontology`, `${OWL}versionInfo`).map(o => o.value)).toEqual(['0.4.0'])
    expect(objects(`${KAMIN}ontology`, `${OWL}priorVersion`).map(o => o.value)).toEqual([`${KAMIN}ontology:0.3.0`])
    expect(emptyPerson360().ontologyVersion).toBe('0.4.0')
  })

  it('public/ontology/ serves the current files, the 0.4.0 copies and the unchanged 0.3.0 files', () => {
    for (const file of ['kamin-core.ttl', 'kamin-shapes.ttl']) {
      expect(read(`public/ontology/${file}`), file).toBe(read(`ontology/${file}`))
      expect(read(`public/ontology/0.4.0/${file}`), `0.4.0/${file}`).toBe(read(`ontology/${file}`))
    }
    expect(read('public/ontology/0.3.0/kamin-core.ttl')).toContain('owl:versionInfo "0.3.0"')
  })

  it('every term declared in 0.3.0 is still declared in 0.4.0, so old IRIs keep their meaning', () => {
    const old = declaredTerms(read('public/ontology/0.3.0/kamin-core.ttl'))
    expect(old.size).toBe(35)
    const now = declaredTerms(CORE)
    expect([...old].filter(term => !now.has(term)).map(short)).toEqual([])
  })
})
