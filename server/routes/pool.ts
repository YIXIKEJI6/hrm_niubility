import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest, isSuperAdmin, isGM } from '../middleware/auth';
import { createNotification } from './notifications';
import { sendCardMessage } from '../services/message';
import { logAudit } from '../services/audit-logger';
import { parseSmartFromDescription } from '../utils/smartParser';

const router = Router();


// 绩效池任务列表 (新状态: proposing/claiming/in_progress/rewarded)
// proposing 状态仅 HR/Admin 可见
router.get('/tasks', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const { status, department } = req.query;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  const isHrAdmin = user && ['hr', 'admin'].includes(user.role) || isGM(req.userId) || isSuperAdmin(req.userId);

  let sql = `SELECT pt.*, u.name as creator_name FROM perf_tasks pt LEFT JOIN users u ON pt.creator_id = u.id WHERE pt.task_type IN ('proposal', 'bounty') AND pt.deleted_at IS NULL AND pt.proposal_status != 'rejected'`;
  const params: any[] = [];

  // 非HR/Admin用户仅能看到已通过审批且非草稿的任务（自己创建的除外）
  if (!isHrAdmin) {
    sql += " AND pt.proposal_status = 'approved' AND (pt.status != 'draft' OR pt.creator_id = ?)";
    params.push(req.userId);
  }
  if (status && status !== 'all') { sql += ' AND pt.status = ?'; params.push(status); }
  if (department) { sql += ' AND pt.department = ?'; params.push(department); }
  sql += ' ORDER BY pt.created_at DESC';

  const tasks = db.prepare(sql).all(...params);

  // 附加参与者信息 + 角色认领信息
  const result = tasks.map((t: any) => {
    const participants = db.prepare(
      'SELECT pp.user_id, u2.name as user_name FROM pool_participants pp LEFT JOIN users u2 ON pp.user_id = u2.id WHERE pp.pool_task_id = ?'
    ).all(t.id) as any[];
    const roleClaims = db.prepare(
      `SELECT rc.*, u3.name as user_name FROM pool_role_claims rc LEFT JOIN users u3 ON rc.user_id = u3.id WHERE rc.pool_task_id = ? ORDER BY rc.created_at`
    ).all(t.id) as any[];
    let rolesConfig = [];
    try { rolesConfig = JSON.parse(t.roles_config || '[]'); } catch {}
    const rewardPlan = db.prepare(
      'SELECT id, status FROM pool_reward_plans WHERE pool_task_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(t.id) as any;
    return {
      ...t,
      participants,
      current_participants: participants.length,
      participant_names: participants.map((p: any) => p.user_name).filter(Boolean),
      role_claims: roleClaims,
      roles_config: rolesConfig,
      reward_plan_status: rewardPlan?.status || null,
      reward_plan_id: rewardPlan?.id || null,
    };
  });

  return res.json({ code: 0, data: result });
});

// 回收站列表 (仅管理员/HR)
router.get('/tasks/trash', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || (!['admin', 'hr'].includes(user.role) && !isGM(req.userId) && !isSuperAdmin(req.userId))) {
    return res.status(403).json({ code: 403, message: '仅管理员或HR可查看回收站' });
  }
  const tasks = db.prepare(
    "SELECT pt.*, u.name as creator_name FROM perf_tasks pt LEFT JOIN users u ON pt.creator_id = u.id WHERE pt.deleted_at IS NOT NULL ORDER BY pt.deleted_at DESC"
  ).all();
  return res.json({ code: 0, data: tasks });
});

// 获取单个任务详情
router.get('/tasks/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const task = db.prepare(
    `SELECT pt.*, u.name as creator_name,
       hr_u.name as hr_reviewer_name, admin_u.name as admin_reviewer_name
     FROM perf_tasks pt
     LEFT JOIN users u ON pt.creator_id = u.id
     LEFT JOIN users hr_u ON pt.hr_reviewer_id = hr_u.id
     LEFT JOIN users admin_u ON pt.admin_reviewer_id = admin_u.id
     WHERE pt.id = ?`
  ).get(req.params.id) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });

  // draft 任务仅创建人和 HR/Admin 可查看
  if (task.status === 'draft') {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
    const canView = task.creator_id === req.userId
      || (user && ['hr', 'admin'].includes(user.role))
      || isGM(req.userId) || isSuperAdmin(req.userId);
    if (!canView) return res.status(403).json({ code: 403, message: '无权查看草稿任务' });
  }

  const participants = db.prepare(
    'SELECT pp.user_id, u2.name as user_name FROM pool_participants pp LEFT JOIN users u2 ON pp.user_id = u2.id WHERE pp.pool_task_id = ?'
  ).all(task.id) as any[];
  task.participants = participants;
  task.current_participants = participants.length;
  task.participant_names = participants.map((p: any) => p.user_name).filter(Boolean);

  // 附加待审批的加入申请
  const pendingJoins = db.prepare(
    `SELECT jr.*, u.name as applicant_name FROM pool_join_requests jr LEFT JOIN users u ON jr.user_id = u.id WHERE jr.pool_task_id = ? AND jr.status = 'pending' ORDER BY jr.created_at DESC`
  ).all(task.id) as any[];
  task.pending_join_requests = pendingJoins;

  // [BUG-4 FIX] 附加角色认领数据
  const roleClaims = db.prepare(
    `SELECT rc.*, u.name as user_name FROM pool_role_claims rc LEFT JOIN users u ON rc.user_id = u.id WHERE rc.pool_task_id = ? ORDER BY rc.created_at DESC`
  ).all(task.id) as any[];
  task.role_claims = roleClaims;
  // 与列表接口保持一致：解析 roles_config JSON 字符串为数组
  try { task.roles_config = JSON.parse(task.roles_config || '[]'); } catch { task.roles_config = []; }

  // 附加奖励分配方案状态
  const rewardPlan = db.prepare(
    `SELECT id, status, initiator_id FROM pool_reward_plans WHERE pool_task_id = ? ORDER BY created_at DESC LIMIT 1`
  ).get(task.id) as any;
  task.reward_plan_status = rewardPlan?.status || null;
  task.reward_plan_id = rewardPlan?.id || null;

  return res.json({ code: 0, data: task });
});

// 人员榜单 (统计每个人参与的已完结任务，分为金额和积分)
router.get('/leaderboard', authMiddleware, (req, res) => {
  const db = getDb();
  // 使用 pool_reward_distributions 实际分配金额（审批后为准），而非 perf_tasks.bonus（任务池总额）
  const sql = `
    SELECT
      u.id, u.name, d.name as department_name, u.title,
      COUNT(DISTINCT pp.pool_task_id) as total_tasks,
      COALESCE(rd_money.total, 0) as total_money,
      COALESCE(rd_score.total, 0) as total_score
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN pool_participants pp ON u.id = pp.user_id
    LEFT JOIN (
      SELECT prd.user_id, SUM(prd.bonus_amount) as total
      FROM pool_reward_distributions prd
      JOIN pool_reward_plans prp ON prd.reward_plan_id = prp.id
      JOIN perf_tasks pt ON prp.pool_task_id = pt.id
      WHERE prp.status != 'draft' AND pt.reward_type = 'money'
      GROUP BY prd.user_id
    ) rd_money ON u.id = rd_money.user_id
    LEFT JOIN (
      SELECT prd.user_id, SUM(prd.perf_score) as total
      FROM pool_reward_distributions prd
      JOIN pool_reward_plans prp ON prd.reward_plan_id = prp.id
      JOIN perf_tasks pt ON prp.pool_task_id = pt.id
      WHERE prp.status != 'draft' AND pt.reward_type = 'score'
      GROUP BY prd.user_id
    ) rd_score ON u.id = rd_score.user_id
    WHERE u.status = 'active'
    GROUP BY u.id
    ORDER BY total_money DESC, total_score DESC, total_tasks DESC
  `;
  const leaderboard = db.prepare(sql).all();
  return res.json({ code: 0, data: leaderboard });
});

