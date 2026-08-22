# Termax

A social trading platform: a **React Native / Expo** app (Android, iOS, web, and Telegram Mini App)
backed by a **Node.js + TypeScript** API with real-time market data, live positions, community chat,
and an AI trading coach.

---

## Repository layout

```
backend/            Express + Socket.IO API (TypeScript)
  src/
    routes/         HTTP route definitions  (/api/v1/*)
    controllers/    Request handlers & business logic
    sockets/        Socket.IO handlers (market, chat, trade)
    models/         Mongoose models
    config/         Supabase client
    middleware/     JWT auth
    scripts/        DB seeds, admin creation, schema SQL
    bot.ts          Telegram bot
  public/           Static uploads + Telegram Mini App shell

mobile/             Expo / React Native client
  src/
    screens/        Chart, Watchlist, Positions, ToolsHub, Chat, AICoach, Admin, …
    navigation/     Root navigator (stack + bottom tabs)
    components/     Shared UI (GlassView, Typography, SvgIcons, …)
    theme/          Theme context and colour tokens
    store/          Account state
    lib/            Supabase client
    config.ts       Backend URL resolution + Telegram helpers
  assets/           Fonts, avatars, emojis, icons
  App.tsx           App shell
  entry.js          Entry point (loads polyfills before the app)

caddy/              Reverse proxy config (API + WebSocket + static frontend)
assets/             Brand assets (logos, icons, Lottie files, avatar source set)
store/              Google Play listing graphics and device screenshots
scripts/ops/        Deploy, tunnel, icon-generation and VPS helper scripts
scripts/legacy-debug/  One-off investigation scripts kept for reference (not part of the build)
```

> `mobile/android/` and `mobile/ios/` are **not** tracked — they are stock `expo prebuild`
> output with no custom native code. Regenerate them with `npx expo prebuild`.

---

## Prerequisites

- **Node.js** 20 or newer, plus npm
- **Expo CLI** (invoked via `npx expo`, no global install needed)
- A **Supabase** project, and a **MongoDB** connection string
- Optional: Android Studio / Xcode for native builds, Caddy for local reverse proxying

---

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in real values
npm run dev               # nodemon + ts-node, hot reload
```

Other scripts:

```bash
npm run build             # tsc → dist/
npm start                 # node dist/server.js
```

The server listens on `PORT` (default `5000`) and exposes:

| Area | Base path |
| --- | --- |
| Health check | `GET /api/health` |
| Market data (prices, candles, promoted symbols) | `/api/v1/market` |
| AI coach chat | `/api/v1/ai` |
| Trading (cTrader OAuth, positions, execute/close/modify) | `/api/v1/trade` |
| Analysis tools (heatmap, SMC, MTF, liquidity map, calendar) | `/api/v1/tools` |
| Auth & profile | `/api/v1/auth` |
| Brokers & reviews | `/api/v1/brokers` |
| Admin panel | `/api/v1/admin` |
| Communities | `/api/v1/communities` |
| Campaigns / quests | `/api/v1/campaigns` |
| Static uploads | `/uploads` |

Socket.IO runs on the same HTTP server, with handlers for live prices
(`marketSocket`), community chat (`chatSocket`), and position updates (`tradeSocket`).

### 2. Mobile app

```bash
cd mobile
npm install
npm start                 # Expo dev server
```

Platform targets:

```bash
npm run android           # expo run:android
npm run ios               # expo run:ios
npm run web               # expo start --web
```

The client resolves its backend URL in `mobile/src/config.ts`. On native it always uses the
remote server; on web it uses the current origin for local development and the remote server
otherwise. Point `remoteBackendUrl` at your own host when running your own stack.

### 3. Reverse proxy (optional)

`caddy/Caddyfile` fronts everything on port `8080`: `/api/*`, `/socket.io/*` and `/uploads/*`
proxy to the backend on `:5000`, and everything else serves the Expo static web build.
Update the `root` and `log` paths — they currently point at a Windows development machine.

---

## Environment variables

All backend configuration lives in `backend/.env`; see `backend/.env.example` for the full
list with descriptions. Required groups:

- **Auth** — `JWT_SECRET`
- **Supabase** — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- **MongoDB** — `MONGODB_URI`
- **AI** — `OPENAI_API_KEY`
- **cTrader** — `CTRADER_CLIENT_ID`, `CTRADER_CLIENT_SECRET`, `CTRADER_REDIRECT_URI`
- **Telegram** — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEB_APP_URL`

`.env` files, keystores and other credentials are gitignored and must never be committed.
Database schema for Supabase is in `backend/src/scripts/supabase_schema.sql`.

---

## Building for release

Android builds go through EAS (see `mobile/eas.json`; profiles: `development`, `preview`,
`production`):

```bash
cd mobile
npx eas build --platform android --profile production
```

The web build (`npx expo export --platform web`) is deployed to Vercel using `mobile/vercel.json`.
