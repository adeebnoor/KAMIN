# Writing and labelling the human test set (v2) · دليل كتابة مجموعة الاختبار البشرية وتصنيفها

This guide is for the people who write and label `testset-v2.json`, the set that gives KAMIN's suggestion engine its **official** result. You need a spreadsheet program, not code. One team member runs the commands at the end.

هذا الدليل لمن يكتب ويصنّف حالات `testset-v2.json`، وهي المجموعة التي تعطي محرك الاقتراحات في كامن نتيجته **الرسمية**. تحتاج برنامج جداول فقط، لا برمجة. يشغّل أحد أعضاء الفريق الأوامر في النهاية.

---

## 1. What a case is · ما الحالة

A case is a short description of project work, written the way a student would describe it in KAMIN's "Add project evidence" form (one to four sentences). KAMIN reads it and suggests capabilities, quoting the student's own sentence. Each case is labelled with the capabilities the text really shows.

الحالة وصف قصير لعمل في مشروع، مكتوب كما يكتبه طالب في نموذج «أضف دليل مشروع» في كامن (من جملة إلى أربع جمل). يقرؤه كامن ويقترح قدرات مع اقتباس جملة الطالب نفسها. وتُصنَّف كل حالة بالقدرات التي يُظهرها النص فعلًا.

## 2. Rules for this set · قواعد هذه المجموعة

1. **People write every text.** Do not use ChatGPT, Claude, Gemini, a translator that rewrites, or any other AI tool to write, rephrase, translate or label a case. (Cases drafted by Claude are a separate set, approved by the supervisor and kept in a different file. They never go into `testset-v2.json`, and you do not copy from them.)
2. **Write from real student work**: things you or classmates actually did in courses, projects or training at FCIT. Change details so no one can be identified.
3. **No personal data**: no names, student numbers, phone numbers, emails, health or money details.
4. **Do not copy or rephrase** cases from `dev-set.json`, `testset.json` (v1) or `testset-ai-v2.json`. Do not open those files while writing. The check reports copies and close texts.
5. **FCIT computing work only** for cases that should get a capability. Non-computing activities belong only in should-abstain cases.
6. **Nobody runs any method on the set before it is frozen.** Do not type the cases into KAMIN to "see what it says", before or during writing and labelling.
7. **Each reviewer labels alone.** Do not look at the other reviewer's sheet, do not discuss labels until both sheets are handed in, and do not look at the writer's target column (it is removed before labelling).

1. **يكتب الناس كل النصوص.** لا تستخدم ChatGPT أو Claude أو Gemini أو مترجمًا يعيد الصياغة أو أي أداة ذكاء اصطناعي لكتابة حالة أو إعادة صياغتها أو ترجمتها أو تصنيفها. (الحالات التي يكتبها Claude مجموعة منفصلة معتمدة في ملف آخر، لا تدخل `testset-v2.json` ولا تنسخ منها.)
2. **اكتب من عمل طلابي حقيقي**: ما قمت به أنت أو زملاؤك فعلًا في المقررات أو المشاريع أو التدريب في كلية الحاسبات. غيّر التفاصيل حتى لا يُعرف أحد.
3. **لا بيانات شخصية**: لا أسماء ولا أرقام جامعية ولا هواتف ولا بريد ولا معلومات صحية أو مالية.
4. **لا تنسخ ولا تُعِد صياغة** حالات من `dev-set.json` أو `testset.json` أو `testset-ai-v2.json`، ولا تفتح هذه الملفات أثناء الكتابة. الفحص يكشف النسخ والنصوص القريبة.
5. **عمل حاسبات في كلية الحاسبات فقط** في الحالات التي يُتوقع لها قدرة. الأنشطة غير الحاسوبية مكانها حالات «لا يُقترح شيء» فقط.
6. **لا يشغّل أحد أي طريقة على المجموعة قبل تجميدها.** لا تكتب الحالات في كامن «لترى ماذا يقترح»، لا قبل الكتابة ولا أثناءها ولا أثناء التصنيف.
7. **كل مراجع يصنّف وحده.** لا تنظر إلى ورقة المراجع الآخر، ولا تناقش التصنيف حتى تُسلَّم الورقتان، ولا تنظر إلى عمود هدف الكاتب (يُحذف قبل التصنيف).

