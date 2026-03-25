import { useState } from 'react';
import EmployeeDashboard from './pages/EmployeeDashboard';
import PersonalGoals from './pages/PersonalGoals';
import TeamPerformance from './pages/TeamPerformance';
import CompanyPerformance from './pages/CompanyPerformance';
import HRMap from './pages/HRMap';
import PanoramaDashboard from './pages/PanoramaDashboard';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  const navigate = (view: string) => {
    setCurrentView(view);
  };

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
