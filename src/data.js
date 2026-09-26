export const SKILL_CATALOG = {
  requirements: {
    id: 'requirements',
    labels: { ar: 'تحليل المتطلبات', en: 'Requirements analysis' },
    esco: 'http://data.europa.eu/esco/skill/requirements-analysis',
  },
  software: {
    id: 'software',
    labels: { ar: 'هندسة البرمجيات', en: 'Software engineering' },
    esco: 'http://data.europa.eu/esco/skill/software-engineering',
  },
  database: {
    id: 'database',
    labels: { ar: 'قواعد البيانات', en: 'Databases' },
    esco: 'http://data.europa.eu/esco/skill/database-management',
  },
  project: {
    id: 'project',
    labels: { ar: 'إدارة المشاريع', en: 'Project management' },
    esco: 'http://data.europa.eu/esco/skill/project-management',
  },
  statistics: {
    id: 'statistics',
    labels: { ar: 'التحليل الكمي', en: 'Quantitative analysis' },
    esco: 'http://data.europa.eu/esco/skill/statistical-analysis',
  },
  web: {
    id: 'web',
    labels: { ar: 'تطوير الويب', en: 'Web development' },
    esco: 'http://data.europa.eu/esco/skill/web-development',
  },
  programming: {
    id: 'programming',
    labels: { ar: 'البرمجة وحل المشكلات', en: 'Programming & problem solving' },
    esco: 'http://data.europa.eu/esco/skill/programming',
  },
  cyber: {
    id: 'cyber',
    labels: { ar: 'أساسيات الأمن السيبراني', en: 'Cybersecurity foundations' },
    esco: 'http://data.europa.eu/esco/skill/cybersecurity',
  },
  'ai-work': {
    id: 'ai-work',
    labels: { ar: 'توظيف الذكاء الاصطناعي في العمل', en: 'AI-enabled work' },
    esco: 'local-extension:ai-enabled-work',
  },
  'ops-governance': {
    id: 'ops-governance',
    labels: { ar: 'التشغيل والحوكمة والتحول', en: 'Operations, governance & transformation' },
    esco: 'local-extension:operations-governance-transformation',
  },
}

export const demoCourses = [
  { code: 'CPIT-251', name: { ar: 'تحليل وتصميم النظم', en: 'Systems Analysis & Design' }, grade: 'A', source: 'demo' },
  { code: 'CPIT-252', name: { ar: 'هندسة البرمجيات', en: 'Software Engineering' }, grade: 'B+', source: 'demo' },
  { code: 'CPIT-260', name: { ar: 'قواعد البيانات', en: 'Database Systems' }, grade: 'B', source: 'demo' },
  { code: 'CPIT-305', name: { ar: 'إدارة المشاريع التقنية', en: 'IT Project Management' }, grade: 'A-', source: 'demo' },
  { code: 'STAT-201', name: { ar: 'الإحصاء التطبيقي', en: 'Applied Statistics' }, grade: 'B+', source: 'demo' },
  { code: 'CPIT-499', name: { ar: 'مشروع التخرج', en: 'Graduation Project' }, grade: 'A', source: 'demo' },
]

export const GOALS = {
  management: {
    labels: { ar: 'الإدارة والمشاريع', en: 'Management & projects' },
    sectors: ['mega-projects', 'technology', 'financial-services'],
    relatedSkills: ['requirements', 'project', 'ops-governance'],
  },
  data: {
    labels: { ar: 'البيانات والتحليلات', en: 'Data & analytics' },
    sectors: ['technology', 'financial-services', 'health'],
    relatedSkills: ['database', 'statistics', 'programming', 'ai-work'],
  },
  product: {
    labels: { ar: 'المنتج والتحول الرقمي', en: 'Product & digital transformation' },
    sectors: ['technology', 'tourism-hospitality', 'mega-projects'],
    relatedSkills: ['requirements', 'software', 'web', 'ai-work'],
  },
  cyber: {
    labels: { ar: 'الأمن السيبراني', en: 'Cybersecurity' },
    sectors: ['technology', 'financial-services', 'energy'],
    relatedSkills: ['cyber', 'programming'],
  },
}

export const SECTORS = {
  industry: { ar: 'الصناعة', en: 'Industry' },
  energy: { ar: 'الطاقة', en: 'Energy' },
  mining: { ar: 'التعدين', en: 'Mining' },
  'tourism-hospitality': { ar: 'السياحة والضيافة', en: 'Tourism & hospitality' },
  'transport-logistics': { ar: 'النقل والخدمات اللوجستية', en: 'Transport & logistics' },
  'financial-services': { ar: 'الخدمات المالية', en: 'Financial services' },
  health: { ar: 'الصحة', en: 'Health' },
  technology: { ar: 'التقنية', en: 'Technology' },
  'mega-projects': { ar: 'المشاريع الكبرى', en: 'Mega-projects' },
}

