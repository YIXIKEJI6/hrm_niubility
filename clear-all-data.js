const DB = require('better-sqlite3');
function clearDb(dbPath) {
  const db = new DB(dbPath);
  const tables = [
    'pool_tasks', 'pool_participants', 'pool_role_claims', 
    'perf_plans', 'perf_logs', 'tasks', 'notifications',
    'team_feeds', 'competency_evaluations', 'competency_scores'
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
  console.log(`Done clearing ${dbPath}`);
}
try { clearDb('./data/hrm.db'); } catch(e) { console.log('Local fail:', e); }
