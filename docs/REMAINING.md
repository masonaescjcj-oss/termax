# Remaining work

State of the trading engine and broker integration, and what is still open.
Written after the engine rebuild so nothing gets lost between sessions.

Last updated: 2026-08-22

---

## Done

| Area | State |
|---|---|
| Instrument specs (contract size, digits, pip, margin, swap, volume limits) | Done — `backend/src/config/instruments.ts` |
| Pricing engine (bid/ask, currency conversion, margin, P/L, swap) | Done — `backend/src/services/pricing.ts` |
| Forex maths | Fixed — was 100,000x out because no forex pair existed in any table |
| Engine on bid/ask (fills, TP/SL, trailing stops) | Done |
| Synthetic prices removed from the execution path | Done — behind `SYNTHETIC_TICKS`, display only |
| Pending-order trigger window | Fixed — intraday range is stamped with its bar start |
| Realised P/L credited to the position's own account | Fixed — was hardcoded to the DEMO account in 9 places |
| Overnight swap | Implemented — 21:00 UTC, Wednesday triple |
| Per-instrument price precision | Done — replaced global `toFixed(4)` / `toFixed(5)` |
| Duplicated calculation tables | All six removed (server ×2, PositionsScreen ×3, ChartScreen ×2 → one shared module each side) |
| Feed routing (cTrader forex/metals/indices, Binance crypto, Yahoo fallback) | Done — `backend/src/services/feeds/` |
| cTrader Open API transport (auth, heartbeat, reconnect, rate pacing) | Done — `backend/src/services/ctrader/connection.ts` |
| Broker contract terms adopted from `ProtoOASymbolByIdReq` | Done |
| Two trading modes, routed per account | Done — `backend/src/services/venues/`, `controllers/liveTrade.ts` |
| OAuth CSRF state, token storage and refresh | Done — `backend/src/services/ctraderService.ts` |
| Client broker-credential form removed | Done — replaced with the cTrader consent redirect |
| Tests | 193 assertions across four suites (`npm test` in `backend/`) |

---

## Open — blocking a live account

### 1. Integration test against a real broker account

**Not done, and cannot be done from the build environment.** The Open API needs
a TLS socket on port 5035 and Binance needs a WebSocket; the sandbox proxy
supports neither. Everything below was therefore pinned with unit tests against
a fake connection, and the wire formats are the part most likely to need a
correction on first contact:

- Spot event descaling (`price / 10^digits`)
- Trendbar decoding (a low plus integer deltas, scaled by 1e5, time in minutes)
- Volume units (`lots x contractSize x 100`)
- Symbol name matching across brokers (`XAUUSD`, `US500`, `.pro` suffixes)
- Money fields (hundredths of a cent)

**How to verify safely, in order:**

1. Set the `CTRADER_*` variables with a **demo** account and `CTRADER_ENV=demo`.
2. Start the server and confirm the log line `[cTrader] Matched N instruments`.
3. Check a quote: `GET /api/v1/market/prices` — a forex pair should now carry a
   spread of roughly a tenth of a pip to a pip, not the synthesised default.
4. Open a chart and confirm candles arrive from `ctrader`, not `yahoo`
   (`feedRouter.status()` reports the routing).
5. Place a **0.01 lot** order on the demo account and compare the fill price,
   commission and margin against the broker's own platform.
6. Only then repeat on live, still at minimum volume.

### 2. Database migration

`backend/src/scripts/migrations/001_add_venue_columns.sql` must be run before a
live account is linked — the routing depends on `positions.venue` and
`positions.broker_position_id`. Safe to run more than once.

### 3. Rotate the leaked credentials

Still outstanding from the import. These were hardcoded in the source and are in
the uploaded archive, so they must be considered public:

- AI provider key (`sk-nry-…`)
- MongoDB connection string with username and password
- Telegram bot token

The code now reads all three from the environment, but the old values are still
live until they are revoked and replaced.

---

## Open — correctness and robustness

### 4. Live position updates are pull-only

`getLivePositions` reconciles when the client asks. A position closed by the
broker's own stop-out, or filled from a pending order, is not pushed to the app
until the next poll. `ProtoOAExecutionEvent` already arrives on the connection —
subscribe to it in `CTraderVenue` and emit through `emitPositionUpdate` so the
live account behaves like the simulated one.

### 5. Simulated stop-out is O(users x positions) per tick

`processStopOuts` runs per symbol, per user, and calls `getAccountState` inside
the liquidation loop — two database round trips per position. Fine for tens of
accounts, not for thousands. Cache account state per tick, or move stop-out onto
an in-memory account ledger that the tick loop updates.

### 6. Partial closes on a live account

`closeLivePosition` sends a partial volume to the broker and mirrors whatever
comes back, but it does not split the local row the way the simulated path does,
so history shows one row changing size rather than a closed part plus a
remainder.

### 7. `getToken` / `setToken` are still exported

Kept so older imports compile. Nothing should use them — a process-wide token is
wrong as soon as two users link an account. Delete once the last caller is gone.

### 8. Caddyfile points at a Windows path

`caddy/Caddyfile` has `root * "c:/Users/asiac/…/mobile/dist"` and a Windows log
path. It will not serve anything on a Linux host.

---

## Open — product surface

### 9. Account leverage is not per-account

`InstrumentSpec.marginRate` is per instrument, which is right, but a user's
account leverage (`'1:200'` on the account record) is still ignored. A broker
account's real leverage comes from `ProtoOATraderRes.leverageInCents`; the
simulated account should get a configurable one.

### 10. Margin-call warning has no UI

`MARGIN_CALL_LEVEL` (100%) blocks new orders but nothing tells the user they are
in margin call before positions start closing at 50%.

### 11. `/trade/advanced-manager` is unreviewed

`addAdvancedRule` was inherited and has not been looked at against the new
engine. It writes `advanced_rules` on a position; whether anything still reads
them is unverified.

---

## Notes for whoever picks this up

- `npm test` in `backend/` runs all four suites. Add to them rather than
  starting a new pattern; every expected value there is a real broker reference
  figure, not a restatement of what the code does.
- `config/instruments.ts` is the only place contract terms belong. Six copies of
  those tables had drifted apart before; do not start a seventh.
- Functions in `services/pricing.ts` return `undefined` for an unpriced symbol
  on purpose. Substituting a default is how the original engine booked wrong
  numbers — refuse the operation instead.
- `SYNTHETIC_TICKS=true` is for demos only. It must never reach the execution
  path; the wiring that keeps it out is in `sockets/marketSocket.ts`.
