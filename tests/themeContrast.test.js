// Task 61 · WCAG contrast of the new interface in both themes, computed from the CSS files themselves.
// Light values: public/brand.css (unchanged). Dark values: src/ui2/theme.css (same token names).
// Every rule in src/ui2/*.css that sets a text colour or a surface is paired with the background it sits on:
// text ≥ 4.5:1 (body-text level for every text, also the large headings); focus ring, control borders and
// the selected-chip fill ≥ 3:1 against the surfaces next to them. A new colour rule in src/ui2 fails here
// until it is classified below, so no pair can be added without being checked.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { render as renderLegacyDark, surfaceToken, textToken, borderToken, parseColour, prefixed } from '../scripts/make-legacy-dark.mjs'

const read = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '')
const declarations = body => Object.fromEntries(body.split(';').map(part => part.trim()).filter(Boolean)
  .map(part => [part.slice(0, part.indexOf(':')).trim(), part.slice(part.indexOf(':') + 1).trim()]))
// Every innermost rule (selector { body }), media rules included, in file order.
const rules = css => [...stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim().replace(/\s+/g, ' '), decl: declarations(body) }))
const block = (css, selector) => {
  const found = rules(css).filter(rule => rule.selector === selector)
  expect(found.length, `rules for ${selector}`).toBeGreaterThan(0)
  return found
}

const BRAND = read('public/brand.css')
const THEME = read('src/ui2/theme.css')
const UI2_CSS = readdirSync('src/ui2').filter(file => file.endsWith('.css')).map(file => `src/ui2/${file}`)
const STYLES = read('src/styles.css')

const brandTokens = Object.fromEntries(Object.entries(block(BRAND, ':root')[0].decl).filter(([name]) => name.startsWith('--')))
const themeShared = block(THEME, ':root[data-theme]')[0].decl
const darkBlocks = block(THEME, ':root[data-theme="dark"]').concat(block(THEME, ':root:not([data-theme="light"])'))
const THEMES = {
  light: { ...brandTokens, ...themeShared },
  dark: { ...brandTokens, ...themeShared, ...darkBlocks[0].decl },
}

