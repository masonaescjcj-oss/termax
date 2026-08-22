# AI engine architecture

Technical plan for the AI side of Termax: assistant, bot builder, backtest,
forward test, indicator builder, and running many bots on one server.

A reader-friendly version of this document, with diagrams, is published as an
artifact — see the link in the session notes. This file is the version that
belongs in the repository.

Last updated: 2026-08-22

---

## 1. The decision everything else depends on

**Is a user's bot a program, or is it data?**

The instinct is a program: give people an editor, run their JavaScript in a
sandbox. That choice makes the thousand-bot requirement unreachable, because a
sandbox has a floor price per bot.

The alternative is a **declarative specification** — a small validated JSON
document — interpreted by one engine shared by every bot.

| Concern | Bot as sandboxed code | Bot as declarative spec |
|---|---|---|
| Memory per bot | 1–2 MB (a WASM heap, minimum) | A few hundred bytes of state |
| 1,000 bots | ~1.5 GB, plus ~20 s of cold starts | Under 10 MB including all shared market state |
| AI can author it | Code that may not run, may loop, may be subtly wrong | JSON checked against a schema before it is accepted |
| Static analysis | Effectively impossible | Trivial — read the spec |
| Shareable | Requires reading someone's code to trust it | Renders as a rule list in any language |
| Backtest/live parity | Two code paths that drift | One interpreter, two clocks — parity by construction |
| Expressive ceiling | Unlimited | Bounded by the grammar |

The last row is the only real cost. Retail strategies overwhelmingly reduce to
conditions over indicators plus risk rules. Capitalise.ai's product is natural
language compiled into exactly this kind of rule set, and Composer turns a
plain-English prompt into a backtested strategy in under a minute; neither hands
the user a code editor.

**Decision: declarative spec as the primary representation**, with a pooled
sandboxed-code path as an explicit advanced tier.

### Spec shape

```jsonc
{
  "name": "London RSI reversion",
  "symbol": "EUR/USD",
  "timeframe": "15m",
  "indicators": {
    "rsi":    { "type": "RSI", "period": 14 },
    "ema200": { "type": "EMA", "period": 200 },
    "atr":    { "type": "ATR", "period": 14 }
  },
  "filters": [
    { "session": "london" },
    { "maxSpreadPips": 1.5 }
  ],
  "entry": {
    "long":  { "all": [ { "crossesAbove": ["rsi", 30] }, { "gt": ["close", "ema200"] } ] },
    "short": { "all": [ { "crossesBelow": ["rsi", 70] }, { "lt": ["close", "ema200"] } ] }
  },
  "exit": {
    "stopLoss":   { "atrMultiple": 1.5 },
    "takeProfit": { "atrMultiple": 2.5 },
    "timeStop":   { "bars": 40 }
  },
  "sizing": { "riskPercent": 0.5 },
  "limits": { "maxOpenPositions": 1, "maxTradesPerDay": 3 }
}
```

Roughly 800 bytes. Validates against a schema, renders as a sentence in any
language, diffs cleanly when the AI proposes a change.

---

## 2. Runtime: compute indicators once, read them many times

Indicators live in a shared bus keyed by `(symbol, timeframe, indicator, params)`
and are computed once per bar, then read by every bot that references them.

Two properties make this cheap:

- **Incremental form.** An EMA update is one multiply and one add, not a pass
  over 200 bars.
- **Bar-close evaluation.** Stops, targets, trailing stops and stop-outs already
  run tick-by-tick in the execution engine (`processTPSL`, `processTrailingStops`,
  `processStopOuts`), so a strategy has nothing to do between bars.

### Scheduling

Bots are indexed by `(symbol, timeframe)`. When a bar closes, the aggregator
updates that series' indicators once, then the interpreter walks only the bots
registered on that key. No polling loop, no per-bot timer, no thread per bot.

- A bot on 15m evaluates 4 times an hour, not 3,600.
- A bot decides *whether to be in*, not how to manage a fill.
- 200 bots on EUR/USD 15m cost one indicator update and 200 rule walks.

### Capacity at 1,000 bots

Assuming 50 instruments, 6 timeframes, 500 bars retained per series:

