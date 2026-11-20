// Task 36 · the learning-path list is reviewed by two department reviewers: review rules, retired
// invented items, the "Planned feature" / "Reviewed by the department" labels, the review kit
// (scripts/path-review), and the startup bundle without the full list. Reviewer roles below are made up.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { reviewProblems, reviewOutcome, pathReviewStatus, isShown, ITEM_STATUSES, SOURCE_TYPES } from '../src/path/review.js'
import { suggestPath, LEARNING_CATALOG } from '../src/path/suggest.js'
import { computeGap } from '../src/path/gap.js'
import { nextStepFeed } from '../src/path/nextSteps.js'
import { targetProfiles } from '../src/matching/targets.js'
import { catalogCourses } from '../src/catalog/fcit.js'
import { opportunities } from '../src/data.js'
import { courseFitView } from '../src/catalog/courseFitView.js'
import { checkSheet, applyReview, sheetRows, parseCsv, toCsvText, reviewableItems, COLUMNS, KIT_VERSION, PROBLEM_TYPES } from '../scripts/path-review/lib.mjs'

const LIST_FILE = 'src/catalog/learning-opportunities.json'
const list = JSON.parse(readFileSync(LIST_FILE, 'utf8'))
const items = list.items
const COURSE_CAPABILITIES = [...new Set(catalogCourses.flatMap(c => c.capabilities))]
const RETIRED = ['ba', 'sql', 'cyber-foundations', 'illustrative-testing-basics', 'illustrative-web-basics', 'illustrative-db-operations']
const ROLES = { reviewer_a_role: 'Course coordinator, CPIT (made up)', reviewer_a_date: '2026-11-20', reviewer_b_role: 'Faculty member, CPIT (made up)', reviewer_b_date: '2026-11-21' }
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')

// A filled sheet: the export with the header and both decision columns filled in.
function filledSheet({ header = ROLES, a = () => 'approve', b = () => 'approve', drop = [] } = {}, source = list) {
  const rows = sheetRows(source, '2026-11-18').map(r => [...r])
  const at = rows.findIndex(r => r[0] === 'id')
  for (const row of rows.slice(0, at)) if (row[0] in header) row[1] = header[row[0]]
  const col = name => COLUMNS.indexOf(name)
  for (const row of rows.slice(at + 1)) {
    row[col('reviewer_a_decision')] = a(row[0]) ?? ''
    row[col('reviewer_b_decision')] = b(row[0]) ?? ''
  }
  return toCsvText(rows.filter(r => !drop.includes(r[0])))
}
const types = text => checkSheet(text).problems.map(p => p.type)

