import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string;
  priority: string;
  status: string;
}

function formatDate(d: string) {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  return `${Math.floor(hrs / 24)}天前`;
}

export default function EmployeeDashboard({ navigate }: { navigate: (view: string) => void }) {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', due_date: '', priority: 'normal' });

  // Dynamic data
  const [pendingWorkflows, setPendingWorkflows] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myPlans, setMyPlans] = useState<any[]>([]);
  const [recentNotifs, setRecentNotifs] = useState<any[]>([]);
  const [myProposals, setMyProposals] = useState<any[]>([]);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchTasks();
    fetchDashboardData();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks', { headers });
      if (res.ok) setTasks(await res.json());
    } catch {}
  };

  const fetchDashboardData = async () => {
    try {
      const [pendingRes, notifRes, plansRes, proposalsRes] = await Promise.all([
        fetch('/api/workflows/pending', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/notifications?limit=5', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/perf/plans', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/pool/my-proposals', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      setPendingWorkflows(pendingRes?.data?.length || 0);
      setRecentNotifs(notifRes?.data || []);
      // unread count
      const ucRes = await fetch('/api/notifications/unread-count', { headers }).then(r => r.json()).catch(() => ({ data: { count: 0 } }));
      setUnreadCount(ucRes?.data?.count || 0);
      // my plans (in progress)
      const plans = (plansRes?.data || []).filter((p: any) => !['completed', 'cancelled'].includes(p.status));
      setMyPlans(plans.slice(0, 4));
      setMyProposals((proposalsRes?.data || []).slice(0, 3));
    } catch {}
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ status: newStatus })
      });
      fetchTasks();
    } catch { fetchTasks(); }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(newTask)
      });
      if (res.ok) {
        fetchTasks();
        setIsTaskModalOpen(false);
        setNewTask({ title: '', description: '', due_date: '', priority: 'normal' });
      }
    } catch {}
  };

  const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: '草稿', color: 'text-slate-500', bg: 'bg-slate-100' },
    submitted: { label: '审批中', color: 'text-blue-600', bg: 'bg-blue-50' },
    approved: { label: '已通过', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    rejected: { label: '已驳回', color: 'text-red-500', bg: 'bg-red-50' },
    assessed: { label: '已评分', color: 'text-purple-600', bg: 'bg-purple-50' },
    pending_hr: { label: '待人事审核', color: 'text-amber-600', bg: 'bg-amber-50' },
    pending_admin: { label: '待总经理复核', color: 'text-orange-600', bg: 'bg-orange-50' },
  };

  // Real date
  const now = new Date();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`;
  const hour = now.getHours();
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <Sidebar currentView="dashboard" navigate={navigate} />

      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto relative">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Welcome Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-on-surface tracking-tight mb-1">{greeting}, {currentUser?.name || '同事'} 👋</h2>
              <p className="text-sm text-on-surface-variant">{dateStr} — 以下是与您相关的事项概览</p>
            </div>
          </div>

          {/* Quick Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button onClick={() => navigate('workflows')}
              className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-4 text-left hover:shadow-md transition-all group border border-blue-100/60 dark:border-blue-800/30">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-600 text-[18px]">pending_actions</span>
                </div>
                {pendingWorkflows > 0 && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black animate-pulse">{pendingWorkflows}</span>}
              </div>
              <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{pendingWorkflows}</p>
              <p className="text-[11px] text-blue-600/70 font-bold">待审核流程</p>
            </button>

            <button onClick={() => navigate('personal')}
              className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-4 text-left hover:shadow-md transition-all group border border-emerald-100/60 dark:border-emerald-800/30">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">trending_up</span>
                </div>
              </div>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{myPlans.length}</p>
              <p className="text-[11px] text-emerald-600/70 font-bold">进行中绩效</p>
            </button>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl p-4 text-left border border-amber-100/60 dark:border-amber-800/30">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-600 text-[18px]">checklist</span>
                </div>
              </div>
              <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{pendingTasks.length}</p>
              <p className="text-[11px] text-amber-600/70 font-bold">待办事项</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-2xl p-4 text-left border border-purple-100/60 dark:border-purple-800/30">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-purple-600 text-[18px]">mail</span>
                </div>
                {unreadCount > 0 && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black">{unreadCount}</span>}
              </div>
              <p className="text-2xl font-black text-purple-700 dark:text-purple-300">{unreadCount}</p>
              <p className="text-[11px] text-purple-600/70 font-bold">未读消息</p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left: Todo + My Performance */}
            <div className="lg:col-span-5 space-y-6">
              {/* Todo List */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>checklist</span>
                    待办事项
                    {pendingTasks.length > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">{pendingTasks.length}</span>}
                  </h3>
                  <button onClick={() => setIsTaskModalOpen(true)}
                    className="text-[10px] font-bold text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[14px]">add</span>新建
                  </button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {tasks.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">暂无待办事项 🎉</div>
                  ) : tasks.map(task => {
                    const done = task.status === 'completed';
                    return (
                      <div key={task.id} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${done ? 'opacity-50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                        <input type="checkbox" checked={done} onChange={() => handleToggleTaskStatus(task)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400 cursor-pointer" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold ${done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'}`}>{task.title}</p>
                          {task.due_date && <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">schedule</span>{task.due_date}
                          </p>}
                        </div>
                        {!done && task.priority === 'high' && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">紧急</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* My Performance Plans */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                    我的绩效计划
                  </h3>
                  <button onClick={() => navigate('personal')} className="text-[10px] font-bold text-blue-500 hover:text-blue-700">查看全部 →</button>
                </div>
                {myPlans.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">暂无进行中的绩效计划</div>
                ) : (
                  <div className="space-y-3">
                    {myPlans.map((plan: any) => {
                      const s = STATUS_MAP[plan.status] || { label: plan.status, color: 'text-slate-500', bg: 'bg-slate-100' };
                      return (
                        <div key={plan.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer"
                          onClick={() => navigate('personal')}>
                          <div className="relative w-10 h-10 flex-shrink-0">
                            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                              <circle cx="18" cy="18" r="14" fill="none"
                                stroke={plan.progress >= 80 ? '#22c55e' : plan.progress >= 40 ? '#3b82f6' : '#f59e0b'}
                                strokeWidth="3" strokeDasharray={`${(plan.progress / 100) * 88} 88`} strokeLinecap="round" />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-600">{plan.progress}%</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{plan.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.color} ${s.bg}`}>{s.label}</span>
                              {plan.deadline && <span className="text-[9px] text-slate-400">截止 {plan.deadline}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Middle: Recent Notifications */}
            <div className="lg:col-span-4 space-y-6">
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>inbox</span>
                    最新消息
                    {unreadCount > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">{unreadCount}</span>}
                  </h3>
                </div>
                {recentNotifs.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">暂无消息</div>
                ) : (
                  <div className="space-y-2">
                    {recentNotifs.map((n: any) => (
                      <div key={n.id} className={`p-3 rounded-xl transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                        onClick={() => { if (n.link) navigate(n.link.replace(/^\//, '').split('?')[0]); }}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${!n.is_read ? 'bg-blue-100' : 'bg-slate-100'}`}>
                            <span className={`material-symbols-outlined text-[14px] ${!n.is_read ? 'text-blue-600' : 'text-slate-400'}`}>
                              {n.type === 'proposal' ? 'description' : n.type === 'perf' ? 'trending_up' : 'notifications'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`text-xs font-bold truncate ${!n.is_read ? 'text-slate-800' : 'text-slate-500'}`}>{n.title}</p>
                              <span className="text-[9px] text-slate-400 flex-shrink-0 ml-2">{formatDate(n.created_at)}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{n.content}</p>
                          </div>
                          {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* My Proposals */}
              {myProposals.length > 0 && (
                <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-purple-500" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
                      我的提案
                    </h3>
                    <button onClick={() => navigate('company')} className="text-[10px] font-bold text-blue-500 hover:text-blue-700">查看全部 →</button>
                  </div>
                  <div className="space-y-2">
                    {myProposals.map((p: any) => {
                      const s = STATUS_MAP[p.proposal_status] || { label: p.proposal_status, color: 'text-slate-500', bg: 'bg-slate-100' };
                      return (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-purple-500 text-[14px]">lightbulb</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{p.title}</p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.color} ${s.bg}`}>{s.label}</span>
                          </div>
                          {p.bonus > 0 && <span className="text-[10px] text-rose-500 font-bold">¥{p.bonus}</span>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            {/* Right: Quick Actions */}
            <div className="lg:col-span-3 space-y-6">
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-5">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">bolt</span>
                  快速入口
                </h3>
                <div className="space-y-2">
                  {[
                    { icon: 'assignment', label: '我的流程', view: 'workflows', color: 'text-blue-600 bg-blue-50', badge: pendingWorkflows },
                    { icon: 'person', label: '个人管理', view: 'personal', color: 'text-emerald-600 bg-emerald-50' },
                    { icon: 'groups', label: '团队管理', view: 'team', color: 'text-indigo-600 bg-indigo-50' },
                    { icon: 'analytics', label: '公司绩效池', view: 'company', color: 'text-orange-600 bg-orange-50' },
                    { icon: 'view_quilt', label: '全景仪表盘', view: 'panorama', color: 'text-purple-600 bg-purple-50' },
                  ].map(item => (
                    <button key={item.view} onClick={() => navigate(item.view)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-left group">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color.split(' ')[1]}`}>
                        <span className={`material-symbols-outlined text-[18px] ${item.color.split(' ')[0]}`}>{item.icon}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black">{item.badge}</span>
                      ) : (
                        <span className="material-symbols-outlined text-[14px] text-slate-300 group-hover:text-slate-500 transition-colors">chevron_right</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {/* Summary Card */}
              <section className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>summarize</span>
                  <h3 className="font-bold text-sm">今日概览</h3>
                </div>
                <div className="space-y-2 text-xs opacity-90">
                  <p>📋 {pendingTasks.length} 项待办事项</p>
                  <p>✅ {completedTasks.length} 项已完成</p>
                  <p>📊 {myPlans.length} 个绩效计划进行中</p>
                  <p>⏳ {pendingWorkflows} 个流程待审核</p>
                  <p>✉️ {unreadCount} 条未读消息</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-base font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500">add_task</span>
                新建待办事项
              </h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">任务标题 *</label>
                <input required autoFocus type="text" value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                  placeholder="例如：准备项目季度汇报PPT" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">截止日期</label>
                <input type="date" value={newTask.due_date}
                  onChange={e => setNewTask({...newTask, due_date: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">描述</label>
                <textarea rows={3} value={newTask.description}
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none"
                  placeholder="补充任务细节..." />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="radio" name="priority" value="normal"
                    checked={newTask.priority === 'normal'}
                    onChange={() => setNewTask({...newTask, priority: 'normal'})}
                    className="accent-blue-500 w-4 h-4" />
                  普通
                </label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="radio" name="priority" value="high"
                    checked={newTask.priority === 'high'}
                    onChange={() => setNewTask({...newTask, priority: 'high'})}
                    className="accent-red-500 w-4 h-4" />
                  <span className="text-red-500 font-bold">紧急</span>
                </label>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">取消</button>
                <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 active:scale-95 shadow-md rounded-xl transition-all">创建</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