| Component | Sizing | Memory |
|---|---|---|
| Candle ring buffers | 50 × 6 × 500 bars × 6 floats | ~7 MB |
| Indicator accumulators | 300 series × ~25 configs, O(1) state | ~0.8 MB |
| Bot specifications | 1,000 × ~800 bytes | ~0.8 MB |
| Per-bot runtime state | position ref, last signal, counters, cooldowns | ~0.5 MB |
| **Total** | one process | **~9 MB** |

CPU: worst realistic case is every bot on 1m — 1,000 rule walks per minute. At a
generous 100 µs each that is 0.1 s per minute, under 0.2% of one core.

**The real limit is orders, not bots.** A thousand bots firing on the same candle
produce a thousand near-simultaneous executions, each writing to the database
and, on live accounts, hitting the broker's 50-requests-per-second cap. Design
the order queue and backpressure policy carefully; the strategy runtime is not
the bottleneck.

Consequences to build in early:

- One process now; the shard key is the symbol, so splitting later is mechanical.
- Order queue with per-account fairness, so one user's twenty bots cannot starve
  everyone else.
- Cap the number of *distinct* symbol/timeframe series, not the number of bots.
- Cold start is a table read plus indicator rebuild from stored candles.

---

## 3. Custom code: the advanced tier

Keep a code path for users who hit the grammar's ceiling, as a bounded pooled
resource rather than the default.

**Do not use `isolated-vm`.** A sandbox-escape flaw in its `ExternalCopy`
component was disclosed in August 2026: code inside the sandbox can corrupt host
memory and reach RCE. `node:vm` is not a sandbox and never was.

**Use QuickJS compiled to WebAssembly.** User code runs in a WASM linear-memory
space with no access to host memory, syscalls or APIs, so even memory corruption
in the JS engine cannot cross the WASM boundary. The trade is execution speed,
which is irrelevant for a function that runs once per bar.

Keeping its cost bounded:

- **Pool, do not allocate per bot.** ~8 interpreter instances serve every custom
  bot in turn, so memory is a constant independent of user count.
- **Pure function signature.** The bot receives a plain snapshot (candles,
  indicator values, position state) and returns a plain signal object. No I/O,
  no network, no clock, no randomness it did not receive as input.
- **Step budget plus wall clock.** Exceeding either disables the bot with a
  message rather than retrying.
- **Determinism is the entry requirement** — otherwise backtest and live cannot
  agree and the honesty grade is meaningless.
- Reserve for paid tiers.

---

## 4. Backtest and forward test

Because the interpreter is shared, backtesting is not a second implementation:
swap the live feed for stored candles and the wall clock for a bar counter. That
removes the usual class of bug where a backtest uses information the live bot
would not have had. Two rules still need deliberate enforcement:

- **No look-ahead.** A rule evaluated on a bar close sees that bar's close and no
  part of the next.
- **Real costs.** Fills on the correct side of the spread, commission per lot, and
  overnight swap — all already computed by `services/pricing.ts`, so the backtest
  inherits them rather than approximating.

### The honesty grade

Score every backtest and show the score as prominently as the return:

1. **Out-of-sample split** — fit on the first 70% of history, report on the last 30%.
2. **Sample size** — under ~30 trades, report "not enough evidence" rather than a win rate.
3. **Parameter pressure** — free parameters against trade count; six tuned numbers over 40 trades is curve fitting.
4. **Sensitivity** — perturb every parameter ±10%; collapse means the result sat on a knife edge.
5. **Trade-order Monte Carlo** — reshuffle trade sequence ~1,000 times for a confidence band on drawdown.

**A bot cannot go live until it has completed a forward test.** Backtests can be
gamed; a forward run on unseen incoming data cannot. The simulated venue built in
the engine work (`services/venues/`) is the right place to run it, so this costs
almost nothing to add — and it doubles as a retention mechanic.

This is also the most defensible position available: every rival claims their AI
finds winning strategies. Being the platform that tells a user their strategy is
overfitted is more useful and much harder to copy, because it requires being
willing to disappoint the user.

---

## 5. Custom indicators

A user-built indicator is an expression over price series and other indicators,
producing a series — the same grammar one level down.

