# Kamin — Graduation Project Student Handoff

Release baseline: **Kamin 1.0.0 — 2026-09-26**  
Architecture owner: Prof. Adeeb Noor

## Product thesis

Kamin first builds an evidence-rich, provenance-aware Person 360 semantic graph. Recommendation is an application over that graph, not the product's data model.

Core relationship families:

- Person ↔ Job
- Person ↔ Course
- Person ↔ Training
- Person ↔ Occupation / Career Path
- Person ↔ Person (similarity or complementarity)

## Frozen architecture

Students must preserve these decisions unless the architecture owner approves a change:

1. **Evidence before inference.** A skill cannot be created from a course-title keyword or an LLM guess.
2. **Claim provenance.** Claims that affect a decision retain source, time, evidence state, consent purpose, and rule/instrument version.
3. **Similarity is not suitability.** Similarity, fit and complementarity are separate functions.
4. **Hard gates first.** Formal eligibility and prerequisites cannot be overridden by psychometrics.
5. **Psychometrics are assessed observations.** They are not diagnoses, verified facts, or academic evidence.
6. **No universal equal weighting.** Feature weights are use-case-specific and become scientific claims only after validation against outcomes.
7. **No uncalibrated fit percentages in the public UI.**
8. **SASCED is educational context, not skill evidence.**
9. **External ontology first.** Reuse ESCO/O*NET/CASE/CLR/CTDL/ELM/SKOS/PROV-O/DPV where applicable; do not create duplicate local concepts.
10. **Consent is layer-specific and withdrawable.**
11. **Commercial/payment data never affects fit judgments.**
12. **Missing data remains unknown, not negative.**

## Current reusable standards

See `docs/KAMIN_ONTOLOGY.md` for the normative registry.

Key layers:

- Schema.org — Person/course/job/occupation basics
- SASCED-20 — Saudi education level and specialization context
- ESCO — multilingual skills and occupations
- O*NET — interests, work styles and occupation-linked worker characteristics
- 1EdTech CASE — competencies and learning outcomes
- 1EdTech CLR 2.0 + Open Badges 3.0 — portable learner achievements
- Credential Engine CTDL / CTDL-ASN — credentials, pathways and competencies
- European Learning Model — learning opportunities and qualifications
- W3C PROV-O — provenance
- W3C DPV 2.0 — purpose/consent metadata
- W3C SKOS — taxonomies and qualified mappings
- W3C SHACL — graph validation
- W3C Verifiable Credentials 2.0 — future verified claims

## Psychometric boundary

Planned instruments/reference models:

- O*NET Mini Interest Profiler / RIASEC
- IPIP Big Five-compatible measures
- O*NET Work Values semantic dimensions
- O*NET Work Styles occupation-side reference model

Before an instrument becomes decision-active, the team must document:

- exact instrument/version
- item/scoring licence
- Arabic adaptation source
- scoring implementation
- missing-response policy
- consent purpose
- validation status
- permitted decision role

No Saudi norm, percentile, diagnosis, or psychological-suitability label may be shown before local validation.

## Student-safe workstreams

Students may independently work on:

- UI and accessibility improvements
- Person 360 visualization
- graph query screens
- import adapters for approved data sources
- test fixtures and regression tests
- course/job/training target profile views
- explainability visualizations
- outcome capture screens
- performance/caching/offline improvements

## Architecture-review workstreams

Require approval before implementation:

- a new ontology or local concept family
- a new psychometric instrument
- changing evidence trust levels
- changing hard gates
- adding numeric recommendation weights
- changing consent purposes or persistence
- enabling a new external integration
- modifying what creates or removes skill evidence
- production matching thresholds

## Matching contract

Every future matcher must return a structured result:

```json
{
  "target": "...",
  "judgment": "fits | conditional | not-yet | exploratory",
  "hardGates": [],
  "supportingMechanisms": [],
  "limitingMechanisms": [],
  "evidenceRefs": [],
  "ruleVersion": "...",
  "modelVersion": null,
  "calibrationStatus": "uncalibrated | validated"
}
```

The UI explanation must be generated from these structured mechanisms, not from an ungrounded free-form LLM response.

## D3 architectural inheritance

The system intentionally carries forward the D3 pattern:

heterogeneous sources → canonical concepts → normalized relations → multi-dimensional profiles → dimension-level similarity → inference → explanation → validation → learned weighting.

Kamin changes the domain from drugs/interactions to people/opportunities, but preserves the separation between representation, inference, evidence, and validation.

## Definition of done for any student feature

A feature is not complete until:

- unit tests pass
- production build passes
- E2E journey passes where applicable
- mobile 390px remains usable
- Arabic/English remain functional
- serious/critical accessibility issues are absent
- new personal data has an explicit purpose and consent path
- provenance is preserved for any decision-relevant claim
- documentation is updated

## Production

Production handoff: https://kamin-12mf.onrender.com/

Kamin 1.0 processes transcript/OCR data locally in the browser. Institutional centralized storage or external sharing remains behind a separate compliance/hosting gate.

## September 2026 release and student contribution boundary

Start with `CAPSTONE_ROADMAP_20260927.md`, `KICKOFF_TASKS.csv`, `PILOT_PROTOCOL_DRAFT.md` and `CLOUDFLARE_PAGES_HANDOFF.md`. Current local recall, encrypted snapshots and graph exports are documented in `SEMANTIC_TOOLS_20260929.md`; they are the baseline, not student deliverables. The first-semester gate is a usable release plus an approved three-college pilot, followed by the rest of the ten-month improvement and evaluation period.

Use `npm ci`, `npm test`, `npm run build`, and `npm run preview` to reproduce the complete website. Node 22 is the supported build baseline. The optional model downloads at build time and on first opted-in browser use; do not confuse its download size with initial page weight. Run `npx playwright install chromium` and `npm run e2e` for the browser gate.
