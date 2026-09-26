# KAMIN ICT Knowledge Graph v1

Status: public pilot seed  
Reviewed: 2026-09-27  
Runtime version: `kamin-ict-kg-v1`

## Purpose

KAMIN now separates two graphs:

1. **Person 360** — evidence-bearing learner/person claims.
2. **Opportunity Knowledge Graph** — occupation, capability, work-activity and learning-opportunity context.

The matcher traverses between them locally. External knowledge enriches identity, context, development signals and next-step bridges. It does not silently replace KAMIN's governed evidence gates.

## Golden path: Data Analyst

Current public path:

```
CPIT-260
  -> approved transcript evidence
  -> Databases
  -> KAMIN pilot core capability gate
  -> Data Analyst

STAT-201
  -> approved transcript evidence
  -> Quantitative analysis
  -> KAMIN pilot core capability gate
  -> Data Analyst
```

The same occupation is externally anchored to:

- **ESCO Data Analyst** — code `2511.3`, URI `http://data.europa.eu/esco/occupation/d3edb8f8-3a06-47a0-8fb9-9b212c006aa2`
- **O*NET Business Intelligence Analysts** — `15-2051.01` as a related reference, not an exact equivalence claim.

## Source roles

### ESCO

Role: persistent semantic identity and interoperability.

KAMIN uses the reviewed Data Analyst URI as an external occupation identity. ESCO concepts are linked-data resources with persistent URIs.

Source:
https://esco.ec.europa.eu/en/use-esco/use-esco-services-api

### O*NET

Role: work-activity context and dated market signals.

The Data Analyst golden path currently uses O*NET `15-2051.01` as a related reference. O*NET employer-posting software signals are stored as **context-only** metadata:

- SQL
- Power BI
- Python
- Tableau

These signals currently refer to U.S. employer postings for 2025 and **must not** be interpreted as universal job requirements or as a hiring score.

Sources:
https://www.onetonline.org/link/summary/15-2051.01
https://www.onetonline.org/link/demand/15-2051.01
https://www.onetcenter.org/database.html

## Decision firewall

A knowledge edge may have one of several decision roles.

- `pilot-core-gate` — governed KAMIN pilot capability gate.
- `context-only` — informative external context; cannot change Fit.
- `development-bridge` — can suggest a next learning action.
- `external-identity` — semantic identity/alignment only.

Current ESCO and O*NET context does **not** create academic evidence and does **not** override missing evidence.

A Person 360 competency still counts toward Fit only when an active `kamin:demonstrates` claim reaches it from evidence with provenance.

## Development loop

Market context can identify development signals that are not hiring gates.

Example:

```
O*NET market context
  -> Python signal
  -> no Person360 evidence yet
  -> Python Analytics Lab
  -> developsCapability Python
  -> future evidence
  -> rebuild Person360
  -> re-run match
```

The current learning opportunities are explicitly labelled illustrative pilot pathways. They are not claims of partnership, accreditation or live course availability.

## Published graph

The exact runtime graph is generated at build time from the same source module used by KAMIN and published at:

`/knowledge/ict-kg-v1.jsonld`

This avoids documentation/runtime drift.

## Saudi / Mi'yar IP boundary

The public graph contains no proprietary SSCO inference methodology, hierarchy scoring, Saudi occupation weighting, private crosswalk table or Mi'yar workforce-intelligence rule.

Public occupation targets retain a nullable `ssco` field. The Data Analyst public seed currently leaves it `null`.

A future private resolver may return an already-resolved occupational concept/code through the generic taxonomy boundary. The protected method that generated that result remains outside this repository.

## Next expansion

After validating Data Analyst end-to-end:

1. Junior Software Engineer
2. Business Analyst
3. Junior Cybersecurity Analyst
4. IT Project Coordinator

Each occupation should pass the same source-review, provenance, decision-role and regression-test gates before its external identifiers or market context are activated.
