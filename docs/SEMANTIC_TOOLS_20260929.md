# Semantic tools release — 29 September 2026

## Student and researcher flows

- Knowledge workspace → SPARQL: malformed queries keep an error panel with parser line/column. Human-readable result cells retain original IRIs in `title` and lossless exports.
- Successful query → CSV download / Copy CSV. Spreadsheet formula prefixes are escaped; JSON remains the lossless term export.
- Dataset export → Turtle (union graph) or TriG (named graphs preserved). Personal scope still requires its own consent. Downloads are unencrypted and the UI says so.
- Profile → Interests & goal → optional local semantic recall. The model loads only after explicit confirmation of an approximately 145 MB download. Arabic/English text is embedded in a WASM worker; model assets are served from the same origin. No student text is sent or cached. Inspect a candidate to see symbolic evidence and gaps; retrieval does not assert a capability or change the profile.
- Profile saving options → choose capabilities/goal → review → create encrypted snapshot. Only catalog capability IDs and an optional goal are allowed; no identity, grades, courses, audit history or social text. AES-GCM ciphertext and key live in the fragment, which is consumed and removed from the address bar, including same-document navigation. The recipient opens a separate preview; the profile is never overwritten.
- Footer → PDPL mapping. The bilingual page maps selected legal articles to controls, descriptive DPV terms and remaining institutional work. It is not certification or a complete legal assessment.
- Public navigation uses `/ar/` and `/en/`. Legacy language query links redirect to the matching language path.

## Model and limitations

Pinned `Xenova/paraphrase-multilingual-MiniLM-L12-v2` revision `2c4055b12046f11709e9df2c122e59ffbdc2f900`, quantized ONNX SHA-256 `66fc00f5f29afcaff34092e1bdd20008ca3918265a82fb9695a551e510cc4ebc`, Transformers.js 4.3.0. Build-time catalog vectors are versioned with runtime and catalog; browser assets and the reconstructed model are hash checked. Public assets are cached separately and can be deleted through the UI.

Recall is experimental: a small catalog, cosine similarity floor and relative margin, not calibrated confidence or measured academic outcomes. Very broad interests may still yield weak candidates. The three-college pilot should measure recall, relevance, abstention, Arabic language quality, device latency and opt-out behavior before efficacy claims.

Sharing is a bearer-link capability, not a zero-knowledge proof, verified credential or zero-risk transport. Anyone with the complete link can decrypt and forward it; messenger apps, extensions and browser history can expose it. Links cannot be revoked. The UI explains this before creation.

## Hosting status and continuation

The existing production Render service was verified as a **static site**, served through its CDN. It does not have the idle web-service cold-start problem. No DNS or hosting migration is included in this release: the Cloudflare dashboard remained in a browser security-verification loop, so account/project configuration could not be completed.

`npm run build` generates `dist/_headers` and enforces Cloudflare Pages' 25 MiB per-file and 20,000-file limits. Model shards are at most 16 MiB. These are compatibility preparations, not evidence of a Cloudflare deployment.

To complete Pages migration once dashboard access is available: connect this repository, select `main`, use Node 22 and `npm run build`, publish `dist`, and set `SITE_ORIGIN` to the chosen canonical HTTPS origin. Verify Pages' `.html`/extensionless URL redirects and align canonical/hreflang/sitemap with the final served URLs before switching the public domain. Verify security response headers, Arabic/English paths, legacy links, model shard/WASM delivery and the snapshot flow on the Pages preview. Retain Render until the domain switch and smoke tests pass. No domain change or paid resource was created.

## Verification gate

The quality workflow runs dependency audit, 100 unit tests, production build and 170 desktop/mobile browser tests. New browser tests exercise actual WASM inference without external inference calls, malformed query recovery, CSV/Turtle/TriG downloads, encrypted sharing and locale routes. Release approval depends on the final commit's green CI; live deployment status remains the source of truth for publication.

Sources: [Render static sites](https://render.com/docs/static-sites), [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [official PDPL](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPL), [DPV 2.0](https://www.w3.org/community/reports/dpvcg/CG-FINAL-dpv-20240801/).