// var(--name) → its value in that theme, following var() chains and fallbacks.
function resolve(theme, value, depth = 0) {
  if (depth > 10) throw new Error(`var() loop at ${value}`)
  const ref = value.trim().match(/^var\(--([\w-]+)(?:\s*,\s*(.+))?\)$/)
  if (!ref) return value.trim()
  const own = THEMES[theme][`--${ref[1]}`]
  if (own !== undefined) return resolve(theme, own, depth + 1)
  if (ref[2]) return resolve(theme, ref[2], depth + 1)
  throw new Error(`--${ref[1]} has no value in the ${theme} theme`)
}
function rgb(colour) {
  let hex = colour.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1]
  if (!hex) throw new Error(`not a solid hex colour: ${colour}`)
  if (hex.length === 3) hex = [...hex].map(c => c + c).join('')
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
}
const luminance = colour => {
  const [r, g, b] = rgb(colour).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const tokenOf = value => value?.match(/var\(--([\w-]+)/)?.[1]

// Where a rule's text sits when the rule does not paint its own background.
const SURFACE = [
  [/^\.ui2-sheet/, ['paper']],
  [/^\.ui2-tab\b/, ['paper']],
  [/^\.ui2-btn/, ['paper']],
  // Task 75 · Home sits on the old landing hero's gradient: its words are checked on each of its three colours.
  [/^\.ui2-page\.ui2-home/, ['ui2-hero-1', 'ui2-hero-2', 'ui2-hero-3']],
  [/^\.ui2-page/, ['soft']],
  // Task 75 · the brand's name and tagline sit on the top bar.
  [/^\.ui2-brand\b/, ['ui2-bar']],
  // Task 75 · src/ui2/legacy-dark.css: the reused old parts in the dark theme. Their words sit on the dark surfaces those
  // rules paint (--paper, --soft, --navy-3 and the tints); they are checked in the dark theme only, where they apply.
  [/^:root\[data-scheme="dark"\]/, ['paper', 'soft', 'navy-3', 'mist', 'warn-bg', 'danger-bg', 'success-bg']],
  // Text buttons sit on the page and inside the sheet.
  [/^\.ui2-text-btn/, ['soft', 'paper']],
  // Task 62 · step 1: the upload area is --paper (--navy-3 while pointed at or while a file is dragged over it);
  // the result card, the approval box and the "Fix something" and "Why?" sheets are --paper.
  [/^\.ui2-drop\b/, ['paper', 'navy-3']],
  [/^\.ui2-(card|result-line|approve|fix|why)\b/, ['paper']],
  // Task 63 · step 2: the project cards, the Add/Edit form and the "Why?" sheet are --paper (the page's own lines,
  // .ui2-page p.ui2-projects-*, sit on --soft through the .ui2-page rule above).
  [/^\.ui2-project\b/, ['paper']],
  // Task 64 · step 3: the consent box, the two chip questions, "Something else?" and the cards of interests in the
  // student's own words are --paper (the page's own lines, .ui2-page p.ui2-interests-*, sit on --soft).
  [/^\.ui2-interest\b/, ['paper']],
  // Task 65 · step 4 and My plan: the goals box, the feed's cards and empty state, the plan's lists and its empty state,
  // the save offer, and the sheets ("Why these paths?", Details, "Compare paths") are --paper. The page's own lines
  // (.ui2-page p.ui2-next-*, p.ui2-plan-*, p.ui2-feed-*) sit on --soft through the .ui2-page rule above; the feed's and
  // the plan's headings sit on --soft too.
  [/^\.ui2-(goals?|goal-[\w-]+|paths?|path-[\w-]+|step|step-[\w-]+|feed-empty|compare|plan-(empty|item|done|offer))\b/, ['paper']],
  [/^\.ui2-(feed|plan-block)\b/, ['soft']],
  // Task 66 · Profile: the header, My capabilities (rows, the "because" line, the level meanings), the three sections,
  // More and the links are --paper boxes; the reasons sheet is --paper too.
  [/^\.ui2-(profile|cap|legend|more)\b/, ['paper']],
  // Task 67 · Settings: the groups (rows, the "Save on this device" switch) and "What does withdrawing remove?" are --paper
  // boxes; a sub-page's other headings sit inside the old components' .ui2-legacy box, which is --paper too.
  [/^\.ui2-settings\b/, ['paper']],
  // Task 68 · Help: the two groups of links are --paper boxes; the one line about reviewer tools and a tool's title sit on
  // the --soft page as well (a tool's sub-page), so every Help colour is checked on both. A "Why?" sheet's Help link is
  // inside the --paper sheet. The footer sits on the --soft page (Home and Help).
  [/^\.ui2-help-link\b/, ['paper']],
  [/^\.ui2-help\b/, ['paper', 'soft']],
  [/^\.ui2-footer\b/, ['soft']],
  // Task 74 · My map, in Profile's --paper box: a node's own words and icon sit on its --soft fill, a capability's on its
  // --navy-3 fill; the panel under the map is --soft; the headings, the line under the title, the empty layers and the
  // legend sit on --paper. Every map colour is checked on each surface it can sit on.
  [/^\.ui2-map-node\[data-kind="capability"\]/, ['navy-3']],
  [/^\.ui2-map-(node|edge|sub)\b/, ['soft', 'navy-3']],
  [/^\.ui2-page p\.ui2-map-|^\.ui2-map\b|^\.ui2-map-/, ['paper', 'soft']],
]
// Rules whose colour carries no information of its own, with the reason.
const DECORATIVE = {
  '.ui2-tab[aria-current] svg': 'the icon sits next to its label, which names the tab; the selected tab is marked by the label colour and aria-current',
  '.ui2-skeleton span': 'loading bars, no text',
  '.ui2-result-skeleton span': 'loading bars in the shape of the result card, no text; the stage line above them says what is happening',
  '.ui2-sheet-handle span': 'drag handle; the sheet also has a named close button, Esc and a tap outside',
  '.ui2-sheet-backdrop': 'the dimmed page behind the sheet, no text',
}
// Surfaces that hold text inheriting --ink.
const INHERITS_INK = new Set(['.ui2', '.ui2-topbar', '.ui2-tabs', '.ui2-sheet', ':root[data-theme],:root[data-theme] body', ':root[data-theme], :root[data-theme] body'])

function ui2Rules() {
  return UI2_CSS.flatMap(file => rules(read(file)).map(rule => ({ ...rule, file })))
    .filter(rule => !rule.selector.startsWith(':root[data-theme]') || rule.selector.includes('body'))
    .filter(rule => !rule.selector.startsWith(':root:not') && !rule.selector.startsWith('@') && !rule.selector.includes('keyframes') && !/^\d+%$/.test(rule.selector))
}

// [label, text token, background token] for every text colour in src/ui2/*.css.
function textPairs() {
  const all = ui2Rules()
  const colourOf = selector => tokenOf(all.find(rule => rule.selector === selector && rule.decl.color)?.decl.color)
  const pairs = []
  const unclassified = []
  for (const { selector, decl, file } of all) {
    const fg = tokenOf(decl.color)
    const bg = tokenOf(decl.background ?? decl['background-color'])
    if (!fg && !bg) continue
    if (DECORATIVE[selector]) continue
    if (fg && bg) { pairs.push([selector, fg, bg]); continue }
    if (fg) {
      const surfaces = SURFACE.find(([pattern]) => pattern.test(selector))?.[1]
      if (surfaces) surfaces.forEach(surface => pairs.push([selector, fg, surface]))
      else unclassified.push(`${file}: ${selector} (colour --${fg})`)
      continue
    }
    // A background without a colour: the text colour comes from the same control without its state, or is --ink.
    const state = selector.replace(/:hover$/, '')
    const inherited = colourOf(state) || colourOf(state.replace(/\[[^\]]*\]$/, ''))
    if (inherited) pairs.push([selector, inherited, bg])
    else if (selector.startsWith(':root[data-scheme="dark"]')) { pairs.push([selector, 'ink', bg]); pairs.push([selector, 'muted', bg]) }
    else if (INHERITS_INK.has(selector)) pairs.push([selector, 'ink', bg])
    else unclassified.push(`${file}: ${selector} (background --${bg})`)
  }
  return { pairs, unclassified }
}

describe('Task 61 · light and dark tokens', () => {
  it('public/brand.css keeps its light values exactly (the brand is unchanged)', () => {
    expect(brandTokens).toMatchObject({
      '--navy': '#0b2f5b', '--navy-2': '#153f70', '--navy-3': '#edf3f9', '--gold': '#c99a3d', '--gold-2': '#ead398',
      '--ink': '#10243f', '--muted': '#526478', '--line': '#dce5ee', '--paper': '#fff', '--soft': '#f6f8fb', '--success': '#146c55',
      '--success-bg': '#e8f6f0', '--warn': '#815900', '--warn-bg': '#fff4d6', '--danger': '#9a3030', '--danger-bg': '#fff0f0',
      '--accent': 'var(--navy)', '--accent-soft': 'var(--navy-3)', '--text-secondary': 'var(--muted)',
    })
    expect(BRAND).not.toMatch(/prefers-color-scheme|data-theme/)
  })

  it('the dark values use the same token names, once under data-theme="dark" and once under the device setting, identical', () => {
    expect(darkBlocks).toHaveLength(2)
    expect(darkBlocks[1].decl).toEqual(darkBlocks[0].decl)
    expect(THEME).toMatch(/@media \(prefers-color-scheme:dark\)\{\s*:root:not\(\[data-theme="light"\]\)\{/)
    const colourTokens = Object.entries(brandTokens).filter(([, value]) => /^#/.test(value)).map(([name]) => name)
    for (const name of colourTokens) expect(darkBlocks[0].decl, `dark value for ${name}`).toHaveProperty(name)
    for (const name of Object.keys(darkBlocks[0].decl)) expect(name in brandTokens || name.startsWith('--ui2-'), `${name} is a brand token or a ui2 token`).toBe(true)
  })

  it('dark surfaces are deep navies (blue the strongest channel, dark), text is near-white and gold stays the brand gold', () => {
    for (const name of ['--paper', '--soft', '--navy-3']) {
      const [r, g, b] = rgb(THEMES.dark[name])
      expect(b, `${name} is navy`).toBeGreaterThan(Math.max(r, g))
      expect(luminance(THEMES.dark[name]), `${name} is dark`).toBeLessThan(0.05)
    }
    expect(luminance(THEMES.dark['--ink'])).toBeGreaterThan(0.8)
    expect(THEMES.dark['--gold']).toBe(brandTokens['--gold'])
  })
})

describe('Task 61 · contrast of every text and control pair in src/ui2, in both themes', () => {
  const { pairs, unclassified } = textPairs()

  it('every colour rule in src/ui2/*.css is paired with its background (or listed as decorative with a reason)', () => {
    expect(unclassified).toEqual([])
    expect(pairs.length).toBeGreaterThanOrEqual(15)
    // The pairs a reader would expect are there.
    const has = (fg, bg) => pairs.some(([, f, b]) => f === fg && b === bg)
    for (const [fg, bg] of [['ink', 'soft'], ['navy', 'paper'], ['paper', 'navy'], ['muted', 'paper'], ['navy', 'navy-3'], ['ink', 'paper'], ['navy', 'soft']]) expect(has(fg, bg), `${fg} on ${bg}`).toBe(true)
  })

  for (const theme of ['light', 'dark']) it(`${theme}: every text ≥ 4.5:1 on its background`, () => {
    const low = pairs.filter(([label]) => theme === 'dark' || !label.startsWith(':root[data-scheme="dark"]')).map(([label, fg, bg]) => [label, fg, bg, contrast(resolve(theme, `var(--${fg})`), resolve(theme, `var(--${bg})`))])
      .filter(([, , , ratio]) => ratio < 4.5).map(([label, fg, bg, ratio]) => `${label}: --${fg} on --${bg} = ${ratio.toFixed(2)}`)
    expect(low).toEqual([])
  })

  it('the one message (Task 25 notice, styled in src/styles.css) is readable in both themes', () => {
    const notices = rules(STYLES).filter(rule => /^\.notice(-info|-error)?$/.test(rule.selector) && rule.decl.color && rule.decl.background)
    expect(notices.map(rule => rule.selector).sort()).toEqual(['.notice', '.notice-error', '.notice-info'])
    for (const theme of ['light', 'dark']) for (const { selector, decl } of notices) {
      expect(contrast(resolve(theme, decl.color), resolve(theme, decl.background)), `${theme} ${selector}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  for (const theme of ['light', 'dark']) it(`${theme}: focus ring, control borders and the selected chip ≥ 3:1 against the surfaces next to them`, () => {
    const all = ui2Rules()
    const focus = tokenOf(all.find(rule => rule.selector.includes(':focus-visible') && rule.decl.outline)?.decl.outline)
    const buttonBorder = tokenOf(all.find(rule => rule.selector === '.ui2-btn')?.decl.border)
    const chipBorder = tokenOf(all.find(rule => rule.selector === 'button.ui2-chip')?.decl['border-color'])
    const pressed = tokenOf(all.find(rule => rule.selector === 'button.ui2-chip[aria-pressed="true"]')?.decl.background)
    expect([focus, buttonBorder, chipBorder, pressed]).toEqual(['ui2-focus', 'muted', 'muted', 'navy'])
    const checks = []
    for (const [what, token] of [['focus ring', focus], ['button border', buttonBorder], ['chip border', chipBorder], ['selected chip', pressed]]) {
      for (const surface of ['paper', 'soft']) checks.push([`${what} on --${surface}`, contrast(resolve(theme, `var(--${token})`), resolve(theme, `var(--${surface})`))])
    }
    expect(checks.filter(([, ratio]) => ratio < 3).map(([label, ratio]) => `${label} = ${ratio.toFixed(2)}`)).toEqual([])
  })

  it('the helper agrees with the WCAG examples', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
})

// Task 75 (Amjd, 2026-11-19) · the old interface's look on the new interface, and dark mode for the old parts it reuses.
describe('Task 75 · the look is the old interface\'s own values, not new ones', () => {
  const OLD = read('src/redesign.css') + read('src/styles.css')
  it('the light values of the new interface are copied from the old CSS (working surface, card, top bar, sidebar, main button, hero)', () => {
    for (const rule of ['.app-content-wrap{background:#f4f0e6}', '.panel,.match-card,.skill-card{background:#fffdf8;border-color:#d9d0bd}', '.app-topbar{background:#fff}', '.app-topbar{border-bottom-color:#d8d0bd}', '.app-sidebar{background:#082d3a}', '.app-sidebar nav button.active{background:#165565;box-shadow:inset 3px 0 0 #a3e2d6}', '.app-content .button.primary{background:#08756e}', '.app-content .button.primary:hover{background:#065d58}', '.button,.text-button,.icon-button{border-radius:7px}', 'background:linear-gradient(135deg,#fbf8f0 0%,#f4efe2 55%,#edf4ef 100%)', 'radial-gradient(circle at 1px 1px,#b4a77f 1px,transparent 0)', 'color:#215d5a', '.bottom-nav button.active{color:var(--navy);background:#f3f7fb}']) expect(OLD, rule).toContain(rule)
    expect(themeShared).toMatchObject({ '--soft': '#f4f0e6', '--paper': '#fffdf8', '--line': '#d9d0bd', '--radius-card': '10px', '--ui2-bar': '#fff', '--ui2-bar-line': '#d8d0bd', '--ui2-rail': '#082d3a', '--ui2-rail-current': '#165565', '--ui2-rail-mark': '#a3e2d6', '--ui2-tab-current': '#f3f7fb', '--ui2-primary': '#08756e', '--ui2-primary-hover': '#065d58', '--ui2-hero-1': '#fbf8f0', '--ui2-hero-2': '#f4efe2', '--ui2-hero-3': '#edf4ef', '--ui2-hero-dot': '#b4a77f', '--ui2-hero-ink': '#215d5a' })
    // The "ك" mark: the old .brand-mark's brand navy and gold.
    expect(STYLES).toMatch(/\.brand-mark\{[^}]*background:var\(--navy\);color:var\(--gold-2\)/)
    expect([themeShared['--ui2-mark'], themeShared['--ui2-mark-ink']]).toEqual([brandTokens['--navy'], brandTokens['--gold-2']])
    expect(read('src/ui2/TopBar.jsx')).toMatch(/<span className="ui2-mark" aria-hidden="true">ك<\/span>/)
    expect(read('src/ui2/TopBar.jsx')).not.toMatch(/<img/)
  })

  it('the tabs use the old sidebar\'s icons where the old interface had the same place', () => {
    const nav = read('src/ui2/NavTabs.jsx')
    expect(nav).toMatch(/const ICONS = \{ home: House, plan: SearchCheck, profile: LayoutDashboard \}/)
    expect(read('src/components/AppNav.jsx')).toMatch(/import \{[^}]*LayoutDashboard[^}]*SearchCheck[^}]*\} from 'lucide-react'/)
  })
})

describe('Task 75 · dark mode for the reused old parts (src/ui2/legacy-dark.css)', () => {
  const LEGACY = read('src/ui2/legacy-dark.css')
  it('the generated part is up to date with scripts/make-legacy-dark.mjs and the old CSS', () => {
    expect(renderLegacyDark(LEGACY)).toBe(LEGACY)
  })

  it('every rule applies in the dark theme only, inside .ui2-legacy, and sets dark theme tokens only (no fixed colour)', () => {
    const all = rules(LEGACY)
    expect(all.length).toBeGreaterThan(150)
    for (const { selector, decl } of all) {
      // Commas inside :is(…) do not split the selector.
      for (const part of selector.split(/,(?![^(]*\))/)) expect(part.trim(), part).toMatch(/^:root\[data-scheme="dark"\](\[(dir|lang)=[^\]]+\])? \.ui2-legacy/)
      for (const [prop, value] of Object.entries(decl)) {
        if (prop === 'color-scheme') { expect(value).toBe('dark'); continue }
        expect(value, `${selector} ${prop}`).toMatch(/^var\(--[\w-]+\)(!important)?$/)
      }
    }
    // Light mode is unchanged: the light reset of Task 66 still holds inside .ui2-legacy when the light theme is shown.
    expect(THEME).toMatch(/:root\[data-scheme="light"\] \.ui2-legacy\{\n --navy:#0b2f5b;/)
  })

  it('the generator maps a colour by what it is for: surfaces, words and edges', () => {
    const t = (fn, hex) => fn(parseColour(hex).rgb)
    expect([t(surfaceToken, '#fff'), t(surfaceToken, '#fffdf8'), t(surfaceToken, '#f3f7f9'), t(surfaceToken, '#e8f6f0'), t(surfaceToken, '#fff4d6'), t(surfaceToken, '#fff0f0'), t(surfaceToken, '#f3ecf8')]).toEqual(['paper', 'paper', 'soft', 'mist', 'warn-bg', 'danger-bg', 'navy-3'])
    expect([t(textToken, '#222222'), t(textToken, '#526478'), t(textToken, '#133e5a'), t(textToken, '#17695d'), t(textToken, '#2e7d32'), t(textToken, '#815900'), t(textToken, '#9a3030')]).toEqual(['ink', 'muted', 'navy', 'teal', 'success', 'warn', 'danger'])
    expect([t(borderToken, '#dbe6eb'), t(borderToken, '#8778a3'), t(borderToken, '#2e7d32')]).toEqual(['line', 'muted', 'success'])
    expect(prefixed('.a .b,[dir=rtl] .c')).toBe(':root[data-scheme="dark"] .ui2-legacy .a .b,:root[data-scheme="dark"][dir=rtl] .ui2-legacy .c')
  })

  it('it loads with the new interface only, after the old CSS, and the old interface never gets data-scheme', () => {
    expect(read('src/ui2/AppNext.jsx')).toMatch(/^import '\.\/look\.css'\nimport '\.\/legacy-dark\.css'$/m)
    expect(read('src/main.jsx')).not.toMatch(/legacy-dark|look\.css|data-scheme/)
    expect(read('src/App.jsx')).not.toMatch(/data-scheme|markScheme/)
  })
})
