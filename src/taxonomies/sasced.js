export const SASCED_SOURCE = {
  id: 'SASCED-20',
  ar: 'التصنيف السعودي الموحد للمستويات والتخصصات التعليمية',
  en: 'Saudi Standard Classification of Educational Levels and Specialties',
  authority: 'وزارة التعليم',
  year: 2020,
  basis: ['ISCED 2011','ISCED-F 2013'],
  url: 'https://www.qu.edu.sa/storage/files/documents/2023-11-13-04-57-25%D8%A7%D9%84%D8%AA%D8%B5%D9%86%D9%8A%D9%81%20%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%20%D8%A7%D9%84%D9%85%D9%88%D8%AD%D8%AF%20%D9%84%D9%84%D9%85%D8%B3%D8%AA%D9%88%D9%8A%D8%A7%D8%AA%20%D9%88%D8%A7%D9%84%D8%AA%D8%AE%D8%B5%D8%B5%D8%A7%D8%AA%20%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85%D9%8A%D8%A9%20(1)%20(1).pdf',
}

export const sascedLevels = {
  '0': { ar:'تعليم الطفولة المبكرة', en:'Early Childhood Education' },
  '1': { ar:'التعليم الابتدائي', en:'Primary Education' },
  '2': { ar:'التعليم المتوسط', en:'Lower Secondary Education' },
  '3': { ar:'التعليم الثانوي', en:'Upper Secondary Education' },
  '4': { ar:'الدبلوم المشارك', en:'Associate Diploma' },
  '5': { ar:'الدبلوم المتوسط', en:'Intermediate Diploma' },
  '6': { ar:'البكالوريوس أو ما يعادلها', en:'Bachelor or Equivalent' },
  '7': { ar:'الماجستير أو ما يعادلها', en:'Master or Equivalent' },
  '8': { ar:'الدكتوراه أو ما يعادلها', en:'Doctorate or Equivalent' },
}

export const sascedLevelAliases = {
  '8': ['دكتوراه','الدكتوراه','doctorate','doctoral','phd'],
  '7': ['ماجستير','الماجستير','master','masters','msc','ma degree'],
  '6': ['بكالوريوس','البكالوريوس','bachelor','bachelors','bsc','ba degree'],
  '5': ['دبلوم متوسط','intermediate diploma'],
  '4': ['دبلوم مشارك','associate diploma','associate degree'],
  '3': ['الثانوية','التعليم الثانوي','high school','upper secondary'],
  '2': ['المتوسط','التعليم المتوسط','lower secondary'],
  '1': ['الابتدائي','التعليم الابتدائي','primary education'],
  '0': ['الطفولة المبكرة','رياض الاطفال','early childhood'],
}

export const sascedIctHierarchy = {
  broad: { code:'06', ar:'تقنية الاتصالات والمعلومات', en:'Information and Communication Technologies' },
  narrow: { code:'061', ar:'تقنية الاتصالات والمعلومات', en:'Information and Communication Technologies' },
  detailed: {
    '0610': { ar:'برامج غير محددة في تقنية الاتصالات والمعلومات', en:'ICT programmes not further defined' },
    '0611': { ar:'استخدام الحاسب الآلي', en:'Computer use' },
    '0612': { ar:'تصميم وإدارة قواعد البيانات والشبكات', en:'Database and network design and administration' },
    '0613': { ar:'تطوير وتحليل البرمجيات والتطبيقات', en:'Software and applications development and analysis' },
    '0619': { ar:'برامج أخرى في تقنية الاتصالات والمعلومات غير مصنفة في مكان آخر', en:'ICT programmes not elsewhere classified' },
    '0688': { ar:'برامج ومؤهلات متعددة التخصصات تتضمن تقنية المعلومات والاتصالات', en:'Interdisciplinary programmes involving ICT' },
  },
}

