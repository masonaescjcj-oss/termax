// @ts-nocheck
/**
 * PORTFOLIO RISK — what the open positions actually add up to.
 *
 * Three longs on EUR/USD, GBP/USD and AUD/USD are not three positions;
 * they are one bet against the dollar at triple size. Every number here
 * is computed server-side from the open book — currency netting exactly,
 * correlation empirically and always with its sample size — so the screen
 * only lays them out.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    View, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { Text } from '../components/Typography';
import axios from 'axios';
import {
    ChevronLeft, PieChart, AlertTriangle, Info, ShieldAlert, Link2, Layers,
} from 'lucide-react-native';
import GlassView from '../components/GlassView';
import { useTheme } from '../theme/ThemeContext';
import { BACKEND_URL, getTgSafeAreaTop, isTelegram } from '../config';
import GlassToast from '../components/GlassToast';
import { getItemAsync } from '../utils/storage';

const api = async (path: string) => {
    const token = await getItemAsync('accessToken');
    return axios.get(`${BACKEND_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
};

const money = (v: any) => (typeof v === 'number' ? `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}` : '—');
/** Compact, for exposure figures that run to six digits. */
const big = (v: number) => {
    const a = Math.abs(v);
    const s = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(2)}M`
        : a >= 10_000 ? `${(a / 1_000).toFixed(1)}k`
        // Under $10k the exact figure still fits, and "1.6k" for a risk
        // number reads as an evasion.
        : a >= 1_000 ? Math.round(a).toLocaleString('en-US')
        : a.toFixed(2);
    return `${v < 0 ? '-' : ''}$${s}`;
};

const CCY_NAME = {
    USD: 'US dollar', EUR: 'Euro', GBP: 'Pound', JPY: 'Yen', CHF: 'Franc',
    AUD: 'Aussie dollar', CAD: 'Canadian dollar', NZD: 'Kiwi dollar',
    XAU: 'Gold', XAG: 'Silver', BTC: 'Bitcoin', ETH: 'Ether', USDT: 'Tether',
};

const sevColour = (s: string, colors: any) =>
    s === 'ALERT' ? colors.danger : s === 'WARN' ? '#F5A623' : colors.primary;

export default function PortfolioScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api('/api/v1/insights/portfolio');
            if (res.data?.success) setReport(res.data.data);
        } catch (e: any) {
            setToastMessage(e?.response?.data?.message || 'Could not load portfolio risk');
            setToastVisible(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const topPad = isTelegram ? getTgSafeAreaTop() : 0;
    const legs = report?.exposure?.legs ?? [];

    return (
        <SafeAreaView style={[styles.safe, { paddingTop: topPad }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <ChevronLeft color={colors.text} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Portfolio risk</Text>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : !report ? (
                <View style={styles.center}><Text style={styles.dim}>Unavailable.</Text></View>
            ) : report.positions === 0 ? (
                <View style={styles.center}>
                    <PieChart color={colors.textSecondary} size={40} />
                    <Text style={[styles.dim, { marginTop: 12 }]}>
                        No open positions. This page only speaks about what is open right now.
                    </Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
                >
                    {/* what the engine concluded, worst first */}
                    {report.findings?.length > 0 && (
                        <GlassView intensity={14} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <ShieldAlert color={colors.primary} size={18} />
                                <Text style={styles.cardTitle}>What this book really is</Text>
                            </View>
                            {report.findings.map((f: any, i: number) => (
                                <View key={i} style={styles.findingRow}>
                                    {f.severity === 'ALERT'
                                        ? <AlertTriangle color={colors.danger} size={16} />
                                        : f.severity === 'WARN'
                                            ? <AlertTriangle color={'#F5A623'} size={16} />
                                            : <Info color={colors.primary} size={16} />}
                                    <Text style={[styles.findingText, { color: sevColour(f.severity, colors) }]}>
                                        {f.en}
                                    </Text>
                                </View>
                            ))}
                        </GlassView>
                    )}

                    {/* currency exposure — exact arithmetic */}
                    <GlassView intensity={14} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <PieChart color={colors.primary} size={18} />
                            <Text style={styles.cardTitle}>Currency exposure</Text>
                        </View>
                        <Text style={styles.noteText}>
                            Every position has two legs: long EUR/USD is long the euro and short the dollar.
                            Netting the legs across the book shows what you are really betting on. Book size:
                            {' '}{big(report.exposure.gross)}. The shares do not add up to 100% — each position is
                            counted in two currencies.
                        </Text>
                        {legs.map((l: any) => (
                            <View key={l.currency} style={styles.legRow}>
                                <View style={styles.legHead}>
                                    <Text style={styles.legName}>
                                        {CCY_NAME[l.currency] ?? l.currency}
                                        <Text style={styles.legCode}>  {l.currency}</Text>
                                    </Text>
                                    <Text style={[styles.legValue, { color: l.exposure >= 0 ? colors.success : colors.danger }]}>
                                        {l.exposure >= 0 ? 'Long ' : 'Short '}{big(Math.abs(l.exposure))}
                                    </Text>
                                </View>
                                <View style={styles.barTrack}>
                                    {/* Absolute width, not scaled to the
                                        biggest leg: a share can never exceed
                                        100% of the book, so the bar can match
                                        the number it is labelled with. */}
                                    <View style={[styles.barFill, {
                                        width: `${Math.min(100, l.sharePct)}%`,
                                        backgroundColor: l.exposure >= 0 ? colors.success : colors.danger,
                                    }]} />
                                </View>
                                <Text style={styles.legMeta}>{l.sharePct}% of the book · {l.symbols.join(', ')}</Text>
                            </View>
                        ))}
                        {report.exposure.skipped?.length > 0 && (
                            <Text style={styles.noteText}>
                                {report.exposure.skipped.join(', ')}: no conversion rate for these, so they are
                                not in the figures above — reported rather than dropped.
                            </Text>
                        )}
                    </GlassView>

                    {/* risk if the stops all fill */}
                    <GlassView intensity={14} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Layers color={colors.primary} size={18} />
                            <Text style={styles.cardTitle}>If every stop is hit</Text>
                        </View>
                        <Text style={[styles.bigNumber, { color: colors.danger }]}>
                            {big(report.risk.ifAllStopsHit)}
                        </Text>
                        {report.risk.unstopped?.length > 0 && (
                            <Text style={[styles.noteText, { color: colors.danger }]}>
                                {report.risk.unstopped.length} position(s) have no stop, and a loss with no number
                                cannot be in this total. The figure above is the floor of the risk, not the ceiling.
                            </Text>
                        )}
                        {report.risk.perPosition?.filter((p: any) => p.risk !== null).map((p: any) => (
                            <View key={p.id} style={styles.riskRow}>
                                <Text style={styles.riskSymbol}>{p.symbol}</Text>
                                <Text style={styles.riskValue}>{money(p.risk)}</Text>
                            </View>
                        ))}
                        {report.risk.unstopped?.map((p: any) => (
                            <View key={p.id} style={styles.riskRow}>
                                <Text style={styles.riskSymbol}>{p.symbol}</Text>
                                <Text style={[styles.riskValue, { color: colors.danger }]}>no stop</Text>
                            </View>
                        ))}
                    </GlassView>

                    {/* correlation — an estimate, so it carries its sample */}
                    {report.correlations?.length > 0 && (
                        <GlassView intensity={14} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Link2 color={colors.primary} size={18} />
                                <Text style={styles.cardTitle}>Correlation</Text>
                            </View>
                            <Text style={styles.noteText}>
                                From daily returns on stored candles, paired only on days both instruments traded.
                                This is an estimate, so the number of days is always printed beside it. Under 30
                                paired days nothing is reported at all.
                            </Text>
                            {report.correlations.map((c: any, i: number) => (
                                <View key={i} style={styles.corrRow}>
                                    <Text style={styles.corrPair}>{c.a} ↔ {c.b}</Text>
                                    <Text style={styles.corrDays}>{c.days} days</Text>
                                    <Text style={[styles.corrR, {
                                        color: Math.abs(c.r) >= 0.7 ? colors.danger
                                            : Math.abs(c.r) >= 0.4 ? '#F5A623' : colors.textSecondary,
                                    }]}>{c.r}</Text>
                                </View>
                            ))}
                            {report.clusters?.filter((g: any) => g.length > 1).length > 0 && (
                                <Text style={styles.noteText}>
                                    Move together: {report.clusters.filter((g: any) => g.length > 1)
                                        .map((g: any) => g.join('+')).join(' · ')}
                                </Text>
                            )}
                        </GlassView>
                    )}
                </ScrollView>
            )}

            <GlassToast
                visible={toastVisible}
                message={toastMessage}
                type="error"
                onHide={() => setToastVisible(false)}
            />
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 34 },
    dim: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 21 },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    iconBtn: { padding: 8, borderRadius: 10 },
    headerTitle: { flex: 1, fontSize: 19, fontWeight: '700', color: colors.text },

    card: {
        borderRadius: 16, padding: 14, marginBottom: 12,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'left' },
    noteText: {
        fontSize: 11.5, color: colors.textSecondary, marginTop: 8, lineHeight: 19,
        textAlign: 'left',
    },
    findingRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    },
    findingText: { flex: 1, fontSize: 12.5, lineHeight: 21, textAlign: 'left' },

    legRow: { marginTop: 12 },
    legHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    legName: { fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'left' },
    legCode: { fontSize: 10.5, color: colors.textSecondary, fontWeight: '400' },
    legValue: { fontSize: 12.5, fontWeight: '700' },
    barTrack: {
        height: 8, borderRadius: 4, marginTop: 6, overflow: 'hidden',
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        flexDirection: 'row',
    },
    barFill: { height: 8, borderRadius: 4 },
    legMeta: { fontSize: 10.5, color: colors.textSecondary, marginTop: 4, textAlign: 'left' },

    bigNumber: { fontSize: 30, fontWeight: '800', textAlign: 'center', marginVertical: 6 },
    riskRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 6,
    },
    riskSymbol: { fontSize: 12.5, color: colors.text, fontWeight: '600' },
    riskValue: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '700' },

    corrRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 7,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 6,
    },
    corrPair: { flex: 1, fontSize: 12.5, color: colors.text, textAlign: 'left' },
    corrDays: { fontSize: 10.5, color: colors.textSecondary, marginHorizontal: 8 },
    corrR: { fontSize: 13.5, fontWeight: '800' },
});
