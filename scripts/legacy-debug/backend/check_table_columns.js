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
  const { data, error } = await supabase.from('brokers').select('*').limit(1);
  if (error) {
    console.error("Database query error:", error.message);
    return;
  }
  console.log("Database columns:", Object.keys(data[0]));
}
test();
