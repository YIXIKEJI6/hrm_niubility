const http = require('http');
const jwt = require('./node_modules/jsonwebtoken');

// Load env 
require('dotenv').config();

const token = jwt.sign({ id: 'admin', role: 'admin' }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1d' });

const data = JSON.stringify({ progress: 100 });
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/pool/tasks/8889/progress',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('✅ 触发结果:', body));
});

req.on('error', e => console.error('❌ 测试失败:', e));
req.write(data);
req.end();
