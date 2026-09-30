// Portable export shaped after 1EdTech Comprehensive Learner Record 2.0 / Open Badges 3.0.
//
// This is an UNSIGNED, self-issued document: it carries no proof, names Kamin as a
// self-issuance profile and marks every achievement as self-asserted with its provenance
// level. A receiving system can read the structure today and replace the issuer and
// proof once institutional verification exists. It is not a conformance claim.
import { skills as catalog } from '../data.js'
import { copy } from '../i18n.js'
import { skillProvenance, rowProvenance } from './provenance.js'
import { normalizeProjectEvidence } from './projectEvidence.js'

export const CLR_CONTEXT = ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/clr/v2p0/context-2.0.1.json']
export const CLR_EXPORT_VERSION = 'kamin-clr-shaped-export-v1'
const skillById = Object.fromEntries(Object.values(catalog).map(skill => [skill.id, skill]))
const localized = (value, lang) => typeof value === 'string' ? value : (value?.[lang] || value?.en || value?.ar || '')

function courseResult(row, lang) {
  const provenance = rowProvenance(row)
  return {
    type: 'Result',
    resultDescription: `urn:kamin:course:${row.code}`,
    value: String(row.grade || ''),
    status: 'Completed',
    'kamin:course': { code: row.code, name: localized(row.name, lang), hours: row.hours ?? null },
    'kamin:provenanceLevel': provenance.level,
    'kamin:editedFields': provenance.edits,
    'kamin:gradeRaisedByStudent': provenance.gradeRaised,
  }
}

export function buildClrExport({ state, skills = [], lang = 'ar', now = new Date() } = {}) {
  if (!state || typeof state !== 'object') throw new Error('PROFILE_STATE_REQUIRED')
  const projects = normalizeProjectEvidence(state.projects)
  const issued = now.toISOString()
  const subject = 'urn:kamin:person:local'
  const issuer = {
    id: 'urn:kamin:issuer:self',
    type: 'Profile',
    name: 'Kamin — self-issued by the learner (unverified)',
    description: 'Generated locally in the learner’s browser from reviewed inputs. No institution has verified this document.',
  }
  const achievements = skills.map(skill => {
    const provenance = skillProvenance(skill)
    const projectEvidence = projects.filter(p => p.skillIds.includes(skill.id))
    return {
      '@context': CLR_CONTEXT,
      id: `urn:kamin:credential:capability:${skill.id}:${issued}`,
      type: ['VerifiableCredential', 'AchievementCredential'],
      issuer,
      validFrom: issued,
      name: localized(skill.labels, lang),
      credentialSubject: {
        type: 'AchievementSubject',
        id: subject,
        achievement: {
          id: skill.uri || `urn:kamin:skill:${skill.id}`,
          type: 'Achievement',
          achievementType: 'Competency',
          name: localized(skill.labels, lang),
          description: `Capability evidenced by governed course-to-outcome mappings (${provenance.level}).`,
          criteria: { narrative: 'Approved course → learning outcome → capability mapping in the Kamin pilot catalog. Not a professional eligibility judgment.' },
        },
        result: (skill.evidence || []).map(row => courseResult(row, lang)),
        source: { type: 'Profile', name: 'Learner-reviewed academic record (self-asserted)' },
      },
      evidence: projectEvidence.map(project => ({
        type: 'Evidence',
        id: project.url || `urn:kamin:evidence:project:${project.id}`,
        name: project.title,
        description: project.description || undefined,
        genre: project.kind,
        'kamin:provenanceLevel': project.level,
        'kamin:reviewStatus': project.reviewStatus,
      })),
      'kamin:evidenceStrength': skill.confidenceLabel || 'preliminary',
      'kamin:provenanceLevel': provenance.level,
      'kamin:verificationStatus': 'self-asserted',
    }
  })
  return {
    '@context': CLR_CONTEXT,
    id: `urn:kamin:clr:${issued}`,
    type: ['VerifiableCredential', 'ClrCredential'],
    issuer,
    validFrom: issued,
    name: lang === 'ar' ? 'سجل قدرات كامن — تصدير محمول غير موقّع' : 'Kamin capability record — unsigned portable export',
    credentialSubject: {
      type: 'ClrSubject',
      id: subject,
      verifiableCredential: achievements,
      'kamin:goal': state.goal ? (copy[lang]?.app?.goals?.[state.goal] || state.goal) : null,
      'kamin:unmappedCourses': (state.courses || []).filter(row => !skills.some(skill => (skill.evidence || []).some(e => e.code === row.code))).map(row => courseResult(row, lang)),
    },
    'kamin:exportVersion': CLR_EXPORT_VERSION,
    'kamin:verificationStatus': 'self-asserted',
    'kamin:notice': 'Unsigned export generated in the learner’s browser. Achievements are self-asserted; provenance levels show which rows came from a document and which were edited or declared. Nothing here is institutionally verified.',
  }
}

export function clrExportFilename(now = new Date()) {
  return `kamin-clr-export-${now.toISOString().slice(0, 10)}.jsonld`
}
