// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView, Image, Modal, Linking } from 'react-native';
import { Text, TextInput } from '../components/Typography';
;
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Key, ShieldCheck, Mail, Database, Check, LogIn, UserPlus, Link, Settings, Bell, Palette, Globe, ChevronRight, LogOut, Edit3, Smartphone, ShieldAlert, Gift, Copy, Share2, Download, Trash2 } from 'lucide-react-native';
import BlurView from '../components/GlassView';
import CustomBlurModal from '../components/CustomBlurModal';
import { setItemAsync, deleteItemAsync, getItemAsync } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { colors as defaultColors } from '../theme/colors';
import GlassToast from '../components/GlassToast';
import axios from 'axios';
import { useAccountStore } from '../store/accountStore';
import { supabase } from '../lib/supabase';

import { BACKEND_URL, isTelegram, getTgSafeAreaTop, ADMIN_CONSOLE_URL } from '../config';
import { useLogs } from '../utils/logger';
import { AVAILABLE_FONTS, loadAndApplyFont } from '../utils/fontManager';

const LOTTIE_MAP: Record<string, any> = {
  'nft_rocket': require('../../assets/emojis/rocket.json'),
  'nft_star': require('../../assets/emojis/star.json'),
  'nft_fire': require('../../assets/emojis/fire.json'),
  'nft_heart': require('../../assets/emojis/heart.json'),
  'nft_party': require('../../assets/emojis/party.json'),
};

export const getLottieSource = (key: string | null | undefined) => {
  if (!key) return LOTTIE_MAP['nft_rocket'];
  
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return { uri: key };
  }
  
  if (key.startsWith('/') || key.startsWith('uploads/')) {
    return { uri: key.startsWith('/') ? `${BACKEND_URL}${key}` : `${BACKEND_URL}/${key}` };
  }
  
  if (key.startsWith('{') && key.endsWith('}')) {
    try {
      return JSON.parse(key);
    } catch (e) {
      console.log('Failed to parse raw Lottie JSON:', e);
    }
  }
  
  const cleanKey = key.startsWith('nft_') ? key : `nft_${key}`;
  return LOTTIE_MAP[cleanKey] || LOTTIE_MAP[key] || LOTTIE_MAP['nft_rocket'];
};

// Flow states:
// 'auth'          → Unified Revolut/TradingView-style Login/Signup
// 'connect_broker'→ Connect cTrader
// 'dashboard'     → Profile dashboard (fully authenticated)

