// Task 51: reading PDF pages by position (src/transcript/layout.js). Unit tests on made-up text items,
// then the Task 50 fixtures (synthetic, made up): every expected row comes out as one line, in term order.
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { readLayout, linesToText, textCharacterCount } from '../src/transcript/layout.js'
import { pdfLayoutText, isScannedPdf, SCANNED_TEXT_MIN_CHARS } from '../src/utils/transcript.js'
import { readPdf, textByHeight } from './helpers/readPdfText.js'
import { FIXTURES, FIXTURE_DIR } from '../scripts/make-transcript-fixtures.mjs'

// ---- made-up items -----------------------------------------------------------------------------------
// pdf.js shape: { str, transform: [a, b, c, d, x, y], width, height }. Width ≈ half the height per char.
const H = 7
const item = (str, x, y, h = H) => ({ str, transform: [h, 0, 0, h, x, y], width: str.length * h * 0.5, height: h, dir: 'ltr', hasEOL: false })
// A KAU-style row: code, description, UA, UE, marks, letter as separate items, cells at fixed offsets
// from the column's left edge.
const CELLS = [0, 40, 176, 192, 208, 236]
const row = (x0, y, cells) => cells.map((cell, i) => (cell === '' ? null : item(String(cell), x0 + CELLS[i], y))).filter(Boolean)
const summary = (x0, y, label, ua, ue) => [item(label, x0 + 40, y), item(String(ua), x0 + 176, y), item(String(ue), x0 + 192, y)]
const STUDENT = (left, right, top = 780) => [
  item('STUDENT INFORMATION', left, top + 12),
  item('NAME', left, top), item('TEST STUDENT ZULU', left + 52, top), item('STUDENT NO', right, top), item('0000099', right + 52, top),
  item('COLLEGE', left, top - 11), item('COMPUTING & INFORMATION TECH.', left + 52, top - 11), item('MAJOR', right, top - 11), item('INFORMATION TECHNOLOGY', right + 52, top - 11),
]
const FOOTER = (left, right) => [item('Print Date: 01/01/2026', left, 52), item('Page 1 of 1', 268, 52), item('Dean of Admission', right + 110, 52)]

// One page: a term in each column, rows at the same heights in both columns (what used to glue them).
function twoColumnPage({ left = 30, right = 306, leftTop = 700, rightTop = 700, terms = ['FALL 2019/2020', 'SPRING 2019/2020'], prefix = 'CPIT' } = {}) {
  const items = [...STUDENT(left, right)]
  const column = (x0, top, header, base) => [
    item(header, x0, top),
    ...row(x0, top - 20, [`${prefix} ${base + 1}`, 'DATABASES I', 3, 3, 88, 'B+']),
    ...row(x0, top - 40, [`${prefix} ${base + 2}`, 'SYSTEM ANALYSIS & DESGIN', 3, 3, 91, 'A']),
    ...row(x0, top - 60, [`${prefix} ${base + 3}`, 'PROGRAMMING I', 3, 3, 62, 'D']),
    ...summary(x0, top - 80, 'Term', 9, 9),
  ]
  items.push(...column(left, leftTop, terms[0], 100), ...column(right, rightTop, terms[1], 200), ...FOOTER(left, right))
  return items
}
const texts = layout => layout.lines.map(l => `${l.page}/${l.column}: ${l.text}`)
const CODE = /\b[A-Z]{2,4} \d{3}\b/g
const codesIn = text => text.match(CODE) || []

