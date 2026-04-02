import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Paperclip, Upload, Trash2, Plus, ChevronDown, X } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { useAuth } from '../context/AuthContext';
import { useRTASR } from '../hooks/useRTASR';
import { useIsMobile } from '../hooks/useIsMobile';
import WorkflowTrajectory from './WorkflowTrajectory';
import AuditTimeline from './AuditTimeline';
import SharedSTARPanel from './SharedSTARPanel';

const SearchableUserDropdown = ({ 
  label, 
  value, 
  onChange, 
  users, 
  placeholder,
  readonly 
}: { 
  label: string, 
  value: string, 
  onChange: (v: string) => void, 
  users: {id: string, name: string}[], 
  placeholder: string,
  readonly?: boolean 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleToggle = () => {
    if (readonly) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
    setIsOpen(!isOpen);
  };

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  const selectedUser = users.find(u => u.id === value);

  return (
    <>
      <div ref={triggerRef} className={`flex items-center bg-white/10 backdrop-blur-sm rounded-lg px-3.5 py-2 border border-white/20 ${readonly ? '' : 'hover:bg-white/20 hover:border-white/30 cursor-pointer'} transition-all duration-200`} onClick={handleToggle}>
        <span className="text-[11px] font-black text-white/70 mr-2 tracking-wider uppercase">{label}</span>
        <div className="flex items-center gap-1 select-none">
          <span className={`text-sm tracking-wide font-semibold ${selectedUser ? 'text-white' : 'text-white/50'}`}>
            {selectedUser ? selectedUser.name : placeholder.replace('选择', '')}
          </span>
          {!readonly && <ChevronDown size={13} className={`text-white/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            ref={panelRef}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            className="w-52 bg-white rounded-xl shadow-xl shadow-black/10 border border-slate-200 overflow-hidden flex flex-col"
          >
            <div className="p-2.5 border-b border-slate-100">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[14px]">search</span>
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="搜索人员..."
                  className="w-full bg-slate-50 text-slate-800 text-xs py-2 pl-8 pr-3 rounded-lg outline-none border border-slate-200 focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-400"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="max-h-56 overflow-y-auto py-1">
              <button
                className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${!value ? 'text-blue-500 font-bold' : 'text-slate-500'}`}
                onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
              >
                <span>{placeholder}</span>
                {!value && <Check size={13} className="text-blue-500" />}
              </button>
              {filteredUsers.map(u => {
                const isSelected = u.id === value;
                return (
                  <button
                    key={u.id}
                    className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${isSelected ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-700'}`}
                    onClick={() => { onChange(u.id); setIsOpen(false); setSearch(''); }}
                  >
                    <span>{u.name}</span>
                    {isSelected && <Check size={13} className="text-blue-500" />}
                  </button>
                )
              })}
              {filteredUsers.length === 0 && (
                <div className="px-4 py-3 text-xs text-slate-500 text-center">无匹配人员</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const MultiSelectUserDropdown = ({ 
  label, 
  value, 
  onChange, 
  users, 
  placeholder,
  readonly 
}: { 
  label: string, 
  value: string, 
  onChange: (v: string) => void, 
  users: {id: string, name: string}[], 
  placeholder: string,
  readonly?: boolean 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const selectedIds = value ? value.split(',').filter(Boolean) : [];

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleToggle = () => {
    if (readonly) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
    setIsOpen(!isOpen);
  };

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  const selectedNames = selectedIds.map(id => users.find(u => u.id === id)?.name).filter(Boolean);

  const toggleUser = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    onChange(newIds.join(','));
  };

  const displayText = selectedNames.length === 0
    ? placeholder.replace('选择', '')
    : selectedNames.length <= 2
      ? selectedNames.join('、')
      : `${selectedNames[0]} 等${selectedNames.length}人`;

  return (
    <>
      <div ref={triggerRef} className={`flex items-center bg-white/10 backdrop-blur-sm rounded-lg px-3.5 py-2 border border-white/20 ${readonly ? '' : 'hover:bg-white/20 hover:border-white/30 cursor-pointer'} transition-all duration-200`} onClick={handleToggle}>
        <span className="text-[11px] font-black text-white/70 mr-2 tracking-wider uppercase">{label}</span>
        <div className="flex items-center gap-1 select-none">
          <span className={`text-sm tracking-wide font-semibold ${selectedNames.length > 0 ? 'text-white' : 'text-white/50'}`}>
            {displayText}
          </span>
          {selectedNames.length > 0 && (
            <span className="ml-1 text-[10px] font-bold bg-white/20 text-white/80 rounded-full w-4 h-4 flex items-center justify-center">{selectedNames.length}</span>
          )}
          {!readonly && <ChevronDown size={13} className={`text-white/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            ref={panelRef}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            className="w-56 bg-white rounded-xl shadow-xl shadow-black/10 border border-slate-200 overflow-hidden flex flex-col"
          >
            {selectedNames.length > 0 && (
              <div className="px-3 pt-2.5 pb-1 flex flex-wrap gap-1.5 border-b border-slate-100">
                {selectedIds.map(id => {
                  const name = users.find(u => u.id === id)?.name;
                  if (!name) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-200">
                      {name}
                      {!readonly && <X size={10} className="cursor-pointer hover:text-blue-800 transition-colors" onClick={(e) => { e.stopPropagation(); toggleUser(id); }} />}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="p-2.5 border-b border-slate-100">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[14px]">search</span>
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="搜索人员..."
                  className="w-full bg-slate-50 text-slate-800 text-xs py-2 pl-8 pr-3 rounded-lg outline-none border border-slate-200 focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-400"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="max-h-56 overflow-y-auto py-1">
              {filteredUsers.map(u => {
                const isSelected = selectedIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${isSelected ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-700'}`}
                    onClick={(e) => { e.stopPropagation(); toggleUser(u.id); }}
                  >
                    <span>{u.name}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>
                  </button>
                )
              })}
              {filteredUsers.length === 0 && (
                <div className="px-4 py-3 text-xs text-slate-500 text-center">无匹配人员</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const TASK_TYPE_OPTIONS = ['常规任务', '重点项目', '创新探索', '临时指派'];
const TaskTypeDropdown = ({ value, onChange, readonly }: { value: string; onChange: (v: string) => void; readonly?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleToggle = () => {
    if (readonly) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      <div ref={triggerRef} className={`flex items-center bg-white/10 backdrop-blur-sm rounded-lg px-3.5 py-2 border border-white/20 ${readonly ? '' : 'hover:bg-white/20 hover:border-white/30 cursor-pointer'} transition-all duration-200`} onClick={handleToggle}>
        <span className="text-[11px] font-black text-white/70 mr-2 tracking-wider uppercase">任务属性</span>
        <div className="flex items-center gap-1 select-none">
          <span className={`text-sm tracking-wide font-semibold ${value ? 'text-white' : 'text-white/50'}`}>{value || '选择属性'}</span>
          {!readonly && <ChevronDown size={13} className={`text-white/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            className="w-44 bg-white rounded-xl shadow-xl shadow-black/10 border border-slate-200 overflow-hidden py-1"
          >
            {TASK_TYPE_OPTIONS.map(opt => (
              <button
                key={opt}
                className={`w-full text-left px-4 py-2.5 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${value === opt ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-700'}`}
                onClick={() => { onChange(opt); setIsOpen(false); }}
              >
                <span>{opt}</span>
                {value === opt && <Check size={13} className="text-blue-500" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

type SectionId = 's' | 'm' | 'a_smart' | 'r_smart' | 't' | 'attachments' | null;

export interface SmartTaskData {
  id?: number | string;
  title?: string;
  category?: string;
  assignee_id?: string;
  approver_id?: string;
  dept_head_id?: string;
  department_id?: number | string;
  collaborators?: string;
  department?: string;
  r: string;
  a: string;
  c: string;
  i: string;
  dt?: string;
  bonus: string;
  rewardType: 'money' | 'score';
  maxParticipants: string;
  taskType: string;
  summary: string;
  s: string;
  m: string;
  a_smart: string;
  r_smart: string;
  t: string;
  planTime?: string;
  doTime?: string;
  checkTime?: string;
  actTime?: string;
  attachments: { name: string; size: string; url?: string }[];
  reject_reason?: string;
  flow_type?: string;
  logs?: any[];
  status?: string;
  approver_name?: string;
  quarter?: string;
  current_participants?: number;
}

export interface SmartTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SmartTaskData) => void;
  title: string;
  type: 'personal' | 'team' | 'pool_propose' | 'pool_publish';
  users: { id: string, name: string, role?: string, position?: string }[];
  initialData?: Partial<SmartTaskData>;
  submitting?: boolean;
  readonly?: boolean;
  customFooter?: React.ReactNode;
  approverMode?: boolean;
  onApprove?: (comment: string, updatedData?: any, action?: 'approve' | 'transfer', targetUser?: string) => void;
  onReject?: (comment: string) => void;
  onDraft?: (data: SmartTaskData) => void;
  onDelete?: () => void;
}

export default function SmartTaskModal({ isOpen, onClose, onSubmit, title, type, users, initialData, submitting, readonly: propReadonly, customFooter, approverMode, onApprove, onReject, onDraft, onDelete }: SmartTaskModalProps) {
  const { currentUser } = useAuth();
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<SectionId>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'star_space'>('details');
  const [aiActivating, setAiActivating] = useState<'full' | null>(null);
  const [tempVoice, setTempVoice] = useState('');
  const [draftSaving, setDraftSaving] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferUserId, setTransferUserId] = useState('');
  const [isEditingMode, setIsEditingMode] = useState(false);
  
  const readonly = propReadonly && !isEditingMode;

  const [allCompanyUsers, setAllCompanyUsers] = useState<{id: string, name: string, role?: string}[]>([]);
  useEffect(() => {
    if (isOpen && allCompanyUsers.length === 0) {
      const token = localStorage.getItem('token');
      fetch('/api/org/users', { headers: { Authorization: `Bearer ${token}` }})
        .then(r => r.json())
        .then(j => { if (j.code === 0 && j.data) setAllCompanyUsers(j.data); })
        .catch(console.error);
    }
  }, [isOpen]);

  const resolvedFlowType = initialData?.flow_type || (type.startsWith('pool') ? 'proposal' : 'perf_plan');
  const codePrefix = resolvedFlowType === 'proposal' ? 'PL' : 'PF';

  const [headerSelections, setHeaderSelections] = useState({
    r: initialData?.r || initialData?.assignee_id || '',
    a: (title === '申请新任务' || type === 'personal') ? (initialData?.a || initialData?.approver_id || currentUser?.id || '') : (initialData?.a || initialData?.approver_id || ''),
    c: initialData?.c || initialData?.collaborators || '',
    i: initialData?.i || '',
    dt: initialData?.dt || '',
    bonus: initialData?.bonus || '0',
    rewardType: initialData?.rewardType || 'money',
    taskType: initialData?.taskType || initialData?.department || '常规任务',
    maxParticipants: initialData?.maxParticipants || '5',
    quarter: initialData?.quarter || ''
  });

  const [formData, setFormData] = useState({
    summary: initialData?.summary || '',
    s: initialData?.s || '',
    m: initialData?.m || '',
    a_smart: initialData?.a_smart || '',
    r_smart: initialData?.r_smart || '',
    t: initialData?.t || '',
    planTime: initialData?.planTime || '',
    doTime: initialData?.doTime || '',
    checkTime: initialData?.checkTime || '',
    actTime: initialData?.actTime || '',
    attachments: Array.isArray(initialData?.attachments) ? initialData.attachments : []
  });

  useEffect(() => {
    if (isOpen) {
      setHeaderSelections({
        r: initialData?.r || initialData?.assignee_id || '',
        a: (title === '申请新任务' || type === 'personal') ? (initialData?.a || initialData?.approver_id || currentUser?.id || '') : (initialData?.a || initialData?.approver_id || ''),
        c: initialData?.c || initialData?.collaborators || '',
        i: initialData?.i || '',
        dt: initialData?.dt || '',
        bonus: initialData?.bonus || '0',
        rewardType: initialData?.rewardType || 'money',
        taskType: initialData?.taskType || initialData?.department || '常规任务',
        maxParticipants: initialData?.maxParticipants || '5',
        quarter: initialData?.quarter || ''
      });
      setFormData({
        summary: initialData?.summary || '',
        s: initialData?.s || '',
        m: initialData?.m || '',
        a_smart: initialData?.a_smart || '',
        r_smart: initialData?.r_smart || '',
        t: initialData?.t || '',
        planTime: initialData?.planTime || '',
        doTime: initialData?.doTime || '',
        checkTime: initialData?.checkTime || '',
        actTime: initialData?.actTime || '',
        attachments: Array.isArray(initialData?.attachments) ? initialData.attachments : []
      });
      setIsFocusMode(false);
      setShowTransfer(false);
      setIsEditingMode(false);
    }
  }, [isOpen, initialData]);

  const { isRecording, startRecording, stopRecording, error: voiceError } = useRTASR({
    onResult: (text, isFinal) => {
      if (isFinal) {
        setFormData(prev => ({ ...prev, summary: prev.summary + text }));
        setTempVoice('');
      } else {
        setTempVoice(text);
      }
    }
  });

  if (!isOpen) return null;

  const handleUpdate = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const sections = [
    { id: 's', letter: 'S', title: '明确目标', color: 'text-blue-600', bg: 'bg-blue-50', placeholder: '具体明确的目标...' },
    { id: 'm', letter: 'M', title: '量化指标', color: 'text-green-600', bg: 'bg-green-50', placeholder: '如何衡量成功...' },
    { id: 'a_smart', letter: 'A', title: '可行方案', color: 'text-orange-600', bg: 'bg-orange-50', placeholder: '执行思路...' },
    { id: 'r_smart', letter: 'R', title: '岗位相关性', color: 'text-indigo-500', bg: 'bg-indigo-50', placeholder: '岗位相关性...' },
    { id: 't', letter: 'T', title: '时限要求', color: 'text-red-500', bg: 'bg-red-50', placeholder: '完成截止时间...' }
  ];

  const handleAIAssist = async () => {
    if (!formData.summary.trim()) { alert('请先填写目标简述'); return; }
    setAiActivating('full');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: { title: formData.summary }, prompt: `Analyze SMART: ${formData.summary}` })
      });
      const json = await res.json();
      if (json.code === 0) { console.log('AI Assist triggered'); }
    } catch { alert('AI 服务失败'); }
    setAiActivating(null);
  };

  const isTaskFull = initialData?.current_participants !== undefined && 
                     initialData?.maxParticipants !== undefined && 
                     Number(initialData.current_participants) >= Number(initialData.maxParticipants);

  const handleSubmit = () => {
    if (isTaskFull && title.includes('领取')) {
      alert('该任务参与人数已满，无法领取。');
      return;
    }
    onSubmit({ ...headerSelections, ...formData, summary: formData.summary || formData.s?.substring(0, 30) });
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center drop-shadow-2xl ${isMobile ? '' : 'p-4 sm:p-6'}`}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className={`bg-slate-50 shadow-2xl w-full flex flex-col relative z-10 overflow-hidden ring-1 ring-slate-900/5 transition-all duration-300 ${isMobile ? 'h-full rounded-none' : `rounded-2xl ${approverMode ? 'max-w-5xl' : 'max-w-4xl'} h-[90vh]`}`}>
        {/* Header */}
        <div className="bg-[#005ea4] text-white flex items-center justify-between shrink-0 shadow-md z-20 px-6 py-4">
          <div className="flex items-center gap-3">
             <h2 className="font-black tracking-wide text-lg flex items-center gap-2">
                {title || 'SMART 目标卡'}
                {initialData?.id && <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded">{codePrefix}-{String(initialData.id).padStart(6, '0')}</span>}
             </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 shrink-0 px-6 gap-6 pt-3 z-10">
          <button onClick={() => setActiveTab('details')} className={`pb-2.5 text-sm font-black border-b-[3px] transition-all ${activeTab === 'details' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>任务详情</button>
          <button onClick={() => setActiveTab('star_space')} className={`pb-2.5 text-sm font-black border-b-[3px] transition-all ${activeTab === 'star_space' ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-violet-600'}`}>团队复盘广场</button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'star_space' ? (
            <SharedSTARPanel taskId={Number(initialData?.id)} taskType={type} taskTitle={initialData?.title} initialData={initialData} currentUser={currentUser} />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden relative bg-white">
              {/* Focus Toggle */}
              {!isMobile && (
                <div className="absolute top-4 right-6 z-[60]">
                  <button onClick={() => setIsFocusMode(!isFocusMode)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shadow-lg ${isFocusMode ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:text-blue-600'}`}>
                    <span className="material-symbols-outlined text-[18px]">{isFocusMode ? 'fullscreen_exit' : 'fullscreen'}</span>
                    <span className="text-xs font-bold">{isFocusMode ? '退出专注' : '专注模式'}</span>
                  </button>
                </div>
              )}

              <div className="flex-1 flex flex-col overflow-hidden">
                <AnimatePresence>
                  {!isFocusMode && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-[#005ea4] text-white">
                       <div className="p-4 sm:px-6 flex flex-wrap items-center gap-3">
                         <MultiSelectUserDropdown label="R 执行人" value={headerSelections.r} onChange={v => setHeaderSelections({...headerSelections, r: v})} users={users} placeholder="执行人" readonly={readonly} />
                         <SearchableUserDropdown label="A 负责人" value={headerSelections.a} onChange={v => setHeaderSelections({...headerSelections, a: v})} users={users} placeholder="负责人" readonly={readonly || title === '申请新任务'} />
                         <TaskTypeDropdown value={headerSelections.taskType} onChange={v => setHeaderSelections({...headerSelections, taskType: v})} readonly={readonly} />
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className={`flex-1 overflow-y-auto bg-[#f8f9fb] transition-all duration-300 ${isFocusMode ? 'p-8 animate-in fade-in zoom-in-95' : 'p-5'}`}>
                  <div className="max-w-4xl mx-auto space-y-4">
                     {/* Summary */}
                     <div className="relative">
                        {readonly ? (
                          <div className="w-full px-4 py-3 font-bold bg-white border border-gray-200 rounded-lg shadow-sm">{formData.summary}</div>
                        ) : (
                          <>
                            <input type="text" value={formData.summary + (isRecording ? tempVoice : '')} onChange={e => !isRecording && handleUpdate('summary', e.target.value)} placeholder="目标简述..." className="w-full pl-4 pr-32 py-3 font-bold bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500" />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              <button onClick={isRecording ? stopRecording : startRecording} className={`p-1.5 rounded-full ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-500'}`}><span className="material-symbols-outlined text-[20px]">mic</span></button>
                              <button onClick={handleAIAssist} disabled={aiActivating === 'full'} className="px-2 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded border border-indigo-200">AI 智能拆解</button>
                            </div>
                          </>
                        )}
                     </div>
                     {/* SMART Sections */}
                     <div className="space-y-3">
                        {sections.map(s => (
                          <div key={s.id} className="bg-white border rounded-lg overflow-hidden shadow-sm">
                             <div className="p-3 bg-gray-50 border-b flex items-center gap-2">
                                <div className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${s.color} ${s.bg}`}>{s.letter}</div>
                                <h4 className="font-bold text-gray-900 text-sm">{s.title}</h4>
                             </div>
                             <div className="p-3">
                                <MDEditor value={formData[s.id as keyof typeof formData] as string} onChange={readonly ? undefined : v => handleUpdate(s.id as keyof typeof formData, v || '')} height={isFocusMode ? 240 : 120} preview={readonly ? "preview" : "edit"} hideToolbar={readonly} />
                             </div>
                          </div>
                        ))}
                     </div>
                     
                     <AnimatePresence>
                       {!isFocusMode && initialData?.id && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-6 border-t space-y-4">
                             <WorkflowTrajectory businessType={resolvedFlowType as any} businessId={initialData.id} codePrefix={codePrefix} />
                             <AuditTimeline businessType={resolvedFlowType === 'proposal' ? 'proposal' : 'perf_plan'} businessId={initialData.id} />
                          </motion.div>
                       )}
                     </AnimatePresence>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t flex justify-end gap-2 shrink-0">
                  {approverMode ? (
                    showTransfer ? (
                      <div className="flex w-full items-center justify-between">
                         <div className="flex items-center gap-2 text-sm font-bold">
                           转办给：
                           <select className="border rounded p-1" value={transferUserId} onChange={e => setTransferUserId(e.target.value)}>
                             <option value="">请选择人员</option>
                             {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                           </select>
                         </div>
                         <div className="flex gap-2">
                           <button onClick={() => setShowTransfer(false)} className="px-4 py-2 text-gray-500">取消</button>
                           <button onClick={() => onApprove?.('转办', null, 'transfer', transferUserId)} disabled={!transferUserId} className="px-4 py-2 bg-purple-600 text-white rounded-lg">确认转办</button>
                         </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setIsEditingMode(!isEditingMode)} className="px-4 py-2 border text-blue-600 rounded-lg">{isEditingMode ? '取消修改' : '修改内容'}</button>
                        <div className="flex-1" />
                        <button onClick={() => setShowTransfer(true)} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-lg">转办</button>
                        <button onClick={() => onReject?.('驳回')} className="px-4 py-2 text-rose-500">驳回</button>
                        <button onClick={() => onApprove?.('同意')} className="px-8 py-2 bg-emerald-600 text-white font-bold rounded-lg shadow-sm">同意</button>
                      </>
                    )
                  ) : (
                    readonly ? (
                      <div className="flex flex-1 items-center justify-between">
                        {onDelete && (initialData as any)?.status === 'draft' && (
                          <button onClick={() => { if (window.confirm('确认删除草稿？')) onDelete(); }} className="px-4 py-2 text-rose-600 border border-rose-300 rounded-xl hover:bg-rose-50">删除草稿</button>
                        )}
                        <div className="flex-1 flex justify-end pr-3">
                          {initialData?.status === 'completed' && type === 'pool_propose' && (currentUser?.role === 'admin' || currentUser?.role === 'gm' || currentUser?.role === 'hrbp') && (
                            <button 
                              onClick={async () => {
                                const amountStr = window.prompt(`【线下奖金签批结案】\n请填入针对该赏金任务最终发放决议的奖金/积分数额：\n（录入后该订单即核销结案，直接计入台账）`);
                                if (!amountStr) return;
                                const amount = Number(amountStr);
                                if (isNaN(amount) || amount < 0) { alert('数额不合法'); return; }
                                try {
                                  const res = await fetch(`/api/pool/rewards/offline-distribution/${initialData.id}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                                    body: JSON.stringify({ amount })
                                  });
                                  const data = await res.json();
                                  if (data.code === 0) {
                                    alert('✅ 台账录入成功，任务已闭环结算！');
                                    onClose();
                                    setTimeout(() => window.location.reload(), 300);
                                  } else alert(data.message || '结算失败');
                                } catch (e) { alert('网络错误'); }
                              }}
                              className="px-6 py-2 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-xl transition-all shadow-sm flex items-center gap-2"
                            >
                              💰 线下清算并结案
                            </button>
                          )}
                        </div>
                        <button onClick={onClose} className="px-8 py-2 bg-[#005ea4] text-white font-bold rounded-xl">关闭</button>
                      </div>
                    ) : (
                      <>
                        <button onClick={onClose} className="px-4 py-2 text-gray-500">取消</button>
                        <button onClick={() => onDraft?.({...headerSelections, ...formData})} className="px-4 py-2 border border-blue-200 text-blue-600 rounded-xl">存为草稿</button>
                        <button 
                          onClick={handleSubmit} 
                          disabled={submitting || (isTaskFull && title.includes('领取'))} 
                          className={`px-8 py-2 text-white font-bold rounded-xl shadow-sm ${isTaskFull && title.includes('领取') ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#005ea4] hover:bg-[#0077ce]'}`}
                        >
                          {isTaskFull && title.includes('领取') ? '人数已满' : title === '申请新任务' ? '发起申请' : title.includes('领取') ? '领取角色' : '提交修改'}
                        </button>
                      </>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
