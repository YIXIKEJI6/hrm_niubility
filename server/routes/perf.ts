import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest, isSuperAdmin, isGM } from '../middleware/auth';
import { transitionPlan, getAssessmentJudge } from '../services/workflow';
import { notifyPerfStatusChange } from '../services/message';
import { getUserEffectivePerms } from './permissions';
import { logAudit } from '../services/audit-logger';
import { parseSmartFromDescription } from '../utils/smartParser';

const router = Router();

// 创建绩效计划
router.post('/plans', authMiddleware, async (req: AuthRequest, res) => {
  const { title, description, category, assignee_id, approver_id, department_id, difficulty, deadline, quarter, alignment, target_value, collaborators, attachments, informed_parties, delivery_target, max_participants, reward_type, bonus, flow_type, smart_s, smart_m, smart_a, smart_r, smart_t, plan_time, do_time, check_time, act_time } = req.body;
  const db = getDb();


  const attachmentsStr = attachments ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : '[]';

  // 流程说明：
  // - 个人目标（R=自己）：创建者就是执行人，审批人由 approver_id 指定（直属上级）
  // - 团队任务（R=别人）：assignee_id 存执行者，approver_id 存负责人
  // 共同规则：approver_id 必须由前端明确传入，后端不做隐式替换，避免 A=R 的错误
  const finalAssigneeId = assignee_id || req.userId;
  // approver_id = A角色（负责人），RACI不可变
  // application（员工申请）：A=创建者本人，部门负责人存dept_head_id
  // dispatch（主管下发）：A=创建者（主管），前端传入的approver_id优先
  let finalApproverId = approver_id || '';
  let finalDeptHeadId: string | null = null;
  if (!finalApproverId) {
    if (flow_type === 'application') {
      // 申请任务：A角色=创建者本人，部门负责人作为审批人存dept_head_id
      finalApproverId = req.userId;
      try {
        const u = db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.userId) as any;
        if (u?.department_id) {
          const dept = db.prepare('SELECT leader_user_id FROM departments WHERE id = ?').get(u.department_id) as any;
          if (dept?.leader_user_id && dept.leader_user_id !== req.userId) {
            finalDeptHeadId = dept.leader_user_id;
          }
        }
      } catch {}
    } else {
      // 下发任务：查组织架构找直属上级作为A角色；兜底为创建者本人
      try {
        const u = db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.userId) as any;
        if (u?.department_id) {
          const dept = db.prepare('SELECT leader_user_id FROM departments WHERE id = ?').get(u.department_id) as any;
          if (dept?.leader_user_id && dept.leader_user_id !== req.userId) {
            finalApproverId = dept.leader_user_id;
          }
        }
      } catch {}
      if (!finalApproverId) finalApproverId = req.userId;
    }
  }

  // 解析 SMART/PDCA：优先使用请求体中的独立字段，fallback 到 description 解析
  const smartFields = parseSmartFromDescription(description || '');
  const finalSmartS = smart_s || smartFields.s || null;
  const finalSmartM = smart_m || smartFields.m || null;
  const finalSmartA = smart_a || smartFields.a || null;
  const finalSmartR = smart_r || smartFields.r || null;
  const finalSmartT = smart_t || smartFields.t || null;
  const finalPlanTime = plan_time || smartFields.planTime || null;
  const finalDoTime = do_time || smartFields.doTime || null;
  const finalCheckTime = check_time || smartFields.checkTime || null;
  const finalActTime = act_time || smartFields.actTime || null;

  // task_type: 'applied' if flow_type is 'application', otherwise 'assigned'
  const taskType = flow_type === 'application' ? 'applied' : 'assigned';
  const result = db.prepare(
    `INSERT INTO perf_tasks (task_type, title, description, category, creator_id, assignee_id, approver_id, dept_head_id, department_id, difficulty, deadline, quarter, alignment, target_value, collaborators, attachments, informed_parties, delivery_target, max_participants, reward_type, bonus, smart_s, smart_m, smart_t, smart_a, smart_r, plan_time, do_time, check_time, act_time, flow_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(taskType, title, description, category, req.userId, finalAssigneeId, finalApproverId, finalDeptHeadId, department_id, difficulty, deadline, quarter, alignment, target_value, collaborators || null, attachmentsStr, informed_parties || null, delivery_target || null, max_participants ?? 5, reward_type || 'money', bonus || 0, finalSmartS, finalSmartM, finalSmartT, finalSmartA, finalSmartR, finalPlanTime, finalDoTime, finalCheckTime, finalActTime, flow_type || null);


  // 流程异常检测：创建时缺少审批人则通知HR
  const issues: string[] = [];
  if (!approver_id) issues.push('缺少审批人(直属上级)');
  const creatorDeptId = department_id || (db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.userId) as any)?.department_id;
  if (creatorDeptId) {
    const dept = db.prepare('SELECT leader_user_id FROM departments WHERE id = ?').get(creatorDeptId) as any;
    if (!dept?.leader_user_id) issues.push('所属部门无负责人');
  }
  if (issues.length > 0) {
    const { WorkflowEngine } = await import('../services/workflow-engine');
    const { createNotification } = await import('./notifications');
    const adminIds = WorkflowEngine.getUsersByRoleTag('hrbp').concat(WorkflowEngine.getUsersByRoleTag('gm'));
    const uniqueIds = Array.from(new Set(adminIds));
    const creatorName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
    if (uniqueIds.length > 0) {
      createNotification(uniqueIds, 'workflow_error', '⚠️ 流程节点异常', `${creatorName} 创建的绩效计划「${title}」${issues.join('、')}，请前往流程异常管理修复`, '/admin');
    }
  }

  return res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

// 查询绩效列表
router.get('/plans', authMiddleware, (req: AuthRequest, res) => {
  const { status, quarter, category, userId } = req.query;
  const db = getDb();
  let sql = `
    SELECT p.*,
      uc.name AS creator_name,
      ua.name AS approver_name,
      us.name AS assignee_name
    FROM perf_tasks p
    LEFT JOIN users uc ON uc.id = p.creator_id
    LEFT JOIN users ua ON ua.id = p.approver_id
    LEFT JOIN users us ON us.id = p.assignee_id
    WHERE p.task_type IN ('assigned', 'applied') AND p.deleted_at IS NULL
  `;
  const params: any[] = [];

  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  if (quarter) { sql += ' AND p.quarter = ?'; params.push(quarter); }
  if (category) { sql += ' AND p.category = ?'; params.push(category); }
  if (userId) {
    // Match creator OR assignee (supports comma-separated multi-assignee)
    sql += " AND (p.creator_id = ? OR p.assignee_id = ? OR (',' || p.assignee_id || ',') LIKE ('%,' || ? || ',%') OR p.approver_id = ?)";
    params.push(userId, userId, userId, userId);
  }

  sql += ' ORDER BY p.created_at DESC';
  const plans = db.prepare(sql).all(...params) as any[];

  // 混入「待我考评」的任务：judge_id 是动态计算的，无法通过 SQL 直接过滤
  if (userId) {
    const pendingAssessmentTasks = db.prepare(`
      SELECT p.*, uc.name AS creator_name, ua.name AS approver_name, us.name AS assignee_name
      FROM perf_tasks p
      LEFT JOIN users uc ON uc.id = p.creator_id
      LEFT JOIN users ua ON ua.id = p.approver_id
      LEFT JOIN users us ON us.id = p.assignee_id
      WHERE p.task_type IN ('assigned', 'applied') AND p.deleted_at IS NULL
        AND p.status = 'pending_assessment'
    `).all() as any[];

    for (const task of pendingAssessmentTasks) {
      if (plans.some((p: any) => p.id === task.id)) continue;
      try {
        let judgeId: string | null = null;
        if (task.flow_type === 'application') {
          judgeId = getAssessmentJudge(task.creator_id).judgeId;
        } else {
          judgeId = task.creator_id;
        }
        if (judgeId && String(judgeId) === String(userId)) {
          plans.push(task);
        }
      } catch {}
    }
  }

  // 混入用户认领的赏金榜任务（现在直接从 perf_tasks 查询，无需虚拟注入）
  if (!status && userId && (!category || category === '专项任务')) {
    const claimedBountyTasks = db.prepare(`
      SELECT p.*, uc.name AS creator_name, GROUP_CONCAT(rc.role_name) as my_roles
      FROM perf_tasks p
      JOIN pool_role_claims rc ON rc.pool_task_id = p.id
      LEFT JOIN users uc ON uc.id = p.creator_id
      WHERE p.task_type IN ('proposal', 'bounty')
        AND rc.user_id = ? AND rc.status IN ('approved', 'star_submitted')
        AND p.status != 'draft' AND p.status != 'rejected'
        AND p.deleted_at IS NULL
      GROUP BY p.id
    `).all(userId) as any[];

    for (const bt of claimedBountyTasks) {
      // 避免重复（已在 plans 中的跳过）
      if (plans.some((p: any) => p.id === bt.id)) continue;
      // 附加 role_claims
      const roleClaims = db.prepare(`
        SELECT rc.*, u.name as user_name FROM pool_role_claims rc
        LEFT JOIN users u ON u.id = rc.user_id
        WHERE rc.pool_task_id = ? AND rc.status IN ('approved', 'star_submitted')
      `).all(bt.id) as any[];
      let rolesConfig: any[] = [];
      try { rolesConfig = JSON.parse(bt.roles_config || '[]'); } catch {}
      plans.push({
        ...bt,
        is_pool: true,
        pool_task_id: bt.id,
        flow_type: 'pool',
        role_claims: roleClaims,
        roles_config: rolesConfig,
        target_value: bt.target_value || `赏金榜角色：${bt.my_roles}`,
      });
    }
    if (claimedBountyTasks.length > 0) {
      plans.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }

  // 为 pending_assessment 任务附加 judge_id
  for (const p of plans) {
    if (['in_progress', 'pending_assessment'].includes(p.status) && !['proposal', 'bounty'].includes(p.task_type)) {
      try {
        if (p.flow_type === 'application') {
          const { judgeId } = getAssessmentJudge(p.creator_id);
          if (judgeId) { p.judge_id = judgeId; p.judge_name = (db.prepare('SELECT name FROM users WHERE id = ?').get(judgeId) as any)?.name; }
        } else {
          p.judge_id = p.creator_id;
          p.judge_name = (db.prepare('SELECT name FROM users WHERE id = ?').get(p.creator_id) as any)?.name;
        }
      } catch {}
    }
  }

  return res.json({ code: 0, data: plans });
});

// 绩效计划详情
router.get('/plans/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const paramId = req.params.id;

  // 兼容旧前端 pool_ 前缀 ID：通过 claim_id 找到真实 task
  if (String(paramId).startsWith('pool_')) {
    const claimId = String(paramId).replace('pool_', '');
    const claim = db.prepare(`SELECT pool_task_id FROM pool_role_claims WHERE id = ?`).get(claimId) as any;
    if (!claim) return res.status(404).json({ code: 404, message: '赏金榜任务不存在' });
    // 重定向到真实 task ID 的详情
    req.params.id = String(claim.pool_task_id);
  }

  const plan = db.prepare(`
    SELECT p.*,
      uc.name AS creator_name,
      ua.name AS approver_name,
      us.name AS assignee_name
    FROM perf_tasks p
    LEFT JOIN users uc ON uc.id = p.creator_id
    LEFT JOIN users ua ON ua.id = p.approver_id
    LEFT JOIN users us ON us.id = p.assignee_id
    WHERE p.id = ?
  `).get(paramId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '绩效计划不存在' });

  // 赏金榜/提案任务：附加 role_claims 和 participants
  if (plan.task_type === 'bounty' || plan.task_type === 'proposal') {
    plan.is_pool = true;
    plan.pool_task_id = plan.id;
    const roleClaims = db.prepare(`
      SELECT rc.*, u.name as user_name FROM pool_role_claims rc
      LEFT JOIN users u ON u.id = rc.user_id
      WHERE rc.pool_task_id = ? ORDER BY rc.created_at
    `).all(plan.id) as any[];
    plan.role_claims = roleClaims;
    try { plan.roles_config = JSON.parse(plan.roles_config || '[]'); } catch { plan.roles_config = []; }
    const participants = db.prepare(
      'SELECT pp.user_id, u2.name as user_name FROM pool_participants pp LEFT JOIN users u2 ON pp.user_id = u2.id WHERE pp.pool_task_id = ?'
    ).all(plan.id) as any[];
    plan.participants = participants;
    plan.current_participants = participants.length;
  }

  // 评分人: Flow1=创建者, Flow2=上级主管
  if (['in_progress', 'pending_assessment'].includes(plan.status)) {
    try {
      if (plan.flow_type === 'application') {
        // getAssessmentJudge 已从顶部 import
        const { judgeId, reason } = getAssessmentJudge(plan.creator_id);
        if (judgeId) {
          const judge = db.prepare('SELECT name FROM users WHERE id = ?').get(judgeId) as any;
          plan.judge_id = judgeId;
          plan.judge_name = judge?.name || judgeId;
          plan.judge_reason = reason;
        }
      } else if (plan.creator_id) {
        const judge = db.prepare('SELECT name FROM users WHERE id = ?').get(plan.creator_id) as any;
        plan.judge_id = plan.creator_id;
        plan.judge_name = judge?.name || plan.creator_id;
        plan.judge_reason = '评分人: 任务创建者';
      }
    } catch { /* ignore */ }
  }

  return res.json({ code: 0, data: plan });
});

// 编辑绩效计划 (草稿 or 被驳回均可编辑)
router.put('/plans/:id', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, category, difficulty, deadline, quarter, alignment, target_value, collaborators, attachments, informed_parties, delivery_target, max_participants, reward_type, bonus, smart_s, smart_m, smart_a, smart_r, smart_t, plan_time, do_time, check_time, act_time } = req.body;
  const db = getDb();

  const attachmentsStr = attachments !== undefined ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : undefined;
  // SMART/PDCA: 优先使用请求体独立字段，fallback 到 description 解析
  const sf = parseSmartFromDescription(description || '');
  const updates = ['title=?', 'description=?', 'category=?', 'difficulty=?', 'deadline=?', 'quarter=?', 'alignment=?', 'target_value=?', 'collaborators=?', 'informed_parties=?', 'delivery_target=?', 'max_participants=?', 'reward_type=?', 'bonus=?', 'smart_s=?', 'smart_m=?', 'smart_t=?', 'smart_a=?', 'smart_r=?', 'plan_time=?', 'do_time=?', 'check_time=?', 'act_time=?', 'updated_at=?'];
  const params: any[] = [title, description, category, difficulty, deadline, quarter, alignment, target_value, collaborators || null, informed_parties || null, delivery_target || null, max_participants ?? 5, reward_type || 'money', bonus || 0, smart_s || sf.s || null, smart_m || sf.m || null, smart_t || sf.t || null, smart_a || sf.a || null, smart_r || sf.r || null, plan_time || sf.planTime || null, do_time || sf.doTime || null, check_time || sf.checkTime || null, act_time || sf.actTime || null, new Date().toISOString()];

  if (attachmentsStr !== undefined) {
    updates.push('attachments=?');
    params.push(attachmentsStr);
  }
  params.push(req.params.id);

  db.prepare(`UPDATE perf_tasks SET ${updates.join(', ')} WHERE id = ? AND status IN ('draft', 'rejected')`).run(...params);

  return res.json({ code: 0, message: '更新成功' });
});

// 驳回后重新提交 (rejected -> draft -> pending_review)
router.post('/plans/:id/resubmit', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.creator_id !== req.userId) return res.status(403).json({ code: 403, message: '仅创建者可重新提交' });
  if (plan.status !== 'rejected' && plan.status !== 'returned') return res.status(400).json({ code: 400, message: '只有被驳回或退回的计划可以重新提交' });

  // 更新字段
  const { title, description, category, target_value, deadline, collaborators, attachments, informed_parties, delivery_target, max_participants, reward_type, bonus, smart_s, smart_m, smart_a, smart_r, smart_t, plan_time, do_time, check_time, act_time } = req.body;
  if (title) {
    const attachmentsStr = attachments !== undefined ? (typeof attachments === 'string' ? attachments : JSON.stringify(attachments)) : undefined;
    // SMART/PDCA: 优先使用请求体独立字段，fallback 到 description 解析
    const sf = parseSmartFromDescription(description || '');
    let sql = `UPDATE perf_tasks SET title=?, description=?, category=?, target_value=?, deadline=?, collaborators=?, informed_parties=?, delivery_target=?, max_participants=?, reward_type=?, bonus=?, smart_s=?, smart_m=?, smart_t=?, smart_a=?, smart_r=?, plan_time=?, do_time=?, check_time=?, act_time=?, reject_reason=NULL, updated_at=?`;
    const params: any[] = [title, description, category, target_value, deadline, collaborators || null, informed_parties || null, delivery_target || null, max_participants ?? 5, reward_type || 'money', bonus || 0, smart_s || sf.s || null, smart_m || sf.m || null, smart_t || sf.t || null, smart_a || sf.a || null, smart_r || sf.r || null, plan_time || sf.planTime || null, do_time || sf.doTime || null, check_time || sf.checkTime || null, act_time || sf.actTime || null, new Date().toISOString()];
    if (attachmentsStr !== undefined) {
      sql += ', attachments=?';
      params.push(attachmentsStr);
    }
    sql += ' WHERE id = ?';
    params.push(req.params.id);
    db.prepare(sql).run(...params);
  } else {
    db.prepare(`UPDATE perf_tasks SET reject_reason=NULL, updated_at=? WHERE id = ?`).run(new Date().toISOString(), req.params.id);
  }

  // 利用引擎重算审批链
  const { WorkflowEngine, WORKFLOWS } = await import('../services/workflow-engine');
  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PERF_PLAN, { initiatorId: plan.creator_id, deptId: plan.department_id });
  const node2 = nodes.find(n => n.seq === 2);
  const node3 = nodes.find(n => n.seq === 3);
  let nextStatus = 'pending_review';
  let firstApproverId = node2?.assignees?.[0] || null;

  // Fix #3/#9: 清除旧的审批人和驳回原因，防止残留脏数据
  // 注意：不清除 approver_id（负责人A不可变），只清除 dept_head_id（审批人）
  db.prepare('UPDATE perf_tasks SET dept_head_id = NULL, reject_reason = NULL WHERE id = ?').run(plan.id);

  if (node2?.isSkipped || !firstApproverId) {
    nextStatus = 'pending_dept_review';
    let secondApproverId = node3?.assignees?.[0] || null;
    if (node3?.isSkipped || !secondApproverId) {
      // 所有审批人缺失，拒绝自动通过
      return res.status(400).json({ code: 400, message: '审批流程异常：未找到任何有效审批人，请联系 HR 配置组织架构' });
    } else {
      db.prepare('UPDATE perf_tasks SET dept_head_id = ? WHERE id = ?').run(secondApproverId, plan.id);
    }
  } else {
    // 一审审批人存 dept_head_id，不覆盖 approver_id（负责人A不可变）
    db.prepare('UPDATE perf_tasks SET dept_head_id = ? WHERE id = ?').run(firstApproverId, plan.id);
  }

  // 触发一次 draft 转换方便统一日志（如果需要的话，但不影响逻辑。直接基于引擎推送最终状态）
  await transitionPlan(plan.id, 'draft', req.userId!, { comment: '系统强制状态重置为草稿' });

  if (nextStatus === 'pending_review') {
      await transitionPlan(plan.id, 'pending_review', req.userId!);
  } else if (nextStatus === 'pending_dept_review') {
      await transitionPlan(plan.id, 'pending_review', req.userId!);
      await transitionPlan(plan.id, 'pending_dept_review', req.userId!);
  }

  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)').run(
    req.params.id, req.userId, 'resubmit', plan.status, nextStatus, '修改后重新提交审批'
  );
  logAudit({ businessType: 'perf_plan', businessId: Number(req.params.id), actorId: req.userId!, action: 'resubmit', fromStatus: plan.status, toStatus: nextStatus });

  return res.json({ code: 0, message: '已重新提交审批' });
});

// 撤回：在审批人未审核前，发起人可以撤回
router.post('/plans/:id/withdraw', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.creator_id !== req.userId) return res.status(403).json({ code: 403, message: '只有发起人可以撤回' });
  if (plan.status !== 'pending_review') return res.json({ code: 400, message: '当前状态不可撤回，仅待审核状态可撤回' });

  db.prepare("UPDATE perf_tasks SET status = 'draft', updated_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)').run(
    req.params.id, req.userId, 'withdraw', 'pending_review', 'draft', '发起人主动撤回'
  );
  logAudit({ businessType: 'perf_plan', businessId: Number(req.params.id), actorId: req.userId!, action: 'withdraw', fromStatus: 'pending_review', toStatus: 'draft' });

  return res.json({ code: 0, message: '已撤回，可重新编辑后提交' });
});

// 退回：被指派人退回上级下发的绩效 (in_progress → returned)
router.post('/plans/:id/return', authMiddleware, async (req: AuthRequest, res) => {
  const { reason } = req.body;
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.status !== 'in_progress') return res.json({ code: 400, message: '只有进行中的任务可以退回' });

  // Flow1(任务下发): creator_id !== assignee_id，禁止退回
  if (plan.creator_id !== plan.assignee_id) {
    return res.status(400).json({ code: 400, message: '任务下发类型不支持退回操作' });
  }

  // 支持多执行人校验 + 负责人(A)也可退回
  const assigneeList = (plan.assignee_id || '').split(',').map((s: string) => s.trim().toLowerCase());
  const isAssignee = assigneeList.includes(String(req.userId).toLowerCase());
  const isApprover = plan.approver_id === req.userId;
  const isAdmin = isGM(req.userId) || isSuperAdmin(req.userId);
  if (!isAssignee && !isApprover && !isAdmin) {
    return res.status(403).json({ code: 403, message: '仅执行人(R)或负责人(A)可退回任务' });
  }

  const result = await transitionPlan(Number(req.params.id), 'returned', req.userId!, { comment: reason || '被指派人退回' });
  return res.json({ code: result.success ? 0 : 400, message: result.success ? '已退回，发起人将收到通知' : result.message });
});

// 删除草稿
router.delete('/plans/:id', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.creator_id !== req.userId) return res.status(403).json({ code: 403, message: '只有创建人可以删除' });
  if (plan.status !== 'draft') return res.json({ code: 400, message: '只有草稿可以删除' });

  db.prepare('DELETE FROM perf_logs WHERE plan_id = ?').run(req.params.id);
  db.prepare('DELETE FROM perf_tasks WHERE id = ?').run(req.params.id);
  return res.json({ code: 0, message: '草稿已删除' });
});

// 提交审批 — 仅限申请流(Flow2)，下发任务(Flow1)应使用 /dispatch
router.post('/plans/:id/submit', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

  // 下发任务(Flow1)不走审批流，应使用 /dispatch 端点
  if (plan.task_type === 'assigned' && plan.flow_type !== 'application') {
    return res.status(400).json({ code: 400, message: '下发任务请使用「派发」功能，不走审批流程' });
  }

  const { WorkflowEngine, WORKFLOWS } = await import('../services/workflow-engine');

  // ── 接入 Workflow Engine ──
  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PERF_PLAN, { initiatorId: plan.creator_id, deptId: plan.department_id });
  const node2 = nodes.find(n => n.seq === 2); // 一审: 直属负责
  const node3 = nodes.find(n => n.seq === 3); // 二审: 跨级负责

  let nextStatus = 'pending_review';
  let firstApproverId = node2?.assignees?.[0] || null;

  if (node2?.isSkipped || !firstApproverId) {
    // 一审自动跳过 → 进入二审
    nextStatus = 'pending_dept_review';
    let secondApproverId = node3?.assignees?.[0] || null;
    if (node3?.isSkipped || !secondApproverId) {
      // 二审也跳过 → 所有审批人缺失，拒绝自动通过
      return res.status(400).json({ code: 400, message: '审批流程异常：未找到任何有效审批人，请联系 HR 配置组织架构' });
    } else {
      db.prepare('UPDATE perf_tasks SET dept_head_id = ? WHERE id = ?').run(secondApproverId, plan.id);
    }
  } else {
    // 正常进入一审 — 审批人存 dept_head_id，不覆盖 approver_id（负责人A不可变）
    db.prepare('UPDATE perf_tasks SET dept_head_id = ? WHERE id = ?').run(firstApproverId, plan.id);
  }

  // 触发状态流转（产生 logs 和企微消息推送）
  if (nextStatus === 'pending_review') {
      await transitionPlan(plan.id, 'pending_review', req.userId!);
  } else if (nextStatus === 'pending_dept_review') {
      await transitionPlan(plan.id, 'pending_review', req.userId!, { silent: true } as any);
      await transitionPlan(plan.id, 'pending_dept_review', req.userId!);
  }

  return res.json({ code: 0, message: '已提交审批' });
});

// 审批通过
router.post('/plans/:id/approve', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);
  const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  // 多流程隔离：仅允许绩效任务(flow1/flow2)
  if (plan.task_type && !['assigned', 'applied'].includes(plan.task_type)) {
    return res.status(400).json({ code: 400, message: '该任务类型不支持此审批操作' });
  }

  // 并发双重审批防护：在处理前重新验证状态，拒绝非审批态的请求
  if (!['pending_review', 'pending_dept_review'].includes(plan.status)) {
    return res.status(400).json({ code: 400, message: `当前状态 (${plan.status}) 不支持审批操作` });
  }

  const { WorkflowEngine, WORKFLOWS } = await import('../services/workflow-engine');
  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PERF_PLAN, { initiatorId: plan.creator_id, deptId: plan.department_id });
  const node2 = nodes.find(n => n.seq === 2); // 一审: 直属负责
  const node3 = nodes.find(n => n.seq === 3); // 二审: 跨级负责

  const isAdminOrGM = isGM(req.userId) || isSuperAdmin(req.userId);

  // 发起人自身拦截（所有人包括管理员都不能审批自己的计划）
  if (plan.creator_id === req.userId) {
    return res.status(403).json({ code: 403, message: '发起人不能审批自己提交的计划' });
  }

  if (plan.status === 'pending_review') {
    // 一审节点阶段校验
    const node2Assignees = node2?.assignees || [];
    if (!node2Assignees.includes(req.userId) && !isAdminOrGM && req.userId !== plan.approver_id && req.userId !== plan.dept_head_id) {
       return res.status(403).json({ code: 403, message: '您不在本节点的审批群组内，不能越级审批' });
    }

    // 引擎检测二审是否应该自动跳过
    let secondApproverId = node3?.assignees?.[0] || null;
    // flow2（任务申请）属于部门内部事宜，无需跨级审批，直属主管审批后直接启动
    let skipNode3 = plan.flow_type === 'application' || node3?.isSkipped || !secondApproverId || secondApproverId === req.userId || secondApproverId === plan.creator_id;
    
    // Auto-escalation 回落如果引擎计算出的结果无效
    if (skipNode3) {
      if (secondApproverId) db.prepare('UPDATE perf_tasks SET dept_head_id = ? WHERE id = ?').run(secondApproverId, planId);
      const result = await transitionPlan(planId, 'approved', req.userId!);
      // Flow2(任务申请): 审批通过后自动启动 + 抄送HRBP
      if (result.success && plan.flow_type === 'application') {
        await transitionPlan(planId, 'in_progress', req.userId!);
        try {
          const { WorkflowEngine: WE2 } = await import('../services/workflow-engine');
          const hrbpIds = WE2.getUsersByRoleTag('hrbp');
          if (hrbpIds.length > 0) {
            const { createNotification } = await import('./notifications');
            createNotification(hrbpIds, 'system_notice', '📋 任务申请已通过', `任务「${plan.title}」审批通过并已启动`, '/my-goals');
          }
        } catch {}
      }
      return res.json({ code: result.success ? 0 : 400, message: result.success && plan.flow_type === 'application' ? '审批通过，任务已启动' : result.message });
    } else {
      // 成功递交二审
      db.prepare('UPDATE perf_tasks SET dept_head_id = ? WHERE id = ?').run(secondApproverId, planId);
      const result = await transitionPlan(planId, 'pending_dept_review', req.userId!);
      const deptHeadName = (db.prepare('SELECT name FROM users WHERE id = ?').get(secondApproverId) as any)?.name || '下一级负责人';
      return res.json({ code: result.success ? 0 : 400, message: result.success ? `节点审批完成，已自动发往「${deptHeadName}」处理` : result.message });
    }
  } else if (plan.status === 'pending_dept_review') {
    // 二审节点阶段校验
    const node3Assignees = node3?.assignees || [];
    if (!node3Assignees.includes(req.userId) && !isAdminOrGM && req.userId !== plan.dept_head_id) {
      return res.status(403).json({ code: 403, message: '您无权处理该跨级审批节点' });
    }
    const result = await transitionPlan(planId, 'approved', req.userId!);
    // Flow2(任务申请): 审批通过后自动启动 + 抄送HRBP
    if (result.success && plan.flow_type === 'application') {
      await transitionPlan(planId, 'in_progress', req.userId!);
      try {
        const { WorkflowEngine: WE2 } = await import('../services/workflow-engine');
        const hrbpIds = WE2.getUsersByRoleTag('hrbp');
        if (hrbpIds.length > 0) {
          const { createNotification } = await import('./notifications');
          createNotification(hrbpIds, 'system_notice', '📋 任务申请已通过', `任务「${plan.title}」审批通过并已启动`, '/my-goals');
        }
      } catch {}
    }
    return res.json({ code: result.success ? 0 : 400, message: result.success && plan.flow_type === 'application' ? '审批通过，任务已启动' : result.message });
  }

  // 状态守卫已在入口拦截，此处不应到达
  return res.status(400).json({ code: 400, message: `当前状态 (${plan.status}) 不支持审批操作` });
});

// 驳回
router.post('/plans/:id/reject', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);
  const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  // 多流程隔离：仅允许绩效任务(flow1/flow2)
  if (plan.task_type && !['assigned', 'applied'].includes(plan.task_type)) {
    return res.status(400).json({ code: 400, message: '该任务类型不支持此驳回操作' });
  }

  const { WorkflowEngine, WORKFLOWS } = await import('../services/workflow-engine');
  const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PERF_PLAN, { initiatorId: plan.creator_id, deptId: plan.department_id });
  const node2 = nodes.find(n => n.seq === 2);
  const node3 = nodes.find(n => n.seq === 3);

  const isAdminOrGM = isGM(req.userId) || isSuperAdmin(req.userId);

  // ── 禁止自审驳回（所有人包括管理员都不能驳回自己的计划）──
  if (plan.creator_id === req.userId) {
    return res.status(403).json({ code: 403, message: '发起人不能驳回自己提交的计划' });
  }
  
  // ── 节点校验 ──
  if (plan.status === 'pending_review') {
    const node2Assignees = node2?.assignees || [];
    if (!node2Assignees.includes(req.userId) && !isAdminOrGM && plan.approver_id !== req.userId && plan.dept_head_id !== req.userId) {
      return res.status(403).json({ code: 403, message: '您不是本计划当前节点的审批人，不能越级操作' });
    }
  } else if (plan.status === 'pending_dept_review') {
    const node3Assignees = node3?.assignees || [];
    if (!node3Assignees.includes(req.userId) && !isAdminOrGM && plan.dept_head_id !== req.userId) {
      return res.status(403).json({ code: 403, message: '您无权在该节点进行驳回操作' });
    }
  } else {
    return res.status(400).json({ code: 400, message: `当前状态 (${plan.status}) 不支持驳回` });
  }

  const result = await transitionPlan(planId, 'rejected', req.userId!, { comment: req.body.reason });
  return res.json({ code: result.success ? 0 : 400, message: result.message });
});

// A角色自评打分
router.post('/plans/:id/self-score', authMiddleware, async (req: AuthRequest, res) => {
  const planId = Number(req.params.id);
  const { score } = req.body;
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.status !== 'pending_assessment') {
    return res.status(400).json({ code: 400, message: '仅待评级状态可提交自评' });
  }
  // 仅A角色（approver_id）可自评
  const isA = plan.approver_id && String(plan.approver_id).toLowerCase() === String(req.userId).toLowerCase();
  if (!isA) {
    return res.status(403).json({ code: 403, message: '仅负责人(A)可提交自评打分' });
  }
  if (score == null || score < 1 || score > 100) {
    return res.status(400).json({ code: 400, message: '自评分数须在1-100之间' });
  }
  db.prepare('UPDATE perf_tasks SET self_score = ?, updated_at = ? WHERE id = ?').run(score, new Date().toISOString(), planId);
  db.prepare(
    'INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(planId, req.userId, 'self_score', null, String(score), 'A角色自评打分');
  return res.json({ code: 0, message: '自评提交成功' });
});

// 统一审批操作 (approve / reject / assess / reward)
router.post('/plans/:id/review', authMiddleware, async (req: AuthRequest, res) => {
  const { action, reason, score, bonus, attachments, transfer_to } = req.body;
  const planId = Number(req.params.id);

  if (action === 'transfer' && transfer_to) {
    const db = (await import('../config/database')).getDb();
    const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(planId) as any;
    if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
    // 多流程隔离：仅允许绩效任务(flow1/flow2)
    if (plan.task_type && !['assigned', 'applied'].includes(plan.task_type)) {
      return res.status(400).json({ code: 400, message: '该任务类型不支持此操作' });
    }

    // 校验：不能将审批转交给计划发起人（避免自审批）
    if (transfer_to === plan.creator_id) {
      return res.status(400).json({ code: 400, message: '不能将审批转交给计划发起人' });
    }

    const isAdminOrGM = isGM(req.userId) || isSuperAdmin(req.userId);

    let updateSql = '';
    if (plan.status === 'pending_review' || plan.status === 'published') {
      // 只有当前审批人或 admin/GM 才能转办
      if (req.userId !== plan.dept_head_id && req.userId !== plan.approver_id && !isAdminOrGM) {
        return res.status(403).json({ code: 403, message: '仅当前审批人可转办此节点' });
      }
      // 转办审批人存 dept_head_id，不覆盖 approver_id（负责人A不可变）
      updateSql = 'UPDATE perf_tasks SET dept_head_id = ? WHERE id = ?';
    } else if (plan.status === 'pending_dept_review') {
      // 只有当前部门审批人或 admin/GM 才能转办
      if (req.userId !== plan.dept_head_id && !isAdminOrGM) {
        return res.status(403).json({ code: 403, message: '仅当前部门审批人可转办此节点' });
      }
      updateSql = 'UPDATE perf_tasks SET dept_head_id = ? WHERE id = ?';
    } else {
      return res.status(400).json({ code: 400, message: '当前阶段不可转办' });
    }

    db.prepare(updateSql).run(transfer_to, planId);

    const { createNotification } = await import('./notifications');
    const transferUser = db.prepare('SELECT name FROM users WHERE id = ?').get(transfer_to) as any;
    const operatorUser = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any;
    
    if (transferUser) {
      createNotification([transfer_to], 'workflow_transfer', '🔄 绩效考核转办', `${operatorUser?.name || '管理员'} 将一个目标考评流程转交给了您，请核实。`, '/my-workflows');
      try { 
        const { sendCardMessage } = await import('../services/message');
        const p = db.prepare('SELECT title FROM perf_tasks WHERE id = ?').get(planId) as any;
        sendCardMessage([transfer_to], '🔄 审批节点转办通知', `${operatorUser?.name || '管理员'} 把考核任务「${p?.title}」移交给了您\n> 留言附注: ${reason || '请阅审'}`, `${process.env.APP_URL || 'http://localhost:3000'}/my-workflows`); 
      } catch(e) {}
    }
    return res.json({ code: 0, message: `任务考核已顺利移交至 ${transferUser?.name}` });
  }

  const db = getDb();

  switch (action) {
    case 'approve': {
      const plan4approve = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(planId) as any;
      if (!plan4approve) return res.status(404).json({ code: 404, message: '计划不存在' });
      // 多流程隔离
      if (plan4approve.task_type && !['assigned', 'applied'].includes(plan4approve.task_type)) {
        return res.status(400).json({ code: 400, message: '该任务类型不支持此审批操作' });
      }

      // 并发双重审批防护
      if (!['pending_review', 'pending_dept_review'].includes(plan4approve.status)) {
        return res.status(400).json({ code: 400, message: `当前状态 (${plan4approve.status}) 不支持审批操作` });
      }

      // 发起人不能审批自己的计划
      if (plan4approve.creator_id === req.userId) {
        return res.status(403).json({ code: 403, message: '发起人不能审批自己提交的计划' });
      }

      const isAdminOrGM = isGM(req.userId) || isSuperAdmin(req.userId);

      if (plan4approve.status === 'pending_review') {
        // 一审：必须是 approver_id / dept_head_id(flow2) 或 admin/GM
        if (req.userId !== plan4approve.approver_id && req.userId !== plan4approve.dept_head_id && !isAdminOrGM) {
          return res.status(403).json({ code: 403, message: '您不是该计划的审批人，无权审批' });
        }
      } else if (plan4approve.status === 'pending_dept_review') {
        // 二审：必须是 dept_head_id 或 admin/GM
        if (req.userId !== plan4approve.dept_head_id && !isAdminOrGM) {
          return res.status(403).json({ code: 403, message: '您不是该计划的部门审批人，无权审批' });
        }
      }

      const result = await transitionPlan(planId, 'approved', req.userId!, { attachments });
      // flow2(任务申请): 审批通过后自动启动 + 抄送HRBP
      if (result.success && plan4approve.flow_type === 'application') {
        await transitionPlan(planId, 'in_progress', req.userId!);
        try {
          const { WorkflowEngine: WE2 } = await import('../services/workflow-engine');
          const hrbpIds = WE2.getUsersByRoleTag('hrbp');
          if (hrbpIds.length > 0) {
            const { createNotification } = await import('./notifications');
            createNotification(hrbpIds, 'system_notice', '📋 任务申请已通过', `任务「${plan4approve.title}」审批通过并已启动`, '/my-goals');
          }
        } catch {}
      }
      return res.json({ code: result.success ? 0 : 400, message: result.success && plan4approve.flow_type === 'application' ? '审批通过，任务已启动' : result.message });
    }
    case 'reject': {
      const plan4reject = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(planId) as any;
      if (!plan4reject) return res.status(404).json({ code: 404, message: '计划不存在' });
      // 多流程隔离
      if (plan4reject.task_type && !['assigned', 'applied'].includes(plan4reject.task_type)) {
        return res.status(400).json({ code: 400, message: '该任务类型不支持此驳回操作' });
      }

      if (!['pending_review', 'pending_dept_review'].includes(plan4reject.status)) {
        return res.status(400).json({ code: 400, message: `当前状态 (${plan4reject.status}) 不支持驳回操作` });
      }

      // 发起人不能驳回自己的计划
      if (plan4reject.creator_id === req.userId) {
        return res.status(403).json({ code: 403, message: '发起人不能驳回自己提交的计划' });
      }

      const isAdminOrGM_r = isGM(req.userId) || isSuperAdmin(req.userId);
      if (plan4reject.status === 'pending_review') {
        if (req.userId !== plan4reject.approver_id && req.userId !== plan4reject.dept_head_id && !isAdminOrGM_r) {
          return res.status(403).json({ code: 403, message: '您不是该计划的审批人，无权驳回' });
        }
      } else if (plan4reject.status === 'pending_dept_review') {
        if (req.userId !== plan4reject.dept_head_id && !isAdminOrGM_r) {
          return res.status(403).json({ code: 403, message: '您不是该计划的部门审批人，无权驳回' });
        }
      }

      const result = await transitionPlan(planId, 'rejected', req.userId!, { comment: reason, attachments });
      return res.json({ code: result.success ? 0 : 400, message: result.message });
    }
    case 'assess': {
      // 流程5核心防腐：评级官避嫌溯源
      const plan4assess = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(planId) as any;
      if (!plan4assess) return res.status(404).json({ code: 404, message: '计划不存在' });

      // 仅负责人A可发起验收（但评分操作是上级做的）
      if (plan4assess.status === 'in_progress') {
        // 发起验收总结 → 限执行人(R)或责任人(A)
        const isR = typeof plan4assess.assignee_id === 'string' && plan4assess.assignee_id.toLowerCase().includes(String(req.userId).toLowerCase());
        const isA = typeof plan4assess.approver_id === 'string' && plan4assess.approver_id.toLowerCase() === String(req.userId).toLowerCase();

        if (!isR && !isA && !isGM(req.userId) && !isSuperAdmin(req.userId)) {
          return res.status(403).json({ code: 403, message: '仅执行人(R)或责任人(A)可发起验收总结' });
        }
        const step1 = await transitionPlan(planId, 'pending_assessment', req.userId!);
        const waitMsg = plan4assess.flow_type === 'application' ? '等待上级主管评分' : '等待任务创建者评分';
        return res.json({ code: step1.success ? 0 : 400, message: step1.success ? `已发起验收总结，${waitMsg}` : step1.message });
      }

      if (plan4assess.status === 'pending_assessment') {
        // 打分权限: Flow1(任务下发)=创建者评分; Flow2(任务申请)=上级主管评分
        const isAdminOrGM = isGM(req.userId) || isSuperAdmin(req.userId);
        let scorerId: string;
        let scorerLabel: string;
        if (plan4assess.flow_type === 'application') {
          // Flow2: 上级主管评分
          // getAssessmentJudge 已从顶部 import
          const { judgeId } = getAssessmentJudge(plan4assess.creator_id);
          scorerId = judgeId || plan4assess.approver_id || plan4assess.creator_id;
          scorerLabel = '上级主管';
        } else {
          // Flow1: 任务创建者(负责人)评分
          scorerId = plan4assess.creator_id;
          scorerLabel = '任务创建者';
        }
        if (!isAdminOrGM && req.userId !== scorerId) {
          const scorerName = scorerId ? (db.prepare('SELECT name FROM users WHERE id = ?').get(scorerId) as any)?.name || scorerId : '未找到';
          return res.status(403).json({ code: 403, message: `您无权评分。本任务评分人为${scorerLabel}：${scorerName}` });
        }
        const result = await transitionPlan(planId, 'assessed', req.userId!, { score, attachments });
        if (result.success) {
          // 评级后直接结案
          await transitionPlan(planId, 'completed', req.userId!);
          // 抄送 HRBP 和 GM
          try {
            const { WorkflowEngine } = await import('../services/workflow-engine');
            const hrbpIds: string[] = WorkflowEngine.getUsersByRoleTag('hrbp');
            const gmIds: string[] = WorkflowEngine.getUsersByRoleTag('gm');
            const ccIds = [...new Set([...hrbpIds, ...gmIds])];
            if (ccIds.length > 0) {
              await notifyPerfStatusChange(planId, 'cc_completed', ccIds, plan4assess.title);
            }
          } catch (e) {
            console.error('CC notification failed:', e);
          }
        }
        return res.json({ code: result.success ? 0 : 400, message: result.success ? '评级完成，任务已结案' : result.message });
      }

      return res.status(400).json({ code: 400, message: `当前状态 (${plan4assess.status}) 不支持评分操作` });
    }
    case 'reward': {
      // 注意：日常绩效不再走此环节（流程5已取消），保留兼容但返回提示
      return res.status(400).json({ code: 400, message: '日常绩效评级后直接结案，无需经过发钱环节。悬赏任务请使用 /pool/rewards 流程' });
    }
    case 'return': {
      const plan4return = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(planId) as any;
      if (!plan4return) return res.status(404).json({ code: 404, message: '计划不存在' });

      if (plan4return.status !== 'in_progress') {
        return res.status(400).json({ code: 400, message: '只有进行中的任务可以退回' });
      }

      // 执行人(R)、负责人(A)、admin/GM 可退回
      const assignees = (plan4return.assignee_id || '').split(',').map((s: string) => s.trim().toLowerCase());
      const isAssignee = assignees.includes(String(req.userId).toLowerCase());
      const isApprover = plan4return.approver_id === req.userId;
      if (!isAssignee && !isApprover && !isGM(req.userId) && !isSuperAdmin(req.userId)) {
        return res.status(403).json({ code: 403, message: '仅执行人(R)或负责人(A)可退回任务' });
      }

      const result = await transitionPlan(planId, 'returned', req.userId!, { comment: reason, attachments });
      return res.json({ code: result.success ? 0 : 400, message: result.message });
    }
    default:
      return res.status(400).json({ code: 400, message: `未知操作: ${action}` });
  }
});

// ═══════════════════════════════════════════════════════
// 流程1: 团队内派发任务 — 签收机制
// ═══════════════════════════════════════════════════════

// 主管下发任务 → pending_receipt
router.post('/plans/:id/dispatch', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);
  const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.creator_id !== req.userId && !isGM(req.userId) && !isSuperAdmin(req.userId)) {
    return res.status(403).json({ code: 403, message: '仅任务创建人可下发任务' });
  }
  if (plan.status !== 'draft') return res.status(400).json({ code: 400, message: '仅草稿可下发' });

  // 收集需要签收的人员名单
  const pendingUsers: string[] = [];
  if (plan.assignee_id) {
    const assigneeIds = plan.assignee_id.split(',').filter(Boolean);
    pendingUsers.push(...assigneeIds);
  }
  // Flow2(任务申请): A=创建者自己，不需要签收自己的任务；Flow1(任务下发): A也需签收
  if (plan.flow_type !== 'application') {
    if (plan.approver_id && !pendingUsers.includes(plan.approver_id)) {
      pendingUsers.push(plan.approver_id);
    }
  }

  if (pendingUsers.length === 0) {
    return res.status(400).json({ code: 400, message: '请先设置执行人(R)' });
  }

  // 初始化签收状态
  const receiptStatus: Record<string, string> = {};
  for (const uid of pendingUsers) {
    receiptStatus[uid] = 'pending';
  }

  db.prepare(`UPDATE perf_tasks SET status = 'pending_receipt', receipt_status = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(receiptStatus), new Date().toISOString(), planId);

  // 记录日志
  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)')
    .run(planId, req.userId, 'dispatch', 'draft', 'pending_receipt', `下发至 ${pendingUsers.length} 人`);

  // 推送待签收通知
  const { createNotification } = await import('./notifications');
  const creatorName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
  createNotification(pendingUsers, 'workflow_pending', '📥 新任务待查收', `${creatorName} 给您下发了任务「${plan.title}」，请确认查收`, '/my-goals');

  return res.json({ code: 0, message: `任务已下发，等待 ${pendingUsers.length} 人签收` });
});

