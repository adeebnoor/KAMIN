# MiniLM-L12 (KAMIN) vs mpnet · both with engine v2 (experimental) · 2026-11-19

Hybrid (engine v2 first, then the model above its threshold), sentences split. Thresholds tuned only on course-dev-set.json (course sets) or dev-set.json (testset, dialect-set). Measured locally on Windows (CPU). "Median ms" is the model's embedding time per text; the engine alone is under 1 ms.

## course-testset-v2 (held-out, 12 courses)

Tuned on course-dev-set.json. Cases: 12

| Method | Precision | Recall | F1 | TP / FP / FN | Unsupported claims | Abstention rate | Correct abstentions / negatives | Median ms per text | Threshold |
|---|---|---|---|---|---|---|---|---|---|
| Engine v2 only (no model) | 75.0% | 75.0% | 75.0% | 3 / 1 / 1 | 0 | 66.7% | 7 / 8 | 0.2 | — |
| L12 + engine v2 | 80.0% | 100.0% | 88.9% | 4 / 1 / 0 | 0 | 58.3% | 7 / 8 | 17.8 | 0.6 (per-capability pass: all equal) |
| mpnet + engine v2 | 80.0% | 100.0% | 88.9% | 4 / 1 / 0 | 0 | 58.3% | 7 / 8 | 33.0 | 0.65 (per-capability pass: all equal) |

## course-testset (seen set, not proof, 25 courses)

Tuned on course-dev-set.json. Cases: 25

| Method | Precision | Recall | F1 | TP / FP / FN | Unsupported claims | Abstention rate | Correct abstentions / negatives | Median ms per text | Threshold |
|---|---|---|---|---|---|---|---|---|---|
| Engine v2 only (no model) | 78.1% | 83.3% | 80.6% | 25 / 7 / 5 | 0 | 12.0% | 3 / 6 | 0.2 | — |
| L12 + engine v2 | 80.0% | 93.3% | 86.2% | 28 / 7 / 2 | 0 | 12.0% | 3 / 6 | 17.9 | 0.6 (per-capability pass: all equal) |
| mpnet + engine v2 | 77.8% | 93.3% | 84.8% | 28 / 8 / 2 | 0 | 12.0% | 3 / 6 | 36.9 | 0.65 (per-capability pass: all equal) |

## testset (project descriptions) · AR

Tuned on dev-set.json. Cases: 20

| Method | Precision | Recall | F1 | TP / FP / FN | Unsupported claims | Abstention rate | Correct abstentions / negatives | Median ms per text | Threshold |
|---|---|---|---|---|---|---|---|---|---|
| Engine v2 only (no model) | 94.7% | 78.3% | 85.7% | 18 / 1 / 5 | 0 | 30.0% | 2 / 2 | 0.1 | — |
| L12 + engine v2 | 94.7% | 78.3% | 85.7% | 18 / 1 / 5 | 0 | 30.0% | 2 / 2 | 5.1 | 0.69 (per-capability pass: all equal) |
| mpnet + engine v2 | 90.9% | 87.0% | 88.9% | 20 / 2 / 3 | 0 | 20.0% | 2 / 2 | 10.8 | 0.66 (per-capability pass: all equal) |

## testset (project descriptions) · EN

Tuned on dev-set.json. Cases: 20

| Method | Precision | Recall | F1 | TP / FP / FN | Unsupported claims | Abstention rate | Correct abstentions / negatives | Median ms per text | Threshold |
|---|---|---|---|---|---|---|---|---|---|
| Engine v2 only (no model) | 100.0% | 82.6% | 90.5% | 19 / 0 / 4 | 0 | 30.0% | 2 / 2 | 0.0 | — |
| L12 + engine v2 | 100.0% | 82.6% | 90.5% | 19 / 0 / 4 | 0 | 30.0% | 2 / 2 | 6.2 | 0.69 (per-capability pass: all equal) |
| mpnet + engine v2 | 100.0% | 87.0% | 93.0% | 20 / 0 / 3 | 0 | 25.0% | 2 / 2 | 12.4 | 0.66 (per-capability pass: all equal) |

## dialect-set (Saudi dialect)

Tuned on dev-set.json. Cases: 22

| Method | Precision | Recall | F1 | TP / FP / FN | Unsupported claims | Abstention rate | Correct abstentions / negatives | Median ms per text | Threshold |
|---|---|---|---|---|---|---|---|---|---|
| Engine v2 only (no model) | 75.0% | 27.3% | 40.0% | 6 / 2 / 16 | 0 | 68.2% | 2 / 2 | 0.1 | — |
| L12 + engine v2 | 77.8% | 31.8% | 45.2% | 7 / 2 / 15 | 0 | 63.6% | 2 / 2 | 6.5 | 0.69 (per-capability pass: all equal) |
| mpnet + engine v2 | 56.3% | 40.9% | 47.4% | 9 / 7 / 13 | 0 | 50.0% | 2 / 2 | 12.0 | 0.66 (per-capability pass: all equal) |

## Model size

| Model | q8 ONNX file | Whole model folder | Embedding dimension | Layers | Vocabulary | Folder |
|---|---|---|---|---|---|---|
| paraphrase-multilingual-MiniLM-L12-v2 (KAMIN) | 112.8 MB (118,308,126 B) | 129.4 MB | 384 | 12 | 250,037 | .model-cache/2c4055b12046f11709e9df2c122e59ffbdc2f900 |
| paraphrase-multilingual-mpnet-base-v2 | 265.7 MB (278,647,663 B) | 282.0 MB | 768 | 12 | 250,002 | evaluation/models/paraphrase-multilingual-mpnet-base-v2 |

KAMIN's folder also holds catalog-index-v1.json (KAMIN's own precomputed catalog vectors), which is counted in its folder size.
