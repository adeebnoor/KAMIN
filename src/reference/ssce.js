// Saudi Standard Classification of Educational Levels and Specializations (SSCE)
// National educational taxonomy context only. This layer does NOT create skill evidence.
// Reviewed against the Ministry of Education classification guide (1441H / 2020)
// and KAU FCIT program/course-code documentation on 2026-09-26.

export const ssceReference = {
  id: 'SA-SSCE',
  name: {
    ar: 'التصنيف السعودي الموحد للمستويات والتخصصات التعليمية',
    en: 'Saudi Standard Classification of Educational Levels and Specializations',
  },
  version: '1441H-2020',
  reviewed: '2026-09-26',
  sourceUrl: 'https://www.qu.edu.sa/wp-content/uploads/2025/05/v1/2023-11-13-04-57-25%D8%A7%D9%84%D8%AA%D8%B5%D9%86%D9%8A%D9%81%20%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%20%D8%A7%D9%84%D9%85%D9%88%D8%AD%D8%AF%20%D9%84%D9%84%D9%85%D8%B3%D8%AA%D9%88%D9%8A%D8%A7%D8%AA%20%D9%88%D8%A7%D9%84%D8%AA%D8%AE%D8%B5%D8%B5%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85%D9%8A%D8%A9%20(1)%20(1).pdf',
  backupSourceUrl: 'https://faculty.ksu.edu.sa/sites/default/files/%D8%AF%D9%84%D9%8A%D9%84-%D8%A7%D9%84%D8%AA%D8%B5%D9%86%D9%8A%D9%81-%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A-%D8%A7%D9%84%D9%85%D9%88%D8%AD%D8%AF-%D9%84%D9%84%D9%85%D8%B3%D8%AA%D9%88%D9%8A%D8%A7%D8%AA-%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85%D9%8A%D8%A9.pdf',
}

export const ssceLevels = {
  '6': { code:'6', labels:{ ar:'البكالوريوس أو ما يعادلها', en:'Bachelor or equivalent' } },
  '7': { code:'7', labels:{ ar:'الماجستير أو ما يعادلها', en:'Master or equivalent' } },
  '8': { code:'8', labels:{ ar:'الدكتوراه أو ما يعادلها', en:'Doctorate or equivalent' } },
}

export const ssceIct = {
  broad: {
    code:'06',
    labels:{ ar:'تقنية الاتصالات والمعلومات', en:'Information and Communication Technologies' },
  },
  narrow: {
    code:'061',
    labels:{ ar:'تقنية الاتصالات والمعلومات', en:'Information and Communication Technologies' },
  },
  detailedFields: {
    '0611': { code:'0611', labels:{ ar:'استخدام الحاسب الآلي', en:'Computer use' } },
    '0612': { code:'0612', labels:{ ar:'تصميم وإدارة قواعد البيانات والشبكات', en:'Database and network design and administration' } },
    '0613': { code:'0613', labels:{ ar:'تطوير وتحليل البرمجيات والتطبيقات', en:'Software and applications development and analysis' } },
    '0619': { code:'0619', labels:{ ar:'برامج أخرى في تقنية الاتصالات والمعلومات غير مصنفة في مكان آخر', en:'Other ICT programmes not elsewhere classified' } },
    '0688': { code:'0688', labels:{ ar:'برامج ومؤهلات متعددة التخصصات تتضمن تقنية الاتصالات والمعلومات', en:'Interdisciplinary programmes involving ICT' } },
  },
  specializations: {
    '061201': { code:'061201', detailed:'0612', labels:{ ar:'إدارة أنظمة الشبكات', en:'Network systems administration' } },
    '061202': { code:'061202', detailed:'0612', labels:{ ar:'الدعم الفني', en:'Technical support' } },
    '061203': { code:'061203', detailed:'0612', labels:{ ar:'أمن المعلومات', en:'Information security' } },
    '061301': { code:'061301', detailed:'0613', labels:{ ar:'البرمجة وعلوم الحاسب', en:'Programming and computer science' } },
    '061302': { code:'061302', detailed:'0613', labels:{ ar:'هندسة البرمجيات', en:'Software engineering' } },
    '061303': { code:'061303', detailed:'0613', labels:{ ar:'تقنية المعلومات', en:'Information technology' } },
    '061304': { code:'061304', detailed:'0613', labels:{ ar:'نظم المعلومات', en:'Information systems' } },
    '061901': { code:'061901', detailed:'0619', labels:{ ar:'الذكاء الاصطناعي', en:'Artificial intelligence' } },
    '061902': { code:'061902', detailed:'0619', labels:{ ar:'علوم البيانات', en:'Data science' } },
    '061999': { code:'061999', detailed:'0619', labels:{ ar:'تخصصات أخرى في تقنية الاتصالات والمعلومات غير مصنفة في مكان آخر', en:'Other ICT specializations not elsewhere classified' } },
    '068801': { code:'068801', detailed:'0688', labels:{ ar:'المعلوماتية الصحية', en:'Health informatics' } },
  },
}

