# Audit remediation — 29 September 2026

Source: user-supplied Kamin bilingual audit (23 pages, 27 findings). Scope: public student website, client application, static hosting. Field outcomes and legal compliance are not inferred from automated tests.

| Finding | Implementation / verification status |
|---|---|
| F01 | One bilingual navigation model shared by React and generated documents; Services, Guide, Knowledge, Methodology, Trust and Try; common project/help footer. |
| F02 | Landing Try opens interests. Initial evidence-choice screen does not claim step 2 is active; review marks the evidence step. |
| F03 | Native radio cards for goals and interests, including equally visible Undecided; no preselected personal claim. |
| F04 | Matches lead with supported goal/preference context and a next step. Full evidence and limits remain in a disclosure. Plan opens the exact selected target. |
| F05 | Empty comparison offers course selection and two current suggestions. |
| F06 | Hero has one profile action and a sample-report link; inline four-step network tour. Existing synthetic transcript example remains available. |
| F07 | Inline synthetic network is immediately usable without account, profile writes or consent. No personal interests or consent are silently prefilled. |
| F08 | Onboarding arrow follows Arabic/English direction. |
| F09 | Student match explanation uses plain language; node identifiers and full trace metadata are optional details. Technical methodology and SPARQL remain available. |
| F10 | Public FR badges removed; research decision IDs moved to a traceability appendix. |
| F11 | Public development evidence links source, automated test runs, mapping and release history; no invented student stories or effectiveness metrics. |
| F12 | About/team and proposed institutional model, plus discoverable interoperability. No partnership, accreditation, paid offering or institutional endorsement claim. |
| F13 | Ten additional bilingual FAQ answers cover ownership, funding, help, recovery, AI and evaluation. |
| F14 | Trust page states proposed measurements and that analytics remain disabled. |
| F15 | Match limitations consolidated into a full explanation while the first material limit remains visible. Consent/privacy boundaries retained where needed. |
| F16 | Strict script CSP without unsafe-inline, XFO, Referrer, Permissions and nosniff defined centrally for preview and in Render configuration. All five headers were installed through the authenticated Render dashboard and confirmed in the production HTTP response on 29 September 2026; a YAML file alone was not treated as proof. |
| F17 | Named project supervisor and verified public professional contact route; no invented controller legal entity, mailbox or SLA. Institutional controller designation remains a launch prerequisite. |
| F18 | Audit cold-start assumption does not apply: the service is a Render static site on its CDN. Custom production domain requires the owner’s selected domain and DNS control; no paid service or keepalive added. |
| F19 | Factual SoftwareApplication/Person and per-document WebPage/FAQPage data. No fictional registered Organization. Homepage already had SoftwareApplication metadata before this change. |
| F20 | Server-readable /ar/ and /en/ routes, localized social images, canonical/hreflang/sitemap. Homepage already had Twitter Card metadata before this change. |
| F21 | Guide documents unsupported file, extraction errors, blocked/full storage, corrupt backup/passphrase, and lost device. Actual storage failures now produce persistent recovery UI and no false initial-save success. |
| F22 | Dated changelog linked from all footers and privacy/trust. |
| F23 | Enforced initial JS/CSS gzip budget 220 KiB; Arabic font 180 KiB. OCR/SPARQL remain lazy and self-hosted; no remote fonts. |
| F24 | Localized skip link, language-switch accessible names, one locale in public navigation/footer. |
| F25 | Generated localized pages contain only the active language. Legacy query routes hide and mark inactive blocks inert/aria-hidden. |
| F26 | Stable English and Arabic share routes; neutral x-default root. Arabic market default retained. |
| F27 | Brand retained with clearer bilingual student tagline. Brand-connotation interviews remain a human research activity, not a claimed completed study. |

## Verification

- Local baseline logic: 92/92 unit tests passed after the implementation.
- Build: 38 localized pages generated. Initial JS/CSS 175.7 KiB gzip, Arabic subset font 162.1 KiB in the verified final application build.
- Chromium download in this workspace returned an invalid archive. Browser checks are run by the existing GitHub Actions / Render QA gates before production.
- Added browser coverage: every public page in both languages, mobile overflow/navigation, no-consent example tour, native profile choices and accessibility, storage errors, empty comparison and crawler metadata/security headers.
- Final application commit `e56fce1ca2b239964d9345b7772f106c9863181f`: GitHub Actions run `36630439019` passed dependency audit, 92 unit tests and 160 desktop/mobile browser checks with no failed or flaky tests.
- Existing Render QA deployment `dep-dau2eb6hbpgs738osa9g` passed the same 92 + 160 checks and published the candidate. Arabic landing and the consent-to-choice flow were visually inspected before promotion.
- Production response on 29 September 2026 confirmed CSP with `frame-ancestors 'none'`, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy and nosniff. UI save success and HTTP output both verified; no broader GitHub permissions or paid plan were added.
- This report-only final commit does not alter the tested application. Production promotion is tracked by PR #29 and Render deployment history.

## Development handoff

Run `npm run build` and `npm run preview` to exercise the complete generated site; `npm run dev` is the React editing loop. Public document content is in `scripts/public-page-content.mjs` and existing `public/*.html`; shared navigation is in `public/site-content.js`, with React chrome in `src/site/SiteChrome.jsx`. Localized HTML and metadata are generated by `scripts/build-public-pages.mjs`. Do not edit generated `dist` files. Security headers must be maintained in the hosting dashboard as well as repository configuration because this service is not managed by a Render Blueprint.

## Remaining external decisions

Choose/authorize the production custom domain and DNS; formally identify the institutional data controller and rights channel before central collection; obtain study approvals and run the three-college field evaluation; conduct Arabic/English brand interviews. This release does not enable institutional sharing, personality scraping, sensitive-trait inference or telemetry.
