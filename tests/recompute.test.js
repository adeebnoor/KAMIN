import { describe, it, expect } from 'vitest'
import { recomputeProfile, mergeNeedsReview, diffIsEmpty, CHANGE_REASONS, changeReasonText } from '../src/evidence/recompute.js'
import { profileSkills, inferSkills } from '../src/utils/engine.js'
import { sweepOrphans, emptyPerson360, addEntity, addClaim, createClaim } from '../src/person360.js'
import { sweepOrphanInferences } from '../src/matching/inference.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'
import { normalizeCollege, collegeHasMap, COLLEGES, collegeFromText, cleanTranscriptText } from '../src/catalog/colleges.js'
import { buildPortableProfile, normalizePortableState } from '../src/utils/portableProfile.js'
import { demoCourses, demoCollegeRaw } from '../src/data.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { readTranscriptPages } from '../src/utils/transcript.js'
import { readPdf } from './helpers/readPdfText.js'
import { FIXTURE_DIR } from '../scripts/make-transcript-fixtures.mjs'
import { syntheticTranscript, SYNTHETIC_TRANSCRIPTS } from '../src/pilot/syntheticTranscripts.js'

// Task 04 · recompute capabilities when the record or college changes, drop unsourced evidence,
// show what changed.
const row = (code, grade, extra = {}) => ({ code, name: code, grade, source: 'pdf', ...extra })
const base = (courses, extra = {}) => ({ approved: true, consents: { analyze: true }, college: 'FCIT', courses, credentials: [], recommendationReviews: [], tasks: [], projects: [], ...extra })
const ids = list => list.map(x => x.skillId).sort()
const REASONS = ['course-removed', 'grade-now-non-evidence', 'grade-changed', 'source-downgraded', 'college-changed-no-map', 'mapping-changed', 'consent-withdrawn']

describe('colleges', () => {
  it('only FCIT has an approved map; unknown or missing values mean "not chosen"', () => {
    expect(COLLEGES.map(c => c.id)).toEqual(['FCIT', 'SCI', 'MED'])
    expect(collegeHasMap('FCIT')).toBe(true)
    expect(collegeHasMap('SCI')).toBe(false)
    expect(collegeHasMap('MED')).toBe(false)
    expect(collegeHasMap(null)).toBe(false)
    expect(normalizeCollege(undefined)).toBe(null)
    expect(normalizeCollege('fcit')).toBe(null)
    expect(normalizeCollege('SCI')).toBe('SCI')
  })

  it('profileSkills never assumes FCIT: no college or a college without a map gives no course evidence', () => {
    const courses = [row('CPIT-240', 'B')]
    expect(profileSkills(base(courses)).map(s => s.id)).toEqual(['database'])
    expect(profileSkills(base(courses, { college: null }))).toEqual([])
    expect(profileSkills(base(courses, { college: 'SCI' }))).toEqual([])
    expect(profileSkills(base(courses, { college: 'MED' }))).toEqual([])
    expect(profileSkills({ ...base(courses), approved: false })).toEqual([])
    // library default (demo surfaces) keeps the FCIT map
    expect(inferSkills(courses).map(s => s.id)).toEqual(['database'])
    expect(inferSkills(courses, { college: null })).toEqual([])
  })

  it('verified credentials do not depend on the college', () => {
    const credential = { outcome: 'verified', issuerTrusted: true, id: 'c1', credentialId: 'c1', achievements: [{ id: 'urn:kamin:skill:database', name: 'SQL' }] }
    const skills = profileSkills(base([], { college: 'SCI', credentials: [credential] }))
    expect(skills.map(s => s.id)).toEqual(['database'])
    expect(skills[0].basis).toBe('practical')
  })
})

