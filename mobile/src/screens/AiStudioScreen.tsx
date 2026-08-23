// @ts-nocheck
/**
 * AI STUDIO — everything that has been built in this app, categorised:
 * bots, custom indicators, backtests. Each item shows WHERE it came from
 * (AI / hand-made / imported / cloned), can be shared as text, exported
 * as a downloadable .json file, and a file from someone else can be
 * imported — validated by the same server-side validator as everything.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    View, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
    Platform, ActivityIndicator, RefreshControl, Share, Modal,
} from 'react-native';
import { Text, TextInput } from '../components/Typography';
import axios from 'axios';
import {
    ChevronLeft, Bot as BotIcon, Activity, BarChart3, Share2, Download,
    Upload, Sparkles, FileJson, X, LineChart, Trash2, Code2,
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

const money = (v: any) => (typeof v === 'number' ? `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}` : '—');

const ORIGIN_LABEL: any = { AI: { text: 'AI', color: '#A78BFA' }, IMPORT: { text: 'Imported', color: '#38BDF8' }, CLONE: { text: 'Cloned', color: '#F5A623' }, USER: { text: 'Manual', color: '#94A3B8' } };
const GRADE_COLORS: any = { A: '#089981', B: '#26a69a', C: '#F5A623', D: '#F97316', F: '#F23645' };

/** Hand the JSON to the user: real file download on web, share sheet on native. */
async function deliverFile(filename: string, jsonText: string) {
    if (Platform.OS === 'web') {
        const blob = new Blob([jsonText], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    } else {
        await Share.share({ message: jsonText, title: filename });
    }
}

export default function AiStudioScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    const [tab, setTab] = useState<'bots' | 'indicators' | 'backtests'>('bots');
    const [bots, setBots] = useState<any[]>([]);
    const [indicators, setIndicators] = useState<any[]>([]);
    const [backtests, setBacktests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [importOpen, setImportOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [importing, setImporting] = useState(false);

    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const showToast = (msg, type) => { setToastMessage(msg); setToastType(type); setToastVisible(true); };

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [b, i, t] = await Promise.all([
                api('get', '/api/v1/bots').catch(() => ({ data: { data: [] } })),
                api('get', '/api/v1/indicators').catch(() => ({ data: { data: [] } })),
                api('get', '/api/v1/backtests').catch(() => ({ data: { data: [] } })),
            ]);
            setBots(b.data?.data ?? []);
            setIndicators(i.data?.data ?? []);
            setBacktests(t.data?.data ?? []);
        } catch {
            showToast('Could not load your studio', 'error');
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

    // ── export / share ──────────────────────────────────────────────
    const exportItem = async (kind: 'bot' | 'indicator', item: any, share = false) => {
        try {
            const path = kind === 'bot' ? `/api/v1/bots/${item.id}/export` : `/api/v1/indicators/${item.id}/export`;
            const res = await api('get', path);
            const jsonText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
            const filename = `${(item.name || kind).replace(/\s+/g, '_')}.termax-${kind}.json`;
            if (share) {
                if (Platform.OS === 'web' && (navigator as any).share) {
                    await (navigator as any).share({ title: item.name, text: jsonText }).catch(() => {});
                } else if (Platform.OS === 'web') {
                    await navigator.clipboard.writeText(jsonText);
                    showToast('Copied to clipboard — paste it anywhere to share', 'success');
                    return;
                } else {
                    await Share.share({ message: jsonText, title: item.name });
                }
            } else {
                await deliverFile(filename, jsonText);
                if (Platform.OS === 'web') showToast('File downloaded', 'success');
            }
        } catch (e: any) {
            showToast(e.response?.data?.message || 'Export failed', 'error');
        }
    };

    const runImport = async () => {
        if (!importText.trim()) return;
        setImporting(true);
        try {
            let parsed: any = null;
            try { parsed = JSON.parse(importText); } catch { throw new Error('این متن JSON معتبر نیست'); }
            const isIndicator = parsed?.format === 'termax-indicator' || (parsed?.expr && !parsed?.spec && !parsed?.entry);
            const path = isIndicator ? '/api/v1/indicators/import' : '/api/v1/bots/import';
            const res = await api('post', path, { payload: parsed });
            if (res.data?.success) {
                showToast(isIndicator ? 'Indicator imported ✓' : 'Bot imported — it starts STOPPED ✓', 'success');
                setImportOpen(false);
                setImportText('');
                load(true);
            }
        } catch (e: any) {
            const errs = e.response?.data?.errors;
            showToast(errs?.length ? `${e.response.data.message}: ${errs[0].path ?? ''} ${errs[0].message}` : (e.response?.data?.message || e.message), 'error');
        } finally { setImporting(false); }
    };

    // ── pieces ──────────────────────────────────────────────────────
    const OriginBadge = ({ origin }: any) => {
        const o = ORIGIN_LABEL[origin] ?? ORIGIN_LABEL.USER;
        return (
            <View style={[styles.originBadge, { borderColor: o.color }]}>
                {origin === 'AI' && <Sparkles color={o.color} size={10} />}
                <Text style={[styles.originText, { color: o.color }]}>{o.text}</Text>
            </View>
        );
    };

    const ActionIcon = ({ Icon, onPress, color }: any) => (
        <TouchableOpacity style={styles.actionIcon} onPress={onPress}>
            <Icon color={color ?? colors.textSecondary} size={16} />
        </TouchableOpacity>
    );

    const TabBtn = ({ id, Icon, label, count }: any) => (
        <TouchableOpacity style={[styles.tabBtn, tab === id && styles.tabBtnActive]} onPress={() => setTab(id)}>
            <Icon color={tab === id ? colors.primary : colors.textSecondary} size={15} />
            <Text style={[styles.tabText, tab === id && { color: colors.primary }]}>{label} ({count})</Text>
        </TouchableOpacity>
    );

    const renderBots = () => bots.map(bot => (
        <GlassView key={bot.id} intensity={14} style={styles.card}>
            <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{bot.name}</Text>
                    <Text style={styles.itemMeta}>{bot.spec?.symbol} · {bot.spec?.timeframe} · {bot.status === 'FORWARD_TEST' ? 'running' : bot.status?.toLowerCase()}</Text>
                </View>
                <OriginBadge origin={bot.origin} />
            </View>
            <View style={styles.actionRow}>
                <Text style={[styles.pnlText, { color: (bot.stats?.netProfit ?? 0) >= 0 ? colors.success : colors.danger }]}>
                    {money(bot.stats?.netProfit)} · {bot.stats?.trades ?? 0} trades
                </Text>
                <View style={{ flex: 1 }} />
                <ActionIcon Icon={Share2} onPress={() => exportItem('bot', bot, true)} />
                <ActionIcon Icon={Download} onPress={() => exportItem('bot', bot, false)} />
            </View>
        </GlassView>
    ));

    const renderIndicators = () => indicators.map(ind => (
        <GlassView key={ind.id} intensity={14} style={styles.card}>
            <View style={styles.cardTop}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ind.color, marginRight: 8, marginTop: 4 }} />
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.itemName} numberOfLines={1}>{ind.name}</Text>
                        {ind.kind === 'CODE' && (
                            <View style={styles.jsBadge}>
                                <Code2 color={'#FBBF24'} size={9} />
                                <Text style={styles.jsBadgeText}>JS</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.itemMeta, { fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }]} numberOfLines={2}>
                        {ind.kind === 'CODE' ? (ind.code ?? '').replace(/\s+/g, ' ').slice(0, 90) : ind.expr}
                    </Text>
                </View>
                <OriginBadge origin={ind.origin} />
            </View>
            <View style={styles.actionRow}>
                <Text style={styles.itemMeta}>{ind.pane === 'price' ? 'on price' : 'own pane'} · {ind.enabled ? 'enabled' : 'off'}</Text>
                <View style={{ flex: 1 }} />
                <ActionIcon Icon={Share2} onPress={() => exportItem('indicator', ind, true)} />
                <ActionIcon Icon={Download} onPress={() => exportItem('indicator', ind, false)} />
            </View>
        </GlassView>
    ));

    const renderBacktests = () => backtests.map(bt => (
        <GlassView key={bt.id} intensity={14} style={styles.card}>
            <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{bt.name}</Text>
                    <Text style={styles.itemMeta}>
                        {bt.spec?.symbol} · {bt.spec?.timeframe} · {new Date(bt.createdAt).toLocaleDateString()}
                        {bt.status !== 'DONE' ? ` · ${bt.status}` : ''}
                    </Text>
                </View>
                {bt.summary?.grade && (
                    <View style={[styles.gradeBadge, { backgroundColor: GRADE_COLORS[bt.summary.grade] ?? colors.textSecondary }]}>
                        <Text style={styles.gradeText}>{bt.summary.grade}</Text>
                    </View>
                )}
            </View>
            <View style={styles.actionRow}>
                {bt.summary?.stats && (
                    <Text style={[styles.pnlText, { color: (bt.summary.stats.netProfit ?? 0) >= 0 ? colors.success : colors.danger }]}>
                        {money(bt.summary.stats.netProfit)} · {bt.summary.stats.trades} trades
                    </Text>
                )}
                <View style={{ flex: 1 }} />
                {bt.status === 'DONE' && (
                    <TouchableOpacity
                        style={styles.chartLink}
                        onPress={() => navigation.navigate('MainTabs', { screen: 'Chart', params: { backtestId: bt.id, ts: Date.now() } })}
                    >
                        <LineChart color={colors.primary} size={14} />
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Chart</Text>
                    </TouchableOpacity>
                )}
            </View>
        </GlassView>
    ));

    const emptyText = tab === 'bots' ? 'No bots yet — build one with MaxAI.' : tab === 'indicators' ? 'No custom indicators yet — ask MaxAI to build one.' : 'No backtests yet.';
    const list = tab === 'bots' ? bots : tab === 'indicators' ? indicators : backtests;

    return (
        <SafeAreaView style={[styles.safeArea, { paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Watchlist' }))} style={styles.backBtn}>
                    <ChevronLeft color={colors.text} size={24} />
                </TouchableOpacity>
                <Sparkles color={'#A78BFA'} size={18} />
                <Text style={styles.headerTitle}>AI Studio</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => setImportOpen(true)}>
                    <View style={styles.importBtn}>
                        <Upload color={colors.primary} size={14} />
                        <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: '700' }}>Import</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <View style={styles.tabs}>
                <TabBtn id="bots" Icon={BotIcon} label="Bots" count={bots.length} />
                <TabBtn id="indicators" Icon={Activity} label="Indicators" count={indicators.length} />
                <TabBtn id="backtests" Icon={BarChart3} label="Backtests" count={backtests.length} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
            >
                {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /> :
                    list.length === 0 ? <Text style={styles.emptyText}>{emptyText}</Text> :
                    tab === 'bots' ? renderBots() : tab === 'indicators' ? renderIndicators() : renderBacktests()}
                <View style={{ height: 50 }} />
            </ScrollView>

            {/* import modal */}
            <Modal visible={importOpen} transparent animationType="fade" onRequestClose={() => setImportOpen(false)}>
                <View style={styles.modalBg}>
                    <GlassView intensity={30} style={styles.modalCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <FileJson color={colors.primary} size={18} />
                            <Text style={[styles.itemName, { marginLeft: 8 }]}>Import bot or indicator</Text>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity onPress={() => setImportOpen(false)}><X color={colors.textSecondary} size={20} /></TouchableOpacity>
                        </View>
                        <Text style={styles.itemMeta}>محتوای فایل .termax-bot.json یا .termax-indicator.json را اینجا paste کنید. قبل از ساخت، با همان اعتبارسنج سرور بررسی می‌شود.</Text>
                        <TextInput
                            style={styles.importInput}
                            multiline
                            value={importText}
                            onChangeText={setImportText}
                            placeholder='{"format":"termax-bot", ...}'
                            placeholderTextColor={colors.textSecondary}
                        />
                        <TouchableOpacity onPress={runImport} disabled={importing}>
                            <LinearGradient colors={[colors.primary, '#1E4FD6']} style={styles.importRun} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                {importing ? <ActivityIndicator color="#FFF" size="small" /> : <Upload color="#FFF" size={15} />}
                                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>{importing ? 'Validating…' : 'Import'}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </GlassView>
                </View>
            </Modal>

            <GlassToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
    backBtn: { padding: 6 },
    headerTitle: { fontSize: 19, fontWeight: '700', color: colors.text },
    importBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7,
        borderRadius: 18, backgroundColor: 'rgba(41,98,255,0.12)',
    },
    tabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
    tabBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    },
    tabBtnActive: { backgroundColor: 'rgba(41,98,255,0.12)' },
    tabText: { fontSize: 12.5, fontWeight: '600', color: colors.textSecondary },
    content: { paddingHorizontal: 14, paddingTop: 4 },
    emptyText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 60 },
    card: { borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
    itemName: { fontSize: 14.5, fontWeight: '700', color: colors.text },
    itemMeta: { fontSize: 11.5, color: colors.textSecondary, marginTop: 2 },
    originBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: 8,
    },
    originText: { fontSize: 10, fontWeight: '700' },
    jsBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(251,191,36,0.15)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.45)',
        paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
    },
    jsBadgeText: { fontSize: 9, fontWeight: '800', color: '#FBBF24' },
    actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    actionIcon: {
        width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', marginLeft: 8,
    },
    pnlText: { fontSize: 12.5, fontWeight: '700' },
    gradeBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, marginLeft: 8 },
    gradeText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
    chartLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(41,98,255,0.12)' },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 18 },
    modalCard: { borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? 'rgba(10,12,18,0.97)' : 'rgba(255,255,255,0.98)' },
    importInput: {
        minHeight: 130, maxHeight: 220, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        color: colors.text, padding: 10, fontSize: 11.5, textAlignVertical: 'top', marginTop: 10,
        fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    },
    importRun: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, marginTop: 10 },
});
