const DB = require('C:/hrm-niubility-test/node_modules/better-sqlite3');
function clearDb(dbPath) {
  const db = new DB(dbPath);
  const tables = [
    'pool_tasks', 'pool_participants', 'pool_role_claims', 
    'perf_plans', 'perf_logs', 'tasks', 'notifications',
    'team_feeds', 'pool_join_requests'
  ];
  console.log(`Clearing ${dbPath}...`);
  tables.forEach(t => {
    try {
      db.prepare(`DELETE FROM ${t}`).run();
      console.log(`  Cleared ${t}`);
    } catch(e) {
      console.log(`  Failed ${t}: ${e.message}`);
    }
  });
  db.close();
  console.log(`Done clearing`);
}
try { clearDb('C:/hrm-niubility-test/data/hrm.db'); } catch(e) { console.log('Remote fail:', e); }