// R/A 签收确认
router.post('/plans/:id/confirm-receipt', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);

  // 用事务包裹签收逻辑，防止并发签收丢失确认状态
  const txResult = db.transaction(() => {
    const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(planId) as any;
    if (!plan) return { error: 404, message: '计划不存在' };
    if (plan.status !== 'pending_receipt') return { error: 400, message: '当前状态非待签收' };

    let receiptStatus: Record<string, string> = {};
    try { receiptStatus = JSON.parse(plan.receipt_status || '{}'); } catch {}

    if (!receiptStatus[req.userId!]) {
      return { error: 403, message: '您不在签收名单中' };
    }
    if (receiptStatus[req.userId!] === 'confirmed') {
      return { ok: true, message: '您已签收过', allConfirmed: false, plan };
    }

    receiptStatus[req.userId!] = 'confirmed';
    db.prepare(`UPDATE perf_tasks SET receipt_status = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(receiptStatus), new Date().toISOString(), planId);

    db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)')
      .run(planId, req.userId, 'confirm_receipt', 'pending', 'confirmed', '已确认查收');

    const allConfirmed = Object.values(receiptStatus).every(s => s === 'confirmed');
    return { ok: true, allConfirmed, plan };
  })();

  if ('error' in txResult) {
    return res.status(txResult.error).json({ code: txResult.error, message: txResult.message });
  }

  // 检查是否全部签收（通知逻辑在事务外执行，避免事务内做异步IO）
  if (txResult.allConfirmed && txResult.plan) {
    const { createNotification } = await import('./notifications');
    const plan = txResult.plan;

    if (plan.flow_type === 'application') {
      // Flow2(任务申请): 签收完成后自动进入上级审批
      // ⚠️ RACI 不可变原则：approver_id（负责人A）创建后不再修改
      // 审批人通过 WorkflowEngine 解析，存到 dept_head_id（flow2 无二审，该字段空闲）
      const { WorkflowEngine: WE, WORKFLOWS: WF } = await import('../services/workflow-engine');
      const engineNodes = WE.resolveAssignees(WF.PERF_PLAN, { initiatorId: plan.creator_id });
      const firstNode = engineNodes.find(n => n.seq === 2);
      const reviewerId = firstNode?.assignees?.[0] || null;

      if (reviewerId) {
        getDb().prepare('UPDATE perf_tasks SET dept_head_id = ? WHERE id = ?').run(reviewerId, planId);
      }

      await transitionPlan(planId, 'pending_review', plan.creator_id);
      const reviewerName = (getDb().prepare('SELECT name FROM users WHERE id = ?').get(reviewerId) as any)?.name || '上级主管';
      if (reviewerId) {
        createNotification([reviewerId], 'workflow_pending', '📋 任务申请待审批', `员工申请的任务「${plan.title}」已完成签收，等待您审批`, '/my-goals');
      }
      return res.json({ code: 0, message: `签收完成，已进入上级审批（${reviewerName}）` });
    } else {
      // Flow1(任务下发): 通知A发车
      if (plan.approver_id) {
        createNotification([plan.approver_id], 'workflow_pending', '🟢 全员已签收', `任务「${plan.title}」所有成员已确认签收，您可以发起任务了`, '/my-goals');
      }
    }
  }

  return res.json({ code: 0, message: '签收成功' + (txResult.allConfirmed ? '，全员已到齐' : '') });
});

// R/A 拒签
router.post('/plans/:id/reject-receipt', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);
  const { reason } = req.body;
  const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.status !== 'pending_receipt') return res.status(400).json({ code: 400, message: '当前状态非待签收' });

  let receiptStatus: Record<string, string> = {};
  try { receiptStatus = JSON.parse(plan.receipt_status || '{}'); } catch {}

  if (!receiptStatus[req.userId!]) {
    return res.status(403).json({ code: 403, message: '您不在签收名单中' });
  }

  receiptStatus[req.userId!] = 'rejected';
  // 拒签 → 退回给发派主管重新编辑
  db.prepare(`UPDATE perf_tasks SET status = 'draft', receipt_status = ?, reject_reason = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(receiptStatus), reason || '成员拒签', new Date().toISOString(), planId);

  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)')
    .run(planId, req.userId, 'reject_receipt', 'pending_receipt', 'draft', reason || '拒绝签收');

  // 通知主管
  const { createNotification } = await import('./notifications');
  const rejecterName = (db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as any)?.name || req.userId;
  createNotification([plan.creator_id], 'workflow_error', '🔴 任务签收被拒', `${rejecterName} 拒绝签收任务「${plan.title}」，原因：${reason || '未说明'}`, '/my-goals');

  return res.json({ code: 0, message: '已拒签，任务退回给主管重新编辑' });
});

