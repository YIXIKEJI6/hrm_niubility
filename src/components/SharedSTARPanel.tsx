import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Paperclip, File, X, Loader2, MessageSquare, Trash2, ExternalLink } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';

function formatTimeAgo(dateString: string) {
  const safeDate = dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z';
  const date = new Date(safeDate);
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  let targetType = 'perf_plan';
  if (taskType === 'pool_propose' || taskType === 'pool_publish' || taskType === 'proposal') {
    targetType = 'proposal';
  } else if (initialData?.flow_type === 'proposal') {
    targetType = 'proposal';
  }

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
