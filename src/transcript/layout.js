// Task 51: read PDF pages by position. Pure (no DOM, no pdf.js): the input is, per page, the text items
// pdf.js gives (`str`, `transform[4]` = x, `transform[5]` = y, `width`, `height`; the Node test helper's
// `{ str, x, y, width, height }` works too). The output is the page text as ordered lines:
//   page 1 left column top → bottom, page 1 right column, page 2 left column, …
// so a left-column row is never glued to the right-column row printed at the same height (finding B2).
//
// Where the columns split is read from the page itself, never from a fixed x:
// 1. The x positions of the term headers ("FALL 2019/2020 …") and of "EQUIVALENT COURSES" form two
//    clusters. The split lies between the right edge of the left cluster and the left edge of the right
//    cluster: in the last strip of that range that the course lines leave empty, just before the right
//    column's headers (an empty strip further left can be the space between two cells of the left
//    column); the middle of the range itself when no strip is empty.
// 2. A page with headers in one column only uses the previous page's split (the first page with no
//    earlier split uses the next page that has one).
// 3. No page has two header columns: the widest horizontal gap that runs the full height of the course
//    area, when lines on its right start with words (a code, a header, "Term"), not with credits or
//    marks. No such gap: one column.
// "Empty" tolerates a few lines across the gap (one, or a tenth of the lines: a title, a page footer).
// The STUDENT INFORMATION block (everything above the topmost term header) is returned separately as
// `headerLines` and never mixed with the course lines.

export const TERM_HEADER = /^(FALL|WINTER|SPRING|SUMMER)\s+\d{4}\/\d{4}/
export const EQUIVALENT_HEADER = /^EQUIVALENT\s+COURSES\b/
const isSectionHeader = text => TERM_HEADER.test(text) || EQUIVALENT_HEADER.test(text)

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const median = values => {
  const sorted = values.filter(v => v > 0).sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
}

function normalizeItem(item, index) {
  const str = clean(item?.str)
  if (!str) return null
  const x = Number(item.x ?? item.transform?.[4] ?? 0)
  const y = Number(item.y ?? item.transform?.[5] ?? 0)
  const height = Math.abs(Number(item.height || item.transform?.[3] || 0)) || 0
  // Some PDFs report a zero width; estimate it from the text so the item still covers its strip.
  const width = Math.abs(Number(item.width || 0)) || str.length * (height || 6) * 0.5
  return { str, x, y, width, height, right: x + width, index }
}

const pageItems = page => (Array.isArray(page) ? page : page?.items || []).map(normalizeItem).filter(Boolean)

// Items at the same height (within a tolerance from the median text height) belong to one band.
function bands(items, tolerance) {
  const groups = []
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const group = groups.find(g => Math.abs(g.y - item.y) <= tolerance)
    if (group) group.items.push(item)
    else groups.push({ y: item.y, items: [item] })
  }
  for (const group of groups) group.items.sort((a, b) => a.x - b.x)
  return groups.sort((a, b) => b.y - a.y)
}

// Neighbouring items of one band with only a word space between them form a phrase, so a header split
// into "FALL" + "2019/2020" by the PDF writer is still found. Cells of a row are further apart.
function phrases(band, height) {
  const out = []
  for (const item of band.items) {
    const last = out.at(-1)
    if (last && item.x - last.right <= Math.max(1, height)) { last.text += ` ${item.str}`; last.right = Math.max(last.right, item.right) }
    else out.push({ text: item.str, x: item.x, right: item.right, y: band.y })
  }
  return out
}

