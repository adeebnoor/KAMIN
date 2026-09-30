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

## Verified as sound (no change)

Security headers (CSP, HSTS preload, frame-ancestors none, permissions policy), localized routes with canonical and hreflang, 404 in the visitor's language, no horizontal overflow on a 375 px viewport in Arabic, no unlabeled icon buttons, no page errors through the sample journey, no third-party requests.

## Still open for the owner (not code)

- Contact page routes support through a personal website. A pilot needs a dedicated, monitored support channel with a stated response time before university testing.
- Sharing links carry their key and cannot be revoked; the UI says so. A revocable, institution-scoped sharing design belongs to the verification roadmap.
- All validation numbers remain targets; investor material must keep presenting them as such.

## Decision principle applied

Result-defined work with acceptance criteria, isolated reversible changes (each fix is one commit-sized unit), human-verifiable evidence (this matrix), and every red-team finding converted into a permanent check.