// A 独占发车权：全员签收后，仅 A 可将 pending_receipt → in_progress
router.post('/plans/:id/start-task', authMiddleware, async (req: AuthRequest, res) => {
  const db = getDb();
  const planId = Number(req.params.id);
  const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });
  if (plan.status !== 'pending_receipt') return res.status(400).json({ code: 400, message: '当前状态非待签收' });

  // flow2（任务申请）不允许手动发车，签收完自动进上级审批
  if (plan.flow_type === 'application') {
    return res.status(400).json({ code: 400, message: '申请类任务签收完成后自动进入上级审批，无需手动启动' });
  }

  // 发车权限: 仅负责人(A)可启动任务
  const isA = typeof plan.approver_id === 'string' && plan.approver_id.toLowerCase() === String(req.userId).toLowerCase();

  if (!isA && !isGM(req.userId) && !isSuperAdmin(req.userId)) {
    return res.status(403).json({ code: 403, message: '仅负责人(A)可启动任务' });
  }

  // 检查全员签收
  let receiptStatus: Record<string, string> = {};
  try { receiptStatus = JSON.parse(plan.receipt_status || '{}'); } catch {}
  const pendingUsers = Object.entries(receiptStatus).filter(([_, s]) => s !== 'confirmed');
  if (pendingUsers.length > 0) {
    const names = pendingUsers.map(([uid]) => {
      const u = db.prepare('SELECT name FROM users WHERE id = ?').get(uid) as any;
      return u?.name || uid;
    });
    return res.status(400).json({ code: 400, message: `以下成员尚未签收: ${names.join('、')}` });
  }

  const result = await transitionPlan(planId, 'in_progress', req.userId!);
  if (result.success) {
    db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)')
      .run(planId, req.userId, 'start_task', 'pending_receipt', 'in_progress', 'A发车，任务启动');
  }

  return res.json({ code: result.success ? 0 : 400, message: result.success ? '🚀 任务已启动！' : result.message });
});

