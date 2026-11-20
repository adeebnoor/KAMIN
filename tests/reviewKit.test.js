import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import {
  CATALOG_FILE, COLUMNS, DECISIONS, ASSESSMENTS, HEADER_KEYS, PROBLEM_TYPES,
  checkSheet, countByType, loadCatalog, parseCsv, sheetDataRows, sheetRows, toCsvText,
  KIT_VERSION, collegeMapFile, kitVersion, loadCollegeMap, parseKitArgs, sheetFileName,
} from '../scripts/review-kit/lib.mjs'

// Task 31 · department review kit: export the FCIT map as a sheet, check a returned sheet, change nothing.

const ROOT = path.resolve(import.meta.dirname, '..')
const FIXTURES = path.join(ROOT, 'tests/fixtures/review-kit')
const fixture = name => readFileSync(path.join(FIXTURES, name), 'utf8')
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const run = (script, args) => spawnSync(process.execPath, [path.join(ROOT, 'scripts/review-kit', script), ...args], { cwd: ROOT, encoding: 'utf8' })
const types = text => countByType(checkSheet(text).problems)

let tmp, exported, exportResult, checkResult, catalogBefore
beforeAll(() => {
  catalogBefore = sha256(CATALOG_FILE)
  tmp = mkdtempSync(path.join(os.tmpdir(), 'kamin-review-kit-'))
  exportResult = run('export.mjs', ['--date', '2026-11-17', '--out', tmp])
  exported = path.join(tmp, 'fcit-map-review-2026-11-17.csv')
  checkResult = existsSync(exported) ? run('check.mjs', [exported]) : null
})
afterAll(() => { if (tmp) rmSync(tmp, { recursive: true, force: true }) })

describe('export (npm run review:export)', () => {
  it('writes review/fcit-map-review-<date>.csv as UTF-8 with a BOM so Excel shows Arabic', () => {
    expect(exportResult.status, exportResult.stderr).toBe(0)
    const bytes = readFileSync(exported)
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(bytes.toString('utf8')).toContain('قواعد البيانات')
  })

  it('has a header block naming the catalog, the map version, the date and the empty reviewer fields', () => {
    const rows = parseCsv(readFileSync(exported, 'utf8'))
    const header = Object.fromEntries(rows.slice(0, rows.findIndex(r => r[0] === 'code')).filter(r => r[0]).map(r => [r[0], r[1]]))
    for (const key of HEADER_KEYS) expect(header, key).toHaveProperty(key)
    expect(header).toMatchObject({ catalog: 'FCIT Catalog 2024-25', mapping_version: 'fcit-map-v1', export_date: '2026-11-17', reviewer_name: '', reviewer_role: '', review_date: '' })
  })

  it('lists the columns in the order the brief gives, with the reviewer columns empty', () => {
    const rows = parseCsv(readFileSync(exported, 'utf8'))
    const at = rows.findIndex(r => r[0] === 'code')
    expect(rows[at]).toEqual(['code', 'title_en', 'catalog_page', 'learning_outcome_en', 'learning_outcome_ar', 'capability_id', 'capability_label_en', 'capability_label_ar',
      'decision', 'corrected_outcome_en', 'corrected_outcome_ar', 'assessment', 'title_ar_official', 'note'])
    for (const row of rows.slice(at + 1)) expect(row.slice(8).every(cell => cell === ''), row[0]).toBe(true)
  })

  it('has 40 courses: 46 link rows (30×1 + 8×2) and 2 unmapped rows = 48 data rows', () => {
    const catalog = loadCatalog()
    const rows = sheetDataRows(catalog)
    const byLinks = n => catalog.courses.filter(c => c.capabilities.length === n).length
    expect([catalog.courses.length, byLinks(1), byLinks(2), byLinks(0)]).toEqual([40, 30, 8, 2])
    expect(rows).toHaveLength(48)
    expect(rows.filter(r => r[5])).toHaveLength(46)
    expect(rows.filter(r => !r[5]).map(r => r[0]).sort()).toEqual(['CPIT-260', 'CPIT-305'])
    expect(new Set(rows.map(r => r[0])).size).toBe(40)
    // The file on disk holds the same 48 rows.
    const disk = parseCsv(readFileSync(exported, 'utf8'))
    expect(disk.slice(disk.findIndex(r => r[0] === 'code') + 1).filter(r => r.some(c => c))).toEqual(rows)
  })

  it('shows CPIT-240 linked to "Databases" with both outcome texts and the catalog page', () => {
    const row = sheetDataRows(loadCatalog()).find(r => r[0] === 'CPIT-240')
    const cell = name => row[COLUMNS.indexOf(name)]
    expect(cell('title_en')).toBe('Databases (I)')
    expect(cell('capability_label_en')).toBe('Databases')
    expect(cell('capability_label_ar')).toBe('قواعد البيانات')
    expect(cell('learning_outcome_en')).toMatch(/SQL/)
    expect(cell('learning_outcome_ar')).toMatch(/[؀-ۿ]/)
    expect(cell('catalog_page')).toBe('60')
  })

  it('keeps commas, quotes and line breaks inside a cell (CSV round-trip)', () => {
    const rows = [['a', 'b, c', 'say "hi"', 'two\nlines', 'عربي']]
    expect(parseCsv(toCsvText(rows))).toEqual(rows)
  })
})

