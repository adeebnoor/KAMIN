# Browser-model evaluation (capability suggestions)

This folder measures how well KAMIN suggests **capabilities** from a text. The texts are a student's project description, or a university course description, and the capabilities come from KAMIN's catalog of 11 (`src/data.js`). It compares three kinds of method:

- KAMIN's local matching engines alone: the baseline lexicon (`src/ai/projectSuggest.js`) and the improved engine (`src/ai/projectSuggestImproved.js`).
- The same engines combined with a local **embedding model** that runs in the browser ("hybrid"): the engine suggests first, then the model adds a capability when the best-matching sentence is above a threshold.
- An experimental engine **v2** that lives **only in `experimental/`**. **The app does not use v2.** Moving it into `src/` would be a separate task.

Everything runs on this computer. No text leaves it, and no external AI service is used. The only network use is `download-model.mjs`: a developer tool that downloads a public comparison model from huggingface.co once. It is never part of the app or the build.

## The rule

**Any suggested capability without verbatim supporting text in the description counts as an error.** Every suggestion must quote a sentence of the text, and the scorer checks that the quote really is in the text. Every table reports "unsupported claims"; so far it is 0 for every method.

## The sets

| File | What | Cases | Role |
|---|---|---|---|
| `dev-set.json` | project descriptions (Arabic + English) | 27 | **dev**: thresholds are tuned here |
| `testset.json` | project descriptions (Arabic + English) | 40 | test, frozen |
| `dialect-set.json` | project descriptions in Saudi dialect | 22 | test, frozen |
| `course-dev-set.json` | course descriptions | 21 | **dev** for course sets |
| `course-testset.json` | course descriptions | 25 | test, frozen (later "seen": see below) |
| `course-testset-v2.json` | course descriptions | 12 | test, frozen **before** v2 was designed (held-out) |

- **Course texts** are copied word for word from the official **FCIT Undergraduate Catalog 2024-2025** (King Abdulaziz University).
- **Labels:** the expected capabilities of the course sets were written by **Claude (AI)** on 2026-11-19, before any method was run. They **still need human review**, and each case says so in its `note`.
- **No personal data:** the project descriptions are made-up texts. No student names, numbers or transcripts appear in this folder.

## Freeze and tuning rules

- `node eval.mjs freeze <set>` writes `<set>.lock.json` with the file's SHA-256. Every `run` on a frozen set first checks that hash and refuses if the file changed. A changed set is a new version with a new date, never an edit.
- Thresholds are tuned **only** on a dev set (`tune` refuses a frozen file), and `run` refuses a config that was tuned on the set being measured.
- `course-testset.json` was used to look at v1's errors before v2 was built. Results of v2 on it are therefore labelled **"seen set, not proof"**. The clean v2 result is on `course-testset-v2.json`, which was frozen before any v2 design.
- Frozen hashes:

| Set | SHA-256 |
|---|---|
| testset.json | `f63fc3b1dc54c03479d92fa155ff95d08384229e61a5841c59e8d2947f99186e` |
| dialect-set.json | `c000972c48c704dfd94b878d887ea7c02276b2f9cae6ebbe9b1c1cfefdc01019` |
| course-testset.json | `99a6783cd3de745d1b591f34dc38f255423ad8fecd9249a4badf901227aeb2e3` |
| course-testset-v2.json | `631619a520ce8ab6397708a3759b42255ef0072779ea26b99cdb9d350ac81903` |

`.gitattributes` keeps these files byte for byte on every machine (`evaluation/*.json text eol=lf`).

## How to run

From the repository root:

```bash
npm run build
node evaluation/download-model.mjs Xenova/paraphrase-multilingual-mpnet-base-v2
node evaluation/run-courses.mjs
node evaluation/run-all.mjs
node evaluation/experimental/run-v2.mjs
node evaluation/experimental/models-l12-vs-mpnet.mjs
```

- `npm run build` puts KAMIN's own model (paraphrase-multilingual-MiniLM-L12-v2) into `.model-cache/`.
- `download-model.mjs` saves comparison models into `evaluation/models/`, which git ignores. `run-all.mjs` also downloads e5-small and e5-base itself.
- `run-courses.mjs` runs the course sets in 4 variants: lexicon or improved engine, whole sentences or phrases.
- `run-all.mjs` runs the project-description and dialect sets.
- `run-v2.mjs` compares v1 with v2.
- `models-l12-vs-mpnet.mjs` compares KAMIN's model with mpnet, both with v2.

Single steps, from inside `evaluation/`:

```bash
node eval.mjs check course-testset-v2.json
LEXICON=improved-v2 node eval.mjs tune course-dev-set.json hybrid
LEXICON=improved-v2 node eval.mjs run course-testset-v2.json hybrid
```

