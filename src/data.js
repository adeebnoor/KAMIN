import { deriveCourseSkillMap } from './catalog/fcit.js'
import courseFitCards from './catalog/course-fit-cards.json' with { type: 'json' }

// Official FCIT Catalog 2024-25 codes. CPIT-260 (Operating Systems) is included on
// purpose: it is a real course with no capability mapping, so the demo shows the
// "insufficient evidence → infer nothing" case next to the mapped ones.
// Task 55: the example is an FCIT record; this is the college as a KAU transcript prints it (made up).
export const demoCollegeRaw = 'COMPUTING & INFO. TECH.'
export const demoCourses = [
  { code: 'CPIT-250', name: { ar: 'تحليل وتصميم النظم', en: 'System Analysis & Design' }, grade: 'A', source: 'demo' },
  { code: 'CPIT-251', name: { ar: 'هندسة البرمجيات (1)', en: 'Software Engineering (I)' }, grade: 'B+', source: 'demo' },
  { code: 'CPIT-240', name: { ar: 'قواعد البيانات (1)', en: 'Databases (I)' }, grade: 'B', source: 'demo' },
  { code: 'CPIS-334', name: { ar: 'مقدمة في إدارة مشاريع البرمجيات', en: 'Introduction to Software Project Management' }, grade: 'A-', source: 'demo' },
  { code: 'STAT-110', name: { ar: 'الإحصاء العام (1)', en: 'General Statistics (1)' }, grade: 'B+', source: 'demo' },
  { code: 'CPIT-499', name: { ar: 'مشروع التخرج (2)', en: 'Senior Project (II)' }, grade: 'A', source: 'demo' },
  { code: 'CPIT-260', name: { ar: 'أنظمة التشغيل', en: 'Operating Systems' }, grade: 'B+', source: 'demo' },
]

export const skills = {
  testing: {id:'testing',labels:{ar:'تصميم وتنفيذ اختبارات البرمجيات',en:'Software test design and execution'}},
  'db-operations': {id:'db-operations',labels:{ar:'تشغيل قواعد البيانات واستعادتها',en:'Database operations and recovery'}},
  'web-development': {id:'web-development',labels:{ar:'تطوير واجهات الويب',en:'Web interface development'}},
  'systems-analysis': {id:'systems-analysis',labels:{ar:'تحليل النظم وسير العمل',en:'Systems and workflow analysis'}},
  requirements: { id: 'requirements', labels: { ar: 'تحليل المتطلبات', en: 'Requirements analysis' } },
  software: { id: 'software', labels: { ar: 'هندسة البرمجيات', en: 'Software engineering' } },
  database: { id: 'database', labels: { ar: 'قواعد البيانات', en: 'Databases' } },
  project: { id: 'project', labels: { ar: 'إدارة المشاريع', en: 'Project management' } },
  statistics: { id: 'statistics', labels: { ar: 'التحليل الكمي', en: 'Quantitative analysis' } },
  cyber: { id: 'cyber', labels: { ar: 'أساسيات الأمن السيبراني', en: 'Cybersecurity fundamentals' } },
  'ai-work': { id: 'ai-work', labels: { ar: 'توظيف الذكاء الاصطناعي في العمل', en: 'AI use at work' } },
}

/*
 * Derived from src/catalog/fcit-2024-25.json (official FCIT Catalog 2024-25). Edit the
 * catalog file, not this export. Production use still requires the department-approved
 * course-to-learning-outcome mapping (BRD FR-14/FR-15): every outcome is 'proposed' until
 * reviewed. Unknown codes and official courses with no capability never create skills.
 */
export const courseSkillMap = deriveCourseSkillMap()

// Task 19: the learning opportunities live in src/catalog/learning-opportunities.json (the local,
// team-reviewed list). Items with a `goals` list also feed the existing course-fit cards; this view
// keeps exactly the fields those cards used, so their behaviour does not change.
// Task 36: the view is stored in course-fit-cards.json (src/catalog/courseFitView.js makes it), so only
// these five cards are in the startup bundle and the full list loads with the Courses view.
export const opportunities = courseFitCards.items
