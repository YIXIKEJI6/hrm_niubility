import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import SmartFormInputs, { SmartData, decodeSmartDescription } from '../components/SmartFormInputs';
import { SmartGoalDisplayFromPlan } from '../components/SmartGoalDisplay';
import SmartTaskModal, { SmartTaskData } from '../components/SmartTaskModal';
import { buildSmartTaskData, buildSmartDescription } from '../utils/taskDataMapper';
import { parseUTC } from '../utils/dateUtils';

interface PerfPlan {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  progress: number;
  target_value: string;
  deadline: string;
  quarter: string;
  collaborators?: string;
  creator_id?: string;
  assignee_id?: string;
  approver_id?: string;
  dept_head_id?: string;
  smart_s?: string;
  smart_m?: string;
  smart_a?: string;
  smart_r?: string;
  smart_t?: string;
}

const statusMap: Record<string, { label: string, color: string, bg: string }> = {
  draft: { label: '草稿', color: 'text-slate-500', bg: 'bg-slate-100' },
  pending_review: { label: '待审批', color: 'text-amber-600', bg: 'bg-amber-100' },
  pending_dept_review: { label: '部门审批中', color: 'text-orange-600', bg: 'bg-orange-100' },
  pending_receipt: { label: '待签收', color: 'text-cyan-700', bg: 'bg-cyan-100' },
  in_progress: { label: '进行中', color: 'text-primary', bg: 'bg-blue-100' },
  completed: { label: '已结案', color: 'text-emerald-600', bg: 'bg-emerald-100' },
  approved: { label: '已批准', color: 'text-blue-600', bg: 'bg-blue-100' },
  rejected: { label: '被驳回', color: 'text-error', bg: 'bg-red-100' },
  returned: { label: '已退回', color: 'text-orange-600', bg: 'bg-orange-100' },
  pending_assessment: { label: '待评级', color: 'text-violet-600', bg: 'bg-violet-100' },
  assessed: { label: '已评级', color: 'text-violet-600', bg: 'bg-violet-100' },
};



