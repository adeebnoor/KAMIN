# Operable advisor review — design (not yet operational)

Status: design proposal, 30 September 2026. Nothing in this document is live. The public release
has no multi-user channel, no reviewer identity, and no central store of student records.
"Advisor approval" is therefore never shown as a working feature; every reviewer role in the
product today is a self-declared label that cannot raise an evidence level (enforced by
`tests/advisorSeparation.test.js`).

## What exists today (local only)

- A student can share a limited, previewed capability snapshot by link (encrypted, key in link, not revocable).
- A student can record a local review of a recommendation or a task output, naming a reviewer
  and role. The record stays at the declared level; withdrawal keeps history.
- A student can import a signed credential; it is verified only against an empty trusted-issuer
  registry, so it stays unverified until an issuer is admitted under an agreement.

## Target design

| Concern | Decision |
| --- | --- |
| Reviewer identity | Institutional sign-in (university IdP, OIDC) for advisors; students never create advisor identities. Kamin never stores passwords. |
| Permissions | An advisor sees only packages a student explicitly shared with that advisor's institutional account, for a stated scope (capabilities, tasks, or a single recommendation) and a stated period. |
| Decision record | Each review stores: reviewer identity (from IdP), scope, decision, reason, timestamp, the fingerprint of the reviewed package version, and the rule/catalog versions. |
| Who can see | The student always; the reviewing advisor for the shared period; nobody else. No cohort view of individual records. |
| Objection and withdrawal | The student can contest a review (kept alongside it) and withdraw sharing; withdrawal stops future access and is logged, but copies already downloaded cannot be recalled. |
| Storage | No central database of student records by default. Shared packages live in an institution-hosted store approved under PDPL review, scoped per institution, with a retention schedule. |
| Institutional dashboard (later) | Shows cases awaiting review, task progress and aggregated measures with minimum cell sizes. Never an automatic ranking of students' employability. |

## Evidence level rules (unchanged by this design)

- Student self-review, peer or alias reviewer: declared.
- Institutionally signed-in advisor review: "advisor-reviewed" (a distinct level, still not issuer-verified).
- Issuer-verified credential: institution-verified. Only a trusted issuer's signature reaches this level.

## Acceptance tests before calling it operational

1. A student cannot create, impersonate or approve as an advisor (identity comes from the IdP only).
2. Sharing never exceeds the elements the student selected; the advisor's view is diffed against the selection.
3. Separation: two students cannot see each other's packages; two advisors see only their own shares.
4. Cancellation and expiry: access stops at withdrawal or expiry; attempts after that are refused and logged.
5. Every review carries the package fingerprint; a changed package invalidates the review.

## Order of work

1. Institutional IdP integration in a test tenant (no student data).
2. Institution-hosted share store with retention and audit log; PDPL review.
3. Advisor review UI reusing the local review model; decisions signed by the store.
4. Only then: institutional dashboard with aggregation limits.
