import { useState, useEffect } from 'react';
import EmployeeDashboard from './pages/EmployeeDashboard';
import PersonalGoals from './pages/PersonalGoals';
import TeamPerformance from './pages/TeamPerformance';
import CompanyPerformance from './pages/CompanyPerformance';
import HRMap from './pages/HRMap';
import PanoramaDashboard from './pages/PanoramaDashboard';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    // 企微环境检测
    const isWecom = navigator.userAgent.toLowerCase().includes('wxwork');
    const token = localStorage.getItem('token');
    
    if (isWecom && !token) {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        // 用 code 去后端换取 token
        fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        })
        .then(res => res.json())
        .then(data => {
          if (data.code === 0 && data.data?.token) {
            localStorage.setItem('token', data.data.token);
            // 清理 URL 上的 code，避免刷新重复使用
            window.history.replaceState({}, document.title, window.location.pathname);
            setIsAuthenticating(false);
          } else {
            console.error('企微登录失败:', data.message);
            setIsAuthenticating(false);
          }
        })
        .catch(err => {
          console.error('企微认证请求错误:', err);
          setIsAuthenticating(false);
        });
      } else {
        // 无 token 无 code，去后端拿构造好的企微 OAuth 授权链接
        window.location.href = '/api/auth/wecom-url';
      }
    } else {
      // 非企微环境，或已有 token
      setIsAuthenticating(false);
    }
  }, []);

  const navigate = (view: string) => {
    setCurrentView(view);
  };

  if (isAuthenticating) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-on-surface-variant font-bold mt-4">正在通过企业微信安全登录...</p>
        </div>
      </div>
    );
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
    case 'admin':
      return <AdminPanel navigate={navigate} />;
    default:
      return <EmployeeDashboard navigate={navigate} />;
  }
}
