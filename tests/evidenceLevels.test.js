import { describe, it, expect } from 'vitest'
import { webcrypto } from 'node:crypto'
import { evidenceLevel, evidenceSentence, gradeCap, weakest, EVIDENCE_LEVELS_VERSION, levelLabel, basisLabel } from '../src/evidence/levels.js'
import { limitingReasons } from '../src/evidence/levels.js'
import { ACTION_LABELS, LEVEL_MEANINGS, limitLine, sharedLimitLine } from '../src/content/levelReasons.js'
import { inferSkills, awaitingEvidence, rowEvidence } from '../src/utils/engine.js'
import { editCourseRow } from '../src/utils/provenance.js'
import { demoCourses } from '../src/data.js'
import { projectStateToPerson360 } from '../src/ontology/projector.js'
import { indexPersonGraph, strongestCapabilityPath } from '../src/matching/graph.js'
import { buildMatchingProfile, matchTargets } from '../src/matching/engine.js'
import { verifyCredential, signCredential, ed25519Multikey } from '../src/credentials/verify.js'
import { buildCredentialRecord, normalizeCredentialRecords } from '../src/credentials/records.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { readLayout } from '../src/transcript/layout.js'
import { readKauLayout } from '../src/utils/transcript.js'
import { readPdf } from './helpers/readPdfText.js'
import { FIXTURE_DIR } from '../scripts/make-transcript-fixtures.mjs'

const kauFixture = async name => readLayout((await readPdf(readFileSync(path.join(FIXTURE_DIR, `${name}.pdf`)))).pages)

const approved = { provenance: 'document', mappingStatus: 'approved' }

