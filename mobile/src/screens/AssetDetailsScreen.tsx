// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform, Dimensions, ActivityIndicator, Modal, Image, KeyboardAvoidingView, Keyboard, Alert } from 'react-native';
import { Text, TextInput } from '../components/Typography';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import io from 'socket.io-client';
import axios from 'axios';
import Svg, { Path, Circle, Line, G, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Share2, Clock, Activity, Zap, Info, ChevronLeft, Bell, TrendingUp, TrendingDown, AlignLeft, BarChart2, Calendar, Target, AlertTriangle, PenTool, Eraser, Trash2, Maximize, Minimize, Settings, Ruler, Search, MoreVertical, Layers, Lightbulb, Share, Send, Heart, MessageSquare, X, Image as ImageIcon } from 'lucide-react-native';
import { colors as defaultColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { BACKEND_URL, getTgSafeAreaTop, isTelegram } from '../config';
import { getItemAsync } from '../utils/storage';

const { width } = Dimensions.get('window');

// Mock data based on provided screenshots
const assetData = {
    symbol: 'GOLD',
    name: 'CFDs on Gold (US$ / OZ)',
    price: '4,569.94',
    currency: 'USD',
    change: '-12.45',
    changePct: '-0.27%',
    isPositive: false,
    logoBadge: 'Au',
    logoColor: '#B68925',
    keyData: {
        volume: 'N/A',
        prevClose: 'N/A',
        open: 'N/A',
        daysRange: 'N/A'
    }
};

const TABS = ['Live Chat', 'Overview'];

// Helper for generating the HTML string for KLineChart in WebView (Static configuration, never reloads WebView)
const getChartHtml = (symbol: string, colors: any) => {
    const isDark = colors.background === '#000000';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)';
    const axisColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
    const tickTextColor = isDark ? '#848E9C' : '#64748B';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
        body { margin: 0; padding: 0; background-color: ${colors.background || '#000000'}; color: ${colors.text || '#FFFFFF'}; overflow: hidden; }
        #tvchart { position: absolute; width: 100vw; height: 100vh; top: 0; left: 0; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/klinecharts/dist/klinecharts.min.js"></script>
</head>
<body>
    <div id="tvchart"></div>
    <script>
        let chart;
        function initChart() {
            chart = klinecharts.init('tvchart', {
                styles: {
                    grid: {
                        horizontal: { color: '${gridColor}', style: 'dashed' },
                        vertical: { color: '${gridColor}', style: 'dashed' }
                    },
                    candle: {
                        type: 'candle_solid',
                        bar: {
                            upColor: '#089981',
                            downColor: '#F23645',
                            noChangeColor: '#848E9C',
                            upBorderColor: '#089981',
                            downBorderColor: '#F23645',
                            noChangeBorderColor: '#848E9C',
                            upWickColor: '#089981',
                            downWickColor: '#F23645',
                            noChangeWickColor: '#848E9C'
                        },
                        area: {
                            lineColor: '#2962FF',
                            fillColor: [{ offset: 0, color: 'rgba(41, 98, 255, 0.4)' }, { offset: 1, color: 'rgba(41, 98, 255, 0.05)' }]
                        },
                        priceMark: {
                            last: {
                                show: true,
                                upColor: '#089981',
                                downColor: '#F23645',
                                noChangeColor: '#848E9C',
                                line: {
                                    show: true,
                                    style: 'dashed',
                                    dashValue: [4, 4],
                                    size: 1
                                },
                                text: {
                                    show: true,
                                    color: '#FFFFFF',
                                    size: 12,
                                    family: '-apple-system, system-ui, sans-serif'
                                }
                            }
                        }
                    },
                    xAxis: { tickText: { color: '${tickTextColor}' }, axisLine: { color: '${axisColor}' } },
                    yAxis: { tickText: { color: '${tickTextColor}' }, axisLine: { color: '${axisColor}' } }
                }
            });
            
            // Notify native that chart is ready
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
            } else {
                parent.postMessage(JSON.stringify({ type: 'ready' }), '*');
            }
        }

        function handleIncomingMessage(incomingData) {
            try {
                let data = incomingData;
                if (typeof data === 'string') data = JSON.parse(data);

                if (data.type === 'historical') {
                    if (chart) {
                        chart.clearData(); // Clears cache to refresh chart bounds for new timeframes
                        chart.applyNewData(data.data);
                    }
                } else if (data.type === 'update') {
                    if (chart) chart.updateData(data.data);
                } else if (data.type === 'changeType') {
                    if (chart) chart.setStyles({
                        candle: {
                            type: data.chartType === 'line' ? 'area' : 'candle_solid'
                        }
                    });
                }
            } catch (e) {
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.message }));
                }
            }
        }
        window.handleChartMessageFromApp = handleIncomingMessage;
        window.addEventListener('message', (event) => {
            handleIncomingMessage(event.data);
        });

        window.addEventListener('resize', () => {
            if (chart) chart.resize();
        });
        
        window.onload = initChart;
    </script>
