// Task 07 · evaluation harness for "project description → capability suggestion".
// Pure helpers shared by eval.mjs and tests/evalHarness.test.js. Node-only, for measurement;
// nothing in the product imports this folder. No network access of any kind.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { skills } from '../../src/data.js'

export const HARNESS_VERSION = 'kamin-eval-project-suggest-v1'
export const CAPABILITY_IDS = Object.keys(skills)
export const LANGS = ['ar', 'en']

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const fileSha256 = file => sha256(readFileSync(file))
export const lockPathFor = file => path.join(path.dirname(file), `${path.basename(file, '.json')}.lock.json`)
export const readLock = file => existsSync(lockPathFor(file)) ? JSON.parse(readFileSync(lockPathFor(file), 'utf8')) : null
export const loadSet = file => {
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  return { meta: Array.isArray(raw) ? {} : raw, cases: Array.isArray(raw) ? raw : raw.cases || [] }
}

// Rule: a frozen set can never be used for tuning.
export function assertNotFrozen(file) {
  if (readLock(file)) throw new Error(`REFUSED: ${path.basename(file)} is frozen (${path.basename(lockPathFor(file))}); tune on the development set only.`)
}
// Rule: a frozen set must not have changed since it was frozen.
export function assertLockMatches(file) {
  const lock = readLock(file)
  if (!lock) return null
  const actual = fileSha256(file)
  if (actual !== lock.sha256) throw new Error(`REFUSED: ${path.basename(file)} changed after it was frozen (expected sha256 ${lock.sha256}, found ${actual}).`)
  return lock
}

// Rule: a suggestion is supported only if its supporting text appears verbatim in the
// description. Comparison ignores only whitespace runs and Arabic orthographic variants that do
// not change a word (diacritics, tatweel, hamza forms of alef, final ya/alef maqsura) — the same
// normalisation the engine applies before quoting. Any other difference is an error.
export const orthographic = text => String(text ?? '').replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي')
const squash = text => orthographic(text).replace(/\s+/g, ' ').trim()
export function isSupported(description, support) {
  const quote = squash(support)
  return quote.length >= 3 && squash(description).includes(quote)
}

const ratio = (a, b) => b ? a / b : null
const emptyBucket = () => ({ cases: 0, tp: 0, fp: 0, fn: 0, unsupported: 0, abstained: 0, correctAbstentions: 0, wrongAbstentions: 0, falseAlarmCases: 0, shouldAbstainCases: 0 })

/**
 * Score predictions against expected labels.
 * @param {Array<{id,lang,text,expected:string[]}>} cases
 * @param {Map<string,{suggestions:Array<{skillId,support}>}>} predictions keyed by case id
 */
export function score(cases, predictions) {
  const buckets = { ar: emptyBucket(), en: emptyBucket(), all: emptyBucket() }
  const rows = []
  for (const item of cases) {
    const prediction = predictions.get(item.id) || { suggestions: [] }
    const expected = new Set(item.expected || [])
    const seen = new Set()
    let tp = 0, fp = 0, unsupported = 0
    const details = []
    for (const s of prediction.suggestions || []) {
      if (seen.has(s.skillId)) continue
      seen.add(s.skillId)
      const supported = isSupported(item.text, s.support)
      if (!supported) unsupported++
      if (supported && expected.has(s.skillId)) tp++
      else fp++
      details.push({ skillId: s.skillId, supported, correct: supported && expected.has(s.skillId) })
    }
    const fn = [...expected].filter(id => !details.some(d => d.correct && d.skillId === id)).length
    const abstained = seen.size === 0
    const row = { id: item.id, lang: item.lang, expected: [...expected], predicted: details, tp, fp, fn, unsupported, abstained,
      correctAbstention: abstained && expected.size === 0, wrongAbstention: abstained && expected.size > 0, falseAlarm: !abstained && expected.size === 0 }
    rows.push(row)
    for (const bucket of [buckets[item.lang], buckets.all]) {
      if (!bucket) continue
      bucket.cases++; bucket.tp += tp; bucket.fp += fp; bucket.fn += fn; bucket.unsupported += unsupported
      if (abstained) bucket.abstained++
      if (row.correctAbstention) bucket.correctAbstentions++
      if (row.wrongAbstention) bucket.wrongAbstentions++
      if (row.falseAlarm) bucket.falseAlarmCases++
      if (expected.size === 0) bucket.shouldAbstainCases++
    }
  }
  const summarise = b => {
    const precision = ratio(b.tp, b.tp + b.fp), recall = ratio(b.tp, b.tp + b.fn)
    return { ...b, precision, recall, f1: precision != null && recall != null && precision + recall ? 2 * precision * recall / (precision + recall) : null }
  }
  return { metrics: { ar: summarise(buckets.ar), en: summarise(buckets.en), all: summarise(buckets.all) }, rows }
}

const csvCell = value => { const text = Array.isArray(value) ? value.join(' ') : String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text }
export function toCsv(rows) {
  const header = ['id', 'lang', 'expected', 'predicted', 'unsupported_ids', 'tp', 'fp', 'fn', 'unsupported', 'abstained', 'correct_abstention', 'wrong_abstention', 'false_alarm']
  const lines = rows.map(r => [r.id, r.lang, r.expected, r.predicted.map(p => p.skillId), r.predicted.filter(p => !p.supported).map(p => p.skillId), r.tp, r.fp, r.fn, r.unsupported, r.abstained, r.correctAbstention, r.wrongAbstention, r.falseAlarm].map(csvCell).join(','))
  return [header.join(','), ...lines].join('\n') + '\n'
}

const pct = v => v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`
export function toMarkdown(result) {
  const { meta, metrics } = result
  const row = (name, m) => `| ${name} | ${m.cases} | ${pct(m.precision)} | ${pct(m.recall)} | ${pct(m.f1)} | ${m.tp} | ${m.fp} | ${m.fn} | ${m.unsupported} | ${m.correctAbstentions}/${m.shouldAbstainCases} | ${m.wrongAbstentions} | ${m.falseAlarmCases} |`
  return [
    `# Evaluation — ${meta.method} on ${meta.set}`,
    '',
    `- Harness: \`${meta.harness}\` · method version: \`${meta.methodVersion}\``,
    `- Commit: \`${meta.commit}\``,
    `- Set: \`${meta.set}\` · sha256 \`${meta.setSha256}\` · ${meta.frozen ? `frozen ${meta.frozenAt}` : '**not frozen**'}`,
    `- Threshold: ${meta.threshold == null ? 'n/a (rule-based)' : `${meta.threshold} (tuned on \`${meta.tunedOn}\`, sha256 \`${meta.tunedOnSha256}\`)`}`,
    `- Date: ${meta.date}`,
    '',
    '| Language | Cases | Precision | Recall | F1 | TP | FP | FN | Unsupported | Correct abstentions | Wrong abstentions | False-alarm cases |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    row('Arabic', metrics.ar), row('English', metrics.en), row('All', metrics.all),
    '',
    'An unsupported suggestion (supporting text not verbatim in the description) is counted as a false positive.',
    'Correct abstentions are reported separately and never add to precision or recall.',
    '',
  ].join('\n')
}

// ---- test-set checks -------------------------------------------------------------------------
const knownId = id => CAPABILITY_IDS.includes(id)
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x))

// v1 structure: [{id, lang, text, expected[]}] (or {cases:[...]}).
export function checkSet(cases) {
  const errors = [], ids = new Set(), texts = new Set()
  for (const [i, c] of cases.entries()) {
    const where = c?.id || `#${i}`
    if (!c?.id || ids.has(c.id)) errors.push(`${where}: missing or duplicate id`)
    ids.add(c?.id)
    if (!LANGS.includes(c?.lang)) errors.push(`${where}: lang must be ar or en`)
    if (typeof c?.text !== 'string' || c.text.trim().length < 3) errors.push(`${where}: text missing`)
    else if (texts.has(c.text.trim())) errors.push(`${where}: duplicate text`)
    else texts.add(c.text.trim())
    if (!Array.isArray(c?.expected)) errors.push(`${where}: expected must be an array`)
    else for (const id of c.expected) if (!knownId(id)) errors.push(`${where}: unknown capability "${id}"`)
  }
  return { errors, counts: Object.fromEntries(LANGS.map(l => [l, cases.filter(c => c?.lang === l).length])) }
}

