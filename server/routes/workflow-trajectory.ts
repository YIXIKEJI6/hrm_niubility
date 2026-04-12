import { Router } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { WorkflowEngine, WORKFLOWS } from '../services/workflow-engine';
import { getAuditLogs } from '../services/audit-logger';

const router = Router();

function getUsersMap(ids: string[]) {
  if (!ids.length) return {};
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const users = db.prepare(`SELECT id, name FROM users WHERE id IN (${placeholders})`).all(...ids) as any[];
  const map: Record<string, string> = {};
  users.forEach(u => map[u.id] = u.name);
  return map;
}

router.get('/:type/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { type, id } = req.params;
  const db = getDb();

  try {
    let trajectory: any[] = [];

    // ==========================================
    // 1. 提案流 (PROPOSAL_CREATE)
    // ==========================================
    if (type === 'proposal') {
      const task = db.prepare(`
        SELECT t.*, u.name as initiator_name 
        FROM perf_tasks t 
        JOIN users u ON t.creator_id = u.id 
        WHERE t.id = ?
      `).get(id) as any;
      
      if (!task) return res.status(404).json({ code: 404, message: '提案不存在' });

      const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PROPOSAL_CREATE, { initiatorId: task.creator_id });
      const currentStatus = task.proposal_status || 'draft'; // draft, proposing, pending_hr, pending_admin, approved, rejected
      
      // Node 1: 发起提案
      trajectory.push({
        seq: 1,
        name: '发起提案',
        status: ['draft', 'proposing'].includes(currentStatus) ? 'current' : 'past',
        assignees: [{ id: task.creator_id, name: task.initiator_name }],
        is_auto_skipped: false
      });

      // Node 2: HRBP审核
      const node2 = nodes.find(n => n.seq === 2);
      const isReject = currentStatus === 'rejected';
      
      let hrStatus = 'future';
      if (node2?.isSkipped) hrStatus = 'skipped';
      else if (currentStatus === 'pending_hr') hrStatus = 'current';
      else if (['pending_admin', 'approved', 'published'].includes(currentStatus) || task.hr_reviewer_id) hrStatus = 'past';
      else if (isReject && task.hr_reviewer_id) hrStatus = 'rejected';

      const hrMap = getUsersMap(node2?.assignees || []);
      const hrAssignees = (node2?.assignees || []).map((uid: string) => ({ id: uid, name: hrMap[uid] || uid }));

      trajectory.push({
        seq: 2,
        name: '人事风控核查',
        status: hrStatus,
        assignees: hrAssignees,
        is_auto_skipped: node2?.isSkipped || false,
        is_escalated: node2?.isEscalated || false,
        actual_reviewer_id: task.hr_reviewer_id || null,
        comment: isReject && hrStatus === 'rejected' ? task.reject_reason : null,
      });

      // Node 3: 总经理终审
      const node3 = nodes.find(n => n.seq === 3);
      let gmStatus = 'future';
      if (node3?.isSkipped) gmStatus = 'skipped';
      else if (currentStatus === 'pending_admin') gmStatus = 'current';
      else if (['approved', 'published'].includes(currentStatus) || task.admin_reviewer_id) gmStatus = 'past';
      else if (isReject && task.admin_reviewer_id) gmStatus = 'rejected';

      const gmMap = getUsersMap(node3?.assignees || []);
      const gmAssignees = (node3?.assignees || []).map((uid: string) => ({ id: uid, name: gmMap[uid] || uid }));

      trajectory.push({
        seq: 3,
        name: '高管 / 总办审批',
        status: gmStatus,
        assignees: gmAssignees,
        is_auto_skipped: node3?.isSkipped || false,
        is_escalated: node3?.isEscalated || false,
        actual_reviewer_id: task.admin_reviewer_id || null,
        comment: isReject && gmStatus === 'rejected' ? task.reject_reason : null,
      });

      // Node 4: 发布认领
      const taskStatus = task.status || 'draft';
      // 赏金执行阶段的完成状态集合（包括 rewarded）
      const bountyDoneStatuses = ['completed', 'rewarded'];
      const bountyActiveStatuses = ['approved', 'published', 'claiming', 'in_progress', ...bountyDoneStatuses];
      const isBountyActive = task.task_type === 'bounty' && bountyActiveStatuses.includes(taskStatus);
      trajectory.push({
        seq: 4,
        name: '发布认领',
        status: isBountyActive ? 'past' : (['approved', 'published'].includes(currentStatus) ? 'current' : 'future'),
        assignees: [],
        is_auto: true
      });

      // 赏金榜已审批后追加执行阶段节点
      if (task.task_type === 'bounty') {
        // 查询参与者
        const participants = db.prepare(
          `SELECT p.user_id, u.name FROM pool_participants p JOIN users u ON p.user_id = u.id WHERE p.pool_task_id = ?`
        ).all(Number(id)) as any[];

        // Node 5: 团队认领
        const claimingPast = ['in_progress', ...bountyDoneStatuses].includes(taskStatus);
        trajectory.push({
          seq: 5,
          name: `团队认领 (${participants.length}人)`,
          status: taskStatus === 'claiming' ? 'current' : claimingPast ? 'past' : 'future',
          assignees: participants.map((p: any) => ({ id: p.user_id, name: p.name }))
        });

        // Node 6: 任务执行
        const execPast = bountyDoneStatuses.includes(taskStatus) || task.star_phase_started_at;
        trajectory.push({
          seq: 6,
          name: '任务执行',
          status: taskStatus === 'in_progress' && !task.star_phase_started_at ? 'current' : execPast ? 'past' : 'future',
          assignees: participants.map((p: any) => ({ id: p.user_id, name: p.name }))
        });

        // Node 7: STAR复盘（仅计已提交的报告）
        const starReports = db.prepare(
          `SELECT s.user_id, u.name FROM pool_star_reports s JOIN users u ON s.user_id = u.id WHERE s.pool_task_id = ? AND s.is_submitted = 1`
        ).all(Number(id)) as any[];
        // STAR 全部提交后即为 past，进入奖金分配阶段
        const allStarSubmitted = starReports.length >= participants.length && participants.length > 0;
        trajectory.push({
          seq: 7,
          name: `STAR复盘 (${starReports.length}/${participants.length})`,
          status: (allStarSubmitted || taskStatus === 'rewarded') ? 'past' : task.star_phase_started_at ? 'current' : 'future',
          assignees: starReports.length > 0
            ? starReports.map((s: any) => ({ id: s.user_id, name: s.name }))
            : participants.map((p: any) => ({ id: p.user_id, name: p.name }))
        });

        // Node 8: 奖金分配（A角色发起→HR审核→管理层确认→发放）
        const rewardPlan = db.prepare(
          `SELECT id, status FROM pool_reward_plans WHERE pool_task_id = ? LIMIT 1`
        ).get(Number(id)) as any;
        const rewardStatusMap: Record<string, string> = {
          draft: '待填写',
          pending_hr: 'HR审核中',
          pending_admin: '管理层确认中',
          approved: '待发放',
          paid: '已发放'
        };
        const rpStatus = rewardPlan?.status || 'draft';
        const rewardLabel = rewardStatusMap[rpStatus] || rpStatus;
        trajectory.push({
          seq: 8,
          name: `奖金分配 (${rewardLabel})`,
          status: taskStatus === 'rewarded' ? 'past' : (allStarSubmitted || taskStatus === 'completed') ? 'current' : 'future',
          assignees: [{ id: task.creator_id, name: task.initiator_name }]
        });

        // Node 9: 任务归档（仅 rewarded 后才算归档完成）
        trajectory.push({
          seq: 9,
          name: '任务归档',
          status: taskStatus === 'rewarded' ? 'past' : 'future',
          assignees: [],
          is_auto: true
        });
      }

      // Inject timestamps from audit logs
      const auditLogs = getAuditLogs('proposal', id) as any[];
      trajectory.forEach((node: any) => {
        if (node.timestamp) return;
        const log = auditLogs.find((l: any) => {
          if (node.seq === 1) return l.action === 'create' || l.action === 'submit';
          if (node.seq === 2) return l.from_status === 'pending_hr';
          if (node.seq === 3) return l.from_status === 'pending_admin';
          if (node.seq === 4) return l.action === 'publish' || l.to_status === 'approved';
          return false;
        });
        if (log) node.timestamp = log.created_at;
      });

      return res.json({ code: 0, data: trajectory });
    }

    // ==========================================
    // 2. 奖励分配流 (REWARD_PLAN)
    // ==========================================
    else if (type === 'reward_plan') {
      const plan = db.prepare(`
        SELECT p.*, t.title as task_title, u.name as initiator_name
        FROM pool_reward_plans p
        JOIN perf_tasks t ON p.pool_task_id = t.id
        JOIN users u ON t.creator_id = u.id
        WHERE p.id = ?
      `).get(id) as any;

      if (!plan) return res.status(404).json({ code: 404, message: '分配方案不存在' });
      
      const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.REWARD_PLAN, { initiatorId: plan.task_creator_id });
      const currentStatus = plan.status || 'draft'; // draft, pending_hr, pending_admin, completed, rejected

      // Node 1: 制定分配方案
      trajectory.push({
        seq: 1,
        name: '制定分配方案',
        status: currentStatus === 'draft' ? 'current' : 'past',
        assignees: [{ id: plan.initiator_id || plan.task_creator_id, name: plan.initiator_name }],
        is_auto_skipped: false
      });

      // Node 2: HR审核
      const hrbpNode = nodes.find((n: any) => n.resolver_type === 'hrbp');
      let hrStatus = 'future';
      if (hrbpNode?.isSkipped) hrStatus = 'skipped';
      else if (currentStatus === 'pending_hr') hrStatus = 'current';
      else if (['pending_admin', 'approved', 'paid'].includes(currentStatus) || plan.hr_reviewer_id) hrStatus = 'past';
      else if (currentStatus === 'rejected' && plan.hr_reviewer_id) hrStatus = 'rejected';

      const hrMap = getUsersMap(hrbpNode?.assignees || []);
      trajectory.push({
        seq: 2,
        name: 'HR审核',
        status: hrStatus,
        assignees: (hrbpNode?.assignees || []).map((uid: string) => ({ id: uid, name: hrMap[uid] || uid })),
        is_auto_skipped: hrbpNode?.isSkipped || false,
        is_escalated: hrbpNode?.isEscalated || false,
        actual_reviewer_id: plan.hr_reviewer_id || null,
        comment: currentStatus === 'rejected' && hrStatus === 'rejected' ? plan.reject_reason : null,
      });

      // Node 3: 高管/总办审批
      const gmNode = nodes.find((n: any) => n.resolver_type === 'gm');
      let gmStatus = 'future';
      if (gmNode?.isSkipped) gmStatus = 'skipped';
      else if (currentStatus === 'pending_admin') gmStatus = 'current';
      else if (['approved', 'paid'].includes(currentStatus) || plan.admin_reviewer_id) gmStatus = 'past';
      else if (currentStatus === 'rejected' && plan.admin_reviewer_id) gmStatus = 'rejected';

      const gmMap = getUsersMap(gmNode?.assignees || []);
      trajectory.push({
        seq: 3,
        name: '高管/总办审批',
        status: gmStatus,
        assignees: (gmNode?.assignees || []).map((uid: string) => ({ id: uid, name: gmMap[uid] || uid })),
        is_auto_skipped: gmNode?.isSkipped || false,
        is_escalated: gmNode?.isEscalated || false,
        actual_reviewer_id: plan.admin_reviewer_id || null,
        comment: currentStatus === 'rejected' && gmStatus === 'rejected' ? plan.reject_reason : null,
      });

      // Node 4: HR确认打款
      const hrUsers = db.prepare("SELECT id, name FROM users WHERE role IN ('hr', 'admin')").all() as any[];
      trajectory.push({
        seq: 4,
        name: 'HR确认打款',
        status: currentStatus === 'paid' ? 'past' : currentStatus === 'approved' ? 'current' : 'future',
        assignees: hrUsers.map((u: any) => ({ id: u.id, name: u.name })),
      });

      // Inject timestamps from audit logs
      const rewardAuditLogs = getAuditLogs('reward_plan', id) as any[];
      trajectory.forEach((node: any) => {
        if (node.timestamp) return;
        const log = rewardAuditLogs.find((l: any) => {
          if (node.seq === 1) return l.action === 'create' || l.action === 'submit';
          if (node.seq === 2) return l.from_status === 'pending_hr';
          if (node.seq === 3) return l.from_status === 'pending_admin';
          if (node.seq === 4) return l.action === 'mark_paid' || l.to_status === 'completed';
          return false;
        });
        if (log) node.timestamp = log.created_at;
      });

      return res.json({ code: 0, data: trajectory });
    }

    // ==========================================
    // 3. 个人计划流 (PERF_PLAN) - 拼装引擎节点与真实日志
    // ==========================================
    else if (type === 'perf_plan') {
      const plan = db.prepare(`SELECT p.*, u.name as initiator_name FROM perf_tasks p JOIN users u ON p.creator_id = u.id WHERE p.id = ?`).get(id) as any;
      if (!plan) return res.status(404).json({ code: 404, message: '单据不存在' });

      const currentStatus = plan.status;
      const allLogs = db.prepare('SELECT * FROM perf_logs WHERE plan_id = ? ORDER BY created_at ASC').all(id) as any[];

      // ==========================================
      // 3.1a 申请流 (APPLICATION FLOW) — flow2
      // draft → pending_receipt → pending_review → in_progress
      // 部门内部事宜，单级审批，无需跨级审核
      // ==========================================
      if (plan.flow_type === 'application') {
        const receiptStatusMap: Record<string, string> = JSON.parse(plan.receipt_status || '{}');
        const userIds = Object.keys(receiptStatusMap);
        const userMap = getUsersMap(userIds);
        const totalCount = userIds.length;
        const confirmedCount = Object.values(receiptStatusMap).filter(s => s === 'confirmed').length;
        const isAllConfirmed = totalCount > 0 && confirmedCount === totalCount;
        const pastReceipt = isAllConfirmed || ['pending_review', 'in_progress', 'pending_assessment', 'assessed', 'completed', 'rejected'].includes(currentStatus);

        // Node 1: 员工发起申请
        const dispatchLog = allLogs.find(l => l.action === 'dispatch');
        trajectory.push({
          seq: 1,
          name: '员工发起申请',
          status: 'past',
          assignees: [{ id: plan.creator_id, name: plan.initiator_name }],
          timestamp: dispatchLog?.created_at
        });

        // Node 2: R签收确认
        trajectory.push({
          seq: 2,
          name: `R签收确认 (${confirmedCount}/${totalCount})`,
          status: pastReceipt ? 'past' : (currentStatus === 'pending_receipt' ? 'current' : 'future'),
          assignees: userIds.map(uid => ({ id: uid, name: userMap[uid] || uid })),
          is_auto_skipped: totalCount === 0
        });

        // Node 3: 上级主管审批（从组织架构解析直属上级，而非 approver_id）
        const approveLog = allLogs.find(l => ['approve', 'reject'].includes(l.action) && l.role === 'dept_head');
        // 也尝试匹配 status_change 日志中非 creator 的审批操作
        const statusApproveLog = !approveLog ? allLogs.find(l => l.action === 'status_change' && l.new_value === 'pending_dept_review' && l.user_id !== plan.creator_id) || allLogs.find(l => l.action === 'status_change' && l.old_value === 'pending_review' && ['in_progress', 'approved'].includes(l.new_value) && l.user_id !== plan.creator_id) : null;
        const effectiveLog = approveLog || statusApproveLog;
        let approveStatus = 'future';
        if (approveLog) approveStatus = approveLog.action === 'reject' ? 'rejected' : 'past';
        else if (statusApproveLog) approveStatus = 'past';
        else if (currentStatus === 'pending_review') approveStatus = 'current';
        else if (['in_progress', 'pending_assessment', 'assessed', 'completed'].includes(currentStatus)) approveStatus = 'past';

        // 用 WorkflowEngine 解析直属上级作为审批人，而非 plan.approver_id（后者是负责人A）
        const engineNodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PERF_PLAN, { initiatorId: plan.creator_id });
        const reviewNode = engineNodes.find(n => n.seq === 2);
        const reviewerIds = reviewNode?.assignees || [];
        const reviewerMap = getUsersMap(reviewerIds);
        trajectory.push({
          seq: 3,
          name: '上级主管审批',
          status: approveStatus,
          assignees: reviewerIds.map((uid: string) => ({ id: uid, name: reviewerMap[uid] || uid })),
          actual_reviewer_id: effectiveLog?.user_id || null,
          comment: effectiveLog?.comment,
          timestamp: effectiveLog?.created_at
        });

        // Node 4: 任务启动执行（in_progress 时保持 current，表示执行中）
        trajectory.push({
          seq: 4,
          name: '任务启动执行',
          status: ['pending_assessment', 'assessed', 'completed'].includes(currentStatus) ? 'past' : (currentStatus === 'in_progress' ? 'current' : 'future'),
          assignees: [],
          is_auto: true
        });

        // Node 5: 待考核评级（进入 pending_assessment 即为 past）
        trajectory.push({
          seq: 5,
          name: '待考核评级',
          status: ['pending_assessment', 'assessed', 'completed'].includes(currentStatus) ? 'past' : 'future',
          assignees: [],
          is_auto: true
        });

        // Node 6: A自评（负责人自评打分）— 自评完成后才轮到考评
        {
          const selfScoreLog = allLogs.find(l => l.action === 'self_score');
          const hasSelfScore = !!(selfScoreLog || plan.self_score);
          const approverMap = getUsersMap(plan.approver_id ? [plan.approver_id] : []);
          trajectory.push({
            seq: 6,
            name: '自评',
            status: hasSelfScore || ['assessed', 'completed'].includes(currentStatus) ? 'past' : currentStatus === 'pending_assessment' ? 'current' : 'future',
            assignees: plan.approver_id ? [{ id: plan.approver_id, name: approverMap[plan.approver_id] || plan.approver_id }] : [],
            timestamp: selfScoreLog?.created_at
          });
        }

        // Node 7: 评级打分（评分人：上级主管）— 仅自评完成后才变 current
        {
          const { getAssessmentJudge } = await import('../services/workflow');
          const { judgeId } = getAssessmentJudge(plan.creator_id);
          const judgeMap = getUsersMap(judgeId ? [judgeId] : []);
          const assessLog = allLogs.find(l => l.action === 'status_change' && l.new_value === 'assessed');
          const hasSelfScore = !!(allLogs.find(l => l.action === 'self_score') || plan.self_score);
          trajectory.push({
            seq: 7,
            name: '考评',
            status: assessLog || ['assessed', 'completed'].includes(currentStatus) ? 'past' : (currentStatus === 'pending_assessment' && hasSelfScore) ? 'current' : 'future',
            assignees: judgeId ? [{ id: judgeId, name: judgeMap[judgeId] || judgeId }] : [],
            timestamp: assessLog?.created_at
          });
        }

        // Node 8: 任务归档（自动触发）
        trajectory.push({
          seq: 8,
          name: '任务归档',
          status: currentStatus === 'completed' ? 'past' : 'future',
          assignees: [],
          is_auto: true
        });

        return res.json({ code: 0, data: trajectory });
      }

      // ==========================================
      // 3.1b 下发派发流 (DISPATCH FLOW) — flow1
      // draft → pending_receipt → in_progress (A手动发车)
      // ==========================================
      if (plan.receipt_status || currentStatus === 'pending_receipt') {
        const receiptStatusMap: Record<string, string> = JSON.parse(plan.receipt_status || '{}');
        const userIds = Object.keys(receiptStatusMap);
        const userMap = getUsersMap(userIds);
        const totalCount = userIds.length;
        const confirmedCount = Object.values(receiptStatusMap).filter(s => s === 'confirmed').length;

        // Node 1: 主管下发
        const dispatchLog = allLogs.find(l => l.action === 'dispatch');
        trajectory.push({
          seq: 1,
          name: '主管下发任务',
          status: 'past',
          assignees: [{ id: plan.creator_id, name: plan.initiator_name }],
          timestamp: dispatchLog?.created_at
        });

        // Node 2: 全员签收
        const isAllConfirmed = totalCount > 0 && confirmedCount === totalCount;
        trajectory.push({
          seq: 2,
          name: `全员签收回复 (${confirmedCount}/${totalCount})`,
          status: isAllConfirmed ? 'past' : 'current',
          assignees: userIds.map(uid => ({ id: uid, name: userMap[uid] || uid })),
          is_auto_skipped: false
        });

        // Node 3: 启动执行（in_progress 时保持 current，表示任务执行中）
        const startLog = allLogs.find(l => l.action === 'start_task');
        trajectory.push({
          seq: 3,
          name: '启动执行 (负责人发起)',
          status: ['pending_assessment', 'assessed', 'completed'].includes(currentStatus) ? 'past' : (currentStatus === 'in_progress' || isAllConfirmed ? 'current' : 'future'),
          assignees: plan.approver_id ? [{ id: plan.approver_id, name: (db.prepare('SELECT name FROM users WHERE id = ?').get(plan.approver_id) as any)?.name || plan.approver_id }] : [],
          timestamp: startLog?.created_at
        });

        // Node 4: 待考核评级（自动触发，进入 pending_assessment 即为 past）
        trajectory.push({
          seq: 4,
          name: '待考核评级',
          status: ['pending_assessment', 'assessed', 'completed'].includes(currentStatus) ? 'past' : 'future',
          assignees: [],
          is_auto: true
        });

        // Node 5: A自评（负责人自评打分）— 自评完成后才轮到考评
        {
          const selfScoreLog = allLogs.find(l => l.action === 'self_score');
          const hasSelfScore = !!(selfScoreLog || plan.self_score);
          const approverMap = getUsersMap(plan.approver_id ? [plan.approver_id] : []);
          trajectory.push({
            seq: 5,
            name: '自评',
            status: hasSelfScore || ['assessed', 'completed'].includes(currentStatus) ? 'past' : currentStatus === 'pending_assessment' ? 'current' : 'future',
            assignees: plan.approver_id ? [{ id: plan.approver_id, name: approverMap[plan.approver_id] || plan.approver_id }] : [],
            timestamp: selfScoreLog?.created_at
          });
        }

        // Node 6: 评级打分（评分人：创建者）— 仅自评完成后才变 current
        {
          const scorerId = plan.creator_id;
          const scorerName = (db.prepare('SELECT name FROM users WHERE id = ?').get(scorerId) as any)?.name || scorerId;
          const assessLog = allLogs.find(l => l.action === 'status_change' && l.new_value === 'assessed');
          const hasSelfScore = !!(allLogs.find(l => l.action === 'self_score') || plan.self_score);
          trajectory.push({
            seq: 6,
            name: '考评',
            status: assessLog || ['assessed', 'completed'].includes(currentStatus) ? 'past' : (currentStatus === 'pending_assessment' && hasSelfScore) ? 'current' : 'future',
            assignees: [{ id: scorerId, name: scorerName }],
            timestamp: assessLog?.created_at
          });
        }

        // Node 7: 任务归档（自动触发）
        trajectory.push({
          seq: 7,
          name: '任务归档',
          status: currentStatus === 'completed' ? 'past' : 'future',
          assignees: [],
          is_auto: true
        });

        return res.json({ code: 0, data: trajectory });
      }

      // ==========================================
      // 3.2 正常审批流 (APPROVAL FLOW)
      // ==========================================
      const nodes = WorkflowEngine.resolveAssignees(WORKFLOWS.PERF_PLAN, { initiatorId: plan.creator_id });
      const lastSubmitIndex = [...allLogs].reverse().findIndex(l => l.action === 'submit' || l.action === 'resubmit');
      const logs = lastSubmitIndex >= 0 ? allLogs.slice(allLogs.length - 1 - lastSubmitIndex) : allLogs;
      
      // Node 1: 发起人拟定计划
      const submitLog = logs.find(l => l.action === 'submit' || l.action === 'resubmit');
      trajectory.push({
        seq: 1,
        name: '发起申请',
        status: submitLog ? 'past' : (currentStatus === 'draft' ? 'current' : 'past'),
        assignees: [{ id: plan.creator_id, name: plan.initiator_name }],
        comment: submitLog?.comment,
        timestamp: submitLog?.created_at
      });

      // Node 2: 直属主管审核
      const node2 = nodes.find(n => n.seq === 2);
      const isReject = currentStatus === 'rejected';
      const n2Log = logs.find(l => l.role === 'dept_head' && ['approve', 'reject'].includes(l.action));
      let n2Status = 'future';
      
      if (node2?.isSkipped) n2Status = 'skipped';
      else if (n2Log) n2Status = n2Log.action === 'reject' ? 'rejected' : 'past';
      else if (currentStatus === 'pending_review' && plan.approver_id && node2?.assignees?.includes(plan.approver_id)) n2Status = 'current';
      else if (currentStatus === 'pending_review' && node2?.assignees?.length > 0) n2Status = 'current';

      const n2Map = getUsersMap(node2?.assignees || []);
      trajectory.push({
        seq: 2,
        name: '部门一级审核',
        status: n2Status,
        assignees: (node2?.assignees || []).map((uid: string) => ({ id: uid, name: n2Map[uid] || uid })),
        is_auto_skipped: node2?.isSkipped || false,
        is_escalated: node2?.isEscalated || false,
        actual_reviewer_id: n2Log ? n2Log.user_id : null,
        comment: n2Log?.comment,
        timestamp: n2Log?.created_at
      });

      // Node 3: 跨级主管审核
      const node3 = nodes.find(n => n.seq === 3);
      const n3Log = logs.find(l => l.role === 'parent_dept_head' && ['approve', 'reject'].includes(l.action));
      let n3Status = 'future';

      if (node3?.isSkipped) n3Status = 'skipped';
      else if (n3Log) n3Status = n3Log.action === 'reject' ? 'rejected' : 'past';
      else if (currentStatus === 'pending_review' && plan.approver_id && node3?.assignees?.includes(plan.approver_id)) n3Status = 'current';

      const n3Map = getUsersMap(node3?.assignees || []);
      trajectory.push({
        seq: 3,
        name: '上溯跨级审核',
        status: n3Status,
        assignees: (node3?.assignees || []).map((uid: string) => ({ id: uid, name: n3Map[uid] || uid })),
        is_auto_skipped: node3?.isSkipped || false,
        is_escalated: node3?.isEscalated || false,
        actual_reviewer_id: n3Log ? n3Log.user_id : null,
        comment: n3Log?.comment,
        timestamp: n3Log?.created_at
      });

      // Node 4: HRBP备案
      const node4 = nodes.find(n => n.seq === 4);
      const n4Log = logs.find(l => l.role === 'hrbp');
      let n4Status = 'future';
      if (node4?.isSkipped) n4Status = 'skipped';
      else if (n4Log) n4Status = 'past';
      else if (['in_progress', 'completed', 'assessed'].includes(currentStatus)) n4Status = 'past'; // 已经过关

      const n4Map = getUsersMap(node4?.assignees || []);
      trajectory.push({
        seq: 4,
        name: 'HRBP 备案通知',
        status: n4Status,
        assignees: (node4?.assignees || []).map((uid: string) => ({ id: uid, name: n4Map[uid] || uid })),
        is_auto_skipped: node4?.isSkipped || false,
        is_escalated: node4?.isEscalated || false
      });

      // Node 5: 任务执行（自动触发）
      trajectory.push({
        seq: 5,
        name: '任务执行',
        status: ['in_progress', 'pending_assessment', 'assessed', 'completed'].includes(currentStatus) ? 'past' : 'future',
        assignees: [],
        is_auto: true
      });

      // Node 6: 待考核评级（自动触发）
      trajectory.push({
        seq: 6,
        name: '待考核评级',
        status: currentStatus === 'pending_assessment' ? 'current' : ['assessed', 'completed'].includes(currentStatus) ? 'past' : 'future',
        assignees: [],
        is_auto: true
      });

      // Node 7: A自评（负责人自评打分）
      {
        const selfScoreLog2 = allLogs.find(l => l.action === 'self_score');
        const approverMap2 = getUsersMap(plan.approver_id ? [plan.approver_id] : []);
        trajectory.push({
          seq: 7,
          name: '自评',
          status: selfScoreLog2 || plan.self_score ? 'past' : currentStatus === 'pending_assessment' ? 'current' : 'future',
          assignees: plan.approver_id ? [{ id: plan.approver_id, name: approverMap2[plan.approver_id] || plan.approver_id }] : [],
          timestamp: selfScoreLog2?.created_at
        });
      }

      // Node 8: 考评
      {
        const scorerId = plan.creator_id;
        const scorerName = (db.prepare('SELECT name FROM users WHERE id = ?').get(scorerId) as any)?.name || scorerId;
        const assessLog2 = allLogs.find(l => l.action === 'status_change' && l.new_value === 'assessed');
        trajectory.push({
          seq: 8,
          name: '考评',
          status: assessLog2 || currentStatus === 'assessed' || currentStatus === 'completed' ? 'past' : currentStatus === 'pending_assessment' ? 'current' : 'future',
          assignees: [{ id: scorerId, name: scorerName }],
          timestamp: assessLog2?.created_at
        });
      }

      // Node 9: 任务归档（自动触发）
      trajectory.push({
        seq: 9,
        name: '任务归档',
        status: currentStatus === 'completed' ? 'past' : 'future',
        assignees: [],
        is_auto: true
      });

      return res.json({ code: 0, data: trajectory });
    }

    return res.status(400).json({ code: 400, message: '不支持的业务类型' });

  } catch (error: any) {
    console.error('[Trajectory Error]', error);
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// ── 完整审计日志 API ──
router.get('/audit-log/:type/:id', authMiddleware, (req: AuthRequest, res) => {
  const { type, id } = req.params;
  try {
    const logs = getAuditLogs(type, id);
    return res.json({ code: 0, data: logs });
  } catch (error: any) {
    console.error('[AuditLog Error]', error);
    return res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
