# Deploying OpenSourceHire (free stack)

| Piece | Host | Cost |
|-------|------|------|
| Frontend (Next.js) | Vercel | free |
| Backend (FastAPI) | Render | free |
| Postgres + pgvector | Neon | free |
| Redis | Upstash | free |

> Free Render web services **sleep after ~15 min idle** and cold-start in ~30–60s.
> That's the only real tradeoff of the $0 stack.

Do the steps **in order** — later steps need URLs from earlier ones.

---

## 0. Push to GitHub

All four platforms deploy from a Git repo:

```bash
git add -A && git commit -m "Add deploy config"
git push
```

(`.env` is gitignored, so your secrets stay local.)

---

## 1. Postgres + pgvector — Neon

1. Sign up at https://neon.tech → **New Project**.
2. Copy the **connection string** (looks like
   `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`).
3. **Convert it** for this app by changing the scheme `postgresql://` →
   `postgresql+psycopg://` and keeping `?sslmode=require`. Save this as your
   `DATABASE_URL`:

   ```
   postgresql+psycopg://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require
   ```

You don't need to create the `vector` extension manually — migration `0001`
runs `CREATE EXTENSION IF NOT EXISTS vector` on first deploy.

---

## 2. Redis — Upstash

1. Sign up at https://upstash.com → **Create Database** (Redis, pick a region).
2. Copy the **`rediss://` URL** (TLS). Save it as your `REDIS_URL`.

---

## 3. Backend — Render

1. Sign up at https://render.com and connect your GitHub repo.
2. **New → Blueprint** → select this repo. Render reads `render.yaml` and
   creates the `osh-api` service.
3. Open the service → **Environment** and fill the secrets marked `sync:false`:
   - `ANTHROPIC_API_KEY` — your z.ai key
   - `VOYAGE_API_KEY`
   - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
   - `DATABASE_URL` — from step 1
   - `REDIS_URL` — from step 2
   - `RESEND_API_KEY` — optional
   - Leave `GITHUB_OAUTH_CALLBACK_URL` and `BACKEND_CORS_ORIGINS` for step 5.
4. Deploy. When it's live you get a URL like `https://osh-api.onrender.com`.
   Check `https://osh-api.onrender.com/health` → `{"status":"ok"}`.

---

## 4. Frontend — Vercel

1. Sign up at https://vercel.com → **Add New → Project** → import the repo.
2. Set **Root Directory = `frontend`** (framework auto-detected as Next.js).
3. Add an env var:
   - `NEXT_PUBLIC_API_URL = https://osh-api.onrender.com`  (your Render URL)
4. Deploy. You get a URL like `https://your-app.vercel.app`.

---

## 5. Wire the two together (the cross-site step)

Now that both URLs exist, set the cross-references and redeploy the backend.

**In Render → Environment:**
- `BACKEND_CORS_ORIGINS = https://your-app.vercel.app`
- `GITHUB_OAUTH_CALLBACK_URL = https://osh-api.onrender.com/auth/github/callback`

(`COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` are already set by the
blueprint — required so the session cookie works across the two domains.)

**In your GitHub OAuth app** (https://github.com/settings/developers):
- **Authorization callback URL** = `https://osh-api.onrender.com/auth/github/callback`
- **Homepage URL** = `https://your-app.vercel.app`

Save, then **Manual Deploy → Deploy latest** on Render so it picks up the new
env vars.

---

## 6. Verify

1. Open `https://your-app.vercel.app`.
2. Click **Continue with GitHub** → authorize → you should land on the dashboard
   logged in (the navbar shows you, not a logged-out state).
3. If you log in but immediately look logged out, the cross-site cookie isn't
   set — recheck `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, and that
   `BACKEND_CORS_ORIGINS` exactly matches the Vercel origin (no trailing slash).

---

## Notes

- **Cold starts:** first request after idle is slow on Render free tier. Normal.
- **Email:** `onboarding@resend.dev` only sends to your own Resend account
  email. To email real users, verify a domain in Resend and set `EMAIL_FROM`.
- **Custom domain:** add it in Vercel/Render, then update
  `BACKEND_CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`, and the GitHub OAuth callback
  to match.
