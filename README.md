# Kamin | كامن

**خزنة قدراتك — Your capability vault**

🌐 **Live public pilot:** https://kamin-12mf.onrender.com

Kamin turns academic records into traceable skill evidence and explainable learning-fit judgments. This repository implements the public pilot against **BRD v3.1 (26 September 2026)**.

## Product boundary

The pilot intentionally keeps a narrow first-release boundary:

- Education record first; the wider ten-record vault is visible but locked.
- Exact course-code → learning-outcome → skill mappings only.
- Failed, withdrawn, incomplete and unknown-grade rows do not create evidence.
- A course title or keyword never creates a skill.
- Demo mappings are synthetic-demo only until the first academic department formally approves its mapping table.
- Course-fit indicators are explicitly **provisional / uncalibrated** until retrospective validation.
- Commercial fields are isolated from the judgment engine and protected by a regression test.

## Public-pilot privacy model

- Transcript parsing runs in the browser.
- The transcript file is not uploaded to a Kamin server.
- **Temporary session storage is the default**; device-persistent local storage is opt-in.
- Analysis consent is off by default and must be granted explicitly after the user reviews the extracted rows.
- Withdrawing the educational record removes its effect from skills and judgments.
- Image OCR is intentionally disabled until Arabic/English OCR worker, core and language assets are self-hosted. The pilot does not download OCR runtime assets from third parties.
- Advisor sharing and research-consent switches are governance demonstrations only until approved Saudi-hosted infrastructure and institutional agreements exist.

## Quality gate and deployment

`npm run check` runs:

1. deterministic engine/transcript tests;
2. production build;
3. desktop + mobile Chromium journeys;
4. accessibility checks across primary screens;
5. browser checks for routing, consent, mobile navigation and network isolation.

Render is configured with `autoDeployTrigger: checksPass`, so a commit to the production branch is deployed only after CI checks pass.

## Compliance posture

The product is designed around Saudi PDPL principles, WCAG 2.1 AA targets, purpose-specific consent, data minimization, explainability, withdrawal and auditability. This is a design posture, **not an official certification or legal opinion**.
