const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim()

export function parseTranscriptText(text) {
  const lines = String(text || '').split(/\r?\n/).map(normalize).filter(Boolean)
  const results = []
  const seen = new Set()
  const patterns = [
    /\b([A-Z]{2,6})\s*[- ]?\s*(\d{2,4})\b\s+(.+?)\s+([A-F](?:\+|-)?|\d{2,3}(?:\.\d+)?)\s*$/i,
    /\b([A-Z]{2,6})\s*[- ]?\s*(\d{2,4})\b\s+([A-F](?:\+|-)?|\d{2,3}(?:\.\d+)?)\s+(.+)$/i,
  ]
  for (const line of lines) {
    for (const pattern of patterns) {
      const m = line.match(pattern)
      if (!m) continue
      const firstPattern = pattern === patterns[0]
      const code = `${m[1].toUpperCase()}-${m[2]}`
      const name = normalize(firstPattern ? m[3] : m[4])
      const grade = normalize(firstPattern ? m[4] : m[3]).toUpperCase()
      if (name.length < 2 || seen.has(`${code}|${grade}`)) break
      results.push({ code, name, grade })
      seen.add(`${code}|${grade}`)
      break
    }
  }
  return results
}

export async function extractTranscript(file, onProgress = () => {}) {
  const type = file.type || ''
  if (type.includes('pdf') || file.name?.toLowerCase().endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    const buffer = await file.arrayBuffer()
    const doc = await pdfjs.getDocument({ data: buffer }).promise
    let text = ''
    for (let i = 1; i <= doc.numPages; i += 1) {
      onProgress(Math.round((i / doc.numPages) * 90))
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((item) => item.str).join(' ') + '\n'
    }
    onProgress(100)
    return { text, courses: parseTranscriptText(text), mode: 'pdf-local' }
  }

  if (type.startsWith('image/')) {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker(['eng', 'ara'], 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') onProgress(Math.round((m.progress || 0) * 100))
      },
    })
    const result = await worker.recognize(file)
    await worker.terminate()
    return { text: result.data.text, courses: parseTranscriptText(result.data.text), mode: 'image-ocr-local' }
  }

  const text = await file.text()
  return { text, courses: parseTranscriptText(text), mode: 'text-local' }
}