describe('Task 36: the review rules (src/path/review.js)', () => {
  it('every item of the list follows the rules (status, source, reviewers, dates)', () => {
    for (const item of items) expect(reviewProblems(item), item.id).toEqual([])
    expect(ITEM_STATUSES).toEqual(['illustrative', 'reviewed', 'retired'])
    expect(SOURCE_TYPES).toEqual(['kau-catalog', 'department-offer', 'provider-page', 'invented'])
  })

  it('0 shown items with an invented source', () => {
    expect(items.filter(isShown).filter(i => i.source.type === 'invented')).toEqual([])
    expect(items.filter(i => i.source.type === 'invented').map(i => i.id)).toEqual(RETIRED)
    expect(reviewProblems({ ...items.find(i => i.id === 'sql'), status: 'illustrative', retiredAt: undefined })).toContain('invented-source-shown')
  })

  it('an item with only one reviewer cannot be reviewed (nor with the same role twice, a name list of three, or no date)', () => {
    const base = { ...items.find(i => i.id === 'fcit-cpit-425'), status: 'reviewed', reviewers: [ROLES.reviewer_a_role, ROLES.reviewer_b_role], reviewedAt: '2026-11-21' }
    expect(reviewProblems(base)).toEqual([])
    expect(reviewProblems({ ...base, reviewers: [ROLES.reviewer_a_role] })).toEqual(['needs-two-reviewers'])
    expect(reviewProblems({ ...base, reviewers: [ROLES.reviewer_a_role, ROLES.reviewer_a_role] })).toEqual(['needs-two-reviewers'])
    expect(reviewProblems({ ...base, reviewers: ['a', 'b', 'c'] })).toEqual(['needs-two-reviewers'])
    expect(reviewProblems({ ...base, reviewers: null })).toEqual(['needs-two-reviewers'])
    expect(reviewProblems({ ...base, reviewedAt: null })).toEqual(['needs-review-date'])
    expect(reviewProblems({ ...base, status: 'illustrative' })).toEqual(['reviewers-without-review'])
  })

  it('retired items are kept for history, with their date, and are never suggested', () => {
    const retired = items.filter(i => i.status === 'retired')
    expect(retired.map(i => i.id)).toEqual(RETIRED)
    for (const item of retired) expect(item.retiredAt, item.id).toBe('2026-11-18')
    expect(items).toHaveLength(14)
    for (const target of targetProfiles) {
      for (const s of suggestPath(computeGap([], target.id))) expect(RETIRED, target.id).not.toContain(s.itemId)
      for (const c of nextStepFeed({ goalIds: [target.id] }).cards) expect(RETIRED, target.id).not.toContain(c.itemId)
    }
  })

  it('course items come only from the FCIT catalogue and support exactly what the course map says', () => {
    for (const item of items.filter(i => i.kind === 'university-course')) {
      const course = catalogCourses.find(c => c.code === item.courseCode)
      expect(course, item.id).toBeTruthy()
      expect([...item.supports].sort(), item.id).toEqual([...course.capabilities].sort())
      expect(item.source.type, item.id).toBe('kau-catalog')
    }
  })

  it('two decisions: only agreement counts; a disagreement keeps the item illustrative', () => {
    expect(reviewOutcome('approve', 'approve')).toBe('reviewed')
    expect(reviewOutcome('Approve', ' APPROVE ')).toBe('reviewed')
    expect(reviewOutcome('retire', 'retire')).toBe('retired')
    for (const [a, b] of [['approve', 'reject'], ['approve', 'retire'], ['reject', 'retire'], ['reject', 'reject'], ['approve', ''], ['', ''], ['approve', 'yes']]) expect(reviewOutcome(a, b), `${a}/${b}`).toBe('illustrative')
  })

  it('"Planned feature" stays until every capability a course links to has a reviewed item', () => {
    expect(COURSE_CAPABILITIES.sort()).toEqual(['cyber', 'database', 'project', 'requirements', 'software', 'statistics'])
    expect(pathReviewStatus(items, COURSE_CAPABILITIES)).toEqual({ complete: false, missing: COURSE_CAPABILITIES })
    const reviewAll = ids => items.map(i => ids.includes(i.id) ? { ...i, status: 'reviewed', reviewers: ['A', 'B'], reviewedAt: '2026-11-21' } : i)
    const all = ['capm', 'fcit-cpit-240', 'fcit-stat-110', 'fcit-cpit-250', 'fcit-cpit-251', 'fcit-cpit-425']
    expect(pathReviewStatus(reviewAll(all), COURSE_CAPABILITIES)).toEqual({ complete: true, missing: [] })
    expect(pathReviewStatus(reviewAll(all.filter(id => id !== 'capm')), COURSE_CAPABILITIES)).toEqual({ complete: false, missing: ['project'] })
    expect(pathReviewStatus(items, [])).toEqual({ complete: false, missing: [] })
  })
})

