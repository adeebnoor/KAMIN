# Kamin — AI-native product delivery

Status: implementation plan for the capstone team; 30 September 2026. The public release still processes personal profiles locally. No production database, user accounts, institutional identity or cloud AI processing is enabled by this document.

## Product outcome

Deliver a usable product by the semester gate, then improve and evaluate it over the ten-month project. A student can choose a goal, inspect the evidence and its limits, complete a practical task, retain control of the profile and receive a scoped review. The review must identify what was assessed and who is accountable.

The inherited release includes six practical tasks, progress, local review declarations, pathway comparison, governed relation metadata, local lexicon capability suggestions and bounded credential import. These are baseline features, not the team's contribution. Record the exact inherited commit and distinguish later contributions in every report.

## Seven operating rules

| Question | Required implementation | Acceptance evidence |
|---|---|---|
| Can work be divided? | Three bounded workstreams with explicit interfaces; one issue and branch per change. Parallelize only independent changes. | Contract names inputs, output schema, owned files and dependencies. |
| Is the result defined? | State user outcome, constraints and failure cases before assigning implementation to an agent. | Acceptance criteria are written before the patch. |
| Is each unit isolated? | Separate identity/storage, knowledge/evidence and AI inference. Synthetic fixtures are the default for agent work. | A failure in extraction cannot bypass consent, authentication or evidence policy. |
| Can the change be reversed? | Independent pull requests, staging deployment, versioned API/catalogue and reversible data migrations. | Demonstrated rollback and backup restoration, including the data-loss window. |
| What is the evidence? | Every PR links claims to reproducible checks, screenshots where relevant, and known limits. | A reviewer can accept or reject without reconstructing the author's reasoning. |
| Who challenges it? | A different student performs an adversarial review; agent-produced critique is supporting material. | A confirmed defect becomes a regression case; passing tests alone do not close the cause. |
| Who is accountable? | A named human author and reviewer approve the release. Agents cannot grant themselves review authority. | Review decision, responsible person, revision and evidence are recorded. |

Track time from a review-ready submission to an informed accept/reject decision, reviewer effort, confirmed defects escaping review, and reproducibility. Keep denominator, severity and observation window explicit. These are targets to measure, not current results.

## Three student leads

1. **Experience and platform:** AR/EN journeys, accessibility, domain and hosting, isolated staging/production, deployment automation, application authentication and operational monitoring. Example: demonstrate that two synthetic student accounts cannot read one another's private records.
2. **Knowledge and evidence:** reviewed mappings for the agreed colleges, provenance and versioning, task rubrics, database data contracts and review lifecycle. Example: preserve the source and version of a course-to-capability relation through edit, review and withdrawal.
3. **AI and evaluation:** benchmark the existing lexicon and semantic retrieval, then add a bounded model service if it improves measured performance. Example: extract a suggested capability and supporting sentence, abstain without evidence, and withstand instructions hidden in a project description.

Security, integration and testing are shared. Rotate red-team review. Each student must explain and rerun their changes, including code produced with agents.

## From a public static release to an operational product

The current Render static site is real hosting. The missing product layer is authenticated services, governed optional persistence and operations, not merely a different host.

### Phase 1 — first two weeks: reproducible baseline and decisions

- Each member runs the inherited release, checks six synthetic journeys and submits one independently reviewable improvement.
- Freeze a small interface contract and inventory: what already exists, what is a demo, what remains a proposal.
- Agree the project-owned or university-approved domain, budget, deployment owner, institutional partner and data-processing scope. Do not buy a domain or open paid subscriptions without the supervisor's budget approval.
- Produce a one-page architecture decision for hosting region, identity provider, database, object storage, backup retention and model processing. Region and provider availability must be checked at procurement time.
- Prepare the college pilot protocol and approval requests; no real-data recruitment before approval.

### Phase 2 — a complete vertical slice on staging

Proposed stack: preserve the React client and add a small authenticated API, managed PostgreSQL and private object storage only for user-selected uploads. Use synthetic accounts and data first. This is a design proposal, not a committed vendor choice.

Candidate data entities: organizations, users, consent receipts, selected profile records, evidence references, task progress, review packages, reviewer memberships, review decisions and audit events. Store selected fields under a clear purpose and retention rule. Do not silently mirror the current browser profile into the database.

Required boundary checks:

- Authentication is provided by the identity service; authorization is checked by the API and database policies. A client cannot choose an advisor role or change evidence levels.
- A student shares only a previewed package with a named authorized reviewer, for a scope and period. Withdrawal and expiry stop future access; downloaded copies cannot be recalled.
- Secrets stay outside the browser and repository. Logs omit raw student documents and sensitive content.
- Migrations are versioned; backups are restored in a separate test environment; the release can be rolled back without erasing student records.
- Cloud sync and external AI processing each require their own clear opt-in flow. Local use remains available.

### Phase 3 — measured AI contribution

Keep the current rules and lexicon as baselines. Use a frozen, independently labelled AR/EN test set separated from development examples. Measure extraction precision/recall, grounding, unsupported claims, abstention, latency and cost. Compare semantic retrieval and any GraphRAG addition against simpler baselines before enabling them.

Model outputs remain suggestions. No model changes trust levels, grants roles, executes unrestricted queries or approves its own output. Test prompt injection, missing evidence, contradictory sources, cross-user access and provider failure. Apply request limits and a budget cap before external processing.

### Phase 4 — product release and pilot

Before the semester release: a verified custom-domain setup, named operational owner, monitored deployment, documented incident/rollback path, tested recovery, approved data flows and a usable complete student journey. A pilot across three colleges is a planned exploratory study, not an existing result. If partner approvals are delayed, release the safe scope and report the missing validation explicitly.

## First review packet

Each student submits: baseline commit, one task contract, PR link, one-page change summary, claim/evidence matrix, adversarial case, screenshot/video when applicable, and one unresolved limitation. Review every week; demonstrate an integrated user journey every two weeks. The precise calendar follows the supervisor-approved semester plan.

References within the repository: `STUDENT_HANDOFF.md`, `CAPSTONE_ROADMAP_20260927.md`, `ADVISOR_REVIEW_DESIGN.md`, `PRIORITIES_20260930.md`, `PILOT_PROTOCOL_DRAFT.md`.
