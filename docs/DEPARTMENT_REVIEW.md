# Department review of the FCIT course map · مراجعة القسم لخريطة مقررات كلية الحاسبات

For the KAU-FCIT IT department reviewer. One sheet, one sitting; no code to read.
لمراجِع قسم تقنية المعلومات في كلية الحاسبات. جدول واحد وجلسة واحدة، دون قراءة أي كود.

---

## English

**What you receive.** A file `fcit-map-review-<date>.csv` (opens in Excel). Each row is one FCIT course (FCIT Catalog 2024-25) and one **capability link** the project team proposes for it. A course with two links has two rows; a course the team links to nothing has one row with empty capability cells. Today there are 40 courses and 48 rows.

**What a capability link means.** "Passing CPIT-240 is a clue that the student met this learning outcome, which belongs to the capability *Databases*." It is a claim about what the course teaches, not about any student. Every learning outcome in the sheet was written by the project team from the course title and catalog description, because the catalog has none; all are *proposed* until you review them.

**A grade is a clue, not a guarantee.** The app shows this sentence to students, word for word:
> A course grade is a clue to an expected learning outcome, not a guarantee of mastery. The evidence level depends on the grade and the type of assessment.

So the app never says a student *masters* something, and shows no percentages. Your review decides which clues the app may use, and how strong they can be.

**Fill in the top of the sheet first:** `reviewer_name`, `reviewer_role` (for example "IT department reviewer") and `review_date` (YYYY-MM-DD). Your name stays on the project computer; only your **role** and the date are written into the project.

**Then one decision per row** (column `decision`):

| Decision | Use it when | What happens after your review |
|---|---|---|
| `approve` | The outcome text and the capability link are right. | The outcome becomes *approved*; the link can give a stronger clue. |
| `change` | The link is right but the outcome text needs correcting. Write the corrected text in `corrected_outcome_en` and/or `corrected_outcome_ar`. | Your text replaces the proposed one and is *approved*. |
| `reject` | This course does not teach this capability. Say why in `note`. | The link is removed: the course no longer creates this capability. |

For an unmapped row (no capability), `approve` means "right, this course should stay unlinked"; to propose a link, use `reject` and write the capability in `note`.

**Other columns (optional but valuable):**
- `assessment`: how the course is mainly assessed: `exam`, `project`, `lab`, `mixed` or `unknown`. It limits how strong the clue can be (a project or lab can support a stronger clue than an exam); `unknown` keeps the clue at the lowest level.
- `title_ar_official`: the official Arabic course title, **only** if the department has one. It is accepted only from a named reviewer.
- `note`: anything else.

**Saving.** In Excel choose *File → Save As → "CSV UTF-8 (Comma delimited)"*. Plain "CSV" loses the Arabic text, and the check will refuse the file. Do not rename or delete columns or rows.

**Sources you may use:** only the official FCIT Catalog 2024-25 (its page is in `catalog_page`) and the department's own knowledge of the course. **No websites,** no other universities' pages, no AI tools.

**Nothing changes when you fill the sheet.** The project team runs `npm run review:check` on the returned file; it only reads it and lists missing or invalid answers, which are sent back to you. Loading the answers into the app is a separate step that needs the supervisor's approval.

---

## العربية

**ما الذي يصلك.** ملف `fcit-map-review-<date>.csv` (يُفتح في Excel). كل سطر فيه مقرر واحد من دليل كلية الحاسبات 2024-25 و**ربط قدرة** واحد يقترحه فريق المشروع لهذا المقرر. المقرر الذي له ربطان يظهر في سطرين، والمقرر الذي لا يرتبط بأي قدرة يظهر في سطر واحد بخانات قدرة فارغة. اليوم: 40 مقررًا و48 سطرًا.

**معنى ربط القدرة.** «اجتياز CPIT-240 قرينة على أن الطالب حقق مخرج التعلم هذا، وهو جزء من قدرة *قواعد البيانات*». إنه وصف لما يدرّسه المقرر، لا حكم على طالب بعينه. كل مخرجات التعلم في الجدول كتبها فريق المشروع من عنوان المقرر ووصفه في الدليل لأن الدليل لا يتضمنها، وكلها *مقترحة* حتى تراجعها.

