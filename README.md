# Kamin | كامن

**خزنة قدراتك — Your capability vault**

🌐 **Live public pilot:** https://kamin-12mf.onrender.com

The pilot is continuously deployed from `main` after code changes and protected by a GitHub quality gate (unit tests, production build, desktop/mobile browser journeys, and accessibility checks).

Kamin turns academic records into evidence-backed skills and explainable learning-fit judgments. This repository contains the public pilot experience built from BRD v3.0.

## Public pilot privacy model

- Transcript parsing runs in the browser.
- No transcript is centrally stored by this static pilot.
- Extracted courses are shown for user review before any inference.
- All pilot profile data lives in browser local storage and can be exported or deleted.
- Advisor sharing and research-consent switches are UI/governance demonstrations only until Saudi-hosted infrastructure and institutional data agreements are approved.

## Quality gates

`npm run check` runs deterministic engine tests, a production build, browser journeys on desktop/mobile Chromium, and an axe accessibility scan for serious/critical issues.

## Compliance posture

The product is designed around Saudi PDPL principles, DGA digital-experience/accessibility guidance, WCAG 2.1 AA targets, purpose-specific consent, data minimization, explainability, withdrawal and auditability. This is a compliance-by-design posture, not a legal certification.
