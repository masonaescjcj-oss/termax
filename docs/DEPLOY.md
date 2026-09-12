# Deploying Termax

Three things ship independently:

| Part | Where | What it needs |
| --- | --- | --- |
| `backend/` | the VPS at `https://45-129-126-98.sslip.io` | Node 22, `.env`, the SQL migrations run on Supabase |
| `web/` | Vercel — the desktop terminal | `VITE_API_URL` at **build** time |
| `admin/` | Vercel — the admin console | `VITE_API_URL` at **build** time |

`mobile/` goes to the stores through EAS and is not part of this document.

---

## Vercel: one project per directory

This is a monorepo, so each site is its own Vercel project pointed at its
own folder. Both already carry a `vercel.json`, so the only thing the
dashboard has to be told is the root directory.

### Terminal (`web/`)

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Root Directory | `web` |
| Build command | `npm run build` *(from `vercel.json`)* |
| Output directory | `dist` *(from `vercel.json`)* |
| Install command | `npm ci` (default) |
| Node version | 22.x |

Environment variables — add for **Production, Preview and Development**:

```
VITE_API_URL = https://45-129-126-98.sslip.io
```

Vite inlines this at build time, so a change to it needs a redeploy, not
just a restart.

### Admin console (`admin/`)

Identical, with Root Directory `admin` and the same `VITE_API_URL`. The
console is served with `X-Robots-Tag: noindex` and `X-Frame-Options:
DENY` — it is a separate site, not a page of the app.

### From the CLI instead

```bash
npm i -g vercel
vercel login

cd web   && vercel link && vercel env add VITE_API_URL production && vercel --prod
cd ../admin && vercel link && vercel env add VITE_API_URL production && vercel --prod
```

`vercel link` asks which project to create or connect; everything else
comes from `vercel.json`.

---

## Before the first deploy

1. **Run the migrations.** `backend/src/scripts/migrations/*.sql` in order
   on the Supabase project. `scripts/bundle-migrations.sh` concatenates
   them into one transaction to paste into the SQL editor. Missing ones
   show up as 500s on alerts, notifications, 2FA and the equity curve.
2. **Backend `.env`.** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (two-factor
   needs it), `SUPABASE_SERVICE_KEY`, `TELEGRAM_BOT_TOKEN` (alerts to
   Telegram), `AI_API_KEY`, `PUBLIC_APP_URL` — see `backend/.env.example`.
3. **Supabase redirect allow-list.** Add the Vercel domains under
   Authentication → URL Configuration, or the email links in password
   reset and verification will refuse to land.

## After it is up

- Open the terminal, sign in, and watch the feed dot in the top bar go
  green — that is the socket, not the REST API.
- `GET /api/v1/market/screener` is empty for the first minute after a
  backend restart by design; the table is built on a timer.
- The backend currently answers with `cors()` wide open, which is what
  lets any Vercel preview URL call it. Tighten it to the two production
  domains once they are fixed.

## Notes

- `vercel.json` uses `rewrites`, not `routes`. The two cannot be mixed
  with `headers`/`cleanUrls` in one file — Vercel rejects the deployment
  with "Mixed routing properties".
- The SPA rewrite deliberately excludes `/assets/`, so a missing bundle
  returns 404 instead of an HTML page pretending to be JavaScript.
- CI (`.github/workflows/ci.yml`) builds both sites on every push, so a
  Vercel build failure should never be the first time a break is seen.
