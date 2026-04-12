import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── 财务核算汇总 ─────────────────────────────────────────────────
router.get('/summary', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const { quarter } = req.query;

  // 当前季度
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  const currentQuarter = (quarter as string) || `${now.getFullYear()} Q${q}`;

  // 查询预算
  const budget = db.prepare(
    "SELECT SUM(budget_amount) as total FROM perf_budgets WHERE quarter = ?"
  ).get(currentQuarter) as any;
  const totalBudget = budget?.total || 0;

  // 已支出 — 直接任务 + 赏金池已分配
  const directSpent = (db.prepare(
    "SELECT SUM(bonus) as total FROM perf_tasks WHERE bonus IS NOT NULL AND quarter = ? AND task_type IN ('assigned', 'applied') AND status = 'completed' AND deleted_at IS NULL"
  ).get(currentQuarter) as any)?.total || 0;
  const bountySpent = (db.prepare(`
    SELECT SUM(prd.bonus_amount) as total
    FROM pool_reward_distributions prd
    JOIN pool_reward_plans prp ON prd.reward_plan_id = prp.id
    JOIN perf_tasks pt ON prp.pool_task_id = pt.id
    WHERE prp.status IN ('approved', 'paid') AND pt.quarter = ? AND pt.deleted_at IS NULL
  `).get(currentQuarter) as any)?.total || 0;
  const spent = directSpent + bountySpent;

  // 已评分待发放（仅直接任务，赏金池通过 reward_plans 走审批流）
  const pendingPayout = (db.prepare(
    "SELECT SUM(bonus) as total FROM perf_tasks WHERE bonus IS NOT NULL AND quarter = ? AND task_type IN ('assigned', 'applied') AND status IN ('assessed', 'pending_reward') AND deleted_at IS NULL"
  ).get(currentQuarter) as any)?.total || 0;

  // 按部门汇总（直接任务奖金 + 赏金池分配奖金）
  const byDepartment = db.prepare(`
    SELECT d.name as dept,
           COUNT(DISTINCT pp.id) as plan_count,
           COUNT(DISTINCT pp.assignee_id) as headcount,
           SUM(CASE WHEN pp.task_type IN ('assigned','applied') AND pp.bonus IS NOT NULL THEN pp.bonus ELSE 0 END) as direct_spent,
           ROUND(AVG(pp.score), 1) as avg_score
    FROM perf_tasks pp
    LEFT JOIN users u ON pp.assignee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE pp.quarter = ? AND d.name IS NOT NULL AND pp.deleted_at IS NULL
    GROUP BY d.name
    ORDER BY direct_spent DESC
  `).all(currentQuarter) as any[];

  // 补充赏金池分配到部门
  const bountyByDept = db.prepare(`
    SELECT d.name as dept, SUM(prd.bonus_amount) as bounty_spent
    FROM pool_reward_distributions prd
    JOIN pool_reward_plans prp ON prd.reward_plan_id = prp.id
    JOIN perf_tasks pt ON prp.pool_task_id = pt.id
    JOIN users u ON prd.user_id = u.id
    JOIN departments d ON u.department_id = d.id
    WHERE prp.status != 'draft' AND pt.quarter = ? AND pt.deleted_at IS NULL
    GROUP BY d.name
  `).all(currentQuarter) as any[];
  const bountyDeptMap = new Map(bountyByDept.map((b: any) => [b.dept, b.bounty_spent || 0]));
  const byDepartmentMerged = byDepartment.map(d => ({
    ...d,
    spent: (d.direct_spent || 0) + (bountyDeptMap.get(d.dept) || 0)
  })).sort((a: any, b: any) => b.spent - a.spent);

  // 按人员汇总（直接任务 + 赏金池分配）
  const directByPerson = db.prepare(`
    SELECT pp.assignee_id, u.name, d.name as dept,
           COUNT(*) as plans_completed,
           SUM(CASE WHEN pp.bonus IS NOT NULL THEN pp.bonus ELSE 0 END) as direct_bonus,
           ROUND(AVG(pp.score), 1) as avg_score
    FROM perf_tasks pp
    LEFT JOIN users u ON pp.assignee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE pp.quarter = ? AND pp.task_type IN ('assigned','applied') AND pp.assignee_id IS NOT NULL AND pp.deleted_at IS NULL
    GROUP BY pp.assignee_id
  `).all(currentQuarter) as any[];

  const bountyByPerson = db.prepare(`
    SELECT prd.user_id as assignee_id, SUM(prd.bonus_amount) as bounty_bonus
    FROM pool_reward_distributions prd
    JOIN pool_reward_plans prp ON prd.reward_plan_id = prp.id
    JOIN perf_tasks pt ON prp.pool_task_id = pt.id
    WHERE prp.status != 'draft' AND pt.quarter = ? AND pt.deleted_at IS NULL
    GROUP BY prd.user_id
  `).all(currentQuarter) as any[];
  const bountyPersonMap = new Map(bountyByPerson.map((b: any) => [b.assignee_id, b.bounty_bonus || 0]));

  const personMap = new Map<string, any>();
  for (const p of directByPerson) {
    personMap.set(p.assignee_id, { ...p, total_bonus: (p.direct_bonus || 0) + (bountyPersonMap.get(p.assignee_id) || 0) });
    bountyPersonMap.delete(p.assignee_id);
  }
  // Users who only have bounty distributions
  for (const [userId, bonus] of bountyPersonMap) {
    const u = db.prepare('SELECT u.name, d.name as dept FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = ?').get(userId) as any;
    personMap.set(userId, { assignee_id: userId, name: u?.name, dept: u?.dept, plans_completed: 0, avg_score: null, total_bonus: bonus });
  }
  const byPerson = Array.from(personMap.values()).sort((a: any, b: any) => b.total_bonus - a.total_bonus);

  // 季度对比
  const quarterComparison = db.prepare(`
    SELECT quarter,
           SUM(CASE WHEN bonus IS NOT NULL THEN bonus ELSE 0 END) as spent,
           COUNT(*) as plan_count,
           COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
    FROM perf_tasks
    WHERE quarter IS NOT NULL AND quarter != '' AND deleted_at IS NULL
    GROUP BY quarter
    ORDER BY quarter
  `).all();

  // 可用季度
  const availableQuarters = db.prepare(
    "SELECT DISTINCT quarter FROM perf_tasks WHERE quarter IS NOT NULL AND quarter != '' AND deleted_at IS NULL ORDER BY quarter"
  ).all();

  return res.json({
    code: 0,
    data: {
      currentQuarter,
      budget: totalBudget,
      spent,
      pendingPayout,
      utilization: totalBudget > 0 ? Math.round(spent / totalBudget * 100) / 100 : 0,
      byDepartment: byDepartmentMerged,
      byPerson,
      quarterComparison,
      availableQuarters: availableQuarters.map((q: any) => q.quarter),
    }
  });
});

