import { describe, expect, it } from 'vitest'
import { demoCourses } from '../src/data.js'
import { inferSkills, judgeOpportunities } from '../src/utils/engine.js'
import { parseTranscriptText, parseTranscriptTextDetailed } from '../src/utils/transcript.js'
import { inferTranscriptSsces, ssceForCourse, ssceIct, findSsceSpecializationCandidates, findSsceLevelCandidates, getSsceSpecialization, courseSsceContexts } from '../src/reference/ssce.js'

describe('Kamin deterministic engine', () => {
  it('infers only explicitly mapped evidence-backed skills', () => {
    const skills=inferSkills(demoCourses)
    expect(skills.some(s=>s.id==='requirements')).toBe(true)
    expect(skills.every(s=>s.evidence.length>0)).toBe(true)
    expect(inferSkills([{code:'MATH-301',name:'Real Analysis',grade:'A'}])).toHaveLength(0)
    expect(inferSkills([{code:'EE-210',name:'Electrical Engineering Systems',grade:'A'}])).toHaveLength(0)
  })

  it('never treats failed, withdrawn, incomplete, or unknown grades as skill evidence', () => {
    const rows=['F','W','WF','I','IP','NP','DN','هـ','ح','م'].map(grade=>({code:'CPIT-251',name:'Systems Analysis',grade}))
    for(const row of rows) expect(inferSkills([row]), row.grade).toHaveLength(0)
    expect(inferSkills([{code:'CPIT-251',name:'Systems Analysis',grade:'A'}]).length).toBeGreaterThan(0)
  })

  it('keeps PMP as not-yet with its formal gate and source', () => {
    const skills=inferSkills(demoCourses)
    const pmp=judgeOpportunities(skills,'management','en').find(r=>r.id==='pmp')
    expect(pmp.status).toBe('no')
    expect(pmp.gapType).toBe('Not yet')
    expect(pmp.formalSource).toMatch(/pmi\.org/)
    expect(pmp.reasons.join(' ')).toMatch(/36 months/)
  })

  it('parses multiple English transcript rows including hours and points', () => {
    const text='CPIT 251 Systems Analysis and Design 3 A 15.00\nCPIT 252 Software Engineering 3 B+ 13.50\nSTAT 201 Applied Statistics 3 B 12.00'
    const rows=parseTranscriptText(text)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({code:'CPIT-251',grade:'A',hours:3,name:'Systems Analysis and Design'})
    expect(rows[1].grade).toBe('B+')
  })

  it('parses Arabic grades and reverse course-code order', () => {
    const text='251 CPIT تحليل وتصميم النظم 3 أ+ 15.00\nSTAT 201 الإحصاء التطبيقي 3 ب 12.00'
    const rows=parseTranscriptText(text)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({code:'CPIT-251',grade:'A+'})
    expect(rows[1]).toMatchObject({code:'STAT-201',grade:'B'})
  })

  it('does not turn a course title keyword into a skill without an explicit mapping', () => {
    const rows=[
      {code:'MATH-410',name:'Real Analysis',grade:'A'},
      {code:'EE-201',name:'Electrical Engineering Systems',grade:'A'},
      {code:'GEN-101',name:'Introduction to Management',grade:'A'},
      {code:'ISL-101',name:'الأمن الفكري',grade:'A'},
    ]
    expect(inferSkills(rows)).toHaveLength(0)
  })
})