export default function PersonalGoalsPanel() {

  const { currentUser } = useAuth();
  const [plans, setPlans] = useState<PerfPlan[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState<{id: string, name: string}[]>([]);
  const [newPlan, setNewPlan] = useState<SmartData & { quarter: string }>({
    title: '完成人事管理系统（HRM）性能优化与看板重构',
    target_value: '核心页面加载速度提升 50%（<1.5s），重构看板组件且达到 0 P0 Bug',
    resource: '需要前端团队提供 2 周专项开发工时，UI 设计配合打磨看板交互细节',
    relevance: '直接关联公司年度数字化转型战略，极大提升内网工具的操作效率',
    deadline: '2024-09-30',
    category: '技术',
    collaborators: '',
    quarter: '2024 Q3'
  });
  const [submitting, setSubmitting] = useState(false);
  // 二次编辑被驳回的目标
  const [editingPlan, setEditingPlan] = useState<PerfPlan | null>(null);
  const [editForm, setEditForm] = useState<SmartData>({ title: '', target_value: '', resource: '', relevance: '', deadline: '', category: '业务', collaborators: '' });
  const [resubmitting, setResubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PerfPlan | null>(null);
  const [actionPrompt, setActionPrompt] = useState<{
    type: string, title: string, desc: React.ReactNode, placeholder?: string, requireInput?: boolean,
    confirmText: string, confirmClass: string, icon: string, iconClass: string, onConfirm: (val: string) => void
  } | null>(null);


  useEffect(() => {
    if (currentUser?.id) {
      fetchPlans();
      fetchUsers();
    }
  }, [currentUser]);

  // 监听 STAR 广场评分完成事件
  useEffect(() => {
    const handleTaskUpdated = () => {
      setSelectedPlan(null);
      fetchPlans();
    };
    window.addEventListener('PERF_TASK_UPDATED', handleTaskUpdated);
    return () => window.removeEventListener('PERF_TASK_UPDATED', handleTaskUpdated);
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/org/users', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.code === 0) {
        setUsers(data.data.map((u: any) => ({ id: u.id, name: u.name })));
      }
    } catch (err) {}
  };

  const fetchPlans = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/perf/plans?userId=${currentUser?.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.code === 0) setPlans(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePlanSmart = async (data: SmartTaskData) => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { alert('登录已过期，请重新登录'); window.location.reload(); return; }
      const targetValue = `S: ${data.s}\nM: ${data.m}\nT: ${data.t}`;
      const createRes = await fetch('/api/perf/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: data.summary || '新目标',
          description: buildSmartDescription(data),
          category: data.taskType || '常规任务',
          target_value: targetValue,
          deadline: data.actTime || data.planTime || null,
          quarter: data.quarter || undefined,
          collaborators: data.c,
          informed_parties: data.i || undefined,
          delivery_target: data.dt || undefined,
          bonus: data.bonus ? parseFloat(data.bonus) : 0,
          max_participants: data.maxParticipants ? parseInt(data.maxParticipants) : 5,
          reward_type: data.rewardType || 'money',
          attachments: data.attachments || [],
          assignee_id: data.r || currentUser?.id,
          approver_id: data.a || currentUser?.id,
          flow_type: 'application'
        })
      });

      if (createRes.status === 401) { alert('登录已过期，请重新登录后再试'); localStorage.removeItem('token'); window.location.reload(); return; }
      const createData = await createRes.json();

      if (createData.code === 0 && createData.data?.id) {
        await fetch(`/api/perf/plans/${createData.data.id}/dispatch`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setIsModalOpen(false);
        fetchPlans();
      } else {
        alert(createData.message || '提交失败，请重试');
      }
    } catch (err) {
      console.error(err);
      alert('网络异常，请检查连接后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const submitProgress = async (id: number | string, progress: number) => {
    try {
      // Optimistic update to keep views perfectly in sync without deep re-fetching
      setPlans(prev => prev.map(p => p.id === id ? { ...p, progress } : p));
      setSelectedPlan(prev => prev && prev.id === id ? { ...prev, progress } : prev);

      const token = localStorage.getItem('token');
      const plan = plans.find(p => p.id === id);
      const isPoolTask = !!(plan as any)?.is_pool || ['bounty', 'proposal'].includes((plan as any)?.task_type);
      const poolId = (plan as any)?.pool_task_id || (isPoolTask ? id : null);
      const url = isPoolTask && poolId
        ? `/api/pool/tasks/${poolId}/progress`
        : `/api/perf/plans/${id}/progress`;
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ progress, comment: '员工自主更新进度' })
      });
    } catch (err) {
      console.error(err);
      fetchPlans(); // revert on fail
    }
  };

  // 打开驳回任务的编辑弹窗
  const handleOpenEdit = (plan: PerfPlan) => {
    setEditingPlan(plan);
    const decoded = decodeSmartDescription(plan.description || '');
    setEditForm({
      title: plan.title,
      resource: decoded.resource,
      relevance: decoded.relevance,
      category: plan.category,
      target_value: plan.target_value || '',
      deadline: plan.deadline || '',
      collaborators: plan.collaborators || '',
    });
  };

  // 重新提交被驳回的任务
  const handleResubmitSmart = async (data: SmartTaskData) => {
    if (!editingPlan) return;
    setResubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const targetValue = `S: ${data.s}\nM: ${data.m}\nT: ${data.t}`;

      const bodyPayload = {
        title: data.summary || editingPlan.title,
        description: buildSmartDescription(data),
        category: data.taskType || editingPlan.category,
        target_value: targetValue,
        deadline: data.t,
        collaborators: data.c,
        informed_parties: data.i || undefined,
        delivery_target: data.dt || undefined,
        bonus: data.bonus ? parseFloat(data.bonus) : 0,
        max_participants: data.maxParticipants ? parseInt(data.maxParticipants) : 5,
        reward_type: data.rewardType || 'money',
        attachments: data.attachments || [],
      };

      if (editingPlan.status === 'draft') {
        // 草稿：先 PUT 更新，再 POST submit
        await fetch(`/api/perf/plans/${editingPlan.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(bodyPayload),
        });
        await fetch(`/api/perf/plans/${editingPlan.id}/dispatch`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else {
        // 驳回：POST resubmit
        await fetch(`/api/perf/plans/${editingPlan.id}/resubmit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(bodyPayload),
        });
      }
      setEditingPlan(null);
      fetchPlans();
    } catch (err) {
      console.error(err);
    } finally {
      setResubmitting(false);
    }
  };

  const overallProgress = plans.length > 0 ? (plans.reduce((acc, p) => acc + (p.progress || 0), 0) / plans.length).toFixed(1) : 0;

  return (
    <div className="w-full text-on-surface antialiased">
      {/* Main Content Area */}
      <div>
        
          {/* Three Category Progress Bars */}
          {(() => {
            // 分类：季度 / 月度 / 专项
            const quarterly = plans.filter(p => p.quarter?.includes('Q') && !p.category?.includes('专项') && !p.category?.includes('公坚'));
            const monthly = plans.filter(p => (!p.quarter || p.quarter.includes('-')) && !p.category?.includes('专项') && !p.category?.includes('公坚'));
            const special = plans.filter(p => p.category?.includes('专项') || p.category?.includes('公坚'));
            const calcPct = (arr: typeof plans) => arr.length > 0 ? Math.round(arr.reduce((a, p) => a + (p.progress || 0), 0) / arr.length) : 0;
            const bars = [
              { label: '季度任务', pct: calcPct(quarterly), count: quarterly.length, icon: 'calendar_month', gradient: 'from-[#0060a9] to-[#409eff]' },
              { label: '月度任务', pct: calcPct(monthly), count: monthly.length, icon: 'event_note', gradient: 'from-[#7c3aed] to-[#a78bfa]' },
              { label: '专项任务', pct: calcPct(special), count: special.length, icon: 'star', gradient: 'from-[#d97706] to-[#fbbf24]' },
            ];
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                {bars.map(b => (
                  <div key={b.label} className={`bg-gradient-to-br ${b.gradient} px-4 py-3 rounded-xl text-white relative overflow-hidden shadow-md h-[100px] flex flex-col justify-between`}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-white/60 text-[16px]">{b.icon}</span>
                      <span className="text-white/90 text-[11px] font-bold">{b.label}</span>
                      <span className="text-white/60 text-[10px] ml-auto">{b.count} 项</span>
                    </div>
                    <div>
                      <div className="flex items-baseline mb-1">
                        <h3 className="text-2xl font-black tracking-tighter leading-none">{b.pct}%</h3>
                      </div>
                      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-white/90 rounded-full transition-all duration-500" style={{ width: `${b.pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Kanban Board ─────────────────────────────────────────── */}
          <div className="mb-3 flex justify-end">
            <button onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary-container/20 px-3 py-1.5 rounded-xl transition-colors border border-primary/20">
              <span className="material-symbols-outlined text-[14px]">add</span>申请新任务
            </button>
          </div>

          {/* Horizontal scroll kanban */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {([
              { keys: ['draft', 'pending_review', 'pending_dept_review', 'rejected', 'returned', 'pending_receipt'], label: '筹备中', color: '#94a3b8', bg: '#f1f5f9', wide: false },
              { keys: ['in_progress'],                          label: '进行中', color: '#3b82f6', bg: '#eff6ff', wide: true  },
              { keys: ['pending_assessment'],                          label: '待考核', color: '#8b5cf6', bg: '#f5f3ff', wide: false },
              { keys: ['assessed', 'completed'],                       label: '已归档', color: '#10b981', bg: '#ecfdf5', wide: false },
            ] as const).map(col => {
              const colPlans = plans.filter(p => (col.keys as readonly string[]).includes(p.status));
              const colKey = col.keys[0]; // for UI keying
              return (
                <div key={colKey}
                  className={`flex-none flex flex-col rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 ${col.wide ? 'w-[560px]' : 'w-72'}`}>
                  {/* Column header */}
                  <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="h-0.5 rounded-full mb-3" style={{ backgroundColor: col.color }} />
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{col.label}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: col.bg, color: col.color }}>
                        {colPlans.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-3 h-[350px]">
                    {colPlans.length === 0 && (
                      <div className="py-8 text-center text-slate-300 dark:text-slate-600 text-xs">暂无</div>
                    )}

                    {colPlans.map((plan) => {
                      const pct = plan.progress || 0;
                      const today = new Date();
                      const dl = plan.deadline ? parseUTC(plan.deadline) : null;
                      const daysLeft = dl ? Math.ceil((dl.getTime() - today.getTime()) / 86400000) : null;
                      const dlColor = daysLeft === null ? 'text-slate-400'
                        : daysLeft < 0 ? 'text-red-500'
                        : daysLeft <= 7 ? 'text-amber-500'
                        : 'text-slate-400';
                      const dlText = daysLeft === null ? '' : daysLeft < 0 ? `逾期${Math.abs(daysLeft)}天` : daysLeft === 0 ? '今天截止' : `${daysLeft}天后`;

                      const barColor = plan.status === 'in_progress' ? '#3b82f6'
                        : plan.status === 'approved' ? '#10b981'
                        : plan.status === 'rejected' ? '#ef4444'
                        : '#cbd5e1';

                      return (
                        <div key={plan.id}
                          onClick={() => setSelectedPlan(plan)}
                          className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3.5 border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-600 transition-all group cursor-pointer">

                          {/* Card top: category + period + title */}
                          <div className="flex items-start gap-2 mb-2.5">
                            <span className="flex-none mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                              style={{ background: col.bg, color: col.color }}>
                              {plan.category}
                            </span>
                            {/* 季度/月度标签 */}
                            {plan.quarter ? (
                              <span className="flex-none mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 border border-blue-200/60">
                                {plan.quarter}
                              </span>
                            ) : plan.deadline && typeof plan.deadline === 'string' ? (
                              <span className="flex-none mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 border border-violet-200/60">
                                {plan.deadline.substring(0, 7)}
                              </span>
                            ) : null}
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug line-clamp-2 flex-1">
                              {plan.title}
                            </h4>
                          </div>

                          {/* Description */}
                          {(plan.smart_s || plan.description) && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2.5 leading-relaxed">
                              {plan.smart_s || plan.description?.replace(/\*?\*?【[^】]+】\*?\*?\s*/g, '').replace(/\n{2,}/g, ' ').trim()}
                            </p>
                          )}

                          {/* Meta row */}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                            {plan.deadline && (
                              <span className={`flex items-center gap-0.5 text-[10px] font-medium ${dlColor}`}>
                                <span className="material-symbols-outlined text-[11px]">{daysLeft !== null && daysLeft < 0 ? 'alarm_off' : 'schedule'}</span>
                                {dlText || plan.deadline}
                              </span>
                            )}
                            {plan.target_value && (
                              <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                                <span className="material-symbols-outlined text-[10px]">flag</span>
                                {plan.target_value}
                              </span>
                            )}
                          </div>

                          {/* Progress — draggable range slider, saves on release */}
                          <div className="w-full"
                            onClick={e => e.stopPropagation()}
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] text-slate-400">当前进度</span>
                              <span className="text-[10px] font-black" style={{ color: barColor }}>
                                <span data-pct-label={plan.id}>{pct}</span>%
                              </span>
                            </div>
                            <div className="relative">
                              <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div data-pct-bar={plan.id} className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                              </div>
                              {plan.status === 'in_progress' && (
                                <input type="range" min="0" max="100" defaultValue={pct}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  onInput={e => {
                                    const v = parseInt((e.target as HTMLInputElement).value);
                                    const bar = document.querySelector(`[data-pct-bar="${plan.id}"]`) as HTMLElement;
                                    const label = document.querySelector(`[data-pct-label="${plan.id}"]`) as HTMLElement;
                                    if (bar) bar.style.width = `${v}%`;
                                    if (label) label.textContent = String(v);
                                  }}
                                  onChange={e => {
                                    const v = parseInt((e.target as HTMLInputElement).value);
                                    submitProgress(plan.id, v);
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          {/* Rejected CTA */}
                          {plan.status === 'rejected' && (
                            <button onClick={() => handleOpenEdit(plan)}
                              className="mt-2.5 w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg border border-amber-200/60 hover:bg-amber-100 transition-colors">
                              <span className="material-symbols-outlined text-[12px]">edit_note</span>
                              修改重新提交
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}
          </div>
        </div>


      {/* Slide-in Modal for Application */}
      <SmartTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreatePlanSmart}
        title="申请新任务"
        type="personal"
        users={users}
        submitting={submitting}
        onDraft={async (data) => {
          setSubmitting(true);
          try {
            const token = localStorage.getItem('token');
            const targetValue = `S: ${data.s}\nM: ${data.m}\nT: ${data.t}`;
            const res = await fetch('/api/perf/plans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                title: data.summary || '草稿目标',
                description: buildSmartDescription(data),
                category: data.taskType || '常规任务',
                target_value: targetValue,
                deadline: data.actTime || data.planTime || null,
                collaborators: data.c,
                informed_parties: data.i || undefined,
                delivery_target: data.dt || undefined,
                bonus: data.bonus ? parseFloat(data.bonus) : 0,
                max_participants: data.maxParticipants ? parseInt(data.maxParticipants) : 5,
                reward_type: data.rewardType || 'money',
                assignee_id: data.r || currentUser?.id,
                approver_id: data.a || currentUser?.id,
                flow_type: 'application'
              })
            });
            const json = await res.json();
            if (json.code === 0) {
              alert('草稿已保存');
              setIsModalOpen(false);
              fetchPlans();
            } else { alert(json.message || '保存失败'); }
          } catch { alert('保存失败'); } finally { setSubmitting(false); }
        }}
        initialData={{
          summary: '',
          s: '',
          m: '',
          a_smart: '',
          r_smart: '',
          t: '',
          taskType: '重点项目',
          r: currentUser?.id,
          a: currentUser?.id
        }}
      />

      {/* 驳回后二次编辑弹窗 */}
      <SmartTaskModal
        isOpen={!!editingPlan}
        onClose={() => setEditingPlan(null)}
        onSubmit={handleResubmitSmart}
        title={editingPlan?.status === 'draft' ? '编辑草稿并提交' : '修改并重新提交'}
        type="personal"
        users={users}
        submitting={resubmitting}
        onDraft={async (data) => {
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/perf/plans/${editingPlan?.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                title: data.summary || editingPlan?.title,
                description: buildSmartDescription(data),
                category: data.taskType || editingPlan?.category,
                target_value: `S: ${data.s}\nM: ${data.m}\nT: ${data.t}`,
                deadline: data.actTime || data.planTime || null,
                collaborators: data.c,
                informed_parties: data.i || undefined,
                delivery_target: data.dt || undefined,
                bonus: data.bonus ? parseFloat(data.bonus) : 0,
                max_participants: data.maxParticipants ? parseInt(data.maxParticipants) : 5,
                reward_type: data.rewardType || 'money',
                attachments: data.attachments || [],
              })
            });
            const json = await res.json();
            if (json.code === 0) {
              alert('草稿已保存');
              setEditingPlan(null);
              fetchPlans();
            } else { alert(json.message || '保存失败'); }
          } catch { alert('保存失败'); }
        }}
        initialData={(() => {
          if (!editingPlan) return {};
          const decoded = decodeSmartDescription(editingPlan.description || '');
          // Safely parse attachments
          let parsedAttachments: any[] = [];
          try {
            if (Array.isArray((editingPlan as any).attachments)) {
              parsedAttachments = (editingPlan as any).attachments;
            } else if (typeof (editingPlan as any).attachments === 'string' && (editingPlan as any).attachments) {
              parsedAttachments = JSON.parse((editingPlan as any).attachments);
            }
          } catch { parsedAttachments = []; }
          const descHasSmart = editingPlan.description?.includes('【目标 S】');
          return {
            summary: editingPlan.title,
            s: descHasSmart ? editingPlan.description.replace(/\n\n【PDCA】[\s\S]*$/, '').trim() : (editingPlan.target_value ? String(editingPlan.target_value).split('\n')[0]?.replace('S: ', '') : ''),
            m: descHasSmart ? '' : (editingPlan.target_value ? String(editingPlan.target_value).split('\n')[1]?.replace('M: ', '') : ''),
            t: editingPlan.deadline || (editingPlan.target_value ? String(editingPlan.target_value).split('\n')[2]?.replace('T: ', '') : '') || '',
            a_smart: descHasSmart ? '' : decoded.resource,
            r_smart: descHasSmart ? '' : decoded.relevance,
            taskType: editingPlan.category,
            c: editingPlan.collaborators || '',
            i: (editingPlan as any).informed_parties || '',
            dt: (editingPlan as any).delivery_target || '',
            bonus: String((editingPlan as any).bonus || ''),
            maxParticipants: String((editingPlan as any).max_participants || '5'),
            rewardType: (editingPlan as any).reward_type || 'money',
            planTime: decoded.planTime,
            doTime: decoded.doTime,
            checkTime: decoded.checkTime,
            actTime: decoded.actTime,
            r: editingPlan.assignee_id || currentUser?.id || '',
            a: editingPlan.approver_id || '',
            attachments: parsedAttachments
          };
        })()}
      />

      {/* ── Plan Detail Modal — 审批人看到审批按钮，其他人只读 ─────────────── */}
      <SmartTaskModal
        isOpen={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
        onSubmit={() => {}}
        title={['pending_review', 'pending_dept_review'].includes(selectedPlan?.status || '') && (String(selectedPlan?.approver_id || '').toLowerCase() === String(currentUser?.id || '').toLowerCase() || String(selectedPlan?.dept_head_id || '').toLowerCase() === String(currentUser?.id || '').toLowerCase()) && String(selectedPlan?.creator_id || '').toLowerCase() !== String(currentUser?.id || '').toLowerCase() ? '流程审批' : '目标详情'}
        type="personal"
        users={users}
        readonly={true}
        approverMode={['pending_review', 'pending_dept_review'].includes(selectedPlan?.status || '') && (String(selectedPlan?.approver_id || '').toLowerCase() === String(currentUser?.id || '').toLowerCase() || String(selectedPlan?.dept_head_id || '').toLowerCase() === String(currentUser?.id || '').toLowerCase()) && String(selectedPlan?.creator_id || '').toLowerCase() !== String(currentUser?.id || '').toLowerCase()}
        onApprove={async (comment, updatedData, customAction, targetUser) => {
          const action = customAction === 'transfer' ? 'transfer' : 'approve';
          try {
            const endpoint = action === 'transfer' ? `/api/perf/plans/${selectedPlan.id}/review` : `/api/perf/plans/${selectedPlan.id}/approve`;
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify({ action, reason: comment, transfer_to: targetUser })
            });
            const json = await res.json();
            if (json.code === 0) { setSelectedPlan(null); fetchPlans(); }
            else alert(json.message || '操作失败');
          } catch { alert('网络错误'); }
        }}
        onReject={async (comment) => {
          try {
            const res = await fetch(`/api/perf/plans/${selectedPlan.id}/reject`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify({ action: 'reject', reason: comment })
            });
            const json = await res.json();
            if (json.code === 0) { setSelectedPlan(null); fetchPlans(); }
            else alert(json.message || '驳回失败');
          } catch { alert('网络错误'); }
        }}
        headerActions={['in_progress', 'pending_receipt', 'pending_assessment'].includes(selectedPlan?.status || '') ? (() => {
          const sp = selectedPlan;
          const isAssigned = sp.creator_id !== sp.assignee_id;

          const isPoolTask = !!(sp as any).is_pool || (sp as any).task_type === 'bounty' || (sp as any).task_type === 'proposal';
          const poolTaskId = (sp as any).pool_task_id || ((isPoolTask) ? sp.id : undefined);
          const isPoolA = isPoolTask && ((sp as any).role_claims || []).some((c: any) => c.role_name === 'A' && (c.status === 'approved' || c.status === 'star_submitted') && String(c.user_id) === String(currentUser?.id));

          const handleComplete100 = () => {
            setActionPrompt({
              type: 'submit_review',
              title: '100% 满分完结',
              desc: '确认发起 100% 完结？\n任务完成后将直接进入验收评级阶段，全员进入 STAR 汇报环节。',
              confirmText: '确认完结',
              confirmClass: 'bg-emerald-500 hover:bg-emerald-600 text-white',
              icon: 'task_alt',
              iconClass: 'bg-emerald-100 text-emerald-500',
              onConfirm: async () => {
                try {
                  const token = localStorage.getItem('token');
                  const url = isPoolTask && poolTaskId
                    ? `/api/pool/tasks/${poolTaskId}/complete`
                    : `/api/perf/plans/${sp.id}/review`;
                  const body = isPoolTask && poolTaskId
                    ? {}
                    : { action: 'assess' };
                  const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(body)
                  });
                  const json = await res.json();
                  if (json.code === 0) {
                    setSelectedPlan(null);
                    fetchPlans();
                  } else { alert(json.message || '操作失败'); }
                } catch { alert('网络错误'); }
              }
            });
          };

          const handleEarlyComplete = () => {
            setActionPrompt({
              type: isPoolTask ? 'early_complete_pool' : 'submit_review',
              title: '提前完结任务',
              desc: isPoolTask
                ? '确认提前完结任务吗？\n请填写完结原因、实际完成度和已交付成果。'
                : '确认提前完结任务吗？\n提前完结无需审批，将直接进入 STAR 验收获评阶段。',
              requireInput: true,
              placeholder: isPoolTask ? '请简述提前完结原因...' : '请简述提前完结原因...',
              confirmText: '提前完结',
              confirmClass: 'bg-amber-500 hover:bg-amber-600 text-white',
              icon: 'stop_circle',
              iconClass: 'bg-amber-100 text-amber-500',
              onConfirm: async (val) => {
                try {
                  const token = localStorage.getItem('token');
                  const url = isPoolTask && poolTaskId
                    ? `/api/pool/tasks/${poolTaskId}/terminate`
                    : `/api/perf/plans/${sp.id}/review`;
                  const body = isPoolTask && poolTaskId
                    ? { reason: val || '提前完结', actual_completion: sp.progress || 0, delivered_content: val || '提前完结' }
                    : { action: 'assess', reason: val };
                  const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(body)
                  });
                  const json = await res.json();
                  if (json.code === 0) {
                    setSelectedPlan(null);
                    fetchPlans();
                  } else { alert(json.message || '操作失败'); }
                } catch { alert('网络错误'); }
              }
            });
          };

          const isPendingReceipt = sp.status === 'pending_receipt';
          const isInProgress = sp.status === 'in_progress';
          const isPendingAssessment = sp.status === 'pending_assessment';

          // 解析签收状态
          let receiptStatus: Record<string, string> = {};
          try { receiptStatus = JSON.parse((sp as any).receipt_status || '{}'); } catch {}
          const myReceiptDone = receiptStatus[currentUser?.id || ''] === 'confirmed';
          const allReceiptsConfirmed = Object.keys(receiptStatus).length > 0 && Object.values(receiptStatus).every(s => s === 'confirmed');
          const isApprover = currentUser?.id === sp.approver_id;
          const canFinishTask = isPoolTask ? isPoolA : (isApprover || sp.creator_id === currentUser?.id);

          // 评级打分权限：优先 judge_id，兜底按流程类型
          const isScorerJudge = (() => {
            const uid = String(currentUser?.id || '');
            if ((sp as any).judge_id) return String((sp as any).judge_id) === uid;
            if ((sp as any).flow_type === 'application') {
              return (sp as any).dept_head_id && String((sp as any).dept_head_id) === uid;
            }
            // flow1: creator_id 是评分人
            return sp.creator_id && String(sp.creator_id) === uid;
          })();

          // 评级打分：跳转到 STAR 广场 tab，查看所有 STAR 报告后评分
          const handleAssessScore = () => {
            document.dispatchEvent(new CustomEvent('SWITCH_TO_STAR_TAB'));
          };

          const handleConfirmReceipt = () => {
            setActionPrompt({
              type: 'confirm_receipt',
              title: '确认查收任务',
              desc: '上级已向您下发此任务，确认查收后任务将正式启动进入"进行中"状态。',
              confirmText: '确认查收',
              confirmClass: 'bg-cyan-500 hover:bg-cyan-600 text-white',
              icon: 'inbox',
              iconClass: 'bg-cyan-100 text-cyan-600',
              onConfirm: async () => {
                try {
                  const token = localStorage.getItem('token');
                  const res = await fetch(`/api/perf/plans/${sp.id}/confirm-receipt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  });
                  const json = await res.json();
                  if (json.code === 0) { setSelectedPlan(null); fetchPlans(); }
                  else { alert(json.message || '签收失败'); }
                } catch { alert('网络错误'); }
              }
            });
          };

          const handleStartTask = () => {
            setActionPrompt({
              type: 'start_task',
              title: '启动执行任务',
              desc: '全员已签收完毕，确认启动任务？\n启动后任务将进入"进行中"状态。',
              confirmText: '启动执行',
              confirmClass: 'bg-emerald-500 hover:bg-emerald-600 text-white',
              icon: 'rocket_launch',
              iconClass: 'bg-emerald-100 text-emerald-500',
              onConfirm: async () => {
                try {
                  const token = localStorage.getItem('token');
                  const res = await fetch(`/api/perf/plans/${sp.id}/start-task`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  });
                  const json = await res.json();
                  if (json.code === 0) { setSelectedPlan(null); fetchPlans(); }
                  else { alert(json.message || '启动失败'); }
                } catch { alert('网络错误'); }
              }
            });
          };

          const handleRejectReceipt = () => {
            setActionPrompt({
              type: 'reject_receipt',
              title: '拒签任务',
              desc: '拒签后，任务将退回给下发人，请说明拒签原因。',
              requireInput: true,
              placeholder: '请输入拒签原因...',
              confirmText: '确认拒签',
              confirmClass: 'bg-red-500 hover:bg-red-600 text-white',
              icon: 'cancel',
              iconClass: 'bg-red-100 text-red-500',
              onConfirm: async (val) => {
                try {
                  const token = localStorage.getItem('token');
                  const res = await fetch(`/api/perf/plans/${sp.id}/reject-receipt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ reason: val || '不接受此任务' })
                  });
                  const json = await res.json();
                  if (json.code === 0) { setSelectedPlan(null); fetchPlans(); }
                  else { alert(json.message || '操作失败'); }
                } catch { alert('网络错误'); }
              }
            });
          };

          return (
            <div className="flex items-center gap-2">
              {/* 签收/启动按钮已统一由 SmartTaskModal 内置 footer 处理，不在 header 重复 */}
              {/* 待评级：写STAR (所有人) + 评级打分 (仅管理者) */}
              {isPendingAssessment && (
                <>
                  <button onClick={() => document.dispatchEvent(new CustomEvent('SWITCH_TO_STAR_TAB'))}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-white/20 hover:bg-white/30 transition-colors shrink-0">
                    <span className="material-symbols-outlined text-[14px]">star</span>
                    写STAR
                  </button>
                  {isScorerJudge && (
                    <button onClick={handleAssessScore}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-violet-500 hover:bg-violet-600 shadow-sm transition-colors shrink-0">
                      <span className="material-symbols-outlined text-[14px]">grade</span>
                      评级打分
                    </button>
                  )}
                </>
              )}
              {/* 进行中：写STAR (所有人), 完结/退回 (仅A角色) */}
              {isInProgress && (
                <>
                  <button onClick={() => document.dispatchEvent(new CustomEvent('SWITCH_TO_STAR_TAB'))}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-white/20 hover:bg-white/30 transition-colors shrink-0">
                    <span className="material-symbols-outlined text-[14px]">star</span>
                    写STAR
                  </button>
                  {canFinishTask && (
                    <>
                      <button onClick={handleComplete100}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 shadow-sm transition-colors shrink-0">
                        <span className="material-symbols-outlined text-[14px]">task_alt</span>
                        100%完结
                      </button>
                      <button onClick={handleEarlyComplete}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 shadow-sm transition-colors shrink-0">
                        <span className="material-symbols-outlined text-[14px]">stop_circle</span>
                        提前完结
                      </button>
                    </>
                  )}
                  {/* Flow1(任务下发)已移除退回按钮 */}
                </>
              )}
            </div>
          );
        })() : undefined}
        initialData={selectedPlan ? buildSmartTaskData(selectedPlan as any, ((selectedPlan as any).is_pool || (selectedPlan as any).task_type === 'bounty' || (selectedPlan as any).task_type === 'proposal') ? 'pool_task' : 'perf_plan') : {}}
        customFooter={(() => {
          if (!selectedPlan) return null;
          const sp = selectedPlan;
          const pct = sp.progress || 0;
          const isAssigned = sp.creator_id !== sp.assignee_id;
          const accentColor = {
            in_progress: '#3b82f6', pending_review: '#f59e0b', completed: '#8b5cf6',
            approved: '#10b981', rejected: '#ef4444', draft: '#94a3b8', returned: '#f97316',
            pending_assessment: '#8b5cf6', assessed: '#8b5cf6', pending_dept_review: '#f59e0b', pending_receipt: '#06b6d4',
          }[sp.status] || '#94a3b8';

          // 删除草稿
          const handleDeleteDraft = () => {
             setActionPrompt({
               type: 'delete',
               title: '删除草稿',
               desc: '确定删除这个草稿吗？此操作不可恢复。',
               confirmText: '确认删除',
               confirmClass: 'bg-red-500 hover:bg-red-600 text-white',
               icon: 'warning',
               iconClass: 'bg-red-100 text-red-500',
               onConfirm: async () => {
                 try {
                   const token = localStorage.getItem('token');
                   const res = await fetch(`/api/perf/plans/${sp.id}`, {
                     method: 'DELETE',
                     headers: { 'Authorization': `Bearer ${token}` }
                   });
                   const data = await res.json();
                   if (data.code === 0) {
                     setSelectedPlan(null);
                     fetchPlans();
                   } else { alert(data.message || '删除失败'); }
                 } catch { alert('操作失败'); }
               }
             });
          };

          // 提交草稿（Flow1: 下发签收 / Flow2: 提交审批 → 签收 → 上级审批）
          const handleSubmitDraft = async () => {
            try {
              const token = localStorage.getItem('token');
              const res = await fetch(`/api/perf/plans/${sp.id}/dispatch`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const json = await res.json();
              if (json.code === 0) {
                setSelectedPlan(null);
                fetchPlans();
              } else {
                alert(json.message || '提交失败');
              }
            } catch { alert('网络错误'); }
          };
          
          return (
            <div className="w-full flex flex-col gap-3">
              <div className="flex items-end justify-between gap-4">
                <div className="flex-1 max-w-md bg-slate-50 dark:bg-slate-800/40 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">trending_up</span>当前进度
                    </span>
                    <span className="text-lg font-black" style={{ color: accentColor }}>
                      <span data-pct-label={`modal-${sp.id}`}>{pct}</span>%
                    </span>
                  </div>
                  <div className="relative">
                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div data-pct-bar={`modal-${sp.id}`} className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: accentColor }} />
                    </div>
                    {sp.status === 'in_progress' && (
                      <input type="range" min="0" max="100" defaultValue={pct}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onInput={e => {
                          const v = parseInt((e.target as HTMLInputElement).value);
                          const bar = document.querySelector(`[data-pct-bar="modal-${sp.id}"]`) as HTMLElement;
                          const label = document.querySelector(`[data-pct-label="modal-${sp.id}"]`) as HTMLElement;
                          if (bar) bar.style.width = `${v}%`;
                          if (label) label.textContent = String(v);
                        }}
                        onChange={e => {
                          const v = parseInt((e.target as HTMLInputElement).value);
                          submitProgress(sp.id, v);
                        }}
                      />
                    )}
                  </div>
                </div>
                {/* 操作按钮区域 */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {/* 草稿：删除 + 编辑 + 提交审批 */}
                  {sp.status === 'draft' && (
                    <>
                      <button onClick={handleDeleteDraft}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-red-500 bg-red-50 text-sm font-bold rounded-lg border border-red-200 hover:bg-red-100 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        删除
                      </button>
                      <button onClick={() => { setSelectedPlan(null); handleOpenEdit(sp); }}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 text-blue-600 text-sm font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        编辑
                      </button>
                      <button onClick={handleSubmitDraft}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-[#005ea4] text-white text-sm font-bold rounded-lg hover:bg-[#0077ce] transition-colors shadow-sm">
                        <span className="material-symbols-outlined text-[16px]">send</span>
                        {(sp as any).flow_type === 'application' ? '提交审批' : '下发任务'}
                      </button>
                    </>
                  )}
                  {/* 驳回/退回：编辑重新提交 */}
                  {(sp.status === 'rejected' || sp.status === 'returned') && (
                    <button onClick={() => { setSelectedPlan(null); handleOpenEdit(sp); }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 text-amber-600 text-sm font-bold rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors">
                      <span className="material-symbols-outlined text-[16px]">edit_note</span>
                      修改后重新提交
                    </button>
                  )}
                  {/* 进行中的退回已移至 header actions 区域 */}
                </div>
              </div>
            </div>
          );
        })()}
      />

    {/* Render action prompt overlay */}
    {actionPrompt && (
      <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setActionPrompt(null)}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-200/50" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${actionPrompt.iconClass}`}>
              <span className="material-symbols-outlined text-[20px]">{actionPrompt.icon}</span>
            </div>
            <div>
               <h3 className="font-black text-[16px] text-slate-800 dark:text-slate-100 tracking-tight">{actionPrompt.title}</h3>
            </div>
          </div>
          <div className="p-5 bg-slate-50/50 dark:bg-slate-900/50">
            <p className="text-[13px] text-slate-600 dark:text-slate-400 font-medium whitespace-pre-wrap leading-relaxed">{actionPrompt.desc}</p>
            
            {actionPrompt.requireInput && (
               <div className="mt-4">
                 {actionPrompt.type === 'assess_score' ? (
                   <input
                     type="number" min="1" max="100" autoFocus
                     placeholder={actionPrompt.placeholder || ''}
                     className="w-full text-sm px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 shadow-sm transition-all text-center text-2xl font-black"
                     id="action-prompt-input"
                   />
                 ) : (
                   <textarea
                     autoFocus
                     placeholder={actionPrompt.placeholder || ''}
                     className="w-full text-sm px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm transition-all h-24"
                     id="action-prompt-input"
                   />
                 )}
               </div>
            )}
          </div>
          <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/50">
            <button onClick={() => setActionPrompt(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200/70 transition-colors">取消</button>
            <button onClick={() => {
               let val = '';
               if (actionPrompt.requireInput) {
                 val = (document.getElementById('action-prompt-input') as HTMLInputElement).value;
                 if (!val.trim() && actionPrompt.title.includes('完结')) {
                    alert('请填写真实原因！'); return;
                 }
               }
               actionPrompt.onConfirm(val);
               setActionPrompt(null);
            }} className={`flex-1 py-2 rounded-xl font-bold text-sm shadow-sm transition-all transform active:scale-95 ${actionPrompt.confirmClass}`}>{actionPrompt.confirmText}</button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
