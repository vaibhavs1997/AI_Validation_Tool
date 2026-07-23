const http = require('http');

const payload = {
  model: 'llama3.2',
  messages: [
    { role: 'system', content: 'Return only JSON: {"testCases":[]}' },
    { role: 'user', content: 'Generate 1 test case for updating a user profile.' }
  ],
  temperature: 0.2,
  max_tokens: 200
};

const data = JSON.stringify(payload);

const req = http.request({
  hostname: 'localhost',
  port: 11434,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, res => {
  const start = Date.now();
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('status', res.statusCode);
    console.log('time', Date.now() - start, 'ms');
    try {
      const parsed = JSON.parse(body);
      console.log('content', JSON.stringify(parsed.choices?.[0]?.message?.content || '').slice(0, 500));
    } catch (e) {
      console.log('body', body.slice(0, 500));
    }
  });
});

req.on('error', err => console.error('error', err.message));
req.write(data);
req.end();