describe('recomputeProfile', () => {
  const prev = base([row('CPIT-240', 'B'), row('STAT-110', 'A'), row('CPIT-250', 'A')])

  it('is pure and every reason code has Arabic and English text', () => {
    const snapshot = JSON.stringify(prev)
    recomputeProfile(prev, { ...prev, courses: [] })
    expect(JSON.stringify(prev)).toBe(snapshot)
    for (const code of REASONS) {
      expect(CHANGE_REASONS[code].ar).toBeTruthy()
      expect(CHANGE_REASONS[code].en).toBeTruthy()
    }
    expect(changeReasonText('course-removed', 'en')).toBe('the course was removed from your record')
  })

  it('no change gives an empty diff', () => {
    const { diff, skills } = recomputeProfile(prev, { ...prev })
    expect(diffIsEmpty(diff)).toBe(true)
    expect(skills.map(s => s.id).sort()).toEqual(['database', 'requirements', 'statistics'])
  })

  it('removing CPIT-240 drops database with reason course-removed', () => {
    const next = { ...prev, courses: prev.courses.filter(c => c.code !== 'CPIT-240') }
    const { diff, skills } = recomputeProfile(prev, next)
    expect(skills.map(s => s.id)).not.toContain('database')
    expect(diff.removed).toEqual([expect.objectContaining({ skillId: 'database', reason: 'course-removed', from: 'limited' })])
    expect(diff.droppedEvidence).toEqual([expect.objectContaining({ courseCode: 'CPIT-240', skillId: 'database', reason: 'course-removed' })])
    expect(diff.added).toEqual([])
    expect(diff.removed[0].labels.ar).toBe('قواعد البيانات')
  })

  it('a capability with other evidence is kept when one course is removed', () => {
    const p = base([row('CPIT-240', 'B'), row('CPCS-241', 'A')])
    const { diff, skills } = recomputeProfile(p, { ...p, courses: [row('CPCS-241', 'A')] })
    expect(skills.map(s => s.id)).toContain('database')
    expect(diff.removed).toEqual([])
    expect(diff.droppedEvidence).toEqual([expect.objectContaining({ courseCode: 'CPIT-240', skillId: 'database', reason: 'course-removed' })])
  })

  it('changing a grade from B to F drops the evidence with grade-now-non-evidence', () => {
    const next = { ...prev, courses: prev.courses.map(c => c.code === 'CPIT-240' ? { ...c, grade: 'F' } : c) }
    const { diff } = recomputeProfile(prev, next)
    expect(diff.removed).toEqual([expect.objectContaining({ skillId: 'database', reason: 'grade-now-non-evidence' })])
    expect(diff.droppedEvidence[0]).toMatchObject({ courseCode: 'CPIT-240', reason: 'grade-now-non-evidence' })
    // the same on a synthetic demo row and on a document row edited after extraction
    const demo = base([{ ...demoCourses.find(c => c.code === 'CPIT-240') }])
    expect(recomputeProfile(demo, { ...demo, courses: [{ ...demo.courses[0], grade: 'F' }] }).diff.removed[0].reason).toBe('grade-now-non-evidence')
    const edited = { ...row('CPIT-240', 'F'), edits: { grade: 'B' } }
    expect(recomputeProfile(base([row('CPIT-240', 'B')]), base([edited])).diff.removed[0].reason).toBe('grade-now-non-evidence')
  })

  it('a grade change that moves the level reports changed with grade-changed', () => {
    const p = base([{ ...row('CPIT-499', 'A') }])
    const lower = recomputeProfile(p, { ...p, courses: [row('CPIT-499', 'D')] })
    // every mapping is still proposed, so A and D are both "limited": no level change
    expect(lower.diff.changed).toEqual([])
    // a document row that becomes hand-typed drops (source-downgraded)
    const typed = recomputeProfile(p, { ...p, courses: [{ ...row('CPIT-499', 'A'), source: 'manual' }] })
    expect(ids(typed.diff.removed)).toEqual(['project', 'software'])
    expect(typed.diff.removed.every(r => r.reason === 'source-downgraded')).toBe(true)
  })

  it('switching FCIT → SCI drops every FCIT-map capability with college-changed-no-map; switching back restores them', () => {
    const toSci = recomputeProfile(prev, { ...prev, college: 'SCI' })
    expect(toSci.skills).toEqual([])
    expect(ids(toSci.diff.removed)).toEqual(['database', 'requirements', 'statistics'])
    expect(toSci.diff.removed.every(r => r.reason === 'college-changed-no-map')).toBe(true)
    expect(toSci.diff.droppedEvidence.every(d => d.reason === 'college-changed-no-map')).toBe(true)
    const sci = { ...prev, college: 'SCI' }
    const back = recomputeProfile(sci, { ...sci, college: 'FCIT' })
    expect(ids(back.diff.added)).toEqual(['database', 'requirements', 'statistics'])
    expect(back.diff.added.every(a => a.reason === 'college-changed')).toBe(true)
    expect(back.diff.added.find(a => a.skillId === 'database').evidence).toEqual([{ courseCode: 'CPIT-240', evidenceLevel: 'limited' }])
    expect(back.skills.map(s => s.id).sort()).toEqual(profileSkills(prev).map(s => s.id).sort())
  })

  it('clearing the college (not chosen) also drops course evidence', () => {
    expect(recomputeProfile(prev, { ...prev, college: null }).diff.removed.every(r => r.reason === 'college-changed-no-map')).toBe(true)
  })

  it('withdrawing consent drops everything with consent-withdrawn', () => {
    const { diff, skills } = recomputeProfile(prev, { ...prev, approved: false, consents: { analyze: false } })
    expect(skills).toEqual([])
    expect(diff.removed).toHaveLength(3)
    expect(diff.removed.every(r => r.reason === 'consent-withdrawn')).toBe(true)
  })

  it('re-coding a row to an unmapped catalog course drops the old course with course-removed', () => {
    // CPIT-260 (Operating Systems) is in the catalog with no capability: re-coding a row to it.
    const next = { ...prev, courses: prev.courses.map(c => c.code === 'CPIT-240' ? { ...c, code: 'CPIT-260' } : c) }
    const { diff } = recomputeProfile(prev, next)
    expect(diff.removed[0]).toMatchObject({ skillId: 'database', reason: 'course-removed' })
  })

  it('first approval lists every capability as added', () => {
    const { diff } = recomputeProfile({ approved: false, courses: [] }, prev)
    expect(ids(diff.added)).toEqual(['database', 'requirements', 'statistics'])
    expect(diff.added.every(a => a.reason === 'course-added')).toBe(true)
  })

  it('a recommendation review, task or project built on a dropped capability appears in staleDerived', () => {
    const p = base([row('CPIT-240', 'B'), row('STAT-110', 'A')], {
      recommendationReviews: [
        { id: 'review-1', kind: 'pathway', targetId: 'job-data-analyst', action: 'accepted', title: { ar: 'محلل بيانات', en: 'Data analyst' } },
        { id: 'review-2', kind: 'pathway', targetId: 'job-data-analyst', action: 'withdrawn', title: { ar: 'x', en: 'x' } },
      ],
      tasks: [{ taskId: 'task-sql-analysis', status: 'in-progress' }],
      projects: [{ id: 'p1', title: 'SQL dashboard', skillIds: ['database'] }],
    })
    const { diff } = recomputeProfile(p, { ...p, courses: [row('STAT-110', 'A')] })
    expect(diff.staleDerived.map(s => `${s.kind}:${s.id}`)).toEqual(['recommendation-review:review-1', 'task:task-sql-analysis', 'project:p1'])
    expect(diff.staleDerived.every(s => s.status === 'needs-review' && s.skillIds.includes('database'))).toBe(true)
    // nothing is deleted: the next profile still holds every derived item
    expect(p.recommendationReviews).toHaveLength(2)
  })
})

