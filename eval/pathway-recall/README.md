# Pathway search evaluation (Task 42)

Measures the app's "search pathways by meaning" feature: `src/components/SemanticRecall.jsx` sends the
student's text to `src/semantic/recall.worker.js`, which embeds it with the pinned MiniLM model and
ranks the 19 pathways of `src/matching/targets.js` with `rankSemanticCandidates` (keep score ≥ 0.25 and
within 0.12 of the best, top 3). Measurement only: nothing in the app imports this folder, and the
app's values are reported, never changed here.

Written by Claude, approved by the team and the supervisor (stated by Amjd, 2026-11-18).

## Sets
| File | Use | Queries |
|---|---|---|
| `testset.json` | the measurement; **frozen** (`testset.lock.json`, sha256) before any method ran on it | 70: 35 Arabic (12 Saudi dialect), 35 English; 28 should find nothing |
| `dev-set.json` | tuning only | 40: 20 Arabic (5 Saudi dialect), 20 English; 14 should find nothing |

Each case: `id`, `lang` (`ar`/`en`), `query` (what is typed into the search, ≤ 300 characters as in the
app), `dialect` (Saudi dialect), `intent` (the writer's note; never read by a method), `expected`
(pathway ids, any one of which is a hit; `[]` = the right answer is "nothing found"). The labelling
rule is in each file (`labelRule`). The queries were written before any matching code, lexicon or
pathway text was opened, and labelled from the 19 pathway ids and names only.

A frozen set is never edited and never tuned on: a change is a new file with a new date.

## Commands
```bash
npm run build                                    # once: fills .model-cache/ with the pinned model (no student data)
node eval/pathway-recall/eval.mjs tune           # dev set only → config.json (minScore and window)
npm run eval:pathways                            # test set → results/<date>-testset.{json,md} and -cases.csv
npm run eval:pathways -- --date 2026-11-18       # fixed date: two runs give byte-identical files
```
Methods in the report: MiniLM with the app values; MiniLM with the dev-tuned values (reported only);
MiniLM top 3 with no cut-off; and a lexicon baseline (words of the pathway title and skill labels).
Metrics per language, Saudi dialect and all: hit@1, hit@3, mean reciprocal rank (over the list the
student sees), and the share of should-find-nothing queries that show nothing, each with a 95%
bootstrap interval (2,000 draws, fixed seed, cases resampled; the Task 39 rule).

No network: the model loads only from the local, sha256-checked `.model-cache/` folder;
`tests/networkGuard.test.js` scans this folder.
