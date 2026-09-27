# Local knowledge workspace — implementation and limits

The student journey starts with two optional selections: a goal and a career interest. Other preferences are progressively disclosed. Mobile navigation offers four common destinations and a More menu. The home page introduces a reference-knowledge search and an interactive dimension ribbon. The advanced explorer is separate from the student workflow.

## Implemented

- Search the pilot catalog in Arabic and English; filter capabilities, interests and pathways; inspect typed relationships and their limits.
- Execute real SPARQL 1.1 SELECT and ASK with Oxigraph 0.5.11, initialized only after Run. The worker and its WebAssembly asset are served from this site's origin.
- Parse and regenerate queries with Traqula 1.4.0. Reject Update, CONSTRUCT, DESCRIBE, SERVICE (including nested or silent), and FROM/FROM NAMED. Impose an outer limit of 101 to display at most 100 rows with an explicit truncation notice.
- Use a disposable worker with a 12-second deadline and cancellation. Editing, changing scope, changing templates, withdrawing local permission or leaving the workspace invalidates results and terminates active work.
- Reference knowledge is the default and contains no personal graph. A synthetic profile is independent of the student's state. Personal queries require separate, transient permission, reset on exit and when the profile changes.
- Preserve input, reference, inferred and explanation named graphs. Named graphs distinguish provenance; they are not access control. No server-side student endpoint exists.
- Keep query text and results out of profile/session persistence. JSON result download is user initiated and explicitly warns that personal results are unencrypted.

## Limits

The source ontology and catalog remain pilot artifacts, with authored mappings. This workspace is not an OWL reasoner or a SHACL validator. Querying does not establish correctness of a mapping or change eligibility, capability gaps or fit judgments. No student similarity search, sensitive-data collection, social-account connection, health/financial/violations ingestion, or automated personality assessment is added.

The local deadline bounds a query by terminating its worker; it is not a server resource quota. First execution downloads approximately 1.45 MB compressed WebAssembly plus the worker; ordinary student entry does not load either. Initial availability requires network access to this site's static assets.

## Verification

Unit tests exercise the actual RDF query engine, named graph isolation, explicit personal permission, SELECT aggregation/OPTIONAL, ASK, result caps, and nested external-service rejection. Browser tests cover Arabic/English, mobile, accessible forms, real WebAssembly execution, result downloads, empty states, personal permission withdrawal, and no outbound SERVICE requests. Existing profile, encrypted-backup, matching and withdrawal checks remain part of the quality gate.

## Design references

- https://geneontology.org/docs/tools-overview/
- https://geneontology.org/docs/ribbon
- https://geneontology.org/docs/go-annotations/
- https://geneontology.org/docs/ontology-relations/
- https://geneontology.org/docs/sparql — GO currently advertises deprecation of its public endpoint. Kamin does not depend on that endpoint.
- https://github.com/oxigraph/oxigraph/tree/main/js
- https://github.com/comunica/traqula

The GO inspiration is the separation of concepts, sourced annotations and explicit relationship models. Biological terminology and causal claims are not transferred to people.