describe('needs-review flags', () => {
  const item = { kind: 'project', id: 'p1', title: { ar: 'مشروع', en: 'Project' }, skillIds: ['database'] }
  it('stay while the capability has no evidence and clear when it comes back', () => {
    const flagged = mergeNeedsReview([], [item], [], '2026-11-10T00:00:00.000Z')
    expect(flagged).toEqual([expect.objectContaining({ kind: 'project', id: 'p1', status: 'needs-review', flaggedAt: '2026-11-10T00:00:00.000Z' })])
    expect(mergeNeedsReview(flagged, [], [{ id: 'statistics' }])).toHaveLength(1)
    expect(mergeNeedsReview(flagged, [], [{ id: 'database' }])).toEqual([])
    expect(mergeNeedsReview([{ kind: 'bogus', id: 'x', skillIds: ['database'] }, null], [], [])).toEqual([])
  })
})

describe('sweepOrphans: no evidence claim without existing evidence', () => {
  it('removes demonstrates/verifiedBy claims whose evidence or capability is missing', () => {
    let g = emptyPerson360()
    g = addEntity(g, { '@id': 'urn:kamin:evidence:course:CPIT-240', '@type': 'Evidence' })
    g = addEntity(g, { '@id': 'urn:kamin:skill:database', '@type': 'Competency' })
    const claim = (id, predicate, source, object) => createClaim({ id, predicate, source, object })
    g = addClaim(g, claim('urn:kamin:claim:ok', 'kamin:demonstrates', 'urn:kamin:evidence:course:CPIT-240', 'urn:kamin:skill:database'))
    g = addClaim(g, claim('urn:kamin:claim:gone', 'kamin:demonstrates', 'urn:kamin:evidence:course:CPIT-999', 'urn:kamin:skill:database'))
    g = addClaim(g, claim('urn:kamin:claim:noskill', 'kamin:demonstrates', 'urn:kamin:evidence:course:CPIT-240', 'urn:kamin:skill:missing'))
    g = addClaim(g, claim('urn:kamin:claim:cred', 'kamin:verifiedBy', 'urn:kamin:evidence:credential:x', 'urn:kamin:skill:database'))
    g = addClaim(g, claim('urn:kamin:claim:goal', 'kamin:pursuesGoal', 'urn:kamin:evidence:self-declaration', 'urn:kamin:goal:data'))
    const { graph, removed } = sweepOrphans(g)
    expect(graph.claims.map(c => c['@id'])).toEqual(['urn:kamin:claim:ok', 'urn:kamin:claim:goal'])
    expect(removed.map(r => [r.id, r.reason])).toEqual([['urn:kamin:claim:gone', 'source-missing'], ['urn:kamin:claim:noskill', 'object-missing'], ['urn:kamin:claim:cred', 'source-missing']])
    expect(sweepOrphans(graph).removed).toEqual([])
  })

  it('stale skills projected after an edit leave no demonstrates claim without its course', () => {
    const before = base([row('CPIT-240', 'B'), row('STAT-110', 'A')])
    const staleSkills = profileSkills(before)
    const after = { ...before, courses: [row('STAT-110', 'A')] }
    const graph = projectStateToPerson360({ state: after, skills: staleSkills })
    const entityIds = new Set(graph.entities.map(e => e['@id']))
    const demonstrates = graph.claims.filter(c => c.predicate === 'kamin:demonstrates')
    expect(demonstrates.length).toBeGreaterThan(0)
    expect(demonstrates.every(c => entityIds.has(c.source))).toBe(true)
    expect(demonstrates.some(c => c.source.includes('CPIT-240'))).toBe(false)
  })

  it('after any edit every demonstrates claim and R1 inference points at existing evidence', () => {
    const edits = [
      s => ({ ...s, courses: s.courses.filter(c => c.code !== 'CPIT-240') }),
      s => ({ ...s, courses: s.courses.map(c => ({ ...c, grade: 'F' })) }),
      s => ({ ...s, college: 'SCI' }),
      s => ({ ...s, courses: s.courses.map(c => ({ ...c, source: 'manual' })) }),
    ]
    for (const edit of edits) {
      const prev = base([row('CPIT-240', 'B'), row('STAT-110', 'A'), row('CPIT-250', 'A')])
      const next = edit(prev)
      const { skills } = recomputeProfile(prev, next)
      const graph = projectStateToPerson360({ state: next, skills })
      const entityIds = new Set(graph.entities.map(e => e['@id']))
      const claimIds = new Set(graph.claims.map(c => c['@id']))
      expect(graph.claims.filter(c => c.predicate === 'kamin:demonstrates').every(c => entityIds.has(c.source) && entityIds.has(c.object))).toBe(true)
      for (const match of matchTargets(buildMatchingProfile({ graph }), { lang: 'en' })) {
        for (const inference of match.inferences.filter(i => i.ruleId === 'R1')) {
          expect(claimIds.has(inference.claimId)).toBe(true)
          expect(entityIds.has(inference.evidenceId)).toBe(true)
        }
      }
    }
  })

  it('sweepOrphanInferences drops an R1 conclusion whose claim is gone and keeps context rules', () => {
    const graph = { claims: [{ '@id': 'c1' }], entities: [{ '@id': 'e1' }] }
    const kept = sweepOrphanInferences([
      { ruleId: 'R1', claimId: 'c1', evidenceId: 'e1' },
      { ruleId: 'R1', claimId: 'c2', evidenceId: 'e1' },
      { ruleId: 'R2', claimId: 'x', evidenceId: 'y' },
    ], graph)
    expect(kept.map(i => i.claimId)).toEqual(['c1', 'x'])
  })
})

