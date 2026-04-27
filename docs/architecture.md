# Architecture

```
┌─ frontend (Next.js) ─────────────────────────┐
│  Dashboard • Issue feed • Profile page       │
└───────────────┬──────────────────────────────┘
                │
┌───────────────▼──────────────────────────────┐
│  backend (FastAPI)                           │
└─┬───────┬───────┬───────┬───────────┬────────┘
  │       │       │       │           │
┌─▼─┐   ┌─▼──┐  ┌▼────┐ ┌▼────────┐ ┌▼───────┐
│Skill   │Issue│  │PR    │Portfolio │ │Bounty  │
│Graph   │Scout│  │Coach │Builder   │ │Sync    │
└─┬──┘   └─┬──┘  └┬────┘ └┬────────┘ └┬───────┘
  │        │      │       │           │
  └────────┴──────┴───────┴───────────┘
                  │
   GitHub API • Algora API • Claude API • Postgres+pgvector • Redis
```

## Models

- **Sonnet 4.6** — agents that read code or write prose (skill_graph, issue_understanding, pr_coach, portfolio_builder)
- **Haiku 4.5** — cheap ranking/classification (issue_scout)
- **Prompt caching** — required on every repo-context block

## Build priority

P0 → P1 → P2. See [the plan](../../../.claude/plans/plan-this-project-in-sprightly-prism.md).

## Deep reference

For an end-to-end study guide with 15 Mermaid diagrams, file:line citations, every feature workflow, and a build script that produces a PDF, see [study-plan.md](./study-plan.md) (rendered: [study-plan.pdf](./study-plan.pdf)).
