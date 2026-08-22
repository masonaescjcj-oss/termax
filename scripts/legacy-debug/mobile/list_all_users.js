const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabaseUrl = 'https://jasgepmskcsyvqoesocc.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY /* hardcoded key removed — rotate it in Supabase */;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    realtime: {
        transport: ws
    }
});

async function listUsers() {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, username, email, ctrader_accounts')
        .limit(20);
        
    if (error) {
        console.error('Error fetching users:', error.message);
        return;
    }
    
    console.log(`Fetched ${users.length} users:`);
    users.forEach(u => {
        console.log(`- ID: ${u.id}, Username: ${u.username}, Email: ${u.email}`);
        console.log(`  Accounts:`, JSON.stringify(u.ctrader_accounts));
    });
}

listUsers();