// 新建任务(提案)
router.post('/tasks/propose', authMiddleware, async (req: AuthRequest, res) => {
  const { title, description, reward_type, bonus, difficulty, max_participants, is_draft, attachments, category, roles_config } = req.body;
  
  if (!title) return res.status(400).json({ code: 400, message: '悬赏标题不能为空' });
  
  const db = getDb();

  // 引擎解析
  const { WorkflowEngine, WORKFLOWS } = await import('../services/workflow-engine');

  if (!is_draft) {
    const rawHrbps = WorkflowEngine.getUsersByRoleTag('hrbp');
    if (rawHrbps.length === 0) {
      return res.status(400).json({ code: 400, message: '系统中尚未配置任何 HRBP 管理员，提交通道暂时锁死，请联系超级管理员配置' });
    }
  }

  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PROPOSAL_CREATE, { initiatorId: req.userId });
  const node2 = nodes.find(n => n.seq === 2); // HRBP
  const node3 = nodes.find(n => n.seq === 3); // GM

  let proposalStatus = 'pending_hr';
  if (is_draft) {
    proposalStatus = 'draft';
  } else {
    // 引擎判断
    let firstApprover = node2?.assignees?.[0];
    if (node2?.isSkipped || !firstApprover) {
      proposalStatus = 'pending_admin';
      let secondApprover = node3?.assignees?.[0];
      if (node3?.isSkipped || !secondApprover) {
        proposalStatus = 'approved';
      }
    }
  }

  const taskStatus = (proposalStatus === 'approved') ? 'published' : 'proposing';
  const attachmentsStr = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : '[]';

  const creatorDeptSql = `
    WITH RECURSIVE dept_tree AS (
      SELECT id, name, parent_id FROM departments WHERE id = (SELECT department_id FROM users WHERE id = ?)
      UNION ALL
      SELECT d.id, d.name, d.parent_id FROM departments d
      JOIN dept_tree dt ON d.id = dt.parent_id
    )
    SELECT name FROM dept_tree WHERE parent_id = 0 OR parent_id = 1 LIMIT 1
  `;
  const topDeptRow = db.prepare(creatorDeptSql).get(req.userId) as { name: string } | undefined;
  const finalDept = topDeptRow ? topDeptRow.name : '全部部门';

  // 方案A: 优先读前端独立字段，兜底解析 description
  const smartFields = parseSmartFromDescription(description || '');
  const finalS = req.body.s || smartFields.s || null;
  const finalM = req.body.m || smartFields.m || null;
  const finalA = req.body.a_smart || smartFields.a || null;
  const finalR = req.body.r_smart || smartFields.r || null;
  const finalT = req.body.t || smartFields.t || null;
  const finalPlanTime = req.body.planTime || smartFields.planTime || null;
  const finalDoTime = req.body.doTime || smartFields.doTime || null;
  const finalCheckTime = req.body.checkTime || smartFields.checkTime || null;
  const finalActTime = req.body.actTime || smartFields.actTime || null;

  // 如果前端发了独立字段但 description 是纯文本，重建带标记的 description
  // 但如果 s 等于原始 description 且其他 SMART 字段全为空，说明是纯文本，不包装
  let finalDescription = description || null;
  const hasRealSmartFields = finalM || finalA || finalR || finalT;
  const isPlainTextAsS = finalS && finalS === description && !hasRealSmartFields;
  if (finalS && !description?.includes('【目标 S】') && !isPlainTextAsS) {
    const pdca = [finalPlanTime ? `Plan: ${finalPlanTime}` : '', finalDoTime ? `Do: ${finalDoTime}` : '', finalCheckTime ? `Check: ${finalCheckTime}` : '', finalActTime ? `Act: ${finalActTime}` : ''].filter(Boolean).join(' | ');
    finalDescription = `【目标 S】\n${finalS}\n【指标 M】\n${finalM || ''}\n【方案 A】\n${finalA || ''}\n【相关 R】\n${finalR || ''}\n【时限 T】\n${finalT || ''}` + (pdca ? `\n【PDCA】\n${pdca}` : '');
  }

  // task_type: 'proposal' initially, becomes 'bounty' upon approval
  const taskTypeVal = (proposalStatus === 'approved') ? 'bounty' : 'proposal';
  const rolesConfigStr = roles_config ? (typeof roles_config === 'string' ? roles_config : JSON.stringify(roles_config)) : null;
  const result = db.prepare(
    `INSERT INTO perf_tasks (task_type, title, description, department, difficulty, reward_type, bonus, max_participants, creator_id, status, proposal_status, attachments, category, smart_s, smart_m, smart_a, smart_r, smart_t, plan_time, do_time, check_time, act_time, roles_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(taskTypeVal, title, finalDescription, finalDept, difficulty || 'normal', reward_type || 'money', bonus || 0, max_participants ?? 5, req.userId, taskStatus, proposalStatus, attachmentsStr, category || null, finalS, finalM, finalA, finalR, finalT, finalPlanTime, finalDoTime, finalCheckTime, finalActTime, rolesConfigStr);

  const { createNotification } = await import('./notifications');

  // 通知逻辑：非草稿时通知 HR 审核
  if (!is_draft) {
    const proposerName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
    if (proposalStatus === 'pending_hr') {
      const hrbps = WorkflowEngine.getUsersByRoleTag('hrbp');
      if (hrbps.length) {
        createNotification(hrbps, 'proposal', '📋 新提案待审核', `${proposerName} 提交了悬赏任务「${title}」，奖金 ¥${bonus || 0}，请审核`, '/company');
        try { sendCardMessage(hrbps, '📋 新提案待审核', `${proposerName} 提交了悬赏任务「${title}」\n奖金: ¥${bonus || 0}\n请前往审核`, `${process.env.APP_URL || 'http://localhost:3000'}/company`); } catch(e) {}
      }
    }
  }

  logAudit({ businessType: 'proposal', businessId: Number(result.lastInsertRowid), actorId: req.userId!, action: is_draft ? 'create' : 'submit', toStatus: proposalStatus, extra: { title, bonus } });

  return res.json({ code: 0, message: is_draft ? '草稿已保存' : '提案已提交，等待人事审核', data: { id: result.lastInsertRowid } });
});

// 更新草稿提案
router.put('/tasks/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(id) as any;
  if (!task) return res.status(404).json({ code: 404, message: '提案不存在' });
  // 创建者或 HR/Admin/GM 均可编辑
  const reqUser = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  const isPrivileged = reqUser && ['hr', 'admin'].includes(reqUser.role) || isSuperAdmin(req.userId!) || isGM(req.userId!);
  if (task.creator_id !== req.userId && !isPrivileged) return res.status(403).json({ code: 403, message: '无权编辑' });
  
  const { title, description, department, difficulty, reward_type, bonus, proposal_status, attachments, category, max_participants } = req.body;
  const sets: string[] = [];
  const vals: any[] = [];
  if (title !== undefined) { sets.push('title = ?'); vals.push(title); }
  if (description !== undefined || req.body.s !== undefined) {
    // 优先读前端独立字段，兜底解析 description
    const sf = parseSmartFromDescription(description || '');
    const sVal = req.body.s || sf.s || null;
    const mVal = req.body.m || sf.m || null;
    const aVal = req.body.a_smart || sf.a || null;
    const rVal = req.body.r_smart || sf.r || null;
    const tVal = req.body.t || sf.t || null;
    const planVal = req.body.planTime || sf.planTime || null;
    const doVal = req.body.doTime || sf.doTime || null;
    const checkVal = req.body.checkTime || sf.checkTime || null;
    const actVal = req.body.actTime || sf.actTime || null;

    // 重建 description
    // 但如果 s 等于原始 description 且其他 SMART 字段全为空，说明是纯文本，不包装
    let finalDesc = description;
    const hasRealSmartFields = mVal || aVal || rVal || tVal;
    const isPlainTextAsS = sVal && sVal === description && !hasRealSmartFields;
    if (sVal && !description?.includes('【目标 S】') && !isPlainTextAsS) {
      const pdca = [planVal ? `Plan: ${planVal}` : '', doVal ? `Do: ${doVal}` : '', checkVal ? `Check: ${checkVal}` : '', actVal ? `Act: ${actVal}` : ''].filter(Boolean).join(' | ');
      finalDesc = `【目标 S】\n${sVal}\n【指标 M】\n${mVal || ''}\n【方案 A】\n${aVal || ''}\n【相关 R】\n${rVal || ''}\n【时限 T】\n${tVal || ''}` + (pdca ? `\n【PDCA】\n${pdca}` : '');
    }
    sets.push('description = ?'); vals.push(finalDesc);
    sets.push('smart_s = ?', 'smart_m = ?', 'smart_a = ?', 'smart_r = ?', 'smart_t = ?', 'plan_time = ?', 'do_time = ?', 'check_time = ?', 'act_time = ?');
    vals.push(sVal, mVal, aVal, rVal, tVal, planVal, doVal, checkVal, actVal);
  }
  if (department !== undefined) { sets.push('department = ?'); vals.push(department); }
  if (difficulty !== undefined) { sets.push('difficulty = ?'); vals.push(difficulty); }
  if (reward_type !== undefined) { sets.push('reward_type = ?'); vals.push(reward_type); }
  if (bonus !== undefined) { sets.push('bonus = ?'); vals.push(bonus); }
  if (proposal_status !== undefined) { sets.push('proposal_status = ?'); vals.push(proposal_status); }
  if (attachments !== undefined) { sets.push('attachments = ?'); vals.push(typeof attachments === 'string' ? attachments : JSON.stringify(attachments)); }
  if (category !== undefined) { sets.push('category = ?'); vals.push(category); }
  if (max_participants !== undefined) { sets.push('max_participants = ?'); vals.push(max_participants); }
  
  if (sets.length === 0) return res.json({ code: 0, message: '无更新' });
  vals.push(id);
  db.prepare(`UPDATE perf_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return res.json({ code: 0, message: proposal_status === 'pending_hr' ? '提案已提交审核' : '草稿已更新' });
});

