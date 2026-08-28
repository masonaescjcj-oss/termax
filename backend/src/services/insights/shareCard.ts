/**
 * SHARE CARD — a day, a trade or a month as one image worth sending.
 *
 * The card is built here as a self-contained SVG and rasterised in the
 * client. That split is deliberate: rendering PNGs server-side would mean
 * a headless browser, or librsvg plus a Persian font and RTL shaping
 * installed on the box — a heavy dependency and a fragile one, since a
 * missing font silently produces a card full of empty rectangles. The
 * client already has a text engine that shapes Persian correctly, so the
 * server sends geometry and the client paints it.
 *
 * Two rules the card must never break:
 *
 *  1. **It cannot flatter.** A shared card is marketing whether we mean it
 *     to be or not, so every rate carries its sample: a win rate is never
 *     shown without the trade count and the period it covers. No
 *     projection, no annualised anything, no "could have made".
 *  2. **It cannot leak.** Money figures can be hidden (pips and percent
 *     survive), and the trader's private note is left out unless it is
 *     explicitly asked for. Every string that reaches the SVG is
 *     XML-escaped, because a card is a document that leaves the device.
 */

import { faDigits } from './jalali';

export type CardKind = 'day' | 'trade' | 'month';
export type CardTheme = 'dark' | 'light';

export interface CardOptions {
    /** Replace every money figure with pips/percent. Default false. */
    hideMoney?: boolean;
    /** Include the trader's own note. Default false — it is private. */
    includeNote?: boolean;
    theme?: CardTheme;
}

export const CARD_W = 1080;
export const CARD_H = 1350;

// ── text plumbing ───────────────────────────────────────────────────

/**
 * Escape for XML text content. `&` and `<` alone would be enough for
 * well-formedness, but a card can be saved and reopened as an .svg — a
 * document format that executes script — so quotes and `>` go too, and no
 * tag we emit ever takes markup from the caller.
 */
export function escapeXml(s: string): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        // Control characters are illegal in XML 1.0: they would make the
        // whole document unparseable rather than merely ugly.
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/**
 * Approximate advance width. There are no text metrics on the server, and
 * the alternative — shipping a font and measuring against it — costs more
 * than a wrapping estimate that is a few percent off. Biased slightly
 * wide on purpose, so a line breaks early rather than overflowing.
 */
export function estimateWidth(text: string, fontSize: number): number {
    let units = 0;
    for (const ch of String(text ?? '')) {
        const code = ch.codePointAt(0)!;
        if (ch === ' ') units += 0.30;
        else if (code === 0x200C) units += 0.02;                     // ZWNJ
        else if (code >= 0x06F0 && code <= 0x06F9) units += 0.58;    // Persian digits
        else if (code >= 0x0600 && code <= 0x06FF) units += 0.54;    // Arabic/Persian
        else if (ch >= '0' && ch <= '9') units += 0.56;
        else if (ch >= 'A' && ch <= 'Z') units += 0.64;
        else if (ch >= 'a' && ch <= 'z') units += 0.53;
        else units += 0.34;
    }
    return units * fontSize;
}

/**
 * Break a sentence into lines that fit `maxWidth`. SVG text does not
 * wrap, so the lines have to exist before the document does. A token too
 * long for one line is hard-split rather than left to run off the edge,
 * and past `maxLines` the text is elided — a card that overflows is worse
 * than one that says less.
 */
export function wrapText(text: string, fontSize: number, maxWidth: number, maxLines = 5): string[] {
    const words = String(text ?? '').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';

    const push = () => { if (line) { lines.push(line); line = ''; } };

    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (estimateWidth(candidate, fontSize) <= maxWidth) { line = candidate; continue; }
        push();
        if (estimateWidth(word, fontSize) <= maxWidth) { line = word; continue; }
        let chunk = '';
        for (const ch of word) {
            if (chunk && estimateWidth(chunk + ch, fontSize) > maxWidth) { lines.push(chunk); chunk = ch; }
            else chunk += ch;
        }
        line = chunk;
    }
    push();

    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    // The ellipsis has width of its own: trim characters off the last
    // line until the line *plus* the ellipsis fits, otherwise eliding is
    // what pushes the text off the card.
    let last = kept[maxLines - 1].replace(/[،.؛]$/, '');
    while (last.length > 1 && estimateWidth(`${last}…`, fontSize) > maxWidth) {
        last = last.slice(0, -1);
    }
    kept[maxLines - 1] = `${last}…`;
    return kept;
}

