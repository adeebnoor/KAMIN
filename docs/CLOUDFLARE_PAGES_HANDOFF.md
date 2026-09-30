# Cloudflare Pages continuation — 30 September 2026

## Status

Production remains `https://kamin-12mf.onrender.com/`, a Render **static site** served through its CDN. It does not have the idle web-service cold-start problem. The Cloudflare dashboard presented a persistent security-verification loop to the cloud browser. No Cloudflare project, account binding, custom domain or DNS switch has been completed. Do not present these preparation files as a successful migration.

## Repository configuration ready for Pages

- Node 22 (`.nvmrc`), framework React/Vite, production branch `main`.
- Build command: `npm ci && npm run build`; output directory: `dist`; root: repository root.
- Set `SITE_ORIGIN` to the actual canonical HTTPS origin selected for the project. This is required when `CF_PAGES=1`; the build fails if it is absent rather than publishing Render canonical URLs on a new host.
- Pages sets `CF_PAGES=1`, which enables extensionless document links, canonical/hreflang/OG/sitemap URLs, consistent language switching and legacy query-link normalization. Render retains its existing `.html` links. `SITE_URL_STYLE=clean` can reproduce the route mode outside Pages.
- `robots.txt` is generated using the selected origin. `_headers` supplies the shared security policy. Model files are split into parts at most 16 MiB; the build enforces the Pages 25 MiB per-asset limit and file-count limit.
- All inference assets stay on the site origin. No inference API key or student-profile backend is needed. Do not add a catch-all rewrite that hides real missing pages; localized entry documents and `404.html` are generated.

## Remaining account and release actions

1. Through an authorized Cloudflare session, connect the existing `adeebnoor/KAMIN` repository to a Pages project. Review the requested repository permission; no broader account access is needed for this static project.
2. Enter the settings above and the exact selected origin. If a custom domain has not been chosen, use the confirmed project hostname for a preview and keep Render as the public link.
3. Open the deployed preview in both languages. Confirm `/ar/`, `/en/`, guide/services/PDPL/capstone, legacy `?lang=` links, language switching and canonical/hreflang after Pages' `.html` redirect.
4. Check response security headers, true 404 behavior, SPARQL error recovery and exports, encrypted snapshot handling, and opted-in local WASM model loading. Check that no student text is sent in network requests.
5. Only after approval and a successful preview, connect the selected domain and change DNS. Verify TLS and repeat the smoke journey. Keep the Render release for rollback until the cutover is accepted.

Do not paste access tokens or account credentials into issues, source files or chat. The remaining blocker is account access and domain selection, not a need for a paid always-on backend.

References: [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/), [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [headers](https://developers.cloudflare.com/pages/configuration/headers/), [limits](https://developers.cloudflare.com/pages/platform/limits/).
