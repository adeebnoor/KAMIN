// Task 04 · recompute capabilities when the record or the college changes.
// Supervisor (10 Nov 2026): previously inferred capabilities must be recomputed, evidence that
// no longer has a source must drop, and the student must see what changed.
//
// recomputeProfile(prev, next) is pure: it never mutates either profile and never deletes derived
// items (reviews, tasks, projects). Those are returned in `staleDerived` so the app can flag them
// "needs review".
import { profileSkills, rowEvidence } from '../utils/engine.js'
import { opportunities, skills as skillCatalog } from '../data.js'
import { canonicalCourseCode } from '../ontology/registry.js'
import { collegeHasMap, normalizeCollege, collegeLabel } from '../catalog/colleges.js'
import { courseSkillMapFor } from '../catalog/courseMaps.js'
import { normalizeGrade } from '../utils/grades.js'
import { compareLevels, levelLabel } from './levels.js'
import { targetProfiles } from '../matching/targets.js'
import { taskById } from '../tasks/catalog.js'

export const RECOMPUTE_VERSION = 'kamin-recompute-v1'

export const CHANGE_REASONS = Object.freeze({
  'course-removed': { ar: 'حُذف المقرر من سجلك', en: 'the course was removed from your record' },
  'grade-now-non-evidence': { ar: 'أصبحت الدرجة لا تُعد دليلًا (رسوب أو انسحاب أو غير مكتملة)', en: 'the grade no longer counts as evidence (fail, withdrawal or incomplete)' },
  'grade-changed': { ar: 'تغيّرت الدرجة', en: 'the grade changed' },
  'source-downgraded': { ar: 'أصبح مصدر الصف أضعف (عُدّل يدويًا أو أُدخل يدويًا)', en: 'the row’s source became weaker (edited or typed by hand)' },
  'source-changed': { ar: 'تغيّر مصدر الصف', en: 'the row’s source changed' },
  'college-changed-no-map': { ar: 'لا توجد خريطة مقررات معتمدة لكليتك بعد', en: 'your college has no approved course map yet' },
  'college-changed': { ar: 'تغيّرت كليتك واستُخدمت خريطتها المعتمدة', en: 'your college changed and its approved map was used' },
  'mapping-changed': { ar: 'تغيّر ربط المقرر بالقدرة', en: 'the course-to-capability mapping changed' },
  'consent-withdrawn': { ar: 'سحبت موافقة تحليل السجل', en: 'you withdrew consent to analyze your record' },
  'course-added': { ar: 'أُضيف مقرر يدعمها', en: 'a supporting course was added' },
  'credential-changed': { ar: 'تغيّر اعتماد موثّق يدعمها', en: 'a verified credential supporting it changed' },
})

export const changeReasonText = (code, lang = 'ar') => CHANGE_REASONS[code]?.[lang] || CHANGE_REASONS['mapping-changed'][lang]

const active = profile => !!profile?.approved && profile?.consents?.analyze !== false
const labelsOf = id => skillCatalog[id]?.labels || { ar: id, en: id }
const rowsByCode = profile => new Map((profile?.courses || []).map(row => [canonicalCourseCode(row.code), row]))
const codesOf = skill => new Set((skill?.evidence || []).map(e => canonicalCourseCode(e.code)))

// Why one course no longer supports one capability.
function dropReason(code, skillId, prev, next, nextRows) {
  if (!active(next)) return 'consent-withdrawn'
  const nextCollege = normalizeCollege(next.college)
  if (!collegeHasMap(nextCollege)) return 'college-changed-no-map'
  const row = nextRows.get(code)
  if (!row) return 'course-removed'
  // Task 37: the next college's own map (only colleges with an approved map get this far).
  const mapping = courseSkillMapFor(nextCollege)?.[code]
  if (!mapping || !mapping.skills.includes(skillId)) return 'mapping-changed'
  const now = rowEvidence(row)
  if (now.factors.grade === 'none') return 'grade-now-non-evidence'
  const before = rowsByCode(prev).get(code)
  if (now.factors.source === 'none' || (before && compareLevels(now.factors.source, rowEvidence(before).factors.source) < 0)) return 'source-downgraded'
  return 'mapping-changed'
}

