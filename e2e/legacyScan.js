// Task 75 · finds what is still light inside the old parts the new interface reuses (.ui2-legacy), in the dark theme.
// Runs in the page. Returns readable lines: a visible element whose own background is light (luminance > 0.3), a visible
// border that is light (> 0.4), and text whose contrast with the surface under it is below 4.5:1 (3:1 for large or bold
// large text). The old graph's map (.relationship-map) keeps its own look in both themes (a dark teal map with cream nodes,
// as in the old interface), so its nodes are not "light cards"; their text is still checked.
export function scanLegacy() {
  const parse = colour => {
    const m = colour && colour.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }
  }
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const ratio = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p); return (a + 0.05) / (b + 0.05) }
  const visible = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0 }
  const label = el => el.tagName.toLowerCase() + [...el.classList].filter(c => !/^ui2-legacy$/.test(c)).map(c => `.${c}`).join('')
  const where = el => { const parts = []; let e = el; for (let i = 0; i < 3 && e && !e.classList?.contains('ui2-legacy'); i++) { parts.unshift(label(e)); e = e.parentElement } return parts.join(' > ') || label(el) }
  const surface = el => { for (let e = el; e; e = e.parentElement) { const p = parse(getComputedStyle(e).backgroundColor); if (p && p.a > 0.5) return p.rgb } return [255, 255, 255] }
  // Edges drawn in the dark theme's own colours (control edges are --muted, Task 61) are not "light borders".
  const tokens = ['--muted', '--navy', '--navy-2', '--gold', '--teal', '--success', '--warn', '--danger', '--ui2-focus', '--ui2-primary', '--ui2-primary-hover']
  const probe = document.createElement('span')
  document.body.append(probe)
  const own = new Set(tokens.map(name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color }))
  // The main button's fill (--ui2-primary, a bright teal in dark, as the new interface's own main button) and a selected
  // control's fill (--navy with --paper words, as the new interface's selected chips) are controls, not surfaces.
  const fills = new Set(['--ui2-primary', '--ui2-primary-hover', '--navy'].map(name => { probe.style.color = `var(${name})`; return getComputedStyle(probe).color }))
  probe.remove()
  const found = new Set()
  for (const root of document.querySelectorAll('.ui2-legacy')) for (const el of [root, ...root.querySelectorAll('*')]) {
    if (el.closest('svg') || !visible(el)) continue
    const cs = getComputedStyle(el)
    const inMap = el.closest('.relationship-map')
    const bg = parse(cs.backgroundColor)
    if (!inMap && bg && bg.a > 0.5 && lum(bg.rgb) > 0.3 && !fills.has(cs.backgroundColor)) found.add(`light surface: ${where(el)} (${cs.backgroundColor})`)
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const c = parse(cs[`border${side}Color`])
      if (!inMap && parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none' && c && c.a > 0.5 && lum(c.rgb) > 0.4 && !own.has(cs[`border${side}Color`])) { found.add(`light border: ${where(el)} (${cs[`border${side}Color`]})`); break }
    }
    const text = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))
    if (text) {
      const fg = parse(cs.color)
      if (fg && fg.a > 0.5) {
        const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700
        const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
        const r = ratio(fg.rgb, surface(el))
        if (r < need) found.add(`low contrast ${r.toFixed(2)}: ${where(el)} (${cs.color} on ${surface(el)})`)
      }
    }
  }
  return [...found]
}
