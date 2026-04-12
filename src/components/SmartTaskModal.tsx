import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Paperclip, Upload, Trash2, Plus, ChevronDown, X } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import WorkflowTrajectory from './WorkflowTrajectory';
import AuditTimeline from './AuditTimeline';
import SharedSTARPanel from './SharedSTARPanel';

const SMART_TEMPLATE_WITH_HINT = `【目标 S】
> 🎯 *说明 (Specific): 请描述具体明确的产出是什么？*

【指标 M】
> 📊 *说明 (Measurable): 请描述如何衡量完成度与验收标准？*

【方案 A】
> 🚀 *说明 (Attainable): 请描述实现该目标的具体行动和所需资源？*

【相关 R】
> 🔗 *说明 (Relevant): 请描述该任务与岗位及大目标的关联性和意义？*

【时限 T】
> ⏰ *说明 (Time-bound): 请描述关键的时间节点与进度安排？*`;

const SMART_TEMPLATE_CLEAN = `【目标 S】

【指标 M】

【方案 A】

【相关 R】

【时限 T】`;

const getInitialS = (initial?: Partial<SmartTaskData>) => {
  if (!initial) return SMART_TEMPLATE_WITH_HINT;
  let initialS = initial.s || '';
  const initialM = initial.m || '';
  const initialA = initial.a_smart || '';
  const initialR = initial.r_smart || '';
  const initialT = initial.t || '';

  if (initial.id) {
     // 如果 smart_s 列被污染（包含组合标记），提取干净的 S 内容
     if (initialS.includes('【目标 S】')) {
       const stripped = initialS.replace(/\*\*\s*(【[^】]+】)\s*\*\*/g, '$1');
       initialS = stripped.match(/【目标 S】\n?([\s\S]*?)(?=\n【指标 M】|$)/)?.[1]?.trim() || initialS;
     }
     if (initialS || initialM || initialA || initialR || initialT) {
       return `【目标 S】\n${initialS}\n\n【指标 M】\n${initialM}\n\n【方案 A】\n${initialA}\n\n【相关 R】\n${initialR}\n\n【时限 T】\n${initialT}`;
     }
     return SMART_TEMPLATE_WITH_HINT;
  }
  return SMART_TEMPLATE_WITH_HINT;
};