describe('Task 36: the Courses tab labels', () => {
  afterEach(() => { vi.doUnmock('../src/catalog/learning-opportunities.json'); vi.resetModules() })
  const render = async (lang, catalog) => {
    vi.resetModules()
    if (catalog) vi.doMock('../src/catalog/learning-opportunities.json', () => ({ default: catalog }))
    const { default: LearningPath } = await import('../src/components/LearningPath.jsx')
    return renderToStaticMarkup(createElement(LearningPath, { lang, skills: [], goal: 'cyber', takenCourses: [] }))
  }
  const reviewed = ids => ({ ...list, items: items.map(i => ids.includes(i.id) ? { ...i, status: 'reviewed', reviewers: ['Course coordinator', 'Faculty member'], reviewedAt: '2026-11-21' } : i) })

  it('today: "Planned feature", every suggestion an "Illustrative example", each with its source (the catalogue page)', async () => {
    for (const [lang, planned, illustrative] of [['en', 'Planned feature', 'Illustrative example'], ['ar', 'ميزة مخطط لها', 'مثال توضيحي']]) {
      const html = await render(lang)
      expect(html).toContain(`data-testid="path-planned">${planned}<`)
      expect(html).toContain('data-item="fcit-cpit-425"')
      expect(html).toContain(illustrative)
      expect(html).not.toContain('data-testid="path-reviewed"')
      expect(html).toContain('CPIT-425 · FCIT Catalog 2024-25, p. 62. Official FCIT Catalog 2024-25')
      for (const id of RETIRED) expect(html).not.toContain(`data-item="${id}"`)
    }
  })

  it('with no goal it opens on the first field the list has a step for; a field with a gap but no step says so in the summary', async () => {
    vi.resetModules()
    const { default: LearningPath } = await import('../src/components/LearningPath.jsx')
    const { demoCourses } = await import('../src/data.js')
    const { inferSkills } = await import('../src/utils/engine.js')
    const skills = inferSkills(demoCourses), takenCourses = demoCourses.map(c => c.code)
    // The synthetic example: Business Analyst (the first field) has a gap, but CPIT-250 and CPIT-251 are on the record.
    const html = renderToStaticMarkup(createElement(LearningPath, { lang: 'en', skills, goal: null, takenCourses }))
    expect(html).toMatch(/<option value="job-data-analyst" selected="">/)
    expect(html).toContain('data-testid="path-summary">1 suggested step for Data Analyst<')
    // A chosen goal still decides the field, even when the list has nothing for it yet.
    const ba = renderToStaticMarkup(createElement(LearningPath, { lang: 'en', skills, goal: 'management', takenCourses }))
    expect(ba).toMatch(/<option value="job-business-analyst" selected="">/)
    expect(ba).toContain('data-testid="path-summary">Nothing in the list yet for Business Analyst<')
    expect(renderToStaticMarkup(createElement(LearningPath, { lang: 'ar', skills, goal: 'management', takenCourses }))).toContain('لا شيء في القائمة بعد لمسار محلل أعمال')
  })

  it('a reviewed item shows "Reviewed by the department"; "Planned feature" stays while a course capability has no reviewed item', async () => {
    const html = await render('en', reviewed(['fcit-cpit-425']))
    expect(html).toContain('data-testid="path-reviewed">Reviewed by the department<')
    expect(html).toContain('data-testid="path-planned"')
    expect(await render('ar', reviewed(['fcit-cpit-425']))).toContain('data-testid="path-reviewed">راجعه القسم<')
  })

  it('once every course capability has a reviewed item, "Planned feature" goes and the intro says who checked the list', async () => {
    const all = reviewed(['capm', 'fcit-cpit-240', 'fcit-stat-110', 'fcit-cpit-250', 'fcit-cpit-251', 'fcit-cpit-425'])
    const html = await render('en', all)
    expect(html).not.toContain('data-testid="path-planned"')
    expect(html).toContain('two department reviewers checked')
    expect(html).toContain('Reviewed by the department')
    expect(await render('ar', all)).toContain('راجعها مراجعان من القسم')
  })
})