// Every strip of x (between `from` and `to`) crossed by at most `allowance` bands and bounded on both
// sides by crossed x: [{ start, end, width }], left to right. With `edgesCrossed`, `from` and `to` count
// as crossed (they are the edges of the headers around the range).
function emptyStrips(groups, from, to, allowance, edgesCrossed = false) {
  const start = Math.floor(from); const end = Math.ceil(to)
  if (end - start < 2) return []
  const counts = new Array(end - start).fill(0)
  for (const group of groups) {
    const covered = new Uint8Array(end - start)
    for (const item of group.items) {
      for (let x = Math.max(start, Math.floor(item.x)); x < Math.min(end, Math.ceil(item.right)); x += 1) covered[x - start] = 1
    }
    covered.forEach((c, i) => { counts[i] += c })
  }
  const strips = []; let runStart = null
  for (let i = 0; i <= counts.length; i += 1) {
    const empty = i < counts.length && counts[i] <= allowance
    if (empty && runStart === null) runStart = i
    if (!empty && runStart !== null) {
      // Only a strip with crossed x on both sides is a gap between two things.
      if (edgesCrossed || (runStart > 0 && i < counts.length)) strips.push({ start: start + runStart, end: start + i, width: i - runStart })
      runStart = null
    }
  }
  return strips
}

// Two clusters of header x → the range the split must fall in, or null (headers in one column only).
function headerRange(headers, height) {
  if (headers.length < 2) return null
  const sorted = [...headers].sort((a, b) => a.x - b.x)
  let cut = -1; let widest = 0
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i].x - sorted[i - 1].x
    if (gap > widest) { widest = gap; cut = i }
  }
  // Headers of one column start within a few points of each other.
  if (widest < Math.max(10, height * 2)) return null
  const left = sorted.slice(0, cut); const right = sorted.slice(cut)
  const leftEdge = Math.max(...left.map(h => h.right))
  const rightEdge = Math.min(...right.map(h => h.x))
  if (rightEdge <= leftEdge) return null
  return { from: leftEdge, to: rightEdge }
}

function analysePage(items) {
  const height = median(items.map(i => i.height)) || 6
  const tolerance = Math.max(1.5, Math.min(4, height * 0.35))
  const groups = bands(items, tolerance)
  const headers = groups.flatMap(g => phrases(g, height)).filter(p => isSectionHeader(p.text))
  return { items, height, tolerance, groups, headers, top: headers.length ? Math.max(...headers.map(h => h.y)) : null }
}

const allowanceFor = groups => Math.max(1, Math.floor(groups.length * 0.1))
// The split inside a strip: its middle, or further left when a line of the right column (one of the few
// lines the strip lets through, e.g. "End of Transcript") starts inside it.
function splitIn(strip, groups) {
  const middle = (strip.start + strip.end) / 2
  const starts = groups.flatMap(g => g.items).map(i => i.x).filter(x => x > strip.start && x < middle)
  return starts.length ? Math.min(...starts) : middle
}
const courseBands = (page, top) => page.groups.filter(g => top === null || g.y <= top + page.tolerance)

// The right column starts at its headers' x, so the gutter is the last empty strip before them (an empty
// strip further left can be the space between two cells of the left column).
function splitFromHeaders(page, top) {
  const range = headerRange(page.headers, page.height)
  if (!range) return null
  const course = courseBands(page, top)
  const strip = emptyStrips(course, range.from, range.to, allowanceFor(course), true).at(-1)
  return strip ? splitIn(strip, course) : (range.from + range.to) / 2
}

