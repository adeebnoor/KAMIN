# HR review response — 30 September 2026

## Implemented in this change

- Shorter initial landing with a three-step sample tour, student/advisor/university entry points, visible FAQ entry, and a collapsed advanced section containing the existing network, inference and knowledge tools.
- Primary sample CTA opens synthetic transcript review directly. It does not approve the transcript, grant consent or replace an existing record automatically. Existing workspace entry and profile flows remain available.
- Career catalog expanded from 5 to 9 job profiles; learning/practice pathways from 6 to 10. Four specialist capability concepts added without inventing any new course-to-skill evidence mappings.
- O*NET occupation-context sources and review date provided for QA, database administration, web development and systems analysis. Local skill gates are explicitly Kamin pilot judgments, not endorsed O*NET/Saudi requirements. Training projects are authored proposals, not bookable courses or credentials.
- Bilingual catalog generated from the same runtime target data, with sources also visible in matching explanations.
- University page specifies proposed buyer, license scope, separate services, willingness-to-pay validation, and evidence-issuer/expiry/revocation roadmap. No prices, signed partners or revenue are claimed.
- Proposed nine-month validation roadmap: approval-gated start; exploratory targets of 12 formative users, 60 participants across 3 colleges, 20 verification cases, and 5 buyer interviews. Explicit success definitions and failure handling. These are proposals, not results or approved commitments.

## Still requires real-world work

Institution-issued credentials and issuer integrations, independent skill assessments/project review, college participation and research approval, Saudi usability studies, willingness-to-pay interviews, national API agreements, and a separately powered Saudi psychometric validation study. A larger catalog and a clearer homepage do not demonstrate product-market fit, legal compliance or superiority over commercial competitors.

## Verification

Local unit suite: 105 passed. Production build: passed; 44 bilingual pages, generated routes and performance budgets passed. The owner explicitly authorized upload and publication. Pull request #32 runs the repository quality gate before merge.

The first hosted browser run executed all 180 scenarios: 170 passed and 10 failed. The failures came from older tests expecting the original hero wording or attempting to use the now-collapsed knowledge area before opening it. Updated those tests to follow the visible advanced-section control and assert the new fictional-sample label, retaining their original search, SPARQL, privacy and evidence assertions. The final hosted quality result is recorded in the pull-request checks; this document does not treat a build or test-discovery pass as a browser-test pass.

## ملخص المراجعة بالعربية

يشمل العمل تبسيط الصفحة الرئيسية وجولة من ثلاث خطوات، فتح المثال مباشرة للمراجعة دون موافقة تلقائية، ومسارات للطالب والمستشار والجامعة. أصبح الكتالوج 9 مسارات مهنية و10 مسارات تدريب وتطبيق، مع أربعة مراجع O*NET جديدة وحدود واضحة للربط التجريبي. تمت إضافة نموذج إيرادات مقترح وخارطة تحقق مؤسسي وخطة تقييم مقترحة لتسعة أشهر، مع الحفاظ على تسليم نسخة قابلة للاستخدام بنهاية الفصل.

نجح 105 اختبارات منطقية وبناء 44 صفحة عربية وإنجليزية. أذن صاحب المستودع بإكمال الرفع والنشر. نُفذت 180 حالة متصفح في التشغيل الأول: نجحت 170 حالة، واحتاجت 10 حالات إلى تحديث خطوات الدخول للأدوات المتقدمة أو النص المتوقع بعد تبسيط الصفحة. تحفظ فحوص طلب الدمج رقم 32 النتيجة النهائية، ولا يتم الدمج قبل نجاحها.

التحقق المؤسسي الفعلي، وتقييم المشروعات، والدراسة الميدانية السعودية، واتفاق الجامعات أمور لم تُنجز بهذا التعديل. كما لا يثبت التقرير تفوقًا مقاسًا على المنافسين أو امتثالًا قانونيًا معتمدًا.

## Authorization update — 30 September 2026

The repository owner has now authorized completing the upload and site publication and updating the student message. Browser checks are still required before merging. The validation roadmap retains the existing weeks 10–12 initial field-pilot target and weeks 13–14 semester release, followed by longer evaluation within the ten-month capstone.