const SearchableUserDropdown = ({ 
  label, 
  value, 
  onChange, 
  users, 
  placeholder,
  readonly,
  receiptStatus
}: { 
  label: string, 
  value: string, 
  onChange: (v: string) => void, 
  users: {id: string, name: string}[], 
  placeholder: string,
  readonly?: boolean,
  receiptStatus?: Record<string, string>
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

  const safeUsers = users || [];
  const filteredUsers = safeUsers.filter(u => (u.name || '').toLowerCase().includes(search.toLowerCase()));
  // 支持逗号分隔的多ID值（如 A 角色有多个 approved claims 时，取第一个显示）
  const selectedUser = safeUsers.find(u => u.id === value || (value && value.includes(',') && value.split(',').includes(u.id)));

  return (
    <>
      <div ref={triggerRef} className={`flex items-center rounded-md px-1 py-1 border border-transparent ${readonly ? '' : 'hover:bg-slate-100 cursor-pointer'} transition-all duration-200`} onClick={handleToggle}>
        <span className="text-[12px] font-bold text-slate-400/80 tracking-wider mr-1" style={{ display: selectedUser ? 'none' : 'inline' }}>{label}</span>
        <div className="flex items-center gap-0.5 select-none">
          {selectedUser ? (
            <span className="text-[13px] tracking-wide font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1 relative">
              <div className="w-4 h-4 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] shrink-0 font-black">{selectedUser.name[0]}</div>
              {selectedUser.name}
              {receiptStatus && (
                receiptStatus[String(selectedUser.id)] === 'confirmed'
                  ? <span className="ml-0.5 text-emerald-500 text-[11px] font-black" title="已签收">✓</span>
                  : <span className="ml-0.5 text-amber-400 text-[11px] font-black" title="待签收">○</span>
              )}
            </span>
          ) : (
            <span className="text-sm font-semibold text-slate-300 hidden"></span>
          )}
          {!readonly && <ChevronDown size={14} className={`text-slate-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ display: selectedUser ? 'none' : 'block' }} />}
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
  readonly,
  receiptStatus
}: { 
  label: string, 
  value: string, 
  onChange: (v: string) => void, 
  users: {id: string, name: string}[], 
  placeholder: string,
  readonly?: boolean,
  receiptStatus?: Record<string, string>
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

  const safeUsers = users || [];
  const filteredUsers = safeUsers.filter(u => (u.name || '').toLowerCase().includes(search.toLowerCase()));
  const selectedNames = selectedIds.map(id => safeUsers.find(u => u.id === id)?.name).filter(Boolean);

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
      <div ref={triggerRef} className={`flex items-center rounded-md px-1 py-1 border border-transparent ${readonly ? '' : 'hover:bg-slate-100 cursor-pointer'} transition-all duration-200`} onClick={handleToggle}>
        <span className="text-[12px] font-bold text-slate-400/80 tracking-wider mr-1" style={{ display: selectedNames.length > 0 ? 'none' : 'inline' }}>{label}</span>
        <div className="flex items-center gap-1 select-none">
          {selectedNames.length > 0 ? (
            <div className="flex gap-1">
             {selectedNames.map((name, idx) => {
               const uid = selectedIds[idx];
               const rStatus = receiptStatus?.[String(uid)];
               return (
                 <span key={name} className="text-[13px] tracking-wide font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                   {name}
                   {receiptStatus && (
                     rStatus === 'confirmed'
                       ? <span className="text-emerald-500 text-[11px] font-black" title="已签收">✓</span>
                       : <span className="text-amber-400 text-[11px] font-black" title="待签收">○</span>
                   )}
                 </span>
               );
             })}
            </div>
          ) : (
            <span className="text-sm font-semibold text-slate-300 hidden"></span>
          )}
          {!readonly && <ChevronDown size={14} className={`text-slate-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ display: selectedNames.length > 0 ? 'none' : 'block' }} />}
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

const TASK_TYPE_PRESETS = ['常规任务', '重点项目', '创新探索', '临时指派'];
const TaskTypeDropdown = ({ value, onChange, readonly }: { value: string; onChange: (v: string) => void; readonly?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [deptNames, setDeptNames] = useState<string[]>([]);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/org/departments', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json())
      .then(j => { if (j.code === 0) setDeptNames((j.data || []).map((d: any) => d.name).filter(Boolean)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
      setIsCustom(false);
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
    setIsCustom(false);
  };

  return (
    <>
      <div ref={triggerRef} className={`flex items-center rounded-md px-1 py-1 border ${!value && !readonly ? 'border-red-300' : 'border-transparent'} ${readonly ? '' : 'hover:bg-slate-100 cursor-pointer'} transition-all duration-200`} onClick={handleToggle}>
        <div className="flex items-center gap-0.5 select-none">
          <span className={`text-[13px] tracking-wide font-bold px-2 py-0.5 rounded flex items-center ${value ? 'text-slate-700 bg-slate-100' : 'text-red-400/80 bg-transparent'}`}>{value || '必填 *'}</span>
          {!readonly && <ChevronDown size={14} className={`text-slate-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />}
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
            className="w-52 bg-white rounded-xl shadow-xl shadow-black/10 border border-slate-200 overflow-hidden"
          >
            {/* 自定义输入 */}
            <div className="px-3 py-2 border-b border-slate-100">
              {isCustom ? (
                <input
                  ref={inputRef}
                  autoFocus
                  placeholder="输入自定义属性..."
                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                      onChange((e.target as HTMLInputElement).value.trim());
                      setIsOpen(false);
                      setIsCustom(false);
                    }
                  }}
                />
              ) : (
                <button onClick={() => setIsCustom(true)} className="w-full text-left text-[11px] text-blue-500 font-bold hover:text-blue-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">edit</span> 自定义输入
                </button>
              )}
            </div>
            {/* 预设选项 */}
            <div className="py-1 max-h-64 overflow-y-auto">
              {TASK_TYPE_PRESETS.length > 0 && (
                <div className="px-3 pt-1 pb-0.5 text-[9px] text-slate-400 font-bold uppercase tracking-widest">任务类型</div>
              )}
              {TASK_TYPE_PRESETS.map(opt => (
                <button
                  key={opt}
                  className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${value === opt ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-700'}`}
                  onClick={() => { onChange(opt); setIsOpen(false); }}
                >
                  <span>{opt}</span>
                  {value === opt && <Check size={13} className="text-blue-500" />}
                </button>
              ))}
              {deptNames.length > 0 && (
                <div className="px-3 pt-2 pb-0.5 text-[9px] text-slate-400 font-bold uppercase tracking-widest border-t border-slate-100 mt-1">按部门</div>
              )}
              {deptNames.map(dept => (
                <button
                  key={dept}
                  className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${value === dept ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-700'}`}
                  onClick={() => { onChange(dept); setIsOpen(false); }}
                >
                  <span>{dept}</span>
                  {value === dept && <Check size={13} className="text-blue-500" />}
                </button>
              ))}
            </div>
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
  creator_id?: string;
  receipt_status?: string;
  quarter?: string;
  current_participants?: number;
  proposal_status?: string;
  role_claims?: any[];
  roles_config?: any;
  pool_task_id?: number;
  task_type?: string;
  join_applicant?: string;
  join_role?: string;
  join_reason?: string;
  creator_name?: string;
  description?: string;
  metric?: string;
  target?: string;
  score?: number;
  progress?: number;
  reward?: string;
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
  headerActions?: React.ReactNode;
  approverMode?: boolean;
  onApprove?: (comment: string, updatedData?: any, action?: 'approve' | 'transfer' | 'publish', targetUser?: string) => void;
  onReject?: (comment: string) => void;
  onDraft?: (data: SmartTaskData) => void;
  onDelete?: () => void;
  proposalCategory?: 'problem' | 'help' | 'suggestion' | null;
  initialTab?: 'details' | 'star_space';
}

export default function SmartTaskModal({ isOpen, onClose, onSubmit, title, type, users = [], initialData, submitting, readonly: propReadonly, customFooter, headerActions, approverMode, onApprove, onReject, onDraft, onDelete, proposalCategory, initialTab }: SmartTaskModalProps) {
  const { currentUser } = useAuth();
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<SectionId>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'star_space'>(initialTab || 'details');
  const [aiActivating, setAiActivating] = useState<'full' | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferUserId, setTransferUserId] = useState('');
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [claimsExpanded, setClaimsExpanded] = useState(false);
  const [propsExpanded, setPropsExpanded] = useState(true);
  const prevOpenRef = React.useRef(false);
  
  const readonly = propReadonly && !isEditingMode;
  const isHeaderEditable = !readonly || approverMode;

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

  // 监听外部触发的"切换到STAR广场"事件（来自 headerActions 的写STAR按钮）
  useEffect(() => {
    const handler = () => setActiveTab('star_space');
    document.addEventListener('SWITCH_TO_STAR_TAB', handler);
    return () => document.removeEventListener('SWITCH_TO_STAR_TAB', handler);
  }, []);

  const rawFlowType = initialData?.flow_type || (type.startsWith('pool') ? 'proposal' : 'perf_plan');
  // pool_join 复用 proposal 的流程轨迹
  const resolvedFlowType = rawFlowType === 'pool_join' ? 'proposal' : rawFlowType;
  const codePrefix = resolvedFlowType === 'proposal' ? 'PL' : 'PF';
  // For pool tasks viewed from personal goals, use pool_task_id for trajectory lookup
  const trajectoryBusinessId = (resolvedFlowType === 'proposal' && initialData?.pool_task_id) ? String(initialData.pool_task_id) : initialData?.id;
  const isPoolJoin = rawFlowType === 'pool_join';

  const [headerSelections, setHeaderSelections] = useState({
    r: initialData?.r || initialData?.assignee_id || '',
    a: (title === '申请新任务' || type === 'personal') ? (initialData?.a || initialData?.approver_id || currentUser?.id || '') : (initialData?.a || initialData?.approver_id || ''),
    c: initialData?.c || initialData?.collaborators || '',
    i: initialData?.i || '',
    dt: initialData?.dt || '',
    bonus: initialData?.bonus || '0',
    rewardType: initialData?.rewardType || 'money',
    taskType: initialData?.taskType || initialData?.department || '常规任务',
    maxParticipants: initialData?.maxParticipants ?? '5',
    quarter: initialData?.quarter || ''
  });
  
  const isSimplifiedMode = type === 'pool_propose' && !initialData?.id;

  const [formData, setFormData] = useState({
    summary: initialData?.summary || '',
    s: isSimplifiedMode ? (initialData?.s || '') : getInitialS(initialData),
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
    const handleTrigger = () => {
      if (type === 'pool_publish') {
        if (!formData.planTime || !formData.doTime || !formData.checkTime || !formData.actTime) {
          alert('缺少 PDCA 节点时间，请先在上方完善时间规划后再执行一键启动！');
          return;
        }
      }
      onApprove?.('batch_approve_and_start', { ...formData, ...headerSelections, summary: formData.summary || formData.s?.substring(0, 30) });
    };
    document.addEventListener('TRIGGER_TASK_FINISH_ALLOCATION', handleTrigger);
    return () => document.removeEventListener('TRIGGER_TASK_FINISH_ALLOCATION', handleTrigger);
  }, [headerSelections, formData, onApprove, type]);

  useEffect(() => {
    // 仅在 isOpen 从 false → true 时初始化数据，防止父组件 re-render 导致用户选择被重置
    const justOpened = isOpen && !prevOpenRef.current;
    prevOpenRef.current = isOpen;

    if (justOpened) {
      let r = initialData?.r || initialData?.assignee_id || '';
      let a = (title === '申请新任务' || type === 'personal') ? (initialData?.a || initialData?.approver_id || '') : (initialData?.a || initialData?.approver_id || '');
      let c = initialData?.c || initialData?.collaborators || '';
      let i = initialData?.i || '';
      let dt = initialData?.dt || '';

      // 解析 roles_config 中的 RACI 信息以保留流转内容
      if (initialData?.roles_config) {
        try {
          const rc = typeof initialData.roles_config === 'string' ? JSON.parse(initialData.roles_config) : initialData.roles_config;
          if (Array.isArray(rc)) {
            const getIdsFromRole = (roleName: string) => rc.find((role: any) => role.name === roleName)?.users?.map((u: any) => u.id).join(',') || '';
            const rcR = getIdsFromRole('R');
            const rcA = getIdsFromRole('A');
            const rcC = getIdsFromRole('C');
            const rcI = getIdsFromRole('I');
            if (rcR && !r) r = rcR;
            if (rcA && !a) a = rcA;
            if (rcC && !c) c = rcC;
            if (rcI && !i) i = rcI;
          }
        } catch (e) {
          console.warn("[SmartTaskModal] Failed to auto-parse roles_config:", e);
        }
      }

      setHeaderSelections({
        r,
        a,
        c,
        i,
        dt,
        bonus: initialData?.bonus || '0',
        rewardType: initialData?.rewardType || 'money',
        taskType: initialData?.taskType || initialData?.department || '常规任务',
        maxParticipants: initialData?.maxParticipants ?? '5',
        quarter: initialData?.quarter || ''
      });
      setFormData({
        summary: initialData?.summary || '',
        s: isSimplifiedMode ? (initialData?.s || '') : getInitialS(initialData),
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
      setShowTransfer(false);
      setIsEditingMode(false);


      setActiveTab(initialTab || 'details');
    }
  }, [isOpen]);

  // 响应外部 initialTab 变化（如写STAR按钮在 modal 已打开时切换 tab）
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);



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
      const prompt = `请根据以下目标简述，按 SMART 原则拆解为五个维度，严格以 JSON 格式返回（不要包含 markdown 代码块标记），字段为:
{"s":"目标 S - 具体明确的产出","m":"指标 M - 如何衡量完成度与验收标准","a":"方案 A - 实现该目标的具体行动和所需资源","r":"相关 R - 与岗位及大目标的关联性和意义","t":"时限 T - 关键的时间节点与进度安排"}

目标简述: ${formData.summary}`;
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: { title: formData.summary }, prompt })
      });
      const json = await res.json();
      if (json.code === 0 && json.data?.analysis) {
        const raw = json.data.analysis;
        // 尝试从 AI 返回中提取 JSON
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // 统一将 AI 拆解结果合并到 s 字段（编辑器只显示 s），同时保留独立字段供后端存储
          const smartText = `**【目标 S】**\n${parsed.s || ''}\n\n**【指标 M】**\n${parsed.m || ''}\n\n**【方案 A】**\n${parsed.a || ''}\n\n**【相关 R】**\n${parsed.r || ''}\n\n**【时限 T】**\n${parsed.t || ''}`;
          setFormData(prev => ({
            ...prev,
            s: smartText,
            m: parsed.m || prev.m,
            a_smart: parsed.a || prev.a_smart,
            r_smart: parsed.r || prev.r_smart,
            t: parsed.t || prev.t,
          }));
        } else {
          setFormData(prev => ({ ...prev, s: raw }));
        }
      } else {
        alert('AI 拆解失败，请稍后重试');
      }
    } catch { alert('AI 服务暂时不可用'); }
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

    // 任务属性必填
    if (!headerSelections.taskType?.trim()) {
      alert('请选择或填写「任务属性」！');
      return;
    }

    // 强制校验个人与团队新建任务的 PDCA 必填
    if (type === 'personal' || type === 'team') {
      if (!formData.planTime || !formData.doTime || !formData.checkTime || !formData.actTime) {
        alert('请完整填写任务的 PDCA (Plan/Do/Check/Act) 时限！');
        return;
      }
    }

    onSubmit({ ...formData, ...headerSelections, summary: formData.summary || formData.s?.substring(0, 30) });
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center drop-shadow-2xl ${isMobile ? '' : 'p-4 sm:p-6'}`}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className={`bg-slate-50 shadow-2xl w-full flex flex-col relative z-10 overflow-hidden ring-1 ring-slate-900/5 transition-all duration-300 ${isMobile ? 'h-full rounded-none' : `rounded-2xl ${approverMode ? 'max-w-5xl' : 'max-w-4xl'} h-[90vh]`}`}>
        <div className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white flex flex-wrap items-center justify-between shrink-0 shadow-md z-20 px-6 py-4 gap-4">
          <div className="flex items-center gap-6">
             <h2 className="font-black tracking-wide text-lg flex items-center gap-2">
                {title || 'SMART 目标卡'}
                {initialData?.id && <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded">{codePrefix}-{String(initialData.id).padStart(6, '0')}</span>}
             </h2>
             {!isSimplifiedMode && (
               <div className="hidden sm:flex items-center gap-4 ml-2 pl-6 border-l border-white/20">
                 <button onClick={() => setActiveTab('details')} className={`text-sm font-bold transition-all ${activeTab === 'details' ? 'text-white' : 'text-white/60 hover:text-white'}`}>任务详情</button>
                 <button onClick={() => setActiveTab('star_space')} className={`text-sm font-bold transition-all ${activeTab === 'star_space' ? 'text-white' : 'text-white/60 hover:text-white'}`}>STAR广场</button>
               </div>
             )}
          </div>
           <div className="flex items-center gap-3">
             {headerActions && <div className="flex items-center gap-2 mr-2">{headerActions}</div>}
             <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white"><X size={20} /></button>
           </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'star_space' ? (
            <SharedSTARPanel taskId={initialData?.pool_task_id || Number(initialData?.id)} taskType={type} taskTitle={initialData?.title} initialData={initialData} currentUser={currentUser} />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden relative bg-white">
              <div className="flex-1 flex flex-col overflow-hidden">
                <AnimatePresence>
                  {!isSimplifiedMode && (() => {
                    const isClaimingPhase = initialData?.status === 'claiming';
                    const validApplicants = (initialData?.role_claims || []).filter((c: any) => c.status === 'pending' || c.status === 'approved');
                    const applicantIds = validApplicants.map((c: any) => String(c.user_id));
                    
                    const safeUsers = users || [];
                    const filteredUsersRAndA = isClaimingPhase ? safeUsers.filter(u => applicantIds.includes(String(u.id))).map(u => {
                      const claim = validApplicants.find((c: any) => String(c.user_id) === String(u.id));
                      return { ...u, name: `${u.name} (意向${claim?.role_name || ''})` };
                    }) : safeUsers;

                    return (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white border-b border-slate-100 z-20 shrink-0">
                        <div className="px-6 pt-4 pb-3 relative group">
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                             {/* R */}
                             <div className="flex items-center text-sm gap-1.5 shrink-0">
                               <span className="text-slate-400 text-xs font-medium flex items-center">执行人 <span className="ml-1 px-1 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black leading-none">R</span></span>
                               <MultiSelectUserDropdown label="+ 添加" value={headerSelections.r} onChange={v => setHeaderSelections({...headerSelections, r: v})} users={filteredUsersRAndA} placeholder="添加" readonly={!isHeaderEditable}
                                 receiptStatus={initialData?.status === 'pending_receipt' ? (() => { try { return JSON.parse(initialData.receipt_status || '{}'); } catch { return undefined; } })() : undefined} />
                             </div>
                             
                             {/* A */}
                             <div className="flex items-center text-sm gap-1.5 shrink-0">
                               <span className="text-slate-400 text-xs font-medium flex items-center">负责人 <span className="ml-1 px-1 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-black leading-none">A</span></span>
                               <SearchableUserDropdown label="+ 添加" value={headerSelections.a} onChange={v => setHeaderSelections({...headerSelections, a: v})} users={filteredUsersRAndA} placeholder="添加" readonly={!isHeaderEditable || title === '申请新任务'}
                                 receiptStatus={initialData?.status === 'pending_receipt' ? (() => { try { return JSON.parse(initialData.receipt_status || '{}'); } catch { return undefined; } })() : undefined} />
                             </div>

                             {/* Expanded items all flow inline with the rest */}
                             <AnimatePresence>
                               {propsExpanded && (
                                 <>
                                   <div className="flex items-center text-sm gap-1.5 shrink-0 animate-in fade-in zoom-in-95 duration-200">
                                     <span className="text-slate-400 text-xs font-medium flex items-center">向谁咨询 <span className="ml-1 px-1 py-0.5 bg-purple-50 text-purple-600 rounded text-[9px] font-black leading-none">C</span></span>
                                     <MultiSelectUserDropdown label="+ 添加" value={headerSelections.c} onChange={v => setHeaderSelections({...headerSelections, c: v})} users={safeUsers} placeholder="添加" readonly={!isHeaderEditable} />
                                   </div>
                                   <div className="flex items-center text-sm gap-1.5 shrink-0 animate-in fade-in zoom-in-95 duration-200 delay-75">
                                     <span className="text-slate-400 text-xs font-medium flex items-center">需要知会 <span className="ml-1 px-1 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-black leading-none">I</span></span>
                                     <MultiSelectUserDropdown label="+ 添加" value={headerSelections.i} onChange={v => setHeaderSelections({...headerSelections, i: v})} users={safeUsers} placeholder="添加" readonly={!isHeaderEditable} />
                                   </div>
                                   <div className="flex items-center text-sm gap-1.5 shrink-0 animate-in fade-in zoom-in-95 duration-200 delay-100">
                                     <span className="text-slate-400 text-xs font-medium">任务属性</span>
                                     <TaskTypeDropdown value={headerSelections.taskType} onChange={v => setHeaderSelections({...headerSelections, taskType: v})} readonly={!isHeaderEditable} />
                                   </div>
                                   <div className="flex items-center text-sm gap-1 shrink-0 group/bonus animate-in fade-in zoom-in-95 duration-200 delay-150">
                                     <span className="text-slate-400 text-xs font-medium mr-1">任务奖金</span>
                                     <span className="text-slate-400 text-xs font-black">¥</span>
                                     <input type="number" min="0" value={headerSelections.bonus} onChange={e => setHeaderSelections({...headerSelections, bonus: e.target.value})} disabled={!isHeaderEditable} className="w-16 outline-none text-slate-700 font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 transition-colors disabled:hover:border-transparent" placeholder="0" />
                                   </div>
                                   <div className="flex items-center text-sm gap-1 shrink-0 group/limit animate-in fade-in zoom-in-95 duration-200 delay-200">
                                     <span className="text-slate-400 text-xs font-medium mr-1">人数上限</span>
                                     <input type="number" min="1" max="20" value={headerSelections.maxParticipants} onChange={e => setHeaderSelections({...headerSelections, maxParticipants: e.target.value})} disabled={!isHeaderEditable} className="w-10 outline-none text-slate-700 font-bold text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 transition-colors disabled:hover:border-transparent mr-0.5" placeholder="1" />
                                     <span className="text-xs text-slate-500 leading-none">人</span>
                                   </div>
                                 </>
                               )}
                             </AnimatePresence>
                          </div>
                          
                          {/* Toggle Button centered below properties (Floating to save space) */}
                          <div className="absolute left-1/2 -translate-x-1/2 -bottom-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => setPropsExpanded(!propsExpanded)} className="text-[10px] bg-white border border-slate-200 hover:bg-blue-50 text-slate-400 hover:text-blue-600 px-3 py-0.5 rounded-full flex items-center gap-1 shadow-sm transition-colors">
                               {propsExpanded ? '收起' : '展开'}
                               <span className="material-symbols-outlined text-[14px]">{propsExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
                             </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>

                <div className="flex-1 overflow-y-auto bg-[#f8f9fb] transition-all duration-300 p-5">
                  <div className="max-w-4xl mx-auto space-y-4">
                     {/* 驳回原因 / 审批意见提示 */}
                     {initialData?.reject_reason && (initialData?.proposal_status === 'rejected' || initialData?.status === 'rejected') && (
                       <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                         <span className="material-symbols-outlined text-red-500 text-[18px] mt-0.5">error</span>
                         <div>
                           <div className="text-xs font-bold text-red-700 mb-0.5">驳回原因</div>
                           <div className="text-sm text-red-600">{initialData.reject_reason}</div>
                         </div>
                       </div>
                     )}
                     {/* Applicant List Widget — 显示所有认领申请（默认折叠） */}
                     {!isSimplifiedMode && (() => {
                       const allClaims = (initialData?.role_claims || []) as any[];
                       if (allClaims.length === 0) return null;
                       const STATUS_MAP: Record<string, { label: string; dot: string; bg: string }> = {
                         pending: { label: '待审核', dot: 'bg-amber-400', bg: 'bg-amber-50 text-amber-700' },
                         approved: { label: '已批准', dot: 'bg-emerald-400', bg: 'bg-emerald-50 text-emerald-700' },
                         rejected: { label: '已拒绝', dot: 'bg-red-400', bg: 'bg-red-50 text-red-600' },
                         star_submitted: { label: '已提交', dot: 'bg-violet-400', bg: 'bg-violet-50 text-violet-700' },
                       };
                       const pendingCount = allClaims.filter((c: any) => c.status === 'pending').length;
                       const approvedCount = allClaims.filter((c: any) => c.status === 'approved' || c.status === 'star_submitted').length;
                       return (
                         <div className="p-3 bg-blue-50/50 border border-blue-100/50 rounded-xl relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                           <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-500"></div>
                           <button type="button" onClick={() => setClaimsExpanded(!claimsExpanded)} className="w-full text-blue-700 font-black flex items-center ml-1 cursor-pointer hover:text-blue-800 transition-colors">
                             <span className="material-symbols-outlined text-[18px] mr-1.5 opacity-80">group</span>
                             <span className="text-xs tracking-wider">角色认领申请 ({allClaims.length}人</span>
                             {pendingCount > 0 && <span className="text-xs ml-1 text-amber-600">· {pendingCount}待审</span>}
                             {approvedCount > 0 && <span className="text-xs ml-1 text-emerald-600">· {approvedCount}已批</span>}
                             <span className="text-xs">)</span>
                             <span className={`material-symbols-outlined text-[16px] ml-auto mr-1 transition-transform duration-200 ${claimsExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                           </button>
                           {claimsExpanded && (
                           <div className="space-y-1.5 ml-1 mt-2">
                             {allClaims.map((claim: any) => {
                               const isA = claim.role_name === 'A';
                               const st = STATUS_MAP[claim.status] || STATUS_MAP.pending;
                               return (
                                 <div key={claim.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-slate-200/60 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                   <span className={`w-5 h-5 rounded-md shadow-sm flex items-center justify-center text-[10px] font-black text-white shrink-0 ${isA ? 'bg-gradient-to-br from-amber-400 to-orange-400' : 'bg-gradient-to-br from-blue-400 to-indigo-400'}`}>
                                     {(claim.user_name || '?')[0]}
                                   </span>
                                   <span className="text-[12px] font-bold text-slate-700 shrink-0">{claim.user_name}</span>
                                   <span className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 ${isA ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                     {claim.role_name === 'A' ? '负责人 A' : claim.role_name === 'R' ? '执行人 R' : claim.role_name === 'C' ? '咨询 C' : claim.role_name === 'I' ? '知会 I' : claim.role_name}
                                   </span>
                                   <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 ${st.bg}`}>
                                     <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                                     {st.label}
                                   </span>
                                   {claim.reason && (
                                     <span className="text-[11px] text-slate-500 truncate flex-1 min-w-0" title={claim.reason}>
                                       理由: {claim.reason}
                                     </span>
                                   )}
                                 </div>
                               );
                             })}
                           </div>
                           )}
                         </div>
                       );
                     })()}

                     {/* 认领申请信息 (pool_join 审批时显示) */}
                     {isPoolJoin && initialData?.join_applicant && (
                       <div className="flex items-center gap-3 p-3 bg-amber-50/80 border border-amber-200/60 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                         <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-sm shrink-0">
                           <span className="material-symbols-outlined text-white text-[18px]">person_add</span>
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="text-sm font-black text-amber-800">
                             {initialData.join_applicant} 申请认领此任务
                             {initialData.join_role && (
                               <span className={`ml-2 text-xs font-black px-1.5 py-0.5 rounded ${initialData.join_role === 'A' ? 'bg-amber-200 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                 意向角色: {initialData.join_role === 'A' ? '负责人 A' : initialData.join_role === 'R' ? '执行人 R' : initialData.join_role}
                               </span>
                             )}
                           </div>
                           {initialData.join_reason && (
                             <p className="text-xs text-amber-600 mt-0.5 truncate">申请理由: {initialData.join_reason}</p>
                           )}
                         </div>
                       </div>
                     )}

                     {/* Summary */}
                     <div className="relative">
                        {readonly ? (
                          <div className="w-full px-4 py-3 font-bold bg-white rounded-lg shadow-sm border-0">{formData.summary}</div>
                        ) : (
                          <>
                            <input type="text" value={formData.summary} onChange={e => handleUpdate('summary', e.target.value)} placeholder="目标简述..." className="w-full pl-4 pr-28 py-3 font-bold bg-white rounded-lg outline-none focus:ring-2 focus:ring-blue-100 shadow-sm border-0 transition-all" />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              <button onClick={handleAIAssist} disabled={aiActivating === 'full'} className={`px-2.5 py-1.5 text-xs font-bold rounded shadow-sm transition-all ${aiActivating === 'full' ? 'bg-indigo-200 text-indigo-400 animate-pulse' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                                {aiActivating === 'full' ? 'AI 拆解中...' : 'AI 智能拆解'}
                              </button>
                            </div>
                          </>
                        )}
                     </div>
                     {/* Unified SMART Content */}
                        <div className="space-y-4">
                           <div className="bg-white rounded-xl overflow-hidden shadow-sm flex flex-col border-0">
                              <div className="bg-slate-50/50 px-4 py-3 flex items-center justify-between border-0">
                                <div className="flex items-center gap-2">
                                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">{isSimplifiedMode ? '提案描述' : '详情与验收标准 (SMART)'}</label>
                                  {type === 'pool_publish' && initialData?.status === 'claiming' && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">选填</span>}
                                </div>
                                {isSimplifiedMode && !readonly && <span className="text-[10px] text-slate-400">自由描述，也可按 SMART 格式填写</span>}
                              </div>
                              <div className="p-4 bg-white smart-task-editor" data-color-mode="light">
                                <style>{`
                                  .smart-task-editor .w-md-editor-text-pre .token.italic {
                                    opacity: 0.4;
                                    transition: opacity 0.2s;
                                  }
                                  .smart-task-editor .wmde-markdown blockquote {
                                    opacity: 0.5;
                                    background: transparent !important;
                                    border-left: 3px solid #e2e8f0 !important;
                                  }
                                `}</style>
                                <MDEditor
                                  textareaProps={isSimplifiedMode ? { placeholder: '请描述您的提案想法...\n可以自由书写，也可点击下方按钮插入 SMART 模板' } : undefined}
                                  value={formData.s}
                                  onChange={readonly ? undefined : (v, ev) => {
                                    if (!v) {
                                      handleUpdate('s', '');
                                      return;
                                    }
                                    let lines = v.split('\n');
                                    let linesNew = lines.map(line => {
                                      if (line.includes('*说明 (')) {
                                        const stripped = line.replace(/>?\s*[\s\S]{0,4}\s*\*说明 \([a-zA-Z-]+\):[^*]+\*?\s*/g, '').trim();
                                        const isPristine = 
                                          line.includes('请描述具体明确的产出是什么') ||
                                          line.includes('请描述如何衡量完成度与验收标准') ||
                                          line.includes('请描述实现该目标的具体行动和所需资源') ||
                                          line.includes('请描述该任务与岗位及大目标的关联性和意义') ||
                                          line.includes('请描述关键的时间节点与进度安排');

                                        if (isPristine && stripped === '') {
                                          return line;
                                        }
                                        return stripped;
                                      }
                                      if (/^>?\s*(🎯|📊|🚀|🔗|⏰)\s*$/.test(line.trim())) {
                                        return '';
                                      }
                                      return line;
                                    });
                                    const newV = linesNew.join('\n');
                                    
                                    // Handle cursor restoration if we performed a magic strip
                                    if (newV !== v && ev?.target) {
                                      const diff = v.length - newV.length;
                                      const cursor = ev.target.selectionStart;
                                      handleUpdate('s', newV);
                                      if (diff > 0 && typeof cursor === 'number') {
                                        setTimeout(() => {
                                          if (ev.target) {
                                            const newCursor = Math.max(0, cursor - diff);
                                            ev.target.setSelectionRange(newCursor, newCursor);
                                          }
                                        }, 0);
                                      }
                                    } else {
                                      handleUpdate('s', newV);
                                    }
                                  }}
                                  height={isSimplifiedMode ? 220 : 380}
                                  preview={readonly ? "preview" : "edit"} 
                                  hideToolbar={readonly} 
                                />
                                {isSimplifiedMode && !readonly && !formData.s?.includes('【目标 S】') && (
                                  <button
                                    onClick={() => handleUpdate('s', (formData.s ? formData.s + '\n\n' : '') + SMART_TEMPLATE_CLEAN)}
                                    className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">add_circle</span>
                                    插入 SMART 模板
                                  </button>
                                )}
                              </div>
                           </div>

                           {/* PDCA 时间规划节点 — 提案模式隐藏 */}
                           {!isSimplifiedMode && (
                           <div className="bg-white border-0 rounded-xl overflow-hidden shadow-sm p-4">
                              <label className="text-[11px] font-black text-rose-600 uppercase tracking-widest block mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                                PDCA 时间规划节点
                              </label>
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1">Plan <span className="font-normal">(计划达成)</span></label>
                                  {!isHeaderEditable ? <div className="text-sm font-bold text-slate-800 tracking-wide">{formData.planTime ? formData.planTime.replace('T', ' ').substring(0, 16) : '-'}</div> : <input type="datetime-local" className="w-full text-sm border-0 bg-slate-50 rounded-lg p-2 focus:ring-2 focus:ring-rose-200 outline-none font-medium text-slate-700 font-mono" value={formData.planTime ? formData.planTime.replace(' ', 'T').substring(0, 16) : ''} onChange={e => setFormData({...formData, planTime: e.target.value.replace('T', ' ')})} />}
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1">Do <span className="font-normal">(执行节点)</span></label>
                                  {!isHeaderEditable ? <div className="text-sm font-bold text-slate-800 tracking-wide">{formData.doTime ? formData.doTime.replace('T', ' ').substring(0, 16) : '-'}</div> : <input type="datetime-local" className="w-full text-sm border-0 bg-slate-50 rounded-lg p-2 focus:ring-2 focus:ring-rose-200 outline-none font-medium text-slate-700 font-mono" value={formData.doTime ? formData.doTime.replace(' ', 'T').substring(0, 16) : ''} onChange={e => setFormData({...formData, doTime: e.target.value.replace('T', ' ')})} />}
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1">Check <span className="font-normal">(检查反馈)</span></label>
                                  {!isHeaderEditable ? <div className="text-sm font-bold text-slate-800 tracking-wide">{formData.checkTime ? formData.checkTime.replace('T', ' ').substring(0, 16) : '-'}</div> : <input type="datetime-local" className="w-full text-sm border-0 bg-slate-50 rounded-lg p-2 focus:ring-2 focus:ring-rose-200 outline-none font-medium text-slate-700 font-mono" value={formData.checkTime ? formData.checkTime.replace(' ', 'T').substring(0, 16) : ''} onChange={e => setFormData({...formData, checkTime: e.target.value.replace('T', ' ')})} />}
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1">Act <span className="font-normal">(调整复盘)</span></label>
                                  {!isHeaderEditable ? <div className="text-sm font-bold text-slate-800 tracking-wide">{formData.actTime ? formData.actTime.replace('T', ' ').substring(0, 16) : '-'}</div> : <input type="datetime-local" className="w-full text-sm border-0 bg-slate-50 rounded-lg p-2 focus:ring-2 focus:ring-rose-200 outline-none font-medium text-slate-700 font-mono" value={formData.actTime ? formData.actTime.replace(' ', 'T').substring(0, 16) : ''} onChange={e => setFormData({...formData, actTime: e.target.value.replace('T', ' ')})} />}
                                </div>
                              </div>
                           </div>
                           )}

                           <div className="bg-white border-0 rounded-xl overflow-hidden shadow-sm p-4">
                              <label className="text-[11px] font-black text-blue-600 uppercase tracking-widest block mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">attachment</span>
                                附件资料 (可选)
                              </label>
                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                  {formData.attachments.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-slate-50 border-0 shadow-sm px-3 py-1.5 rounded-lg">
                                      <span className="material-symbols-outlined text-slate-400 text-[18px]">description</span>
                                      {file.url && !file.url.startsWith('blob:') ? (
                                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[120px]">{file.name}</a>
                                      ) : (
                                        <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{file.name}</span>
                                      )}
                                      {!readonly && (
                                        <button onClick={() => setFormData({...formData, attachments: formData.attachments.filter((_, i) => i !== idx)})} className="text-slate-400 hover:text-red-500 transition-colors">
                                          <X size={14} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {!readonly && (
                                    <label className="flex items-center justify-center w-8 h-8 bg-blue-50 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 transition-all border-0 shadow-sm">
                                      <span className="material-symbols-outlined text-[18px]">add</span>
                                      <input type="file" multiple className="hidden" onChange={async (e) => {
                                        if (e.target.files) {
                                          const files = Array.from(e.target.files);
                                          const fd = new FormData();
                                          files.forEach(f => fd.append('files', f));
                                          try {
                                            const token = localStorage.getItem('token') || '';
                                            const res = await fetch('/api/uploads/files', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                                            if (!res.ok) {
                                              try { const ej = await res.json(); alert(ej.message || `上传失败 (${res.status})`); } catch { alert(`上传失败 (HTTP ${res.status})`); }
                                              return;
                                            }
                                            const json = await res.json();
                                            if (json.code === 0 && json.data) {
                                              setFormData({...formData, attachments: [...formData.attachments, ...json.data]});
                                            } else {
                                              alert(json.message || '上传失败');
                                            }
                                          } catch (e: any) { alert('上传失败: ' + (e?.message || '请检查网络')); }
                                        }
                                      }} />
                                    </label>
                                  )}
                                </div>
                              </div>
                           </div>
                        </div>
                     
                     {customFooter && (
                       <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                         {customFooter}
                       </div>
                     )}
                     
                     {/* Audit & Trajectory moved to Footer */}
                  </div>
                </div>

                {/* Footer - Single Row Integration */}
                <div className="px-6 py-3 bg-white border-t shrink-0 flex items-center justify-between gap-6 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] selection:bg-transparent min-h-[64px]">
                  {initialData?.id ? (
                    <div className="flex-1 flex items-center gap-4 min-w-0">
                       <div className="flex-1 min-w-0 scale-90 origin-left">
                          <WorkflowTrajectory businessType={resolvedFlowType as any} businessId={trajectoryBusinessId} codePrefix={codePrefix} />
                       </div>
                       <div className="shrink-0 opacity-60 scale-90 origin-right">
                          <AuditTimeline businessType={resolvedFlowType === 'proposal' ? 'proposal' : 'perf_plan'} businessId={trajectoryBusinessId} />
                       </div>
                    </div>
                  ) : <div className="flex-1" />}
                  
                  <div className="flex items-center gap-2 shrink-0">
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
                    ) : initialData?.proposal_status === 'pending_publish' ? (
                       <button onClick={() => onApprove?.('一键发布', null, 'publish')} className="px-8 py-2 bg-sky-600 shadow-md hover:opacity-90 transition-opacity text-white font-bold rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto">
                         <span className="material-symbols-outlined text-[18px]">campaign</span> 一键发榜
                       </button>
                    ) : (
                      <>
                        <button onClick={() => setIsEditingMode(!isEditingMode)} className="px-4 py-2 border text-blue-600 rounded-lg">{isEditingMode ? '取消修改' : '修改内容'}</button>
                        <div className="flex-1 flex items-center justify-end pr-3 gap-3">
                          {/* 签收按钮已移至 header，此处仅保留其他操作 */}
                          <button onClick={() => setShowTransfer(true)} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-lg">转办</button>
                          <button onClick={() => onReject?.('驳回')} className="px-4 py-2 text-rose-500">驳回</button>
                          <button onClick={() => {
                            const submitData = (readonly && !approverMode && !isEditingMode) ? null : { ...formData, ...headerSelections, summary: formData.summary || formData.s?.substring(0, 30) };
                            onApprove?.('同意', submitData);
                          }} className="px-8 py-2 bg-emerald-600 text-white font-bold rounded-lg shadow-sm">同意</button>
                        </div>
                      </>
                    )
                  ) : (
                    readonly ? (
                      <div className="flex flex-1 items-center justify-between gap-3">
                        {/* 左侧：草稿删除 */}
                        {onDelete && (initialData as any)?.status === 'draft' && (
                          <button
                            onClick={() => { if (window.confirm('确认删除草稿？')) onDelete(); }}
                            className="px-4 py-2 text-sm font-bold text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50 transition-all"
                          >
                            删除草稿
                          </button>
                        )}

                        {/* 右侧动作区 */}
                        <div className="flex-1 flex items-center justify-end gap-3">

                          {/* ── 派发签收流程动作 (pending_receipt) ── */}
                          {initialData?.status === 'pending_receipt' && (() => {
                            const receiptStatus: Record<string, string> = JSON.parse(initialData.receipt_status || '{}');
                            const myStatus = receiptStatus[currentUser?.id || ''];
                            const total = Object.keys(receiptStatus).length;
                            const confirmed = Object.values(receiptStatus).filter(s => s === 'confirmed').length;
                            const allConfirmed = total > 0 && confirmed === total;
                            const isA = initialData.approver_id === currentUser?.id;

                            const handleReceiptAction = async (action: 'confirm' | 'reject') => {
                              const reason = action === 'reject' ? window.prompt('请输入拒签理由：') : '同意签收';
                              if (action === 'reject' && reason === null) return;
                              try {
                                const res = await fetch(
                                  `/api/perf/plans/${initialData.id}/${action === 'confirm' ? 'confirm-receipt' : 'reject-receipt'}`,
                                  {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                                    body: JSON.stringify({ reason })
                                  }
                                );
                                const data = await res.json();
                                if (data.code === 0) {
                                  alert(action === 'confirm' ? '✅ 签收成功！' : '🔴 已拒签，任务将退回给主管。');
                                  onClose();
                                  setTimeout(() => window.location.reload(), 300);
                                } else alert(data.message);
                              } catch { alert('服务异常'); }
                            };

                            const handleStartTask = async () => {
                              try {
                                const res = await fetch(`/api/perf/plans/${initialData.id}/start-task`, {
                                  method: 'POST',
                                  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                                });
                                const data = await res.json();
                                if (data.code === 0) {
                                  alert('🚀 任务已启动，进入执行阶段！');
                                  onClose();
                                  setTimeout(() => window.location.reload(), 300);
                                } else alert(data.message);
                              } catch { alert('服务异常'); }
                            };

                            return (
                              <div className="flex items-center gap-3">
                                {/* 签收进度指示 */}
                                <div className="flex flex-col items-end">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">查收进度</span>
                                  <span className="text-xs font-bold text-slate-700">{confirmed} / {total} {allConfirmed && <span className="text-emerald-500">✓ 全员已签</span>}</span>
                                </div>

                                {/* 员工：待签收操作 */}
                                {myStatus === 'pending' && (
                                  <>
                                    {/* 次要危险按钮 */}
                                    <button
                                      onClick={() => handleReceiptAction('reject')}
                                      className="px-4 py-2 text-sm font-bold text-rose-500 border border-rose-200 rounded-xl hover:bg-rose-50 transition-all"
                                    >
                                      拒签
                                    </button>
                                    {/* 主要确认按钮 */}
                                    <button
                                      onClick={() => handleReceiptAction('confirm')}
                                      className="px-6 py-2 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 rounded-xl shadow-md hover:shadow-emerald-200/60 transition-all"
                                    >
                                      确认查收
                                    </button>
                                  </>
                                )}

                                {/* 主管(A)：全员签收后显示发车按钮（flow2 申请类任务签收完自动进审批，不需手动发车） */}
                                {allConfirmed && isA && initialData?.task_type !== 'applied' && (
                                  <button
                                    onClick={handleStartTask}
                                    className="px-8 py-2 text-sm font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg hover:shadow-blue-200/60 transition-all"
                                  >
                                    🚀 发起任务
                                  </button>
                                )}
                                {/* flow2 申请类：签收完后等待上级审批 */}
                                {allConfirmed && initialData?.task_type === 'applied' && (
                                  <span className="text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1.5 rounded-lg">
                                    ✓ 签收完成，等待上级审批
                                  </span>
                                )}
                              </div>
                            );
                          })()}

                          {/* ── 已完成赏金任务：线下清算 ── */}
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
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
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
                        {/* 默认关闭按钮 */}
                        <button onClick={onClose} className="px-6 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors font-bold rounded-xl">关闭</button>
                      </div>

                    ) : (
                      <>
                        {onDelete ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                            className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center mr-2 group"
                            title="删除/撤回"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        ) : (
                          <button onClick={onClose} className="px-4 py-2 text-gray-500">取消</button>
                        )}
                        <button onClick={() => onDraft?.({...formData, ...headerSelections})} className="px-4 py-2 border border-violet-200 text-violet-600 rounded-xl">存为草稿</button>
                        <button 
                          onClick={handleSubmit} 
                          disabled={submitting || (isTaskFull && title.includes('领取'))} 
                          className={`px-8 py-2 text-white font-bold rounded-xl shadow-sm transition-opacity ${isTaskFull && title.includes('领取') ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:opacity-90'}`}
                        >
                          {isTaskFull && title.includes('领取') ? '人数已满' : title === '申请新任务' ? '发起申请' : title.includes('领取') ? '领取角色' : '提交修改'}
                        </button>
                      </>
                    )
                  )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