describe('Task 02 · evidenceLevel rules (ordinal, weakest link wins)', () => {
  // [description, input, expected level]
  const table = [
    // 1. Grade
    ['A, project, document, approved → strong', { grade: 'A', assessment: 'project', ...approved }, 'strong'],
    ['B+, lab, document, approved → strong', { grade: 'B+', assessment: 'lab', ...approved }, 'strong'],
    ['C, project → moderate (grade cap)', { grade: 'C', assessment: 'project', ...approved }, 'moderate'],
    ['D, project → limited (grade cap)', { grade: 'D+', assessment: 'project', ...approved }, 'limited'],
    ['F creates no evidence', { grade: 'F', assessment: 'project', ...approved }, 'none'],
    ['W creates no evidence', { grade: 'W', assessment: 'project', ...approved }, 'none'],
    ['I creates no evidence', { grade: 'I', assessment: 'project', ...approved }, 'none'],
    ['Arabic أ maps like A', { grade: 'أ', assessment: 'project', ...approved }, 'strong'],
    ['Arabic هـ is a fail', { grade: 'هـ', assessment: 'project', ...approved }, 'none'],
    ['numeric 92 → strong', { grade: '92', assessment: 'project', ...approved }, 'strong'],
    ['numeric 65 → limited', { grade: '65', assessment: 'project', ...approved }, 'limited'],
    ['numeric 40 → none', { grade: '40', assessment: 'project', ...approved }, 'none'],
    // 2. Assessment type
    ['A, exam → moderate (exam cap)', { grade: 'A', assessment: 'exam', ...approved }, 'moderate'],
    ['A, mixed → moderate', { grade: 'A', assessment: 'mixed', ...approved }, 'moderate'],
    ['A, unknown assessment → limited', { grade: 'A', assessment: 'unknown', ...approved }, 'limited'],
    ['A, missing assessment → limited', { grade: 'A', ...approved }, 'limited'],
    // 3. Source
    ['declared (typed by hand) → none', { grade: 'A', assessment: 'project', provenance: 'declared', mappingStatus: 'approved' }, 'none'],
    ['synthetic example keeps its level', { grade: 'A', assessment: 'project', provenance: 'synthetic', mappingStatus: 'approved' }, 'strong'],
    ['edited D→B uses the original D → limited', { grade: 'B', originalGrade: 'D', editedFields: ['grade'], assessment: 'project', provenance: 'edited', mappingStatus: 'approved' }, 'limited'],
    ['edited A→C (lowered) uses C → moderate', { grade: 'C', originalGrade: 'A', editedFields: ['grade'], assessment: 'project', provenance: 'edited', mappingStatus: 'approved' }, 'moderate'],
    ['edited name only keeps the grade level', { grade: 'A', editedFields: ['name'], assessment: 'project', provenance: 'edited', mappingStatus: 'approved' }, 'strong'],
    ['edited course code caps at limited', { grade: 'A', editedFields: ['code'], assessment: 'project', provenance: 'edited', mappingStatus: 'approved' }, 'limited'],
    ['verified credential (T4) → strong practical', { provenance: 'verified-credential' }, 'strong'],
    // 4. Mapping status
    ['proposed mapping caps at limited', { grade: 'A', assessment: 'project', provenance: 'document', mappingStatus: 'proposed' }, 'limited'],
    ['unmapped course → none', { grade: 'A', assessment: 'project', provenance: 'document', mappingStatus: 'missing' }, 'none'],
  ]
  it.each(table)('%s', (_, input, level) => {
    const result = evidenceLevel(input)
    expect(result.level).toBe(level)
    expect(result.version).toBe(EVIDENCE_LEVELS_VERSION)
    for (const r of result.reasons) {
      expect(r.code).toMatch(/^[a-z-]+$/)
      expect(r.ar.length).toBeGreaterThan(2)
      expect(r.en.length).toBeGreaterThan(2)
    }
  })

  it('weakest link: a high grade never compensates for a weak source, assessment or mapping', () => {
    expect(weakest('strong', 'limited', 'strong')).toBe('limited')
    const r = evidenceLevel({ grade: 'A+', assessment: 'exam', provenance: 'document', mappingStatus: 'proposed' })
    expect(r.level).toBe('limited')
    expect(r.reasons.filter(x => x.limiting).map(x => x.code)).toEqual(['mapping-proposed'])
  })

  it('separates academically supported from demonstrated in practice', () => {
    expect(evidenceLevel({ grade: 'A', assessment: 'project', ...approved }).basis).toBe('academic')
    expect(evidenceLevel({ provenance: 'verified-credential' }).basis).toBe('practical')
    expect(basisLabel('academic', 'en')).toBe('Academically supported')
    expect(basisLabel('practical', 'ar')).toBe('مثبت عمليًا')
  })

  it('explains a level in a short sentence in both languages, without numbers or percentages', () => {
    const r = evidenceLevel({ grade: 'B', assessment: 'exam', ...approved })
    expect(evidenceSentence(r, 'en')).toBe('Moderate clue: grade B, in an exam-based course, from an unedited document, course mapping approved by the department.')
    expect(evidenceSentence(r, 'ar')).toMatch(/^قرينة متوسطة: /)
    expect(evidenceSentence(r, 'en')).not.toMatch(/%|\d+\.\d|confidence/i)
    expect(levelLabel('none', 'en')).toBe('Not enough evidence')
    // Task 54 changed this rule on purpose: P (passed without a grade) is now at most 'limited'.
    // An unknown code still gives nothing.
    expect(gradeCap('P')).toBe('limited')
    expect(gradeCap('ZZ')).toBe('none')
  })
})