describe('readLayout: two columns read in order (Task 51)', () => {
  test('left column top to bottom, then the right column; no line holds two columns', () => {
    const layout = readLayout([twoColumnPage()])
    expect(texts(layout)).toEqual([
      '1/0: FALL 2019/2020',
      '1/0: CPIT 101 DATABASES I 3 3 88 B+',
      '1/0: CPIT 102 SYSTEM ANALYSIS & DESGIN 3 3 91 A',
      '1/0: CPIT 103 PROGRAMMING I 3 3 62 D',
      '1/0: Term 9 9',
      '1/0: Print Date: 01/01/2026 Page 1 of 1',
      '1/1: SPRING 2019/2020',
      '1/1: CPIT 201 DATABASES I 3 3 88 B+',
      '1/1: CPIT 202 SYSTEM ANALYSIS & DESGIN 3 3 91 A',
      '1/1: CPIT 203 PROGRAMMING I 3 3 62 D',
      '1/1: Term 9 9',
      '1/1: Dean of Admission',
    ])
    expect(layout.pages).toEqual([expect.objectContaining({ page: 1, source: 'headers', courseTop: 700 })])
    for (const line of layout.lines) {
      expect(line).toEqual(expect.objectContaining({ page: 1, column: expect.any(Number), y: expect.any(Number), x: expect.any(Number), text: expect.any(String) }))
      expect(line.items.map(i => i.str).join(' ')).toBe(line.text)
    }
  })

  test('the split falls in the gutter, after the last cell of the left column and before the right column', () => {
    const { pages: [page] } = readLayout([twoColumnPage()])
    // Left column: last cell (letter) at 30 + 236 = 266, about 7 wide; right column starts at 306.
    expect(page.split).toBeGreaterThan(266 + 7)
    expect(page.split).toBeLessThanOrEqual(306)
  })

  test('the right column starts higher than the left', () => {
    const layout = readLayout([twoColumnPage({ leftTop: 640, rightTop: 700 })])
    const lines = texts(layout)
    expect(lines.slice(0, 5)).toEqual(['1/0: FALL 2019/2020', '1/0: CPIT 101 DATABASES I 3 3 88 B+', '1/0: CPIT 102 SYSTEM ANALYSIS & DESGIN 3 3 91 A', '1/0: CPIT 103 PROGRAMMING I 3 3 62 D', '1/0: Term 9 9'])
    expect(lines).toContain('1/1: SPRING 2019/2020')
    expect(lines.indexOf('1/1: SPRING 2019/2020')).toBeGreaterThan(lines.indexOf('1/0: Term 9 9'))
    expect(layout.lines.every(l => codesIn(l.text).length <= 1)).toBe(true)
    // The course area starts at the higher (right) header; the header block stays apart.
    expect(layout.pages[0].courseTop).toBe(700)
    expect(layout.headerLines.map(l => l.text)).toContain('STUDENT INFORMATION')
  })

  test.each([
    [24, 296], [30, 306], [44, 318], [60, 340], [20, 280],
  ])('columns at x %i and %i: the split is read from the page, not a fixed x', (left, right) => {
    const layout = readLayout([twoColumnPage({ left, right })])
    expect(layout.pages[0].source).toBe('headers')
    expect(layout.pages[0].split).toBeGreaterThan(left + 236)
    expect(layout.pages[0].split).toBeLessThanOrEqual(right)
    expect(layout.lines.filter(l => l.column === 0).map(l => codesIn(l.text)).flat()).toEqual(['CPIT 101', 'CPIT 102', 'CPIT 103'])
    expect(layout.lines.filter(l => l.column === 1).map(l => codesIn(l.text)).flat()).toEqual(['CPIT 201', 'CPIT 202', 'CPIT 203'])
  })

  test('3 pages: page 1 left, page 1 right, page 2 left, …; a page with headers in one column uses the previous split', () => {
    const page1 = twoColumnPage({ left: 30, right: 306, terms: ['FALL 2019/2020', 'SPRING 2019/2020'], prefix: 'MATH' })
    // Page 2: only the left column has a header (the right column continues that term).
    const page2 = [...STUDENT(30, 306), item('FALL 2020/2021', 30, 700),
      ...row(30, 680, ['CPIT 301', 'OPERATING SYSTEMS', 3, 3, 77, 'C+']), ...row(30, 660, ['CPIT 302', 'NETWORKS', 3, 3, 84, 'B']),
      ...row(306, 700, ['CPIT 303', 'COMPILERS', 3, 3, 90, 'A']), ...row(306, 680, ['CPIT 304', 'SECURITY', 3, 3, 81, 'B']), ...FOOTER(30, 306)]
    // Page 3: no header at all (rows of the same term in both columns).
    const page3 = [...STUDENT(30, 306), ...row(30, 700, ['ISLS 401', 'ISLAMIC CULTURE IV', 2, 2, 95, 'A+']), ...row(306, 700, ['CPIT 499', 'SENIOR PROJECT II', 4, 4, 97, 'A+']), ...FOOTER(30, 306)]
    const layout = readLayout([page1, { items: page2 }, page3])
    expect(layout.pages.map(p => [p.page, p.source])).toEqual([[1, 'headers'], [2, 'previous-page'], [3, 'previous-page']])
    expect(layout.pages[1].split).toBe(layout.pages[0].split)
    expect(layout.lines.flatMap(l => codesIn(l.text))).toEqual([
      'MATH 101', 'MATH 102', 'MATH 103', 'MATH 201', 'MATH 202', 'MATH 203',
      'CPIT 301', 'CPIT 302', 'CPIT 303', 'CPIT 304',
      'ISLS 401', 'CPIT 499',
    ])
    expect(layout.lines.map(l => [l.page, l.column]).filter((pc, i, all) => !i || pc.join() !== all[i - 1].join())).toEqual([[1, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1]])
    // Each page's header block is apart; nothing of it is in the course lines.
    expect(layout.headerLines.filter(l => l.text === 'STUDENT INFORMATION').map(l => l.page)).toEqual([1, 2, 3])
    expect(linesToText(layout.lines)).not.toMatch(/STUDENT|TEST STUDENT ZULU|0000099|COLLEGE/)
  })

  test('the first page with headers in one column only takes the split of the next page that has two', () => {
    const page1 = [...STUDENT(30, 306), item('FALL 2019/2020', 30, 700), ...row(30, 680, ['CPIT 101', 'DATABASES I', 3, 3, 88, 'B+']), ...row(306, 700, ['CPIT 102', 'NETWORKS', 3, 3, 84, 'B']), ...row(306, 680, ['CPIT 103', 'COMPILERS', 3, 3, 90, 'A'])]
    const layout = readLayout([page1, twoColumnPage()])
    expect(layout.pages.map(p => p.source)).toEqual(['next-page', 'headers'])
    expect(layout.lines.filter(l => l.page === 1).map(l => [l.column, codesIn(l.text).join()])).toEqual([[0, ''], [0, 'CPIT 101'], [1, 'CPIT 102'], [1, 'CPIT 103']])
  })

  test('STUDENT INFORMATION (above the first term header) comes back as headerLines, row by row, each column apart', () => {
    const layout = readLayout([twoColumnPage()])
    expect(layout.headerLines.map(l => l.text)).toEqual([
      'STUDENT INFORMATION',
      'NAME TEST STUDENT ZULU', 'STUDENT NO 0000099',
      'COLLEGE COMPUTING & INFORMATION TECH.', 'MAJOR INFORMATION TECHNOLOGY',
    ])
    expect(layout.lines.some(l => /STUDENT|COLLEGE|MAJOR/.test(l.text))).toBe(false)
  })

  test('a header the PDF writes as two items ("FALL" + "2019/2020") is still a header; EQUIVALENT COURSES counts too', () => {
    const items = [...STUDENT(30, 306), item('FALL', 30, 700), item('2019/2020', 50, 700), ...row(30, 680, ['CPIT 101', 'DATABASES I', 3, 3, 88, 'B+']),
      item('EQUIVALENT COURSES', 306, 700), ...row(306, 680, ['MATH 110', 'GENERAL MATHEMATICS I', 3, 3, '', 'TR']), ...row(30, 660, ['CPIT 102', 'NETWORKS', 3, 3, 84, 'B']), ...row(306, 660, ['STAT 110', 'STATISTICS I', 3, 3, '', 'TR'])]
    const layout = readLayout([items])
    expect(layout.pages[0].source).toBe('headers')
    expect(texts(layout)).toEqual([
      '1/0: FALL 2019/2020', '1/0: CPIT 101 DATABASES I 3 3 88 B+', '1/0: CPIT 102 NETWORKS 3 3 84 B',
      '1/1: EQUIVALENT COURSES', '1/1: MATH 110 GENERAL MATHEMATICS I 3 3 TR', '1/1: STAT 110 STATISTICS I 3 3 TR',
    ])
  })

  test('no header on any page: the widest gap between two columns of text; never a gap between two cells of one column', () => {
    const left = [...row(30, 700, ['ELI 101', 'ENGLISH LANGUAGE I', 2, 2, 91, 'A']), ...row(30, 680, ['MATH 110', 'GENERAL MATHEMATICS I', 3, 3, 78, 'C+']), ...row(30, 660, ['CPIT 110', 'PROGRAMMING I', 3, 3, 92, 'A'])]
    const right = [...row(306, 700, ['CPIT 201', 'INTRO. TO COMPUTING', 3, 3, 87, 'B+']), ...row(306, 680, ['CPCS 203', 'PROGRAMMING II', 3, 3, 81, 'B']), ...row(306, 660, ['CPIT 221', 'TECH. WRITTING', 2, 2, 90, 'A'])]
    const two = readLayout([[...left, ...right]])
    expect(two.pages[0].source).toBe('gap')
    expect(two.lines.map(l => [l.column, codesIn(l.text).join()])).toEqual([[0, 'ELI 101'], [0, 'MATH 110'], [0, 'CPIT 110'], [1, 'CPIT 201'], [1, 'CPCS 203'], [1, 'CPIT 221']])
    const one = readLayout([left])
    expect(one.pages[0]).toMatchObject({ split: null, source: 'one-column' })
    expect(one.lines.map(l => l.text)).toEqual(['ELI 101 ENGLISH LANGUAGE I 2 2 91 A', 'MATH 110 GENERAL MATHEMATICS I 3 3 78 C+', 'CPIT 110 PROGRAMMING I 3 3 92 A'])
    expect(one.headerLines).toEqual([])
  })

  test('items in the Node helper shape work the same; empty and blank items are ignored; spaces inside an item collapse', () => {
    const pdfjs = twoColumnPage()
    const plain = pdfjs.map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], width: i.width, height: i.height }))
    expect(texts(readLayout([plain]))).toEqual(texts(readLayout([pdfjs])))
    const spaced = [item('FALL 2019/2020', 30, 700), item('', 60, 690), item('   ', 70, 690), item('ISLS   201', 30, 680), item('ISLAMIC CULTURE II', 70, 680)]
    expect(readLayout([spaced]).lines.map(l => l.text)).toEqual(['FALL 2019/2020', 'ISLS 201 ISLAMIC CULTURE II'])
    expect(readLayout([]).lines).toEqual([])
    expect(readLayout([[]])).toMatchObject({ lines: [], headerLines: [], pages: [{ page: 1, split: null }] })
  })
})

