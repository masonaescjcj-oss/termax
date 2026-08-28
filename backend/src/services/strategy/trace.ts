/**
 * DECISION TRACE — why the strategy did what it did on this bar.
 *
 * Learn mode's whole value is that the explanation cannot drift from the
 * decision. So there is no second evaluator here: the interpreter's own
 * `evaluate` records a node as it tests each condition, and this file
 * only defines the shape of those nodes and turns them into sentences.
 * An explanation produced by re-deriving the logic would eventually
 * disagree with the engine, and a confident wrong explanation is worse
 * for a learner than none at all.
 *
 * Every leaf carries the operand values it compared, so the reader sees
 * the arithmetic rather than a verdict: «RSI(14) = 28.4 < 30 ✓».
 */

import { Condition, StrategySpec } from './types';
import { Lang } from './describe';

export type LeafKind =
    | 'gt' | 'gte' | 'lt' | 'lte'
    | 'crossesAbove' | 'crossesBelow'
    | 'rising' | 'falling'
    | 'unknown';

export interface TraceLeaf {
    node: 'leaf';
    kind: LeafKind;
    passed: boolean;
    /** Operand labels and the values actually compared on this bar. */
    left: { label: string; value: number };
    right: { label: string; value: number };
    /**
     * For crossesAbove/Below and rising/falling: the previous reading, which
     * is what makes a cross a cross rather than a level.
     */
    prev?: { left: number; right: number };
    /** Bars back, for rising/falling. */
    bars?: number;
}

export interface TraceGroup {
    node: 'group';
    kind: 'all' | 'any' | 'not';
    passed: boolean;
    children: TraceNode[];
}

export type TraceNode = TraceLeaf | TraceGroup;

/** Everything the interpreter can explain about one bar. */
export interface BarTrace {
    /** Bar open time, so the client can align it to the candle. */
    time: number;
    /** In a position on this bar? Entries are not even tested if so. */
    inPosition: boolean;
    /** Set when a filter (session, hours, spread…) blocked the bar. */
    blockedBy?: 'filter' | 'cooldown' | 'maxTradesPerDay';
    long?: TraceNode;
    short?: TraceNode;
    exit?: TraceNode;
    /** What the engine actually did — the decision this trace explains. */
    outcome: 'ENTER_LONG' | 'ENTER_SHORT' | 'EXIT_SIGNAL' | 'EXIT_TIME_STOP' | 'WAIT';
}

const num = (v: number): string => {
    if (!Number.isFinite(v)) return '—';
    const a = Math.abs(v);
    // Prices need their decimals; indicator readings and levels do not need
    // five of them.
    const digits = a >= 1000 ? 2 : a >= 10 ? 2 : a >= 1 ? 4 : 5;
    return Number(v.toFixed(digits)).toString();
};

const OP_FA: Record<string, string> = {
    gt: 'بیشتر از', gte: 'بیشتر یا مساوی', lt: 'کمتر از', lte: 'کمتر یا مساوی',
};
const OP_EN: Record<string, string> = {
    gt: 'greater than', gte: 'at least', lt: 'less than', lte: 'at most',
};

/** One leaf as a sentence with its arithmetic shown. */
export function renderLeaf(leaf: TraceLeaf, lang: Lang = 'fa'): string {
    const fa = lang === 'fa';
    const L = `${leaf.left.label} = ${num(leaf.left.value)}`;
    const R = leaf.right.label === String(leaf.right.value)
        // A literal level needs no "= 30" after it.
        ? leaf.right.label
        : `${leaf.right.label} = ${num(leaf.right.value)}`;

    switch (leaf.kind) {
        case 'gt': case 'gte': case 'lt': case 'lte':
            return fa ? `${L} ${OP_FA[leaf.kind]} ${R}` : `${L} ${OP_EN[leaf.kind]} ${R}`;

        case 'crossesAbove': case 'crossesBelow': {
            const dirFa = leaf.kind === 'crossesAbove' ? 'از پایین رد کرد' : 'از بالا رد کرد';
            const dirEn = leaf.kind === 'crossesAbove' ? 'crossed above' : 'crossed below';
            const before = leaf.prev
                ? (fa ? ` (کندل قبل: ${num(leaf.prev.left)} در برابر ${num(leaf.prev.right)})`
                      : ` (previous bar: ${num(leaf.prev.left)} vs ${num(leaf.prev.right)})`)
                : '';
            return fa ? `${leaf.left.label} ${dirFa} ${R}${before}`
                      : `${leaf.left.label} ${dirEn} ${R}${before}`;
        }

        case 'rising': case 'falling': {
            const dirFa = leaf.kind === 'rising' ? 'صعودی' : 'نزولی';
            const dirEn = leaf.kind === 'rising' ? 'rising' : 'falling';
            const n = leaf.bars ?? 1;
            return fa
                ? `${leaf.left.label} در ${n} کندل ${dirFa} است (${num(leaf.right.value)} → ${num(leaf.left.value)})`
                : `${leaf.left.label} ${dirEn} over ${n} bars (${num(leaf.right.value)} → ${num(leaf.left.value)})`;
        }

        default:
            return fa ? 'شرط ناشناخته' : 'unknown condition';
    }
}

