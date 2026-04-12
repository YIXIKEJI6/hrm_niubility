import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createNotification } from './notifications';
import { sendCardMessage } from '../services/message';

const router = Router();

// ─── 过程监管 Overview ─────────────────────────────────────────────
router.get('/overview', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // 状态管道 (各状态数量)
  const pipeline = db.prepare(
    "SELECT status, COUNT(*) as count FROM perf_tasks WHERE deleted_at IS NULL GROUP BY status"
  ).all() as any[];
  const statusPipeline: Record<string, number> = {};
  pipeline.forEach(p => statusPipeline[p.status] = p.count);

  // 超期计划 (deadline < today 且未完成)
  const overduePlans = db.prepare(`
    SELECT pp.id, pp.title, pp.assignee_id, pp.deadline, pp.status, pp.progress,
           u.name as assignee_name, d.name as department_name
    FROM perf_tasks pp
    LEFT JOIN users u ON pp.assignee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE pp.deadline < ? AND pp.status NOT IN ('completed', 'draft') AND pp.deleted_at IS NULL
    ORDER BY pp.deadline ASC
  `).all(today) as any[];

  overduePlans.forEach(p => {
    const deadlineDate = new Date(p.deadline);
    const todayDate = new Date(today);
    p.days_overdue = Math.ceil((todayDate.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
  });

  // 卡点分析 (在当前状态停留 > 3天的计划)
  const bottlenecks = db.prepare(`
    SELECT pp.id, pp.title, pp.status, pp.approver_id, pp.updated_at,
           u.name as approver_name, u2.name as assignee_name
    FROM perf_tasks pp
    LEFT JOIN users u ON pp.approver_id = u.id
    LEFT JOIN users u2 ON pp.assignee_id = u2.id
    WHERE pp.status IN ('pending_review', 'in_progress') AND pp.deleted_at IS NULL
    ORDER BY pp.updated_at ASC
  `).all() as any[];

  bottlenecks.forEach((b: any) => {
    const updated = new Date(b.updated_at);
    b.stuck_days = Math.ceil((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));
  });

  const significantBottlenecks = bottlenecks.filter((b: any) => b.stuck_days >= 3);

  // 审批人效率排名
  const approverStats = db.prepare(`
    SELECT pp.approver_id, u.name as approver_name,
           COUNT(CASE WHEN pp.status = 'pending_review' THEN 1 END) as pending_count,
           COUNT(CASE WHEN pp.status NOT IN ('draft', 'pending_review') THEN 1 END) as reviewed_count
    FROM perf_tasks pp
    LEFT JOIN users u ON pp.approver_id = u.id
    WHERE pp.approver_id IS NOT NULL AND pp.deleted_at IS NULL
    GROUP BY pp.approver_id
    ORDER BY pending_count DESC
  `).all() as any[];

  // 计算审批人的平均审批时长
  for (const approver of approverStats) {
    const logs = db.prepare(`
      SELECT pl1.created_at as submit_time, pl2.created_at as review_time
      FROM perf_logs pl1
      JOIN perf_logs pl2 ON pl1.plan_id = pl2.plan_id 
        AND pl2.user_id = ? 
        AND pl2.action IN ('approve', 'reject')
      JOIN perf_tasks pp ON pl1.plan_id = pp.id AND pp.approver_id = ?
      WHERE pl1.action = 'submit'
      GROUP BY pl1.plan_id
    `).all(approver.approver_id, approver.approver_id) as any[];

    if (logs.length > 0) {
      const total = logs.reduce((s: number, l: any) => {
        return s + (new Date(l.review_time).getTime() - new Date(l.submit_time).getTime()) / (1000 * 60 * 60);
      }, 0);
      approver.avg_hours = Math.round((total / logs.length) * 10) / 10;
    } else {
      approver.avg_hours = null;
    }
  }

  // 最近操作日志 (最近 30 条)
  const recentLogs = db.prepare(`
    SELECT pl.*, pp.title as plan_title, u.name as user_name, d.name as department_name
    FROM perf_logs pl
    LEFT JOIN perf_tasks pp ON pl.plan_id = pp.id
    LEFT JOIN users u ON pl.user_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    ORDER BY pl.created_at DESC
    LIMIT 30
  `).all();

  return res.json({
    code: 0,
    data: {
      statusPipeline,
      overduePlans,
      bottlenecks: significantBottlenecks,
      approverEfficiency: approverStats,
      recentLogs,
      summary: {
        totalOverdue: overduePlans.length,
        totalBottlenecks: significantBottlenecks.length,
        totalPending: statusPipeline['pending_review'] || 0,
      }
    }
  });
});

// ─── 催办 ──────────────────────────────────────────────────────────
router.post('/nudge', authMiddleware, (req: AuthRequest, res) => {
  const { plan_id, approver_id } = req.body;
  const db = getDb();

  const plan = db.prepare('SELECT * FROM perf_tasks WHERE id = ?').get(plan_id) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '计划不存在' });

  const targetId = approver_id || plan.approver_id;
  if (!targetId) return res.json({ code: 400, message: '无审批人' });

  // 创建通知
  createNotification(
    [targetId],
    'nudge',
    '⏰ 催办提醒',
    `「${plan.title}」需要您尽快处理审批`,
    '/workflows'
  );

  // 尝试发送企微消息
  try {
    sendCardMessage(
      [targetId],
      '⏰ 催办提醒',
      `绩效计划「${plan.title}」正在等待您的审批，请尽快处理。`,
      `${process.env.APP_URL || 'http://localhost:3000'}/workflows`
    );
  } catch (e) {}

  // 记录日志
  db.prepare(
    'INSERT INTO perf_logs (plan_id, user_id, action, comment) VALUES (?, ?, ?, ?)'
  ).run(plan_id, req.userId, 'nudge', `催办审批人: ${targetId}`);

  return res.json({ code: 0, message: '催办已发送' });
});

export default router;
