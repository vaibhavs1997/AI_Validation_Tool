const http = require('http');
const fs = require('fs');

// Check if server log file exists
const logPath = require('path').join(require('./src/config').rootDir, 'data', 'ai-debug.log');
console.log('Looking for log at:', logPath);
if (fs.existsSync(logPath)) {
  const logs = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
  console.log('Found', logs.length, 'log entries');
  logs.slice(-10).forEach((line, i) => console.log('LOG', i, line));
} else {
  console.log('No log file found yet');
}

const payload = {
  projectId: 'SBD-01',
  ticket: {
    key: 'SBD-1',
    summary: 'Update profile',
    description: 'As a user I can update my profile',
    acceptanceCriteria: [
      'Profile fields can be updated',
      'Validation errors returned for invalid data'
    ]
  },
  contract: null
};

const data = JSON.stringify(payload);

const req = http.request({
  hostname: 'localhost',
  port: 4173,
  path: '/api/test-specifications/generate',
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
    console.log('Response status:', res.statusCode);
    console.log('Response time:', Date.now() - start, 'ms');
    console.log('Response body:', body);
  });
});

req.on('error', err => console.error('Request error:', err.message));
req.write(data);
req.end();