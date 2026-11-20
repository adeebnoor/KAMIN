# Browser models + lexicon (2026-11-19)

Sets: course-testset.json · threshold tuned on course-dev-set.json only · split: phrases

| Method | course-testset EN F1 | Unsupported claims | Threshold |
|---|---|---|---|
| Lexicon only (baseline) | 71.6% | 0 | — |
| MiniLM (current in KAMIN) + lexicon | 70.6% | 0 | 0.79 |
| multilingual-e5-small + lexicon | 68.6% | 0 | 0.88 |
| multilingual-e5-base + lexicon | 71.6% | 0 | 0.9 |
| paraphrase-multilingual-mpnet + lexicon | 63.3% | 0 | 0.67 |
