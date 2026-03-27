import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── 数据驾驶舱 Overview ─────────────────────────────────────────────
router.get('/overview', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();

  // 活跃计划数
  const activePlans = (db.prepare(
    "SELECT COUNT(*) as c FROM perf_plans WHERE status NOT IN ('draft', 'completed')"
  ).get() as any)?.c || 0;

  // 平均进度
  const avgProgress = (db.prepare(
    "SELECT AVG(progress) as avg FROM perf_plans WHERE status = 'in_progress'"
  ).get() as any)?.avg || 0;

  // 审批效率 (提交→审批平均时长, 小时)
  const approvalLogs = db.prepare(`
    SELECT 
      pl1.plan_id,
      pl1.created_at as submit_time,
      pl2.created_at as review_time
    FROM perf_logs pl1
    JOIN perf_logs pl2 ON pl1.plan_id = pl2.plan_id 
      AND pl2.action IN ('approve', 'reject')
      AND pl2.created_at > pl1.created_at
    WHERE pl1.action = 'submit'
    GROUP BY pl1.plan_id
  `).all() as any[];
  
  let avgApprovalHours = 0;
  if (approvalLogs.length > 0) {
    const totalHours = approvalLogs.reduce((sum, log) => {
      const diff = new Date(log.review_time).getTime() - new Date(log.submit_time).getTime();
      return sum + diff / (1000 * 60 * 60);
    }, 0);
    avgApprovalHours = Math.round((totalHours / approvalLogs.length) * 10) / 10;
  }

  // 绩效达标率 (score >= 80)
  const scored = db.prepare("SELECT COUNT(*) as c FROM perf_plans WHERE score IS NOT NULL").get() as any;
  const achieved = db.prepare("SELECT COUNT(*) as c FROM perf_plans WHERE score >= 80").get() as any;
  const achievementRate = scored?.c > 0 ? Math.round((achieved?.c / scored?.c) * 100) / 100 : 0;

  // 奖金总额
  const totalBudget = (db.prepare(
    "SELECT SUM(bonus) as total FROM perf_plans WHERE bonus IS NOT NULL"
  ).get() as any)?.total || 0;

  // 状态分布
  const statusDist = db.prepare(
    "SELECT status, COUNT(*) as count FROM perf_plans WHERE status != 'draft' GROUP BY status"
  ).all() as any[];
  const statusDistribution: Record<string, number> = {};
  statusDist.forEach(s => statusDistribution[s.status] = s.count);

  // 季度对比趋势
  const quarterTrend = db.prepare(`
    SELECT 
      quarter,
      COUNT(*) as total_plans,
      ROUND(AVG(score), 1) as avg_score,
      SUM(CASE WHEN bonus IS NOT NULL THEN bonus ELSE 0 END) as total_bonus,
      ROUND(AVG(progress), 0) as avg_progress
    FROM perf_plans 
    WHERE quarter IS NOT NULL AND quarter != ''
    GROUP BY quarter
    ORDER BY quarter
  `).all();

  // 类型分布
  const categoryDist = db.prepare(
    "SELECT category, COUNT(*) as count FROM perf_plans WHERE category IS NOT NULL AND category != '' GROUP BY category"
  ).all();

  // 部门分布 (JOIN departments)
  const deptDist = db.prepare(`
    SELECT d.name as department, COUNT(*) as count, 
           ROUND(AVG(pp.progress), 0) as avg_progress,
           ROUND(AVG(pp.score), 1) as avg_score
    FROM perf_plans pp 
    LEFT JOIN users u ON pp.creator_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE d.name IS NOT NULL
    GROUP BY d.name
  `).all();

  // 总计划数
  const totalPlans = (db.prepare("SELECT COUNT(*) as c FROM perf_plans").get() as any)?.c || 0;

  return res.json({
    code: 0,
    data: {
      activePlans,
      totalPlans,
      avgProgress: Math.round(avgProgress),
      avgApprovalHours,
      achievementRate,
      totalBudget,
      statusDistribution,
      quarterTrend,
      categoryDistribution: categoryDist,
      departmentDistribution: deptDist
    }
  });
});

