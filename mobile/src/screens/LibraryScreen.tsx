// @ts-nocheck
/**
 * STRATEGY LIBRARY — the leaderboard of published bots, ranked by their
 * LIVE forward-test record. No backtests on this board, by design: a
 * library of curve-fit backtests would be a casino brochure.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    View, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
    Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Text } from '../components/Typography';
import axios from 'axios';
import { ChevronLeft, Trophy, Copy, User as UserIcon, ChevronDown, ChevronUp } from 'lucide-react-native';
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

const money = (v: any) => (typeof v === 'number' ? `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}` : '—');
const pct = (v: any) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '—');

export default function LibraryScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [cloning, setCloning] = useState<string | null>(null);

    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const showToast = (msg, type) => { setToastMessage(msg); setToastType(type); setToastVisible(true); };

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api('get', '/api/v1/library');
            if (res.data?.success) setRows(res.data.data ?? []);
        } catch (e: any) {
            showToast(e.response?.status === 401 ? 'Please log in first' : 'Could not load the library', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

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

    const clone = async (row: any) => {
        setCloning(row.id);
        try {
            const res = await api('post', `/api/v1/library/${row.id}/clone`);
            if (res.data?.success) {
                showToast('Cloned — it starts STOPPED so you run your own forward test', 'success');
                load(true);
            }
        } catch (e: any) {
            showToast(e.response?.data?.message || 'Clone failed', 'error');
        } finally { setCloning(null); }
    };

    const medal = (rank: number) => rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`;

    return (
        <SafeAreaView style={[styles.safeArea, { paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Watchlist' }))} style={styles.backBtn}>
                    <ChevronLeft color={colors.text} size={24} />
                </TouchableOpacity>
                <Trophy color={'#F5A623'} size={20} />
                <Text style={styles.headerTitle}>Strategy Library</Text>
            </View>
            <Text style={styles.subLine}>Ranked by LIVE forward-test results — never backtests.</Text>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
            >
                {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /> :
                rows.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Trophy color={colors.textSecondary} size={40} />
                        <Text style={styles.emptyTitle}>The board is empty</Text>
                        <Text style={styles.emptyText}>Publish a bot after it completes its forward test — the first name on the leaderboard is remembered.</Text>
                    </View>
                ) : rows.map((row, i) => (
                    <GlassView key={row.id} intensity={14} style={styles.card}>
                        <TouchableOpacity onPress={() => setExpanded(expanded === row.id ? null : row.id)}>
                            <View style={styles.cardTop}>
                                <Text style={styles.rank}>{medal(i)}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.title} numberOfLines={1}>{row.title}</Text>
                                    <View style={styles.metaRow}>
                                        <UserIcon color={colors.textSecondary} size={11} />
                                        <Text style={styles.meta}>{row.author}{row.mine ? ' (you)' : ''} · {row.symbol} · {row.timeframe}</Text>
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.netText, { color: (row.forward?.netProfit ?? 0) >= 0 ? colors.success : colors.danger }]}>
                                        {money(row.forward?.netProfit)}
                                    </Text>
                                    <Text style={styles.meta}>{row.forward?.trades ?? 0} trades · {pct(row.forward?.winRate)}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {expanded === row.id && (
                            <>
                                <View style={styles.statRow}>
                                    <View style={styles.statCell}><Text style={styles.statLabel}>Profit factor</Text><Text style={styles.statValue}>{typeof row.forward?.profitFactor === 'number' ? row.forward.profitFactor.toFixed(2) : '∞'}</Text></View>
                                    <View style={styles.statCell}><Text style={styles.statLabel}>Expectancy</Text><Text style={styles.statValue}>{money(row.forward?.expectancy)}</Text></View>
                                    <View style={styles.statCell}><Text style={styles.statLabel}>Max DD</Text><Text style={[styles.statValue, { color: colors.danger }]}>{money(row.forward?.maxDrawdown)}</Text></View>
                                </View>
                                {row.description ? <Text style={styles.desc}>{row.description}</Text> : null}
                                {Array.isArray(row.rules) && (
                                    <View style={styles.rulesBox}>
                                        {row.rules.map((line: string, k: number) => (
                                            <Text key={k} style={styles.ruleLine}>• {line}</Text>
                                        ))}
                                    </View>
                                )}
                                {!row.mine && (
                                    <TouchableOpacity onPress={() => clone(row)} disabled={cloning === row.id}>
                                        <LinearGradient colors={[colors.primary, '#1E4FD6']} style={styles.cloneBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                            {cloning === row.id ? <ActivityIndicator color="#FFF" size="small" /> : <Copy color="#FFF" size={15} />}
                                            <Text style={styles.cloneBtnText}>Clone to my bots ({row.clones})</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </GlassView>
                ))}
                <View style={{ height: 50 }} />
            </ScrollView>
            <GlassToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
    backBtn: { padding: 6 },
    headerTitle: { fontSize: 19, fontWeight: '700', color: colors.text },
    subLine: { fontSize: 11.5, color: colors.textSecondary, paddingHorizontal: 20, marginBottom: 8 },
    content: { paddingHorizontal: 14, paddingTop: 4 },
    emptyBox: { alignItems: 'center', marginTop: 70, paddingHorizontal: 30 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 14 },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 19 },
    card: { borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rank: { fontSize: 20, width: 34, textAlign: 'center' },
    title: { fontSize: 15, fontWeight: '700', color: colors.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    meta: { fontSize: 11.5, color: colors.textSecondary },
    netText: { fontSize: 16, fontWeight: '800' },
    statRow: { flexDirection: 'row', marginTop: 12 },
    statCell: { flex: 1 },
    statLabel: { fontSize: 11, color: colors.textSecondary },
    statValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },
    desc: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 19, marginTop: 10 },
    rulesBox: { marginTop: 10 },
    ruleLine: { fontSize: 12.5, color: colors.text, lineHeight: 21, textAlign: 'right', writingDirection: 'rtl', marginTop: 2 },
    cloneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, marginTop: 12 },
    cloneBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