export const opportunities = [
  {
    id: 'ba',
    title: { ar: 'أساسيات تحليل الأعمال', en: 'Business Analysis Foundations' },
    provider: { ar: 'مثال توضيحي', en: 'Illustrative catalog' },
    illustrative: true,
    duration: { ar: '6 أسابيع — مثال', en: '6 weeks — example' },
    cost: { ar: 'مثال توضيحي', en: 'Illustrative' },
    goals: ['management', 'product'],
    requires: ['requirements'],
    teaches: ['requirements', 'ops-governance'],
    outcome: {
      ar: 'ستستطيع تحويل احتياج تشغيلي إلى متطلبات واضحة قابلة للتنفيذ والتتبع.',
      en: 'You will be able to turn an operational need into clear, traceable, actionable requirements.',
    },
    sectors: ['technology', 'mega-projects'],
  },
  {
    id: 'sql',
    title: { ar: 'SQL للمحللين', en: 'SQL for Analysts' },
    provider: { ar: 'مثال توضيحي', en: 'Illustrative catalog' },
    illustrative: true,
    duration: { ar: '5 أسابيع — مثال', en: '5 weeks — example' },
    cost: { ar: 'مثال توضيحي', en: 'Illustrative' },
    goals: ['data', 'product'],
    requires: ['database'],
    teaches: ['database'],
    outcome: {
      ar: 'ستستطيع بناء استعلامات وتحويلها إلى تقرير أسبوعي آلي بدل التجميع اليدوي.',
      en: 'You will be able to build queries that feed an automated weekly report instead of manual aggregation.',
    },
    sectors: ['technology', 'financial-services'],
  },
  {
    id: 'capm',
    title: { ar: 'CAPM — تأسيس إدارة المشاريع', en: 'CAPM — Project Management Foundation' },
    provider: { ar: 'PMI', en: 'PMI' },
    providerUrl: 'https://www.pmi.org/certifications/certified-associate-capm',
    duration: { ar: 'راجع مزود الشهادة', en: 'See credential provider' },
    cost: { ar: 'تختلف الرسوم؛ راجع PMI', en: 'Fees vary; see PMI' },
    goals: ['management'],
    requires: ['requirements'],
    teaches: ['project'],
    outcome: {
      ar: 'ستبني أساسًا منظمًا في مفاهيم إدارة المشاريع قبل الانتقال إلى شهادات الخبرة المتقدمة.',
      en: 'You will build a structured foundation in project management before moving to experience-gated credentials.',
    },
    sectors: ['mega-projects', 'technology'],
  },
  {
    id: 'pmp',
    title: { ar: 'PMP — محترف إدارة المشاريع', en: 'PMP — Project Management Professional' },
    provider: { ar: 'PMI', en: 'PMI' },
    providerUrl: 'https://www.pmi.org/certifications/project-management-pmp',
    duration: { ar: 'بحسب الأهلية والاستعداد', en: 'Depends on eligibility and readiness' },
    cost: { ar: 'تختلف الرسوم؛ راجع PMI', en: 'Fees vary; see PMI' },
    goals: ['management'],
    requires: ['project'],
    teaches: [],
    formalGate: {
      id: 'RULE-PMP-EXP-2026-09',
      ar: 'لحامل البكالوريوس: 36 شهرًا من خبرة قيادة المشاريع و35 ساعة تدريب بحسب مرجع متطلبات المشروع.',
      en: 'For a bachelor’s degree holder: 36 months leading projects plus 35 hours of training, per the project requirements reference.',
      sourceUrl: 'https://www.pmi.org/certifications/project-management-pmp',
      reviewedAt: '2026-09-26',
      alternative: {
        ar: 'ابدأ بمسار تحليل الأعمال أو CAPM/Scrum، وابنِ خبرة قيادة مشاريع فعلية قبل PMP.',
        en: 'Start with business analysis or CAPM/Scrum and build real project-leadership experience before PMP.',
      },
    },
    outcome: {
      ar: 'هذه شهادة تحقق خبرة متقدمة؛ القيمة هنا في إثبات الأهلية والخبرة لا في دورة تمهيدية وحدها.',
      en: 'This credential validates advanced experience; the value is eligibility and experience, not a preparatory course alone.',
    },
    sectors: ['mega-projects', 'technology', 'energy'],
  },
  {
    id: 'cyber-foundations',
    title: { ar: 'أساسيات الأمن السيبراني', en: 'Cybersecurity Foundations' },
    provider: { ar: 'مثال توضيحي', en: 'Illustrative catalog' },
    illustrative: true,
    duration: { ar: '7 أسابيع — مثال', en: '7 weeks — example' },
    cost: { ar: 'مثال توضيحي', en: 'Illustrative' },
    goals: ['cyber'],
    requires: [],
    teaches: ['cyber'],
    outcome: {
      ar: 'ستستطيع تفسير المخاطر الأساسية وتطبيق ضوابط حماية أولية على نظام ويب بسيط.',
      en: 'You will be able to explain core risks and apply baseline controls to a simple web system.',
    },
    sectors: ['technology', 'financial-services'],
  },
]

export const VAULT_RECORD_TYPES = [
  { id: 'education', layer: 1, release: 1, active: true, labels: { ar: 'السجل التعليمي', en: 'Education record' } },
  { id: 'professional', layer: 1, release: 2, active: false, labels: { ar: 'السجل المهني والإنجازات', en: 'Professional record & achievements' } },
  { id: 'training', layer: 1, release: 2, active: false, labels: { ar: 'التدريب', en: 'Training' } },
  { id: 'volunteering', layer: 1, release: 2, active: false, labels: { ar: 'التطوع', en: 'Volunteering' } },
  { id: 'national-address', layer: 2, release: 3, active: false, labels: { ar: 'العنوان الوطني', en: 'National address' } },
  { id: 'driving', layer: 2, release: 3, active: false, labels: { ar: 'مخالفات القيادة', en: 'Driving record' } },
  { id: 'health', layer: 3, release: 3, active: false, purposeOnly: true, labels: { ar: 'الصحي', en: 'Health' } },
  { id: 'credit', layer: 3, release: 3, active: false, purposeOnly: true, labels: { ar: 'الائتماني', en: 'Credit' } },
  { id: 'financial', layer: 3, release: 3, active: false, purposeOnly: true, labels: { ar: 'المالي', en: 'Financial' } },
  { id: 'criminal', layer: 3, release: 3, active: false, purposeOnly: true, labels: { ar: 'الجنائي', en: 'Criminal' } },
]
