import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Check if Telegram CloudStorage is available
const getTelegramCloud = (): any | null => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.CloudStorage) {
        return (window as any).Telegram.WebApp.CloudStorage;
    }
    return null;
};

// Promisify Telegram CloudStorage.setItem
const cloudSet = (key: string, value: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const cloud = getTelegramCloud();
        if (!cloud) return reject('No CloudStorage');
        cloud.setItem(key, value, (err: any) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

// Promisify Telegram CloudStorage.getItem
const cloudGet = (key: string): Promise<string | null> => {
    return new Promise((resolve, reject) => {
        const cloud = getTelegramCloud();
        if (!cloud) return reject('No CloudStorage');
        cloud.getItem(key, (err: any, value: string) => {
            if (err) reject(err);
            else resolve(value || null);
        });
    });
};

// Promisify Telegram CloudStorage.removeItem
const cloudRemove = (key: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const cloud = getTelegramCloud();
        if (!cloud) return reject('No CloudStorage');
        cloud.removeItem(key, (err: any) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

export const setItemAsync = async (key: string, value: string | null | undefined) => {
    if (value === undefined || value === null || value === 'undefined') {
        await deleteItemAsync(key);
        return;
    }
    // Always save to localStorage for instant access
    if (Platform.OS === 'web') {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.error('Local storage is unavailable:', e);
        }
        // Also save to Telegram CloudStorage for cross-session persistence
        try {
            await cloudSet(key, value);
        } catch (e) {
            // CloudStorage not available, localStorage is enough
        }
    } else {
        await SecureStore.setItemAsync(key, value);
    }
};

export const getItemAsync = async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
        // Try localStorage first (instant, no network)
        try {
            const localValue = localStorage.getItem(key);
            if (localValue && localValue !== 'undefined') return localValue;
            if (localValue === 'undefined') {
                localStorage.removeItem(key);
            }
        } catch (e) {
            console.error('Local storage is unavailable:', e);
        }
        // Fallback to Telegram CloudStorage (persists across clears)
        try {
            const cloudValue = await cloudGet(key);
            if (cloudValue && cloudValue !== 'undefined') {
                // Sync back to localStorage for next time
                try { localStorage.setItem(key, cloudValue); } catch (e) {}
                return cloudValue;
            }
            if (cloudValue === 'undefined') {
                await cloudRemove(key).catch(() => {});
            }
        } catch (e) {
            // CloudStorage not available
        }
        return null;
    } else {
        const val = await SecureStore.getItemAsync(key);
        if (val === 'undefined') {
            await SecureStore.deleteItemAsync(key).catch(() => {});
            return null;
        }
        return val;
    }
};

export const deleteItemAsync = async (key: string) => {
    if (Platform.OS === 'web') {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Local storage is unavailable:', e);
        }
        // Also remove from Telegram CloudStorage
        try {
            await cloudRemove(key);
        } catch (e) {
            // CloudStorage not available
        }
    } else {
        await SecureStore.deleteItemAsync(key);
    }
};