describe('check (npm run review:check)', () => {
  it('an untouched export exits non-zero: 48 empty decisions and the missing reviewer header', () => {
    expect(checkResult.status).toBe(1)
    expect(checkResult.stdout).toContain('48 × empty decision')
    expect(checkResult.stdout).toContain('3 × reviewer field missing in the header')
    expect(types(readFileSync(exported, 'utf8'))).toEqual({ 'empty-decision': 48, 'missing-header': 3 })
  })

  it('every data row of the untouched export is listed as "empty decision"', () => {
    const { problems } = checkSheet(readFileSync(exported, 'utf8'))
    const listed = problems.filter(p => p.type === 'empty-decision').map(p => p.where.replace(/^line \d+ /, ''))
    const expected = sheetDataRows(loadCatalog()).map(r => `(${r[0]}${r[5] ? ` → ${r[5]}` : ''})`)
    expect(listed).toEqual(expected)
  })

  it('the "all approved" fixture passes and exits 0', () => {
    expect(checkSheet(fixture('all-approved.csv')).problems).toEqual([])
    const result = run('check.mjs', [path.join(FIXTURES, 'all-approved.csv')])
    expect(result.status, result.stdout).toBe(0)
    expect(result.stdout).toContain('OK')
  })

  it('a valid mix (change with text, reject with a note, an official Arabic title, a project assessment) passes', () => {
    expect(checkSheet(fixture('mixed-valid.csv')).problems).toEqual([])
  })

  // One fixture per error type in the brief; each must raise exactly its own problem.
  const cases = [
    ['empty-decision.csv', { 'empty-decision': 1 }],
    ['bad-decision.csv', { 'bad-decision': 1 }],
    ['change-without-text.csv', { 'change-without-text': 1 }],
    ['bad-assessment.csv', { 'bad-assessment': 1 }],
    ['unknown-code.csv', { 'unknown-code': 1 }],
    ['missing-code.csv', { 'missing-code': 1 }],
    ['missing-header.csv', { 'missing-header': 2 }],
    // A missing reviewer name is also a header problem; the Arabic title is reported on its row.
    ['arabic-title-without-reviewer.csv', { 'missing-header': 1, 'arabic-title-without-reviewer': 1 }],
  ]
  it.each(cases)('%s raises exactly its own problem', (name, expected) => {
    expect(types(fixture(name))).toEqual(expected)
  })

  it.each(cases)('%s exits 1 from the command line and names the row or field', name => {
    const result = run('check.mjs', [path.join(FIXTURES, name)])
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/line \d+ \(|header: |STAT-110: /)
    expect(result.stdout).toContain('Nothing was changed.')
  })

  it('every fixture file is used by a test', () => {
    const used = new Set(['all-approved.csv', 'mixed-valid.csv', ...cases.map(([name]) => name)])
    expect(readdirSync(FIXTURES).filter(f => f.endsWith('.csv')).sort()).toEqual([...used].sort())
  })

  it('names the reviewer fields one by one, and refuses a sheet without them', () => {
    const problems = checkSheet(fixture('missing-header.csv')).problems.filter(p => p.type === 'missing-header')
    expect(problems.map(p => p.message)).toEqual([
      'header: reviewer field missing in the header (reviewer_role is empty or missing)',
      'header: reviewer field missing in the header (review_date is empty or missing)',
    ])
  })

  describe('other ways a sheet can go wrong', () => {
    const approved = () => parseCsv(fixture('all-approved.csv'))
    const text = rows => toCsvText(rows)
    const codeRow = rows => rows.findIndex(r => r[0] === 'code')

    it('a deleted link row of a two-link course is a missing link, not a missing course', () => {
      const rows = approved()
      rows.splice(rows.findIndex(r => r[0] === 'CPIT-498' && r[5] === 'project'), 1)
      expect(types(text(rows))).toEqual({ 'missing-link': 1 })
    })
    it('a capability the course was never linked to, and a repeated row, are reported', () => {
      const rows = approved()
      const at = rows.findIndex(r => r[0] === 'CPIT-240')
      rows.push(Object.assign([...rows[at]], { 5: 'cyber' }), [...rows[at]])
      expect(types(text(rows))).toEqual({ 'unknown-link': 1, 'duplicate-row': 1 })
    })
    it('a sheet exported from another map version is refused', () => {
      const rows = approved()
      rows.find(r => r[0] === 'mapping_version')[1] = 'fcit-map-v0'
      expect(types(text(rows))).toEqual({ 'wrong-catalog': 1 })
    })
    it('a deleted column, or a file that is not a review sheet, is refused', () => {
      const rows = approved()
      const drop = rows[codeRow(rows)].indexOf('assessment')
      expect(types(text(rows.map((r, i) => i >= codeRow(rows) ? r.filter((_, j) => j !== drop) : r)))).toEqual({ 'missing-column': 1 })
      expect(types('id,text\nar-01,hello\n')).toEqual({ 'not-a-sheet': 1 })
    })
    it('a sheet Excel saved as plain CSV (not UTF-8) is refused, because the Arabic text is gone', () => {
      const utf8 = Buffer.from(fixture('mixed-valid.csv'), 'utf8')
      // What readFileSync(…, 'utf8') returns for a Windows-1256 file: Arabic bytes become U+FFFD.
      const ansi = Buffer.from(utf8.toString('latin1').replace(/[Ø-Û][-¿]/g, 'Ç'), 'latin1').toString('utf8')
      expect(ansi).toContain('�')
      expect(types(ansi)).toEqual({ 'not-utf8': 1 })
    })
    it('accepts decisions and assessments in any letter case, and blank lines Excel may add', () => {
      const rows = approved()
      const at = codeRow(rows)
      rows[at + 1][COLUMNS.indexOf('decision')] = 'Approve'
      rows[at + 2][COLUMNS.indexOf('assessment')] = 'LAB'
      rows.push([], ['', '', ''])
      expect(checkSheet(text(rows)).problems).toEqual([])
    })
    it('every problem type has a message, and the allowed lists match the brief', () => {
      expect(DECISIONS).toEqual(['approve', 'reject', 'change'])
      expect(ASSESSMENTS).toEqual(['exam', 'project', 'lab', 'mixed', 'unknown'])
      for (const [type, message] of Object.entries(PROBLEM_TYPES)) expect(message, type).toBeTruthy()
    })
  })
})

