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

## No external taxonomy service

Kamin uses no external taxonomy service. The adapter that fetched a configurable endpoint (`src/taxonomy/externalService.js`, `src/taxonomy/config.js`) and its two settings (`VITE_SSCO_ENABLED`, `VITE_OCCUPATION_TAXONOMY_ENDPOINT`) were removed on 2026-11-17 (Task 49), following the 2026-11-04 decision that KAMIN calls no outside AI model or data service. Every adapter registered in `OccupationTaxonomyRegistry` is static and local, and runs in the browser.

The SSCO crosswalk is a static, local reference only. Until a dated written publication clearance exists, no SSCO mapping data ship in this repository, and no SSCO lookup runs anywhere. `tests/networkGuard.test.js` fails if any code under `src/`, `public/`, `scripts/`, `eval/` or `resources/` adds a network call or an outside host that is not on its reviewed list.

## Target-profile contract

Governed job target profiles may carry nullable identifiers:

```text
occupationCodes.onet
occupationCodes.esco
occupationCodes.ssco
```

These fields are identifiers only. They do not encode a classification method. With SSCO disabled, current target-profile behavior remains unchanged.

## Merge gate

Any pull request touching occupation taxonomy, occupation codes, or crosswalk paths must complete the repository pull-request IP checklist and record owner sign-off appropriate to the current filing status.
