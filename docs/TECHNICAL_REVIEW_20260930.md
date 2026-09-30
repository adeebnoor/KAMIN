# Technical review response — 30 September 2026

This records implementation and verification, not field-study results.

| Finding | Repository response |
| --- | --- |
| Conflicting typography, colour and document layout | One brand source, self-hosted Inter and variable Arabic 100–900, real font weights with synthesis disabled; 720/1040/1260px content widths; all twelve embedded document style blocks moved to reusable CSS. |
| Visual drift in future releases | Both languages, every generated public page, desktop and mobile have a screenshot gate. Reviewed baselines are versioned; CI cannot approve its own changes. |
| PBKDF2 iteration count | New password-protected exports use PBKDF2-HMAC-SHA-256 at 600,000 iterations. Previous default was 310,000. The 32,768 constant is a base64 chunk size, not the KDF. A fixture encrypted by the previous implementation verifies old backups still open; new exports cannot request the weaker setting. |
| SPARQL blocking the UI | Already isolated in a disposable Web Worker, with cancellation, timeout and termination. Existing functional tests cover this workflow. |
| Turtle and CSV absent | Already implemented: JSON-LD/Turtle/TriG graph downloads and CSV query-result downloads, exercised by functional tests. |
| Mixed locale URLs | Generated pages and shared links use /ar/ and /en/. Legacy ?lang=en links normalize to the localized page. |
| Goal-only sharing | Already supported with explicit inclusion and review consent. The dialog now explains the precise missing prerequisite when creation is disabled; a test creates a goal-only snapshot with an unapproved transcript. |
| Core content unavailable without JavaScript | Localized no-JavaScript home content links to static guide, sources/catalog and sample report. Interactive inference and extraction still need JavaScript. |
| Heavy local inference | The quantized model is 129.1 MiB; the existing UI warns about an approximately 145 MB optional first load including runtime, requests opt-in, and provides download progress/failure handling. This is an asset-size observation, not a measured network latency claim. |
| Cloudflare Pages | Hosting configuration is prepared and asset limits checked. Production remains Render's CDN static site. The Cloudflare account/security-verification blocker is documented in CLOUDFLARE_PAGES_HANDOFF.md; no migration or DNS cutover has occurred. |

## Evidence still needed outside software tests

Real Saudi transcript extraction accuracy requires authorized, redacted samples spanning institutions, PDF formats and scans. Published precision, recall, completion time, psychometric validity, institutional verification and student usability results require real protocols, participants/partners and measurements. The current validation plan and targets remain explicitly proposed rather than achieved. Synthetic demonstration data is labelled synthetic. No code change authenticates a university seal or creates a university partnership.

## Release checks

Unit tests include old encrypted-backup compatibility. The build checks localized routes and asset budgets. Browser tests exercise onboarding, consent, RDF/SPARQL, downloads, sharing, mobile journeys and accessibility. The public-page visual gate additionally inspects the common typography and layouts. The merged release and production checks are recorded in its pull request.