type FlowState = 'auth' | 'connect_broker' | 'dashboard';
type EditingField = null | 'username' | 'email' | 'password';

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const glassStyle = {
    ...Platform.select({
      web: {
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      },
      default: {}
    })
  };
  const navigation = useNavigation<any>();
  const { syncFromServer } = useAccountStore();
  const [flow, setFlow] = useState<FlowState>('auth');
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isAutoLoading, setIsAutoLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Font settings state
  const [isFontModalOpen, setIsFontModalOpen] = useState(false);
  const [selectedFontId, setSelectedFontId] = useState<string>('Montserrat');
  const [loadingFont, setLoadingFont] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    const fetchActiveFont = async () => {
      const activeFont = await AsyncStorage.getItem('selectedAppFont');
      if (activeFont) {
        setSelectedFontId(activeFont);
      }
    };
    fetchActiveFont();
  }, []);

  const handleFontChange = async (fontId: string) => {
    setLoadingFont(true);
    console.log(`[FontManager] Changing font to: ${fontId}`);
    const success = await loadAndApplyFont(fontId);
    if (success) {
      setSelectedFontId(fontId);
      showToast(`Font ${fontId} applied!`, 'success');
    } else {
      showToast(`Failed to load font ${fontId}`, 'danger');
    }
    setLoadingFont(false);
  };
  
  // Track what's completed
  const [hasAccount, setHasAccount] = useState(false);      // registered or logged in
  const [hasBroker, setHasBroker] = useState(false);        // broker connected

  // Broker fields
  // Broker credentials are never collected: linking goes through cTrader's
  // own OAuth page.
  const [awaitingBrokerConsent, setAwaitingBrokerConsent] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Campaigns & Collections
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const token = await getItemAsync('accessToken');
      if (!token) return;
      setLoadingCampaigns(true);
      const res = await axios.get(`${BACKEND_URL}/api/v1/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setCampaigns(res.data.campaigns);
      }
    } catch (e) {
      console.log('Failed to fetch campaigns in profile:', e);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    if (flow === 'dashboard') {
      fetchCampaigns();
    }
  }, [flow]);

  // Social Registration fields
  const [socialUsername, setSocialUsername] = useState('');
  const [socialEmail, setSocialEmail] = useState('');
  const [socialPassword, setSocialPassword] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Edit mode
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState('');

  // Login fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Avatar Selection
  const [selectedAvatar, setSelectedAvatar] = useState('default');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

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

  const trunksAvatars = [
    'dbz_trunks_01', 'dbz_trunks_02', 'dbz_trunks_03', 'dbz_trunks_08',
    'dbz_trunks_10', 'dbz_trunks_11', 'dbz_trunks_12', 'dbz_trunks_19',
    'dbz_trunks_21', 'dbz_trunks_26', 'dbz_trunks_35', 'dbz_trunks_38',
    'dbz_trunks_45', 'dbz_trunks_48'
  ];

  const gwenpoolAvatars = [
    'gwenpool_01', 'gwenpool_02', 'gwenpool_03', 'gwenpool_05',
    'gwenpool_08', 'gwenpool_10', 'gwenpool_11', 'gwenpool_12',
    'gwenpool_16', 'gwenpool_17', 'gwenpool_18', 'gwenpool_19',
    'gwenpool_23', 'gwenpool_24', 'gwenpool_25', 'gwenpool_27',
    'gwenpool_29', 'gwenpool_35'
  ];

  const randomAvatarsList = useMemo(() => {
    const getRandom10 = (arr: string[]) => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, 10);
    };
    return [...getRandom10(trunksAvatars), ...getRandom10(gwenpoolAvatars)];
  }, []);

  const getAvatarSource = (avatarUrl: string | null) => {
    if (!avatarUrl || avatarUrl === 'default') return avatars.default;
    if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
      return { uri: avatarUrl };
    }
    return avatars[avatarUrl as keyof typeof avatars] || avatars.default;
  };

  const updateAvatarOnBackend = async (newAvatar: string) => {
    try {
      const token = await getItemAsync('accessToken');
      await axios.put(`${BACKEND_URL}/api/v1/auth/me`, { avatarUrl: newAvatar }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserProfile((prev: any) => prev ? { ...prev, avatarUrl: newAvatar } : prev);
    } catch (e) {
      console.log('Failed to update avatar on backend', e);
    }
  };

  const updateActiveNftOnBackend = async (newNft: string | null) => {
    try {
      const token = await getItemAsync('accessToken');
      await axios.put(`${BACKEND_URL}/api/v1/auth/me`, { activeNft: newNft }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserProfile((prev: any) => prev ? { ...prev, activeNft: newNft } : prev);
    } catch (e) {
      console.log('Failed to update active NFT on backend', e);
    }
  };

  const handleCustomAvatarUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setSelectedAvatar(base64Image);
        setIsAvatarModalOpen(false);
        await updateAvatarOnBackend(base64Image);
        showToast('Custom avatar uploaded successfully!', 'success');
      }
    } catch (e: any) {
      showToast('Failed to pick image: ' + e.message, 'error');
    }
  };

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  };

  // Auto-login: check for saved token on screen focus or Telegram user
  useFocusEffect(
    useCallback(() => {
      const tryAutoLogin = async () => {
        console.log('[AutoLogin] Starting auto-login check...');

        // 1. Telegram Mini App: always do fresh login to ensure valid token
        if (isTelegram && typeof window !== 'undefined') {
          const tg = (window as any).Telegram?.WebApp;
          if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
            const tgUser = tg.initDataUnsafe.user;
            console.log('[AutoLogin] Telegram user detected:', tgUser);

            const tgUsername = tgUser.username || `tg_${tgUser.id}`;
            const tgPassword = `tg_secure_${tgUser.id}_${tgUser.first_name || 'user'}`;

            const saveAndSetProfile = async (user: any, tokens: any) => {
              await setItemAsync('accessToken', tokens.accessToken);
              await setItemAsync('refreshToken', tokens.refreshToken);
              user.telegramId = tgUser.id;
              await setItemAsync('tg_cached_profile', JSON.stringify(user));
              await setItemAsync('cached_user_profile', JSON.stringify(user));
              setUserProfile(user);
              setHasAccount(true);
              setSocialUsername(user.username || tgUsername);
              setSocialEmail(user.email || '');
              setSelectedAvatar(user.avatarUrl || 'default');
              if (user.cTraderAccounts && user.cTraderAccounts.length > 0) {
                setHasBroker(true);
                syncFromServer(user.cTraderAccounts.map((a: any) => ({ ...a, id: a.cTraderId || a.accountId || a._id })));
              }
              setFlow('dashboard');
              setIsAutoLoading(false);
            };

            // Try login first
            try {
              let res = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, {
                username: tgUsername, password: tgPassword, telegramId: tgUser.id
              });
              if (res.data.success && res.data.data) {
                await saveAndSetProfile(res.data.data.user, res.data.data);
                console.log('[AutoLogin] Telegram login success');
                return;
              }
            } catch (loginErr: any) {
              console.log('[AutoLogin] Login failed, trying register...');
            }

            // Try register
            try {
              const startParam = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param || '';
              const allAvatarKeys = [...trunksAvatars, ...gwenpoolAvatars];
              const randomAvatar = allAvatarKeys[Math.floor(Math.random() * allAvatarKeys.length)];
              let res = await axios.post(`${BACKEND_URL}/api/v1/auth/register`, {
                username: tgUsername, password: tgPassword,
                email: `${tgUsername}@telegram.user`,
                telegramId: tgUser.id, referredByCode: startParam,
                avatarUrl: tgUser.photo_url || randomAvatar
              });
              if (res.data.success && res.data.data) {
                await saveAndSetProfile(res.data.data.user, res.data.data);
                console.log('[AutoLogin] Telegram register success');
                return;
              }
            } catch (regErr: any) {
              console.log('[AutoLogin] Register failed:', regErr.message);
            }

            // Fallback: show dashboard but keep retrying login
            const profile = {
              username: tgUsername, email: '', avatarUrl: tgUser.photo_url || 'default',
              telegramId: tgUser.id, role: 'user', cTraderAccounts: []
            };
            setUserProfile(profile);
            setHasAccount(true);
            setSocialUsername(profile.username);
            setSocialEmail('');
            setFlow('dashboard');
            setIsAutoLoading(false);
            console.log('[AutoLogin] Backend unreachable, retrying in background...');
            const retryLogin = setInterval(async () => {
              try {
                let r = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, {
                  username: tgUsername, password: tgPassword, telegramId: tgUser.id
                });
                if (r.data.success && r.data.data) {
                  clearInterval(retryLogin);
                  await saveAndSetProfile(r.data.data.user, r.data.data);
                  console.log('[AutoLogin] Retry login succeeded!');
                }
              } catch {}
            }, 5000);
            return;
          }
        }

        // 2. Regular user: check existing token
        try {
          const { data: { session } } = await supabase.auth.getSession();
          let token = session?.access_token;
          
          if (token) {
            await setItemAsync('accessToken', token);
            if (session.refresh_token) {
              await setItemAsync('refreshToken', session.refresh_token);
            }
          } else {
            token = await getItemAsync('accessToken');
          }

          console.log('[AutoLogin] Token found:', token ? 'YES' : 'NO');
          if (!token) { setIsAutoLoading(false); return; }

          // Instant cache load (Zero loading screen)
          try {
            const cachedStr = await getItemAsync('cached_user_profile');
            if (cachedStr) {
              const cachedUser = JSON.parse(cachedStr);
              setUserProfile(cachedUser);
              setHasAccount(true);
              setSocialUsername(cachedUser.username || '');
              setSocialEmail(cachedUser.email || '');
              setSelectedAvatar(cachedUser.avatarUrl || 'default');
              if (cachedUser.cTraderAccounts && cachedUser.cTraderAccounts.length > 0) {
                 setHasBroker(true);
                 syncFromServer(cachedUser.cTraderAccounts.map((a: any) => ({ ...a, id: a.cTraderId || a.accountId || a._id })));
              }
              setFlow('dashboard');
              setIsAutoLoading(false);
            }
          } catch(e) {}

          const res = await axios.get(`${BACKEND_URL}/api/v1/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data.success && res.data.data) {
            const user = res.data.data;
            await setItemAsync('cached_user_profile', JSON.stringify(user));
            setUserProfile(user);
            setHasAccount(true);
            setSocialUsername(user.username || '');
            setSocialEmail(user.email || '');
            setSelectedAvatar(user.avatarUrl || 'default');
            if (user.cTraderAccounts && user.cTraderAccounts.length > 0) {
               setHasBroker(true);
               syncFromServer(user.cTraderAccounts.map((a: any) => ({ ...a, id: a.cTraderId || a.accountId || a._id })));
            }
            setFlow('dashboard');
            console.log('[AutoLogin] Session restored for @' + user.username);
          }
        } catch (e: any) {
          console.log('[AutoLogin] Error:', e.message);
          if (e.response?.status === 401) {
            console.log('[AutoLogin] Token is invalid or expired. Logging out...');
            await deleteItemAsync('accessToken');
            await deleteItemAsync('refreshToken');
            await deleteItemAsync('cached_user_profile');
            await deleteItemAsync('tg_cached_profile');
            setUserProfile(null);
            setHasAccount(false);
            setHasBroker(false);
            setFlow('auth');
          } else {
            const cachedStr = await getItemAsync('cached_user_profile');
            if (!cachedStr) {
              await deleteItemAsync('accessToken');
              await deleteItemAsync('refreshToken');
            }
          }
        } finally {
          setIsAutoLoading(false);
        }
      };
      tryAutoLogin();
    }, [])
  );

  const connectCTrader = async () => {
    if (!hasAccount) {
      showToast('Please create an account or login first!', 'info');
      setFlow('auth');
      return;
    }

    // cTrader is linked through OAuth: the user authorises the app on
    // Spotware's own page and the broker redirects back to our /callback,
    // which stores the tokens. The app never sees or handles broker
    // credentials — asking for them here (as this screen used to) would be
    // both wrong and indistinguishable from phishing.
    setIsConnecting(true);
    try {
      const token = await getItemAsync('accessToken');
      const res = await axios.get(`${BACKEND_URL}/api/v1/trade/auth`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const url = res.data?.url;
      if (!res.data?.success || !url) {
        showToast(res.data?.message || 'Broker linking is not available right now.', 'error');
        return;
      }

      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        showToast('Could not open the cTrader sign-in page.', 'error');
        return;
      }

      await Linking.openURL(url);
      setAwaitingBrokerConsent(true);
      showToast('Authorise Termax in cTrader, then come back here.', 'info');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not start the cTrader connection.', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  // Pull the profile again to see whether the broker accounts arrived. Called
  // when the user returns from the consent page.
  const refreshBrokerLink = async () => {
    setIsConnecting(true);
    try {
      const token = await getItemAsync('accessToken');
      const res = await axios.get(`${BACKEND_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const accounts = res.data?.data?.user?.cTraderAccounts || res.data?.data?.cTraderAccounts || [];
      const linked = accounts.filter((a: any) => a.ctidTraderAccountId);

      if (linked.length > 0) {
        syncFromServer(accounts.map((a: any) => ({ ...a, id: a.cTraderId || a.accountId || a._id })));
        setHasBroker(true);
        setAwaitingBrokerConsent(false);
        showToast(`Connected — ${linked.length} account${linked.length === 1 ? '' : 's'} linked.`, 'success');
        setFlow('dashboard');
      } else {
        showToast('No cTrader account linked yet. Finish authorising and try again.', 'info');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not check the connection.', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogin = async () => {
    if (!loginUsername || !loginPassword) {
      showToast('Enter username/email and password', 'error');
      return;
    }
    setIsLoggingIn(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, {
        username: loginUsername,
        password: loginPassword
      });
      if (res.data.success) {
        await setItemAsync('accessToken', res.data.data.accessToken);
        await setItemAsync('refreshToken', res.data.data.refreshToken);
        await setItemAsync('cached_user_profile', JSON.stringify(res.data.data.user));
        try {
          await supabase.auth.setSession({
            access_token: res.data.data.accessToken,
            refresh_token: res.data.data.refreshToken,
          });
        } catch (se) {
          console.log('[Login] Error setting Supabase session:', se);
        }
        setUserProfile(res.data.data.user);
        setHasAccount(true);
        setSocialUsername(res.data.data.user.username);
        setSelectedAvatar(res.data.data.user.avatarUrl || 'default');
        if (res.data.data.user.cTraderAccounts && res.data.data.user.cTraderAccounts.length > 0) {
           syncFromServer(res.data.data.user.cTraderAccounts.map((a: any) => ({ ...a, id: a.cTraderId || a.accountId || a._id })));
        }
        showToast('Welcome back, @' + res.data.data.user.username + '!', 'success');
        setFlow('dashboard');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Login failed', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegisterComplete = async () => {
    const allAvatarKeys = [...trunksAvatars, ...gwenpoolAvatars];
    const randomAvatar = allAvatarKeys[Math.floor(Math.random() * allAvatarKeys.length)];

    setIsRegistering(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/v1/auth/register`, {
        username: socialUsername,
        email: socialEmail,
        password: socialPassword,
        avatarUrl: randomAvatar
      });
      
      if (res.data.success) {
        await setItemAsync('accessToken', res.data.data.accessToken);
        await setItemAsync('refreshToken', res.data.data.refreshToken);
        await setItemAsync('cached_user_profile', JSON.stringify(res.data.data.user));
        try {
          await supabase.auth.setSession({
            access_token: res.data.data.accessToken,
            refresh_token: res.data.data.refreshToken,
          });
        } catch (se) {
          console.log('[Register] Error setting Supabase session:', se);
        }
        setUserProfile(res.data.data.user);
        setHasAccount(true);
        if (res.data.data.user.cTraderAccounts && res.data.data.user.cTraderAccounts.length > 0) {
           syncFromServer(res.data.data.user.cTraderAccounts.map((a: any) => ({ ...a, id: a.cTraderId || a.accountId || a._id })));
        }
        showToast('Profile created successfully!', 'success');
        setFlow('dashboard');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Registration failed', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await supabase.auth.signOut();
    } catch (se) {
      console.log('[Logout] Error signing out of Supabase:', se);
    }
    await deleteItemAsync('accessToken');
    await deleteItemAsync('refreshToken');
    await deleteItemAsync('cached_user_profile');
    await deleteItemAsync('tg_cached_profile');
    setHasAccount(false);
    setHasBroker(false);
    setUserProfile(null);
    setSocialUsername('');
    setSocialEmail('');
    setSocialPassword('');
    setLoginUsername('');
    setLoginPassword('');
    setBrokerEmail('');
    setBrokerPassword('');
    setUsernameAvailable(null);
    setFlow('auth');
  };

  const handleDeleteAccount = async () => {
    if (!deleteEmail || !deletePassword) {
      showToast('Please fill out both email and password.', 'error');
      return;
    }
    setIsDeleting(true);
    try {
      const token = await getItemAsync('accessToken');
      const res = await axios.post(`${BACKEND_URL}/api/v1/auth/deactivate`, {
        email: deleteEmail.trim(),
        password: deletePassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        showToast('Your account has been deleted successfully.', 'success');
        setIsDeleteModalOpen(false);
        setDeleteEmail('');
        setDeletePassword('');
        await handleDisconnect();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to delete account.';
      showToast(errMsg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── RENDER ──────────────────────────────────
  const renderAuth = () => {
    const isRegisterValid = socialUsername.length >= 5 && usernameAvailable && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(socialEmail) && socialPassword.length >= 8;
    const isLoginValid = loginUsername.length > 0 && loginPassword.length > 0;

    return (
      <View style={[styles.connectedCard, glassStyle, { backgroundColor: isDark ? '#000000' : '#FFFFFF', borderWidth: 1, borderColor: colors.border }]}>
        {/* TradingView/Revolut-style Header */}
        <View style={styles.authHeader}>
          <View style={styles.logoOuterRing}>
            <Image source={require('../../assets/app-logo.png')} style={{ width: 52, height: 52 }} resizeMode="contain" />
          </View>
          <Text style={styles.authSubtitle}>
            {authTab === 'login' ? 'Sign in to monitor positions & copy trades' : 'Create an account to start trading'}
          </Text>
        </View>

        {/* Tab Selection */}
        <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => setAuthTab('login')} style={[styles.tabButton, authTab === 'login' && styles.activeTabButton]}>
            <Text style={[styles.tabButtonText, authTab === 'login' ? styles.activeTabButtonText : { color: colors.textMuted }]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAuthTab('register')} style={[styles.tabButton, authTab === 'register' && styles.activeTabButton]}>
            <Text style={[styles.tabButtonText, authTab === 'register' ? styles.activeTabButtonText : { color: colors.textMuted }]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        {authTab === 'login' ? (
          <View style={{ width: '100%', gap: 16 }}>
            <View style={styles.inputBox}>
              <User color={colors.primary} size={20} style={{ marginRight: 12 }} />
              <TextInput 
                style={[styles.input, { color: colors.text }]} 
                placeholder="Username or Email" 
                placeholderTextColor={colors.textMuted} 
                autoCapitalize="none" 
                value={loginUsername} 
                onChangeText={setLoginUsername}
              />
            </View>

            <View style={styles.inputBox}>
              <Key color={colors.primary} size={20} style={{ marginRight: 12 }} />
              <TextInput 
                style={[styles.input, { color: colors.text }]} 
                placeholder="Password" 
                placeholderTextColor={colors.textMuted} 
                secureTextEntry 
                value={loginPassword} 
                onChangeText={setLoginPassword}
              />
            </View>

            <TouchableOpacity onPress={handleLogin} disabled={!isLoginValid || isLoggingIn} style={{ width: '100%', marginTop: 12 }}>
              <LinearGradient
                colors={isLoginValid && !isLoggingIn ? ['#2962FF', '#1E40AF'] : (isDark ? ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)'] : ['#E2E8F0', '#CBD5E1'])}
                style={styles.connectBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                {isLoggingIn ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.connectBtnText, !isLoginValid && { color: colors.textMuted }]}>Sign In</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: '100%', gap: 16 }}>
            <View style={styles.inputBox}>
              <User color={colors.primary} size={20} style={{ marginRight: 12 }} />
              <TextInput 
                style={[styles.input, { color: colors.text }]} 
                placeholder="Username (min 5 chars)" 
                placeholderTextColor={colors.textMuted} 
                autoCapitalize="none" 
                value={socialUsername} 
                onChangeText={(text) => { 
                  setSocialUsername(text); 
                  setUsernameAvailable(text.length >= 5 && /^[a-zA-Z0-9_]+$/.test(text) ? true : null); 
                }}
              />
              <View style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}>
                {socialUsername.length > 0 && (
                  usernameAvailable ? <Check color={colors.success} size={20} /> : <ShieldAlert color={colors.danger} size={20} />
                )}
              </View>
            </View>

            <View style={styles.inputBox}>
              <Mail color={colors.primary} size={20} style={{ marginRight: 12 }} />
              <TextInput 
                style={[styles.input, { color: colors.text }]} 
                placeholder="Email Address" 
                placeholderTextColor={colors.textMuted} 
                keyboardType="email-address" 
                autoCapitalize="none" 
                value={socialEmail} 
                onChangeText={socialEmail => setSocialEmail(socialEmail)}
              />
              <View style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}>
                {socialEmail.length > 0 && (
                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(socialEmail) ? <Check color={colors.success} size={20} /> : <ShieldAlert color={colors.danger} size={20} />
                )}
              </View>
            </View>

            <View style={styles.inputBox}>
              <Key color={colors.primary} size={20} style={{ marginRight: 12 }} />
              <TextInput 
                style={[styles.input, { color: colors.text }]} 
                placeholder="Password (min 8 chars)" 
                placeholderTextColor={colors.textMuted} 
                secureTextEntry 
                value={socialPassword} 
                onChangeText={socialPassword => setSocialPassword(socialPassword)}
              />
              <View style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}>
                {socialPassword.length > 0 && (
                  socialPassword.length >= 8 ? <Check color={colors.success} size={20} /> : <ShieldAlert color={colors.danger} size={20} />
                )}
              </View>
            </View>

            <TouchableOpacity onPress={handleRegisterComplete} disabled={!isRegisterValid || isRegistering} style={{ width: '100%', marginTop: 12 }}>
              <LinearGradient
                colors={isRegisterValid && !isRegistering ? ['#2962FF', '#1E40AF'] : (isDark ? ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)'] : ['#E2E8F0', '#CBD5E1'])}
                style={styles.connectBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              >
                {isRegistering ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.connectBtnText, !isRegisterValid && { color: colors.textMuted }]}>Create Account</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer Disclaimer */}
        <Text style={styles.disclaimerText}>
          By continuing, you agree to the Terms of Service and Privacy Policy.
        </Text>
      </View>
    );
  };

  const renderConnectBroker = () => (
    <BlurView experimentalBlurMethod="regular" intensity={100} tint={colors.blurTint} style={[styles.connectedCard, { borderColor: '#2962FF' }, glassStyle]}>
      <View style={[styles.successIconWrapper, { backgroundColor: 'rgba(41, 98, 255, 0.15)' }]}>
        <Link color="#2962FF" size={32} />
      </View>
      <Text style={[styles.connectedTitle, { color: '#2962FF' }]}>Connect cTrader</Text>
      <Text style={styles.connectedDesc}>
        Link your broker to trade your real account. You will authorise Termax on
        cTrader's own site — your broker password is never entered here.
      </Text>

      <View style={styles.features}>
        <View style={styles.featureRow}>
          <ShieldCheck color={colors.primary} size={20} style={{ marginRight: 12 }} />
          <Text style={[styles.featureText, { color: colors.text }]}>You sign in on cTrader, not in this app</Text>
        </View>
        <View style={styles.featureRow}>
          <Globe color={colors.primary} size={20} style={{ marginRight: 12 }} />
          <Text style={[styles.featureText, { color: colors.text }]}>Access can be revoked from your cTrader account</Text>
        </View>
        <View style={[styles.featureRow, { marginBottom: 0 }]}>
          <Database color={colors.primary} size={20} style={{ marginRight: 12 }} />
          <Text style={[styles.featureText, { color: colors.text }]}>Positions stay in sync with your broker</Text>
        </View>
      </View>

      {awaitingBrokerConsent ? (
        <>
          <TouchableOpacity onPress={refreshBrokerLink} disabled={isConnecting} style={{ width: '100%' }}>
            <LinearGradient colors={['#089981', '#05745F']} style={styles.connectBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              {isConnecting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.connectBtnText}>I've authorised — check now</Text>}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={connectCTrader} disabled={isConnecting} style={{ marginTop: 12 }}>
            <Text style={{ color: '#2962FF', fontSize: 14 }}>Open the cTrader page again</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity onPress={connectCTrader} disabled={isConnecting} style={{ width: '100%' }}>
          <LinearGradient colors={['#2962FF', '#1D4ED8']} style={styles.connectBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {isConnecting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.connectBtnText}>Continue with cTrader</Text>}
          </LinearGradient>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => hasAccount ? setFlow('dashboard') : setFlow('auth')} style={{ marginTop: 16 }}>
        <Text style={{ color: '#64748B', fontSize: 14 }}>← Back</Text>
      </TouchableOpacity>
    </BlurView>
  );

  const renderDashboard = () => (
    <View style={{ width: '100%', paddingBottom: 40 }}>
      {/* Mega Profile Header */}
      <BlurView experimentalBlurMethod="regular" intensity={100} tint={colors.blurTint} style={[styles.premiumProfileCard, { paddingVertical: 28, alignItems: 'center' }, glassStyle]}>
        <TouchableOpacity onPress={() => setIsAvatarModalOpen(true)} style={styles.megaAvatarContainer}>
          <Image 
            source={getAvatarSource(userProfile?.avatarUrl || selectedAvatar)} 
            style={styles.megaAvatar} 
          />
          <View style={styles.editAvatarBadge}>
            <Edit3 color="#FFF" size={14} />
          </View>
        </TouchableOpacity>
        
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.megaUsername, { color: colors.text }]}>@{socialUsername || loginUsername}</Text>
            
            {userProfile?.activeNft && (
              <View style={{ width: 16, height: 16, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                <LottieView
                  source={getLottieSource(userProfile.activeNft)}
                  autoPlay
                  loop
                  style={{ width: '100%', height: '100%' }}
                />
              </View>
            )}

            {userProfile?.telegramId && (
              <View style={styles.telegramBadge}>
                <Text style={styles.telegramBadgeText}>Telegram</Text>
              </View>
            )}
          </View>
          <Text style={[styles.megaEmail, { color: colors.textMuted }]}>{socialEmail || 'No email configured'}</Text>
          {userProfile?.telegramId && (
            <Text style={styles.premiumId}>ID: {userProfile.telegramId}</Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          <TouchableOpacity onPress={() => { setEditingField('username'); setEditValue(socialUsername || loginUsername); }} style={styles.quickActionBtn}>
            <User color="#2962FF" size={16} style={{ marginRight: 6 }} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Change ID</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsAvatarModalOpen(true)} style={styles.quickActionBtn}>
            <Palette color="#3B82F6" size={16} style={{ marginRight: 6 }} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Avatar</Text>
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* Inline Edits for Username/Email/Password */}
      {editingField && (
        <BlurView experimentalBlurMethod="regular" intensity={100} tint={colors.blurTint} style={[styles.inlineEditCard, glassStyle]}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: 'bold', marginBottom: 12 }}>
            Update {editingField.charAt(0).toUpperCase() + editingField.slice(1)}
          </Text>
          <View style={styles.inputBox}>
            {editingField === 'email' ? <Mail color={colors.textMuted} size={18} style={{ marginRight: 10 }} /> :
             editingField === 'password' ? <Key color={colors.textMuted} size={18} style={{ marginRight: 10 }} /> :
             <User color={colors.textMuted} size={18} style={{ marginRight: 10 }} />}
             
            <TextInput 
              style={[styles.input, { color: colors.text }]} 
              autoFocus 
              value={editValue} 
              onChangeText={setEditValue} 
              placeholder={`Enter new ${editingField}`} 
              placeholderTextColor={colors.textMuted} 
              secureTextEntry={editingField === 'password'}
              keyboardType={editingField === 'email' ? 'email-address' : 'default'}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <TouchableOpacity onPress={() => setEditingField(null)} style={[styles.inlineEditBtn, { backgroundColor: colors.glassCard }]}>
              <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => { 
                if (editingField === 'email' && editValue.includes('@')) setSocialEmail(editValue.trim());
                if (editingField === 'username' && editValue.trim()) setSocialUsername(editValue.trim());
                if (editingField === 'password' && editValue.length >= 6) setSocialPassword(editValue);
                setEditingField(null); 
                showToast(`${editingField} updated successfully!`, 'success'); 
              }} 
              style={[styles.inlineEditBtn, { backgroundColor: '#2962FF' }]}
            >
              <Text style={{ color: colors.text, fontWeight: 'bold' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      )}

      {/* Collections Section */}
      <Text style={[styles.sectionHeaderTitle, { color: colors.textMuted }]}>Collections</Text>
      {loadingCampaigns ? (
        <BlurView experimentalBlurMethod="regular" intensity={100} tint={colors.blurTint} style={[styles.collectionsCard, { justifyContent: 'center', padding: 24 }, glassStyle]}>
          <ActivityIndicator color={colors.primary} />
        </BlurView>
      ) : campaigns.filter(c => c.progress?.claimedReward).length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionsScroll}>
          {campaigns.filter(c => c.progress?.claimedReward).map((campaign) => {
            const isActive = userProfile?.activeNft === campaign.rewardLottieKey;
            return (
              <BlurView
                key={campaign._id}
                experimentalBlurMethod="regular"
                intensity={100}
                tint={colors.blurTint}
                style={[
                  styles.nftCard, 
                  isActive ? { borderColor: campaign.accentColor || '#A855F7', borderWidth: 2 } : {}, 
                  glassStyle
                ]}
              >
                <View style={styles.nftLottieContainer}>
                  <LottieView
                    source={getLottieSource(campaign.rewardLottieKey)}
                    autoPlay
                    loop
                    style={{ width: 80, height: 80 }}
                  />
                  {isActive && (
                    <View style={[styles.nftActiveBadge, { backgroundColor: campaign.accentColor || '#A855F7' }]}>
                      <Text style={styles.nftActiveBadgeText}>ACTIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.nftTitle, { color: colors.text }]} numberOfLines={2}>{campaign.title}</Text>
                
                {!isActive ? (
                  <TouchableOpacity 
                    onPress={() => {
                      updateActiveNftOnBackend(campaign.rewardLottieKey);
                      showToast(`${campaign.title} badge activated next to name!`, 'success');
                    }}
                    style={[styles.nftActionBtn, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}
                  >
                    <Text style={[styles.nftActionBtnText, { color: '#3B82F6' }]}>Activate</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    onPress={() => {
                      updateActiveNftOnBackend(null);
                      showToast(`${campaign.title} badge deactivated!`, 'info');
                    }}
                    style={[styles.nftActionBtn, { backgroundColor: 'rgba(242, 54, 69, 0.1)' }]}
                  >
                    <Text style={[styles.nftActionBtnText, { color: colors.danger }]}>Deactivate</Text>
                  </TouchableOpacity>
                )}
              </BlurView>
            );
          })}
        </ScrollView>
      ) : (
        <BlurView experimentalBlurMethod="regular" intensity={100} tint={colors.blurTint} style={[styles.collectionsCard, { padding: 24, alignItems: 'center', marginBottom: 24 }, glassStyle]}>
          <Gift color={colors.textMuted} size={32} style={{ marginBottom: 12, opacity: 0.6 }} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 6 }}>Your gallery is empty</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 18 }}>
            Complete challenges to unlock and claim rare animated avatars.
          </Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('EarnNft')} 
            style={[styles.exploreBtn, { backgroundColor: '#2962FF' }]}
          >
            <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Explore Challenges</Text>
          </TouchableOpacity>
        </BlurView>
      )}

      {/* Broker Integration */}
      <Text style={[styles.sectionHeaderTitle, { color: colors.textMuted }]}>Trading Integration</Text>
      <BlurView experimentalBlurMethod="regular" intensity={100} tint={colors.blurTint} style={[styles.premiumBrokerCard, hasBroker ? { borderColor: 'rgba(41, 98, 255, 0.5)' } : {}, { marginBottom: 12 }, glassStyle]}>
        {hasBroker ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.brokerIconBox, { backgroundColor: 'rgba(41, 98, 255, 0.15)' }]}>
                <Link color="#2962FF" size={20} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: '#2962FF', fontSize: 13, fontWeight: '700', marginBottom: 2 }}>cTrader Connected</Text>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: 'bold' }}>ID: {userProfile?.cTraderId || (userProfile?.cTraderAccounts?.[0]?.cTraderId) || 'Active'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => { setHasBroker(false); showToast('Broker Disconnected', 'info'); }} style={styles.disconnectMiniBtn}>
              <Text style={{ color: colors.danger, fontSize: 12, fontWeight: 'bold' }}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => {
            if (Platform.OS !== 'web') {
              showToast('soon', 'info');
            } else {
              setFlow('connect_broker');
            }
          }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.brokerIconBox, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
                <Link color={colors.text} size={20} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 2 }}>Connect Broker</Text>
                <Text style={{ color: '#64748B', fontSize: 12 }}>Link your cTrader account</Text>
              </View>
            </View>
            <ChevronRight color={colors.textMuted} size={20} />
          </TouchableOpacity>
        )}
      </BlurView>

      <BlurView experimentalBlurMethod="regular" intensity={100} tint={colors.blurTint} style={[styles.premiumBrokerCard, glassStyle]}>
        <TouchableOpacity onPress={() => navigation.navigate('ToolsHub', { subScreen: 'demo_account', referrer: 'Login' })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.brokerIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <UserPlus color="#F59E0B" size={20} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 2 }}>Add Demo Account</Text>
              <Text style={{ color: '#64748B', fontSize: 12 }}>Practice trading with virtual funds</Text>
            </View>
          </View>
          <ChevronRight color={colors.textMuted} size={20} />
        </TouchableOpacity>
      </BlurView>

      {/* Advanced Settings Hub */}
      <Text style={[styles.sectionHeaderTitle, { color: colors.textMuted }]}>Account & Security</Text>
      <BlurView experimentalBlurMethod="regular" intensity={100} tint={colors.blurTint} style={[styles.settingsGroup, glassStyle]}>
        <TouchableOpacity style={styles.settingsListItem} onPress={() => { setEditingField('email'); setEditValue(socialEmail); }}>
          <View style={[styles.settingsListIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}><Mail color="#3B82F6" size={18} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.settingsListTitle, { color: colors.text }]}>Email Address</Text>
            <Text style={[styles.settingsListDesc, { color: colors.textMuted }]}>{socialEmail || 'Not configured'}</Text>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>
        <View style={styles.settingsDivider} />
        <TouchableOpacity style={styles.settingsListItem} onPress={() => { setEditingField('password'); setEditValue(''); }}>
          <View style={[styles.settingsListIcon, { backgroundColor: 'rgba(41, 98, 255, 0.15)' }]}><Key color="#2962FF" size={18} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.settingsListTitle, { color: colors.text }]}>Password</Text>
            <Text style={[styles.settingsListDesc, { color: colors.textMuted }]}>Secure your profile</Text>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>
        <View style={styles.settingsDivider} />
        <TouchableOpacity style={styles.settingsListItem} onPress={() => showToast('2FA is coming soon!', 'info')}>
          <View style={[styles.settingsListIcon, { backgroundColor: 'rgba(41, 98, 255, 0.15)' }]}><ShieldAlert color="#2962FF" size={18} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.settingsListTitle, { color: colors.text }]}>Two-Factor Authentication</Text>
            <Text style={[styles.settingsListDesc, { color: colors.textMuted }]}>Recommended for security</Text>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>
        <View style={styles.settingsDivider} />
        <TouchableOpacity style={styles.settingsListItem} onPress={() => setIsDeleteModalOpen(true)}>
          <View style={[styles.settingsListIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}><Trash2 color="#EF4444" size={18} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.settingsListTitle, { color: '#EF4444' }]}>Delete Account</Text>
            <Text style={[styles.settingsListDesc, { color: colors.textMuted }]}>Deactivate profile & data</Text>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>
      </BlurView>

      {/* Refer & Earn Hub */}
      <Text style={[styles.sectionHeaderTitle, { color: '#FBBF24' }]}>Refer & Earn</Text>
      <BlurView experimentalBlurMethod="regular" intensity={100} tint={colors.blurTint} style={[styles.referCard, glassStyle]}>
        <View style={styles.referHeader}>
          <View style={styles.referIconWrapper}>
            <Gift color="#FBBF24" size={28} />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.referTitle}>Invite Friends, Earn Rewards</Text>
            <Text style={[styles.referDesc, { color: colors.textMuted }]}>Get 10% of their trading fees forever.</Text>
          </View>
        </View>

        <View style={styles.referralCodeBox}>
          <Text style={[styles.referralCodeLabel, { color: colors.textSubtle }]}>Your Invite Code</Text>
          <View style={styles.referralCodeInner}>
            <Text style={[styles.referralCodeText, { color: colors.text }]}>{userProfile?.referralCode || userProfile?.telegramId || 'TRD77X'}</Text>
            <TouchableOpacity onPress={() => showToast('Referral code copied!', 'success')} style={styles.copyBtn}>
              <Copy color="#2962FF" size={18} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 }}>
          <Text style={{ color: '#64748B', fontSize: 14 }}>Total Invited Users:</Text>
          <Text style={{ color: '#FBBF24', fontSize: 18, fontWeight: '700' }}>{userProfile?.referralCount || 0}</Text>
        </View>

        {isTelegram && (
          <>
            <TouchableOpacity onPress={() => {
                if (isTelegram && typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.openTelegramLink) {
                    const refCode = userProfile?.referralCode || `ref_${userProfile?.telegramId}`;
                    (window as any).Telegram.WebApp.openTelegramLink('https://t.me/SaulnoakesBot/Trade?startapp=' + refCode);
                } else {
                    showToast('Telegram share dialog opened!', 'success');
                }
            }} style={styles.telegramShareBtn}>
              <LinearGradient colors={['#2AABEE', '#229ED9']} style={StyleSheet.absoluteFillObject} />
              <Share2 color="#FFF" size={18} style={{ marginRight: 8 }} />
              <Text style={styles.telegramShareText}>Invite via Telegram Mini App</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity onPress={() => showToast('App Store link copied with your code!', 'info')} style={styles.storeBtn}>
                <Download color="#F8FAFC" size={20} style={{ marginBottom: 6 }} />
                <Text style={styles.storeBtnText}>App Store</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => showToast('Google Play link copied with your code!', 'info')} style={styles.storeBtn}>
                <Download color="#F8FAFC" size={20} style={{ marginBottom: 6 }} />
                <Text style={styles.storeBtnText}>Google Play</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </BlurView>

      <Text style={[styles.sectionHeaderTitle, { color: colors.textMuted }]}>Preferences</Text>
      <BlurView experimentalBlurMethod="regular" intensity={100} tint={colors.blurTint} style={[styles.settingsGroup, glassStyle]}>
        <TouchableOpacity style={styles.settingsListItem} onPress={() => showToast('Notifications settings coming soon!', 'info')}>
          <View style={[styles.settingsListIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}><Bell color="#F59E0B" size={18} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.settingsListTitle, { color: colors.text }]}>Notifications</Text>
            <Text style={[styles.settingsListDesc, { color: colors.textMuted }]}>Alerts, sounds, badges</Text>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>
        <View style={styles.settingsDivider} />
        <TouchableOpacity style={styles.settingsListItem} onPress={() => showToast('Language selection coming soon!', 'info')}>
          <View style={[styles.settingsListIcon, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}><Globe color="#EC4899" size={18} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.settingsListTitle, { color: colors.text }]}>Language</Text>
            <Text style={[styles.settingsListDesc, { color: colors.textMuted }]}>English (Default)</Text>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>
        <View style={styles.settingsDivider} />
        <TouchableOpacity style={styles.settingsListItem} onPress={() => setIsFontModalOpen(true)}>
          <View style={[styles.settingsListIcon, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}><Palette color="#A855F7" size={18} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.settingsListTitle, { color: colors.text }]}>App Font Family</Text>
            <Text style={[styles.settingsListDesc, { color: colors.textMuted }]}>{AVAILABLE_FONTS.find(f => f.id === selectedFontId)?.name || selectedFontId}</Text>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>
        <View style={styles.settingsDivider} />
        <TouchableOpacity style={styles.settingsListItem} onPress={() => showToast('Active sessions coming soon!', 'info')}>
          <View style={[styles.settingsListIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}><Smartphone color="#6366F1" size={18} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.settingsListTitle, { color: colors.text }]}>Active Sessions</Text>
            <Text style={[styles.settingsListDesc, { color: colors.textMuted }]}>Manage connected devices</Text>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </TouchableOpacity>
      </BlurView>

      {/* The admin panel is a separate site now — see admin/ in the repo.
          Keeping a whole moderation surface inside the trading app meant
          every user shipped code they could never open. This is a link out,
          and only when a console address has been configured. */}
      {userProfile?.role === 'admin' && !!ADMIN_CONSOLE_URL && (
        <TouchableOpacity onPress={() => Linking.openURL(ADMIN_CONSOLE_URL)} style={{ width: '100%', marginBottom: 16 }}>
          <LinearGradient colors={['#2962FF', '#1E40AF']} style={styles.connectBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <ShieldCheck color="#FFF" size={20} style={{ marginRight: 8 }} />
            <Text style={styles.connectBtnText}>Open Admin Console</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Universal Logout Button */}
      <TouchableOpacity onPress={handleDisconnect} style={styles.megaLogoutBtn}>
        <LogOut color={colors.danger} size={20} style={{ marginRight: 8 }} />
        <Text style={styles.megaLogoutText}>Log Out</Text>
      </TouchableOpacity>

      <CustomBlurModal visible={isAvatarModalOpen} animationType="fade" transparent={true} onRequestClose={() => setIsAvatarModalOpen(false)}>
        <View style={styles.modalOverlay}>
           <BlurView 
               experimentalBlurMethod="regular"
               intensity={100} 
               tint={colors.blurTint} 
               style={[styles.modalContent, glassStyle]}
           >
             <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Avatar</Text>
             
             <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', marginTop: 12 }}>
               {/* 1. Custom Upload Button */}
               <TouchableOpacity onPress={handleCustomAvatarUpload} style={styles.customUploadBtn}>
                 <Edit3 color={colors.background} size={18} style={{ marginRight: 8 }} />
                 <Text style={styles.customUploadBtnText}>Upload Custom Avatar</Text>
               </TouchableOpacity>

               {/* 3. Trunks Avatars */}
               <Text style={styles.avatarSectionTitle}>Anime Style (Trunks)</Text>
               <View style={styles.avatarsGrid}>
                 {randomAvatarsList.filter(key => key.startsWith('dbz_trunks')).map((key) => (
                   <TouchableOpacity key={key} onPress={() => { setSelectedAvatar(key); setIsAvatarModalOpen(false); updateAvatarOnBackend(key); }}>
                     <Image source={avatars[key as keyof typeof avatars]} style={[styles.avatarImg, selectedAvatar === key && styles.avatarImgSelected]} />
                   </TouchableOpacity>
                 ))}
               </View>

               {/* 4. Gwenpool Avatars */}
               <Text style={styles.avatarSectionTitle}>Pop-Art Style (Gwenpool)</Text>
               <View style={styles.avatarsGrid}>
                 {randomAvatarsList.filter(key => key.startsWith('gwenpool')).map((key) => (
                   <TouchableOpacity key={key} onPress={() => { setSelectedAvatar(key); setIsAvatarModalOpen(false); updateAvatarOnBackend(key); }}>
                     <Image source={avatars[key as keyof typeof avatars]} style={[styles.avatarImg, selectedAvatar === key && styles.avatarImgSelected]} />
                   </TouchableOpacity>
                 ))}
               </View>
             </ScrollView>

             <TouchableOpacity onPress={() => setIsAvatarModalOpen(false)} style={{ marginTop: 16, alignSelf: 'center', padding: 8 }}>
               <Text style={{ color: colors.textMuted, fontWeight: 'bold' }}>Cancel</Text>
             </TouchableOpacity>
           </BlurView>
        </View>
      </CustomBlurModal>

    </View>
  );

  return (
    <LinearGradient
      colors={isDark ? ['#000000', '#000000'] : ['#FFFFFF', '#FFFFFF']}
      style={styles.safeArea}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Ambient background glowing orbs for premium glassmorphism depth */}
      <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
        {isDark && (
          <>
            <View style={[styles.glowOrb, { backgroundColor: colors.glowBlue, top: -80, left: -80, opacity: 0.45 }]} />
            <View style={[styles.glowOrb, { backgroundColor: colors.glowPurple, bottom: 60, right: -100, opacity: 0.4 }]} />
            <View style={[styles.glowOrb, { backgroundColor: '#FF007F', top: '35%', left: '-20%', width: 280, height: 280, opacity: 0.25 }]} />
            <View style={[styles.glowOrb, { backgroundColor: colors.glowGreen, top: '15%', right: '-10%', width: 300, height: 300, opacity: 0.25 }]} />
          </>
        )}
      </View>

      <GlassToast visible={toastVisible} message={toastMessage} type={toastType} onHide={() => setToastVisible(false)} />

      {isAutoLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#A855F7" />
          <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>Restoring session...</Text>
        </View>
      ) : (
      <>

      {flow === 'dashboard' && (
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Profile & Settings</Text>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" keyboardDismissMode="none">

          {flow === 'auth' && renderAuth()}
          {flow === 'connect_broker' && renderConnectBroker()}
          {flow === 'dashboard' && renderDashboard()}

          {/* Quick Font Switcher for Unauthenticated Users */}
          {flow === 'auth' && (
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 16 }}
              onPress={() => setIsFontModalOpen(true)}
            >
              <Palette color="#A855F7" size={16} style={{ marginRight: 6 }} />
              <Text style={{ color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' }}>
                Change App Font ({AVAILABLE_FONTS.find(f => f.id === selectedFontId)?.name || selectedFontId})
              </Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dedicated App Font Switcher Modal (60 Premium Fonts) */}
      <CustomBlurModal visible={isFontModalOpen} animationType="slide" transparent={true} onRequestClose={() => setIsFontModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <BlurView experimentalBlurMethod="regular" intensity={100} tint={colors.blurTint} style={[styles.modalContent, { maxHeight: '80%', width: '90%', borderRadius: 24, padding: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Palette color="#A855F7" size={22} style={{ marginRight: 8 }} />
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>Select App Font</Text>
              </View>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: 'bold' }}>{AVAILABLE_FONTS.length} Fonts</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={true} style={{ width: '100%' }} nestedScrollEnabled={true}>
              {AVAILABLE_FONTS.map((font) => {
                const isSelected = selectedFontId === font.id;
                return (
                  <TouchableOpacity 
                    key={font.id} 
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      paddingVertical: 12, 
                      paddingHorizontal: 16, 
                      backgroundColor: isSelected ? 'rgba(41, 98, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                      borderRadius: 14,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : 'rgba(255,255,255,0.06)'
                    }}
                    disabled={loadingFont}
                    onPress={() => handleFontChange(font.id)}
                  >
                    <Text style={{ 
                      color: isSelected ? colors.primary : colors.text, 
                      fontSize: 15, 
                      fontWeight: isSelected ? 'bold' : 'normal',
                      fontFamily: font.id
                    }}>
                      {font.name}
                    </Text>
                    {isSelected && <Check color={colors.primary} size={18} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity onPress={() => setIsFontModalOpen(false)} style={{ marginTop: 16, width: '100%', paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 15 }}>Done</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </CustomBlurModal>

      {/* Delete Account Modal */}
      <CustomBlurModal visible={isDeleteModalOpen} animationType="slide" transparent={true} onRequestClose={() => setIsDeleteModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <BlurView experimentalBlurMethod="regular" intensity={100} tint={colors.blurTint} style={[styles.modalContent, { width: '90%', borderRadius: 24, padding: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Trash2 color="#EF4444" size={24} style={{ marginRight: 8 }} />
              <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: 'bold' }}>Delete Account</Text>
            </View>

            <Text style={{ color: colors.text, fontSize: 14, marginBottom: 16, lineHeight: 20 }}>
              To delete your account, please enter your registered email address and password for confirmation.
            </Text>

            <View style={{ width: '100%', gap: 12, marginBottom: 16 }}>
              <View style={styles.inputBox}>
                <Mail color={colors.textMuted} size={18} style={{ marginRight: 10 }} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Confirm Email"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={deleteEmail}
                  onChangeText={setDeleteEmail}
                />
              </View>
              <View style={styles.inputBox}>
                <Key color={colors.textMuted} size={18} style={{ marginRight: 10 }} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Confirm Password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity 
                onPress={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteEmail('');
                  setDeletePassword('');
                }} 
                style={{ flex: 1, backgroundColor: colors.glassCard, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleDeleteAccount} 
                disabled={isDeleting}
                style={{ flex: 1, backgroundColor: '#EF4444', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </CustomBlurModal>
      </>
      )}
    </LinearGradient>
  );
}

const createStyles = (colors: any, isDark: boolean) => ({
  safeArea: { flex: 1, paddingTop: Platform.OS === 'ios' ? 0 : getTgSafeAreaTop() },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 24, fontWeight: 'bold' },
  content: { paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  subtitle: { color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  description: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },

  inputContainer: { width: '100%', marginBottom: 20, gap: 12 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(0, 0, 0, 0.4)' : colors.glassInputBg || colors.glassCard, borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : colors.glassInputBorder || colors.border, borderRadius: 16, paddingHorizontal: 16, height: 52 },
  input: { flex: 1, color: colors.text, fontSize: 15, height: '100%', outlineStyle: 'none' },

  features: { width: '100%', backgroundColor: colors.glassCard, padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  featureText: { color: colors.text, fontSize: 14 },
  connectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 16, borderRadius: 16 },
  connectBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  connectedCard: { width: '100%', borderRadius: 28, padding: 28, alignItems: 'center', backgroundColor: isDark ? 'rgba(0, 0, 0, 1.0)' : 'rgba(255, 255, 255, 0.25)', borderWidth: 1, borderColor: colors.glassCardBorder, overflow: 'hidden' },
  successIconWrapper: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  connectedTitle: { color: '#A855F7', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  connectedDesc: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  profileInfo: { width: '100%', backgroundColor: colors.glassCard, padding: 16, borderRadius: 12, marginBottom: 16 },
  infoLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  infoValue: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
  disconnectBtn: { paddingVertical: 14, width: '100%', borderRadius: 12, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', marginTop: 8 },
  disconnectBtnText: { color: colors.danger, fontSize: 16, fontWeight: 'bold' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassCard, padding: 16, borderRadius: 12 },
  settingsRowText: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginLeft: 12 },
  
  // Mega Dashboard Styles
  megaAvatarContainer: { position: 'relative', marginBottom: 12 },
  megaAvatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#2962FF' },
  editAvatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#3B82F6', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.background },
  megaUsername: { color: colors.text, fontSize: 26, fontWeight: '900', marginBottom: 4 },
  megaEmail: { color: colors.textMuted, fontSize: 14, marginBottom: 4 },
  quickActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.glassCard, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.glassCardBorder },
  
  settingsGroup: { width: '100%', backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.glassCard, borderRadius: 16, borderWidth: 1, borderColor: colors.glassCardBorder, overflow: 'hidden', marginBottom: 24 },
  settingsListItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  settingsListIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  settingsListTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  settingsListDesc: { color: colors.textMuted, fontSize: 12 },
  settingsDivider: { height: 1, backgroundColor: colors.border, marginLeft: 64 },
  
  megaLogoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, width: '100%', borderRadius: 16, backgroundColor: 'rgba(242, 54, 69, 0.1)', borderWidth: 1, borderColor: 'rgba(242, 54, 69, 0.3)', marginTop: 8 },
  megaLogoutText: { color: colors.danger, fontSize: 16, fontWeight: '900' },
  
  premiumProfileCard: { width: '100%', borderRadius: 24, padding: 20, marginBottom: 24, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.2)', borderWidth: 1, borderColor: colors.glassCardBorder, overflow: 'hidden' },
  premiumProfileContent: { flexDirection: 'row', alignItems: 'center' },
  avatarGlow: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(59, 130, 246, 0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(59, 130, 246, 0.5)' },
  premiumAvatar: { width: 60, height: 60, borderRadius: 30 },
  premiumProfileInfo: { flex: 1, marginLeft: 16 },
  premiumUsername: { color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: 2 },
  telegramBadge: { backgroundColor: '#2AABEE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  telegramBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  premiumEmail: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },
  premiumId: { color: colors.textMuted, fontSize: 11, fontFamily: 'monospace', opacity: 0.6 },
  
  premiumBrokerCard: { width: '100%', borderRadius: 16, padding: 16, marginBottom: 24, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.2)', borderWidth: 1, borderColor: colors.glassCardBorder, overflow: 'hidden' },
  brokerIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  disconnectMiniBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(242, 54, 69, 0.15)', borderRadius: 8 },
  
  sectionHeaderTitle: { color: colors.textMuted, fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 16 },
  
  glassyActionBtn: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.glassBorder, overflow: 'hidden' },
  actionIconWrapper: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionBtnText: { color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  actionBtnSubtext: { color: colors.textMuted, fontSize: 11 },
  
  inlineEditCard: { width: '100%', borderRadius: 16, padding: 16, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.2)', borderWidth: 1, borderColor: colors.glassCardBorder, overflow: 'hidden' },
  inlineEditBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  
  // Refer & Earn Styles
  referCard: { width: '100%', borderRadius: 16, padding: 20, marginBottom: 24, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.2)', borderWidth: 1, borderColor: colors.glassCardBorder, overflow: 'hidden' },
  referHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  referIconWrapper: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(251, 191, 36, 0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.4)' },
  referTitle: { color: '#FBBF24', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  referDesc: { color: colors.textMuted, fontSize: 13 },
  referralCodeBox: { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.4)' : colors.glassCard, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.glassBorder },
  referralCodeLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  referralCodeInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  referralCodeText: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: 2, fontFamily: 'monospace' },
  copyBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(41, 98, 255, 0.15)', justifyContent: 'center', alignItems: 'center' },
  telegramShareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  telegramShareText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  storeBtn: { flex: 1, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.glassCard, borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.glassCardBorder },
  storeBtnText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { alignSelf: 'center', width: '90%', maxHeight: '75%', padding: 20, borderRadius: 24, backgroundColor: isDark ? 'rgba(10, 14, 23, 0.85)' : 'rgba(255, 255, 255, 0.2)', borderWidth: 1, borderColor: colors.glassCardBorder, overflow: 'hidden' },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  customUploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text, paddingVertical: 12, borderRadius: 12, marginBottom: 8 },
  customUploadBtnText: { color: colors.background, fontWeight: 'bold', fontSize: 14 },
  avatarSectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: 'bold', letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  avatarsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarImgSelected: { borderWidth: 3, borderColor: '#2962FF' },
  
  glowOrb: {
    display: 'none',
    width: 0,
    height: 0,
    opacity: 0,
  },
  tabContainer: { flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.04)', borderRadius: 28, padding: 4, marginBottom: 24, width: '100%', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
  tabButton: { flex: 1, paddingVertical: 12, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  activeTabButton: { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  tabButtonText: { fontSize: 14, fontWeight: '700' },
  activeTabButtonText: { color: colors.text },
  authHeader: { alignItems: 'center', marginBottom: 20, width: '100%' },
  logoOuterRing: { marginBottom: 16 },
  authLogo: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  authTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 },
  authSubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 16 },
  focusedInputBox: { borderColor: '#2962FF', borderWidth: 1.5, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.95)', shadowColor: '#2962FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 8 },
  disclaimerText: { fontSize: 11, color: colors.textSubtle, textAlign: 'center', marginTop: 24, lineHeight: 16, paddingHorizontal: 16, opacity: 0.7 },
  exploreBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  collectionsCard: { width: '100%', borderRadius: 20, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.2)', borderWidth: 1, borderColor: colors.glassCardBorder, overflow: 'hidden', marginBottom: 24 },
  collectionsScroll: { gap: 16, paddingHorizontal: 4, paddingBottom: 16, marginBottom: 16 },
  nftCard: { width: 150, borderRadius: 20, padding: 16, alignItems: 'center', backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.2)', borderWidth: 1, borderColor: colors.glassCardBorder, overflow: 'hidden' },
  nftLottieContainer: { position: 'relative', width: 90, height: 90, justifyContent: 'center', alignItems: 'center', marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16 },
  nftActiveBadge: { position: 'absolute', bottom: -4, alignSelf: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  nftActiveBadgeText: { color: '#FFF', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },
  nftTitle: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginBottom: 12, height: 36 },
  nftActionBtn: { width: '100%', paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  nftActionBtnText: { fontSize: 12, fontWeight: 'bold' }
});