// Inter-rater agreement on the binary decision (case × capability) between reviewers A and B.
export function agreement(cases) {
  let both = 0, onlyA = 0, onlyB = 0, neither = 0, exactCases = 0
  for (const c of cases) {
    const a = c.labels?.reviewerA || [], b = c.labels?.reviewerB || []
    if (sameSet(a, b)) exactCases++
    for (const id of CAPABILITY_IDS) {
      const x = a.includes(id), y = b.includes(id)
      if (x && y) both++; else if (x) onlyA++; else if (y) onlyB++; else neither++
    }
  }
  const n = both + onlyA + onlyB + neither
  const observed = n ? (both + neither) / n : null
  const expectedAgreement = n ? (((both + onlyA) / n) * ((both + onlyB) / n)) + (((neither + onlyB) / n) * ((neither + onlyA) / n)) : null
  const kappa = n && expectedAgreement !== 1 ? (observed - expectedAgreement) / (1 - expectedAgreement) : null
  return { decisions: n, observed, kappa, exactCaseAgreement: cases.length ? exactCases / cases.length : null }
}

// Task 38: the categories of the Task 38 kit (direct, synonym, tech-name, multi, should-abstain,
// dialect); "mixed" is kept so a file written with the Task 07 list still loads.
// minPositivesPerCapability: every capability needs at least 3 POSITIVE cases: cases whose final agreed
// gold labels (labels.agreed = expected) include it, both languages together. A mention in the text, a
// label from one reviewer only, an unresolved disagreement or a writer's target does not count.
// Project owner's decision (2026-11-16), approved by the supervisor (reported 2026-11-17); docs/EVALUATION_PROTOCOL.md §4.
export const V2_RULES = Object.freeze({ minPerLanguage: 20, minSynonymPerLanguage: 2, minDialectArabic: 2, minShouldAbstainPerLanguage: 2, minPositivesPerCapability: 3, categories: ['direct', 'synonym', 'tech-name', 'multi', 'should-abstain', 'dialect', 'mixed'] })

// ---- Task 38 · mechanical text checks ----------------------------------------------------------
const ARABIC_LETTER = /[ء-يٱ-ۓۺ-ۿ]/gu
const LATIN_LETTER = /[A-Za-z]/g
// Share of letters that are Arabic (digits, punctuation and spaces are ignored).
export function arabicShare(text) {
  const arabic = (String(text).match(ARABIC_LETTER) || []).length, latin = (String(text).match(LATIN_LETTER) || []).length
  return arabic + latin ? arabic / (arabic + latin) : null
}
// A case is in the wrong language when most of its letters are in the other script. Arabic cases may
// name tools in Latin letters (SQL, Figma) and still be Arabic; an English case is mostly Latin.
export function languageProblem(c) {
  const share = arabicShare(c?.text)
  if (share == null) return null
  if (c.lang === 'ar' && share < 0.5) return `marked Arabic but ${Math.round((1 - share) * 100)}% of its letters are Latin`
  if (c.lang === 'en' && share > 0.2) return `marked English but ${Math.round(share * 100)}% of its letters are Arabic`
  return null
}
// Text compared after orthographic normalisation, lower case, punctuation removed.
export const normaliseText = text => orthographic(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
const tokens = text => new Set(normaliseText(text).split(' ').filter(Boolean))
const trigrams = text => { const t = ` ${normaliseText(text)} `, out = new Set(); for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3)); return out }
const jaccard = (a, b) => { let both = 0; for (const x of a) if (b.has(x)) both++; const union = a.size + b.size - both; return union ? both / union : 0 }
export const NEAR_DUPLICATE = Object.freeze({ words: 0.7, trigrams: 0.8, minWords: 4 })
// The closest text of the other sets: exact after normalisation, near (word or character-trigram
// overlap above NEAR_DUPLICATE), or nothing. `others`: [{ set: 'dev-set.json', id, text }].
export function closestText(text, others) {
  const norm = normaliseText(text), words = tokens(text), grams = trigrams(text)
  let best = null
  for (const o of others) {
    if (normaliseText(o.text) === norm) return { kind: 'exact', ...o, words: 1, trigrams: 1 }
    const w = jaccard(words, tokens(o.text)), g = jaccard(grams, trigrams(o.text))
    if (words.size >= NEAR_DUPLICATE.minWords && (w >= NEAR_DUPLICATE.words || g >= NEAR_DUPLICATE.trigrams) && (!best || Math.max(w, g) > Math.max(best.words, best.trigrams))) best = { kind: 'near', ...o, words: w, trigrams: g }
  }
  return best
}

// Positive cases per capability, per language: cases whose final agreed labels (`labels.agreed`; `expected`
// for a set without labels) include it. Each case counts once per capability.
export function capabilityCoverage(cases) {
  const out = Object.fromEntries(CAPABILITY_IDS.map(id => [id, { ar: 0, en: 0, total: 0 }]))
  for (const c of cases) for (const id of new Set(c?.labels?.agreed || c?.expected || [])) if (out[id]) { out[id][c.lang] = (out[id][c.lang] || 0) + 1; out[id].total++ }
  return out
}

