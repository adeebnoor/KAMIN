// Local document-integrity signals for uploaded transcripts.
//
// These are signals, not verdicts: many universities issue unsigned PDFs and some
// editors never change content. Nothing here authenticates a document or verifies a
// certificate chain; the signals only make silent tampering more visible and give the
// student a way to point a reviewer at the issuer's own verification page.
import jsQR from 'jsqr'

const latin1 = bytes => new TextDecoder('latin1').decode(bytes)

// Structural facts readable from the raw bytes without trusting any parser.
export function analyzePdfBytes(bytes) {
  const text = latin1(bytes)
  const byteRanges = [...text.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)].map(m => m.slice(1, 5).map(Number))
  const signatureFields = (text.match(/\/Type\s*\/Sig\b/g) || []).length
  const trailers = (text.match(/%%EOF/g) || []).length
  const signed = byteRanges.length > 0 || signatureFields > 0
  let signatureCoversFile = null
  if (byteRanges.length) {
    const last = byteRanges[byteRanges.length - 1]
    signatureCoversFile = last[2] + last[3] === bytes.length
  }
  return {
    signed,
    signatureCount: Math.max(byteRanges.length, signatureFields),
    signatureCoversFile,
    updatedAfterSignature: signed && signatureCoversFile === false,
    incrementalUpdates: Math.max(0, trailers - 1),
  }
}

const parsePdfDate = value => {
  const m = String(value || '').match(/D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/)
  if (!m) return null
  const date = new Date(Date.UTC(+m[1], (+m[2] || 1) - 1, +m[3] || 1, +m[4] || 0, +m[5] || 0, +m[6] || 0))
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}
const EDITOR_SOFTWARE = /acrobat|foxit|nitro|pdf-?xchange|libreoffice|openoffice|microsoft.*word|ilovepdf|smallpdf|sejda|pdfsam|pdftk|canva|photoshop|gimp|pdfescape|soda ?pdf|wondershare|pdfelement|pdf24|preview|skia\/pdf|quartz pdfcontext/i

// pdf.js getMetadata().info → who produced the file and whether it was re-saved.
export function metadataSignals(info = {}) {
  const producer = String(info.Producer || '').slice(0, 120)
  const creator = String(info.Creator || '').slice(0, 120)
  const createdAt = parsePdfDate(info.CreationDate)
  const modifiedAt = parsePdfDate(info.ModDate)
  return {
    producer, creator,
    editorSoftware: EDITOR_SOFTWARE.test(`${producer} ${creator}`),
    createdAt, modifiedAt,
    modifiedAfterCreation: !!(createdAt && modifiedAt && Date.parse(modifiedAt) - Date.parse(createdAt) > 60_000),
  }
}

export function decodeQrFromImageData(imageData) {
  const data = imageData.data instanceof Uint8ClampedArray ? imageData.data : new Uint8ClampedArray(imageData.data)
  const result = jsQR(data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' })
  return result?.data || null
}

// Only http(s) links become clickable; anything else is shown as text.
export function describeQr(text) {
  let url = null
  try { const parsed = new URL(text); if (['https:', 'http:'].includes(parsed.protocol)) url = parsed.toString() } catch { /* not a URL */ }
  return { text: String(text).slice(0, 500), url, host: url ? new URL(url).host : null }
}

const MAX_SCAN_EDGE = 1800

// Browser only: render a bitmap source to a canvas and look for one QR code.
export async function scanQrFromSource(source, width, height) {
  if (typeof document === 'undefined') return null
  const scale = Math.min(1, MAX_SCAN_EDGE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return decodeQrFromImageData(context.getImageData(0, 0, canvas.width, canvas.height))
}

export async function scanQrFromImageFile(file) {
  if (typeof createImageBitmap !== 'function') return []
  try {
    const bitmap = await createImageBitmap(file)
    try { const text = await scanQrFromSource(bitmap, bitmap.width, bitmap.height); return text ? [describeQr(text)] : [] }
    finally { bitmap.close?.() }
  } catch { return [] }
}

// Render the first pages of a pdf.js document and look for QR codes.
export async function scanQrFromPdf(doc, pages = 2) {
  if (typeof document === 'undefined') return []
  const found = []
  for (let number = 1; number <= Math.min(pages, doc.numPages); number += 1) {
    try {
      const page = await doc.getPage(number)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, MAX_SCAN_EDGE / Math.max(viewport.width, viewport.height))
      canvas.width = Math.round(viewport.width * scale); canvas.height = Math.round(viewport.height * scale)
      const context = canvas.getContext('2d', { willReadFrequently: true })
      await page.render({ canvasContext: context, viewport: page.getViewport({ scale: 2 * scale }) }).promise
      const text = decodeQrFromImageData(context.getImageData(0, 0, canvas.width, canvas.height))
      if (text && !found.some(item => item.text === text)) found.push(describeQr(text))
    } catch { /* a page that cannot render is simply skipped */ }
  }
  return found
}
