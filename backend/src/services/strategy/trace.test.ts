/**
 * Learn-mode trace tests.
 *
 * The property that matters most is not the wording — it is that turning
 * tracing on changes nothing. A traced run and an untraced run over the
 * same bars must produce byte-identical decisions, because the moment the
 * explanation comes from a different pass than the decision, learn mode
 * starts teaching things the engine does not do.
 *
 * Run with:  npx ts-node src/services/strategy/trace.test.ts
 */

import { compileStrategy } from './interpreter';
import { Bar, BarContext, BotState, StrategySpec } from './types';
import {
    renderTrace, renderLeaf, traceHeadline, primaryTree, hasExplainableRules,
    TraceLeaf, TraceGroup,
} from './trace';

let passed = 0;
const failures: string[] = [];
function check(name: string, got: unknown, want: unknown, tolerance = 0) {
    let ok: boolean;
    if (typeof got === 'number' && typeof want === 'number') {
        ok = Number.isFinite(got) && Math.abs(got - want) <= tolerance;
    } else {
        ok = got === want;
    }
    if (ok) passed++;
    else failures.push(`${name}\n      got  ${String(got)}\n      want ${String(want)}`);
}
function truthy(name: string, got: boolean) { check(name, got, true); }
function section(t: string) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`); }

const MIN = 60_000;
const T0 = Date.UTC(2026, 0, 5, 8, 0, 0);   // a Monday, inside London

/** Bars whose closes follow `closes`, on the 15m clock. */
const bars = (closes: number[]): Bar[] => closes.map((c, i) => ({
    time: T0 + i * 15 * MIN,
    open: i === 0 ? c : closes[i - 1],
    high: Math.max(c, i === 0 ? c : closes[i - 1]) + 0.0005,
    low: Math.min(c, i === 0 ? c : closes[i - 1]) - 0.0005,
    close: c,
    volume: 100,
}));

const freshState = (): BotState => ({
    dayKey: '', tradesToday: 0, barsInPosition: 0, cooldown: 0,
} as BotState);

const spec: StrategySpec = {
    name: 'RSI dip',
    symbol: 'EUR/USD',
    timeframe: '15m',
    indicators: {
        rsi: { type: 'RSI', period: 14 },
        ema: { type: 'EMA', period: 20 },
    },
    entry: {
        // A dip buy: oversold *and* still under the mean. Both leaves are
        // true together during the slide below, which is what makes this
        // fixture exercise an actual entry.
        long: { all: [{ lt: ['rsi', 30] }, { lt: ['close', 'ema'] }] },
    },
    exit: {
        signal: { long: { gt: ['rsi', 55] } },
        stopLoss: { pips: 20 },
        takeProfit: { pips: 40 },
    },
    sizing: { riskPercent: 1 },
} as StrategySpec;

// A run of 90 closes: a slide down into oversold, then a recovery.
const closes: number[] = [];
for (let i = 0; i < 45; i++) closes.push(1.1000 - i * 0.0004);
for (let i = 0; i < 45; i++) closes.push(closes[44] + i * 0.0006);
const series = bars(closes);

// ── the property that matters ───────────────────────────────────────
section('tracing changes nothing');

/** Feed every bar and collect the decisions, with the same ctx both times. */
function run(trace: boolean) {
    const strat = compileStrategy(spec, { trace });
    let state = freshState();
    const decisions: string[] = [];
    const traces: any[] = [];
    let position: BarContext['position'] = null;

    for (const bar of series) {
        const ctx: BarContext = { position, spreadPips: 0.2 } as BarContext;
        const out = strat.onBar('15m', bar, state, ctx);
        state = out.state;
        // A crude position model, identical in both runs: the point is that
        // both runs see the same inputs, not that fills are realistic.
        if (out.decision.enter) position = { side: out.decision.enter.side, entryPrice: bar.close } as any;
        else if (out.decision.exit) position = null;

        decisions.push(JSON.stringify(out.decision));
        traces.push(strat.lastTrace());
    }
    return { decisions, traces, strat };
}

const plain = run(false);
const traced = run(true);

check('same number of bars', plain.decisions.length, traced.decisions.length);
check('every decision is identical', traced.decisions.join('|'), plain.decisions.join('|'));
truthy('and the run actually did something',
    plain.decisions.some(d => d !== '{}'));
check('an untraced strategy has no trace', plain.traces.filter(Boolean).length, 0);
check('a traced one has a trace per bar', traced.traces.filter(Boolean).length, series.length);

// ── what a trace contains ───────────────────────────────────────────
section('a trace shows the arithmetic, not a verdict');

const entryIdx = traced.decisions.findIndex(d => d.includes('enter'));
truthy('the run produced an entry', entryIdx >= 0);
const entryTrace = traced.traces[entryIdx];
check('the entry bar is marked as such', entryTrace.outcome, 'ENTER_LONG');
check('and it was not in a position', entryTrace.inPosition, false);
truthy('the long tree is present', !!entryTrace.long);
check('and it passed', entryTrace.long.passed, true);

// The spec's long side is all[ rsi < 30, close > ema ] — two leaves.
const group = entryTrace.long as TraceGroup;
check('it is an "all" group', group.kind, 'all');
check('with two children', group.children.length, 2);
const leaves = group.children.filter((c: any) => c.node === 'leaf') as TraceLeaf[];
check('both children are leaves', leaves.length, 2);
truthy('the RSI leaf names the indicator with its period', leaves[0].left.label === 'RSI(14)');
check('and compares against the literal level', leaves[0].right.label, '30');
truthy('with a real reading, not a placeholder', Number.isFinite(leaves[0].left.value));
truthy('that actually satisfies the condition', leaves[0].left.value < 30);
check('the leaf knows it passed', leaves[0].passed, true);
truthy('the second leaf is close vs the EMA', leaves[1].right.label === 'EMA(20)');

// ── the exit side ───────────────────────────────────────────────────
section('the exit side');

const exitIdx = traced.decisions.findIndex(d => d.includes('exit'));
truthy('the run produced an exit', exitIdx >= 0);
const exitTrace = traced.traces[exitIdx];
truthy('the exit bar was in a position', exitTrace.inPosition);
truthy('with an exit tree', !!exitTrace.exit);
check('which passed', exitTrace.exit.passed, true);
check('and the outcome names the signal', exitTrace.outcome, 'EXIT_SIGNAL');
// While holding, entries are never even tested.
const holdIdx = traced.traces.findIndex((t: any, i: number) => t.inPosition && traced.decisions[i] === '{}');
truthy('there was a holding bar', holdIdx >= 0);
check('a holding bar has no entry trees', !!traced.traces[holdIdx].long, false);
truthy('and says it is holding',
    traceHeadline(traced.traces[holdIdx]).includes('no exit condition was met'));

// ── a bar the rules never saw ───────────────────────────────────────
section('a blocked bar must not be reported as a failed rule');

// The same spec with a Tokyo-session filter; the bars are all in London,
// so every bar is blocked before any condition is tested.
const filtered = compileStrategy({ ...spec, filters: [{ session: 'tokyo' }] } as StrategySpec, { trace: true });
let fState = freshState();
for (const bar of series.slice(0, 40)) {
    const out = filtered.onBar('15m', bar, fState, { position: null, spreadPips: 0.2 } as BarContext);
    fState = out.state;
}
const blocked = filtered.lastTrace()!;
check('the bar is marked blocked', blocked.blockedBy, 'filter');
check('no entry tree was built', !!blocked.long, false);
truthy('and the headline says it was never checked',
    traceHeadline(blocked).includes('never checked'));
truthy('naming the filter, not the rules',
    traceHeadline(blocked).includes('a filter blocked it'));

// ── short-circuiting is preserved ───────────────────────────────────
section('the trace shows what the engine looked at, not more');

// `all` stops at the first false child, so a failing first leaf means the
// second was never evaluated and must not appear.
const shortCircuit = compileStrategy({
    ...spec,
    entry: { long: { all: [{ gt: ['rsi', 99] }, { lt: ['close', 'ema'] }] } },
} as StrategySpec, { trace: true });
let sState = freshState();
for (const bar of series.slice(0, 40)) {
    const out = shortCircuit.onBar('15m', bar, sState, { position: null, spreadPips: 0.2 } as BarContext);
    sState = out.state;
}
const sc = shortCircuit.lastTrace()!;
const scGroup = sc.long as TraceGroup;
check('the group failed', scGroup.passed, false);
check('and only the child that was tested is recorded', scGroup.children.length, 1);
check('which is the one that failed', (scGroup.children[0] as TraceLeaf).right.label, '99');

// `any` stops at the first true child, symmetrically.
const anyStop = compileStrategy({
    ...spec,
    entry: { long: { any: [{ lt: ['rsi', 99] }, { lt: ['close', 'ema'] }] } },
} as StrategySpec, { trace: true });
let aState = freshState();
for (const bar of series.slice(0, 40)) {
    const out = anyStop.onBar('15m', bar, aState, { position: null, spreadPips: 0.2 } as BarContext);
    aState = out.state;
}
const anyGroup = anyStop.lastTrace()!.long as TraceGroup;
check('an "any" that hit on the first child records one', anyGroup.children.length, 1);
check('and passed', anyGroup.passed, true);

// ── rendering ───────────────────────────────────────────────────────
section('rendering: the numbers are in the sentence');

const lines = renderTrace(entryTrace.long, 'fa');
truthy('the group header is a line', lines[0].group);
truthy('and says all of these', lines[0].text.includes('همه‌ی این‌ها'));
check('with the leaves indented under it', lines[1].depth, 1);
truthy('the RSI line carries its reading', /RSI\(14\) = \d/.test(lines[1].text));
truthy('and the comparison word', lines[1].text.includes('کمتر از'));
truthy('and the level', lines[1].text.includes('30'));
check('every line knows whether it passed', lines.every(l => typeof l.passed === 'boolean'), true);

// A single-child `all` is spec structure, not information for a reader.
const oneChild = renderTrace({
    node: 'group', kind: 'all', passed: true,
    children: [{ node: 'leaf', kind: 'lt', passed: true,
        left: { label: 'RSI(14)', value: 25 }, right: { label: '30', value: 30 } }],
} as TraceGroup, 'fa');
check('a one-child group is flattened away', oneChild.length, 1);
check('leaving the leaf at depth 0', oneChild[0].depth, 0);

// Crosses read as crosses, with the bar that made them one.
const crossLine = renderLeaf({
    node: 'leaf', kind: 'crossesAbove', passed: true,
    left: { label: 'EMA(9)', value: 1.1042 }, right: { label: 'EMA(21)', value: 1.1039 },
    prev: { left: 1.1035, right: 1.1038 },
} as TraceLeaf, 'fa');
truthy('a cross names the direction', crossLine.includes('از پایین رد کرد'));
truthy('and shows the previous bar, which is what makes it a cross',
    crossLine.includes('کندل قبل'));
truthy('with both previous readings', crossLine.includes('1.1035') && crossLine.includes('1.1038'));

const risingLine = renderLeaf({
    node: 'leaf', kind: 'rising', passed: true,
    left: { label: 'EMA(50)', value: 1.1060 }, right: { label: 'EMA(50)', value: 1.1020 },
    bars: 5,
} as TraceLeaf, 'fa');
truthy('rising names the window', risingLine.includes('5 کندل'));
truthy('and shows the move', risingLine.includes('1.102') && risingLine.includes('1.106'));

// A literal operand should not be printed as "30 = 30".
const literal = renderLeaf({
    node: 'leaf', kind: 'lt', passed: true,
    left: { label: 'RSI(14)', value: 28.4 }, right: { label: '30', value: 30 },
} as TraceLeaf, 'fa');
check('a literal level is written once', literal, 'RSI(14) = 28.4 کمتر از 30');

// Warm-up values are not invented.
const warm = renderLeaf({
    node: 'leaf', kind: 'lt', passed: false,
    left: { label: 'RSI(14)', value: NaN }, right: { label: '30', value: 30 },
} as TraceLeaf, 'fa');
truthy('an unavailable reading shows as a dash, not as 0', warm.includes('—'));

check('an empty trace renders nothing', renderTrace(undefined, 'fa').length, 0);

// ── which tree to show ──────────────────────────────────────────────
section('which tree the reader should look at');

check('on an entry bar, the side that fired', primaryTree(entryTrace).titleFa, 'شرط ورود خرید');
check('in a position, the exit', primaryTree(exitTrace).titleFa, 'شرط خروج');
// Flat and waiting: the side that got closer is the one worth studying.
const waitIdx = traced.traces.findIndex((t: any, i: number) =>
    !t.inPosition && !t.blockedBy && traced.decisions[i] === '{}' && t.long);
truthy('there was a flat waiting bar', waitIdx >= 0);
truthy('and a tree is offered for it', !!primaryTree(traced.traces[waitIdx]).node);

check('a spec with rules is explainable', hasExplainableRules(spec), true);
check('one with none is not',
    hasExplainableRules({ ...spec, entry: {}, exit: { stopLoss: { pips: 10 } } } as unknown as StrategySpec), false);

// ── english mirror ──────────────────────────────────────────────────
section('english');

const en = renderTrace(entryTrace.long, 'en');
truthy('renders in english too', en[0].text.includes('all of'));
truthy('with the same numbers', /RSI\(14\) = \d/.test(en[1].text));
truthy('and the english comparison', en[1].text.includes('less than'));

// ── report ──────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
if (failures.length) {
    console.log(`❌ ${failures.length} failed, ${passed} passed\n`);
    failures.forEach(f => console.log(`  ✗ ${f}\n`));
    process.exit(1);
}
console.log(`✅ all ${passed} assertions passed`);
