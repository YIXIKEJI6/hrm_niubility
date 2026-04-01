/**
 * SMART 任务 STAR 复盘路由 (个人目标/团队目标)
 * POST   /api/perf/star/:planId        提交/更新自己的 STAR（随时发起）
 * GET    /api/perf/star/:planId/mine   获取我的 STAR
 * GET    /api/perf/star/:planId        获取任务所有人 STAR
 */
import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// ── 辅助：获取人员在任务中的角色 (R/A 等)
function getUserRoleInPlan(plan: any, userId: string): string | null {
  if (!plan) return null;
  const uid = String(userId).toLowerCase();
  
  if (typeof plan.assignee_id === 'string' && plan.assignee_id.toLowerCase().includes(uid)) return 'R';
  if (typeof plan.approver_id === 'string' && plan.approver_id.toLowerCase() === uid) return 'A';
  if (typeof plan.creator_id === 'string' && plan.creator_id.toLowerCase() === uid) return 'A'; // Creator is often the A for personal goals
  if (typeof plan.dept_head_id === 'string' && plan.dept_head_id.toLowerCase() === uid) return 'Leader';
  
  const c = plan.collaborators || '';
  if (c.toLowerCase().includes(uid)) return 'C/I';
  
  return null;
}

// POST /api/perf/star/:planId — 提交/更新我的 STAR
router.post('/:planId', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const planId = parseInt(req.params.planId);
  const userId = req.userId!;

  const plan = db.prepare('SELECT * FROM perf_plans WHERE id = ?').get(planId) as any;
  if (!plan) return res.status(404).json({ code: 404, message: '任务不存在' });

  let roleName = getUserRoleInPlan(plan, userId);
  
  // 允许任何相关人填写 (不仅仅是 R/A，如果是管理员或 HR 也可以自由记录复盘)
  if (!roleName) {
    const isSuperAdmin = db.prepare('SELECT is_super_admin FROM users WHERE id = ?').get(userId) as any;
    if (isSuperAdmin && isSuperAdmin.is_super_admin === 1) {
      roleName = 'Admin';
    } else {
      return res.status(403).json({ code: 403, message: '仅任务相关人员可填写 STAR 复盘' });
    }
  }

  const { situation, task_desc, action, result, submit } = req.body;
  const isSubmit = submit ? 1 : 0;
  
  const existing = db.prepare('SELECT id, is_submitted FROM perf_star_reports WHERE plan_id = ? AND user_id = ?')
    .get(planId, userId) as any;
    
  if (existing?.is_submitted === 1) {
    return res.status(400).json({ code: 400, message: 'STAR 复盘已提交，不可修改' });
  }

  const now = new Date().toISOString();
  if (existing) {
    db.prepare(`
      UPDATE perf_star_reports 
      SET situation = ?, task_desc = ?, action = ?, result = ?, role_name = ?,
          is_submitted = ?, submitted_at = CASE WHEN ? = 1 THEN ? ELSE submitted_at END
      WHERE id = ?
    `).run(situation, task_desc, action, result, roleName, isSubmit, isSubmit, now, existing.id);
  } else {
    db.prepare(`
      INSERT INTO perf_star_reports (plan_id, user_id, role_name, situation, task_desc, action, result, is_submitted, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN ? ELSE NULL END)
    `).run(planId, userId, roleName, situation, task_desc, action, result, isSubmit, isSubmit, now);
  }

  res.json({ code: 0, message: submit ? 'STAR 复盘提交成功' : 'STAR 草稿已保存' });
});

// GET /api/perf/star/:planId/mine — 获取我的 STAR
router.get('/:planId/mine', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const planId = parseInt(req.params.planId);
  
  const record = db.prepare('SELECT * FROM perf_star_reports WHERE plan_id = ? AND user_id = ?')
    .get(planId, req.userId);
    
  res.json({ code: 0, data: record || null });
});

// GET /api/perf/star/:planId — 获取所有人 STAR
router.get('/:planId', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const planId = parseInt(req.params.planId);
  
  const records = db.prepare(`
    SELECT r.*, u.name as user_name, u.avatar 
    FROM perf_star_reports r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.plan_id = ?
    ORDER BY r.created_at ASC
  `).all(planId);
  
  res.json({ code: 0, data: records });
});

export default router;
