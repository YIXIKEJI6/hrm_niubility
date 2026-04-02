import { getDb } from '../server/config/database';

const db = getDb();

const pending = getDb().prepare(`SELECT pp.*, u.name as creator_name, au.name as approver_name, 'perf_plan' as flow_type FROM perf_plans pp LEFT JOIN users u ON pp.creator_id = u.id LEFT JOIN users au ON pp.approver_id = au.id WHERE pp.id = 11`).get();
console.log(pending);
