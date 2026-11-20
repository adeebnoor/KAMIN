import { opportunities, skills as skillCatalog } from '../data.js'
import { canonicalCourseCode } from '../ontology/registry.js'
import { mappingReviewStatus } from '../catalog/fcit.js'
import { normalizeGrade } from './grades.js'
import { rowProvenance } from './provenance.js'
import { evidenceLevel, strongest, compareLevels, EVIDENCE_LEVELS_VERSION } from '../evidence/levels.js'
import { normalizeCollege } from '../catalog/colleges.js'
import { courseMapFor, courseSkillMapFor } from '../catalog/courseMaps.js'

export { normalizeGrade }
const normalizeCode = canonicalCourseCode
const skillEntry = id => skillCatalog[id] || (id === 'cyber' ? { id, labels: { ar: 'الأمن السيبراني', en: 'Cybersecurity' } } : null)

// Evidence level of one transcript row against the official course map (Task 02). Task 37: the map of
// `college` (FCIT when omitted, as before); a college without an approved map has no mapping.
export function rowEvidence(course, { college = 'FCIT' } = {}) {
  const code = normalizeCode(course?.code)
  const mapping = courseSkillMapFor(college)?.[code]
  const entry = courseMapFor(college)?.course(code) || null
  const provenance = rowProvenance(course)
  return evidenceLevel({
    grade: course?.grade,
    originalGrade: course?.edits?.grade,
    editedFields: provenance.edits,
    assessment: entry?.assessment,
    provenance: provenance.level,
    mappingStatus: !mapping ? 'missing' : mappingReviewStatus(entry) === 'reviewed' ? 'approved' : 'proposed',
  })
}

// Verified credentials from a trusted issuer (tier T4) are practical evidence for the
// capabilities they declare. Only records whose issuer was trusted at import count.
function practicalEvidence(credentials) {
  const items = []
  for (const record of credentials || []) {
    if (record?.outcome !== 'verified' || record.issuerTrusted !== true) continue
    for (const achievement of record.achievements || []) {
      const id = String(achievement?.id || '').match(/^urn:kamin:skill:([a-z0-9-]+)$/)?.[1]
      if (!id || !skillEntry(id)) continue
      const level = evidenceLevel({ provenance: 'verified-credential' })
      items.push({ skillId: id, kind: 'credential', credentialId: record.credentialId || record.id, issuerId: record.issuerId, issuerName: record.issuerName, name: achievement.name || null, evidenceLevel: level.level, basis: level.basis, reasons: level.reasons })
    }
  }
  return items
}

/**
 * Capabilities supported by evidence. Each row carries its own ordinal level and reasons; the
 * capability shows its academic and practical levels separately (strongest supporting row of
 * each kind). A row whose level is 'none' — failed/withdrawn, typed by hand, unmapped — creates
 * nothing. No numeric confidence is produced.
 *
 * `college` selects the approved course map (Task 04; Task 37: that college's own map, from
 * src/catalog/courseMaps.js). Library callers that omit it get the FCIT map; the app always passes
 * the student's choice, and `null` (not chosen) or a college without an approved map gives no
 * academic evidence. Verified credentials do not depend on the college.
 */
export function inferSkills(courses, { credentials = [], college = 'FCIT' } = {}) {
  const academic = new Map()
  const courseMap = courseSkillMapFor(college)
  for (const course of courseMap ? courses || [] : []) {
    const mapping = courseMap[normalizeCode(course?.code)]
    if (!mapping) continue
    const result = rowEvidence(course, { college })
    if (result.level === 'none') continue
    for (const id of mapping.skills) {
      if (!skillEntry(id)) continue
      const list = academic.get(id) || []
      list.push({ ...course, learningOutcome: mapping.learningOutcome, evidenceType: mapping.evidenceType, evidenceLevel: result.level, basis: result.basis, reasons: result.reasons, factors: result.factors })
      academic.set(id, list)
    }
  }
  const practical = new Map()
  for (const item of practicalEvidence(credentials)) practical.set(item.skillId, [...(practical.get(item.skillId) || []), item])

  return [...new Set([...academic.keys(), ...practical.keys()])].map(id => {
    const evidence = academic.get(id) || []
    const practicalItems = practical.get(id) || []
    const academicLevel = evidence.length ? strongest(...evidence.map(e => e.evidenceLevel)) : 'none'
    const practicalLevel = practicalItems.length ? strongest(...practicalItems.map(e => e.evidenceLevel)) : 'none'
    const best = [...evidence].sort((a, b) => compareLevels(b.evidenceLevel, a.evidenceLevel))[0]
    return {
      ...skillEntry(id),
      evidenceLevel: strongest(academicLevel, practicalLevel),
      academicLevel, practicalLevel,
      basis: practicalLevel !== 'none' ? 'practical' : 'academic',
      reasons: best?.reasons || practicalItems[0]?.reasons || [],
      evidenceLevelsVersion: EVIDENCE_LEVELS_VERSION,
      isPreliminary: true,
      evidence,
      practicalEvidence: practicalItems,
    }
  }).sort((a, b) => compareLevels(b.evidenceLevel, a.evidenceLevel) || b.evidence.length - a.evidence.length || a.id.localeCompare(b.id))
}