describe('scanned PDFs and the text given to the parser (Task 51)', () => {
  test(`no text items, or fewer than ${SCANNED_TEXT_MIN_CHARS} characters in all pages: scanned`, () => {
    expect(isScannedPdf([[]])).toBe(true)
    expect(isScannedPdf([[], { items: [] }, []])).toBe(true)
    expect(isScannedPdf([[item('Page 1 of 1', 268, 52)], [item('x'.repeat(60), 30, 700)]])).toBe(true)
    expect(isScannedPdf([[item('x'.repeat(40), 30, 700)], [item('y'.repeat(40), 30, 700)]])).toBe(false)
    expect(textCharacterCount([[item('A B  C', 0, 0)]])).toBe(3)
    expect(isScannedPdf([twoColumnPage()])).toBe(false)
  })

  test('the text for today\'s parser: the header block first, then the course lines in reading order', () => {
    const layout = readLayout([twoColumnPage()])
    const text = pdfLayoutText(layout).split('\n')
    expect(text.slice(0, 5)).toEqual(layout.headerLines.map(l => l.text))
    expect(text.slice(5)).toEqual(layout.lines.map(l => l.text))
    expect(pdfLayoutText(readLayout([[]]))).toBe('')
  })
})

describe('the Task 50 fixtures read by position (Task 51)', () => {
  const fixtures = FIXTURES.map(def => ({
    def,
    expected: JSON.parse(readFileSync(path.join(FIXTURE_DIR, `${def.name}.expected.json`), 'utf8')),
    pdfFile: path.join(FIXTURE_DIR, `${def.name}.pdf`),
  }))

  // The printed row, as the line must hold it: "CPIT 250 … 3 3 88 B+" (the description is not in the
  // expected file, so the line is matched by its start and its end; nothing is parsed).
  const printedStart = row => `${row.code.replace('-', ' ')} `
  const printedEnd = row => ` ${[row.credits.ua, row.credits.ue, row.marks ?? '', row.letter].filter(v => v !== '').join(' ')}`

  test.each(fixtures.filter(f => !f.def.scanned).map(f => [f.def.name, f]))('%s: every expected row is one line, in term order', async (name, { def, expected, pdfFile }) => {
    const pdf = await readPdf(pdfFile)
    const { lines, headerLines, pages } = readLayout(pdf.pages)
    let at = -1; const missing = []
    for (const row of expected.rows) {
      const found = lines.findIndex((line, i) => i > at && line.text.startsWith(printedStart(row)) && line.text.endsWith(printedEnd(row)))
      if (found < 0) missing.push(`${row.code} (${row.term} ${row.year})`)
      else at = found
    }
    expect(missing, `${name}: rows not found as one line, in order`).toEqual([])
    // Never two columns in one line: each line's items all sit left, or all right, of the fixture's right column.
    const rightColumn = def.columns[1]
    const mixed = lines.filter(l => !l.text.includes('Page ')).filter(l => new Set(l.items.map(i => i.x >= rightColumn - 0.5)).size > 1)
    expect(mixed.map(l => l.text)).toEqual([])
    expect(lines.every(l => codesIn(l.text).length <= 1)).toBe(true)
    // The STUDENT INFORMATION block is apart on every page.
    expect(headerLines.filter(l => l.text === 'STUDENT INFORMATION').map(l => l.page)).toEqual(Array.from({ length: def.pages }, (_, i) => i + 1))
    expect(linesToText(lines)).not.toMatch(/STUDENT INFORMATION|NATIONALITY|TEST STUDENT/)
    expect(pages.every(p => p.split !== null)).toBe(true)
  })

  test('before Task 51, rows at the same height in two columns were glued into one line (finding B2); now never', async () => {
    const pdf = await readPdf(path.join(FIXTURE_DIR, 'fcit-it-2p.pdf'))
    const glued = textByHeight(pdf.pages).split('\n').filter(line => codesIn(line).length > 1)
    expect(glued.length).toBeGreaterThan(10)
    expect(readLayout(pdf.pages).lines.filter(line => codesIn(line.text).length > 1)).toEqual([])
  })

  test('the scanned fixture has no text: scanned, and no lines', async () => {
    const pdf = await readPdf(path.join(FIXTURE_DIR, 'scanned.pdf'))
    expect(isScannedPdf(pdf.pages)).toBe(true)
    expect(readLayout(pdf.pages)).toMatchObject({ lines: [], headerLines: [] })
    for (const f of fixtures.filter(x => !x.def.scanned)) expect(isScannedPdf((await readPdf(f.pdfFile)).pages), f.def.name).toBe(false)
  })
})
