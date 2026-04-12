import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

interface FieldSetting {
  key: string;
  label: string;
  category: string;
  checked: boolean;
}

interface PerfTaskDetail {
  id: string;
  title: string;
  source: 'direct' | 'bounty';
  score: number;
  bonus: number;
}

interface UserPerfStats {
  user_id: string;
  user_name: string;
  department_name: string;
  total_score: number;
  total_bonus: number;
  tasks: PerfTaskDetail[];
  eval_self_score: number;
  eval_manager_score: number;
  eval_prof_score: number;
  eval_peer_score: number;
  eval_final_score: number;
}

export default function PerfAccountingPage({ navigate }: { navigate: (view: string) => void }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [stats, setStats] = useState<UserPerfStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Search & Filter
  const [searchText, setSearchText] = useState('');
  const [filterDept, setFilterDept] = useState('');

  // Export config
  const [fields, setFields] = useState<FieldSetting[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTplName, setNewTplName] = useState('');
  const [exporting, setExporting] = useState(false);

  const { hasPermission } = useAuth();

  const fetchStats = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/perf/stats/overview?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.code === 0) {
        setStats(data.data);
      } else {
        alert(data.message || '获取数据失败');
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/payroll-export/fields', { headers })
      .then(res => res.json())
      .then(json => { if (json.code === 0) setFields(json.data); });
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/payroll-export/templates', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.code === 0) setTemplates(json.data || []);
    } catch {}
  };

  const saveTemplate = async () => {
    if (!newTplName) return alert('请输入模板名称');
    const activeKeys = fields.filter(f => f.checked).map(f => f.key);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/payroll-export/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: newTplName, fields_json: JSON.stringify(activeKeys) })
      });
      const json = await res.json();
      if (json.code === 0) { setNewTplName(''); fetchTemplates(); alert('模板已保存'); }
    } catch {}
  };

  const applyTemplate = (fieldsJsonStr: string) => {
    try {
      const keys = JSON.parse(fieldsJsonStr);
      setFields(prev => prev.map(f => ({ ...f, checked: keys.includes(f.key) })));
    } catch {}
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const activeFields = fields.filter(f => f.checked);
      if (activeFields.length === 0) { alert('请至少选择一个导出字段'); setExporting(false); return; }
      const activeKeys = activeFields.map(f => f.key);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/payroll-export/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month, fields: activeKeys })
      });
      const json = await res.json();
      if (json.code === 0 && json.data?.length > 0) {
        const headerRow = activeFields.map(f => f.label);
        const rows = json.data.map((rowData: any) =>
          activeFields.map(f => {
            const val = rowData[f.key];
            return typeof val === 'number' ? Number(val.toFixed(2)) : val || '';
          })
        );
        const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '薪资台账');
        XLSX.writeFile(workbook, `发薪台账导出_${month}.xlsx`);
        setShowConfig(false);
      } else {
        alert('当前月份没查到任何人的发薪记录，无法导出');
      }
    } catch (e) {
      console.error(e);
      alert('导出失败');
    }
    setExporting(false);
  };

  const categories = Array.from(new Set(fields.map(f => f.category)));
  const toggleRow = (userId: string) => setExpandedRows(prev => ({ ...prev, [userId]: !prev[userId] }));

  // Derived: department list for filter
  const departments = useMemo(() => {
    const set = new Set(stats.map(s => s.department_name).filter(Boolean));
    return Array.from(set).sort();
  }, [stats]);

  // Filtered data
  const filteredStats = useMemo(() => {
    let list = stats;
    if (filterDept) list = list.filter(s => s.department_name === filterDept);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(s =>
        s.user_name.toLowerCase().includes(q) ||
        s.user_id.toLowerCase().includes(q) ||
        (s.department_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [stats, filterDept, searchText]);

  // Aggregates on filtered data
  const sumScore = filteredStats.reduce((acc, s) => acc + s.total_score, 0);
  const sumBonus = filteredStats.reduce((acc, s) => acc + s.total_bonus, 0);
  const avgScore = filteredStats.length > 0 ? sumScore / filteredStats.length : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 antialiased font-sans">
      <Sidebar currentView="perf-accounting" navigate={navigate} />

      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto relative p-4 lg:p-10 pb-20 lg:pb-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-indigo-600 dark:text-indigo-400">payments</span>
              员工绩效统计台账
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-2xl leading-relaxed">
              全员绩效与奖金核算一览表，与导出字段保持一致。可穿透查看每笔奖金的<strong className="text-indigo-500">来源任务编号</strong>。
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 shadow-sm flex items-center">
              <span className="material-symbols-outlined text-slate-400 text-lg ml-2">calendar_month</span>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none w-32 cursor-pointer" />
            </div>
            <button onClick={() => setShowConfig(!showConfig)}
              className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-md hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">tune</span>
              导出与模板配置
            </button>
          </div>
        </div>

        {/* Aggregate Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">本月涉及核算人数</span>
            <div className="text-3xl font-black text-slate-800 dark:text-white">{filteredStats.length} <span className="text-base font-medium text-slate-400 ml-1">人</span></div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 shadow-sm flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute right-[-10px] bottom-[-20px] opacity-5 group-hover:scale-110 transition-transform duration-500">
              <span className="material-symbols-outlined text-8xl text-indigo-600">military_tech</span>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">核定全员总绩效分</span>
            <div className="text-3xl font-black text-indigo-700 dark:text-indigo-300 relative z-10">{sumScore.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} <span className="text-base font-medium text-indigo-400 ml-1">分</span></div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 shadow-sm flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute right-[-10px] bottom-[-20px] opacity-5 group-hover:scale-110 transition-transform duration-500">
              <span className="material-symbols-outlined text-8xl text-emerald-600">currency_yuan</span>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">需拨款实得总奖金</span>
            <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300 relative z-10"><span className="text-xl mr-1">¥</span>{sumBonus.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-amber-100 dark:border-amber-500/20 shadow-sm flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute right-[-10px] bottom-[-20px] opacity-5 group-hover:scale-110 transition-transform duration-500">
              <span className="material-symbols-outlined text-8xl text-amber-600">avg_pace</span>
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">人均绩效得分</span>
            <div className="text-3xl font-black text-amber-700 dark:text-amber-300 relative z-10">{avgScore.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} <span className="text-base font-medium text-amber-400 ml-1">分</span></div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="搜索姓名 / 工号..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-indigo-500/30 font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400"
            />
            {searchText && (
              <button onClick={() => setSearchText('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
          <div className="relative min-w-[160px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">apartment</span>
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 ring-indigo-500/30 font-medium text-slate-700 dark:text-slate-200 appearance-none cursor-pointer"
            >
              <option value="">全部部门</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">expand_more</span>
          </div>
          {(searchText || filterDept) && (
            <button onClick={() => { setSearchText(''); setFilterDept(''); }}
              className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>清除筛选
            </button>
          )}
          <span className="text-xs text-slate-400 ml-auto">
            显示 {filteredStats.length} / {stats.length} 人
          </span>
        </div>

        {/* Main Data Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-sm font-medium animate-pulse">正在穿透业务数据汇算...</p>
            </div>
          ) : filteredStats.length === 0 ? (
            <div className="p-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-700">receipt_long</span>
              <p className="text-base font-bold text-slate-500">
                {stats.length === 0 ? '所选月份暂无已完结兑现的绩效任务' : '无匹配的搜索结果'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left bg-white dark:bg-slate-800 border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider w-10 text-center sticky left-0 bg-slate-50 dark:bg-slate-900 z-10"></th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">工号</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">员工姓名</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">所属部门</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">绩效总台账分</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">核定应发奖金</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">任务溯源</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">自评分<span className="text-slate-400 font-normal">(20%)</span></th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">主管分<span className="text-slate-400 font-normal">(30%)</span></th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">专业分<span className="text-slate-400 font-normal">(40%)</span></th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">互评分<span className="text-slate-400 font-normal">(10%)</span></th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">评价总分</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredStats.map(user => {
                    const isExpanded = !!expandedRows[user.user_id];
                    const hasTasks = user.tasks.length > 0;

                    return (
                      <React.Fragment key={user.user_id}>
                        <tr className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                          onClick={() => hasTasks && toggleRow(user.user_id)}>
                          {/* Expand toggle */}
                          <td className="px-3 py-3 text-center sticky left-0 bg-white dark:bg-slate-800 z-10">
                            {hasTasks && (
                              <span className={`material-symbols-outlined text-[14px] transition-transform duration-200 ${isExpanded ? 'rotate-90 text-indigo-500' : 'text-slate-300'}`}>
                                chevron_right
                              </span>
                            )}
                          </td>
                          {/* 工号 */}
                          <td className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap">{user.user_id}</td>
                          {/* 姓名 */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-[10px]">
                                {user.user_name.charAt(0)}
                              </div>
                              <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{user.user_name}</span>
                            </div>
                          </td>
                          {/* 部门 */}
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{user.department_name}</td>
                          {/* 绩效总分 */}
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold text-sm ${user.total_score > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300'}`}>
                              {user.total_score > 0 ? user.total_score.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '-'}
                            </span>
                          </td>
                          {/* 核定奖金 */}
                          <td className="px-4 py-3 text-right">
                            <span className={`font-black text-sm ${user.total_bonus > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300'}`}>
                              {user.total_bonus > 0 ? `¥${user.total_bonus.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}
                            </span>
                          </td>
                          {/* 任务溯源 */}
                          <td className="px-4 py-3 text-center">
                            {hasTasks ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                                <span className="material-symbols-outlined text-[12px]">link</span>
                                {user.tasks.length} 笔
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </td>
                          {/* 5 eval scores */}
                          <td className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                            {user.eval_self_score > 0 ? user.eval_self_score.toFixed(1) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                            {user.eval_manager_score > 0 ? user.eval_manager_score.toFixed(1) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                            {user.eval_prof_score > 0 ? user.eval_prof_score.toFixed(1) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                            {user.eval_peer_score > 0 ? user.eval_peer_score.toFixed(1) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold text-sm ${user.eval_final_score > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-slate-300'}`}>
                              {user.eval_final_score > 0 ? user.eval_final_score.toFixed(1) : '-'}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded Task Detail */}
                        {isExpanded && hasTasks && (
                          <tr className="bg-slate-50/80 dark:bg-slate-900/50">
                            <td></td>
                            <td colSpan={11} className="p-0 border-l-2 border-indigo-300 dark:border-indigo-500/40">
                              <div className="p-4">
                                <h4 className="text-[11px] font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[14px]">subdirectory_arrow_right</span>
                                  【{user.user_name}】本期奖金任务溯源明细
                                </h4>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                                  <table className="w-full text-left">
                                    <thead>
                                      <tr className="bg-slate-100/50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-4 py-2 text-[10px] font-black tracking-wider text-slate-400">来源任务编号</th>
                                        <th className="px-4 py-2 text-[10px] font-black tracking-wider text-slate-400">类型</th>
                                        <th className="px-4 py-2 text-[10px] font-black tracking-wider text-slate-400 w-1/2">任务标题</th>
                                        <th className="px-4 py-2 text-[10px] font-black tracking-wider text-slate-400 text-right">核算得分</th>
                                        <th className="px-4 py-2 text-[10px] font-black tracking-wider text-slate-400 text-right">拨付奖金</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                      {user.tasks.map(task => (
                                        <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                          <td className="px-4 py-2 whitespace-nowrap">
                                            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                                              {task.id}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                              task.source === 'bounty'
                                                ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                                : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                            }`}>
                                              {task.source === 'bounty' ? '赏金池' : '直接'}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-xs" title={task.title}>
                                            {task.title}
                                          </td>
                                          <td className="px-4 py-2 text-xs text-right font-bold text-indigo-500">
                                            {task.score > 0 ? `+${task.score}` : task.score || '-'}
                                          </td>
                                          <td className="px-4 py-2 text-xs text-right font-black text-emerald-600 dark:text-emerald-400">
                                            {task.bonus > 0 ? `¥${task.bonus.toLocaleString()}` : '-'}
                                          </td>
                                        </tr>
                                      ))}
                                      <tr className="bg-slate-50 dark:bg-slate-900/50">
                                        <td colSpan={3} className="px-4 py-2 text-right text-[10px] font-bold text-slate-500">源数据汇总 =</td>
                                        <td className="px-4 py-2 text-xs text-right font-black text-indigo-700 dark:text-indigo-400">{user.total_score}</td>
                                        <td className="px-4 py-2 text-xs text-right font-black text-emerald-700 dark:text-emerald-400">¥{user.total_bonus.toLocaleString()}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Export Config Drawer */}
        {showConfig && (
          <div className="absolute top-0 right-0 bottom-0 w-[420px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col pt-6 animate-in slide-in-from-right-8 duration-300">
            <div className="px-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 z-10 bg-white dark:bg-slate-900">
              <h3 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                <span className="material-symbols-outlined text-indigo-500">settings_applications</span>
                导出字段提取器
              </h3>
              <button onClick={() => setShowConfig(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">汇总发薪月：<span className="text-indigo-600">{month}</span></span>
              <button onClick={handleExportExcel} disabled={exporting}
                className="px-4 py-2 bg-emerald-600 text-white font-bold hover:bg-emerald-700 rounded-lg text-sm transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined text-[18px]">{exporting ? 'hourglass_empty' : 'download'}</span>
                {exporting ? '提取中...' : '生成发薪表'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-900">
              {categories.map(cat => (
                <div key={cat} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-4 px-1">{cat}</h4>
                  <div className="space-y-3">
                    {fields.filter(f => f.category === cat).map(f => (
                      <label key={f.key} className="flex items-center gap-3 cursor-pointer group p-2 rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${f.checked ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm shadow-indigo-500/20' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                          {f.checked && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
                        </div>
                        <input type="checkbox" checked={f.checked} className="hidden"
                          onChange={(e) => setFields(prev => prev.map(item => item.key === f.key ? {...item, checked: e.target.checked} : item))} />
                        <span className={`text-sm select-none ${f.checked ? 'font-bold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>{f.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                <h4 className="font-bold text-sm text-indigo-800 dark:text-indigo-300 mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">save</span>保存为预设模板
                </h4>
                <div className="flex gap-2">
                  <input value={newTplName} onChange={e => setNewTplName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border-indigo-200 dark:border-indigo-700 rounded-lg outline-none focus:ring-2 ring-indigo-500/30 font-bold text-indigo-900 dark:text-indigo-100 dark:bg-slate-800"
                    placeholder="例如：开发部报盘底座" />
                  <button onClick={saveTemplate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm shadow-indigo-600/30 hover:bg-indigo-700 active:scale-95">保存</button>
                </div>
                {templates.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-indigo-200/50 dark:border-indigo-800/50">
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-2 font-bold uppercase tracking-wider">已保存预设方案</p>
                    <div className="flex flex-wrap gap-2">
                      {templates.map(tpl => (
                        <button key={tpl.id} onClick={() => applyTemplate(tpl.fields_json)}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all flex items-center gap-1 shadow-sm">
                          <span className="material-symbols-outlined text-[12px]">library_add_check</span>{tpl.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