// Rows typed by hand that would map to a capability: shown as "waiting for a document or
// review" and never counted as evidence.
export function awaitingEvidence(courses, { college = 'FCIT' } = {}) {
  const courseMap = courseSkillMapFor(college)
  return (courseMap ? courses || [] : []).flatMap(course => {
    const mapping = courseMap[normalizeCode(course?.code)]
    if (!mapping || rowProvenance(course).level !== 'declared') return []
    return [{ code: normalizeCode(course.code), name: course.name, grade: course.grade, skills: mapping.skills.filter(skillEntry), reasons: rowEvidence(course, { college }).reasons }]
  })
}

// The capabilities of a saved profile: only after approval, using the
// student's own college (null until chosen). App surfaces use this, never inferSkills(state.courses).
export function profileSkills(state) {
  if (!state?.approved) return []
  return inferSkills(state.courses, { credentials: state.credentials, college: normalizeCollege(state.college) })
}

const statusRank={yes:0,conditional:1,no:2}
export function judgeOpportunities(skills, goal = null, lang = 'ar') {
  const map=new Map((skills||[]).map(s=>[s.id,s]))
  const t=(ar,en)=>lang==='ar'?ar:en
  return opportunities.map(opp=>{
    const required=(opp.requires||[])
    const teaches=(opp.teaches||[])
    const presentRequired=required.filter(id=>map.has(id))
    const presentTaught=teaches.filter(id=>map.has(id))
    const goalMatch=goal ? opp.goals.includes(goal) : null
    let status='conditional'
    let gapCode='bridgeable'
    let gapType=t('فجوة قابلة للسد','Bridgeable gap')
    let becomes=t('تسد الفجوة المطلوبة بدليل مناسب.','You bridge the required gap with suitable evidence.')
    const reasons=[]
    if (opp.formalGate) {
      status='no'; gapCode='formal-gate'; gapType=t('ليس الآن','Not yet')
      becomes=opp.formalGate.alternative[lang]
      reasons.push(opp.formalGate.text[lang])
      reasons.push(t('الشرط الرسمي له مصدر وتاريخ مراجعة، ولا يُستبدل بمقرر أكاديمي.','The formal condition has a source and review date and is not replaced by academic coursework.'))
    } else if (goal && !goalMatch) {
      status='no'; gapCode='goal-mismatch'; gapType=t('تعارض مع رغبتك','Goal mismatch')
      becomes=t('تغيّر هدفك أو تستخدم الدورة كمسار ثانوي واضح.','Your goal changes or you deliberately use the course as a secondary path.')
    } else if (required.some(id=>!map.has(id))) {
      status='no'; gapCode='prerequisite-gap'; gapType=t('فجوة قابلة للسد','Bridgeable gap')
      becomes=t('تضيف دليلًا على المتطلب السابق قبل البدء.','You add evidence for the prerequisite before starting.')
    } else if (teaches.length && presentTaught.length === teaches.length) {
      status='no'; gapCode='repetition'; gapType=t('تكرار','Repetition')
      becomes=t('تختار مستوى أعلى بدل إعادة ما لديك عليه دليل بالفعل.','You choose a higher level instead of repeating content you already evidence.')
    } else if (!goal) {
      status='conditional'; gapCode='no-goal'; gapType=t('استكشاف بلا هدف محدد','Exploration without a chosen goal')
      becomes=t('تختار هدفًا أولًا حتى يصبح الحكم مرتبطًا بما تريد تحقيقه.','You choose a goal first so the judgment is tied to what you want to achieve.')
    } else {
      status='yes'; gapCode='ready'; gapType=t('لا توجد فجوة جوهرية ظاهرة','No material gap is visible')
      becomes=t('تتأكد من شروط المزود وتختار المستوى المناسب.','You verify provider prerequisites and choose the right level.')
    }
    if (presentRequired.length) reasons.push(t(
      `لدينا دليل مباشر على: ${presentRequired.map(id=>map.get(id).labels.ar).join('، ')}.`,
      `We have direct evidence for: ${presentRequired.map(id=>map.get(id).labels.en).join(', ')}.`
    ))
    if (!required.length && !teaches.length) reasons.push(t('هذه الفرصة لا تحتوي متطلبات معرفة مهيكلة بعد.','This opportunity has no structured knowledge requirements yet.'))
    const coverage=required.length?presentRequired.length/required.length:1
    const score=Math.round(Math.max(0,Math.min(100,coverage*70+(goalMatch===true?20:0)+(status==='yes'?10:0))))
    return {...opp,status,gapCode,gapType,becomes,reasons,score,isPreliminary:true,formalSource:opp.formalGate?.source||null}
  }).sort((a,b)=>statusRank[a.status]-statusRank[b.status] || b.score-a.score)
}
