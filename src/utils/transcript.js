import { normalizeGrade } from './engine.js'

const normalize = (s) => String(s || '')
  .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const codePattern = /\b([A-Z]{2,8})\s*[-–— ]?\s*(\d{2,4})\b/i
const letterGradePattern = /(?:^|\s)(A\+|A-|A|B\+|B-|B|C\+|C-|C|D\+|D-|D|F|WF|W|IP|I|NP|DN|أ\+|ا\+|أ|ا|ب\+|ب|ج\+|ج|د\+|د|هـ|ه|ح|م)(?=\s|$)/i

function parseLine(line, source = 'text') {
  const clean = normalize(line)
  const codeMatch = clean.match(codePattern)
  if (!codeMatch) return null

  const code = `${codeMatch[1].toUpperCase()}-${codeMatch[2]}`
  let rest = normalize(clean.slice((codeMatch.index || 0) + codeMatch[0].length))
  let grade = null
  let gradeRaw = ''
  let gradeStart = -1
  const gm = rest.match(letterGradePattern)

  if (gm) {
    gradeRaw = gm[1]
    grade = normalizeGrade(gradeRaw)
    gradeStart = gm.index + (gm[0].length - gm[1].length)
  } else {
    // Numeric grades are accepted only when they look like a percentage, not hours/points.
    const numericMatches = [...rest.matchAll(/(?:^|\s)(\d{2,3}(?:\.\d+)?)(?=\s|$)/g)]
      .map((m) => ({ raw: m[1], index: m.index + (m[0].length - m[1].length), value: Number(m[1]) }))
      .filter((m) => m.value >= 50 && m.value <= 100)
    if (numericMatches.length === 1) {
      const n = numericMatches[0]
      gradeRaw = n.raw
      grade = normalizeGrade(n.raw)
      gradeStart = n.index
    }
  }

  if (gradeStart < 0) {
    return {
      code,
      name: rest || code,
      grade: '',
      hours: null,
      points: null,
      source,
      reviewRequired: true,
      reviewReason: 'grade-unreadable',
      raw: clean,
    }
  }

  let before = normalize(rest.slice(0, gradeStart))
  const after = normalize(rest.slice(gradeStart + gradeRaw.length))

  let hours = null
  const hoursMatch = before.match(/^(.*?)(?:\s+)([0-9](?:\.0)?)$/)
  if (hoursMatch && Number(hoursMatch[2]) <= 9) {
    before = normalize(hoursMatch[1])
    hours = Number(hoursMatch[2])
  }

  const pointsMatch = after.match(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/)
  const points = pointsMatch ? Number(pointsMatch[1]) : null
  const name = before.replace(/^[-–—:|]+|[-–—:|]+$/g, '').trim()
  const reviewRequired = !name || name.length < 2 || !grade

  return {
    code,
    name: name || code,
    grade: grade || gradeRaw,
    hours,
    points,
    source,
    reviewRequired,
    reviewReason: reviewRequired ? 'row-structure-uncertain' : null,
    raw: clean,
  }
}

function rowKey(row) {
  return `${row.code}|${row.grade}|${String(row.name).toLowerCase()}`
}

export function parseTranscriptText(text, source = 'text') {
  const lines = String(text || '').split(/\r?\n/).map(normalize).filter(Boolean)
  const results = []
  const seen = new Set()
  for (const line of lines) {
    const row = parseLine(line, source)
    if (!row) continue
    const key = rowKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    results.push(row)
  }
  return results
}

function pageLineCandidates(items = []) {
  const groups = []
  const tolerance = 2.5

  for (const item of items) {
    const text = normalize(item?.str)
    if (!text) continue
    const x = Number(item?.transform?.[4] || 0)
    const y = Number(item?.transform?.[5] || 0)
    let group = groups.find((g) => Math.abs(g.y - y) <= tolerance)
    if (!group) {
      group = { y, items: [] }
      groups.push(group)
    }
    group.items.push({ x, text })
  }

  groups.sort((a, b) => b.y - a.y)
  return groups.map((group) => {
    const asc = group.items.slice().sort((a, b) => a.x - b.x).map((i) => i.text).join(' ')
    const desc = group.items.slice().sort((a, b) => b.x - a.x).map((i) => i.text).join(' ')
    return asc === desc ? [asc] : [asc, desc]
  })
}

function parsePageItems(items, source = 'pdf') {
  const results = []
  const seenCodes = new Set()
  const lineGroups = pageLineCandidates(items)

  for (const candidates of lineGroups) {
    const parsed = candidates
      .map((candidate) => parseLine(candidate, source))
      .filter(Boolean)
      .sort((a, b) => {
        const qualityA = (a.reviewRequired ? 0 : 1000) + String(a.name || '').length
        const qualityB = (b.reviewRequired ? 0 : 1000) + String(b.name || '').length
        return qualityB - qualityA
      })
    const row = parsed[0]
    if (!row || seenCodes.has(row.code)) continue
    seenCodes.add(row.code)
    results.push(row)
  }

  return { rows: results, text: lineGroups.flat().join('\n') }
}

export async function extractTranscript(file, onProgress = () => {}) {
  const type = file.type || ''
  if (type.includes('pdf') || file.name?.toLowerCase().endsWith('.pdf')) {
    const [pdfjs, workerModule] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default
    const buffer = await file.arrayBuffer()
    const doc = await pdfjs.getDocument({ data: buffer }).promise
    let text = ''
    const courses = []
    const seen = new Set()

    for (let i = 1; i <= doc.numPages; i += 1) {
      onProgress(Math.round((i / doc.numPages) * 90))
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const parsed = parsePageItems(content.items, 'pdf')
      text += parsed.text + '\n'
      for (const row of parsed.rows) {
        const key = rowKey(row)
        if (!seen.has(key)) {
          seen.add(key)
          courses.push(row)
        }
      }
    }
    onProgress(100)
    return { text, courses, mode: 'pdf-local' }
  }

  if (type.startsWith('image/')) {
    // Privacy-first hard stop: the previous implementation downloaded OCR worker/core/
    // language assets from third-party CDNs. Image OCR remains disabled until ara+eng
    // assets are self-hosted under /public/ocr and covered by the CSP/network test.
    const error = new Error('LOCAL_OCR_NOT_INSTALLED')
    error.code = 'LOCAL_OCR_NOT_INSTALLED'
    throw error
  }

  const text = await file.text()
  return { text, courses: parseTranscriptText(text, 'text'), mode: 'text-local' }
}
