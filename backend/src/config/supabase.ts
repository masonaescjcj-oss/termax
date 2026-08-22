import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ Supabase credentials are not set in .env yet.');
}

// Create a single supabase client for interacting with your database
// We use the service_role key in the backend to bypass RLS and perform admin actions
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false
    },
    realtime: {
        transport: ws as any
    }
});

