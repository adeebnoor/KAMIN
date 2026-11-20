# Project-suggestion evaluation harness

Measures the "project description → capability suggestion" assistant with the same modules
and pinned model files the browser uses. Local only: no external APIs and no network calls.
The full method, metric definitions and rules are in [`docs/EVALUATION_PROTOCOL.md`](../../docs/EVALUATION_PROTOCOL.md).

| File | What it is |
|---|---|
| `eval.mjs` | `check`, `freeze`, `tune`, `run` (methods `lexicon`, `embedding`, `improved`, `all`), `compare`; Task 38 kit: `labels-sheet`, `coverage`, `import-v2`, `resolve-v2` |
| `lib.mjs` | scoring rules, set checks, agreement (Cohen's kappa), CSV/Markdown output |
| `methods.mjs` | `lexicon` = `src/ai/projectSuggest.js`; `embedding` = pinned local MiniLM vs. capability label + description (`nazeh-embed-sentence-v1`); `improved` = Task 08 |
| `skill-descriptions.json` | short AR/EN description per capability, used by the embedding method |
| `dev-set.json` | development set — the only set used for tuning |
| `testset.json` + `testset.lock.json` | v1 test set (40 cases), frozen |
| `testset-v2.json` | v2 test set — human-written, two reviewers; being collected |
| `ai-drafts/` | Task 38b: 40 Claude-drafted cases (`drafts.json`, text only, `writtenBy: "ai"`) with a sha256 commitment to Claude's **sealed** proposed labels and self-review (not in the tree; `unseal-proposed` restores them from git history only after both reviewers' confirmed sheets are imported), a label-free `self-review-summary.md`, the reviewers' guide `README.md`. Reviewed by two people into `testset-ai-v3.json`, a separate set; never part of `testset-v2.json` |
| `v2-kit/` | Task 38 kit for the v2 set: `GUIDE.md` (Arabic + English), `cases-template.csv`, `labels-template.csv`, `coverage-quota.csv`, `disagreements.md` (generated); `work/` (git-ignored) holds the sheets until import |
| `testset-ai-v2.json` + lock | interim AI-written set (Task 08), frozen before the improved method; preliminary only |
| `config.json` | embedding threshold and the set it was tuned on |
| `score-floors.json` | Task 40: the lowest scores `lexicon` and `improved` may reach on the frozen sets; checked by `tests/engineScores.test.js` in `npm test` |
| `results/` | `<date>-<set>-<method>.json/.csv/.md`; `2026-10-25-original/` = the first measurement (outside the repo), kept for comparison |

```bash
npm run eval:suggest                                   # lexicon on the frozen v1 set
npm run eval:compare                                   # comparison report on the frozen sets
node eval/project-suggest/eval.mjs run eval/project-suggest/testset.json --method all
node eval/project-suggest/eval.mjs check eval/project-suggest/testset-v2.json
node eval/project-suggest/eval.mjs tune eval/project-suggest/dev-set.json   # refused on a frozen set
node eval/project-suggest/eval.mjs freeze eval/project-suggest/testset-v2.json
```

The embedding method needs the pinned model in `.model-cache/` (filled once by `npm run build`
through `scripts/prepare-semantic.mjs`); the harness checks its sha256 before loading it.

## Score floors (Task 40)

`npm test` runs `lexicon` and `improved` on every set in `score-floors.json`, in memory (no file
written, no model). It fails if any precision, recall or F1 (Arabic, English or all) drops below
its floor, or if any suggestion is unsupported (`unsupported` must stay 0). The failure names the
set, method, language and metric. On a rise it passes and prints "update the floors".

- **Floors change only in a PR that names the reason.**
- **A lexicon change is tuned on `dev-set.json` only**, never on a frozen set.
- **Only approved frozen sets have floors:** `testset.json` (v1) and `testset-ai-v2.json` today;
  `testset-v2.json` once it is frozen. Never `testset-ai-v3.json` (Claude-drafted, reviewed by
  people) or a diagnostic set. The test refuses any other set and checks each set's sha256
  against its lock and against the value recorded with the floors.
- The floors are exact counts (`tp`, `fp`, `fn`) measured on 2026-11-17 on `main` at `71962cb`
  (the percentages beside them are the same values, rounded). They equal the committed 2026-11-10
  comparison (improved: v1 all 97.4 / 80.4 / 88.1, ai-v2 all 93.2 / 85.4 / 89.1).

## Writing `testset-v2.json` (people only)

People write and label it in spreadsheets; the kit turns the sheets into the JSON. Full steps for
writers and reviewers, in Arabic and English: [`v2-kit/GUIDE.md`](v2-kit/GUIDE.md).

```bash
node eval/project-suggest/eval.mjs coverage eval/project-suggest/v2-kit/work/cases.csv          # live coverage while writing
node eval/project-suggest/eval.mjs labels-sheet <cases.csv> <labels-A.csv>                     # a blank sheet per reviewer
node eval/project-suggest/eval.mjs import-v2 <cases.csv> <labels-A.csv> <labels-B.csv> --reviewer-a "<role>" --reviewer-b "<role>"
node eval/project-suggest/eval.mjs resolve-v2 <resolved.csv>                                    # agreed final labels + reasons
node eval/project-suggest/eval.mjs check eval/project-suggest/testset-v2.json --v2
```

`import-v2` refuses a reviewer sheet with a missing or extra case, an unknown capability column or a
value other than `1`/empty, and never writes a frozen set. It records both reviewers' labels,
Cohen's kappa and exact-case agreement, and lists every disagreement in `v2-kit/disagreements.md`.
`resolve-v2` sets the final labels (`labels.agreed` = `expected`) with the reason
(`labels.adjudication`); the per-reviewer labels and the agreement stay. The writers' `target`
column is for coverage planning only and is never imported.

Each case in the file:

```json
{
  "id": "ar-01",
  "lang": "ar",
  "category": "direct | synonym | tech-name | multi | should-abstain | dialect",
  "writtenBy": "human",
  "author": "initials or pseudonym of the writer",
  "writerRole": "student",
  "text": "the project description, written by a person",
  "labels": { "reviewerA": ["database"], "reviewerB": ["database"], "agreed": ["database"], "adjudication": "only when A and B differ" },
  "expected": ["database"]
}
```

`check --v2` requires: at least 20 Arabic and 20 English cases; at least 2 synonym and 2
should-abstain cases per language and 2 Arabic dialect cases; **every capability in at least 3 positive
cases** (cases whose final agreed labels include it, both languages together; Task 38, approved by the
supervisor); two different reviewers; `expected` equal to
`labels.agreed`; an adjudication note wherever A and B differ; each case in its own language; no text
copied from the development, v1 or ai-v2 set (compared after normalising punctuation, case and Arabic
spelling); and the agreement block (`observed`, `kappa`) matching the labels (`import-v2` writes it).
It also warns, without blocking, about texts close to those sets and capabilities missing in one
language. Capability ids: `testing db-operations web-development systems-analysis requirements
software database project statistics cyber ai-work`. With 3 positive cases per capability, per-capability
results are indicative only; the official claim is overall precision, recall and F1 per language.
