import { getDb } from '../server/config/database';
import { v4 as uuidv4 } from 'uuid';

const db = getDb();

// Delete all existing test workflows and logs
db.prepare('DELETE FROM perf_plans').run();
db.prepare('DELETE FROM pool_tasks').run();
db.prepare('DELETE FROM perf_logs').run();

// The users we use for the test
// Creator: zhangwei
// Subordinate: liuqiang
// Approver (Manager): lifang

const ts = new Date().toISOString();
const tsMinus1 = new Date(Date.now() - 3600000).toISOString();
const tsMinus2 = new Date(Date.now() - 7200000).toISOString();
const tsMinus3 = new Date(Date.now() - 86400000 * 2).toISOString();

// 1. zhangwei initiated a new plan, now pending (Wait for Li Fang)
const p1Fields = ['Q2 OKR: Improve HR system performance', 'S: Load <1s\\nM: Refactor DOM\\nT: 2w', 'pending_review', 'Q2', 'lifang', 'zhangwei', 'frontend module', '2026-06-30'];
const r1 = db.prepare('INSERT INTO perf_plans (title, description, status, quarter, approver_id, creator_id, category, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(...p1Fields);
db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, new_value, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(r1.lastInsertRowid, 'zhangwei', 'submit', 'pending_review', '提交了Q2绩效计划，期待批准', tsMinus1);

// 2. liuqiang initiated a plan, pending zhangwei's approval
const p2Fields = ['Completed UI components refactor', 'S: All buttons migrated\\nM: 0 visual bugs\\nT: 1w', 'pending_review', 'Q2', 'zhangwei', 'liuqiang', 'UI Redesign', '2026-05-15'];
const r2 = db.prepare('INSERT INTO perf_plans (title, description, status, quarter, approver_id, creator_id, category, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(...p2Fields);
db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, new_value, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(r2.lastInsertRowid, 'liuqiang', 'submit', 'pending_review', '张主管，前端重构方案已提交完毕，请查阅', tsMinus2);

// 3. proposal submitted by liuqiang, reviewed by zhangwei, pending hr (admin)
const pt1Fields = [1, 'Outstanding coding speed award', 5000, 'liuqiang', 'pending_hr', 'zhangwei', 'admin', tsMinus3];
const rp1 = db.prepare('INSERT INTO pool_tasks (id, title, bonus, created_by, proposal_status, hr_reviewer_id, admin_reviewer_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(...pt1Fields);
// Log table for proposals is currently... Wait, we just use perf_logs for plans, pool tasks don't have a rigid log table unless we use `notifications` or standard strings.
// Actually, for pool proposals, if there are no logs, we can just render the status statically or skip, but I will make the dashboard robust.

// 4. a workflow that was rejected by HR (from zhangwei)
const p3Fields = ['Apply for remote work equipment', 'Need a new monitor', 'rejected', 'Q2', 'lifang', 'zhangwei', 'Equipment', '2026-04-30'];
const r3 = db.prepare('INSERT INTO perf_plans (title, description, status, quarter, approver_id, creator_id, category, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(...p3Fields);
db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(r3.lastInsertRowid, 'zhangwei', 'submit', 'draft', 'pending_review', 'Please approve my monitor request', tsMinus3);
db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(r3.lastInsertRowid, 'lifang', 'status_change', 'pending_review', 'rejected', 'Equipment budget is currently frozen until Q3', ts);

console.log('Successfully seeded typical workflows.');
