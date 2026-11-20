# Decision record — course maps for other colleges (Science, Medicine)

**Date:** 2026-11-18
**Status:** OPEN / waiting for the supervisor's decision on the source
**Scope:** `src/catalog/`, the department review kit (`scripts/review-kit/`), Task 37

## The question for the supervisor

> **May each college's own official catalog be used, one per college, never mixed?**
>
> For example: the Faculty of Science courses would be mapped only from the official Faculty of
> Science catalog, the Faculty of Medicine courses only from the official Faculty of Medicine catalog,
> and neither would ever borrow from the FCIT catalog or from each other.

Today the fixed rule (Task 01, `docs/sources/README.md`) allows a single source: the official
**FCIT Catalog 2024-25**. A second catalog is a new source, so it needs this decision first.

## What is true today (2026-11-18)

- `src/catalog/colleges.js`: FCIT `hasApprovedMap: true`; SCI and MED `hasApprovedMap: false`.
- `docs/sources/` holds one catalog: `FCITCatalog24-25.pdf` (70 pages, English only).
- A Science or Medicine student gets **no capability from courses**. The app says why: "This college
  has no approved course map yet, so its courses create no capability." Verified credentials still
  count, because they do not depend on the college.
- No map file, placeholder or invented course exists for Science or Medicine.

## What is ready (Task 37), so work can start the day a catalog is approved

- **One loader for every college.** `src/catalog/courseMaps.js` loads `src/catalog/<college>-<year>.json`
  (for example `fcit-2024-25.json`) with the same schema as the FCIT map and picks the map by the
  student's college. A map is used for a student only when the college has `hasApprovedMap: true`.
- **An incomplete map cannot load.** The loader refuses a map without the catalog name (on the map
  and on every course, and it must be the same catalog: never mixed), without a `catalogPage` per course,
  or without a `verification` per course. `tests/courseMaps.test.js` checks every map file in
  `src/catalog/`.
- **The same review flow.** The Task 31 kit takes `--college`:
  `npm run review:export -- --college SCI` and `npm run review:check -- --college SCI <sheet.csv>`.
  While a college has no map file, both stop and point to this record.

## If the answer is **yes**

1. The supervisor or the team obtains the official catalog PDF **from the college itself** and adds it to
   `docs/sources/` with a row in `docs/sources/README.md` (one catalog per college).
2. The team builds `src/catalog/<college>-<year>.json` (for example `sci-2025-26.json`) **only** from that
   catalog: official codes and English titles, `catalogPage` for each course, `"verification":
   "checked-against-catalog"`, learning outcomes `"status": "proposed"`, Arabic titles `null` unless the
   catalog prints them. Capabilities only from those that already exist in `src/data.js`.
3. One import line and one entry in `MAP_FILES` in `src/catalog/courseMaps.js` register the file. It is
   loaded and checked, but `hasApprovedMap` stays `false`, so students still get no capability from it.
4. The college's department reviews the map with the kit, as in Task 31
   (`npm run review:export -- --college <ID>`, fill, `npm run review:check -- --college <ID> <sheet>`).
5. Only after that review: set `hasApprovedMap: true` for the college. From then on its students get
   capabilities from their own college's map, never from FCIT's.

## If the answer is **no** (or no decision)

Nothing changes. Science and Medicine keep `hasApprovedMap: false`, their students see the "no approved
course map yet" message, and no map file is added. This record is superseded only by a dated written
decision.
