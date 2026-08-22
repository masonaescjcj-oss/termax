import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://jasgepmskcsyvqoesocc.supabase.co';
const supabaseAnonKey = 'sb_publishable_m-HAN3dCgDJpgQ_L3WO1hQ_y1CWihK9';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Synchronize Supabase authentication state with custom SecureStore/localStorage keys
import { setItemAsync, deleteItemAsync } from '../utils/storage';
supabase.auth.onAuthStateChange(async (event, session) => {
    console.log(`[Supabase Auth Listener] Event: ${event}, Session: ${session ? 'YES' : 'NO'}`);
    if (session) {
        try {
            await setItemAsync('accessToken', session.access_token);
            if (session.refresh_token) {
                await setItemAsync('refreshToken', session.refresh_token);
            }
        } catch (err) {
            console.error('[Supabase Auth Sync] Error syncing session to storage:', err);
        }
    } else if (event === 'SIGNED_OUT') {
        try {
            await deleteItemAsync('accessToken');
            await deleteItemAsync('refreshToken');
            await deleteItemAsync('cached_user_profile');
        } catch (err) {
            console.error('[Supabase Auth Sync] Error clearing session from storage:', err);
        }
    }
});
