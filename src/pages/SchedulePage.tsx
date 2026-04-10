import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { useIsMobile } from '../hooks/useIsMobile';

type TabKey = 'calendar' | 'leaves' | 'config';

interface ShiftType { id: number; name: string; code: string; color: string; start_time: string; end_time: string; sort_order: number; enabled: number }
interface LeaveType { id: number; name: string; code: string; color: string; need_approval: number; max_days: number | null; unit: string; sort_order: number; enabled: number }
interface CalendarUser { id: string; name: string; avatar_url: string; title: string; department_id: number }
interface ShiftRecord { id: number; user_id: string; date: string; shift_type: string; shift_label: string; department_id: number; note: string }
interface LeaveRecord { id: number; user_id: string; leave_type_id: number; start_date: string; end_date: string; duration: number; reason: string; status: string; leave_type_name: string; leave_type_color: string; user_name: string; dept_name: string; created_at: string }
interface Dept { id: number; name: string }

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '待审批', color: 'text-amber-600', bg: 'bg-amber-50' },
  approved:  { label: '已通过', color: 'text-green-600', bg: 'bg-green-50' },
  rejected:  { label: '已驳回', color: 'text-red-600',   bg: 'bg-red-50' },
  cancelled: { label: '已撤销', color: 'text-slate-400', bg: 'bg-slate-50' },
};

const token = () => localStorage.getItem('token') || '';
const api = async (url: string, opts?: RequestInit) => {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...opts?.headers } });
  return res.json();
};

