// @ts-nocheck
/**
 * TRADE DNA — the trader's behavioural profile, and the one-tap trade
 * autopsy. Everything shown here is counted server-side from the user's
 * own closed trades; the Persian sentences arrive pre-rendered from the
 * evidence, so the screen only lays them out.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    View, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
    Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Text } from '../components/Typography';
import axios from 'axios';
import {
    ChevronLeft, Dna, AlertTriangle, Info, Flame, Microscope, Clock,
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

export default function TradeDnaScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    const [view, setView] = useState<'dna' | 'autopsy'>('dna');
    const [profile, setProfile] = useState<any>(null);
    const [closed, setClosed] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autopsy, setAutopsy] = useState<any>(null);
    const [autopsyLoading, setAutopsyLoading] = useState(false);

    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const showToast = (msg, type) => { setToastMessage(msg); setToastType(type); setToastVisible(true); };

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [dnaRes, posRes] = await Promise.all([
                api('/api/v1/insights/dna'),
                api('/api/v1/trade/positions?status=CLOSED').catch(() => ({ data: { data: [] } })),
            ]);
            if (dnaRes.data?.success) setProfile(dnaRes.data.data);
            const rows = posRes.data?.data ?? posRes.data ?? [];
            setClosed((Array.isArray(rows) ? rows : [])
                .filter((p: any) => p.status === 'CLOSED')
                .sort((a: any, b: any) => new Date(b.closeTime ?? 0).getTime() - new Date(a.closeTime ?? 0).getTime())
                .slice(0, 15));
        } catch (e: any) {
            showToast(e.response?.status === 401 ? 'Please log in first' : 'Could not load your Trade DNA', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!isTelegram) return;
        (window as any).customTelegramBackHandler = () => {
            if (view !== 'dna') { setView('dna'); return true; }
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('MainTabs', { screen: 'Watchlist' });
            return true;
        };
        return () => { (window as any).customTelegramBackHandler = undefined; };
    }, [view, navigation]);

    const openAutopsy = async (pos: any) => {
        setView('autopsy');
        setAutopsy(null);
        setAutopsyLoading(true);
        try {
            const res = await api(`/api/v1/insights/autopsy/${pos.id ?? pos._id}`);
            if (res.data?.success) setAutopsy(res.data.data);
        } catch (e: any) {
            showToast(e.response?.data?.message || 'Autopsy unavailable for this trade', 'error');
            setView('dna');
        } finally { setAutopsyLoading(false); }
    };

    const SevIcon = ({ severity }: any) => severity === 'ALERT'
        ? <Flame color={colors.danger} size={18} />
        : severity === 'WARN'
            ? <AlertTriangle color={'#F5A623'} size={18} />
            : <Info color={colors.primary} size={18} />;

    const Header = ({ title, onBack }: any) => (
        <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                <ChevronLeft color={colors.text} size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
        </View>
    );

    // Tiny hour heatmap from the buckets — pure Views, no chart lib.
    const HourStrip = ({ hourly }: any) => {
        const max = Math.max(1, ...hourly.map((b: any) => Math.abs(b.netProfit)));
        return (
            <View>
                <View style={styles.hourRow}>
                    {hourly.map((b: any) => {
                        const mag = Math.abs(b.netProfit) / max;
                        const bg = b.trades === 0
                            ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                            : b.netProfit >= 0
                                ? `rgba(8,153,129,${0.25 + 0.75 * mag})`
                                : `rgba(242,54,69,${0.25 + 0.75 * mag})`;
                        return <View key={b.bucket} style={[styles.hourCell, { backgroundColor: bg }]} />;
                    })}
                </View>
                <View style={styles.hourLabels}>
                    <Text style={styles.hourLabel}>0</Text>
                    <Text style={styles.hourLabel}>6</Text>
                    <Text style={styles.hourLabel}>12</Text>
                    <Text style={styles.hourLabel}>18</Text>
                    <Text style={styles.hourLabel}>23 UTC</Text>
                </View>
            </View>
        );
    };

    const renderDna = () => (
        <>
            <Header title="Trade DNA" onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Watchlist' }))} />
            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
            >
                {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /> : !profile ? null : (
                    <>
                        {profile.trades < 10 && (
                            <GlassView intensity={14} style={styles.card}>
                                <Text style={styles.noteText}>هنوز {profile.trades} معامله‌ی بسته دارید. با معاملات بیشتر، الگوهای رفتاری‌تان اینجا شمرده می‌شود — نه حدس زده.</Text>
                            </GlassView>
                        )}

                        {profile.findings.length > 0 && (
                            <GlassView intensity={14} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Dna color={colors.primary} size={18} />
                                    <Text style={styles.cardTitle}>الگوهای شما</Text>
                                </View>
                                {profile.findings.map((f: any, i: number) => (
                                    <View key={i} style={styles.findingRow}>
                                        <SevIcon severity={f.severity} />
                                        <Text style={styles.findingText}>{f.fa}</Text>
                                    </View>
                                ))}
                            </GlassView>
                        )}

                        {profile.trades >= 5 && (
                            <GlassView intensity={14} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Clock color={colors.primary} size={18} />
                                    <Text style={styles.cardTitle}>سود/زیان بر حسب ساعت (UTC)</Text>
                                </View>
                                <HourStrip hourly={profile.hourly} />
                            </GlassView>
                        )}

                        <GlassView intensity={14} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Microscope color={colors.primary} size={18} />
                                <Text style={styles.cardTitle}>کالبدشکافی معامله</Text>
                            </View>
                            <Text style={styles.noteText}>روی هر معامله‌ی بسته بزنید تا از روی کندل‌های واقعی بگوید چرا این نتیجه را داد.</Text>
                            {closed.length === 0 && <Text style={styles.noteText}>معامله‌ی بسته‌ای ندارید.</Text>}
                            {closed.map((p: any) => (
                                <TouchableOpacity key={String(p.id ?? p._id)} style={styles.tradeRow} onPress={() => openAutopsy(p)}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.tradeSymbol}>{p.side} {p.volume} {p.symbol}</Text>
                                        <Text style={styles.tradeMeta}>{p.closeTime ? new Date(p.closeTime).toLocaleDateString() : ''}</Text>
                                    </View>
                                    <Text style={[styles.tradePnl, { color: (p.finalProfit ?? 0) >= 0 ? colors.success : colors.danger }]}>
                                        {money(p.finalProfit)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </GlassView>
                    </>
                )}
                <View style={{ height: 50 }} />
            </ScrollView>
        </>
    );

    const renderAutopsy = () => {
        const d = autopsy;
        return (
            <>
                <Header title="چرا این نتیجه؟" onBack={() => setView('dna')} />
                <ScrollView contentContainerStyle={styles.content}>
                    {autopsyLoading || !d ? <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /> : (
                        <>
                            <GlassView intensity={14} style={styles.card}>
                                <Text style={styles.cardTitle}>{d.trade.side} {d.trade.volume} {d.trade.symbol}</Text>
                                <Text style={[styles.tradePnl, { color: d.trade.netProfit >= 0 ? colors.success : colors.danger, fontSize: 22, marginTop: 4 }]}>
                                    {money(d.trade.netProfit)}
                                </Text>
                                <View style={styles.factsRow}>
                                    <View style={styles.factCell}><Text style={styles.factLabel}>نتیجه</Text><Text style={styles.factValue}>{d.facts.pips} pips</Text></View>
                                    <View style={styles.factCell}><Text style={styles.factLabel}>بهترین لحظه</Text><Text style={[styles.factValue, { color: colors.success }]}>+{d.facts.mfePips}</Text></View>
                                    <View style={styles.factCell}><Text style={styles.factLabel}>بدترین لحظه</Text><Text style={[styles.factValue, { color: colors.danger }]}>-{d.facts.maePips}</Text></View>
                                </View>
                                <View style={styles.factsRow}>
                                    <View style={styles.factCell}><Text style={styles.factLabel}>بعد از خروج</Text><Text style={styles.factValue}>{d.facts.afterExitPips} pips</Text></View>
                                    <View style={styles.factCell}><Text style={styles.factLabel}>حد ضرر</Text><Text style={styles.factValue}>{d.facts.stopPips ?? '—'} pips</Text></View>
                                    <View style={styles.factCell}><Text style={styles.factLabel}>هزینه‌ها</Text><Text style={styles.factValue}>{money(d.facts.costs)}</Text></View>
                                </View>
                            </GlassView>

                            <GlassView intensity={14} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Microscope color={colors.primary} size={18} />
                                    <Text style={styles.cardTitle}>یافته‌ها</Text>
                                </View>
                                {d.verdicts.map((v: any, i: number) => (
                                    <View key={i} style={styles.findingRow}>
                                        <SevIcon severity={v.key === 'cleanLossOrWin' ? 'INFO' : 'ALERT'} />
                                        <Text style={styles.findingText}>{v.fa}</Text>
                                    </View>
                                ))}
                                <Text style={styles.noteText}>محاسبه‌شده از کندل‌های {d.timeframe} واقعی اطراف ورود و خروج — نه حدس.</Text>
                            </GlassView>
                        </>
                    )}
                    <View style={{ height: 50 }} />
                </ScrollView>
            </>
        );
    };

    return (
        <SafeAreaView style={[styles.safeArea, { paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() }]}>
            {view === 'dna' ? renderDna() : renderAutopsy()}
            <GlassToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
    backBtn: { padding: 6 },
    headerTitle: { fontSize: 19, fontWeight: '700', color: colors.text, marginLeft: 4 },
    content: { paddingHorizontal: 14, paddingTop: 6 },
    card: { borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    noteText: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 20, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
    findingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
    findingText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl' },
    hourRow: { flexDirection: 'row', gap: 2, marginTop: 4 },
    hourCell: { flex: 1, height: 26, borderRadius: 4 },
    hourLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    hourLabel: { fontSize: 10, color: colors.textSecondary },
    tradeRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 6,
    },
    tradeSymbol: { fontSize: 13.5, fontWeight: '600', color: colors.text },
    tradeMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    tradePnl: { fontSize: 14.5, fontWeight: '700' },
    factsRow: { flexDirection: 'row', marginTop: 12 },
    factCell: { flex: 1 },
    factLabel: { fontSize: 11, color: colors.textSecondary, textAlign: 'right', writingDirection: 'rtl' },
    factValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2, textAlign: 'right' },
});
