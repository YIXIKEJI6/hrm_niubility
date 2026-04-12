import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Paperclip, File, X, Loader2, MessageSquare, Trash2, ExternalLink, FileText, Save, CheckCircle2 } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { parseUTC } from '../utils/dateUtils';

function formatTimeAgo(dateString: string) {
  const date = parseUTC(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

interface SharedSTARPanelProps {
  taskId: number;
  taskType: string;
  taskTitle: string;
  initialData?: any;
  currentUser: any;
}

interface Attachment {
  name: string;
  size: string;
  url: string;
  filename: string;
}

interface Discussion {
  id: number;
  user_id: string;
  user_name: string;
  avatar_url: string;
  content: string;
  attachments: Attachment[];
  created_at: string;
}

export default function SharedSTARPanel({ taskId, taskType, taskTitle, initialData, currentUser }: SharedSTARPanelProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // ── STAR 报告状态 ──
  const [myRole, setMyRole] = useState<string | null>(null);
  const [starReport, setStarReport] = useState<any>(null);
  const [starForm, setStarForm] = useState({ situation: '', task_desc: '', action: '', result: '' });
  const [starSaving, setStarSaving] = useState(false);
  const [starSubmitting, setStarSubmitting] = useState(false);
  const [starMsg, setStarMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [starExpanded, setStarExpanded] = useState(true);
  const [starConfirming, setStarConfirming] = useState(false);

  // ── 管理者查看所有 STAR 报告 + 评分 ──
  const [allStarReports, setAllStarReports] = useState<any[]>([]);
  const [allStarLoading, setAllStarLoading] = useState(false);
  const [scoreInput, setScoreInput] = useState('');
  const [scoring, setScoring] = useState(false);
  // A角色自评
  const [selfScoreInput, setSelfScoreInput] = useState('');
  const [selfScoring, setSelfScoring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  let targetType = 'perf_plan';
  if (taskType === 'pool_propose' || taskType === 'pool_publish' || taskType === 'proposal') {
    targetType = 'proposal';
  } else if (initialData?.flow_type === 'proposal') {
    targetType = 'proposal';
  }

  const isPoolTask = targetType === 'proposal';
  // STAR API 端点：perf 任务走 /api/perf/star，pool 任务走 /api/pool/star
  const starApiBase = isPoolTask ? `/api/pool/star/${taskId}` : `/api/perf/star/${taskId}`;
  const isRaUser = myRole === 'R' || myRole === 'A';
  const starSubmitted = starReport?.is_submitted === 1;

  // 管理者评分权限判断（仅 perf 任务，pool 任务走奖励分配流程）
  const isPendingAssessment = initialData?.status === 'pending_assessment';
  const isManager = (() => {
    if (!currentUser?.id) return false;
    const uid = String(currentUser.id);
    // 优先使用后端动态计算的 judge_id（最准确）
    if (initialData?.judge_id) {
      return String(initialData.judge_id) === uid;
    }
    // 兜底：无 judge_id 时按流程类型判断
    // flow1(下发): 评分人=creator_id（任务创建者/发起人），approver_id是A角色不应有评级权
    // flow2(申请): 评分人=上级主管（由getAssessmentJudge动态计算），兜底用dept_head_id
    if (initialData?.flow_type === 'application') {
      if (initialData?.dept_head_id && String(initialData.dept_head_id) === uid) return true;
    } else {
      // flow1: 只有 creator_id 有评级权，approver_id 是负责人A，不评分
      if (initialData?.creator_id && String(initialData.creator_id) === uid) return true;
    }
    if (currentUser?.is_super_admin) return true;
    return false;
  })();
  const canScore = isPendingAssessment && isManager && !isPoolTask;

  // A角色自评权限：pending_assessment 状态下，approver_id 可以自评
  const isApproverA = (() => {
    if (!currentUser?.id || !isPendingAssessment || isPoolTask) return false;
    const uid = String(currentUser.id);
    return initialData?.approver_id && String(initialData.approver_id) === uid;
  })();
  const hasSelfScore = initialData?.self_score != null && initialData.self_score > 0;
  const canSelfScore = isApproverA && !hasSelfScore;

  // A自评提交
  const handleSelfScore = async () => {
    const s = Number(selfScoreInput);
    if (!s || s < 1 || s > 100) return alert('请输入1-100的分数');
    setSelfScoring(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/perf/plans/${taskId}/self-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ score: s }),
      });
      const json = await res.json();
      if (json.code === 0) {
        alert('自评提交成功');
        if (initialData) initialData.self_score = s;
        setSelfScoreInput('');
      } else {
        alert(json.message || '自评提交失败');
      }
    } catch { alert('网络错误'); }
    finally { setSelfScoring(false); }
  };

  // ── 加载我的 STAR 报告（perf + pool 任务通用）──
  useEffect(() => {
    // 先从 initialData 的 RACI 字段判断角色（兜底，不依赖新API）
    if (currentUser?.id && !myRole) {
      const uid = String(currentUser.id);
      if (isPoolTask) {
        const aUsers = (initialData?.a || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        const rUsers = (initialData?.r || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        if (aUsers.includes(uid)) setMyRole('A');
        else if (rUsers.includes(uid)) setMyRole('R');
      } else {
        // perf 任务：从 assignee_id / approver_id / creator_id 判断
        if (initialData?.assignee_id && String(initialData.assignee_id).includes(uid)) setMyRole('R');
        else if (initialData?.approver_id && String(initialData.approver_id) === uid) setMyRole('A');
        else if (initialData?.creator_id && String(initialData.creator_id) === uid) setMyRole('A');
      }
    }

    const token = localStorage.getItem('token');
    fetch(`${starApiBase}/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.code === 0 && data.data) {
          // 统一格式: { report, role }
          const report = data.data.report !== undefined ? data.data.report : (data.data.is_submitted !== undefined ? data.data : null);
          const role = data.data.role || null;
          if (role) setMyRole(role);
          if (report) {
            setStarReport(report);
            setStarForm({
              situation: report.situation || '',
              task_desc: report.task_desc || '',
              action: report.action || '',
              result: report.result || '',
            });
            if (report.is_submitted === 1) setStarExpanded(false);
          }
        }
      })
      .catch(() => {});
  }, [taskId, starApiBase]);

  // ── 管理者：加载所有成员 STAR 报告 ──
  useEffect(() => {
    if (!canScore) return;
    setAllStarLoading(true);
    const token = localStorage.getItem('token');
    // perf-star GET /:planId 返回所有 STAR 报告
    fetch(starApiBase, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.code === 0 && data.data) {
          setAllStarReports(Array.isArray(data.data) ? data.data : []);
        }
      })
      .catch(() => {})
      .finally(() => setAllStarLoading(false));
  }, [canScore, starApiBase]);

  // ── 保存 STAR 草稿 ──
  const handleStarSave = async () => {
    setStarSaving(true);
    setStarMsg(null);
    try {
      const res = await fetch(`${starApiBase}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ ...starForm, submit: false }),
      }).then(r => r.json());
      setStarMsg(res.code === 0 ? { type: 'ok', text: '草稿已保存' } : { type: 'err', text: res.message });
    } catch { setStarMsg({ type: 'err', text: '网络错误' }); }
    setStarSaving(false);
  };

  // ── 点击提交按钮 → 先校验再弹确认 ──
  const handleStarSubmitClick = () => {
    if (!starForm.situation.trim() || !starForm.task_desc.trim() || !starForm.action.trim() || !starForm.result.trim()) {
      setStarMsg({ type: 'err', text: '请完整填写 S/T/A/R 四个维度' });
      return;
    }
    setStarConfirming(true);
  };

  // ── 确认提交 STAR 报告 ──
  const handleStarSubmit = async () => {
    setStarConfirming(false);
    setStarSubmitting(true);
    setStarMsg(null);
    try {
      const res = await fetch(`${starApiBase}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ ...starForm, submit: true }),
      }).then(r => r.json());
      if (res.code === 0) {
        setStarReport({ ...starForm, is_submitted: 1 });
        setStarMsg({ type: 'ok', text: 'STAR 报告已提交！' });
        setStarExpanded(false);
        fetchDiscussions(); // 刷新讨论列表，显示自动发布的 STAR 内容
      } else {
        setStarMsg({ type: 'err', text: res.message });
      }
    } catch { setStarMsg({ type: 'err', text: '网络错误' }); }
    setStarSubmitting(false);
  };

  // ── 管理者评级打分 ──
  const handleManagerScore = async () => {
    const score = parseInt(scoreInput);
    if (isNaN(score) || score < 1 || score > 100) {
      alert('请输入1-100之间的整数分数');
      return;
    }
    setScoring(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/perf/plans/${taskId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'assess', score })
      });
      const json = await res.json();
      if (json.code === 0) {
        alert('评级完成！任务已归档。');
        // 通知父组件刷新
        window.dispatchEvent(new CustomEvent('PERF_TASK_UPDATED'));
      } else {
        alert(json.message || '评级失败');
      }
    } catch { alert('网络错误'); }
    setScoring(false);
  };

  const fetchDiscussions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/task-discussions/${targetType}/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.code === 0) {
        setDiscussions(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch discussions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscussions();
  }, [taskId, targetType]);

  useEffect(() => {
    // Auto scroll to bottom when new discussions arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [discussions]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setIsUploading(true);
    try {
      const res = await fetch('/api/uploads/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      const data = await res.json();
      if (data.code === 0 && data.data) {
        setAttachments(prev => [...prev, ...data.data]);
      } else {
        alert(data.message || '上传失败');
      }
    } catch (err) {
      console.error('Upload failed', err);
      alert('上传发生了错误');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && attachments.length === 0) return;
    
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/task-discussions/${targetType}/${taskId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: content.trim(),
          attachments
        })
      });
      const data = await res.json();
      if (data.code === 0) {
        setContent('');
        setAttachments([]);
        fetchDiscussions();
      } else {
        alert(data.message || '发布失败');
      }
    } catch (err) {
      console.error('Submit failed', err);
      alert('发布遇到了网络错误');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定要删除这条复盘跟帖吗？')) return;
    try {
      const res = await fetch(`/api/task-discussions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.code === 0) {
        setDiscussions(prev => prev.filter(d => d.id !== id));
      } else {
        alert(data.message || '删除失败');
      }
    } catch (err) {
      alert('网络错误');
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50/50">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* 顶部标题条 */}
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/80 backdrop-blur-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
            <MessageSquare size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{taskTitle}</h3>
            <p className="text-xs text-slate-500 font-medium tracking-wide">STAR广场 - 沉淀复盘探讨与文档</p>
          </div>
        </div>
        <div className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded shadow-sm border border-slate-100">
          共 {discussions.length} 条记录
        </div>
      </div>

      {/* ── STAR 报告区（R/A 角色，perf + pool 通用） ── */}
      {isRaUser && (
        <div className="shrink-0 border-b border-slate-200">
          {/* 折叠标题 */}
          <button
            onClick={() => setStarExpanded(!starExpanded)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${starSubmitted ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                {starSubmitted ? <CheckCircle2 size={15} /> : <FileText size={15} />}
              </div>
              <span className="text-sm font-bold text-slate-700">
                {starSubmitted ? '✅ STAR 报告已提交' : '📝 填写 STAR 绩效报告'}
              </span>
              {!starSubmitted && <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-bold">必填</span>}
            </div>
            <span className={`material-symbols-outlined text-slate-400 text-[18px] transition-transform ${starExpanded ? 'rotate-180' : ''}`}>expand_more</span>
          </button>

          <AnimatePresence>
            {starExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4 space-y-3">
                  {starMsg && (
                    <div className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${starMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      <span className="material-symbols-outlined text-[14px]">{starMsg.type === 'ok' ? 'check_circle' : 'error'}</span>
                      {starMsg.text}
                    </div>
                  )}

                  {[
                    { key: 'situation', label: 'S — 情境 (Situation)', placeholder: '描述任务发生的背景和环境...' },
                    { key: 'task_desc', label: 'T — 任务 (Task)', placeholder: '说明你承担的具体任务和目标...' },
                    { key: 'action', label: 'A — 行动 (Action)', placeholder: '详述你采取了哪些关键行动...' },
                    { key: 'result', label: 'R — 结果 (Result)', placeholder: '量化描述最终成果和影响...' },
                  ].map(item => (
                    <div key={item.key}>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">{item.label}</label>
                      <textarea
                        value={(starForm as any)[item.key]}
                        onChange={e => setStarForm(prev => ({ ...prev, [item.key]: e.target.value }))}
                        disabled={starSubmitted}
                        placeholder={item.placeholder}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-400 disabled:bg-slate-50 disabled:text-slate-500 resize-none"
                      />
                    </div>
                  ))}

                  {!starSubmitted && !starConfirming && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleStarSave}
                        disabled={starSaving}
                        className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Save size={14} />
                        {starSaving ? '保存中...' : '保存草稿'}
                      </button>
                      <button
                        onClick={handleStarSubmitClick}
                        disabled={starSubmitting}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50"
                      >
                        <Send size={14} />
                        {starSubmitting ? '提交中...' : '提交 STAR 报告'}
                      </button>
                    </div>
                  )}

                  {/* 提交确认 */}
                  {starConfirming && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-1"
                    >
                      <p className="text-sm font-bold text-amber-800 mb-2">确认提交 STAR 报告？</p>
                      <p className="text-xs text-amber-600 mb-3">提交后将不可修改，报告将同步发布到 STAR 广场</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStarConfirming(false)}
                          className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleStarSubmit}
                          disabled={starSubmitting}
                          className="flex-1 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 size={14} />
                          {starSubmitting ? '提交中...' : '确认提交'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── A角色自评区 ── */}
      {isPendingAssessment && isApproverA && !isPoolTask && (
        <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-amber-50/50 to-white">
          <div className="px-5 py-3 flex items-center gap-2 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">person</span>
            </div>
            <span className="text-sm font-bold text-slate-700">负责人自评</span>
            {hasSelfScore ? (
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold ml-auto">
                已自评: {initialData.self_score}分
              </span>
            ) : (
              <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-bold ml-auto">
                待自评
              </span>
            )}
          </div>
          {canSelfScore ? (
            <div className="px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">自评打分 (1-100分)</label>
                  <input
                    type="number" min="1" max="100"
                    value={selfScoreInput}
                    onChange={e => setSelfScoreInput(e.target.value)}
                    placeholder="请输入自评分数"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />
                </div>
                <button
                  onClick={handleSelfScore}
                  disabled={selfScoring || !selfScoreInput}
                  className="mt-5 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-400 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-amber-500/20 shrink-0"
                >
                  {selfScoring ? <Loader2 size={16} className="animate-spin" /> : <span className="material-symbols-outlined text-[16px]">check</span>}
                  提交自评
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">自评将在主管考评前展示，请客观评估任务完成情况</p>
            </div>
          ) : hasSelfScore ? (
            <div className="px-5 py-3">
              <p className="text-sm text-slate-500">您的自评分数：<span className="font-bold text-amber-600">{initialData.self_score}分</span></p>
            </div>
          ) : null}
        </div>
      )}

      {/* ── 管理者 STAR 审阅 + 评分区 ── */}
      {canScore && (
        <div className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-violet-50/50 to-white">
          <div className="px-5 py-3 flex items-center gap-2 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">analytics</span>
            </div>
            <span className="text-sm font-bold text-slate-700">STAR 报告审阅 & 评级打分</span>
            <span className="text-[10px] text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200 font-bold ml-auto">
              待评级
            </span>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[400px] overflow-y-auto">
            {allStarLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="animate-spin text-violet-400" size={24} />
                <span className="ml-2 text-sm text-slate-500">加载 STAR 报告...</span>
              </div>
            ) : allStarReports.length === 0 ? (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-slate-300 text-[40px]">description</span>
                <p className="text-sm text-slate-400 mt-2">暂无成员提交 STAR 报告</p>
                <p className="text-xs text-slate-400 mt-1">成员完成任务后可在此填写 STAR 绩效报告</p>
              </div>
            ) : (
              allStarReports.map((item: any, idx: number) => {
                const star = item.star || item;
                const userName = item.name || item.user_name || star.user_name || '未知';
                const roleName = item.role_name || star.role_name || '';
                const submitted = (item.star_submitted) || (star.is_submitted === 1);
                return (
                  <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                        {userName[0]}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-700">{userName}</span>
                        {roleName && <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">{roleName}</span>}
                      </div>
                      <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold ${submitted ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                        {submitted ? '已提交' : '未提交'}
                      </span>
                    </div>
                    {submitted ? (
                      <div className="space-y-2 text-sm">
                        {[
                          { label: 'S — 情境', value: star.situation },
                          { label: 'T — 任务', value: star.task_desc },
                          { label: 'A — 行动', value: star.action },
                          { label: 'R — 结果', value: star.result },
                        ].map(f => (
                          <div key={f.label}>
                            <span className="text-xs font-bold text-violet-500">{f.label}</span>
                            <p className="text-slate-600 mt-0.5 whitespace-pre-wrap leading-relaxed">{f.value || '(未填写)'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">该成员尚未提交 STAR 报告</p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* A自评分数展示（评分人可见） */}
          {initialData?.self_score != null && initialData.self_score > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-amber-50/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500 text-[16px]">person</span>
                <span className="text-xs font-bold text-slate-600">负责人自评分数：</span>
                <span className="text-sm font-bold text-amber-600">{initialData.self_score}分</span>
              </div>
            </div>
          )}

          {/* 评分输入区 */}
          <div className="px-5 py-4 border-t border-slate-100 bg-white/80">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">综合评级打分 (1-100分)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={scoreInput}
                  onChange={e => setScoreInput(e.target.value)}
                  placeholder="请输入评分"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <button
                onClick={handleManagerScore}
                disabled={scoring || !scoreInput}
                className="mt-5 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-violet-500/20 shrink-0"
              >
                {scoring ? <Loader2 size={16} className="animate-spin" /> : <span className="material-symbols-outlined text-[16px]">grade</span>}
                确认评级
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">评级完成后任务将自动结案归档，请审阅上方 STAR 报告后慎重打分</p>
          </div>
        </div>
      )}

      {/* 跟帖 Feed 流 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/30">
        {discussions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p className="font-medium text-sm">暂无复盘记录</p>
            <p className="text-xs mt-1">在下方发表您的任务总结或附上成果文档吧</p>
          </div>
        ) : (
          discussions.map(disc => {
            const isMe = disc.user_id === currentUser?.id;
            const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={disc.id} 
                className={`flex gap-4 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                {/* 头像 */}
                <div className="shrink-0 pt-1">
                  {disc.avatar_url ? (
                    <img src={disc.avatar_url} alt={disc.user_name} className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold border-2 border-white shadow-sm">
                      {disc.user_name?.[0]}
                    </div>
                  )}
                </div>

                {/* 消息体 */}
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  <div className={`flex items-center gap-2 mb-1 text-xs ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="font-bold text-slate-700">{disc.user_name}</span>
                    <span className="text-slate-400 text-[11px]">{formatTimeAgo(disc.created_at)}</span>
                    {/* Admin or owner delete button */}
                    {(isMe || currentUser?.is_super_admin) && (
                      <button onClick={() => handleDelete(disc.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  
                  {/* 文字内容 */}
                  {disc.content && (
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                      isMe 
                        ? 'bg-violet-50 border border-violet-100 text-slate-800 rounded-tr-sm' 
                        : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                    }`} data-color-mode="light">
                      <MDEditor.Markdown source={disc.content} style={{ backgroundColor: 'transparent', color: 'inherit', fontSize: '14px' }} />
                    </div>
                  )}

                  {/* 附件渲染 */}
                  {disc.attachments && disc.attachments.length > 0 && (
                    <div className={`flex flex-wrap gap-2 mt-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {disc.attachments.map((att, i) => (
                        <a 
                          key={i} 
                          href={att.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className={`group relative overflow-hidden rounded-xl border flex items-center gap-2 transition-all ${
                            isImage(att.url) 
                              ? 'w-32 h-32 bg-slate-100 hover:shadow-md border-slate-200' 
                              : 'px-3 py-2 bg-white hover:bg-slate-50 border-slate-200 shadow-sm'
                          }`}
                        >
                          {isImage(att.url) ? (
                            <img src={att.url} alt={att.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          ) : (
                            <>
                              <div className="w-8 h-8 rounded bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                                <File size={16} />
                              </div>
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-xs font-bold text-slate-700 truncate">{att.name}</span>
                                <span className="text-[10px] text-slate-400">{att.size}</span>
                              </div>
                            </>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <ExternalLink size={20} className="text-white drop-shadow-md" />
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* 发表区（输入框 + 附件） */}
      <div className="shrink-0 p-4 bg-white border-t border-slate-100">
        {/* 已选择附件预览 */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2 mb-3"
            >
              {attachments.map((att, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-1 py-1 max-w-[200px]">
                  <File size={12} className="text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-600 truncate flex-1">{att.name}</span>
                  <button 
                    onClick={() => handleRemoveAttachment(index)}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-violet-200 transition-all overflow-hidden rounded-b-xl relative z-10">
          <div data-color-mode="light" className="w-full relative z-20">
            <MDEditor 
              value={content}
              onChange={v => setContent(v || '')}
              height={180}
              preview="edit"
              className="border-none shadow-none !bg-transparent w-full"
              textareaProps={{
                placeholder: '输入复盘总结或讨论重点... (支持 Markdown, Ctrl+Enter 快捷发送)',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSubmit();
                }
              }}
            />
          </div>

          <div className="flex items-center justify-between bg-slate-50 border-t border-slate-100 px-3 py-2 z-10 relative">
             <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  multiple 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all disabled:opacity-50"
                  title="添加附件"
                >
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                  <span>上传附件或截图</span>
                </button>
             </div>
             
             <button 
                onClick={handleSubmit}
                disabled={isPublishing || (!content.trim() && attachments.length === 0)}
                className="px-5 py-1.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:opacity-90 active:scale-95 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-violet-500/20"
                title="发布 (Ctrl+Enter)"
              >
                {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                发送
              </button>
          </div>
        </div>
        <div className="text-center mt-2">
          <span className="text-[10px] text-slate-400 font-medium">支持上传相关文档、截图凭证。单文件限 50MB</span>
        </div>
      </div>
    </div>
  );
}
