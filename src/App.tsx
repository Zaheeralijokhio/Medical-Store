/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { TopNavbar } from './components/layout/TopNavbar';
import { MobileBottomBar } from './components/layout/MobileBottomBar';
import { LoginPage } from './components/auth/LoginPage';

// View Components
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { StaffDashboard } from './components/dashboard/StaffDashboard';
import { POSScreen } from './components/pos/POSScreen';
import { MedicineList } from './components/inventory/MedicineList';
import { SalesHistory } from './components/sales/SalesHistory';
import { PurchaseList } from './components/purchases/PurchaseList';
import { SupplierList } from './components/suppliers/SupplierList';
import { CustomerList } from './components/customers/CustomerList';
import { ExpenseManagement } from './components/expenses/ExpenseManagement';
import { StockAdjustmentView } from './components/stock-adjustment/StockAdjustmentView';
import { ReportsAnalytics } from './components/reports/ReportsAnalytics';
import { StaffManagement } from './components/staff/StaffManagement';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { SystemSettingsView } from './components/settings/SystemSettingsView';

const MainAppContent: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // If user is not authenticated, show modern login portal
  if (!currentUser) {
    return <LoginPage onLoginSuccess={() => setCurrentTab('dashboard')} />;
  }

  // Role guard: if staff tries to visit admin-restricted pages, redirect to dashboard or pos
  const isRestrictedForStaff =
    !isAdmin &&
    ['purchases', 'suppliers', 'expenses', 'adjustments', 'reports', 'staff', 'settings'].includes(
      currentTab
    );

  const activeTab: NavTab = isRestrictedForStaff ? 'dashboard' : currentTab;

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return isAdmin ? (
          <AdminDashboard onNavigate={setCurrentTab} />
        ) : (
          <StaffDashboard onNavigate={setCurrentTab} />
        );
      case 'pos':
        return <POSScreen />;
      case 'inventory':
        return <MedicineList onNavigate={setCurrentTab} />;
      case 'sales':
        return <SalesHistory />;
      case 'purchases':
        return <PurchaseList />;
      case 'suppliers':
        return <SupplierList />;
      case 'customers':
        return <CustomerList />;
      case 'expenses':
        return <ExpenseManagement />;
      case 'adjustments':
        return <StockAdjustmentView />;
      case 'reports':
        return <ReportsAnalytics />;
      case 'staff':
        return <StaffManagement />;
      case 'notifications':
        return <NotificationCenter />;
      case 'settings':
        return <SystemSettingsView />;
      default:
        return <AdminDashboard onNavigate={setCurrentTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Dark Sidebar */}
      <Sidebar
        currentTab={activeTab}
        onSelectTab={setCurrentTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <TopNavbar
          currentTab={activeTab}
          onNavigate={setCurrentTab}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20 lg:pb-8">
          {renderActiveView()}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (<768px) */}
      <MobileBottomBar
        currentTab={activeTab}
        onSelectTab={setCurrentTab}
        onOpenMenu={() => setIsSidebarOpen(true)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <MainAppContent />
      </StoreProvider>
    </AuthProvider>
  );
}
