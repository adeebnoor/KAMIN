# Trust signals release — 30 September 2026

Question answered: "How do we know a student did not tamper with the inputs?"
Honest answer: we cannot prove it for a self-uploaded file. We can make tampering
pointless (no advantage in the product), visible (provenance per field), detectable
(document integrity signals), and irrelevant for high-stakes use (the trust level travels
with every claim). This release implements the first three and prepares the fourth.

| Capability | What it does | What it does not do | Guard |
| --- | --- | --- | --- |
| Provenance per field | Extracted values are kept when a student edits a row; the level (document / edited / self-declared / mixed / synthetic) shows on the review table, skill cards, dashboard, shared snapshot and exports. A raised grade is named explicitly. | Authenticate the document or block the edit. | `tests/provenance.test.js`, `e2e/adversarial-inputs.spec.js` (field-level provenance) |
| Document integrity signals | From raw PDF bytes and pdf.js metadata: signature presence and coverage, later saves, producing software, modification date; QR codes in PDFs and images become a verify-at-source link that opens only on click. All local. | Verify the signer's certificate chain, contact the issuer, or change any judgment. | `tests/documentIntegrity.test.js`, `e2e/adversarial-inputs.spec.js` (document integrity) |
| From gap to evidence | A project, certificate or internship attached to a gap at the declared-applied level, awaiting review; https links only; exported to Person 360 as review-required claims; cleared with consent withdrawal. | Create a capability, move Fit or missing requirements, or accept non-https links. | `tests/projectEvidence.test.js`, `e2e/adversarial-inputs.spec.js` (from gap to evidence) |
| Portable export | Unsigned JSON-LD in the CLR 2.0 / OB 3.0 shape: one AchievementCredential per evidenced capability with results, provenance levels, declared evidence and goal. | Sign, verify or claim conformance. | `tests/clrExport.test.js`, `e2e/adversarial-inputs.spec.js` (portable export) |
| Parser fix (found by red team) | Titles containing a number are no longer split into fragments and silently lost. | — | `tests/engine.test.js`, `e2e/adversarial-inputs.spec.js` (large upload) |

## Still open (design or institution, not code)

- Advisor review of declared evidence needs a multi-user, consented channel (roadmap).
- Issuer verification (signed assertions, revocation) turns "document" into "institution-verified" (roadmap, month 5–6 of the validation plan).
- Revocable sharing links need server-side key management.
- Local AI explanation (GraphRAG over the student's own graph) and labour-market context are candidates for the next round; neither was started here.
