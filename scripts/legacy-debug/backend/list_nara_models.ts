import axios from 'axios';

async function listModels() {
  try {
    const res = await axios.get('https://router.bynara.id/v1/models', {
      headers: {
        'Authorization': 'Bearer ${process.env.AI_API_KEY}'
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e: any) {
    console.error(e.response?.data || e.message);
  }
}

listModels();
