import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('deployment performance configuration',()=>{
  const blueprint=readFileSync(new URL('../render.yaml',import.meta.url),'utf8')
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8')

  it('declares the manifest media type in both HTML and Render headers',()=>{
    expect(html).toMatch(/rel="manifest"[^>]+type="application\/manifest\+json"/)
    expect(blueprint).toContain('path: /manifest.json')
    expect(blueprint).toContain('application/manifest+json; charset=utf-8')
  })

  it('uses immutable one-year caching for hashed assets and OCR runtime',()=>{
    expect(blueprint).toMatch(/path: \/assets\/\*[\s\S]*?max-age=31536000, immutable/)
    expect(blueprint).toMatch(/path: \/ocr\/\*[\s\S]*?max-age=31536000, immutable/)
  })

  it('keeps the service worker uncached so deployments can take control promptly',()=>{
    expect(blueprint).toMatch(/path: \/sw\.js[\s\S]*?no-cache, no-store, must-revalidate/)
  })
})
