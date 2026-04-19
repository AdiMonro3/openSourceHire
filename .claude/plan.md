# OpenSourceHire — MVP Build Plan

## Context
Greenfield project in `/Users/adityasingh/college-projects/openSource-Hire` (empty dir). Goal: a 3-month college-thesis-grade MVP that turns OSS contributions into a verifiable hiring signal for Indian engineers — skill profiling from GitHub, daily curated issue feed, AI-assisted issue understanding + PR drafting, auto-built public portfolio, and bounty sync. The build is segmented in strict priority order so that at any checkpoint the product is demo-able and the thesis has real metrics to report.

---

## Priority segmentation

Three tiers. Ship P0 end-to-end before touching P1. Ship P1 before P2.

### P0 — Foundations (Month 1)  — *"login → see 5 matched issues → read a plain-English summary"*
This is the minimum the thesis committee can see working.

- **P0.1 — Repo + infra scaffold**
  - Monorepo (pnpm workspaces) layout: `frontend/`, `backend/`, `cli/`, `packages/shared/`, `eval/`
  - `docker-compose.yml` for Postgres + pgvector + Redis
  - `.env.example`, root `README.md`, `.gitignore`
- **P0.2 — GitHub OAuth + session**
  - FastAPI `/auth/github/*` routes; httpOnly cookie session
  - Next.js login page + session middleware
- **P0.3 — Skill-Graph Agent** *(highest risk — build first)*
  - Ingest user's top repos → languages, frameworks, file-type histogram, prior PR stats
  - Claude Sonnet 4.6 synthesizes a structured `SkillProfile` (skills, levels 1–5, interests)
  - Store as row + pgvector embedding
- **P0.4 — Issue ingestion pipeline**
  - Cron worker: GraphQL query top-500 OSS repos for `good-first-issue`/`help-wanted`
  - Embed title+body, dedupe, persist with repo-reputation metadata (stars, recent merge rate)
  - Seed list of 100 hand-curated beginner-friendly repos (cold-start)
- **P0.5 — Issue Scout Agent + feed UI**
  - Haiku 4.5 ranker: `skill_fit × repo_reputation × bounty_$` with reason string
  - `GET /feed` returns top 5/day per user; `/dashboard` renders cards
- **P0.6 — Issue-Understanding Agent**
  - Pulls repo context (README, relevant files via embedding search), summarizes fix, flags gotchas
  - Prompt caching on repo-context block (critical for cost)

### P1 — AI core + thesis proof (Month 2)

- **P1.1 — PR Coach Agent**
  - Few-shot from last ~10 merged PRs in the target repo to mimic tone/format
  - Generates commit message + PR description; never auto-submits
- **P1.2 — CLI companion (`osh`)**
  - `osh login`, `osh explain <issue-url>`, `osh draft-pr`, `osh review`
  - Talks to same FastAPI backend; no duplicated agent code
- **P1.3 — Maintainer Pledge guardrails**
  - AI-draft disclosure block auto-appended to PR body
  - Ranker blocks repos with anti-AI contribution policies (keyword + maintainer list)
- **P1.4 — End-to-end proof point**
  - Developer ships their own first real PR using the tool (Week 8 milestone)
- **P1.5 — Evaluation harness**
  - `eval/` scripts: precision@5 vs ground-truth, time-to-first-PR, merge rate, PR-message BLEU/embedding similarity
  - Logs from all agent calls feed a simple SQLite eval store

### P2 — Portfolio, monetization, polish (Month 3)

- **P2.1 — Portfolio Builder Agent** — `/profile/[username]` public page (merged PRs, impact, testimonials)
- **P2.2 — Bounty Sync Agent** — Algora + Gitcoin read-only integration on the feed + profile
- **P2.3 — "Hire me" inbound** — simple contact form + email notification
- **P2.4 — Beta with 10 students** — collect metrics, fix top-5 pain points
- **P2.5 — Thesis writeup + demo video + deploy** (Vercel + Fly.io)

---

## Proposed MVP file tree