describe('Task 02 · acceptance criteria through inferSkills', () => {
  it('a manual row with grade A creates no capability and is listed as waiting for a document', () => {
    const manual = { code: 'CPIT-240', name: 'Databases', grade: 'A', source: 'manual' }
    expect(inferSkills([manual])).toEqual([])
    const waiting = awaitingEvidence([manual])
    expect(waiting.map(w => [w.code, w.skills])).toEqual([['CPIT-240', ['database']]])
    expect(waiting[0].reasons.map(r => r.en).join(' ')).toMatch(/waiting for a document or review/)
    expect(awaitingEvidence([{ ...manual, source: 'pdf' }])).toEqual([])
  })

  it('a row edited from D to B is limited, never strong', () => {
    const extracted = { code: 'CPIT-240', name: 'Databases (I)', grade: 'D', source: 'pdf' }
    const edited = editCourseRow(extracted, 'grade', 'B')
    expect(edited.edits.grade).toBe('D')
    expect(rowEvidence(edited).level).toBe('limited')
    const [database] = inferSkills([edited])
    expect(database.evidenceLevel).toBe('limited')
    expect(database.evidence[0].reasons.map(r => r.code)).toContain('grade-original')
  })

  it('exam with A is moderate and project with A is strong once the mapping is approved', () => {
    expect(evidenceLevel({ grade: 'A', assessment: 'exam', provenance: 'document', mappingStatus: 'approved' }).level).toBe('moderate')
    expect(evidenceLevel({ grade: 'A', assessment: 'project', provenance: 'document', mappingStatus: 'approved' }).level).toBe('strong')
  })

  it('F or W creates no evidence', () => {
    for (const grade of ['F', 'W']) expect(inferSkills([{ code: 'CPIT-240', name: 'Databases (I)', grade, source: 'pdf' }])).toEqual([])
  })

  it('reports ordinal levels only — no numeric confidence on any capability', () => {
    const skills = inferSkills(demoCourses)
    expect(skills.length).toBeGreaterThan(0)
    for (const skill of skills) {
      expect(skill).not.toHaveProperty('confidence')
      expect(skill).not.toHaveProperty('confidenceLabel')
      expect(['strong', 'moderate', 'limited']).toContain(skill.evidenceLevel)
      expect(skill.basis).toBe('academic')
      expect(skill.practicalLevel).toBe('none')
      for (const row of skill.evidence) expect(row).not.toHaveProperty('weight')
    }
    // Today every mapping is proposed, so honest course evidence is at most limited.
    expect(new Set(skills.map(s => s.evidenceLevel))).toEqual(new Set(['limited']))
  })
})

describe('Task 02 · evidence levels in RDF and matching', () => {
  it('writes kamin:evidenceLevel and the levels version on every demonstrates claim', () => {
    const graph = projectStateToPerson360({ state: { courses: demoCourses }, skills: inferSkills(demoCourses) })
    const claims = graph.claims.filter(c => c.predicate === 'kamin:demonstrates')
    expect(claims.length).toBeGreaterThan(0)
    for (const claim of claims) {
      expect(claim).toMatchObject({ evidenceLevel: 'limited', evidenceStrength: 'limited', evidenceLevelsVersion: EVIDENCE_LEVELS_VERSION, evidenceBasis: 'academic' })
      expect(claim.metadata.evidenceReasons).toContain('mapping-proposed')
    }
  })

  it('ranks paths by evidence level, with practical evidence ahead at the same level', () => {
    const paths = [
      { id: 'a', evidenceLevel: 'limited', basis: 'academic' },
      { id: 'b', evidenceLevel: 'moderate', basis: 'academic' },
      { id: 'c', evidenceLevel: 'moderate', basis: 'practical' },
      { id: 'legacy', evidenceStrength: 'high' },
    ]
    expect(strongestCapabilityPath(paths).id).toBe('c')
    expect(strongestCapabilityPath([{ id: 'x', evidenceStrength: 'medium' }, { id: 'y', evidenceStrength: 'high' }]).id).toBe('y')
  })

  it('a credential verified against a trusted (fixture) issuer is practical evidence that matching uses', async () => {
    const pair = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
    const raw = await webcrypto.subtle.exportKey('raw', pair.publicKey)
    const issuer = { id: 'did:example:fixture-university', name: 'Fixture University (test only)', keys: [{ id: 'did:example:fixture-university#key-1', publicKeyMultibase: ed25519Multikey(raw) }] }
    const doc = {
      '@context': ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'],
      id: 'urn:uuid:fixture-credential', type: ['VerifiableCredential', 'AchievementCredential'],
      issuer: { id: issuer.id, type: 'Profile', name: issuer.name },
      validFrom: '2026-09-01T00:00:00Z', validUntil: '2028-09-01T00:00:00Z',
      credentialSubject: { type: 'AchievementSubject', id: 'did:example:student', achievement: { id: 'urn:kamin:skill:statistics', type: 'Achievement', name: 'Statistics' } },
    }
    const now = new Date('2026-10-01T00:00:00Z')
    const signed = await signCredential(doc, { privateKey: pair.privateKey, verificationMethod: issuer.keys[0].id })
    const result = await verifyCredential(signed, { trustedIssuers: [issuer], now })
    expect(result.outcome).toBe('verified')
    const credentials = normalizeCredentialRecords([buildCredentialRecord(signed, result, now)])

    const courses = [{ code: 'CPIT-240', name: 'Databases (I)', grade: 'A', source: 'pdf' }]
    const skills = inferSkills(courses, { credentials })
    const statistics = skills.find(s => s.id === 'statistics')
    expect(statistics).toMatchObject({ evidenceLevel: 'strong', practicalLevel: 'strong', academicLevel: 'none', basis: 'practical', evidence: [] })
    expect(statistics.practicalEvidence[0]).toMatchObject({ kind: 'credential', issuerName: 'Fixture University (test only)' })

    // The same record from an untrusted issuer gives nothing.
    expect(inferSkills(courses, { credentials: credentials.map(c => ({ ...c, issuerTrusted: false })) }).some(s => s.id === 'statistics')).toBe(false)

    const graph = projectStateToPerson360({ state: { courses, credentials, goal: 'data', approved: true }, skills })
    const index = indexPersonGraph(graph)
    const path = index.capabilities.get('statistics')?.[0]
    expect(path).toMatchObject({ relation: 'kamin:verifiedBy', basis: 'practical', evidenceLevel: 'strong' })
    const analyst = matchTargets(buildMatchingProfile({ graph }), { lang: 'en' }).find(m => m.id === 'job-data-analyst')
    expect(analyst.missingSkills).not.toContain('statistics')
    expect(analyst.semanticPaths.find(p => p.kind === 'capability-match' && p.capabilityKey === 'statistics').relationChain.map(e => e.predicate)).toContain('kamin:verifiedBy')
  })
})