export interface RenderedLine {
    /** Nesting depth, so the client can indent. */
    depth: number;
    text: string;
    passed: boolean;
    /** A group header rather than a comparison. */
    group: boolean;
}

/**
 * Flatten a trace into indented lines. Groups keep their header so the
 * reader can see whether they were looking at "all of these" or "any of
 * these" — a condition that failed inside an `any` is not a reason the
 * trade was skipped, and hiding the structure would imply it was.
 */
export function renderTrace(node: TraceNode | undefined, lang: Lang = 'fa', depth = 0): RenderedLine[] {
    if (!node) return [];
    const fa = lang === 'fa';

    if (node.node === 'leaf') {
        return [{ depth, text: renderLeaf(node, lang), passed: node.passed, group: false }];
    }

    const header = node.kind === 'all' ? (fa ? 'همه‌ی این‌ها:' : 'all of:')
        : node.kind === 'any' ? (fa ? 'دست‌کم یکی از این‌ها:' : 'any of:')
        : (fa ? 'این نباشد:' : 'not:');

    // A single-child `all` is structure the spec author wrote, not
    // information for the reader; skip the header and keep the child.
    if (node.kind === 'all' && node.children.length === 1) {
        return renderTrace(node.children[0], lang, depth);
    }

    return [
        { depth, text: header, passed: node.passed, group: true },
        ...node.children.flatMap(c => renderTrace(c, lang, depth + 1)),
    ];
}

const OUTCOME_FA: Record<BarTrace['outcome'], string> = {
    ENTER_LONG: 'ورود خرید',
    ENTER_SHORT: 'ورود فروش',
    EXIT_SIGNAL: 'خروج با سیگنال',
    EXIT_TIME_STOP: 'خروج با حد زمان',
    WAIT: 'صبر',
};
const BLOCK_FA: Record<string, string> = {
    filter: 'فیلترها اجازه ندادند (سشن، ساعت یا اسپرد)',
    cooldown: 'دوره‌ی استراحت بعد از معامله‌ی قبل',
    maxTradesPerDay: 'سقف تعداد معامله‌ی امروز پر شده بود',
};

/**
 * The headline for one bar: what happened, and the shortest true reason.
 *
 * When a filter blocked the bar the conditions were never tested, and
 * saying "the rules did not fire" would be a lie — the rules were not
 * asked. That distinction is the thing a learner most needs.
 */
export function traceHeadline(trace: BarTrace, lang: Lang = 'fa'): string {
    const fa = lang === 'fa';
    if (!fa) {
        if (trace.blockedBy) return `Not tested — ${trace.blockedBy}`;
        if (trace.inPosition) return trace.outcome === 'WAIT' ? 'In a position, holding' : `In a position — ${trace.outcome}`;
        return trace.outcome === 'WAIT' ? 'Flat, no entry condition met' : trace.outcome;
    }

    if (trace.blockedBy) {
        return `این کندل اصلاً بررسی نشد — ${BLOCK_FA[trace.blockedBy] ?? trace.blockedBy}`;
    }
    if (trace.inPosition) {
        return trace.outcome === 'WAIT'
            ? 'پوزیشن باز است؛ شرط خروجی برقرار نشد، پس نگه داشته شد'
            : OUTCOME_FA[trace.outcome];
    }
    if (trace.outcome === 'WAIT') {
        const both = trace.long?.passed && trace.short?.passed;
        return both
            // Both sides true is a contradiction the engine refuses to
            // resolve by guessing; the learner should know that is why.
            ? 'هم شرط خرید و هم شرط فروش برقرار بود — موتور در تضاد وارد نمی‌شود'
            : 'بدون پوزیشن؛ هیچ‌کدام از شرط‌های ورود کامل نشد';
    }
    return OUTCOME_FA[trace.outcome];
}

/** Which condition tree the reader should look at first on this bar. */
export function primaryTree(trace: BarTrace): { node?: TraceNode; titleFa: string } {
    if (trace.inPosition) return { node: trace.exit, titleFa: 'شرط خروج' };
    if (trace.outcome === 'ENTER_SHORT') return { node: trace.short, titleFa: 'شرط ورود فروش' };
    if (trace.outcome === 'ENTER_LONG') return { node: trace.long, titleFa: 'شرط ورود خرید' };
    // Flat and waiting: show whichever side got closer to firing, since
    // that is the one worth studying.
    const score = (n?: TraceNode): number => {
        if (!n) return -1;
        if (n.node === 'leaf') return n.passed ? 1 : 0;
        const kids = n.children.map(score);
        return kids.length ? kids.reduce((a, b) => a + b, 0) / kids.length : 0;
    };
    return score(trace.long) >= score(trace.short)
        ? { node: trace.long, titleFa: 'شرط ورود خرید' }
        : { node: trace.short, titleFa: 'شرط ورود فروش' };
}

/** Shape guard for a spec that has anything to explain at all. */
export function hasExplainableRules(spec: StrategySpec): boolean {
    const any = (c?: Condition) => !!c;
    return any(spec.entry?.long) || any(spec.entry?.short)
        || any(spec.exit?.signal?.long) || any(spec.exit?.signal?.short);
}
