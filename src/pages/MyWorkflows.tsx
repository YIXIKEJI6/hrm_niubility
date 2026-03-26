import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';

interface MyWorkflowsProps {
  navigate: (view: string) => void;
}

type TabKey = 'initiated' | 'pending' | 'reviewed' | 'cc';

const TABS: { key: TabKey; label: string; icon: string; emptyText: string }[] = [
  { key: 'initiated', label: '我发起的', icon: 'send', emptyText: '暂无发起的流程' },
  { key: 'pending',   label: '待我审核', icon: 'pending_actions', emptyText: '暂无待审核流程' },
  { key: 'reviewed',  label: '我已审核', icon: 'task_alt', emptyText: '暂无已审核流程' },
  { key: 'cc',        label: '抄送我的', icon: 'forward_to_inbox', emptyText: '暂无抄送消息' },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft:         { label: '草稿',       color: 'text-slate-500', bg: 'bg-slate-100' },
  submitted:     { label: '审批中',     color: 'text-blue-600',  bg: 'bg-blue-50' },
  approved:      { label: '已通过',     color: 'text-emerald-600', bg: 'bg-emerald-50' },
  rejected:      { label: '已驳回',     color: 'text-red-500',   bg: 'bg-red-50' },
  assessed:      { label: '已评分',     color: 'text-purple-600', bg: 'bg-purple-50' },
  pending_hr:    { label: '待人事审核', color: 'text-amber-600', bg: 'bg-amber-50' },
  pending_admin: { label: '待总经理复核', color: 'text-orange-600', bg: 'bg-orange-50' },
  open:          { label: '进行中',     color: 'text-blue-600',  bg: 'bg-blue-50' },
  completed:     { label: '已完成',     color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, color: 'text-slate-500', bg: 'bg-slate-100' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color} ${s.bg}`}>{s.label}</span>;
}

function FlowTypeTag({ type }: { type: string }) {
  if (type === 'perf_plan') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-blue-600 bg-blue-50 border border-blue-100">绩效计划</span>;
  if (type === 'proposal') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-purple-600 bg-purple-50 border border-purple-100">绩效提案</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-500 bg-slate-100">{type}</span>;
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
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString();
}

export default function MyWorkflows({ navigate }: MyWorkflowsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('initiated');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<TabKey, number>>({ initiated: 0, pending: 0, reviewed: 0, cc: 0 });
  const { currentUser } = useAuth();

  const fetchTab = async (tab: TabKey) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/workflows/${tab}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.code === 0) {
        setData(json.data || []);
      }
    } catch {}
    setLoading(false);
  };

  // Fetch counts for all tabs on mount
  useEffect(() => {
    const fetchCounts = async () => {
      const token = localStorage.getItem('token');
      const allTabs: TabKey[] = ['initiated', 'pending', 'reviewed', 'cc'];
      const results = await Promise.all(
        allTabs.map(t =>
          fetch(`/api/workflows/${t}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .catch(() => ({ data: [] }))
        )
      );
      const newCounts: Record<string, number> = {};
      allTabs.forEach((t, i) => { newCounts[t] = results[i]?.data?.length || 0; });
      setCounts(newCounts as any);
    };
    fetchCounts();
  }, []);

  useEffect(() => { fetchTab(activeTab); }, [activeTab]);

  const tabInfo = TABS.find(t => t.key === activeTab)!;

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <Sidebar currentView="workflows" navigate={navigate} />
      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-xl">account_tree</span>
            </div>
            我的流程
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 ml-[52px]">
            跟踪所有我发起、审核和参与的流程
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-slate-900 rounded-2xl p-1.5 shadow-sm border border-slate-200/60 dark:border-slate-800">
          {TABS.map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-200/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}>
              <span className="material-symbols-outlined text-[18px]"
                style={activeTab === tab.key ? { fontVariationSettings: "'FILL' 1" } : {}}>{tab.icon}</span>
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 font-black ${
                  activeTab === tab.key ? 'bg-white/20 text-white' :
                  tab.key === 'pending' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                }`}>{counts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-20">{tabInfo.icon}</span>
            <p className="text-sm">{tabInfo.emptyText}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item: any, idx: number) => (
              <WorkflowCard key={`${item.flow_type || item.type}-${item.id}-${idx}`} item={item} tab={activeTab} />
            ))}
          </div>
        )}
      </div>
      </main>
    </div>
  );
}

function WorkflowCard({ item, tab }: { item: any; tab: TabKey }) {
  const isCC = tab === 'cc';

  if (isCC) {
    // Notification-style card
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4 hover:shadow-md transition-all">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-blue-500 text-[20px]">forward_to_inbox</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{item.title}</p>
              <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{formatDate(item.created_at)}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{item.content}</p>
          </div>
          {!item.is_read && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
        </div>
      </div>
    );
  }

  const flowType = item.flow_type || 'unknown';
  const status = flowType === 'proposal' ? item.proposal_status : item.status;
  const title = item.title;
  const creator = item.creator_name || item.created_by;
  const approver = item.approver_name || item.hr_reviewer_name || item.admin_reviewer_name;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4 hover:shadow-md transition-all group">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          flowType === 'perf_plan' ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-purple-50 dark:bg-purple-900/30'
        }`}>
          <span className={`material-symbols-outlined text-[20px] ${
            flowType === 'perf_plan' ? 'text-blue-500' : 'text-purple-500'
          }`}>{flowType === 'perf_plan' ? 'trending_up' : 'lightbulb'}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FlowTypeTag type={flowType} />
            <StatusBadge status={status} />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1 truncate">{title}</h3>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            {tab === 'initiated' && approver && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">person</span>
                审批人: {approver}
              </span>
            )}
            {(tab === 'pending' || tab === 'reviewed') && creator && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">person</span>
                发起人: {creator}
              </span>
            )}
            {item.bonus > 0 && (
              <span className="flex items-center gap-1 text-rose-500 font-bold">
                <span className="material-symbols-outlined text-[12px]">payments</span>
                ¥{item.bonus?.toLocaleString()}
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">schedule</span>
              {formatDate(item.created_at)}
            </span>
          </div>
          {item.reject_reason && (
            <p className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-1.5">
              驳回原因: {item.reject_reason}
            </p>
          )}
          {item.description && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{item.description}</p>
          )}
        </div>

        {/* Progress (for perf plans) */}
        {flowType === 'perf_plan' && typeof item.progress === 'number' && (
          <div className="flex-shrink-0 text-center">
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={item.progress >= 80 ? '#22c55e' : item.progress >= 40 ? '#3b82f6' : '#f59e0b'}
                  strokeWidth="3" strokeDasharray={`${(item.progress / 100) * 88} 88`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-700 dark:text-slate-200">{item.progress}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
