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
