// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { Text } from '../components/Typography';
;
import axios from 'axios';
import { ChevronLeft, Clock, Calendar, AlertTriangle, Folder } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAccountStore } from '../store/accountStore';
import { BACKEND_URL, getTgSafeAreaTop, isTelegram } from '../config';

const MOCK_NEWS_EVENTS = [
    { id: 1, event: 'Non-Farm Employment Change', country: 'USD', impact: 'HIGH', time: new Date(Date.now() + 59 * 60 * 1000).toISOString(), forecast: '185K', previous: '175K' },
    { id: 2, event: 'ECB Interest Rate Decision', country: 'EUR', impact: 'HIGH', time: new Date(Date.now() + 119 * 60 * 1000).toISOString(), forecast: '3.75%', previous: '4.00%' },
    { id: 3, event: 'Manufacturing PMI', country: 'GBP', impact: 'MEDIUM', time: new Date(Date.now() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000).toISOString(), forecast: '51.2', previous: '50.8' }
];

export default function NewsRadarScreen({ navigation }) {
    const { colors, isDark } = useTheme();
    const { selectedAccount } = useAccountStore();
    const [newsEvents, setNewsEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadNewsEvents = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BACKEND_URL}/api/v1/tools/calendar`);
            if (res.data?.success && res.data.data && res.data.data.length > 0) {
                setNewsEvents(res.data.data);
            } else {
                setNewsEvents(MOCK_NEWS_EVENTS);
            }
        } catch (err) {
            console.log('Failed to load news events, using fallback', err);
            setNewsEvents(MOCK_NEWS_EVENTS);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNewsEvents();
    }, []);

    const formatEventTime = (timeStr: string) => {
        try {
            const date = new Date(timeStr);
            const now = new Date();
            const diffMs = date.getTime() - now.getTime();
            if (diffMs < 0) return 'Passed';
            
            const diffMins = Math.floor(diffMs / (60 * 1000));
            if (diffMins < 60) return `${diffMins}m`;
            
            const diffHours = Math.floor(diffMins / 60);
            const remainingMins = diffMins % 60;
            if (diffHours < 24) return `${diffHours}h ${remainingMins}m`;
            
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch {
            return '—';
        }
    };

    const formatExactTime = (timeIsoStr: string) => {
        try {
            const d = new Date(timeIsoStr);
            return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch {
            return 'All Day';
        }
    };

    const getDayHeader = (timeIsoStr: string) => {
        try {
            const d = new Date(timeIsoStr);
            return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return 'Today';
        }
    };

    const getImpactColor = (impact: string) => {
        switch (impact?.toUpperCase()) {
            case 'HIGH': return '#EF4444'; // Red
            case 'MEDIUM': return '#F97316'; // Orange
            case 'LOW': return '#EAB308'; // Yellow
            default: return '#94A3B8'; // Gray
        }
    };

    const formatBalance = (val: number) => {
        return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    // Group events by day
    const groupedEvents: { [key: string]: any[] } = {};
    newsEvents.forEach(event => {
        const header = getDayHeader(event.time);
        if (!groupedEvents[header]) {
            groupedEvents[header] = [];
        }
        groupedEvents[header].push(event);
    });

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() }]}>
            {/* Glow Orbs Background */}
            {isDark && (
                <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <View style={[styles.glowOrb, { backgroundColor: colors.glowBlue, top: -100, left: -100, opacity: isDark ? 0.15 : 0.25 }]} />
                    <View style={[styles.glowOrb, { backgroundColor: colors.glowPurple, bottom: -50, right: -50, opacity: isDark ? 0.1 : 0.2 }]} />
                </View>
            )}

            {/* Header Block */}
            <View style={styles.header}>
                {isTelegram ? (
                    <View />
                ) : (
                    <TouchableOpacity 
                        style={styles.backButton} 
                        onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Watchlist' })}
                        activeOpacity={0.7}
                    >
                        <ChevronLeft color={colors.primary} size={24} />
                        <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Screen Title */}
            <View style={styles.titleContainer}>
                <Text style={[styles.screenTitle, { color: colors.text }]}>Macro Calendar</Text>
                <Text style={[styles.screenSubtitle, { color: colors.textMuted }]}>Economic events from Forex Factory feed</Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {newsEvents.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <AlertTriangle color={colors.textMuted} size={48} />
                            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No macro events scheduled.</Text>
                        </View>
                    ) : (
                        <View style={styles.calendarContainer}>
                            {Object.keys(groupedEvents).map((dayHeader) => (
                                <View key={dayHeader} style={styles.daySection}>
                                    {/* Section Date Header */}
                                    <View style={[styles.dayHeaderContainer, { 
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', 
                                        borderColor: colors.glassBorder 
                                    }]}>
                                        <Calendar color={colors.primary} size={14} style={styles.calendarIcon} />
                                        <Text style={[styles.dayHeaderText, { color: colors.text }]}>{dayHeader}</Text>
                                    </View>

                                    {/* Events List */}
                                    {groupedEvents[dayHeader].map((event, index) => {
                                        const impactColor = getImpactColor(event.impact);
                                        const timeRemaining = formatEventTime(event.time);
                                        const exactTime = formatExactTime(event.time);
                                        const hasPassed = timeRemaining === 'Passed';

                                        return (
                                            <View 
                                                key={event.id || index} 
                                                style={[
                                                    styles.eventRow, 
                                                    { 
                                                        borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                                        opacity: hasPassed ? 0.35 : 1
                                                    }
                                                ]}
                                            >
                                                {/* Left Col: Time & Currency */}
                                                <View style={styles.leftColumn}>
                                                    <Text style={[styles.timeText, { color: colors.text }]}>{exactTime}</Text>
                                                    <View style={[styles.currencyBadge, { 
                                                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)', 
                                                        borderColor: colors.glassBorder 
                                                    }]}>
                                                        <Text style={[styles.currencyText, { color: colors.text }]}>{event.country}</Text>
                                                    </View>
                                                </View>

                                                {/* Middle Col: Title & Impact & Countdown */}
                                                <View style={styles.middleColumn}>
                                                    <View style={styles.titleRow}>
                                                        <View style={[styles.folderBadge, { backgroundColor: `${impactColor}15`, borderColor: impactColor }]}>
                                                            <Folder color={impactColor} size={10} fill={impactColor} />
                                                        </View>
                                                        <Text 
                                                            style={[
                                                                styles.eventTitleText, 
                                                                { 
                                                                    color: colors.text,
                                                                    textDecorationLine: hasPassed ? 'line-through' : 'none'
                                                                }
                                                            ]} 
                                                            numberOfLines={2}
                                                        >
                                                            {event.event}
                                                        </Text>
                                                    </View>
                                                    {hasPassed ? (
                                                        <View style={styles.countdownRow}>
                                                            <Clock color={colors.textMuted} size={10} style={{ marginRight: 3 }} />
                                                            <Text style={[styles.countdownText, { color: colors.textMuted }]}>Passed</Text>
                                                        </View>
                                                    ) : (
                                                        <View style={styles.countdownRow}>
                                                            <Clock color={colors.primary} size={10} style={{ marginRight: 3 }} />
                                                            <Text style={[styles.countdownText, { color: colors.primary }]}>{timeRemaining}</Text>
                                                        </View>
                                                    )}
                                                </View>

                                                {/* Right Col: Forecast & Previous */}
                                                <View style={styles.rightColumn}>
                                                    <View style={styles.dataRow}>
                                                        <Text style={[styles.dataLabel, { color: colors.textMuted }]}>Act</Text>
                                                        <Text style={[styles.dataValue, { color: colors.text }]} numberOfLines={1}>
                                                            {event.actual || '—'}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.dataRow}>
                                                        <Text style={[styles.dataLabel, { color: colors.textMuted }]}>For</Text>
                                                        <Text style={[styles.dataValue, { color: colors.text }]} numberOfLines={1}>
                                                            {event.forecast}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.dataRow}>
                                                        <Text style={[styles.dataLabel, { color: colors.textMuted }]}>Prev</Text>
                                                        <Text style={[styles.dataValue, { color: colors.textSubtle }]} numberOfLines={1}>
                                                            {event.previous}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop(),
    },
    glowOrb: {
        display: 'none',
        width: 0,
        height: 0,
        opacity: 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingLeft: 4,
        paddingRight: 12,
    },
    backText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    accountPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 20,
        paddingLeft: 8,
        paddingRight: 14,
        paddingVertical: 4,
    },
    demoBadge: {
        backgroundColor: '#EAB308',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginRight: 8,
    },
    demoBadgeText: {
        color: '#000',
        fontSize: 9,
        fontWeight: '900',
    },
    accountInfo: {
        alignItems: 'flex-start',
    },
    brokerText: {
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    balanceText: {
        fontSize: 12,
        fontWeight: '900',
        marginTop: 1,
    },
    titleContainer: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        marginBottom: 16,
    },
    screenTitle: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    screenSubtitle: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '600',
    },
    calendarContainer: {
        paddingHorizontal: 16,
    },
    daySection: {
        marginBottom: 24,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(255,255,255,0.01)',
    },
    dayHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    calendarIcon: {
        marginRight: 8,
    },
    dayHeaderText: {
        fontSize: 13,
        fontWeight: '800',
    },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    leftColumn: {
        width: 65,
        alignItems: 'flex-start',
    },
    timeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    currencyBadge: {
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 5,
        paddingVertical: 1,
        marginTop: 4,
    },
    currencyText: {
        fontSize: 9,
        fontWeight: '900',
    },
    middleColumn: {
        flex: 1,
        paddingHorizontal: 10,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    folderBadge: {
        borderWidth: 1,
        borderRadius: 4,
        padding: 3,
        marginRight: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    eventTitleText: {
        fontSize: 13,
        fontWeight: '700',
        flex: 1,
        lineHeight: 18,
    },
    countdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        marginLeft: 23,
    },
    countdownText: {
        fontSize: 9,
        fontWeight: '800',
    },
    rightColumn: {
        width: 85,
        alignItems: 'flex-end',
        gap: 3,
    },
    dataRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    dataLabel: {
        fontSize: 9,
        fontWeight: '600',
    },
    dataValue: {
        fontSize: 10,
        fontWeight: '800',
    },
});
