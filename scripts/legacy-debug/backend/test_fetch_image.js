const axios = require('axios');

async function testFetch() {
  try {
    const url = 'https://tramadol-thats-serial-manuals.trycloudflare.com/uploads/4ac09b9d56c22170040f1a9f0f4381bb.jpeg';
    console.log("Fetching:", url);
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    console.log("Status:", res.status);
    console.log("Content-Length:", res.headers['content-length']);
    console.log("Access-Control-Allow-Origin:", res.headers['access-control-allow-origin']);
  } catch (e) {
    console.error("Error fetching:", e.message);
  }
}

testFetch();
