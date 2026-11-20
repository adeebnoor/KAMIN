// Task 50: read a PDF in Node with pdfjs (the legacy build runs without a browser), the same library
// the app uses. Returns the text items of every page with their positions, as Task 51's layout reader
// will receive them: { numPages, pages: [{ items: [{ str, x, y, width, height }] }] }.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const STANDARD_FONTS = `${path.resolve('node_modules/pdfjs-dist/standard_fonts').replace(/\\/g, '/')}/`

export async function readPdf(file) {
  const data = new Uint8Array(typeof file === 'string' ? readFileSync(file) : file)
  const doc = await getDocument({ data, standardFontDataUrl: STANDARD_FONTS, isEvalSupported: false, verbosity: 0 }).promise
  try {
    const pages = []
    for (let n = 1; n <= doc.numPages; n += 1) {
      const content = await (await doc.getPage(n)).getTextContent()
      pages.push({
        items: content.items.filter(item => item.str !== undefined && item.str.trim() !== '')
          .map(item => ({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height })),
      })
    }
    return { numPages: doc.numPages, pages }
  } finally {
    await doc.destroy()
  }
}

// The text the app built before Task 51 (src/utils/transcript.js, reconstructPdfLines, now replaced by
// src/transcript/layout.js): items on the same height become one line across the whole page width,
// lines from top to bottom, pages one after the other. Kept only so tests/transcriptLayout.test.js can
// show the old gluing of two columns (finding B2) next to the new reader.
export function textByHeight(pages) {
  return pages.map(({ items }) => {
    const heights = items.map(i => Math.abs(i.height)).filter(Boolean).sort((a, b) => a - b)
    const tolerance = Math.max(1.5, Math.min(4, (heights[Math.floor(heights.length / 2)] ?? 2) * 0.35))
    const groups = []
    for (const item of items) {
      let group = groups.find(g => Math.abs(g.y - item.y) <= tolerance)
      if (!group) { group = { y: item.y, parts: [] }; groups.push(group) }
      group.parts.push(item)
    }
    return groups.sort((a, b) => b.y - a.y).map(g => g.parts.sort((a, b) => a.x - b.x).map(p => p.str.replace(/\s+/g, ' ').trim()).join(' ')).join('\n')
  }).join('\n')
}
