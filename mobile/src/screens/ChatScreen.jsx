import React, { useEffect, useState, useRef, useMemo } from 'react';
import LottieView from 'lottie-react-native';
import {
    View,
        StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
        Animated,
    Image,
    Platform,
    Alert,
    KeyboardAvoidingView,
    Keyboard
} from 'react-native';
import { Text, TextInput } from '../components/Typography';
import io from 'socket.io-client';
import BlurView from '../components/GlassView';
import { LinearGradient } from 'expo-linear-gradient';
import * as D from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as v from 'lucide-react-native';
import { getItemAsync } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BACKEND_URL, isTelegram, getTgSafeAreaTop } from '../config';

// Helper: Resolve image URL
const getAvatarUri = (avatarUrl) => {
    if (!avatarUrl || avatarUrl === 'default') return null;
    if (avatarUrl.startsWith('/')) {
        return `${BACKEND_URL}${avatarUrl}`;
    }
    return avatarUrl;
};

const LOTTIE_MAP = {
    'nft_rocket': require('../../assets/emojis/rocket.json'),
    'nft_star': require('../../assets/emojis/star.json'),
    'nft_fire': require('../../assets/emojis/fire.json'),
    'nft_heart': require('../../assets/emojis/heart.json'),
    'nft_party': require('../../assets/emojis/party.json'),
};

const getLottieSource = (key) => {
    if (!key) return null;
    if (key.startsWith('http://') || key.startsWith('https://')) {
        return { uri: key };
    }
    if (key.startsWith('/') || key.startsWith('uploads/')) {
        return { uri: key.startsWith('/') ? `${BACKEND_URL}${key}` : `${BACKEND_URL}/${key}` };
    }
    const cleanKey = key.startsWith('nft_') ? key : `nft_${key}`;
    return LOTTIE_MAP[cleanKey] || LOTTIE_MAP[key] || null;
};

const avatars = {
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

const getAvatarSource = (avatarUrl) => {
    if (!avatarUrl) return null;
    if (avatarUrl === 'default') return avatars.default;
    if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
        return { uri: avatarUrl };
    }
    return avatars[avatarUrl] || null;
};

// A voice note is sent as base64 over the socket and stored in the row, so
// its length is a direct cost to everyone in the room. A minute is plenty.
const MAX_RECORD_SECONDS = 60;

// Helper: Format elapsed recording time
const formatDuration = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
};