// v2: human-written texts, two reviewers, agreed labels, agreement recorded, separated from dev.
// `otherTexts`: strings, or { set, id, text } objects (dev, v1 and ai-v2 sets) for the copy check.
export function checkSetV2(set, { otherTexts = [] } = {}) {
  const { meta, cases } = set
  const base = checkSet(cases)
  const errors = [...base.errors], warnings = []
  if (meta.writtenBy !== 'human') errors.push('set: writtenBy must be "human"')
  if (!meta.reviewers?.A || !meta.reviewers?.B || meta.reviewers.A === meta.reviewers.B) errors.push('set: two different reviewers (reviewers.A, reviewers.B) are required')
  const others = otherTexts.map(o => typeof o === 'string' ? { set: 'other set', text: o } : o)
  for (const c of cases) {
    const where = c?.id || '?'
    const wrongLanguage = languageProblem(c)
    if (wrongLanguage) errors.push(`${where}: ${wrongLanguage}`)
    const close = typeof c?.text === 'string' ? closestText(c.text, others) : null
    if (close?.kind === 'exact') errors.push(`${where}: text also appears in the development or v1 set or the ai-v2 set (${close.set}${close.id ? ` ${close.id}` : ''})`)
    else if (close) warnings.push(`${where}: close to ${close.set}${close.id ? ` ${close.id}` : ''} (word overlap ${close.words.toFixed(2)}, character overlap ${close.trigrams.toFixed(2)}); make sure it was not copied`)
    const l = c?.labels || {}
    if (c?.category === 'should-abstain' && !l.adjudication && [l.reviewerA, l.reviewerB].some(x => Array.isArray(x) && x.length)) warnings.push(`${where}: a should-abstain case was given a capability by a reviewer; agree on it or change the category`)
    if (c?.category && c.category !== 'should-abstain' && Array.isArray(c?.expected) && !c.expected.length && (sameSet(l.reviewerA || [], l.reviewerB || []) || l.adjudication)) warnings.push(`${where}: category "${c.category}" but the agreed labels are empty; if nothing should be suggested, use should-abstain`)
  }
  const coverage = capabilityCoverage(cases)
  for (const [id, n] of Object.entries(coverage)) {
    if (n.total < V2_RULES.minPositivesPerCapability) errors.push(`set: capability "${id}" has ${n.total} positive case(s), needs at least ${V2_RULES.minPositivesPerCapability} (both languages together)`)
    else for (const lang of LANGS) if (!n[lang]) warnings.push(`set: capability "${id}" has no ${lang === 'ar' ? 'Arabic' : 'English'} positive case (aim for at least 1 per language)`)
  }
  for (const c of cases) {
    const where = c?.id || '?'
    if (c?.writtenBy !== 'human') errors.push(`${where}: writtenBy must be "human"`)
    if (!c?.author) errors.push(`${where}: author is required`)
    if (!V2_RULES.categories.includes(c?.category)) errors.push(`${where}: category must be one of ${V2_RULES.categories.join(', ')}`)
    const l = c?.labels || {}
    for (const key of ['reviewerA', 'reviewerB', 'agreed']) {
      if (!Array.isArray(l[key])) errors.push(`${where}: labels.${key} must be an array`)
      else for (const id of l[key]) if (!knownId(id)) errors.push(`${where}: labels.${key} has unknown capability "${id}"`)
    }
    if (Array.isArray(l.agreed) && Array.isArray(c?.expected) && !sameSet(l.agreed, c.expected)) errors.push(`${where}: expected must equal labels.agreed`)
    if (Array.isArray(l.reviewerA) && Array.isArray(l.reviewerB) && !sameSet(l.reviewerA, l.reviewerB) && !l.adjudication) errors.push(`${where}: reviewers disagree; record labels.adjudication`)
    if (c?.category === 'should-abstain' && c?.expected?.length) errors.push(`${where}: a should-abstain case must have expected []`)
    if (c?.category === 'dialect' && c?.lang !== 'ar') errors.push(`${where}: dialect cases are Arabic`)
  }
  const count = (lang, category) => cases.filter(c => c?.lang === lang && (!category || c.category === category)).length
  for (const lang of LANGS) {
    if (count(lang) < V2_RULES.minPerLanguage) errors.push(`set: ${lang} has ${count(lang)} cases, needs at least ${V2_RULES.minPerLanguage}`)
    if (count(lang, 'synonym') < V2_RULES.minSynonymPerLanguage) errors.push(`set: ${lang} needs at least ${V2_RULES.minSynonymPerLanguage} synonym cases`)
    if (count(lang, 'should-abstain') < V2_RULES.minShouldAbstainPerLanguage) errors.push(`set: ${lang} needs at least ${V2_RULES.minShouldAbstainPerLanguage} should-abstain cases`)
  }
  if (count('ar', 'dialect') < V2_RULES.minDialectArabic) errors.push(`set: needs at least ${V2_RULES.minDialectArabic} Arabic dialect cases`)
  const computed = agreement(cases)
  const recorded = meta.agreement
  if (!recorded) errors.push('set: agreement must be recorded (run check, copy the computed values into "agreement")')
  else if (cases.length && (Math.abs((recorded.kappa ?? -9) - (computed.kappa ?? -9)) > 0.001 || Math.abs((recorded.observed ?? -9) - (computed.observed ?? -9)) > 0.001)) errors.push(`set: recorded agreement (kappa ${recorded.kappa}) does not match the labels (kappa ${computed.kappa?.toFixed(3)})`)
  return { errors, warnings, counts: base.counts, agreement: computed, coverage }
}

// ---- Task 38 · the v2 kit: spreadsheets in, testset-v2 JSON out ----------------------------------
export const KIT_VERSION = 'kamin-v2-kit-v1'
export const CASE_COLUMNS = Object.freeze(['id', 'lang', 'category', 'text', 'writer_role', 'author', 'target'])
// Labels sheet: id, the case text (read-only, for the reviewer), one column per capability, note.
// A capability column header is "<id> (<Arabic label> / <English label>)"; only the id is read.
export const capabilityHeader = id => `${id} (${skills[id].labels.ar} / ${skills[id].labels.en})`
export const LABEL_COLUMNS = Object.freeze(['id', 'text', ...CAPABILITY_IDS.map(capabilityHeader), 'note'])
const headerId = cell => String(cell).trim().split(/\s+/)[0]

// RFC 4180 CSV: quotes, doubled quotes, commas and line breaks inside quotes; a UTF-8 BOM is ignored.
export function parseCsv(text) {
  const rows = [], src = String(text).replace(/^﻿/, '')
  let row = [], cell = '', quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ''))
}
const csvField = value => { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text }
// UTF-8 with BOM so Excel shows Arabic; CRLF line ends as Excel writes them.
export const toCsvText = rows => '﻿' + rows.map(r => r.map(csvField).join(',')).join('\r\n') + '\r\n'

function table(text, name) {
  const [header = [], ...body] = parseCsv(text)
  return { header: header.map(h => h.trim()), rows: body.map((cells, i) => ({ line: i + 2, cells })), name }
}

// The writers' sheet → cases (no labels). `target` is the writer's plan for coverage only: it is
// returned separately and never stored in the set.
export function casesFromCsv(text, name = 'cases sheet') {
  const t = table(text, name), errors = []
  for (const col of CASE_COLUMNS.filter(c => c !== 'target')) if (!t.header.includes(col)) errors.push(`${name}: column "${col}" is missing`)
  if (errors.length) return { cases: [], targets: new Map(), errors }
  const at = col => t.header.indexOf(col)
  const cases = [], targets = new Map(), seen = new Set()
  for (const { line, cells } of t.rows) {
    const get = col => at(col) >= 0 ? String(cells[at(col)] ?? '').trim() : ''
    const id = get('id'), where = `${name} line ${line}${id ? ` (${id})` : ''}`
    if (!id) { errors.push(`${where}: id is empty`); continue }
    if (seen.has(id)) errors.push(`${where}: duplicate id`)
    seen.add(id)
    if (!LANGS.includes(get('lang'))) errors.push(`${where}: lang must be ar or en`)
    if (!V2_RULES.categories.includes(get('category'))) errors.push(`${where}: category must be one of ${V2_RULES.categories.join(', ')}`)
    if (get('text').length < 3) errors.push(`${where}: text is empty`)
    if (!get('author')) errors.push(`${where}: author (initials or pseudonym) is empty`)
    const target = get('target').split(/[\s;|]+/).filter(Boolean)
    for (const cap of target) if (!CAPABILITY_IDS.includes(cap)) errors.push(`${where}: target "${cap}" is not a capability id`)
    cases.push({ id, lang: get('lang'), category: get('category'), writtenBy: 'human', author: get('author'), writerRole: get('writer_role') || null, text: get('text') })
    targets.set(id, target)
  }
  return { cases, targets, errors }
}

