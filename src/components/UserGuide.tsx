import React, { useState } from 'react';

interface GuideSection {
  id: string;
  icon: string;
  title: string;
  content: React.ReactNode;
}

const sections: GuideSection[] = [
  {
    id: 'overview',
    icon: 'dashboard',
    title: '系统概述',
    content: (
      <div className="space-y-3">
        <p>You!Niubility! HRM 是一套集绩效管理、人力地图、组织架构、审批流程、团队协作于一体的智能人力资源管理系统。</p>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300">💡 主要功能模块</p>
          <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
            <li>📊 <b>我的主页</b> — 个人仪表盘、待办任务、绩效概览</li>
            <li>👥 <b>我的团队</b> — 团队成员管理、绩效追踪</li>
            <li>🔥 <b>赏金榜</b> — 公司级任务发布、认领与奖金激励</li>
            <li>🗺️ <b>人力地图</b> — 全公司人员分布可视化</li>
            <li>📈 <b>全景仪表盘</b> — 多维数据分析与 PDCA 监管</li>
            <li>🏗️ <b>组织关系</b> — 部门架构树状图管理</li>
            <li>📅 <b>排班请假</b> — 值班日历排班、请假申请与审批</li>
            <li>🎯 <b>能力大盘</b> — 团队能力评测模型与短板预警</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'bounty',
    icon: 'local_fire_department',
    title: '赏金榜使用指南',
    content: (
      <div className="space-y-3">
        <p>赏金榜是公司级任务激励平台。管理层发布高价值任务，员工自主认领，完成后获得奖金/绩效分奖励。</p>
        <div className="space-y-2">
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">1</span> 提案申请</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">员工可通过"申请绩效池提案"提议新任务，使用 SMART 原则填写目标，经 HR → 总经理逐级审批后入池。</p>
          
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">2</span> 任务认领</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">在任务视图点击"立即加入"认领任务。查看任务详情了解具体要求和奖金金额。</p>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">3</span> RACI 角色</h4>
          <div className="ml-7 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-xs space-y-1">
            <p><b className="text-blue-600">R (负责人)</b> — 单选，最终负责交付</p>
            <p><b className="text-green-600">A (执行人)</b> — 多选，实际执行任务</p>
            <p><b className="text-amber-600">C (咨询人)</b> — 多选，提供专业建议</p>
            <p><b className="text-violet-600">验收人</b> — 多选，负责验收成果</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'perf',
    icon: 'trending_up',
    title: '绩效管理',
    content: (
      <div className="space-y-3">
        <p>系统支持 OKR 与 PDCA 双轨绩效管理模式。</p>
        <div className="space-y-2">
          <h4 className="text-sm font-bold">🎯 个人绩效</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">在"我的主页"查看个人绩效目标，提交目标制定申请并追踪进度。支持 SMART 原则的结构化目标设定。</p>
          
          <h4 className="text-sm font-bold">📋 PDCA 监管</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">全景仪表盘提供 PDCA（计划-执行-检查-改进）全周期监控，可查看项目健康度、进度/时间差距分析。</p>
          
          <h4 className="text-sm font-bold">🤖 AI 诊断</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">系统内置 AI 诊断引擎（页面右下角浮窗），可对绩效数据进行智能分析、瓶颈诊断和改善建议。</p>
        </div>
      </div>
    ),
  },
  {
    id: 'approval',
    icon: 'approval',
    title: '审批流程',
    content: (
      <div className="space-y-3">
        <p>系统提供标准化审批流程，支持多级串行/并行审批。</p>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-300">📝 审批类型</p>
          <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
            <li>• <b>个人目标</b> — 员工提交 → 直属领导审批</li>
            <li>• <b>绩效池提案</b> — 提案人提交 → HR 审核 → 总经理复核</li>
            <li>• <b>团队任务</b> — 由主管直接发布</li>
          </ul>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">审批通知会通过企业微信实时推送。可在消息盒(导航栏铃铛图标)中查看所有通知。</p>
      </div>
    ),
  },
  {
    id: 'org',
    icon: 'account_tree',
    title: '组织架构',
    content: (
      <div className="space-y-3">
        <p>组织关系页面展示公司完整的部门架构树状图。</p>
        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p>• <b>同步企微通讯录</b> — 点击"同步企微通讯录"按钮一键同步企业微信部门和人员</p>
          <p>• <b>部门管理</b> — 支持新建、编辑、删除和移动部门</p>
          <p>• <b>人员管理</b> — 点击部门可查看成员列表，编辑人员信息</p>
        </div>
      </div>
    ),
  },
  {
    id: 'schedule',
    icon: 'calendar_month',
    title: '排班请假',
    content: (
      <div className="space-y-3">
        <p>排班请假模块提供全公司值班排班管理和请假申请功能，支持按部门查看值班日历、在线提交请假、主管审批和自定义假期/班次类型。</p>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300">📅 三大功能 Tab</p>
          <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
            <li>• <b>值班日历</b> — 月历视图查看全员排班，主管可直接点击排班</li>
            <li>• <b>请假管理</b> — 员工提交请假、查看记录，主管审批/驳回</li>
            <li>• <b>假期配置</b> — 管理员自定义假期类型和班次定义</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">1</span> 值班日历</h4>
          <div className="ml-7 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            <p>• 月历视图：横轴为日期(1-31)，纵轴按部门分组显示成员姓名</p>
            <p>• 每个格子用彩色标签显示班次(早/中/晚/全天/休息)，请假日期会用红色标记覆盖</p>
            <p>• <b>切换月份</b>：点击左右箭头切换查看月份</p>
            <p>• <b>部门筛选</b>：下拉选择部门，可查看指定部门或全公司排班</p>
            <p>• <b>主管排班</b>：点击任意格子，弹出班次选择菜单，选择后自动保存；点"清除"可删除已有排班</p>
            <p className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-1.5">⚠️ 普通员工只能查看排班表，无法编辑。只有主管/HR/管理员有排班权限。</p>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">2</span> 请假管理</h4>
          <div className="ml-7 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            <p><b>提交请假：</b></p>
            <p>① 点击右上角"新建请假" → ② 选择假期类型(年假/事假/病假等) → ③ 选择起止日期和上午/下午 → ④ 系统自动计算天数 → ⑤ 填写事由 → ⑥ 提交</p>
            <p><b>额度检查：</b>如果假期类型设置了年度上限(如年假15天)，系统会自动检查剩余额度，不足时提交会被拒绝。</p>
            <p><b>查看模式：</b></p>
            <p>• "我的请假" — 查看自己的请假记录</p>
            <p>• "部门请假" — 主管/HR 查看本部门所有请假记录</p>
            <p><b>操作：</b></p>
            <p>• 员工可在"待审批"状态下撤销自己的请假</p>
            <p>• 主管/HR 可对他人的待审批请假进行"通过"或"驳回"</p>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2.5 text-xs text-green-700 dark:text-green-300">
              <b>💡 请假与排班联动：</b>请假审批通过后，值班日历上对应日期会自动显示请假标记，无需手动修改排班表。
            </div>
          </div>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">3</span> 假期配置（管理员）</h4>
          <div className="ml-7 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            <p><b>假期类型管理：</b></p>
            <p>• 系统预设了 8 种假期类型：年假、事假、病假、调休、婚假、产假、陪产假、丧假</p>
            <p>• 管理员可新增/编辑假期类型，配置名称、颜色、年度天数上限、是否需要审批、计量单位(天/半天/小时)</p>
            <p><b>班次定义管理：</b></p>
            <p>• 系统预设了 5 种班次：早班(08:00-17:00)、中班(13:00-22:00)、晚班(22:00-06:00)、全天、休息</p>
            <p>• 管理员可新增/编辑班次，配置名称、颜色和上下班时间</p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">🔐 权限说明</p>
          <div className="text-xs space-y-1 text-slate-500 dark:text-slate-400">
            <p>• <b>全员</b>：查看排班表、提交/撤销自己的请假</p>
            <p>• <b>主管</b>：编辑本部门排班、查看部门请假、审批/驳回请假</p>
            <p>• <b>HR/管理员</b>：管理全公司排班、管理假期类型和班次定义</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'competency',
    icon: 'psychology',
    title: '能力大盘与预警',
    content: (
      <div className="space-y-3">
        <p>能力大盘用于建立公司的人才能力指标模型，发掘员工潜能，并实时追踪团队的能力短板以便于及时招聘补齐。</p>
        <div className="space-y-2">
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">1</span> 预设能力库配置 (字典)</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">HR 或架构师可在此沉淀通用的“职级能力”与“素养要求”，配置评估说明标准与满分，统一各部门评估尺度。</p>
          
          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">2</span> 能力模型与目标分数</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">为不同岗位组装多项能力维度。创建模型时可「从字典一键导入」，并为其设定一个决定是否合格的<b className="text-blue-600">“达标分”(期望靶点)</b>。</p>

          <h4 className="text-sm font-bold flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">3</span> 自动短板诊断与预警</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 ml-7">当产生评估日志后，系统会<b className="text-red-500">自动聚合</b>计算。如果某项技能的<b className="text-red-500">团队实际均分持续低于期望达标线</b>，该领域大盘会「标红警报」，提示您团队当前该项人才短缺，亟待启动招募补充计划。</p>
        </div>
      </div>
    ),
  },
  {
    id: 'admin',
    icon: 'admin_panel_settings',
    title: '管理后台',
    content: (
      <div className="space-y-3">
        <p>仅管理员和 HR 可访问管理后台，包含以下功能：</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: 'group', label: '组织架构管理' },
            { icon: 'verified', label: '权限矩阵配置' },
            { icon: 'route', label: '审批流模板' },
            { icon: 'payments', label: '工资表管理' },
            { icon: 'notifications_active', label: '消息推送' },
            { icon: 'bar_chart', label: '数据分析' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="material-symbols-outlined text-[14px] text-blue-500">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'shortcuts',
    icon: 'keyboard',
    title: '快捷操作',
    content: (
      <div className="space-y-3">
        <div className="space-y-2">
          {[
            { key: '头像菜单', desc: '更新通知、工资单、个人设置、管理后台、帮助中心' },
            { key: '消息铃铛', desc: '查看企微推送通知和系统消息' },
            { key: '回收站', desc: '赏金榜中删除的任务可恢复/彻底删除' },
            { key: 'AI 助手', desc: '右下角浮窗，随时咨询系统使用问题' },
          ].map(item => (
            <div key={item.key} className="flex items-start gap-3">
              <span className="text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md whitespace-nowrap">{item.key}</span>
              <p className="text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserGuide({ isOpen, onClose }: UserGuideProps) {
  const [activeSection, setActiveSection] = useState('overview');

  if (!isOpen) return null;

  const currentSection = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <div className="fixed inset-0 z-[70] flex">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="ml-auto relative w-full max-w-2xl bg-white dark:bg-slate-900 h-full flex shadow-2xl animate-in slide-in-from-right-8 duration-200">
        {/* Sidebar Navigation */}
        <div className="w-52 bg-slate-50 dark:bg-slate-950 border-r border-slate-200/60 dark:border-slate-800 flex flex-col shrink-0">
          <div className="px-5 py-5 border-b border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0060a9] to-[#409eff] flex items-center justify-center text-white shadow-md">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
              </div>
              <div>
                <h2 className="font-black text-sm text-slate-800 dark:text-slate-100">使用说明</h2>
                <p className="text-[10px] text-slate-400 font-medium">User Guide</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 text-xs font-medium transition-all duration-200 ${
                  activeSection === section.id
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-sm border-r-2 border-blue-500'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-900/60 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{section.icon}</span>
                {section.title}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-slate-200/60 dark:border-slate-800">
            <p className="text-[10px] text-slate-400 text-center">You!Niubility! HRM v1.7.0</p>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-blue-500">{currentSection.icon}</span>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{currentSection.title}</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {currentSection.content}
          </div>
        </div>
      </div>
    </div>
  );
}