// 授权用户直接发布任务
router.post('/tasks/publish', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, department, difficulty, reward_type, bonus, max_participants, attachments, category } = req.body;
  if (!title) return res.status(400).json({ code: 400, message: '任务标题不能为空' });
  const db = getDb();

  // 校验权限
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '权限不足，无法直接发布任务' });
  }

  const attachmentsStr = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : '[]';

  // Extract true top-level department of the creator (A-level)
  const creatorDeptSql = `
    WITH RECURSIVE dept_tree AS (
      SELECT id, name, parent_id FROM departments WHERE id = (SELECT department_id FROM users WHERE id = ?)
      UNION ALL
      SELECT d.id, d.name, d.parent_id FROM departments d
      JOIN dept_tree dt ON d.id = dt.parent_id
    )
    SELECT name FROM dept_tree WHERE parent_id = 0 OR parent_id = 1 LIMIT 1
  `;
  const topDeptRow = db.prepare(creatorDeptSql).get(req.userId) as { name: string } | undefined;
  const finalDept = topDeptRow ? topDeptRow.name : '全部部门';

  // 方案A: 解析 SMART/PDCA 写入独立列
  const smartFields = parseSmartFromDescription(description || '');
  const result = db.prepare(
    `INSERT INTO perf_tasks (task_type, title, description, department, difficulty, reward_type, bonus, max_participants, creator_id, status, proposal_status, attachments, category, smart_s, smart_m, smart_a, smart_r, smart_t, plan_time, do_time, check_time, act_time)
     VALUES ('bounty', ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'approved', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(title, description || null, finalDept, difficulty || 'normal', reward_type || 'money', bonus || 0, max_participants ?? 5, req.userId, attachmentsStr, category || null, smartFields.s || null, smartFields.m || null, smartFields.a || null, smartFields.r || null, smartFields.t || null, smartFields.planTime || null, smartFields.doTime || null, smartFields.checkTime || null, smartFields.actTime || null);

  // 全员通知新任务
  const allUserIds = (db.prepare("SELECT id FROM users").all() as any[]).map(u => u.id);
  if (allUserIds.length) {
    createNotification(allUserIds, 'pool_task', '📢 新公司级任务', `绩效池已发布新任务「${title}」，快来认领吧！`, '/company');
    try { sendCardMessage(allUserIds, '📢 新公司级任务', `绩效池已发布新任务「${title}」\n快来认领吧！`, `${process.env.APP_URL || 'http://localhost:3000'}/company`); } catch(e) {}
  }

  return res.json({ code: 0, message: '任务已直接发布到绩效池', data: { id: result.lastInsertRowid } });
});

// 提案列表 (HR/Admin 查看)
router.get('/proposals', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const { status: propStatus } = req.query;
  let sql = "SELECT pt.*, u.name as creator_name FROM perf_tasks pt LEFT JOIN users u ON pt.creator_id = u.id WHERE pt.task_type = 'proposal' AND pt.deleted_at IS NULL";
  const params: any[] = [];
  if (propStatus) { sql += ' AND pt.proposal_status = ?'; params.push(propStatus); }
  sql += ' ORDER BY pt.created_at DESC';
  const proposals = db.prepare(sql).all(...params);
  return res.json({ code: 0, data: proposals });
});

// 我的提案
router.get('/my-proposals', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const proposals = db.prepare("SELECT pt.*, u.name as creator_name FROM perf_tasks pt LEFT JOIN users u ON pt.creator_id = u.id WHERE pt.task_type IN ('proposal', 'bounty') AND pt.creator_id = ? AND pt.deleted_at IS NULL ORDER BY pt.created_at DESC").all(req.userId);
  // 附加 participants、role_claims、解析 roles_config（与列表/详情接口保持一致）
  const result = (proposals as any[]).map((t: any) => {
    const participants = db.prepare(
      'SELECT pp.user_id, u2.name as user_name FROM pool_participants pp LEFT JOIN users u2 ON pp.user_id = u2.id WHERE pp.pool_task_id = ?'
    ).all(t.id) as any[];
    t.participants = participants;
    t.current_participants = participants.length;
    const roleClaims = db.prepare(
      'SELECT rc.*, u3.name as user_name FROM pool_role_claims rc LEFT JOIN users u3 ON rc.user_id = u3.id WHERE rc.pool_task_id = ? ORDER BY rc.created_at DESC'
    ).all(t.id) as any[];
    t.role_claims = roleClaims;
    try { t.roles_config = JSON.parse(t.roles_config || '[]'); } catch { t.roles_config = []; }
    return t;
  });
  return res.json({ code: 0, data: result });
});

// 单个提案详情 (审批、查看用)
router.get('/proposals/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const proposal = db.prepare(
    `SELECT pt.*, u.name as creator_name
     FROM perf_tasks pt
     LEFT JOIN users u ON pt.creator_id = u.id
     WHERE pt.id = ? AND pt.deleted_at IS NULL`
  ).get(req.params.id) as any;
  if (!proposal) return res.status(404).json({ code: 404, message: '提案不存在' });

  // 附加审批轨迹
  try {
    const logs = db.prepare(
      `SELECT al.*, u.name as actor_name FROM audit_logs al LEFT JOIN users u ON al.actor_id = u.id WHERE al.business_type = 'proposal' AND al.business_id = ? ORDER BY al.created_at ASC`
    ).all(proposal.id);
    proposal.logs = logs;
  } catch { proposal.logs = []; }

  return res.json({ code: 0, data: proposal });
});

// 撤回提案：在 HR 未审核前，发起人可以撤回
router.post('/proposals/:id/withdraw', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const proposal = db.prepare('SELECT * FROM perf_tasks WHERE id = ? AND creator_id = ?').get(req.params.id, req.userId) as any;
  if (!proposal) return res.status(404).json({ code: 404, message: '提案不存在' });
  if (!['pending_hr', 'pending_admin'].includes(proposal.proposal_status)) {
    return res.json({ code: 400, message: '当前状态不可撤回，仅待审核状态可撤回' });
  }

  db.prepare("UPDATE perf_tasks SET proposal_status = 'draft' WHERE id = ?").run(req.params.id);
  logAudit({ businessType: 'proposal', businessId: Number(req.params.id), actorId: req.userId!, action: 'withdraw', fromStatus: proposal.proposal_status, toStatus: 'draft' });
  return res.json({ code: 0, message: '提案已撤回，可重新编辑后提交' });
});

// 修改提案 (草稿 or 被驳回均可编辑)
router.post('/proposals/:id/resubmit', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, reward_type, bonus, attachments, max_participants, category, department, difficulty, roles_config } = req.body;
  const db = getDb();

  const proposal = db.prepare('SELECT * FROM perf_tasks WHERE id = ? AND creator_id = ?').get(req.params.id, req.userId) as any;
  if (!proposal) return res.status(404).json({ code: 404, message: '提案不存在' });
  if (!['draft', 'rejected'].includes(proposal.proposal_status)) {
    return res.status(400).json({ code: 400, message: '只能重新提交草稿或被驳回的提案' });
  }

  // Parse SMART fields from description
  const finalDesc = description || proposal.description;
  // parseSmartFromDescription 已在文件顶部 import
  const parsed = parseSmartFromDescription(finalDesc);
  const attachmentsStr = attachments !== undefined ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : undefined;

  const sets = [
    'title=?', 'description=?', 'reward_type=?', 'bonus=?',
    'smart_s=?', 'smart_m=?', 'smart_a=?', 'smart_r=?', 'smart_t=?',
    'plan_time=?', 'do_time=?', 'check_time=?', 'act_time=?',
    "proposal_status='pending_hr'", 'reject_reason=NULL'
  ];
  const params: any[] = [
    title || proposal.title, finalDesc, reward_type || proposal.reward_type, bonus ?? proposal.bonus,
    parsed.s || null, parsed.m || null, parsed.a || null, parsed.r || null, parsed.t || null,
    parsed.planTime || null, parsed.doTime || null, parsed.checkTime || null, parsed.actTime || null
  ];
  if (attachmentsStr !== undefined) { sets.push('attachments=?'); params.push(attachmentsStr); }
  if (max_participants != null) { sets.push('max_participants=?'); params.push(Number(max_participants) ?? 5); }
  if (category) { sets.push('category=?'); params.push(category); }
  if (department) { sets.push('department=?'); params.push(department); }
  if (difficulty) { sets.push('difficulty=?'); params.push(difficulty); }
  if (roles_config !== undefined) {
    sets.push('roles_config=?');
    params.push(typeof roles_config === 'string' ? roles_config : JSON.stringify(roles_config));
  }
  params.push(proposal.id);
  db.prepare(`UPDATE perf_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  // Notify HR
  const hrAdmins = db.prepare("SELECT id FROM users WHERE role IN ('hr', 'admin')").all() as any[];
  const hrAdminIds = hrAdmins.map((u: any) => u.id);
  const proposerName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
  if (hrAdminIds.length) {
    createNotification(hrAdminIds, 'proposal', '📋 提案重新提交', `${proposerName} 借修后重新提交了提案「${title || proposal.title}」`, '/workflows');
  }

  return res.json({ code: 0, message: '提案已重新提交' });
});

// 仅保存修改 (不流转状态)
router.put('/proposals/:id', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, reward_type, bonus, roles_config } = req.body;
  const db = getDb();

  const proposal = db.prepare('SELECT * FROM perf_tasks WHERE id = ? AND creator_id = ?').get(req.params.id, req.userId) as any;
  if (!proposal) return res.status(404).json({ code: 404, message: '提案不存在' });
  if (!['draft', 'rejected'].includes(proposal.proposal_status)) {
    return res.status(400).json({ code: 400, message: '只能修改草稿或被驳回的提案' });
  }

  const finalDesc = description || proposal.description;
  // parseSmartFromDescription 已在文件顶部 import
  const parsed = parseSmartFromDescription(finalDesc);
  const rolesConfigStr = roles_config !== undefined ? (typeof roles_config === 'string' ? roles_config : JSON.stringify(roles_config)) : null;

  db.prepare(
    `UPDATE perf_tasks SET title=?, description=?, reward_type=?, bonus=?,
     smart_s=?, smart_m=?, smart_a=?, smart_r=?, smart_t=?,
     plan_time=?, do_time=?, check_time=?, act_time=?${rolesConfigStr !== null ? ', roles_config=?' : ''} WHERE id = ?`
  ).run(
    ...[title || proposal.title, finalDesc,
    reward_type || proposal.reward_type, bonus || proposal.bonus,
    parsed.s, parsed.m, parsed.a, parsed.r, parsed.t,
    parsed.planTime, parsed.doTime, parsed.checkTime, parsed.actTime,
    ...(rolesConfigStr !== null ? [rolesConfigStr] : []),
    proposal.id]
  );

  return res.json({ code: 0, message: '提案已保存' });
});

