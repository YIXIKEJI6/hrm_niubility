import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import PerfModuleV2 from '../components/PerfModuleV2';

export default function PerfAnalyticsPage({ navigate }: { navigate: (view: string) => void }) {
  const [question, setQuestion] = useState('');
  const [diagnosing, setDiagnosing] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [reports, setReports] = useState<{ question: string; answer: string; time: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('hrm_ai_reports') || '[]'); } catch { return []; }
  });

  const saveReports = (list: typeof reports) => {
    setReports(list);
    localStorage.setItem('hrm_ai_reports', JSON.stringify(list.slice(0, 20)));
  };

  const runDiagnosis = async () => {
    if (!question.trim()) return;
    setDiagnosing(true);
    setAiOpen(true);
    try {
      const token = localStorage.getItem('token');
      const plansRes = await fetch('/api/perf/plans', { headers: { Authorization: `Bearer ${token}` } });
      const plans = ((await plansRes.json()).data || []).slice(0, 20);
      const analyticsRes = await fetch('/api/perf/analytics/overview', { headers: { Authorization: `Bearer ${token}` } });
      const a = (await analyticsRes.json()).data;

      const prompt = `你是一位专业的人力资源绩效管理顾问。以下是当前公司的绩效数据：

核心指标：活跃计划 ${a.activePlans}项(共${a.totalPlans}项)，平均进度 ${a.avgProgress}%，达标率(≥80分) ${Math.round(a.achievementRate * 100)}%，审批均耗 ${a.avgApprovalHours}h，奖金总额 ¥${a.totalBudget}
状态分布: ${JSON.stringify(a.statusDistribution)}
部门: ${JSON.stringify(a.departmentDistribution)}
计划明细前20: ${JSON.stringify(plans.map((p: any) => ({ title: p.title, status: p.status, progress: p.progress, score: p.score, bonus: p.bonus, deadline: p.deadline })))}

用户的问题是：${question}

请基于以上数据，用简洁的中文回答用户的问题。给出具体的数据支撑和可操作的建议。`;

      const aiRes = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: {}, prompt })
      });
      const aiJson = await aiRes.json();
      const answer = aiJson.code === 0 ? (aiJson.data.analysis || aiJson.data.result || '诊断完成') : '❌ ' + aiJson.message;
      saveReports([{ question, answer, time: new Date().toLocaleString('zh-CN') }, ...reports]);
      setQuestion('');
    } catch (e: any) {
      saveReports([{ question, answer: '❌ 请求失败: ' + e.message, time: new Date().toLocaleString('zh-CN') }, ...reports]);
    }
    setDiagnosing(false);
  };

  const presetQuestions = [
    '整体绩效健康度如何？',
    '哪些部门需重点关注？',
    '审批效率是否有瓶颈？',
    '奖金分配是否合理？',
    '超期任务原因分析',
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <Sidebar currentView="perf-analytics" navigate={navigate} />
      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto relative">
        <div className="p-8 max-w-7xl mx-auto pb-28">
          <div className="mb-6">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-1">绩效管理</h2>
            <p className="text-on-surface-variant text-sm">数据驾驶舱 · PDCA监管 · 多维透析 · 过程监管 · 财务核算</p>
          </div>
          <PerfModuleV2 />
        </div>

        {/* AI 诊断浮窗 — 固定底部 */}
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none" style={{ paddingLeft: '80px' }}>
          <div className="max-w-7xl mx-auto px-8 pointer-events-auto">
            {/* 展开的报告面板 */}
            {aiOpen && reports.length > 0 && (
              <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-t-2xl shadow-2xl max-h-[45vh] overflow-y-auto">
                <div className="sticky top-0 bg-white/95 backdrop-blur-xl px-5 py-2.5 border-b border-slate-100 flex items-center justify-between z-10">
                  <h4 className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-violet-500">history</span>
                    AI 诊断报告 ({reports.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <button onClick={() => saveReports([])}
                      className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">清空</button>
                    <button onClick={() => setAiOpen(false)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                      <span className="material-symbols-outlined text-[16px]">expand_more</span>
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {reports.map((r, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl overflow-hidden">
                      <div className="px-4 py-2 flex items-center gap-2 border-b border-slate-100">
                        <span className="material-symbols-outlined text-[12px] text-violet-500">help</span>
                        <span className="text-xs font-bold text-slate-700 flex-1">{r.question}</span>
                        <span className="text-[10px] text-slate-400">{r.time}</span>
                      </div>
                      <div className="px-4 py-2.5">
                        <div className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{r.answer}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 底部输入栏 */}
            <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-t-2xl shadow-2xl px-4 py-3 flex items-center gap-3"
              style={aiOpen && reports.length > 0 ? { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' } : {}}>
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-[16px]">psychology</span>
              </div>
              {/* 快捷标签 */}
              <div className="flex gap-1 shrink-0">
                {presetQuestions.map((q, i) => (
                  <button key={i} onClick={() => setQuestion(q)}
                    className="text-[9px] text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5 hover:bg-violet-100 transition-colors whitespace-nowrap hidden xl:block">
                    {q.length > 8 ? q.slice(0, 8) + '…' : q}
                  </button>
                ))}
              </div>
              <input value={question} onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !diagnosing && runDiagnosis()}
                placeholder="边看数据边提问：输入绩效相关问题，AI 基于真实数据分析..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 placeholder:text-slate-400" />
              <button onClick={runDiagnosis} disabled={diagnosing || !question.trim()}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-violet-500/20 hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1 shrink-0">
                {diagnosing ? <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                  : <span className="material-symbols-outlined text-[14px]">auto_awesome</span>}
                {diagnosing ? '分析...' : '诊断'}
              </button>
              {reports.length > 0 && (
                <button onClick={() => setAiOpen(!aiOpen)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors shrink-0 relative">
                  <span className="material-symbols-outlined text-[16px]">{aiOpen ? 'expand_more' : 'expand_less'}</span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{reports.length}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
