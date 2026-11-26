# Evaluation — embedding on testset-v2.json

- Harness: `kamin-eval-project-suggest-v1` · method version: `nazeh-embed-sentence-v1+2c4055b`
- Commit: `14ceaaf-dirty`
- Set: `testset-v2.json` · sha256 `b6ea4839aeeb9f4080aa3c8b46ce108e1de56382fa4b69a0158408c74308d189` · frozen 2026-11-24
- Threshold: 0.52 (tuned on `dev-set.json`, sha256 `22123e75330e5196cc70be8e543e2b66d9899102442fc2f02b73ae4f3fda94c7`)
- Date: 2026-11-24

| Language | Cases | Precision | Recall | F1 | TP | FP | FN | Unsupported | Correct abstentions | Wrong abstentions | False-alarm cases |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Arabic | 44 | 46.7% | 38.9% | 42.4% | 14 | 16 | 22 | 0 | 7/11 | 14 | 4 |
| English | 27 | 68.8% | 45.8% | 55.0% | 11 | 5 | 13 | 0 | 6/6 | 8 | 0 |
| All | 71 | 54.3% | 41.7% | 47.2% | 25 | 21 | 35 | 0 | 13/17 | 22 | 4 |

An unsupported suggestion (supporting text not verbatim in the description) is counted as a false positive.
Correct abstentions are reported separately and never add to precision or recall.
