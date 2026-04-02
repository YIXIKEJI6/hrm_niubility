import React, { useState, Suspense, lazy } from 'react';
import { useIsMobile } from './hooks/useIsMobile';

const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));
const PersonalGoals = lazy(() => import('./pages/PersonalGoals'));
const TeamPerformance = lazy(() => import('./pages/TeamPerformance'));
const CompanyPerformance = lazy(() => import('./pages/CompanyPerformance'));
const HRMap = lazy(() => import('./pages/HRMap'));
const PanoramaDashboard = lazy(() => import('./pages/PanoramaDashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const OrgChart = lazy(() => import('./pages/OrgChart'));
const MyWorkflows = lazy(() => import('./pages/MyWorkflows'));
const PerformanceManager = lazy(() => import('./pages/PerformanceManager'));
const PerfAnalyticsPage = lazy(() => import('./pages/PerfAnalyticsPage'));
const PerfAccountingPage = lazy(() => import('./pages/PerfAccountingPage'));
const CompetencyManager = lazy(() => import('./pages/CompetencyManager'));
const TestBankManager = lazy(() => import('./pages/TestBankManager'));
const MonthlyEvaluationPage = lazy(() => import('./pages/MonthlyEvaluationPage'));

import DevRoleSwitcher from './components/DevRoleSwitcher';
import Watermark from './components/Watermark';
import FloatingAiChat from './components/FloatingAiChat';
import GlobalToast from './components/GlobalToast';
import GlobalPageSkeleton from './components/GlobalPageSkeleton';
import { useAuth } from './context/AuthContext';

export default function App() {
  const [currentView, setCurrentView] = useState(() => localStorage.getItem('hrm_current_view') || 'company');
  const { isAuthenticating, currentUser } = useAuth();
  const isMobile = useIsMobile();
  const isDev = (import.meta as any).env?.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isTestServer = window.location.port === '4001';
  const showDevTools = isDev || isTestServer;

  const navigate = (view: string) => {
    setCurrentView(view);
    localStorage.setItem('hrm_current_view', view);
  };

  // 正在认证中（AuthContext 在测试环境会自动 Mock 登录）
  if (isAuthenticating) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">
            {showDevTools ? '正在自动进入测试环境...' : '正在通过企业微信安全登录...'}
          </p>
        </div>
      </div>
    );
  }

  // 若无用户身份
  if (!currentUser) {
    // 测试/开发环境：AuthContext 应该已经自动登录了，如果到这里说明登录失败
    if (showDevTools) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-50 flex-col">
          <div className="w-16 h-16 bg-amber-100 rounded-3xl mb-6 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-600 text-3xl">warning</span>
          </div>
          <h2 className="text-lg font-black text-slate-800 mb-2">自动登录失败</h2>
          <p className="text-slate-400 text-xs mb-8">请确认后端服务 (3001端口) 已启动</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-95"
          >
            重新尝试
          </button>
        </div>
      );
    }

    // 正式生产环境：跳转企微扫码
    const isWecom = navigator.userAgent.toLowerCase().includes('wxwork');
    if (!isWecom) {
      setTimeout(() => {
        if (!localStorage.getItem('token')) {
          window.location.href = '/api/auth/wecom-qr-url';
        }
      }, 1500);
    }
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-surface">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-on-surface-variant font-bold mt-4">正在跳转扫码登录...</p>
        </div>
        <p className="text-on-surface-variant text-sm mb-6">请在企业微信客户端内打开，或浏览器刷新弹出登陆二维码。</p>
      </div>
    );
  }


  const renderView = () => {
    if (currentView.startsWith('competency')) {
      let tid: number | undefined;
      let tab: string | undefined;
      if (currentView.includes('testId=')) tid = Number(currentView.split('testId=')[1].split('&')[0]);
      if (currentView.includes('tab=')) tab = currentView.split('tab=')[1].split('&')[0];
      return <CompetencyManager navigate={navigate} initialTestId={tid} initialTab={tab as any} />;
    }

    if (currentView.startsWith('workflows')) {
      let tab: string | undefined;
      if (currentView.includes('tab=')) tab = currentView.split('tab=')[1].split('&')[0];
      return <MyWorkflows navigate={navigate} initialTab={tab as any} />;
    }

    if (currentView.startsWith('admin')) {
      let mod: string | undefined;
      if (currentView.includes('module=')) mod = currentView.split('module=')[1].split('&')[0];
      return <AdminPanel navigate={navigate} initialModule={mod} />;
    }

    switch (currentView) {
      case 'dashboard':
        return <EmployeeDashboard navigate={navigate} />;
      case 'personal':
        return <PersonalGoals navigate={navigate} />;
      case 'team':
        return <TeamPerformance navigate={navigate} />;
      case 'company':
        return <CompanyPerformance navigate={navigate} />;
      case 'hrmap':
        return <HRMap navigate={navigate} />;
      case 'panorama':
        return <PanoramaDashboard navigate={navigate} />;
      case 'org':
        return <OrgChart navigate={navigate} />;

      case 'perf-manage':
        return <PerformanceManager navigate={navigate} />;
      case 'perf-analytics':
        return <PerfAnalyticsPage navigate={navigate} />;
      case 'perf-accounting':
        return <PerfAccountingPage navigate={navigate} />;
      case 'test-bank':
        return <TestBankManager navigate={navigate} />;
      case 'monthly-eval':
        return <MonthlyEvaluationPage navigate={navigate} />;
      default:
        return <EmployeeDashboard navigate={navigate} />;
    }
  };

  return (
    <>
      <div key={currentView} className={isMobile ? 'mobile-page-enter' : ''}>
        <Suspense fallback={<GlobalPageSkeleton />}>
          {renderView()}
        </Suspense>
      </div>
      <Watermark text={currentUser.name} />
      <FloatingAiChat />
      <GlobalToast />
      <DevRoleSwitcher />
    </>
  );
}