describe('Task 36: the review kit (scripts/path-review)', () => {
  it('the sheet: one row per item still shown, two reviewer columns and an agreement column', () => {
    const rows = sheetRows(list, '2026-11-18')
    const at = rows.findIndex(r => r[0] === 'id')
    expect(rows[0]).toEqual(['kit', KIT_VERSION])
    expect(rows.slice(0, at).map(r => r[0]).filter(Boolean)).toEqual(['kit', 'instructions', 'list_version', 'export_date', 'reviewer_a_role', 'reviewer_a_date', 'reviewer_b_role', 'reviewer_b_date'])
    expect(rows[at]).toEqual([...COLUMNS])
    expect(COLUMNS.slice(-5)).toEqual(['reviewer_a_decision', 'reviewer_a_note', 'reviewer_b_decision', 'reviewer_b_note', 'agreement'])
    const data = rows.slice(at + 1)
    expect(data.map(r => r[0])).toEqual(reviewableItems(list).map(i => i.id))
    expect(data.map(r => r[0])).toEqual(['capm', 'pmp', 'fcit-cpit-240', 'fcit-cpit-340', 'fcit-stat-110', 'fcit-cpit-250', 'fcit-cpit-251', 'fcit-cpit-425'])
    // The agreement cell is an Excel formula on the row's own two decision cells (N and P).
    expect(data[0].at(-1)).toBe(`=IF(OR(N${at + 2}="",P${at + 2}=""),"",IF(LOWER(N${at + 2})=LOWER(P${at + 2}),"agree","DISAGREE"))`)
    expect(parseCsv(toCsvText(rows))).toEqual(rows.map(r => (r.length ? r.map(String) : ['']))) // a blank line reads back as one empty cell
  })

  it('the untouched export is refused: four empty reviewer fields and two empty decisions per item', () => {
    const counts = {}
    for (const t of types(toCsvText(sheetRows(list, '2026-11-18')))) counts[t] = (counts[t] || 0) + 1
    expect(counts).toEqual({ 'missing-header': 4, 'empty-decision': 16 })
  })

  it('both approve → reviewed with the two roles and the later date; a disagreement stays illustrative; both retire → retired', () => {
    const text = filledSheet({ b: id => (id === 'pmp' ? 'reject' : id === 'fcit-cpit-340' ? 'retire' : 'approve'), a: id => (id === 'fcit-cpit-340' ? 'retire' : 'approve') })
    const { problems, results } = checkSheet(text)
    expect(problems).toEqual([])
    expect(results.find(r => r.id === 'pmp')).toEqual({ id: 'pmp', a: 'approve', b: 'reject', agreement: 'disagree', outcome: 'illustrative' })
    expect(results.find(r => r.id === 'fcit-cpit-340')).toMatchObject({ agreement: 'agree', outcome: 'retired' })
    const merged = applyReview(list, text)
    const by = id => merged.items.find(i => i.id === id)
    expect(by('fcit-cpit-425')).toMatchObject({ status: 'reviewed', reviewers: [ROLES.reviewer_a_role, ROLES.reviewer_b_role], reviewedAt: '2026-11-21' })
    expect(by('pmp')).toMatchObject({ status: 'illustrative', reviewers: null, reviewedAt: null })
    expect(by('fcit-cpit-340')).toMatchObject({ status: 'retired', retiredAt: '2026-11-21', reviewers: null })
    for (const id of RETIRED) expect(by(id)).toEqual(items.find(i => i.id === id)) // retired items are untouched
    for (const item of merged.items) expect(reviewProblems(item), item.id).toEqual([])
    expect(Object.keys(by('fcit-cpit-340')).indexOf('retiredAt')).toBe(Object.keys(by('fcit-cpit-340')).indexOf('status') + 1)
  })

  it('a sheet only one reviewer filled cannot make anything reviewed', () => {
    const text = filledSheet({ header: { ...ROLES, reviewer_b_role: '', reviewer_b_date: '' }, b: () => '' })
    expect(new Set(types(text))).toEqual(new Set(['missing-header', 'empty-decision']))
    expect(() => applyReview(list, text)).toThrow(/nothing was merged/)
  })

  it('names each problem: same role twice, bad date, bad decision, unknown, retired, duplicate or missing item, another list version, invented item approved', () => {
    expect(types(filledSheet({ header: { ...ROLES, reviewer_b_role: ROLES.reviewer_a_role.toUpperCase() } }))).toEqual(['same-reviewer'])
    expect(types(filledSheet({ header: { ...ROLES, reviewer_a_date: '20/11/2026' } }))).toEqual(['bad-date'])
    expect(types(filledSheet({ a: id => (id === 'capm' ? 'yes' : 'approve') }))).toEqual(['bad-decision'])
    expect(types(filledSheet({ drop: ['pmp'] }))).toEqual(['missing-item'])
    const text = filledSheet()
    const extra = (line) => text.replace(/\r\n$/, `\r\n${line}\r\n`)
    expect(types(extra('no-such-item,course,,,,,,,,,,,,approve,,approve,,'))).toEqual(['unknown-item'])
    expect(types(extra('sql,course,,,,,,,,,,,,approve,,approve,,'))).toEqual(['retired-item'])
    expect(types(extra('capm,course,,,,,,,,,,,,approve,,approve,,'))).toEqual(['duplicate-row'])
    expect(types(text.replace(list.version, 'kamin-learning-opportunities-v1-2026-11-11'))).toEqual(['wrong-list'])
    expect(types('id,something\r\n')).toContain('not-a-sheet')
    expect(types(text.replace('reviewer_b_decision', 'reviewer_b'))).toEqual(['missing-column'])
    expect(types(text.replace('إدارة', '�'))).toContain('not-utf8')
    // A list where an invented item was put back on show: approving it is refused.
    const shownInvented = { ...list, items: items.map(i => i.id === 'sql' ? { ...i, status: 'illustrative' } : i) }
    expect(checkSheet(filledSheet({}, shownInvented), shownInvented).problems.map(p => p.type)).toEqual(['invented-approved', 'invented-approved'])
    for (const type of Object.keys(PROBLEM_TYPES)) expect(PROBLEM_TYPES[type]).toMatch(/\w/)
  })

  it('command line: export, check (exit 1 untouched, 0 filled), --apply on a copy; the real list is never touched', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'kamin-path-review-'))
    try {
      const before = sha(LIST_FILE)
      const run = (...args) => spawnSync(process.execPath, args, { encoding: 'utf8' })
      const exported = run('scripts/path-review/export.mjs', '--date', '2026-11-18', '--out', dir)
      expect(exported.status, exported.stderr).toBe(0)
      expect(exported.stdout).toContain('8 items to review (6 retired, not in the sheet)')
      const sheet = path.join(dir, 'learning-path-review-2026-11-18.csv')
      expect(readFileSync(sheet, 'utf8').startsWith('﻿kit,kamin-path-review-v1\r\n')).toBe(true)
      const untouched = run('scripts/path-review/check.mjs', sheet)
      expect(untouched.status).toBe(1)
      expect(untouched.stdout).toContain('20 problem(s). Nothing was changed.')
      const filled = path.join(dir, 'filled.csv')
      writeFileSync(filled, filledSheet({ b: id => (id === 'pmp' ? 'reject' : 'approve') }))
      const ok = run('scripts/path-review/check.mjs', filled)
      expect(ok.status, ok.stdout).toBe(0)
      expect(ok.stdout).toContain('8 items: 7 reviewed, 1 stay illustrative, 0 retired; 1 disagreement(s).')
      expect(ok.stdout).toContain('pmp: A approve, B reject → DISAGREE, illustrative')
      const copy = path.join(dir, 'list.json')
      writeFileSync(copy, readFileSync(LIST_FILE))
      const applied = run('scripts/path-review/check.mjs', filled, '--apply', '--list', copy)
      expect(applied.status, applied.stderr).toBe(0)
      const merged = JSON.parse(readFileSync(copy, 'utf8'))
      expect(merged.items.filter(i => i.status === 'reviewed').map(i => i.id)).toEqual(['capm', 'fcit-cpit-240', 'fcit-cpit-340', 'fcit-stat-110', 'fcit-cpit-250', 'fcit-cpit-251', 'fcit-cpit-425'])
      expect(pathReviewStatus(merged.items, COURSE_CAPABILITIES).complete).toBe(true)
      expect(run('scripts/path-review/check.mjs', sheet, '--apply', '--list', copy).status).toBe(1) // problems: nothing merged
      expect(run('scripts/path-review/check.mjs').status).toBe(2)
      expect(run('scripts/path-review/check.mjs', path.join(dir, 'missing.csv')).status).toBe(2)
      expect(sha(LIST_FILE)).toBe(before)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('no network in the kit, and the npm scripts exist', () => {
    for (const file of ['lib.mjs', 'export.mjs', 'check.mjs']) expect(readFileSync(`scripts/path-review/${file}`, 'utf8'), file).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|https?:\/\//)
    expect(readFileSync('scripts/path-review/export.mjs', 'utf8')).not.toMatch(/learning-opportunities\.json'[^\n]*write/)
    const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts
    expect(scripts['path-review:export']).toBe('node scripts/path-review/export.mjs')
    expect(scripts['path-review:check']).toBe('node scripts/path-review/check.mjs')
    expect(scripts['catalog:course-fit']).toBe('node scripts/catalog/course-fit-cards.mjs')
    expect(readFileSync('.gitignore', 'utf8')).toMatch(/^\/review\/$/m) // a filled sheet stays out of git
  })
})

describe('Task 36: the full list is out of the startup bundle', () => {
  // Static imports reachable from the entry point form the initial bundle; import() does not.
  const staticImports = file => {
    const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    return [...code.matchAll(/^\s*(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1])
  }
  const initialGraph = () => {
    const seen = new Set(), queue = [path.resolve('src/main.jsx')]
    while (queue.length) {
      const file = queue.pop()
      if (seen.has(file)) continue
      seen.add(file)
      if (file.endsWith('.json')) continue
      for (const spec of staticImports(file)) {
        if (!spec.startsWith('.')) continue
        const raw = path.resolve(path.dirname(file), spec)
        const next = [raw, `${raw}.js`, `${raw}.jsx`].find(p => existsSync(p) && !p.endsWith('.css'))
        if (next) queue.push(next)
      }
    }
    return seen
  }

  it('the startup graph holds the five course-fit cards, not the learning list, the path code or the review rules', () => {
    const graph = initialGraph()
    expect(graph.has(path.resolve('src/App.jsx'))).toBe(true)
    expect(graph.has(path.resolve('src/data.js'))).toBe(true)
    expect(graph.has(path.resolve('src/catalog/course-fit-cards.json'))).toBe(true)
    for (const file of ['src/catalog/learning-opportunities.json', 'src/path/suggest.js', 'src/path/gap.js', 'src/path/review.js', 'src/path/nextSteps.js', 'src/components/LearningPath.jsx', 'src/components/CourseCards.jsx']) {
      expect(graph.has(path.resolve(file)), file).toBe(false)
    }
  })

  it('behaviour identical: the course-fit cards equal the view of the full list, field for field', () => {
    expect(JSON.parse(readFileSync('src/catalog/course-fit-cards.json', 'utf8'))).toEqual(courseFitView(list))
    expect(opportunities).toEqual(courseFitView(LEARNING_CATALOG).items)
    expect(opportunities.map(o => o.id)).toEqual(['ba', 'sql', 'capm', 'pmp', 'cyber-foundations'])
  })
})
