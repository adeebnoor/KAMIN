// Task 76 · finds (and with --write removes) CSS rules that can match nothing the app renders: rules whose selector
// needs a class or an id that no file in src/ (scripts, components, data; not the stylesheets) ever names. Task 70 deleted
// the old interface and left its rules in the shared stylesheets; this proves each removed selector dead before removal.
//
// A selector (one part of a comma list) is dead when one of the classes or ids it REQUIRES is never named:
// - required = the .class and #id tokens outside parentheses and [attribute] brackets. A class inside :not(), :is(),
//   :where() or :has() never makes a selector dead (".a:not(.gone)" still matches), so those are left alone.
// - named = the token occurs in a src/ file that is not CSS (js, jsx, mjs, json, html, svg) or in index.html as a whole
//   word ("ui2-chip" does not count inside "ui2-chip-row"), or it starts with a prefix the code builds at run time
//   (`tone-${kind}`, 'tone-' + kind) or ends with such a suffix (`${kind}-card`), or a library makes it (lucide-react's
//   "lucide" and "lucide-…" on every icon). Comments in src/ count as naming a class, so the rule errs on keeping.
// A rule whose selectors are all dead is removed; a rule with some dead selectors keeps the others; an @media or
// @supports block left empty is removed. @keyframes and @font-face are never touched.
//
// Run: node scripts/find-unused-css.mjs            (report only; exit code 1 when something is dead)
//      node scripts/find-unused-css.mjs --write    (remove, then report what was removed)
//      node scripts/find-unused-css.mjs --json out.json   (the report as JSON: file, selector, missing tokens)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

// The stylesheets Task 70 named (old-interface rules left in shared files). src/main.jsx loads all four.
export const OLD_SHARED_CSS = ['src/styles.css', 'src/redesign.css', 'src/experience.css', 'src/knowledge-workspace.css']
const CODE = new Set(['.js', '.jsx', '.mjs', '.json', '.html', '.svg'])
const LIBRARY = [/^lucide(-|$)/]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (CODE.has(extname(name))) out.push(path)
  }
  return out
}

/** The text every class and id is looked up in: every non-CSS file of src/, and index.html. */
export function readCorpus(root = process.cwd()) {
  return [...walk(join(root, 'src')), join(root, 'index.html')].map(file => readFileSync(file, 'utf8')).join('\n')
}

const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** A function telling whether a class or id is named by the code (see the header). */
export function namedIn(corpus) {
  const prefixes = new Set(), suffixes = new Set()
  for (const m of corpus.matchAll(/([A-Za-z][\w-]*[-_])\$\{/g)) prefixes.add(m[1])
  for (const m of corpus.matchAll(/['"`]([A-Za-z][\w-]*[-_])['"`]\s*\+/g)) prefixes.add(m[1])
  for (const m of corpus.matchAll(/\$\{[^}]*\}([-_][\w-]*\w)/g)) suffixes.add(m[1])
  for (const m of corpus.matchAll(/\+\s*['"`]([-_][\w-]*\w)['"`]/g)) suffixes.add(m[1])
  const cache = new Map()
  return token => {
    if (cache.has(token)) return cache.get(token)
    const named = LIBRARY.some(re => re.test(token))
      || [...prefixes].some(p => token.startsWith(p) && token.length > p.length)
      || [...suffixes].some(s => token.endsWith(s) && token.length > s.length)
      || new RegExp(`(?<![\\w-])${escapeRe(token)}(?![\\w-])`).test(corpus)
    cache.set(token, named)
    return named
  }
}

/** The classes and ids a selector requires (outside parentheses and attribute brackets). */
export function requiredTokens(selector) {
  let flat = '', depth = 0, inAttr = false
  for (const ch of selector.replace(/\\./g, '_')) {
    if (inAttr) { if (ch === ']') inAttr = false; continue }
    if (ch === '[' && !depth) { inAttr = true; continue }
    if (ch === '(') { depth++; continue }
    if (ch === ')') { depth--; continue }
    if (!depth) flat += ch
  }
  return [...flat.matchAll(/([.#])(-?[_a-zA-Z][\w-]*)/g)].map(m => m[2])
}

const insideKeyframes = node => { for (let p = node.parent; p; p = p.parent) if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return true; return false }

/** Every dead selector of one stylesheet: [{ selector, missing, media }]. With write, returns the cleaned CSS too. */
export function deadSelectors(css, named, { write = false, from = 'input.css' } = {}) {
  const root = postcss.parse(css, { from })
  const dead = []
  root.walkRules(rule => {
    if (insideKeyframes(rule)) return
    const keep = []
    for (const selector of rule.selectors) {
      const missing = requiredTokens(selector).filter(token => !named(token))
      if (missing.length) dead.push({ selector, missing: [...new Set(missing)], media: rule.parent?.type === 'atrule' ? `@${rule.parent.name} ${rule.parent.params}` : null })
      else keep.push(selector)
    }
    if (!write || keep.length === rule.selectors.length) return
    if (keep.length) rule.selectors = keep
    else rule.remove()
  })
  if (write) {
    let emptied = true
    while (emptied) {
      emptied = false
      root.walkAtRules(at => { if (/^(media|supports)$/i.test(at.name) && at.nodes && !at.nodes.length) { at.remove(); emptied = true } })
    }
  }
  return { dead, css: write ? root.toString() : css }
}

/** Rules (selector lists) whose every selector is dead, counted per file; used for the report. */
export function countRules(css, named) {
  let rules = 0, dead = 0
  postcss.parse(css).walkRules(rule => {
    if (insideKeyframes(rule)) return
    rules++
    if (rule.selectors.every(s => requiredTokens(s).some(t => !named(t)))) dead++
  })
  return { rules, dead }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes('--write')
  const jsonAt = process.argv.indexOf('--json')
  const named = namedIn(readCorpus())
  const report = []
  for (const file of OLD_SHARED_CSS) {
    const css = readFileSync(file, 'utf8')
    const before = countRules(css, named)
    const { dead, css: cleaned } = deadSelectors(css, named, { write, from: file })
    if (write && cleaned !== css) writeFileSync(file, cleaned)
    const after = write ? countRules(cleaned, named) : before
    report.push({ file, rulesBefore: before.rules, deadRules: before.dead, rulesAfter: after.rules, deadSelectors: dead })
    console.log(`${file}: ${before.rules} rules, ${before.dead} wholly dead, ${dead.length} dead selectors${write ? ` → ${after.rules} rules left` : ''}`)
  }
  if (jsonAt > 0) writeFileSync(process.argv[jsonAt + 1], JSON.stringify(report, null, 1))
  if (!write && report.some(r => r.deadSelectors.length)) process.exitCode = 1
}
