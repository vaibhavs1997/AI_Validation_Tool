const http = require('http');

const testData = {
  ticket: { 
    key: 'REQ-001', 
    summary: 'Create user account management API with POST /users endpoint', 
    description: 'User registration and management', 
    acceptanceCriteria: ['Users can be created via POST', 'Users can be retrieved via GET', 'Users can be deleted via DELETE']
  }, 
  contract: { 
    endpoints: [
      { id: 'ep1', method: 'POST', path: '/users', operationId: 'createUser' }, 
      { id: 'ep2', method: 'GET', path: '/users/{userId}', operationId: 'getUser' }, 
      { id: 'ep3', method: 'DELETE', path: '/users/{userId}', operationId: 'deleteUser' }
    ]
  }, 
  useAi: false
};

const data = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 4173,
  path: '/api/scenarios/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const parsed = JSON.parse(body);
    console.log('Scenarios:', parsed.scenarios?.length || 0);
    parsed.scenarios?.forEach((s, i) => {
      console.log(`\n[${i+1}] ${s.title}`);
      console.log(`    ID: ${s.id}`);
      console.log(`    Type: ${s.type}`);
      console.log(`    Risk: ${s.risk}`);
      console.log(`    Endpoint: ${s.endpointId ? s.method + ' ' + s.path : 'Unlinked'}`);
      if (s.matchScore !== undefined) console.log(`    Match Score: ${s.matchScore}`);
      if (s.matchConfidence) console.log(`    Confidence: ${s.matchConfidence}`);
    });
  });
});

req.on('error', (e) => { console.error('Error:', e.message); });
req.write(data);
req.end();