// Task 29 · "why is this level limited?": the reasons that set the level, in plain words. Reads the
// reasons evidenceLevel() already produces; the tests above are unchanged.
const ALL_CODES = ['grade-high', 'grade-medium', 'grade-low', 'grade-none', 'grade-original', 'grade-lowered', 'grade-transfer', 'grade-pass',
  'assessment-project', 'assessment-lab', 'assessment-mixed', 'assessment-exam', 'assessment-unknown',
  'source-document', 'source-edited', 'source-code-edited', 'source-declared', 'source-synthetic', 'source-verified-credential',
  'mapping-approved', 'mapping-proposed', 'mapping-missing']
const strongRow = { grade: 'A', assessment: 'project', provenance: 'document', mappingStatus: 'approved' }
// [input, level, the limiting codes]
const LIMIT_CASES = [
  [strongRow, 'strong', []],
  [{ ...strongRow, assessment: 'lab' }, 'strong', []],
  [{ ...strongRow, provenance: 'synthetic' }, 'strong', []],
  [{ ...strongRow, provenance: 'edited', editedFields: ['name'] }, 'strong', []],
  [{ provenance: 'verified-credential' }, 'strong', []],
  [{ ...strongRow, grade: 'C' }, 'moderate', ['grade-medium']],
  [{ ...strongRow, grade: 'D' }, 'limited', ['grade-low']],
  [{ ...strongRow, grade: 'F' }, 'none', ['grade-none']],
  [{ ...strongRow, grade: 'TR' }, 'limited', ['grade-transfer']],
  [{ ...strongRow, grade: 'P' }, 'limited', ['grade-pass']],
  [{ ...strongRow, provenance: 'edited', grade: 'A', originalGrade: 'D' }, 'limited', ['grade-low', 'grade-original']],
  [{ ...strongRow, provenance: 'edited', grade: 'D', originalGrade: 'A' }, 'limited', ['grade-low', 'grade-lowered']],
  [{ ...strongRow, assessment: 'exam' }, 'moderate', ['assessment-exam']],
  [{ ...strongRow, assessment: 'mixed' }, 'moderate', ['assessment-mixed']],
  [{ ...strongRow, assessment: 'unknown' }, 'limited', ['assessment-unknown']],
  [{ ...strongRow, provenance: 'edited', editedFields: ['code'] }, 'limited', ['source-code-edited']],
  [{ ...strongRow, provenance: 'declared' }, 'none', ['source-declared']],
  [{ ...strongRow, mappingStatus: 'proposed' }, 'limited', ['mapping-proposed']],
  [{ ...strongRow, mappingStatus: 'missing' }, 'none', ['mapping-missing']],
  [{ ...strongRow, assessment: 'unknown', mappingStatus: 'proposed' }, 'limited', ['assessment-unknown', 'mapping-proposed']],
  [{ ...strongRow, grade: 'D', assessment: 'unknown', mappingStatus: 'proposed' }, 'limited', ['grade-low', 'assessment-unknown', 'mapping-proposed']],
  [{ ...strongRow, grade: 'C', assessment: 'unknown' }, 'limited', ['assessment-unknown']],
]
const codesOf = reasons => reasons.map(r => r.code)