</body>
</html>
`;
};

const avatars: Record<string, any> = {
    default: require('../../assets/avatars/default.png'),
    dbz_trunks_01: require('../../assets/avatars/dbz-trunks-pfp-01.jpg'),
    dbz_trunks_02: require('../../assets/avatars/dbz-trunks-pfp-02.jpg'),
    dbz_trunks_03: require('../../assets/avatars/dbz-trunks-pfp-03.jpg'),
    dbz_trunks_08: require('../../assets/avatars/dbz-trunks-pfp-08.jpg'),
    dbz_trunks_10: require('../../assets/avatars/dbz-trunks-pfp-10.jpg'),
    dbz_trunks_11: require('../../assets/avatars/dbz-trunks-pfp-11.jpg'),
    dbz_trunks_12: require('../../assets/avatars/dbz-trunks-pfp-12.jpg'),
    dbz_trunks_19: require('../../assets/avatars/dbz-trunks-pfp-19.jpg'),
    dbz_trunks_21: require('../../assets/avatars/dbz-trunks-pfp-21.jpg'),
    dbz_trunks_26: require('../../assets/avatars/dbz-trunks-pfp-26.jpg'),
    dbz_trunks_35: require('../../assets/avatars/dbz-trunks-pfp-35.jpg'),
    dbz_trunks_38: require('../../assets/avatars/dbz-trunks-pfp-38.jpg'),
    dbz_trunks_45: require('../../assets/avatars/dbz-trunks-pfp-45.jpg'),
    dbz_trunks_48: require('../../assets/avatars/dbz-trunks-pfp-48.jpg'),
    gwenpool_01: require('../../assets/avatars/gwenpool-pfp-01.jpg'),
    gwenpool_02: require('../../assets/avatars/gwenpool-pfp-02.jpg'),
    gwenpool_03: require('../../assets/avatars/gwenpool-pfp-03.jpg'),
    gwenpool_05: require('../../assets/avatars/gwenpool-pfp-05.jpg'),
    gwenpool_08: require('../../assets/avatars/gwenpool-pfp-08.jpg'),
    gwenpool_10: require('../../assets/avatars/gwenpool-pfp-10.jpg'),
    gwenpool_11: require('../../assets/avatars/gwenpool-pfp-11.jpg'),
    gwenpool_12: require('../../assets/avatars/gwenpool-pfp-12.jpg'),
    gwenpool_16: require('../../assets/avatars/gwenpool-pfp-16.jpg'),
    gwenpool_17: require('../../assets/avatars/gwenpool-pfp-17.jpg'),
    gwenpool_18: require('../../assets/avatars/gwenpool-pfp-18.jpg'),
    gwenpool_19: require('../../assets/avatars/gwenpool-pfp-19.jpg'),
    gwenpool_23: require('../../assets/avatars/gwenpool-pfp-23.jpg'),
    gwenpool_24: require('../../assets/avatars/gwenpool-pfp-24.jpg'),
    gwenpool_25: require('../../assets/avatars/gwenpool-pfp-25.jpg'),
    gwenpool_27: require('../../assets/avatars/gwenpool-pfp-27.jpg'),
    gwenpool_29: require('../../assets/avatars/gwenpool-pfp-29.jpg'),
    gwenpool_35: require('../../assets/avatars/gwenpool-pfp-35.jpg')
};

const getAvatarSource = (avatarUrl: string | null) => {
    if (!avatarUrl) return null;
    if (avatarUrl === 'default') return avatars.default;
    if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
        return { uri: avatarUrl };
    }
    return avatars[avatarUrl] || null;
};

function AssetLogo({ symbol, logoColor, logoBadge, size = 32 }: { symbol: string; logoColor?: string; logoBadge?: string; size?: number }) {
    const s = symbol.toUpperCase();
    
    // 1. Forex overlapping flag icons
    if (s.includes('/') && !s.endsWith('/USDT') && !s.endsWith('/BTC')) {
        const parts = s.split('/');
        const first = parts[0];
        const second = parts[1];
        
        const currencyMap: Record<string, string> = {
            EUR: 'eu', USD: 'us', GBP: 'gb', JPY: 'jp', CAD: 'ca', CHF: 'ch', AUD: 'au', NZD: 'nz'
        };
        
        const code1 = currencyMap[first] || first.substring(0, 2).toLowerCase();
        const code2 = currencyMap[second] || second.substring(0, 2).toLowerCase();
        
        const uri1 = `https://flagcdn.com/w80/${code1}.png`;
        const uri2 = `https://flagcdn.com/w80/${code2}.png`;
        
        return (
            <View style={{ width: size + 6, height: size, position: 'relative', marginRight: 8 }}>
                <Image source={{ uri: uri1 }} style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2, position: 'absolute', left: 0, top: 2, zIndex: 2, borderWidth: 1.5, borderColor: '#000000' }} />
                <Image source={{ uri: uri2 }} style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2, position: 'absolute', right: 0, bottom: 2, zIndex: 1, borderWidth: 1.5, borderColor: '#000000' }} />
            </View>
        );
    }
    
    // 2. Crypto logos from CoinGecko / GitHub raw CDN
    const cryptoUris: Record<string, string> = {
        'BTC/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png',
        'ETH/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png',
        'SOL/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/sol.png',
        'BNB/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/bnb.png',
        'XRP/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/xrp.png',
        'ADA/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/ada.png',
        'DOGE/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/doge.png',
        'AVAX/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/avax.png',
        'LINK/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/link.png',
        'DOT/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/dot.png',
        'MATIC/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/matic.png',
        'SHIB/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/shib.png',
        'LTC/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/ltc.png',
        'TRX/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/trx.png',
        'UNI/USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/uni.png',
        'TON/USDT': 'https://assets.coingecko.com/coins/images/17980/large/ton_token_blue.png',
        'NOT/USDT': 'https://assets.coingecko.com/coins/images/37859/large/notcoin.png',
        'PEPE/USDT': 'https://assets.coingecko.com/coins/images/29850/large/pepe-token.png'
    };
    
    if (cryptoUris[s]) {
        const uri = cryptoUris[s];
        return (
            <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#1E222D', overflow: 'hidden', marginRight: 8, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            </View>
        );
    }
    
    // 3. Fallback badge
    return (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: logoColor || '#B68925', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
            <Text style={{ color: '#FFF', fontSize: size * 0.4, fontWeight: 'bold' }}>{logoBadge || s.substring(0, 2)}</Text>
        </View>
    );
}

// Helper SVG Gauge Component
const SpeedometerGauge = ({ value, label, mainColor }: { value: number, label: string, mainColor: string }) => {
    const { colors } = useTheme();
    const clampedValue = Math.min(Math.max(value, 0), 1);
    const angle = Math.PI * (1 - clampedValue);

    const r = 80;
    const cx = 100;
    const cy = 90;

    const needleLen = 65;
    const nx = cx + needleLen * Math.cos(angle);
    const ny = cy - needleLen * Math.sin(angle);

    return (
        <View style={{ alignItems: 'center', marginVertical: 10 }}>
            <Svg width="200" height="110" viewBox="0 0 200 110">
                <Defs>
                    <SvgLinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#F23645" />
                        <Stop offset="50%" stopColor="#A855F7" />
                        <Stop offset="100%" stopColor="#089981" />
                    </SvgLinearGradient>
                </Defs>
                <Path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round" />
                <Path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round" opacity="0.8" />
                <Line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
                <Circle cx={cx} cy={cy} r="6" fill={mainColor} />
            </Svg>
            <Text style={{ color: mainColor, fontSize: 16, fontWeight: 'bold', marginTop: -15, zIndex: 10 }}>{label}</Text>
        </View>
    );
};

