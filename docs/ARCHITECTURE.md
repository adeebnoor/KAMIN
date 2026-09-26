# Kamin Architecture Notes — BRD 3.1

## Processing boundary

The public pilot is a browser-side application. Transcript files are not uploaded to an application backend.

### Ingestion pipeline

1. Text PDF: PDF.js reconstructs rows using text-item coordinates.
2. Scanned PDF: if the PDF has no useful text layer, pages are rendered locally to canvas and passed to Tesseract.js.
3. Image: Tesseract.js OCR runs locally.
4. TXT: parsed locally.
5. Every path produces a validation summary before approval.

Tesseract worker, WASM core, and `eng`/`ara` language data are built into the static deployment and served from the Kamin origin.

## Saudi academic classification context (SASCED-20)

Kamin carries a separate academic-context layer based on the Saudi Standard Classification of Educational Levels and Specialties (SASCED-20), which is aligned to ISCED 2011/2013.

`record/program text -> SASCED candidate -> user/institution confirmation -> academic context`

For the ICT pilot, the first explicit crosswalk includes:
- 061201 Network Systems Administration
- 061202 Technical Support
- 061203 Information Security / cybersecurity context
- 061301 Programming and Computer Science
- 061302 Software Engineering
- 061303 Information Technology
- 061304 Information Systems
- 061901 Artificial Intelligence
- 061902 Data Science
- 068801 Health Informatics

SASCED context does **not** create a skill and does **not** alter fit scores by itself. A text-derived SASCED match is shown only as a candidate until confirmed by the student or academic authority. Course-level SASCED tags are contextual crosswalks, not claims that the individual course is itself an educational specialty.

## Evidence pipeline

`record -> extracted row -> approved course mapping -> skill evidence -> explained judgment`

A successfully parsed course is **not automatically skill evidence**.

- Approved course mappings are explicit and versionable.
- Failed, withdrawn, incomplete, or unknown grades create no evidence.
- Unmapped courses remain visible but create no skill and do not affect a recommendation.
- The current percentages are preliminary indicators, not calibrated mastery probabilities.

## Semantic similarity

Semantic similarity / embeddings are appropriate as a reviewer-assistance layer, not as a direct judgment rule.

Future workflow:

1. Unmapped course + official CLO text.
2. Local/approved embedding model proposes candidate ESCO/SSCO skills.
3. Reviewer sees similarity, source CLO, and alternatives.
4. Department reviewer approves/rejects the mapping.
5. Only the approved mapping becomes part of the symbolic rule set.

This preserves explainability and prevents a model-generated similarity from silently becoming an academic claim.

## Storage

The public pilot uses temporary `sessionStorage` for approved session state. It is cleared when the browser session closes. Legacy plaintext `localStorage` state is migrated to the temporary session and removed.

If durable browser persistence is introduced later, it should use encrypted IndexedDB with Web Crypto and explicit user opt-in, not silent plaintext persistence.

## Error model

- Demo mode is an explicit user action and is never an upload fallback.
- File and parsing failures return user-visible errors.
- Course-like rows that cannot be parsed are included in the validation report.
- A React error boundary prevents an unexpected rendering exception from failing silently.

## Static delivery

- Vite-hashed JS/CSS assets: one-year immutable cache.
- Versioned identity/PWA/OCR assets: one-year immutable cache.
- Manifest: short cache + explicit `application/manifest+json`.
- Service worker: no-cache so updates propagate.
- Navigation/HTML: network-first in the service worker.
