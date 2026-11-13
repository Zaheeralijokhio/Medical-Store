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
import { ErrorBoundary } from './components/common/ErrorBoundary';

const MainAppContent: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // If user is not authenticated, show modern login portal
  if (!currentUser) {
    return <LoginPage onLoginSuccess={() => setCurrentTab('dashboard')} />;
  }

  // Role & Permission guard: allow access based on Owner-assigned permissions
  const perms = currentUser?.permissions;
  const canManagePurchases = isAdmin || currentUser?.role === 'pharmacist' || Boolean(perms?.canManagePurchases);
  const canAdjustStock = isAdmin || currentUser?.role === 'pharmacist' || Boolean(perms?.canAdjustStock);
  const canViewReports = isAdmin || Boolean(perms?.canViewReports);

  const isRestrictedForStaff =
    !isAdmin &&
    (((currentTab === 'purchases' || currentTab === 'suppliers') && !canManagePurchases) ||
      (currentTab === 'adjustments' && !canAdjustStock) ||
      ((currentTab === 'reports' || currentTab === 'expenses') && !canViewReports) ||
      currentTab === 'staff' ||
      currentTab === 'settings');

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
        return isAdmin ? (
          <AdminDashboard onNavigate={setCurrentTab} />
        ) : (
          <StaffDashboard onNavigate={setCurrentTab} />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F6F8] flex overflow-x-hidden">
      {/* Botanical Obsidian Sidebar */}
      <Sidebar
        currentTab={activeTab}
        onSelectTab={setCurrentTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[264px] flex flex-col min-w-0">
        <TopNavbar
          currentTab={activeTab}
          onNavigate={setCurrentTab}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />

        <main
          className={`flex-1 px-3.5 py-4 sm:p-6 lg:p-7 max-w-[1400px] w-full mx-auto ${
            activeTab === 'pos' ? 'pb-36 lg:pb-8' : 'pb-24 lg:pb-8'
          }`}
        >
          <ErrorBoundary>
            {renderActiveView()}
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (<1024px) */}
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
    <ErrorBoundary>
      <AuthProvider>
        <StoreProvider>
          <MainAppContent />
        </StoreProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
