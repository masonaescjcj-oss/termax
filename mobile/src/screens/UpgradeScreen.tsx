// @ts-nocheck
/**
 * UPGRADE / PAYWALL — the plan comparison and today's usage.
 *
 * Two honesty rules for this screen:
 *  - The numbers come from the server's own limits table, so what the
 *    user is promised is exactly what the server enforces.
 *  - No performance claims, no "traders earn X" — an upgrade screen in a
 *    trading app is exactly where that temptation lives, and exactly
 *    where it must be refused.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    View, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
    Platform, ActivityIndicator, Linking,
} from 'react-native';
import { Text } from '../components/Typography';
import axios from 'axios';
import { ChevronLeft, Check, Crown, Zap, MessageSquare, Bot as BotIcon, Activity, Code2, BarChart3 } from 'lucide-react-native';
import GlassView from '../components/GlassView';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { BACKEND_URL, getTgSafeAreaTop, isTelegram } from '../config';
import GlassToast from '../components/GlassToast';
import { getItemAsync } from '../utils/storage';

const api = async (path: string) => {
    const token = await getItemAsync('accessToken');
    return axios.get(`${BACKEND_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
};

export default function UpgradeScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    const [plans, setPlans] = useState<any>(null);
    const [usage, setUsage] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const showToast = (msg, type) => { setToastMessage(msg); setToastType(type); setToastVisible(true); };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [p, u] = await Promise.all([
                api('/api/v1/ai/plans'),
                api('/api/v1/ai/usage').catch(() => ({ data: { data: null } })),
            ]);
            if (p.data?.success) setPlans(p.data.data);
            if (u.data?.data) setUsage(u.data.data);
        } catch (e: any) {
            showToast(e.response?.status === 401 ? 'Please log in first' : 'Could not load the plans', 'error');
        } finally { setLoading(false); }
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

    const isPro = plans?.current === 'PRO';
    const free = plans?.plans?.FREE;
    const pro = plans?.plans?.PRO;

    const ROWS = [
        { Icon: MessageSquare, label: 'AI messages per day', get: (p: any) => p?.aiMessagesPerDay },
        { Icon: BotIcon, label: 'Trading bots', get: (p: any) => p?.maxBots },
        { Icon: Activity, label: 'Custom indicators', get: (p: any) => p?.maxCustomIndicators },
        { Icon: BarChart3, label: 'Stored backtests', get: (p: any) => p?.maxStoredBacktests },
        { Icon: Code2, label: 'JavaScript indicators', get: (p: any) => (p?.codeIndicators ? '✓' : '—') },
    ];

    const usedPct = usage && usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

    return (
        <SafeAreaView style={[styles.safeArea, { paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Watchlist' }))} style={styles.backBtn}>
                    <ChevronLeft color={colors.text} size={24} />
                </TouchableOpacity>
                <Crown color={'#F5A623'} size={19} />
                <Text style={styles.headerTitle}>Plans</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /> : (
                    <>
                        {usage && (
                            <GlassView intensity={14} style={styles.card}>
                                <View style={styles.rowBetween}>
                                    <Text style={styles.cardTitle}>Today's usage</Text>
                                    <Text style={[styles.usageText, { color: usedPct >= 90 ? colors.danger : colors.text }]}>
                                        {usage.used} / {usage.limit} messages
                                    </Text>
                                </View>
                                <View style={styles.meterTrack}>
                                    <View style={[styles.meterFill, {
                                        width: `${usedPct}%`,
                                        backgroundColor: usedPct >= 90 ? colors.danger : usedPct >= 60 ? '#F5A623' : colors.success,
                                    }]} />
                                </View>
                                <Text style={styles.noteText}>
                                    {usage.remaining > 0
                                        ? `${usage.remaining} left — resets at midnight UTC.`
                                        : "Today's quota is used up. It resets at midnight UTC."}
                                    {typeof usage.toolCalls === 'number' ? ` (${usage.toolCalls} tool calls)` : ''}
                                </Text>
                            </GlassView>
                        )}

                        <GlassView intensity={14} style={styles.card}>
                            <View style={styles.planHead}>
                                <View style={styles.planCol}><Text style={styles.planColLabel}>Feature</Text></View>
                                <View style={styles.planCol}>
                                    <Text style={[styles.planName, !isPro && { color: colors.primary }]}>FREE</Text>
                                    {!isPro && <Text style={styles.currentTag}>Current</Text>}
                                </View>
                                <View style={styles.planCol}>
                                    <Text style={[styles.planName, isPro && { color: '#F5A623' }]}>PRO</Text>
                                    {isPro && <Text style={[styles.currentTag, { color: '#F5A623' }]}>Current</Text>}
                                </View>
                            </View>
                            {ROWS.map((r, i) => (
                                <View key={i} style={styles.planRow}>
                                    <View style={[styles.planCol, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                                        <r.Icon color={colors.textSecondary} size={13} />
                                        <Text style={styles.rowLabel} numberOfLines={2}>{r.label}</Text>
                                    </View>
                                    <View style={styles.planCol}><Text style={styles.rowValue}>{String(r.get(free) ?? '—')}</Text></View>
                                    <View style={styles.planCol}><Text style={[styles.rowValue, { color: '#F5A623', fontWeight: '800' }]}>{String(r.get(pro) ?? '—')}</Text></View>
                                </View>
                            ))}
                        </GlassView>

                        <GlassView intensity={14} style={styles.card}>
                            <Text style={styles.cardTitle}>In both plans</Text>
                            {[
                                'Real cost engine: two-sided spread, commission, swap, margin',
                                'Backtests with an honesty grade — no figure without its caveat',
                                'Live gate: a full forward test before real money',
                                'Bot watchdog and daily risk guard',
                                'Trade DNA and per-trade autopsy',
                            ].map((t, i) => (
                                <View key={i} style={styles.bulletRow}>
                                    <Check color={colors.success} size={14} />
                                    <Text style={styles.bulletText}>{t}</Text>
                                </View>
                            ))}
                        </GlassView>

                        {!isPro && (
                            <>
                                <TouchableOpacity onPress={() => showToast('The payment gateway is not connected yet — this button will upgrade you as soon as it is', 'info')}>
                                    <LinearGradient colors={['#F5A623', '#D68910']} style={styles.ctaBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                        <Zap color="#FFF" size={17} />
                                        <Text style={styles.ctaText}>Upgrade to PRO</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                                <Text style={[styles.noteText, { textAlign: 'center' }]}>
                                    Termax is an analysis and execution tool, not investment advice. No plan guarantees a
                        profit; trading carries the risk of losing your capital.
                                </Text>
                            </>
                        )}
                        {isPro && (
                            <GlassView intensity={14} style={[styles.card, { borderColor: 'rgba(245,166,35,0.4)' }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Crown color={'#F5A623'} size={18} />
                                    <Text style={styles.cardTitle}>PRO is active</Text>
                                </View>
                                <Text style={styles.noteText}>Every limit is set to PRO, including the JavaScript indicator tier.</Text>
                            </GlassView>
                        )}
                    </>
                )}
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
    content: { paddingHorizontal: 14, paddingTop: 4 },
    card: { borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    usageText: { fontSize: 14, fontWeight: '700' },
    meterTrack: { height: 8, borderRadius: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', marginTop: 10, overflow: 'hidden' },
    meterFill: { height: 8, borderRadius: 4 },
    noteText: { fontSize: 12, color: colors.textSecondary, lineHeight: 19, marginTop: 8, textAlign: 'left' },
    planHead: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    planRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    planCol: { flex: 1, alignItems: 'center' },
    planColLabel: { fontSize: 11, color: colors.textSecondary },
    planName: { fontSize: 14, fontWeight: '800', color: colors.text },
    currentTag: { fontSize: 9.5, color: colors.primary, marginTop: 2, fontWeight: '700' },
    rowLabel: { flex: 1, fontSize: 11.5, color: colors.text, textAlign: 'left' },
    rowValue: { fontSize: 13.5, fontWeight: '700', color: colors.text },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
    bulletText: { flex: 1, fontSize: 12.5, color: colors.text, lineHeight: 20, textAlign: 'left' },
    ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 4 },
    ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
