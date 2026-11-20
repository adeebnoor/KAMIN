# Evaluation — embedding on testset.json

- Harness: `kamin-eval-project-suggest-v1` · method version: `nazeh-embed-sentence-v1+2c4055b`
- Commit: `7313e45`
- Set: `testset.json` · sha256 `f63fc3b1dc54c03479d92fa155ff95d08384229e61a5841c59e8d2947f99186e` · frozen 2026-10-25T18:05:04.280Z
- Threshold: 0.52 (tuned on `dev-set.json`, sha256 `22123e75330e5196cc70be8e543e2b66d9899102442fc2f02b73ae4f3fda94c7`)
- Date: 2026-11-10

| Language | Cases | Precision | Recall | F1 | TP | FP | FN | Unsupported | Correct abstentions | Wrong abstentions | False-alarm cases |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Arabic | 20 | 100.0% | 26.1% | 41.4% | 6 | 0 | 17 | 0 | 2/2 | 13 | 0 |
| English | 20 | 100.0% | 26.1% | 41.4% | 6 | 0 | 17 | 0 | 2/2 | 12 | 0 |
| All | 40 | 100.0% | 26.1% | 41.4% | 12 | 0 | 34 | 0 | 4/4 | 25 | 0 |

An unsupported suggestion (supporting text not verbatim in the description) is counted as a false positive.
Correct abstentions are reported separately and never add to precision or recall.
