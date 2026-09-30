# Kamin | كامن

**طبقة الثقة للقدرات — Capability Trust Layer**

🌐 **Live public release:** https://kamin-12mf.onrender.com

The release is deployed from `main` only after the GitHub quality gate passes (unit tests, production build, desktop/mobile browser journeys, and accessibility checks).

Kamin 1.0 focuses its public launch on final-year students and recent graduates. It turns reviewed academic evidence and structured user inputs into a user-owned Capability Profile 360°, then produces explainable learning, job, and training judgments with visible evidence, gaps, and next steps. The internal semantic architecture remains Person 360, while the public product deliberately narrows its beachhead and does not claim unmeasured accuracy, signed partner networks, or automated hiring decisions.

## Kamin 1.0 baseline

Operational modules include local transcript/OCR ingestion, review-before-inference, SASCED academic context, approved course-to-skill evidence, explainable course judgments, structured Person 360 preferences, governed job/training target profiles, mechanisms-of-fit matching, provenance-aware export, privacy/consent/audit controls, bilingual UI, PWA assets, and published ontology/JSON-LD/SHACL contracts.

Research-dependent functions such as Saudi-normalized psychometric scores, learned fit weights, institution-verified credentials, employer access, aggregate cohort analytics, and institutional centralized storage remain behind explicit validation/compliance gates rather than being presented as finished scientific claims. Public validation targets are documented in `public/methodology.html`; they are targets, not measured results.

## Public release privacy model

- Transcript parsing and OCR run inside the browser.
- OCR worker, WASM core, and Arabic/English language data are served from the Kamin origin; transcript content is not sent to an OCR API.
- No transcript is centrally stored by this static public release.
- Extracted courses are shown for user review before any inference.
- Profile data are session-only by default. With explicit user consent, Kamin can persist the profile locally on the same device in IndexedDB; there is still no central profile store in the public release.
- Users can export/import an AES-GCM encrypted portable profile and can clear all Kamin profile data from browser session storage and IndexedDB.
- Users can create an AES-GCM encrypted local `.kamin` backup containing restore state plus the canonical JSON-LD graph. The passphrase is never stored; import recomputes derived judgments and resets external-sharing consents.
- Advisor sharing and research-consent switches are UI/governance demonstrations only until Saudi-hosted infrastructure and institutional data agreements are approved.

## Occupational taxonomy boundary

Kamin exposes a taxonomy-neutral occupation interface with `lookup`, `search`, and SKOS-governed `crosswalk` operations. The public repository contains no SSCO classification rules, hierarchy-construction logic, proprietary scoring method, SSCO ontology assets, or SSCO crosswalk table.

- `VITE_SSCO_ENABLED=false` is the required/default public state.
- Any SSCO implementation is consumed only through a separately controlled runtime service.
- No SSCO mapping data may be published here without a dated written clearance decision.
- Job target profiles can carry nullable `onet`, `esco`, and `ssco` identifiers without embedding any taxonomy-specific method.

See `docs/OCCUPATION_TAXONOMY_BOUNDARY.md` and the pull-request IP gate.

## Evidence and skill mapping

- Parsing a course is not the same as mapping it to a skill.
- Student judgments use only explicitly approved course → learning outcome → skill mappings.
- An unmapped course remains visible in the record but creates no skill and changes no judgment.
- Semantic similarity / embeddings may be used later to **suggest candidate mappings to a department reviewer**. They are not accepted as direct evidence until a human reviewer approves the mapping.

## Quality gates

`npm run check` runs deterministic engine tests, a production build, browser journeys on desktop/mobile Chromium, an axe accessibility scan for serious/critical issues, and a WCAG AA text-contrast sweep of the landing and student workspace under both operating-system colour schemes (`e2e/color-scheme.spec.js`).

The production build also generates PWA icons, a horizontal social card, and self-hosted OCR runtime assets.

## Compliance posture

The product is designed around Saudi PDPL principles, DGA digital-experience/accessibility guidance, WCAG 2.1 AA targets, purpose-specific consent, data minimization, explainability, withdrawal and auditability. This is a compliance-by-design posture, not a legal certification.


## Person 360 semantic architecture

Kamin 1.0 is built around an evidence-rich **Person 360 semantic graph**. Academic evidence, structured preferences, psychometric observations when validated, target profiles, matching explanations, and outcomes remain distinct typed layers with provenance.

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

See `docs/KAMIN_ONTOLOGY.md` for the frozen architecture and student-project guardrails. Public-facing transparency surfaces are `public/sample-report.html`, `public/methodology.html`, `public/trust.html`, and `public/privacy.html`.


## National interoperability posture

Kamin is intentionally positioned as a **complementary university evidence & trust layer**, not a parallel Saudi national skills platform and not a KAU-only product. The launch wedge is university-led B2B2C. The architecture keeps a provider-neutral canonical graph, explicit crosswalk/adapters, and portable evidence so an official national API can be integrated later without making it a prerequisite for user value. Kamin does not claim a current government integration or endorsement. See `public/interoperability.html`.

## Saudi psychometric validation boundary

O*NET Mini Interest Profiler and the IPIP Big Five Arabic adaptation are research candidates only. Their instrument scores have `productionUse:false` and `decisionRole:'none-until-saudi-validation'`. Self-declared RIASEC/work-value labels remain separate product preferences and are not psychometric scores. A Saudi validation study is required before instrument scores can affect Fit.
