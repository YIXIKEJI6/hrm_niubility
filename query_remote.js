const url = 'http://8.129.5.180:4001';

async function run() {
  const login = await fetch(`${url}/api/auth/mock-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: 'admin' })
  }).then(r => r.json());
  
  const token = login.token;
  const users = await fetch(`${url}/api/org/users`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());
  
  console.log("USERS RETURNED:", users.data.filter(u => u.id === 'huangli' || u.id === 'admin'));
  
  const workflows = await fetch(`${url}/api/workflows/pending`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());
  
  console.log("WORKFLOW 11:", workflows.data?.find(w => String(w.id) === '11') || "NOT FOUND");
}
run();
