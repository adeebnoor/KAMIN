# Claude-drafted cases: how to review them · مسودات Claude: طريقة مراجعتها

`drafts.json` holds 40 test cases (20 Arabic, 20 English) **written by Claude** (`claude-opus-5-5`, 2026-11-17), with the supervisor's approval. They are **not** part of the human test set `testset-v2.json` and never will be. Two human reviewers decide what happens to each draft and label it; the result is a separate set, `testset-ai-v3.json`, always reported separately from the human-only result and marked with its origin.

يحتوي `drafts.json` على ٤٠ حالة اختبار (٢٠ عربية و٢٠ إنجليزية) **كتبها Claude** بموافقة المشرف. **ليست** جزءًا من مجموعة الاختبار البشرية `testset-v2.json` ولن تكون. يقرر مراجعان بشريان مصير كل مسودة ويصنّفانها، وتكون النتيجة مجموعة منفصلة `testset-ai-v3.json` تُعرض نتيجتها دائمًا منفصلة عن نتيجة المجموعة البشرية ومعها مصدرها.

## Claude's labels are sealed · تصنيف Claude مختوم

Claude's proposed labels and its full self-review are **not in this folder**. `drafts.json` records a sha256 commitment to each (`sealed`) and the commit that holds them. They are restored with `eval.mjs unseal-proposed`, which refuses until **both** reviewers' confirmed sheets are imported, and which checks the sha256. `self-review-summary.md` is safe to read: it names no capability.

**Limitation, stated plainly:** sealing keeps the labels out of a fresh checkout and out of your review sheet, but it **cannot erase them from git history** (they were committed before sealing) and it cannot technically stop anyone from looking them up there. Blindness is **not guaranteed** by the code; it rests on each reviewer's own confirmation, which is recorded in the dataset.

تصنيف Claude المقترح ومراجعته الكاملة **ليسا في هذا المجلد**؛ يسجل `drafts.json` بصمة sha256 لكل منهما، ولا يُستعادان إلا بعد استيراد ورقتي المراجعَين المؤكَّدتين. **حدود:** الختم لا يمحوهما من سجل git ولا يمنع تقنيًا الاطلاع عليهما هناك؛ عدم الاطلاع يعتمد على تأكيد كل مراجع، ويُسجَّل هذا التأكيد.

## Rules · القواعد

1. **Do not look up Claude's labels or full self-review** (in git history or anywhere else) until your own sheet is handed in. The first row of your sheet (`CONFIRM`) asks you to confirm this: write `confirmed` under `decision` and, if you like, your role or pseudonym under `note`. A sheet without it is refused. · **لا تطّلع على تصنيف Claude** قبل تسليم ورقتك؛ أكّد ذلك في الصف الأول (`CONFIRM`) بكتابة `confirmed` تحت `decision`.
2. **Label alone.** Do not look at the other reviewer's sheet or discuss until both sheets are handed in. · **صنّف وحدك**، ولا تناقش قبل تسليم الورقتين.
3. **Write the human set first.** If you also write cases for `testset-v2.json`, hand those in **before** reading these drafts. Never copy or rephrase a draft into the human set (the kit refuses it). · **اكتب حالات المجموعة البشرية أولًا**، ولا تنقل مسودة إليها.
4. Nobody runs any method on the drafts before the reviewed set is frozen. · لا يشغّل أحد أي طريقة على المسودات قبل التجميد.
5. The capabilities and what they mean are in [`../v2-kit/GUIDE.md`](../v2-kit/GUIDE.md), section 3. Label a capability only when the text shows the work was done. · معاني القدرات في الدليل، القسم ٣.

## Your decision for each draft · قرارك لكل مسودة

| decision | when | متى |
|---|---|---|
| `keep` | it reads like real FCIT student work and is clear | يشبه عمل طالب حقيقي في كلية الحاسبات وواضح |
| `edit` | the idea is good but a word or sentence is unnatural, unclear, or gives the answer away (e.g. a "synonym" case that still uses the usual keyword); write the whole corrected text in `edited_text` | الفكرة جيدة لكن فيها كلمة أو جملة غير طبيعية أو غامضة أو تكشف الإجابة؛ اكتب النص المصحح كاملًا في `edited_text` |
| `reject` | unrealistic, ambiguous beyond repair, not FCIT work where it should be, or a near copy of another case; leave its capability columns empty and say why in `note` | غير واقعي أو غامض لا يصلح، أو قريب جدًا من حالة أخرى؛ اترك القدرات فارغة واكتب السبب |

For `keep` and `edit`, put `1` under each capability the (edited) text shows; leave the rest empty. A draft may have none.

## Steps · الخطوات

Keep sheets in `eval/project-suggest/ai-drafts/work/` (git-ignored).

1. Each reviewer gets a blank sheet (the confirmation row, then **id and text only**: no category, no proposed labels):
   `node eval/project-suggest/eval.mjs ai-review-sheet eval/project-suggest/ai-drafts/work/review-A.csv` (and `review-B.csv`)
2. Fill the confirmation row, then `decision`, `edited_text` (only for `edit`), the capability columns and `note` for every draft.
3. Import both sheets (refused if either sheet is unconfirmed or incomplete):
   `node eval/project-suggest/eval.mjs import-ai-review eval/project-suggest/ai-drafts/work/review-A.csv eval/project-suggest/ai-drafts/work/review-B.csv --reviewer-a "<role A>" --reviewer-b "<role B>"`
   This writes `testset-ai-v3.json` with both confirmations, each reviewer's decisions and labels, Cohen's kappa on the drafts neither rejected, and `ai-drafts/disagreements.md`.
4. Now unseal Claude's labels (they are needed to resolve and are checked against the commitment):
   `node eval/project-suggest/eval.mjs unseal-proposed`
   They land in `ai-drafts/sealed/` (git-ignored). A full clone is needed (`git fetch --unshallow` in a shallow one).
5. Resolve together every draft that was edited, rejected or labelled differently: one row per such draft in `work/resolved.csv` (same columns, no confirmation row) with the **final** decision, final text (for `edit`), final labels and the reason in `note`; then
   `node eval/project-suggest/eval.mjs resolve-ai-review eval/project-suggest/ai-drafts/work/resolved.csv`
   Resolution refuses if Claude's labels are missing or do not match the sealed sha256. Rejected drafts move to `rejected` with their reviews, labels and reason (never evaluated). Claude's original labels are stored on every draft, kept and rejected (`claudeProposed`), the counts of kept, edited and rejected drafts are recorded, and Claude's labels are compared with your final labels (`claudeVsHuman`).
6. `node eval/project-suggest/eval.mjs check eval/project-suggest/testset-ai-v3.json`, commit, then `freeze` in a separate commit. Check and freeze recompute every rule from the stored reviews (settled drafts, kappa, counts, the Claude comparison), require every draft exactly once, and verify the drafts' sha256.

## Files · الملفات

| File | What it is |
|---|---|
| `drafts.json` | the 40 drafts: id, language, category, text, `writtenBy: "ai"`, model; generation method, approval and the `sealed` commitment |
| `self-review-summary.md` | Claude's self-review without any capability or label (safe to read before reviewing) |
| `disagreements.md` | written by `import-ai-review` / `resolve-ai-review` |
| `sealed/` | Claude's proposed labels and full self-review, restored by `unseal-proposed` after import (git-ignored) |
| `work/` | your sheets (git-ignored) |

`node eval/project-suggest/eval.mjs check-drafts` re-runs the mechanical checks on the drafts (and on Claude's labels once unsealed).