export default function ChatScreen({
    roomName,
    communities = [],
    joinedRooms = [],
    currentUserId,
    currentUserAliases = [],
    userRole = 'user',
    onBack,
    onProfile,
    onJoin,
    isDark,
    colors
}) {
    const insets = useSafeAreaInsets();

    // Keyboard state tracking for Android (matching AICoachScreen pattern)
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

    // The composer is the bottom-most thing on this screen and the tab bar
    // is not under it, so it has to hold itself clear of the system
    // navigation bar. Telegram draws its own chrome and reports no inset,
    // and while the keyboard is open it has taken the navigation bar's
    // place — adding the inset then would just leave a gap.
    const footerInset = isTelegram || isKeyboardActive ? 0 : insets.bottom;
    const [messages, setMessages] = useState([]);
    const latestMessagesRef = useRef(messages);
    latestMessagesRef.current = messages;
    const [inputText, setInputText] = useState('');
    const [mediaAttachment, setMediaAttachment] = useState(null);
    const [replyTo, setReplyTo] = useState(null);
    const [contextMenuId, setContextMenuId] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    // The last thing the server refused to do, shown above the composer.
    const [errorNotice, setErrorNotice] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [isScrolledUp, setIsScrolledUp] = useState(false);
    const currentUserIdRef = useRef(currentUserId);
    currentUserIdRef.current = currentUserId;
    const isScrolledUpRef = useRef(isScrolledUp);
    isScrolledUpRef.current = isScrolledUp;
    
    // Community meta info from socket
    const [communityMeta, setCommunityMeta] = useState(null);
    const [pinnedMessage, setPinnedMessage] = useState(null);
    const [admins, setAdmins] = useState([]);
    const [typingTimer, setTypingTimer] = useState(null);

    // Audio/Recording States
    const [isRecording, setIsRecording] = useState(false);
    const [recordDuration, setRecordDuration] = useState(0);
    const [activePlayingId, setActivePlayingId] = useState(null);
    const [playbackProgress, setPlaybackProgress] = useState(0);

    // Refs
    const socketRef = useRef(null);
    const scrollViewRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const recordIntervalRef = useRef(null);
    const soundRef = useRef(null);
    const recordingRef = useRef(null);
    const layoutYMap = useRef({});
    const typingTimersRef = useRef(new Map());

    const isMember = joinedRooms.includes(roomName);



    // Clean up sound on unmount
    useEffect(() => {
        const typingTimers = typingTimersRef.current;
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync().catch(() => {});
            }
            if (recordIntervalRef.current) {
                clearInterval(recordIntervalRef.current);
            }
            typingTimers.forEach(clearTimeout);
            typingTimers.clear();
        };
    }, []);

    // Telegram native back button handler registration
    useEffect(() => {
        if (isTelegram && typeof window !== 'undefined') {
            window.customTelegramBackHandler = () => {
                if (onBack) onBack();
            };
            // Sync initial state
            if (typeof window._syncTelegramBackButton === 'function') {
                window._syncTelegramBackButton();
            }
        }
        return () => {
            if (isTelegram && typeof window !== 'undefined') {
                window.customTelegramBackHandler = null;
                if (typeof window._syncTelegramBackButton === 'function') {
                    window._syncTelegramBackButton();
                }
            }
        };
    }, [onBack]);

    // Update document title for Telegram WebApp native header
    useEffect(() => {
        if (isTelegram && typeof window !== 'undefined') {
            const originalTitle = document.title;
            const count = communityMeta?.memberCount || communities.find(c => c.name === roomName)?.memberCount || 0;
            document.title = `${roomName} (${count} members)`;
            return () => {
                document.title = originalTitle;
            };
        }
    }, [roomName, communityMeta, communities]);

    // ─── Smart Chat Cache Helpers ───
    const CACHE_KEY = `chat_cache_${roomName}`;
    const CACHE_META_KEY = `chat_meta_${roomName}`;
    const MAX_CACHED = 200;

    // Cross-platform cache read (sync on web, async on native)
    const loadCachedMessages = async () => {
        try {
            let raw;
            if (Platform.OS === 'web') {
                raw = localStorage.getItem(CACHE_KEY);
            } else {
                raw = await AsyncStorage.getItem(CACHE_KEY);
            }
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('[ChatCache] Failed to load cache:', e);
        }
        return null;
    };

    const saveCacheDebounceRef = useRef(null);
    const saveMessagesToCache = (msgs) => {
        if (saveCacheDebounceRef.current) clearTimeout(saveCacheDebounceRef.current);
        saveCacheDebounceRef.current = setTimeout(async () => {
            try {
                // Keep only last MAX_CACHED messages
                const toSave = msgs.slice(-MAX_CACHED);
                const cacheStr = JSON.stringify(toSave);
                // Save metadata (timestamp of newest message for delta sync)
                let metaStr = null;
                if (toSave.length > 0) {
                    const newest = toSave[toSave.length - 1];
                    metaStr = JSON.stringify({
                        lastId: newest.id,
                        count: toSave.length,
                        updatedAt: Date.now()
                    });
                }
                if (Platform.OS === 'web') {
                    localStorage.setItem(CACHE_KEY, cacheStr);
                    if (metaStr) localStorage.setItem(CACHE_META_KEY, metaStr);
                } else {
                    await AsyncStorage.setItem(CACHE_KEY, cacheStr);
                    if (metaStr) await AsyncStorage.setItem(CACHE_META_KEY, metaStr);
                }
            } catch (e) {
                console.warn('[ChatCache] Failed to save cache:', e);
            }
        }, 300); // Debounce 300ms to avoid rapid writes
    };

    const mergeMessages = (cached, incoming) => {
        const map = new Map();
        // Add cached first, then incoming overwrites (server is authoritative)
        (cached || []).forEach(m => { if (m && m.id) map.set(m.id, m); });
        (incoming || []).forEach(m => { if (m && m.id) map.set(m.id, m); });
        // Sort by createdAt timestamp for accurate chronological order
        return Array.from(map.values())
            .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
            .slice(-MAX_CACHED);
    };

    const [isAuthenticated, setIsAuthenticated] = useState(true);

    // ─── Load cached messages immediately on mount & Check Auth ───
    useEffect(() => {
        (async () => {
            const cached = await loadCachedMessages();
            if (cached && cached.length > 0) {
                setMessages(cached);
                console.log(`[ChatCache] Loaded ${cached.length} cached messages for ${roomName}`);
            }
            const token = await getItemAsync('accessToken');
            setIsAuthenticated(!!(token && token !== 'null' && token !== 'undefined'));
        })();
    }, [roomName]);

    // Socket Connection Lifecycle
    useEffect(() => {
        let isCancelled = false;
        let socket;
        const initSocket = async () => {
            const token = await getItemAsync('accessToken');
            if (isCancelled) return;
            socket = io(BACKEND_URL, {
                transports: ['websocket'],
                // `query` puts the token in the connection URL, where it
                // lands in server access logs and any proxy in between.
                // `auth` sends it in the handshake payload instead.
                auth: token ? { token } : {}
            });
            socketRef.current = socket;

            socket.on('connect', () => {
                console.log(`[ChatSocket] Connected. Joining room: ${roomName}`);
                socket.emit('joinChat', roomName);
            });

            socket.on('chatHistory', async (history) => {
                const normalized = (Array.isArray(history) ? history : [])
                    .map(normalizeMessage)
                    .filter(m => m && m.id);
                const cached = await loadCachedMessages();
                const merged = mergeMessages(cached, normalized);
                setMessages(merged);
                saveMessagesToCache(merged);
                // Reset states
                setReplyTo(null);
                setContextMenuId(null);
                setHasMore(true);
                setIsLoadingOlder(false);
                console.log(`[ChatCache] Synced: ${normalized.length} from server, ${merged.length} total`);
            });

            socket.on('newMessage', (msg) => {
                const normalized = normalizeMessage(msg);
                // normalizeMessage answers null for an empty payload, and
                // reading .id off it further down would take the screen out.
                if (!normalized || !normalized.id) return;
                setMessages((prev) => {
                    const exists = prev.some((m) => m.id === normalized.id);
                    if (exists) return prev;

                    // If it is sent by the current user, try to replace the optimistic temp message
                    const isOwnMsg = normalized.userId === currentUserIdRef.current || 
                                     (normalized.user && currentUserAliases.includes(normalized.user.toLowerCase()));
                    if (isOwnMsg) {
                        const tempIndex = prev.findIndex((m) => {
                            if (!m.id || !m.id.toString().startsWith('temp_')) return false;
                            if (normalized.text && m.text === normalized.text) return true;
                            if (normalized.mediaUrl && m.mediaUrl === normalized.mediaUrl) return true;
                            if (normalized.text && normalized.text.startsWith('🎤 Voice') && m.text && m.text.startsWith('🎤 Voice')) return true;
                            return false;
                        });

                        if (tempIndex !== -1) {
                            const clone = [...prev];
                            clone[tempIndex] = normalized;
                            saveMessagesToCache(clone);
                            return clone;
                        }
                    }

                    const updated = [...prev, normalized].slice(-MAX_CACHED);
                    saveMessagesToCache(updated);
                    return updated;
                });
                // Auto scroll to end if not scrolled up significantly
                if (!isScrolledUpRef.current) {
                    setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd?.({ animated: true });
                    }, 100);
                }
            });

            socket.on('messageUpdated', (data) => {
                setMessages((prev) => {
                    const updated = prev.map((msg) =>
                        msg.id === data.messageId
                            ? { ...msg, likes: data.likes, likedBy: data.likedBy }
                            : msg
                    );
                    saveMessagesToCache(updated);
                    return updated;
                });
            });

            socket.on('messageDeleted', (data) => {
                setMessages((prev) => {
                    const updated = prev.filter((msg) => msg.id !== data.messageId);
                    saveMessagesToCache(updated);
                    return updated;
                });
            });

            socket.on('olderMessages', (older) => {
                if (!older || older.length === 0) {
                    setHasMore(false);
                    setIsLoadingOlder(false);
                    return;
                }
                const normalized = older.map(normalizeMessage).filter(m => m && m.id);
                setMessages((prev) => {
                    const combined = [...normalized, ...prev];
                    // De-duplicate
                    const map = new Map(combined.map((m) => [m.id, m]));
                    const merged = Array.from(map.values())
                        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
                        .slice(-MAX_CACHED);
                    saveMessagesToCache(merged);
                    return merged;
                });
                setIsLoadingOlder(false);
            });

            socket.on('userTyping', (data) => {
                if (!data?.username) return;
                setTypingUsers((prev) =>
                    prev.includes(data.username) ? prev : [...prev, data.username]);

                // Every event used to schedule its own removal, so someone
                // typing continuously was dropped by the timer their first
                // keystroke set and then added back — the indicator blinked
                // the whole time they typed. One timer per name, reset.
                const timers = typingTimersRef.current;
                if (timers.has(data.username)) clearTimeout(timers.get(data.username));
                timers.set(data.username, setTimeout(() => {
                    timers.delete(data.username);
                    setTypingUsers((prev) => prev.filter((u) => u !== data.username));
                }, 3000));
            });

            socket.on('communityInfo', (info) => {
                setCommunityMeta(info);
                setPinnedMessage(info.pinnedMessage ? normalizeMessage(info.pinnedMessage) : null);
                if (Array.isArray(info.admins)) {
                    setAdmins(info.admins);
                }
            });

            socket.on('messagePinned', (msg) => {
                setPinnedMessage(normalizeMessage(msg));
            });

            socket.on('messageUnpinned', () => {
                setPinnedMessage(null);
            });

            socket.on('userKicked', (data) => {
                if (data.userId === currentUserId) {
                    Alert.alert('Kicked', 'You were removed from this community.');
                    if (onBack) onBack();
                }
            });

            socket.on('chatError', (err) => {
                // This was only ever logged to a console nobody has open.
                // A refused message left its optimistic bubble on screen
                // forever and the sender was told nothing at all.
                const text = typeof err === 'string' ? err : (err?.message || 'Something went wrong.');
                console.warn('[ChatSocket] Error:', text);
                setErrorNotice(text);
                setMessages(prev => prev.map(m =>
                    m.id && m.id.toString().startsWith('temp_') && !m.failed
                        ? { ...m, failed: true }
                        : m));
            });
        };

        initSocket();

        return () => {
            isCancelled = true;
            if (saveCacheDebounceRef.current) {
                clearTimeout(saveCacheDebounceRef.current);
                // Flush the cache write immediately on unmount
                const toSave = latestMessagesRef.current.slice(-MAX_CACHED);
                const cacheStr = JSON.stringify(toSave);
                if (Platform.OS === 'web') {
                    localStorage.setItem(CACHE_KEY, cacheStr);
                } else {
                    AsyncStorage.setItem(CACHE_KEY, cacheStr).catch((e) => {
                        console.warn('[ChatCache] Failed to flush cache on unmount:', e);
                    });
                }
            }
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                console.log('[ChatSocket] Disconnected');
            }
        };
    }, [roomName]);

    // Normalize socket message into local structure
    const normalizeMessage = (raw) => {
        if (!raw) return null;
        const rawDate = raw.createdAt || raw.created_at;
        return {
            id: raw._id || raw.id,
            userId: raw.userId || raw.user_id || null,
            user: raw.username === 'You' ? '@You' : raw.username,
            avatarUrl: raw.avatarUrl || null,
            text: raw.text,
            mediaUrl: raw.mediaUrl || raw.media_url || null,
            replyTo: raw.replyTo || raw.reply_to || null,
            createdAt: rawDate, // preserve raw timestamp for sorting
            time: rawDate ? new Date(rawDate).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
            }) : '',
            likes: Array.isArray(raw.likes) ? raw.likes.length : (raw.likes || 0),
            likedBy: Array.isArray(raw.likes) ? raw.likes : [],
            isPro: raw.isPro || raw.is_pro || false,
            activeNft: raw.activeNft || raw.active_nft || null
        };
    };

    // Load older messages (pagination)
    const handleLoadOlder = () => {
        if (isLoadingOlder || !hasMore || messages.length === 0) return;
        setIsLoadingOlder(true);
        socketRef.current?.emit('loadOlder', {
            room: roomName,
            beforeId: messages[0].id
        });
    };

    // Scroll Detection
    const handleScroll = (event) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
        setIsScrolledUp(distanceFromBottom > 150);

        // Load older if scrolled near top
        if (contentOffset.y < 50) {
            handleLoadOlder();
        }
    };

    // Send Message
    const handleSend = async () => {
        if (!inputText.trim() && !mediaAttachment) return;
        const token = await getItemAsync('accessToken');
        // This used to fall back to the string 'guest_demo_token', which the
        // server rejects. The message got its optimistic bubble, the send
        // failed, and nothing ever said so.
        if (!token) {
            setErrorNotice('Sign in to send messages.');
            return;
        }

        const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const tempMsg = {
            id: tempId,
            userId: currentUserId,
            user: currentUserAliases[0] || '@You',
            avatarUrl: null,
            text: inputText.trim(),
            mediaUrl: mediaAttachment,
            replyTo: replyTo ? replyTo.id : null,
            createdAt: new Date().toISOString(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            likes: 0,
            likedBy: []
        };

        // Instant optimistic UI update
        setMessages((prev) => [...prev, tempMsg]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd?.({ animated: true }), 100);

        if (socketRef.current) {
            socketRef.current.emit('sendMessage', {
                room: roomName,
                token,
                text: tempMsg.text,
                mediaUrl: mediaAttachment,
                replyTo: replyTo ? replyTo.id : null
            });
        }

        setInputText('');
        setMediaAttachment(null);
        setReplyTo(null);
    };

    // Trigger typing event (throttled)
    const handleTextInput = (text) => {
        setInputText(text);
        if (socketRef.current && !typingTimer) {
            getItemAsync('accessToken').then((token) => {
                if (token) {
                    socketRef.current.emit('typing', { room: roomName, token });
                }
            });
            const timer = setTimeout(() => {
                setTypingTimer(null);
            }, 2000);
            setTypingTimer(timer);
        }
    };

    // Toggle message like
    const handleLike = async (messageId) => {
        const token = await getItemAsync('accessToken');
        if (token && socketRef.current) {
            socketRef.current.emit('likeMessage', {
                room: roomName,
                token,
                messageId
            });
        }
    };

    // Delete message
    const handleDelete = async (messageId) => {
        const token = await getItemAsync('accessToken');
        if (token && socketRef.current) {
            socketRef.current.emit('deleteMessage', {
                room: roomName,
                token,
                messageId
            });
            setContextMenuId(null);
        }
    };

    // Pin message
    const handlePin = async (messageId) => {
        const token = await getItemAsync('accessToken');
        if (token && socketRef.current) {
            socketRef.current.emit('pinMessage', {
                room: roomName,
                token,
                messageId
            });
            setContextMenuId(null);
        }
    };

    // Unpin message
    const handleUnpin = async () => {
        const token = await getItemAsync('accessToken');
        if (token && socketRef.current) {
            socketRef.current.emit('unpinMessage', {
                room: roomName,
                token
            });
        }
    };

    // Image Picker
    const pickImage = async () => {
        let result = await D.launchImageLibraryAsync({
            mediaTypes: D.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
            base64: true
        });
        if (!result.canceled && result.assets[0].base64) {
            setMediaAttachment(`data:image/jpeg;base64,${result.assets[0].base64}`);
        }
    };

    // Voice Message Recording (Web/Browser or Native expo-av)
    const startRecording = async () => {
        try {
            if (Platform.OS === 'web') {
                if (typeof MediaRecorder === 'undefined') {
                    setErrorNotice('This browser cannot record audio.');
                    return;
                }
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // Safari does not support audio/webm, and naming a codec it
                // cannot produce made the constructor throw — the mic button
                // simply did nothing, with the reason in a console log.
                const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg']
                    .find(t => MediaRecorder.isTypeSupported?.(t));
                const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
                recordedChunksRef.current = [];

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        recordedChunksRef.current.push(e.data);
                    }
                };

                mediaRecorderRef.current = mediaRecorder;
                mediaRecorder.start();
                setIsRecording(true);
                setRecordDuration(0);
                recordIntervalRef.current = setInterval(() => {
                    setRecordDuration((prev) => {
                        if (prev + 1 >= MAX_RECORD_SECONDS) stopAndSendRecording();
                        return prev + 1;
                    });
                }, 1000);
            } else {
                const permission = await Audio.requestPermissionsAsync();
                if (permission.status === 'granted') {
                    await Audio.setAudioModeAsync({
                        allowsRecordingIOS: true,
                        playsInSilentModeIOS: true,
                    });
                    const { recording } = await Audio.Recording.createAsync(
                        Audio.RecordingOptionsPresets.HIGH_QUALITY
                    );
                    recordingRef.current = recording;
                    setIsRecording(true);
                    setRecordDuration(0);
                    recordIntervalRef.current = setInterval(() => {
                        setRecordDuration((prev) => {
                            // Audio travels as base64 on the same socket as
                            // the message, so a recording left running is an
                            // attachment nobody can send.
                            if (prev + 1 >= MAX_RECORD_SECONDS) stopAndSendRecording();
                            return prev + 1;
                        });
                    }, 1000);
                } else {
                    Alert.alert('Permission Required', 'Microphone permission is required to record voice messages.');
                }
            }
        } catch (err) {
            console.warn('Failed to start recording', err);
            setErrorNotice('Could not start recording. Check the microphone permission.');
            setIsRecording(false);
        }
    };

    const stopAndSendRecording = async () => {
        if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
        setIsRecording(false);

        try {
            let base64Audio = null;
            if (Platform.OS === 'web') {
                const recorder = mediaRecorderRef.current;
                if (!recorder) return;

                await new Promise((resolve) => {
                    recorder.onstop = resolve;
                    recorder.stop();
                });

                recorder.stream?.getTracks().forEach((track) => track.stop());

                const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
                mediaRecorderRef.current = null;
                recordedChunksRef.current = [];

                const reader = new FileReader();
                base64Audio = await new Promise((resolve) => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(audioBlob);
                });
            } else {
                const recording = recordingRef.current;
                if (!recording) return;
                await recording.stopAndUnloadAsync();
                await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
                const uri = recording.getURI();
                recordingRef.current = null;
                if (uri) {
                    const { readAsStringAsync, EncodingType } = require('expo-file-system');
                    const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
                    base64Audio = `data:audio/m4a;base64,${base64}`;
                }
            }

            if (base64Audio) {
                const token = await getItemAsync('accessToken');
                if (!token) {
                    setErrorNotice('Sign in to send messages.');
                    return;
                }
                // The server refuses anything over 2MB, and a data URI is a
                // third larger than the audio it carries. Say so here rather
                // than sending it and having it bounce.
                if (base64Audio.length > 2_000_000) {
                    setErrorNotice('That recording is too long to send. Keep it under about a minute.');
                    return;
                }
                const tempId = 'temp_voice_' + Date.now();
                const tempMsg = {
                    id: tempId,
                    userId: currentUserId,
                    user: currentUserAliases[0] || '@You',
                    avatarUrl: null,
                    text: `🎤 Voice (${formatDuration(recordDuration)})`,
                    mediaUrl: base64Audio,
                    replyTo: replyTo ? replyTo.id : null,
                    createdAt: new Date().toISOString(),
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    likes: 0,
                    likedBy: []
                };

                setMessages((prev) => [...prev, tempMsg]);
                setTimeout(() => scrollViewRef.current?.scrollToEnd?.({ animated: true }), 100);

                if (socketRef.current) {
                    socketRef.current.emit('sendMessage', {
                        room: roomName,
                        token,
                        text: tempMsg.text,
                        mediaUrl: base64Audio,
                        replyTo: replyTo ? replyTo.id : null
                    });
                }
                setReplyTo(null);
            }
        } catch (err) {
            console.error('Failed to stop recording', err);
        }
    };

    const cancelRecording = async () => {
        if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
        setIsRecording(false);
        try {
            if (Platform.OS === 'web') {
                const recorder = mediaRecorderRef.current;
                if (recorder) {
                    recorder.stop();
                    recorder.stream?.getTracks().forEach((track) => track.stop());
                }
            } else {
                const recording = recordingRef.current;
                if (recording) {
                    await recording.stopAndUnloadAsync();
                }
            }
        } catch (e) {}
        mediaRecorderRef.current = null;
        recordingRef.current = null;
        recordedChunksRef.current = [];
    };

    // Audio Playback
    const playAudio = async (messageId, audioUrl) => {
        try {
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }

            if (activePlayingId === messageId) {
                setActivePlayingId(null);
                setPlaybackProgress(0);
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true
            });

            const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
            soundRef.current = sound;
            setActivePlayingId(messageId);
            setPlaybackProgress(0);

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded) {
                    if (status.durationMillis) {
                        setPlaybackProgress(status.positionMillis / status.durationMillis);
                    }
                    if (status.didJustFinish) {
                        setActivePlayingId(null);
                        setPlaybackProgress(0);
                    }
                }
            });

            await sound.playAsync();
        } catch (err) {
            console.error('Voice playback error', err);
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: isDark ? '#000000' : colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 60}
            enabled={Platform.OS === 'ios' ? true : isKeyboardActive}
        >
            {/* Ambient glows for premium look in dark mode */}
            {isDark && (
                <View style={[StyleSheet.absoluteFillObject, { zIndex: -1, overflow: 'hidden' }]}>
                    <View style={[styles.glowOrb, { backgroundColor: colors.glowBlue, top: 150, left: -100 }]} />
                    <View style={[styles.glowOrb, { backgroundColor: colors.glowPurple, bottom: 60, right: -100 }]} />
                </View>
            )}

            {/* Header Area */}
            <View style={[styles.header, { paddingTop: 0 }]}>
                {isTelegram ? (
                    <View style={{ width: 44 }} />
                ) : (
                    <TouchableOpacity onPress={onBack} style={styles.headerButton}>
                        <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={styles.blurBack}>
                            <v.ArrowLeft color={colors.text} size={20} />
                        </BlurView>
                    </TouchableOpacity>
                )}

                <TouchableOpacity onPress={onProfile} activeOpacity={0.8} style={styles.headerMeta}>
                    <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={styles.headerMetaBlur}>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>{roomName}</Text>
                        <Text style={styles.headerSubtitle}>
                            {communityMeta?.memberCount || communities.find(c => c.name === roomName)?.memberCount || 0} members
                        </Text>
                    </BlurView>
                </TouchableOpacity>

                <TouchableOpacity onPress={onProfile} activeOpacity={0.8}>
                    <View style={[styles.headerAvatar, { borderColor: colors.glassCardBorder }]}>
                        {(() => {
                            const comm = communityMeta || communities.find((c) => c.name === roomName);
                            const avatarUri = getAvatarUri(comm?.imageUrl);
                            return avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={styles.headerAvatarImg} />
                            ) : (
                                <v.Briefcase color="#60A5FA" size={20} />
                            );
                        })()}
                    </View>
                </TouchableOpacity>
            </View>

            {/* Pinned Message Bar */}
            {pinnedMessage && (
                <View style={styles.pinnedBar}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                            const targetY = layoutYMap.current[pinnedMessage.id];
                            if (targetY !== undefined) {
                                scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
                            }
                        }}
                        style={{ flex: 1 }}
                    >
                        <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={styles.pinnedBlur}>
                            <View style={styles.pinnedIndicator} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.pinnedTitle}>Pinned Message</Text>
                                <Text style={[styles.pinnedText, { color: colors.textMuted }]} numberOfLines={1}>
                                    {pinnedMessage.text || 'Photo/Media'}
                                </Text>
                            </View>
                            {(userRole === 'admin' || admins.some((a) => a._id === currentUserId)) && (
                                <TouchableOpacity onPress={handleUnpin} style={styles.pinnedClose}>
                                    <Text style={{ color: colors.textMuted, fontSize: 18 }}>×</Text>
                                </TouchableOpacity>
                            )}
                        </BlurView>
                    </TouchableOpacity>
                </View>
            )}

            {/* Messages ScrollView */}
            <ScrollView
                ref={scrollViewRef}
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScroll={handleScroll}
                scrollEventThrottle={100}
                onContentSizeChange={() => {
                    if (!isScrolledUp) {
                        scrollViewRef.current?.scrollToEnd({ animated: false });
                    }
                }}
            >
                {isLoadingOlder && (
                    <ActivityIndicator size="small" color="#60A5FA" style={{ marginBottom: 12 }} />
                )}

                {messages.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>No messages yet. Say hello!</Text>
                    </View>
                )}

                {messages.map((msg, index) => {
                    const isPending = msg.id && msg.id.toString().startsWith('temp_');
                    const isOwn = msg.userId === currentUserId || (msg.user && currentUserAliases.includes(msg.user.toLowerCase()));
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
                    const isSequential = prevMsg && prevMsg.userId === msg.userId && !isOwn;
                    const hasNextSequential = nextMsg && nextMsg.userId === msg.userId && !isOwn;

                    return (
                        <View
                            key={msg.id}
                            onLayout={(e) => {
                                layoutYMap.current[msg.id] = e.nativeEvent.layout.y;
                            }}
                            style={[
                                styles.messageRow,
                                {
                                    flexDirection: isOwn ? 'row-reverse' : 'row',
                                    marginBottom: hasNextSequential ? 4 : 16,
                                    // Still in flight, or refused by the
                                    // server. Either way it is not yet a
                                    // message anyone else can see, and it
                                    // should not look like one.
                                    opacity: msg.failed ? 0.45 : (isPending ? 0.6 : 1)
                                }
                            ]}
                        >
                            {/* Avatar for other users */}
                            {!isOwn && (
                                <View style={styles.msgAvatarCol}>
                                    {!hasNextSequential && (
                                        <View style={[styles.msgAvatar, { backgroundColor: isDark ? '#1D9BF0' : '#0F1419' }]}>
                                            {getAvatarSource(msg.avatarUrl) ? (
                                                <Image source={getAvatarSource(msg.avatarUrl)} style={styles.msgAvatarImg} />
                                            ) : (
                                                <Text style={styles.msgAvatarText}>
                                                    {msg.user?.replace('@', '').substring(0, 2).toUpperCase() || 'U'}
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Bubble Content */}
                            <View style={[styles.msgBubbleCol, { alignItems: isOwn ? 'flex-end' : 'flex-start' }]}>
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onLongPress={() => setContextMenuId(contextMenuId === msg.id ? null : msg.id)}
                                    style={[
                                        styles.bubble,
                                        {
                                            backgroundColor: isOwn ? colors.primary : isDark ? '#1C1C1E' : '#FFFFFF',
                                            borderBottomLeftRadius: isOwn ? 18 : 4,
                                            borderBottomRightRadius: isOwn ? 4 : 18,
                                            borderWidth: isOwn || isDark ? 0 : 1,
                                            borderColor: colors.glassBorder,
                                            alignSelf: isOwn ? 'flex-end' : 'flex-start'
                                        }
                                    ]}
                                >
                                    {/* Sender Name */}
                                    {!isOwn && !isSequential && (
                                        <View style={styles.bubbleSenderRow}>
                                            <Text style={styles.bubbleSenderText}>{msg.user}</Text>
                                            {msg.activeNft ? (
                                                (() => {
                                                    const src = getLottieSource(msg.activeNft);
                                                    return src ? (
                                                        <LottieView
                                                            source={src}
                                                            autoPlay
                                                            loop
                                                            style={{ width: 18, height: 18, marginLeft: 4 }}
                                                        />
                                                    ) : (
                                                        msg.isPro && <v.Check color="#38BDF8" size={12} style={{ marginLeft: 4 }} />
                                                    );
                                                })()
                                            ) : (
                                                msg.isPro && (
                                                    <v.Check color="#38BDF8" size={12} style={{ marginLeft: 4 }} />
                                                )
                                            )}
                                        </View>
                                    )}

                                    {/* Reply Preview inside bubble */}
                                    {msg.replyTo && (
                                        <View style={[styles.bubbleReplyBox, { borderLeftColor: isOwn ? '#FFF' : '#38BDF8' }]}>
                                            <Text style={[styles.replyUsername, { color: isOwn ? '#FFF' : '#38BDF8' }]}>
                                                {msg.replyTo.username?.replace(/\s+/g, '').toLowerCase() || 'User'}
                                            </Text>
                                            <Text style={[styles.replyTextBody, { color: isOwn ? 'rgba(255,255,255,0.8)' : colors.textMuted }]} numberOfLines={1}>
                                                {msg.replyTo.text || 'Photo/Media'}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Audio Playback Message */}
                                    {msg.text?.startsWith('🎤 Voice') && msg.mediaUrl ? (
                                        <View style={styles.audioMsgRow}>
                                            <TouchableOpacity
                                                onPress={() => playAudio(msg.id, msg.mediaUrl)}
                                                style={[styles.audioPlayBtn, { backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : 'rgba(56,189,248,0.2)' }]}
                                            >
                                                {activePlayingId === msg.id ? (
                                                    <v.Pause color={isOwn ? '#FFF' : '#38BDF8'} size={18} />
                                                ) : (
                                                    <v.Play color={isOwn ? '#FFF' : '#38BDF8'} size={18} style={{ marginLeft: 2 }} />
                                                )}
                                            </TouchableOpacity>

                                            <View style={styles.waveformContainer}>
                                                <View style={styles.waveformRow}>
                                                    {Array.from({ length: 15 }).map((_, waveIdx) => {
                                                        const hVal = 6 + (waveIdx * 7) % 15;
                                                        const isActive = activePlayingId === msg.id && waveIdx / 15 <= playbackProgress;
                                                        return (
                                                            <View
                                                                key={waveIdx}
                                                                style={[
                                                                    styles.waveBar,
                                                                    {
                                                                        height: hVal,
                                                                        backgroundColor: isActive
                                                                            ? (isOwn ? '#FFF' : '#38BDF8')
                                                                            : (isOwn ? 'rgba(255,255,255,0.3)' : colors.glassBorder)
                                                                    }
                                                                ]}
                                                            />
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        </View>
                                    ) : (
                                        /* Regular Text / Image Messages */
                                        <>
                                            {msg.text && (
                                                <Text style={[styles.msgText, { color: isOwn ? '#FFFFFF' : colors.text }]} selectable>
                                                    {msg.text}
                                                </Text>
                                            )}

                                            {msg.mediaUrl && (
                                                <Image source={{ uri: msg.mediaUrl }} style={styles.messageImage} resizeMode="cover" />
                                            )}
                                        </>
                                    )}

                                    {/* Time and Checkmark */}
                                    <View style={styles.msgMetaRow}>
                                        <Text style={[styles.msgTime, { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>
                                            {msg.time}
                                        </Text>
                                        {isOwn && (
                                            <v.Check color="rgba(255,255,255,0.7)" size={12} style={{ marginLeft: 4 }} />
                                        )}
                                    </View>

                                    {/* Liked Badge */}
                                    {msg.likes > 0 && (
                                        <TouchableOpacity
                                            onPress={() => handleLike(msg.id)}
                                            style={[styles.likeBadge, { backgroundColor: isDark ? '#2A2A2C' : '#F3F4F6', borderColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}
                                        >
                                            <Text style={{ fontSize: 11 }}>❤️</Text>
                                            <Text style={[styles.likeBadgeText, { color: colors.text }]}>{msg.likes}</Text>
                                        </TouchableOpacity>
                                    )}
                                </TouchableOpacity>

                                {/* Micro Action Buttons */}
                                <View style={[styles.microActions, { flexDirection: isOwn ? 'row-reverse' : 'row' }]}>
                                    <TouchableOpacity onPress={() => handleLike(msg.id)} style={styles.microBtn}>
                                        <Text style={[styles.microBtnText, { color: msg.likedBy?.some(u => currentUserAliases.includes(u.toLowerCase())) ? '#F43F5E' : colors.textMuted }]}>
                                            {msg.likedBy?.some(u => currentUserAliases.includes(u.toLowerCase())) ? '❤️ Liked' : '♡ Like'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setReplyTo(msg)} style={styles.microBtn}>
                                        <Text style={[styles.microBtnText, { color: colors.textMuted }]}>↩ Reply</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Long Press Context Menu */}
                                {contextMenuId === msg.id && (
                                    <View style={[styles.contextMenu, { alignSelf: isOwn ? 'flex-end' : 'flex-start' }]}>
                                        <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={styles.contextMenuBlur}>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setReplyTo(msg);
                                                    setContextMenuId(null);
                                                }}
                                                style={styles.contextItem}
                                            >
                                                <Text style={[styles.contextText, { color: colors.text }]}>↩️ Reply</Text>
                                            </TouchableOpacity>

                                            <View style={[styles.contextDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />

                                            <TouchableOpacity
                                                onPress={() => {
                                                    handleLike(msg.id);
                                                    setContextMenuId(null);
                                                }}
                                                style={styles.contextItem}
                                            >
                                                <Text style={[styles.contextText, { color: colors.text }]}>
                                                    {msg.likedBy?.some(u => currentUserAliases.includes(u.toLowerCase())) ? '❤️ Unliked' : '❤️ Like'}
                                                </Text>
                                            </TouchableOpacity>

                                            {(isOwn || userRole === 'admin' || admins.some((a) => a._id === currentUserId)) && (
                                                <>
                                                    <View style={[styles.contextDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
                                                    <TouchableOpacity onPress={() => handleDelete(msg.id)} style={styles.contextItem}>
                                                        <Text style={[styles.contextText, { color: '#F43F5E' }]}>🗑️ Delete</Text>
                                                    </TouchableOpacity>
                                                </>
                                            )}

                                            {(userRole === 'admin' || admins.some((a) => a._id === currentUserId)) && (
                                                <>
                                                    <View style={[styles.contextDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
                                                    <TouchableOpacity onPress={() => handlePin(msg.id)} style={styles.contextItem}>
                                                        <Text style={[styles.contextText, { color: '#38BDF8' }]}>📌 Pin</Text>
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                        </BlurView>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            {/* Scroll to Bottom Floating Indicator */}
            {isScrolledUp && (
                <TouchableOpacity
                    onPress={() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                        setIsScrolledUp(false);
                    }}
                    style={[styles.scrollBottomBtn, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}
                >
                    <v.ArrowDown color={colors.text} size={20} />
                </TouchableOpacity>
            )}

            {/* Typing Indicator Text */}
            {typingUsers.length > 0 && (
                <View style={styles.typingIndicatorContainer}>
                    <Text style={styles.typingText}>
                        {typingUsers.length === 1
                            ? `${typingUsers[0]} is typing...`
                            : `${typingUsers.length} people typing...`}
                    </Text>
                </View>
            )}

            {/* Whatever the server last refused to do */}
            {errorNotice && (
                <TouchableOpacity
                    onPress={() => setErrorNotice(null)}
                    activeOpacity={0.8}
                    style={styles.errorNotice}
                >
                    <v.AlertTriangle color="#F43F5E" size={15} />
                    <Text style={styles.errorNoticeText} numberOfLines={2}>{errorNotice}</Text>
                    <Text style={styles.errorNoticeClose}>×</Text>
                </TouchableOpacity>
            )}

            {/* Footer Input Area */}
            <View style={[styles.footerContainer, { paddingBottom: 10 + footerInset }]}>
                {!isAuthenticated ? (
                    <View
                        style={[styles.joinBtn, { backgroundColor: '#000000', borderWidth: 1, borderColor: colors.border || '#333333' }]}
                    >
                        <Text style={[styles.joinBtnText, { color: colors.textMuted }]}>
                            Please log in to send messages
                        </Text>
                    </View>
                ) : isMember ? (
                    isRecording ? (
                        /* Recording UI */
                        <View style={styles.recordingRow}>
                            <TouchableOpacity onPress={cancelRecording} style={styles.cancelRecBtn}>
                                <v.Square color="#F43F5E" size={22} />
                            </TouchableOpacity>

                            <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={styles.recordingIndicator}>
                                <View style={styles.redDot} />
                                <Text style={[styles.recTime, { color: colors.text }]}>{formatDuration(recordDuration)}</Text>
                                <Text style={styles.cancelSlideText}>◄ Slide to cancel</Text>
                            </BlurView>

                            <TouchableOpacity onPress={stopAndSendRecording} style={styles.sendRecBtn}>
                                <v.Send color="#FFF" size={18} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        /* Normal Message input UI */
                        <View style={{ width: '100%' }}>
                            {/* Reply info preview bar */}
                            {replyTo && (
                                <View style={[styles.replyPreviewBar, { backgroundColor: colors.glassCard }]}>
                                    <View style={styles.replyPreviewIndicator} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.replyPreviewUsername}>Replying to {replyTo.user}</Text>
                                        <Text style={[styles.replyPreviewText, { color: colors.textMuted }]} numberOfLines={1}>
                                            {replyTo.text || 'Photo/Media'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyPreviewClose}>
                                        <Text style={{ color: colors.textMuted, fontSize: 16 }}>×</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Image Attachment preview bar */}
                            {mediaAttachment && (
                                <View style={styles.attachmentBar}>
                                    <Image source={{ uri: mediaAttachment }} style={styles.attachmentImg} />
                                    <TouchableOpacity onPress={() => setMediaAttachment(null)} style={styles.attachmentClose}>
                                        <Text style={{ color: colors.text, fontSize: 16 }}>×</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Message input bar */}
                            <View style={styles.inputRow}>
                                <BlurView
                                    intensity={40}
                                    tint={isDark ? 'dark' : 'light'}
                                    style={[
                                        styles.inputBlur,
                                        {
                                            backgroundColor: Platform.OS === 'web' ? (isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF') : (isDark ? '#0F172A' : '#FFFFFF'),
                                            borderWidth: 1,
                                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)'
                                        }
                                    ]}
                                >
                                    <TouchableOpacity onPress={pickImage} style={{ padding: 8 }}>
                                        <v.Paperclip color="#94A3B8" size={22} />
                                    </TouchableOpacity>

                                    <TextInput
                                        style={[styles.textInput, { color: colors.text, outlineStyle: 'none' }]}
                                        placeholder="Message"
                                        placeholderTextColor="#64748B"
                                        value={inputText}
                                        onChangeText={handleTextInput}
                                        autoComplete="off"
                                        autoCorrect={false}
                                    />

                                    {(inputText.trim().length > 0 || mediaAttachment) && (
                                        <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
                                            <v.Send color="#FFF" size={18} />
                                        </TouchableOpacity>
                                    )}
                                </BlurView>

                                {inputText.trim().length === 0 && !mediaAttachment && (
                                    <TouchableOpacity onPress={startRecording} style={[styles.micBtn, { backgroundColor: colors.glassCard }]}>
                                        <v.Mic color="#94A3B8" size={22} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )
                ) : (
                    /* Join Group button for non-members */
                    <TouchableOpacity
                        onPress={async () => {
                            const token = await getItemAsync('accessToken');
                            if (token && socketRef.current) {
                                console.log('[Chat] Emitting joinCommunity for room:', roomName);
                                socketRef.current.emit('joinCommunity', {
                                    room: roomName,
                                    token: token
                                });
                            }
                            if (onJoin) onJoin(roomName);
                        }}
                        style={[styles.joinBtn, { backgroundColor: colors.glassCard }]}
                    >
                        <Text style={styles.joinBtnText}>JOIN GROUP</Text>
                    </TouchableOpacity>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    glowOrb: {
        display: 'none',
        width: 0,
        height: 0,
        opacity: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingBottom: 10,
        justifyContent: 'space-between'
    },
    headerButton: {
        marginRight: 6
    },
    blurBack: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    headerMeta: {
        flex: 1,
        marginHorizontal: 8
    },
    headerMetaBlur: {
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)'
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: 'bold'
    },
    headerSubtitle: {
        fontSize: 11,
        color: '#60A5FA',
        marginTop: 2
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        overflow: 'hidden'
    },
    headerAvatarImg: {
        width: 40,
        height: 40,
        borderRadius: 20
    },
    pinnedBar: {
        paddingHorizontal: 12,
        marginBottom: 6
    },
    pinnedBlur: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)'
    },
    pinnedIndicator: {
        width: 3,
        height: 24,
        backgroundColor: '#60A5FA',
        marginRight: 10,
        borderRadius: 1.5
    },
    pinnedTitle: {
        color: '#60A5FA',
        fontSize: 12,
        fontWeight: 'bold'
    },
    pinnedText: {
        fontSize: 12,
        marginTop: 1
    },
    pinnedClose: {
        padding: 4
    },
    scrollContent: {
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 16
    },
    emptyState: {
        alignSelf: 'center',
        marginVertical: 40
    },
    messageRow: {
        alignItems: 'flex-end'
    },
    msgAvatarCol: {
        width: 36,
        marginRight: 8,
        alignItems: 'center',
        justifyContent: 'flex-end'
    },
    msgAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    msgAvatarImg: {
        width: 32,
        height: 32,
        borderRadius: 16
    },
    msgAvatarText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12
    },
    msgBubbleCol: {
        flex: 1
    },
    bubble: {
        maxWidth: '85%',
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 6,
        position: 'relative'
    },
    bubbleSenderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2
    },
    bubbleSenderText: {
        color: '#38BDF8',
        fontWeight: '600',
        fontSize: 13
    },
    bubbleReplyBox: {
        backgroundColor: 'rgba(0,0,0,0.15)',
        borderLeftWidth: 3,
        padding: 6,
        borderRadius: 6,
        marginBottom: 6
    },
    replyUsername: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 1
    },
    replyTextBody: {
        fontSize: 12
    },
    audioMsgRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 2
    },
    audioPlayBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8
    },
    waveformContainer: {
        width: 100,
        height: 24,
        justifyContent: 'center'
    },
    waveformRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2
    },
    waveBar: {
        width: 3,
        borderRadius: 1.5
    },
    msgText: {
        fontSize: 15,
        lineHeight: 20
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
        marginTop: 6
    },
    msgMetaRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4
    },
    msgTime: {
        fontSize: 10
    },
    likeBadge: {
        position: 'absolute',
        bottom: -8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 2
    },
    likeBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 2
    },
    microActions: {
        gap: 12,
        marginTop: 2,
        paddingHorizontal: 4
    },
    microBtn: {
        paddingVertical: 2
    },
    microBtnText: {
        fontSize: 11
    },
    contextMenu: {
        marginTop: 4,
        zIndex: 100
    },
    contextMenuBlur: {
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4
    },
    contextItem: {
        paddingHorizontal: 16,
        paddingVertical: 8
    },
    contextText: {
        fontSize: 13,
        fontWeight: '500'
    },
    contextDivider: {
        height: 1
    },
    scrollBottomBtn: {
        position: 'absolute',
        right: 16,
        bottom: 80,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 99
    },
    typingIndicatorContainer: {
        paddingHorizontal: 16,
        paddingVertical: 2,
        marginBottom: 2
    },
    typingText: {
        color: '#60A5FA',
        fontSize: 11,
        fontStyle: 'italic'
    },
    errorNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 12,
        marginBottom: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(244,63,94,0.35)',
        backgroundColor: 'rgba(244,63,94,0.10)'
    },
    errorNoticeText: { flex: 1, color: '#FCA5A5', fontSize: 12 },
    errorNoticeClose: { color: '#FCA5A5', fontSize: 16, paddingHorizontal: 4 },
    footerContainer: {
        paddingBottom: 10,
        paddingTop: 4,
        paddingHorizontal: 12
    },
    recordingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%'
    },
    cancelRecBtn: {
        padding: 8,
        marginRight: 6
    },
    recordingIndicator: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        borderRadius: 22,
        paddingHorizontal: 14,
        height: 44,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        overflow: 'hidden'
    },
    redDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F43F5E',
        marginRight: 8
    },
    recTime: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1
    },
    cancelSlideText: {
        color: '#F43F5E',
        fontSize: 12,
        fontWeight: '500'
    },
    sendRecBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8
    },
    replyPreviewBar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)'
    },
    replyPreviewIndicator: {
        width: 3,
        height: 24,
        backgroundColor: '#60A5FA',
        marginRight: 8,
        borderRadius: 1.5
    },
    replyPreviewUsername: {
        color: '#60A5FA',
        fontSize: 11,
        fontWeight: 'bold'
    },
    replyPreviewText: {
        fontSize: 11,
        marginTop: 1
    },
    replyPreviewClose: {
        padding: 4
    },
    attachmentBar: {
        flexDirection: 'row',
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        position: 'relative'
    },
    attachmentImg: {
        width: 50,
        height: 50,
        borderRadius: 6
    },
    attachmentClose: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 10,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%'
    },
    inputBlur: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 22,
        paddingHorizontal: 10,
        height: 44,
        borderWidth: 0,
        overflow: 'hidden'
    },
    textInput: {
        flex: 1,
        fontSize: 15,
        height: 40,
        padding: 0,
        marginHorizontal: 8
    },
    sendBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center'
    },
    micBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)'
    },
    joinBtn: {
        borderRadius: 22,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        width: '100%'
    },
    joinBtnText: {
        color: '#60A5FA',
        fontSize: 15,
        fontWeight: 'bold'
    }
});
