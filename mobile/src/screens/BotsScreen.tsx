// @ts-nocheck
/**
 * BOTS — the phase 2–6 backend, finally visible.
 *
 * Three views in one stack screen:
 *  - list:    the user's bots with live paper record and start/stop
 *  - builder: describe a strategy in plain language -> validated spec,
 *             Persian rule sheet, real backtest with honesty grade; the
 *             ONLY action button is "start forward test"
 *  - report:  forward-test scorecard, reality gap vs backtest, bot-vs-you,
 *             and the live gate's verdict
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    View, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
    Platform, ActivityIndicator, RefreshControl, Alert, Switch,
} from 'react-native';
import { Text, TextInput } from '../components/Typography';
import axios from 'axios';
import {
    Bot as BotIcon, ChevronLeft, Play, Square, Trash2, Plus, Sparkles,
    FileText, ShieldCheck, ShieldAlert, TrendingUp, RefreshCw, Rocket, LineChart, Trophy, ShieldOff, Siren, Radar,
} from 'lucide-react-native';
import GlassView from '../components/GlassView';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { BACKEND_URL, getTgSafeAreaTop, isTelegram } from '../config';
import GlassToast from '../components/GlassToast';
import { getItemAsync } from '../utils/storage';

const api = async (method: string, path: string, body?: any) => {
    const token = await getItemAsync('accessToken');
    return axios({
        method,
        url: `${BACKEND_URL}${path}`,
        data: body,
        headers: { Authorization: `Bearer ${token}` },
    });
};

const money = (v: any) => (typeof v === 'number' ? `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}` : '—');
const pct = (v: any) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '—');

const GRADE_COLORS: Record<string, string> = {
    A: '#089981', B: '#26a69a', C: '#F5A623', D: '#F97316', F: '#F23645',
};

export default function BotsScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    const [view, setView] = useState<'list' | 'builder' | 'report' | 'scan'>('list');
    const [bots, setBots] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyBotId, setBusyBotId] = useState<string | null>(null);

    // builder state
    const [description, setDescription] = useState('');
    const [building, setBuilding] = useState(false);
    const [buildResult, setBuildResult] = useState<any>(null);
    const [buildErrors, setBuildErrors] = useState<any[] | null>(null);
    const [deploying, setDeploying] = useState(false);

    // report state
    const [report, setReport] = useState<any>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [savingWatchdog, setSavingWatchdog] = useState(false);
    const [scan, setScan] = useState<any>(null);
    const [scanLoading, setScanLoading] = useState(false);

    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
    const showToast = (msg: string, type: 'success' | 'error' | 'info') => {
        setToastMessage(msg); setToastType(type); setToastVisible(true);
    };

    const loadBots = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api('get', '/api/v1/bots');
            if (res.data?.success) setBots(res.data.data ?? []);
        } catch (e: any) {
            if (e.response?.status === 401) showToast('Please log in first', 'error');
            else showToast('Could not load bots', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadBots(); }, [loadBots]);

    useEffect(() => {
        if (!isTelegram) return;
        (window as any).customTelegramBackHandler = () => {
            if (view !== 'list') { setView('list'); return true; }
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('MainTabs', { screen: 'Watchlist' });
            return true;
        };
        return () => { (window as any).customTelegramBackHandler = undefined; };
    }, [view, navigation]);

    // ── actions ─────────────────────────────────────────────────────
    const startBot = async (bot: any) => {
        setBusyBotId(bot.id);
        try {
            const res = await api('post', `/api/v1/bots/${bot.id}/start`);
            if (res.data?.success) { showToast('Forward test started', 'success'); loadBots(true); }
        } catch (e: any) {
            showToast(e.response?.data?.message || 'Could not start bot', 'error');
        } finally { setBusyBotId(null); }
    };

    const stopBot = async (bot: any) => {
        setBusyBotId(bot.id);
        try {
            const res = await api('post', `/api/v1/bots/${bot.id}/stop`);
            if (res.data?.success) { showToast('Bot stopped', 'info'); loadBots(true); }
        } catch (e: any) {
            showToast(e.response?.data?.message || 'Could not stop bot', 'error');
        } finally { setBusyBotId(null); }
    };

    const deleteBot = (bot: any) => {
        const doDelete = async () => {
            setBusyBotId(bot.id);
            try {
                const res = await api('delete', `/api/v1/bots/${bot.id}`);
                if (res.data?.success) { showToast('Bot deleted', 'info'); loadBots(true); }
            } catch (e: any) {
                showToast(e.response?.data?.message || 'Stop the bot before deleting it', 'error');
            } finally { setBusyBotId(null); }
        };
        if (Platform.OS === 'web') {
            if ((window as any).confirm?.(`Delete "${bot.name}"? Its trade history stays.`)) doDelete();
        } else {
            Alert.alert('Delete bot', `Delete "${bot.name}"? Its trade history stays.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: doDelete },
            ]);
        }
    };

    // Setup scanner: this bot's entry logic across its whole asset class.
    const runScan = async (bot: any) => {
        setView('scan');
        setScan(null);
        setScanLoading(true);
        try {
            const res = await api('post', `/api/v1/bots/${bot.id}/scan`);
            if (res.data?.success) setScan(res.data.data);
        } catch (e: any) {
            showToast(e.response?.data?.message || 'Scan failed', 'error');
            setView('list');
        } finally { setScanLoading(false); }
    };

    const openReport = async (bot: any) => {
        setView('report');
        setReport(null);
        setReportLoading(true);
        try {
            const res = await api('get', `/api/v1/bots/${bot.id}/report`);
            if (res.data?.success) setReport(res.data.data);
        } catch {
            showToast('Could not load the report', 'error');
            setView('list');
        } finally { setReportLoading(false); }
    };

    const buildFromDescription = async () => {
        if (description.trim().length < 10) {
            showToast('Describe the strategy in at least a sentence', 'error');
            return;
        }
        setBuilding(true);
        setBuildResult(null);
        setBuildErrors(null);
        try {
            const res = await api('post', '/api/v1/bots/build', { description: description.trim() });
            if (res.data?.success) setBuildResult(res.data.data);
        } catch (e: any) {
            if (e.response?.status === 429) showToast('Daily AI limit reached — resets at midnight UTC', 'error');
            else if (e.response?.status === 422) {
                setBuildErrors(e.response.data?.errors ?? []);
                showToast('The AI could not produce a valid strategy — rephrase and try again', 'error');
            } else showToast(e.response?.data?.message || 'Build failed', 'error');
        } finally { setBuilding(false); }
    };

    // The single output of the builder: save + start forward test.
    const deployBuild = async () => {
        if (!buildResult?.spec) return;
        setDeploying(true);
        try {
            const created = await api('post', '/api/v1/bots', { spec: buildResult.spec });
            const botId = created.data?.data?.id;
            if (!botId) throw new Error(created.data?.message || 'Could not save the bot');
            const started = await api('post', `/api/v1/bots/${botId}/start`);
            if (!started.data?.success) throw new Error(started.data?.message || 'Saved, but could not start');
            showToast('Forward test started 🚀', 'success');
            setBuildResult(null);
            setDescription('');
            setView('list');
            loadBots(true);
        } catch (e: any) {
            showToast(e.response?.data?.message || e.message, 'error');
        } finally { setDeploying(false); }
    };

    // The watchdog's on/off switch. Turning it OFF is a real decision, so
    // it asks once — and the server records it in the bot's audit trail.
    const setWatchdogEnabled = async (botId: string, enabled: boolean) => {
        setSavingWatchdog(true);
        try {
            const res = await api('post', `/api/v1/bots/${botId}/watchdog`, { enabled });
            if (res.data?.success) {
                setReport((r: any) => r ? { ...r, watchdog: { ...r.watchdog, config: res.data.data.config } } : r);
                showToast(enabled ? 'نگهبان روشن شد' : 'نگهبان خاموش شد — هیچ سقفی ربات را متوقف نمی‌کند', enabled ? 'success' : 'info');
            }
        } catch (e: any) {
            showToast(e.response?.data?.message || 'Could not change the watchdog', 'error');
        } finally { setSavingWatchdog(false); }
    };

    const toggleWatchdog = (botId: string, next: boolean) => {
        if (next) { setWatchdogEnabled(botId, true); return; }
        const msg = 'نگهبان را خاموش می‌کنید؟ از این پس هیچ سقف ضرری این ربات را متوقف نمی‌کند.';
        if (Platform.OS === 'web') {
            if ((window as any).confirm?.(msg)) setWatchdogEnabled(botId, false);
        } else {
            Alert.alert('Turn the watchdog off?', msg, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Turn off', style: 'destructive', onPress: () => setWatchdogEnabled(botId, false) },
            ]);
        }
    };

    const goLive = (data: any) => {
        const request = async (ack: boolean) => {
            try {
                const res = await api('post', `/api/v1/bots/${data.bot.id}/go-live`, ack ? { acknowledgeLosingRecord: true } : {});
                if (res.data?.success) {
                    showToast('Bot is LIVE at minimum volume', 'success');
                    openReport({ id: data.bot.id });
                    loadBots(true);
                }
            } catch (e: any) {
                const body = e.response?.data;
                if (body?.gate?.losingRecord && !ack) {
                    const msg = 'This bot LOST money in its forward test. Deploy live anyway?';
                    if (Platform.OS === 'web') {
                        if ((window as any).confirm?.(msg)) request(true);
                    } else {
                        Alert.alert('Losing record', msg, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Deploy anyway', style: 'destructive', onPress: () => request(true) },
                        ]);
                    }
                } else {
                    showToast(body?.message || 'Go-live refused', 'error');
                }
            }
        };
        const confirmMsg = `Deploy "${data.bot.name}" LIVE at minimum volume?`;
        if (Platform.OS === 'web') {
            if ((window as any).confirm?.(confirmMsg)) request(false);
        } else {
            Alert.alert('Go live', confirmMsg, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Go live', onPress: () => request(false) },
            ]);
        }
    };

    // ── small pieces ────────────────────────────────────────────────
    const StatusChip = ({ status }: any) => {
        const map: any = {
            STOPPED: { label: 'Stopped', color: colors.textSecondary, bg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
            FORWARD_TEST: { label: 'Forward test', color: colors.primary, bg: 'rgba(41,98,255,0.14)' },
            LIVE: { label: 'LIVE', color: '#FFF', bg: colors.danger },
        };
        const c = map[status] ?? map.STOPPED;
        return (
            <View style={[styles.chip, { backgroundColor: c.bg }]}>
                <Text style={[styles.chipText, { color: c.color }]}>{c.label}</Text>
            </View>
        );
    };

    const GradeBadge = ({ grade, score }: any) => grade ? (
        <View style={[styles.gradeBadge, { backgroundColor: GRADE_COLORS[grade] ?? colors.textSecondary }]}>
            <Text style={styles.gradeBadgeText}>{grade}</Text>
            {typeof score === 'number' && <Text style={styles.gradeScoreText}>{score}</Text>}
        </View>
    ) : null;

    const StatCell = ({ label, value, color }: any) => (
        <View style={styles.statCell}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
        </View>
    );

    const RuleSheet = ({ rules }: any) => Array.isArray(rules) && rules.length ? (
        <View style={styles.rulesBox}>
            {rules.map((line: string, i: number) => (
                <Text key={i} style={styles.ruleLine}>• {line}</Text>
            ))}
        </View>
    ) : null;

    const Header = ({ title, onBack, right }: any) => (
        <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                <ChevronLeft color={colors.text} size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={{ flex: 1 }} />
            {right}
        </View>
    );

    // ── list view ───────────────────────────────────────────────────
    const renderList = () => (
        <>
            <Header
                title="Trading Bots"
                onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Watchlist' }))}
                right={
                    <TouchableOpacity onPress={() => { setBuildResult(null); setBuildErrors(null); setView('builder'); }}>
                        <LinearGradient colors={[colors.primary, '#1E4FD6']} style={styles.newBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            <Sparkles color="#FFF" size={14} />
                            <Text style={styles.newBtnText}>New bot</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                }
            />
            <ScrollView
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBots(true); }} tintColor={colors.primary} />}
            >
                {loading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
                ) : bots.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <BotIcon color={colors.textSecondary} size={42} />
                        <Text style={styles.emptyTitle}>No bots yet</Text>
                        <Text style={styles.emptyText}>Describe a strategy in plain language and MaxAI turns it into a validated, backtested bot that trades on paper first.</Text>
                        <TouchableOpacity onPress={() => setView('builder')}>
                            <LinearGradient colors={[colors.primary, '#1E4FD6']} style={styles.emptyCta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                <Sparkles color="#FFF" size={16} />
                                <Text style={styles.emptyCtaText}>Build my first bot</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : bots.map(bot => (
                    <GlassView key={bot.id} intensity={14} style={styles.botCard}>
                        <View style={styles.botCardTop}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.botName} numberOfLines={1}>{bot.name}</Text>
                                <Text style={styles.botMeta}>{bot.spec?.symbol} · {bot.spec?.timeframe}</Text>
                            </View>
                            <StatusChip status={bot.status} />
                        </View>
                        <View style={styles.statRow}>
                            <StatCell label="Trades" value={bot.stats?.trades ?? 0} />
                            <StatCell label="Net P/L" value={money(bot.stats?.netProfit)} color={(bot.stats?.netProfit ?? 0) >= 0 ? colors.success : colors.danger} />
                            <StatCell label="Open" value={bot.stats?.openPosition ? `${bot.stats.openPosition.side} ${bot.stats.openPosition.symbol}` : '—'} />
                        </View>
                        <View style={styles.botActions}>
                            {bot.status === 'STOPPED' ? (
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(8,153,129,0.14)' }]} disabled={busyBotId === bot.id} onPress={() => startBot(bot)}>
                                    <Play color={colors.success} size={15} />
                                    <Text style={[styles.actionBtnText, { color: colors.success }]}>Start</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(242,54,69,0.12)' }]} disabled={busyBotId === bot.id} onPress={() => stopBot(bot)}>
                                    <Square color={colors.danger} size={15} />
                                    <Text style={[styles.actionBtnText, { color: colors.danger }]}>Stop</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.actionBtn} onPress={() => openReport(bot)}>
                                <FileText color={colors.text} size={15} />
                                <Text style={styles.actionBtnText}>Report</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => runScan(bot)}>
                                <Radar color={colors.primary} size={15} />
                                <Text style={[styles.actionBtnText, { color: colors.primary }]}>Scan</Text>
                            </TouchableOpacity>
                            {bot.status === 'STOPPED' && (
                                <TouchableOpacity style={styles.actionBtn} disabled={busyBotId === bot.id} onPress={() => deleteBot(bot)}>
                                    <Trash2 color={colors.textSecondary} size={15} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </GlassView>
                ))}
                <View style={{ height: 40 }} />
            </ScrollView>
        </>
    );

    // ── builder view ────────────────────────────────────────────────
    const renderBacktestSummary = (bt: any) => {
        if (!bt) return null;
        if (bt.error) {
            return (
                <GlassView intensity={14} style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Backtest</Text>
                    <Text style={[styles.noteText, { color: colors.danger }]}>{bt.error}</Text>
                </GlassView>
            );
        }
        return (
            <GlassView intensity={14} style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Backtest (real costs)</Text>
                    <GradeBadge grade={bt.grade} score={bt.honestyScore} />
                </View>
                <View style={styles.statRow}>
                    <StatCell label="Net P/L" value={money(bt.netProfit)} color={(bt.netProfit ?? 0) >= 0 ? colors.success : colors.danger} />
                    <StatCell label="Return" value={pct(bt.returnPct)} />
                    <StatCell label="Trades" value={bt.trades ?? '—'} />
                </View>
                <View style={styles.statRow}>
                    <StatCell label="Win rate" value={pct(bt.winRate)} />
                    <StatCell label="Profit factor" value={typeof bt.profitFactor === 'number' ? bt.profitFactor.toFixed(2) : '∞'} />
                    <StatCell label="Max DD" value={pct(bt.maxDrawdownPct)} color={colors.danger} />
                </View>
                {Array.isArray(bt.honestyChecks) && bt.honestyChecks.map((c: any) => (
                    <Text key={c.key} style={styles.checkLine}>
                        {c.score >= 65 ? '✅' : c.score >= 40 ? '⚠️' : '❌'} {c.summary}
                    </Text>
                ))}
                {Array.isArray(bt.warnings) && bt.warnings.map((w: string, i: number) => (
                    <Text key={i} style={[styles.checkLine, { color: '#F5A623' }]}>⚠️ {w}</Text>
                ))}
                {bt.backtestId && (
                    <TouchableOpacity
                        style={[styles.chartBtn, { alignSelf: 'flex-start', marginTop: 10 }]}
                        onPress={() => navigation.navigate('MainTabs', { screen: 'Chart', params: { backtestId: bt.backtestId, ts: Date.now() } })}
                    >
                        <LineChart color={colors.primary} size={15} />
                        <Text style={[styles.actionBtnText, { color: colors.primary }]}>View trades on chart</Text>
                    </TouchableOpacity>
                )}
                <Text style={styles.noteText}>The honesty grade measures how much this backtest can be trusted — not how good the strategy is.</Text>
            </GlassView>
        );
    };

    const renderBuilder = () => (
        <>
            <Header title="New bot" onBack={() => setView('list')} />
            <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
                <GlassView intensity={14} style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Describe the strategy</Text>
                    <Text style={styles.noteText}>Persian or English. Example: «روی EUR/USD تایم ۱۵ دقیقه، وقتی RSI از ۳۰ رو به بالا عبور کرد و قیمت بالای EMA200 چهارساعته بود بخر، حد ضرر ۱.۵ برابر ATR، حد سود ۲ برابر ریسک، فقط سشن لندن.»</Text>
                    <TextInput
                        style={styles.descInput}
                        multiline
                        value={description}
                        onChangeText={setDescription}
                        placeholder="What should the bot do?"
                        placeholderTextColor={colors.textSecondary}
                    />
                    <TouchableOpacity onPress={buildFromDescription} disabled={building}>
                        <LinearGradient colors={[colors.primary, '#1E4FD6']} style={styles.buildBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            {building ? <ActivityIndicator color="#FFF" size="small" /> : <Sparkles color="#FFF" size={16} />}
                            <Text style={styles.buildBtnText}>{building ? 'Building & backtesting…' : 'Build & backtest'}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    {building && <Text style={styles.noteText}>Validating the spec and running a real backtest — this can take up to a minute.</Text>}
                </GlassView>

                {buildErrors && (
                    <GlassView intensity={14} style={styles.sectionCard}>
                        <Text style={[styles.sectionTitle, { color: colors.danger }]}>Could not build a valid strategy</Text>
                        {buildErrors.slice(0, 6).map((e: any, i: number) => (
                            <Text key={i} style={styles.checkLine}>• {e.path}: {e.message}</Text>
                        ))}
                        <Text style={styles.noteText}>Rephrase the description (simpler rules usually work better) and try again.</Text>
                    </GlassView>
                )}

                {buildResult && (
                    <>
                        <GlassView intensity={14} style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>{buildResult.spec?.name}</Text>
                            <Text style={styles.noteText}>These rules are rendered from the exact JSON the engine will run:</Text>
                            <RuleSheet rules={buildResult.rules?.fa} />
                        </GlassView>
                        {renderBacktestSummary(buildResult.backtest)}
                        <TouchableOpacity onPress={deployBuild} disabled={deploying}>
                            <LinearGradient colors={['#089981', '#056B5A']} style={styles.deployBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                {deploying ? <ActivityIndicator color="#FFF" size="small" /> : <Rocket color="#FFF" size={17} />}
                                <Text style={styles.deployBtnText}>{deploying ? 'Starting…' : 'Start forward test'}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <Text style={[styles.noteText, { textAlign: 'center' }]}>Paper trading on your demo account. Live needs a completed forward test.</Text>
                    </>
                )}
                <View style={{ height: 60 }} />
            </ScrollView>
        </>
    );

    // ── report view ─────────────────────────────────────────────────
    const renderReport = () => {
        const d = report;
        return (
            <>
                <Header
                    title={d?.bot?.name ?? 'Report'}
                    onBack={() => { setView('list'); loadBots(true); }}
                    right={d ? (
                        <TouchableOpacity
                            style={styles.chartBtn}
                            onPress={() => navigation.navigate('MainTabs', { screen: 'Chart', params: { symbol: d.bot.symbol, botId: d.bot.id, ts: Date.now() } })}
                        >
                            <LineChart color={colors.primary} size={16} />
                            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Chart</Text>
                        </TouchableOpacity>
                    ) : null}
                />
                <ScrollView contentContainerStyle={styles.listContent}>
                    {reportLoading || !d ? (
                        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
                    ) : (
                        <>
                            <GlassView intensity={14} style={styles.sectionCard}>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionTitle}>Forward test record</Text>
                                    <StatusChip status={d.bot.status} />
                                </View>
                                <View style={styles.statRow}>
                                    <StatCell label="Trades" value={d.forward.trades} />
                                    <StatCell label="Win rate" value={pct(d.forward.winRate)} />
                                    <StatCell label="Net P/L" value={money(d.forward.netProfit)} color={d.forward.netProfit >= 0 ? colors.success : colors.danger} />
                                </View>
                                <View style={styles.statRow}>
                                    <StatCell label="Expectancy" value={money(d.forward.expectancy)} />
                                    <StatCell label="Profit factor" value={typeof d.forward.profitFactor === 'number' ? d.forward.profitFactor.toFixed(2) : '∞'} />
                                    <StatCell label="Max DD" value={money(d.forward.maxDrawdown)} color={colors.danger} />
                                </View>
                                {d.openPosition && (
                                    <Text style={styles.checkLine}>Open now: {d.openPosition.side} {d.openPosition.volume} lot {d.openPosition.symbol} @ {d.openPosition.entryPrice}</Text>
                                )}
                            </GlassView>

                            {d.backtest && (
                                <GlassView intensity={14} style={styles.sectionCard}>
                                    <View style={styles.sectionHeaderRow}>
                                        <Text style={styles.sectionTitle}>vs its backtest</Text>
                                        <GradeBadge grade={d.backtest.grade} />
                                    </View>
                                    <View style={styles.statRow}>
                                        <StatCell label="BT expectancy" value={money(d.backtest.expectancy)} />
                                        <StatCell label="Fwd expectancy" value={money(d.forward.expectancy)} />
                                        <StatCell
                                            label="Reality gap"
                                            value={typeof d.backtest.realityGap === 'number' ? `${(d.backtest.realityGap * 100).toFixed(0)}%` : '—'}
                                            color={typeof d.backtest.realityGap === 'number' ? (d.backtest.realityGap >= 0.6 ? colors.success : colors.danger) : undefined}
                                        />
                                    </View>
                                    <Text style={styles.noteText}>Reality gap = live expectancy as a share of the backtest's. Far below 100% means the backtest flattered.</Text>
                                </GlassView>
                            )}

                            <GlassView intensity={14} style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>Bot vs you</Text>
                                <View style={styles.statRow}>
                                    <StatCell label="Bot trades" value={d.forward.trades} />
                                    <StatCell label="Your trades" value={d.you.trades} />
                                    <StatCell label="" value="" />
                                </View>
                                <View style={styles.statRow}>
                                    <StatCell label="Bot net" value={money(d.forward.netProfit)} color={d.forward.netProfit >= 0 ? colors.success : colors.danger} />
                                    <StatCell label="Your net" value={money(d.you.netProfit)} color={d.you.netProfit >= 0 ? colors.success : colors.danger} />
                                    <StatCell label="" value="" />
                                </View>
                                <Text style={styles.noteText}>Your manual closed trades over the same period, same formulas.</Text>
                            </GlassView>

                            {d.watchdog && (
                                <GlassView intensity={14} style={styles.sectionCard}>
                                    <View style={styles.sectionHeaderRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            {d.watchdog.config.enabled
                                                ? <ShieldCheck color={colors.success} size={19} />
                                                : <ShieldOff color={colors.textSecondary} size={19} />}
                                            <Text style={styles.sectionTitle}>نگهبان ربات</Text>
                                        </View>
                                        <Switch
                                            value={!!d.watchdog.config.enabled}
                                            disabled={savingWatchdog}
                                            onValueChange={(v) => toggleWatchdog(d.bot.id, v)}
                                            trackColor={{ false: isDark ? '#3A3F4B' : '#CBD5E1', true: 'rgba(8,153,129,0.45)' }}
                                            thumbColor={d.watchdog.config.enabled ? colors.success : '#F1F5F9'}
                                        />
                                    </View>

                                    {d.watchdog.config.enabled ? (
                                        <>
                                            <View style={styles.statRow}>
                                                <StatCell
                                                    label={`ضرر امروز / سقف ${d.watchdog.config.maxDailyLossPct}٪`}
                                                    value={money(d.watchdog.verdict.readings.todayNet)}
                                                    color={d.watchdog.verdict.readings.todayNet < 0 ? colors.danger : colors.success}
                                                />
                                                <StatCell
                                                    label={`ضرر پیاپی / ${d.watchdog.config.maxConsecutiveLosses}`}
                                                    value={d.watchdog.verdict.readings.consecutiveLosses}
                                                    color={d.watchdog.verdict.readings.consecutiveLosses >= d.watchdog.config.maxConsecutiveLosses ? colors.danger : undefined}
                                                />
                                                <StatCell
                                                    label={`افت / سقف ${d.watchdog.config.maxDrawdownPct}٪`}
                                                    value={`${d.watchdog.verdict.readings.drawdownPct}%`}
                                                    color={d.watchdog.verdict.readings.drawdownPct >= d.watchdog.config.maxDrawdownPct ? colors.danger : undefined}
                                                />
                                            </View>
                                            {d.watchdog.verdict.readings.edgeRatio !== null && (
                                                <Text style={styles.checkLine}>
                                                    {d.watchdog.verdict.readings.edgeRatio >= 0.6 ? '✅' : d.watchdog.verdict.readings.edgeRatio > 0.3 ? '⚠️' : '❌'} لبه: {Math.round(d.watchdog.verdict.readings.edgeRatio * 100)}٪ از انتظار ریاضی شروع باقی مانده
                                                </Text>
                                            )}
                                            <Text style={[styles.checkLine, { color: d.watchdog.verdict.tripped ? colors.danger : colors.textSecondary }]}>
                                                {d.watchdog.verdict.tripped ? '⛔ ' : ''}{d.watchdog.verdict.fa}
                                            </Text>
                                            <Text style={styles.noteText}>
                                                {d.watchdog.config.action === 'PAUSE'
                                                    ? 'با عبور از هر سقف، ربات خودش متوقف می‌شود؛ پوزیشن باز با حد ضرر خودش می‌ماند.'
                                                    : 'با عبور از هر سقف فقط هشدار ثبت می‌شود و ربات ادامه می‌دهد.'}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={[styles.noteText, { color: '#F5A623' }]}>
                                            نگهبان خاموش است — هیچ سقف ضرر روزانه، ضرر پیاپی یا افت سرمایه‌ای این ربات را متوقف نمی‌کند.
                                        </Text>
                                    )}

                                    {Array.isArray(d.watchdog.events) && d.watchdog.events.length > 0 && (
                                        <View style={{ marginTop: 10 }}>
                                            <Text style={[styles.sectionTitle, { fontSize: 13 }]}>رویدادها</Text>
                                            {d.watchdog.events.slice(0, 5).map((ev: any) => (
                                                <View key={ev.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 6 }}>
                                                    <Siren color={ev.severity === 'ALERT' ? colors.danger : ev.severity === 'WARN' ? '#F5A623' : colors.textSecondary} size={13} />
                                                    <Text style={[styles.checkLine, { flex: 1, textAlign: 'right', writingDirection: 'rtl' }]}>
                                                        {ev.messageFa}
                                                        <Text style={{ color: colors.textSecondary }}>{'  '}{new Date(ev.createdAt).toLocaleDateString()}</Text>
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </GlassView>
                            )}

                            <GlassView intensity={14} style={styles.sectionCard}>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionTitle}>Live gate</Text>
                                    {d.gate.eligible
                                        ? <ShieldCheck color={colors.success} size={20} />
                                        : <ShieldAlert color={'#F5A623'} size={20} />}
                                </View>
                                <View style={styles.statRow}>
                                    <StatCell label="Days" value={`${d.gate.progress.daysRunning} / ${d.gate.requirements.minDays}`} />
                                    <StatCell label="Trades" value={`${d.gate.progress.trades} / ${d.gate.requirements.minTrades}`} />
                                    <StatCell label="Status" value={d.gate.eligible ? 'OPEN' : 'CLOSED'} color={d.gate.eligible ? colors.success : '#F5A623'} />
                                </View>
                                {d.gate.reasons.map((r: string, i: number) => (
                                    <Text key={i} style={styles.checkLine}>• {r}</Text>
                                ))}
                                {d.gate.losingRecord && (
                                    <Text style={[styles.checkLine, { color: colors.danger }]}>⚠️ This bot's forward record is losing money.</Text>
                                )}
                                {d.gate.eligible && d.bot.status !== 'LIVE' && (
                                    <TouchableOpacity onPress={() => goLive(d)}>
                                        <LinearGradient colors={['#F23645', '#B82330']} style={styles.deployBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                            <Rocket color="#FFF" size={16} />
                                            <Text style={styles.deployBtnText}>Go live (minimum volume)</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                                {d.gate.eligible && (
                                    <TouchableOpacity onPress={async () => {
                                        try {
                                            const r = await api('post', '/api/v1/library/publish', { botId: d.bot.id });
                                            if (r.data?.success) showToast('Published to the Strategy Library 🏆', 'success');
                                        } catch (e: any) {
                                            showToast(e.response?.data?.message || 'Publish failed', 'error');
                                        }
                                    }}>
                                        <View style={styles.publishBtn}>
                                            <Trophy color={'#F5A623'} size={15} />
                                            <Text style={[styles.actionBtnText, { color: '#F5A623' }]}>Publish to library</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            </GlassView>

                            {Array.isArray(d.rules) && d.rules.length > 0 && (
                                <GlassView intensity={14} style={styles.sectionCard}>
                                    <Text style={styles.sectionTitle}>Rules</Text>
                                    <RuleSheet rules={d.rules} />
                                </GlassView>
                            )}
                        </>
                    )}
                    <View style={{ height: 60 }} />
                </ScrollView>
            </>
        );
    };

    // ── scan view ───────────────────────────────────────────────────
    const renderScan = () => (
        <>
            <Header title="Setup scanner" onBack={() => setView('list')} />
            <ScrollView contentContainerStyle={styles.listContent}>
                {scanLoading || !scan ? (
                    <>
                        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
                        <Text style={[styles.noteText, { textAlign: 'center' }]}>در حال اجرای قواعد این ربات روی همه‌ی نمادهای هم‌خانواده…</Text>
                    </>
                ) : (
                    <>
                        <GlassView intensity={14} style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>{scan.bot.name}</Text>
                            <Text style={styles.noteText}>
                                قواعد ورود این ربات روی {scan.scanned.length} نماد در تایم‌فریم {scan.timeframe} اجرا شد.
                                فقط کندل‌های بسته‌شده و حداکثر {scan.lookbackBars} کندل اخیر شمرده می‌شود — سقف معامله‌ی روزانه و cooldown هم اعمال نشده، چون سؤال «آیا ستاپ وجود دارد؟» است نه «آیا ربات معامله می‌کرد؟».
                            </Text>
                        </GlassView>

                        {scan.hits.length === 0 ? (
                            <GlassView intensity={14} style={styles.sectionCard}>
                                <Text style={styles.sectionTitle}>هیچ ستاپ فعالی نیست</Text>
                                <Text style={styles.noteText}>روی هیچ‌کدام از {scan.scanned.length} نماد اسکن‌شده، شرط ورود در {scan.lookbackBars} کندل اخیر برقرار نشده.</Text>
                            </GlassView>
                        ) : scan.hits.map((h: any) => (
                            <GlassView key={h.symbol} intensity={14} style={styles.sectionCard}>
                                <View style={styles.cardTopRow}>
                                    <View style={[styles.sideChip, { backgroundColor: h.side === 'BUY' ? 'rgba(8,153,129,0.16)' : 'rgba(242,54,69,0.14)' }]}>
                                        <Text style={[styles.sideChipText, { color: h.side === 'BUY' ? colors.success : colors.danger }]}>{h.side}</Text>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.botName}>{h.symbol}</Text>
                                        <Text style={styles.botMeta}>
                                            {h.barsAgo === 0 ? 'کندل همین حالا بسته شد' : `${h.barsAgo} کندل پیش`} · {new Date(h.barTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.chartBtn}
                                        onPress={() => navigation.navigate('MainTabs', { screen: 'Chart', params: { symbol: h.symbol, ts: Date.now() } })}
                                    >
                                        <LineChart color={colors.primary} size={15} />
                                        <Text style={[styles.actionBtnText, { color: colors.primary }]}>Chart</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.statRow}>
                                    <StatCell label="قیمت کندل" value={h.close} />
                                    <StatCell label="حد ضرر" value={h.stopLoss} color={colors.danger} />
                                    <StatCell label="حد سود" value={h.takeProfit ?? '—'} color={colors.success} />
                                </View>
                                {h.spreadPips !== null && <Text style={styles.checkLine}>اسپرد الان: {h.spreadPips.toFixed(1)} پیپ</Text>}
                            </GlassView>
                        ))}

                        {Object.keys(scan.skipped ?? {}).length > 0 && (
                            <GlassView intensity={14} style={styles.sectionCard}>
                                <Text style={[styles.sectionTitle, { fontSize: 13 }]}>اسکن‌نشده</Text>
                                {Object.entries(scan.skipped).slice(0, 8).map(([sym, why]: any) => (
                                    <Text key={sym} style={styles.checkLine}>• {sym}: {String(why)}</Text>
                                ))}
                            </GlassView>
                        )}
                    </>
                )}
                <View style={{ height: 50 }} />
            </ScrollView>
        </>
    );

    return (
        <SafeAreaView style={[styles.safeArea, { paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() }]}>
            {view === 'scan' && renderScan()}
            {view === 'list' && renderList()}
            {view === 'builder' && renderBuilder()}
            {view === 'report' && renderReport()}
            <GlassToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
    backBtn: { padding: 6 },
    headerTitle: { fontSize: 19, fontWeight: '700', color: colors.text, marginLeft: 4 },
    newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    newBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

    listContent: { paddingHorizontal: 14, paddingTop: 6 },

    emptyBox: { alignItems: 'center', marginTop: 70, paddingHorizontal: 30 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 14 },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 19 },
    emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24, marginTop: 20 },
    emptyCtaText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

    botCard: { borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    botCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    botName: { fontSize: 15.5, fontWeight: '700', color: colors.text },
    botMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    chipText: { fontSize: 11, fontWeight: '700' },

    statRow: { flexDirection: 'row', marginBottom: 8 },
    statCell: { flex: 1 },
    statLabel: { fontSize: 11, color: colors.textSecondary },
    statValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },

    botActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    actionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 8,
        borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    },
    actionBtnText: { fontSize: 12.5, fontWeight: '600', color: colors.text },

    sectionCard: { borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 },
    noteText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 6 },
    checkLine: { fontSize: 12.5, color: colors.text, lineHeight: 19, marginTop: 4 },

    descInput: {
        minHeight: 110, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        color: colors.text, padding: 12, fontSize: 14, textAlignVertical: 'top', marginTop: 10,
    },
    buildBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, marginTop: 12 },
    buildBtnText: { color: '#FFF', fontSize: 14.5, fontWeight: '700' },
    deployBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 4, marginBottom: 6 },
    deployBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

    rulesBox: { marginTop: 8 },
    ruleLine: { fontSize: 13, color: colors.text, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl', marginTop: 2 },

    publishBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 11, borderRadius: 12, marginTop: 10,
        backgroundColor: 'rgba(245,166,35,0.12)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.35)',
    },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    sideChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
    sideChipText: { fontSize: 12, fontWeight: '800' },
    chartBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7,
        borderRadius: 18, backgroundColor: 'rgba(41,98,255,0.12)',
    },
    gradeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    gradeBadgeText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
    gradeScoreText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
});