// 更新进度
router.put('/plans/:id/progress', authMiddleware, (req: AuthRequest, res) => {
  const { progress, comment } = req.body;
  const db = getDb();
  const plan = db.prepare('SELECT progress FROM perf_tasks WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

  db.prepare('UPDATE perf_tasks SET progress = ?, updated_at = ? WHERE id = ?').run(progress, new Date().toISOString(), req.params.id);
  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.id, req.userId, 'progress_update', String(plan.progress), String(progress), comment);
  logAudit({ businessType: 'perf_plan', businessId: Number(req.params.id), actorId: req.userId!, action: 'progress_update', extra: { from: plan.progress, to: progress } });

  return res.json({ code: 0, message: '进度已更新' });
});

// 进度日志
router.get('/plans/:id/logs', authMiddleware, (req, res) => {
  const db = getDb();
  const logs = db.prepare(
    `SELECT pl.*, u.name as user_name FROM perf_logs pl LEFT JOIN users u ON pl.user_id = u.id WHERE pl.plan_id = ? ORDER BY pl.created_at ASC`
  ).all(req.params.id);
  return res.json({ code: 0, data: logs });
});

// 我的待审批列表
router.get('/my-approvals', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const plans = db.prepare("SELECT * FROM perf_tasks WHERE approver_id = ? AND status = 'pending_review' ORDER BY created_at DESC").all(req.userId);
  return res.json({ code: 0, data: plans });
});

