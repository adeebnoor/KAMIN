// Task 19 · suggest only from the gap. An item is suggested only if it teaches a capability that the
// field requires and that is "limited" or "missing" for this student. Each suggestion says which gap it
// closes and why. A university course already on the student's record is never suggested again.
// Order follows written rules, and no score is produced or shown:
//   1. items whose prerequisites the student already meets come first;
//   2. then items that close a missing capability before items that strengthen a limited one;
//   3. then lower level first (intro, intermediate, advanced);
//   4. then university courses, other courses, certificates; then by id, so the order is stable.
import learningCatalog from '../catalog/learning-opportunities.json' with { type: 'json' }
import { statusForLevel } from './gap.js'
import { skills as skillCatalog } from '../data.js'
import { canonicalCourseCode } from '../ontology/registry.js'
import { isShown } from './review.js'

export const SUGGEST_VERSION = 'kamin-path-suggest-v1'
export const LEARNING_CATALOG = learningCatalog
const LEVEL_ORDER = ['intro', 'intermediate', 'advanced']
const KIND_ORDER = ['university-course', 'course', 'certificate']

const label = (id, lang) => (skillCatalog[id]?.labels || (id === 'cyber' ? { ar: 'الأمن السيبراني', en: 'Cybersecurity' } : { ar: id, en: id }))[lang]
const list = (ids, lang) => ids.map(id => label(id, lang)).join(lang === 'ar' ? '، ' : ', ')

// Task 57 · "supports" is the capability list; "teaches" stays as an alias for one release.
export const supportsOf = item => item.supports || item.teaches || []

function reasonFor(gap, closes) {
  const missing = closes.filter(id => gap.requirements.find(r => r.capability === id)?.status === 'missing')
  const limited = closes.filter(id => !missing.includes(id))
  const ar = [], en = []
  if (missing.length) {
    ar.push(`مجال «${gap.targetTitle.ar}» يتطلب ${list(missing, 'ar')}، ولا يوجد في سجلك دليل عليها.`)
    en.push(`The field "${gap.targetTitle.en}" requires ${list(missing, 'en')}, and your record has no evidence for ${missing.length > 1 ? 'them' : 'it'}.`)
  }
  if (limited.length) {
    ar.push(`مجال «${gap.targetTitle.ar}» يتطلب ${list(limited, 'ar')}، ودليلك عليها محدود.`)
    en.push(`The field "${gap.targetTitle.en}" requires ${list(limited, 'en')}, and your evidence for ${limited.length > 1 ? 'them' : 'it'} is limited.`)
  }
  return { ar: ar.join(' '), en: en.join(' ') }
}

export function suggestPath(gap, catalog = learningCatalog.items, { skills = [], takenCourses = [] } = {}) {
  if (!gap?.hasGap) return []
  const taken = new Set(takenCourses.map(code => canonicalCourseCode(code)))
  const open = new Set(gap.gaps.map(r => r.capability))
  const have = new Map(skills.map(skill => [skill.id, skill.evidenceLevel]))
  // A prerequisite asks for a basis, not mastery: any evidence (limited or better) meets it. A field's
  // requirement needs more (moderate or better, see gap.js). So "Database (II)" waits for some database
  // evidence, while a student with limited evidence can take it to strengthen that capability.
  const met = id => statusForLevel(have.get(id) || gap.requirements.find(r => r.capability === id)?.level) !== 'missing'
  const suggestions = []
  for (const item of catalog) {
    if (!isShown(item)) continue // Task 36: a retired item stays in the list for history, never suggested
    const closes = supportsOf(item).filter(id => open.has(id))
    if (!closes.length) continue
    if (item.kind === 'university-course' && taken.has(canonicalCourseCode(item.courseCode))) continue
    const missingPrereqs = (item.requires || []).filter(id => !met(id))
    suggestions.push({
      itemId: item.id,
      closes,
      reason: reasonFor(gap, closes),
      prerequisitesMet: missingPrereqs.length === 0,
      missingPrerequisites: missingPrereqs,
      status: item.status,
      _closesMissing: closesMissing(gap, closes),
      _level: item.level,
      _kind: item.kind,
    })
  }
  return suggestions
    .sort((a, b) => byWrittenRules(rulesKey(a), rulesKey(b)))
    .map(({ _closesMissing, _level, _kind, ...suggestion }) => suggestion)
}

const rulesKey = s => ({ itemId: s.itemId, prerequisitesMet: s.prerequisitesMet, closesMissing: s._closesMissing, level: s._level, kind: s._kind })

// Task 57 · the written ordering rules above as one comparator, shared with src/path/nextSteps.js so
// the two lists can never order differently. Each side: { itemId, prerequisitesMet, closesMissing,
// level, kind }. No score: only these comparisons, in this order.
export function byWrittenRules(a, b) {
  return Number(b.prerequisitesMet) - Number(a.prerequisitesMet)
    || Number(b.closesMissing) - Number(a.closesMissing)
    || LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
    || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
    || a.itemId.localeCompare(b.itemId)
}

// Does closing these capabilities close a "missing" one (not only strengthen a "limited" one)?
export const closesMissing = (gap, closes) => closes.some(id => gap.requirements.find(r => r.capability === id)?.status === 'missing')

// Gaps no item in the list closes yet (shown to the student instead of staying silent).
export const uncoveredGaps = (gap, suggestions) => (gap?.gaps || []).filter(r => !suggestions.some(s => s.closes.includes(r.capability)))

export const catalogItem = id => learningCatalog.items.find(item => item.id === id) || null
