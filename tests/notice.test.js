import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { NOTICE_MIN_MS, NOTICE_MS_PER_CHAR, noticeDuration } from '../src/components/Notice.jsx'

// Task 25 · one message at a time: long enough to read, errors stay, no toast over the page.
describe('notice timing', () => {
  it('stays max(6 s, 60 ms per character)', () => {
    expect(NOTICE_MIN_MS).toBe(6000)
    expect(NOTICE_MS_PER_CHAR).toBe(60)
    expect(noticeDuration('Saved.')).toBe(6000)
    expect(noticeDuration('x'.repeat(100))).toBe(6000)
    expect(noticeDuration('x'.repeat(101))).toBe(6060)
    // A 20-word message stays longer than 6 seconds.
    const twentyWords = 'Your profile was restored locally and every derived result was recomputed from the evidence while external sharing consents stayed off.'
    expect(twentyWords.split(' ')).toHaveLength(20)
    expect(noticeDuration(twentyWords)).toBe(60 * twentyWords.length)
    expect(noticeDuration(twentyWords)).toBeGreaterThan(6000)
  })

  it('counts Arabic characters, not bytes', () => {
    const ar = 'تمت استعادة ملفك محليًا. أُعيد حساب النتائج من الأدلة، ولم تُفعّل موافقات المشاركة الخارجية.'
    expect(noticeDuration(ar)).toBe(Math.max(6000, 60 * [...ar].length))
  })

  it('never hides an error message by itself', () => {
    expect(noticeDuration('Could not save.', 'error')).toBe(null)
    expect(noticeDuration('x'.repeat(500), 'error')).toBe(null)
    expect(noticeDuration('Saved.', 'info')).toBe(6000)
  })

  it('the old floating toast and its fixed 4.2 s timer are gone', () => {
    // Task 70: the old interface (src/App.jsx) is deleted; the interface's own code must not bring the toast back.
    const app = ['src/ui2/AppNext.jsx', 'src/ui2/Notice.jsx'].map(f => readFileSync(f, 'utf8')).join('\n'), css = readFileSync('src/styles.css', 'utf8')
    expect(app).not.toMatch(/className="toast"|4200/)
    expect(css).not.toMatch(/\.toast\b/)
    expect(css).toMatch(/\.notice-slot\{flex:0 0 auto\}/)
  })
})
