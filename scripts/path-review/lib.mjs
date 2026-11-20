// Task 36 · review kit for the learning-path list (src/catalog/learning-opportunities.json), in the
// shape of Task 31's department review kit: one sheet, two reviewer columns, an agreement column.
// Two reviewers (named by the supervisor) fill their own column independently; Amjd checks the sheet
// with check.mjs and, only when it has no problem, merges it with `--apply`. Items where the two
// reviewers disagree stay illustrative (rules in src/path/review.js). No network: everything is read
// from disk; the CSV helpers are Task 31's.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { skills } from '../../src/data.js'
import { REVIEW_DECISIONS, reviewOutcome, reviewProblems, isShown } from '../../src/path/review.js'
import { parseCsv, toCsvText, today, countByType } from '../review-kit/lib.mjs'

export { parseCsv, toCsvText, today, countByType }
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const LIST_FILE = path.join(ROOT, 'src/catalog/learning-opportunities.json')
export const REVIEW_DIR = path.join(ROOT, 'review')
export const KIT_VERSION = 'kamin-path-review-v1'
export const loadList = (file = LIST_FILE) => JSON.parse(readFileSync(file, 'utf8'))

export const ITEM_COLUMNS = Object.freeze([
  'id', 'kind', 'title_en', 'title_ar', 'provider', 'source_type', 'source_ref', 'source_note',
  'supports_en', 'supports_ar', 'requires_en', 'level', 'current_status',
])
export const REVIEWER_COLUMNS = Object.freeze(['reviewer_a_decision', 'reviewer_a_note', 'reviewer_b_decision', 'reviewer_b_note'])
export const AGREEMENT_COLUMN = 'agreement'
export const COLUMNS = Object.freeze([...ITEM_COLUMNS, ...REVIEWER_COLUMNS, AGREEMENT_COLUMN])
// Roles, never names: the list records "who checked it" as roles (Task 36).
export const REVIEWER_FIELDS = Object.freeze(['reviewer_a_role', 'reviewer_a_date', 'reviewer_b_role', 'reviewer_b_date'])
export const INSTRUCTIONS = 'Read docs/LEARNING_PATH.md ("Reviewing the list") first. Each reviewer fills only their own role, date (YYYY-MM-DD) and column: approve, reject or retire on every row. Write roles, not names. اقرأ الدليل أولًا؛ يملأ كل مراجع دوره وتاريخه وعموده فقط: approve أو reject أو retire في كل سطر. اكتب الدور لا الاسم.'

export const PROBLEM_TYPES = Object.freeze({
  'not-a-sheet': 'not a learning-path review sheet',
  'not-utf8': 'file is not UTF-8, so Arabic text was lost (in Excel: Save As → "CSV UTF-8")',
  'missing-header': 'reviewer field missing in the header',
  'bad-date': 'review date is not YYYY-MM-DD',
  'same-reviewer': 'the two reviewer roles are the same: two different reviewers are needed',
  'wrong-list': 'sheet made from another version of the list',
  'missing-column': 'column missing',
  'unknown-item': 'unknown item id',
  'retired-item': 'retired item (it is never shown; it is not reviewed)',
  'duplicate-row': 'row appears twice',
  'missing-item': 'item missing from the sheet',
  'empty-decision': 'empty decision',
  'bad-decision': 'decision outside approve / reject / retire',
  'invented-approved': 'an item with an invented source cannot be approved',
})

const labels = (ids, lang) => (ids || []).map(id => skills[id]?.labels?.[lang] || (id === 'cyber' ? (lang === 'ar' ? 'الأمن السيبراني' : 'Cybersecurity') : id)).join(lang === 'ar' ? '، ' : '; ')

// Excel column letter of a 0-based index (A … Z, AA …).
const letter = index => { let n = index + 1, s = ''; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) } return s }

// The items a review covers: everything still shown (retired items stay retired).
export const reviewableItems = list => list.items.filter(isShown)

export function sheetDataRows(list, firstRow) {
  const a = letter(COLUMNS.indexOf('reviewer_a_decision')), b = letter(COLUMNS.indexOf('reviewer_b_decision'))
  return reviewableItems(list).map((item, i) => {
    const r = firstRow + i
    // Shown in Excel only; check.mjs ignores this cell and works agreement out itself.
    const agreement = `=IF(OR(${a}${r}="",${b}${r}=""),"",IF(LOWER(${a}${r})=LOWER(${b}${r}),"agree","DISAGREE"))`
    return [
      item.id, item.kind, item.title.en, item.title.ar, item.provider, item.source?.type || '', item.source?.ref || '', item.sourceNote,
      labels(item.supports || item.teaches, 'en'), labels(item.supports || item.teaches, 'ar'), labels(item.requires, 'en'), item.level, item.status,
      '', '', '', '', agreement,
    ]
  })
}

export function sheetRows(list, date) {
  const head = [
    ['kit', KIT_VERSION],
    ['instructions', INSTRUCTIONS],
    ['list_version', list.version],
    ['export_date', date],
    ...REVIEWER_FIELDS.map(field => [field, '']),
    [],
    [...COLUMNS],
  ]
  return [...head, ...sheetDataRows(list, head.length + 1)]
}

export const sheetFileName = date => `learning-path-review-${date}.csv`

