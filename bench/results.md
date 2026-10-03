# Classifier benchmark (v0)

Run: 2026-10-03 · 40 attacks + 40 normal items (bench/dataset.ts) · public slice: 116 rows of deepset/prompt-injections (Apache-2.0).

| | Threshold | Attacks caught (patterns + model) | False alarms (patterns + model) | Model alone: caught / false alarms | Public slice (deepset): caught / false alarms | ms per item | Download | License |
|---|---|---|---|---|---|---|---|---|
| patterns only | - | 10/40 (25%) | 1/40 | 10 / 1 | 2% / 0% | 0 | - | - |
| protectai-deberta-v2 | 0.990 | 24/40 (60%) | 6/40 | 23 / 6 | 30% / 0% | 52 | 739 MB | Apache-2.0 |
| horizon-guard-small | 0.890 | 38/40 (95%) | 3/40 | 37 / 2 | 30% / 0% | 42 | 268 MB | Apache-2.0 |
| prompt-guard-2-86m | 0.500 | 14/40 (35%) | 1/40 | 9 / 1 | 7% / 0% | 29 | 281 MB | Llama 4 (community ONNX copy of a gated model) |

Winner by the pre-set rule: **horizon-guard-small** (threshold 0.890).

Notes:
- Small set (80 items); M6 grows it to ~400. Treat differences of 1–2 items as noise.
- The public slice is mostly *direct* injections (some in German) and may be in some models' training data.
- Thresholds are picked on the same safe items they're scored on, so false alarms here are optimistic.
- The `exfil-secrets` phrase rule was tightened after seeing a false alarm in this set, so the phrase-rule numbers are slightly tuned to it.
- Models are pinned to the revisions in src/classifier.ts.