// 审批提案 (两级: HR审核 → Admin复核)
router.post('/proposals/:id/review', authMiddleware, async (req: AuthRequest, res) => {
  const { action, reason, bonus, reward_type, max_participants, department, category, attachments } = req.body;
  const db = getDb();
  const proposal = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(req.params.id) as any;
  if (!proposal) return res.status(404).json({ code: 404, message: '提案不存在' });

  const { isGM, isSuperAdmin } = await import('../middleware/auth');
  const isAdminOrGM = isGM(req.userId) || isSuperAdmin(req.userId);

  // ── 禁止自批 ──
  if (proposal.creator_id === req.userId && !isAdminOrGM) {
    return res.status(403).json({ code: 403, message: '提案发起人不能审批自己提交的提案' });
  }

  const { WorkflowEngine, WORKFLOWS } = await import('../services/workflow-engine');
  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PROPOSAL_CREATE, { initiatorId: proposal.creator_id });
  const node2 = nodes.find(n => n.seq === 2); // HRBP
  const node3 = nodes.find(n => n.seq === 3); // GM

  const { createNotification } = await import('./notifications');
  const { sendCardMessage } = await import('../services/message');

  // -- 🚀 特权转办/转交处理 (Transfer) 🚀 --
  if (action === 'transfer' && req.body.transfer_to) {
    const transferUserId = req.body.transfer_to;
    let updateAssigneeSql = "";
    if (proposal.proposal_status === 'pending_hr') {
      updateAssigneeSql = "UPDATE perf_tasks SET hr_reviewer_id = ? WHERE id = ?";
    } else if (proposal.proposal_status === 'pending_admin') {
      updateAssigneeSql = "UPDATE perf_tasks SET admin_reviewer_id = ? WHERE id = ?";
    } else {
      return res.status(400).json({ code: 400, message: '当前评审阶段不可转办' });
    }
    
    // 执行转移
    db.prepare(updateAssigneeSql).run(transferUserId, proposal.id);
    
    const transferUser = db.prepare('SELECT name FROM users WHERE id = ?').get(transferUserId) as any;
    const operatorUser = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
    
    if (transferUser) {
      createNotification([transferUserId], 'workflow_transfer', '🔄 悬赏审批转办单', `${operatorUser?.name || '管理员'} 将一个悬赏提案的审批流转交给了您，请在工作台中查看。`, '/pool');
      try { 
        sendCardMessage([transferUserId], '🔄 审批节点转办通知', `${operatorUser?.name || '管理员'} 将提案「${proposal.title}」的审核工作转交给了您\n> 留言附注: ${reason || '请协助处理该环节审批'}`, `${process.env.APP_URL || 'http://localhost:3000'}/pool`); 
      } catch(e) {}
    }
    return res.json({ code: 0, message: `任务审批流已成功转办给 ${transferUser?.name}` });
  }

  if (action === 'approve') {
    if (proposal.proposal_status === 'pending_hr') {
      const hrbpIds = node2?.assignees || [];
      if (!hrbpIds.includes(req.userId) && !isAdminOrGM) {
        return res.status(403).json({ code: 403, message: '仅分配的 HRBP 或高级管理员可审核' });
      }

      let nextStatus = 'pending_admin';
      let nextApprovers = node3?.assignees || [];
      if (node3?.isSkipped || nextApprovers.length === 0) {
        nextStatus = 'approved';
      }

      let updateSql = "UPDATE perf_tasks SET proposal_status = ?, hr_reviewer_id = ?";
      const params: any[] = [nextStatus, req.userId];
      if (bonus !== undefined) { updateSql += ', bonus = ?'; params.push(Number(bonus) || 0); }
      if (reward_type) { updateSql += ', reward_type = ?'; params.push(reward_type); }
      if (max_participants != null) { updateSql += ', max_participants = ?'; params.push(Number(max_participants) || proposal.max_participants || 5); }
      if (department) { updateSql += ', department = ?'; params.push(department); }
      if (category) { updateSql += ', category = ?'; params.push(category); }
      if (attachments !== undefined) { updateSql += ', attachments = ?'; params.push(typeof attachments === 'string' ? attachments : JSON.stringify(attachments)); }
      if (req.body.dt || req.body.a || req.body.r || req.body.c || req.body.i) {
        const buildRole = (name: string, idsStr: string | undefined, max: number = 0) => {
          if (!idsStr) return { name, max, users: [] };
          const ids = idsStr.split(',').filter(Boolean);
          if (ids.length === 0) return { name, max, users: [] };
          const placeholders = ids.map(() => '?').join(',');
          const users = db.prepare(`SELECT id, name, avatar_url, department_id, status, role FROM users WHERE id IN (${placeholders})`).all(...ids).map((u: any) => ({
            id: u.id,
            name: u.name,
            avatar: u.avatar_url,
            department: u.department_id,
            type: u.role,
            status: u.status
          }));
          return { name, max, users };
        };

        const defaultRolesConfig = [
          buildRole('R', req.body.r, 0),
          buildRole('A', req.body.a, 1),
          buildRole('C', req.body.c, 0),
          buildRole('I', req.body.i, 0),
          buildRole('交付对象', req.body.dt, 0) // [DEPRECATED] 交付对象角色已弃用，保留兼容历史数据
        ];
        updateSql += ', roles_config = ?';
        params.push(JSON.stringify(defaultRolesConfig));
      }
      // [DEPRECATED] delivery_target_id 字段已弃用，金主验收流程已移除，保留向后兼容
      if (req.body.dt) {
        updateSql += ', delivery_target_id = ?';
        params.push(req.body.dt);
      }
      if (req.body.s) {
        // 如果前端发来的 s 已包含 SMART 标记（非简化模式的整合文本），先解析出干净字段
        let cleanS = req.body.s, cleanM = req.body.m || '', cleanA = req.body.a_smart || '', cleanR = req.body.r_smart || '', cleanT = req.body.t || '';
        if (String(req.body.s).includes('【目标 S】')) {
          const parsed = parseSmartFromDescription(req.body.s);
          cleanS = parsed.s || req.body.s;
          cleanM = parsed.m || cleanM;
          cleanA = parsed.a || cleanA;
          cleanR = parsed.r || cleanR;
          cleanT = parsed.t || cleanT;
        }
        let pdca: string;
        if (req.body.planTime || req.body.doTime || req.body.checkTime || req.body.actTime) {
          pdca = [
            req.body.planTime ? `Plan: ${req.body.planTime}` : '',
            req.body.doTime ? `Do: ${req.body.doTime}` : '',
            req.body.checkTime ? `Check: ${req.body.checkTime}` : '',
            req.body.actTime ? `Act: ${req.body.actTime}` : '',
          ].filter(Boolean).join(' | ') || 'Plan:  | Do:  | Check:  | Act: ';
        } else {
          pdca = proposal.description?.match(/【PDCA】\n?([\s\S]*?)$/)?.[1]?.trim() || 'Plan:  | Do:  | Check:  | Act: ';
        }
        updateSql += ', title = ?, description = ?';
        params.push(
          req.body.summary || proposal.title,
          `【目标 S】\n${cleanS}\n【指标 M】\n${cleanM}\n【方案 A】\n${cleanA}\n【相关 R】\n${cleanR}\n【时限 T】\n${cleanT}\n【PDCA】\n${pdca}`
        );
        // 方案A: 同步写入 SMART/PDCA 独立列
        updateSql += ', smart_s = ?, smart_m = ?, smart_a = ?, smart_r = ?, smart_t = ?, plan_time = ?, do_time = ?, check_time = ?, act_time = ?';
        params.push(cleanS, cleanM, cleanA, cleanR, cleanT, req.body.planTime || proposal.plan_time || '', req.body.doTime || proposal.do_time || '', req.body.checkTime || proposal.check_time || '', req.body.actTime || proposal.act_time || '');
      }
      if (reason && reason !== '同意') { updateSql += ', reject_reason = ?'; params.push(reason); }
      if (nextStatus === 'approved') { updateSql += ", task_type = 'bounty', status = 'published'"; }
      updateSql += ' WHERE id = ?';
      params.push(proposal.id);
      db.prepare(updateSql).run(...params);
      logAudit({ businessType: 'proposal', businessId: proposal.id, actorId: req.userId!, action: 'approve', fromStatus: 'pending_hr', toStatus: nextStatus, comment: reason });

      if (nextStatus === 'pending_admin') {
        const adminIds = Array.from(new Set(nextApprovers));
        if (adminIds.length) {
          createNotification(adminIds as string[], 'proposal', '🔍 提案待复核', `「${proposal.title}」已通过人事审核，请进行总经理复核`, '/workflows');
          try { sendCardMessage(adminIds as string[], '🔍 提案待复核', `「${proposal.title}」已通过人事审核\n请进行总经理复核`, `${process.env.APP_URL || 'http://localhost:3000'}/workflows`); } catch(e) {}
        }
        createNotification([proposal.creator_id], 'proposal', '✅ 提案通过人事审核', `您的提案「${proposal.title}」已通过人事审核，正在等待总经理复核`, '/company');
        return res.json({ code: 0, message: '人事审核通过，已转交总经理复核' });
      } else {
        createNotification([proposal.creator_id], 'proposal', '🎉 提案已通过', `您的提案「${proposal.title}」已通过复核，全员可见`, '/company');
        try { sendCardMessage([proposal.creator_id], '🎉 提案已通过', `您的提案「${proposal.title}」已通过复核\n等待认领`, `${process.env.APP_URL || 'http://localhost:3000'}/company`); } catch(e) {}
        const hrListIds = node2?.assignees || [];
        if (hrListIds.length) {
          createNotification(hrListIds, 'proposal', '✅ 提案可发布', `「${proposal.title}」已自动通过总经理复核`, '/admin');
        }
        return res.json({ code: 0, message: '审核通过，触发免审直接发布全员可见' });
      }
    }

    if (proposal.proposal_status === 'pending_admin') {
      const adminIds = node3?.assignees || [];
      if (!adminIds.includes(req.userId) && !isAdminOrGM) {
        return res.status(403).json({ code: 403, message: '仅分配的高管可复核' });
      }
      // [DEPRECATED] 交付对象校验已弃用，金主验收流程已移除
      let updateSql = "UPDATE perf_tasks SET task_type = 'bounty', proposal_status = 'approved', status = 'published', admin_reviewer_id = ?";
      const params: any[] = [req.userId];
      if (bonus !== undefined) { updateSql += ', bonus = ?'; params.push(Number(bonus) || 0); }
      if (reward_type) { updateSql += ', reward_type = ?'; params.push(reward_type); }
      if (max_participants != null) { updateSql += ', max_participants = ?'; params.push(Number(max_participants) || proposal.max_participants || 5); }
      if (category) { updateSql += ', category = ?'; params.push(category); }
      if (attachments !== undefined) { updateSql += ', attachments = ?'; params.push(typeof attachments === 'string' ? attachments : JSON.stringify(attachments)); }
      if (req.body.s) {
        let cleanS = req.body.s, cleanM = req.body.m || '', cleanA = req.body.a_smart || '', cleanR = req.body.r_smart || '', cleanT = req.body.t || '';
        if (String(req.body.s).includes('【目标 S】')) {
          const parsed = parseSmartFromDescription(req.body.s);
          cleanS = parsed.s || req.body.s;
          cleanM = parsed.m || cleanM;
          cleanA = parsed.a || cleanA;
          cleanR = parsed.r || cleanR;
          cleanT = parsed.t || cleanT;
        }
        let pdca: string;
        if (req.body.planTime || req.body.doTime || req.body.checkTime || req.body.actTime) {
          pdca = [
            req.body.planTime ? `Plan: ${req.body.planTime}` : '',
            req.body.doTime ? `Do: ${req.body.doTime}` : '',
            req.body.checkTime ? `Check: ${req.body.checkTime}` : '',
            req.body.actTime ? `Act: ${req.body.actTime}` : '',
          ].filter(Boolean).join(' | ') || 'Plan:  | Do:  | Check:  | Act: ';
        } else {
          pdca = proposal.description?.match(/【PDCA】\n?([\s\S]*?)$/)?.[1]?.trim() || 'Plan:  | Do:  | Check:  | Act: ';
        }
        updateSql += ', title = ?, description = ?';
        params.push(
          req.body.summary || proposal.title,
          `【目标 S】\n${cleanS}\n【指标 M】\n${cleanM}\n【方案 A】\n${cleanA}\n【相关 R】\n${cleanR}\n【时限 T】\n${cleanT}\n【PDCA】\n${pdca}`
        );
        updateSql += ', smart_s = ?, smart_m = ?, smart_a = ?, smart_r = ?, smart_t = ?, plan_time = ?, do_time = ?, check_time = ?, act_time = ?';
        params.push(cleanS, cleanM, cleanA, cleanR, cleanT, req.body.planTime || proposal.plan_time || '', req.body.doTime || proposal.do_time || '', req.body.checkTime || proposal.check_time || '', req.body.actTime || proposal.act_time || '');
      }
      if (reason && reason !== '同意') { updateSql += ', reject_reason = ?'; params.push(reason); }
      updateSql += ' WHERE id = ?';
      params.push(proposal.id);
      db.prepare(updateSql).run(...params);
      logAudit({ businessType: 'proposal', businessId: proposal.id, actorId: req.userId!, action: 'approve', fromStatus: 'pending_admin', toStatus: 'approved', comment: reason });

      // 通知提案人已通过
      createNotification([proposal.creator_id], 'proposal', '🎉 提案已通过', `您的提案「${proposal.title}」已通过总经理复核，全员可见`, '/company');
      try { sendCardMessage([proposal.creator_id], '🎉 提案已通过', `您的提案「${proposal.title}」已通过总经理复核\n全员可见等待认领`, `${process.env.APP_URL || 'http://localhost:3000'}/company`); } catch(e) {}
      
      const hrListIds = node2?.assignees || [];
      if (hrListIds.length) {
        createNotification(hrListIds, 'proposal', '✅ 提案已通过复核', `「${proposal.title}」已完成总经理复核，正式生效`, '/admin');
      }
      return res.json({ code: 0, message: '总经理复核通过，提案已生效' });
    }
    return res.status(400).json({ code: 400, message: `当前状态 ${proposal.proposal_status} 不可审批` });
  }

  if (action === 'reject') {
    if (!['pending_hr', 'pending_admin'].includes(proposal.proposal_status)) {
      return res.status(400).json({ code: 400, message: '当前状态不可驳回' });
    }
    if (proposal.proposal_status === 'pending_hr') {
        const hrbpIds = node2?.assignees || [];
        if (!hrbpIds.includes(req.userId) && !isAdminOrGM) return res.status(403).json({ code: 403, message: '无权限驳回' });
    } else {
        const adminIds = node3?.assignees || [];
        if (!adminIds.includes(req.userId) && !isAdminOrGM) return res.status(403).json({ code: 403, message: '无权限驳回' });
    }

    const rejector = proposal.proposal_status === 'pending_hr' ? 'hr_reviewer_id' : 'admin_reviewer_id';
    let updateSql = `UPDATE perf_tasks SET proposal_status = 'rejected', ${rejector} = ?, reject_reason = ?`;
    const params: any[] = [req.userId, reason || '未说明'];
    if (attachments !== undefined) { updateSql += ', attachments = ?'; params.push(typeof attachments === 'string' ? attachments : JSON.stringify(attachments)); }
    updateSql += ' WHERE id = ?';
    params.push(proposal.id);
    db.prepare(updateSql).run(...params);
    logAudit({ businessType: 'proposal', businessId: proposal.id, actorId: req.userId!, action: 'reject', fromStatus: proposal.proposal_status, toStatus: 'rejected', comment: reason || '未说明' });
    
    // 通知提案人被驳回
    createNotification([proposal.creator_id], 'proposal', '❌ 提案被驳回', `您的提案「${proposal.title}」被驳回，原因：${reason || '未说明'}`, '/company');
    try { sendCardMessage([proposal.creator_id], '❌ 提案被驳回', `您的提案「${proposal.title}」被驳回\n原因: ${reason || '未说明'}`, `${process.env.APP_URL || 'http://localhost:3000'}/company`); } catch(e) {}
    return res.json({ code: 0, message: '提案已驳回' });
  }

  return res.status(400).json({ code: 400, message: `未知操作: ${action}` });
});