describe('Task 29 · limitingReasons: the reasons whose cap equals the final level', () => {
  for (const [input, level, codes] of LIMIT_CASES) it(`${JSON.stringify(input)} → ${level}: ${codes.join(', ') || 'nothing limits it'}`, () => {
    const result = evidenceLevel(input)
    expect(result.level).toBe(level)
    expect(codesOf(limitingReasons(result))).toEqual(codes)
    // The same reasons levels.js already marks as limiting: the helper adds no rule of its own.
    if (level !== 'strong') expect(codesOf(limitingReasons(result))).toEqual(codesOf(result.reasons.filter(r => r.limiting)))
  })
  it('every reason code in levels.js is exercised above', () => {
    const seen = new Set(LIMIT_CASES.flatMap(([input]) => codesOf(evidenceLevel(input).reasons)))
    expect(ALL_CODES.filter(code => !seen.has(code))).toEqual([])
  })
  it('works on a capability from inferSkills (evidenceLevel) as on one result (level); nothing for strong or unknown input', () => {
    for (const skill of inferSkills(demoCourses)) expect(codesOf(limitingReasons(skill))).toEqual(['assessment-unknown', 'mapping-proposed'])
    expect(limitingReasons({ evidenceLevel: 'strong', reasons: evidenceLevel(strongRow).reasons })).toEqual([])
    expect(limitingReasons(null)).toEqual([])
    expect(limitingReasons({ evidenceLevel: 'odd', reasons: [{ cap: 'odd' }] })).toEqual([])
  })
})