```jsonc
{
  "name": "Squeeze",
  "inputs": { "period": 20, "mult": 2 },
  "body": {
    "div": [
      { "sub": [ { "bbUpper": ["close", "period", "mult"] },
                 { "bbLower": ["close", "period", "mult"] } ] },
      { "mul": [ { "atr": ["period"] }, 2 ] }
    ]
  },
  "plot": { "pane": "separate", "style": "line" }
}
```

- **Any indicator can appear in any bot.** A custom indicator registers in the
  same bus as the built-ins, so referencing it from a strategy needs no special
  case.
- **The chart is the shared surface.** Indicators, bot entries and exits,
  backtest trade markers and the forward-test run all draw on the existing chart.
  That screen becomes where everything is inspected.

---

## 6. The AI layer

### What exists today

`controllers/aiController.ts` builds a system prompt containing equity, free
margin and a sentence per open position, then sends the conversation. That is a
snapshot, and it caps what the assistant can be: it cannot answer "what is my
worst hour of the day", "am I cutting winners early", or "how would this idea
have done in 2020".

It was also filling that prompt from a private copy of the contract-size tables —
the sixth in the codebase, and like the others it held no forex pair, so MaxAI
stated account figures 100,000x out with total confidence. Now fixed to read
`services/pricing.ts`. **The lesson generalises: the model must never compute a
number, only report one a tool gave it.**

### Tool surface

| Tool | Answers |
|---|---|
| `get_account` | balance, equity, margin, leverage |
| `get_positions` | what is held and what it is doing |
| `get_trade_history` | what I did last week / on this pair / after that loss |
| `get_trade_stats` | win rate, expectancy, profit factor, drawdown — grouped by symbol, hour, weekday, session |
| `get_candles`, `get_indicator` | what the market was doing at entry |
| `get_quote` | current spread |
| `run_backtest` | how would this idea have done |
| `save_strategy`, `deploy_strategy` | build this bot, start a forward test |
| `get_news`, `get_calendar` | what is moving this pair, what is due |
| `propose_order` | **never executes** — returns a card the user must confirm |

### Numbers must be traceable

The widget mechanism already in the code — a JSON block appended to the reply and
rendered by the client — is the right instinct and should become the *only* way
figures reach the screen. A metric rendered from a tool result has nowhere for a
hallucinated number to appear. Prose explains; structured blocks carry the
arithmetic.

**Remove the confidence score.** The current prompt asks for `"confidence": 90`
alongside a trade setup. A language model's self-reported confidence in a trade
is not a probability of anything, and users will read it as one. Replace with the
backtested win rate of the setup and its sample size, or show nothing.

### Strategy authoring loop

1. User describes an idea in their own words.
2. Model emits a strategy spec as JSON, constrained by the schema.
3. Validation runs; errors go back to the model, bounded retries.
4. A backtest runs automatically, with the honesty grade.
5. User sees the rules in plain language, the equity curve and the grade — then a
   button to start a forward test.

The user never sees an untested strategy, and never sees one that does not run.
Both properties come free from the spec being data.

### Cost control

- **Cache the static prefix.** System prompt and tool definitions are identical
  every call and are the largest fixed cost.
- **Tier the models.** A small fast model routes intent and handles lookups; the
  strong model handles analysis and strategy authoring.
- **Precompute statistics.** `get_trade_stats` reads a rollup updated when a
  trade closes, not an aggregate over full history per question.
- **Stream.** Perceived latency is most of the felt quality.

---

## 7. Product surface, ranked

The differentiator is not the feature list — every platform ships bots,
backtests and a chat box. It is being useful in the moments a trader is already
emotionally engaged.

**Cheap, high impact**

- **Trade DNA** — behavioural profile from their own closed trades: revenge
  trading after a loss, cutting winners early, worst hour and weekday, size creep
  after a win. Uses only stored data. The most shareable thing on this list.
- **"Why did this lose?"** — one tap on a closed trade; the AI pulls candles and
  indicators around entry and exit and explains. A loss is when a trader most
  wants an explanation and is least likely to get one.
- **Alerts that say why** — not "RSI crossed 30" but "RSI crossed 30 while price
  swept the Asian low — the setup your London reversion bot waits for".

**Medium effort**

- **A bot from your own trades** — infer the strategy the user is implicitly
  running, write it as a spec, backtest it. Shows them their own edge, with
  evidence.
- **Bot versus you** — a bot in forward test on the same instrument the user
  trades by hand, scored side by side. Gives the forward-test gate a reason to
  exist beyond safety.