// ─── 多维透析 ──────────────────────────────────────────────────────
router.get('/dimensions', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const { group_by, quarter, category, department, status } = req.query;

  let baseQuery = `
    SELECT pp.*, u.name as creator_name, d.name as department_name
    FROM perf_plans pp
    LEFT JOIN users u ON pp.creator_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (quarter) { baseQuery += ' AND pp.quarter = ?'; params.push(quarter); }
  if (category) { baseQuery += ' AND pp.category = ?'; params.push(category); }
  if (department) { baseQuery += ' AND d.name = ?'; params.push(department); }
  if (status) { baseQuery += ' AND pp.status = ?'; params.push(status); }

  const allPlans = db.prepare(baseQuery).all(...params) as any[];

  // 评分分布 (0-20, 20-40, 40-60, 60-80, 80-100)
  const scoreDistribution = [0, 0, 0, 0, 0];
  allPlans.forEach(p => {
    if (p.score != null) {
      const bucket = Math.min(Math.floor(p.score / 20), 4);
      scoreDistribution[bucket]++;
    }
  });

  // 进度分布
  const progressBuckets: Record<string, number> = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
  allPlans.forEach(p => {
    const prog = p.progress || 0;
    if (prog <= 25) progressBuckets['0-25']++;
    else if (prog <= 50) progressBuckets['26-50']++;
    else if (prog <= 75) progressBuckets['51-75']++;
    else progressBuckets['76-100']++;
  });

  // 按维度分组
  const groupKey = group_by === 'department' ? 'department_name' :
                   group_by === 'quarter' ? 'quarter' :
                   group_by === 'category' ? 'category' :
                   group_by === 'assignee' ? 'assignee_id' : 'department_name';

  const groupMap = new Map<string, any[]>();
  allPlans.forEach(plan => {
    const key = (plan as any)[groupKey] || '未分类';
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(plan);
  });

  const groups = Array.from(groupMap.entries()).map(([label, items]) => {
    const scored = items.filter(i => i.score != null);
    const achieved = scored.filter(i => i.score >= 80);
    return {
      label,
      count: items.length,
      avg_score: scored.length > 0 ? Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length * 10) / 10 : null,
      avg_progress: Math.round(items.reduce((s, i) => s + (i.progress || 0), 0) / items.length),
      total_bonus: items.reduce((s, i) => s + (i.bonus || 0), 0),
      achievement_rate: scored.length > 0 ? Math.round(achieved.length / scored.length * 100) : null,
      status_breakdown: items.reduce((acc: any, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {}),
    };
  }).sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0));

  // 人员排行 (top 10)
  const personRanking = db.prepare(`
    SELECT pp.assignee_id, u.name, d.name as department_name,
           COUNT(*) as plan_count,
           ROUND(AVG(pp.score), 1) as avg_score,
           SUM(pp.bonus) as total_bonus,
           ROUND(AVG(pp.progress), 0) as avg_progress
    FROM perf_plans pp
    LEFT JOIN users u ON pp.assignee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE pp.assignee_id IS NOT NULL
    GROUP BY pp.assignee_id
    ORDER BY avg_score DESC NULLS LAST
    LIMIT 10
  `).all();

  // 可用筛选值
  const availableQuarters = db.prepare("SELECT DISTINCT quarter FROM perf_plans WHERE quarter IS NOT NULL AND quarter != '' ORDER BY quarter").all();
  const availableCategories = db.prepare("SELECT DISTINCT category FROM perf_plans WHERE category IS NOT NULL AND category != '' ORDER BY category").all();
  const availableDepts = db.prepare("SELECT DISTINCT d.name FROM users u JOIN departments d ON u.department_id = d.id WHERE d.name IS NOT NULL ORDER BY d.name").all();

  return res.json({
    code: 0,
    data: {
      total: allPlans.length,
      groups,
      scoreDistribution,
      progressBuckets,
      personRanking,
      filters: {
        quarters: availableQuarters.map((q: any) => q.quarter),
        categories: availableCategories.map((c: any) => c.category),
        departments: availableDepts.map((d: any) => d.name),
      }
    }
  });
});

export default router;
