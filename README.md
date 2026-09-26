# Kamin | كامن

## Release baseline

**Version:** 1.0.0  
**Status:** production-ready handoff baseline  
**Architecture:** Person 360 semantic graph + evidence/provenance + explainable course-fit engine  

The 1.0 baseline includes local transcript/OCR ingestion, review-before-inference, SASCED academic context, approved course-to-skill mappings where available, evidence-backed skills, explainable course judgments, structured Person 360 preferences, provenance-aware graph export, consent/audit controls, bilingual UI, PWA/offline assets, and published ontology/JSON-LD/SHACL contracts.

Features that require external institutional data, validated psychometric scoring, longitudinal outcome datasets, or new matching targets are tracked as future extensions rather than represented as completed production functions.


**خزنة قدراتك — Your capability vault**

🌐 **Live application:** https://kamin-12mf.onrender.com

Kamin 1.0 is deployed from `main` only after the GitHub quality gate passes (unit tests, production build, desktop/mobile browser journeys, and accessibility checks).

Kamin turns academic records and structured Person 360 data into evidence-backed skills and explainable learning-fit judgments. This repository contains the Kamin 1.0 application baseline built from BRD v3.1 and the Person 360 semantic architecture.

## Privacy model

- Transcript parsing and OCR run inside the browser.
- OCR worker, WASM core, and Arabic/English language data are served from the Kamin origin; transcript content is not sent to an OCR API.
- No transcript is centrally stored by the current static application.
- Extracted courses are shown for user review before any inference.
- Profile data use temporary `sessionStorage` by default and clear when the browser session closes; legacy plaintext `localStorage` and older pilot session keys are migrated out and removed.
- Advisor sharing and research-consent switches are UI/governance demonstrations only until Saudi-hosted infrastructure and institutional data agreements are approved.

## Evidence and skill mapping

- Parsing a course is not the same as mapping it to a skill.
- Student judgments use only explicitly approved course → learning outcome → skill mappings.
- An unmapped course remains visible in the record but creates no skill and changes no judgment.
- Semantic similarity / embeddings may be used later to **suggest candidate mappings to a department reviewer**. They are not accepted as direct evidence until a human reviewer approves the mapping.

## Quality gates

`npm run check` runs deterministic engine tests, a production build, browser journeys on desktop/mobile Chromium, and an axe accessibility scan for serious/critical issues.

The production build also generates PWA icons, a horizontal social card, and self-hosted OCR runtime assets.

## Compliance posture

The product is designed around Saudi PDPL principles, DGA digital-experience/accessibility guidance, WCAG 2.1 AA targets, purpose-specific consent, data minimization, explainability, withdrawal and auditability. This is a compliance-by-design posture, not a legal certification.


## Person 360 semantic architecture

Kamin is evolving from a transcript-to-course recommender into an evidence-rich **Person 360 semantic graph**.

The architecture reuses external standards rather than inventing one monolithic ontology:

- Schema.org for the canonical person type.
- 1EdTech CLR 2.0 for learner-controlled achievements and records.
- 1EdTech CASE 1.1 for competencies and learning outcomes.
- ESCO for multilingual skill and occupation concepts.
- O*NET RDF/Content Model for occupation-linked interests, work styles, abilities, knowledge, activities and context.
- Credential Engine CTDL / CTDL-ASN for credentials, pathways and competency frameworks.
- W3C SKOS for taxonomies such as SASCED and crosswalks.
- W3C PROV-O for evidence provenance.
- W3C DPV for consent-purpose metadata.

Psychometric instruments are registered separately from the ontology. Current candidate instruments include O*NET Mini Interest Profiler (RIASEC) and the public-domain IPIP Big Five Arabic adaptation. They do not create academic skill evidence or override formal eligibility gates.

See `docs/KAMIN_ONTOLOGY.md` for the frozen architecture and student-project guardrails.
