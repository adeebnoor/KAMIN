# Browser models + improved engine (2026-11-19)

Sets: course-testset.json · threshold tuned on course-dev-set.json only · split: sentences

| Method | course-testset EN F1 | Unsupported claims | Threshold |
|---|---|---|---|
| Improved local engine only (baseline) | 67.8% | 0 | — |
| MiniLM (current in KAMIN) + improved engine | 79.4% | 0 | 0.57 |
| multilingual-e5-small + improved engine | 74.6% | 0 | 0.87 |
| multilingual-e5-base + improved engine | 73.0% | 0 | 0.86 |
| paraphrase-multilingual-mpnet + improved engine | 74.6% | 0 | 0.65 |
