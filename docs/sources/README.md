# Official sources

Task 01 allows a single source: the official **FCIT Catalog 2024-25**.

| File | From the project library | Used for |
|------|--------------------------|----------|
| `FCITCatalog24-25.pdf` | `kamin/sources/FCITCatalog24-25.pdf` | Course codes, official English titles, `catalogPage` (70 pages, English only) |
| `مصفوفة-مقررات-الحاسبات.xlsx` | `kamin/amjd-2026-10-28/` | Draft matrix (prepared from the catalog) for choosing which official courses map to existing capabilities |

Do not mix in other sources or third-party websites.

## How `src/catalog/fcit-2024-25.json` was built

- Every entry is `"verification": "checked-against-catalog"`: code and English title match the
  catalog, and `catalogPage` is the 1-based PDF page of the course description (or of the study
  plan for STAT courses, whose descriptions are not in the FCIT catalog).
- `title.ar` is `null` everywhere: the catalog has no Arabic titles. Fill them in only from an
  official departmental source.
- Capabilities follow the matrix, limited to capabilities that already exist in `src/data.js`.
  The matrix also proposes the specialist capabilities `testing`, `db-operations`,
  `web-development` and `systems-analysis` (e.g. CPIT-345, CPIT-405, CPIS-357, CPIS-358,
  CPIS-483, CPCS-403). These are held back: the current policy test
  (`tests/catalogExpansion.test.js`) says coursework must not grant them, so that needs a
  supervisor decision first. Capabilities the matrix marks as new are out of scope for Task 01.
- Learning outcomes are not in the catalog: each is written from the official title and
  description and stays `"status": "proposed"` until a department reviewer approves it
  (`reviewedBy`, `reviewedAt`).
