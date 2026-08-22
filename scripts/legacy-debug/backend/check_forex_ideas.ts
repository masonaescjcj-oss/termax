import { supabase } from './src/config/supabase';
import dotenv from 'dotenv';
dotenv.config();

async function checkCommunity() {
  try {
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id, created_at, text');
    
    console.log("All messages timestamps:");
    messages?.forEach((m, index) => {
      console.log(`${index+1}: ID=${m.id}, Date=${m.created_at}, Text="${m.text?.substring(0, 15)}"`);
    });

  } catch (e) {
    console.error(e);
  }
}

checkCommunity();