// ─── 预算管理 ─────────────────────────────────────────────────────
router.get('/budgets', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const budgets = db.prepare(`
    SELECT pb.*, u.name as creator_name, d.name as department_name
    FROM perf_budgets pb
    LEFT JOIN users u ON pb.created_by = u.id
    LEFT JOIN departments d ON pb.department_id = d.id
    ORDER BY pb.quarter DESC, pb.created_at DESC
  `).all();
  return res.json({ code: 0, data: budgets });
});

router.post('/budgets', authMiddleware, (req: AuthRequest, res) => {
  const { quarter, department_id, budget_amount } = req.body;
  if (!quarter || !budget_amount) {
    return res.json({ code: 400, message: '季度和预算金额必填' });
  }
  const db = getDb();
  
  // 检查是否已存在
  const existing = db.prepare(
    'SELECT id FROM perf_budgets WHERE quarter = ? AND (department_id = ? OR (department_id IS NULL AND ? IS NULL))'
  ).get(quarter, department_id || null, department_id || null);
  
  if (existing) {
    db.prepare('UPDATE perf_budgets SET budget_amount = ? WHERE id = ?').run(budget_amount, (existing as any).id);
    return res.json({ code: 0, message: '预算已更新' });
  }

  db.prepare(
    'INSERT INTO perf_budgets (quarter, department_id, budget_amount, created_by) VALUES (?, ?, ?, ?)'
  ).run(quarter, department_id || null, budget_amount, req.userId);
  return res.json({ code: 0, message: '预算已设定' });
});

// ─── CSV 导出 ──────────────────────────────────────────────────────
router.get('/export', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const { quarter } = req.query;

  let query = `
    SELECT pp.id, pp.title, pp.category, pp.status, pp.quarter,
           pp.progress, pp.score, pp.bonus, pp.deadline,
           u1.name as creator_name, d.name as department_name,
           u2.name as assignee_name, u3.name as approver_name
    FROM perf_tasks pp
    LEFT JOIN users u1 ON pp.creator_id = u1.id
    LEFT JOIN departments d ON u1.department_id = d.id
    LEFT JOIN users u2 ON pp.assignee_id = u2.id
    LEFT JOIN users u3 ON pp.approver_id = u3.id
  `;
  const params: any[] = [];
  if (quarter) { query += ' WHERE pp.quarter = ?'; params.push(quarter); }
  query += ' ORDER BY pp.created_at DESC';

  const rows = db.prepare(query).all(...params) as any[];

  // 构建 CSV
  const headers = ['编号', '标题', '类型', '状态', '季度', '进度%', '评分', '奖金', '截止日期', '发起人', '部门', '执行人', '审批人'];
  const statusMap: Record<string, string> = {
    draft: '草稿', pending_review: '待审批', in_progress: '进行中',
    approved: '已通过', rejected: '已驳回', assessed: '已评分',
    completed: '已完成', pending_assessment: '待评估', pending_reward: '待发奖'
  };

  const csvLines = [
    '\uFEFF' + headers.join(','), // BOM for Excel UTF-8
    ...rows.map(r => [
      `PF-${String(r.id).padStart(6, '0')}`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      r.category || '',
      statusMap[r.status] || r.status,
      r.quarter || '',
      r.progress ?? '',
      r.score ?? '',
      r.bonus ?? '',
      r.deadline || '',
      r.creator_name || '',
      r.department_name || '',
      r.assignee_name || '',
      r.approver_name || ''
    ].join(','))
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="perf_report_${quarter || 'all'}.csv"`);
  return res.send(csvLines.join('\n'));
});

export default router;