// One reviewer's sheet → Map(id → { labels, note, text }). Values: "1" = yes, empty = no.
// `extra`: further non-capability columns this sheet may carry (Task 38b: decision, edited_text); their
// values are returned in `extra`. The human labels sheet takes none.
export function labelsFromCsv(text, name = 'labels sheet', { extra = [] } = {}) {
  const t = table(text, name), errors = []
  if (t.header[0] !== 'id') errors.push(`${name}: the first column must be "id"`)
  const capCols = [], known = new Set(['id', 'text', 'note', ...extra])
  t.header.forEach((h, i) => {
    if (known.has(h)) return
    const id = headerId(h)
    if (CAPABILITY_IDS.includes(id)) capCols.push({ i, id })
    else errors.push(`${name}: column "${h}" is not a capability id (allowed: ${CAPABILITY_IDS.join(', ')})`)
  })
  for (const id of CAPABILITY_IDS) if (!capCols.some(c => c.id === id)) errors.push(`${name}: capability column "${id}" is missing`)
  const out = new Map(), textAt = t.header.indexOf('text'), noteAt = t.header.indexOf('note')
  for (const { line, cells } of t.rows) {
    const id = String(cells[0] ?? '').trim(), where = `${name} line ${line}${id ? ` (${id})` : ''}`
    if (!id) { errors.push(`${where}: id is empty`); continue }
    if (out.has(id)) { errors.push(`${where}: duplicate id`); continue }
    const labels = []
    for (const { i, id: cap } of capCols) {
      const v = String(cells[i] ?? '').trim()
      if (v === '1') labels.push(cap)
      else if (v !== '') errors.push(`${where}: "${v}" under ${cap}; use 1 or leave it empty`)
    }
    const extras = Object.fromEntries(extra.map(col => [col, t.header.indexOf(col) >= 0 ? String(cells[t.header.indexOf(col)] ?? '').trim() : '']))
    out.set(id, { labels, note: noteAt >= 0 ? String(cells[noteAt] ?? '').trim() : '', text: textAt >= 0 ? String(cells[textAt] ?? '').trim() : null, extra: extras })
  }
  return { labels: out, errors }
}

// A blank labels sheet for one reviewer, with every case's id and text (and nothing else).
export const labelsSheet = cases => toCsvText([LABEL_COLUMNS, ...cases.map(c => [c.id, c.text, ...CAPABILITY_IDS.map(() => ''), ''])])

// Import: the writers' cases + reviewer A's and reviewer B's labels → a testset-v2 set. Where A and
// B agree, `agreed` = their labels; where they differ, `agreed` stays empty until resolve-v2 and
// check --v2 fails ("reviewers disagree"). `base`: the existing set's metadata (purpose, version).
// `forbiddenTexts` (Task 38b): Claude-drafted texts; the human set refuses them outright.
export function importV2({ casesCsv, labelsACsv, labelsBCsv, reviewers = {}, base = {}, forbiddenTexts = [] }) {
  const parsed = casesFromCsv(casesCsv, 'cases sheet'), a = labelsFromCsv(labelsACsv, 'reviewer A sheet'), b = labelsFromCsv(labelsBCsv, 'reviewer B sheet')
  const errors = [...parsed.errors, ...a.errors, ...b.errors]
  if (!reviewers.A || !reviewers.B) errors.push('two reviewers are required (--reviewer-a, --reviewer-b: a role or pseudonym)')
  else if (reviewers.A === reviewers.B) errors.push('reviewer A and reviewer B must be different people')
  const ids = new Set(parsed.cases.map(c => c.id))
  const forbidden = new Set(forbiddenTexts.map(normaliseText))
  for (const c of parsed.cases) if (forbidden.has(normaliseText(c.text))) errors.push(`${c.id}: this text is a Claude-drafted case (eval/project-suggest/ai-drafts); it can never enter the human set`)
  for (const [sheet, name] of [[a.labels, 'reviewer A'], [b.labels, 'reviewer B']]) {
    for (const id of ids) if (!sheet.has(id)) errors.push(`${name} sheet has no row for case ${id}`)
    for (const id of sheet.keys()) if (!ids.has(id)) errors.push(`${name} sheet has a row for ${id}, which is not in the cases sheet`)
  }
  const warnings = []
  for (const c of parsed.cases) for (const [sheet, name] of [[a.labels, 'reviewer A'], [b.labels, 'reviewer B']]) {
    const row = sheet.get(c.id)
    if (row?.text != null && row.text !== '' && normaliseText(row.text) !== normaliseText(c.text)) warnings.push(`${c.id}: the text in the ${name} sheet differs from the cases sheet; the cases sheet is used`)
  }
  if (errors.length) return { set: null, errors, warnings, targets: parsed.targets }
  const cases = parsed.cases.map(c => {
    const A = a.labels.get(c.id), B = b.labels.get(c.id), same = sameSet(A.labels, B.labels)
    const labels = { reviewerA: A.labels, reviewerB: B.labels, agreed: same ? [...A.labels] : [] }
    if (A.note) labels.noteA = A.note
    if (B.note) labels.noteB = B.note
    return { ...c, labels, expected: [...labels.agreed] }
  })
  const computed = agreement(cases)
  const set = { ...base, version: 'testset-v2', status: 'labelled', writtenBy: 'human', kit: KIT_VERSION, reviewers: { A: reviewers.A, B: reviewers.B },
    agreement: { decisions: computed.decisions, observed: round(computed.observed), kappa: round(computed.kappa), exactCaseAgreement: round(computed.exactCaseAgreement) }, cases }
  return { set, errors, warnings, targets: parsed.targets }
}
const round = v => v == null ? null : Number(v.toFixed(4))

// Resolve: the reviewers' agreed final labels (same sheet as a labels sheet; the note is the
// adjudication). Every case where A and B differ must be resolved, with a note. A case where they
// agreed may be changed only with a note. Per-reviewer labels and the agreement stay unchanged.
export function resolveV2(set, resolvedCsv) {
  const r = labelsFromCsv(resolvedCsv, 'resolved sheet'), errors = [...r.errors]
  const byId = new Map(set.cases.map(c => [c.id, c]))
  for (const id of r.labels.keys()) if (!byId.has(id)) errors.push(`resolved sheet has a row for ${id}, which is not in the set`)
  const cases = set.cases.map(c => {
    const row = r.labels.get(c.id), disagreed = !sameSet(c.labels.reviewerA, c.labels.reviewerB)
    if (!row) { if (disagreed && !c.labels.adjudication) errors.push(`${c.id}: reviewers disagree and the resolved sheet has no row for it`); return c }
    const changed = !sameSet(row.labels, c.labels.agreed)
    if ((disagreed || changed) && !row.note) errors.push(`${c.id}: write in "note" why the final labels are ${row.labels.join(', ') || 'none'} (A: ${c.labels.reviewerA.join(', ') || 'none'}; B: ${c.labels.reviewerB.join(', ') || 'none'})`)
    if (!disagreed && !changed) return c
    const labels = { ...c.labels, agreed: [...row.labels], adjudication: row.note }
    return { ...c, labels, expected: [...row.labels] }
  })
  if (errors.length) return { set: null, errors }
  return { set: { ...set, status: cases.every(c => sameSet(c.labels.reviewerA, c.labels.reviewerB) || c.labels.adjudication) ? 'resolved' : 'labelled', cases }, errors }
}

