import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * PDCA 状态监管
 * P(Plan)  = draft / pending_review 
 * D(Do)    = approved / in_progress  
 * C(Check) = pending_assessment / assessed  
 * A(Act)   = completed / pending_reward
 */
function getPDCAPhase(status: string): string {
  switch (status) {
    case 'draft':
    case 'pending_review':
      return 'P';
    case 'approved':
    case 'in_progress':
      return 'D';
    case 'pending_assessment':
    case 'assessed':
      return 'C';
    case 'completed':
    case 'pending_reward':
      return 'A';
    case 'rejected':
      return 'P'; // 驳回 → 回到计划阶段
    default:
      return 'P';
  }
}

function getPhaseLabel(phase: string): string {
  const map: Record<string, string> = { P: '计划', D: '执行', C: '检查', A: '处理' };
  return map[phase] || phase;
}

// ─── PDCA Overview ──────────────────────────────────────────────────
router.get('/overview', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 获取所有非草稿计划
  const plans = db.prepare(`
    SELECT pp.id, pp.title, pp.status, pp.progress, pp.deadline, pp.created_at,
           pp.updated_at, pp.category, pp.quarter, pp.score,
           pp.creator_id, pp.assignee_id, pp.approver_id,
           u1.name as creator_name, u2.name as assignee_name,
           u3.name as approver_name, d.name as department_name
    FROM perf_plans pp
    LEFT JOIN users u1 ON pp.creator_id = u1.id
    LEFT JOIN users u2 ON pp.assignee_id = u2.id
    LEFT JOIN users u3 ON pp.approver_id = u3.id
    LEFT JOIN departments d ON u2.department_id = d.id
    WHERE pp.status != 'draft'
    ORDER BY pp.deadline ASC
  `).all() as any[];

  // 为每个计划计算 PDCA 阶段和时间健康度
  const enriched = plans.map(plan => {
    const phase = getPDCAPhase(plan.status);
    const created = new Date(plan.created_at);
    const deadline = plan.deadline ? new Date(plan.deadline) : null;

    let timeHealthy = 'normal'; // normal / warning / danger / completed
    let daysRemaining: number | null = null;
    let totalDays: number | null = null;
    let elapsedDays: number | null = null;
    let timeProgress = 0;

    if (deadline) {
      daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      totalDays = Math.ceil((deadline.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      elapsedDays = Math.ceil((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      timeProgress = totalDays > 0 ? Math.min(Math.round((elapsedDays / totalDays) * 100), 100) : 100;

      if (plan.status === 'completed') {
        timeHealthy = 'completed';
      } else if (daysRemaining < 0) {
        timeHealthy = 'danger'; // 已超期
      } else if (daysRemaining <= 7) {
        timeHealthy = 'warning'; // 7天内到期
      }
    }

    // 时间 vs 进度偏差分析
    const progressGap = timeProgress - (plan.progress || 0); // 正值 = 进度滞后

    return {
      ...plan,
      phase,
      phaseLabel: getPhaseLabel(phase),
      daysRemaining,
      totalDays,
      elapsedDays,
      timeProgress,
      timeHealthy,
      progressGap,
    };
  });

  // PDCA 阶段分布统计
  const phaseStats = { P: 0, D: 0, C: 0, A: 0 };
  enriched.forEach(p => { phaseStats[p.phase as keyof typeof phaseStats]++; });

  // 健康度统计
  const healthStats = { normal: 0, warning: 0, danger: 0, completed: 0 };
  enriched.forEach(p => { healthStats[p.timeHealthy as keyof typeof healthStats]++; });

  // 滞后项目 (时间进度 > 任务进度 20% 以上)
  const laggingPlans = enriched
    .filter(p => p.progressGap > 20 && p.timeHealthy !== 'completed')
    .sort((a, b) => b.progressGap - a.progressGap);

  // 按部门分组的 PDCA 分布
  const deptPDCA: Record<string, { P: number; D: number; C: number; A: number; total: number }> = {};
  enriched.forEach(p => {
    const dept = p.department_name || '未分配';
    if (!deptPDCA[dept]) deptPDCA[dept] = { P: 0, D: 0, C: 0, A: 0, total: 0 };
    deptPDCA[dept][p.phase as keyof typeof phaseStats]++;
    deptPDCA[dept].total++;
  });

  // 即将到期 (7天内)
  const upcomingDeadlines = enriched
    .filter(p => p.daysRemaining !== null && p.daysRemaining >= 0 && p.daysRemaining <= 7 && p.timeHealthy !== 'completed')
    .sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));

  return res.json({
    code: 0,
    data: {
      plans: enriched,
      phaseStats,
      healthStats,
      laggingPlans,
      upcomingDeadlines,
      departmentPDCA: Object.entries(deptPDCA).map(([dept, stats]) => ({ dept, ...stats })),
      total: enriched.length,
    }
  });
});

export default router;