// No header columns: the widest gap that separates two columns of text. Lines right of a real gutter
// start with words (a course code, a header, a label such as "Term"); right of the space between two
// cells of one column, they start with credits or marks. And a column holds rows of several cells on
// both sides; the space after the code cell has one cell on its left. Neither is taken for a gutter.
function splitFromGap(page, top) {
  const course = courseBands(page, top)
  const items = course.flatMap(g => g.items)
  if (!items.length) return null
  const strips = emptyStrips(course, Math.min(...items.map(i => i.x)), Math.max(...items.map(i => i.right)), allowanceFor(course))
  const columnsOfText = strip => {
    const split = (strip.start + strip.end) / 2
    const firstRight = course.map(g => g.items.find(i => i.x >= split)).filter(Boolean)
    const words = firstRight.filter(i => /^\p{L}{3}/u.test(i.str)).length
    const cells = side => { const counts = course.map(g => g.items.filter(side).length).filter(Boolean); return counts.reduce((a, b) => a + b, 0) / (counts.length || 1) }
    return firstRight.length >= 2 && words >= firstRight.length / 2 && course.some(g => g.items.some(i => i.x < split && /^\p{L}{3}/u.test(i.str)))
      && cells(i => i.x < split) >= 1.5 && cells(i => i.x >= split) >= 1.5
  }
  const best = strips.filter(s => s.width >= page.height * 1.5 && columnsOfText(s)).sort((a, b) => b.width - a.width)[0]
  return best ? splitIn(best, course) : null
}

function buildLines(items, pageNumber, split, tolerance) {
  const columns = split === null ? [items] : [items.filter(i => i.x < split), items.filter(i => i.x >= split)]
  return columns.flatMap((columnItems, column) => bands(columnItems, tolerance).map(g => ({
    page: pageNumber,
    column,
    y: g.y,
    x: g.items[0].x,
    text: g.items.map(i => i.str).join(' '),
    items: g.items.map(({ str, x, y, width, height }) => ({ str, x, y, width, height })),
  })))
}

// pages: [[item, …] | { items: [item, …] }, …] → { lines, headerLines, pages: [{ page, split, source, courseTop }] }
export function readLayout(pages) {
  const analysed = (pages || []).map(page => analysePage(pageItems(page)))

  // Top of the course area: the topmost header on the page; a page whose own headers start lower (a term
  // continued from the previous page) keeps the previous page's top. Before the first header: none.
  const tops = []
  analysed.forEach((page, i) => {
    const previous = i ? tops[i - 1] : null
    tops.push(page.top === null ? previous : previous === null ? page.top : Math.max(page.top, previous))
  })
  const firstTop = tops.find(t => t !== null) ?? null
  for (let i = 0; i < tops.length && tops[i] === null; i += 1) tops[i] = firstTop

  const fromHeaders = analysed.map((page, i) => splitFromHeaders(page, tops[i]))
  const anyHeaderSplit = fromHeaders.some(s => s !== null)
  const info = analysed.map((page, i) => {
    if (fromHeaders[i] !== null) return { split: fromHeaders[i], source: 'headers' }
    if (anyHeaderSplit) {
      for (let j = i - 1; j >= 0; j -= 1) if (fromHeaders[j] !== null) return { split: fromHeaders[j], source: 'previous-page' }
      return { split: fromHeaders.find(s => s !== null), source: 'next-page' }
    }
    const gap = splitFromGap(page, tops[i])
    return gap === null ? { split: null, source: 'one-column' } : { split: gap, source: 'gap' }
  })

  const lines = []; const headerLines = []
  analysed.forEach((page, i) => {
    const top = tops[i]
    const isHeader = item => top !== null && item.y > top + page.tolerance
    const { split } = info[i]
    lines.push(...buildLines(page.items.filter(item => !isHeader(item)), i + 1, split, page.tolerance))
    // The header block is a form (label, value, label, value): read it row by row, each column apart.
    headerLines.push(...buildLines(page.items.filter(isHeader), i + 1, split, page.tolerance)
      .sort((a, b) => b.y - a.y || a.column - b.column))
  })

  return {
    lines,
    headerLines,
    pages: analysed.map((page, i) => ({ page: i + 1, split: info[i].split, source: info[i].source, courseTop: tops[i] })),
  }
}

// Total characters (spaces excluded) in the text items: a scan without a text layer has none.
export function textCharacterCount(pages) {
  return (pages || []).flatMap(pageItems).reduce((n, item) => n + item.str.replace(/\s/g, '').length, 0)
}

export const linesToText = lines => lines.map(line => line.text).join('\n')
