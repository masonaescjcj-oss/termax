// @ts-nocheck
/**
 * JOURNAL — the trading diary that writes itself.
 *
 * Three levels of zoom. The month, as a heatmap in the Jalali calendar a
 * Persian trader actually lives in. The day, with a recap the engine
 * wrote. The trade, with the entry the engine wrote, the habits it was
 * tagged with, and the one place the trader adds their own words.
 *
 * Every sentence and every number on this screen arrives pre-computed
 * from the server. The screen lays them out; it never derives a figure,
 * so what is drawn here cannot disagree with the account.
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    View, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Modal,
    Platform, ActivityIndicator, RefreshControl, TextInput, KeyboardAvoidingView,
    Switch, Share as RNShare,
} from 'react-native';
import { Text } from '../components/Typography';
import axios from 'axios';
import Svg, { Polyline, Circle, Line as SvgLine, SvgXml } from 'react-native-svg';
import {
    ChevronLeft, ChevronRight, CalendarDays, Flame, BookOpen, Tag, X, Check, Info,
    NotebookPen, TrendingUp, TrendingDown, Share2, Download,
} from 'lucide-react-native';
import GlassView from '../components/GlassView';
import { useTheme } from '../theme/ThemeContext';
import { BACKEND_URL, getTgSafeAreaTop, isTelegram } from '../config';
import GlassToast from '../components/GlassToast';
import { getItemAsync } from '../utils/storage';

const authed = async () => {
    const token = await getItemAsync('accessToken');
    return { headers: { Authorization: `Bearer ${token}` } };
};
const api = async (path: string) => axios.get(`${BACKEND_URL}${path}`, await authed());
const post = async (path: string, body: any) => axios.post(`${BACKEND_URL}${path}`, body, await authed());

const money = (v: any) => (typeof v === 'number' ? `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}` : '—');
const compact = (v: number) => {
    const a = Math.abs(v);
    if (a >= 1000) return `${v < 0 ? '-' : ''}${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
    return `${v < 0 ? '-' : ''}${a.toFixed(a < 10 ? 1 : 0)}`;
};

/** The closed list of moods, mirrored from the server's EMOTIONS. */
const EMOTIONS = [
    { key: 'confident', fa: 'با اعتماد' },
    { key: 'disciplined', fa: 'منظم' },
    { key: 'anxious', fa: 'مضطرب' },
    { key: 'fearful', fa: 'ترسیده' },
    { key: 'greedy', fa: 'طمع‌کار' },
    { key: 'bored', fa: 'بی‌حوصله' },
];

/**
 * Half the card's pixel size, in points. The capture is taken at the
 * device's own pixel ratio, so 540pt is 1080px at @2x and 1620px at @3x —
 * at or above the card's real width on any modern phone.
 */
const CAPTURE_W = 540;
const CAPTURE_H = 675;

const toneColor = (tone: string, colors: any) =>
    tone === 'risk' ? colors.danger : tone === 'good' ? colors.success : colors.textSecondary;

/** The trade's shape, drawn from the closes the server thinned for us. */
function Sparkline({ spark, side, won, colors }) {
    if (!spark?.values?.length || spark.values.length < 2) return null;
    const W = 240, H = 44, PAD = 3;
    const vals = spark.values;
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const x = (i: number) => PAD + (i / (vals.length - 1)) * (W - PAD * 2);
    const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
    const points = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const stroke = won ? colors.success : colors.danger;

    return (
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <Polyline points={points} fill="none" stroke={stroke} strokeWidth={1.6} strokeOpacity={0.85} />
            {spark.entryAt >= 0 && (
                <>
                    <SvgLine x1={x(spark.entryAt)} y1={0} x2={x(spark.entryAt)} y2={H}
                        stroke={colors.textSecondary} strokeWidth={0.7} strokeOpacity={0.35} strokeDasharray="2,2" />
                    <Circle cx={x(spark.entryAt)} cy={y(vals[spark.entryAt])} r={3}
                        fill={side === 'BUY' ? colors.success : colors.danger} />
                </>
            )}
            {spark.exitAt >= 0 && (
                <Circle cx={x(spark.exitAt)} cy={y(vals[spark.exitAt])} r={3}
                    fill={colors.background} stroke={stroke} strokeWidth={1.6} />
            )}
        </Svg>
    );
}

