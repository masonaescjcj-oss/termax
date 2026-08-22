const axios = require('axios');
const fs = require('fs');

const url = "https://storage.googleapis.com/eas-workflows-production/logs/f6384776-20ed-40b1-acd7-d1517060488d/6da4f70a-982f-419c-ad74-d6d02acba627/2026-06-22T19%3A55%3A46Z-479edd73-2f62-4a88-b5ba-36fd36d7d81c.txt?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=www-production%40exponentjs.iam.gserviceaccount.com%2F20260623%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260623T081340Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=3b18bbd337043aaf09bfae5f436d1b06e57fb2be88b0436653e5fed1dcd6748e928bfce8eff29198275db3451769f8c9ed55f47ee37f3ab17cb49e898a7a3cffbb8928463f38b80ea8381b4ac5b54867a40aebfad0117b259aa5e0e649e9da4e95216fa84e8e46b2fa181aa9802ef31c78307e11afe74baea3feb845d34531686b535a9b9ac4ecc6c6897c7620af0495b0c01cedcdbffd2d5f59c038f66e502ffdbe348d5429d6ea3d8598cc63ef7a29773c2c9bbc8cf804f0fe3153ed7b41d8732aa121170c6286a323c82d4b60a4da42977b9e0aa2179908039fa4c4f1b95a016851e7be56140530153a2b33719ecd34ef38290f78857ed1b1958d497f0d13";

axios.get(url)
  .then(res => {
    fs.writeFileSync('full_eas_log.txt', typeof res.data === 'object' ? JSON.stringify(res.data) : res.data);
    console.log('Successfully saved full logs.');
  })
  .catch(err => {
    console.error('Error fetching logs:', err.message);
  });
