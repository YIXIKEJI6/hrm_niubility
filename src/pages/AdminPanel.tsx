import Sidebar from '../components/Sidebar';

export default function AdminPanel({ navigate }: { navigate: (view: string) => void }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <Sidebar currentView="admin" navigate={navigate} />

      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">管理后台</h2>
            <p className="text-on-surface-variant">系统设置、组织架构管理与数据维护</p>
          </div>

          {/* Admin Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* 组织架构管理 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/60 hover:shadow-lg hover:border-[#0060a9]/30 transition-all cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[#0060a9] text-2xl">account_tree</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">组织架构管理</h3>
              <p className="text-sm text-slate-500 mb-4">同步企业微信通讯录，管理部门与人员信息</p>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">apartment</span>6 个部门</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">person</span>8 名员工</span>
              </div>
            </div>

            {/* 绩效管理 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/60 hover:shadow-lg hover:border-emerald-400/30 transition-all cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-emerald-600 text-2xl">trending_up</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">绩效管理</h3>
              <p className="text-sm text-slate-500 mb-4">绩效计划审批、考核评分与奖金发放</p>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">assignment</span>5 个计划</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">pending</span>1 待审批</span>
              </div>
            </div>

            {/* 工资表管理 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/60 hover:shadow-lg hover:border-amber-400/30 transition-all cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-amber-600 text-2xl">payments</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">工资表管理</h3>
              <p className="text-sm text-slate-500 mb-4">制作月度工资表、审批发放、推送工资条</p>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">table_chart</span>薪资模板</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">calculate</span>自动计算</span>
              </div>
            </div>

            {/* 消息推送管理 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/60 hover:shadow-lg hover:border-purple-400/30 transition-all cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-purple-600 text-2xl">send</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">消息推送</h3>
              <p className="text-sm text-slate-500 mb-4">企业微信消息推送、审批卡片与推送记录</p>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">chat</span>卡片交互</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">history</span>推送记录</span>
              </div>
            </div>

            {/* 绩效池管理 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/60 hover:shadow-lg hover:border-rose-400/30 transition-all cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-rose-600 text-2xl">pool</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">绩效池管理</h3>
              <p className="text-sm text-slate-500 mb-4">创建与调配绩效池任务、设置奖金额度</p>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">task</span>3 个任务</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">monetization_on</span>¥28,000</span>
              </div>
            </div>

            {/* 系统设置 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/60 dark:border-slate-800/60 hover:shadow-lg hover:border-slate-400/30 transition-all cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-slate-600 text-2xl">settings</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">系统设置</h3>
              <p className="text-sm text-slate-500 mb-4">企微配置、AI分析设置、数据备份与恢复</p>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">shield</span>权限管理</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">backup</span>数据备份</span>
              </div>
            </div>

          </div>

          {/* Quick Actions */}
          <div className="mt-8 bg-gradient-to-r from-[#0060a9]/5 to-[#409eff]/5 rounded-2xl p-6 border border-[#0060a9]/10">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#0060a9]">bolt</span>
              快捷操作
            </h3>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-white dark:bg-slate-900 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800/60 hover:border-[#0060a9]/30 hover:text-[#0060a9] transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">sync</span>
                同步企微通讯录
              </button>
              <button className="px-4 py-2 bg-white dark:bg-slate-900 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800/60 hover:border-emerald-400/30 hover:text-emerald-600 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">add_task</span>
                批量创建绩效计划
              </button>
              <button className="px-4 py-2 bg-white dark:bg-slate-900 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800/60 hover:border-amber-400/30 hover:text-amber-600 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">summarize</span>
                生成本月工资表
              </button>
              <button className="px-4 py-2 bg-white dark:bg-slate-900 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800/60 hover:border-purple-400/30 hover:text-purple-600 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">campaign</span>
                群发消息通知
              </button>
              <button className="px-4 py-2 bg-white dark:bg-slate-900 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800/60 hover:border-rose-400/30 hover:text-rose-600 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">analytics</span>
                AI 绩效分析
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