/**
 * Drop any clause that names a money amount.
 *
 * The recap and the entry arrive as finished Persian sentences with the
 * figures already in them, so `hideMoney` cannot be honoured by simply
 * not printing the headline — the amount would walk back in through the
 * prose. Whole clauses go rather than the numbers inside them: a sentence
 * with a hole punched in it reads like a redacted document and invites
 * the reader to guess, while a shorter sentence just says less.
 */
export function redactMoney(text: string): string {
    const MONEY = /[$€£]\s?\d|\d\s?[$€£]/;
    const kept = String(text ?? '')
        .split(/(?<=[.؛])\s+/)
        .filter(clause => !MONEY.test(clause));
    return kept.join(' ').trim();
}

// ── palette ─────────────────────────────────────────────────────────

interface Palette {
    bg: string; bgTo: string; panel: string; stroke: string;
    text: string; dim: string; up: string; down: string;
    brand: string; amber: string;
}

const PALETTES: Record<CardTheme, Palette> = {
    dark: {
        bg: '#0B0E13', bgTo: '#151A24', panel: 'rgba(255,255,255,0.045)',
        stroke: 'rgba(255,255,255,0.10)', text: '#F2F4F8', dim: '#8B93A7',
        up: '#12C296', down: '#F5455C', brand: '#4C82FF', amber: '#F5A623',
    },
    light: {
        bg: '#FFFFFF', bgTo: '#EDF1F7', panel: 'rgba(15,23,42,0.035)',
        stroke: 'rgba(15,23,42,0.10)', text: '#0F172A', dim: '#5A6478',
        up: '#059669', down: '#DC2626', brand: '#2563EB', amber: '#D97706',
    },
};

const FONT = "Vazirmatn, 'Noto Sans Arabic', Tahoma, 'Segoe UI', system-ui, sans-serif";

/**
 * Wrap a number in a bidi isolate so it keeps its own direction inside a
 * Persian phrase. Without it the run "−641.0 پیپ" is reordered by the
 * bidi algorithm into "پیپ −641.0" — the unit jumps in front of its own
 * number. `num()` is for a number standing alone; this is for one that
 * has a Persian word attached.
 */
const iso = (s: string) => `\u2066${s}\u2069`;

/** A true minus sign, not a hyphen: it lines up with the digits. */
const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`;
const signed = (n: number, digits = 1) =>
    `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;

/** A left-aligned line; `x` is the left edge. */
function line(text: string, x: number, y: number, size: number, fill: string, weight = '400'): string {
    return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" `
        + `fill="${fill}" direction="ltr" text-anchor="start" `
        + `xml:space="preserve">${escapeXml(text)}</text>`;
}

/** A right-aligned line; `x` is the right edge. */
function right(text: string, x: number, y: number, size: number, fill: string, weight = '400'): string {
    return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" `
        + `fill="${fill}" direction="ltr" text-anchor="end" `
        + `xml:space="preserve">${escapeXml(text)}</text>`;
}

/**
 * A centred number. Signed and currency strings must be laid out LTR even
 * on an RTL card: in a right-to-left run the bidi algorithm moves a
 * leading sign to the visual end, turning "−$100.05" into "$100.05−".
 */
function num(text: string, x: number, y: number, size: number, fill: string, weight = '400'): string {
    return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" `
        + `fill="${fill}" direction="ltr" text-anchor="middle">${escapeXml(text)}</text>`;
}

/** A left-aligned LTR line, for the wordmark and the URL. */
function ltr(text: string, x: number, y: number, size: number, fill: string, weight = '400', spacing = 0): string {
    return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" `
        + `fill="${fill}" letter-spacing="${spacing}" direction="ltr" text-anchor="start">${escapeXml(text)}</text>`;
}

function centred(text: string, x: number, y: number, size: number, fill: string, weight = '400'): string {
    return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" `
        + `fill="${fill}" direction="ltr" text-anchor="middle">${escapeXml(text)}</text>`;
}

function panel(x: number, y: number, w: number, h: number, p: Palette, r = 28): string {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${p.panel}" `
        + `stroke="${p.stroke}" stroke-width="1.5"/>`;
}

