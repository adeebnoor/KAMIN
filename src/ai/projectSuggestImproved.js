// Task 08 · improved local matching for "project description → capability suggestions".
// Same interface as projectSuggest.js. Fully local and deterministic: no model download, no
// network. Differences from the baseline lexicon:
//  1. stronger normalisation — Arabic hamza/alef forms, taa marbuta, alef maqsura, diacritics,
//     tatweel, the article "ال" and attached و/ف/ب/ك/ل, suffixes matched by prefix; English simple
//     inflection (test/tests/testing, implement/implemented); Arabic-Indic digits;
//  2. a reviewed synonym lexicon (src/ai/lexicon/capabilities.json) with STRONG terms (enough on
//     their own) and WEAK terms (count only with another term of the same capability in the same
//     sentence), so one generic word such as "implemented" or "API" no longer suggests anything;
//  3. the quoted snippet is the student's original sentence, character for character.
// Task 77 (v2): a plain description of what a system does ("a call comes in, the supervisor enters the case,
// the system sends it to the available unit ...") can suggest systems analysis and requirements without any
// technical word: see workflowFindings below and the "workflow" section of the lexicon. A lone hamza (ء) is
// dropped in normalisation, so "استدعاء" and "استدعا" match.
// Task 80 (v3): Saudi/Gulf dialect, English tech words written in Arabic letters and mixed sentences. Before
// matching, the words of src/ai/lexicon/dialect.json are read as their standard forms (أبلكيشن → تطبيق, سستم → نظام,
// داتابيس → قاعدة بيانات, سويت → عملت, حق → ignored ...), dialect phrases are added per capability and to the
// workflow cues, and a sentence that only states a wish ("أبغى أتعلم البرمجة") is not evidence for a project. The
// quote is still the student's original sentence. v2 stays reproducible with { dialect: false }.
// No supporting sentence → no suggestion (abstain).
import LEXICON from './lexicon/capabilities.json' with { type: 'json' }
import DIALECT from './lexicon/dialect.json' with { type: 'json' }

export const IMPROVED_V2_VERSION = 'kamin-project-suggest-improved-v2'
export const IMPROVED_V3_VERSION = 'kamin-project-suggest-improved-v3'
// Task 80 rule 7: v3 is the default only if it met the rule on testset-dialect.json (log/task-80.md).
export const DIALECT_DEFAULT = true
export const PROJECT_SUGGEST_IMPROVED_VERSION = DIALECT_DEFAULT ? IMPROVED_V3_VERSION : IMPROVED_V2_VERSION

const ARABIC = /[؀-ۿ]/
const DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' }

export function normaliseText(text) {
  return String(text || '')
    .replace(/[٠-٩]/g, d => DIGITS[d])
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '')
    // separate Arabic and Latin runs ("وCSS" → "و CSS")
    .replace(/([؀-ۿ])([a-z0-9])/g, '$1 $2').replace(/([a-z0-9])([؀-ۿ])/g, '$1 $2')
}

