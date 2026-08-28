/**
 * NATURAL-LANGUAGE BOT BUILDER — the phase-6 authoring loop.
 *
 * توصیف فارسی/انگلیسی ← JSON محدود به schema ← اعتبارسنجی با retry ←
 * بک‌تست خودکار ← قواعد به زبان ساده + نمره‌ی صداقت.
 *
 * The model's only job is translating intent into a StrategySpec. The
 * validator (not the model) decides what is legal; validation errors go back
 * into the loop verbatim, path-addressed, until the spec is clean or the
 * attempts run out. The rule sheet the user reads is rendered from the FINAL
 * JSON deterministically — never from the model's own paraphrase. The
 * backtest that accompanies the result is the real engine with real costs,
 * and its honesty grade rides along.
 */

import OpenAI from 'openai';
import { loadAIConfig } from '../../utils/aiConfigManager';
import { describeSpec } from '../strategy/describe';
import { StrategySpec } from '../strategy/types';
import { validateSpec, SpecError } from '../strategy/validate';
import { executeTool } from './tools';

const MAX_ATTEMPTS = 3;
const DEFAULT_BACKTEST_DAYS = 60;

/**
 * The grammar, stated once, statically (cache-friendly). Everything the
 * validator enforces that the model tends to get wrong is called out.
 */
const BUILDER_PROMPT = `You translate a trader's plain-language strategy description into ONE JSON StrategySpec. Output ONLY the JSON object — no prose, no markdown fences.

Schema:
{
  "name": string (<= 60 chars),
  "symbol": string (e.g. "EUR/USD", "BTC/USDT", "GOLD"),
  "timeframe": "1m"|"5m"|"15m"|"30m"|"1h"|"4h"|"1d"|"1w",
  "indicators": { "<name>": IndicatorDef, ... } (optional, max 12),
  "filters": [ {"session":"sydney"|"tokyo"|"london"|"newyork"} | {"hoursUtc":[from,to]} | {"weekdaysUtc":[0-6,...]} | {"maxSpreadPips":n} ] (optional),
  "entry": { "long"?: Condition, "short"?: Condition } (at least one),
  "exit": {
    "stopLoss": {"pips":n} | {"atrMultiple":n},          // REQUIRED, always
    "takeProfit"?: {"pips":n} | {"atrMultiple":n} | {"rMultiple":n},
    "trailingStop"?: {"pips":n} | {"atrMultiple":n},
    "timeStop"?: {"bars":n},
    "signal"?: { "long"?: Condition, "short"?: Condition } // closes positions
  },
  "sizing": {"riskPercent": 0.1–5} | {"fixedLots": n},
  "limits"?: { "maxTradesPerDay"?: n, "cooldownBars"?: n }
}

IndicatorDef: {"type":"SMA"|"EMA"|"RSI"|"ATR"|"HIGHEST"|"LOWEST","period":n,"source"?:"open"|"high"|"low"|"close"|"hl2"|"hlc3"|"ohlc4"}
  | {"type":"MACD","fast":n,"slow":n,"signal":n}   // fields: macd, signal, hist
  | {"type":"BBANDS","period":n,"mult":n}          // fields: upper, middle, lower
  | {"type":"STOCH","kPeriod":n,"dPeriod":n}       // fields: k, d
Any indicator may add "timeframe" for a higher frame (no look-ahead; it reads the last CLOSED higher bar).

Condition (operands are indicator names like "fast", multi-output fields like "macd1.hist", price sources like "close", or numbers):
  {"gt":[a,b]} {"gte":[a,b]} {"lt":[a,b]} {"lte":[a,b]}
  {"crossesAbove":[a,b]} {"crossesBelow":[a,b]}
  {"rising":[a,nBars]} {"falling":[a,nBars]}
  {"all":[...]} {"any":[...]} {"not": c}
Two-number crossovers are rejected. Lookbacks max 100 bars. Max 64 condition nodes.

Rules of craft:
- stopLoss is mandatory; prefer riskPercent sizing (0.5–2%) unless the user asks otherwise.
- Fewer tuned numbers = better honesty grade. Do not add filters or indicators the user did not imply.
- If the user's description is ambiguous, choose the most standard reading; never invent extra entry conditions.
- "name" must be a short English label, whatever language the description was written in.

If you receive VALIDATION ERRORS, fix EXACTLY those paths and output the corrected full JSON again.`;