// disagreements.md: every case where A and B differ, with the case text and both label sets.
export function disagreementsMarkdown(set, { date = '' } = {}) {
  // Task 38b: a reviewed AI draft is also listed when either reviewer edited or rejected it.
  const bothKept = c => !c.review || (c.review.A.decision === 'keep' && c.review.B.decision === 'keep')
  const list = set.cases.filter(c => !sameSet(c.labels?.reviewerA || [], c.labels?.reviewerB || []) || !bothKept(c))
  const names = ids => ids.length ? ids.map(id => `\`${id}\``).join(', ') : '*none*'
  const reviewer = (c, who) => {
    const labels = c.labels[`reviewer${who}`], r = c.review?.[who]
    const note = r ? r.note : c.labels[`note${who}`]
    const decision = r ? `**${r.decision}**${r.editedText ? ` → “${r.editedText}”` : ''}; ` : ''
    return `- Reviewer ${who}: ${decision}${names(labels)}${note ? ` — ${note}` : ''}`
  }
  const ag = set.agreement || {}
  const lines = ['# Disagreements between reviewer A and reviewer B', '',
    `Generated by \`eval.mjs import-v2\` / \`resolve-v2\` (${KIT_VERSION})${date ? ` on ${date}` : ''}. Do not edit by hand.`, '',
    `- Cases: ${set.cases.length} · disagreements: ${list.length} · resolved: ${list.filter(c => c.labels.adjudication).length}`,
    `- Agreement on case × capability decisions: observed ${ag.observed ?? 'n/a'}, Cohen's kappa ${ag.kappa ?? 'n/a'}, exact-case ${ag.exactCaseAgreement ?? 'n/a'}`, '']
  if (!list.length) lines.push('No disagreements.', '')
  for (const c of list) {
    lines.push(`## ${c.id} (${c.lang}, ${c.category})`, '', `> ${String(c.text).replace(/\n/g, ' ')}`, '',
      reviewer(c, 'A'), reviewer(c, 'B'),
      c.labels.adjudication ? `- **Resolved:** ${c.finalDecision ? `${c.finalDecision}; ` : ''}${names(c.labels.agreed)} — ${c.labels.adjudication}` : '- **Not resolved yet.** Agree on the final labels together and put them in the resolved sheet.', '')
  }
  if (set.rejected?.length) {
    lines.push('## Rejected drafts', '', 'Kept for traceability; never evaluated.', '')
    for (const r of set.rejected) lines.push(`- \`${r.id}\` (${r.lang}): A ${r.review.A.decision}, B ${r.review.B.decision} — ${r.reason}`)
    lines.push('')
  }
  return lines.join('\n')
}

// Live coverage: cases per language and category, and positive cases per capability (agreed labels;
// for a cases sheet before labelling, the writers' targets) against the quota.
export function coverageReport(cases, { targets = null } = {}) {
  const perCapability = targets
    ? capabilityCoverage(cases.map(c => ({ lang: c.lang, expected: targets.get(c.id) || [] })))
    : capabilityCoverage(cases)
  const byCategory = {}
  for (const c of cases) { byCategory[c.category] ??= { ar: 0, en: 0 }; byCategory[c.category][c.lang] = (byCategory[c.category][c.lang] || 0) + 1 }
  const count = lang => cases.filter(c => c.lang === lang).length
  const minimum = { minPerLanguage: V2_RULES.minPerLanguage, synonym: V2_RULES.minSynonymPerLanguage, 'should-abstain': V2_RULES.minShouldAbstainPerLanguage, dialect: V2_RULES.minDialectArabic }
  const gaps = []
  for (const lang of LANGS) {
    if (count(lang) < minimum.minPerLanguage) gaps.push(`${lang}: ${count(lang)} of ${minimum.minPerLanguage} cases`)
    for (const cat of ['synonym', 'should-abstain']) if ((byCategory[cat]?.[lang] || 0) < minimum[cat]) gaps.push(`${lang}: ${byCategory[cat]?.[lang] || 0} of ${minimum[cat]} ${cat} cases`)
  }
  if ((byCategory.dialect?.ar || 0) < minimum.dialect) gaps.push(`ar: ${byCategory.dialect?.ar || 0} of ${minimum.dialect} dialect cases`)
  for (const [id, n] of Object.entries(perCapability)) {
    if (n.total < V2_RULES.minPositivesPerCapability) gaps.push(`${id}: ${n.total} of ${V2_RULES.minPositivesPerCapability} ${targets ? 'planned positive cases' : 'positive cases'}`)
    else for (const lang of LANGS) if (!n[lang]) gaps.push(`${id}: no ${lang} case yet (aim, not required)`)
  }
  const lines = [`Cases: ar ${count('ar')}, en ${count('en')}${targets ? ' · capabilities counted from the writers\' targets (planning only; the reviewers\' labels decide)' : ' · capabilities counted as positive cases: final agreed labels only'}`, '',
    'Category        ar   en', ...Object.entries(byCategory).map(([cat, n]) => `${cat.padEnd(15)} ${String(n.ar || 0).padStart(2)}   ${String(n.en || 0).padStart(2)}`), '',
    `Capability          ar   en   total  (${targets ? 'planned' : 'positive'} cases; need ≥${V2_RULES.minPositivesPerCapability} total, aim ≥1 per language)`,
    ...Object.entries(perCapability).map(([id, n]) => `${id.padEnd(18)} ${String(n.ar).padStart(3)}  ${String(n.en).padStart(3)}  ${String(n.total).padStart(5)}${n.total < V2_RULES.minPositivesPerCapability ? '  ← short' : ''}`), '',
    gaps.length ? `Still needed:\n- ${gaps.join('\n- ')}` : 'Quota met.']
  return { byCategory, perCapability, gaps, text: lines.join('\n') }
}

// ---- Task 38b · Claude-drafted cases, reviewed and labelled by two people -----------------------
// The drafts (eval/project-suggest/ai-drafts/drafts.json) are text only. Claude's proposed labels and
// its self-review are SEALED: they are not in the working tree; drafts.json records a sha256
// commitment to each and the commit that holds them, and `unseal-proposed` restores them only after
// both reviews are imported. Reviewers see the text only (no category, no labels), confirm they did not
// open Claude's labels, and decide keep / edit / reject, then label. The result is its own set,
// testset-ai-v3.json (writtenBy "ai", humanReviewed), never testset-v2.json.
// Limitation: sealing keeps the labels out of a fresh checkout and out of the review sheets; it cannot
// erase them from git history (they were pushed before sealing), so blindness rests on the reviewers'
// recorded confirmation and is not technically guaranteed.
export const AI_SET_VERSION = 'testset-ai-v3'
export const DRAFTS_VERSION = 'ai-drafts-v1'
export const AI_DECISIONS = Object.freeze(['keep', 'edit', 'reject'])
export const AI_REVIEW_COLUMNS = Object.freeze(['id', 'text', 'decision', 'edited_text', ...CAPABILITY_IDS.map(capabilityHeader), 'note'])
// First row of every review sheet: the reviewer confirms blindness by writing "confirmed" under
// decision (and may sign with a role or pseudonym under note). Import refuses a sheet without it.
export const BLIND_ROW_ID = 'CONFIRM'
export const BLIND_STATEMENT = 'I did not open or inspect Claude\'s proposed labels or self-review (ai-drafts/claude, sealed) before submitting this review.'
const SHA256 = /^[0-9a-f]{64}$/