describe('Task 29 · the "because" line and the shared line', () => {
  const line = (input, lang, code = 'CPIS-334') => limitLine(evidenceLevel(input), lang, { code })
  it('names only the limiting factor, in plain words, with the one action the student can take', () => {
    expect(line({ ...strongRow, mappingStatus: 'proposed' }, 'en')).toEqual({ codes: ['mapping-proposed'], action: null,
      text: 'Limited because the department has not approved this course link yet, not because of your grade.' })
    expect(line({ ...strongRow, assessment: 'unknown' }, 'en').text).toBe('Limited because we don’t know yet how this course is assessed, not because of your grade.')
    expect(line({ ...strongRow, grade: 'D' }, 'en')).toEqual({ codes: ['grade-low'], action: null, text: 'Limited by the grade D in CPIS-334.' })
    expect(line({ ...strongRow, grade: 'C+' }, 'en').text).toBe('Moderate because of the grade C+ in CPIS-334.')
    expect(line({ ...strongRow, provenance: 'declared' }, 'en')).toEqual({ codes: ['source-declared'], action: 'upload', text: 'Waiting for a document: you typed this course in.' })
    expect(line({ ...strongRow, provenance: 'edited', grade: 'A', originalGrade: 'D' }, 'en')).toEqual({ codes: ['grade-low', 'grade-original'], action: 'review',
      text: 'Limited by the grade D in CPIS-334. Your edit is not counted; the document’s grade is used.' })
    expect(line({ ...strongRow, provenance: 'edited', editedFields: ['code'] }, 'en').action).toBe('review')
    expect(line({ ...strongRow, assessment: 'exam' }, 'en').text).toBe('Moderate because this course is assessed by exams, not because of your grade.')
    expect(line(strongRow, 'en')).toBeNull()
    expect(line({ provenance: 'verified-credential' }, 'en')).toBeNull()
  })
  it('every limiting code above has a line in Arabic and English, and Arabic says the same thing', () => {
    for (const [input, level, codes] of LIMIT_CASES) {
      if (!codes.length || codes.every(c => c === 'grade-none' || c === 'mapping-missing')) continue
      for (const lang of ['ar', 'en']) expect(line(input, lang)?.text, `${level} ${codes} ${lang}`).toBeTruthy()
    }
    expect(line({ ...strongRow, mappingStatus: 'proposed' }, 'ar').text).toBe('قرينة محدودة لأن القسم لم يعتمد ربط هذا المقرر بعد، وليس بسبب درجتك.')
    expect(line({ ...strongRow, provenance: 'declared' }, 'ar').text).toBe('بانتظار مستند: أدخلت هذا المقرر يدويًا.')
    expect(line({ ...strongRow, grade: 'D' }, 'ar').text).toBe('قرينة محدودة بسبب الدرجة D في CPIS-334.')
  })
  it('a level with no student action has no action; the actions are upload and review only', () => {
    for (const [input] of LIMIT_CASES) expect([null, undefined, 'upload', 'review']).toContain(line(input, 'en')?.action)
    expect(line({ ...strongRow, mappingStatus: 'proposed', assessment: 'unknown' }, 'en').action).toBeNull()
    expect(Object.keys(ACTION_LABELS.en)).toEqual(['upload', 'review'])
  })
  it('the synthetic profile: one shared line (the department links and the assessment type), not your grades', () => {
    const skills = inferSkills(demoCourses)
    expect(sharedLimitLine(skills, 'en')).toEqual({ codes: ['mapping-proposed', 'assessment-unknown'], action: null,
      text: 'All limited for the same reasons, not your grades: the department has not approved these course links yet, and we don’t know yet how these courses are assessed.' })
    expect(sharedLimitLine(skills, 'ar').text).toBe('كلها محدودة للأسباب نفسها، وليس بسبب درجاتك: القسم لم يعتمد ربط هذه المقررات بعد، ولا نعرف بعد كيف تُقيَّم هذه المقررات.')
  })
  it('no shared line when the reasons differ, depend on one course (a grade), or there is one capability', () => {
    const limited = input => ({ evidenceLevel: 'limited', reasons: evidenceLevel(input).reasons })
    const proposed = limited({ ...strongRow, mappingStatus: 'proposed' })
    expect(sharedLimitLine([proposed, proposed], 'en').codes).toEqual(['mapping-proposed'])
    expect(sharedLimitLine([proposed, proposed], 'en').text).toMatch(/^All limited for the same reason, not your grades: /)
    expect(sharedLimitLine([proposed, limited({ ...strongRow, assessment: 'unknown' })], 'en')).toBeNull()
    expect(sharedLimitLine([limited({ ...strongRow, grade: 'D' }), limited({ ...strongRow, grade: 'D' })], 'en')).toBeNull()
    expect(sharedLimitLine([proposed], 'en')).toBeNull()
    const strong = { evidenceLevel: 'strong', reasons: evidenceLevel(strongRow).reasons }
    expect(sharedLimitLine([strong, strong], 'en')).toBeNull()
  })
  it('the level meanings: four levels and the rule, in both languages; no percentage', () => {
    for (const lang of ['ar', 'en']) {
      const m = LEVEL_MEANINGS[lang]
      for (const level of ['none', 'limited', 'moderate', 'strong', 'title', 'rule']) expect(m[level], `${lang} ${level}`).toBeTruthy()
      expect(Object.values(m).join(' ')).not.toMatch(/\d+\s*%|٪/)
      expect(Object.isFrozen(m)).toBe(true)
    }
    for (const level of ['none', 'limited', 'moderate', 'strong']) expect(LEVEL_MEANINGS.en[level].startsWith(levelLabel(level, 'en'))).toBe(true)
  })
})