// Arabic: drop an attached conjunction/preposition and the article; suffixes are handled by
// prefix matching. English: light inflection stripping.
function arabicStem(word) {
  const strip = /^(?:[وفبك]?ال|لل)(?=[؀-ۿ]{3})/
  return strip.test(word) ? word.replace(strip, '') : word
}
function englishStem(word) {
  let w = word
  if (w.length > 5 && w.endsWith('ies')) w = w.slice(0, -3) + 'y'
  else if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2)
  else if (w.length > 4 && w.endsWith('es') && /(?:ss|x|ch|sh)es$/.test(w)) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1)
  return w
}
// Task 80 · the dialect layer. Each word (or phrase of up to `longest` words separated only by spaces) of the
// original text is compared after normalisation, allowing one attached prefix on its first word and one plural or
// possessive ending on its last; a hit is replaced by its standard form (empty = dropped). Other text is kept as is.
const WORD = /[\p{L}\p{M}\p{N}ـ]+/gu
const PREFIXES = ['وبال', 'ولل', 'وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك']
const SUFFIXES = ['ات', 'ها', 'هم', 'نا', 'كم', 'ين', 'ه', 'ي', 'ز', 'س']
const keyOf = word => normaliseText(word).trim()
const DIALECT_MAP = new Map()
let longest = 1
for (const entry of DIALECT.map) for (const from of entry.from) {
  const key = keyOf(from).split(/\s+/).join(' ')
  DIALECT_MAP.set(key, entry.to)
  longest = Math.max(longest, key.split(' ').length)
}
const firstForms = w => [w, ...PREFIXES.filter(p => w.startsWith(p) && w.length - p.length >= 2).map(p => w.slice(p.length))]
const lastForms = w => [w, ...SUFFIXES.filter(x => w.endsWith(x) && w.length - x.length >= 3).map(x => w.slice(0, -x.length))]
export function dialectRewrite(text) {
  const src = String(text ?? '')
  const words = [...src.matchAll(WORD)].map(m => ({ start: m.index, end: m.index + m[0].length, k: keyOf(m[0]) }))
  let out = '', at = 0
  for (let i = 0; i < words.length;) {
    let hit = null
    for (let len = Math.min(longest, words.length - i); len >= 1 && !hit; len--) {
      const span = words.slice(i, i + len)
      if (span.some(w => w.k.includes(' ')) || span.some((w, j) => j && src.slice(span[j - 1].end, w.start).trim())) continue
      const candidates = len === 1 ? firstForms(span[0].k).flatMap(lastForms)
        : firstForms(span[0].k).flatMap(h => lastForms(span[len - 1].k).map(t => [h, ...span.slice(1, -1).map(w => w.k), t].join(' ')))
      const key = candidates.find(c => DIALECT_MAP.has(c))
      if (key !== undefined) hit = { len, to: DIALECT_MAP.get(key) }
    }
    if (!hit) { i++; continue }
    out += src.slice(at, words[i].start) + hit.to
    at = words[i + hit.len - 1].end
    i += hit.len
  }
  return out + src.slice(at)
}

// Task 80 · the variety of a text, used to choose the MiniLM fallback's threshold (src/ai/hybridFallback.js):
// 'en' (no Arabic word, or more than three English words per Arabic word), 'mixed' (Arabic with an English word in
// Latin letters), 'dialect' (a word of the map or a dialect marker), else 'msa'. The evaluation sets label each case
// the same way.
const ARABIC_WORDS = /[ء-يٱ-ۓ]+/g, LATIN_WORDS = /[A-Za-z]{2,}/g
const MARKERS = new Set(DIALECT.markers.words.map(keyOf))
export function detectVariety(text) {
  const src = String(text ?? '')
  const arabic = (src.match(ARABIC_WORDS) || []).length, latin = (src.match(LATIN_WORDS) || []).length
  if (!arabic || latin > arabic * 3) return 'en'
  if (latin) return 'mixed'
  if (dialectRewrite(src) !== src) return 'dialect'
  return [...src.matchAll(WORD)].some(m => firstForms(keyOf(m[0])).some(w => MARKERS.has(w))) ? 'dialect' : 'msa'
}

export function tokens(text, { dialect = false } = {}) {
  return (normaliseText(dialect ? dialectRewrite(text) : text).match(/[\p{L}\p{N}]+/gu) || []).map(w => {
    if (!ARABIC.test(w)) return { ar: false, w: englishStem(w) }
    const stem = arabicStem(w)
    // A single attached و/ف/ب/ك/ل is tried as an alternative, never forced ("وثيقة" stays intact).
    return { ar: true, w: stem, alt: stem === w && /^[وفبكل][؀-ۿ]{3}/.test(w) ? w.slice(1) : null }
  })
}
const arabicMatch = (word, term) => !!word && (word === term || (term.length >= 3 && word.startsWith(term)))
const tokenMatches = (text, term) => term.ar
  ? (text.ar && (arabicMatch(text.w, term.w) || arabicMatch(text.alt, term.w)))
  : (!text.ar && text.w === term.w)

function findTerm(sentenceTokens, termTokens) {
  outer: for (let i = 0; i + termTokens.length <= sentenceTokens.length; i++) {
    for (let k = 0; k < termTokens.length; k++) if (!tokenMatches(sentenceTokens[i + k], termTokens[k])) continue outer
    return true
  }
  return false
}

