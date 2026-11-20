// Task 19 · gap first. For the field (target) a student wants, each capability the field requires is
// "sufficient", "limited" or "missing", using the student's Task 02 evidence level. Written rule:
//   strong or moderate evidence → sufficient · limited evidence → limited · none or no evidence → missing
// No numbers are produced. A grade is a clue, not a guarantee, so "sufficient" means "enough evidence
// for this suggestion list", never "mastered".
import { targetProfiles } from '../matching/targets.js'
import { skills as skillCatalog } from '../data.js'
import { compareLevels } from '../evidence/levels.js'

export const GAP_VERSION = 'kamin-path-gap-v1'
export const SUFFICIENT_FROM = 'moderate'
export const GAP_STATUSES = Object.freeze(['sufficient', 'limited', 'missing'])

const capability = id => skillCatalog[id] || (id === 'cyber' ? { id, labels: { ar: 'الأمن السيبراني', en: 'Cybersecurity' } } : { id, labels: { ar: id, en: id } })

export function statusForLevel(level) {
  if (!level || level === 'none') return 'missing'
  return compareLevels(level, SUFFICIENT_FROM) >= 0 ? 'sufficient' : 'limited'
}

// The fields a student can choose: reference job profiles (not job postings).
export const PATH_FIELDS = targetProfiles.filter(target => target.type === 'job')

export function computeGap(skills, targetId, { targets = targetProfiles } = {}) {
  const target = targets.find(item => item.id === targetId)
  if (!target) throw new Error('PATH_TARGET_NOT_FOUND')
  const have = new Map((skills || []).map(skill => [skill.id, skill]))
  const requirements = (target.requiredSkills || []).map(id => {
    const level = have.get(id)?.evidenceLevel || 'none'
    return { capability: id, labels: capability(id).labels, level, status: statusForLevel(level) }
  })
  return {
    version: GAP_VERSION,
    targetId: target.id,
    targetTitle: target.title,
    requirements,
    gaps: requirements.filter(r => r.status !== 'sufficient'),
    hasGap: requirements.some(r => r.status !== 'sufficient'),
    noRequirements: requirements.length === 0,
  }
}
