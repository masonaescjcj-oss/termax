const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const ws = require('ws');
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  realtime: {
    transport: ws
  }
});

async function test() {
  const { data: brokers } = await supabase.from('brokers').select('*').limit(1);
  if (!brokers || brokers.length === 0) {
    console.log("No brokers found");
    return;
  }
  const b = brokers[0];
  console.log("Broker ID to update:", b.id);
  console.log("Current broker name:", b.name);
  
  // Try to update with ID included (similar to how mapBrokerToSnake is doing)
  const updates = { ...b };
  console.log("Attempting update with ID included...");
  const { data, error } = await supabase
    .from('brokers')
    .update(updates)
    .eq('id', b.id)
    .select();
    
  if (error) {
    console.error("Error with ID included:", error.message);
  } else {
    console.log("Success with ID included!");
  }
  
  // Try to update without ID
  delete updates.id;
  console.log("Attempting update without ID...");
  const res = await supabase
    .from('brokers')
    .update(updates)
    .eq('id', b.id)
    .select();
    
  if (res.error) {
    console.error("Error without ID:", res.error.message);
  } else {
    console.log("Success without ID!");
  }
}
test();
