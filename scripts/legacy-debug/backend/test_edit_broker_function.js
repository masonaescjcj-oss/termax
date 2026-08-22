const { editBroker } = require('./src/controllers/adminController');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const ws = require('ws');
dotenv.config();

// Initialize mock request and response
const req = {
  params: {
    id: '0c778524-d61d-4a86-b660-0f4351bd5429' // Alpari ID
  },
  body: {
    name: 'Alpari Updated Test',
    regulation: 'FSA, FSC',
    spreads: 'From 0.0 pips',
    minDeposit: '$1',
    maxLeverage: '1:1000',
    logoUrl: '/uploads/l5f5f28057fd3725a6e5f003e46fbe00.png',
    ranking: 0,
    isPromoted: false,
    communityName: ''
  }
};

const res = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    console.log("Response Status Code:", this.statusCode || 200);
    console.log("Response JSON:", data);
  }
};

async function run() {
  try {
    await editBroker(req, res);
  } catch (e) {
    console.error("Function threw error:", e);
  }
}
run();