/** A tag pill anchored at its left edge. Returns svg and width. */
function pill(label: string, leftX: number, y: number, colour: string): { svg: string; width: number } {
    const size = 26;
    const w = estimateWidth(label, size) + 46;
    const x = leftX;
    return {
        svg: `<rect x="${x}" y="${y}" width="${w}" height="52" rx="26" fill="none" stroke="${colour}" `
            + `stroke-width="2" stroke-opacity="0.75"/>`
            + `<text x="${x + w / 2}" y="${y + 35}" font-family="${FONT}" font-size="${size}" fill="${colour}" `
            + `direction="ltr" text-anchor="middle">${escapeXml(label)}</text>`,
        width: w,
    };
}

/**
 * One row of pills, left to right. Pills that would cross the right
 * margin are dropped rather than wrapped: the card's height is fixed, so
 * a second row would push the footer off the image.
 */
function pillRow(labels: Array<{ text: string; colour: string }>, leftX: number, rightX: number, y: number): string {
    let cursor = leftX;
    const out: string[] = [];
    for (const l of labels) {
        const made = pill(l.text, cursor, y, l.colour);
        if (cursor + made.width > rightX) break;
        out.push(made.svg);
        cursor += made.width + 14;
    }
    return out.join('');
}

/** The frame every card shares: background, wordmark, footer. */
function shell(p: Palette, body: string, footerNote: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">`
        + `<defs><linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">`
        + `<stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="${p.bgTo}"/></linearGradient></defs>`
        + `<rect width="${CARD_W}" height="${CARD_H}" fill="url(#bg)"/>`
        + `<rect x="0" y="0" width="${CARD_W}" height="8" fill="${p.brand}"/>`
        + ltr('TERMAX', 72, 108, 40, p.text, '800', 6)
        + right('TRADING JOURNAL', CARD_W - 72, 108, 32, p.dim)
        + body
        + `<line x1="72" y1="${CARD_H - 132}" x2="${CARD_W - 72}" y2="${CARD_H - 132}" stroke="${p.stroke}" stroke-width="1.5"/>`
        + ltr('termax.app', 72, CARD_H - 72, 28, p.dim)
        + right(footerNote, CARD_W - 72, CARD_H - 72, 26, p.dim)
        + `</svg>`;
}

// ── inputs ──────────────────────────────────────────────────────────

export interface DayCardInput {
    kind: 'day';
    label: string;
    netProfit: number;
    trades: number;
    wins: number;
    /** Signed pip total, so the money-hidden card still has a headline. */
    pips: number;
    recap: string;
    tags: Array<{ fa: string; tone: string }>;
    clean: boolean;
    /** The day's trades, newest last. As many as fit are listed. */
    rows?: Array<{ symbol: string; side: 'BUY' | 'SELL'; volume: number; netProfit: number; pips: number }>;
}

export interface TradeCardInput {
    kind: 'trade';
    symbol: string;
    side: 'BUY' | 'SELL';
    volume: number;
    netProfit: number;
    pips: number;
    entry: string;
    label: string;
    tags: Array<{ fa: string; tone: string }>;
    spark?: { values: number[]; entryAt: number; exitAt: number } | null;
    note?: string | null;
}

export interface MonthCardInput {
    kind: 'month';
    monthLabel: string;
    netProfit: number;
    trades: number;
    winRate: number;
    tradingDays: number;
    cleanDays: number;
    streak: number;
    firstWeekday: number;
    weekdayLabels: string[];
    days: Array<{ label: string; trades: number; netProfit: number; intensity: number; clean: boolean }>;
}

export type CardInput = DayCardInput | TradeCardInput | MonthCardInput;

const toneColour = (tone: string, p: Palette) =>
    tone === 'risk' ? p.down : tone === 'good' ? p.up : p.dim;

/** Stat cells across the card, read right to left. */
function statRow(cells: Array<{ label: string; value: string; colour?: string }>, y: number, p: Palette): string {
    const out: string[] = [panel(72, y, CARD_W - 144, 150, p)];
    const slot = (CARD_W - 144) / cells.length;
    cells.forEach((c, i) => {
        const cx = 72 + slot * (i + 0.5);
        out.push(centred(c.label, cx, y + 52, 28, p.dim));
        out.push(num(c.value, cx, y + 112, 46, c.colour ?? p.text, '700'));
        if (i < cells.length - 1) {
            const lx = 72 + slot * (i + 1);
            out.push(`<line x1="${lx}" y1="${y + 30}" x2="${lx}" y2="${y + 120}" stroke="${p.stroke}" stroke-width="1.5"/>`);
        }
    });
    return out.join('');
}

