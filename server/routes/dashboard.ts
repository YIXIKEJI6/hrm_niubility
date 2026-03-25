import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 个人仪表盘
router.get('/personal', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.userId;

  const user = db.prepare('SELECT id, name, title, avatar_url FROM users WHERE id = ?').get(userId);
  const activeGoals = db.prepare("SELECT * FROM perf_plans WHERE assignee_id = ? AND status NOT IN ('draft', 'completed') ORDER BY deadline").all(userId);
  const completedCount = (db.prepare("SELECT COUNT(*) as c FROM perf_plans WHERE assignee_id = ? AND status = 'completed'").get(userId) as any)?.c || 0;
  const avgScore = (db.prepare("SELECT AVG(score) as avg FROM perf_plans WHERE assignee_id = ? AND score IS NOT NULL").get(userId) as any)?.avg;
  const latestFeed = db.prepare('SELECT * FROM team_feeds ORDER BY created_at DESC LIMIT 5').all();
  const notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 10").all(userId);

  return res.json({
    code: 0,
    data: { user, activeGoals, completedCount, avgScore: avgScore ? Math.round(avgScore * 10) / 10 : null, latestFeed, notifications },
  });
});

// 团队仪表盘
router.get('/team', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const userId = req.userId;
  const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(userId) as any;
  if (!user) return res.status(404).json({ code: 404 });

  const members = db.prepare('SELECT id, name, title, avatar_url FROM users WHERE department_id = ?').all(user.department_id) as any[];
  const teamStats = {
    total_members: members.length,
    active_plans: (db.prepare("SELECT COUNT(*) as c FROM perf_plans WHERE department_id = ? AND status NOT IN ('draft', 'completed')").get(user.department_id) as any)?.c || 0,
    overdue_plans: (db.prepare("SELECT COUNT(*) as c FROM perf_plans WHERE department_id = ? AND deadline < date('now') AND status NOT IN ('completed')").get(user.department_id) as any)?.c || 0,
    avg_progress: (db.prepare("SELECT AVG(progress) as avg FROM perf_plans WHERE department_id = ? AND status = 'in_progress'").get(user.department_id) as any)?.avg || 0,
  };

  return res.json({ code: 0, data: { members, stats: teamStats } });
});

// 公司绩效池概览
router.get('/company', authMiddleware, (_req, res) => {
  const db = getDb();
  const poolTasks = db.prepare('SELECT * FROM pool_tasks ORDER BY created_at DESC').all();
  const stats = {
    open_count: (db.prepare("SELECT COUNT(*) as c FROM pool_tasks WHERE status = 'open'").get() as any)?.c || 0,
    in_progress_count: (db.prepare("SELECT COUNT(*) as c FROM pool_tasks WHERE status = 'in_progress'").get() as any)?.c || 0,
    total_bonus: (db.prepare("SELECT COALESCE(SUM(bonus), 0) as total FROM pool_tasks").get() as any)?.total || 0,
  };

  return res.json({ code: 0, data: { poolTasks, stats } });
});

// 全景数据
router.get('/panorama', authMiddleware, (_req, res) => {
  const db = getDb();

  const totalEmployees = (db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'active'").get() as any)?.c || 0;
  const totalPlans = (db.prepare('SELECT COUNT(*) as c FROM perf_plans').get() as any)?.c || 0;
  const completedPlans = (db.prepare("SELECT COUNT(*) as c FROM perf_plans WHERE status = 'completed'").get() as any)?.c || 0;
  const avgScore = (db.prepare("SELECT AVG(score) as avg FROM perf_plans WHERE score IS NOT NULL").get() as any)?.avg;
  const totalBonus = (db.prepare("SELECT COALESCE(SUM(bonus), 0) as total FROM perf_plans WHERE status = 'completed'").get() as any)?.total || 0;

  // 按部门统计
  const deptStats = db.prepare(`
    SELECT d.name, d.id, 
      COUNT(DISTINCT u.id) as member_count,
      COUNT(DISTINCT pp.id) as plan_count,
      AVG(pp.progress) as avg_progress
    FROM departments d
    LEFT JOIN users u ON u.department_id = d.id
    LEFT JOIN perf_plans pp ON pp.department_id = d.id
    GROUP BY d.id
    ORDER BY avg_progress DESC
  `).all();

  return res.json({
    code: 0,
    data: {
      totalEmployees, totalPlans, completedPlans,
      completionRate: totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100 * 10) / 10 : 0,
      avgScore: avgScore ? Math.round(avgScore * 10) / 10 : null,
      totalBonus, deptStats,
    },
  });
});

// 部门热力图
router.get('/heatmap', authMiddleware, (_req, res) => {
  const db = getDb();
  const heatmap = db.prepare(`
    SELECT d.name, d.id,
      COALESCE(AVG(pp.progress), 0) as avg_progress,
      COUNT(CASE WHEN pp.status = 'completed' THEN 1 END) as completed,
      COUNT(pp.id) as total
    FROM departments d
    LEFT JOIN perf_plans pp ON pp.department_id = d.id
    GROUP BY d.id
    ORDER BY avg_progress DESC
  `).all();

  return res.json({ code: 0, data: heatmap });
});

export default router;
