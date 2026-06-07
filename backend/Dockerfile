# Backend container for Render (works on any Docker host).
# Build context is the backend/ directory.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Install dependencies first so this layer is cached between code changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy the application code.
COPY . .

# Use the synced virtualenv directly so we don't need `uv run` at runtime.
ENV PATH="/app/.venv/bin:$PATH"
ENV PORT=8000
EXPOSE 8000

# Apply DB migrations, then start the API. Render injects $PORT.
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
