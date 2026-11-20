# Evaluation — lexicon on testset.json

- Harness: `kamin-eval-project-suggest-v1` · method version: `kamin-project-suggest-lexicon-v1`
- Commit: `7313e45`
- Set: `testset.json` · sha256 `f63fc3b1dc54c03479d92fa155ff95d08384229e61a5841c59e8d2947f99186e` · frozen 2026-10-25T18:05:04.280Z
- Threshold: n/a (rule-based)
- Date: 2026-11-10

| Language | Cases | Precision | Recall | F1 | TP | FP | FN | Unsupported | Correct abstentions | Wrong abstentions | False-alarm cases |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Arabic | 20 | 93.3% | 60.9% | 73.7% | 14 | 1 | 9 | 0 | 2/2 | 8 | 0 |
| English | 20 | 86.7% | 56.5% | 68.4% | 13 | 2 | 10 | 0 | 2/2 | 9 | 0 |
| All | 40 | 90.0% | 58.7% | 71.1% | 27 | 3 | 19 | 0 | 4/4 | 17 | 0 |

An unsupported suggestion (supporting text not verbatim in the description) is counted as a false positive.
Correct abstentions are reported separately and never add to precision or recall.