const isBlank = row => row.every(cell => String(cell).trim() === '')
const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Checks a returned sheet against the list. Changes nothing. Returns every problem
 * ({ type, where, message }), the header, and the merge result per item:
 * { id, a, b, agreement: 'agree' | 'disagree', outcome: 'reviewed' | 'retired' | 'illustrative' }.
 */
export function checkSheet(text, list = loadList()) {
  const problems = []
  const add = (type, where, detail = '') => problems.push({ type, where, message: `${where}: ${PROBLEM_TYPES[type]}${detail ? ` (${detail})` : ''}` })
  if (String(text).includes('�')) add('not-utf8', 'file')
  const rows = parseCsv(text)
  const headerAt = rows.findIndex(row => String(row[0] ?? '').trim() === 'id')
  if (headerAt < 0) {
    add('not-a-sheet', 'sheet', 'no table header row starting with "id"; export a fresh sheet with npm run path-review:export')
    return { problems, header: {}, results: [] }
  }
  const header = {}
  for (const row of rows.slice(0, headerAt)) {
    const key = String(row[0] ?? '').trim()
    if (key) header[key] = String(row[1] ?? '').trim()
  }
  if (header.kit !== KIT_VERSION) add('not-a-sheet', 'header', `kit "${header.kit || ''}"`)
  for (const field of REVIEWER_FIELDS) if (!header[field]) add('missing-header', 'header', `${field} is empty or missing`)
  for (const field of ['reviewer_a_date', 'reviewer_b_date']) if (header[field] && !DATE.test(header[field])) add('bad-date', 'header', `${field} "${header[field]}"`)
  if (header.reviewer_a_role && header.reviewer_a_role.toLowerCase() === (header.reviewer_b_role || '').toLowerCase()) add('same-reviewer', 'header')
  if (header.list_version !== list.version) add('wrong-list', 'header', `sheet: ${header.list_version || '?'}; repository: ${list.version}`)

  const columns = rows[headerAt].map(cell => String(cell).trim())
  const missingColumns = [...ITEM_COLUMNS.slice(0, 1), ...REVIEWER_COLUMNS].filter(col => !columns.includes(col))
  for (const col of missingColumns) add('missing-column', 'table', col)
  if (missingColumns.length) return { problems, header, results: [] }

  const byId = new Map(list.items.map(item => [item.id, item]))
  const seen = new Set(), results = []
  rows.forEach((cells, index) => {
    if (index <= headerAt || isBlank(cells)) return
    const get = col => String(cells[columns.indexOf(col)] ?? '').trim()
    const id = get('id'), where = `line ${index + 1} (${id || 'no id'})`
    const item = byId.get(id)
    if (!item) { add('unknown-item', where); return }
    if (!isShown(item)) { add('retired-item', where); return }
    if (seen.has(id)) { add('duplicate-row', where); return }
    seen.add(id)
    const decisions = {}
    for (const who of ['a', 'b']) {
      const value = get(`reviewer_${who}_decision`), at = `${where}, reviewer ${who.toUpperCase()}`
      if (!value) add('empty-decision', at)
      else if (!REVIEW_DECISIONS.includes(value.toLowerCase())) add('bad-decision', at, `"${value}"`)
      else if (value.toLowerCase() === 'approve' && item.source?.type === 'invented') add('invented-approved', at)
      decisions[who] = value.toLowerCase()
    }
    const agreement = decisions.a && decisions.a === decisions.b ? 'agree' : 'disagree'
    results.push({ id, a: decisions.a, b: decisions.b, agreement, outcome: reviewOutcome(decisions.a, decisions.b) })
  })
  for (const item of reviewableItems(list)) if (!seen.has(item.id)) add('missing-item', item.id)
  return { problems, header, results }
}

/**
 * The list after a checked sheet is merged: reviewed items get the two roles and the later review date;
 * retired items get the date; every other item stays (or goes back to) illustrative. Refuses a sheet with
 * problems, and refuses to produce an item that breaks a review rule.
 */
export function applyReview(list, text) {
  const { problems, header, results } = checkSheet(text, list)
  if (problems.length) throw new Error(`The sheet has ${problems.length} problem(s); nothing was merged. Run the check first.`)
  const date = [header.reviewer_a_date, header.reviewer_b_date].sort().at(-1)
  const outcome = new Map(results.map(r => [r.id, r.outcome]))
  const items = list.items.map(item => {
    if (!outcome.has(item.id)) return item
    const next = { ...item }
    const result = outcome.get(item.id)
    next.status = result
    next.reviewers = result === 'reviewed' ? [header.reviewer_a_role, header.reviewer_b_role] : null
    next.reviewedAt = result === 'reviewed' ? date : null
    if (result === 'retired') next.retiredAt = date
    else delete next.retiredAt
    // Keep the key order of the file (retiredAt right after status).
    const ordered = {}
    for (const [k, v] of Object.entries(next)) { if (k === 'retiredAt') continue; ordered[k] = v; if (k === 'status' && next.retiredAt) ordered.retiredAt = next.retiredAt }
    const broken = reviewProblems(ordered)
    if (broken.length) throw new Error(`${item.id}: ${broken.join(', ')}; nothing was merged.`)
    return ordered
  })
  return { ...list, items }
}

export const outcomeCounts = results => results.reduce((acc, r) => ({ ...acc, [r.outcome]: (acc[r.outcome] || 0) + 1 }), {})
