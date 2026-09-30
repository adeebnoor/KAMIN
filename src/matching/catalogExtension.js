// Occupational context is sourced below; capability gates are Kamin pilot judgments,
// not O*NET requirements or a Saudi crosswalk. No course-to-skill mappings are added.
const definitions=[
 ['qa-tester','محلل اختبار البرمجيات','Software QA Analyst','15-1253.00','testing',['software','testing'],['product'],'اختبر سلوك تطبيق ووثّق حالات الاختبار والعيوب.','Test application behavior and document test cases and defects.'],
 ['database-administrator','مسؤول قواعد البيانات','Database Administrator','15-1242.00','db-operations',['database','db-operations'],['data'],'جرّب الاستعادة من نسخة احتياطية وافحص الصلاحيات في قاعدة تدريبية.','Exercise backup recovery and review access in a training database.'],
 ['web-developer','مطور ويب','Web Developer','15-1254.00','web-development',['software','web-development'],['product'],'ابنِ واجهة قابلة للاستخدام على الجوال واختبر وظائفها الأساسية.','Build a usable mobile interface and test its core functions.'],
 ['systems-analyst','محلل نظم حاسوبية','Computer Systems Analyst','15-1211.00','systems-analysis',['requirements','systems-analysis'],['product','management'],'وثّق سير عمل واحتياجات أصحاب المصلحة وقارن بديلين للحل.','Document a workflow and stakeholder needs, then compare two solution options.'],
]
export const catalogExtension=definitions.flatMap(([key,ar,en,onet,skill,requiredSkills,goals,outcomeAr,outcomeEn])=>[
 {id:`job-${key}`,type:'job',title:{ar,en},subtitle:{ar:'مسار مرجعي — يتطلب مراجعة محلية',en:'Reference pathway — local validation pending'},occupationCodes:{onet},goals,requiredSkills,
  outcome:{ar:outcomeAr,en:outcomeEn},source:{title:`O*NET · ${onet}`,url:`https://www.onetonline.org/link/summary/${onet}`,checked:'2026-09-30',scope:'occupation-context-only'},
  mappingStatus:'pilot-authoring-not-institution-verified'},
 {id:`training-${key}`,type:'training',title:{ar:`مشروع تطبيقي: ${ar}`,en:`Practice project: ${en}`},subtitle:{ar:'مقترح تعلم من كامن — لا شهادة أو تسجيل',en:'Kamin learning proposal — no credential or enrollment'},goals,requiredSkills:[],teachesSkills:[skill],outcome:{ar:outcomeAr,en:outcomeEn}},
])