// 加入绩效池任务 → 创建待审批申请（不直接加入）
router.post('/tasks/:id/join', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  // 自动迁移
  try { db.exec(`CREATE TABLE IF NOT EXISTS pool_join_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_task_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    reason TEXT,
    role TEXT,
    status TEXT DEFAULT 'pending',
    reviewer_id TEXT,
    review_comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME
  )`); } catch(e) {}

  const task = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(req.params.id) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });

  // 检查是否已是参与者
  const existing = db.prepare('SELECT * FROM pool_participants WHERE pool_task_id = ? AND user_id = ?').get(task.id, req.userId);
  if (existing) return res.status(400).json({ code: 400, message: '您已是该任务的参与者' });

  // 检查是否已有待审批申请
  const pendingReq = db.prepare("SELECT * FROM pool_join_requests WHERE pool_task_id = ? AND user_id = ? AND status = 'pending'").get(task.id, req.userId);
  if (pendingReq) return res.status(400).json({ code: 400, message: '您已提交申请，正在等待审批' });

  // 检查人数上限（已批准的参与者）
  const currentCount = (db.prepare('SELECT COUNT(*) as c FROM pool_participants WHERE pool_task_id = ?').get(task.id) as any)?.c || 0;
  if (currentCount >= task.max_participants) {
    return res.status(400).json({ code: 400, message: '参与人数已满' });
  }

  const { reason, role } = req.body;
  db.prepare('INSERT INTO pool_join_requests (pool_task_id, user_id, reason, role) VALUES (?, ?, ?, ?)').run(task.id, req.userId, reason || '', role || '');

  // 通知 HR + Admin 有新的加入申请
  const hrAdmins = db.prepare("SELECT id FROM users WHERE role IN ('hr', 'admin')").all() as any[];
  const hrAdminIds = hrAdmins.map((u: any) => u.id);
  const applicantName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
  if (hrAdminIds.length) {
    createNotification(hrAdminIds, 'pool_join', '📋 绩效池加入申请', `${applicantName} 申请加入任务「${task.title}」，请审批`, '/workflows');
    try { sendCardMessage(hrAdminIds, '📋 绩效池加入申请', `${applicantName} 申请加入任务「${task.title}」\n请前往管理后台审批`, `${process.env.APP_URL || 'http://localhost:3000'}/admin`); } catch(e) {}
  }

  return res.json({ code: 0, message: '申请已提交，等待管理员审批' });
});

// 加入申请列表 (HR/Admin)
router.get('/join-requests', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const { status: reqStatus, task_id } = req.query;
  let sql = `SELECT jr.*, u.name as user_name, pt.title as task_title 
    FROM pool_join_requests jr 
    LEFT JOIN users u ON jr.user_id = u.id 
    LEFT JOIN perf_tasks pt ON jr.pool_task_id = pt.id 
    WHERE 1=1`;
  const params: any[] = [];
  if (reqStatus) { sql += ' AND jr.status = ?'; params.push(reqStatus); }
  if (task_id) { sql += ' AND jr.pool_task_id = ?'; params.push(task_id); }
  sql += ' ORDER BY jr.created_at DESC';
  const requests = db.prepare(sql).all(...params);
  return res.json({ code: 0, data: requests });
});

// 审批加入申请
router.post('/join-requests/:id/review', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role, name FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '仅管理员或HR可审批加入申请' });
  }

  const joinReq = db.prepare('SELECT * FROM pool_join_requests WHERE id = ?').get(req.params.id) as any;
  if (!joinReq) return res.status(404).json({ code: 404, message: '申请不存在' });
  if (joinReq.status !== 'pending') return res.status(400).json({ code: 400, message: '该申请已处理' });

  const { action, comment } = req.body;
  const task = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(joinReq.pool_task_id) as any;

  if (action === 'approve') {
    // 再次检查人数上限
    const currentCount = (db.prepare('SELECT COUNT(*) as c FROM pool_participants WHERE pool_task_id = ?').get(joinReq.pool_task_id) as any)?.c || 0;
    if (task && currentCount >= task.max_participants) {
      db.prepare("UPDATE pool_join_requests SET status = 'rejected', reviewer_id = ?, review_comment = ?, reviewed_at = datetime('now') WHERE id = ?")
        .run(req.userId, '人数已满，自动驳回', joinReq.id);
      return res.status(400).json({ code: 400, message: '参与人数已满，无法批准' });
    }

    // 批准 → 加入参与者
    db.prepare("UPDATE pool_join_requests SET status = 'approved', reviewer_id = ?, review_comment = ?, reviewed_at = datetime('now') WHERE id = ?")
      .run(req.userId, comment || '同意', joinReq.id);
    db.prepare('INSERT OR IGNORE INTO pool_participants (pool_task_id, user_id) VALUES (?, ?)').run(joinReq.pool_task_id, joinReq.user_id);

    // 赏金任务已在 perf_tasks 统一表中，无需自动创建重复行

    // 【风险2修复】如果人数满了，必须 A 角色已到位才能自动启动
    const newCount = (db.prepare('SELECT COUNT(*) as c FROM pool_participants WHERE pool_task_id = ?').get(joinReq.pool_task_id) as any)?.c || 0;
    if (task && newCount >= task.max_participants) {
      const approvedA = db.prepare(
        `SELECT id FROM pool_role_claims WHERE pool_task_id = ? AND role_name = 'A' AND status = 'approved'`
      ).get(joinReq.pool_task_id);
      if (approvedA) {
        db.prepare("UPDATE perf_tasks SET status = 'in_progress' WHERE id = ?").run(joinReq.pool_task_id);
      }
      // 若 A 角色未到位，任务停留在 claiming，等 A 认领审批通过后再启动
    }


    // 通知申请人
    createNotification([joinReq.user_id], 'pool_join', '✅ 加入申请已通过', `您申请加入任务「${task?.title || ''}」已被批准`, '/goals');
    try { sendCardMessage([joinReq.user_id], '✅ 加入申请已通过', `您申请加入任务「${task?.title || ''}」已被批准`, `${process.env.APP_URL || 'http://localhost:3000'}/goals`); } catch(e) {}

    return res.json({ code: 0, message: '已批准加入' });
  }

  if (action === 'reject') {
    db.prepare("UPDATE pool_join_requests SET status = 'rejected', reviewer_id = ?, review_comment = ?, reviewed_at = datetime('now') WHERE id = ?")
      .run(req.userId, comment || '不符合条件', joinReq.id);
    
    createNotification([joinReq.user_id], 'pool_join', '❌ 加入申请被驳回', `您申请加入任务「${task?.title || ''}」被驳回，原因：${comment || '不符合条件'}`, '/company');
    
    return res.json({ code: 0, message: '已驳回' });
  }

  return res.status(400).json({ code: 400, message: `未知操作: ${action}` });
});

// 创建绩效池任务 (HR / Admin 直接创建，无需审批)
router.post('/tasks', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, department, difficulty, bonus, max_participants, roles_config,
    smart_s, smart_m, smart_a, smart_r, smart_t, plan_time, do_time, check_time, act_time } = req.body;
  if (!title || !bonus) return res.status(400).json({ code: 400, message: '任务名称和奖金不能为空' });
  const db = getDb();
  // 优先读前端独立字段，兜底解析 description
  const smartFields = parseSmartFromDescription(description || '');
  const finalS = smart_s || smartFields.s || null;
  const finalM = smart_m || smartFields.m || null;
  const finalA = smart_a || smartFields.a || null;
  const finalR = smart_r || smartFields.r || null;
  const finalT = smart_t || smartFields.t || null;
  const finalPlanTime = plan_time || smartFields.planTime || null;
  const finalDoTime = do_time || smartFields.doTime || null;
  const finalCheckTime = check_time || smartFields.checkTime || null;
  const finalActTime = act_time || smartFields.actTime || null;
  const rolesConfigStr = roles_config ? (typeof roles_config === 'string' ? roles_config : JSON.stringify(roles_config)) : null;
  const result = db.prepare(
    "INSERT INTO perf_tasks (title, description, department, difficulty, bonus, max_participants, creator_id, task_type, proposal_status, smart_s, smart_m, smart_a, smart_r, smart_t, plan_time, do_time, check_time, act_time, roles_config) VALUES (?, ?, ?, ?, ?, ?, ?, 'bounty', 'approved', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(title, description || null, department || null, difficulty || 'normal', bonus, max_participants ?? 5, req.userId, finalS, finalM, finalA, finalR, finalT, finalPlanTime, finalDoTime, finalCheckTime, finalActTime, rolesConfigStr);
  return res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

// 关闭绩效池任务 (仅管理员/HR/GM可操作)
router.post('/tasks/:id/close', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  const canClose = (user && ['admin', 'hr'].includes(user.role)) || isGM(req.userId) || isSuperAdmin(req.userId);
  if (!canClose) return res.status(403).json({ code: 403, message: '权限不足，仅管理员或HR可关闭任务' });
  const task = db.prepare('SELECT id FROM perf_tasks WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
  db.prepare("UPDATE perf_tasks SET status = 'closed' WHERE id = ?").run(req.params.id);
  return res.json({ code: 0, message: '已关闭' });
});

// 软删除 → 移入回收站 (仅管理员/HR)
router.delete('/tasks/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const task = db.prepare('SELECT id, title, creator_id, proposal_status FROM perf_tasks WHERE id = ? AND deleted_at IS NULL').get(req.params.id) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });

  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  const isAdminOrHr = user && ['admin', 'hr'].includes(user.role);
  const isCreatorDraft = task.creator_id === req.userId && ['draft', 'rejected'].includes(task.proposal_status);

  if (!isAdminOrHr && !isCreatorDraft) {
    return res.status(403).json({ code: 403, message: '仅管理员/HR可删除任务，或创建者可删除自己的草稿' });
  }

  db.prepare("UPDATE perf_tasks SET deleted_at = datetime('now') WHERE id = ?").run(task.id);
  return res.json({ code: 0, message: `任务「${task.title}」已移入回收站` });
});