**الدرجة قرينة لا ضمان.** يعرض التطبيق هذه الجملة للطلاب حرفيًا:
> درجة المقرر قرينة على مخرج تعلم متوقع، وليست ضمانًا لإتقانه. يختلف مستوى الدليل حسب الدرجة ونوع التقييم.

فالتطبيق لا يقول أبدًا إن الطالب *يتقن* شيئًا، ولا يعرض نسبًا مئوية. مراجعتك تحدد أي القرائن يجوز للتطبيق استخدامها، وإلى أي حد تكون قوية.

**املأ أعلى الجدول أولًا:** `reviewer_name` (الاسم)، و`reviewer_role` (الصفة، مثل «مراجع قسم تقنية المعلومات»)، و`review_date` (التاريخ بصيغة YYYY-MM-DD). يبقى اسمك على جهاز المشروع، ولا يُكتب في المشروع إلا **صفتك** والتاريخ.

**ثم قرار واحد لكل سطر** (العمود `decision`):

| القرار | متى تستخدمه | ما يحدث بعد مراجعتك |
|---|---|---|
| `approve` (اعتماد) | نص المخرج وربط القدرة صحيحان. | يصبح المخرج *معتمدًا*، ويمكن أن يعطي الربط قرينة أقوى. |
| `change` (تعديل) | الربط صحيح لكن نص المخرج يحتاج تصحيحًا. اكتب النص المصحح في `corrected_outcome_ar` و/أو `corrected_outcome_en`. | يحل نصك محل النص المقترح ويصبح *معتمدًا*. |
| `reject` (رفض) | المقرر لا يدرّس هذه القدرة. اذكر السبب في `note`. | يُحذف الربط، فلا يُنشئ المقرر هذه القدرة بعد ذلك. |

في سطر المقرر غير المرتبط (بلا قدرة): `approve` تعني «صحيح، يبقى المقرر بلا ربط»؛ ولاقتراح ربط استخدم `reject` واكتب القدرة في `note`.

**أعمدة أخرى (اختيارية لكنها مفيدة):**
- `assessment`: طريقة التقييم الغالبة في المقرر: `exam` (اختبار)، `project` (مشروع)، `lab` (معمل)، `mixed` (مختلط)، `unknown` (غير معروف). تحدد أقصى قوة للقرينة (المشروع أو المعمل يدعم قرينة أقوى من الاختبار)، و`unknown` تُبقي القرينة في أدنى مستوى.
- `title_ar_official`: الاسم العربي الرسمي للمقرر، **فقط** إن كان لدى القسم اسم رسمي. لا يُقبل إلا من مراجِع مذكور الاسم.
- `note`: أي ملاحظة أخرى.

**الحفظ.** في Excel اختر *ملف ← حفظ باسم ← "CSV UTF-8 (Comma delimited)"*. صيغة "CSV" العادية تُضيّع النص العربي وسيرفض الفحص الملف. لا تُعِد تسمية الأعمدة ولا تحذف أعمدة أو أسطرًا.

**المصادر المسموح بها:** دليل كلية الحاسبات الرسمي 2024-25 فقط (رقم صفحته في `catalog_page`) ومعرفة القسم بالمقرر. **لا مواقع إنترنت**، ولا صفحات جامعات أخرى، ولا أدوات ذكاء اصطناعي.

**لا يتغير شيء عند تعبئة الجدول.** يشغّل فريق المشروع `npm run review:check` على الملف المُعاد؛ وهو يقرؤه فقط ويسرد الإجابات الناقصة أو غير الصالحة لتُعاد إليك. إدخال الإجابات في التطبيق خطوة منفصلة تحتاج موافقة المشرف.

---

### For the project team · لفريق المشروع
```bash
npm run review:export                         # writes review/fcit-map-review-<today>.csv
npm run review:check -- review/<returned>.csv # lists problems; exit 0 only when complete
```
`review/` is git-ignored. Never commit a filled sheet: it holds the reviewer's name. Loading the answers is Task 32.
