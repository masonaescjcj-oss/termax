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

async function restoreAccount() {
    const email = 'jsdjcvvfjcncn@fmdkf.com';
    console.log(`Searching for user with email: ${email}...`);
    
    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
        
    if (fetchError || !user) {
        console.error('Error fetching user:', fetchError?.message || 'User not found.');
        return;
    }
    
    console.log(`Found user: ${user.username} (ID: ${user.id})`);
    let accounts = user.ctrader_accounts || [];
    console.log('Current accounts:', JSON.stringify(accounts, null, 2));
    
    // Check if account 834998 exists
    const idx = accounts.findIndex(a => a.cTraderId === '834998');
    if (idx > -1) {
        console.log('Account 834998 already exists. Updating its balance to 1000...');
        accounts[idx].balance = 1000;
        accounts[idx].accountType = 'DEMO';
    } else {
        console.log('Account 834998 not found. Appending it with 1000 balance...');
        accounts.push({
            cTraderId: '834998',
            broker: 'Demo Trading',
            accountType: 'DEMO',
            balance: 1000,
            currency: 'USD',
            leverage: '1:100',
            connectedAt: new Date().toISOString()
        });
    }
    
    // Update profile
    const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({ ctrader_accounts: accounts })
        .eq('id', user.id)
        .select()
        .single();
        
    if (updateError) {
        console.error('Error updating user accounts:', updateError.message);
    } else {
        console.log('Successfully updated accounts in database!');
        console.log('New database accounts state:', JSON.stringify(updated.ctrader_accounts, null, 2));
    }
}

restoreAccount();
