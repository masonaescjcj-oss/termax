const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const ws = require('ws');
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  realtime: { transport: ws }
});

async function test() {
  const { data: brokers } = await supabase.from('brokers').select('*');
  console.log("All brokers in DB:");
  for (const b of brokers) {
    console.log(`ID: ${b.id}, Name: ${b.name}, is_active: ${b.is_active}`);
  }
}
test();
