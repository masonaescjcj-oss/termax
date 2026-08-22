import './src/utils/logger';
import { initAppFont } from './src/utils/fontManager';
import React, { Component, ErrorInfo, useEffect, useRef } from 'react';
import { View, ScrollView, SafeAreaView, TouchableOpacity, Platform } from 'react-native';
import { Text } from './src/components/Typography';
;
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme/colors';
import { isTelegram } from './src/config';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { useAccountStore } from './src/store/accountStore';
import { getItemAsync, setItemAsync, deleteItemAsync } from './src/utils/storage';
import { BACKEND_URL } from './src/config';
import axios from 'axios';
import { supabase } from './src/lib/supabase';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null, info: ErrorInfo | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 24, color: colors.danger, fontWeight: 'bold', marginBottom: 10 }}>App Crashed</Text>
            <Text style={{ color: colors.text, fontSize: 16, marginBottom: 10 }}>{this.state.error?.toString()}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{this.state.info?.componentStack}</Text>
          </ScrollView>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { isDark } = useTheme();
  const { syncFromServer } = useAccountStore();
  const hasSyncedRef = useRef(false);
  const [fontKey, setFontKey] = React.useState(0);

  useEffect(() => {
    (global as any).triggerFontChange = () => {
      setFontKey(k => k + 1);
    };
  }, []);

  const performSync = async (tgUser?: any) => {
    if (hasSyncedRef.current) return;
    
    try {
      if (tgUser) {
        hasSyncedRef.current = true;
        console.log('[App Startup] Syncing Telegram user:', tgUser.id);
        const tgUsername = tgUser.username || `tg_${tgUser.id}`;
        const tgPassword = `tg_secure_${tgUser.id}_${tgUser.first_name || 'user'}`;

        const saveAndSync = async (user: any, tokens: any) => {
          await setItemAsync('accessToken', tokens.accessToken);
          await setItemAsync('refreshToken', tokens.refreshToken);
          user.telegramId = tgUser.id;
          await setItemAsync('tg_cached_profile', JSON.stringify(user));
          if (user.cTraderAccounts && user.cTraderAccounts.length > 0) {
            syncFromServer(user.cTraderAccounts.map((a: any) => ({ ...a, id: a.cTraderId || a.accountId || a._id })));
          }
          try {
            await supabase.auth.setSession({
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken
            });
          } catch (e) {
            console.log('[App Startup] Supabase setSession error:', e);
          }
        };

        // Try login
        try {
          let res = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, {
            username: tgUsername, password: tgPassword, telegramId: tgUser.id
          });
          if (res.data.success && res.data.data) {
            await saveAndSync(res.data.data.user, res.data.data);
            console.log('[App Startup] Telegram login success');
            return;
          }
        } catch (loginErr: any) {
          console.log('[App Startup] Telegram login failed, trying register...');
        }

        // Try register
        try {
          const startParam = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param || '' : '';
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
          const allAvatarKeys = [...trunksAvatars, ...gwenpoolAvatars];
          const randomAvatar = allAvatarKeys[Math.floor(Math.random() * allAvatarKeys.length)];

          let res = await axios.post(`${BACKEND_URL}/api/v1/auth/register`, {
            username: tgUsername, password: tgPassword,
            email: `${tgUsername}@telegram.user`,
            telegramId: tgUser.id, referredByCode: startParam,
            avatarUrl: tgUser.photo_url || randomAvatar
          });
          if (res.data.success && res.data.data) {
            await saveAndSync(res.data.data.user, res.data.data);
            console.log('[App Startup] Telegram register success');
          }
        } catch (regErr: any) {
          console.log('[App Startup] Telegram register failed:', regErr.message);
        }
      }
    } catch (e: any) {
      console.log('[App Startup] Sync failed:', e.message);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      const styleId = 'google-font-montserrat';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap');
          body, html, #root {
            font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            font-size: 100% !important;
          }
          * {
            font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          }
          .premium-glass-heavy {
            backdrop-filter: blur(35px) saturate(160%) !important;
            -webkit-backdrop-filter: blur(35px) saturate(160%) !important;
          }
          .premium-glass-medium {
            backdrop-filter: blur(20px) saturate(135%) !important;
            -webkit-backdrop-filter: blur(20px) saturate(135%) !important;
          }
          .premium-glass-light {
            backdrop-filter: blur(12px) saturate(115%) !important;
            -webkit-backdrop-filter: blur(12px) saturate(115%) !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      // 0. Initialize app font family
      await initAppFont();

      // 1. Instantly load cached profile to avoid $0 showing on load
      try {
        const cached = await getItemAsync('tg_cached_profile');
        if (cached) {
          const user = JSON.parse(cached);
          if (user.cTraderAccounts && user.cTraderAccounts.length > 0) {
            syncFromServer(user.cTraderAccounts.map((a: any) => ({ ...a, id: a.cTraderId || a.accountId || a._id })));
          }
        }
      } catch (e) {
        console.log('[App Startup] Error loading cached balance:', e);
      }

      // 2. Perform fresh server sync
      if (isTelegram && typeof window !== 'undefined') {
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
          await performSync(tg.initDataUnsafe.user);
        } else {
          await performSync();
        }
      } else {
        await performSync();
      }
    };
    initAuth();
  }, []);

  // Listen to Supabase Auth state changes to keep accessToken and profiles synced
  // IMPORTANT: Only act on Supabase-specific events. Do NOT delete the app's own
  // backend tokens when Supabase session is null — the app uses its own JWT system.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Supabase Auth Listener] Event: ${event}, Session: ${session ? 'Active' : 'None'}`);
      if (session) {
        // Only update tokens if Supabase actually has a valid session
        // and try to sync with backend
        try {
          const res = await axios.get(`${BACKEND_URL}/api/v1/auth/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          if (res.data.success && res.data.data) {
            // Supabase token works with our backend — sync tokens
            await setItemAsync('accessToken', session.access_token);
            await setItemAsync('refreshToken', session.refresh_token);
            const user = res.data.data;
            await setItemAsync('tg_cached_profile', JSON.stringify(user));
            if (user.cTraderAccounts && user.cTraderAccounts.length > 0) {
              syncFromServer(user.cTraderAccounts.map((a: any) => ({ ...a, id: a.cTraderId || a.accountId || a._id })));
            }
          }
        } catch (e: any) {
          console.log('[Supabase Auth Listener] Sync profile failed:', e.message);
          // Don't delete tokens — the backend token may still be valid
        }
      }
      // Do NOT delete tokens on session=null. The app uses its own backend JWT.
      // Tokens are only deleted in handleDisconnect (explicit user logout).
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isTelegram || typeof window === 'undefined') return;

    const initTelegram = (tg: any) => {
      try {
        console.log('[Telegram-Init] Initializing Telegram WebApp');
        tg.ready();
        tg.expand();
        if (tg.disableVerticalSwipes) {
          tg.disableVerticalSwipes();
        }

        // Set initial header/background colors
        const themeColor = isDark ? '#000000' : '#FFFFFF';
        if (typeof tg.setHeaderColor === 'function') {
          tg.setHeaderColor(themeColor);
        }
        if (typeof tg.setBackgroundColor === 'function') {
          tg.setBackgroundColor(themeColor);
        }

        // Sync user immediately when WebApp is ready
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
          performSync(tg.initDataUnsafe.user);
        } else {
          performSync();
        }

        // Request fullscreen after a small delay to hide system nav bar
        setTimeout(() => {
          try {
            if (tg.requestFullscreen) {
              tg.requestFullscreen();
            }
          } catch (e) {
            console.log('Fullscreen not supported:', e);
          }
        }, 300);

        // Force expand if user tries to swipe it down
        tg.onEvent('viewportChanged', () => {
          if (!tg.isExpanded) {
            tg.expand();
          }
          // Re-request fullscreen if it was lost
          try {
            if (tg.requestFullscreen && !tg.isFullscreen) {
              tg.requestFullscreen();
            }
          } catch (e) {}
        });
      } catch (e) {
        console.log('Telegram API error:', e);
      }
    };

    // Set viewport meta for immersive mode
    const existingMeta = document.querySelector('meta[name="viewport"]');
    if (existingMeta) {
      existingMeta.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no');
    }

    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      initTelegram(tg);
    } else {
      console.log('[Telegram-Init] WebApp not found in window, polling...');
      const interval = setInterval(() => {
        const polledTg = (window as any).Telegram?.WebApp;
        if (polledTg) {
          clearInterval(interval);
          initTelegram(polledTg);
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, []);

  // Update Telegram WebApp header and status bar colors when theme changes
  useEffect(() => {
    if (!isTelegram || typeof window === 'undefined') return;
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      try {
        const themeColor = isDark ? '#000000' : '#FFFFFF';
        if (typeof tg.setHeaderColor === 'function') {
          tg.setHeaderColor(themeColor);
        }
        if (typeof tg.setBackgroundColor === 'function') {
          tg.setBackgroundColor(themeColor);
        }
      } catch (e) {
        console.log('Error setting Telegram header colors:', e);
      }
    }
  }, [isDark]);

  return (
    <ErrorBoundary>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator key={fontKey} />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