// Why a capability that exists before and after (or appears) changed level.
function changeReason(prevSkill, nextSkill, prev, next) {
  if (normalizeCollege(prev?.college) !== normalizeCollege(next?.college)) return 'college-changed'
  const prevRows = rowsByCode(prev), nextRows = rowsByCode(next)
  const before = codesOf(prevSkill), after = codesOf(nextSkill)
  for (const code of after) if (!before.has(code)) return prevRows.has(code) ? reasonForRow(prevRows.get(code), nextRows.get(code)) || 'mapping-changed' : 'course-added'
  for (const code of before) if (!after.has(code)) return dropReason(code, nextSkill?.id || prevSkill?.id, prev, next, nextRows)
  for (const code of after) {
    const reason = reasonForRow(prevRows.get(code), nextRows.get(code))
    if (reason) return reason
  }
  if ((prevSkill?.practicalLevel || 'none') !== (nextSkill?.practicalLevel || 'none')) return 'credential-changed'
  return 'mapping-changed'
}

function reasonForRow(before, after) {
  if (!before || !after) return null
  if (normalizeGrade(before.grade) !== normalizeGrade(after.grade)) return 'grade-changed'
  const a = rowEvidence(before), b = rowEvidence(after)
  const source = compareLevels(b.factors.source, a.factors.source)
  if (source < 0) return 'source-downgraded'
  if (source > 0 || a.factors.tier !== b.factors.tier) return 'source-changed'
  if (a.factors.mapping !== b.factors.mapping) return 'mapping-changed'
  return null
}

const requiredSkillsOf = review => review.kind === 'course'
  ? opportunities.find(o => o.id === review.targetId)?.requires || []
  : targetProfiles.find(t => t.id === review.targetId)?.requiredSkills || []

// Reviews, tasks and projects that relied on a capability that just lost all its evidence.
function staleDerivedItems(next, removedIds) {
  if (!removedIds.size) return []
  const hit = ids => [...new Set(ids)].filter(id => removedIds.has(id))
  const items = []
  for (const review of next?.recommendationReviews || []) {
    if (review.action === 'withdrawn') continue
    const skillIds = hit(requiredSkillsOf(review))
    if (skillIds.length) items.push({ kind: 'recommendation-review', id: review.id, targetId: review.targetId, title: review.title, skillIds, status: 'needs-review' })
  }
  for (const record of next?.tasks || []) {
    const task = taskById(record.taskId)
    if (!task || record.status === 'not-started') continue
    const skillIds = hit(task.skillIds)
    if (skillIds.length) items.push({ kind: 'task', id: task.id, title: task.title, skillIds, status: 'needs-review' })
  }
  for (const project of next?.projects || []) {
    const skillIds = hit(project.skillIds || [])
    if (skillIds.length) items.push({ kind: 'project', id: project.id, title: { ar: project.title, en: project.title }, skillIds, status: 'needs-review' })
  }
  return items
}

/**
 * @param {object} prev  profile before the change ({approved, consents, college, courses, credentials, recommendationReviews, tasks, projects})
 * @param {object} next  profile after the change
 * @returns {{skills: object[], diff: {added, removed, changed, droppedEvidence, staleDerived}, version: string}}
 */
export function recomputeProfile(prev, next) {
  const before = profileSkills(prev)
  const skills = profileSkills(next)
  const beforeById = new Map(before.map(s => [s.id, s]))
  const afterById = new Map(skills.map(s => [s.id, s]))
  const nextRows = rowsByCode(next)

  const droppedEvidence = []
  for (const skill of before) {
    const kept = codesOf(afterById.get(skill.id))
    for (const code of codesOf(skill)) {
      if (!kept.has(code)) droppedEvidence.push({ courseCode: code, skillId: skill.id, labels: labelsOf(skill.id), reason: dropReason(code, skill.id, prev, next, nextRows) })
    }
  }

  const added = skills.filter(s => !beforeById.has(s.id)).map(s => ({
    skillId: s.id, labels: labelsOf(s.id), to: s.evidenceLevel,
    reason: active(prev) ? changeReason(null, s, prev, next) : 'course-added',
    evidence: s.evidence.map(e => ({ courseCode: canonicalCourseCode(e.code), evidenceLevel: e.evidenceLevel })),
    practicalEvidence: (s.practicalEvidence || []).map(e => ({ credentialId: e.credentialId, evidenceLevel: e.evidenceLevel })),
  }))

  const removed = before.filter(s => !afterById.has(s.id)).map(s => {
    const own = droppedEvidence.filter(d => d.skillId === s.id)
    const reason = own[0]?.reason || (!active(next) ? 'consent-withdrawn' : (s.practicalLevel || 'none') !== 'none' ? 'credential-changed' : 'mapping-changed')
    return { skillId: s.id, labels: labelsOf(s.id), from: s.evidenceLevel, reason }
  })

  const changed = skills.filter(s => beforeById.has(s.id) && beforeById.get(s.id).evidenceLevel !== s.evidenceLevel).map(s => {
    const was = beforeById.get(s.id)
    return { skillId: s.id, labels: labelsOf(s.id), from: was.evidenceLevel, to: s.evidenceLevel, reason: changeReason(was, s, prev, next) }
  })

  const staleDerived = staleDerivedItems(next, new Set(removed.map(r => r.skillId)))
  // Each item carries its reason in both languages so the UI needs no copy of the reason table.
  const withText = list => list.map(item => item.reason ? { ...item, reasonText: CHANGE_REASONS[item.reason] || CHANGE_REASONS['mapping-changed'] } : item)
  return { skills, diff: { added: withText(added), removed: withText(removed), changed: withText(changed), droppedEvidence: withText(droppedEvidence), staleDerived }, version: RECOMPUTE_VERSION }
}

