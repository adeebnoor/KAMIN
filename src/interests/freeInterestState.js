// Task 56 · the stored shape of interests in the student's own words, and its strict allowlist.
// Small and dependency-free, kept out of the initial bundle: every place that reads, exports or
// deletes free interests is itself loaded on demand (src/interests/freeText.js, the backup in
// src/utils/portableProfile.js, delete and withdraw in src/utils/dataControl.js) and runs this
// normaliser first. Covered by the interests consent; a goal signal, never evidence:
// profileSkills, evidence levels and the person graph never read them.
//
// state.insight.freeInterests = [{ id, text, understood: [{ kind: 'capability' | 'pathway' | 'topic', id, removed }], method, createdAt }]
// 'topic' chips (apps, health, ...) come from the interest vocabulary (src/interests/vocabulary.js); like
// the others they are a goal signal only.
export const FREE_INTEREST_METHOD = 'kamin-free-interest-v1'
export const FREE_INTEREST_MAX = 5
export const FREE_INTEREST_MAX_CHIPS = 4 // of each kind
const CHIP_KINDS = ['capability', 'pathway', 'topic']

// Kept text: no control characters (line breaks and tabs are allowed), at most 500 characters, and
// at least 3 once the spaces at both ends are ignored. freeText.js cleans and checks before saving.
const TEXT = /^(?=[^]*\S[^]+\S)[^\0-\x08\x0b-\x1f\x7f-\x9f]{3,500}$/u
const isId = value => typeof value === 'string' && /^[\w-]{1,64}$/.test(value)

export function normalizeFreeInterests(value) {
  const seen = new Set()
  return (Array.isArray(value) ? value : []).flatMap(entry => {
    const { id, text, createdAt } = entry || {}
    if (!isId(id) || seen.has(id) || typeof text !== 'string' || !TEXT.test(text) || entry.method !== FREE_INTEREST_METHOD || !Number.isFinite(Date.parse(createdAt))) return []
    seen.add(id)
    const chips = new Set()
    const understood = (Array.isArray(entry.understood) ? entry.understood : [])
      .filter(chip => CHIP_KINDS.includes(chip?.kind) && isId(chip.id) && !chips.has(`${chip.kind}:${chip.id}`) && chips.add(`${chip.kind}:${chip.id}`))
      .slice(0, FREE_INTEREST_MAX_CHIPS * CHIP_KINDS.length)
      .map(chip => ({ kind: chip.kind, id: chip.id, removed: chip.removed === true }))
    return [{ id, text, understood, method: FREE_INTEREST_METHOD, createdAt }]
  }).slice(0, FREE_INTEREST_MAX)
}
