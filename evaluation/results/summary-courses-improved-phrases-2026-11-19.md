# Browser models + improved engine (2026-11-19)

Sets: course-testset.json · threshold tuned on course-dev-set.json only · split: phrases

| Method | course-testset EN F1 | Unsupported claims | Threshold |
|---|---|---|---|
| Improved local engine only (baseline) | 67.8% | 0 | — |
| MiniLM (current in KAMIN) + improved engine | 73.0% | 0 | 0.79 |
| multilingual-e5-small + improved engine | 70.8% | 0 | 0.88 |
| multilingual-e5-base + improved engine | 67.8% | 0 | 0.9 |
| paraphrase-multilingual-mpnet + improved engine | 74.2% | 0 | 0.77 |