function sparkPath(
    spark: { values: number[]; entryAt: number; exitAt: number },
    x: number, y: number, w: number, h: number, colour: string, p: Palette
): string {
    const v = spark.values;
    if (!v || v.length < 2) return '';
    const min = Math.min(...v), max = Math.max(...v), span = (max - min) || 1;
    const px = (i: number) => x + (i / (v.length - 1)) * w;
    const py = (val: number) => y + (1 - (val - min) / span) * h;
    const pts = v.map((val, i) => `${px(i).toFixed(1)},${py(val).toFixed(1)}`).join(' ');

    const out = [
        `<polyline points="${pts}" fill="none" stroke="${colour}" stroke-width="5" `
        + `stroke-linejoin="round" stroke-linecap="round"/>`,
    ];
    if (spark.entryAt >= 0 && spark.entryAt < v.length) {
        out.push(`<line x1="${px(spark.entryAt)}" y1="${y}" x2="${px(spark.entryAt)}" y2="${y + h}" `
            + `stroke="${p.dim}" stroke-width="2" stroke-dasharray="8,8" stroke-opacity="0.5"/>`);
        out.push(`<circle cx="${px(spark.entryAt)}" cy="${py(v[spark.entryAt])}" r="12" fill="${colour}"/>`);
    }
    if (spark.exitAt >= 0 && spark.exitAt < v.length) {
        out.push(`<circle cx="${px(spark.exitAt)}" cy="${py(v[spark.exitAt])}" r="12" `
            + `fill="${p.bg}" stroke="${colour}" stroke-width="5"/>`);
    }
    return out.join('');
}

// ── the cards ───────────────────────────────────────────────────────

function dayCard(d: DayCardInput, o: CardOptions, p: Palette): string {
    const hide = !!o.hideMoney;
    const heroColour = d.netProfit >= 0 ? p.up : p.down;
    const hero = hide ? `${signed(d.pips)} pips` : money(d.netProfit);
    const winRate = d.trades ? Number(((d.wins / d.trades) * 100).toFixed(1)) : 0;

    const body: string[] = [
        line(d.label, 72, 220, 46, p.text, '700'),
        // Money stands alone (LTR); a pip total carries a Persian unit and
        // therefore needs the RTL base with the number isolated.
        hide ? centred(hero, CARD_W / 2, 360, 108, heroColour, '800')
             : num(hero, CARD_W / 2, 360, 124, heroColour, '800'),
        centred(hide ? 'PIPS FOR THE DAY' : 'PROFIT / LOSS', CARD_W / 2, 412, 30, p.dim),
        statRow([
            { label: 'TRADES', value: String(d.trades) },
            { label: 'WINNERS', value: String(d.wins) },
            { label: 'WIN RATE', value: `${winRate}%` },
        ], 440, p),
    ];

    const recap = hide ? redactMoney(d.recap) : d.recap;
    const lines = wrapText(recap, 34, CARD_W - 200, 3);
    const recapTop = 620;
    body.push(panel(72, recapTop, CARD_W - 144, 60 + lines.length * 54, p));
    lines.forEach((l, i) => body.push(line(l, 112, recapTop + 60 + i * 54, 34, p.text)));

    const chipsY = recapTop + 60 + lines.length * 54 + 40;
    body.push(pillRow(d.tags.map(t => ({ text: t.fa, colour: toneColour(t.tone, p) })), 72, CARD_W - 72, chipsY));

    const y = chipsY + 92;

    // The badge and the trade list are alternatives, not a stack: both
    // together do not fit under a three-line recap, and on a clean day
    // the badge *is* the story. Otherwise the day's own trades fill the
    // space — real rows rather than padding.
    const BOTTOM = CARD_H - 165;
    const ROW_H = 58;
    const rows = d.clean ? [] : (d.rows ?? []);
    const fits = Math.max(0, Math.floor((BOTTOM - y - 56) / ROW_H));
    const shown = rows.slice(0, Math.min(fits, 5));

    if (d.clean) {
        body.push(`<rect x="72" y="${y}" width="${CARD_W - 144}" height="86" rx="24" `
            + `fill="none" stroke="${p.up}" stroke-width="2.5" stroke-opacity="0.55"/>`);
        body.push(centred('A disciplined day — every trade stopped, no revenge, no oversizing',
            CARD_W / 2, y + 54, 27, p.up));
    } else if (shown.length) {
        body.push(panel(72, y, CARD_W - 144, 46 + shown.length * ROW_H
            + (rows.length > shown.length ? 40 : 0), p));
        shown.forEach((r, i) => {
            const ry = y + 46 + i * ROW_H;
            const good = r.netProfit >= 0;
            const colour = good ? p.up : p.down;
            body.push(line(`${r.side} ${r.volume} ${r.symbol}`, 112, ry, 30, p.text));
            body.push(right(hide ? `${signed(r.pips)}p` : money(r.netProfit),
                CARD_W - 112, ry, 30, colour, '700'));
            if (i < shown.length - 1) {
                body.push(`<line x1="112" y1="${ry + 18}" x2="${CARD_W - 112}" y2="${ry + 18}" `
                    + `stroke="${p.stroke}" stroke-width="1"/>`);
            }
        });
        if (rows.length > shown.length) {
            body.push(centred(`and ${rows.length - shown.length} more`,
                CARD_W / 2, y + 46 + shown.length * ROW_H + 24, 26, p.dim));
        }
    }

    return shell(p, body.join(''), `${d.trades} trade${d.trades === 1 ? '' : 's'} on this day`);
}

