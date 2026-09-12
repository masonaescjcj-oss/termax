# Termax Web — the desktop terminal

The browser version of Termax: a full-width trading terminal on the same
backend, accounts and data as the mobile app. Nothing here is a second
engine — every panel is a view over an existing endpoint.

## What is in it

| Area | Backed by |
| --- | --- |
| Live candlestick chart (klinecharts) with 12 indicators, 5 chart types, 11 drawing tools, position/SL/TP lines | `GET /market/candles/:symbol`, socket `subscribe` → `priceUpdate` |
| Symbol search (60+ instruments across Forex, Metals, Energy, Indices, Crypto, Stocks) | catalogue in `src/symbols.ts`, mirrors `backend/src/config/instruments.ts` |
| Watchlist with live ticks, saved on the account | `PUT /auth/me { watchlist }` |
| Order ticket — market/limit/stop, SL/TP, size-by-risk, pre-trade warnings | `POST /trade/execute`, `/trade/calculate-lot`, `GET /insights/pre-trade` |
| Positions / Orders / History with live P/L, modify, close, close-all, account strip | `GET /trade/positions`, `POST /trade/modify`, `POST /trade/close` |
| MaxAI (side panel and full page) | `POST /ai/chat`, `GET /ai/usage` |
| Markets: heatmap, technical scan, economic calendar | `GET /tools/heatmap`, `/tools/analysis`, `/tools/calendar` |
| Bots: build from a sentence, start/stop/go-live, report, events | `/bots/*` |
| Backtests: run, list, result with equity curve and honesty notes | `/backtests/*` |
| Journal: month heatmap, day view, auto-written entries, notes and mood | `/journal/*` |
| Portfolio & risk: exposure, all-stops-hit, correlations, Trade DNA, digest, risk guard | `/insights/*` |
| Strategy library: publish, clone, unpublish | `/library/*` |
| Sign in / sign up / forgot / verify (verification on only when the server says so) | `/auth/*` |

## Run

```bash
cd web
npm install
npm run dev            # http://localhost:5175, proxies /api and /socket.io to VITE_API_URL or localhost:5000
npm run build          # typecheck + production bundle in dist/
```

Set `VITE_API_URL` to the backend origin for production builds (see
`.env.example`). `vercel.json` carries the SPA fallback; deploy the `web/`
directory as its own Vercel project with root directory `web`.

## Keyboard

- `/` symbol search · `Esc` back to the cursor tool · `B` / `S` open the order ticket
- Wheel to zoom, drag to pan; drawing tools are one-shot and return to the cursor.