// The drafts file itself: origin on every case, no labels inside it, the sealed commitment, each case
// in its language, no copy of another set. If Claude's proposed labels are given (only after unsealing)
// they must match the commitment and cover every draft with known capabilities.
export function checkDrafts(drafts, { proposed = null, proposedSha256 = null, otherTexts = [] } = {}) {
  const { meta, cases } = drafts
  const errors = [], warnings = []
  if (meta.version !== DRAFTS_VERSION) errors.push(`drafts: version must be "${DRAFTS_VERSION}"`)
  if (meta.writtenBy !== 'ai') errors.push('drafts: writtenBy must be "ai"')
  for (const key of ['model', 'generatedAt', 'method']) if (!meta.generation?.[key]) errors.push(`drafts: generation.${key} is required`)
  for (const key of ['proposedLabels', 'selfReview']) {
    const s = meta.sealed?.[key]
    if (!s?.path || !SHA256.test(s?.sha256 || '') || !/^[0-9a-f]{40}$/.test(s?.commit || '')) errors.push(`drafts: sealed.${key} needs path, commit (full hash) and sha256`)
  }
  const ids = new Set(), texts = new Set()
  const others = otherTexts.map(o => typeof o === 'string' ? { set: 'other set', text: o } : o)
  for (const c of cases) {
    const where = c?.id || '?'
    if (!/^aid-(ar|en)-\d{2}$/.test(c?.id || '') || ids.has(c.id)) errors.push(`${where}: id must be aid-<lang>-NN and unique`)
    ids.add(c?.id)
    if (!LANGS.includes(c?.lang) || !String(c?.id).startsWith(`aid-${c?.lang}-`)) errors.push(`${where}: lang must be ar or en and match the id`)
    if (!V2_RULES.categories.includes(c?.category)) errors.push(`${where}: category must be one of ${V2_RULES.categories.join(', ')}`)
    if (c?.writtenBy !== 'ai' || c?.model !== meta.generation?.model) errors.push(`${where}: writtenBy must be "ai" with the drafts' model`)
    if ('expected' in (c || {}) || 'labels' in (c || {})) errors.push(`${where}: labels never go in the drafts file (Claude's proposals are sealed)`)
    if (typeof c?.text !== 'string' || c.text.trim().length < 10) { errors.push(`${where}: text missing`); continue }
    const norm = normaliseText(c.text)
    if (texts.has(norm)) errors.push(`${where}: duplicate text`)
    texts.add(norm)
    const wrong = languageProblem(c)
    if (wrong) errors.push(`${where}: ${wrong}`)
    const close = closestText(c.text, others)
    if (close?.kind === 'exact') errors.push(`${where}: copies ${close.set} ${close.id || ''}`.trim())
    else if (close) warnings.push(`${where}: close to ${close.set} ${close.id || ''} (word overlap ${close.words.toFixed(2)}, character overlap ${close.trigrams.toFixed(2)})`)
  }
  for (const a of cases) for (const b of cases) if (a.id < b.id) {
    const close = closestText(a.text, [{ set: 'drafts', id: b.id, text: b.text }])
    if (close) warnings.push(`${a.id}: close to ${b.id} in the same drafts (word overlap ${close.words.toFixed(2)})`)
  }
  if (proposed) {
    if (proposedSha256 !== meta.sealed?.proposedLabels?.sha256) errors.push(`proposed labels: sha256 ${proposedSha256} does not match the sealed commitment ${meta.sealed?.proposedLabels?.sha256}`)
    for (const c of cases) {
      const p = proposed.labels?.[c.id]
      if (!p) { errors.push(`${c.id}: no proposed labels`); continue }
      for (const id of p.labels || []) if (!CAPABILITY_IDS.includes(id)) errors.push(`${c.id}: proposed label "${id}" is not a capability`)
      if (c.category === 'should-abstain' && p.labels?.length) errors.push(`${c.id}: a should-abstain draft has proposed labels`)
      if (c.category !== 'should-abstain' && !p.labels?.length) errors.push(`${c.id}: no proposed label for a ${c.category} draft`)
      if (!p.reason) errors.push(`${c.id}: proposed labels need a reason`)
    }
    for (const id of Object.keys(proposed.labels || {})) if (!ids.has(id)) errors.push(`proposed labels: ${id} is not a draft`)
    const coverage = capabilityCoverage(cases.map(c => ({ lang: c.lang, expected: proposed.labels?.[c.id]?.labels || [] })))
    for (const [id, n] of Object.entries(coverage)) if (n.total < V2_RULES.minPositivesPerCapability) warnings.push(`proposed labels: "${id}" has ${n.total} positive drafts (aim ${V2_RULES.minPositivesPerCapability})`)
  }
  return { errors, warnings }
}

// A blank review sheet for one reviewer: the blindness confirmation row, then id and text only (no
// category, no proposed label).
export const aiReviewSheet = cases => toCsvText([AI_REVIEW_COLUMNS, [BLIND_ROW_ID, BLIND_STATEMENT, '', '', ...CAPABILITY_IDS.map(() => ''), ''], ...cases.map(c => [c.id, c.text, '', '', ...CAPABILITY_IDS.map(() => ''), ''])])

function readAiReview(text, name, draftIds, { confirmation = true } = {}) {
  const r = labelsFromCsv(text, name, { extra: ['decision', 'edited_text'] }), errors = [...r.errors]
  let confirmed = null
  const blind = r.labels.get(BLIND_ROW_ID)
  r.labels.delete(BLIND_ROW_ID)
  if (confirmation) {
    if (!blind || blind.extra.decision !== 'confirmed' || blind.labels.length) errors.push(`${name}: the reviewer must confirm blindness: row "${BLIND_ROW_ID}" with "confirmed" under decision (${BLIND_STATEMENT})`)
    else confirmed = { confirmed: true, statement: BLIND_STATEMENT, ...(blind.note ? { note: blind.note } : {}) }
  }
  for (const id of draftIds) if (!r.labels.has(id)) errors.push(`${name} has no row for draft ${id}`)
  for (const [id, row] of r.labels) {
    if (!draftIds.has(id)) errors.push(`${name} has a row for ${id}, which is not a draft`)
    const decision = row.extra.decision
    if (!AI_DECISIONS.includes(decision)) errors.push(`${name} (${id}): decision must be keep, edit or reject`)
    if (decision === 'edit' && !row.extra.edited_text) errors.push(`${name} (${id}): "edit" needs the edited text in edited_text`)
    if (decision !== 'edit' && row.extra.edited_text) errors.push(`${name} (${id}): edited_text is only for "edit"`)
    if (decision === 'reject' && row.labels.length) errors.push(`${name} (${id}): a rejected draft has no labels`)
  }
  return { rows: r.labels, errors, confirmed }
}
const aiAgreementOf = cases => { const a = agreement(cases); return { cases: cases.length, decisions: a.decisions, observed: round(a.observed), kappa: round(a.kappa), exactCaseAgreement: round(a.exactCaseAgreement) } }
const decisionCounts = rows => Object.fromEntries(AI_DECISIONS.map(d => [d, [...rows.values()].filter(r => r.extra.decision === d).length]))
// The drafts both reviewers labelled (neither rejected): the base of the reviewers' agreement.
const notRejectedByEither = entries => entries.filter(c => c.review.A.decision !== 'reject' && c.review.B.decision !== 'reject')
// Settled = both kept it unchanged with the same labels, or the reviewers resolved it together.
export const aiSettled = c => (c.review.A.decision === 'keep' && c.review.B.decision === 'keep' && sameSet(c.labels.reviewerA, c.labels.reviewerB)) || !!c.labels?.adjudication

