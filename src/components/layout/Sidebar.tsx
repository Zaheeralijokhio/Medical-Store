/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  Receipt,
  Truck,
  Building2,
  Users,
  UserCheck,
  WalletCards,
  SlidersHorizontal,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';

export type NavTab =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'sales'
  | 'purchases'
  | 'suppliers'
  | 'customers'
  | 'staff'
  | 'expenses'
  | 'adjustments'
  | 'reports'
  | 'notifications'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const { currentUser, isAdmin, logout } = useAuth();
  const { settings, notifications, medicines } = useStore();

  const unreadNotifs = (notifications || []).filter(n => n && !n.read).length;
  const lowStockCount = (medicines || []).filter(m => m && Number(m.totalQuantity || 0) <= Number(m.minStockLevel ?? 15)).length;

  const perms = currentUser?.permissions;
  const canManagePurchases = isAdmin || currentUser?.role === 'pharmacist' || Boolean(perms?.canManagePurchases);
  const canAdjustStock = isAdmin || currentUser?.role === 'pharmacist' || Boolean(perms?.canAdjustStock);
  const canViewReports = isAdmin || Boolean(perms?.canViewReports);
  const canMakeSales = isAdmin || perms?.canMakeSales !== false;
  const canViewInventory = isAdmin || perms?.canViewInventory !== false;
  const canAddCustomer = isAdmin || perms?.canAddCustomer !== false;

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    {
      id: 'dashboard',
      label: isAdmin ? 'Owner Overview' : 'Staff Shift Overview',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    ...(canMakeSales
      ? [
          {
            id: 'pos' as NavTab,
            label: 'POS Terminal (Sales)',
            icon: <ShoppingCart className="w-5 h-5" />,
            badgeColor: 'bg-emerald-500',
          },
        ]
      : []),
    ...(canViewInventory
      ? [
          {
            id: 'inventory' as NavTab,
            label: 'Medicine Inventory',
            icon: <Pill className="w-5 h-5" />,
            badge: lowStockCount > 0 ? lowStockCount : undefined,
            badgeColor: 'bg-amber-500',
          },
        ]
      : []),
    ...(canMakeSales
      ? [{ id: 'sales' as NavTab, label: 'Sales & Invoices', icon: <Receipt className="w-5 h-5" /> }]
      : []),
    ...(canManagePurchases
      ? [
          { id: 'purchases' as NavTab, label: 'Purchases & Stock In', icon: <Truck className="w-5 h-5" /> },
          { id: 'suppliers' as NavTab, label: 'Suppliers Directory', icon: <Building2 className="w-5 h-5" /> },
        ]
      : []),
    ...(canAddCustomer
      ? [{ id: 'customers' as NavTab, label: 'Customer Directory', icon: <Users className="w-5 h-5" /> }]
      : []),
    ...(canViewReports
      ? [{ id: 'expenses' as NavTab, label: 'Expense Tracker', icon: <WalletCards className="w-5 h-5" /> }]
      : []),
    ...(canAdjustStock
      ? [{ id: 'adjustments' as NavTab, label: 'Stock Audit / Adjust', icon: <SlidersHorizontal className="w-5 h-5" /> }]
      : []),
    ...(canViewReports
      ? [{ id: 'reports' as NavTab, label: 'Reports & P&L', icon: <BarChart3 className="w-5 h-5" /> }]
      : []),
    ...(isAdmin
      ? [{ id: 'staff' as NavTab, label: 'Staff Accounts', icon: <UserCheck className="w-5 h-5" /> }]
      : []),
    {
      id: 'notifications',
      label: 'Alerts & Expiry',
      icon: <Bell className="w-5 h-5" />,
      badge: unreadNotifs > 0 ? unreadNotifs : undefined,
      badgeColor: 'bg-rose-500',
    },
    ...(isAdmin
      ? [{ id: 'settings' as NavTab, label: 'Store Settings', icon: <Settings className="w-5 h-5" /> }]
      : []),
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } border-r border-slate-800 shadow-xl`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-teal-500/20 font-bold text-lg">
              <Pill className="w-6 h-6 transform -rotate-12" />
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-base text-white tracking-tight truncate leading-tight">
                {String(settings?.storeName || 'PharmaCare').split(' ')[0]} <span className="text-teal-400">Pro</span>
              </h1>
              <p className="text-xs text-slate-400 truncate">Pharmacy Management</p>
            </div>
          </div>
        </div>

        {/* User Role Badge Card */}
        <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-800/60 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
            isAdmin ? 'bg-indigo-600 text-white' : 'bg-teal-600 text-white'
          }`}>
            {(currentUser?.fullName || currentUser?.username || 'U').charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-100 truncate block">
                {currentUser?.fullName || currentUser?.username || 'Store User'}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <ShieldCheck className="w-3 h-3" /> Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  <UserIcon className="w-3 h-3" /> Staff Dispenser
                </span>
              )}
              <span className="text-[10px] text-slate-400 truncate">({settings.currency})</span>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {isAdmin ? 'Management Portal' : 'Sales & Dispensing'}
          </div>

          {navItems.map(item => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm shadow-teal-700/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-xs font-bold text-white ${
                      item.badgeColor || 'bg-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 space-y-2">
          <div className="px-2 py-1.5 bg-slate-800/70 rounded-md text-[11px] text-slate-400 flex items-center justify-between">
            <span>Location: Karachi, PK</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
            </span>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};
