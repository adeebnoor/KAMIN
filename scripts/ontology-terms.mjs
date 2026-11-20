// Task 33 · which kamin: terms does the app really write, and which does the ontology declare?
//
// "Used" is measured on the graphs the app builds (not by grep): every graph is loaded into Oxigraph
// as JSON-LD, the same way the knowledge workspace loads it, and every kamin: IRI that appears as
//   - a predicate,
//   - a class (object of rdf:type),
//   - a relation named inside a claim or a reified statement (object of kamin:predicate / rdf:predicate)
// is a used term. Instance IRIs (urn:kamin:course:…, urn:kamin:skill:…) are not terms.
// "Declared" is every kamin: IRI that ontology/kamin-core.ttl types as a class or a property.
//
// Graphs built:
//   workspace-demo      buildWorkspaceDataset('demo'): reference graph, demo profile, inferences
//   coverage-profile    projectStateToPerson360 on a made-up state that runs every projector branch
//                       (courses with an edited row, capabilities, projects, task outputs and a local review,
//                       credentials verified and not,
//                       SASCED context, goal, all seven declared-preference schemes, digital interests)
//   coverage-inference  buildInferenceDataset (src/ontology/rdf.js) for that profile and every pathway
//   coverage-workspace  buildWorkspaceDataset('personal') for that profile
//   ict-kg              src/knowledge/ictKgV1.js, with the published JSON-LD context
//
// Usage: node scripts/ontology-terms.mjs [--json]
// Exit code 1 when a used term is not declared (tests/ontologyTerms.test.js runs the same check).
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import oxigraph from 'oxigraph'
import { demoCourses } from '../src/data.js'
import { DIGITAL_METHOD, DIGITAL_NOTICE } from '../src/digitalInterests.js'
import { DECLARED_PREFERENCE_SCHEMES } from '../src/insight.js'
import { buildWorkspaceDataset } from '../src/knowledge/workspace.js'
import { ictKnowledgeGraph } from '../src/knowledge/ictKgV1.js'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { buildInferenceDataset } from '../src/ontology/rdf.js'
import { JSON_LD_CONTEXT } from '../src/ontology/registry.js'
import { inferTranscriptSsces } from '../src/reference/ssce.js'
import { attachTaskOutput, recordLocalTaskReview } from '../src/tasks/progress.js'
import { editCourseRow } from '../src/utils/provenance.js'
import { normalizeCredentialRecords } from '../src/credentials/records.js'
import { inferSkills } from '../src/utils/engine.js'

export const KAMIN = 'urn:kamin:'
export const CORE_TTL = new URL('../ontology/kamin-core.ttl', import.meta.url)
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const OWL = 'http://www.w3.org/2002/07/owl#'
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#'
const TERM_TYPES = new Set([`${OWL}Class`, `${RDFS}Class`, `${OWL}ObjectProperty`, `${OWL}DatatypeProperty`, `${OWL}AnnotationProperty`, `${RDF}Property`])
const RELATION_NAMES = new Set([`${KAMIN}predicate`, `${RDF}predicate`])

// A made-up student state that reaches every branch of src/ontology/projector.js. No real person.
export function coverageState(now = new Date('2026-11-18T00:00:00.000Z')) {
  const at = now.toISOString()
  const declaredPreferences = Object.fromEntries(Object.entries(DECLARED_PREFERENCE_SCHEMES).map(([scheme, { options }]) => [scheme, options[0].id]))
  const credentials = normalizeCredentialRecords([
    { id: 'credential-coverage-verified', credentialId: 'urn:uuid:coverage-verified', issuerId: 'did:example:fixture-university', issuerName: 'Fixture University (test only)', issuerTrusted: true, outcome: 'verified', reasons: [], importedAt: at, achievements: [{ id: 'urn:kamin:skill:statistics', name: 'Statistics' }] },
    { id: 'credential-coverage-unverified', credentialId: 'urn:uuid:coverage-unverified', issuerId: 'did:example:unknown', issuerTrusted: false, outcome: 'unverified', reasons: ['ISSUER_NOT_TRUSTED'], importedAt: at, achievements: [{ id: 'urn:kamin:skill:python', name: 'Python' }] },
  ])
  return {
    approved: true,
    // The demo courses, plus one transcript row with credit hours whose grade the student edited.
    courses: [...demoCourses, editCourseRow({ code: 'CPIT-221', name: 'Made-up course', grade: 'B', hours: 3, source: 'pdf' }, 'grade', 'A')],
    goal: 'data',
    consents: { insight: true },
    projects: [{ id: 'coverage-project', title: 'Made-up SQL dashboard', kind: 'repository', url: 'urn:made-up:project-link', description: 'Synthetic project for the ontology coverage graph.', skillIds: ['database'], reviewStatus: 'unreviewed', createdAt: at }],
    tasks: recordLocalTaskReview(attachTaskOutput([], 'task-access-review', { note: 'Made-up output for the ontology coverage graph.' }, now), 'task-access-review', { reviewerLabel: 'Made-up peer', role: 'peer', scope: 'output', decision: 'reviewed' }, now),
    credentials,
    insight: {
      declaredPreferences,
      digitalInterests: { noticeVersion: DIGITAL_NOTICE, analysisConsent: true, contextConsent: true, grantedAt: at, confirmed: [{ topicId: 'data', matchedTerms: ['sql'], methodVersion: DIGITAL_METHOD, confirmedAt: at }] },
    },
  }
}