describe('storage and backup', () => {
  it('the encrypted-backup payload carries the college; old backups restore as "not chosen"', () => {
    const state = { ...base([row('CPIT-240', 'B')], { college: 'SCI' }), needsReview: [{ kind: 'project', id: 'p1', title: { ar: 'a', en: 'a' }, skillIds: ['database'] }] }
    const payload = buildPortableProfile({ state })
    expect(payload.state.college).toBe('SCI')
    expect(normalizePortableState(payload).college).toBe('SCI')
    expect(normalizePortableState(payload).needsReview).toHaveLength(1)
    const old = { ...payload, state: { ...payload.state } }
    delete old.state.college
    delete old.state.needsReview
    expect(normalizePortableState(old).college).toBe(null)
    expect(normalizePortableState(old).needsReview).toEqual([])
  })
})

describe('what-changed sentences', () => {
  it('name the capability, the course and the reason in Arabic and English, with no technical IDs', async () => {
    const { describeDiff, recomputeAuditLabel } = await import('../src/evidence/recompute.js')
    const prev = base([row('CPIT-240', 'B'), row('STAT-110', 'A')], { projects: [{ id: 'p1', title: 'SQL dashboard', skillIds: ['database'] }] })
    const { diff } = recomputeProfile(prev, { ...prev, courses: [row('CPIT-240', 'F'), row('STAT-110', 'A')] })
    const ar = describeDiff(diff, 'ar').join(' ')
    const en = describeDiff(diff, 'en').join(' ')
    expect(ar).toContain('أُزيلت قدرة «قواعد البيانات»')
    expect(ar).toContain('أصبحت الدرجة لا تُعد دليلًا')
    expect(ar).toContain('يحتاج إلى مراجعة: «SQL dashboard»')
    expect(en).toContain('Removed “Databases”')
    expect(en).toContain('the grade no longer counts as evidence')
    expect(`${ar} ${en}`).not.toMatch(/urn:kamin|%/)
    expect(describeDiff(recomputeProfile(prev, { ...prev }).diff, 'en')).toEqual(['No capability or evidence level changed.'])
    expect(recomputeAuditLabel(diff, 'en')).toBe('Approved record edited; capabilities recomputed: 0 added, 1 removed, 0 changed level')
    expect(recomputeAuditLabel(diff, 'en', 'SCI')).toMatch(/^College changed to Faculty of Science/)
  })
})

