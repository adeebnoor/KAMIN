# Semantic inference: implementation and visible evidence

## Fixed product baseline

Retain the current Arabic/English person-first visual system, interests entry,
optional reviewed transcript, six-dimension profile view and local-only storage.
Add an executable inference example and expose the same proof in the student's
decision studio. Acceptance is observable behavior, not another visual redesign.

The original requirement is an evidence-rich Person360 followed by person–job,
person–course, person–training and eventually person–person relationships,
inspired by the founder's D3 semantic-network research. The present system is a
bounded application of that pattern, not a reproduction of the biomedical model
or its validation results.

## Audit findings before this change

- Matching did traverse qualified person claims and reference target edges,
  with goal/preference context and capability gaps. JavaScript implemented the
  matching rules. There was no OWL reasoner, SPARQL executor or SHACL processor.
- OWL/SHACL files existed as development assets; listing vocabularies was not
  evidence of an operational standards-based reasoning stack.
- The landing diagram illustrated profile dimensions. The actual academic
  path was inside a collapsed disclosure. This hid the original inference idea.
- The inline JSON-LD context did not map `entities`, `claims`, `predicate` or
  `object`. A standard jsonld.js conversion of the synthetic profile with 19
  entities and 15 claims produced **one triple**, the Person type. Application
  JSON traversal worked, but interoperable RDF export lost those relationships.

## This change

- Ontology/context 0.3.0 preserves claims, relationship IRIs, multilingual labels,
  metadata and provenance through standard JSON-LD-to-RDF conversion. The public
  context is tested against the runtime context.
- Three bounded rule families materialize qualified inference records: R1
  capability evidence to a pathway requirement; R2 declared goal context; R3
  declared preference context. Each records premises, conclusion, rule version,
  claim source, evidence source and scope.
- The landing example calls the production projection and matching functions.
  Changing a preference recomputes conclusions; removing academic evidence keeps
  contextual alignment but exposes missing requirements. No demo changes the
  user's profile.
- The student studio shows the same proof before the profile illustration.
- Local, user-triggered JSON-LD export separates profile input, reference,
  inferred and explanation named graphs. Qualified claims and rule provenance
  remain inspectable. The file is clearly labeled unencrypted; existing encrypted
  backups remain the profile restoration mechanism. No RDF import or public
  personal-data endpoint is added.
- Capability joins require matching concept IRIs, not just matching notation.
  Dangling evidence, withdrawn claims and another person's claims cannot support
  the capability proof. External concept crosswalks need explicit governed rules.

## Remaining boundaries

- No general OWL entailment, SPARQL querying, runtime SHACL validation or general
  RDF input ingestion. JSON-LD is the RDF exchange format; the decision engine is
  bounded JavaScript, not a triple-store query engine.
- No person-to-person matching, calibrated similarity weights or population
  database. Local person identity is opaque and is not a cross-person identifier.
- No measured recommendation accuracy, institutional document authentication,
  real-time jobs, provider booking or automatic eligibility decisions.
- Psychometric scores remain excluded from Fit until Saudi validation. Contextual
  preferences cannot establish capability or remove an academic evidence gap.
- An absent evidence path means unknown support, not a claim that a person lacks
  a skill. The exported context connections do not assert overall suitability.
- Career/training matches and knowledge bridges use a limited reference catalog;
  they are not a complete national/global knowledge graph.

## Verification

- Standard processor: jsonld.js 9.0.0, development/test dependency only. Regression
  tests check statement IRIs, source provenance, Arabic/English literals, named
  graph separation, rule records and preference retraction.
- Negative tests: missing evidence cannot produce R1; a different IRI with the
  same notation is not equated; withdrawn and other-person claims are ignored.
- Browser tests exercise Arabic and English input changes, the empty state,
  downloaded JSON-LD converted to RDF, mobile overflow and accessibility.
- Specification: W3C JSON-LD 1.1 and processing algorithms,
  https://www.w3.org/TR/json-ld11/ and https://www.w3.org/TR/json-ld11-api/.
