// @ts-nocheck
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Bookmark, LineChart, Cpu, Layers, User, Bot } from 'lucide-react-native';

import WatchlistScreen from '../screens/WatchlistScreen';
import ChartScreen from '../screens/ChartScreen';

import AssetDetailsScreen from '../screens/AssetDetailsScreen';
import PositionsScreen from '../screens/PositionsScreen';
import LoginScreen from '../screens/LoginScreen';
import AdminScreen from '../screens/AdminScreen';
import AICoachScreen from '../screens/AICoachScreen';
import ToolsHubScreen from '../screens/ToolsHubScreen';
import NewsRadarScreen from '../screens/NewsRadarScreen';
import EarnNftScreen from '../screens/EarnNftScreen';
import BotsScreen from '../screens/BotsScreen';
import TradeDnaScreen from '../screens/TradeDnaScreen';
import { useTheme } from '../theme/ThemeContext';
import { isTelegram } from '../config';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function BottomTabs() {
    const { colors, isDark } = useTheme();
    return (
        <Tab.Navigator
            backBehavior="history"
            screenOptions={{
                headerShown: false,
                sceneContainerStyle: { backgroundColor: colors.background },
                tabBarBackground: () => (
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isDark ? '#000000' : colors.tabBar, borderTopWidth: 0 }} />
                ),
                tabBarStyle: {
                    backgroundColor: 'transparent',
                    borderTopColor: 'transparent',
                    borderTopWidth: 0,
                    elevation: 0,
                    shadowOpacity: 0,
                    shadowColor: 'transparent',
                    shadowOffset: { width: 0, height: 0 },
                    shadowRadius: 0,
                    height: isTelegram ? 54 : 60,
                    paddingBottom: isTelegram ? 4 : 8,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.tabBarInactive,
                tabBarShowLabel: false,
                tabBarLabelStyle: {
                    fontSize: 10,
                    marginTop: 4,
                }
            }}
        >
            <Tab.Screen
                name="Watchlist"
                component={WatchlistScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Bookmark color={color} size={22} />
                }}
            />
            <Tab.Screen
                name="Positions"
                component={PositionsScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Layers color={color} size={22} />
                }}
            />
            <Tab.Screen
                name="Chart"
                component={ChartScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <LineChart color={color} size={22} />
                }}
            />
            <Tab.Screen
                name="AICoach"
                component={AICoachScreen}
                options={{
                    tabBarLabel: 'MaxAI',
                    tabBarIcon: ({ color, size }) => <Bot color={color} size={22} />,
                    tabBarStyle: { display: 'none' }
                }}
            />
            <Tab.Screen
                name="Login"
                component={LoginScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <User color={color} size={22} />
                }}
            />
        </Tab.Navigator>
    );
}

// A route-based registry for custom back handlers to prevent overwrite/cleanup race conditions
const routeHandlers: Record<string, Function> = {};

if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'customTelegramBackHandler', {
        configurable: true,
        get() {
            const activeRoute = (window as any)._navigationRefCurrent?.getCurrentRoute()?.name;
            const handler = activeRoute ? routeHandlers[activeRoute] : undefined;
            console.log(`[TG-Back-Proxy] GET handler for route: ${activeRoute} -> exists: ${!!handler}`);
            return handler;
        },
        set(handler) {
            const activeRoute = (window as any)._navigationRefCurrent?.getCurrentRoute()?.name;
            if (activeRoute) {
                if (handler) {
                    routeHandlers[activeRoute] = handler;
                    console.log(`[TG-Back-Proxy] SET handler for route: ${activeRoute}`);
                } else {
                    delete routeHandlers[activeRoute];
                    console.log(`[TG-Back-Proxy] CLEAR handler for route: ${activeRoute}`);
                }
                // Trigger visibility sync immediately on handler change
                if (typeof (window as any)._syncTelegramBackButton === 'function') {
                    (window as any)._syncTelegramBackButton();
                }
            } else {
                console.log('[TG-Back-Proxy] SET/CLEAR called but no active route found in window._navigationRefCurrent');
            }
        }
    });
}