// 历史绩效记录
router.get('/history', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const plans = db.prepare("SELECT * FROM perf_tasks WHERE (creator_id = ? OR (',' || assignee_id || ',' LIKE '%,' || ? || ',%')) AND status = 'completed' ORDER BY created_at DESC").all(req.userId, req.userId);
  return res.json({ code: 0, data: plans });
});

// 我的团队及成员任务状态
router.get('/team-status', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const currentUser = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId) as any;
  if (!currentUser) return res.status(401).json({ code: 401, message: '未授权' });

  let subordinates: any[] = [];
  const perms = getUserEffectivePerms(req.userId!);
  const canViewDept = perms.includes('view_dept_data');

  const userRow = db.prepare('SELECT department_id FROM users WHERE id = ?').get(req.userId) as any;
  const userDeptId = userRow?.department_id;

  // ── 优先：检查是否存在自定义团队可视范围配置 ──────────────────────────
  // 如果 HR/管理员为该用户配置了自定义范围，完全替换部门推算逻辑
  const scopeRows = db.prepare(
    'SELECT member_id FROM team_view_scopes WHERE manager_id = ?'
  ).all(req.userId) as any[];

  if (scopeRows.length > 0) {
    const memberIds = scopeRows.map((r: any) => r.member_id);
    const placeholders = memberIds.map(() => '?').join(',');
    subordinates = db.prepare(
      `SELECT id, name, title, avatar_url, role FROM users WHERE id IN (${placeholders}) AND status = ?`
    ).all(...memberIds, 'active');
  } else {
  // ── 默认：按部门归属推算 ──────────────────────────────────────────────
  const leaderDepts = db.prepare('SELECT id FROM departments WHERE leader_user_id = ?').all(req.userId) as any[];

  // 递归收集该部门及所有子部门的 ID
  function getAllDeptIds(id: number): number[] {
    const children = db.prepare('SELECT id FROM departments WHERE parent_id = ?').all(id) as any[];
    return [id, ...children.flatMap((c: any) => getAllDeptIds(c.id))];
  }

  let deptIds = new Set<number>();
  if (userDeptId) deptIds.add(userDeptId);
  leaderDepts.forEach(d => {
    getAllDeptIds(d.id).forEach(id => deptIds.add(id));
  });
  
  const finalDeptIds = Array.from(deptIds);

  if (finalDeptIds.length > 0) {
    if (canViewDept) {
      const placeholders = finalDeptIds.map(() => '?').join(',');
      subordinates = db.prepare(
        `SELECT id, name, title, avatar_url, role FROM users WHERE department_id IN (${placeholders}) AND status = ?`
      ).all(...finalDeptIds, 'active');
    } else {
      const allowedDeptIds = Array.from(deptIds).filter(id => id !== userDeptId || leaderDepts.some(ld => ld.id === id));
      let baseSubordinates = db.prepare(
        `SELECT id, name, title, avatar_url, role FROM users WHERE id = ? AND status = ?`
      ).all(req.userId, 'active');

      if (allowedDeptIds.length > 0) {
        const placeholders = allowedDeptIds.map(() => '?').join(',');
        const extraSubordinates = db.prepare(
          `SELECT id, name, title, avatar_url, role FROM users WHERE department_id IN (${placeholders}) AND status = ? AND id != ?`
        ).all(...allowedDeptIds, 'active', req.userId);
        baseSubordinates = baseSubordinates.concat(extraSubordinates);
      }
      subordinates = baseSubordinates;
    }
  } else {
    subordinates = db.prepare(
        `SELECT id, name, title, avatar_url, role FROM users WHERE id = ? AND status = ?`
    ).all(req.userId, 'active');
  }
  } // end else (default dept logic)

  // 使用真实数据：平均分 + 任务列表
  // 按 assignee_id 归组（避免同一任务出现在多人行下）
  // 对当前用户自己的行，额外包含 creator/approver 维度的任务
  for (let sub of subordinates) {
    const isSelf = sub.id === req.userId;
    let plans: any[];
    if (isSelf) {
      // 自己的行：包含自己作为 assignee/creator/approver 的任务（不重复）
      plans = db.prepare(`SELECT p.*, uc.name AS creator_name, ua.name AS approver_name, us.name AS assignee_name FROM perf_tasks p LEFT JOIN users uc ON uc.id = p.creator_id LEFT JOIN users ua ON ua.id = p.approver_id LEFT JOIN users us ON us.id = p.assignee_id WHERE ((',' || p.assignee_id || ',' LIKE '%,' || ? || ',%') OR p.creator_id = ? OR p.approver_id = ?) AND p.task_type IN ('assigned', 'applied') AND p.status != 'draft' AND p.deleted_at IS NULL ORDER BY p.deadline ASC`).all(sub.id, sub.id, sub.id);
    } else {
      // 下属的行：仅按 assignee_id 归组
      plans = db.prepare(`SELECT p.*, uc.name AS creator_name, ua.name AS approver_name, us.name AS assignee_name FROM perf_tasks p LEFT JOIN users uc ON uc.id = p.creator_id LEFT JOIN users ua ON ua.id = p.approver_id LEFT JOIN users us ON us.id = p.assignee_id WHERE (',' || p.assignee_id || ',' LIKE '%,' || ? || ',%') AND p.task_type IN ('assigned', 'applied') AND p.status != 'draft' AND p.deleted_at IS NULL ORDER BY p.deadline ASC`).all(sub.id);
    }
    // 为任务附加 judge_id 和 self_score
    for (const p of plans as any[]) {
      if (['in_progress', 'pending_assessment'].includes(p.status)) {
        try {
          if (p.flow_type === 'application') {
            const { judgeId } = getAssessmentJudge(p.creator_id);
            if (judgeId) { p.judge_id = judgeId; p.judge_name = (db.prepare('SELECT name FROM users WHERE id = ?').get(judgeId) as any)?.name; }
          } else {
            p.judge_id = p.creator_id;
            p.judge_name = (db.prepare('SELECT name FROM users WHERE id = ?').get(p.creator_id) as any)?.name;
          }
        } catch {}
      }
    }
    sub.tasks = plans;
    const avgScore = (db.prepare("SELECT AVG(score) as avg FROM perf_tasks WHERE (',' || assignee_id || ',' LIKE '%,' || ? || ',%') AND score IS NOT NULL").get(sub.id) as any)?.avg;
    sub.score = avgScore ? Math.round(avgScore * 10) / 10 : null;
  }

  return res.json({ code: 0, data: subordinates });
});

export default router;
