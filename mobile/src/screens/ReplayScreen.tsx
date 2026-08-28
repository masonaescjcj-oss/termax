// @ts-nocheck
/**
 * REPLAY — candle-by-candle practice on real history, optionally against
 * one of the user's bots. The server seals the window and the bot's trades
 * (computed by the real backtest engine); this screen reveals candles one
 * at a time, keeps the human's paper score in pips, and shows the bot's
 * trades only as history reaches them — no peeking for either player.
 */
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    View, StyleSheet, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Text } from '../components/Typography';
import axios from 'axios';
import {
    ChevronLeft, Play, Pause, SkipForward, RotateCcw, Swords,
    GraduationCap, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import GlassView from '../components/GlassView';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { BACKEND_URL, getTgSafeAreaTop, isTelegram } from '../config';
import GlassToast from '../components/GlassToast';
import { getItemAsync } from '../utils/storage';

const api = async (method: string, path: string, body?: any) => {
    const token = await getItemAsync('accessToken');
    return axios({ method, url: `${BACKEND_URL}${path}`, data: body, headers: { Authorization: `Bearer ${token}` } });
};

const replayHtml = (colors: any) => `
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>body{margin:0;padding:0;background:transparent;overflow:hidden}#c{position:absolute;inset:0}</style>
<script src="https://cdn.jsdelivr.net/npm/klinecharts@9.8.10/dist/umd/klinecharts.min.js"></script>
</head><body><div id="c"></div>
<script>
var chart = klinecharts.init('c', { styles: {
    candle: { bar: { upColor: '${colors.success}', downColor: '${colors.danger}', upBorderColor: '${colors.success}', downBorderColor: '${colors.danger}', upWickColor: '${colors.success}', downWickColor: '${colors.danger}' } },
    grid: { horizontal: { color: 'rgba(128,128,128,0.08)' }, vertical: { color: 'rgba(128,128,128,0.08)' } },
    xAxis: { axisLine: { color: 'rgba(128,128,128,0.2)' } },
    yAxis: { axisLine: { color: 'rgba(128,128,128,0.2)' } }
}});
klinecharts.registerOverlay({
    name: 'rpMark', totalStep: 2,
    needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
    createPointFigures: function(p) {
        var d = p.overlay.extendData || {}; var c = p.coordinates[0];
        var col = d.color || '#888';
        var up = d.dir === 'up';
        return [
            { type: 'polygon', attrs: { coordinates: up
                ? [ { x: c.x, y: c.y - 4 }, { x: c.x - 5, y: c.y + 7 }, { x: c.x + 5, y: c.y + 7 } ]
                : [ { x: c.x, y: c.y + 4 }, { x: c.x - 5, y: c.y - 7 }, { x: c.x + 5, y: c.y - 7 } ] },
              styles: { style: 'fill', color: col } },
            d.label ? { type: 'text', attrs: { x: c.x, y: up ? c.y + 20 : c.y - 20, text: d.label, align: 'center', baseline: 'middle' },
              styles: { color: '#FFF', backgroundColor: col, borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, size: 9, weight: 'bold' } } : null
        ].filter(Boolean);
    }
});
function handle(raw) {
    try {
        var m = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (m.type === 'init') { chart.applyNewData(m.candles); }
        else if (m.type === 'step') { chart.updateData(m.candle); }
        else if (m.type === 'mark') {
            chart.createOverlay({ name: 'rpMark', lock: true, groupId: 'rp',
                points: [{ timestamp: m.timestamp, value: m.value }],
                extendData: { color: m.color, dir: m.dir, label: m.label } });
        }
        else if (m.type === 'reset') { try { chart.removeOverlay({ groupId: 'rp' }); } catch(e){} chart.applyNewData(m.candles || []); }
    } catch(e) {}
}
window.handleChartMessageFromApp = handle;
window.addEventListener('message', function(ev) { handle(ev.data); });
</script></body></html>`;

export default function ReplayScreen({ navigation, route }) {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
    const iframeRef = useRef<any>(null);

    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [cursor, setCursor] = useState(0);          // index of last revealed candle
    const [playing, setPlaying] = useState(false);
    const [position, setPosition] = useState<any>(null); // {side, entry}
    const [myPips, setMyPips] = useState(0);
    const [myTrades, setMyTrades] = useState(0);
    const [botRevealedPips, setBotRevealedPips] = useState(0);
    const [finished, setFinished] = useState(false);
    // Learn mode: the bot's reasoning for the bar just revealed. Fetched
    // with the session, so stepping costs no request.
    const [learn, setLearn] = useState(true);
    const [whyOpen, setWhyOpen] = useState(true);

    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const showToast = (msg, type) => { setToastMessage(msg); setToastType(type); setToastVisible(true); };

    const send = useCallback((msg: any) => {
        const str = JSON.stringify(msg);
        if (Platform.OS === 'web') {
            iframeRef.current?.contentWindow?.postMessage(str, '*');
        }
    }, []);

    const pipSizeOf = (symbol: string) => symbol?.includes('JPY') ? 0.01 : symbol?.includes('/USDT') || ['GOLD', 'SPX', 'BTC'].some(s => symbol?.includes(s)) ? 0.1 : 0.0001;

    const load = useCallback(async () => {
        setLoading(true);
        setFinished(false);
        setPosition(null);
        setMyPips(0); setMyTrades(0); setBotRevealedPips(0);
        setPlaying(false);
        try {
            const res = await api('post', '/api/v1/replay', {
                botId: route?.params?.botId,
                symbol: route?.params?.symbol ?? 'BTC/USDT',
                timeframe: route?.params?.timeframe ?? '15m',
                days: 30,
                learn: true,
            });
            const d = res.data?.data;
            setSession(d);
            setCursor(d.warmup);
            setTimeout(() => send({ type: 'reset', candles: d.candles.slice(0, d.warmup).map(c => ({ timestamp: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })) }), 800);
        } catch (e: any) {
            showToast(e.response?.data?.message || 'Could not start the replay', 'error');
        } finally { setLoading(false); }
    }, [route?.params, send]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!isTelegram) return;
        (window as any).customTelegramBackHandler = () => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('MainTabs', { screen: 'Watchlist' });
            return true;
        };
        return () => { (window as any).customTelegramBackHandler = undefined; };
    }, [navigation]);

    const currentCandle = session?.candles?.[cursor - 1];
    const pipSize = pipSizeOf(session?.symbol);

    // The lesson is keyed by bar time rather than index: the explanation
    // pass skips bars of other timeframes, so the two arrays are not
    // guaranteed to line up position for position.
    const lesson = useMemo(() => {
        if (!learn || !currentCandle || !session?.lessons?.length) return null;
        return session.lessons.find((l: any) => l.time === currentCandle.time) ?? null;
    }, [learn, currentCandle, session]);

    const step = useCallback(() => {
        if (!session) return;
        if (cursor >= session.candles.length) { setPlaying(false); setFinished(true); return; }
        const c = session.candles[cursor];
        send({ type: 'step', candle: { timestamp: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume } });

        // Reveal bot activity as history reaches it.
        for (const t of session.botTrades ?? []) {
            if (t.entryTime > (session.candles[cursor - 1]?.time ?? 0) && t.entryTime <= c.time) {
                send({ type: 'mark', timestamp: c.time, value: t.entryPrice, color: '#2962FF', dir: t.side === 'BUY' ? 'up' : 'down', label: 'BOT ' + t.side });
            }
            if (t.exitTime > (session.candles[cursor - 1]?.time ?? 0) && t.exitTime <= c.time) {
                send({ type: 'mark', timestamp: c.time, value: t.exitPrice, color: t.pips >= 0 ? '#089981' : '#F23645', dir: t.pips >= 0 ? 'down' : 'up', label: (t.pips >= 0 ? '+' : '') + t.pips });
                setBotRevealedPips(p => Number((p + t.pips).toFixed(1)));
            }
        }
        setCursor(cursor + 1);
    }, [session, cursor, send]);

    useEffect(() => {
        if (!playing) return;
        const t = setInterval(step, 350);
        return () => clearInterval(t);
    }, [playing, step]);

    const act = (side: 'BUY' | 'SELL') => {
        if (!currentCandle || finished) return;
        if (position) { showToast('Close the open position first', 'info'); return; }
        setPosition({ side, entry: currentCandle.close });
        send({ type: 'mark', timestamp: currentCandle.time, value: currentCandle.close, color: side === 'BUY' ? '#089981' : '#F23645', dir: side === 'BUY' ? 'up' : 'down', label: 'YOU ' + side });
    };

    const closePos = () => {
        if (!position || !currentCandle) return;
        const dir = position.side === 'BUY' ? 1 : -1;
        const pips = Number((((currentCandle.close - position.entry) * dir) / pipSize).toFixed(1));
        setMyPips(p => Number((p + pips).toFixed(1)));
        setMyTrades(t => t + 1);
        send({ type: 'mark', timestamp: currentCandle.time, value: currentCandle.close, color: pips >= 0 ? '#089981' : '#F23645', dir: pips >= 0 ? 'down' : 'up', label: (pips >= 0 ? '+' : '') + pips });
        setPosition(null);
    };

    const openPips = position && currentCandle
        ? Number((((currentCandle.close - position.entry) * (position.side === 'BUY' ? 1 : -1)) / pipSize).toFixed(1))
        : null;

    const progress = session ? Math.round(((cursor - session.warmup) / (session.candles.length - session.warmup)) * 100) : 0;

    return (
        <SafeAreaView style={[styles.safeArea, { paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Watchlist' }))} style={styles.backBtn}>
                    <ChevronLeft color={colors.text} size={24} />
                </TouchableOpacity>
                <Swords color={colors.primary} size={18} />
                <Text style={styles.headerTitle}>Replay {session ? `· ${session.symbol} ${session.timeframe}` : ''}</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={load} style={styles.backBtn}>
                    <RotateCcw color={colors.textSecondary} size={18} />
                </TouchableOpacity>
            </View>

            {/* scoreboard */}
            <View style={styles.scoreRow}>
                <View style={styles.scoreCell}>
                    <Text style={styles.scoreLabel}>YOU</Text>
                    <Text style={[styles.scoreValue, { color: myPips >= 0 ? colors.success : colors.danger }]}>{myPips >= 0 ? '+' : ''}{myPips} pips</Text>
                    <Text style={styles.scoreMeta}>{myTrades} trades{openPips !== null ? ` · open ${openPips >= 0 ? '+' : ''}${openPips}` : ''}</Text>
                </View>
                <Text style={styles.vs}>vs</Text>
                <View style={styles.scoreCell}>
                    <Text style={styles.scoreLabel}>{session?.botName ? session.botName.toUpperCase() : 'BOT'}</Text>
                    <Text style={[styles.scoreValue, { color: botRevealedPips >= 0 ? colors.success : colors.danger }]}>{botRevealedPips >= 0 ? '+' : ''}{botRevealedPips} pips</Text>
                    <Text style={styles.scoreMeta}>{session?.botName ? 'revealed so far' : 'no bot selected'}</Text>
                </View>
            </View>

            {/* chart */}
            <View style={{ flex: 1 }}>
                {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />}
                {!loading && Platform.OS === 'web' && (
                    <iframe ref={iframeRef} srcDoc={replayHtml(colors)} style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'transparent' }} />
                )}
            </View>

            {/* progress */}
            <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, progress))}%` }]} />
            </View>

            {/* controls */}
            {/* ── learn mode: why the bot did what it did on this bar ── */}
            {session?.botName && learn && !finished && (
                <GlassView intensity={12} style={styles.whyCard}>
                    <TouchableOpacity style={styles.whyHead} onPress={() => setWhyOpen(o => !o)}>
                        <GraduationCap color={colors.primary} size={16} />
                        <Text style={styles.whyTitle}>
                            {lesson ? lesson.headlineFa : 'برای این کندل توضیحی نیست'}
                        </Text>
                        {whyOpen ? <ChevronDown color={colors.textSecondary} size={16} />
                                 : <ChevronUp color={colors.textSecondary} size={16} />}
                    </TouchableOpacity>

                    {whyOpen && lesson && lesson.lines?.length > 0 && (
                        <View style={styles.whyBody}>
                            <Text style={styles.whySubtitle}>{lesson.titleFa}</Text>
                            {lesson.lines.map((l: any, i: number) => (
                                <View key={i} style={[styles.whyLine, { paddingRight: 4 + l.depth * 16 }]}>
                                    <Text style={[styles.whyMark, {
                                        color: l.passed ? colors.success : colors.danger,
                                    }]}>{l.group ? (l.passed ? '▾' : '▾') : (l.passed ? '✓' : '✗')}</Text>
                                    <Text style={[styles.whyText, l.group && styles.whyGroupText, {
                                        color: l.group ? colors.textSecondary
                                            : l.passed ? colors.text : colors.textSecondary,
                                    }]}>{l.text}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                    {whyOpen && lesson && !lesson.lines?.length && (
                        <Text style={styles.whyNote}>
                            هیچ شرطی سنجیده نشد — به همین دلیل خطی برای نمایش نیست.
                        </Text>
                    )}
                </GlassView>
            )}

            {finished ? (
                <GlassView intensity={16} style={styles.endCard}>
                    <Text style={styles.endTitle}>
                        {session?.botName
                            ? (myPips > (session?.botTotalPips ?? 0) ? '🏆 You beat the bot!' : myPips === (session?.botTotalPips ?? 0) ? '🤝 Dead heat' : '🤖 The bot wins')
                            : '🏁 Replay finished'}
                    </Text>
                    <Text style={styles.endLine}>You: {myPips >= 0 ? '+' : ''}{myPips} pips ({myTrades} trades){session?.botName ? ` · Bot: ${session.botTotalPips >= 0 ? '+' : ''}${session.botTotalPips} pips` : ''}</Text>
                    <TouchableOpacity onPress={load}>
                        <LinearGradient colors={[colors.primary, '#1E4FD6']} style={styles.againBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            <RotateCcw color="#FFF" size={15} />
                            <Text style={styles.againText}>Replay again</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </GlassView>
            ) : (
                <View style={styles.controls}>
                    <TouchableOpacity style={styles.ctrlBtn} onPress={() => setPlaying(!playing)}>
                        {playing ? <Pause color={colors.text} size={20} /> : <Play color={colors.text} size={20} />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.ctrlBtn} onPress={step}>
                        <SkipForward color={colors.text} size={20} />
                    </TouchableOpacity>
                    {position ? (
                        <TouchableOpacity style={[styles.tradeBtn, { backgroundColor: '#F5A623' }]} onPress={closePos}>
                            <Text style={styles.tradeBtnText}>CLOSE {openPips !== null ? `(${openPips >= 0 ? '+' : ''}${openPips})` : ''}</Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity style={[styles.tradeBtn, { backgroundColor: colors.danger }]} onPress={() => act('SELL')}>
                                <Text style={styles.tradeBtnText}>SELL</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.tradeBtn, { backgroundColor: colors.success }]} onPress={() => act('BUY')}>
                                <Text style={styles.tradeBtnText}>BUY</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            )}
            <GlassToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    // ── learn mode ──────────────────────────────────────────────────
    whyCard: {
        marginHorizontal: 12, marginBottom: 8, borderRadius: 14, padding: 10,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    whyHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
    whyTitle: {
        flex: 1, fontSize: 12, fontWeight: '700', color: colors.text,
        textAlign: 'right', writingDirection: 'rtl',
    },
    whyBody: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8 },
    whySubtitle: {
        fontSize: 10.5, color: colors.primary, fontWeight: '700', marginBottom: 6,
        textAlign: 'right', writingDirection: 'rtl',
    },
    whyLine: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 6, paddingVertical: 2 },
    whyMark: { fontSize: 12, fontWeight: '800', width: 14, textAlign: 'center' },
    whyText: { flex: 1, fontSize: 11.5, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
    whyGroupText: { fontWeight: '700' },
    whyNote: {
        fontSize: 10.5, color: colors.textSecondary, marginTop: 8,
        textAlign: 'right', writingDirection: 'rtl',
    },

    safeArea: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
    backBtn: { padding: 6 },
    headerTitle: { fontSize: 16.5, fontWeight: '700', color: colors.text },
    scoreRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
    scoreCell: { flex: 1 },
    scoreLabel: { fontSize: 10.5, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1 },
    scoreValue: { fontSize: 19, fontWeight: '800', marginTop: 2 },
    scoreMeta: { fontSize: 10.5, color: colors.textSecondary, marginTop: 2 },
    vs: { fontSize: 13, color: colors.textSecondary, marginHorizontal: 10, fontWeight: '700' },
    progressTrack: { height: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
    progressFill: { height: 3, backgroundColor: colors.primary },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
    ctrlBtn: {
        width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    },
    tradeBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    tradeBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
    endCard: { margin: 12, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    endTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    endLine: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
    againBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22, marginTop: 12 },
    againText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
