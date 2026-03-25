import Sidebar from '../components/Sidebar';

export default function PanoramaDashboard({ navigate }: { navigate: (view: string) => void }) {
  return (
    <div className="bg-surface text-on-background min-h-screen flex">
      <Sidebar currentView="panorama" navigate={navigate} />

      {/* Main Content Canvas */}
      <main className="flex-1 mt-16 h-[calc(100vh-4rem)] relative overflow-y-auto">

        {/* Dashboard Content */}
        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Column 1: Company (Global Stats) */}
          <section className="space-y-6">
            <div className="flex items-end justify-between">
              <h2 className="text-2xl font-extrabold font-headline tracking-tight">企业全局视角</h2>
              <span className="text-xs font-label text-slate-500 px-2 py-1 bg-surface-container-high rounded-full">更新于 10:45 AM</span>
            </div>
            {/* Main Progress Card */}
            <div className="bg-surface-container-low p-6 rounded-xl relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-sm font-label text-on-surface-variant mb-1">年度业绩总达成率</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black font-headline text-primary italic">84.2%</span>
                  <span className="text-secondary text-sm font-bold flex items-center">
                    <span className="material-symbols-outlined text-sm">trending_up</span> +3.1%
                  </span>
                </div>
                <div className="mt-4 w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-primary-container" style={{ width: '84.2%' }}></div>
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-label text-slate-400">
                  <span>Q1: 100% (达成)</span>
                  <span>Q2: 100% (达成)</span>
                  <span>Q3: 进行中</span>
                </div>
              </div>
              {/* Decorative Abstract Gradient */}
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl"></div>
            </div>
            {/* Stats Bento */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/15">
                <p className="text-xs font-label text-slate-500 mb-2">营收目标 (CNY)</p>
                <p className="text-lg font-bold">12.8 亿</p>
                <p className="text-[10px] text-slate-400">目标: 15 亿</p>
              </div>
              <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/15">
                <p className="text-xs font-label text-slate-500 mb-2">核心人效比</p>
                <p className="text-lg font-bold text-secondary">1.42</p>
                <p className="text-[10px] text-slate-400">环比: +0.05</p>
              </div>
            </div>
            {/* YTD Trend Chart Placeholder */}
            <div className="bg-surface-container-low p-6 rounded-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold">YTD 绩效趋势图</h3>
                <span className="material-symbols-outlined text-slate-400 cursor-pointer">more_horiz</span>
              </div>
              <div className="h-48 flex items-end justify-between gap-2 px-2">
                <div className="flex-1 bg-primary/20 rounded-t-lg h-[60%] hover:bg-primary transition-colors"></div>
                <div className="flex-1 bg-primary/20 rounded-t-lg h-[65%] hover:bg-primary transition-colors"></div>
                <div className="flex-1 bg-primary/20 rounded-t-lg h-[75%] hover:bg-primary transition-colors"></div>
                <div className="flex-1 bg-primary/20 rounded-t-lg h-[80%] hover:bg-primary transition-colors"></div>
                <div className="flex-1 bg-primary/20 rounded-t-lg h-[85%] hover:bg-primary transition-colors"></div>
                <div className="flex-1 bg-primary/20 rounded-t-lg h-[92%] hover:bg-primary transition-colors"></div>
                <div className="flex-1 bg-primary/40 rounded-t-lg h-[70%] border-t-4 border-primary shadow-[0_-8px_16px_-4px_rgba(0,96,169,0.3)]"></div>
                <div className="flex-1 bg-slate-100 rounded-t-lg h-[10%]"></div>
                <div className="flex-1 bg-slate-100 rounded-t-lg h-[10%]"></div>
              </div>
              <div className="flex justify-between mt-4 text-[10px] font-label text-slate-400">
                <span>1月</span><span>3月</span><span>5月</span><span>7月</span><span>9月</span><span>12月</span>
              </div>
            </div>
          </section>

          {/* Column 2: Team (BU Progress) */}
          <section className="space-y-6">
            <div className="flex items-end justify-between">
              <h2 className="text-2xl font-extrabold font-headline tracking-tight">团队执行矩阵</h2>
              <div className="flex gap-2">
                <button className="p-1 hover:bg-surface-container rounded transition-colors"><span className="material-symbols-outlined text-sm">filter_alt</span></button>
                <button className="p-1 hover:bg-surface-container rounded transition-colors"><span className="material-symbols-outlined text-sm">sort</span></button>
              </div>
            </div>
            <div className="space-y-3">
              {/* Team Card: Strategic Sales */}
              <div className="bg-surface-container-low p-4 rounded-xl hover:bg-surface-bright transition-all group border border-transparent hover:border-outline-variant/20 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-sm">战略销售部 (South)</h4>
                    <p className="text-[10px] text-slate-500 font-label">Leader: 李宏伟 | 42 成员</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold">ON TRACK</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-secondary" style={{ width: '94%' }}></div>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-headline">94.0%</span>
                </div>
              </div>
              {/* Team Card: Product Dev */}
              <div className="bg-surface-container-low p-4 rounded-xl hover:bg-surface-bright transition-all group border border-transparent hover:border-outline-variant/20 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-sm">产品研发中心</h4>
                    <p className="text-[10px] text-slate-500 font-label">Leader: 张若曦 | 128 成员</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold">ON TRACK</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-secondary" style={{ width: '88%' }}></div>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-headline">88.2%</span>
                </div>
              </div>
              {/* Team Card: Customer Success */}
              <div className="bg-surface-container-low p-4 rounded-xl hover:bg-surface-bright transition-all group border border-transparent hover:border-outline-variant/20 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-sm">客户成功部</h4>
                    <p className="text-[10px] text-slate-500 font-label">Leader: 陈思颖 | 35 成员</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] font-bold">AT RISK</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-error" style={{ width: '62%' }}></div>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-headline text-error">62.5%</span>
                </div>
              </div>
              {/* Team Card: Marketing */}
              <div className="bg-surface-container-low p-4 rounded-xl hover:bg-surface-bright transition-all group border border-transparent hover:border-outline-variant/20 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-sm">市场整合营销部</h4>
                    <p className="text-[10px] text-slate-500 font-label">Leader: 王子涵 | 24 成员</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-slate-600 text-[10px] font-bold uppercase">Stable</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: '79%' }}></div>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-headline">79.1%</span>
                </div>
              </div>
              {/* Team Card: Supply Chain */}
              <div className="bg-surface-container-low p-4 rounded-xl hover:bg-surface-bright transition-all group border border-transparent hover:border-outline-variant/20 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-sm">全球供应链</h4>
                    <p className="text-[10px] text-slate-500 font-label">Leader: 赵明亮 | 56 成员</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold">ON TRACK</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-secondary" style={{ width: '91%' }}></div>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-headline">91.4%</span>
                </div>
              </div>
            </div>
            {/* Insights Block */}
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
                <div>
                  <p className="text-xs font-bold text-primary mb-1">AI 绩效洞察</p>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    过去两周，“客户成功部”的达成率放缓 12%。建议审查 Q3 关键客户流失风险，或增加二线技术支持投入。
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Column 3: Individual (Top Contributors & Support Needed) */}
          <section className="space-y-6">
            <div className="flex items-end justify-between">
              <h2 className="text-2xl font-extrabold font-headline tracking-tight">精英与待支榜</h2>
            </div>
            {/* Scrollable Container */}
            <div className="space-y-8 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 pb-8">
              {/* Top Performers Section */}
              <div>
                <div className="flex items-center gap-2 mb-4 text-xs font-bold text-secondary tracking-widest uppercase">
                  <span className="h-px flex-1 bg-secondary/20"></span>
                  <span>Top Contributors</span>
                  <span className="h-px flex-1 bg-secondary/20"></span>
                </div>
                <div className="space-y-4">
                  {/* Card: Performer 1 */}
                  <div className="flex items-center gap-4 bg-surface-container-lowest p-3 rounded-xl shadow-sm border border-outline-variant/10">
                    <div className="relative">
                      <img alt="Anna" className="w-12 h-12 rounded-full bg-slate-100 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAmxqdIbJ7AChSrbMWJT0AVkPiZtFoqi5SkaHDfrbDmtcDT4rI9cefdcotFSKzXFMtsU80v2bftKAjeVEeVTO5W0khJQQtSPJmcnc1LAdMy3mC7ver1rx5yfSfHI4VZbuSpePOM8URsVH5u2d6DGY-Dxr7pvuzCafn_VUxu3PgwXYDPVVJUItFkql9-7SHMzy4Vqcmk2hyNYK7IS3T02a3jw3I-O3QANUI5r1vviBYO_B52khkwma7wCC-1tuUV6UmY8fIPjNPmqwM" />
                      <div className="absolute -top-1 -right-1 bg-yellow-400 text-[8px] font-black p-0.5 rounded shadow-sm">MVP</div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">周子墨</p>
                      <p className="text-[10px] text-slate-500 font-label">战略销售部 · 华东区</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black font-headline text-secondary">114%</p>
                      <p className="text-[8px] text-slate-400 font-label">季度达成</p>
                    </div>
                  </div>
                  {/* Card: Performer 2 */}
                  <div className="flex items-center gap-4 bg-surface-container-lowest p-3 rounded-xl shadow-sm border border-outline-variant/10">
                    <img alt="Jack" className="w-12 h-12 rounded-full bg-slate-100 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCZWS9PRjAUsooXtoLf6foeuv2dOVQgWseUjd54IZydbMQAh0j9hLilkIaLJaQ8RQxS7jNucZMMdOwy7vGm52is5OYIo_PB8T5RUgZTASyaJMWXSv4TChAVj-ZNMTIF-BmCLilEjuLSW84czRtllHPrb4wbk1_U_iy33RukUXzIbFuYyZd5sOGeWcGIw7ZfQ24wOXSdQ5KL5-4AD01_FqTa6x25mXa3GuIg8q6I_zEmY5aAMsS4QlYD-jEJVoSdDpyIrnmZYefVsXY" />
                    <div className="flex-1">
                      <p className="text-sm font-bold">林先森</p>
                      <p className="text-[10px] text-slate-500 font-label">产品研发中心 · 架构组</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black font-headline text-secondary">108%</p>
                      <p className="text-[8px] text-slate-400 font-label">季度达成</p>
                    </div>
                  </div>
                  {/* Card: Performer 3 */}
                  <div className="flex items-center gap-4 bg-surface-container-lowest p-3 rounded-xl shadow-sm border border-outline-variant/10">
                    <img alt="Mimi" className="w-12 h-12 rounded-full bg-slate-100 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBtpEVRamm32yqYfzzCS5SL_ealtZcEx7DfSwksZjp37Z6ecv3lscnOmnkXMcn4YMEklQuufbxu2g85_0zy8k6LSewvpbxSo5xvEq6Obtvqw4S2OhxWg8n8JD7aVF2HJNySClRjXRPypwpIdBe6XaP4aDp-S_ZUC52VoOODlgjr5Nk3pBe145JZFqnNR68UjtNlBiuOuuwGxZAzrMeyanc02SIGcTT3K-bZl918iP8Qzwv7vLsPxp_DEVJhxKVw_lZIFcz4uFpR1zU" />
                    <div className="flex-1">
                      <p className="text-sm font-bold">苏曼妮</p>
                      <p className="text-[10px] text-slate-500 font-label">市场整合部 · 创意设计</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black font-headline text-secondary">102%</p>
                      <p className="text-[8px] text-slate-400 font-label">季度达成</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Needs Support Section */}
              <div>
                <div className="flex items-center gap-2 mb-4 text-xs font-bold text-error tracking-widest uppercase">
                  <span className="h-px flex-1 bg-error/20"></span>
                  <span>Needs Support</span>
                  <span className="h-px flex-1 bg-error/20"></span>
                </div>
                <div className="space-y-4">
                  {/* Card: Support 1 */}
                  <div className="flex items-center gap-4 bg-surface-container-low p-3 rounded-xl grayscale hover:grayscale-0 transition-all cursor-pointer">
                    <img alt="Kevin" className="w-12 h-12 rounded-full bg-slate-200 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCBLWHH2uPbm0WN2Fy_6gKTs2SQ5YUn6-V_n8mY5FiTmsX6bIsERe41V6h99l5xhxNwr1P-zsBH0MJOt27lFAWVCDe-2-gq1EKfgVBkLvXdLE6mr5_YCyqE7LdEjBdha_FnvRAvN0YTaa2P5Ih7ejARR1pzUTSaTCvOPiZAJtT7SyVz-Ex0AGywuMuZAifCJx2tH4pFGZRmUlSv_Rqa87mXuc4vzqh4nIJQ-CEUjbLqY1mBUHns9N4PMwvsxyYPumTqc47Pj_lM2W4" />
                    <div className="flex-1">
                      <p className="text-sm font-bold">陈志强</p>
                      <p className="text-[10px] text-slate-500 font-label">全球供应链 · 采购</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black font-headline text-error">45%</p>
                      <button className="text-[8px] px-1.5 py-0.5 bg-error text-white rounded hover:opacity-80 transition-opacity">发起辅导</button>
                    </div>
                  </div>
                  {/* Card: Support 2 */}
                  <div className="flex items-center gap-4 bg-surface-container-low p-3 rounded-xl grayscale hover:grayscale-0 transition-all cursor-pointer">
                    <img alt="Sara" className="w-12 h-12 rounded-full bg-slate-200 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAcUzVBW9OcjIdgb6gB5Vb2_lwZuZXTg17OU6BWobbOKij5J0iIiCR3iTcy9CJzdTYov0bd81fA6--2RIYlQ7Ho_tyx1krV5hh4s1ECZcKI92_ncKxSDPJeLUYYUCbunTDVyJlOG-Ja2ubtllCIjhWRXNrQc9SFSFxf_s4fyaIX5FuQZdb9MpubEXgdtiZunw_Pnax0hrbZQIDkkPjJH7nC-oHaiqyowO5jb_Ky4gss7hGvDWKhzx25LrSQwhuQhnmVUDF70LJ_amo" />
                    <div className="flex-1">
                      <p className="text-sm font-bold">李雨霏</p>
                      <p className="text-[10px] text-slate-500 font-label">客户成功部 · 华北区</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black font-headline text-error">52%</p>
                      <button className="text-[8px] px-1.5 py-0.5 bg-error text-white rounded hover:opacity-80 transition-opacity">发起辅导</button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Bottom CTA */}
              <div className="bg-gradient-to-br from-primary to-primary-container p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="font-bold text-lg mb-2">生成全员绩效报告</h4>
                  <p className="text-white/80 text-xs mb-4">通过深度学习分析当前的组织效能，并获取可执行的优化建议。</p>
                  <button className="px-4 py-2 bg-white text-primary font-bold rounded-xl text-xs flex items-center gap-2 active:scale-95 transition-transform">
                    <span className="material-symbols-outlined text-sm">auto_graph</span> 立即生成报告
                  </button>
                </div>
                <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-white/10 text-9xl">analytics</span>
              </div>
            </div>
          </section>
        </div>

        {/* --- New Injected Content: Department Performance Heatmap --- */}
        <div className="px-8 pb-8 mt-4 border-t border-outline-variant/20 pt-12">
          {/* Header */}
          <header className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">核心绩效进度：部门效能热力排行</h1>
            </div>
          </header>

          {/* View Selector Tabs */}
          <section className="flex justify-between items-end mb-8">
            <div className="flex bg-surface-container-low p-1.5 rounded-full">
              <button className="px-6 py-2 rounded-full text-sm font-semibold transition-all shadow-sm bg-white text-primary">分公司维度</button>
              <button className="px-6 py-2 rounded-full text-sm font-medium transition-all text-on-surface-variant hover:text-primary">团队维度</button>
              <button className="px-6 py-2 rounded-full text-sm font-medium transition-all text-on-surface-variant hover:text-primary">个人维度</button>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-secondary"></span>
                <span className="text-xs font-label text-on-surface-variant">优秀 (&gt;90%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary-container"></span>
                <span className="text-xs font-label text-on-surface-variant">正常 (60-90%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-error"></span>
                <span className="text-xs font-label text-on-surface-variant">预警 (&lt;60%)</span>
              </div>
            </div>
          </section>

          {/* Bento Heatmap Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Strategic Office */}
            <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-secondary flex flex-col justify-between h-48 hover:shadow-lg transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-secondary">rocket_launch</span>
                  <span className="text-xs font-label py-1 px-3 bg-secondary-container text-on-secondary-container rounded-full">优秀</span>
                </div>
                <h3 className="text-lg font-bold">战略办</h3>
                <p className="text-sm text-on-surface-variant mt-1">Strategic Office</p>
              </div>
              <div className="text-3xl font-black text-secondary">94.2%</div>
            </div>
            {/* Core Cloud */}
            <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-primary-container flex flex-col justify-between h-48 hover:shadow-lg transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-primary">cloud</span>
                  <span className="text-xs font-label py-1 px-3 bg-primary-fixed text-on-primary-fixed-variant rounded-full">正常</span>
                </div>
                <h3 className="text-lg font-bold">核心云</h3>
                <p className="text-sm text-on-surface-variant mt-1">Core Cloud BU</p>
              </div>
              <div className="text-3xl font-black text-primary">82.5%</div>
            </div>
            {/* Innovation Research */}
            <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-secondary flex flex-col justify-between h-48 hover:shadow-lg transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-secondary">psychology</span>
                  <span className="text-xs font-label py-1 px-3 bg-secondary-container text-on-secondary-container rounded-full">优秀</span>
                </div>
                <h3 className="text-lg font-bold">创新研究院</h3>
                <p className="text-sm text-on-surface-variant mt-1">Innovation R&amp;D</p>
              </div>
              <div className="text-3xl font-black text-secondary">91.8%</div>
            </div>
            {/* Global Expansion */}
            <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-error flex flex-col justify-between h-48 hover:shadow-lg transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-error">public</span>
                  <span className="text-xs font-label py-1 px-3 bg-error-container text-on-error-container rounded-full">预警</span>
                </div>
                <h3 className="text-lg font-bold">海外拓展</h3>
                <p className="text-sm text-on-surface-variant mt-1">Global Market</p>
              </div>
              <div className="text-3xl font-black text-error">58.4%</div>
            </div>
            {/* Finance */}
            <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-primary-container flex flex-col justify-between h-48 hover:shadow-lg transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
                  <span className="text-xs font-label py-1 px-3 bg-primary-fixed text-on-primary-fixed-variant rounded-full">正常</span>
                </div>
                <h3 className="text-lg font-bold">财务结算</h3>
                <p className="text-sm text-on-surface-variant mt-1">Finance &amp; Settlements</p>
              </div>
              <div className="text-3xl font-black text-primary">76.0%</div>
            </div>
            {/* Compliance */}
            <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-primary-container flex flex-col justify-between h-48 hover:shadow-lg transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-primary">verified_user</span>
                  <span className="text-xs font-label py-1 px-3 bg-primary-fixed text-on-primary-fixed-variant rounded-full">正常</span>
                </div>
                <h3 className="text-lg font-bold">风险合规</h3>
                <p className="text-sm text-on-surface-variant mt-1">Risk &amp; Compliance</p>
              </div>
              <div className="text-3xl font-black text-primary">88.2%</div>
            </div>
            {/* Marketing */}
            <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-secondary flex flex-col justify-between h-48 hover:shadow-lg transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-secondary">campaign</span>
                  <span className="text-xs font-label py-1 px-3 bg-secondary-container text-on-secondary-container rounded-full">优秀</span>
                </div>
                <h3 className="text-lg font-bold">品牌营销</h3>
                <p className="text-sm text-on-surface-variant mt-1">Brand Marketing</p>
              </div>
              <div className="text-3xl font-black text-secondary">96.5%</div>
            </div>
            {/* Data Security */}
            <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-error flex flex-col justify-between h-48 hover:shadow-lg transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-error">security</span>
                  <span className="text-xs font-label py-1 px-3 bg-error-container text-on-error-container rounded-full">预警</span>
                </div>
                <h3 className="text-lg font-bold">数据安全</h3>
                <p className="text-sm text-on-surface-variant mt-1">Data Security</p>
              </div>
              <div className="text-3xl font-black text-error">52.1%</div>
            </div>
          </section>

          {/* Dynamic Insights & Charts Section */}
          <section className="mt-8 grid grid-cols-3 gap-8">
            <div className="col-span-2 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">月度效能趋势</h3>
                <div className="flex gap-2">
                  <span className="text-xs font-label bg-secondary-container/30 px-2 py-1 rounded text-secondary">环比增长 +4.2%</span>
                </div>
              </div>
              <div className="h-64 flex items-end gap-4 px-2">
                <div className="flex-1 flex flex-col gap-2 items-center group">
                  <div className="w-full bg-surface-container-low rounded-t-lg transition-all h-24 group-hover:bg-primary-container"></div>
                  <span className="text-xs font-label text-on-surface-variant">Q1</span>
                </div>
                <div className="flex-1 flex flex-col gap-2 items-center group">
                  <div className="w-full bg-surface-container-low rounded-t-lg transition-all h-32 group-hover:bg-primary-container"></div>
                  <span className="text-xs font-label text-on-surface-variant">Q2</span>
                </div>
                <div className="flex-1 flex flex-col gap-2 items-center group">
                  <div className="w-full bg-surface-container-low rounded-t-lg transition-all h-40 group-hover:bg-primary-container"></div>
                  <span className="text-xs font-label text-on-surface-variant">Q3</span>
                </div>
                <div className="flex-1 flex flex-col gap-2 items-center group">
                  <div className="w-full bg-gradient-to-br from-primary to-primary-container rounded-t-lg h-56"></div>
                  <span className="text-xs font-label text-primary font-bold">Q4 (Current)</span>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
              <h3 className="text-xl font-bold mb-6">效能异常通知</h3>
              <div className="space-y-4">
                <div className="flex gap-4 p-4 rounded-xl bg-error-container/20">
                  <div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-error">warning</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">海外拓展进度受阻</p>
                    <p className="text-xs text-on-surface-variant mt-1">Q4项目节点延迟，建议开启人力增援计划。</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 rounded-xl bg-secondary-container/20">
                  <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-secondary">stars</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">品牌营销超预期</p>
                    <p className="text-xs text-on-surface-variant mt-1">效能指数突破历史峰值，年度奖金池已激活。</p>
                  </div>
                </div>
                <button className="w-full py-2 border border-outline-variant/30 rounded-lg text-sm font-medium hover:bg-surface-container-low transition-colors">
                  查看全部 12 条动态
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