// The lexicon of each version: v2 = capabilities.json; v3 adds dialect.json's phrases and reads every term through
// the same dialect layer as the text.
const compiled = new Map()
function lexiconFor(dialect) {
  if (compiled.has(dialect)) return compiled.get(dialect)
  const opts = { dialect }, extra = dialect ? DIALECT.capabilities : {}
  const terms = list => list.map(e => ({ term: e.t, tokens: tokens(e.t, opts) })).filter(e => e.tokens.length)
  const capabilities = Object.entries(LEXICON.capabilities).map(([skillId, entry]) => ({
    skillId,
    strong: terms([...entry.strong, ...(extra[skillId]?.strong || [])]),
    weak: terms([...entry.weak, ...(extra[skillId]?.weak || [])]),
  }))
  // Task 77 · cue groups: every form of one concept counts once ("send", "يرسل", "إرسال" → send).
  const flow = Object.fromEntries(['system', 'actions', 'roles', 'modal'].map(kind => [kind,
    LEXICON.workflow[kind].flatMap(group => [...group.t, ...(dialect ? DIALECT.workflow[kind]?.[group.k] || [] : [])]
      .map(t => ({ k: group.k, term: t, tokens: tokens(t, opts), handoff: !!group.handoff, actor: kind === 'roles' && !group.item })))
      .filter(e => e.tokens.length)]))
  const wish = { cues: DIALECT.wish.cues.map(c => tokens(c, opts).map(t => t.w)), verbs: DIALECT.wish.verbs.map(v => tokens(v, opts).map(t => t.w)) }
  const entry = { capabilities, flow, wish }
  compiled.set(dialect, entry)
  return entry
}

// Task 80 · a wish or plan ("أبغى أتعلم البرمجة", "I want to learn ML"): a cue followed within `window` words by a
// learn/work verb. Such a sentence is an interest, not evidence of a skill.
const WISH_WINDOW = DIALECT.wish.window
const seqAt = (st, i, words) => words.every((w, j) => st[i + j]?.w === w)
const verbAt = (st, i, words) => words.length > 1 ? seqAt(st, i, words) : !!st[i] && (st[i].w === words[0] || (words[0].length >= 4 && st[i].w.startsWith(words[0])))
export function isWish(sentence, { dialect = true } = {}) {
  const st = Array.isArray(sentence) ? sentence : tokens(sentence, { dialect })
  const { wish } = lexiconFor(dialect)
  for (let i = 0; i < st.length; i++) for (const cue of wish.cues) {
    if (!seqAt(st, i, cue)) continue
    for (let j = i + cue.length; j < Math.min(st.length, i + cue.length + WISH_WINDOW); j++) if (wish.verbs.some(v => verbAt(st, j, v))) return true
  }
  return false
}

// Sentences of the ORIGINAL text, so the quoted snippet is verbatim.
export const sentences = text => String(text || '').split(/(?<=[.!?؟؛])\s+|\n+/).map(s => s.trim()).filter(s => s.length >= 3)

// Task 77 · where each sentence sits in the original text, so a window of consecutive sentences is quoted
// as one verbatim slice.
function sentenceSpans(text) {
  const source = String(text || ''), out = []
  let from = 0
  for (const sentence of sentences(source)) {
    const start = source.indexOf(sentence, from)
    out.push({ start, end: start + sentence.length })
    from = start + sentence.length
  }
  return out
}

export const WORKFLOW_WINDOW = 3
export const WORKFLOW_RULES = Object.freeze({ system: 1, actions: 2, roles: 2, handoffs: 1, actors: 2, listActions: 3 })