export const diffIsEmpty = diff => !diff || ['added', 'removed', 'changed', 'droppedEvidence', 'staleDerived'].every(k => !(diff[k] || []).length)

// Task 04: the before/after difference in plain language (capability names, course codes and
// reasons; never technical IDs).
const quoted=(labels,lang)=>lang==='ar'?`«${labels?.ar||''}»`:`“${labels?.en||''}”`
export function describeDiff(diff,lang){
  if(!diff) return []
  const ar=lang==='ar'
  const out=[]
  const why=item=>item.reasonText?.[lang]||''
  for(const a of diff.added||[]) out.push(ar?`أُضيفت قدرة ${quoted(a.labels,lang)} (${levelLabel(a.to,lang)}) — السبب: ${why(a)}.`:`Added ${quoted(a.labels,lang)} (${levelLabel(a.to,lang)}) — because ${why(a)}.`)
  for(const r of diff.removed||[]) out.push(ar?`أُزيلت قدرة ${quoted(r.labels,lang)} — السبب: ${why(r)}.`:`Removed ${quoted(r.labels,lang)} — because ${why(r)}.`)
  for(const c of diff.changed||[]) out.push(ar?`تغيّر مستوى ${quoted(c.labels,lang)} من ${levelLabel(c.from,lang)} إلى ${levelLabel(c.to,lang)} — السبب: ${why(c)}.`:`${quoted(c.labels,lang)} changed from ${levelLabel(c.from,lang)} to ${levelLabel(c.to,lang)} — because ${why(c)}.`)
  const removedIds=new Set((diff.removed||[]).map(r=>r.skillId))
  for(const d of (diff.droppedEvidence||[]).filter(d=>!removedIds.has(d.skillId))) out.push(ar?`لم يعد ${d.courseCode} دليلًا على ${quoted(d.labels,lang)} — السبب: ${why(d)}.`:`${d.courseCode} no longer counts as evidence for ${quoted(d.labels,lang)} — because ${why(d)}.`)
  for(const s of diff.staleDerived||[]) out.push(ar?`يحتاج إلى مراجعة: ${quoted(s.title,lang)} لأنه اعتمد على قدرة لم يعد لها دليل.`:`Needs review: ${quoted(s.title,lang)} relied on a capability that no longer has evidence.`)
  if(!out.length) out.push(ar?'لم تتغير أي قدرة أو مستوى دليل.':'No capability or evidence level changed.')
  return out
}

export function recomputeAuditLabel(diff,lang,college){
  const n=k=>(diff?.[k]||[]).length
  const head=college!==undefined?(lang==='ar'?`تغيير الكلية إلى ${collegeLabel(college,'ar')||'غير محددة'} وإعادة حساب القدرات`:`College changed to ${collegeLabel(college,'en')||'not chosen'}; capabilities recomputed`):(lang==='ar'?'تعديل السجل المعتمد وإعادة حساب القدرات':'Approved record edited; capabilities recomputed')
  return lang==='ar'?`${head}: أُضيفت ${n('added')}، أُزيلت ${n('removed')}، تغيّر مستوى ${n('changed')}`:`${head}: ${n('added')} added, ${n('removed')} removed, ${n('changed')} changed level`
}

// Re-exported so callers can use one module.
export { mergeNeedsReview } from './needsReview.js'