export const sascedSpecialties = {
  '061000': { detailed:'0610', ar:'تخصص غير محدد في تقنية الاتصالات والمعلومات', en:'ICT specialty not further defined' },
  '061101': { detailed:'0611', ar:'التطبيقات المكتبية وصيانة الحاسب للمعوقين سمعيًا', en:'Office applications and computer maintenance for hearing-impaired learners' },
  '061102': { detailed:'0611', ar:'التطبيقات المكتبية على الحاسب للمعوقين بصريًا', en:'Computer office applications for visually-impaired learners' },
  '061201': { detailed:'0612', ar:'إدارة أنظمة الشبكات', en:'Network Systems Administration' },
  '061202': { detailed:'0612', ar:'الدعم الفني', en:'Technical Support' },
  '061203': { detailed:'0612', ar:'أمن المعلومات', en:'Information Security' },
  '061301': { detailed:'0613', ar:'البرمجة وعلوم الحاسب', en:'Programming and Computer Science' },
  '061302': { detailed:'0613', ar:'هندسة البرمجيات', en:'Software Engineering' },
  '061303': { detailed:'0613', ar:'تقنية المعلومات', en:'Information Technology' },
  '061304': { detailed:'0613', ar:'نظم المعلومات', en:'Information Systems' },
  '061901': { detailed:'0619', ar:'الذكاء الاصطناعي', en:'Artificial Intelligence' },
  '061902': { detailed:'0619', ar:'علوم البيانات', en:'Data Science' },
  '061999': { detailed:'0619', ar:'تخصصات أخرى في تقنية الاتصالات والمعلومات غير مصنفة في مكان آخر', en:'Other ICT specialties not elsewhere classified' },
  '068801': { detailed:'0688', ar:'المعلوماتية الصحية', en:'Health Informatics' },
}

const normalize = value => String(value||'')
  .toLowerCase()
  .replace(/[أإآ]/g,'ا')
  .replace(/ة/g,'ه')
  .replace(/[^؀-ۿa-z0-9]+/g,' ')
  .replace(/\s+/g,' ')
  .trim()

export const sascedAliases = {
  '061201': ['ادارة انظمة الشبكات','ادارة الشبكات','network systems administration','network administration'],
  '061202': ['الدعم الفني','technical support','it support'],
  '061203': ['امن المعلومات','الامن السيبراني','امن سيبراني','information security','cybersecurity','cyber security'],
  '061301': ['البرمجة وعلوم الحاسب','علوم الحاسب','علوم الحاسب الالي','computer science','computing','programming and computer science'],
  '061302': ['هندسة البرمجيات','software engineering'],
  '061303': ['تقنية المعلومات','تكنولوجيا المعلومات','information technology','it program'],
  '061304': ['نظم المعلومات','نظم المعلومات الادارية','information systems','management information systems','mis'],
  '061901': ['الذكاء الاصطناعي','artificial intelligence','ai'],
  '061902': ['علوم البيانات','علم البيانات','data science'],
  '068801': ['المعلوماتية الصحية','المعلوماتيه الصحيه','health informatics','medical informatics'],
}

export function getSascedSpecialty(code){
  const specialty=sascedSpecialties[String(code||'')]
  if(!specialty) return null
  const detailed=sascedIctHierarchy.detailed[specialty.detailed] || null
  return {
    code:String(code),
    ...specialty,
    broad:sascedIctHierarchy.broad,
    narrow:sascedIctHierarchy.narrow,
    detailed: detailed ? {code:specialty.detailed,...detailed} : null,
    source:SASCED_SOURCE,
  }
}

export function findSascedLevelCandidates(text){
  const n=normalize(text)
  if(!n) return []
  const padded=' '+n+' '
  const matches=[]
  for(const [code,aliases] of Object.entries(sascedLevelAliases)){
    let best=null
    for(const alias of aliases){
      const a=normalize(alias)
      if(!a) continue
      const index=padded.indexOf(' '+a+' ')
      if(index<0) continue
      const score=Math.min(1,.8 + Math.min(.2,a.length/40))
      if(!best || score>best.score) best={alias,score,index}
    }
    if(best) matches.push({code,...sascedLevels[code],match:best.alias,score:best.score,source:SASCED_SOURCE})
  }
  return matches.sort((a,b)=>b.score-a.score || Number(b.code)-Number(a.code))
}