## 3. The 11 capabilities · القدرات الإحدى عشرة

Label a capability only when the text shows the student **did** that kind of work. Mentioning a word, a tool or a course is not enough.

صنّف قدرة فقط إذا أظهر النص أن الطالب **قام** بهذا النوع من العمل. ذكر كلمة أو أداة أو اسم مقرر لا يكفي.

| id | Capability · القدرة | What it means (English) | المعنى |
|---|---|---|---|
| `testing` | Software test design and execution · تصميم وتنفيذ اختبارات البرمجيات | Writing and running software test cases and finding defects | كتابة وتنفيذ حالات اختبار للبرمجيات واكتشاف الأخطاء |
| `db-operations` | Database operations and recovery · تشغيل قواعد البيانات واستعادتها | Database backup, restore and access permissions | النسخ الاحتياطي واستعادة قواعد البيانات وإدارة الصلاحيات |
| `web-development` | Web interface development · تطوير واجهات الويب | Building web pages and front-end user interfaces | بناء واجهات ومواقع ويب للمستخدم |
| `systems-analysis` | Systems and workflow analysis · تحليل النظم وسير العمل | Analysing workflows and business processes with stakeholders | تحليل سير العمل والعمليات مع أصحاب المصلحة |
| `requirements` | Requirements analysis · تحليل المتطلبات | Gathering requirements, user stories and acceptance criteria | جمع المتطلبات وكتابة قصص المستخدم ومعايير القبول |
| `software` | Software engineering · هندسة البرمجيات | Designing and programming software systems and services | تصميم وبرمجة أنظمة وخدمات برمجية |
| `database` | Databases · قواعد البيانات | Designing databases and writing queries | تصميم قواعد البيانات وكتابة الاستعلامات |
| `project` | Project management · إدارة المشاريع | Planning, scheduling and tracking a project's milestones and scope | تخطيط المشروع وجدولته ومتابعة المعالم والنطاق |
| `statistics` | Quantitative analysis · التحليل الكمي | Statistical and quantitative data analysis | تحليل البيانات إحصائيًا وحساب المؤشرات الكمية |
| `cyber` | Cybersecurity fundamentals · أساسيات الأمن السيبراني | Protecting systems and networks from vulnerabilities and threats | حماية الأنظمة والشبكات من الثغرات والتهديدات |
| `ai-work` | AI use at work · توظيف الذكاء الاصطناعي في العمل | Using AI models and machine learning at work | استخدام نماذج الذكاء الاصطناعي والتعلم الآلي في العمل |

A case may have several capabilities, or none.

قد تكون للحالة عدة قدرات، أو لا شيء.

## 4. Categories · الفئات

| category | Write a case where … | اكتب حالة … |
|---|---|---|
| `direct` | the work is described with the usual words for the capability | تصف العمل بالكلمات المعتادة للقدرة |
| `synonym` | the work is clearly one capability but described **without** its usual keyword (say what was done, not its name) | العمل فيها قدرة واضحة لكنه موصوف **دون** كلمتها المعتادة (صف ما حدث لا اسمه) |
| `tech-name` | the work is described mainly through tools, languages or products | يوصف فيها العمل أساسًا بالأدوات أو اللغات أو المنتجات |
| `multi` | two or more capabilities are shown in the same text | تظهر فيها قدرتان أو أكثر في النص نفسه |
| `should-abstain` | **nothing** should be suggested: non-computing work, only meetings or attendance, only an intention, or only a tool or course name with no work | **لا** يُقترح فيها شيء: عمل غير حاسوبي، أو اجتماعات وحضور فقط، أو نية فقط، أو اسم أداة أو مقرر دون عمل |
| `dialect` | (Arabic only) written in a spoken dialect, as a student would type it | (عربي فقط) مكتوبة بلهجة محكية كما يكتبها الطالب |

