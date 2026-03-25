import Sidebar from '../components/Sidebar';

export default function EmployeeDashboard({ navigate }: { navigate: (view: string) => void }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface antialiased">
      <Sidebar currentView="dashboard" navigate={navigate} />

      {/* Main Canvas */}
      <main className="flex-1 h-[calc(100vh-4rem)] mt-16 overflow-y-auto">

        {/* Content Area */}
        <div className="p-8 space-y-8">
          {/* Welcome Header & Quick Actions */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-4xl font-extrabold text-on-surface tracking-tight mb-2">欢迎回来, 张伟</h2>
              <p className="text-on-surface-variant max-w-lg">今天是 2024年5月22日 星期三。您本周已完成 85% 的既定任务，继续保持！</p>
            </div>
            <div className="flex items-center space-x-3">
              <button className="flex items-center px-6 py-3 bg-surface-container-highest text-on-primary-container font-bold rounded-xl hover:bg-surface-dim transition-colors active:scale-95">
                <span className="material-symbols-outlined mr-2 text-[20px]">payments</span>
                查看薪资单
              </button>
              <button className="flex items-center px-6 py-3 bg-gradient-to-br from-[#0060a9] to-[#409eff] text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all active:scale-95">
                <span className="material-symbols-outlined mr-2 text-[20px]">event_available</span>
                申请休假
              </button>
            </div>
          </div>

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Column 1: Performance & Goals */}
            <div className="lg:col-span-4 space-y-8">
              {/* Performance Metrics */}
              <section className="bg-surface-container-low rounded-xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[100px]">military_tech</span>
                </div>
                <h3 className="label-font text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-6 flex items-center">
                  <span className="material-symbols-outlined mr-2 text-sm">insights</span>
                  绩效指标
                </h3>
                <div className="flex items-baseline space-x-1 mb-2">
                  <span className="text-5xl font-black text-primary">4.8</span>
                  <span className="text-xl text-on-surface-variant">/ 5.0</span>
                </div>
                <div className="inline-flex items-center px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold mb-6">
                  <span className="material-symbols-outlined text-[14px] mr-1">trending_up</span>
                  本季度表现优异
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-lg">
                  <p className="text-sm text-on-surface leading-relaxed">
                    "张伟在项目交付和跨部门协作方面展现了卓越的能力。建议继续关注新入职成员的导师计划。"
                  </p>
                  <p className="text-[11px] text-outline mt-3 flex items-center">
                    <span className="material-symbols-outlined text-[12px] mr-1">person</span>
                    反馈人: 李芳 (部门总监)
                  </p>
                </div>
              </section>

              {/* Personal Goals Management */}
              <section className="bg-surface-container-low rounded-xl p-6">
                <h3 className="label-font text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-6 flex items-center justify-between">
                  <span className="flex items-center">
                    <span className="material-symbols-outlined mr-2 text-sm">track_changes</span>
                    个人目标管理
                  </span>
                  <span className="text-primary cursor-pointer hover:underline text-[11px] normal-case tracking-normal">管理所有</span>
                </h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold">Q2 项目上线率</span>
                      <span className="text-primary font-bold">92%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-primary-container" style={{ width: '92%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold">团队技能内训</span>
                      <span className="text-primary font-bold">60%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-primary-container" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold">客户满意度提升</span>
                      <span className="text-primary font-bold">45%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full bg-primary-container" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Column 2: Pending Tasks */}
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-surface-container-low rounded-xl p-6 flex flex-col h-full">
                <h3 className="label-font text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-6 flex items-center">
                  <span className="material-symbols-outlined mr-2 text-sm">checklist</span>
                  待办事项
                </h3>
                <div className="space-y-4 flex-1">
                  <div className="group bg-surface-container-lowest p-4 rounded-xl flex items-start space-x-4 border-l-4 border-error hover:shadow-md transition-shadow">
                    <input className="mt-1 rounded border-outline-variant text-primary focus:ring-primary h-5 w-5" type="checkbox" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm">完成 Q2 绩效自评</p>
                        <span className="text-[10px] px-2 py-0.5 bg-error-container text-on-error-container rounded-full font-bold">紧急</span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1">截止日期: 今天 18:00</p>
                    </div>
                  </div>
                  <div className="group bg-surface-container-lowest p-4 rounded-xl flex items-start space-x-4 border-l-4 border-primary transition-shadow">
                    <input className="mt-1 rounded border-outline-variant text-primary focus:ring-primary h-5 w-5" type="checkbox" />
                    <div className="flex-1">
                      <p className="font-bold text-sm">提交差旅报销申请</p>
                      <p className="text-xs text-on-surface-variant mt-1">截止日期: 5月25日</p>
                    </div>
                  </div>
                  <div className="group bg-surface-container-lowest p-4 rounded-xl flex items-start space-x-4 border-l-4 border-tertiary transition-shadow">
                    <input className="mt-1 rounded border-outline-variant text-primary focus:ring-primary h-5 w-5" type="checkbox" />
                    <div className="flex-1">
                      <p className="font-bold text-sm">参加安全生产在线培训</p>
                      <p className="text-xs text-on-surface-variant mt-1">需完成 45 分钟课程</p>
                    </div>
                  </div>
                  <div className="group bg-surface-container-lowest p-4 rounded-xl flex items-start space-x-4 border-l-4 border-primary transition-shadow">
                    <input className="mt-1 rounded border-outline-variant text-primary focus:ring-primary h-5 w-5" type="checkbox" />
                    <div className="flex-1">
                      <p className="font-bold text-sm">准备下周一早会汇报</p>
                      <p className="text-xs text-on-surface-variant mt-1">重点: 云平台迁移进度</p>
                    </div>
                  </div>
                </div>
                <button className="w-full mt-6 py-3 border border-dashed border-outline-variant rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors">
                  + 添加新任务
                </button>
              </section>
            </div>

            {/* Column 3: Team Communications */}
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-surface-container-low rounded-xl p-6 h-full">
                <h3 className="label-font text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-6 flex items-center">
                  <span className="material-symbols-outlined mr-2 text-sm">forum</span>
                  团队动态
                </h3>
                <div className="relative space-y-8 before:content-[''] before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant/30">
                  <div className="relative pl-10">
                    <div className="absolute left-0 top-1 w-9 h-9 bg-primary-container rounded-full border-4 border-surface-container-low flex items-center justify-center text-white z-10">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary mb-1">系统公告</p>
                      <p className="text-sm font-bold text-on-surface">公司年会活动报名已开始</p>
                      <p className="text-xs text-on-surface-variant mt-2 leading-relaxed bg-surface-container-lowest p-3 rounded-xl">
                        各位同事，本年度公司年会将于下月15日举行，请在周五前提交报名...
                      </p>
                      <p className="text-[10px] text-outline mt-2">10 分钟前</p>
                    </div>
                  </div>
                  <div className="relative pl-10">
                    <div className="absolute left-0 top-1 w-9 h-9 bg-secondary rounded-full border-4 border-surface-container-low flex items-center justify-center text-white z-10">
                      <span className="material-symbols-outlined text-sm">group_add</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-secondary mb-1">团队入职</p>
                      <p className="text-sm font-bold text-on-surface">欢迎新成员：赵敏 (交互设计师)</p>
                      <div className="flex items-center mt-3 space-x-2">
                        <img className="w-6 h-6 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCooiLc3rFXYwKekscVUu_XlKH6nWBpf4SE8s0cHJd0t2sNtT_0OMgdkg3X_hz8DgocQoXkVRDQFDTS4MbPtni3W8BDTm0sJ4UPopY9Uqr8ubQhGkSyOlxQymDXclfl07loCFr8ytL5Zrshs5OrwdrTwTT3Znqem_WEr7VzqAlPMeRlRlvvY0hMnZA1chC-WedlwGzL_Ba-RNKIoc5dOKJccjJ5jC-j8mrB6Jvk84ou8VVrDq72a3f_X8WEi33SFvOZjJmtd6Pz2vM" alt="Avatar" />
                        <span className="text-xs text-on-surface-variant">敏敏加入到了 <b>UX 设计组</b></span>
                      </div>
                      <p className="text-[10px] text-outline mt-2">2 小时前</p>
                    </div>
                  </div>
                  <div className="relative pl-10">
                    <div className="absolute left-0 top-1 w-9 h-9 bg-tertiary-container rounded-full border-4 border-surface-container-low flex items-center justify-center text-white z-10">
                      <span className="material-symbols-outlined text-sm">update</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-tertiary mb-1">进度更新</p>
                      <p className="text-sm font-bold text-on-surface">Azure Horizon 3.0 开发里程碑已达成</p>
                      <p className="text-[10px] text-outline mt-2">昨天 16:45</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Contextual FAB */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-[#0060a9] to-[#409eff] text-white rounded-full shadow-2xl flex items-center justify-center group active:scale-90 transition-all z-50">
        <span className="material-symbols-outlined text-[28px]">chat_bubble</span>
        <span className="absolute right-16 bg-on-surface text-surface text-xs font-bold py-2 px-4 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          联系 HR 助手
        </span>
      </button>
    </div>
  );
}
