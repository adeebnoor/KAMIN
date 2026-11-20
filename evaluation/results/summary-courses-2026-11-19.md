# Browser models + lexicon (2026-11-19)

Sets: course-testset.json · threshold tuned on course-dev-set.json only · split: sentences

| Method | course-testset EN F1 | Unsupported claims | Threshold |
|---|---|---|---|
| Lexicon only (baseline) | 71.6% | 0 | — |
| MiniLM (current in KAMIN) + lexicon | 65.9% | 0 | 0.5 |
| multilingual-e5-small + lexicon | 70.4% | 0 | 0.87 |
| multilingual-e5-base + lexicon | 58.4% | 0 | 0.83 |
| paraphrase-multilingual-mpnet + lexicon | 72.5% | 0 | 0.64 |
