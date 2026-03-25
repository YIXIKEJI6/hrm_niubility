import Sidebar from '../components/Sidebar';

export default function TeamPerformance({ navigate }: { navigate: (view: string) => void }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface font-body selection:bg-primary-fixed">
      <Sidebar currentView="team" navigate={navigate} />

      {/* Main Content Canvas */}
      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto">

        <div className="pt-4 pb-12 px-8">
          {/* Section Header */}
          <section className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black text-on-surface font-headline tracking-tight">团队绩效与任务追踪</h2>
            <p className="text-on-surface-variant font-label mt-1">实时概览核心团队成员的能力模型与产出效率</p>
          </div>
          <div className="flex space-x-3">
            <div className="flex p-1 bg-surface-container-high rounded-xl">
              <button className="px-4 py-1.5 bg-surface-container-lowest text-primary font-bold rounded-lg text-sm shadow-sm transition-all">所有部门</button>
              <button className="px-4 py-1.5 text-on-surface-variant font-medium rounded-lg text-sm hover:bg-white/50 transition-all">产品开发</button>
              <button className="px-4 py-1.5 text-on-surface-variant font-medium rounded-lg text-sm hover:bg-white/50 transition-all">市场推广</button>
            </div>
            <button className="flex items-center px-4 py-2 bg-surface-container-highest text-on-surface rounded-xl font-bold text-sm hover:bg-surface-variant transition-all">
              <span className="material-symbols-outlined text-sm mr-2">filter_list</span>
              高级筛选
            </button>
          </div>
        </section>

        {/* Quick Action Cards Section */}
        <section className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Action 1: Pending Review */}
          <div className="bg-white border border-surface-container rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary transition-colors">
                <span className="material-symbols-outlined text-secondary group-hover:text-white">assignment_turned_in</span>
              </div>
              <div>
                <h4 className="font-bold text-on-surface">待办审核</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">审核下级的目标或请假申请</p>
              </div>
            </div>
            <span className="bg-error text-white text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center">5</span>
          </div>
          
          {/* Action 2: Initiate Task */}
          <div className="bg-white border border-surface-container rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
              <span className="material-symbols-outlined text-primary group-hover:text-white">add_task</span>
            </div>
            <div>
              <h4 className="font-bold text-on-surface">发起任务</h4>
              <p className="text-xs text-on-surface-variant mt-0.5">给下级发起新任务或指标</p>
            </div>
          </div>

          {/* Action 3: Apply Upwards */}
          <div className="bg-white border border-surface-container rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-tertiary-fixed-dim/20 flex items-center justify-center group-hover:bg-tertiary transition-colors">
              <span className="material-symbols-outlined text-tertiary group-hover:text-white">rocket_launch</span>
            </div>
            <div>
              <h4 className="font-bold text-on-surface">往上级申请</h4>
              <p className="text-xs text-on-surface-variant mt-0.5">提交资源申请、目标变更或请假</p>
            </div>
          </div>
        </section>

        {/* Team Overall Progress Section */}
        <section className="mb-10 bg-white border border-surface-container rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-grow">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h3 className="text-lg font-black font-headline text-on-surface">团队整体进度</h3>
                  <p className="text-xs text-on-surface-variant font-label mt-0.5">当前周期任务执行概况</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary/10 text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary mr-1.5"></span>
                    按计划进行 (On Track)
                  </span>
                  <span className="text-2xl font-black text-primary font-headline">72%</span>
                </div>
              </div>
              <div className="w-full bg-surface-container rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-primary to-primary-container h-full rounded-full transition-all duration-1000" style={{ width: '72%' }}></div>
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-bold text-outline uppercase font-label">
                <span>开始</span>
                <span>里程碑 1</span>
                <span>当前进度</span>
                <span>目标</span>
              </div>
            </div>
            <div className="flex gap-4 lg:border-l lg:border-surface-container lg:pl-8">
              <div className="px-4 py-2">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase font-label mb-1">活跃任务数</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-on-surface">24</span>
                  <span className="text-xs text-on-surface-variant font-medium">/ 32</span>
                </div>
              </div>
              <div className="px-4 py-2 border-x border-surface-container">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase font-label mb-1">逾期任务数</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-error">2</span>
                  <span className="text-[10px] text-error font-bold flex items-center">
                    <span className="material-symbols-outlined text-[10px] mr-0.5">warning</span>
                    需关注
                  </span>
                </div>
              </div>
              <div className="px-4 py-2">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase font-label mb-1">平均达成率</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-on-surface">88%</span>
                  <span className="text-[10px] text-secondary font-bold">↑ 4.2%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bento Grid: Member Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Member Card 1 */}
          <div className="bg-surface-container-low rounded-xl p-6 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img alt="Member Avatar" className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white shadow-sm" src="https://lh3.googleusercontent.com/aida-public/AB6AXuChC7ybweytlrFKGiYebzIzmNzv3_C76fS6oPIppUoJ0D90u2NPDGBdwkcAkzzflnd8kIApWB4S6gS4U2oi3oWd0n-W_dZ66M8dj0kp5krpZLz95GKcI7uyhDAX5Eq1A7WYrQqktFoLuIO3vNpjTu_HaFKdOBYiqVDnz_XJFKeq93GwJVMWalBG196BM9ceWHnHSAiW-8sStGqQ32P6V-EPmYqWmflBJp9nxZor5v1D1nVbTpxbUxS1aoinQq_6F0MOhVoBi_uR6Z0" />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-secondary border-2 border-white rounded-full"></span>
                </div>
                <div>
                  <h3 className="text-lg font-black font-headline">李晓月</h3>
                  <p className="text-xs text-on-surface-variant font-label tracking-wide uppercase">高级产品经理</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-black text-primary">94</span>
                <span className="text-[10px] text-on-surface-variant font-label uppercase">绩效评分</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Mini Radar Chart Mockup */}
              <div className="bg-surface-container-lowest rounded-xl p-3 radar-grid flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5"></div>
                <svg className="w-24 h-24 transform -rotate-90 relative z-10" viewBox="0 0 100 100">
                  <polygon fill="none" points="50,10 85,35 75,80 25,80 15,35" stroke="#c0c7d4" strokeWidth="0.5"></polygon>
                  <polygon fill="rgba(0, 96, 169, 0.2)" points="50,20 75,40 65,70 35,70 25,40" stroke="#0060a9" strokeWidth="2"></polygon>
                </svg>
                <span className="absolute bottom-1 text-[8px] font-label text-on-surface-variant">核心能力模型</span>
              </div>
              {/* Performance Trend */}
              <div className="bg-surface-container-lowest rounded-xl p-3 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">趋势</span>
                  <span className="text-secondary text-[10px] font-bold">+12%</span>
                </div>
                <div className="flex items-end justify-between h-12 px-1">
                  <div className="w-1.5 bg-surface-variant rounded-full h-4"></div>
                  <div className="w-1.5 bg-surface-variant rounded-full h-6"></div>
                  <div className="w-1.5 bg-primary rounded-full h-8"></div>
                  <div className="w-1.5 bg-primary rounded-full h-10"></div>
                  <div className="w-1.5 bg-primary rounded-full h-7"></div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-on-surface-variant uppercase flex items-center">
                <span className="material-symbols-outlined text-xs mr-1">task_alt</span>
                当前关键任务 (3)
              </h4>
              <div className="space-y-2">
                <div className="p-2.5 bg-white/60 rounded-lg flex items-center justify-between group-hover:bg-white transition-colors">
                  <span className="text-sm font-medium">Q3 路线图规划</span>
                  <span className="text-[10px] px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-full font-bold">进行中</span>
                </div>
                <div className="p-2.5 bg-white/60 rounded-lg flex items-center justify-between group-hover:bg-white transition-colors">
                  <span className="text-sm font-medium">用户访谈报告汇总</span>
                  <span className="text-[10px] px-2 py-0.5 bg-surface-container-highest text-on-surface-variant rounded-full font-bold">待审核</span>
                </div>
                <div className="p-2.5 bg-white/60 rounded-lg flex items-center justify-between group-hover:bg-white transition-colors">
                  <span className="text-sm font-medium">跨部门资源协调会议</span>
                  <span className="text-[10px] px-2 py-0.5 bg-primary-fixed text-on-primary-fixed rounded-full font-bold">今天 14:00</span>
                </div>
              </div>
            </div>
          </div>

          {/* Member Card 2 */}
          <div className="bg-surface-container-low rounded-xl p-6 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img alt="Member Avatar" className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white shadow-sm" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIrzh3kq9-Hh49f0vaoW5UE6e0C51b5ZsVJeBXJoGzsKw2fb725S69WiGjY_oPkBva6wc-2hJTEqdnkLNAIOj2is-G2LMsDHOf53nkczEnAmK7kUzI527r0ATV9WfjZOyhfR1rUeKfIXTyj0wOoTimnIMpjMdXcrDx_p9vMEmCc49WTdp2rQcswVlG6uC4XsgKx8lKGrsiNjbRmNwbz8dfhNtl95NuS9PIygQkzpmyoDzf8LUg3B-HxabEGRAS7w40HieRhToLBw0" />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-secondary border-2 border-white rounded-full"></span>
                </div>
                <div>
                  <h3 className="text-lg font-black font-headline">张建华</h3>
                  <p className="text-xs text-on-surface-variant font-label tracking-wide uppercase">全栈开发工程师</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-black text-primary">88</span>
                <span className="text-[10px] text-on-surface-variant font-label uppercase">绩效评分</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-surface-container-lowest rounded-xl p-3 radar-grid flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5"></div>
                <svg className="w-24 h-24 transform -rotate-90 relative z-10" viewBox="0 0 100 100">
                  <polygon fill="none" points="50,10 85,35 75,80 25,80 15,35" stroke="#c0c7d4" strokeWidth="0.5"></polygon>
                  <polygon fill="rgba(0, 96, 169, 0.2)" points="50,15 80,45 70,75 40,85 10,40" stroke="#0060a9" strokeWidth="2"></polygon>
                </svg>
                <span className="absolute bottom-1 text-[8px] font-label text-on-surface-variant">核心能力模型</span>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">趋势</span>
                  <span className="text-error text-[10px] font-bold">-2%</span>
                </div>
                <div className="flex items-end justify-between h-12 px-1">
                  <div className="w-1.5 bg-primary rounded-full h-10"></div>
                  <div className="w-1.5 bg-primary rounded-full h-9"></div>
                  <div className="w-1.5 bg-primary rounded-full h-8"></div>
                  <div className="w-1.5 bg-surface-variant rounded-full h-7"></div>
                  <div className="w-1.5 bg-surface-variant rounded-full h-6"></div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-on-surface-variant uppercase flex items-center">
                <span className="material-symbols-outlined text-xs mr-1">task_alt</span>
                当前关键任务 (3)
              </h4>
              <div className="space-y-2">
                <div className="p-2.5 bg-white/60 rounded-lg flex items-center justify-between group-hover:bg-white transition-colors">
                  <span className="text-sm font-medium">后端 API 性能优化</span>
                  <span className="text-[10px] px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-full font-bold">已完成 80%</span>
                </div>
                <div className="p-2.5 bg-white/60 rounded-lg flex items-center justify-between group-hover:bg-white transition-colors">
                  <span className="text-sm font-medium">数据库迁移方案设计</span>
                  <span className="text-[10px] px-2 py-0.5 bg-error-container text-on-error-container rounded-full font-bold">高优先级</span>
                </div>
                <div className="p-2.5 bg-white/60 rounded-lg flex items-center justify-between group-hover:bg-white transition-colors">
                  <span className="text-sm font-medium">新员工入职技术培训</span>
                  <span className="text-[10px] px-2 py-0.5 bg-surface-container-highest text-on-surface-variant rounded-full font-bold">下周开始</span>
                </div>
              </div>
            </div>
          </div>

          {/* Member Card 3 */}
          <div className="bg-surface-container-low rounded-xl p-6 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img alt="Member Avatar" className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white shadow-sm" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC8NiGRp9CSkyxf45rs-wniV6v_gYye6WRV2e7olrXnMkM09jPnjqKTGg1G1Lx88tzKRDnkRi2JPwyiVx0rPFKcv_CWztNHk3KV6RpxpuseV0-dH6fH9WHAOsvLfT2P4hSOj0_bwqmhN6LhD3ubpRt_TulkzpoyWsNwy1e-5AEwspk8D7VS9nCXdI_9eL6n6Kh7a7eAAbzX7Go1smtSyFuyc5Yvog61bbp-Q0rJ93xPtdmthsvSFMX8d0mHKUfWThGKYQbbKxdE4ok" />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-outline-variant border-2 border-white rounded-full"></span>
                </div>
                <div>
                  <h3 className="text-lg font-black font-headline">陈思雨</h3>
                  <p className="text-xs text-on-surface-variant font-label tracking-wide uppercase">视觉设计主管</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-black text-primary">91</span>
                <span className="text-[10px] text-on-surface-variant font-label uppercase">绩效评分</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-surface-container-lowest rounded-xl p-3 radar-grid flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5"></div>
                <svg className="w-24 h-24 transform -rotate-90 relative z-10" viewBox="0 0 100 100">
                  <polygon fill="none" points="50,10 85,35 75,80 25,80 15,35" stroke="#c0c7d4" strokeWidth="0.5"></polygon>
                  <polygon fill="rgba(0, 96, 169, 0.2)" points="50,12 80,30 65,75 30,75 20,40" stroke="#0060a9" strokeWidth="2"></polygon>
                </svg>
                <span className="absolute bottom-1 text-[8px] font-label text-on-surface-variant">核心能力模型</span>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-3 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">趋势</span>
                  <span className="text-secondary text-[10px] font-bold">+5%</span>
                </div>
                <div className="flex items-end justify-between h-12 px-1">
                  <div className="w-1.5 bg-surface-variant rounded-full h-3"></div>
                  <div className="w-1.5 bg-primary rounded-full h-5"></div>
                  <div className="w-1.5 bg-primary rounded-full h-9"></div>
                  <div className="w-1.5 bg-primary rounded-full h-10"></div>
                  <div className="w-1.5 bg-primary rounded-full h-10"></div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-on-surface-variant uppercase flex items-center">
                <span className="material-symbols-outlined text-xs mr-1">task_alt</span>
                当前关键任务 (3)
              </h4>
              <div className="space-y-2">
                <div className="p-2.5 bg-white/60 rounded-lg flex items-center justify-between group-hover:bg-white transition-colors">
                  <span className="text-sm font-medium">设计系统 2.0 更新</span>
                  <span className="text-[10px] px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-full font-bold">进行中</span>
                </div>
                <div className="p-2.5 bg-white/60 rounded-lg flex items-center justify-between group-hover:bg-white transition-colors">
                  <span className="text-sm font-medium">品牌营销视觉规范</span>
                  <span className="text-[10px] px-2 py-0.5 bg-surface-container-highest text-on-surface-variant rounded-full font-bold">待讨论</span>
                </div>
                <div className="p-2.5 bg-white/60 rounded-lg flex items-center justify-between group-hover:bg-white transition-colors">
                  <span className="text-sm font-medium">移动端 UI 走查报告</span>
                  <span className="text-[10px] px-2 py-0.5 bg-primary-fixed text-on-primary-fixed rounded-full font-bold">已安排</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team Stats Summary Section (Bento Bottom) */}
        <section className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2 bg-gradient-to-r from-primary to-primary-container p-6 rounded-xl text-white shadow-xl shadow-primary/10 flex items-center justify-between relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-black mb-1">团队整体绩效趋势</h3>
              <p className="text-primary-fixed text-sm font-medium">过去 30 天内，团队产出效率提升了 8.4%</p>
              <div className="mt-4 flex space-x-2">
                <button className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs font-bold transition-all">查看详细报告</button>
              </div>
            </div>
            <div className="relative z-10 text-right">
              <div className="text-5xl font-black opacity-30">A+</div>
            </div>
            {/* Abstract Design Decor */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          </div>
          <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between">
            <div className="flex items-center space-x-2 text-on-surface-variant mb-2">
              <span className="material-symbols-outlined text-sm">schedule</span>
              <span className="text-xs font-bold uppercase font-label tracking-tight">进行中任务</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-primary">24</span>
              <span className="text-secondary text-xs font-bold flex items-center mb-1">
                <span className="material-symbols-outlined text-xs mr-1">trending_up</span>
                +4
              </span>
            </div>
          </div>
          <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between">
            <div className="flex items-center space-x-2 text-on-surface-variant mb-2">
              <span className="material-symbols-outlined text-sm">assignment_late</span>
              <span className="text-xs font-bold uppercase font-label tracking-tight">逾期风险</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-black text-error">2</span>
              <span className="text-on-surface-variant text-xs font-bold flex items-center mb-1">
                正常范围
              </span>
            </div>
          </div>
        </section>
        </div>
      </main>
    </div>
  );
}
