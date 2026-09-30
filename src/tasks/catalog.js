// Task catalog: one executable task per capability gap, with a rubric and a review scope.
//
// Design proposal for the pilot: 3 pathways, 6 tasks. Every task uses synthetic training
// data only. Completing a task, evaluating its output and verifying an issuer are three
// different claims and stay separate in progress records (see progress.js).
export const TASK_CATALOG_VERSION = 'kamin-tasks-v1-20260930'
export const TASK_GOVERNANCE = {
  author: 'Kamin pilot team',
  reviewOwner: 'HR and domain experts (pending; not yet reviewed)',
  reviewedAt: null,
  validityScope: 'Pilot design proposal for computing and IT programmes; not an institutional standard.',
}
const t = (ar, en) => ({ ar, en })

export const taskCatalog = [
  {
    id: 'task-sql-analysis', pathwayIds: ['job-data-analyst'], skillIds: ['database'], hours: 6,
    title: t('تحليل مبيعات بـ SQL على بيانات تدريبية', 'SQL sales analysis on a training dataset'),
    why: t('يغطي فجوة «قواعد البيانات» بدليل استعلامات قابلة للمراجعة، لا بشهادة حضور.', 'Covers the “Databases” gap with reviewable queries instead of an attendance certificate.'),
    steps: [t('حمّل مجموعة بيانات مبيعات وهمية (جدولان على الأقل).', 'Load a synthetic sales dataset (at least two tables).'), t('اكتب خمسة استعلامات تجيب عن أسئلة عمل محددة، منها ربط جدولين وتجميع.', 'Write five queries answering specific business questions, including a join and an aggregation.'), t('وثّق كل استعلام: السؤال، الاستعلام، النتيجة، وما الذي تحققت منه.', 'Document each query: question, query, result, and what you checked.')],
    deliverables: [t('ملف الاستعلامات مع النتائج', 'Query file with results'), t('ملاحظة قصيرة عن قرارات الفهرسة أو الأداء', 'Short note on indexing or performance decisions')],
    syntheticData: t('استخدم بيانات وهمية فقط؛ لا قاعدة إنتاج ولا بيانات أشخاص.', 'Synthetic data only; no production database and no personal data.'),
    rubric: [{ id: 'correctness', criterion: t('الاستعلامات تُرجع النتائج الصحيحة للأسئلة المطروحة', 'Queries return the correct results for the stated questions') }, { id: 'join-aggregate', criterion: t('استخدام صحيح لربط الجداول والتجميع', 'Correct use of joins and aggregation') }, { id: 'documentation', criterion: t('كل استعلام موثّق بالسؤال والتحقق', 'Each query is documented with its question and check') }],
    reviewScope: t('مراجع بخبرة SQL يفحص صحة الاستعلامات والتوثيق فقط', 'A reviewer with SQL experience checks query correctness and documentation only'),
  },
  {
    id: 'task-stats-summary', pathwayIds: ['job-data-analyst'], skillIds: ['statistics'], hours: 5,
    title: t('ملخص إحصائي مع عدم اليقين لبيانات استبيان وهمية', 'Statistical summary with uncertainty on a synthetic survey'),
    why: t('يغطي فجوة «التحليل الكمي» بتحليل يمكن لمراجع إعادة إنتاجه.', 'Covers the “Quantitative analysis” gap with an analysis a reviewer can reproduce.'),
    steps: [t('استخدم استبيانًا وهميًا من 200 إجابة.', 'Use a synthetic survey of 200 responses.'), t('احسب مقاييس النزعة والتشتت وفاصل ثقة لمتوسط واحد.', 'Compute central tendency, spread and one confidence interval for a mean.'), t('اكتب فقرة تفسير تذكر حدود العينة.', 'Write an interpretation paragraph that states the sample’s limits.')],
    deliverables: [t('دفتر تحليل أو جدول قابل لإعادة التشغيل', 'A re-runnable notebook or spreadsheet'), t('فقرة التفسير', 'The interpretation paragraph')],
    syntheticData: t('بيانات وهمية مولّدة؛ لا استبيانات حقيقية.', 'Generated synthetic data; no real survey responses.'),
    rubric: [{ id: 'method', criterion: t('اختيار المقاييس مناسب لنوع البيانات', 'Measures fit the data type') }, { id: 'uncertainty', criterion: t('فاصل الثقة محسوب ومفسَّر بشكل صحيح', 'The confidence interval is computed and interpreted correctly') }, { id: 'limits', criterion: t('حدود العينة مذكورة صراحة', 'Sample limits are stated explicitly') }],
    reviewScope: t('مراجع بخبرة إحصائية يفحص الطريقة والتفسير', 'A reviewer with statistics experience checks method and interpretation'),
  },
  {
    id: 'task-module-tests', pathwayIds: ['job-software-engineer'], skillIds: ['software', 'testing'], hours: 8,
    title: t('وحدة برمجية صغيرة مع اختبارات آلية', 'A small module with automated tests'),
    why: t('يغطي فجوة «هندسة البرمجيات» بكود واختبارات يمكن تشغيلها.', 'Covers the “Software engineering” gap with code and tests that run.'),
    steps: [t('اختر وظيفة محدودة (مثل تحليل ملف إعدادات) واكتب لها واجهة واضحة.', 'Choose a bounded function (such as parsing a settings file) and define a clear interface.'), t('نفّذها مع ثمانية اختبارات على الأقل تشمل حالات الخطأ.', 'Implement it with at least eight tests including error cases.'), t('سجّل ما استخدمته من أدوات ذكاء اصطناعي وما راجعته بنفسك.', 'Record which AI tools you used and what you reviewed yourself.')],
    deliverables: [t('مستودع أو ملف مضغوط بالكود والاختبارات', 'A repository or archive with code and tests'), t('سجل تشغيل الاختبارات', 'A test-run log')],
    syntheticData: t('مثال تدريبي وهمي؛ لا تستخدم كودًا أو بيانات من جهة عملك.', 'Synthetic training example; do not use code or data from an employer.'),
    rubric: [{ id: 'behaviour', criterion: t('السلوك يطابق الواجهة المعلنة', 'Behaviour matches the declared interface') }, { id: 'tests', criterion: t('الاختبارات تغطي الحالات الطبيعية والخاطئة وتنجح', 'Tests cover normal and error cases and pass') }, { id: 'ownership', criterion: t('مساهمة الطالب وأدوات الذكاء الاصطناعي مذكورة بوضوح', 'The student’s contribution and AI tools are stated clearly') }],
    reviewScope: t('مراجع بخبرة برمجية يشغّل الاختبارات ويقرأ الكود', 'A reviewer with programming experience runs the tests and reads the code'),
  },
  {
    id: 'task-code-review-doc', pathwayIds: ['job-software-engineer'], skillIds: ['software'], hours: 3,
    title: t('مراجعة موثّقة لطلب دمج وهمي', 'A documented review of a synthetic pull request'),
    why: t('يظهر قدرة القراءة النقدية للكود، وهي جزء من هندسة البرمجيات لا تُقاس بالشهادات.', 'Shows critical code reading, a part of software engineering that certificates do not measure.'),
    steps: [t('خذ طلب دمج وهميًا مزودًا من المهمة (يحتوي ثلاثة عيوب مقصودة).', 'Take the synthetic pull request supplied with the task (it contains three planted defects).'), t('اكتب مراجعة تحدد العيوب وتقترح إصلاحًا لكل منها.', 'Write a review that identifies the defects and proposes a fix for each.'), t('رتّب الملاحظات حسب الخطورة.', 'Order the findings by severity.')],
    deliverables: [t('وثيقة المراجعة', 'The review document')],
    syntheticData: t('الكود المراجَع وهمي ومُعد للتدريب.', 'The reviewed code is synthetic and prepared for training.'),
    rubric: [{ id: 'found', criterion: t('العيوب المزروعة الثلاثة مكتشفة', 'The three planted defects are found') }, { id: 'fixes', criterion: t('كل عيب له إصلاح مقترح صحيح', 'Each defect has a correct proposed fix') }, { id: 'severity', criterion: t('الترتيب حسب الخطورة مبرَّر', 'Severity ordering is justified') }],
    reviewScope: t('مراجع يقارن النتائج بقائمة العيوب المزروعة', 'A reviewer compares findings with the planted-defect list'),
  },
  {
    id: 'task-backup-restore', pathwayIds: ['job-database-administrator'], skillIds: ['db-operations'], hours: 4,
    title: t('نسخ احتياطي واستعادة قاعدة تدريبية', 'Backup and restore of a training database'),
    why: t('يغطي فجوة «تشغيل قواعد البيانات واستعادتها» بأوامر وسجل نتائج يمكن فحصهما.', 'Covers the “Database operations and recovery” gap with commands and a result log a reviewer can inspect.'),
    steps: [t('أنشئ قاعدة تدريبية ببيانات وهمية.', 'Create a training database with synthetic data.'), t('نفّذ نسخًا احتياطيًا كاملًا، ثم أتلف جدولًا عمدًا، ثم استعد.', 'Take a full backup, deliberately damage one table, then restore.'), t('تحقق من سلامة البيانات بعد الاستعادة وسجّل الأوامر والنتائج.', 'Verify data integrity after the restore and log commands and results.')],
    deliverables: [t('أوامر التشغيل', 'The commands run'), t('سجل النتائج قبل وبعد', 'A before/after result log'), t('شرح قرارات الصلاحيات المستخدمة', 'An explanation of the permission decisions used')],
    syntheticData: t('بيانات تدريبية وهمية؛ لا تستخدم قاعدة إنتاج أو بيانات أشخاص.', 'Synthetic training data; do not use a production database or personal data.'),
    rubric: [{ id: 'restore', criterion: t('الاستعادة أعادت البيانات كاملة وتم التحقق منها', 'The restore returned the data completely and was verified') }, { id: 'log', criterion: t('السجل يسمح بإعادة تنفيذ الخطوات', 'The log allows the steps to be repeated') }, { id: 'permissions', criterion: t('قرارات الصلاحيات مشروحة ومبررة', 'Permission decisions are explained and justified') }],
    reviewScope: t('مراجع بخبرة إدارة قواعد بيانات يفحص السجل والقرارات', 'A reviewer with database administration experience checks the log and decisions'),
  },
  {
    id: 'task-access-review', pathwayIds: ['job-database-administrator'], skillIds: ['db-operations', 'database'], hours: 3,
    title: t('مراجعة صلاحيات الوصول لقاعدة تدريبية', 'Access-permission review of a training database'),
    why: t('يظهر فهم الحد الأدنى من الصلاحيات، وهو جزء من التشغيل الآمن.', 'Shows least-privilege understanding, part of safe operations.'),
    steps: [t('استعرض حسابات وأدوار القاعدة التدريبية المزودة (تحتوي أخطاء مقصودة).', 'Review the supplied training database accounts and roles (they contain planted mistakes).'), t('حدد الصلاحيات الزائدة واقترح التصحيح.', 'Identify excessive permissions and propose corrections.'), t('اكتب سجل قرارات مع سبب كل تغيير.', 'Write a decision log with the reason for each change.')],
    deliverables: [t('جدول الصلاحيات قبل وبعد', 'A before/after permissions table'), t('سجل القرارات', 'The decision log')],
    syntheticData: t('حسابات وأدوار وهمية.', 'Synthetic accounts and roles.'),
    rubric: [{ id: 'findings', criterion: t('الصلاحيات الزائدة المزروعة مكتشفة', 'Planted excessive permissions are found') }, { id: 'least-privilege', criterion: t('التصحيح يطبّق مبدأ الحد الأدنى من الصلاحيات', 'Corrections apply least privilege') }, { id: 'reasons', criterion: t('كل قرار له سبب مكتوب', 'Every decision has a written reason') }],
    reviewScope: t('مراجع يقارن بقائمة الأخطاء المزروعة ويقرأ الأسباب', 'A reviewer compares with the planted-mistake list and reads the reasons'),
  },
]

export const taskById = id => taskCatalog.find(task => task.id === id) || null
export const tasksForSkill = skillId => taskCatalog.filter(task => task.skillIds.includes(skillId))
export const tasksForPathway = pathwayId => taskCatalog.filter(task => task.pathwayIds.includes(pathwayId))