// 从回收站恢复 (仅管理员/HR)
router.post('/tasks/:id/restore', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '权限不足' });
  }
  const task = db.prepare('SELECT id, title FROM perf_tasks WHERE id = ? AND deleted_at IS NOT NULL').get(req.params.id) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不在回收站中' });

  db.prepare('UPDATE perf_tasks SET deleted_at = NULL WHERE id = ?').run(task.id);
  return res.json({ code: 0, message: `任务「${task.title}」已恢复` });
});

// 永久删除 (仅管理员/HR)
router.delete('/tasks/:id/purge', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '权限不足' });
  }
  const task = db.prepare('SELECT id, title FROM perf_tasks WHERE id = ? AND deleted_at IS NOT NULL').get(req.params.id) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不在回收站中' });

  db.prepare('DELETE FROM pool_participants WHERE pool_task_id = ?').run(task.id);
  db.prepare('DELETE FROM perf_tasks WHERE id = ?').run(task.id);
  return res.json({ code: 0, message: `任务「${task.title}」已永久删除` });
});



// ── 设置任务角色配置并发布认领 (HR/Admin) ──
router.post('/tasks/:id/roles', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '仅HR或管理员可配置角色' });
  }
  // [BUG-1 FIX] 兼容两种传参方式: {roles: [...]} 或直接传数组 [...]
  const roles = Array.isArray(req.body) ? req.body : req.body.roles;
  if (!Array.isArray(roles)) return res.json({ code: 400, message: 'roles 必须是数组，支持 {roles:[...]} 或直接传 [...]' });
  // 校验每个角色必须有 name
  for (const r of roles) {
    if (!r.name || !['R', 'A', 'C', 'I'].includes(r.name)) {
      return res.json({ code: 400, message: `无效的角色名: ${r.name}，仅支持 R/A/C/I` });
    }
  }
  db.prepare('UPDATE perf_tasks SET roles_config = ? WHERE id = ?').run(JSON.stringify(roles), req.params.id);
  return res.json({ code: 0, message: '角色配置已保存' });
});

// ── HR发布认领 (published → claiming) ──
router.post('/tasks/:id/start-claiming', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '仅HR或管理员可发布认领' });
  }
  const task = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(req.params.id) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
  if (task.status !== 'published') return res.json({ code: 400, message: '仅“发布”状态可开启认领' });

  // 新流程：无需预先配置RACI，直接发布认领，员工自选角色，HR审批后再配置
  db.prepare("UPDATE perf_tasks SET status = 'claiming' WHERE id = ?").run(task.id);
  // 通知所有用户有新任务可认领
  const allUsers = db.prepare("SELECT id FROM users WHERE status != 'inactive'").all() as any[];
  const allUserIds = allUsers.map((u: any) => u.id);
  createNotification(allUserIds, 'pool_task', '📢 新任务可认领', `「${task.title}」已开放角色认领（R·A·C·I），快来选择角色吧！`, '/company');
  return res.json({ code: 0, message: '任务已发布认领' });
});

// ── 用户认领角色 ──
router.post('/tasks/:id/claim-role', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const { role_name, reason } = req.body;
  if (!role_name) return res.json({ code: 400, message: '请选择要认领的角色' });

  const task = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(taskId) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
  if (task.status !== 'claiming') return res.json({ code: 400, message: '当前状态不可认领' });

  // [BUG-2 FIX] 检查是否已在此任务中认领了任何角色 (pending 或 approved)
  const existingAny = db.prepare("SELECT id, role_name, status FROM pool_role_claims WHERE pool_task_id = ? AND user_id = ? AND status IN ('pending', 'approved')").get(taskId, req.userId) as any;
  if (existingAny) {
    const ROLE_LABELS: Record<string, string> = { R: '执行者', A: '责任验收者', C: '被咨询者', I: '被告知者' };
    return res.json({ code: 400, message: `您已认领了「${ROLE_LABELS[existingAny.role_name] || existingAny.role_name}」角色（${existingAny.status === 'pending' ? '审核中' : '已通过'}），每人仅可认领一个角色` });
  }

  // 检查角色名是否合法
  if (!['R', 'A', 'C', 'I'].includes(role_name)) {
    return res.json({ code: 400, message: `无效的角色：${role_name}，仅支持 R/A/C/I` });
  }

  // 如果已配置RACI，检查容量限制；否则允许自由认领
  let rolesConfig: any[] = [];
  try { rolesConfig = JSON.parse(task.roles_config || '[]'); } catch {}
  const roleConf = rolesConfig.find((r: any) => r.name === role_name);

  if (roleConf) {
    // 检查角色是否已满员（已批准数 >= required）
    const approvedCount = (db.prepare("SELECT COUNT(*) as c FROM pool_role_claims WHERE pool_task_id = ? AND role_name = ? AND status = 'approved'").get(taskId, role_name) as any)?.c || 0;
    if (approvedCount >= (roleConf.required || 1)) {
      return res.json({ code: 400, message: '该角色已满员' });
    }
  }

  const reward = roleConf?.reward || 0;
  db.prepare('INSERT INTO pool_role_claims (pool_task_id, role_name, user_id, reward, reason, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(taskId, role_name, req.userId, reward, reason || '', 'pending');

  // 通知 HR（含申请理由）
  const hrAdmins = db.prepare("SELECT id FROM users WHERE role IN ('hr', 'admin')").all() as any[];
  const hrIds = hrAdmins.map((u: any) => u.id);
  const userName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
  const ROLE_LABELS: Record<string, string> = { R: '执行者', A: '责任验收者', C: '被咨询者', I: '被告知者' };
  const roleLabel = ROLE_LABELS[role_name] || role_name;
  const reasonText = reason ? `，理由: ${reason}` : '';
  if (hrIds.length) {
    createNotification(hrIds, 'role_claim', '📋 角色认领待审批', `${userName} 申请认领「${task.title}」的「${roleLabel}」角色${reasonText}，请前往审批`, '/company');
  }

  return res.json({ code: 0, message: '认领申请已提交，等待人事确认' });
});

// ── HR审批角色认领 ──
router.post('/role-claims/:id/review', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '仅HR或管理员可审批' });
  }

  const { action, comment } = req.body;
  const claim = db.prepare('SELECT * FROM pool_role_claims WHERE id = ?').get(req.params.id) as any;
  if (!claim) return res.status(404).json({ code: 404, message: '认领申请不存在' });
  if (claim.status !== 'pending') return res.json({ code: 400, message: '该申请已处理' });

  if (action === 'approve') {
    // [BUG-3 FIX] 审批前检查该角色已批准人数是否已达上限
    const task = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(claim.pool_task_id) as any;
    let rolesConfig: any[] = [];
    try { rolesConfig = JSON.parse(task?.roles_config || '[]'); } catch {}
    const roleConf = rolesConfig.find((r: any) => r.name === claim.role_name);
    if (roleConf) {
      const approvedCount = (db.prepare("SELECT COUNT(*) as c FROM pool_role_claims WHERE pool_task_id = ? AND role_name = ? AND status = 'approved'").get(claim.pool_task_id, claim.role_name) as any)?.c || 0;
      if (approvedCount >= (roleConf.required || 1)) {
        return res.json({ code: 400, message: `「${claim.role_name}」角色已满员（${approvedCount}/${roleConf.required}），无法继续批准` });
      }
    }

    db.prepare("UPDATE pool_role_claims SET status = 'approved', reviewer_id = ?, review_comment = ?, reviewed_at = datetime('now') WHERE id = ?")
      .run(req.userId, comment || '同意', claim.id);

    // 同时加入参与者表
    db.prepare('INSERT OR IGNORE INTO pool_participants (pool_task_id, user_id) VALUES (?, ?)')
      .run(claim.pool_task_id, claim.user_id);

    // 通知用户（含角色标签）
    const ROLE_LABELS: Record<string, string> = { R: '执行者', A: '责任验收者', C: '被咨询者', I: '被告知者' };
    const roleLabel = ROLE_LABELS[claim.role_name] || claim.role_name;
    createNotification([claim.user_id], 'role_claim', '✅ 角色认领通过', `您在「${task?.title || ''}」中认领的「${roleLabel}」角色已通过审批`, '/company');

    return res.json({ code: 0, message: '已批准角色认领' });
  }

  if (action === 'reject') {
    db.prepare("UPDATE pool_role_claims SET status = 'rejected', reviewer_id = ?, review_comment = ?, reviewed_at = datetime('now') WHERE id = ?")
      .run(req.userId, comment || '不符合条件', claim.id);
    const task = db.prepare('SELECT title FROM perf_tasks WHERE id = ?').get(claim.pool_task_id) as any;
    createNotification([claim.user_id], 'role_claim', '❌ 角色认领被拒', `您在「${task?.title || ''}」中认领的「${claim.role_name}」被拒绝：${comment || '不符合条件'}`, '/company');
    return res.json({ code: 0, message: '已拒绝角色认领' });
  }

  return res.json({ code: 400, message: `未知操作: ${action}` });
});

