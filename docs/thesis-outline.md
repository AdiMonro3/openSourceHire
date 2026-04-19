# Thesis outline

**Working title:** *Agentic retrieval and code-context reasoning for lowering the barrier to first open-source contribution: a multi-agent system for skill–issue matching, style-conditioned patch drafting, and portfolio construction.*

## Sections

1. Introduction — the Indian OSS-to-income gap; problem statement
2. Related work — Copilot, Cursor, Algora, Gitcoin, prior issue-recommendation systems
3. System design — multi-agent architecture; skill graph; issue ingestion; ranker; understanding agent; PR coach; portfolio builder
4. Implementation — Claude Sonnet 4.6 + Haiku 4.5; prompt caching strategy; pgvector retrieval; GitHub GraphQL ingestion
5. Evaluation
   - Match quality: top-5 precision vs. ground truth (n≈20)
   - Time-to-first-PR: baseline vs. tool-assisted
   - Merge rate
   - Style fidelity: BLEU + embedding similarity
6. Discussion — failure modes, AI-slop risk, maintainer pledge
7. Conclusion + future work
