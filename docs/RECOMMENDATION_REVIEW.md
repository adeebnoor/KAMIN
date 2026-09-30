# Human review of Kamin recommendations

Implemented 30 September 2026. This is a local decision record for exploration, not skills validation, authenticated identity, institutional verification or an operational advisor service.

## Acceptance contract

Each pathway/course card and the selected decision-studio target offer review and contest actions. The form exposes the target's requirements, evidence presence, source and rule version. Acceptance/rejection require three explicit checks: evidence, personal goal and limits. Contest/unresolved do not require them. A reviewer supplies a local name or alias, self-declared role, reason and confidence. Free text is bounded and rendered as text.

The decision must never change inferred capabilities, evidence level, ranking, consent or the knowledge graph. Reviews are excluded from capability-sharing links and all RDF/JSON-LD graph exports. The encrypted portable profile includes them separately as private restore state.

## Modules and persistence

- `src/review/recommendations.js`: descriptors, stable input hashes, validated bounded records, history, withdrawal and candidate export.
- `src/components/RecommendationReview.jsx`: shared bilingual form and historical display; optional local timing.
- `src/App.jsx`: state/persistence, privacy deletion, consent withdrawal and placement in recommendation surfaces.
- `src/utils/portableProfile.js`: encrypted backup and historical-only review import.
- `scripts/review-governance.mjs`: public explanations, privacy and proposed study metrics.

Records follow the existing session or opt-in IndexedDB choice. SHA-256 binds a review to relevant inputs, target and rule/catalog versions; it is a change detector, not proof of identity or tamper resistance. Changing inputs requires another review. Restoring any backup forces reviews to historical-only even if its hash still matches. Older backups remain supported. Withdrawal adds an event and preserves the prior event. Separate deletion clears review history; withdrawing transcript-analysis or insight consent also clears it. Downloaded files cannot be recalled. The 200-event limit refuses new records rather than silently discarding history.

## Confirmed defect to regression check

1. The student contests a specific judgment. This is unverified feedback, never a confirmed defect by itself.
2. Optional candidate export contains only a known target ID/kind, recognized catalog/rule version and a controlled reason. Unknown imported version strings are replaced by `unrecognized-version`; unknown target IDs/reasons cannot be exported. This also prevents personal text embedded in forged metadata from leaking into candidates. It excludes names, notes, grades, input data, timestamps, judgment and context hashes. Export is a download, not submission.
3. A human reviewer checks the referenced source and constructs a minimal **synthetic** reproduction. Do not commit a student's transcript, alias, note or backup. Obtain a separate approved channel/consent if personal evidence is ever needed.
4. For a confirmed defect, add a fixture in `tests/fixtures/recommendation-red-team.json` or a focused test asserting the intended boundary. For browser-only failures, add a reproducible browser case. Record the expected behavior and source; demonstrate failure before the fix and success after it.
5. Review the fix and the source independently. A green test alone does not establish that the source interpretation is correct. Disagreements remain unresolved; do not change inference rules to satisfy an untriaged complaint.
6. Release through the existing quality and screenshot gates, retaining a rollback commit. State the correction and affected rule version so prior decisions become stale when relevant.

There is no central intake, authenticated reviewer signature, automatic test generation from personal data, or automatic complaint closure. The exported candidate intentionally cannot reconstruct a private profile. It is a starting point for synthetic reproduction, not a complete bug report.

## Verification and measurement

Unit tests cover forged records, all decision outcomes, missing/failed/unapproved/duplicate/unmapped evidence, preference-only inputs, consent withdrawal, stale rules/inputs, encrypted restoration, history limits, candidate privacy and isolation from graph/share/ranking. Browser checks cover both languages and desktop/mobile, keyboard semantics via axe, local history, acceptance gates, backup restoration and consent deletion. New-form screenshots are CI review artifacts; the public-page visual gate remains enforced.

The study protocol separately defines time to a **correct, confident** accept/reject and the proportion of seeded defects that escaped review. Targets are provisional, not results. The optional product timer starts at explicit opt-in, not at first exposure, and therefore is only descriptive. Interruptions are flagged; failures and unresolved outcomes remain in study denominators. Self-reported confidence alone is not correctness. See `PILOT_PROTOCOL_DRAFT.md` and the public validation page.
