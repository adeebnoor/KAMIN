# Pre-pilot audit, round 2 — 30 September 2026

Scope: the live release at https://kamin-12mf.onrender.com reviewed end to end (all public pages in both languages, the student workspace with the synthetic sample, mobile viewport, operating-system dark preference, hosting headers and routes). Each finding below was fixed in this change and is guarded by an automated check, so a regression fails the quality gate instead of reaching the pilot.

| Finding (red team) | Evidence | Fix | Guard |
| --- | --- | --- | --- |
| Under an OS dark preference the workspace became unreadable: headings, metric values, goal buttons and match cards rendered navy-on-navy or white-on-white (contrast 1.0–2.3, WCAG AA needs 4.5). Public pages had no dark theme at all, so the product was inconsistent. | Live contrast sweep, 30 Sep 2026: 82 failing text nodes in Matches alone, 30 on the dashboard. | Ship the single audited light theme everywhere (`index.html` already declares `color-scheme: light`); removed 17 partial dark blocks from `src/*.css`. | `e2e/color-scheme.spec.js` sweeps landing, transcript review, dashboard and every workspace section in light and dark schemes, ar and en, desktop and mobile. |
| Gold “Evidence” label in My skills at 2.57:1 on white (light theme). | Same sweep. | Darker gold text token `#7a5512`. | Same gate. |
| A dated “Research and sharing tools · 30 September 2026” release card was appended to the privacy policy, trust center, guide, services and interoperability pages. | Page text of all five pages. | Release notes now live on the changelog only. | `e2e/hosting-hygiene.spec.js`. |
| No RFC 9116 security contact (`/.well-known/security.txt` → 404) while the site claims a security posture. | HTTP 404. | Published `security.txt` with two contact routes, policy link and expiry; `SECURITY.md` gains a reporting section. | `e2e/hosting-hygiene.spec.js`. |
| PWA `start_url` forced `?lang=ar`, overriding the language the student chose. | `manifest.json`. | `start_url: "/"` so the stored language applies. | `e2e/hosting-hygiene.spec.js`. |
| Landing preloaded `kamin-logo-v3.webp` but never renders it (browser warning on every visit). | Console warning, network log. | Preload removed; the asset is still served for the workspace. | `e2e/hosting-hygiene.spec.js` fails on any preload warning. |
| Transcript parser cut any row whose title contains a two-to-four digit number (for example `PHYS-101 Physics 101 A`) into two fragments, so the real course was silently dropped into the "rows need review" bucket. Found by feeding 1,500 synthetic rows: 10 parsed, 2,980 rejected. | Node timing run on 30 Sep 2026; reproduced in the browser. | Merged-row splitting now keeps a fragment with the preceding text unless it is a complete row (code + grade); genuinely merged rows still split. | `tests/engine.test.js` (title-with-number case) and `e2e/adversarial-inputs.spec.js` (markup injection, duplicates, out-of-range grade, Arabic digits, 1,500-row upload, hostile SPARQL). |

## Verified as sound (no change)

Security headers (CSP, HSTS preload, frame-ancestors none, permissions policy), localized routes with canonical and hreflang, 404 in the visitor's language, no horizontal overflow on a 375 px viewport in Arabic, no unlabeled icon buttons, no page errors through the sample journey, no third-party requests.

## Still open for the owner (not code)

- Contact page routes support through a personal website. A pilot needs a dedicated, monitored support channel with a stated response time before university testing.
- Sharing links carry their key and cannot be revoked; the UI says so. A revocable, institution-scoped sharing design belongs to the verification roadmap.
- All validation numbers remain targets; investor material must keep presenting them as such.

## Decision principle applied

Result-defined work with acceptance criteria, isolated reversible changes (each fix is one commit-sized unit), human-verifiable evidence (this matrix), and every red-team finding converted into a permanent check.

## Visual baseline review — 30 September 2026

Reviewed the desktop and mobile artifacts from [quality run 182](https://github.com/adeebnoor/KAMIN/actions/runs/36683366313), built from `9281ae89f473cb065b43b4ecef7525262297b0ce`. That run passed 106 unit tests, 202 functional browser tests, the production build and dependency audit. Its only failures were the 24 expected screenshot comparisons.

Approved only `privacy`, `trust`, `guide`, `services`, `interoperability` and `changelog` in Arabic and English, for desktop and mobile Chromium. Inspected the changed regions with surrounding content: the five content pages lose the dated release card; the changelog gains the audit entry. Footer flow, text wrapping and spacing remain intact. All other 64 screenshots are pixel-identical to their existing references. The original PNG bytes are preserved; thresholds and test coverage are unchanged.

Artifact integrity was checked against GitHub's SHA-256 digests:

- Desktop (`11082686477`): `84bf1ae7456fbe64200a3cfc6f8ef79aa78acd7c4fef9481cbc3fc111135252a`
- Mobile (`11082821336`): `1bd04b29f0da6fbea6bc733edc3614652ed8c5b84f91c82602824f9627d20a9d`

The approval commit must pass the complete quality gate again before publication.
