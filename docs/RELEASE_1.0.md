# Kamin 1.0 — Release Baseline

Release date: 2026-09-26  
Status: **ready for graduation-project handoff**

## Included and operational

### Public application
- Arabic/English responsive interface
- desktop + 390px mobile journeys
- PWA manifest, icons, service worker and offline asset caching
- SEO/OG/Twitter metadata
- accessible keyboard dialog behavior

### Academic ingestion
- PDF digital-text extraction
- same-origin browser OCR for Arabic and English scanned records
- TXT and image ingestion
- Arabic/Persian digit normalization
- multi-row, wrapped-row and merged-row transcript parsing
- validation summary, extraction coverage and rejected-row inspection
- no silent demo fallback
- explicit review and approval before inference

### Academic context
- SASCED-20 education level/specialization reference
- KAU-FCIT namespace mappings for the current approved pilot mappings
- national programme context kept separate from skill evidence

### Capability evidence
- explicit approved course-to-skill mapping only
- failed/withdrawn/incomplete courses do not create skill evidence
- evidence strength displayed categorically
- no public uncalibrated mastery percentages
- explainable course-fit judgments and formal-gate handling

### Person 360
- optional purpose-specific consent
- structured declared preferences
- evidence/provenance-aware Person 360 graph
- JSON export containing graph + academic evidence + judgments
- psychometric instrument registry and governance boundary
- optional layer can be withdrawn independently

### Semantic architecture
- reusable ontology registry
- Schema.org, ESCO, O*NET, SASCED, CASE, CLR, Open Badges, CTDL/CTDL-ASN, ELM, SKOS, PROV-O, DPV, SHACL and VC registry
- thin Kamin RDF vocabulary
- published JSON-LD context
- SHACL claim/observation constraints
- source/version policy and external-ID policy

### Privacy and data control
- local browser processing for transcript/OCR
- temporary session storage
- explicit purpose-specific consents
- export
- deletion
- audit trail
- automatic migration/removal of legacy plaintext/session keys

### Quality gate
Production changes must pass:
1. dependency security audit
2. unit tests
3. production build
4. Playwright E2E journeys
5. accessibility checks included in browser tests

## Scientific/product boundaries

The following are intentionally **not represented as completed or validated production functions**:

- Saudi-normalized psychometric percentiles
- clinical or mental-health diagnosis
- numeric universal Person↔Job/Course/Training fit percentages
- learned matching weights without outcome data
- centralized institutional student storage
- advisor/research sharing before institutional hosting/data agreements
- full-university course-to-CLO-to-skill mappings without department approval
- Person↔Person production matching before a defined teamwork/mentorship use case and validation dataset are supplied

These are expansion modules, not defects in the 1.0 baseline.

## Handoff rule

Students receive the complete 1.0 repository and may extend it under `docs/STUDENT_HANDOFF.md`. Core ontology, evidence, consent, psychometric and matching-governance rules require architecture review before alteration.

## Production URL

https://kamin-12mf.onrender.com/