- **Idea to bot in under a minute** — the demo that sells the product; worth
  optimising latency for specifically.

**Bigger build**

- **Strategy library with real track records** — published bots browsable with
  their *forward-test* record rather than a backtest, so the leaderboard cannot be
  gamed by curve fitting. Composer's community holds thousands of strategies and
  is their strongest retention surface.
- **Replay mode** — scrub the chart back and trade forward bar by bar against a
  bot on the same data. Reuses the backtest clock that has to exist anyway.

The thread through the strong ones: they use the trader's *own* data to tell them
something they did not know about themselves. Market commentary is a commodity.
A mirror is not.

---

## 8. Risks

| Risk | Note |
|---|---|
| **Signals look like investment advice** | An AI emitting "BUY BTC, entry 62000, confidence 90" is close to regulated advice in many jurisdictions, and the confidence figure makes it worse. Needs disclaimers, no performance claims, jurisdiction awareness. |
| **An AI-written bot losing real money** | The forward-test gate is the mitigation and should be mandatory on live accounts with no override. Default live deployments to minimum volume. |
| **User code escaping the sandbox** | Why the recommendation is QuickJS-in-WASM, not `isolated-vm`. Revisit on every runtime upgrade. |
| **Token spend per conversation** | Tool use multiplies calls per turn. Without caching, precomputed stats and model tiering, an engaged user becomes unprofitable. |
| **One wrong number costs the feature** | The forex bug already had MaxAI stating figures 100,000x out. A trader who catches the assistant confidently wrong once will not trust it again. |
| **Order storms** | A thousand bots is a rounding error; a thousand bots firing on one candle is a queueing and broker-rate-limit problem. |

---

## 9. Build order

Each stage depends on the one before it. None of it needs the broker feed to be
live, so it can proceed in parallel with the cTrader integration.

1. **Strategy schema and interpreter** — the grammar, its JSON Schema, and the
   evaluator. Everything else is downstream. Testable with stored candles and no
   feed, the same way the engine maths was tested.
2. **Indicator bus** — incremental indicators keyed by symbol/timeframe/params,
   plus the bar aggregator. Where the thousand-bot economics are won or lost.
3. **Backtest engine and honesty grade** — the interpreter on a bar clock with
   real spread, commission and swap, plus the five scoring checks. The first thing
   a user can feel, and the safety gate everything after depends on.
4. **Forward test on the simulated venue** — mostly wiring; the venue exists.
   Unlocks the live gate and the daily-return habit.
5. **AI tool layer** — replace prompt-stuffing with typed tools, structured number
   rendering, prompt caching, model tiering.
6. **Strategy authoring loop** — plain English to validated spec to automatic
   backtest to graded result. The demo moment.
7. **Trade DNA and trade post-mortems** — highest engagement per unit of work on
   the list, and only needs the tool layer.
8. **Custom indicators, then the QuickJS tier** — last, because the grammar has to
   prove its ceiling before it is worth escaping, and the sandbox is the only part
   with a security surface.

### One thing to decide before stage 1

How wide the grammar goes. Every construct added is one the AI must generate
correctly, the interpreter must evaluate, the backtest must reproduce, and the
plain-language renderer must describe. Starting narrow — comparisons, crossovers,
logical composition, one higher-timeframe reference, session and spread filters,
ATR-based risk — covers a surprising share of real strategies and can grow from
evidence rather than guesswork.

---

## Sources

- [isolated-vm sandbox escape, August 2026](https://thehackernews.com/2026/08/isolated-vm-flaw-lets-sandboxed.html)
- [QuickJS/WASM sandboxing comparison](https://github.com/formio/vm)
- [JavaScript sandboxing research](https://github.com/simonw/research/tree/main/javascript-sandboxing-research)
- [Pine Script alerts run server-side on realtime bars](https://www.tradingview.com/pine-script-docs/concepts/alerts/)
- [Composer: plain-English to backtested strategy](https://www.businesswire.com/news/home/20251021050436/en/Composer-Supercharges-Investing-Platform-with-New-Trade-With-AI-Tool)
- [No-code strategy builders, 2026 survey](https://crypto.news/top-9-no-code-ai-trading-apps-for-beginners-in-2026/)
