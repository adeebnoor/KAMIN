# Graph-native matching

Kamin matching now consumes the Person 360 graph directly instead of flattening the learner into a list of skill IDs before judging an opportunity.

## Core rule

A capability counts toward a target requirement only when the Person 360 graph contains an active `kamin:demonstrates` claim with provenance. A competency entity by itself is not evidence.

The public matching path is:

```
Course / approved source
  -> Evidence
  -> qualified kamin:demonstrates claim
  -> Competency
  -> kamin:requiresCapability
  -> Opportunity
```

Goals and structured preferences are also graph claims. They may provide context or alter whether a result is exploratory, but they never erase a missing required-capability evidence path.

## Explainability

Each match exposes `semanticPaths` and `graphTrace` so the UI can show the actual evidence route used in the judgment. Public output remains categorical (`fits`, `conditional`, `exploratory`, `not-yet`) and is not presented as a calibrated probability.

## Target graphs

Reference jobs and training pathways are converted at runtime into small semantic target graphs using generic relations such as:

- `kamin:requiresCapability`
- `kamin:developsCapability`
- `kamin:supportsGoal`
- `kamin:compatiblePreference:<scheme>`
- `kamin:classifiedAs`

This leaves room for ESCO, O*NET, CTDL/CASE and other external concept identifiers without making the matcher dependent on one taxonomy.

## SSCO / Mi'yar IP firewall

This public graph engine does **not** contain SSCO classification methodology, proprietary hierarchy logic, occupation-scoring logic, private crosswalk tables, or Mi'yar workforce-intelligence rules.

If SSCO is enabled after the filing gate, the public matcher may consume an already-resolved occupational concept or code through the generic taxonomy boundary. The protected method that produced that result remains outside this repository.

## Compatibility

The legacy flat-profile path is retained only for backward compatibility and tests. The production KAMIN Matches screen builds Person 360 first and runs in `person360-graph` mode.