export function findSascedCandidates(text){
  const n=normalize(text)
  if(!n) return []
  const matches=[]
  for(const [code,aliases] of Object.entries(sascedAliases)){
    let best=null
    for(const alias of aliases){
      const a=normalize(alias)
      if(!a) continue
      const index=(' '+n+' ').indexOf(' '+a+' ')
      if(index<0) continue
      const score=Math.min(1,.72 + Math.min(.28,a.length/60))
      if(!best || score>best.score) best={alias,score,index}
    }
    if(best) matches.push({...getSascedSpecialty(code),match:best.alias,score:best.score})
  }
  return matches.sort((a,b)=>b.score-a.score || a.code.localeCompare(b.code))
}

/*
 * Context tags only. They do NOT classify an individual course and do not affect fit scores.
 * They indicate official SASCED specialty contexts in which a course/mapped learning outcome
 * is particularly relevant. Program classification must be confirmed from the student's
 * declared/official programme.
 */
export const courseSascedContexts = {
  'CPIT-251': ['061304','061302'],
  'CPIT-252': ['061302'],
  'CPIT-260': ['061303','061304','061301'],
  'CPIT-305': ['061303'],
  'CPIT-499': ['061303','061304','061302','061301'],
  'STAT-201': [],
}


/*
 * Institution-specific programme namespace crosswalk.
 * This is academic context only; it does not create skills or alter fit judgments.
 */
export const institutionalProgrammeMappings = [
  {
    institution:'KAU-FCIT',
    prefix:'CPIT',
    sasced:'061303',
    evidence:'KAU IT programme states CP + IT is the department code.',
    sourceUrl:'https://fcitweb.kau.edu.sa/fcitwebsite/uploads/IT-ProgramCourses.pdf',
  },
  {
    institution:'KAU-FCIT',
    prefix:'CPCS',
    sasced:'061301',
    evidence:'KAU CS programme states CP + CS is the department code.',
    sourceUrl:'https://fcitweb.kau.edu.sa/fcitwebsite/uploads/CS_Bachelor_Program_Program_Courses.pdf',
  },
  {
    institution:'KAU-FCIT',
    prefix:'CPIS',
    sasced:'061304',
    evidence:'KAU B.S. Information Systems curriculum uses the CPIS namespace.',
    sourceUrl:'https://fcitweb.kau.edu.sa/fcitwebsite/uploads/IS_Program_Curriculum.PDF',
  },
]

const coursePrefix=(code)=>String(code||'').trim().toUpperCase().split(/[-\s]/)[0]

export function sascedForCourse(course,{institution='KAU-FCIT'}={}){
  const prefix=coursePrefix(course?.code)
  const mapping=institutionalProgrammeMappings.find(item=>item.institution===institution && item.prefix===prefix)
  if(!mapping) return null
  const specialty=getSascedSpecialty(mapping.sasced)
  if(!specialty) return null
  return {
    code:specialty.code,
    labels:{ar:specialty.ar,en:specialty.en},
    broad:{code:specialty.broad.code,labels:{ar:specialty.broad.ar,en:specialty.broad.en}},
    narrow:{code:specialty.narrow.code,labels:{ar:specialty.narrow.ar,en:specialty.narrow.en}},
    detailed:specialty.detailed ? {code:specialty.detailed.code,labels:{ar:specialty.detailed.ar,en:specialty.detailed.en}} : null,
    institution,
    coursePrefix:prefix,
    mappingEvidence:mapping.evidence,
    mappingSourceUrl:mapping.sourceUrl,
    status:'contextual-approved-pilot',
  }
}

export function inferTranscriptSascedContext(courses,{institution='KAU-FCIT'}={}){
  const contexts=(courses||[]).map(course=>sascedForCourse(course,{institution})).filter(Boolean)
  const counts=new Map()
  for(const context of contexts) counts.set(context.code,(counts.get(context.code)||0)+1)
  const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1])
  if(!ranked.length) return {primary:null,contexts:[],coverage:0,mappedCourses:0,totalCourses:(courses||[]).length}
  const [code,count]=ranked[0]
  const primary=contexts.find(context=>context.code===code)
  return {
    primary:{...primary,count},
    contexts,
    mappedCourses:contexts.length,
    totalCourses:(courses||[]).length,
    coverage:(courses||[]).length ? contexts.length/(courses||[]).length : 0,
    isMixed:ranked.length>1,
    alternatives:ranked.slice(1).map(([altCode,altCount])=>({...contexts.find(context=>context.code===altCode),count:altCount})),
  }
}
