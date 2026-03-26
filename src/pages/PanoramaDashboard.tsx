import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

export default function PanoramaDashboard({ navigate }: { navigate: (view: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('/api/dashboard/panorama', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (json.code === 0) setData(json.data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchData();
  }, []);

  const STATUS_LABELS: Record<string, [string, string]> = {
    pending_review: ['待审批', '#f59e0b'],
    in_progress: ['进行中', '#3b82f6'],
    completed: ['已完成', '#10b981'],
    rejected: ['已驳回', '#ef4444'],
  };

  const getDeptColor = (avg: number) => {
    if (avg >= 80) return { border: 'border-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50', badge: '优秀' };
    if (avg >= 50) return { border: 'border-blue-400', text: 'text-blue-600', bg: 'bg-blue-50', badge: '正常' };
    return { border: 'border-red-400', text: 'text-red-500', bg: 'bg-red-50', badge: '预警' };
  };

  return (
    <div className="bg-surface text-on-background min-h-screen flex">
      <Sidebar currentView="panorama" navigate={navigate} />
      <main className="flex-1 mt-16 h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">全景数据看板</h1>
            <p className="text-sm text-slate-500 mt-1">基于实时绩效数据的全局视角</p>
          </div>

          {loading || !data ? (
            <div className="text-center py-20 text-slate-400">
              <span className="material-symbols-outlined text-[48px] mb-3 block animate-spin">autorenew</span>
              <p>加载数据中...</p>
            </div>
          ) : (
            <>
              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                {[
                  { label: '在职员工', value: data.totalEmployees, icon: 'group', color: 'blue' },
                  { label: '绩效计划', value: data.totalPlans, icon: 'assignment', color: 'slate' },
                  { label: '完成率', value: `${data.completionRate}%`, icon: 'check_circle', color: 'emerald' },
                  { label: '平均分', value: data.avgScore ?? '—', icon: 'star', color: 'amber' },
                  { label: '奖金发放', value: data.totalBonus > 0 ? `¥${data.totalBonus.toLocaleString()}` : '¥0', icon: 'payments', color: 'violet' },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-8 h-8 rounded-lg bg-${kpi.color}-50 dark:bg-${kpi.color}-900/20 flex items-center justify-center`}>
                        <span className={`material-symbols-outlined text-${kpi.color}-600 text-[18px]`}>{kpi.icon}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* ── Row 2: Status Distribution + Monthly Trends ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                {/* Status Distribution - Horizontal bar chart */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-blue-600">donut_large</span>
                    绩效状态分布
                  </h3>
                  {(() => {
                    const dist = data.statusDistribution || {};
                    const entries = Object.entries(dist);
                    if (entries.length === 0) return <div className="text-center py-10 text-slate-400 text-sm">暂无数据</div>;
                    const total = entries.reduce((a: number, [, b]: any) => a + (b || 0), 0) || 1;
                    return (
                      <div className="space-y-4">
                        {entries.map(([key, count]: [string, any]) => {
                          const [label, color] = STATUS_LABELS[key] || [key, '#94a3b8'];
                          const pct = Math.round(((count || 0) / (total as number)) * 100);
                          return (
                            <div key={key}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
                                <span className="font-bold" style={{ color }}>{count} ({pct}%)</span>
                              </div>
                              <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                            </div>
                          );
                        })}
                        {/* Stacked bar */}
                        <div className="h-6 flex rounded-full overflow-hidden mt-4">
                          {entries.map(([key, count]: [string, any]) => {
                            const [, color] = STATUS_LABELS[key] || [key, '#94a3b8'];
                            const pct = ((count || 0) / (total as number)) * 100;
                            return pct > 0 ? <div key={key} style={{ width: `${pct}%`, backgroundColor: color }} className="transition-all duration-500" /> : null;
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Monthly Trends - Bar chart */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">bar_chart</span>
                    月度趋势 (近6月)
                  </h3>
                  {data.monthlyTrends?.length > 0 ? (() => {
                    const maxVal = Math.max(...data.monthlyTrends.map((m: any) => m.created), 1);
                    return (
                      <div className="flex items-end gap-3 h-40">
                        {data.monthlyTrends.map((m: any) => (
                          <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full flex flex-col items-center gap-0.5" style={{ height: '120px' }}>
                              <div className="w-full flex gap-0.5 items-end" style={{ height: '100%' }}>
                                <div className="flex-1 bg-blue-400/80 rounded-t-md transition-all duration-500 hover:bg-blue-500"
                                  title={`创建: ${m.created}`}
                                  style={{ height: `${(m.created / maxVal) * 100}%`, minHeight: m.created > 0 ? '4px' : '0' }} />
                                <div className="flex-1 bg-emerald-400/80 rounded-t-md transition-all duration-500 hover:bg-emerald-500"
                                  title={`完成: ${m.completed}`}
                                  style={{ height: `${(m.completed / maxVal) * 100}%`, minHeight: m.completed > 0 ? '4px' : '0' }} />
                              </div>
                            </div>
                            <span className="text-[9px] text-slate-400">{m.month.slice(5)}月</span>
                          </div>
                        ))}
                      </div>
                    );
                  })() : (
                    <div className="text-center py-10 text-slate-400 text-sm">暂无数据</div>
                  )}
                  <div className="flex items-center justify-center gap-6 mt-4 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-400" />创建</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-400" />完成</span>
                  </div>
                </div>
              </div>

              {/* ── Row 3: Department Heatmap + Top Performers ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Department Heatmap */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-orange-500">grid_view</span>
                    部门效能热力图
                  </h3>
                  {data.deptStats?.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {data.deptStats.map((dept: any) => {
                        const avg = Math.round(dept.avg_progress || 0);
                        const s = getDeptColor(avg);
                        return (
                          <div key={dept.id} className={`rounded-xl p-4 border-l-4 ${s.border} ${s.bg} dark:bg-opacity-10`}>
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{dept.name}</h4>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.badge}</span>
                            </div>
                            <p className={`text-2xl font-black ${s.text}`}>{avg}%</p>
                            <p className="text-[10px] text-slate-400 mt-1">{dept.member_count || 0} 人 · {dept.plan_count || 0} 个计划</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-sm">暂无部门数据，请先同步组织架构</div>
                  )}
                </div>

                {/* Top Performers */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-amber-500">military_tech</span>
                    绩效排行榜
                  </h3>
                  {data.topPerformers?.length > 0 ? (
                    <div className="space-y-3">
                      {data.topPerformers.map((p: any, i: number) => (
                        <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                            i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : 'bg-orange-100 text-orange-600'
                          }`}>{i + 1}</div>
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-600">
                            {p.name?.[0] || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{p.dept_name || p.title}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-emerald-600">{Math.round(p.avg_score * 10) / 10}</p>
                            <p className="text-[9px] text-slate-400">{p.plan_count} 项</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-sm">暂无评分数据</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