```
openSource-Hire/
├── README.md
├── .env.example
├── .gitignore
├── docker-compose.yml              # postgres+pgvector, redis
├── pnpm-workspace.yaml
├── package.json
│
├── frontend/                       # Next.js 15 (App Router) + Tailwind + shadcn/ui
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                # landing
│   │   ├── (auth)/login/page.tsx
│   │   ├── dashboard/
│   │   │   ├── page.tsx            # today's 5 issues
│   │   │   └── issues/[id]/page.tsx   # understanding view
│   │   ├── profile/[username]/page.tsx # public portfolio (P2)
│   │   └── api/auth/[...nextauth]/route.ts
│   ├── components/
│   │   ├── ui/                     # shadcn primitives
│   │   ├── IssueCard.tsx
│   │   ├── SkillChip.tsx
│   │   ├── FixSummary.tsx
│   │   └── PortfolioHeader.tsx
│   ├── lib/{api-client.ts, auth.ts}
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                        # FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py               # settings, Claude/GitHub keys
│   │   ├── deps.py                 # DB, auth, Claude client DI
│   │   ├── routers/
│   │   │   ├── auth.py             # P0.2
│   │   │   ├── users.py            # P0.3
│   │   │   ├── issues.py           # P0.5, P0.6
│   │   │   ├── pr.py               # P1.1
│   │   │   ├── portfolio.py        # P2.1
│   │   │   └── bounties.py         # P2.2
│   │   ├── agents/
│   │   │   ├── base.py             # shared Claude client + prompt caching helpers
│   │   │   ├── skill_graph.py             # P0.3
│   │   │   ├── issue_scout.py             # P0.5 (Haiku 4.5)
│   │   │   ├── issue_understanding.py     # P0.6 (Sonnet 4.6)
│   │   │   ├── pr_coach.py                # P1.1
│   │   │   ├── portfolio_builder.py       # P2.1
│   │   │   └── bounty_sync.py             # P2.2
│   │   ├── integrations/
│   │   │   ├── github.py           # GraphQL client, rate-limit aware
│   │   │   ├── algora.py
│   │   │   └── gitcoin.py
│   │   ├── models/                 # SQLAlchemy
│   │   │   ├── user.py
│   │   │   ├── skill.py
│   │   │   ├── issue.py
│   │   │   ├── contribution.py
│   │   │   └── bounty.py
│   │   ├── schemas/                # pydantic DTOs
│   │   ├── services/
│   │   │   ├── embeddings.py       # pgvector helpers (shared by scout+understanding)
│   │   │   ├── ranker.py           # skill_fit × rep × bounty
│   │   │   ├── cache.py            # Redis + Claude prompt-cache keys
│   │   │   └── pledge.py           # maintainer pledge / anti-AI repo filter (P1.3)
│   │   ├── workers/
│   │   │   ├── ingest_issues.py    # P0.4 cron
│   │   │   └── refresh_feed.py     # P0.5 cron
│   │   └── db/
│   │       ├── session.py
│   │       └── migrations/         # alembic
│   ├── tests/{test_skill_graph.py, test_issue_scout.py, test_pr_coach.py}
│   ├── pyproject.toml
│   └── alembic.ini
│
├── cli/                            # `osh` CLI (P1)
│   ├── src/
│   │   ├── index.ts
│   │   ├── commands/{login.ts, explain.ts, draft-pr.ts, review.ts}
│   │   └── lib/api.ts
│   └── package.json
│
├── packages/
│   └── shared/
│       └── types.ts                # SkillProfile, Issue, RankedIssue, PRDraft
│
├── eval/                           # thesis metrics (P1.5)
│   ├── ground_truth.jsonl          # hand-labeled n≈20 user × issue pairs
│   ├── metrics.py                  # precision@5, merge rate, BLEU, embed-sim
│   ├── run_study.py
│   └── results/
│
└── docs/
    ├── thesis-outline.md
    ├── architecture.md
    └── maintainer-pledge.md
```

---

## Critical files to get right first (in this order)

1. `backend/app/agents/base.py` — Claude client + prompt-caching helper. Every agent depends on it; get caching wrong and costs explode.
2. `backend/app/agents/skill_graph.py` — the product collapses if profiling is bad. Test against the developer's own GitHub before anything else.
3. `backend/app/integrations/github.py` — GraphQL wrapper with aggressive caching; reused by `skill_graph`, `issue_scout`, `pr_coach`, `portfolio_builder`.
4. `backend/app/services/embeddings.py` — one pgvector helper reused by issue ingest, scout ranking, and understanding's repo-context retrieval.
5. `backend/app/services/ranker.py` — the scoring function is both a product decision and a thesis metric (precision@5 is measured against it).

**Reuse discipline:** `github.py`, `embeddings.py`, `cache.py`, and `base.py` must be the *only* places those concerns live. Each agent file stays thin.

---

## Verification (per tier)

**P0 done when:**
- `docker-compose up` boots API + Postgres + Redis
- Login with GitHub → `/dashboard` shows 5 ranked issues within 5s
- Clicking an issue shows a plain-English fix summary with flagged gotchas
- Logs show prompt-cache hits on repeated repo reads (≥70% cache-hit rate)

**P1 done when:**
- `osh explain <url>` and `osh draft-pr` work against a real repo
- Developer has landed ≥1 merged PR drafted via the tool
- `eval/run_study.py` outputs precision@5, merge rate, and style-BLEU on ≥20 labeled pairs
- PR bodies include the AI-disclosure block; anti-AI repos are filtered from the feed

**P2 done when:**
- `/profile/<username>` loads publicly with merged PRs + bounty totals
- Algora feed appears inline in dashboard + profile
- 10 beta users have been run through the full loop; top-5 pain points logged + fixed
- Demo video + thesis draft + Vercel/Fly.io deploy live

---

## First-week execution order (concrete)

1. `pnpm init` + workspace scaffolding, `docker-compose.yml`, `.env.example`
2. FastAPI skeleton + `/health` + Postgres+pgvector migration
3. GitHub OAuth round-trip (server-side) + session cookie
4. `integrations/github.py` GraphQL client with caching
5. `agents/base.py` Claude client with prompt-cache wrapper
6. `agents/skill_graph.py` — run it against the developer's own GitHub; iterate until the profile is convincingly accurate before building anything else