export default function RootNavigator() {
    const { colors, isDark } = useTheme();
    const navigationRef = React.useRef<any>(null);
    const [isAuthChecked, setIsAuthChecked] = React.useState(false);

    // Telegram Auto-Login on Mount
    React.useEffect(() => {
        const checkTelegramLogin = async () => {
            if (isTelegram && typeof window !== 'undefined') {
                const tg = (window as any).Telegram?.WebApp;
                if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
                    const tgUser = tg.initDataUnsafe.user;
                    console.log('[RootNavigator-AutoLogin] Telegram user detected:', tgUser);

                    const tgUsername = tgUser.username || `tg_${tgUser.id}`;
                    const tgPassword = `tg_secure_${tgUser.id}_${tgUser.first_name || 'user'}`;

                    const saveTokens = async (tokens: any) => {
                        const { setItemAsync } = require('../utils/storage');
                        await setItemAsync('accessToken', tokens.accessToken);
                        await setItemAsync('refreshToken', tokens.refreshToken);
                        const user = tokens.user || {};
                        user.telegramId = tgUser.id;
                        await setItemAsync('tg_cached_profile', JSON.stringify(user));
                    };

                    const { BACKEND_URL } = require('../config');
                    const axios = require('axios').default;

                    // Try login first
                    try {
                        let res = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, {
                            username: tgUsername, password: tgPassword, telegramId: tgUser.id
                        });
                        if (res.data.success && res.data.data) {
                            await saveTokens(res.data.data);
                            console.log('[RootNavigator-AutoLogin] Telegram login success');
                            setIsAuthChecked(true);
                            return;
                        }
                    } catch (loginErr: any) {
                        console.log('[RootNavigator-AutoLogin] Login failed, trying register...', loginErr.message);
                    }

                    // Try register
                    try {
                        const startParam = tg.initDataUnsafe.start_param || '';
                        let res = await axios.post(`${BACKEND_URL}/api/v1/auth/register`, {
                            username: tgUsername, password: tgPassword,
                            email: `${tgUsername}@telegram.user`,
                            telegramId: tgUser.id, referredByCode: startParam,
                            avatarUrl: tgUser.photo_url || 'default'
                        });
                        if (res.data.success && res.data.data) {
                            await saveTokens(res.data.data);
                            console.log('[RootNavigator-AutoLogin] Telegram register success');
                            setIsAuthChecked(true);
                            return;
                        }
                    } catch (regErr: any) {
                        console.log('[RootNavigator-AutoLogin] Register failed:', regErr.message);
                    }
                }
            }
            setIsAuthChecked(true);
        };
        checkTelegramLogin();
    }, []);

    // Callback ref executes during commit phase, setting window._navigationRefCurrent before child effects run
    const setNavigationRef = React.useCallback((refVal: any) => {
        navigationRef.current = refVal;
        if (typeof window !== 'undefined') {
            (window as any)._navigationRefCurrent = refVal;
        }
    }, []);

    const navTheme = {
        ...(isDark ? DarkTheme : DefaultTheme),
        colors: {
            ...(isDark ? DarkTheme : DefaultTheme).colors,
            background: colors.background,
            card: isDark ? '#000000' : colors.tabBar,
            text: colors.text,
            border: 'transparent',
            primary: colors.primary,
        },
    };

    // Show/hide native Telegram BackButton based on current route
    const syncTelegramBackButton = React.useCallback(() => {
        if (!isTelegram) return;
        const tg = (window as any).Telegram?.WebApp;
        if (!tg || !tg.BackButton) return;

        const activeRouteName = navigationRef.current?.getCurrentRoute()?.name;
        
        const mainTabs = ['Watchlist', 'Positions', 'Chart', 'Login'];
        let shouldShow = activeRouteName && !mainTabs.includes(activeRouteName);

        // Show back button if customTelegramBackHandler is currently active
        if (typeof (window as any).customTelegramBackHandler === 'function') {
            shouldShow = true;
        }

        console.log('[TG-Back] syncVisibility route=' + activeRouteName + ' show=' + shouldShow);

        if (shouldShow) {
            tg.BackButton.show();
        } else {
            tg.BackButton.hide();
        }
    }, []);

    // Expose sync function to window so proxy setter can trigger it
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any)._syncTelegramBackButton = syncTelegramBackButton;
        }
        return () => {
            if (typeof window !== 'undefined') {
                (window as any)._syncTelegramBackButton = null;
            }
        };
    }, [syncTelegramBackButton]);

    // Register global Telegram BackButton click handler
    React.useEffect(() => {
        if (!isTelegram) return;
        console.log('[TG-Back] isTelegram=true, setting up back button handler');

        let lastClickTime = 0; // throttle to prevent double-fire

        const handleBackClick = () => {
            // Throttle: ignore if fired within 300ms
            const now = Date.now();
            if (now - lastClickTime < 300) {
                console.log('[TG-Back] throttled (double-fire prevention)');
                return;
            }
            lastClickTime = now;

            console.log('[TG-Back] BACK CLICKED');

            // 1) Check if the active screen has a custom handler
            if (typeof (window as any).customTelegramBackHandler === 'function') {
                try {
                    const handled = (window as any).customTelegramBackHandler();
                    console.log('[TG-Back] customHandler returned=' + handled);
                    if (handled) return;
                } catch (err) {
                    console.error('[TG-Back] customHandler error:', err);
                }
            }

            // 2) Fall back to standard navigation
            const route = navigationRef.current?.getCurrentRoute()?.name;
            const canGoBack = navigationRef.current?.canGoBack();
            console.log('[TG-Back] fallback route=' + route + ' canGoBack=' + canGoBack);

            if (canGoBack) {
                navigationRef.current?.goBack();
            } else {
                navigationRef.current?.navigate('MainTabs', { screen: 'Watchlist' });
            }
        };

        // Try to register the handler immediately, or poll until Telegram WebApp is ready
        let intervalId: any = null;
        let registered = false;

        const doRegister = (tg: any) => {
            if (registered) return;
            registered = true;

            console.log('[TG-Back] Registering handler on Telegram WebApp (version=' + (tg.version || '?') + ')');

            // Method 1: BackButton.onClick (standard API)
            if (tg.BackButton && typeof tg.BackButton.onClick === 'function') {
                tg.BackButton.offClick(handleBackClick); // Prevent duplicate registration
                tg.BackButton.onClick(handleBackClick);
                console.log('[TG-Back] Registered via BackButton.onClick');
            }

            // Method 2: onEvent (alternative API for older/newer clients)
            if (typeof tg.onEvent === 'function') {
                if (typeof tg.offEvent === 'function') {
                    tg.offEvent('backButtonClicked', handleBackClick); // Prevent duplicate registration
                }
                tg.onEvent('backButtonClicked', handleBackClick);
                console.log('[TG-Back] Registered via onEvent(backButtonClicked)');
            }

            // Sync initial visibility
            syncTelegramBackButton();
        };

        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.BackButton) {
            doRegister(tg);
        } else {
            console.log('[TG-Back] Telegram.WebApp not ready yet, polling...');
            intervalId = setInterval(() => {
                const tg2 = (window as any).Telegram?.WebApp;
                if (tg2 && tg2.BackButton) {
                    clearInterval(intervalId);
                    intervalId = null;
                    doRegister(tg2);
                }
            }, 100);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
            const tgCleanup = (window as any).Telegram?.WebApp;
            if (tgCleanup) {
                if (tgCleanup.BackButton && typeof tgCleanup.BackButton.offClick === 'function') {
                    tgCleanup.BackButton.offClick(handleBackClick);
                }
                if (typeof tgCleanup.offEvent === 'function') {
                    tgCleanup.offEvent('backButtonClicked', handleBackClick);
                }
            }
        };
    }, [syncTelegramBackButton]);

    if (!isAuthChecked) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer 
            ref={setNavigationRef} 
            theme={navTheme}
            onReady={syncTelegramBackButton}
            onStateChange={syncTelegramBackButton}
        >
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainTabs" component={BottomTabs} />
                <Stack.Screen name="AssetDetails" component={AssetDetailsScreen} />
                <Stack.Screen name="ToolsHub" component={ToolsHubScreen} />
                <Stack.Screen name="NewsRadar" component={NewsRadarScreen} />
                <Stack.Screen name="Admin" component={AdminScreen} />
                <Stack.Screen name="EarnNft" component={EarnNftScreen} />
                <Stack.Screen name="Bots" component={BotsScreen} />
                <Stack.Screen name="TradeDna" component={TradeDnaScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
