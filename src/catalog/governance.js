// Governance metadata for every catalog relation: source, version, review date, review owner
// and validity scope. A relation without all five is not publishable. Taxonomy roles are
// explicit: ESCO is a terminology and relations source, O*NET is occupational context, and
// SSCO alignment stays unresolved until a code-and-meaning review produces a valid match.
import { targetProfiles, TARGET_CATALOG_VERSION } from '../matching/targets.js'
import { courseSkillMap } from '../data.js'

export const DEFAULT_REVIEW_OWNER = { ar: 'مراجع مختص لم يُعيَّن بعد', en: 'Specialist reviewer not yet assigned' }
export const DEFAULT_VALIDITY_SCOPE = { ar: 'تجربة الحوسبة في KAU-FCIT فقط؛ لا يُعمَّم على برامج أخرى', en: 'KAU-FCIT computing pilot only; not generalised to other programmes' }
export const TAXONOMY_ROLES = {
  esco: { ar: 'مصدر مصطلحات وعلاقات (بالعربية أيضًا)؛ ليس دليلًا على الطلب السعودي', en: 'Terminology and relations source (Arabic included); not evidence of Saudi demand' },
  onet: { ar: 'سياق مهني فقط؛ ليس متطلبات سعودية ولا طلب سوق', en: 'Occupational context only; neither Saudi requirements nor market demand' },
  ssco: { ar: 'مواءمة على مستوى الرمز والمعنى؛ غير محسومة حتى وجود تطابق صالح مُراجَع', en: 'Code-and-meaning alignment; unresolved until a reviewed valid match exists' },
}

export function relationGovernance(target) {
  const codes = target.occupationCodes || {}
  return {
    id: target.id,
    source: target.source || null,
    version: TARGET_CATALOG_VERSION,
    reviewedAt: target.source?.checked || null,
    reviewOwner: target.reviewOwner || DEFAULT_REVIEW_OWNER,
    validityScope: target.validityScope || DEFAULT_VALIDITY_SCOPE,
    esco: codes.esco ? { id: codes.esco, role: TAXONOMY_ROLES.esco } : null,
    onet: codes.onet ? { id: codes.onet, role: TAXONOMY_ROLES.onet } : null,
    ssco: { code: codes.ssco || null, status: codes.ssco ? 'pending-code-and-meaning-review' : 'unresolved', role: TAXONOMY_ROLES.ssco },
  }
}

export function mappingGovernance(code) {
  const mapping = courseSkillMap[code]
  if (!mapping) return null
  return {
    code, skills: mapping.skills, evidenceType: mapping.evidenceType,
    source: { title: 'Kamin pilot course-to-outcome mapping', url: '/mapping.html' },
    version: 'course-skill-map-pilot-v1',
    reviewedAt: '2026-09-26',
    reviewOwner: { ar: 'قسم تقنية المعلومات KAU-FCIT (اعتماد معلّق)', en: 'KAU-FCIT IT department (approval pending)' },
    validityScope: { ar: 'رموز مقررات برنامج تقنية المعلومات في KAU-FCIT فقط', en: 'KAU-FCIT IT programme course codes only' },
  }
}

const complete = g => !!(g.source && g.version && g.reviewedAt && g.reviewOwner && g.validityScope)

// Every relation in the catalog, with a completeness flag a test can enforce.
export function catalogGovernanceReport() {
  const relations = targetProfiles.map(relationGovernance).map(g => ({ kind: 'pathway', ...g, complete: complete(g) }))
  const mappings = Object.keys(courseSkillMap).map(mappingGovernance).map(g => ({ kind: 'course-mapping', ...g, complete: complete(g) }))
  return { version: TARGET_CATALOG_VERSION, relations, mappings, incomplete: [...relations, ...mappings].filter(g => !g.complete).map(g => g.id || g.code) }
}

export const governanceLine = (g, lang) => [
  `${lang === 'ar' ? 'الإصدار' : 'Version'}: ${g.version}`,
  `${lang === 'ar' ? 'روجع' : 'Reviewed'}: ${g.reviewedAt}`,
  `${lang === 'ar' ? 'مالك المراجعة' : 'Review owner'}: ${g.reviewOwner[lang]}`,
  `${lang === 'ar' ? 'نطاق الصلاحية' : 'Validity scope'}: ${g.validityScope[lang]}`,
  ...(g.ssco ? [`SSCO: ${g.ssco.status === 'unresolved' ? (lang === 'ar' ? 'غير محسوم' : 'unresolved') : g.ssco.code}`] : []),
].join(' · ')
