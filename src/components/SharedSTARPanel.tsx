import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link2, ExternalLink, RefreshCw, Layers } from 'lucide-react';

interface SharedSTARPanelProps {
  taskId: number;
  taskType: string;
  taskTitle: string;
  initialData: any;
  currentUser: any;
}

export default function SharedSTARPanel({ taskId, taskType, taskTitle, initialData, currentUser }: SharedSTARPanelProps) {
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputUrl, setInputUrl] = useState('');
  const [linking, setLinking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const targetType = taskType === 'pool_propose' ? 'proposal' : 'perf_plan';

  const fetchDoc = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wecom/docs/${targetType}/${taskId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.code === 0 && data.data) {
        setDocUrl(data.data.doc_url);
        setInputUrl(data.data.doc_url);
      } else {
        setDocUrl(null);
      }
    } catch (err) {
      console.error('Failed to fetch doc link:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoc();
  }, [taskId, targetType]);

  const handleLink = async () => {
    if (!inputUrl.trim()) return;
    setLinking(true);
    try {
      const res = await fetch('/api/wecom/docs/link', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          targetType,
          targetId: taskId,
          docUrl: inputUrl,
          docTitle: taskTitle
        })
      });
      const data = await res.json();
      if (data.code === 0) {
        setDocUrl(inputUrl);
        setIsEditing(false);
      } else {
        alert(data.message || '关联失败');
      }
    } catch (err) {
      alert('网络错误');
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50/50">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  // 如果没有关联文档，或者处于编辑模式
  if (!docUrl || isEditing) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center"
        >
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Link2 size={32} />
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">关联团队协作文档</h3>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            将本任务关联至一个企业微信/飞书/腾讯协同文档，实现在页面内实时共同编辑、复盘与沉淀。
          </p>

          <div className="space-y-4">
            <div className="text-left">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">协同文档分享链接</label>
              <input 
                type="text" 
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                placeholder="https://docs.qq.com/doc/..."
                className="w-full mt-1.5 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-xs"
              />
            </div>
            
            <div className="flex gap-3">
              {isEditing && (
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-4 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-all"
                >
                  返回
                </button>
              )}
              <button 
                onClick={handleLink}
                disabled={linking || !inputUrl}
                className="flex-[2] px-6 py-3 bg-[#005ea4] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:bg-[#0077ce] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {linking ? '正在关联...' : '立即关联并开始协作'}
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
               <Layers size={14} />
               <span>支持企微、飞书、腾讯文档嵌入</span>
             </div>
             <a href="https://docs.qq.com" target="_blank" className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1">
               去创建 <ExternalLink size={12} />
             </a>
          </div>
        </motion.div>
      </div>
    );
  }

  // 渲染嵌入式文档
  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* 顶部工具条 */}
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/80 backdrop-blur-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-2 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            已接入协同文档
          </div>
          <p className="text-xs font-bold text-slate-500 truncate max-w-[300px]">
             {taskTitle} - 协作空间
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsEditing(true)}
            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
            title="更换文档链接"
          >
            <Link2 size={16} />
          </button>
          <a 
            href={docUrl} 
            target="_blank" 
            className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
            title="新窗口打开"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </div>

      {/* 文档嵌入区 */}
      <div className="flex-1 bg-slate-50 relative overflow-hidden">
        <iframe 
          src={docUrl}
          className="w-full h-full border-none"
          title="Collaborative Workspace"
          allow="autoplay; clipboard-read; clipboard-write; fullscreen"
        />
        
        {/* 指引条 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/80 backdrop-blur-sm text-white rounded-full text-[10px] font-bold shadow-2xl pointer-events-none opacity-0 hover:opacity-100 transition-opacity flex items-center gap-2 border border-white/10">
           <span className="material-symbols-outlined text-[14px]">info</span>
           本页面已自动启用文档免密嵌入，如无法显示请检查链接权限
        </div>
      </div>
    </div>
  );
}