export default function AssetDetailsScreen({ navigation, route }: any) {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
    const asset = route?.params?.asset || assetData;
    
    const [activeTab, setActiveTab] = useState('Live Chat');
    const [livePrice, setLivePrice] = useState(asset.price);
    const [chartDataStr, setChartDataStr] = useState("[]");
    const [selectedInterval, setSelectedInterval] = useState('1h');
    const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
    const [inputText, setInputText] = useState('');
    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [token, setToken] = useState<string | null>(null);
    const [scrollEnabled, setScrollEnabled] = useState(true);
    const [isInputFocused, setIsInputFocused] = useState(false);

    const [chatMessages, setChatMessages] = useState<any[]>([]);

    const webviewRef = useRef<WebView>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const chatInputRef = useRef<any>(null);
    const socketRef = useRef<any>(null);

    const INTERVALS = [{ label: '1H', value: '1h' }, { label: '4H', value: '4h' }, { label: '1D', value: '1d' }, { label: '1W', value: '1w' }, { label: '1M', value: '1mo' }];

    // Fetch user profile on focus
    useFocusEffect(
        useCallback(() => {
            const loadUser = async () => {
                try {
                    const storedToken = await getItemAsync('accessToken');
                    setToken(storedToken);
                    if (storedToken) {
                        const res = await axios.get(`${BACKEND_URL}/api/v1/auth/me`, {
                            headers: { Authorization: `Bearer ${storedToken}` }
                        });
                        if (res.data.success) {
                            setCurrentUser(res.data.data);
                        }
                    }
                } catch (e) {
                    console.log('Error loading user profile:', e);
                }
            };
            loadUser();
        }, [])
    );

    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        if (Platform.OS === 'web') {
            if (typeof window === 'undefined' || !window.visualViewport) return;
            const handleResize = () => {
                if (!window.visualViewport) return;
                const diff = window.innerHeight - window.visualViewport.height;
                setKeyboardHeight(diff > 150 ? diff : 0);
            };
            window.visualViewport.addEventListener('resize', handleResize);
            return () => {
                if (window.visualViewport) {
                    window.visualViewport.removeEventListener('resize', handleResize);
                }
            };
        } else {
            const showSub = Keyboard.addListener(
                Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
                (e) => setKeyboardHeight(e.endCoordinates.height)
            );
            const hideSub = Keyboard.addListener(
                Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
                () => setKeyboardHeight(0)
            );
            return () => {
                showSub.remove();
                hideSub.remove();
            };
        }
    }, []);

    // Set up Socket logic for Price Updates and Real-Time Chat messages
    useEffect(() => {
        const socket = io(BACKEND_URL, { transports: ['websocket'] });
        socketRef.current = socket;

        // 1. Subscribe to Live Price Ticks
        socket.emit('subscribe', asset.symbol);
        socket.on('priceUpdate', (data: any) => {
            if (data && data.symbol === asset.symbol) {
                setLivePrice(data.price);
                const tick = {
                    timestamp: Date.now(),
                    open: parseFloat(data.price),
                    high: parseFloat(data.price),
                    low: parseFloat(data.price),
                    close: parseFloat(data.price),
                    volume: 0
                };
                const updateMsg = JSON.stringify({ type: 'update', data: tick });
                sendMessageToChart(updateMsg);
            }
        });

        // 2. Join Community Chat Room
        socket.emit('joinChat', asset.symbol);
        
        socket.on('chatHistory', (messages: any[]) => {
            const reversed = [...messages].reverse();
            setChatMessages(reversed);
        });

        socket.on('newMessage', (msg: any) => {
            setChatMessages(prev => {
                if (prev.some(m => (m._id || m.id) === (msg._id || msg.id))) return prev;
                const tempIndex = prev.findIndex(m => 
                    m.id?.startsWith('temp_') && 
                    (m.content === msg.text || m.text === msg.text)
                );
                if (tempIndex !== -1) {
                    const updated = [...prev];
                    updated[tempIndex] = msg;
                    return updated;
                }
                return [msg, ...prev];
            });
        });

        socket.on('messageLiked', (data: { messageId: string, likes: string[] }) => {
            setChatMessages(prev => prev.map(msg => {
                if ((msg._id || msg.id) === data.messageId) {
                    return {
                        ...msg,
                        likes: data.likes,
                        liked: currentUser ? data.likes.includes(currentUser._id) : false
                    };
                }
                return msg;
            }));
        });

        return () => {
            socket.emit('leaveChat', asset.symbol);
            socket.disconnect();
        };
    }, [asset.symbol, currentUser]);

    // Send Message / Reply Handler
    const handleSendMessage = () => {
        if (!inputText.trim() && !attachedImage) return;

        if (!token || token === 'null' || token === 'undefined') {
            Alert.alert('Authentication Required', 'Please log in from the Profile tab to send messages in the live chat.');
            return;
        }

        const tempId = `temp_${Date.now()}`;
        const cleanText = inputText.trim();

        const activeUsername = currentUser?.username || currentUser?.name || currentUser?.email?.split('@')[0] || 'User';
        const userAvatar = currentUser?.avatarImg || currentUser?.avatarUrl || currentUser?.imageUrl || null;
        const newMsg = {
            id: tempId,
            _id: tempId,
            username: `@${activeUsername}`,
            avatarImg: userAvatar,
            avatar: activeUsername.charAt(0).toUpperCase(),
            avatarColor: currentUser?.avatarColor || '#3B82F6',
            time: 'Just now',
            content: cleanText,
            text: cleanText,
            likes: [],
            repliesCount: 0,
            image: attachedImage,
            mediaUrl: attachedImage,
            replyTo: replyingTo ? {
                _id: replyingTo._id || replyingTo.id,
                username: replyingTo.username,
                text: replyingTo.text || replyingTo.content
            } : null,
            liked: false
        };

        // 2. Append optimistic message immediately to the chat view
        setChatMessages(prev => [newMsg, ...prev]);

        // 3. Emit via socket if logged in
        if (socketRef.current && token && token !== 'null' && token !== 'undefined') {
            socketRef.current.emit('sendMessage', {
                room: asset.symbol,
                text: cleanText,
                mediaUrl: attachedImage || undefined,
                replyTo: replyingTo ? (replyingTo._id || replyingTo.id) : undefined,
                token: token
            });
        }

        setInputText('');
        setAttachedImage(null);
        setReplyingTo(null);
        Keyboard.dismiss();
    };

    const handleLikeMessage = (messageId: string) => {
        if (socketRef.current && token) {
            socketRef.current.emit('likeMessage', {
                messageId,
                token,
                room: asset.symbol
            });
        } else {
            setChatMessages(prev => prev.map(msg => {
                if ((msg._id || msg.id) === messageId) {
                    const liked = !msg.liked;
                    const mockLikes = liked ? ['guest'] : [];
                    return {
                        ...msg,
                        liked,
                        likes: mockLikes
                    };
                }
                return msg;
            }));
        }
    };

    const handleReplyAction = (message: any) => {
        setReplyingTo(message);
        setInputText(`@${message.username.replace('@', '')} `);
        chatInputRef.current?.focus();
    };

    const handleAttachImage = async () => {
        try {
            // Request permission first
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission Denied', 'Permission to access camera roll is required!');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
                const base64Data = `data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`;
                // Set temporary base64 preview first so the UI responds immediately
                setAttachedImage(base64Data);

                // Upload to backend if token exists
                const storedToken = await getItemAsync('accessToken');
                if (storedToken && storedToken !== 'null' && storedToken !== 'undefined') {
                    try {
                        const res = await axios.post(`${BACKEND_URL}/api/v1/auth/upload`, {
                            imageBase64: base64Data
                        }, {
                            headers: {
                                Authorization: `Bearer ${storedToken}`
                            }
                        });

                        if (res.data.success && res.data.url) {
                            // Update with the final backend absolute URL
                            setAttachedImage(`${BACKEND_URL}${res.data.url}`);
                        }
                    } catch (uploadErr) {
                        console.log('Backend image upload failed, keeping base64 local preview:', uploadErr);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to attach image:', err);
            Alert.alert('Upload Failed', 'Could not select image');
        }
    };

    // Helper functions for replies threading
    const getParentId = (msg: any) => {
        if (!msg.replyTo) return null;
        if (typeof msg.replyTo === 'object') {
            return msg.replyTo._id || msg.replyTo.id;
        }
        return msg.replyTo;
    };

    const getRepliesForMessage = (msgId: string) => {
        return chatMessages.filter(m => {
            const parentId = getParentId(m);
            return parentId && parentId.toString() === msgId.toString();
        });
    };

    const toggleReplies = (msgId: string) => {
        setExpandedReplies(prev => ({
            ...prev,
            [msgId]: !prev[msgId]
        }));
    };

    // Separate main threads from replies for clean rendering
    const mainMessages = useMemo(() => {
        return chatMessages.filter(m => {
            const parentId = getParentId(m);
            if (!parentId) return true;
            const parentExists = chatMessages.some(parent => (parent._id || parent.id).toString() === parentId.toString());
            return !parentExists;
        });
    }, [chatMessages]);

    const sendMessageToChart = (messageStr: string) => {
        if (Platform.OS === 'web') {
            if (iframeRef.current && iframeRef.current.contentWindow) {
                iframeRef.current.contentWindow.postMessage(messageStr, '*');
            }
        } else {
            if (webviewRef.current && typeof webviewRef.current.injectJavaScript === 'function') {
                webviewRef.current.injectJavaScript(`
                    (function() {
                        if (window.handleChartMessageFromApp) {
                            window.handleChartMessageFromApp(${JSON.stringify(messageStr)});
                        } else {
                            window.postMessage(${JSON.stringify(messageStr)}, '*');
                        }
                    })();
                `);
            }
        }
    };

    // Push new historical candles data to Klinechart without reloading the WebView container
    const postHistoricalData = () => {
        if (chartDataStr !== "[]") {
            const msg = JSON.stringify({ type: 'historical', data: JSON.parse(chartDataStr) });
            sendMessageToChart(msg);
        }
    };

    useEffect(() => {
        postHistoricalData();
    }, [chartDataStr]);

    const handleWebViewMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'ready' || data.type === 'chartReady') {
                postHistoricalData();
            }
        } catch (e) {}
    };

    useEffect(() => {
        if (Platform.OS === 'web') {
            const handleMsg = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'ready' || data.type === 'chartReady') {
                        postHistoricalData();
                    }
                } catch (e) {}
            };
            window.addEventListener('message', handleMsg);
            return () => window.removeEventListener('message', handleMsg);
        }
    }, [chartDataStr]);

    // Fetch Historical Data when Timeframe Interval Changes
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await axios.get(`${BACKEND_URL}/api/v1/market/candles/${asset.symbol}?interval=${selectedInterval}&limit=500`);
                const formattedData = response.data.map((item: any) => ({
                    timestamp: new Date(item.timestamp).getTime(),
                    open: item.open,
                    high: item.high,
                    low: item.low,
                    close: item.close,
                    volume: item.volume || 0
                }));
                formattedData.sort((a: any, b: any) => a.timestamp - b.timestamp);
                setChartDataStr(JSON.stringify(formattedData));
            } catch (error) {
                console.error('Error fetching chart history:', error);
            }
        };
        fetchHistory();
    }, [asset.symbol, selectedInterval]);

    const renderHeader = () => (
        <View style={styles.header}>
            {!isTelegram && (
                <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'Watchlist' })} style={styles.backBtn}>
                    <ChevronLeft color="#FFFFFF" size={24} />
                </TouchableOpacity>
            )}
            
            <View style={styles.headerTitleRow}>
                <AssetLogo symbol={asset.symbol} logoColor={asset.logoColor} logoBadge={asset.logoBadge} size={32} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.headerSymbol}>{asset.symbol}</Text>
                    <Text style={styles.headerName} numberOfLines={1}>{asset.name}</Text>
                </View>
            </View>
            
            <View style={styles.headerActions}>
                <TouchableOpacity style={styles.tradeHeaderBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'Chart', params: { symbol: asset.symbol } })}>
                    <Text style={styles.tradeHeaderBtnText}>TRADE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareBtn}>
                    <Share2 color="#FFFFFF" size={20} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderPriceSection = () => {
        const isPositive = asset.isPositive;
        const changeColor = isPositive ? '#089981' : '#F23645';
        return (
            <View style={styles.priceContainer}>
                <Text style={styles.priceText}>{livePrice}</Text>
                <View style={styles.priceChangeRow}>
                    <Text style={[styles.changeText, { color: changeColor }]}>
                        {asset.changePct || '0.00%'} today
                    </Text>
                </View>
            </View>
        );
    };

    const renderToolbar = () => (
        <View style={styles.toolbarContainer}>
            <View style={styles.intervalsRow}>
                {INTERVALS.map((item) => {
                    const isActive = selectedInterval === item.value;
                    return (
                        <TouchableOpacity
                            key={item.value}
                            style={[styles.intervalBtn, isActive && styles.activeIntervalBtn]}
                            onPress={() => setSelectedInterval(item.value)}
                        >
                            <Text style={[styles.intervalText, isActive && styles.activeIntervalText]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            
            <View style={styles.chartTypeRow}>
                <TouchableOpacity
                    style={[styles.chartTypeBtn, chartType === 'candle' && styles.activeChartTypeBtn]}
                    onPress={() => {
                        setChartType('candle');
                        const msg = JSON.stringify({ type: 'changeType', chartType: 'candle' });
                        sendMessageToChart(msg);
                    }}
                >
                    <Text style={[styles.chartTypeText, chartType === 'candle' && styles.activeChartTypeText]}>
                        🕯
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.chartTypeBtn, chartType === 'line' && styles.activeChartTypeBtn, { marginLeft: 8 }]}
                    onPress={() => {
                        setChartType('line');
                        const msg = JSON.stringify({ type: 'changeType', chartType: 'line' });
                        sendMessageToChart(msg);
                    }}
                >
                    <Text style={[styles.chartTypeText, chartType === 'line' && styles.activeChartTypeText]}>
                        📈
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderChartSection = () => (
        <View 
            style={styles.chartContainer}
            onTouchStart={() => setScrollEnabled(false)}
            onTouchEnd={() => setScrollEnabled(true)}
            onTouchCancel={() => setScrollEnabled(true)}
        >
            {Platform.OS === 'web' ? (
                <iframe ref={iframeRef} srcDoc={getChartHtml(asset.symbol, colors)} style={{ width: '100%', height: '100%', border: 'none' }} />
            ) : (
                <WebView
                    ref={webviewRef}
                    originWhitelist={['*']}
                    source={{ html: getChartHtml(asset.symbol, colors) }}
                    style={{ backgroundColor: 'transparent' }}
                    scrollEnabled={false}
                    javaScriptEnabled={true}
                    onMessage={handleWebViewMessage}
                />
            )}
        </View>
    );

    const renderTabBar = () => (
        <View style={styles.tabsContainer}>
            {TABS.map((tab) => {
                const isActive = activeTab === tab;
                return (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tabBtn, isActive && styles.activeTabBtn]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    const renderChatMessage = (item: any, isReply: boolean = false) => {
        const itemId = item._id || item.id;
        const replies = getRepliesForMessage(itemId);
        const repliesCount = replies.length;
        
        const isMe = !!(currentUser && (
            item.userId === currentUser._id || 
            item.username === `@${currentUser.username}` ||
            item.username === '@you' || item.username === 'you' ||
            item.username === '@You' || item.username === 'You'
        ));

        const activeMyUsername = currentUser ? `@${currentUser.username || currentUser.name || currentUser.email?.split('@')[0] || 'User'}` : '@User';
        const displayUsername = isMe ? activeMyUsername : (item.username === '@you' || item.username === 'you' || item.username === '@You' ? '@User' : (item.username || '@User'));
        const avatarSource = getAvatarSource(item.avatarImg || item.avatarUrl || (isMe ? (currentUser?.avatarImg || currentUser?.avatarUrl) : null));
        
        const likesCount = Array.isArray(item.likes) ? item.likes.length : (item.likes || 0);
        const isLiked = currentUser ? (Array.isArray(item.likes) && item.likes.includes(currentUser._id)) : item.liked;

        return (
            <View key={itemId} style={[styles.chatCardContainer, isReply && { marginLeft: 32 }]}>
                <View style={[styles.chatCard, isMe && styles.chatCardMe]}>
                    <View style={styles.chatCardHeader}>
                        <View style={styles.chatUserRow}>
                            {avatarSource ? (
                                <Image source={avatarSource} style={{ width: 36, height: 36, borderRadius: 18 }} />
                            ) : (
                                <View style={[styles.chatAvatar, { backgroundColor: item.avatarColor || (isMe ? '#2563EB' : '#3B82F6') }]}>
                                    <Text style={styles.chatAvatarText}>
                                        {displayUsername.replace('@', '').substring(0, 2).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <View style={{ marginLeft: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.chatUsername, isMe && { color: '#2563EB', fontWeight: '800' }]}>{displayUsername}</Text>
                                    {isMe && (
                                        <View style={styles.youBadge}>
                                            <Text style={styles.youBadgeText}>YOU</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.chatTime}>{item.time || 'Just now'}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => handleLikeMessage(itemId)} style={styles.heartBtn}>
                            <Heart color={isLiked ? '#F23645' : '#848E9C'} fill={isLiked ? '#F23645' : 'transparent'} size={14} />
                            <Text style={[styles.heartCount, { color: isLiked ? '#F23645' : '#848E9C' }]}>{likesCount}</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.chatBody}>
                        <Text style={styles.chatTextContent}>{item.content || item.text}</Text>
                        {(item.image || item.mediaUrl) && (
                            <Image source={{ uri: item.image || item.mediaUrl }} style={styles.chatAttachedImage} />
                        )}
                    </View>
                    
                    <View style={styles.chatCardFooter}>
                        <TouchableOpacity onPress={() => handleReplyAction(item)} style={styles.chatReplyBtn}>
                            <MessageSquare color="#848E9C" size={14} />
                            <Text style={styles.chatReplyBtnText}>Reply</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Indented Sub-replies section (Instagram-like replies toggle) */}
                {!isReply && repliesCount > 0 && (
                    <View>
                        <TouchableOpacity onPress={() => toggleReplies(itemId)} style={styles.viewRepliesBtn}>
                            <View style={styles.replyLineConnector} />
                            <Text style={styles.viewRepliesText}>
                                {expandedReplies[itemId] ? 'Hide replies' : `View replies (${repliesCount})`}
                            </Text>
                        </TouchableOpacity>
                        
                        {expandedReplies[itemId] && (
                            <View style={styles.nestedRepliesContainer}>
                                {replies.map(reply => renderChatMessage(reply, true))}
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const renderReplyingBar = () => {
        if (!replyingTo) return null;
        return (
            <View style={styles.replyingBar}>
                <Text style={styles.replyingText} numberOfLines={1}>
                    Replying to <Text style={{ fontWeight: 'bold', color: colors.primary }}>{replyingTo.username}</Text>: "{replyingTo.content || replyingTo.text}"
                </Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.cancelReplyBtn}>
                    <X color={colors.textMuted} size={16} />
                </TouchableOpacity>
            </View>
        );
    };

    const renderChatInputBar = () => {
        if (activeTab !== 'Live Chat') return null;

        const isGuest = !token || token === 'null' || token === 'undefined';
        if (isGuest) {
            return (
                <View style={styles.chatInputWrapper}>
                    <View style={[styles.chatInputInner, { justifyContent: 'center', paddingVertical: 12, backgroundColor: '#000000', borderWidth: 1, borderColor: colors.border || '#333333' }]}>
                        <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>
                            Please log in to send messages
                        </Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.chatInputWrapper}>
                {renderReplyingBar()}
                {attachedImage && (
                    <View style={styles.imagePreviewContainer}>
                        <Image source={{ uri: attachedImage }} style={styles.imagePreview} />
                        <TouchableOpacity onPress={() => setAttachedImage(null)} style={styles.removeImageBtn}>
                            <X color="#FFFFFF" size={12} />
                        </TouchableOpacity>
                    </View>
                )}
                <View style={styles.chatInputInner}>
                    <TouchableOpacity onPress={handleAttachImage} style={styles.attachBtn}>
                        <ImageIcon color="#848E9C" size={22} />
                    </TouchableOpacity>
                    
                    <TextInput
                        ref={chatInputRef}
                        style={styles.chatTextInput}
                        placeholder="Message... (use @ to mention)"
                        placeholderTextColor="#848E9C"
                        value={inputText}
                        onChangeText={setInputText}
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                    />
                    
                    {(inputText.trim() || attachedImage) ? (
                        <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
                            <Send color="#2962FF" size={20} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.sendBtn}>
                            <Activity color="#848E9C" size={20} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const renderOverviewContent = () => (
        <View style={styles.overviewContainer}>
            {/* Notes Input */}
            <TouchableOpacity style={styles.notesContainer}>
                <Text style={styles.notesText}>+ Add notes to {asset.symbol}</Text>
            </TouchableOpacity>

            {/* Key Data Points */}
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Key data points</Text>
            </View>
            
            <View style={styles.glassCard}>
                <View style={styles.dataPointRow}>
                    <Text style={styles.dataPointLabel}>Volume</Text>
                    <Text style={styles.dataPointValue}>{asset.keyData?.volume || 'N/A'}</Text>
                </View>
                <View style={styles.dataPointDivider} />
                <View style={styles.dataPointRow}>
                    <Text style={styles.dataPointLabel}>Previous close</Text>
                    <Text style={styles.dataPointValue}>{asset.keyData?.prevClose || 'N/A'}</Text>
                </View>
                <View style={styles.dataPointDivider} />
                <View style={styles.dataPointRow}>
                    <Text style={styles.dataPointLabel}>Open</Text>
                    <Text style={styles.dataPointValue}>{asset.keyData?.open || 'N/A'}</Text>
                </View>
                <View style={styles.dataPointDivider} />
                <View style={styles.dataPointRow}>
                    <Text style={styles.dataPointLabel}>Day's range</Text>
                    <Text style={styles.dataPointValue}>{asset.keyData?.daysRange || 'N/A'}</Text>
                </View>
            </View>

            {/* Premium Pro Data Header */}
            <View style={styles.premiumHeaderRow}>
                <Zap color="#F59E0B" fill="#F59E0B" size={18} />
                <Text style={styles.premiumTitle}>Premium Pro Data</Text>
            </View>

            {/* 1. AI Institutional Insight */}
            <View style={styles.glassCard}>
                <View style={styles.cardHeaderRow}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
                        <Circle color="#A855F7" size={16} fill="none" />
                    </View>
                    <Text style={styles.cardTitle}>AI Institutional Insight</Text>
                </View>
                <Text style={styles.cardBodyText}>Insight currently unavailable. Market data missing.</Text>
            </View>

            {/* 2. AI Sentiment Analysis */}
            <View style={styles.glassCard}>
                <View style={styles.cardHeaderRow}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                        <AlignLeft color="#3B82F6" size={16} />
                    </View>
                    <Text style={styles.cardTitle}>AI Sentiment Analysis</Text>
                </View>
                <Text style={styles.cardSubtitleText}>Calculated based on real-time market data matrix.</Text>
                
                <View style={styles.sentimentProgressContainer}>
                    <View style={[styles.sentimentProgressFill, { flex: 0.75, backgroundColor: '#089981' }]} />
                    <View style={[styles.sentimentProgressFill, { flex: 0.25, backgroundColor: '#F23645' }]} />
                </View>
                
                <View style={styles.sentimentLabelsRow}>
                    <Text style={[styles.sentimentLabel, { color: '#089981' }]}>75% Bullish</Text>
                    <Text style={[styles.sentimentLabel, { color: '#F23645' }]}>25% Bearish</Text>
                </View>
            </View>

            {/* 3. Whale Tracker (Requires API) */}
            <View style={styles.glassCard}>
                <View style={styles.cardHeaderRow}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                        <Activity color="#3B82F6" size={16} />
                    </View>
                    <Text style={styles.cardTitle}>Whale Tracker (Requires API)</Text>
                </View>
                <Text style={styles.cardSubtitleText}>Premium on-chain data (e.g. Glassnode/CryptoQuant) required.</Text>
                
                <View style={styles.whaleDataRow}>
                    <View style={styles.whaleColumn}>
                        <TrendingUp color="#089981" size={16} />
                        <Text style={styles.whaleLabel}>+ $--</Text>
                        <Text style={styles.whaleSubtext}>Inflows</Text>
                    </View>
                    <View style={styles.whaleColumn}>
                        <TrendingDown color="#F23645" size={16} />
                        <Text style={styles.whaleLabel}>-$--</Text>
                        <Text style={styles.whaleSubtext}>Outflows</Text>
                    </View>
                </View>
            </View>

            {/* 4. Volume Profile (Requires Level 2 Data) */}
            <View style={styles.glassCard}>
                <View style={styles.cardHeaderRow}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                        <BarChart2 color="#3B82F6" size={16} />
                    </View>
                    <Text style={styles.cardTitle}>Volume Profile (Requires Level 2 Data)</Text>
                </View>
                <View style={styles.liquidityRow}>
                    <Text style={styles.cardSubtitleText}>Highest liquidity zone today is at</Text>
                    <Text style={styles.liquidityValue}>$--</Text>
                </View>
                
                <View style={styles.volumeProfileBarsContainer}>
                    <View style={[styles.volumeBar, { width: '80%', backgroundColor: 'rgba(41, 98, 255, 0.4)' }]} />
                    <View style={[styles.volumeBar, { width: '95%', backgroundColor: 'rgba(41, 98, 255, 0.5)' }]} />
                    <View style={[styles.volumeBar, { width: '60%', backgroundColor: 'rgba(41, 98, 255, 0.3)' }]} />
                    <View style={[styles.volumeBar, { width: '45%', backgroundColor: 'rgba(41, 98, 255, 0.2)' }]} />
                </View>
            </View>

            {/* 5. Smart Alerts Engine */}
            <View style={styles.glassCard}>
                <View style={styles.cardHeaderRow}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                        <AlertTriangle color="#F59E0B" size={16} />
                    </View>
                    <Text style={styles.cardTitle}>Smart Alerts Engine</Text>
                </View>
                <View style={styles.alertCalloutBox}>
                    <Text style={styles.alertCalloutText}>
                        <Text style={{ fontWeight: 'bold', color: '#F59E0B' }}>Active Setup: </Text>
                        Watching for price action break of structure with RSI convergence.
                    </Text>
                </View>
            </View>

            {/* 6. Upcoming Events Impact */}
            <View style={styles.glassCard}>
                <View style={styles.cardHeaderRow}>
                    <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                        <Calendar color="#3B82F6" size={16} />
                    </View>
                    <Text style={styles.cardTitle}>Upcoming Events Impact</Text>
                </View>
                <View style={styles.loadingCalendarRow}>
                    <Clock color="#848E9C" size={16} />
                    <Text style={styles.loadingCalendarText}>Loading calendar...</Text>
                </View>
            </View>

            {/* Technicals Section */}
            <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Technicals</Text>
            </View>
            
            <View style={styles.glassCard}>
                <View style={styles.gaugeLabelsRow}>
                    <Text style={[styles.gaugeLabelText, { color: '#F23645' }]}>Strong sell</Text>
                    <Text style={[styles.gaugeLabelText, { color: '#848E9C' }]}>Neutral</Text>
                    <Text style={[styles.gaugeLabelText, { color: '#089981' }]}>Strong buy</Text>
                </View>

                <SpeedometerGauge value={0.75} label="Buy" mainColor="#2962FF" />
                
                <View style={styles.gaugeStatsRow}>
                    <View style={styles.gaugeStatCol}>
                        <Text style={styles.gaugeStatVal}>8</Text>
                        <Text style={styles.gaugeStatLabel}>Sell</Text>
                    </View>
                    <View style={styles.gaugeStatCol}>
                        <Text style={styles.gaugeStatVal}>5</Text>
                        <Text style={styles.gaugeStatLabel}>Neutral</Text>
                    </View>
                    <View style={styles.gaugeStatCol}>
                        <Text style={styles.gaugeStatVal}>16</Text>
                        <Text style={styles.gaugeStatLabel}>Buy</Text>
                    </View>
                </View>
                
                <TouchableOpacity style={styles.moreTechnicalsLink}>
                    <Text style={styles.moreTechnicalsLinkText}>More technicals &gt;</Text>
                </TouchableOpacity>
            </View>

            {/* Persistent green Trade Button inside overview scroll */}
            <TouchableOpacity
                style={styles.bigTradeBtn}
                onPress={() => navigation.navigate('MainTabs', { screen: 'Chart', params: { symbol: asset.symbol } })}
            >
                <Text style={styles.bigTradeBtnText}>Trade {asset.symbol}</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {renderHeader()}
                {activeTab === 'Overview' ? (
                    <ScrollView style={styles.scrollContent} scrollEnabled={scrollEnabled} contentContainerStyle={{ paddingBottom: 50 }}>
                        {renderPriceSection()}
                        {renderToolbar()}
                        {renderChartSection()}
                        {renderTabBar()}
                        {renderOverviewContent()}
                    </ScrollView>
                ) : (
                    <KeyboardAvoidingView
                        style={{ flex: 1, paddingBottom: Platform.OS === 'web' ? keyboardHeight : 0 }}
                        behavior="padding"
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 60}
                        enabled={Platform.OS === 'ios' ? true : keyboardHeight > 0}
                    >
                        <View style={keyboardHeight > 0 ? { display: 'none' } : null}>
                            {renderPriceSection()}
                            {renderToolbar()}
                            {renderChartSection()}
                        </View>
                        {renderTabBar()}
                        <ScrollView style={styles.chatList} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
                            {mainMessages.map(item => renderChatMessage(item, false))}
                        </ScrollView>
                        {renderChatInputBar()}
                    </KeyboardAvoidingView>
                )}
            </View>
        </SafeAreaView>
    );
}

const createStyles = (colors: any, isDark: boolean) => ({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop()
    },
    container: {
        flex: 1,
        backgroundColor: colors.background
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    backBtn: {
        padding: 4,
        marginLeft: -4
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginLeft: 8
    },
    headerSymbol: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold'
    },
    headerName: {
        color: colors.textMuted,
        fontSize: 12
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    tradeHeaderBtn: {
        backgroundColor: '#089981',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 18
    },
    tradeHeaderBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800'
    },
    shareBtn: {
        marginLeft: 16,
        padding: 4
    },
    priceContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.background
    },
    priceText: {
        color: colors.text,
        fontSize: 36,
        fontWeight: '900'
    },
    priceChangeRow: {
        marginTop: 4
    },
    changeText: {
        fontSize: 14,
        fontWeight: '600'
    },
    chartContainer: {
        height: 250,
        width: '100%',
        backgroundColor: colors.background
    },
    toolbarContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: colors.background,
    },
    intervalsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    intervalBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginRight: 6,
        borderRadius: 6,
    },
    activeIntervalBtn: {
        backgroundColor: colors.primary,
    },
    intervalText: {
        color: colors.textMuted,
        fontSize: 13,
        fontWeight: 'bold',
    },
    activeIntervalText: {
        color: '#FFFFFF',
    },
    chartTypeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    chartTypeBtn: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: colors.glassButtonBg,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        width: 32,
        height: 32,
    },
    activeChartTypeBtn: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chartTypeText: {
        color: colors.text,
        fontSize: 14,
    },
    activeChartTypeText: {
        color: '#FFFFFF',
    },
    tabsContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: 16,
        backgroundColor: colors.background,
    },
    tabBtn: {
        paddingVertical: 14,
        marginRight: 24,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTabBtn: {
        borderBottomColor: colors.primary,
    },
    tabText: {
        color: colors.textMuted,
        fontSize: 16,
        fontWeight: 'bold',
    },
    activeTabText: {
        color: colors.text,
    },
    scrollContent: {
        flex: 1,
        backgroundColor: colors.background
    },
    chatList: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    chatCardContainer: {
        marginBottom: 12,
    },
    chatCard: {
        backgroundColor: colors.glassCard,
        borderWidth: 1,
        borderColor: colors.glassCardBorder,
        borderRadius: 12,
        padding: 12,
    },
    chatCardMe: {
        backgroundColor: isDark ? 'rgba(37, 99, 235, 0.22)' : 'rgba(219, 234, 254, 0.85)',
        borderColor: '#3B82F6',
        borderLeftWidth: 5,
        borderLeftColor: '#2563EB',
    },
    chatCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chatUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    chatAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatAvatarText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    chatUsername: {
        color: colors.text,
        fontSize: 14,
        fontWeight: 'bold',
    },
    youBadge: {
        backgroundColor: '#2563EB',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 6,
    },
    youBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    chatTime: {
        color: colors.textMuted,
        fontSize: 11,
    },
    heartBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: colors.glassButtonBg,
    },
    heartCount: {
        marginLeft: 4,
        fontSize: 12,
        fontWeight: 'bold',
    },
    chatBody: {
        marginTop: 10,
    },
    chatTextContent: {
        color: colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
    chatAttachedImage: {
        width: '100%',
        height: 160,
        borderRadius: 8,
        marginTop: 10,
        resizeMode: 'cover',
    },
    chatCardFooter: {
        flexDirection: 'row',
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
    },
    chatReplyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    chatReplyBtnText: {
        color: colors.textMuted,
        fontSize: 12,
        marginLeft: 6,
        fontWeight: '500',
    },
    viewRepliesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
        marginTop: 6,
        marginBottom: 4,
    },
    replyLineConnector: {
        width: 16,
        height: 1,
        backgroundColor: colors.border,
        marginRight: 8,
    },
    viewRepliesText: {
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: 'bold',
    },
    nestedRepliesContainer: {
        marginTop: 6,
    },
    replyingBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: isDark ? 'rgba(41, 98, 255, 0.08)' : 'rgba(59, 130, 246, 0.08)',
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        marginBottom: 8,
    },
    replyingText: {
        color: colors.text,
        fontSize: 12,
        flex: 1,
        marginRight: 12,
    },
    cancelReplyBtn: {
        padding: 2,
    },
    chatInputWrapper: {
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    imagePreviewContainer: {
        position: 'relative',
        marginBottom: 8,
        width: 60,
        height: 60,
    },
    imagePreview: {
        width: 60,
        height: 60,
        borderRadius: 8,
    },
    removeImageBtn: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#F23645',
        borderRadius: 10,
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatInputInner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Platform.OS === 'web' ? colors.glassInputBg : (isDark ? '#0F172A' : colors.glassInputBg),
        borderRadius: 22,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: colors.glassInputBorder,
    },
    attachBtn: {
        marginRight: 10,
    },
    chatTextInput: {
        flex: 1,
        color: colors.text,
        fontSize: 14,
        paddingVertical: 8,
    },
    sendBtn: {
        padding: 4,
        marginLeft: 6,
    },
    overviewContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        backgroundColor: colors.background
    },
    notesContainer: {
        backgroundColor: colors.glassCard,
        borderWidth: 1,
        borderColor: colors.glassCardBorder,
        borderRadius: 8,
        padding: 14,
        marginBottom: 16,
    },
    notesText: {
        color: colors.textMuted,
        fontSize: 14,
    },
    sectionHeaderRow: {
        marginVertical: 14,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    glassCard: {
        backgroundColor: colors.glassCard,
        borderWidth: 1,
        borderColor: colors.glassCardBorder,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
    },
    dataPointRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    dataPointLabel: {
        color: colors.textMuted,
        fontSize: 14,
    },
    dataPointValue: {
        color: colors.text,
        fontSize: 14,
        fontWeight: 'bold',
    },
    dataPointDivider: {
        height: 1,
        backgroundColor: colors.border,
    },
    premiumHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 14,
    },
    premiumTitle: {
        color: '#F59E0B',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    iconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    cardTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: 'bold',
    },
    cardSubtitleText: {
        color: colors.textMuted,
        fontSize: 12,
        marginBottom: 8,
    },
    cardBodyText: {
        color: colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
    sentimentProgressContainer: {
        height: 8,
        borderRadius: 4,
        flexDirection: 'row',
        overflow: 'hidden',
        marginVertical: 12,
    },
    sentimentProgressFill: {
        height: '100%',
    },
    sentimentLabelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sentimentLabel: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    whaleDataRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginTop: 12,
    },
    whaleColumn: {
        alignItems: 'center',
    },
    whaleLabel: {
        color: colors.text,
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 6,
    },
    whaleSubtext: {
        color: colors.textMuted,
        fontSize: 11,
        marginTop: 2,
    },
    liquidityRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    liquidityValue: {
        color: colors.text,
        fontSize: 15,
        fontWeight: 'bold',
    },
    volumeProfileBarsContainer: {
        marginVertical: 6,
    },
    volumeBar: {
        height: 8,
        borderRadius: 4,
        marginBottom: 8,
    },
    alertCalloutBox: {
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.15)',
        borderRadius: 8,
        padding: 12,
        marginTop: 4,
    },
    alertCalloutText: {
        color: colors.text,
        fontSize: 13,
        lineHeight: 18,
    },
    loadingCalendarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    loadingCalendarText: {
        color: colors.textMuted,
        fontSize: 13,
        marginLeft: 8,
    },
    gaugeLabelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        marginBottom: 10,
    },
    gaugeLabelText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    gaugeStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginTop: 14,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 12,
    },
    gaugeStatCol: {
        alignItems: 'center',
    },
    gaugeStatVal: {
        color: colors.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    gaugeStatLabel: {
        color: colors.textMuted,
        fontSize: 11,
        marginTop: 2,
    },
    moreTechnicalsLink: {
        alignItems: 'center',
        marginTop: 16,
        paddingVertical: 4,
    },
    moreTechnicalsLinkText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '600',
    },
    bigTradeBtn: {
        backgroundColor: '#089981',
        borderRadius: 12,
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 30,
    },
    bigTradeBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    }
});