`mixed` is accepted only for files written before this kit.

## 5. How many · كم حالة

The check refuses to freeze the set until **all** of these hold (`coverage-quota.csv` lists them):

لا يقبل الفحص تجميد المجموعة حتى تتحقق **كل** هذه الشروط (مذكورة في `coverage-quota.csv`):

- at least **20 Arabic and 20 English** cases; **30 + 30 is better** (fewer cases give very wide error bars) · ‏٢٠ حالة عربية و٢٠ إنجليزية على الأقل، و٣٠ + ٣٠ أفضل
- per language: at least **2 synonym** and **2 should-abstain** cases · ‏في كل لغة: حالتا مرادفات وحالتا «لا يُقترح شيء» على الأقل
- at least **2 Arabic dialect** cases · ‏حالتان باللهجة على الأقل
- **every capability in at least 3 positive cases**: cases whose **final agreed labels** include it, both languages together. A case that only mentions a word, a label from one reviewer, an unresolved disagreement or a writer's target does not count. *This rule is approved by the supervisor.* · ‏**كل قدرة في ٣ حالات إيجابية على الأقل**: حالات يتضمن **تصنيفها النهائي المتفق عليه** هذه القدرة، اللغتان معًا. لا تُحسب حالة تذكر الكلمة فقط، ولا تصنيف مراجع واحد، ولا خلاف لم يُحسم، ولا هدف الكاتب. *هذه القاعدة معتمدة من المشرف.*
- aim for **at least 1 Arabic and 1 English** case per capability (a warning, not a block) · ‏استهدف حالة عربية وحالة إنجليزية على الأقل لكل قدرة (تنبيه لا منع)

`db-operations`, `systems-analysis` and `software` were short in every earlier set: plan them first.

كانت `db-operations` و`systems-analysis` و`software` ناقصة في كل المجموعات السابقة: خطط لها أولًا.

**Limitation.** With 3 positive cases, a capability's own result can only be 0%, 33%, 67% or 100%, and "2 of 3" means anything from about 21% to 94%. Per-capability numbers are **indicative**. The official claim is the overall precision, recall and F1 per language.

**حدود.** مع ٣ حالات إيجابية لا تكون نتيجة القدرة إلا ٠٪ أو ٣٣٪ أو ٦٧٪ أو ١٠٠٪، و«٢ من ٣» تعني أي قيمة بين نحو ٢١٪ و٩٤٪. أرقام كل قدرة **استرشادية**؛ النتيجة الرسمية هي الدقة والاستدعاء وF1 الإجمالية لكل لغة.

## 6. Step by step · الخطوات

