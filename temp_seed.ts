import { getDb } from './server/config/database';

const db = getDb();

try {
  console.log("Seeding workflows...");
  // 1. 向下发起任务
  const res1 = db.prepare(`INSERT INTO approval_templates (name, icon, description, category, business_types) VALUES (?, ?, ?, ?, ?)`).run('向下发起任务', 'trending_up', '主管先下发 > 下属员工确认 > 抄送HR及RACI成员', 'performance', '["perf_plan"]');
  const tplId1 = res1.lastInsertRowid;
  db.prepare(`INSERT INTO approval_nodes (template_id, node_type, node_index, label, config_json) VALUES (?, ?, ?, ?, ?)`).run(tplId1, 'initiator', 0, '主管下发', '{"scope":"所有人"}');
  db.prepare(`INSERT INTO approval_nodes (template_id, node_type, node_index, label, config_json) VALUES (?, ?, ?, ?, ?)`).run(tplId1, 'handler', 1, '下属员工确认', '{"assigneeType":"specified","assignees":[]}');
  db.prepare(`INSERT INTO approval_nodes (template_id, node_type, node_index, label, config_json) VALUES (?, ?, ?, ?, ?)`).run(tplId1, 'cc', 2, '抄送HR及更高负责人', '{"assigneeType":"specified","assignees":["lifang"]}');

  // 2. 个人申请目标
  const res2 = db.prepare(`INSERT INTO approval_templates (name, icon, description, category, business_types) VALUES (?, ?, ?, ?, ?)`).run('个人申请目标', 'trending_down', '员工申请 > 主管审批确认 > 抄送HR及RACI成员', 'performance', '["perf_plan"]');
  const tplId2 = res2.lastInsertRowid;
  db.prepare(`INSERT INTO approval_nodes (template_id, node_type, node_index, label, config_json) VALUES (?, ?, ?, ?, ?)`).run(tplId2, 'initiator', 0, '员工申请', '{"scope":"所有人"}');
  db.prepare(`INSERT INTO approval_nodes (template_id, node_type, node_index, label, config_json) VALUES (?, ?, ?, ?, ?)`).run(tplId2, 'approver', 1, '主管审批确认', '{"assigneeType":"specified","assignees":["zhangwei"]}');
  db.prepare(`INSERT INTO approval_nodes (template_id, node_type, node_index, label, config_json) VALUES (?, ?, ?, ?, ?)`).run(tplId2, 'cc', 2, '抄送HR及更高负责人', '{"assigneeType":"specified","assignees":["lifang"]}');

  // 3. 绩效池申请提案
  const res3 = db.prepare(`INSERT INTO approval_templates (name, icon, description, category, business_types) VALUES (?, ?, ?, ?, ?)`).run('绩效池申请提案', 'approval', '员工申请 > 人事评定组织 > 老板审批发布 > 抄送全员', 'performance', '["proposal"]');
  const tplId3 = res3.lastInsertRowid;
  db.prepare(`INSERT INTO approval_nodes (template_id, node_type, node_index, label, config_json) VALUES (?, ?, ?, ?, ?)`).run(tplId3, 'initiator', 0, '员工申请', '{"scope":"所有人"}');
  db.prepare(`INSERT INTO approval_nodes (template_id, node_type, node_index, label, config_json) VALUES (?, ?, ?, ?, ?)`).run(tplId3, 'approver', 1, '人事评定组织', '{"assigneeType":"specified","assignees":["lifang"]}');
  db.prepare(`INSERT INTO approval_nodes (template_id, node_type, node_index, label, config_json) VALUES (?, ?, ?, ?, ?)`).run(tplId3, 'approver', 2, '老板审批和发布', '{"assigneeType":"specified","assignees":["admin"]}');
  db.prepare(`INSERT INTO approval_nodes (template_id, node_type, node_index, label, config_json) VALUES (?, ?, ?, ?, ?)`).run(tplId3, 'cc', 3, '抄送全员', '{"assigneeType":"specified","assignees":[]}');

  console.log("Seeding complete.");
} catch(e) {
  console.log("Error:", e.message);
}
