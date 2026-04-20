# Evaluation harness (P1.5)

Thesis-grade metrics for the multi-agent system, plus a SQLite audit log of
every Claude call.

## What lives here

- `store.py` — opens / writes the SQLite study tables (`study_runs`, `study_predictions`).
- `metrics.py` — pure functions: `precision_at_k`, `recall_at_k`, `merge_rate`, `bleu`, `cosine_similarity`.
- `ground_truth.jsonl` — hand-labeled `(github_login, expected_issues)` pairs. Add ~20 rows for stable precision@5.
- `run_study.py` — end-to-end runner: replays each user through Scout, scores precision@k, writes results.
- `results/` — generated, gitignored. Default DB lives at `results/eval.sqlite`.

The agent-side audit logger is `backend/app/services/eval_log.py`. Every call
through `call_claude` writes one row to the same SQLite file so study metrics
can be joined against the calls that produced them.

## Schema

```sql
agent_calls(ts, agent, tier, model, user_id, prompt_hash,
            input_tokens, output_tokens, cache_read, cache_write,
            latency_ms, output_text, metadata, error)

study_runs(ts, name, config_json, metrics)
study_predictions(run_id, user_login, rank, issue_url, score, is_match)
```

## Run a study

From the repo root, against the backend's venv:

```bash
uv run --project backend python eval/run_study.py --k 5 --name scout-v1
```

Optional PR-message style eval (BLEU + cosine over `{candidate, reference}` pairs):

```bash
uv run --project backend python eval/run_study.py \
  --pr-style-file eval/pr_style_pairs.jsonl
```

## Knobs

- `EVAL_DB_PATH=/tmp/foo.sqlite` — point both writer and reader at a different file.
- `EVAL_LOG_DISABLED=1` — silence the audit logger (CI, local dev where the file is a nuisance).

## Ad-hoc queries

```bash
sqlite3 eval/results/eval.sqlite \
  "SELECT agent, COUNT(*), AVG(latency_ms), SUM(cache_read) FROM agent_calls GROUP BY agent;"
```
