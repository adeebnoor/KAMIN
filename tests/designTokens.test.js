import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// Task 13 · one token set; no hard-coded spacing outside src/tokens.css.
const cssFiles = dir => readdirSync(dir).flatMap(name => { const p = path.join(dir, name); return statSync(p).isDirectory() ? cssFiles(p) : name.endsWith('.css') ? [p] : [] })
// cards.css holds the one card rule (moved out of tokens.css, which the public pages also load).
const files = cssFiles('src').filter(f => !f.endsWith('tokens.css') && !f.endsWith('cards.css'))
const SPACING = /(?:^|[;{\s])((?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?):([^;}]*)/g

describe('design tokens', () => {
  it('tokens.css defines the spacing scale, text sizes and control height; cards.css the one card style', () => {
    const tokens = readFileSync('src/tokens.css', 'utf8')
    for (const [name, value] of [['--space-1', '4px'], ['--space-2', '8px'], ['--space-3', '12px'], ['--space-4', '16px'], ['--space-5', '24px'], ['--space-6', '32px'], ['--control-h', '40px']]) expect(tokens).toContain(`${name}:${value}`)
    expect(tokens).toMatch(/--text-sm:[^;]+;--text-base:[^;]+;--text-lg:[^;]+;--text-xl:/)
    expect(tokens).toMatch(/@media \(pointer:coarse\)\{:root\{--control-h:44px\}\}/)
    expect(readFileSync('src/cards.css', 'utf8')).toMatch(/\.card,\.panel\{[^}]*padding:var\(--card-pad\)/)
    // Shared with the public pages: only custom properties on :root, so loading it there restyles nothing.
    const selectors = [...tokens.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{(?=[^{}]*\})/g)].map(m => m[1].trim())
    expect(selectors.every(s => s === ':root')).toBe(true)
    const declarations = [...tokens.matchAll(/:root\{([^}]*)\}/g)].flatMap(m => m[1].split(';')).map(d => d.trim()).filter(Boolean)
    expect(declarations.filter(d => !d.startsWith('--'))).toEqual([])
    expect(readFileSync('src/main.jsx', 'utf8')).toMatch(/import '\.\/tokens\.css'\r?\nimport '\.\/cards\.css'/)
    expect(readFileSync('src/main.jsx', 'utf8')).toMatch(/import '\.\.\/public\/brand\.css'\r?\nimport '\.\/tokens\.css'/)
  })

  it('no hard-coded spacing between 4px and 40px outside the token file', () => {
    const offenders = []
    for (const file of files) {
      const css = readFileSync(file, 'utf8')
      for (const [, prop, value] of css.matchAll(SPACING)) {
        for (const [, sign, num, unit] of value.matchAll(/(-?)(\d*\.?\d+)(px|rem)\b/g)) {
          const px = unit === 'rem' ? parseFloat(num) * 16 : parseFloat(num)
          if (!sign && px >= 4 && px < 40) offenders.push(`${path.basename(file)} ${prop}:${value.trim()}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('there is one card rule and buttons share one control height', () => {
    const all = files.map(f => readFileSync(f, 'utf8')).join('\n')
    expect(all).not.toMatch(/(^|[}\s,])\.panel\{background/)
    expect(all).not.toMatch(/\.button[^{]*\{[^}]*min-height:\d+px/)
  })

  it('buttons never animate colour (mid-transition colours failed the contrast check)', () => {
    const all = files.map(f => readFileSync(f, 'utf8')).join('\n')
    expect(all).not.toMatch(/\.button\{[^}]*transition:\.\d+s/)
  })
})
