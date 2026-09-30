import { describe, it, expect } from 'vitest'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { analyzePdfBytes, metadataSignals, decodeQrFromImageData, describeQr } from '../src/utils/documentIntegrity.js'

const encoder = new TextEncoder()
const pdf = (body) => encoder.encode(`%PDF-1.7\n${body}\ntrailer\n<< /Root 1 0 R >>\nstartxref\n9\n%%EOF\n`)

describe('PDF structural signals', () => {
  it('reports an unsigned single-revision file neutrally', () => {
    expect(analyzePdfBytes(pdf('1 0 obj << /Type /Catalog >> endobj'))).toEqual({
      signed: false, signatureCount: 0, signatureCoversFile: null, updatedAfterSignature: false, incrementalUpdates: 0,
    })
  })

  it('recognises a signature whose byte range covers the whole file', () => {
    const body = '2 0 obj << /Type /Sig /ByteRange [0 10 20 XXXX] >> endobj'
    let bytes = pdf(body)
    const length = bytes.length
    // Patch the placeholder so offset + length equals the file length.
    const patched = new TextDecoder('latin1').decode(bytes).replace('XXXX', String(length - 20).padStart(4, "0"))
    bytes = encoder.encode(patched)
    const result = analyzePdfBytes(bytes)
    expect(result.signed).toBe(true)
    expect(result.signatureCount).toBe(1)
    expect(result.signatureCoversFile).toBe(true)
    expect(result.updatedAfterSignature).toBe(false)
  })

  it('flags a file that was saved again after it was signed', () => {
    const signed = '2 0 obj << /Type /Sig /ByteRange [0 100 200 50] >> endobj'
    const bytes = encoder.encode(new TextDecoder('latin1').decode(pdf(signed)) + '3 0 obj << /Edited true >> endobj\nstartxref\n400\n%%EOF\n')
    const result = analyzePdfBytes(bytes)
    expect(result.signed).toBe(true)
    expect(result.signatureCoversFile).toBe(false)
    expect(result.updatedAfterSignature).toBe(true)
    expect(result.incrementalUpdates).toBe(1)
  })
})

describe('PDF metadata signals', () => {
  it('names general-purpose editors and later modification dates without judging', () => {
    const signals = metadataSignals({ Producer: 'Adobe Acrobat Pro DC 23.1', Creator: 'Acrobat', CreationDate: 'D:20260101120000Z', ModDate: 'D:20260315090000Z' })
    expect(signals.editorSoftware).toBe(true)
    expect(signals.modifiedAfterCreation).toBe(true)
    expect(signals.createdAt).toBe('2026-01-01T12:00:00.000Z')
    const issuer = metadataSignals({ Producer: 'Oracle PeopleSoft', CreationDate: 'D:20260101120000Z', ModDate: 'D:20260101120030Z' })
    expect(issuer.editorSoftware).toBe(false)
    expect(issuer.modifiedAfterCreation).toBe(false)
    expect(metadataSignals({}).producer).toBe('')
  })
})

describe('QR code reading', () => {
  it('decodes a verification link from a rendered QR image and keeps only http(s) links clickable', async () => {
    const png = await QRCode.toBuffer('https://verify.example-university.edu.sa/t/ABC123', { width: 320, margin: 2 })
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const text = decodeQrFromImageData({ data: new Uint8ClampedArray(data), width: info.width, height: info.height })
    expect(text).toBe('https://verify.example-university.edu.sa/t/ABC123')
    expect(describeQr(text)).toEqual({ text, url: text, host: 'verify.example-university.edu.sa' })
    expect(describeQr('javascript:alert(1)').url).toBeNull()
    expect(describeQr('STUDENT-4411').url).toBeNull()
  })
})