function tradeCard(t: TradeCardInput, o: CardOptions, p: Palette): string {
    const hide = !!o.hideMoney;
    const heroColour = t.netProfit >= 0 ? p.up : p.down;
    const hero = hide ? `${signed(t.pips)} pips` : money(t.netProfit);
    const dir = t.side;

    const withNote = !!(o.includeNote && t.note);
    const body: string[] = [
        line(`${dir} ${t.volume} ${t.symbol}`, 72, 240, 50, p.text, '700'),
        line(t.label, 72, 292, 28, p.dim),
        hide ? centred(hero, CARD_W / 2, 420, 116, heroColour, '800')
             : num(hero, CARD_W / 2, 420, 132, heroColour, '800'),
        centred(hide ? 'RESULT' : `${signed(t.pips)} pips`, CARD_W / 2, 468, 32, p.dim),
    ];

    const hasSpark = !!t.spark?.values?.length;
    if (hasSpark) {
        body.push(panel(72, 500, CARD_W - 144, 240, p));
        body.push(sparkPath(t.spark!, 132, 545, CARD_W - 264, 150, heroColour, p));
    }

    const top = hasSpark ? 770 : 520;
    const entry = hide ? redactMoney(t.entry) : t.entry;
    // A note needs room, and the card's height is fixed: the entry gives
    // up lines rather than the note being cut off below the footer.
    const lines = wrapText(entry, 34, CARD_W - 200, withNote ? 2 : 4);
    body.push(panel(72, top, CARD_W - 144, 60 + lines.length * 54, p));
    lines.forEach((l, i) => body.push(line(l, 112, top + 60 + i * 54, 34, p.text)));

    let cursorY = top + 60 + lines.length * 54 + 40;
    body.push(pillRow(t.tags.map(x => ({ text: x.fa, colour: toneColour(x.tone, p) })), 72, CARD_W - 72, cursorY));
    cursorY += 92;

    if (withNote) {
        const note = hide ? redactMoney(t.note!) : t.note!;
        const noteLines = wrapText(note ? `«${note}»` : '', 30, CARD_W - 220, 2);
        body.push(`<rect x="76" y="${cursorY}" width="4" `
            + `height="${noteLines.length * 46 + 20}" fill="${p.brand}"/>`);
        noteLines.forEach((l, i) => body.push(line(l, 104, cursorY + 36 + i * 46, 30, p.dim)));
    }

    return shell(p, body.join(''), 'One trade from the journal');
}