export interface BuilderDeps {
    /** Returns the model's raw text for a message list. */
    complete: (messages: Array<{ role: string; content: string }>) => Promise<string>;
    /** Runs the real backtest tool; returns its JSON result. */
    backtest: (userId: string, spec: StrategySpec, days: number) => Promise<any>;
}

export interface BuildResult {
    ok: boolean;
    attempts: number;
    spec?: StrategySpec;
    /** Deterministic rule sheet rendered from the final JSON. */
    rules?: { en: string[] };
    /** The auto-backtest's summary (includes the honesty grade), or its error. */
    backtest?: any;
    errors?: SpecError[];
    /** Model output that could not even be parsed as JSON, for debugging. */
    unparsed?: string;
}

async function defaultComplete(messages: Array<{ role: string; content: string }>): Promise<string> {
    const config = await loadAIConfig();
    const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    try {
        const completion = await client.chat.completions.create({
            model: config.modelName,
            messages: messages as any,
            temperature: 0.2,
            max_tokens: 900,
        });
        return completion.choices[0]?.message?.content ?? '';
    } catch (primaryError: any) {
        if (!config.fallbackApiKey) throw primaryError;
        const fallback = new OpenAI({ apiKey: config.fallbackApiKey, baseURL: config.fallbackBaseUrl || 'https://api.openai.com/v1' });
        const completion = await fallback.chat.completions.create({
            model: config.fallbackModelName || 'gpt-4o',
            messages: messages as any,
            temperature: 0.2,
            max_tokens: 900,
        });
        return completion.choices[0]?.message?.content ?? '';
    }
}

const defaultBacktest = (userId: string, spec: StrategySpec, days: number) =>
    executeTool(userId, 'run_backtest', JSON.stringify({ spec, days }));

/** Pull the first JSON object out of a model reply (fences and prose tolerated). */
export function extractJson(text: string): any | null {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
        return JSON.parse(candidate.slice(start, end + 1));
    } catch {
        return null;
    }
}

export async function buildBotFromDescription(
    userId: string,
    description: string,
    opts: { days?: number; deps?: Partial<BuilderDeps> } = {}
): Promise<BuildResult> {
    const deps: BuilderDeps = {
        complete: opts.deps?.complete ?? defaultComplete,
        backtest: opts.deps?.backtest ?? defaultBacktest,
    };
    const days = Math.min(120, Math.max(2, Number(opts.days) || DEFAULT_BACKTEST_DAYS));

    const convo: Array<{ role: string; content: string }> = [
        { role: 'system', content: BUILDER_PROMPT },
        { role: 'user', content: description },
    ];

    let lastErrors: SpecError[] = [];
    let lastRaw = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const raw = await deps.complete(convo);
        lastRaw = raw;
        const parsed = extractJson(raw);

        if (!parsed) {
            lastErrors = [{ path: '$', message: 'Output was not a JSON object.' }];
            convo.push({ role: 'assistant', content: raw });
            convo.push({ role: 'user', content: 'VALIDATION ERRORS:\n$ : Output was not a single JSON object. Output ONLY the JSON.' });
            continue;
        }

        const check = validateSpec(parsed);
        if (!check.ok) {
            lastErrors = check.errors;
            convo.push({ role: 'assistant', content: JSON.stringify(parsed) });
            convo.push({
                role: 'user',
                content: 'VALIDATION ERRORS:\n' + check.errors.map(e => `${e.path}: ${e.message}`).join('\n') + '\nFix exactly these and output the corrected full JSON.',
            });
            continue;
        }

        const spec = check.spec!;
        const backtest = await deps.backtest(userId, spec, days);
        return {
            ok: true,
            attempts: attempt,
            spec,
            rules: { en: describeSpec(spec, 'en') },
            backtest,
        };
    }

    return { ok: false, attempts: MAX_ATTEMPTS, errors: lastErrors, unparsed: extractJson(lastRaw) ? undefined : lastRaw.slice(0, 500) };
}
