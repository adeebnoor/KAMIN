// Pilot-only mappings. These are intentionally exact course-code mappings.
// They are used for synthetic demo data only until the department formally approves
// its course -> learning outcome -> skill table (BRD D-02 / FR-14 / FR-15).

export const COURSE_MAP_VERSION = 'demo-map-2026-09-26'

export const courseMap = {
  'CPIT-251': {
    status: 'demo-approved',
    courseType: 'knowledge',
    learningOutcome: {
      ar: 'تحليل احتياجات أصحاب المصلحة وتحويلها إلى متطلبات نظام واضحة.',
      en: 'Analyze stakeholder needs and translate them into clear system requirements.',
    },
    skills: ['requirements'],
    approvedBy: 'Synthetic demo mapping',
    approvedAt: '2026-09-26',
  },
  'CPIT-252': {
    status: 'demo-approved',
    courseType: 'knowledge',
    learningOutcome: {
      ar: 'تطبيق مبادئ هندسة البرمجيات في تصميم وتطوير نظام برمجي.',
      en: 'Apply software engineering principles to the design and development of a software system.',
    },
    skills: ['software'],
    approvedBy: 'Synthetic demo mapping',
    approvedAt: '2026-09-26',
  },
  'CPIT-260': {
    status: 'demo-approved',
    courseType: 'knowledge',
    learningOutcome: {
      ar: 'تصميم واستخدام قواعد بيانات علائقية لدعم احتياجات نظام معلومات.',
      en: 'Design and use relational databases to support information-system needs.',
    },
    skills: ['database'],
    approvedBy: 'Synthetic demo mapping',
    approvedAt: '2026-09-26',
  },
  'CPIT-305': {
    status: 'demo-approved',
    courseType: 'knowledge',
    learningOutcome: {
      ar: 'تفسير مبادئ إدارة المشاريع التقنية وتطبيق أدوات التخطيط والمتابعة.',
      en: 'Explain IT project-management principles and apply planning and tracking tools.',
    },
    skills: ['project'],
    approvedBy: 'Synthetic demo mapping',
    approvedAt: '2026-09-26',
  },
  'STAT-201': {
    status: 'demo-approved',
    courseType: 'knowledge',
    learningOutcome: {
      ar: 'استخدام أساليب إحصائية أساسية لتحليل البيانات وتفسير النتائج.',
      en: 'Use basic statistical methods to analyze data and interpret results.',
    },
    skills: ['statistics'],
    approvedBy: 'Synthetic demo mapping',
    approvedAt: '2026-09-26',
  },
  'CPIT-499': {
    status: 'demo-approved',
    courseType: 'applied',
    learningOutcome: {
      ar: 'تطبيق تحليل المتطلبات وممارسات هندسة البرمجيات في مشروع متكامل.',
      en: 'Apply requirements analysis and software-engineering practices in an integrated project.',
    },
    skills: ['requirements', 'software'],
    approvedBy: 'Synthetic demo mapping',
    approvedAt: '2026-09-26',
  },
}

export function normalizeCourseCode(value = '') {
  const compact = String(value).trim().toUpperCase().replace(/\s+/g, '-').replace(/-+/g, '-')
  const match = compact.match(/^([A-Z]{2,8})-?(\d{2,4})$/)
  return match ? `${match[1]}-${match[2]}` : compact
}

export function getCourseMapping(course) {
  const mapping = courseMap[normalizeCourseCode(course?.code)]
  if (!mapping) return null
  if (mapping.status === 'approved') return mapping
  if (mapping.status === 'demo-approved' && course?.source === 'demo') return mapping
  return null
}