export function coverageGraph() {
  const state = coverageState()
  return projectStateToPerson360({ state, skills: inferSkills(state.courses, { credentials: state.credentials }), educationClassification: inferTranscriptSsces(state.courses) })
}

// Every JSON-LD document the term check reads, by name.
export function emittedDocuments() {
  const graph = coverageGraph()
  const matches = matchTargets(buildMatchingProfile({ graph }), { lang: 'en' })
  return [
    { name: 'workspace-demo', document: buildWorkspaceDataset('demo') },
    { name: 'coverage-profile', document: graph },
    { name: 'coverage-inference', document: { '@context': JSON_LD_CONTEXT, '@graph': matches.flatMap(match => buildInferenceDataset(graph, match)['@graph']) } },
    { name: 'coverage-workspace', document: buildWorkspaceDataset('personal', { personalGraph: graph, allowPersonal: true }) },
    { name: 'ict-kg', document: { ...ictKnowledgeGraph, '@context': JSON_LD_CONTEXT } },
  ]
}

// JSON-LD → quads with the app's own RDF engine (src/knowledge/queryPolicy.js loads the same way).
export function quadsOf(document) {
  const store = new oxigraph.Store()
  try {
    store.load(JSON.stringify(document), { format: 'application/ld+json' })
    return store.match()
  } finally { store.free() }
}

// kamin: terms in a list of quads → Map(term IRI → how many times it is used).
export function termsInQuads(quads) {
  const terms = new Map()
  const add = iri => { if (iri.startsWith(KAMIN)) terms.set(iri, (terms.get(iri) || 0) + 1) }
  for (const { predicate, object } of quads) {
    add(predicate.value)
    if (object.termType === 'NamedNode' && (predicate.value === `${RDF}type` || RELATION_NAMES.has(predicate.value))) add(object.value)
  }
  return terms
}

// kamin: classes and properties declared in a Turtle file (the ontology header itself is not a term).
export function declaredTerms(turtle = readFileSync(CORE_TTL, 'utf8')) {
  const store = new oxigraph.Store()
  try {
    store.load(turtle, { format: 'text/turtle' })
    return new Set(store.match().filter(q => q.subject.value.startsWith(KAMIN) && q.predicate.value === `${RDF}type` && TERM_TYPES.has(q.object.value)).map(q => q.subject.value))
  } finally { store.free() }
}

export function compareTerms({ documents = emittedDocuments(), turtle } = {}) {
  const used = new Map()
  for (const { name, document } of documents) {
    for (const [iri, count] of termsInQuads(quadsOf(document))) {
      const entry = used.get(iri) || { count: 0, graphs: [] }
      entry.count += count
      entry.graphs.push(name)
      used.set(iri, entry)
    }
  }
  const declared = declaredTerms(turtle)
  const sort = list => [...list].sort()
  return {
    graphs: documents.map(d => d.name),
    used: sort(used.keys()),
    usage: Object.fromEntries(sort(used.keys()).map(iri => [iri, used.get(iri)])),
    declared: sort(declared),
    undeclared: sort([...used.keys()].filter(iri => !declared.has(iri))),
    unused: sort([...declared].filter(iri => !used.has(iri))),
  }
}

const short = iri => iri.replace(KAMIN, 'kamin:')
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = compareTerms()
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
  else {
    console.log(`Graphs built: ${report.graphs.join(', ')}`)
    console.log(`kamin: terms used: ${report.used.length} · declared in ontology/kamin-core.ttl: ${report.declared.length}`)
    console.log(`\nUsed but undeclared (${report.undeclared.length}):`)
    for (const iri of report.undeclared) console.log(`  ${short(iri)}  (${report.usage[iri].count}× in ${report.usage[iri].graphs.join(', ')})`)
    console.log(`\nDeclared but unused (${report.unused.length}):`)
    for (const iri of report.unused) console.log(`  ${short(iri)}`)
  }
  if (report.undeclared.length) process.exitCode = 1
}
