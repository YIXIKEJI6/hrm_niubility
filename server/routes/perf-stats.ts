import express from 'express';
import { getDb } from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

// GET /api/perf/stats/overview?month=YYYY-MM
// 返回全员清单：基础信息 + 绩效与奖金 + 月度考评，与导出字段保持一致
router.get('/overview', (req, res) => {
  const { month } = req.query;
  const db = getDb();

  if (!month) {
    return res.status(400).json({ code: 1, message: '请提供查询月份，格式例如 2026-03' });
  }

  try {
    // ── 全员基础信息 ──
    const users = db.prepare(`
      SELECT u.id, u.name, u.department_id, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.status = 'active'
      ORDER BY d.name, u.name
    `).all() as any[];

    // ── Source A: 直接任务奖金 (assigned/applied) ──
    const directTasks = db.prepare(`
      SELECT id, title, score, bonus, assignee_id
      FROM perf_tasks
      WHERE task_type IN ('assigned', 'applied')
        AND status IN ('completed', 'rewarded', 'assessed', 'pending_reward')
        AND deleted_at IS NULL
        AND (strftime('%Y-%m', COALESCE(rewarded_at, assessed_at, updated_at)) = ?)
    `).all(month) as any[];

    // ── Source B: 赏金池分配奖金（审批后实际分配） ──
    const bountyDistributions = db.prepare(`
      SELECT prd.user_id, prd.bonus_amount, prd.perf_score,
             pt.id as task_id, pt.title as task_title
      FROM pool_reward_distributions prd
      JOIN pool_reward_plans prp ON prd.reward_plan_id = prp.id
      JOIN perf_tasks pt ON prp.pool_task_id = pt.id
      WHERE prp.status != 'draft'
        AND prd.bonus_amount > 0
        AND strftime('%Y-%m', prd.created_at) = ?
    `).all(month) as any[];

    // ── Source C: 月度四大维度考评 ──
    const evalData = db.prepare(`
      SELECT user_id, self_score, manager_score, prof_score, peer_score, final_score
      FROM monthly_evaluations
      WHERE month = ?
    `).all(month) as any[];

    // ── 拼装全员数据 ──
    const statsResult = users.map(u => {
      const userDirectTasks = directTasks.filter(p => p.assignee_id === u.id);
      const userBountyDist = bountyDistributions.filter(b => b.user_id === u.id);
      const userEval = evalData.find(e => e.user_id === u.id);

      const directScore = userDirectTasks.reduce((sum, t) => sum + (t.score || 0), 0);
      const directBonus = userDirectTasks.reduce((sum, t) => sum + (t.bonus || 0), 0);
      const bountyScore = userBountyDist.reduce((sum, b) => sum + (b.perf_score || 0), 0);
      const bountyBonus = userBountyDist.reduce((sum, b) => sum + (b.bonus_amount || 0), 0);

      const total_score = directScore + bountyScore;
      const total_bonus = directBonus + bountyBonus;

      const tasks = [
        ...userDirectTasks.map(t => ({
          id: `TASK-${t.id}`,
          title: t.title,
          source: 'direct' as const,
          score: t.score || 0,
          bonus: t.bonus || 0
        })),
        ...userBountyDist.map(b => ({
          id: `TASK-${b.task_id}`,
          title: b.task_title,
          source: 'bounty' as const,
          score: b.perf_score || 0,
          bonus: b.bonus_amount || 0
        }))
      ];

      return {
        user_id: u.id,
        user_name: u.name,
        department_name: u.department_name || '未分配',
        total_score,
        total_bonus,
        tasks,
        // 月度考评
        eval_self_score: userEval?.self_score || 0,
        eval_manager_score: userEval?.manager_score || 0,
        eval_prof_score: userEval?.prof_score || 0,
        eval_peer_score: userEval?.peer_score || 0,
        eval_final_score: userEval?.final_score || 0,
      };
    });

    // 按总奖金倒序，再按考评倒序
    statsResult.sort((a, b) => b.total_bonus - a.total_bonus || b.total_score - a.total_score);

    res.json({ code: 0, data: statsResult, message: '查询成功' });
  } catch (err: any) {
    console.error('Perf Stats Error:', err);
    res.status(500).json({ code: 1, message: '核算绩效数据时发生错误' });
  }
});

export default router;