`LEXICON` is `lexicon` (default), `improved` or `improved-v2`. `EMBED_SPLIT=phrases` embeds phrases instead of whole sentences. `EMBED_MODEL_DIR` with `EMBED_PREFIX` selects another model. In PowerShell, set them first: `$env:LEXICON="improved-v2"`. Results go to `results/` (JSON, per-case CSV, Markdown summaries).

## Headline result (2026-11-19, measured on Windows, CPU)

Hybrid with engine v2, sentences split. Thresholds were tuned on `course-dev-set.json` for the course sets and on `dev-set.json` for the others.

| Set | Model + engine v2 | Precision | Recall | F1 | Median ms/text |
|---|---|---|---|---|---|
| course-testset-v2 (held-out, 12) | MiniLM-L12 (KAMIN) | 80.0% | 100% | **88.9%** | 17.8 |
| | mpnet | 80.0% | 100% | **88.9%** | 33.0 |
| course-testset (seen, 25; not proof) | MiniLM-L12 | 80.0% | 93.3% | 86.2% | 17.9 |
| | mpnet | 77.8% | 93.3% | 84.8% | 36.9 |
| testset Arabic (20) | MiniLM-L12 | 94.7% | 78.3% | 85.7% | 5.1 |
| | mpnet | 90.9% | 87.0% | 88.9% | 10.8 |
| testset English (20) | MiniLM-L12 | 100% | 82.6% | 90.5% | 6.2 |
| | mpnet | 100% | 87.0% | 93.0% | 12.4 |
| dialect (22) | MiniLM-L12 | 77.8% | 31.8% | 45.2% | 6.5 |
| | mpnet | 56.3% | 40.9% | 47.4% | 12.0 |

- **Sizes:** MiniLM-L12 is 112.8 MB as q8 ONNX (384 dimensions, 12 layers). mpnet is 265.7 MB (768 dimensions, 12 layers).
- **v1 for comparison:** on course-testset-v2, v1 + MiniLM-L12 scored F1 50.0% (8 false positives); v2 has 1.
- **Caveat:** the held-out set is small and mostly negative (4 expected labels, 8 courses with no capability), so read 88.9% as a signal, not a precise number.
- **Unsupported claims:** 0 everywhere.
- **Full tables:**
  - `results/compare-v1-v2-2026-11-19.md`
  - `results/models-L12-vs-mpnet-v2-2026-11-19.md`
  - `results/summary-courses*-2026-11-19.md`
  - `results/قسم-التقرير-النماذج-والعوائق-2026-11-19.md` (report section, Arabic)
- **What v2 changes:** `experimental/CHANGES-v2.md`, with the dev cases behind each rule.

## Known limitation

On an IT student's transcript only part of the courses are recognised, because many department courses (e.g. Operating Systems, Human-Computer Interaction) are not in the course–capability matrix. The current catalog has no capability for their fields. The report section above lists the options.

## Notes on this copy

The folder was first built as a standalone copy outside the repository, then added here.

- The external-model mode of that copy was **removed**, because KAMIN uses no external AI service. Its old result files are not included.
- Method ids were renamed from an author-prefixed form to `eval-…`.
- `KAMIN_DIR` defaults to the repository root.

---

## بالعربي (مختصر)

**ما المجلد؟** يقيس هذا المجلد دقة كامن في اقتراح القدرات من نص (وصف مشروع أو وصف مقرر).

**ما الذي يقارنه؟** المحرك المحلي وحده، ثم المحرك مع نموذج تضمين يعمل في المتصفح. كل شيء يعمل محليًا، ولا تُستخدم أي خدمة ذكاء اصطناعي خارجية.

**القاعدة:** أي قدرة بلا نص داعم حرفي في الوصف تُحسب خطأ.

**مصدر النصوص:** نصوص المقررات منقولة حرفيًا من دليل FCIT الرسمي 2024-2025.

**الوسوم:** كتبها Claude (ذكاء اصطناعي) وتحتاج مراجعة بشرية.

**التجميد والضبط:** مجموعات الاختبار مجمّدة ببصمة SHA-256، والعتبة تُضبط على مجموعة التطوير فقط.

**المحرك v2:** تجريبي، وموجود في `experimental/` فقط. التطبيق ما زال يستخدم v1.

**أهم نتيجة:** على مجموعة المقررات المحجوزة حقق المحرك v2 مع نموذج كامن (MiniLM-L12) قيمة F1 = 88.9%، مقابل 50.0% للإصدار v1. حقق mpnet النتيجة نفسها، مع أن حجمه أكبر بنحو 2.3 مرة وهو أبطأ بنحو مرتين.