// Import both reviewers' sheets. Each must carry the reviewer's blindness confirmation. A draft is
// settled only when both kept it unchanged with the same labels; every other draft waits for
// resolve-ai-review. Agreement (Cohen's kappa) is computed on the drafts neither reviewer rejected.
export function importAiReview({ drafts, draftsSha256, reviewACsv, reviewBCsv, reviewers = {} }) {
  const ids = new Set(drafts.cases.map(c => c.id))
  const a = readAiReview(reviewACsv, 'reviewer A sheet', ids), b = readAiReview(reviewBCsv, 'reviewer B sheet', ids)
  const errors = [...a.errors, ...b.errors]
  if (!reviewers.A || !reviewers.B) errors.push('two reviewers are required (--reviewer-a, --reviewer-b: a role or pseudonym)')
  else if (reviewers.A === reviewers.B) errors.push('reviewer A and reviewer B must be different people')
  if (!SHA256.test(drafts.meta.sealed?.proposedLabels?.sha256 || '')) errors.push('drafts: no sealed commitment to Claude\'s proposed labels')
  if (errors.length) return { set: null, errors }
  const cases = drafts.cases.map(d => {
    const A = a.rows.get(d.id), B = b.rows.get(d.id)
    const review = { A: { decision: A.extra.decision, ...(A.extra.edited_text ? { editedText: A.extra.edited_text } : {}), ...(A.note ? { note: A.note } : {}) },
      B: { decision: B.extra.decision, ...(B.extra.edited_text ? { editedText: B.extra.edited_text } : {}), ...(B.note ? { note: B.note } : {}) } }
    const c = { id: d.id, lang: d.lang, category: d.category, writtenBy: 'ai', origin: { model: d.model, draftId: d.id, draftText: d.text }, text: d.text, review, labels: { reviewerA: A.labels, reviewerB: B.labels } }
    const settled = aiSettled(c)
    return { ...c, labels: { ...c.labels, agreed: settled ? [...A.labels] : [] }, expected: settled ? [...A.labels] : [], settled }
  })
  const set = { version: AI_SET_VERSION, status: 'labelled', writtenBy: 'ai', humanReviewed: true, kit: KIT_VERSION,
    disclosure: 'Drafted by Claude (AI); each draft kept, edited or rejected and labelled independently by two human reviewers, who each confirmed they had not opened Claude\'s proposed labels (sealed until after import). Reported separately from the human-written testset-v2.json; never part of it.',
    drafts: { file: 'ai-drafts/drafts.json', sha256: draftsSha256, model: drafts.meta.generation.model, generatedAt: drafts.meta.generation.generatedAt },
    proposedLabels: { sealedSha256: drafts.meta.sealed.proposedLabels.sha256, sealedIn: drafts.meta.sealed.proposedLabels.commit, path: drafts.meta.sealed.proposedLabels.path, verified: false },
    reviewers: { A: reviewers.A, B: reviewers.B }, reviewerConfirmations: { A: a.confirmed, B: b.confirmed },
    reviewerDecisions: { A: decisionCounts(a.rows), B: decisionCounts(b.rows) },
    agreement: aiAgreementOf(notRejectedByEither(cases)), cases, rejected: [] }
  return { set, errors: [] }
}

// Resolve: one row per unsettled draft (and any settled draft that changes, with a reason): the final
// decision, the final text for "edit", the final labels and the reason in `note`. Claude's proposed
// labels must be given (unsealed) and match the sealed sha256; they are stored on every draft
// (`claudeProposed`), kept and rejected, so the comparison can be checked later. Rejected drafts move to
// `rejected` with their reviews, labels and reason (kept for traceability, never evaluated).
export function resolveAiReview(set, resolvedCsv, { proposed = null, proposedSha256 = null } = {}) {
  const errors = []
  if (!proposed) errors.push(`Claude's proposed labels are required to resolve (unseal them: eval.mjs unseal-proposed); sealed sha256 ${set.proposedLabels?.sealedSha256}`)
  else if (proposedSha256 !== set.proposedLabels?.sealedSha256) errors.push(`Claude's proposed labels do not match the sealed commitment (sha256 ${proposedSha256}, sealed ${set.proposedLabels?.sealedSha256}); use the original file`)
  else for (const c of set.cases) if (!Array.isArray(proposed.labels?.[c.id]?.labels)) errors.push(`${c.id}: no proposed labels in the unsealed file`)
  const ids = new Set(set.cases.map(c => c.id))
  const r = readAiReview(resolvedCsv, 'resolved sheet', new Set(), { confirmation: false })
  errors.push(...r.errors.filter(e => !/has a row for .*, which is not a draft/.test(e)))
  for (const id of r.rows.keys()) if (!ids.has(id)) errors.push(`resolved sheet has a row for ${id}, which is not in the set`)
  if (errors.length) return { set: null, errors }
  const claudeOf = id => [...proposed.labels[id].labels]
  const kept = [], rejected = [...(set.rejected || [])]
  for (const c of set.cases) {
    const row = r.rows.get(c.id)
    if (!row) { if (!aiSettled(c)) errors.push(`${c.id}: not settled (A: ${c.review.A.decision} ${c.labels.reviewerA.join(' ') || '-'}; B: ${c.review.B.decision} ${c.labels.reviewerB.join(' ') || '-'}) and the resolved sheet has no row for it`); else kept.push({ ...c, finalDecision: 'keep', claudeProposed: claudeOf(c.id) }); continue }
    if (!row.note) errors.push(`${c.id}: write in "note" why the final decision is ${row.extra.decision}`)
    const decision = row.extra.decision
    if (decision === 'reject') { rejected.push({ id: c.id, lang: c.lang, category: c.category, origin: c.origin, review: c.review, labels: { reviewerA: c.labels.reviewerA, reviewerB: c.labels.reviewerB }, claudeProposed: claudeOf(c.id), reason: row.note }); continue }
    const text = decision === 'edit' ? row.extra.edited_text : c.origin.draftText
    kept.push({ ...c, text, ...(decision === 'edit' ? { humanEdited: true } : {}), finalDecision: decision, settled: true, claudeProposed: claudeOf(c.id),
      labels: { ...c.labels, agreed: [...row.labels], adjudication: row.note }, expected: [...row.labels] })
  }
  if (errors.length) return { set: null, errors }
  const counts = { kept: kept.filter(c => c.finalDecision === 'keep').length, edited: kept.filter(c => c.finalDecision === 'edit').length, rejected: rejected.length }
  const claudeVsHuman = { ...aiAgreementOf(kept.map(c => ({ labels: { reviewerA: c.claudeProposed, reviewerB: c.labels.agreed } }))), note: 'Claude\'s proposed labels (claudeProposed) vs the reviewers\' final labels, on the kept and edited drafts.' }
  return { set: { ...set, status: 'resolved', proposedLabels: { ...set.proposedLabels, verified: true, sha256: proposedSha256 }, counts, claudeVsHuman, cases: kept, rejected }, errors: [] }
}

