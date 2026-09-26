# Occupation taxonomy boundary

This document defines the public integration boundary only. It does **not** document or implement any occupational-classification methodology.

## Public contract

An occupation taxonomy adapter exposes exactly these operations:

- `lookup(code)`
- `search(query)`
- `crosswalk(fromTaxonomy, toTaxonomy, code)`

Crosswalk results use only the governed SKOS relation vocabulary: `exactMatch`, `closeMatch`, or `broadMatch`.

## SSCO public-release rule

The public Kamin repository must not contain:

- SSCO classification rules or hierarchy-construction logic.
- Proprietary matching/scoring methodology.
- Private ontology/source assets.
- SSCO crosswalk mapping tables unless a dated written publication clearance exists.

The public build therefore defaults to `VITE_SSCO_ENABLED=false`. When enabled in an authorized environment, the adapter talks to a separately controlled runtime service; implementation and mapping data do not ship in this repository.

## Target-profile contract

Governed job target profiles may carry nullable identifiers:

```text
occupationCodes.onet
occupationCodes.esco
occupationCodes.ssco
```

These fields are identifiers only. They do not encode a classification method. With SSCO disabled, current target-profile behavior remains unchanged.

## Merge gate

Any pull request touching occupation taxonomy, SSCO feature flags, occupation codes, or crosswalk paths must complete the repository pull-request IP checklist and record owner sign-off appropriate to the current filing status.
