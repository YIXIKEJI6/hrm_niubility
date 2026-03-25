import Sidebar from '../components/Sidebar';

export default function PersonalGoals({ navigate }: { navigate: (view: string) => void }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <Sidebar currentView="personal" navigate={navigate} />

      {/* Main Content Area */}
      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto">

        <div className="p-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div>
              <nav className="flex text-xs font-label text-outline mb-2 space-x-2">
                <span>主页</span>
                <span>/</span>
                <span className="text-primary font-medium">目标管理</span>
              </nav>
              <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">个人目标管理</h1>
              <p className="text-on-surface-variant mt-2 max-w-2xl">追踪您的关键结果，保持与组织数字化转型战略的一致性。本季度您已完成 65% 的核心指标。</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative inline-block text-left">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-lowest rounded-xl font-medium border border-outline-variant/20 shadow-sm hover:bg-surface-bright transition-all">
                  <span className="material-symbols-outlined text-primary">calendar_today</span>
                  <span>2024 Q2</span>
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </button>
              </div>
              <button className="primary-gradient text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/30 active:scale-95 transition-all">
                <span className="material-symbols-outlined">add</span>
                <span>设定新目标</span>
              </button>
            </div>
          </div>

          {/* Top Level Overview (Bento Grid Style) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            {/* Progress Ring Card 1 */}
            <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between group hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-primary/10 rounded-lg text-primary">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                </div>
                <span className="font-label text-xs font-semibold text-primary px-2 py-1 bg-primary/5 rounded-md">核心技术</span>
              </div>
              <div>
                <h3 className="text-lg font-bold mb-1">系统微服务重构</h3>
                <p className="text-sm text-on-surface-variant mb-6">提升支付接口的并发处理能力 40%</p>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1.5 font-label">
                      <span className="font-medium">已完成 78%</span>
                      <span className="text-outline">目标: 100%</span>
                    </div>
                    <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: '78%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Ring Card 2 */}
            <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between group hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-secondary/10 rounded-lg text-secondary">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                </div>
                <span className="font-label text-xs font-semibold text-secondary px-2 py-1 bg-secondary/5 rounded-md">业务拓展</span>
              </div>
              <div>
                <h3 className="text-lg font-bold mb-1">华东市场渗透率</h3>
                <p className="text-sm text-on-surface-variant mb-6">新增 15 个战略级合作企业账号</p>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1.5 font-label">
                      <span className="font-medium">已完成 45%</span>
                      <span className="text-outline">目标: 100%</span>
                    </div>
                    <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-secondary rounded-full transition-all" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Circular Stats Card */}
            <div className="bg-primary p-6 rounded-xl text-white relative overflow-hidden flex items-center shadow-xl">
              <div className="z-10">
                <p className="text-primary-fixed-dim font-medium mb-1">总体季度完成度</p>
                <h3 className="text-4xl font-black mb-2 tracking-tighter">65.8%</h3>
                <p className="text-sm text-primary-fixed-dim/80">超过团队 85% 的成员</p>
              </div>
              <div className="absolute -right-8 -bottom-8 opacity-20">
                <span className="material-symbols-outlined text-[160px]">auto_graph</span>
              </div>
            </div>
          </div>

          {/* Filters & Goals List */}
          <div className="bg-surface-container-low rounded-xl overflow-hidden p-1">
            <div className="bg-surface-container-lowest rounded-lg">
              {/* List Header / Filters */}
              <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container-low">
                <div className="flex items-center gap-6">
                  <button className="text-primary font-bold border-b-2 border-primary pb-1">所有目标 (12)</button>
                  <button className="text-on-surface-variant hover:text-primary transition-colors pb-1">进行中 (7)</button>
                  <button className="text-on-surface-variant hover:text-primary transition-colors pb-1">已完成 (4)</button>
                  <button className="text-on-surface-variant hover:text-primary transition-colors pb-1">待开始 (1)</button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">filter_list</span>
                    <select className="pl-10 pr-8 py-2 bg-surface-container-low border-none rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary appearance-none outline-none">
                      <option>所有分类</option>
                      <option>技术研发</option>
                      <option>业务增长</option>
                      <option>团队建设</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Goals List Content */}
              <div className="divide-y divide-surface-container-low">
                {/* Goal Item 1 */}
                <div className="p-6 hover:bg-surface-container-low transition-colors group">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-blue-100 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">技术</span>
                        <h4 className="text-lg font-bold text-on-surface">自动化部署流水线优化</h4>
                        <span className="flex items-center gap-1 text-secondary text-xs font-semibold bg-secondary-container/20 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> 进行中
                        </span>
                      </div>
                      <p className="text-sm text-on-surface-variant mb-4">通过容器化技术将平均部署时间从 20 分钟降低至 5 分钟以内。</p>
                      <div className="flex items-center gap-4 text-xs font-label">
                        <div className="flex items-center gap-1.5 text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm">link</span>
                          <span className="font-medium">对齐组织年度目标: 数字化转型</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          <span>截止: 2024-06-30</span>
                        </div>
                      </div>
                    </div>
                    <div className="lg:w-72">
                      <div className="flex justify-between text-xs mb-2 font-label">
                        <span className="font-bold">进度 82%</span>
                        <span className="text-outline">关键节点 4/5</span>
                      </div>
                      <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: '82%' }}></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-primary hover:text-white transition-all">
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-error hover:text-white transition-all">
                        <span className="material-symbols-outlined">more_horiz</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Goal Item 2 */}
                <div className="p-6 hover:bg-surface-container-low transition-colors group">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-emerald-100 text-secondary text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">业务</span>
                        <h4 className="text-lg font-bold text-on-surface">新零售行业解决方案落地</h4>
                        <span className="flex items-center gap-1 text-tertiary text-xs font-semibold bg-tertiary-container/20 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> 阻塞
                        </span>
                      </div>
                      <p className="text-sm text-on-surface-variant mb-4">与 3 家头部新零售企业达成初步战略合作意向。</p>
                      <div className="flex items-center gap-4 text-xs font-label">
                        <div className="flex items-center gap-1.5 text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm">link</span>
                          <span className="font-medium">对齐组织年度目标: 行业深耕战略</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          <span>截止: 2024-05-15</span>
                        </div>
                      </div>
                    </div>
                    <div className="lg:w-72">
                      <div className="flex justify-between text-xs mb-2 font-label">
                        <span className="font-bold text-error">进度 30%</span>
                        <span className="text-outline">依赖外部法务审批</span>
                      </div>
                      <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                        <div className="h-full bg-error/60 rounded-full" style={{ width: '30%' }}></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-primary hover:text-white transition-all">
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-error hover:text-white transition-all">
                        <span className="material-symbols-outlined">more_horiz</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Goal Item 3 */}
                <div className="p-6 hover:bg-surface-container-low transition-colors group">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">团队</span>
                        <h4 className="text-lg font-bold text-on-surface">初级工程师导师计划</h4>
                        <span className="flex items-center gap-1 text-primary text-xs font-semibold bg-primary-container/20 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span> 已完成
                        </span>
                      </div>
                      <p className="text-sm text-on-surface-variant mb-4">指导 2 名初级工程师顺利通过试用期评估，并完成技术栈同步。</p>
                      <div className="flex items-center gap-4 text-xs font-label">
                        <div className="flex items-center gap-1.5 text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm">link</span>
                          <span className="font-medium">对齐组织年度目标: 人才梯队建设</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-on-surface-variant">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          <span>完成日期: 2024-03-20</span>
                        </div>
                      </div>
                    </div>
                    <div className="lg:w-72">
                      <div className="flex justify-between text-xs mb-2 font-label">
                        <span className="font-bold text-secondary">进度 100%</span>
                        <span className="text-outline">目标达成</span>
                      </div>
                      <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                        <div className="h-full bg-secondary rounded-full" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-primary hover:text-white transition-all">
                        <span className="material-symbols-outlined">visibility</span>
                      </button>
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant hover:bg-error hover:text-white transition-all">
                        <span className="material-symbols-outlined">more_horiz</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pagination */}
              <div className="p-4 flex items-center justify-between bg-surface-container-low/30">
                <p className="text-xs text-on-surface-variant font-label">显示 1-3 之于 12 个目标</p>
                <div className="flex gap-2">
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant text-outline hover:bg-surface-container-highest disabled:opacity-50" disabled>
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white text-xs font-bold">1</button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest text-xs">2</button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest text-xs">3</button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Action Button (FAB) - Contextual */}
      <button className="fixed bottom-8 right-8 w-14 h-14 primary-gradient text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform md:hidden">
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  );
}
