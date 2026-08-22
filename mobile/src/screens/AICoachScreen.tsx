// @ts-nocheck
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, Keyboard, ScrollView } from 'react-native';
import { Text, TextInput } from '../components/Typography';
;
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { getItemAsync } from '../utils/storage';
import { Bot, Paperclip, Rocket, Mic, ArrowUp, Trash2, Search, Zap, Lightbulb, Ban, Layers, Check, TrendingUp, ChevronDown, Activity, Cpu, ShieldAlert, Target, BarChart3, Calendar, ArrowLeft } from 'lucide-react-native';
import GlassView from '../components/GlassView';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { BACKEND_URL, getTgSafeAreaTop, isTelegram } from '../config';
import GlassToast from '../components/GlassToast';
import ToolsHubScreen from './ToolsHubScreen';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    widget?: any;
}

const FlatListAny = FlatList as any;

export default function AICoachScreen() {
    const { colors, isDark } = useTheme();
    const navigation = useNavigation<any>();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    useEffect(() => {
        if (!isTelegram) return;

        (window as any).customTelegramBackHandler = () => {
            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                navigation.navigate('MainTabs', { screen: 'Watchlist' });
            }
            return true; // handled
        };

        return () => {
            (window as any).customTelegramBackHandler = null;
        };
    }, [navigation]);

    const [isKeyboardActive, setIsKeyboardActive] = useState(false);

    useEffect(() => {
        const showSubscription = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setIsKeyboardActive(true)
        );
        const hideSubscription = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setIsKeyboardActive(false)
        );

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);


    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [selectedModel, setSelectedModel] = useState('MaxAI');
    const flatListRef = useRef<any>(null);
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');


    const showToast = (msg: string, type: 'success' | 'error' | 'info') => {
        setToastMessage(msg);
        setToastType(type);
        setToastVisible(true);
    };

    const clearChat = () => {
        setMessages([]);
        showToast('Chat history cleared', 'info');
    };

    const streamMessage = (fullText: string, widget: any, baseMessages: Message[]) => {
        const targetIndex = baseMessages.length;
        
        // Add the empty AI response bubble
        setMessages([...baseMessages, { role: 'assistant', content: '', widget }]);
        
        const words = fullText.split(' ');
        let currentText = '';
        let wordIdx = 0;
        
        const timer = setInterval(() => {
            if (wordIdx < words.length) {
                currentText += (wordIdx === 0 ? '' : ' ') + words[wordIdx];
                setMessages(prev => {
                    const clone = [...prev];
                    if (clone[targetIndex]) {
                        clone[targetIndex] = {
                            ...clone[targetIndex],
                            content: currentText
                        };
                    }
                    return clone;
                });
                wordIdx++;
                
                if (flatListRef.current) {
                    flatListRef.current.scrollToEnd({ animated: true });
                }
            } else {
                clearInterval(timer);
                setLoading(false);
            }
        }, 12);
    };

    const sendMessage = async () => {
        if (!inputText.trim()) return;

        const newUserMsg: Message = { role: 'user', content: inputText.trim() };
        const updatedMessages = [...messages, newUserMsg];

        setMessages(updatedMessages);
        setInputText('');
        setLoading(true);
        Keyboard.dismiss();

        try {
            const token = await getItemAsync('accessToken');
            if (!token) {
                setLoading(false);
                streamMessage('Please log in from the Profile tab to chat with MaxAI.', null, updatedMessages);
                return;
            }

            const response = await axios.post(`${BACKEND_URL}/api/v1/ai/chat`, {
                messages: updatedMessages,
                model: selectedModel
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data && response.data.reply) {
                streamMessage(response.data.reply.content, response.data.reply.widget, updatedMessages);
            } else {
                setLoading(false);
            }
        } catch (error: any) {
            console.error("AI Chat Error:", error);
            setLoading(false);
            
            let detailedError = 'Sorry, I am having trouble connecting to the network right now.';
            if (error.response) {
                if (error.response.status === 401) {
                    detailedError = 'Session expired or invalid. Please log out and log in again from the Profile tab.';
                } else {
                    detailedError = `Server Error (${error.response.status}): ${error.response.data?.error || error.response.data?.message || 'Internal Server Error'}`;
                }
            } else if (error.request) {
                detailedError = `Network Connection Failure: Unable to reach the server. Please check your internet connection or VPN.`;
            } else {
                detailedError = `Error: ${error.message}`;
            }
            
            streamMessage(detailedError, null, updatedMessages);
        }
    };

    const executeTradeFromSignal = async (signalData: any) => {
        try {
            showToast('Executing trade...', 'info');
            const token = await getItemAsync('accessToken');
            const response = await axios.post(`${BACKEND_URL}/api/v1/trade/execute`, {
                symbol: signalData.symbol,
                side: signalData.side,
                orderType: 'MARKET',
                volume: 1.0, 
                currentPrice: signalData.entry
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                if (signalData.tp || signalData.sl) {
                    const modifyToken = await getItemAsync('accessToken');
                    await axios.post(`${BACKEND_URL}/api/v1/trade/modify`, {
                        positionId: response.data.data.id,
                        takeProfit: signalData.tp,
                        stopLoss: signalData.sl
                    }, {
                        headers: { Authorization: `Bearer ${modifyToken}` }
                    });
                }
                showToast(`${signalData.side} ${signalData.symbol} executed successfully!`, 'success');
            }
        } catch (e: any) {
            showToast(`Error: ${e.message}`, 'error');
        }
    };

    const renderWidget = (widget: any) => {
        if (!widget) return null;
        
        if (widget.type === 'risk_report') {
            return (
                <GlassView intensity={15} style={styles.widgetCard}>
                    <View style={styles.widgetHeader}>
                        <Activity color={colors.primary} size={18} />
                        <Text style={styles.widgetTitle}>Risk Report</Text>
                    </View>
                    <View style={styles.widgetRow}>
                        <Text style={styles.widgetLabel}>Open Trades:</Text>
                        <Text style={styles.widgetValue}>{widget.data.openTrades}</Text>
                    </View>
                    <View style={styles.widgetRow}>
                        <Text style={styles.widgetLabel}>Health Score:</Text>
                        <Text style={[styles.widgetValue, { color: colors.success }]}>{widget.data.score}/100</Text>
                    </View>
                    <View style={styles.widgetSuggestionList}>
                        {widget.data.suggestions.map((s: string, i: number) => (
                            <View {...{key: i}} style={styles.widgetSuggestionRow}>
                                <Check color={colors.primary} size={14} style={{ marginRight: 8 }} />
                                <Text style={styles.widgetSuggestionText}>{s}</Text>
                            </View>
                        ))}
                    </View>
                </GlassView>
            );
        }

        if (widget.type === 'signal') {
            const isBuy = widget.data.side === 'BUY';
            return (
                <GlassView intensity={20} style={[styles.widgetCard, { borderColor: isBuy ? 'rgba(8,153,129,0.3)' : 'rgba(242,54,69,0.3)' }]}>
                    <View style={styles.widgetHeader}>
                        <Zap color={isBuy ? colors.success : colors.danger} size={18} />
                        <Text style={[styles.widgetTitle, { color: isBuy ? colors.success : colors.danger }]}>{widget.data.symbol} {widget.data.side}</Text>
                        <View style={styles.spacer} />
                        <View style={styles.confidenceBadge}>
                            <Text style={styles.confidenceText}>{widget.data.confidence}% Conf.</Text>
                        </View>
                    </View>
                    <View style={styles.widgetTargetRow}>
                        <View>
                            <Text style={styles.widgetLabel}>Entry</Text>
                            <Text style={styles.widgetValue}>{widget.data.entry}</Text>
                        </View>
                        <View>
                            <Text style={styles.widgetLabel}>Take Profit</Text>
                            <Text style={[styles.widgetValue, { color: colors.success }]}>{widget.data.tp}</Text>
                        </View>
                        <View>
                            <Text style={styles.widgetLabel}>Stop Loss</Text>
                            <Text style={[styles.widgetValue, { color: colors.danger }]}>{widget.data.sl}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => executeTradeFromSignal(widget.data)}>
                        <LinearGradient colors={isBuy ? ['#089981', '#056B5A'] : ['#F23645', '#B82330']} style={styles.executeSignalBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            <Text style={styles.executeSignalBtnText}>Execute 1.00 Lot</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </GlassView>
            );
        }

        if (widget.type === 'sentiment') {
            const bullishStyle = { flex: widget.data.bullishPercent, backgroundColor: colors.success };
            const bearishStyle = { flex: widget.data.bearishPercent, backgroundColor: colors.danger };
            
            return (
                <GlassView intensity={15} style={styles.widgetCard}>
                    <View style={styles.widgetHeader}>
                        <TrendingUp color={colors.primary} size={18} />
                        <Text style={styles.widgetTitle}>Market Sentiment</Text>
                    </View>
                    <View style={styles.sentimentBar}>
                        <View style={bullishStyle} />
                        <View style={bearishStyle} />
                    </View>
                    <View style={styles.sentimentLabels}>
                        <Text style={styles.sentimentLabelBullish}>{widget.data.bullishPercent}% Bullish</Text>
                        <Text style={styles.sentimentLabelBearish}>{widget.data.bearishPercent}% Bearish</Text>
                    </View>
                    <View style={styles.sentimentDriversContainer}>
                        {widget.data.keyDrivers.map((d: string, i: number) => (
                            <Text {...{key: i}} style={styles.sentimentDriverText}>• {d}</Text>
                        ))}
                    </View>
                </GlassView>
            );
        }

        return null;
    };

    const renderMarkdownContent = (content: string) => {
        if (!content) return null;
        
        const lines = content.split('\n');
        let inCodeBlock = false;
        const filteredLines = [];
        
        for (const line of lines) {
            if (line.trim().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                continue;
            }
            if (!inCodeBlock) {
                filteredLines.push(line);
            }
        }
        
        return filteredLines.map((line, lineIndex) => {
            let isBullet = false;
            let cleanLine = line.trim();
            
            if (cleanLine.startsWith('* ') || cleanLine.startsWith('- ')) {
                isBullet = true;
                cleanLine = cleanLine.substring(2);
            } else if (cleanLine.startsWith('• ')) {
                isBullet = true;
                cleanLine = cleanLine.substring(2);
            }
            
            const parts = cleanLine.split('**');
            const renderedParts = parts.map((part, partIndex) => {
                const isBold = partIndex % 2 === 1;
                return (
                    <Text key={partIndex} style={isBold ? { fontWeight: 'bold', color: colors.text } : { color: colors.text }}>
                        {part}
                    </Text>
                );
            });
            
            if (isBullet) {
                return (
                    <View key={lineIndex} style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 4, paddingLeft: 8, flexShrink: 1, width: '100%' }}>
                        <Text style={{ color: colors.primary, marginRight: 6, fontSize: 15, fontWeight: 'bold' }}>•</Text>
                        <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: colors.text, flexWrap: 'wrap' }}>
                            {renderedParts}
                        </Text>
                    </View>
                );
            }
            
            return (
                <Text key={lineIndex} style={{ fontSize: 15, lineHeight: 22, color: colors.text, marginVertical: 3, flexWrap: 'wrap' }}>
                    {renderedParts}
                </Text>
            );
        });
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.role === 'user';
        return (
            <View style={[styles.messageWrapper, isUser ? styles.messageWrapperUser : styles.messageWrapperAI]}>
                <GlassView 
                    intensity={isUser ? 30 : 15} 
                    style={[styles.messageBubble, isUser ? styles.messageBubbleUser : styles.messageBubbleAI]}
                >
                    {renderMarkdownContent(item.content)}
                    {item.widget && renderWidget(item.widget)}
                </GlassView>
            </View>
        );
    };

    const modelOptions = [
        { name: 'Mimo 2.5 Pro', desc: 'Active Nara AI Agent', icon: Cpu },
        { name: 'DeepSeek R1', desc: 'Deep logical thinking', icon: Lightbulb },
        { name: 'MaxAI', desc: 'Chooses Best Agent', icon: Bot },
        { name: 'Market Sniper', desc: 'Sentiment & sweeps', icon: Target },
        { name: 'Heavy Analyst', desc: 'Team of experts', icon: Layers }
    ];



    return (
        <SafeAreaView style={styles.safeArea}>
            <GlassToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />
            
            {/* Ambient background glows */}
            {/*
            <View style={styles.ambientGlow1} />
            <View style={styles.ambientGlow2} />
            <View style={styles.ambientGlow3} />
            */}

            {/* Header bar */}
            <View style={styles.header}>
                {/* Back button placeholder or actual button */}
                {isTelegram ? (
                    <View style={{ width: 38 }} />
                ) : (
                    <TouchableOpacity 
                        onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Watchlist' })}
                        activeOpacity={0.8}
                        style={{ 
                            width: 38, 
                            height: 38, 
                            borderRadius: 12, 
                            backgroundColor: isDark ? '#000000' : '#F1F5F9', 
                            borderWidth: 1, 
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)', 
                            justifyContent: 'center', 
                            alignItems: 'center' 
                        }}
                    >
                        <ArrowLeft color={colors.text} size={18} />
                    </TouchableOpacity>
                )}

                {/* Model dropdown selector */}
                <TouchableOpacity 
                    style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }} 
                    onPress={() => setIsModelMenuOpen(!isModelMenuOpen)}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <GlassView
                            intensity={isDark ? 30 : 80}
                            tint={isDark ? 'dark' : 'light'}
                            style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                paddingHorizontal: 16, 
                                paddingVertical: 8,
                                borderWidth: 0
                            }}
                        >
                            <Bot color={colors.primary} size={18} style={{ marginRight: 6 }} />
                            <Text style={styles.headerModelText}>{selectedModel}</Text>
                            <ChevronDown color={colors.textMuted} size={16} style={{ marginLeft: 4 }} />
                        </GlassView>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Clear Chat Button */}
                <TouchableOpacity 
                    onPress={clearChat}
                    activeOpacity={0.8}
                    style={{ 
                        width: 38, 
                        height: 38, 
                        borderRadius: 12, 
                        backgroundColor: isDark ? '#000000' : '#F1F5F9', 
                        borderWidth: 1, 
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)', 
                        justifyContent: 'center', 
                        alignItems: 'center' 
                    }}
                >
                    <Trash2 color={colors.text} size={18} />
                </TouchableOpacity>
            </View>

            {/* Dropdown Menu below Header */}
            {isModelMenuOpen && (
                <View style={styles.dropdownOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsModelMenuOpen(false)} />
                    {isDark ? (
                        <GlassView 
                            intensity={100} 
                            tint="dark"
                            style={[
                                styles.dropdownCard, 
                                { 
                                    backgroundColor: 'rgba(10, 12, 18, 0.08)',
                                    borderColor: 'rgba(255, 255, 255, 0.12)',
                                    borderWidth: 1,
                                    ...Platform.select({
                                        web: {
                                            backdropFilter: 'blur(20px) saturate(160%)',
                                            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                                        },
                                        default: {}
                                    })
                                }
                            ]}
                        >
                            {modelOptions.map((opt) => {
                                const Icon = opt.icon;
                                const isSel = selectedModel === opt.name;
                                return (
                                    <TouchableOpacity 
                                        key={opt.name} 
                                        style={styles.dropdownItem} 
                                        onPress={() => { 
                                            setSelectedModel(opt.name); 
                                            setIsModelMenuOpen(false); 
                                        }}
                                    >
                                        <View style={styles.dropdownIconBox}>
                                            <Icon color={isSel ? colors.primary : colors.textMuted} size={18} />
                                        </View>
                                        <View style={styles.spacer}>
                                            <Text style={[styles.dropdownTitle, isSel && { color: colors.primary }]}>{opt.name}</Text>
                                            <Text style={styles.dropdownSub}>{opt.desc}</Text>
                                        </View>
                                        {isSel && <Check color={colors.primary} size={18} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </GlassView>
                    ) : (
                        <View style={styles.dropdownCard}>
                            {modelOptions.map((opt) => {
                                const Icon = opt.icon;
                                const isSel = selectedModel === opt.name;
                                return (
                                    <TouchableOpacity 
                                        key={opt.name} 
                                        style={styles.dropdownItem} 
                                        onPress={() => { 
                                            setSelectedModel(opt.name); 
                                            setIsModelMenuOpen(false); 
                                        }}
                                    >
                                        <View style={styles.dropdownIconBox}>
                                            <Icon color={isSel ? colors.primary : colors.textMuted} size={18} />
                                        </View>
                                        <View style={styles.spacer}>
                                            <Text style={[styles.dropdownTitle, isSel && { color: colors.primary }]}>{opt.name}</Text>
                                            <Text style={styles.dropdownSub}>{opt.desc}</Text>
                                        </View>
                                        {isSel && <Check color={colors.primary} size={18} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            )}

            <KeyboardAvoidingView
                style={styles.container}
                behavior="padding"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                enabled={Platform.OS === 'ios' ? true : isKeyboardActive}
            >
                {messages.length === 0 ? (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.landingContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                        
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <View style={styles.pillsContainer}>
                            <View style={styles.pillRow}>
                                <TouchableOpacity 
                                    style={{ flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }} 
                                    onPress={() => setInputText("Audit my open trades and evaluate my overall risk exposure relative to my account equity.")}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={{ flex: 1 }}
                                    >
                                        <GlassView
                                            intensity={isDark ? 30 : 80}
                                            tint={isDark ? 'dark' : 'light'}
                                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 16, width: '100%', height: '100%', borderWidth: 0 }}
                                        >
                                            <ShieldAlert color={colors.primary} size={16} style={{ marginRight: 8 }} />
                                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Risk Exposure</Text>
                                        </GlassView>
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={{ flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }} 
                                    onPress={() => setInputText("Analyze the current market structure and Smart Money Concepts (SMC) setups for major assets.")}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={{ flex: 1 }}
                                    >
                                        <GlassView
                                            intensity={isDark ? 30 : 80}
                                            tint={isDark ? 'dark' : 'light'}
                                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 16, width: '100%', height: '100%', borderWidth: 0 }}
                                        >
                                            <Zap color={colors.primary} size={16} style={{ marginRight: 8 }} />
                                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>SMC Analysis</Text>
                                        </GlassView>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.pillRow}>
                                <TouchableOpacity 
                                    style={{ flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }} 
                                    onPress={() => setInputText("Identify potential liquidity pools and high-probability sweep zones for key currency pairs.")}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={{ flex: 1 }}
                                    >
                                        <GlassView
                                            intensity={isDark ? 30 : 80}
                                            tint={isDark ? 'dark' : 'light'}
                                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 16, width: '100%', height: '100%', borderWidth: 0 }}
                                        >
                                            <TrendingUp color={colors.primary} size={16} style={{ marginRight: 8 }} />
                                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Liquidity Sweep</Text>
                                        </GlassView>
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={{ flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }} 
                                    onPress={() => setInputText("Generate a complete, structured trading plan for today based on current market trends and news events.")}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={{ flex: 1 }}
                                    >
                                        <GlassView
                                            intensity={isDark ? 30 : 80}
                                            tint={isDark ? 'dark' : 'light'}
                                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 16, width: '100%', height: '100%', borderWidth: 0 }}
                                        >
                                            <Cpu color={colors.primary} size={16} style={{ marginRight: 8 }} />
                                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Trading Plan</Text>
                                        </GlassView>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Find Broker Card */}
                        <TouchableOpacity 
                            style={styles.findBrokerCard}
                            onPress={() => navigation.navigate('ToolsHub', { initialActiveTool: 'broker_list' })}
                            activeOpacity={0.8}
                        >
                            <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }}>
                                <LinearGradient 
                                    colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']} 
                                    start={{ x: 0, y: 0 }} 
                                    end={{ x: 1, y: 1 }}
                                >
                                    <GlassView
                                        intensity={isDark ? 30 : 80}
                                        tint={colors.blurTint}
                                        style={{ padding: 18, borderWidth: 0 }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <View style={{ flex: 1, marginRight: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                                    <Search color={colors.text} size={18} style={{ marginRight: 8 }} />
                                                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Find Broker</Text>
                                                </View>
                                                <Text style={{ color: colors.textSubtle, fontSize: 12, lineHeight: 18 }}>Compare and find top institutional brokers matching your region, leverage requirements, and spreads.</Text>
                                            </View>
                                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)', borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)', justifyContent: 'center', alignItems: 'center' }}>
                                                <Cpu color={colors.text} size={22} />
                                            </View>
                                        </View>
                                    </GlassView>
                                </LinearGradient>
                            </View>
                        </TouchableOpacity>

                        {/* AI & Institutional Tools Card */}
                        <TouchableOpacity 
                            style={styles.findBrokerCard}
                            onPress={() => navigation.navigate('ToolsHub', { initialActiveTool: 'tools_hub' })}
                            activeOpacity={0.8}
                        >
                            <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }}>
                                <LinearGradient 
                                    colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']} 
                                    start={{ x: 0, y: 0 }} 
                                    end={{ x: 1, y: 1 }}
                                >
                                    <GlassView
                                        intensity={isDark ? 30 : 80}
                                        tint={colors.blurTint}
                                        style={{ padding: 18, borderWidth: 0 }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <View style={{ flex: 1, marginRight: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                                    <Layers color={colors.text} size={18} style={{ marginRight: 8 }} />
                                                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>AI & Institutional Tools</Text>
                                                </View>
                                                <Text style={{ color: colors.textSubtle, fontSize: 12, lineHeight: 18 }}>Access advanced tools including Liquidity Map, SMC Scanner, Risk Calculator, and News Radar.</Text>
                                            </View>
                                            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)', borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)', justifyContent: 'center', alignItems: 'center' }}>
                                                <Cpu color={colors.text} size={22} />
                                            </View>
                                        </View>
                                    </GlassView>
                                </LinearGradient>
                            </View>
                        </TouchableOpacity>
                    </ScrollView>
                ) : (
                    <FlatListAny
                        ref={flatListRef}
                        style={{ flex: 1 }}
                        data={messages}
                        keyExtractor={(_, index: number) => index.toString()}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.listContent}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        keyboardShouldPersistTaps="handled"
                        ListFooterComponent={loading ? (
                            <View style={[styles.messageWrapper, styles.messageWrapperAI, { marginBottom: 10 }]}>
                                <GlassView 
                                    intensity={15} 
                                    style={[styles.messageBubble, styles.messageBubbleAI, { minWidth: 120, flexDirection: 'row', alignItems: 'center' }]}
                                >
                                    <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>Processing...</Text>
                                </GlassView>
                            </View>
                        ) : null}
                    />
                )}

                <View style={[styles.floatingInputWrapper, { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassCardBorder }]}>
                    <LinearGradient
                        colors={isDark ? ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.01)'] : ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.15)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <GlassView
                            intensity={isDark ? 30 : 80}
                            tint={colors.blurTint}
                            style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                paddingHorizontal: 8, 
                                paddingVertical: 6, 
                                height: 56,
                                borderWidth: 0
                            }}
                        >
                            <TouchableOpacity style={styles.iconButton}>
                                <Paperclip color={colors.textMuted} size={20} />
                            </TouchableOpacity>

                            <TextInput
                                style={styles.input}
                                placeholder="Message MaxAI..."
                                placeholderTextColor={colors.textMuted}
                                value={inputText}
                                onChangeText={setInputText}
                                multiline={false}
                                onSubmitEditing={sendMessage}
                            />

                            {inputText.trim() ? (
                                <TouchableOpacity
                                    style={styles.sendButtonActive}
                                    onPress={sendMessage}
                                    disabled={loading}
                                >
                                    {loading ? <ActivityIndicator color="#FFF" size="small" /> : <ArrowUp color="#FFF" size={18} />}
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.rightIconsContainer}>
                                    <TouchableOpacity style={styles.rightIconButton} onPress={() => setIsModelMenuOpen(true)}>
                                        <Rocket color={colors.textMuted} size={20} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.micButton}>
                                        <Mic color={isDark ? '#FFF' : colors.text} size={18} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </GlassView>
                    </LinearGradient>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    safeArea: { 
        flex: 1, 
        backgroundColor: colors.background, 
        paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop(),
        position: 'relative'
    },
    ambientGlow1: {
        position: 'absolute',
        top: 80,
        left: -100,
        width: 350,
        height: 350,
        borderRadius: 175,
        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(37, 99, 235, 0.05)',
        zIndex: -1,
    },
    ambientGlow2: {
        position: 'absolute',
        bottom: 100,
        right: -80,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: isDark ? 'rgba(168, 85, 247, 0.07)' : 'rgba(124, 58, 237, 0.04)',
        zIndex: -1,
    },
    ambientGlow3: {
        position: 'absolute',
        top: '40%',
        left: '20%',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.02)',
        zIndex: -1,
    },
    header: { 
        height: 64, 
        paddingHorizontal: 16, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
        backgroundColor: 'transparent',
    },
    headerSpacer: { width: 40 },
    headerModelBtn: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', 
        paddingHorizontal: 16, 
        paddingVertical: 8, 
        borderRadius: 20,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    headerModelText: { color: colors.text, fontSize: 14, fontWeight: '800' },
    headerClearBtn: { padding: 8 },
    container: { flex: 1, backgroundColor: 'transparent' },
    listContent: { padding: 16, paddingBottom: 16 },

    // Landing screen styles
    landingContainer: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
    logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, justifyContent: 'center' },
    logoText: { color: colors.text, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
    landingSub: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 16, letterSpacing: 0.5 },
    pillsContainer: { width: '100%', gap: 12 },
    pillRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
    actionPill: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', 
        paddingHorizontal: 16, 
        paddingVertical: 14, 
        borderRadius: 16, 
        borderWidth: 1, 
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        flex: 1,
        justifyContent: 'center'
    },
    findBrokerCard: {
        width: '100%',
        marginTop: 16,
        marginBottom: 8,
    },
    
    // Tools Grid
    toolsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    toolCard: {
        width: '48%',
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        alignItems: 'flex-start',
    },
    toolIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    toolTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 4 },
    toolDesc: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },

    // Chat bubble styles
    messageWrapper: { flexDirection: 'row', marginBottom: 20, alignItems: 'flex-start', width: '100%' },
    messageWrapperUser: { justifyContent: 'flex-end', paddingLeft: 60 },
    messageWrapperAI: { justifyContent: 'flex-start', paddingRight: 60 },
    avatarAI: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    messageBubble: { padding: 16, borderRadius: 20, borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.08)', flexShrink: 1 },
    messageBubbleUser: { 
        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)', 
        borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
        borderBottomRightRadius: 4,
        flexShrink: 1,
        maxWidth: '100%'
    },
    messageBubbleAI: { 
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)', 
        borderBottomLeftRadius: 4,
        flexShrink: 1,
        maxWidth: '100%'
    },
    messageText: { fontSize: 15, lineHeight: 22, color: colors.text },

    // Widget Styles
    widgetCard: { width: '100%', alignSelf: 'stretch', marginTop: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.08)' },
    widgetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    widgetTitle: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
    widgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    widgetLabel: { color: colors.textMuted, fontSize: 13 },
    widgetValue: { color: colors.text, fontSize: 14, fontWeight: 'bold' },
    widgetSuggestionList: { marginTop: 12 },
    widgetSuggestionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    widgetSuggestionText: { color: colors.text, fontSize: 13, flex: 1 },
    confidenceBadge: { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    confidenceText: { color: colors.text, fontSize: 11, fontWeight: 'bold' },
    widgetTargetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    executeSignalBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    executeSignalBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5 },
    sentimentBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
    sentimentLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    sentimentLabelBullish: { color: colors.success, fontSize: 12, fontWeight: 'bold' },
    sentimentLabelBearish: { color: colors.danger, fontSize: 12, fontWeight: 'bold' },
    sentimentDriversContainer: { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', padding: 10, borderRadius: 8 },
    sentimentDriverText: { color: '#64748B', fontSize: 12, marginBottom: 4 },

    floatingInputWrapper: { marginHorizontal: 16, marginBottom: Platform.OS === 'ios' ? 16 : 16, marginTop: 8 },
    linearInputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 8, 
        paddingVertical: 6, 
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)', 
        borderWidth: 0,
        borderBottomWidth: 2, 
        borderBottomColor: colors.primary, 
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        height: 56,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 8,
    },
    input: { 
        flex: 1, 
        color: colors.text, 
        fontSize: 15, 
        paddingHorizontal: 12, 
        height: '100%',
        ...Platform.select({
            web: {
                outlineStyle: 'none' as any,
                outlineWidth: 0,
            }
        })
    },
    iconButton: { padding: 10 },
    rightIconButton: { padding: 8 },
    rightIconsContainer: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    micButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center', marginLeft: 6, marginRight: 2 },
    sendButtonActive: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 8, marginRight: 2 },

    // Dropdown menu styles (renders inline below header)
    dropdownOverlay: { position: 'absolute', top: 64, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.4)' },
    dropdownCard: { 
        position: 'absolute',
        top: 8,
        left: 16,
        right: 16,
        borderRadius: 20, 
        padding: 8,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        backgroundColor: isDark ? 'rgba(15,22,36,0.98)' : 'rgba(255,255,255,0.98)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
    dropdownIconBox: { width: 32 },
    dropdownTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
    dropdownSub: { color: colors.textMuted, fontSize: 12 },

    spacer: { flex: 1 },
});
