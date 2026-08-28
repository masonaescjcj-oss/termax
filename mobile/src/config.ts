import { Platform, StatusBar } from 'react-native';

// =====================================================
// Backend connection settings
// =====================================================
// To test on a real phone, put your computer's LAN IP here.
// Example: 'http://192.168.1.100:5000'
//
// For a browser or simulator on the same machine: 'http://localhost:5000'
// =====================================================

// =====================================================
// Backend connection settings (HTTPS enabled)
// =====================================================
const getBackendUrl = () => {
    const remoteBackendUrl = 'https://45-129-126-98.sslip.io';

    // Native mobile (Android/iOS) — always use the remote server URL
    // On native, localhost refers to the phone itself, not the development machine
    if (Platform.OS !== 'web') {
        return remoteBackendUrl;
    }

    if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;
        // If loaded on an external web hosting (like Vercel) rather than local, use the remote backend tunnel
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.');
        if (!isLocal) {
            return remoteBackendUrl;
        }

        // If accessed directly via Metro dev server (8081/8082), route API calls directly to live Backend
        if (window.location.port === '8082' || window.location.port === '8081') {
            return remoteBackendUrl;
        }
        // If loaded on local Caddy server (8080) or via cloudflare tunnel, route directly to origin
        return window.location.origin;
    }
    return remoteBackendUrl;
};

export const BACKEND_URL = getBackendUrl();

export const isTelegram = Platform.OS === 'web' && typeof window !== 'undefined' && 
  (window.location.search.includes('tgWebAppData') || 
   window.location.hash.includes('tgWebAppData') || 
   window.location.pathname.includes('/tg') ||
   window.location.pathname.includes('/telegram') ||
   (navigator.userAgent && navigator.userAgent.toLowerCase().includes('telegram')));

export const getTgSafeAreaTop = (): number => {
    if (!isTelegram || typeof window === 'undefined') {
        if (Platform.OS === 'web') return 0;
        return Platform.OS === 'android'
            ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 32)
            : 50;
    }
    const tg = (window as any).Telegram?.WebApp;
    
    // Desktop / Web versions usually don't have overlapping headers
    const platform = tg?.platform || 'unknown';
    if (['tdesktop', 'web', 'weba', 'macos'].includes(platform)) {
        return 16; // Minimal padding for desktop/web
    }

    // For modern Telegram clients, contentSafeAreaInset contains the exact header height
    if (tg?.contentSafeAreaInset?.top) {
        return tg.contentSafeAreaInset.top + 8;
    }
    
    // If only safeAreaInset (notch/status bar) is available, add the native Telegram header height
    if (tg?.safeAreaInset?.top) {
        const headerHeight = platform === 'ios' ? 44 : 56;
        return tg.safeAreaInset.top + headerHeight + 8;
    }
    
    // Fallbacks for older clients
    if (platform === 'ios') {
        const h = window.screen?.height || 0;
        if (h > 800) return 90; // iPhones with notch
        return 70; // Older iPhones
    }
    
    if (platform === 'android') {
        return 12; // On Android, Telegram WebApp viewport starts below status/header bar
    }
    
    // Default fallback for unknown mobile devices
    return 16;
};