// ── 获取待审批的角色认领列表 (HR/Admin) ──
router.get('/role-claims', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '仅HR或管理员可查看' });
  }
  const { status: claimStatus } = req.query;
  let sql = `SELECT rc.*, u.name as user_name, pt.title as task_title 
    FROM pool_role_claims rc 
    LEFT JOIN users u ON rc.user_id = u.id 
    LEFT JOIN perf_tasks pt ON rc.pool_task_id = pt.id
    WHERE 1=1`;
  const params: any[] = [];
  if (claimStatus) { sql += ' AND rc.status = ?'; params.push(claimStatus); }
  sql += ' ORDER BY rc.created_at DESC';
  const claims = db.prepare(sql).all(...params);
  return res.json({ code: 0, data: claims });
});

// ── 我的认领 (当前用户) ──
router.get('/my-claims', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const claims = db.prepare(`
    SELECT rc.*, pt.title as task_title, pt.status as task_status, pt.bonus as task_bonus, 
           pt.department as task_department, pt.difficulty as task_difficulty, pt.reward_type as task_reward_type,
           pt.roles_config as task_roles_config
    FROM pool_role_claims rc
    LEFT JOIN perf_tasks pt ON rc.pool_task_id = pt.id
    WHERE rc.user_id = ?
    ORDER BY rc.created_at DESC
  `).all(req.userId) as any[];
  return res.json({ code: 0, data: claims });
});

// ── 奖励分配 (HR/Admin) ──
router.post('/tasks/:id/distribute-rewards', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!user || !['admin', 'hr'].includes(user.role)) {
    return res.status(403).json({ code: 403, message: '仅HR或管理员可分配奖励' });
  }
  const taskId = Number(req.params.id);
  const task = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(taskId) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
  if (!['completed', 'terminated'].includes(task.status)) return res.json({ code: 400, message: '任务尚未完成或已发赏' });

  const { rewards } = req.body; // [{claim_id, reward}] 或空(直接标记已发赏)
  if (Array.isArray(rewards)) {
    rewards.forEach((r: any) => {
      db.prepare('UPDATE pool_role_claims SET reward = ? WHERE id = ? AND pool_task_id = ?').run(r.reward, r.claim_id, taskId);
    });
  }

  db.prepare("UPDATE perf_tasks SET status = 'rewarded' WHERE id = ?").run(taskId);

  // 通知所有参与者已发赏
  const allClaimed = db.prepare("SELECT DISTINCT user_id FROM pool_role_claims WHERE pool_task_id = ? AND status = 'approved'").all(taskId) as any[];
  const allUserIds = allClaimed.map((u: any) => u.user_id);
  if (allUserIds.length > 0) {
    createNotification(allUserIds, 'pool_task', '🏆 奖励已发放', `「${task.title}」项目奖励已发放，请查收！`, '/company');
  }

  return res.json({ code: 0, message: '奖励已分配，任务状态已更新为"已发赏"' });
});

// ── 责任验收者(A) 启动项目 (claiming → in_progress) ──
router.post('/tasks/:id/start-project', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const task = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(taskId) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
  if (task.status !== 'claiming') return res.json({ code: 400, message: '仅认领中的任务可启动' });

  // 验证：当前用户必须是该任务的 A 角色且已通过审批
  const isA = db.prepare("SELECT id FROM pool_role_claims WHERE pool_task_id = ? AND user_id = ? AND role_name = 'A' AND status = 'approved'").get(taskId, req.userId) as any;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!isA && (!user || (!['admin', 'hr'].includes(user.role) && !isGM(req.userId) && !isSuperAdmin(req.userId)))) {
    return res.status(403).json({ code: 403, message: '仅责任验收者(A)或HR可启动项目' });
  }

  // [FIX] HR 通过面板直接选人时 (r/a/c/i 字段传入)，
  // 将这些用户直接 upsert 为 approved 的 role_claims，
  // 避免"员工未主动申请 → 数据库无记录 → 校验报缺角色"的假警报
  const roleFieldMap: Record<string, string> = { r: 'R', a: 'A', c: 'C', i: 'I' };
  // 收集HR最终定岗：userId → 最终角色名
  const finalRoleAssignments = new Map<string, string>();
  for (const [field, roleName] of Object.entries(roleFieldMap)) {
    const idStr: string = req.body[field] || '';
    const ids = idStr.split(',').filter(Boolean);
    for (const userId of ids) {
      finalRoleAssignments.set(`${userId}:${roleName}`, roleName);
      // 先检查是否已有记录
      const existing = db.prepare(
        'SELECT id, status FROM pool_role_claims WHERE pool_task_id = ? AND user_id = ? AND role_name = ?'
      ).get(taskId, userId, roleName) as any;
      if (existing) {
        if (existing.status !== 'approved') {
          db.prepare("UPDATE pool_role_claims SET status = 'approved' WHERE id = ?").run(existing.id);
        }
      } else {
        db.prepare(
          "INSERT INTO pool_role_claims (pool_task_id, user_id, role_name, status, reason) VALUES (?, ?, ?, 'approved', 'HR直接分配')"
        ).run(taskId, userId, roleName);
      }
    }
  }
  // 撤销被HR重新定岗的用户的旧角色申请（例如：申请了A但最终定岗为R，则撤销A）
  const assignedUserIds = new Set<string>();
  for (const key of finalRoleAssignments.keys()) {
    assignedUserIds.add(key.split(':')[0]);
  }
  for (const userId of assignedUserIds) {
    const userFinalRoles = new Set<string>();
    for (const [key, role] of finalRoleAssignments) {
      if (key.startsWith(`${userId}:`)) userFinalRoles.add(role);
    }
    // 将该用户在此任务上、不在最终定岗角色中的其他 approved 认领改为 rejected
    const otherClaims = db.prepare(
      "SELECT id, role_name FROM pool_role_claims WHERE pool_task_id = ? AND user_id = ? AND status = 'approved'"
    ).all(taskId, userId) as any[];
    for (const claim of otherClaims) {
      if (!userFinalRoles.has(claim.role_name)) {
        db.prepare("UPDATE pool_role_claims SET status = 'rejected', reason = 'HR重新定岗' WHERE id = ?").run(claim.id);
      }
    }
  }

  // Also ensure roles_config users have pool_role_claims entries
  // (handles case where A/R was set in roles_config but not passed in req.body)
  let rolesConfig: any[] = [];
  try {
    const parsed = JSON.parse(task.roles_config || '[]');
    rolesConfig = Array.isArray(parsed) ? parsed : [];
  } catch {}
  for (const rc of rolesConfig) {
    if (['R', 'A', 'C', 'I'].includes(rc.name) && Array.isArray(rc.users)) {
      for (const u of rc.users) {
        const uid = String(u.id);
        const existing = db.prepare(
          'SELECT id, status FROM pool_role_claims WHERE pool_task_id = ? AND user_id = ? AND role_name = ?'
        ).get(taskId, uid, rc.name) as any;
        if (!existing) {
          db.prepare(
            "INSERT INTO pool_role_claims (pool_task_id, user_id, role_name, status, reason) VALUES (?, ?, ?, 'approved', '从角色配置同步')"
          ).run(taskId, uid, rc.name);
        } else if (existing.status !== 'approved') {
          db.prepare("UPDATE pool_role_claims SET status = 'approved' WHERE id = ?").run(existing.id);
        }
      }
    }
  }

  const missingRoles: string[] = [];
  const ROLE_LABELS: Record<string, string> = { R: '执行者', A: '责任验收者', C: '被咨询者', I: '被告知者' };

  if (rolesConfig.length > 0) {
    for (const rc of rolesConfig) {
      if (['R', 'A'].includes(rc.name)) {
        const approvedCount = (db.prepare("SELECT COUNT(*) as c FROM pool_role_claims WHERE pool_task_id = ? AND role_name = ? AND status = 'approved'").get(taskId, rc.name) as any)?.c || 0;
        if (approvedCount < (rc.required || 1)) {
          missingRoles.push(`${ROLE_LABELS[rc.name] || rc.name}(需${rc.required || 1}人, 已${approvedCount}人)`);
        }
      }
    }
  } else {
    // 流程4: 无 rolesConfig 时兜底硬校验
    const hasApprovedA = (db.prepare("SELECT COUNT(*) as c FROM pool_role_claims WHERE pool_task_id = ? AND role_name = 'A' AND status = 'approved'").get(taskId) as any)?.c || 0;
    const hasApprovedR = (db.prepare("SELECT COUNT(*) as c FROM pool_role_claims WHERE pool_task_id = ? AND role_name = 'R' AND status = 'approved'").get(taskId) as any)?.c || 0;
    if (hasApprovedA === 0) missingRoles.push('责任验收者(A) 未到位');
    if (hasApprovedR === 0) missingRoles.push('执行者(R) 未到位');
  }
  if (missingRoles.length > 0) {
    return res.json({ code: 400, message: `以下必填角色未满员: ${missingRoles.join('、')}` });
  }

  // 方案A: 保存 HR 在面板修改的 SMART/PDCA/description/title/category 数据
  {
    const { s, m, a_smart, r_smart, t, planTime, doTime, checkTime, actTime, summary, taskType, bonus: newBonus, rewardType, maxParticipants, attachments } = req.body;
    let updateSql = "UPDATE perf_tasks SET status = 'in_progress'";
    const updateParams: any[] = [];

    if (s) {
      let cleanS = s, cleanM = m || '', cleanA_smart = a_smart || '', cleanR_smart = r_smart || '', cleanT = t || '';
      if (String(s).includes('【目标 S】')) {
        const parsed = parseSmartFromDescription(s);
        cleanS = parsed.s || s;
        cleanM = parsed.m || cleanM;
        cleanA_smart = parsed.a || cleanA_smart;
        cleanR_smart = parsed.r || cleanR_smart;
        cleanT = parsed.t || cleanT;
      }
      const effectivePlanTime = planTime || task.plan_time || '';
      const effectiveDoTime = doTime || task.do_time || '';
      const effectiveCheckTime = checkTime || task.check_time || '';
      const effectiveActTime = actTime || task.act_time || '';
      const pdca = [
        effectivePlanTime ? `Plan: ${effectivePlanTime}` : '',
        effectiveDoTime ? `Do: ${effectiveDoTime}` : '',
        effectiveCheckTime ? `Check: ${effectiveCheckTime}` : '',
        effectiveActTime ? `Act: ${effectiveActTime}` : '',
      ].filter(Boolean).join(' | ') || 'Plan:  | Do:  | Check:  | Act: ';
      const newDesc = `【目标 S】\n${cleanS}\n【指标 M】\n${cleanM}\n【方案 A】\n${cleanA_smart}\n【相关 R】\n${cleanR_smart}\n【时限 T】\n${cleanT}\n【PDCA】\n${pdca}`;
      updateSql += ', title = ?, description = ?, smart_s = ?, smart_m = ?, smart_a = ?, smart_r = ?, smart_t = ?, plan_time = ?, do_time = ?, check_time = ?, act_time = ?';
      updateParams.push(summary || task.title, newDesc, cleanS, cleanM, cleanA_smart, cleanR_smart, cleanT, effectivePlanTime, effectiveDoTime, effectiveCheckTime, effectiveActTime);
    }
    if (taskType) { updateSql += ', category = ?'; updateParams.push(taskType); }
    if (newBonus !== undefined) { updateSql += ', bonus = ?'; updateParams.push(Number(newBonus) || task.bonus); }
    if (rewardType) { updateSql += ', reward_type = ?'; updateParams.push(rewardType); }
    if (maxParticipants != null) { updateSql += ', max_participants = ?'; updateParams.push(Number(maxParticipants) || task.max_participants); }

    // 保存 roles_config (RACI 配置)
    const buildRole = (name: string, idsStr: string | undefined) => {
      if (!idsStr) return { name, max: 0, users: [] };
      const ids = idsStr.split(',').filter(Boolean);
      if (ids.length === 0) return { name, max: 0, users: [] };
      const placeholders = ids.map(() => '?').join(',');
      const users = db.prepare(`SELECT id, name, avatar_url, department_id, status, role FROM users WHERE id IN (${placeholders})`).all(...ids).map((u: any) => ({
        id: u.id, name: u.name, avatar: u.avatar_url, department: u.department_id, type: u.role, status: u.status
      }));
      return { name, max: name === 'A' ? 1 : 0, users };
    };
    if (req.body.r || req.body.a || req.body.c || req.body.i) {
      const newRolesConfig = [
        buildRole('R', req.body.r),
        buildRole('A', req.body.a),
        buildRole('C', req.body.c),
        buildRole('I', req.body.i),
        buildRole('交付对象', req.body.dt)
      ];
      updateSql += ', roles_config = ?';
      updateParams.push(JSON.stringify(newRolesConfig));
    }

    if (attachments !== undefined) {
      updateSql += ', attachments = ?';
      updateParams.push(typeof attachments === 'string' ? attachments : JSON.stringify(attachments));
    }

    updateSql += ', updated_at = ? WHERE id = ?';
    updateParams.push(new Date().toISOString(), taskId);
    db.prepare(updateSql).run(...updateParams);
  }

  // 通知所有已认领的参与者
  const allClaimed = db.prepare("SELECT DISTINCT user_id FROM pool_role_claims WHERE pool_task_id = ? AND status = 'approved'").all(taskId) as any[];
  const allUserIds = allClaimed.map((u: any) => u.user_id);
  if (allUserIds.length) {
    createNotification(allUserIds, 'pool_task', '🚀 项目启动', `「${task.title}」项目已正式开始！`, '/company');
  }

  return res.json({ code: 0, message: '项目已启动' });
});

