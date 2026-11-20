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
// No supporting sentence → no suggestion (abstain).
// v2 (EXPERIMENTAL, evaluation/experimental only — not used by the app): lexicon v2 (experimental/lexicon/capabilities-v2.json) and
// a secondary-mention guard: a strong term marked "generic" (e.g. "security", "database") does not suggest its
// capability when it is the only distinct term of that capability in the whole text and every sentence holding it is a
// topic list (2+ commas), e.g. "Topics include ..., network security, ...". See CHANGES-v2.md.
import LEXICON from './lexicon/capabilities-v2.json' with { type: 'json' }

export const PROJECT_SUGGEST_IMPROVED_VERSION = 'kamin-project-suggest-improved-v2-exp'
const LIST_MIN_COMMAS = 2
const isList = sentence => (sentence.match(/[,،]/g) || []).length >= LIST_MIN_COMMAS

const ARABIC = /[؀-ۿ]/
const DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' }

export function normaliseText(text) {
  return String(text || '')
    .replace(/[٠-٩]/g, d => DIGITS[d])
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
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
export function tokens(text) {
  return (normaliseText(text).match(/[\p{L}\p{N}]+/gu) || []).map(w => {
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

const COMPILED = Object.entries(LEXICON.capabilities).map(([skillId, entry]) => ({
  skillId,
  strong: entry.strong.map(e => ({ term: e.t, tokens: tokens(e.t), generic: !!e.generic })).filter(e => e.tokens.length),
  weak: entry.weak.map(e => ({ term: e.t, tokens: tokens(e.t) })).filter(e => e.tokens.length),
}))

// Sentences of the ORIGINAL text, so the quoted snippet is verbatim.
export const sentences = text => String(text || '').split(/(?<=[.!?؟؛])\s+|\n+/).map(s => s.trim()).filter(s => s.length >= 3)

/** @returns {{version, suggestions:[{skillId, snippet, matches, method, confidence}], abstained}} */
export function suggestCapabilities(description, { max = 4 } = {}) {
  const found = new Map()
  // per capability: distinct matched terms (keyed by their stems) and whether every hit sentence is a topic list
  const support = new Map()
  for (const sentence of sentences(description)) {
    const st = tokens(sentence)
    for (const cap of COMPILED) {
      const strongE = cap.strong.filter(e => findTerm(st, e.tokens))
      const weakE = cap.weak.filter(e => findTerm(st, e.tokens))
      if (strongE.length || weakE.length) {
        const s = support.get(cap.skillId) || { keys: new Set(), allGeneric: true, allList: true }
        for (const e of [...strongE, ...weakE]) s.keys.add(e.tokens.map(t => t.w).join(' '))
        if (strongE.some(e => !e.generic) || weakE.length) s.allGeneric = false
        if (!isList(sentence)) s.allList = false
        support.set(cap.skillId, s)
      }
      const strong = strongE.map(e => e.term)
      const weak = weakE.map(e => e.term)
      if (!strong.length && new Set(weak).size < 2) continue
      const strength = strong.length * 2 + weak.length
      const prev = found.get(cap.skillId)
      if (!prev || strength > prev.strength) found.set(cap.skillId, { skillId: cap.skillId, snippet: sentence, matches: [...new Set([...strong, ...weak])], strength, strongHits: strong.length })
    }
  }
  // secondary-mention guard
  for (const id of [...found.keys()]) {
    const s = support.get(id)
    if (s && s.keys.size === 1 && s.allGeneric && s.allList) found.delete(id)
  }
  const order = COMPILED.map(c => c.skillId)
  const suggestions = [...found.values()]
    .sort((a, b) => b.strength - a.strength || order.indexOf(a.skillId) - order.indexOf(b.skillId))
    .slice(0, max)
    .map(({ skillId, snippet, matches, strongHits }) => ({ skillId, snippet, matches, method: 'lexicon-v2', confidence: strongHits ? 'strong-term' : 'two-weak-terms' }))
  return { version: PROJECT_SUGGEST_IMPROVED_VERSION, suggestions, abstained: suggestions.length === 0 }
}