// Institution-specific namespace mapping. This maps the academic programme context,
// not individual mastery. The mapping is intentionally explicit and reviewable.
export const institutionalProgrammeMappings = [
  {
    institution:'KAU-FCIT',
    prefix:'CPIT',
    ssce:'061303',
    evidence:'KAU IT programme states CP + IT is the department code.',
    sourceUrl:'https://fcitweb.kau.edu.sa/fcitwebsite/uploads/IT-ProgramCourses.pdf',
  },
  {
    institution:'KAU-FCIT',
    prefix:'CPCS',
    ssce:'061301',
    evidence:'KAU CS programme states CP + CS is the department code.',
    sourceUrl:'https://fcitweb.kau.edu.sa/fcitwebsite/uploads/CS_Bachelor_Program_Program_Courses.pdf',
  },
  {
    institution:'KAU-FCIT',
    prefix:'CPIS',
    ssce:'061304',
    evidence:'KAU B.S. Information Systems curriculum uses the CPIS namespace.',
    sourceUrl:'https://fcitweb.kau.edu.sa/fcitwebsite/uploads/IS_Program_Curriculum.PDF',
  },
]

const coursePrefix=(code)=>String(code||'').trim().toUpperCase().split(/[-\s]/)[0]

export function ssceForCourse(course,{institution='KAU-FCIT'}={}){
  const prefix=coursePrefix(course?.code)
  const mapping=institutionalProgrammeMappings.find(item=>item.institution===institution && item.prefix===prefix)
  if(!mapping) return null
  const specialization=ssceIct.specializations[mapping.ssce]
  if(!specialization) return null
  return {
    ...specialization,
    broad:ssceIct.broad,
    narrow:ssceIct.narrow,
    detailed:ssceIct.detailedFields[specialization.detailed],
    institution,
    coursePrefix:prefix,
    mappingEvidence:mapping.evidence,
    mappingSourceUrl:mapping.sourceUrl,
    status:'contextual-approved-pilot',
  }
}

export function inferTranscriptSsces(courses,{institution='KAU-FCIT'}={}){
  const contexts=(courses||[]).map(course=>ssceForCourse(course,{institution})).filter(Boolean)
  const counts=new Map()
  for(const context of contexts) counts.set(context.code,(counts.get(context.code)||0)+1)
  const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1])
  if(!ranked.length) return { primary:null, contexts:[], coverage:0, mappedCourses:0, totalCourses:(courses||[]).length }
  const [code,count]=ranked[0]
  const primary=contexts.find(context=>context.code===code)
  return {
    primary:{...primary,count},
    contexts,
    mappedCourses:contexts.length,
    totalCourses:(courses||[]).length,
    coverage:(courses||[]).length ? contexts.length/(courses||[]).length : 0,
    isMixed:ranked.length>1,
    alternatives:ranked.slice(1).map(([altCode,altCount])=>({...contexts.find(c=>c.code===altCode),count:altCount})),
  }
}
