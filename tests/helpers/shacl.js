// Task 33 · SHACL validation of the graphs the app builds, in Node, with no network.
// The graph is loaded the same way the knowledge workspace loads it (Oxigraph, JSON-LD), every named
// graph is merged into one (the workspace queries the union too), and rdf-validate-shacl (pinned dev
// dependency, never in the app bundle) checks it against ontology/kamin-shapes.ttl.
import { readFileSync } from 'node:fs'
import oxigraph from 'oxigraph'
import SHACLValidator from 'rdf-validate-shacl'
import { JSON_LD_CONTEXT } from '../../src/ontology/registry.js'

export const SHAPES_TTL = new URL('../../ontology/kamin-shapes.ttl', import.meta.url)
const SH = 'http://www.w3.org/ns/shacl#'

const parse = (text, format) => {
  const store = new oxigraph.Store()
  try {
    store.load(text, { format })
    return store.match()
  } finally { store.free() }
}

// Oxigraph terms → RDF/JS terms of the validator's own factory, all in the default graph.
const toDataset = (factory, quads) => {
  const term = t => t.termType === 'NamedNode' ? factory.namedNode(t.value)
    : t.termType === 'BlankNode' ? factory.blankNode(t.value)
      : factory.literal(t.value, t.language || factory.namedNode(t.datatype.value))
  return factory.dataset(quads.map(q => factory.quad(term(q.subject), term(q.predicate), term(q.object))))
}

// A JSON-LD document whose @context is the published context file gets the same context inline.
export const withInlineContext = document => (typeof document['@context'] === 'string' && document['@context'].endsWith('/ontology/kamin-context.jsonld'))
  ? { ...document, '@context': JSON_LD_CONTEXT } : document

export const jsonLdQuads = document => parse(JSON.stringify(withInlineContext(document)), 'application/ld+json')

let shapes
// → { conforms, violations: [{ focusNode, shape, path, message, component }] }
export async function validateGraph(document) {
  shapes ||= parse(readFileSync(SHAPES_TTL, 'utf8'), 'text/turtle')
  // A fresh validator per run: the engine keeps its report between validate() calls.
  const v = new SHACLValidator(shapes)
  const report = await v.validate(toDataset(v.factory, jsonLdQuads(document)))
  const violations = report.results.map(r => ({
    focusNode: r.focusNode?.value,
    shape: r.sourceShape?.termType === 'NamedNode' ? r.sourceShape.value.replace('urn:kamin:', 'kamin:') : `property shape on ${r.path?.value || '?'}`,
    path: r.path?.value || null,
    message: r.message.map(m => m.value).join(' '),
    component: r.sourceConstraintComponent?.value.replace(SH, 'sh:'),
  }))
  return { conforms: report.conforms, violations }
}

// One line per violation, so a failing test names the node and what is wrong.
export const describeViolations = violations => violations.map(v => `${v.focusNode} · ${v.shape}${v.path ? ` · ${v.path}` : ''} · ${v.component}${v.message ? ` · ${v.message}` : ''}`).join('\n')
