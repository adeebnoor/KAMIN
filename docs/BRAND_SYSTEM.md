# Shared public design

`public/brand.css` is the only font-face and brand-token source. React imports it in `src/main.jsx`; the public-page builder links it before document styles. Both Noto Sans Arabic and Inter are self-hosted variable fonts with weights 100–900. `font-synthesis: none` prevents simulated weight/style. The builder preloads the active language's font.

`public/site-layout.css` owns title typography and the three content widths: 720px for reading, 1040px standard, and 1260px wide. Diagram canvases and controls have independent functional dimensions. `site-chrome.css` owns shared navigation/footer; `document-pages.css` and `help-pages.css` own reusable document components. Public source HTML has no embedded style blocks. Semantic graph colours describe relationship types and are not replacements for brand colours.

## Visual gate

`npm run build && npm run visual` discovers all localized public HTML pages and checks desktop/mobile screenshots, actual loaded font family/variable range/weight, heading colour, horizontal overflow and selected accessibility checks. Normal functional tests run separately with `npm run e2e`. CI uses Ubuntu 24.04, Node 22, and the lockfile's Playwright/Chromium versions.

Screenshots use CSS-pixel scale to keep mobile baselines compact and deterministic across device pixel ratios.

The reviewed PNG baselines live in `e2e/visual-baselines/{project}/{lang}/`. Missing or changed images fail CI. CI uploads candidate screenshots and failure evidence; it never updates or approves the baseline. Review changed pages at full resolution in both languages and screen sizes before intentionally replacing a baseline. A browser/OS upgrade needs the same review. Run `npm run visual -- --update-snapshots` only in the matching environment for an intentional design change, then inspect and commit the images with that change. The pixel-difference allowance is 0.2%; functional typography and overflow checks still apply.

## App design tokens (Task 13)

`src/tokens.css` is imported right after `public/brand.css` and holds the app's spacing scale
(`--space-1..6` = 4/8/12/16/24/32px), text sizes (`--text-sm/base/lg/xl`), the card radius, the
control height (`--control-h`: 40px, 44px on touch screens). The one card style (`.card`, with
`.panel` as an alias; 16px padding, 12px on phones) is in `src/cards.css`, imported right after it.
`src/tokens.css` holds custom properties on `:root` only: the build copies it to `public/tokens.css`
and the public pages load it before `semantic-tools.css`, which uses `--space-*` (without it the
public tables lost their padding; `e2e/visual.spec.js` now fails on any undefined `var()` on a
public page). Brand colours, fonts, `--radius` and
`--shadow` stay in `public/brand.css`. App CSS uses the tokens for padding, margin and gap;
`tests/designTokens.test.js` rejects new hard-coded spacing between 4px and 40px. Buttons animate
only movement and shadow, never colour, so contrast holds at every moment.
