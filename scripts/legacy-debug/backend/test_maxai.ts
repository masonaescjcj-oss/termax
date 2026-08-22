import { chatWithMaxAI } from './src/controllers/aiController';
import dotenv from 'dotenv';
dotenv.config();

// We need a valid user ID from the database for the test
const req: any = {
  user: {
    id: '399207185' // Isaacar's user ID or another existing user ID
  },
  body: {
    messages: [
      { role: 'user', content: 'hello' }
    ]
  }
};

const res: any = {
  statusCode: 200,
  status: function(code: number) {
    this.statusCode = code;
    return this;
  },
  json: function(data: any) {
    console.log("Response Status Code:", this.statusCode);
    console.log("Response JSON:", JSON.stringify(data, null, 2));
  }
};

async function run() {
  try {
    // Let's find a valid user ID first
    const { supabase } = require('./src/config/supabase');
    const { data: users } = await supabase.from('users').select('id').limit(1);
    if (users && users.length > 0) {
      req.user.id = users[0].id;
      console.log("Running MaxAI test for user ID:", req.user.id);
      await chatWithMaxAI(req, res);
    } else {
      console.error("No users found in database to test with.");
    }
  } catch (e) {
    console.error("Function threw error:", e);
  }
}
run();
