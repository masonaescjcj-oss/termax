import { supabase } from '../config/supabase';

async function testConnection() {
    console.log('Testing connection to Supabase using backend config...');
    
    // Attempt to query 'users' table
    const { data, error } = await supabase.from('users').select('id').limit(1);
    
    if (error) {
        console.error('Error querying "users" table:', error);
        if (error.code === '42P01' || error.message.includes('relation "public.users" does not exist')) {
            console.log('❌ Table "users" does not exist. The schema SQL has not been executed yet.');
        } else {
            console.log('❌ Connection failed with error:', error.message);
        }
    } else {
        console.log('✅ Connected successfully! Table "users" exists. Data:', data);
    }
}

testConnection();
