# Evaluation — improved on testset-v2.json

- Harness: `kamin-eval-project-suggest-v1` · method version: `kamin-project-suggest-improved-v3`
- Commit: `14ceaaf-dirty`
- Set: `testset-v2.json` · sha256 `b6ea4839aeeb9f4080aa3c8b46ce108e1de56382fa4b69a0158408c74308d189` · frozen 2026-11-24
- Threshold: n/a (rule-based)
- Date: 2026-11-24

| Language | Cases | Precision | Recall | F1 | TP | FP | FN | Unsupported | Correct abstentions | Wrong abstentions | False-alarm cases |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Arabic | 44 | 73.1% | 52.8% | 61.3% | 19 | 7 | 17 | 0 | 8/11 | 14 | 3 |
| English | 27 | 89.5% | 70.8% | 79.1% | 17 | 2 | 7 | 0 | 6/6 | 6 | 0 |
| All | 71 | 80.0% | 60.0% | 68.6% | 36 | 9 | 24 | 0 | 14/17 | 20 | 3 |

An unsupported suggestion (supporting text not verbatim in the description) is counted as a false positive.
Correct abstentions are reported separately and never add to precision or recall.