// ─── 赏金榜任务进度更新 ────────────────────────────
router.put('/tasks/:id/progress', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const taskId = Number(req.params.id);
  const { progress } = req.body;
  const task = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(taskId) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });

  // 仅 R 或 A 角色可更新进度
  const isApproved = db.prepare("SELECT id FROM pool_role_claims WHERE pool_task_id = ? AND user_id = ? AND role_name IN ('R', 'A') AND status = 'approved'").get(taskId, req.userId) as any;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!isApproved && (!user || (!['admin', 'hr'].includes(user.role) && !isGM(req.userId) && !isSuperAdmin(req.userId)))) {
    return res.status(403).json({ code: 403, message: '仅执行人(R)或负责人(A)可更新进度' });
  }

  db.prepare('UPDATE perf_tasks SET progress = ?, updated_at = ? WHERE id = ?').run(progress, new Date().toISOString(), taskId);
  return res.json({ code: 0, message: '进度已更新' });
});

export default router;

// ─── PDCA 延期申请（A 角色，无需审批）────────────────────────────
router.post('/tasks/:id/extend', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const taskId = parseInt(req.params.id);
  const userId = req.userId!;

  const claim = db.prepare(
    `SELECT * FROM pool_role_claims WHERE pool_task_id = ? AND user_id = ? AND role_name = 'A'`
  ).get(taskId, userId);
  if (!claim) return res.status(403).json({ code: 403, message: '仅 A 角色可发起延期申请' });

  const task = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(taskId) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
  if (!['open', 'in_progress'].includes(task.status)) {
    return res.status(400).json({ code: 400, message: '任务当前状态不支持延期' });
  }

  const { new_deadline, reason, impact_analysis } = req.body;
  if (!new_deadline || !reason) {
    return res.status(400).json({ code: 400, message: '新截止日期和延期原因为必填项' });
  }

  const desc = task.description || '';
  const originalDeadline = task.deadline || desc.match(/Act:\s*([^\s|]+)/)?.[1] || '未设置';

  db.prepare(`
    INSERT INTO pool_task_extensions (pool_task_id, initiator_id, original_deadline, new_deadline, reason, impact_analysis)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(taskId, userId, originalDeadline, new_deadline, reason, impact_analysis || null);

  if (desc.includes('Act:')) {
    const newDesc = desc.replace(/Act:\s*[^\s|]+/, 'Act: ' + new_deadline);
    db.prepare(`UPDATE perf_tasks SET description = ?, act_time = ?, updated_at = ? WHERE id = ?`)
      .run(newDesc, new_deadline, new Date().toISOString(), taskId);
  }

  const operator = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any;
  const ciMembers = db.prepare(
    `SELECT prc.user_id FROM pool_role_claims prc WHERE prc.pool_task_id = ? AND prc.role_name IN ('C', 'I')`
  ).all(taskId) as any[];
  const hrs = db.prepare(`SELECT id FROM users WHERE role IN ('hr', 'admin')`).all() as any[];
  const notifyIds = [...hrs.map((u: any) => u.id), ...ciMembers.map((u: any) => u.user_id)];

  try {
    const { sendMarkdownMessage } = await import('../services/message');
    await sendMarkdownMessage(
      [...new Set(notifyIds)] as string[],
      `**延期通知**\n\n> 任务：${task.title}\n> 负责人：${operator?.name}\n> 原截止：${originalDeadline}\n> 新截止：${new_deadline}\n> 原因：${reason}`
    );
  } catch {}

  return res.json({ code: 0, message: `延期申请已生效，新截止日期：${new_deadline}` });
});

// ─── 提前完结（A 角色，无需审批，直接进入 STAR 阶段）──────────────
router.post('/tasks/:id/terminate', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const taskId = parseInt(req.params.id);
  const userId = req.userId!;

  const claim = db.prepare(
    `SELECT * FROM pool_role_claims WHERE pool_task_id = ? AND user_id = ? AND role_name = 'A'`
  ).get(taskId, userId);
  if (!claim) return res.status(403).json({ code: 403, message: '仅 A 角色可发起提前完结' });

  const task = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(taskId) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
  if (!['open', 'in_progress'].includes(task.status)) {
    return res.status(400).json({ code: 400, message: '任务当前状态不支持提前完结' });
  }

  const { reason, actual_completion, delivered_content } = req.body;
  if (!reason || actual_completion === undefined || !delivered_content) {
    return res.status(400).json({ code: 400, message: '完结原因、实际完成度、已交付成果均为必填项' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE perf_tasks
    SET status = 'terminated', actual_end_reason = ?, actual_completion = ?,
        terminated_by = ?, terminated_at = ?, star_phase_started_at = ?, updated_at = ?
    WHERE id = ?
  `).run(reason, actual_completion, userId, now, now, now, taskId);

  const raMembers = db.prepare(
    `SELECT prc.user_id FROM pool_role_claims prc WHERE prc.pool_task_id = ? AND prc.role_name IN ('R', 'A')`
  ).all(taskId) as any[];
  const hrs = db.prepare(`SELECT id FROM users WHERE role IN ('hr', 'admin')`).all() as any[];
  const operator = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any;

  try {
    const { sendMarkdownMessage } = await import('../services/message');
    await sendMarkdownMessage(
      raMembers.map((m: any) => m.user_id),
      `**任务提前完结 — 请填写 STAR 报告**\n\n> 任务：${task.title}\n> 负责人：${operator?.name}\n> 实际完成度：${actual_completion}%\n> 完结原因：${reason}\n\n请尽快填写 STAR 绩效报告，这是获得任务奖励的必要条件！`
    );
    await sendMarkdownMessage(
      hrs.map((u: any) => u.id),
      `**任务提前完结通知**\n\n> 任务：${task.title}\n> 负责人：${operator?.name}\n> 实际完成度：${actual_completion}%\n> 已交付：${delivered_content}\n> 原因：${reason}\n\n任务已进入 STAR 汇报阶段。`
    );
  } catch {}

  return res.json({ code: 0, message: '任务已提前完结，已通知所有成员填写 STAR' });
});

// ─── 任务进度更新（含 100% 自动触发 STAR 阶段）──────────────────
router.post('/tasks/:id/complete', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const taskId = parseInt(req.params.id);

  const task = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(taskId) as any;
  if (!task) return res.status(404).json({ code: 404, message: '任务不存在' });
  
  const { delivered_content } = req.body;
  
  // 验证：必须是认领了并且通过的 R角色或 A角色 才能触发满分完结
  const isRA = db.prepare("SELECT id FROM pool_role_claims WHERE pool_task_id = ? AND user_id = ? AND role_name IN ('R', 'A') AND status IN ('approved', 'star_submitted')").get(taskId, req.userId);
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  const isAdminOrHr = user && ['admin', 'hr'].includes(user.role);
  if (!isRA && !isAdminOrHr) {
    return res.status(403).json({ code: 403, message: '仅任务执行人(R)或负责人(A)可执行满分完结' });
  }

  const now = new Date().toISOString();
  db.prepare(`UPDATE perf_tasks SET status = 'completed', progress = 100, star_phase_started_at = ?, updated_at = ? WHERE id = ?`)
    .run(now, now, taskId);

  const raMembers = db.prepare(
    `SELECT prc.user_id FROM pool_role_claims prc WHERE prc.pool_task_id = ? AND prc.role_name IN ('R', 'A') AND prc.status IN ('approved', 'star_submitted')`
  ).all(taskId) as any[];

  try {
    const { sendMarkdownMessage } = await import('../services/message');
    const operator = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
    await sendMarkdownMessage(
      raMembers.map((m: any) => m.user_id),
      `**任务已满分完结 — 请填写 STAR 报告**\n\n> 任务：${task.title}\n> 进度：100%\n> 操作人：${operator?.name || '未知'}\n> 交付说明：${delivered_content || '未提供具体说明'}\n\n恭喜！任务圆满完成！请所有成员尽快填写 STAR 绩效报告以领取奖励！`
    );
  } catch {}

  return res.json({ code: 0, message: '任务已完结，已进入 STAR 汇报阶段' });
});
