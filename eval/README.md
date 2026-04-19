# Evaluation harness (P1.5)

Thesis-grade metrics for the multi-agent system.

## Metrics

- **precision@5** — top-5 issue match precision vs. ground-truth contributions
- **time-to-first-PR** — manual baseline vs. tool-assisted
- **merge rate** — % of drafted PRs that get merged
- **style fidelity** — BLEU + embedding similarity of generated PR messages vs. repo norm

## Layout

- `ground_truth.jsonl` — n≈20 user × issue pairs (hand-labeled)
- `metrics.py` — metric implementations
- `run_study.py` — end-to-end study runner
- `results/` — generated, gitignored