Keep the sheets in `eval/project-suggest/v2-kit/work/` (that folder is not committed; reviewers' sheets stay private until import).

احفظ الأوراق في `eval/project-suggest/v2-kit/work/` (هذا المجلد لا يُرفع إلى المستودع).

1. **Choose two reviewers** (a role or pseudonym is enough; they are recorded as `reviewers.A` / `reviewers.B`). · **اختاروا مراجعَين** (يكفي الدور أو اسم مستعار).
2. **Writers** copy `cases-template.csv` to `work/cases.csv` and fill one row per case: · **الكتّاب** ينسخون `cases-template.csv` إلى `work/cases.csv` ويملؤون صفًا لكل حالة:
   - `id`: `ar-01`, `ar-02` … / `en-01` …, never reused · لا يُكرر
   - `lang`: `ar` or `en`
   - `category`: one of section 4 · من القسم ٤
   - `text`: the description · الوصف
   - `writer_role`: e.g. student, TA · مثل طالب، معيد
   - `author`: your initials or a pseudonym · الأحرف الأولى أو اسم مستعار
   - `target`: the capability ids you **meant** to show, separated by spaces. **For planning only**: it shows coverage while you write, and it is never imported or shown to reviewers. · معرفات القدرات التي **قصدتها** مفصولة بمسافات، **للتخطيط فقط**، لا تُستورد ولا يراها المراجعون.
3. **Check coverage while writing** · **راقب التغطية أثناء الكتابة**:
   `node eval/project-suggest/eval.mjs coverage eval/project-suggest/v2-kit/work/cases.csv`
4. **Make one labels sheet per reviewer** (ids and texts only; no target) · **أنشئ ورقة تصنيف لكل مراجع** (المعرف والنص فقط):
   `node eval/project-suggest/eval.mjs labels-sheet eval/project-suggest/v2-kit/work/cases.csv eval/project-suggest/v2-kit/work/labels-A.csv` and again with `eval/project-suggest/v2-kit/work/labels-B.csv`.
5. **Each reviewer labels alone**: put `1` under each capability the text shows; leave the rest empty; use `note` for doubts. Do not edit `id` or `text`. · **كل مراجع يصنّف وحده**: ضع `1` تحت كل قدرة يظهرها النص واترك الباقي فارغًا، واكتب شكوكك في `note`، ولا تعدّل `id` ولا `text`.
6. **Import** · **الاستيراد**:
   `node eval/project-suggest/eval.mjs import-v2 eval/project-suggest/v2-kit/work/cases.csv eval/project-suggest/v2-kit/work/labels-A.csv eval/project-suggest/v2-kit/work/labels-B.csv --reviewer-a "<role A>" --reviewer-b "<role B>"`
   This writes `testset-v2.json`, computes the agreement (Cohen's kappa) and lists the disagreements in `v2-kit/disagreements.md`. · يكتب الملف ويحسب الاتفاق ويسرد الخلافات.
7. **Resolve** · **حسم الخلافات**: the two reviewers read `disagreements.md` together and agree on final labels. Copy `labels-template.csv` to `work/resolved.csv`, add one row per disagreement with the final labels, and write **why** in `note`. Then: · يقرأ المراجعان الخلافات معًا ويتفقان، ثم يكتبان صفًا لكل خلاف مع السبب في `note`، ثم:
   `node eval/project-suggest/eval.mjs resolve-v2 eval/project-suggest/v2-kit/work/resolved.csv`
   The per-reviewer labels and the agreement stay in the file. · يبقى تصنيف كل مراجع والاتفاق في الملف.
8. **Check, then commit the set, then freeze it in a separate commit** · **افحص، ثم ارفع المجموعة، ثم جمّدها في التزام منفصل**:
   `node eval/project-suggest/eval.mjs check eval/project-suggest/testset-v2.json --v2`
   `node eval/project-suggest/eval.mjs freeze eval/project-suggest/testset-v2.json`
   After freezing, nobody changes a case, and nobody looks at per-case errors to change a method.

## 7. What the check reports · ماذا يفحص

**Blocks freezing** · **يمنع التجميد**: missing or extra ids in a reviewer sheet; an unknown capability column; a value other than `1` or empty; an unknown category; a case in the wrong language (an Arabic case whose letters are mostly Latin, or an English case with Arabic text); a text copied from the development, v1 or ai-v2 set (after ignoring punctuation, case and Arabic spelling variants); a should-abstain case with agreed labels; an unresolved disagreement; fewer cases than section 5 requires (including fewer than 3 positive cases for a capability).

**Warns only** · **تنبيه فقط**: a text close to one in those sets (check that it was not copied); a capability with no case in one language; a should-abstain case that a reviewer labelled before resolution; a labelled category with empty agreed labels.

Tool names in Latin letters inside an Arabic case are fine. · أسماء الأدوات بالحروف اللاتينية داخل حالة عربية مقبولة.
