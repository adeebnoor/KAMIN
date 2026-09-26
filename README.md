# Kamin | كامن

**خزنة قدراتك — Your capability vault**

🌐 **Live public pilot:** https://kamin-12mf.onrender.com

The pilot is deployed from `main` only after the GitHub quality gate passes (unit tests, production build, desktop/mobile browser journeys, and accessibility checks).

Kamin turns academic records into evidence-backed skills and explainable learning-fit judgments. This repository contains the public pilot experience built from BRD v3.1.

## Public pilot privacy model

- Transcript parsing and OCR run inside the browser.
- OCR worker, WASM core, and Arabic/English language data are served from the Kamin origin; transcript content is not sent to an OCR API.
- No transcript is centrally stored by this static pilot.
- Extracted courses are shown for user review before any inference.
- Pilot profile data use temporary `sessionStorage` by default and clear when the browser session closes; legacy plaintext `localStorage` data are migrated out and removed.
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
