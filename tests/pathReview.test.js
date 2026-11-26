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
import { LEARNING_PATH_COPY } from '../src/content/learningPathCopy.js'
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

// Task 70: the old Courses tab (src/components/LearningPath.jsx) is deleted. Its four Task 36 label tests now run on
// step 4, which shows the same list (src/ui2/components/StepCard.jsx: the card and its Details; src/ui2/stepsEngine.js:
// whether the list is reviewed). Step 4 says "an early version of a feature planned for the next phase" (intro) in each
// card's Details instead of a separate "Planned feature" badge, and the reviewers' sentence (introReviewed) once every
// course capability has a reviewed item; each illustrative card carries "Illustrative example".
describe('Task 36: the step 4 labels (the old Courses tab until Task 70)', () => {
  afterEach(() => { vi.doUnmock('../src/catalog/learning-opportunities.json'); vi.resetModules() })
  const noop = () => {}
  const ALL_GOALS = targetProfiles.map(t => t.id)
  // Every card of the feed for every pathway, with its Details, as step 4 renders them.
  const renderStep4 = async (lang, catalog) => {
    vi.resetModules()
    if (catalog) vi.doMock('../src/catalog/learning-opportunities.json', () => ({ default: catalog }))
    const engine = await import('../src/ui2/stepsEngine.js')
    const { default: StepCard, StepDetails } = await import('../src/ui2/components/StepCard.jsx')
    const feed = engine.nextStepFeed({ skills: [], goalIds: ALL_GOALS })
    const html = feed.cards.map(card => {
      const item = engine.catalogItem(card.itemId)
      return renderToStaticMarkup(createElement(StepCard, { lang, card, item, goals: [], onTake: noop, onHide: noop, onDetails: noop }))
        + renderToStaticMarkup(createElement(StepDetails, { lang, card, item, reviewed: engine.LIST_REVIEWED }))
    }).join('\n')
    return { html, feed, reviewed: engine.LIST_REVIEWED }
  }
  const reviewed = ids => ({ ...list, items: items.map(i => ids.includes(i.id) ? { ...i, status: 'reviewed', reviewers: ['Course coordinator', 'Faculty member'], reviewedAt: '2026-11-21' } : i) })

  it('today: "planned feature" in every card\'s Details, "Illustrative example" on every illustrative card, each with its source', async () => {
    for (const lang of ['en', 'ar']) {
      const T = LEARNING_PATH_COPY[lang]
      const { html, feed, reviewed: isReviewed } = await renderStep4(lang)
      expect(isReviewed).toBe(false)
      expect(feed.cards.length).toBeGreaterThan(3)
      expect(html.split('data-testid="ui2-step-list-note"').length - 1).toBe(feed.cards.length)
      expect(html).toContain(`data-testid="ui2-step-list-note">${T.intro}<`)
      expect(html).not.toContain(T.introReviewed)
      expect(html).toContain('data-item="fcit-cpit-425"')
      expect(html).toContain('FCIT Catalog 2024-25, p. 62')
      const illustrative = feed.cards.filter(card => card.illustrative)
      expect(illustrative.length).toBeGreaterThan(0)
      expect(html.split('data-testid="ui2-step-illustrative"').length - 1).toBe(illustrative.length)
      expect(html).toContain(T.illustrative)
      for (const id of RETIRED) expect(html).not.toContain(`data-item="${id}"`)
    }
  })

  it('with no goal the feed waits for one; a goal with a gap but no step says what the list does not close yet', async () => {
    const { demoCourses } = await import('../src/data.js')
    const { inferSkills } = await import('../src/utils/engine.js')
    const skills = inferSkills(demoCourses), takenCourses = demoCourses.map(c => c.code)
    const none = nextStepFeed({ skills, goalIds: [], takenCourses })
    expect(none.cards).toEqual([])
    expect(none.reason.en).toBe('Choose a goal first.')
    // The synthetic example: Data Analyst has one step; Business Analyst has a gap, but CPIT-250 and CPIT-251 are on the record.
    expect(nextStepFeed({ skills, goalIds: ['job-data-analyst'], takenCourses }).cards.map(c => c.itemId)).toEqual(['fcit-cpit-340'])
    const ba = nextStepFeed({ skills, goalIds: ['job-business-analyst'], takenCourses })
    expect(ba.cards).toEqual([])
    expect(ba.uncovered).toEqual([{ goalId: 'job-business-analyst', capabilities: ['requirements'] }])
    // Task 79: with no card at all, the empty state itself names what the list does not close yet ("list-empty"), so
    // the line under the feed is shown only when there are cards (it would repeat the empty state otherwise).
    expect(readFileSync('src/ui2/screens/NextSteps.jsx', 'utf8')).toMatch(/feed\.uncovered\.length > 0 && empty !== 'list-empty' && <p className="ui2-feed-uncovered" data-testid="ui2-feed-uncovered">/)
  })

  it('a reviewed item alone does not change the label: "planned feature" stays while a course capability has no reviewed item', async () => {
    for (const lang of ['en', 'ar']) {
      const T = LEARNING_PATH_COPY[lang]
      const { html, reviewed: isReviewed } = await renderStep4(lang, reviewed(['fcit-cpit-425']))
      expect(isReviewed).toBe(false)
      expect(html).toContain(T.intro)
      expect(html).not.toContain(T.introReviewed)
    }
  })

  it('once every course capability has a reviewed item, "planned feature" goes and the Details say who checked the list', async () => {
    const all = reviewed(['capm', 'fcit-cpit-240', 'fcit-stat-110', 'fcit-cpit-250', 'fcit-cpit-251', 'fcit-cpit-425'])
    const { html, reviewed: isReviewed } = await renderStep4('en', all)
    expect(isReviewed).toBe(true)
    expect(html).not.toContain(LEARNING_PATH_COPY.en.intro)
    expect(html).toContain('two department reviewers checked')
    expect((await renderStep4('ar', all)).html).toContain(LEARNING_PATH_COPY.ar.introReviewed)
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
  const initialGraph = (entry = 'src/main.jsx') => {
    const seen = new Set(), queue = [path.resolve(entry)]
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

  // Task 70: the startup graph is src/main.jsx and its static imports (the old src/App.jsx is deleted). The interface's
  // first chunk (src/ui2/AppNext.jsx and its static imports) holds the app data with the five course-fit cards; the full
  // list and the path code load only on demand, in both. Task 76: startup carried the app data and the cards too, through
  // the snapshot reader; it now holds only the link's fragment reader (src/utils/snapshotLink.js), so it carries neither.
  const LAZY_ONLY = ['src/catalog/learning-opportunities.json', 'src/path/suggest.js', 'src/path/gap.js', 'src/path/review.js', 'src/path/nextSteps.js', 'src/ui2/stepsEngine.js']
  it('the interface\'s first chunk holds the five course-fit cards (startup holds none), not the learning list, the path code or the review rules', () => {
    const startup = initialGraph()
    expect(startup.has(path.resolve('src/themeChoice.js'))).toBe(true)
    expect(startup.has(path.resolve('src/utils/snapshotLink.js'))).toBe(true)
    expect(startup.has(path.resolve('src/data.js'))).toBe(false)
    expect(startup.has(path.resolve('src/catalog/course-fit-cards.json'))).toBe(false)
    for (const file of LAZY_ONLY) expect(startup.has(path.resolve(file)), `startup: ${file}`).toBe(false)
    const first = initialGraph('src/ui2/AppNext.jsx')
    expect(first.has(path.resolve('src/data.js'))).toBe(true)
    expect(first.has(path.resolve('src/catalog/course-fit-cards.json'))).toBe(true)
    for (const file of LAZY_ONLY) expect(first.has(path.resolve(file)), `first chunk: ${file}`).toBe(false)
  })


  it('behaviour identical: the course-fit cards equal the view of the full list, field for field', () => {
    expect(JSON.parse(readFileSync('src/catalog/course-fit-cards.json', 'utf8'))).toEqual(courseFitView(list))
    expect(opportunities).toEqual(courseFitView(LEARNING_CATALOG).items)
    expect(opportunities.map(o => o.id)).toEqual(['ba', 'sql', 'capm', 'pmp', 'cyber-foundations'])
  })
})
