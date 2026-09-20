/**
 * Test script to invoke POST /plan-action endpoint and display response
 */
const http = require('http');

const payload = {
  task: 'search for wireless headphones',
  sanitizedSchema: {
    schemaVersion: '1.0',
    capturedAt: new Date().toISOString(),
    viewport: { width: 1920, height: 1080 },
    domain: 'shop.example.com',
    elements: [
      {
        id: 'el_0',
        source: 'dom',
        tag: 'input',
        role: 'searchbox',
        label: 'Search catalog',
        type: 'text',
        autocomplete: 'off',
        bbox: { x: 100, y: 50, width: 400, height: 40 },
        value: null,
        text: null
      },
      {
        id: 'el_1',
        source: 'dom',
        tag: 'button',
        role: 'button',
        label: 'Search',
        type: 'submit',
        autocomplete: null,
        bbox: { x: 510, y: 50, width: 80, height: 40 },
        value: null,
        text: null
      }
    ]
  },
  actionHistory: []
};

const data = JSON.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/plan-action',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    try {
      const parsed = JSON.parse(body);
      console.log('Response JSON:\n', JSON.stringify(parsed, null, 2));
    } catch {
      console.log('Response Body:\n', body);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(data);
req.end();
