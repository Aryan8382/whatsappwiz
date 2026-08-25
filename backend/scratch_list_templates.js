const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
let apiKey = '';
let baseUrl = 'https://live.themessenger.app/api';
envContent.split('\n').forEach(line => {
  const clean = line.trim();
  if (clean.startsWith('MESSENGER_API_KEY=')) {
    apiKey = clean.substring('MESSENGER_API_KEY='.length).replace(/^["']|["']$/g, '');
  }
  if (clean.startsWith('MESSENGER_API_BASE_URL=')) {
    baseUrl = clean.substring('MESSENGER_API_BASE_URL='.length).replace(/^["']|["']$/g, '');
  }
});

async function main() {
  const url = baseUrl.replace(/\/+$/, '') + '/get_templates?limit=100';
  console.log('Fetching from:', url);
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    }
  });
  const data = await res.json();
  console.log('Response summary:', data.data ? `${data.data.length} templates` : data);
  if (data.data) {
    console.log('Sample Template 0:', JSON.stringify(data.data[0], null, 2));
    if (data.data.length > 1) {
      console.log('Sample Template 1:', JSON.stringify(data.data[1], null, 2));
    }
  }

}

main().catch(console.error);
