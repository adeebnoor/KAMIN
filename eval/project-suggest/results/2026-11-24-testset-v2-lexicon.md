# Evaluation — lexicon on testset-v2.json

- Harness: `kamin-eval-project-suggest-v1` · method version: `kamin-project-suggest-lexicon-v1`
- Commit: `14ceaaf-dirty`
- Set: `testset-v2.json` · sha256 `b6ea4839aeeb9f4080aa3c8b46ce108e1de56382fa4b69a0158408c74308d189` · frozen 2026-11-24
- Threshold: n/a (rule-based)
- Date: 2026-11-24

| Language | Cases | Precision | Recall | F1 | TP | FP | FN | Unsupported | Correct abstentions | Wrong abstentions | False-alarm cases |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Arabic | 44 | 71.4% | 41.7% | 52.6% | 15 | 6 | 21 | 0 | 8/11 | 19 | 3 |
| English | 27 | 78.9% | 62.5% | 69.8% | 15 | 4 | 9 | 0 | 6/6 | 8 | 0 |
| All | 71 | 75.0% | 50.0% | 60.0% | 30 | 10 | 30 | 0 | 14/17 | 27 | 3 |

An unsupported suggestion (supporting text not verbatim in the description) is counted as a false positive.
Correct abstentions are reported separately and never add to precision or recall.