// The reviewed AI set. Every rule is recomputed from the stored reviews, never taken from a stored
// flag: settled, agreement, counts and Claude-vs-human agreement. Every draft of the drafts file is
// accounted for exactly once (kept, edited or rejected) and the drafts' sha256 must match the file.
// The 3-positive-cases rule belongs to the official human set; here it is a warning.
// `drafts`: the loaded drafts file; `draftsSha256`: its actual sha256.
export function checkSetAiReviewed(set, { otherTexts = [], drafts = null, draftsSha256 = null } = {}) {
  const { meta, cases } = set
  const base = checkSet(cases)
  const errors = [...base.errors], warnings = []
  const rejected = meta.rejected || []
  if (meta.version !== AI_SET_VERSION) errors.push(`set: version must be "${AI_SET_VERSION}"`)
  if (meta.writtenBy !== 'ai' || meta.humanReviewed !== true) errors.push('set: writtenBy must be "ai" with humanReviewed true')
  if (!meta.reviewers?.A || !meta.reviewers?.B || meta.reviewers.A === meta.reviewers.B) errors.push('set: two different reviewers are required')
  for (const who of ['A', 'B']) if (meta.reviewerConfirmations?.[who]?.confirmed !== true) errors.push(`set: reviewer ${who}'s blindness confirmation is missing`)
  if (!meta.drafts?.sha256 || !meta.drafts?.model) errors.push('set: the drafts file and model must be recorded')
  // A · every draft exactly once, against the actual drafts file
  if (!drafts) errors.push('set: the drafts file is needed to verify the set (ai-drafts/drafts.json)')
  else {
    if (draftsSha256 !== meta.drafts?.sha256) errors.push(`set: drafts sha256 ${meta.drafts?.sha256} does not match the drafts file (${draftsSha256})`)
    const seen = new Map()
    for (const e of [...cases, ...rejected]) seen.set(e?.id, (seen.get(e?.id) || 0) + 1)
    for (const [id, n] of seen) if (n > 1) errors.push(`${id}: appears ${n} times across cases and rejected`)
    const draftIds = new Set(drafts.cases.map(d => d.id))
    for (const d of drafts.cases) if (!seen.has(d.id)) errors.push(`${d.id}: draft is missing from the set (neither a case nor rejected)`)
    for (const id of seen.keys()) if (!draftIds.has(id)) errors.push(`${id}: not a draft of the drafts file`)
    for (const e of [...cases, ...rejected]) {
      const d = drafts.cases.find(x => x.id === e?.id)
      if (d && (e.origin?.draftText !== d.text || e.lang !== d.lang)) errors.push(`${e.id}: origin does not match the drafts file`)
    }
    if (meta.proposedLabels?.sealedSha256 !== drafts.meta.sealed?.proposedLabels?.sha256) errors.push('set: the proposed-labels commitment does not match the drafts file')
  }
  const others = otherTexts.map(o => typeof o === 'string' ? { set: 'other set', text: o } : o)
  for (const c of cases) {
    const where = c?.id || '?'
    if (c?.writtenBy !== 'ai' || !c?.origin?.model || !c?.origin?.draftId) errors.push(`${where}: writtenBy "ai" and origin (model, draftId) are required`)
    if (!c?.review?.A || !c?.review?.B) { errors.push(`${where}: both reviewers' decisions are required`); continue }
    const settled = aiSettled(c)
    if (!settled) errors.push(`${where}: not settled by the reviews; resolve it (resolve-ai-review)`)
    if (c.settled !== settled) errors.push(`${where}: stored "settled" (${c.settled}) does not match the reviews (${settled})`)
    if (settled && !c.labels.adjudication && !sameSet(c.labels.agreed || [], c.labels.reviewerA)) errors.push(`${where}: agreed labels differ from both reviewers' labels without a resolution`)
    if (c.finalDecision === 'edit' ? (!c.humanEdited || c.text === c.origin?.draftText) : c.text !== c.origin?.draftText) errors.push(`${where}: text does not match the final decision (${c.finalDecision || 'none'})`)
    if (!V2_RULES.categories.includes(c?.category)) errors.push(`${where}: unknown category`)
    if (!sameSet(c?.labels?.agreed || [], c?.expected || [])) errors.push(`${where}: expected must equal labels.agreed`)
    if (c?.category === 'should-abstain' && c?.expected?.length) errors.push(`${where}: a should-abstain case must have expected []`)
    const wrong = languageProblem(c)
    if (wrong) errors.push(`${where}: ${wrong}`)
    const close = typeof c?.text === 'string' ? closestText(c.text, others) : null
    if (close?.kind === 'exact') errors.push(`${where}: text also appears in ${close.set} ${close.id || ''}`.trim())
    else if (close) warnings.push(`${where}: close to ${close.set} ${close.id || ''}`.trim())
  }
  for (const e of rejected) if (!e?.reason || !e?.review?.A || !e?.review?.B || !e?.labels) errors.push(`${e?.id || '?'}: a rejected draft keeps its reviews, labels and reason`)
  for (const [id, n] of Object.entries(capabilityCoverage(cases))) if (n.total < V2_RULES.minPositivesPerCapability) warnings.push(`set: capability "${id}" has ${n.total} positive case(s)`)
  // A · agreement recomputed from the stored labels of every draft neither reviewer rejected
  const computed = aiAgreementOf(notRejectedByEither([...cases, ...rejected].filter(e => e?.review?.A && e?.review?.B && e?.labels)))
  const recorded = meta.agreement
  if (!recorded) errors.push('set: agreement must be recorded (import-ai-review writes it)')
  else if (recorded.cases !== computed.cases || Math.abs((recorded.kappa ?? -9) - (computed.kappa ?? -9)) > 0.001 || Math.abs((recorded.observed ?? -9) - (computed.observed ?? -9)) > 0.001) errors.push(`set: recorded agreement (kappa ${recorded.kappa} on ${recorded.cases} drafts) does not match the reviews (kappa ${computed.kappa} on ${computed.cases})`)
  if (meta.status !== 'resolved' || !meta.counts) errors.push('set: counts of kept, edited and rejected drafts must be recorded (resolve-ai-review writes them)')
  else {
    const counts = { kept: cases.filter(c => c.finalDecision === 'keep').length, edited: cases.filter(c => c.finalDecision === 'edit').length, rejected: rejected.length }
    if (meta.counts.kept !== counts.kept || meta.counts.edited !== counts.edited || meta.counts.rejected !== counts.rejected || counts.kept + counts.edited !== cases.length) errors.push(`set: recorded counts ${JSON.stringify(meta.counts)} do not match the cases (${JSON.stringify(counts)})`)
    // B · Claude's original labels kept on every draft, verified against the sealed file, and the comparison recomputed
    if (meta.proposedLabels?.verified !== true || meta.proposedLabels?.sha256 !== meta.proposedLabels?.sealedSha256) errors.push('set: Claude\'s proposed labels were not verified against the sealed commitment at resolution')
    for (const e of [...cases, ...rejected]) if (!Array.isArray(e?.claudeProposed)) errors.push(`${e?.id || '?'}: Claude's original proposed labels (claudeProposed) are missing`)
    const claude = aiAgreementOf(cases.map(c => ({ labels: { reviewerA: c.claudeProposed || [], reviewerB: c.labels?.agreed || [] } })))
    if (!meta.claudeVsHuman || Math.abs((meta.claudeVsHuman.observed ?? -9) - (claude.observed ?? -9)) > 0.001 || meta.claudeVsHuman.cases !== claude.cases) errors.push('set: recorded Claude-vs-human agreement does not match claudeProposed and the final labels')
  }
  return { errors, warnings, counts: base.counts }
}
