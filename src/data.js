export const demoCourses = [
  { code: 'CPIT-251', name: { ar: 'تحليل وتصميم النظم', en: 'Systems Analysis & Design' }, grade: 'A', source: 'demo' },
  { code: 'CPIT-252', name: { ar: 'هندسة البرمجيات', en: 'Software Engineering' }, grade: 'B+', source: 'demo' },
  { code: 'CPIT-260', name: { ar: 'قواعد البيانات', en: 'Database Systems' }, grade: 'B', source: 'demo' },
  { code: 'CPIT-305', name: { ar: 'إدارة المشاريع التقنية', en: 'IT Project Management' }, grade: 'A-', source: 'demo' },
  { code: 'STAT-201', name: { ar: 'الإحصاء التطبيقي', en: 'Applied Statistics' }, grade: 'B+', source: 'demo' },
  { code: 'CPIT-499', name: { ar: 'مشروع التخرج', en: 'Graduation Project' }, grade: 'A', source: 'demo' },
]

export const skills = {
  requirements: { id: 'requirements', labels: { ar: 'تحليل المتطلبات', en: 'Requirements analysis' } },
  software: { id: 'software', labels: { ar: 'هندسة البرمجيات', en: 'Software engineering' } },
  database: { id: 'database', labels: { ar: 'قواعد البيانات', en: 'Databases' } },
  project: { id: 'project', labels: { ar: 'إدارة المشاريع', en: 'Project management' } },
  statistics: { id: 'statistics', labels: { ar: 'التحليل الكمي', en: 'Quantitative analysis' } },
  aiWork: { id: 'ai-work', labels: { ar: 'توظيف الذكاء الاصطناعي في العمل', en: 'AI use at work' } },
}

/*
 * Pilot mapping only. Production use requires the department-approved course-to-learning-
 * outcome mapping required by BRD FR-14/FR-15. Unknown course titles never create skills.
 */
export const courseSkillMap = {
  'CPIT-251': { evidenceType: 'knowledge', skills: ['requirements'], learningOutcome: { ar: 'تحليل احتياجات أصحاب المصلحة وصياغة المتطلبات', en: 'Analyze stakeholder needs and specify requirements' } },
  'CPIT-252': { evidenceType: 'knowledge', skills: ['software'], learningOutcome: { ar: 'تطبيق مبادئ هندسة البرمجيات', en: 'Apply software engineering principles' } },
  'CPIT-260': { evidenceType: 'knowledge', skills: ['database'], learningOutcome: { ar: 'تصميم واستخدام قواعد البيانات', en: 'Design and use database systems' } },
  'CPIT-305': { evidenceType: 'knowledge', skills: ['project'], learningOutcome: { ar: 'تطبيق مبادئ إدارة المشاريع التقنية', en: 'Apply IT project management principles' } },
  'STAT-201': { evidenceType: 'knowledge', skills: ['statistics'], learningOutcome: { ar: 'تطبيق الأساليب الإحصائية في التحليل', en: 'Apply statistical methods in analysis' } },
  'CPIT-499': { evidenceType: 'applied', skills: ['requirements','project'], learningOutcome: { ar: 'تطبيق مهارات التخصص في مشروع متكامل', en: 'Apply disciplinary skills in an integrated project' } },
}

export const opportunities = [
  {
    id: 'ba',
    title: { ar: 'أساسيات تحليل الأعمال', en: 'Business Analysis Foundations' },
    provider: 'مثال توضيحي · Illustrative example',
    duration: { ar: '6 أسابيع', en: '6 weeks' },
    cost: { ar: 'تقديرية', en: 'Illustrative' },
    goals: ['management', 'product'],
    requires: ['requirements'],
    teaches: ['requirements'],
    outcome: { ar: 'صياغة احتياج أعمال واضح وتحويله إلى متطلبات قابلة للتنفيذ.', en: 'Turn a business need into clear, actionable requirements.' },
  },
  {
    id: 'sql',
    title: { ar: 'SQL للمحللين', en: 'SQL for Analysts' },
    provider: 'مثال توضيحي · Illustrative example',
    duration: { ar: '5 أسابيع', en: '5 weeks' },
    cost: { ar: 'تقديرية', en: 'Illustrative' },
    goals: ['data', 'product'],
    requires: [],
    teaches: ['database'],
    outcome: { ar: 'بناء تقرير أسبوعي آلي بالاعتماد على استعلامات SQL.', en: 'Build an automated weekly report using SQL queries.' },
  },
  {
    id: 'capm',
    title: { ar: 'CAPM — تأسيس إدارة المشاريع', en: 'CAPM — Project Management Foundation' },
    provider: 'PMI',
    duration: { ar: 'بحسب المزود والاستعداد', en: 'Depends on provider and readiness' },
    cost: { ar: 'راجع المزود', en: 'See provider' },
    goals: ['management'],
    requires: [],
    teaches: ['project'],
    outcome: { ar: 'بناء أساس منهجي في مفاهيم وممارسات إدارة المشاريع.', en: 'Build a structured foundation in project-management concepts and practices.' },
  },
  {
    id: 'pmp',
    title: { ar: 'PMP — محترف إدارة المشاريع', en: 'PMP — Project Management Professional' },
    provider: 'PMI',
    duration: { ar: 'حسب الأهلية والاستعداد', en: 'Depends on eligibility and readiness' },
    cost: { ar: 'راجع PMI', en: 'See PMI' },
    goals: ['management'],
    requires: ['project'],
    teaches: [],
    outcome: { ar: 'الاستعداد لشهادة مهنية متقدمة بعد استيفاء متطلبات الأهلية الرسمية.', en: 'Prepare for an advanced professional credential after meeting official eligibility requirements.' },
    formalGate: {
      id: 'PMI-PMP-EXPERIENCE',
      text: { ar: 'لحامل البكالوريوس: 36 شهرًا من خبرة قيادة المشاريع و35 ساعة تدريب بحسب قاعدة BRD الحالية.', en: 'For a bachelor’s degree holder: 36 months of project leadership experience and 35 hours of training under the current BRD rule.' },
      source: 'https://www.pmi.org/certifications/project-management-pmp',
      reviewed: '2026-09-26',
      alternative: { ar: 'ابدأ بمسار تحليل الأعمال أو CAPM، ثم أعد تقييم PMP بعد اكتساب الخبرة.', en: 'Start with business analysis or CAPM, then reassess PMP after gaining experience.' }
    },
  },
  {
    id: 'cyber-foundations',
    title: { ar: 'أساسيات الأمن السيبراني', en: 'Cybersecurity Foundations' },
    provider: 'مثال توضيحي · Illustrative example',
    duration: { ar: '7 أسابيع', en: '7 weeks' },
    cost: { ar: 'تقديرية', en: 'Illustrative' },
    goals: ['cyber'],
    requires: [],
    teaches: ['cyber'],
    outcome: { ar: 'فهم أساسيات حماية الأنظمة والبيانات وتطبيق ضوابط أولية.', en: 'Understand core system/data protection concepts and apply baseline controls.' },
  },
]
