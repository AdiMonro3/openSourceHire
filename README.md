# OpenSourceHire

An AI career engine that turns open-source contributions into verifiable income and hiring signal for Indian engineers.

## Monorepo layout

```
openSource-Hire/
├── frontend/          Next.js 15 web app
├── backend/           FastAPI + Postgres/pgvector + Redis
├── cli/               `osh` CLI companion
├── packages/shared/   Shared TS types
├── eval/              Thesis evaluation harness
└── docs/              Architecture, thesis outline, maintainer pledge
```

## Prerequisites

- Node 20+, pnpm 9+
- Python 3.11+, [uv](https://docs.astral.sh/uv/) (or pip)
- Docker + Docker Compose
- A GitHub OAuth app (client id/secret)
- An Anthropic API key

## Quick start

```bash
cp .env.example .env            # fill in keys
docker compose up -d            # postgres+pgvector+redis
pnpm install                    # JS workspaces
cd backend && uv sync           # python deps
```

Run the backend:

```bash
cd backend && uv run uvicorn app.main:app --reload --port 8000
# verify: curl http://localhost:8000/health
```

Run the frontend:

```bash
cd frontend && pnpm dev          # http://localhost:3000
```

## Build priority

See [docs/architecture.md](docs/architecture.md). Ship P0 → P1 → P2 in order.