export default function SchedulePage({ navigate }: { navigate: (v: string) => void }) {
  const { currentUser, hasPermission } = useAuth();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<TabKey>('calendar');

  const canManageShifts = hasPermission('manage_dept_shifts');
  const canManageConfig = hasPermission('manage_leave_types');
  const canViewDeptLeaves = hasPermission('view_dept_leaves');

  const tabs: { key: TabKey; label: string; icon: string; show: boolean }[] = [
    { key: 'calendar', label: '值班日历', icon: 'calendar_month', show: true },
    { key: 'leaves',   label: '请假管理', icon: 'event_busy',     show: true },
    { key: 'config',   label: '假期配置', icon: 'settings',       show: canManageConfig },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar currentView="schedule" navigate={navigate} />
      <div className="flex-1 mt-16 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            {isMobile && (
              <button onClick={() => navigate('dashboard')} className="mr-3">
                <span className="material-symbols-outlined text-slate-400">arrow_back</span>
              </button>
            )}
            <h1 className="text-xl font-black text-slate-800">排班请假</h1>
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {tabs.filter(t => t.show).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    tab === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  <span className="material-symbols-outlined text-sm">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {tab === 'calendar' && <CalendarTab canManage={canManageShifts} userId={currentUser?.id} userDeptId={currentUser?.department_id} />}
          {tab === 'leaves' && <LeavesTab userId={currentUser?.id || ''} canViewDept={canViewDeptLeaves} canApprove={canViewDeptLeaves} />}
          {tab === 'config' && <ConfigTab />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Tab 1: 值班日历
// ═══════════════════════════════════════════════════════════════════

function CalendarTab({ canManage, userId, userDeptId }: { canManage: boolean; userId?: string; userDeptId?: number }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [deptId, setDeptId] = useState<number | ''>('');
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');
  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const [users, setUsers] = useState<CalendarUser[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState<{ userId: string; date: string } | null>(null);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const fetchData = async () => {
    setLoading(true);
    const [calRes, stRes] = await Promise.all([
      api(`/api/schedule/calendar?year=${year}&month=${month}${deptId ? `&department_id=${deptId}` : ''}`),
      api('/api/schedule/shift-types'),
    ]);
    if (calRes.code === 0) {
      setUsers(calRes.data.users);
      setShifts(calRes.data.shifts);
      setLeaves(calRes.data.leaves);
      setDepartments(calRes.data.departments);
    }
    if (stRes.code === 0) setShiftTypes(stRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [year, month, deptId]);

  // 点击外部关闭部门下拉
  useEffect(() => {
    if (!deptOpen) return;
    const handler = (e: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) setDeptOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [deptOpen]);

  // 按部门分组用户
  const groupedUsers = useMemo(() => {
    const groups: Record<string, CalendarUser[]> = {};
    for (const u of users) {
      const dept = departments.find(d => d.id === u.department_id);
      const key = dept ? dept.name : '未分配部门';
      if (!groups[key]) groups[key] = [];
      groups[key].push(u);
    }
    return groups;
  }, [users, departments]);

  // 构建查找表
  const shiftMap = useMemo(() => {
    const m: Record<string, ShiftRecord> = {};
    for (const s of shifts) m[`${s.user_id}_${s.date}`] = s;
    return m;
  }, [shifts]);

  const leaveMap = useMemo(() => {
    const m: Record<string, LeaveRecord> = {};
    for (const l of leaves) {
      const start = new Date(l.start_date);
      const end = new Date(l.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = `${l.user_id}_${d.toISOString().slice(0, 10)}`;
        m[key] = l;
      }
    }
    return m;
  }, [leaves]);

  const handleSetShift = async (userId: string, date: string, shiftType: ShiftType) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const user = users.find(u => u.id === userId);
    await api('/api/schedule/shifts/batch', {
      method: 'POST',
      body: JSON.stringify({ items: [{ user_id: userId, date: dateStr, shift_type: shiftType.code, shift_label: shiftType.name, department_id: user?.department_id }] }),
    });
    setEditCell(null);
    fetchData();
  };

  const handleDeleteShift = async (shiftId: number) => {
    await api(`/api/schedule/shifts/${shiftId}`, { method: 'DELETE' });
    setEditCell(null);
    fetchData();
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const getWeekday = (day: number) => {
    const d = new Date(year, month - 1, day);
    return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  };
  const isWeekend = (day: number) => {
    const d = new Date(year, month - 1, day);
    return d.getDay() === 0 || d.getDay() === 6;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      {/* Controls bar — outside the scrollable card to avoid stacking context issues */}
      <div className="flex flex-wrap items-center gap-3 mb-3 px-1">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="hover:bg-slate-100 rounded-lg p-1 transition-colors">
            <span className="material-symbols-outlined text-base text-slate-500">chevron_left</span>
          </button>
          <span className="font-black text-slate-700 text-sm min-w-[100px] text-center">{year} 年 {month} 月</span>
          <button onClick={nextMonth} className="hover:bg-slate-100 rounded-lg p-1 transition-colors">
            <span className="material-symbols-outlined text-base text-slate-500">chevron_right</span>
          </button>
        </div>

        <div className="relative" ref={deptDropdownRef}>
          <button onClick={() => { setDeptOpen(v => !v); setDeptSearch(''); }}
            className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-1.5 border border-slate-200 text-xs font-medium text-slate-600 shadow-sm hover:border-blue-300 transition-colors">
            <span className="material-symbols-outlined text-sm text-slate-400">apartment</span>
            {deptId ? departments.find(d => d.id === deptId)?.name || '全部部门' : '全部部门'}
            <span className={`material-symbols-outlined text-sm text-slate-400 transition-transform ${deptOpen ? 'rotate-180' : ''}`}>expand_more</span>
          </button>
          {deptOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-50 min-w-[200px] overflow-hidden">
              <div className="p-2 border-b border-slate-100">
                <input autoFocus value={deptSearch} onChange={e => setDeptSearch(e.target.value)}
                  placeholder="搜索部门..." className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100" />
              </div>
              <div className="max-h-[240px] overflow-y-auto py-1">
                <button onClick={() => { setDeptId(''); setDeptOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${deptId === '' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {deptId === '' && <span className="material-symbols-outlined text-sm">check</span>}
                  全部部门
                </button>
                {departments.filter(d => !deptSearch || d.name.includes(deptSearch)).map(d => (
                  <button key={d.id} onClick={() => { setDeptId(d.id); setDeptOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${deptId === d.id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                    {deptId === d.id && <span className="material-symbols-outlined text-sm">check</span>}
                    {d.name}
                  </button>
                ))}
                {departments.filter(d => !deptSearch || d.name.includes(deptSearch)).length === 0 && (
                  <div className="px-3 py-4 text-xs text-slate-400 text-center">无匹配部门</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1" />
        <div className="flex gap-1.5 flex-wrap">
          {shiftTypes.map(st => (
            <span key={st.id} className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: st.color + '20', color: st.color }}>
              {st.name}{st.start_time && st.end_time ? ` ${st.start_time}-${st.end_time}` : ''}
            </span>
          ))}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-500">请假</span>
        </div>
      </div>

      {/* Calendar Card — table only */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-auto max-h-[calc(100vh-220px)]">
        <table className="w-full text-xs border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-20 bg-white">
            <tr className="border-b border-slate-100">
              <th className="sticky left-0 bg-white z-30 px-3 py-2 text-left text-slate-500 font-medium min-w-[100px]">成员</th>
              {days.map(d => (
                <th key={d} className={`px-1 py-2 text-center font-medium min-w-[36px] ${isWeekend(d) ? 'text-red-400 bg-red-50' : 'text-slate-500 bg-white'}`}>
                  <div>{d}</div>
                  <div className="text-[9px] font-normal">{getWeekday(d)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedUsers).map(([deptName, deptUsers]) => (
              <React.Fragment key={deptName}>
                <tr className="bg-slate-50/50">
                  <td colSpan={days.length + 1} className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">{deptName}</td>
                </tr>
                {deptUsers.map(user => (
                  <tr key={user.id} className="border-b border-slate-50 hover:bg-blue-50/20 transition-colors">
                    <td className="sticky left-0 bg-white z-10 px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} className="w-5 h-5 rounded-full" alt="" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-bold text-blue-600">{user.name[0]}</div>
                        )}
                        <span className="font-medium text-slate-700 truncate max-w-[70px]">{user.name}</span>
                      </div>
                    </td>
                    {days.map(d => {
                      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const cellKey = `${user.id}_${dateStr}`;
                      const shift = shiftMap[cellKey];
                      const leave = leaveMap[cellKey];
                      const isEditing = editCell?.userId === user.id && editCell?.date === String(d);
                      const stInfo = shift ? shiftTypes.find(st => st.code === shift.shift_type) : null;

                      return (
                        <td key={d} className={`px-0.5 py-1 text-center relative ${isWeekend(d) ? 'bg-red-50/20' : ''}`}>
                          {isEditing && canManage ? (
                            <div className="absolute z-20 top-0 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-slate-200 p-2 min-w-[120px]">
                              {shiftTypes.map(st => (
                                <button key={st.id} onClick={() => handleSetShift(user.id, String(d), st)}
                                  className="block w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors">
                                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: st.color }} />
                                  {st.name}
                                </button>
                              ))}
                              {shift && (
                                <button onClick={() => handleDeleteShift(shift.id)}
                                  className="block w-full text-left px-2 py-1.5 rounded-lg hover:bg-red-50 text-xs font-medium text-red-500 mt-1 border-t border-slate-100 pt-1.5">
                                  清除
                                </button>
                              )}
                              <button onClick={() => setEditCell(null)}
                                className="block w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 text-xs font-medium text-slate-400">
                                取消
                              </button>
                            </div>
                          ) : null}
                          <div
                            onClick={() => canManage ? setEditCell({ userId: user.id, date: String(d) }) : undefined}
                            className={`min-h-[24px] rounded-md flex items-center justify-center text-[9px] font-bold leading-none ${canManage ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}`}
                            title={shift?.note || leave?.reason || ''}
                          >
                            {leave ? (
                              <span className="px-1 py-0.5 rounded" style={{ backgroundColor: (leave.leave_type_color || '#EF4444') + '20', color: leave.leave_type_color || '#EF4444' }}>
                                {leave.leave_type_name?.slice(0, 1) || '假'}
                              </span>
                            ) : shift ? (
                              <span className="px-1 py-0.5 rounded" style={{ backgroundColor: (stInfo?.color || '#10B981') + '20', color: stInfo?.color || '#10B981' }}>
                                {shift.shift_label?.slice(0, 1) || shift.shift_type.slice(0, 1)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="py-16 text-center text-slate-400 text-sm">
            <span className="material-symbols-outlined text-4xl mb-2 block">event_busy</span>
            暂无排班数据，请选择部门
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Tab 2: 请假管理
// ═══════════════════════════════════════════════════════════════════

function LeavesTab({ userId, canViewDept, canApprove }: { userId: string; canViewDept: boolean; canApprove: boolean }) {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<'mine' | 'dept'>(canViewDept ? 'dept' : 'mine');

  const [form, setForm] = useState({ leave_type_id: 0, start_date: '', end_date: '', start_half: 'am', end_half: 'pm', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchLeaves = async () => {
    setLoading(true);
    const params = viewMode === 'mine' ? `user_id=${userId}` : '';
    const [lRes, ltRes] = await Promise.all([
      api(`/api/schedule/leaves?${params}`),
      api('/api/schedule/leave-types'),
    ]);
    if (lRes.code === 0) setLeaves(lRes.data);
    if (ltRes.code === 0) {
      setLeaveTypes(ltRes.data);
      if (ltRes.data.length > 0 && !form.leave_type_id) setForm(f => ({ ...f, leave_type_id: ltRes.data[0].id }));
    }
    setLoading(false);
  };

  useEffect(() => { fetchLeaves(); }, [viewMode]);

  const calcDuration = () => {
    if (!form.start_date || !form.end_date) return 0;
    const s = new Date(form.start_date);
    const e = new Date(form.end_date);
    let days = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (form.start_half === 'pm') days -= 0.5;
    if (form.end_half === 'am') days -= 0.5;
    return Math.max(days, 0.5);
  };

  const handleSubmit = async () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) return;
    setSubmitting(true);
    const duration = calcDuration();
    const res = await api('/api/schedule/leaves', {
      method: 'POST',
      body: JSON.stringify({ ...form, duration }),
    });
    setSubmitting(false);
    if (res.code === 0) {
      setShowCreate(false);
      setForm({ leave_type_id: leaveTypes[0]?.id || 0, start_date: '', end_date: '', start_half: 'am', end_half: 'pm', reason: '' });
      fetchLeaves();
    } else {
      alert(res.message || '提交失败');
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('确定撤销该请假申请？')) return;
    await api(`/api/schedule/leaves/${id}`, { method: 'DELETE' });
    fetchLeaves();
  };

  const handleApprove = async (id: number, action: 'approve' | 'reject') => {
    await api(`/api/schedule/leaves/${id}/approve`, { method: 'PUT', body: JSON.stringify({ action }) });
    fetchLeaves();
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        {canViewDept && (
          <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-100">
            {(['mine', 'dept'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === m ? 'bg-blue-50 text-blue-600' : 'text-slate-500'}`}>
                {m === 'mine' ? '我的请假' : '部门请假'}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <button onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">add</span> 新建请假
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 mb-4">新建请假申请</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">假期类型</label>
                <div className="flex flex-wrap gap-2">
                  {leaveTypes.map(lt => (
                    <button key={lt.id} onClick={() => setForm(f => ({ ...f, leave_type_id: lt.id }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        form.leave_type_id === lt.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      style={form.leave_type_id === lt.id ? { borderColor: lt.color, backgroundColor: lt.color + '15', color: lt.color } : {}}>
                      {lt.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">开始日期</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                  <select value={form.start_half} onChange={e => setForm(f => ({ ...f, start_half: e.target.value }))}
                    className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600">
                    <option value="am">上午开始</option>
                    <option value="pm">下午开始</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">结束日期</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                  <select value={form.end_half} onChange={e => setForm(f => ({ ...f, end_half: e.target.value }))}
                    className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600">
                    <option value="am">上午结束</option>
                    <option value="pm">下午结束</option>
                  </select>
                </div>
              </div>

              {form.start_date && form.end_date && (
                <div className="text-center py-2 bg-blue-50 rounded-xl">
                  <span className="text-2xl font-black text-blue-600">{calcDuration()}</span>
                  <span className="text-xs text-blue-500 ml-1 font-bold">天</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">请假事由</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3} placeholder="请输入请假原因..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none" />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all">取消</button>
              <button onClick={handleSubmit} disabled={submitting || !form.start_date || !form.end_date}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50">
                {submitting ? '提交中...' : '提交申请'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave List */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : leaves.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm bg-white rounded-2xl shadow-sm border border-slate-100">
          <span className="material-symbols-outlined text-4xl mb-2 block">beach_access</span>
          暂无请假记录
        </div>
      ) : (
        <div className="space-y-3">
          {leaves.map(l => {
            const st = STATUS_MAP[l.status] || STATUS_MAP.pending;
            return (
              <div key={l.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white" style={{ backgroundColor: l.leave_type_color || '#3B82F6' }}>
                      {l.leave_type_name?.slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{l.leave_type_name}</div>
                      {viewMode === 'dept' && <div className="text-[10px] text-slate-400 font-medium">{l.user_name} · {l.dept_name}</div>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${st.color} ${st.bg}`}>{st.label}</span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">date_range</span>
                    {l.start_date} ~ {l.end_date}
                  </span>
                  <span className="font-bold text-blue-600">{l.duration} 天</span>
                </div>
                {l.reason && <p className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{l.reason}</p>}
                <div className="mt-3 flex gap-2 justify-end">
                  {l.status === 'pending' && l.user_id === userId && (
                    <button onClick={() => handleCancel(l.id)} className="text-[10px] font-bold text-red-500 px-3 py-1 rounded-lg hover:bg-red-50 transition-all">撤销</button>
                  )}
                  {l.status === 'pending' && canApprove && l.user_id !== userId && (
                    <>
                      <button onClick={() => handleApprove(l.id, 'reject')} className="text-[10px] font-bold text-red-500 px-3 py-1 rounded-lg hover:bg-red-50 transition-all">驳回</button>
                      <button onClick={() => handleApprove(l.id, 'approve')} className="text-[10px] font-bold text-green-600 px-3 py-1 rounded-lg hover:bg-green-50 transition-all">通过</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Tab 3: 假期配置（管理员）
// ═══════════════════════════════════════════════════════════════════

function ConfigTab() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [configTab, setConfigTab] = useState<'leave' | 'shift'>('leave');
  const [editingLT, setEditingLT] = useState<Partial<LeaveType> | null>(null);
  const [editingST, setEditingST] = useState<Partial<ShiftType> | null>(null);

  const fetchConfig = async () => {
    const [lt, st] = await Promise.all([api('/api/schedule/leave-types/all'), api('/api/schedule/shift-types')]);
    if (lt.code === 0) setLeaveTypes(lt.data);
    if (st.code === 0) setShiftTypes(st.data);
  };

  useEffect(() => { fetchConfig(); }, []);

  const saveLT = async () => {
    if (!editingLT) return;
    const method = editingLT.id ? 'PUT' : 'POST';
    const url = editingLT.id ? `/api/schedule/leave-types/${editingLT.id}` : '/api/schedule/leave-types';
    const res = await api(url, { method, body: JSON.stringify(editingLT) });
    if (res.code === 0) { setEditingLT(null); fetchConfig(); } else alert(res.message);
  };

  const saveST = async () => {
    if (!editingST) return;
    const method = editingST.id ? 'PUT' : 'POST';
    const url = editingST.id ? `/api/schedule/shift-types/${editingST.id}` : '/api/schedule/shift-types';
    const res = await api(url, { method, body: JSON.stringify(editingST) });
    if (res.code === 0) { setEditingST(null); fetchConfig(); } else alert(res.message);
  };

  return (
    <div>
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-100 mb-4 w-fit">
        <button onClick={() => setConfigTab('leave')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${configTab === 'leave' ? 'bg-blue-50 text-blue-600' : 'text-slate-500'}`}>假期类型</button>
        <button onClick={() => setConfigTab('shift')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${configTab === 'shift' ? 'bg-blue-50 text-blue-600' : 'text-slate-500'}`}>班次定义</button>
      </div>

      {configTab === 'leave' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setEditingLT({ name: '', code: '', color: '#3B82F6', need_approval: 1, max_days: null, unit: 'day', sort_order: 0, enabled: 1 })}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">add</span> 新增假期类型
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leaveTypes.map(lt => (
              <div key={lt.id} className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 ${!lt.enabled ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lt.color }} />
                    <span className="font-bold text-slate-800 text-sm">{lt.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{lt.code}</span>
                  </div>
                  <button onClick={() => setEditingLT({ ...lt })} className="text-slate-400 hover:text-blue-500 transition-colors">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                </div>
                <div className="flex gap-3 text-[10px] text-slate-500">
                  <span>{lt.need_approval ? '需审批' : '免审批'}</span>
                  <span>{lt.max_days ? `上限${lt.max_days}天` : '不限天数'}</span>
                  <span>{lt.unit === 'half_day' ? '半天制' : lt.unit === 'hour' ? '小时制' : '天制'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Edit Modal */}
          {editingLT && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setEditingLT(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-black text-slate-800 mb-4">{editingLT.id ? '编辑' : '新增'}假期类型</h3>
                <div className="space-y-3">
                  <input placeholder="名称 (如: 年假)" value={editingLT.name || ''} onChange={e => setEditingLT(p => ({ ...p!, name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                  <input placeholder="编码 (如: annual)" value={editingLT.code || ''} onChange={e => setEditingLT(p => ({ ...p!, code: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono" />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">颜色</label>
                      <input type="color" value={editingLT.color || '#3B82F6'} onChange={e => setEditingLT(p => ({ ...p!, color: e.target.value }))}
                        className="w-full h-8 rounded-lg cursor-pointer" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">年度上限</label>
                      <input type="number" placeholder="不限" value={editingLT.max_days ?? ''} onChange={e => setEditingLT(p => ({ ...p!, max_days: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <select value={editingLT.unit || 'day'} onChange={e => setEditingLT(p => ({ ...p!, unit: e.target.value }))}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                      <option value="day">按天</option>
                      <option value="half_day">按半天</option>
                      <option value="hour">按小时</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={!!editingLT.need_approval} onChange={e => setEditingLT(p => ({ ...p!, need_approval: e.target.checked ? 1 : 0 }))} />
                      需审批
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button onClick={() => setEditingLT(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100">取消</button>
                  <button onClick={saveLT} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700">保存</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {configTab === 'shift' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setEditingST({ name: '', code: '', color: '#10B981', start_time: '', end_time: '', sort_order: 0, enabled: 1 })}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">add</span> 新增班次
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shiftTypes.map(st => (
              <div key={st.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: st.color }} />
                    <span className="font-bold text-slate-800 text-sm">{st.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{st.code}</span>
                  </div>
                  <button onClick={() => setEditingST({ ...st })} className="text-slate-400 hover:text-blue-500 transition-colors">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                </div>
                {st.start_time && st.end_time && (
                  <div className="text-[10px] text-slate-500 font-medium">{st.start_time} - {st.end_time}</div>
                )}
              </div>
            ))}
          </div>

          {editingST && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setEditingST(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-black text-slate-800 mb-4">{editingST.id ? '编辑' : '新增'}班次</h3>
                <div className="space-y-3">
                  <input placeholder="名称 (如: 早班)" value={editingST.name || ''} onChange={e => setEditingST(p => ({ ...p!, name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
                  <input placeholder="编码 (如: morning)" value={editingST.code || ''} onChange={e => setEditingST(p => ({ ...p!, code: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono" />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">颜色</label>
                      <input type="color" value={editingST.color || '#10B981'} onChange={e => setEditingST(p => ({ ...p!, color: e.target.value }))}
                        className="w-full h-8 rounded-lg cursor-pointer" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">开始时间</label>
                      <input type="time" value={editingST.start_time || ''} onChange={e => setEditingST(p => ({ ...p!, start_time: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">结束时间</label>
                      <input type="time" value={editingST.end_time || ''} onChange={e => setEditingST(p => ({ ...p!, end_time: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button onClick={() => setEditingST(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100">取消</button>
                  <button onClick={saveST} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700">保存</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