describe('the kit changes nothing and calls nothing', () => {
  it('src/catalog/fcit-2024-25.json is byte-identical (sha256) after export and check', () => {
    expect(checkResult).not.toBeNull()
    expect(sha256(CATALOG_FILE)).toBe(catalogBefore)
  })
  it('the scripts have no network call and do not write to src/', () => {
    for (const name of ['lib.mjs', 'export.mjs', 'check.mjs']) {
      const source = readFileSync(path.join(ROOT, 'scripts/review-kit', name), 'utf8')
      expect(source, name).not.toMatch(/\bfetch\w*\s*\(|XMLHttpRequest|WebSocket|https?:\/\//)
      expect(source, name).not.toMatch(/writeFileSync\([^)]*CATALOG_FILE/)
    }
    expect(readFileSync(path.join(ROOT, 'scripts/review-kit/check.mjs'), 'utf8')).not.toMatch(/writeFile|mkdir|rename|unlink/)
  })
  it('review/ is git-ignored (filled sheets carry the reviewer name)', () => {
    const result = spawnSync('git', ['check-ignore', '-q', 'review/fcit-map-review-2026-11-17.csv'], { cwd: ROOT })
    expect(result.status).toBe(0)
    // Only the top-level folder: src/review/ (app code) stays tracked.
    expect(spawnSync('git', ['check-ignore', '-q', 'src/review/x.js'], { cwd: ROOT }).status).toBe(1)
  })
  it('package.json runs the kit as review:export and review:check', () => {
    const { scripts } = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    expect(scripts['review:export']).toBe('node scripts/review-kit/export.mjs')
    expect(scripts['review:check']).toBe('node scripts/review-kit/check.mjs')
  })
  it('the reviewer guide exists in Arabic and English and says a grade is a clue, not a guarantee', () => {
    const doc = readFileSync(path.join(ROOT, 'docs/DEPARTMENT_REVIEW.md'), 'utf8')
    expect(doc).toContain('A course grade is a clue to an expected learning outcome, not a guarantee of mastery.')
    expect(doc).toContain('درجة المقرر قرينة على مخرج تعلم متوقع، وليست ضمانًا لإتقانه.')
    for (const word of ['approve', 'reject', 'change', 'npm run review:check']) expect(doc).toContain(word)
  })
  it('the sample sheet built in memory matches the export header shape', () => {
    const rows = sheetRows(loadCatalog(), '2026-11-17')
    expect(rows.slice(0, codeRowIndex(rows)).filter(r => r.length).map(r => r[0])).toEqual(['kit', 'instructions', ...HEADER_KEYS.slice(1)])
  })
})

function codeRowIndex(rows) { return rows.findIndex(r => r[0] === 'code') }

// Task 37 · the same kit for any college: `--college <ID>` picks that college's map file. Only FCIT has
// one, so Science and Medicine stop with the reason. The flow itself is checked on a synthetic map held
// in this test only (clearly not a real catalog; nothing is added to src/catalog/).
describe('Task 37 · --college', () => {
  let dir
  beforeAll(() => { dir = mkdtempSync(path.join(os.tmpdir(), 'kamin-review-kit-college-')) })
  afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

  it('--college FCIT (any letter case) writes the same sheet as no flag', () => {
    for (const value of ['FCIT', 'fcit']) {
      const out = path.join(dir, value)
      const result = run('export.mjs', ['--college', value, '--date', '2026-11-17', '--out', out])
      expect(result.status, result.stderr).toBe(0)
      expect(readFileSync(path.join(out, 'fcit-map-review-2026-11-17.csv'))).toEqual(readFileSync(exported))
    }
  })

  it.each(['SCI', 'MED'])('--college %s stops with exit 2, points to the decision record and writes nothing', college => {
    const out = path.join(dir, `none-${college}`)
    const result = run('export.mjs', ['--college', college, '--date', '2026-11-17', '--out', out])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`${college} has no course map file yet`)
    expect(result.stderr).toContain('docs/decisions/2026-11-other-college-catalogs.md')
    expect(existsSync(out)).toBe(false)
    const check = run('check.mjs', ['--college', college, path.join(FIXTURES, 'all-approved.csv')])
    expect(check.status).toBe(2)
    expect(check.stderr).toContain(`${college} has no course map file yet`)
  })

  it('an unknown college, or --college without a value, stops with exit 2', () => {
    expect(run('export.mjs', ['--college', 'XYZ', '--out', dir]).stderr).toContain('Unknown college "XYZ". Known colleges: FCIT, SCI, MED.')
    expect(run('export.mjs', ['--college', 'XYZ', '--out', dir]).status).toBe(2)
    expect(run('check.mjs', ['--college']).status).toBe(2)
  })

  it('check takes --college before or after the file', () => {
    const file = path.join(FIXTURES, 'all-approved.csv')
    for (const args of [['--college', 'FCIT', file], [file, '--college', 'FCIT']]) {
      const result = run('check.mjs', args)
      expect(result.status, result.stdout + result.stderr).toBe(0)
    }
    expect(run('check.mjs', ['--college', 'FCIT', path.join(FIXTURES, 'empty-decision.csv')]).status).toBe(1)
  })

  it('names the sheet and the kit after the college', () => {
    expect(sheetFileName('2026-11-17')).toBe('fcit-map-review-2026-11-17.csv')
    expect(sheetFileName('2026-11-17', 'SCI')).toBe('sci-map-review-2026-11-17.csv')
    expect(kitVersion('FCIT')).toBe(KIT_VERSION)
    expect(kitVersion('SCI')).toBe('kamin-sci-review-v1')
    expect(collegeMapFile()).toEqual({ college: 'FCIT', file: CATALOG_FILE })
    expect(loadCollegeMap('FCIT')).toEqual({ college: 'FCIT', file: CATALOG_FILE, catalog: loadCatalog() })
    expect(loadCollegeMap('SCI').error).toMatch(/^SCI has no course map file yet/)
    expect(parseKitArgs(['a.csv', '--college', 'med'])).toEqual({ college: 'med', rest: ['a.csv'], error: null })
  })

  it('the same export → check flow works on another college\'s map (synthetic, in memory)', () => {
    const outcome = { id: 'TEST-101-LO1', ar: 'نص اختبار', en: 'Test outcome', status: 'proposed' }
    const course = (code, capabilities) => ({ code, title: { ar: null, en: `Synthetic ${code}` }, college: 'SCI', catalog: 'Synthetic test catalog (not a source)', catalogPage: 1,
      learningOutcomes: [{ ...outcome, id: `${code}-LO1` }], capabilities, evidenceType: 'knowledge', assessment: 'unknown', mappingVersion: 'test-map-v0', reviewedBy: null, reviewedAt: null, verification: 'checked-against-catalog' })
    const map = { catalog: 'Synthetic test catalog (not a source)', college: 'SCI', mappingVersion: 'test-map-v0', courses: [course('TEST-101', ['statistics']), course('TEST-102', [])] }
    const rows = sheetRows(map, '2026-11-18')
    expect(rows[0]).toEqual(['kit', 'kamin-sci-review-v1'])
    expect(countByType(checkSheet(toCsvText(rows), map).problems)).toEqual({ 'empty-decision': 2, 'missing-header': 3 })
    const at = codeRowIndex(rows)
    const filled = rows.map((r, i) => i > at ? Object.assign([...r], { [COLUMNS.indexOf('decision')]: 'approve' })
      : r[0] === 'reviewer_name' ? ['reviewer_name', 'Test reviewer'] : r[0] === 'reviewer_role' ? ['reviewer_role', 'Test'] : r[0] === 'review_date' ? ['review_date', '2026-11-18'] : r)
    expect(checkSheet(toCsvText(filled), map).problems).toEqual([])
    // An FCIT sheet checked against another college's map is refused.
    const fcitSheet = types(fixture('all-approved.csv'))
    expect(fcitSheet).toEqual({})
    expect(countByType(checkSheet(fixture('all-approved.csv'), map).problems)).toMatchObject({ 'wrong-catalog': 1, 'missing-code': 2 })
  })
})