function monthCard(m: MonthCardInput, o: CardOptions, p: Palette): string {
    const hide = !!o.hideMoney;

    const body: string[] = [
        line(m.monthLabel, 72, 225, 52, p.text, '700'),
        statRow([
            { label: 'TRADES', value: String(m.trades) },
            { label: 'WIN RATE', value: `${m.winRate}%` },
            { label: 'CLEAN DAYS', value: `${m.cleanDays}/${m.tradingDays}` },
        ], 265, p),
    ];

    // With money hidden the headline becomes the discipline streak, which
    // is the number this app would rather people shared anyway.
    if (hide) {
        body.push(centred(`${m.streak} disciplined days in a row`, CARD_W / 2, 505, 52, p.amber, '800'));
    } else {
        body.push(num(money(m.netProfit), CARD_W / 2, 510, 88, m.netProfit >= 0 ? p.up : p.down, '800'));
    }

    // The heatmap: 7 columns, right to left, Saturday first. Cells are
    // wider than tall because the budget is six rows — a 31-day month
    // whose first day lands late in the week needs all six, and a grid
    // sized for five would push the last row through the footer.
    const cellW = 122, cellH = 84, gap = 10;
    const gridTop = 590;
    const gridW = 7 * cellW + 6 * gap;
    const gridLeft = (CARD_W - gridW) / 2;
    const rows = Math.ceil((m.firstWeekday + m.days.length) / 7);

    body.push(panel(72, gridTop - 45, CARD_W - 144, 85 + rows * (cellH + gap), p));
    m.weekdayLabels.slice(0, 7).forEach((w, i) => {
        body.push(centred(w, gridLeft + (i + 0.5) * cellW + i * gap, gridTop, 30, p.dim));
    });

    m.days.forEach((d, idx) => {
        const slot = m.firstWeekday + idx;
        const col = slot % 7, row = Math.floor(slot / 7);
        const x = gridLeft + col * (cellW + gap);
        const y = gridTop + 24 + row * (cellH + gap);
        const alpha = d.trades ? 0.18 + Math.min(1, Math.abs(d.intensity)) * 0.62 : 0;
        const hex = Math.round(alpha * 255).toString(16).padStart(2, '0');
        const fill = !d.trades ? 'none' : `${d.netProfit >= 0 ? p.up : p.down}${hex}`;
        const broken = d.trades > 0 && !d.clean;
        body.push(`<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="18" fill="${fill}" `
            + `stroke="${broken ? p.amber : p.stroke}" stroke-width="${broken ? 3 : 1.5}"/>`);
        body.push(centred(d.label, x + cellW / 2, y + (d.trades && !hide ? 36 : 52), 32, d.trades ? p.text : p.dim));
        if (d.trades && !hide) {
            const short = Math.abs(d.netProfit) >= 1000
                ? `${signed(d.netProfit / 1000, 1)}k`
                : signed(d.netProfit, 0);
            body.push(num(short, x + cellW / 2, y + 68, 25, d.netProfit >= 0 ? p.up : p.down));
        }
    });

    return shell(p, body.join(''), `${m.trades} trades over ${m.tradingDays} trading days`);
}

/**
 * Build the card. Returns the SVG plus an `alt` line, so a share that
 * carries text next to the image says the same thing the image does.
 */
export function buildShareCard(input: CardInput, options: CardOptions = {}): {
    svg: string; width: number; height: number; alt: string; filename: string;
} {
    const p = PALETTES[options.theme === 'light' ? 'light' : 'dark'];
    const hide = !!options.hideMoney;

    let svg: string;
    let alt: string;
    let stem: string;

    if (input.kind === 'day') {
        svg = dayCard(input, options, p);
        alt = `${input.label} — ${input.trades} trades, ${input.wins} winners`
            + (hide ? `, ${signed(input.pips)} pips` : `, ${money(input.netProfit)}`);
        stem = `termax-day-${input.label.replace(/\s+/g, '-')}`;
    } else if (input.kind === 'trade') {
        svg = tradeCard(input, options, p);
        alt = `${input.side} ${input.volume} ${input.symbol} — `
            + (hide ? `${signed(input.pips)} pips` : money(input.netProfit));
        stem = `termax-trade-${input.symbol.replace(/[^\w]/g, '')}`;
    } else {
        svg = monthCard(input, options, p);
        alt = `${input.monthLabel} — ${input.trades} trades, ${input.winRate}% win rate`
            + `, ${input.cleanDays} disciplined days of ${input.tradingDays}`
            + (hide ? '' : `, ${money(input.netProfit)}`);
        stem = `termax-month-${input.monthLabel.replace(/\s+/g, '-')}`;
    }

    return { svg, width: CARD_W, height: CARD_H, alt, filename: `${stem}.png` };
}
