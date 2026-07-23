const http = require('http');

const payload = {
  model: 'llama3.2',
  messages: [
    { role: 'user', content: 'Say hello in JSON: {"greeting":"..."}' }
  ]
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
    console.log('body', body);
  });
});

req.on('error', err => console.error('error', err.message));
req.write(data);
req.end();