// Task 55 · the college comes from the transcript. What the app does on approval (src/App.jsx approve():
// the college read, then recomputeProfile when a record was already approved) on the synthetic KAU PDFs.
describe('Task 55 · the college from the transcript, and recompute when it changes', () => {
  const read = async name => readTranscriptPages((await readPdf(readFileSync(path.join(FIXTURE_DIR, `${name}.pdf`)))).pages)
  const approveRead = (prev, result) => ({ ...prev, approved: true, consents: { analyze: true }, courses: result.courses.map(c => ({ ...c, source: 'pdf' })),
    college: normalizeCollege(result.student.collegeId), collegeRaw: cleanTranscriptText(result.student.collegeRaw), major: cleanTranscriptText(result.student.majorRaw) })
  it('fcit-cs-1p, science-2p and unknown-college give FCIT, SCI and no college, with the printed text kept', async () => {
    const [cs, sci, unknown] = await Promise.all(['fcit-cs-1p', 'science-2p', 'unknown-college'].map(read))
    const empty = base([], { approved: false, college: null })
    const a = approveRead(empty, cs), b = approveRead(empty, sci), c = approveRead(empty, unknown)
    expect([a.college, b.college, c.college]).toEqual(['FCIT', 'SCI', null])
    expect(a.collegeRaw).toBeTruthy()
    expect(b.collegeRaw).toBe('FACULTY OF SCI.')
    expect(b.major).toBe('MATHEMATICS')
    expect(c.collegeRaw).toBe('FACULTY OF ECONOMICS & ADMIN.')
    // Capabilities appear with no college step for FCIT; Science and the unknown college have none, and approval is not blocked.
    expect(profileSkills(a).length).toBeGreaterThan(0)
    expect(profileSkills(b)).toEqual([])
    expect(profileSkills(c)).toEqual([])
  })
  it('the one-tap fix (unknown -> FCIT) recomputes: what FCIT gives is added with the reason "college changed"', async () => {
    const prev = approveRead(base([], { college: null }), await read('unknown-college'))
    const next = { ...prev, college: 'FCIT' }
    const { diff } = recomputeProfile(prev, next)
    expect(diff.added.length).toBe(profileSkills(next).length)
    expect(diff.added.every(a => a.reason === 'college-changed')).toBe(true)
    expect(next.collegeRaw).toBe(prev.collegeRaw)
  })
  it('a later upload whose college differs (FCIT record, then a Science transcript) recomputes with college-changed-no-map', async () => {
    const prev = approveRead(base([], { college: null }), await read('fcit-cs-1p'))
    const next = approveRead(prev, await read('science-2p'))
    const { diff } = recomputeProfile(prev, next)
    expect(profileSkills(prev).length).toBeGreaterThan(0)
    expect(diff.removed.length).toBe(profileSkills(prev).length)
    expect(diff.removed.every(r => ['college-changed-no-map', 'course-removed'].includes(r.reason))).toBe(true)
    expect(diff.removed.some(r => r.reason === 'college-changed-no-map')).toBe(true)
  })
  it('the example and the pilot synthetic transcripts keep FCIT, and their printed college reads as FCIT', () => {
    expect(collegeFromText(demoCollegeRaw).id).toBe('FCIT')
    for (const record of SYNTHETIC_TRANSCRIPTS) {
      expect(record.college).toBe('FCIT')
      expect(collegeFromText(record.collegeRaw).id).toBe('FCIT')
      expect(syntheticTranscript(record.id).collegeRaw).toBe(record.collegeRaw)
    }
  })
  it('cleanTranscriptText keeps a short line of printed text and drops anything else', () => {
    expect(cleanTranscriptText('  COMPUTING &  INFO.\nTECH. ')).toBe('COMPUTING & INFO. TECH.')
    expect(cleanTranscriptText('')).toBeNull()
    expect(cleanTranscriptText('   ')).toBeNull()
    expect(cleanTranscriptText(null)).toBeNull()
    expect(cleanTranscriptText(42)).toBeNull()
    expect(cleanTranscriptText({ raw: 'x' })).toBeNull()
    expect(cleanTranscriptText('A'.repeat(500))).toHaveLength(120)
  })
})
