import { Routes, Route } from 'react-router-dom';
import AdminSidebar from './components/AdminSidebar';
import AdminHeader from './components/AdminHeader';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminDiagrams from './pages/AdminDiagrams';
import AdminWorkspaces from './pages/AdminWorkspaces';
import AdminPlans from './pages/AdminPlans';
import AdminFeatureFlags from './pages/AdminFeatureFlags';
import AdminBilling from './pages/AdminBilling';
import AdminSystem from './pages/AdminSystem';

export default function AdminApp() {
  return (
    <div className="admin-area flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="diagrams" element={<AdminDiagrams />} />
              <Route path="workspaces" element={<AdminWorkspaces />} />
              <Route path="plans" element={<AdminPlans />} />
              <Route path="feature-flags" element={<AdminFeatureFlags />} />
              <Route path="billing" element={<AdminBilling />} />
              <Route path="system" element={<AdminSystem />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