describe('portable transcript parsing', () => {
  it('normalizes Arabic-Indic digits and non-ASCII hyphens', () => {
    const rows=parseTranscriptText('CPIT–٢٥١ تحليل وتصميم النظم ٣ أ+ ١٥.٠٠')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({code:'CPIT-251',grade:'A+',hours:3})
  })

  it('supports compact codes and row numbers without polluting course names', () => {
    const rows=parseTranscriptText('1 CS101 Introduction to Programming 3 A 12.00\n2 MATH202 Discrete Mathematics 4 B+ 14.00')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({code:'CS-101',name:'Introduction to Programming',grade:'A',hours:3})
    expect(rows[1]).toMatchObject({code:'MATH-202',name:'Discrete Mathematics',grade:'B+',hours:4})
  })

  it('stitches a wrapped course row when title and grade spill to the next line', () => {
    const rows=parseTranscriptText('CPCS 204 Data Structures and\nAlgorithms 3 B+ 13.50')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({code:'CPCS-204',name:'Data Structures and Algorithms',grade:'B+',hours:3})
  })

  it('splits accidentally merged rows containing more than one course code', () => {
    const rows=parseTranscriptText('CPIT 251 Systems Analysis 3 A 15.00 CPIT 252 Software Engineering 3 B+ 13.50')
    expect(rows).toHaveLength(2)
    expect(rows.map(r=>r.code)).toEqual(['CPIT-251','CPIT-252'])
  })

  it('reports rejected course-like rows instead of silently replacing them with demo data', () => {
    const report=parseTranscriptTextDetailed('CPIT 251 Systems Analysis UNKNOWN\nSTAT 201 Applied Statistics 3 B 12.00')
    expect(report.courses).toHaveLength(1)
    expect(report.rejected).toHaveLength(1)
    expect(report.rejected[0].line).toContain('CPIT 251')
    expect(report.coverage).toBeCloseTo(.5)
  })

  it('does not strip meaningful title numbers that are not credit-hour metadata', () => {
    const rows=parseTranscriptText('CS 202 Programming 2 3 A 12.00')
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Programming 2')
  })
})


describe('SASCED-20 academic context layer', () => {
  it('maps qualification levels as well as specialties', () => {
    expect(findSsceLevelCandidates('بكالوريوس تقنية المعلومات')[0].code).toBe('6')
    expect(findSsceLevelCandidates('ماجستير علوم البيانات')[0].code).toBe('7')
    expect(findSsceLevelCandidates('PhD in Computer Science')[0].code).toBe('8')
  })

  it('maps common Saudi ICT programme names to official SASCED specialty codes', () => {
    expect(findSsceSpecializationCandidates('بكالوريوس تقنية المعلومات')[0].code).toBe('061303')
    expect(findSsceSpecializationCandidates('Bachelor of Information Systems')[0].code).toBe('061304')
    expect(findSsceSpecializationCandidates('برنامج الأمن السيبراني')[0].code).toBe('061203')
    expect(findSsceSpecializationCandidates('ماجستير علوم البيانات')[0].code).toBe('061902')
  })

  it('preserves the official hierarchy for Information Technology', () => {
    const it=getSsceSpecialization('061303')
    expect(it.broad.code).toBe('06')
    expect(it.narrow.code).toBe('061')
    expect(it.detailed.code).toBe('0613')
    expect(it.labels.ar).toBe('تقنية المعلومات')
  })

  it('does not infer an academic specialty from a generic course title alone', () => {
    expect(findSsceSpecializationCandidates('Systems Analysis and Design')).toHaveLength(0)
  })

  it('keeps course-to-SASCED links as context tags rather than skill evidence', () => {
    expect(courseSsceContexts['CPIT-305']).toContain('061303')
    expect(courseSsceContexts['CPIT-252']).toContain('061302')
  })
})


describe('Saudi education classification context', () => {
  it('maps KAU FCIT course namespaces to national educational specializations', () => {
    expect(ssceForCourse({code:'CPIT-250'})?.code).toBe('061303')
    expect(ssceForCourse({code:'CPCS-204'})?.code).toBe('061301')
    expect(ssceForCourse({code:'CPIS-220'})?.code).toBe('061304')
    expect(ssceForCourse({code:'STAT-201'})).toBeNull()
  })

  it('keeps the official ICT hierarchy separate from skill evidence', () => {
    expect(ssceIct.broad.code).toBe('06')
    expect(ssceIct.narrow.code).toBe('061')
    expect(ssceIct.specializations['061302'].labels.ar).toBe('هندسة البرمجيات')
    expect(ssceIct.specializations['061901'].labels.ar).toBe('الذكاء الاصطناعي')
    expect(ssceIct.specializations['061902'].labels.ar).toBe('علوم البيانات')
  })

  it('selects a dominant transcript programme context without classifying unrelated courses', () => {
    const result=inferTranscriptSsces([
      {code:'CPIT-250'},{code:'CPIT-251'},{code:'CPIT-260'},{code:'STAT-201'}
    ])
    expect(result.primary.code).toBe('061303')
    expect(result.primary.count).toBe(3)
    expect(result.mappedCourses).toBe(3)
    expect(result.totalCourses).toBe(4)
  })
})
