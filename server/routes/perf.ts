import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { transitionPlan } from '../services/workflow';

const router = Router();

// 创建绩效计划
router.post('/plans', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, category, assignee_id, approver_id, department_id, difficulty, deadline, quarter, alignment, target_value } = req.body;
  const db = getDb();

  const result = db.prepare(
    `INSERT INTO perf_plans (title, description, category, creator_id, assignee_id, approver_id, department_id, difficulty, deadline, quarter, alignment, target_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(title, description, category, req.userId, assignee_id || req.userId, approver_id, department_id, difficulty, deadline, quarter, alignment, target_value);

  return res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

// 查询绩效列表
router.get('/plans', authMiddleware, (req: AuthRequest, res) => {
  const { status, quarter, category, userId } = req.query;
  const db = getDb();
  let sql = 'SELECT * FROM perf_plans WHERE 1=1';
  const params: any[] = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (quarter) { sql += ' AND quarter = ?'; params.push(quarter); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (userId) { sql += ' AND (creator_id = ? OR assignee_id = ?)'; params.push(userId, userId); }

  sql += ' ORDER BY created_at DESC';
  const plans = db.prepare(sql).all(...params);
  return res.json({ code: 0, data: plans });
});

// 绩效计划详情
router.get('/plans/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ code: 404, message: '绩效计划不存在' });
  return res.json({ code: 0, data: plan });
});

// 编辑绩效计划
router.put('/plans/:id', authMiddleware, (req: AuthRequest, res) => {
  const { title, description, category, difficulty, deadline, quarter, alignment, target_value } = req.body;
  const db = getDb();

  db.prepare(
    `UPDATE perf_plans SET title=?, description=?, category=?, difficulty=?, deadline=?, quarter=?, alignment=?, target_value=?, updated_at=? WHERE id = ? AND status = 'draft'`
  ).run(title, description, category, difficulty, deadline, quarter, alignment, target_value, new Date().toISOString(), req.params.id);

  return res.json({ code: 0, message: '更新成功' });
});

// 提交审批
router.post('/plans/:id/submit', authMiddleware, async (req: AuthRequest, res) => {
  const result = await transitionPlan(Number(req.params.id), 'pending_review', req.userId!);
  return res.json({ code: result.success ? 0 : 400, message: result.message });
});

// 审批通过
router.post('/plans/:id/approve', authMiddleware, async (req: AuthRequest, res) => {
  const result = await transitionPlan(Number(req.params.id), 'approved', req.userId!);
  return res.json({ code: result.success ? 0 : 400, message: result.message });
});

// 驳回
router.post('/plans/:id/reject', authMiddleware, async (req: AuthRequest, res) => {
  const result = await transitionPlan(Number(req.params.id), 'rejected', req.userId!, { comment: req.body.reason });
  return res.json({ code: result.success ? 0 : 400, message: result.message });
});

// 考核评分
router.post('/plans/:id/assess', authMiddleware, async (req: AuthRequest, res) => {
  // 先过渡到 pending_assessment，再到 assessed
  const step1 = await transitionPlan(Number(req.params.id), 'pending_assessment', req.userId!);
  if (!step1.success) return res.json({ code: 400, message: step1.message });
  const result = await transitionPlan(Number(req.params.id), 'assessed', req.userId!, { score: req.body.score });
  return res.json({ code: result.success ? 0 : 400, message: result.message });
});

// 发放奖励
router.post('/plans/:id/reward', authMiddleware, async (req: AuthRequest, res) => {
  const step1 = await transitionPlan(Number(req.params.id), 'pending_reward', req.userId!, { bonus: req.body.bonus });
  if (!step1.success) return res.json({ code: 400, message: step1.message });
  const result = await transitionPlan(Number(req.params.id), 'completed', req.userId!);
  return res.json({ code: result.success ? 0 : 400, message: result.message });
});

// 更新进度
router.put('/plans/:id/progress', authMiddleware, (req: AuthRequest, res) => {
  const { progress, comment } = req.body;
  const db = getDb();
  const plan = db.prepare('SELECT progress FROM perf_plans WHERE id = ?').get(req.params.id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

  db.prepare('UPDATE perf_plans SET progress = ?, updated_at = ? WHERE id = ?').run(progress, new Date().toISOString(), req.params.id);
  db.prepare('INSERT INTO perf_logs (plan_id, user_id, action, old_value, new_value, comment) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.id, req.userId, 'progress_update', String(plan.progress), String(progress), comment);

  return res.json({ code: 0, message: '进度已更新' });
});

// 进度日志
router.get('/plans/:id/logs', authMiddleware, (req, res) => {
  const db = getDb();
  const logs = db.prepare('SELECT * FROM perf_logs WHERE plan_id = ? ORDER BY created_at DESC').all(req.params.id);
  return res.json({ code: 0, data: logs });
});

// 我的待审批列表
router.get('/my-approvals', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const plans = db.prepare("SELECT * FROM perf_plans WHERE approver_id = ? AND status = 'pending_review' ORDER BY created_at DESC").all(req.userId);
  return res.json({ code: 0, data: plans });
});

// 历史绩效记录
router.get('/history', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const plans = db.prepare("SELECT * FROM perf_plans WHERE (creator_id = ? OR assignee_id = ?) AND status = 'completed' ORDER BY created_at DESC").all(req.userId, req.userId);
  return res.json({ code: 0, data: plans });
});

export default router;