// A description of what a system does: in a window of 1 to WORKFLOW_WINDOW consecutive sentences,
//  - systems-analysis: a system cue, 2 action concepts and 2 role/work-item concepts, with a hand-off (send,
//    assign, notify, ...) or 2 roles that are people or units: work passing between roles, not a list of functions;
//  - requirements: the same, or a system cue, a can/must cue and 3 action concepts (what the system does).
// The smallest window that meets a rule is quoted as it stands in the original text. A person's own errands
// ("I sent the weekly report to my supervisor") have no system cue, so they never qualify.
export function workflowFindings(description, { dialect = DIALECT_DEFAULT, keepWishes = false } = {}) {
  const text = String(description || '')
  const spans = sentenceSpans(text)
  const FLOW = lexiconFor(dialect).flow
  const cues = spans.map(({ start, end }) => {
    const st = tokens(text.slice(start, end), { dialect })
    const skip = dialect && !keepWishes && isWish(st, { dialect })
    return Object.fromEntries(Object.entries(FLOW).map(([kind, list]) => [kind, skip ? [] : list.filter(e => findTerm(st, e.tokens))]))
  })
  const R = WORKFLOW_RULES
  const flow = c => c.system.size >= R.system && c.actions.size >= R.actions && c.roles.size >= R.roles && (c.handoffs.size >= R.handoffs || c.actors.size >= R.actors)
  const rules = {
    'systems-analysis': flow,
    requirements: c => flow(c) || (c.system.size >= R.system && c.modal.size >= 1 && c.actions.size >= R.listActions),
  }
  const out = []
  for (const [skillId, meets] of Object.entries(rules)) {
    search: for (let size = 1; size <= Math.min(WORKFLOW_WINDOW, spans.length); size++) {
      for (let i = 0; i + size <= spans.length; i++) {
        const hits = cues.slice(i, i + size).flatMap(c => Object.entries(c).flatMap(([kind, list]) => list.map(e => ({ kind, ...e }))))
        const concepts = Object.fromEntries(Object.keys(FLOW).map(kind => [kind, new Set(hits.filter(h => h.kind === kind).map(h => h.k))]))
        concepts.handoffs = new Set(hits.filter(h => h.handoff).map(h => h.k))
        concepts.actors = new Set(hits.filter(h => h.actor).map(h => h.k))
        if (!meets(concepts)) continue
        out.push({ skillId, snippet: text.slice(spans[i].start, spans[i + size - 1].end), matches: [...new Set(hits.map(h => h.term))] })
        break search
      }
    }
  }
  return out
}

/**
 * @param {{max?: number, dialect?: boolean, keepWishes?: boolean}} options dialect: v3 (true) or v2 (false);
 *   keepWishes: the free-text interest reader reads wishes (an interest is a wish), projects do not.
 * @returns {{version, suggestions:[{skillId, snippet, matches, method, confidence}], abstained}}
 */
export function suggestCapabilities(description, { max = 4, dialect = DIALECT_DEFAULT, keepWishes = false } = {}) {
  const found = new Map()
  const COMPILED = lexiconFor(dialect).capabilities
  for (const sentence of sentences(description)) {
    const st = tokens(sentence, { dialect })
    if (dialect && !keepWishes && isWish(st, { dialect })) continue
    for (const cap of COMPILED) {
      const strong = cap.strong.filter(e => findTerm(st, e.tokens)).map(e => e.term)
      const weak = cap.weak.filter(e => findTerm(st, e.tokens)).map(e => e.term)
      if (!strong.length && new Set(weak).size < 2) continue
      const strength = strong.length * 2 + weak.length
      const prev = found.get(cap.skillId)
      if (!prev || strength > prev.strength) found.set(cap.skillId, { skillId: cap.skillId, snippet: sentence, matches: [...new Set([...strong, ...weak])], strength, strongHits: strong.length })
    }
  }
  // Task 77: only where no term of the capability was found; ranked after every term match.
  for (const w of workflowFindings(description, { dialect, keepWishes })) if (!found.has(w.skillId)) found.set(w.skillId, { ...w, strength: 1, strongHits: 0, workflow: true })
  const order = COMPILED.map(c => c.skillId)
  const suggestions = [...found.values()]
    .sort((a, b) => b.strength - a.strength || order.indexOf(a.skillId) - order.indexOf(b.skillId))
    .slice(0, max)
    .map(({ skillId, snippet, matches, strongHits, workflow }) => workflow
      ? { skillId, snippet, matches, method: 'workflow-v1', confidence: 'workflow-description' }
      : { skillId, snippet, matches, method: 'lexicon-v2', confidence: strongHits ? 'strong-term' : 'two-weak-terms' })
  return { version: dialect ? IMPROVED_V3_VERSION : IMPROVED_V2_VERSION, suggestions, abstained: suggestions.length === 0 }
}