// Task 54 · how TR (completed by transfer) and P (passed, no grade) count as evidence. Proposed to the
// supervisor: both give at most a limited clue with their own reason; IC and NF create nothing, like F
// and W. The rules above are unchanged; the synthetic example's results are the same as before.
describe('Task 54 · TR and P: at most a limited clue, with their own reason', () => {
  const NONE = ['IC', 'NF', 'NP', 'W', 'WF', 'IP', 'DN', 'F']
  const REASON = {
    TR: { code: 'grade-transfer', en: 'completed by transfer: the grade is not on this transcript', ar: 'أُكمل بالمعادلة: الدرجة ليست في هذا السجل' },
    P: { code: 'grade-pass', en: 'passed without a grade', ar: 'ناجح دون درجة' },
  }
  it('the version string names the new rule', () => {
    expect(EVIDENCE_LEVELS_VERSION).toBe('kamin-evidence-levels-v2')
    expect(evidenceLevel({ ...strongRow, grade: 'TR' }).version).toBe('kamin-evidence-levels-v2')
  })
  it.each(Object.entries(REASON))('%s: cap limited, its own reason in English and Arabic', (grade, expected) => {
    expect(gradeCap(grade)).toBe('limited')
    expect(gradeCap(grade.toLowerCase())).toBe('limited')
    expect(gradeCap(` ${grade} `)).toBe('limited')
    const result = evidenceLevel({ ...strongRow, grade })
    expect(result.level).toBe('limited')
    expect(result.factors).toMatchObject({ grade: 'limited', gradeUsed: grade })
    expect(result.reasons[0]).toEqual({ ...expected, factor: 'grade', cap: 'limited', limiting: true })
    expect(evidenceSentence(result, 'en')).toBe(`Limited clue: ${expected.en}, in a project-based course, from an unedited document, course mapping approved by the department.`)
    expect(evidenceSentence(result, 'ar')).toBe(`قرينة محدودة: ${expected.ar}، في مقرر قائم على مشروع، من مستند غير معدّل، ربط المقرر معتمد من القسم.`)
  })
  it.each(NONE)('%s: no evidence, with the "creates no evidence" reason in English and Arabic', grade => {
    expect(gradeCap(grade)).toBe('none')
    const result = evidenceLevel({ ...strongRow, grade })
    expect(result.level).toBe('none')
    expect(result.reasons[0]).toMatchObject({ code: 'grade-none', factor: 'grade', cap: 'none',
      en: `grade ${grade} creates no evidence (fail, withdrawal or incomplete)`, ar: `الدرجة ${grade} لا تُنشئ دليلًا (رسوب أو انسحاب أو غير مكتمل)` })
  })
  it('the other caps still apply: the strongest a TR or P row can give is limited', () => {
    for (const grade of ['TR', 'P']) {
      for (const assessment of ['project', 'lab', 'mixed', 'exam', 'unknown']) {
        for (const provenance of ['document', 'synthetic', 'edited', 'declared']) {
          for (const mappingStatus of ['approved', 'reviewed', 'proposed', 'missing']) {
            const level = evidenceLevel({ grade, assessment, provenance, mappingStatus }).level
            const expected = provenance === 'declared' || mappingStatus === 'missing' ? 'none' : 'limited'
            expect(level, `${grade} ${assessment} ${provenance} ${mappingStatus}`).toBe(expected)
          }
        }
      }
    }
    // An edit cannot raise a TR or P row: the document's TR is used.
    const edited = evidenceLevel({ grade: 'A', originalGrade: 'TR', editedFields: ['grade'], assessment: 'project', provenance: 'edited', mappingStatus: 'approved' })
    expect(edited.level).toBe('limited')
    expect(codesOf(edited.reasons).slice(0, 2)).toEqual(['grade-transfer', 'grade-original'])
  })
  it('the "because" line names the transfer or the missing grade, in both languages', () => {
    const line = (grade, lang) => limitLine(evidenceLevel({ ...strongRow, grade }), lang, { code: 'STAT-110' })
    expect(line('TR', 'en')).toEqual({ codes: ['grade-transfer'], action: null, text: 'Limited because STAT-110 was completed by transfer: the grade is not on this transcript.' })
    expect(line('TR', 'ar')).toEqual({ codes: ['grade-transfer'], action: null, text: 'قرينة محدودة لأن STAT-110 أُكمل بالمعادلة: الدرجة ليست في هذا السجل.' })
    expect(line('P', 'en')).toEqual({ codes: ['grade-pass'], action: null, text: 'Limited because STAT-110 was passed without a grade.' })
    expect(line('P', 'ar')).toEqual({ codes: ['grade-pass'], action: null, text: 'قرينة محدودة لأن STAT-110 اجتيز دون درجة.' })
    // With a proposed mapping too, the line does not say "not because of your grade".
    const both = limitLine(evidenceLevel({ ...strongRow, grade: 'TR', mappingStatus: 'proposed' }), 'en', { code: 'STAT-110' })
    expect(both.text).toBe('Limited because the department has not approved this course link yet. Limited because STAT-110 was completed by transfer: the grade is not on this transcript.')
    const trLimited = { evidenceLevel: 'limited', reasons: evidenceLevel({ ...strongRow, grade: 'TR' }).reasons }
    expect(sharedLimitLine([trLimited, trLimited], 'en')).toBeNull()
  })
  it('the level meanings name transfer and pass-without-grade under "limited"; no percentage', () => {
    expect(LEVEL_MEANINGS.en.limited).toContain('a course completed by transfer or passed without a grade')
    expect(LEVEL_MEANINGS.ar.limited).toContain('مقرر مُعادَل أو ناجح دون درجة')
    for (const lang of ['ar', 'en']) expect(Object.values(LEVEL_MEANINGS[lang]).join(' ')).not.toMatch(/\d+\s*%|٪/)
  })
  it('the synthetic example gives the same capabilities, levels and reasons as before', () => {
    const skills = inferSkills(demoCourses)
    expect(skills.map(s => [s.id, s.evidenceLevel])).toEqual([['project', 'limited'], ['requirements', 'limited'], ['software', 'limited'], ['database', 'limited'], ['statistics', 'limited']])
    for (const skill of skills) {
      for (const e of skill.evidence) {
        const cap = gradeCap(e.grade)
        expect(codesOf(e.reasons).filter(c => c.startsWith('grade-'))).toEqual([cap === 'strong' ? 'grade-high' : cap === 'moderate' ? 'grade-medium' : 'grade-low'])
      }
    }
  })
  it('transfer-tr.pdf approved: its mapped TR course shows "limited" with the transfer reason', async () => {
    const { courses } = readKauLayout(await kauFixture('transfer-tr'))
    const rows = courses.map(c => ({ ...c, source: 'pdf' }))
    const tr = rows.filter(c => c.grade === 'TR')
    expect(tr.length).toBeGreaterThanOrEqual(3)
    const fromTr = inferSkills(rows).flatMap(s => s.evidence).filter(e => e.grade === 'TR')
    expect([...new Set(fromTr.map(e => e.code))]).toEqual(['STAT-110'])
    for (const e of fromTr) {
      expect(e.evidenceLevel).toBe('limited')
      expect(e.reasons[0]).toMatchObject({ code: 'grade-transfer', en: REASON.TR.en, ar: REASON.TR.ar })
    }
    // Every TR row, mapped or not, is never above limited.
    for (const row of tr) expect(['none', 'limited']).toContain(rowEvidence(row).level)
  })
  it('codes-mix.pdf approved: F, W, IC and the other not-passed rows create nothing', async () => {
    const { courses } = readKauLayout(await kauFixture('codes-mix'))
    const rows = courses.map(c => ({ ...c, source: 'pdf' }))
    const notPassed = rows.filter(c => NONE.includes(String(c.grade).toUpperCase()))
    expect(notPassed.length).toBeGreaterThanOrEqual(6)
    for (const row of notPassed) expect(rowEvidence(row).level, `${row.code} ${row.grade}`).toBe('none')
    expect(inferSkills(rows).flatMap(s => s.evidence).filter(e => NONE.includes(e.grade))).toEqual([])
  })
})