export default function JournalScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    const [month, setMonth] = useState<any>(null);
    const [ym, setYm] = useState<{ year: number; month: number } | null>(null);
    const [calendar, setCalendar] = useState<'jalali' | 'gregorian'>('jalali');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [dayOpen, setDayOpen] = useState(false);
    const [day, setDay] = useState<any>(null);
    const [dayLoading, setDayLoading] = useState(false);

    const [editing, setEditing] = useState<string | null>(null);
    const [draftNote, setDraftNote] = useState('');
    const [draftEmotion, setDraftEmotion] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Share card. `cardReq` is what to build; the toggles are how.
    const [cardReq, setCardReq] = useState<any>(null);
    const [card, setCard] = useState<any>(null);
    const [cardLoading, setCardLoading] = useState(false);
    const [hideMoney, setHideMoney] = useState(false);
    const [includeNote, setIncludeNote] = useState(false);
    const [cardTheme, setCardTheme] = useState<'dark' | 'light'>('dark');
    const [busy, setBusy] = useState(false);
    // The node captured on native — an off-screen copy of the card, not
    // the visible preview. captureRef resizes *from the view's on-screen
    // bounds*, so capturing a ~370pt preview and scaling it up to 1080
    // would ship a blurry card. The web path rasterises the SVG source
    // directly and needs no view at all.
    const captureRef_ = useRef<any>(null);

    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const toast = (m: string, t: any = 'info') => { setToastMessage(m); setToastType(t); setToastVisible(true); };

    // Tehran is +210. The server buckets days with this, so a trade closed
    // at 01:30 local lands on the night the trader remembers.
    const tz = useMemo(() => -new Date().getTimezoneOffset(), []);

    const loadMonth = useCallback(async (target?: { year: number; month: number }, silent = false) => {
        if (!silent) setLoading(true);
        try {
            const q = new URLSearchParams({ calendar, tz: String(tz) });
            if (target) { q.set('year', String(target.year)); q.set('month', String(target.month)); }
            const res = await api(`/api/v1/journal/month?${q.toString()}`);
            if (res.data?.success) {
                setMonth(res.data.data);
                setYm({ year: res.data.data.year, month: res.data.data.month });
            }
        } catch (e: any) {
            toast(e?.response?.data?.message || 'ژورنال بارگیری نشد', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [calendar, tz]);

    // One effect, on mount and on a calendar switch. No target month is
    // passed on a switch: 1405/6 and 2026/6 are different months, so the
    // server re-anchors on today in whichever calendar is now active.
    useEffect(() => { loadMonth(); }, [calendar]);

    const openDay = useCallback(async (isoDay: string) => {
        setDayOpen(true);
        setDayLoading(true);
        setDay(null);
        setEditing(null);
        try {
            const res = await api(`/api/v1/journal/day?date=${isoDay}&tz=${tz}&source=${month?.source ?? 'manual'}`);
            if (res.data?.success) setDay(res.data.data);
        } catch (e: any) {
            toast(e?.response?.data?.message || 'روز بارگیری نشد', 'error');
        } finally {
            setDayLoading(false);
        }
    }, [tz, month]);

    const saveNote = async (tradeId: string) => {
        setSaving(true);
        try {
            await post(`/api/v1/journal/note/${tradeId}`, { note: draftNote, emotion: draftEmotion });
            setDay((d: any) => ({
                ...d,
                trades: d.trades.map((t: any) => t.id === tradeId
                    ? { ...t, note: { note: draftNote, emotion: draftEmotion } } : t),
            }));
            setEditing(null);
            toast('یادداشت ذخیره شد', 'success');
        } catch (e: any) {
            toast(e?.response?.data?.message || 'ذخیره نشد', 'error');
        } finally {
            setSaving(false);
        }
    };

    // The card is built server-side from the same numbers the screen
    // shows, then rasterised here. Re-fetched whenever a switch moves,
    // because redaction happens where the card is composed — the client
    // never gets a figure it was asked to hide.
    useEffect(() => {
        if (!cardReq) { setCard(null); return; }
        let alive = true;
        (async () => {
            setCardLoading(true);
            try {
                const q = new URLSearchParams({
                    ...cardReq,
                    tz: String(tz),
                    theme: cardTheme,
                    hideMoney: hideMoney ? '1' : '0',
                    includeNote: includeNote ? '1' : '0',
                });
                const res = await api(`/api/v1/journal/card?${q.toString()}`);
                if (alive && res.data?.success) setCard(res.data.data);
            } catch (e: any) {
                if (alive) toast(e?.response?.data?.message || 'کارت ساخته نشد', 'error');
            } finally {
                if (alive) setCardLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [cardReq, hideMoney, includeNote, cardTheme, tz]);

    /** SVG → PNG. Web only: there is no canvas on native. */
    const toPngBlob = (svg: string, width: number, height: number): Promise<Blob> =>
        new Promise((resolve, reject) => {
            const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { URL.revokeObjectURL(url); return reject(new Error('no 2d context')); }
                ctx.drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(url);
                canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg did not load')); };
            img.src = url;
        });

    /**
     * Capture the preview to a PNG file and hand it to the OS.
     *
     * The three modules are required lazily and on purpose: they carry
     * native code, so a binary built before they were added does not have
     * them. A missing module then means falling back to the text share
     * instead of crashing a button the user just tapped — which is also
     * what happens between an over-the-air JS update and the next build.
     */
    const shareNative = async (download: boolean): Promise<boolean> => {
        let captureRef: any, Sharing: any, MediaLibrary: any;
        try {
            captureRef = require('react-native-view-shot').captureRef;
            Sharing = require('expo-sharing');
            if (download) MediaLibrary = require('expo-media-library');
        } catch {
            return false;
        }
        if (!captureRef_.current) return false;

        const uri = await captureRef(captureRef_, {
            format: 'png', quality: 1, result: 'tmpfile',
            // The off-screen host is half the card's size in points, so on
            // any screen with a pixel ratio of 2 or more the raw capture is
            // already at least 1080px wide and this only normalises it
            // down — never up.
            width: card.width, height: card.height,
        });

        if (download) {
            const perm = await MediaLibrary.requestPermissionsAsync();
            if (!perm?.granted) { toast('برای ذخیره در گالری اجازه لازم است', 'error'); return true; }
            await MediaLibrary.saveToLibraryAsync(uri);
            toast('تصویر در گالری ذخیره شد', 'success');
            return true;
        }

        if (!(await Sharing.isAvailableAsync())) return false;
        await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'اشتراک‌گذاری کارت ژورنال',
            UTI: 'public.png',
        });
        return true;
    };

    const shareCard = async (download = false) => {
        if (!card) return;
        setBusy(true);
        try {
            if (Platform.OS !== 'web') {
                if (await shareNative(download)) return;
                // No capture module in this binary: send the sentence the
                // image would have carried, and say why it is not a picture.
                await RNShare.share({ message: `${card.alt}\n\ntermax.app` });
                toast('این نسخه‌ی اپ فقط متن را می‌فرستد؛ برای تصویر، اپ را به‌روز کنید', 'info');
                return;
            }
            const blob = await toPngBlob(card.svg, card.width, card.height);
            const file = new File([blob], card.filename, { type: 'image/png' });

            if (!download && (navigator as any).canShare?.({ files: [file] })) {
                await (navigator as any).share({ files: [file], text: `${card.alt}\n\ntermax.app` });
                return;
            }
            const href = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = href;
            a.download = card.filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(href), 4000);
            toast('تصویر ذخیره شد', 'success');
        } catch (e: any) {
            // A cancelled share sheet rejects too; that is not an error.
            if (e?.name !== 'AbortError') toast(e?.message || 'اشتراک‌گذاری انجام نشد', 'error');
        } finally {
            setBusy(false);
        }
    };

    const cellStyle = (d: any) => {
        if (!d.trades) return { backgroundColor: 'transparent', borderColor: colors.border };
        const a = 0.16 + Math.min(1, Math.abs(d.intensity)) * 0.5;
        const base = d.netProfit >= 0 ? `rgba(8,153,129,${a})` : `rgba(242,54,69,${a})`;
        return {
            backgroundColor: base,
            borderColor: d.clean ? 'transparent' : 'rgba(245,166,35,0.75)',
            borderWidth: d.clean ? StyleSheet.hairlineWidth : 1.4,
        };
    };

    // isTelegram is a boolean, not a predicate — calling it throws.
    const topPad = isTelegram ? getTgSafeAreaTop() : 0;

    return (
        <SafeAreaView style={[styles.safe, { paddingTop: topPad }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <ChevronLeft color={colors.text} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>ژورنال</Text>
                <TouchableOpacity
                    onPress={() => setCalendar(c => (c === 'jalali' ? 'gregorian' : 'jalali'))}
                    style={styles.calToggle}
                >
                    <CalendarDays color={colors.primary} size={14} />
                    <Text style={styles.calToggleText}>{calendar === 'jalali' ? 'شمسی' : 'میلادی'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    disabled={!month}
                    onPress={() => setCardReq({
                        kind: 'month', calendar,
                        year: String(month.year), month: String(month.month),
                        source: month.source ?? 'manual',
                    })}
                    style={styles.iconBtn}
                >
                    <Share2 color={month ? colors.primary : colors.textSecondary} size={19} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : !month ? (
                <View style={styles.center}><Text style={styles.dim}>ژورنال در دسترس نیست.</Text></View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMonth(ym, true); }} tintColor={colors.primary} />}
                >
                    {/* month navigator */}
                    <View style={styles.monthNav}>
                        <TouchableOpacity onPress={() => loadMonth(month.prev)} style={styles.navBtn}>
                            <ChevronRight color={colors.text} size={20} />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={styles.monthLabel}>{month.monthLabel}</Text>
                            <Text style={[styles.monthNet, { color: month.totals.netProfit >= 0 ? colors.success : colors.danger }]}>
                                {money(month.totals.netProfit)}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => loadMonth(month.next)} style={styles.navBtn}>
                            <ChevronLeft color={colors.text} size={20} />
                        </TouchableOpacity>
                    </View>

                    {/* discipline streak */}
                    <GlassView intensity={14} style={styles.card}>
                        <View style={styles.rowBetween}>
                            <View style={styles.rowStart}>
                                <Flame color={month.streak.current > 0 ? '#F5A623' : colors.textSecondary} size={18} />
                                <Text style={styles.cardTitle}>روزهای منظم</Text>
                            </View>
                            <Text style={[styles.streakBig, { color: month.streak.current > 0 ? '#F5A623' : colors.textSecondary }]}>
                                {month.streak.current}
                            </Text>
                        </View>
                        <Text style={styles.noteText}>
                            یک روز «منظم» است اگر هیچ معامله‌اش بدون حد ضرر، انتقامی یا با حجم غیرعادی نبوده باشد — بُرد و باخت در آن نقشی ندارد.
                        </Text>
                        <Text style={styles.noteText}>
                            بهترین رکورد شما: {month.streak.best} روز
                            {month.streak.lastBreakFa?.length ? ` · آخرین چیزی که نظم را شکست: ${month.streak.lastBreakFa.join('، ')}` : ''}
                        </Text>
                    </GlassView>

                    {/* calendar */}
                    <GlassView intensity={14} style={styles.card}>
                        <View style={styles.weekHead}>
                            {month.weekdayLabels.map((w: string, i: number) => (
                                <Text key={i} style={styles.weekHeadCell}>{w}</Text>
                            ))}
                        </View>
                        <View style={styles.grid}>
                            {Array.from({ length: month.firstWeekday }).map((_, i) => (
                                <View key={`pad-${i}`} style={styles.cellWrap} />
                            ))}
                            {month.days.map((d: any) => (
                                <View key={d.day} style={styles.cellWrap}>
                                    <TouchableOpacity
                                        disabled={!d.trades}
                                        onPress={() => openDay(d.day)}
                                        style={[styles.cell, cellStyle(d), d.day === month.today && styles.cellToday]}
                                    >
                                        <Text style={[styles.cellDay, !d.trades && { color: colors.textSecondary, opacity: 0.55 }]}>
                                            {d.label}
                                        </Text>
                                        {d.trades > 0 && (
                                            <Text style={[styles.cellNet, { color: d.netProfit >= 0 ? colors.success : colors.danger }]}>
                                                {compact(d.netProfit)}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                        <View style={styles.legendRow}>
                            <View style={[styles.legendSwatch, { backgroundColor: 'rgba(8,153,129,0.55)' }]} />
                            <Text style={styles.legendText}>روز سودده</Text>
                            <View style={[styles.legendSwatch, { backgroundColor: 'rgba(242,54,69,0.55)' }]} />
                            <Text style={styles.legendText}>روز ضررده</Text>
                            <View style={[styles.legendSwatch, { backgroundColor: 'transparent', borderColor: 'rgba(245,166,35,0.75)', borderWidth: 1.4 }]} />
                            <Text style={styles.legendText}>روزی که نظم شکست</Text>
                        </View>
                    </GlassView>

                    {/* month totals */}
                    <GlassView intensity={14} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <BookOpen color={colors.primary} size={18} />
                            <Text style={styles.cardTitle}>خلاصه‌ی ماه</Text>
                        </View>
                        <View style={styles.factsRow}>
                            <View style={styles.factCell}>
                                <Text style={styles.factLabel}>معامله</Text>
                                <Text style={styles.factValue}>{month.totals.trades}</Text>
                            </View>
                            <View style={styles.factCell}>
                                <Text style={styles.factLabel}>وین‌ریت</Text>
                                <Text style={styles.factValue}>{month.totals.winRate}%</Text>
                            </View>
                            <View style={styles.factCell}>
                                <Text style={styles.factLabel}>روز معاملاتی</Text>
                                <Text style={styles.factValue}>{month.totals.tradingDays}</Text>
                            </View>
                            <View style={styles.factCell}>
                                <Text style={styles.factLabel}>روز منظم</Text>
                                <Text style={[styles.factValue, { color: colors.success }]}>
                                    {month.totals.cleanDays}/{month.totals.tradingDays}
                                </Text>
                            </View>
                        </View>
                        {month.totals.bestDay && (
                            <Text style={styles.noteText}>
                                سبزترین روز {money(month.totals.bestDay.netProfit)} · قرمزترین روز {money(month.totals.worstDay.netProfit)}
                                {'  '}({month.totals.greenDays} سبز / {month.totals.redDays} قرمز)
                            </Text>
                        )}
                        {month.totals.trades === 0 && (
                            <Text style={styles.noteText}>در این ماه معامله‌ی بسته‌شده‌ای نبود.</Text>
                        )}
                    </GlassView>

                    {/* habit bill */}
                    {month.habits?.slices?.length > 0 && (
                        <GlassView intensity={14} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Tag color={colors.primary} size={18} />
                                <Text style={styles.cardTitle}>صورت‌حساب عادت‌ها</Text>
                            </View>
                            <Text style={styles.noteText}>
                                هر معامله‌ی {month.habits.days} روز گذشته ({month.habits.trades} معامله) با عادت‌هایی که در آن دیده شد برچسب خورده. گران‌ترین عادت اول آمده. عادت‌های زیر ۳ معامله نمایش داده نمی‌شوند.
                            </Text>
                            {month.habits.slices.map((s: any) => (
                                <View key={s.key} style={styles.habitRow}>
                                    <View style={[styles.tagChip, { borderColor: toneColor(s.tone, colors) }]}>
                                        <Text style={[styles.tagChipText, { color: toneColor(s.tone, colors) }]}>{s.fa}</Text>
                                    </View>
                                    <Text style={styles.habitMeta}>{s.trades} معامله · {s.winRate}%</Text>
                                    <Text style={[styles.habitNet, { color: s.netProfit >= 0 ? colors.success : colors.danger }]}>
                                        {money(s.netProfit)}
                                    </Text>
                                </View>
                            ))}
                        </GlassView>
                    )}
                </ScrollView>
            )}

            {/* ── day sheet ─────────────────────────────────────────── */}
            <Modal visible={dayOpen} animationType="slide" transparent onRequestClose={() => setDayOpen(false)}>
                <View style={styles.modalBackdrop}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
                        <View style={styles.sheetHead}>
                            <TouchableOpacity onPress={() => setDayOpen(false)} style={styles.iconBtn}>
                                <X color={colors.text} size={20} />
                            </TouchableOpacity>
                            <Text style={styles.sheetTitle}>{day?.labelFa ?? '...'}</Text>
                            <TouchableOpacity
                                disabled={!day?.trades?.length}
                                onPress={() => setCardReq({ kind: 'day', date: day.day, source: month?.source ?? 'manual' })}
                                style={styles.iconBtn}
                            >
                                <Share2 color={day?.trades?.length ? colors.primary : colors.textSecondary} size={19} />
                            </TouchableOpacity>
                        </View>

                        {dayLoading ? (
                            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
                        ) : (
                            <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }}>
                                {day?.recap && (
                                    <View style={styles.recapBox}>
                                        <Info color={colors.primary} size={15} />
                                        <Text style={styles.recapText}>{day.recap.fa}</Text>
                                    </View>
                                )}

                                {day?.trades?.map((t: any) => {
                                    const won = t.netProfit > 0;
                                    const isEditing = editing === t.id;
                                    return (
                                        <GlassView key={t.id} intensity={12} style={styles.tradeCard}>
                                            <View style={styles.rowBetween}>
                                                <View style={styles.rowStart}>
                                                    {t.side === 'BUY'
                                                        ? <TrendingUp color={colors.success} size={16} />
                                                        : <TrendingDown color={colors.danger} size={16} />}
                                                    <Text style={styles.tradeTitle}>{t.side} {t.volume} {t.symbol}</Text>
                                                </View>
                                                <Text style={[styles.tradeNet, { color: won ? colors.success : colors.danger }]}>
                                                    {money(t.netProfit)}
                                                </Text>
                                            </View>

                                            {t.spark && (
                                                <View style={styles.sparkWrap}>
                                                    <Sparkline spark={t.spark} side={t.side} won={won} colors={colors} />
                                                </View>
                                            )}

                                            <Text style={styles.entryText}>{t.entry?.fa}</Text>

                                            {t.tagMeta?.length > 0 && (
                                                <View style={styles.chipRow}>
                                                    {t.tagMeta.map((m: any) => (
                                                        <View key={m.key} style={[styles.tagChip, { borderColor: toneColor(m.tone, colors) }]}>
                                                            <Text style={[styles.tagChipText, { color: toneColor(m.tone, colors) }]}>{m.fa}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}

                                            {/* the human half */}
                                            {isEditing ? (
                                                <View style={styles.noteEditor}>
                                                    <View style={styles.chipRow}>
                                                        {EMOTIONS.map(e => (
                                                            <TouchableOpacity
                                                                key={e.key}
                                                                onPress={() => setDraftEmotion(draftEmotion === e.key ? null : e.key)}
                                                                style={[styles.emotionChip, draftEmotion === e.key && { borderColor: colors.primary, backgroundColor: 'rgba(41,98,255,0.12)' }]}
                                                            >
                                                                <Text style={[styles.emotionText, draftEmotion === e.key && { color: colors.primary }]}>{e.fa}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                    <TextInput
                                                        value={draftNote}
                                                        onChangeText={setDraftNote}
                                                        placeholder="چه چیزی دیدی که وارد شدی؟ و اگر دوباره ببینی همین کار را می‌کنی؟"
                                                        placeholderTextColor={colors.textSecondary}
                                                        multiline
                                                        style={styles.noteInput}
                                                    />
                                                    <View style={styles.rowEnd}>
                                                        <TouchableOpacity onPress={() => setEditing(null)} style={styles.ghostBtn}>
                                                            <Text style={styles.ghostBtnText}>انصراف</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => saveNote(t.id)} disabled={saving} style={styles.primaryBtn}>
                                                            {saving
                                                                ? <ActivityIndicator size="small" color="#fff" />
                                                                : <><Check color="#fff" size={14} /><Text style={styles.primaryBtnText}>ذخیره</Text></>}
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ) : t.note?.note || t.note?.emotion ? (
                                                <TouchableOpacity
                                                    onPress={() => { setEditing(t.id); setDraftNote(t.note?.note ?? ''); setDraftEmotion(t.note?.emotion ?? null); }}
                                                    style={styles.noteBox}
                                                >
                                                    {t.note?.emotion && (
                                                        <Text style={styles.noteEmotion}>
                                                            حالم: {EMOTIONS.find(e => e.key === t.note.emotion)?.fa ?? t.note.emotion}
                                                        </Text>
                                                    )}
                                                    {!!t.note?.note && <Text style={styles.noteOwn}>{t.note.note}</Text>}
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity
                                                    onPress={() => { setEditing(t.id); setDraftNote(''); setDraftEmotion(null); }}
                                                    style={styles.addNoteBtn}
                                                >
                                                    <NotebookPen color={colors.primary} size={14} />
                                                    <Text style={styles.addNoteText}>یادداشت خودت را اضافه کن</Text>
                                                </TouchableOpacity>
                                            )}

                                            <View style={styles.cardFooterRow}>
                                                <TouchableOpacity
                                                    onPress={() => setCardReq({
                                                        kind: 'trade', date: day.day, tradeId: t.id,
                                                        source: month?.source ?? 'manual',
                                                    })}
                                                    style={styles.shareChip}
                                                >
                                                    <Share2 color={colors.primary} size={13} />
                                                    <Text style={styles.shareChipText}>ساخت تصویر</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => { setDayOpen(false); navigation.navigate('TradeDna', { positionId: t.id }); }}
                                                >
                                                    <Text style={styles.autopsyLinkText}>کالبدشکافی کامل این معامله ↗</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </GlassView>
                                    );
                                })}

                                {day && day.trades?.length === 0 && (
                                    <Text style={styles.dim}>این روز معامله‌ای بسته نشد.</Text>
                                )}
                            </ScrollView>
                        )}
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* ── share card ────────────────────────────────────────── */}
            <Modal visible={!!cardReq} animationType="fade" transparent onRequestClose={() => setCardReq(null)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.cardSheet}>
                        <View style={styles.sheetHead}>
                            <TouchableOpacity onPress={() => setCardReq(null)} style={styles.iconBtn}>
                                <X color={colors.text} size={20} />
                            </TouchableOpacity>
                            <Text style={styles.sheetTitle}>تصویر برای اشتراک‌گذاری</Text>
                            <View style={{ width: 36 }} />
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28 }}>
                            <View style={styles.cardPreview}>
                                {cardLoading || !card ? (
                                    <View style={styles.previewLoading}><ActivityIndicator color={colors.primary} /></View>
                                ) : (
                                    <SvgXml xml={card.svg} width="100%" height="100%" />
                                )}
                            </View>

                            {/* The capture host: laid out and rendered, but
                                parked off-screen. collapsable={false} keeps
                                Android from flattening it away, which would
                                leave captureRef with nothing to capture. */}
                            {!!card && Platform.OS !== 'web' && (
                                <View ref={captureRef_} collapsable={false} style={styles.captureHost}>
                                    <SvgXml xml={card.svg} width={CAPTURE_W} height={CAPTURE_H} />
                                </View>
                            )}

                            <View style={styles.optRow}>
                                <Text style={styles.optLabel}>پنهان کردن مبالغ (فقط پیپ و درصد)</Text>
                                <Switch
                                    value={hideMoney}
                                    onValueChange={setHideMoney}
                                    trackColor={{ true: colors.primary, false: colors.border }}
                                />
                            </View>
                            {cardReq?.kind === 'trade' && (
                                <View style={styles.optRow}>
                                    <Text style={styles.optLabel}>یادداشت خودم هم روی تصویر باشد</Text>
                                    <Switch
                                        value={includeNote}
                                        onValueChange={setIncludeNote}
                                        trackColor={{ true: colors.primary, false: colors.border }}
                                    />
                                </View>
                            )}
                            <View style={styles.optRow}>
                                <Text style={styles.optLabel}>تم روشن</Text>
                                <Switch
                                    value={cardTheme === 'light'}
                                    onValueChange={(v) => setCardTheme(v ? 'light' : 'dark')}
                                    trackColor={{ true: colors.primary, false: colors.border }}
                                />
                            </View>

                            <Text style={styles.privacyNote}>
                                یادداشت شخصی شما به‌صورت پیش‌فرض روی تصویر نیست. با «پنهان کردن مبالغ» هیچ عددِ دلاری روی کارت نمی‌ماند — حتی داخل جمله‌ها.
                            </Text>

                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    disabled={!card || busy}
                                    onPress={() => shareCard(true)}
                                    style={[styles.ghostBtn, styles.actionBtn]}
                                >
                                    <Download color={colors.textSecondary} size={15} />
                                    <Text style={styles.ghostBtnText}>ذخیره</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    disabled={!card || busy}
                                    onPress={() => shareCard(false)}
                                    style={[styles.primaryBtn, styles.actionBtn]}
                                >
                                    {busy
                                        ? <ActivityIndicator size="small" color="#fff" />
                                        : <><Share2 color="#fff" size={15} /><Text style={styles.primaryBtnText}>اشتراک‌گذاری</Text></>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <GlassToast
                visible={toastVisible}
                message={toastMessage}
                type={toastType}
                onHide={() => setToastVisible(false)}
            />
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
    dim: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    iconBtn: { padding: 8, borderRadius: 10 },
    headerTitle: { flex: 1, fontSize: 19, fontWeight: '700', color: colors.text },
    calToggle: {
        flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    calToggleText: { fontSize: 11.5, color: colors.primary, fontWeight: '700' },

    // row-reverse: in a right-to-left month strip the past sits on the
    // right, so the "previous month" arrow belongs there too.
    monthNav: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    navBtn: { padding: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    monthLabel: { fontSize: 17, fontWeight: '700', color: colors.text },
    monthNet: { fontSize: 14, fontWeight: '700', marginTop: 2 },

    card: {
        borderRadius: 16, padding: 14, marginBottom: 12,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowStart: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rowEnd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
    noteText: { fontSize: 11.5, color: colors.textSecondary, marginTop: 6, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
    streakBig: { fontSize: 26, fontWeight: '800' },

    weekHead: { flexDirection: 'row-reverse', marginBottom: 6 },
    weekHeadCell: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
    grid: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
    cellWrap: { width: `${100 / 7}%`, padding: 2 },
    cell: {
        aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    cellToday: { borderColor: colors.primary, borderWidth: 1.6 },
    cellDay: { fontSize: 12, fontWeight: '700', color: colors.text },
    cellNet: { fontSize: 8.5, fontWeight: '700', marginTop: 1 },
    legendRow: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 10 },
    legendSwatch: { width: 11, height: 11, borderRadius: 3, marginLeft: 4 },
    legendText: { fontSize: 10, color: colors.textSecondary, marginLeft: 8 },

    factsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 4 },
    factCell: { alignItems: 'center', flex: 1 },
    factLabel: { fontSize: 10.5, color: colors.textSecondary },
    factValue: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 3 },

    habitRow: {
        flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 8,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 6,
    },
    habitMeta: { flex: 1, fontSize: 11, color: colors.textSecondary, marginHorizontal: 8, textAlign: 'right' },
    habitNet: { fontSize: 12.5, fontWeight: '700' },

    tagChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
    tagChipText: { fontSize: 10.5, fontWeight: '700' },
    chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 8 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
        maxHeight: '92%', backgroundColor: colors.background,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
    },
    sheetHead: {
        flexDirection: 'row', alignItems: 'center', padding: 8,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    sheetTitle: { flex: 1, fontSize: 15.5, fontWeight: '700', color: colors.text, textAlign: 'center' },
    recapBox: {
        flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12,
        backgroundColor: isDark ? 'rgba(41,98,255,0.10)' : 'rgba(37,99,235,0.07)',
        borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(41,98,255,0.35)', marginBottom: 12,
    },
    recapText: { flex: 1, fontSize: 12.5, color: colors.text, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl' },

    tradeCard: {
        borderRadius: 14, padding: 12, marginBottom: 10,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    tradeTitle: { fontSize: 13.5, fontWeight: '700', color: colors.text },
    tradeNet: { fontSize: 14.5, fontWeight: '800' },
    sparkWrap: { marginTop: 10, marginBottom: 4 },
    entryText: { fontSize: 12.5, color: colors.text, lineHeight: 21, marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },

    noteEditor: { marginTop: 10 },
    noteInput: {
        marginTop: 8, minHeight: 70, borderRadius: 12, padding: 10, fontSize: 12.5,
        color: colors.text, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        textAlign: 'right', writingDirection: 'rtl', textAlignVertical: 'top',
        // On web the default focus ring is a heavy black outline; keep the
        // ring (it is the only focus cue a keyboard user gets) but tint it.
        ...(Platform.OS === 'web' ? { outlineColor: colors.primary, outlineWidth: 1, outlineStyle: 'solid' } : {}),
    },
    emotionChip: {
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    emotionText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
    noteBox: {
        marginTop: 10, padding: 10, borderRadius: 12,
        backgroundColor: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.025)',
        borderLeftWidth: 2, borderLeftColor: colors.primary,
    },
    noteEmotion: { fontSize: 10.5, color: colors.primary, fontWeight: '700', textAlign: 'right' },
    noteOwn: { fontSize: 12.5, color: colors.text, marginTop: 4, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl' },
    addNoteBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 10 },
    addNoteText: { fontSize: 11.5, color: colors.primary, fontWeight: '700' },

    primaryBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 10, backgroundColor: colors.primary,
    },
    primaryBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    ghostBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    ghostBtnText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    autopsyLink: { marginTop: 10, alignItems: 'flex-end' },
    autopsyLinkText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
    cardFooterRow: {
        flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    },
    shareChip: {
        flexDirection: 'row-reverse', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primary,
    },
    shareChipText: { fontSize: 11, color: colors.primary, fontWeight: '700' },

    cardSheet: {
        maxHeight: '94%', backgroundColor: colors.background,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
    },
    // 1080x1350 is 4:5 — the aspect ratio the card is composed at, so the
    // preview is the image, not an approximation of it.
    cardPreview: {
        width: '100%', aspectRatio: 1080 / 1350, borderRadius: 14, overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        backgroundColor: isDark ? '#0B0E13' : '#FFFFFF',
    },
    previewLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    captureHost: {
        position: 'absolute', left: -10000, top: 0,
        width: CAPTURE_W, height: CAPTURE_H,
    },
    optRow: {
        flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    optLabel: { flex: 1, fontSize: 12.5, color: colors.text, textAlign: 'right', writingDirection: 'rtl' },
    privacyNote: {
        fontSize: 11, color: colors.textSecondary, marginTop: 12, lineHeight: 18,
        textAlign: 'right', writingDirection: 'rtl',
    },
    actionRow: { flexDirection: 'row-reverse', gap: 10, marginTop: 16 },
    actionBtn: {
        flex: 1, flexDirection: 'row-reverse', alignItems: 'center',
        justifyContent: 'center', gap: 6,
    },
});
