/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronDown,
  Boxes,
  BadgeDollarSign,
  Cog,
  X,
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

interface NavChild {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeTone?: 'amber' | 'rose' | 'emerald';
}

interface NavDropdownGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeTone?: 'amber' | 'rose' | 'emerald';
  items: NavChild[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const { currentUser, isAdmin, isOwner, logout } = useAuth();
  const { settings, notifications, medicines } = useStore();

  const visibleNotifs = isAdmin
    ? notifications || []
    : (notifications || []).filter(
        n =>
          n &&
          n.type !== 'staff_activity' &&
          n.type !== 'payment_due' &&
          !String(n.message || '').includes('Owner')
      );
  const unreadNotifs = visibleNotifs.filter(n => n && !n.read).length;
  const lowStockCount = (medicines || []).filter(
    m => m && Number(m.totalQuantity || 0) <= Number(m.minStockLevel ?? 15)
  ).length;

  const perms = currentUser?.permissions;
  const canManagePurchases =
    isAdmin || currentUser?.role === 'pharmacist' || Boolean(perms?.canManagePurchases);
  const canAdjustStock =
    isAdmin || currentUser?.role === 'pharmacist' || Boolean(perms?.canAdjustStock);
  const canViewReports = isAdmin || Boolean(perms?.canViewReports);
  const canMakeSales = isAdmin || perms?.canMakeSales !== false;
  const canViewInventory = isAdmin || perms?.canViewInventory !== false;
  const canAddCustomer = isAdmin || perms?.canAddCustomer !== false;

  const dropdownGroups: NavDropdownGroup[] = useMemo(() => {
    const groups: NavDropdownGroup[] = [];

    const inventoryItems: NavChild[] = [
      ...(canViewInventory
        ? [
            {
              id: 'inventory' as NavTab,
              label: 'Medicine Catalog',
              icon: <Pill className="w-4 h-4" />,
              badge: lowStockCount > 0 ? lowStockCount : undefined,
              badgeTone: 'amber' as const,
            },
          ]
        : []),
      ...(canAdjustStock
        ? [
            {
              id: 'adjustments' as NavTab,
              label: 'Stock Audit & Adjust',
              icon: <SlidersHorizontal className="w-4 h-4" />,
            },
          ]
        : []),
    ];

    if (inventoryItems.length > 0) {
      groups.push({
        key: 'inventory_group',
        label: 'Inventory & Stock',
        icon: <Boxes className="w-[18px] h-[18px]" />,
        badge: lowStockCount > 0 ? lowStockCount : undefined,
        badgeTone: 'amber',
        items: inventoryItems,
      });
    }

    const salesItems: NavChild[] = [
      ...(canMakeSales
        ? [
            {
              id: 'sales' as NavTab,
              label: 'Sales & Invoices',
              icon: <Receipt className="w-4 h-4" />,
            },
          ]
        : []),
      ...(canAddCustomer
        ? [
            {
              id: 'customers' as NavTab,
              label: 'Customer Directory',
              icon: <Users className="w-4 h-4" />,
            },
          ]
        : []),
    ];

    if (salesItems.length > 0) {
      groups.push({
        key: 'sales_group',
        label: 'Sales & Patients',
        icon: <Receipt className="w-[18px] h-[18px]" />,
        items: salesItems,
      });
    }

    const financeItems: NavChild[] = [
      ...(canManagePurchases
        ? [
            {
              id: 'purchases' as NavTab,
              label: 'Purchases & Stock In',
              icon: <Truck className="w-4 h-4" />,
            },
            {
              id: 'suppliers' as NavTab,
              label: 'Suppliers Directory',
              icon: <Building2 className="w-4 h-4" />,
            },
          ]
        : []),
      ...(canViewReports
        ? [
            {
              id: 'expenses' as NavTab,
              label: 'Expense Tracker',
              icon: <WalletCards className="w-4 h-4" />,
            },
            {
              id: 'reports' as NavTab,
              label: 'Reports & P&L',
              icon: <BarChart3 className="w-4 h-4" />,
            },
          ]
        : []),
    ];

    if (financeItems.length > 0) {
      groups.push({
        key: 'finance_group',
        label: 'Supply & Finance',
        icon: <BadgeDollarSign className="w-[18px] h-[18px]" />,
        items: financeItems,
      });
    }

    const adminItems: NavChild[] = [
      ...(isOwner
        ? [
            {
              id: 'staff' as NavTab,
              label: 'Staff Accounts',
              icon: <UserCheck className="w-4 h-4" />,
            },
          ]
        : []),
      {
        id: 'notifications',
        label: 'Alerts & Expiry',
        icon: <Bell className="w-4 h-4" />,
        badge: unreadNotifs > 0 ? unreadNotifs : undefined,
        badgeTone: 'rose',
      },
      ...(isOwner
        ? [
            {
              id: 'settings' as NavTab,
              label: 'Store Settings',
              icon: <Settings className="w-4 h-4" />,
            },
          ]
        : []),
    ];

    if (adminItems.length > 0) {
      groups.push({
        key: 'system_group',
        label: isOwner ? 'System & Team' : 'Alerts & Updates',
        icon: <Cog className="w-[18px] h-[18px]" />,
        badge: unreadNotifs > 0 ? unreadNotifs : undefined,
        badgeTone: 'rose',
        items: adminItems,
      });
    }

    return groups;
  }, [
    canViewInventory,
    canAdjustStock,
    canMakeSales,
    canAddCustomer,
    canManagePurchases,
    canViewReports,
    isOwner,
    lowStockCount,
    unreadNotifs,
  ]);

  const activeGroupKey = useMemo(() => {
    const match = dropdownGroups.find(g => g.items.some(i => i.id === currentTab));
    return match?.key || dropdownGroups[0]?.key || 'inventory_group';
  }, [dropdownGroups, currentTab]);

  // Keep a single cleanly expanded dropdown by default so sidebar never needs a scrollbar
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    [activeGroupKey]: true,
  }));

  useEffect(() => {
    if (activeGroupKey) {
      setOpenGroups({ [activeGroupKey]: true });
    }
  }, [activeGroupKey]);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({
      [key]: !prev[key],
    }));
  };

  const handleNavigate = (tab: NavTab) => {
    onSelectTab(tab);
    onClose();
  };

  const badgeToneClass = (tone?: 'amber' | 'rose' | 'emerald') => {
    if (tone === 'rose') return 'bg-rose-500/90 text-white';
    if (tone === 'amber') return 'bg-amber-400 text-slate-950';
    return 'bg-emerald-500 text-slate-950';
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#071114]/70 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[264px] bg-[#0B191E] text-slate-200 flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } border-r border-white/[0.08] shadow-2xl`}
      >
        {/* Brand Header */}
        <div className="px-4 py-3.5 border-b border-white/[0.07] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-950/50 shrink-0">
              <Pill className="w-5 h-5 transform -rotate-12 stroke-[2.4]" />
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-[15px] text-white tracking-tight truncate leading-tight">
                {String(settings?.storeName || 'PharmaCare').split(' ')[0]}{' '}
                <span className="text-emerald-400">Pro</span>
              </h1>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {settings?.city || 'Karachi, PK'} · {settings?.currency || 'PKR'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close navigation drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Compact Account Strip */}
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center gap-2.5 shrink-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
              isAdmin
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                : 'bg-teal-500/20 text-teal-200 border border-teal-400/30'
            }`}
          >
            {(currentUser?.fullName || currentUser?.username || 'U').charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate leading-tight">
              {currentUser?.fullName || currentUser?.username || 'Store User'}
            </p>
            <p className="text-[10px] text-emerald-300/90 flex items-center gap-1 mt-0.5 truncate">
              {isOwner ? (
                <>
                  <ShieldCheck className="w-3 h-3 shrink-0" /> Store Owner
                </>
              ) : isAdmin ? (
                <>
                  <ShieldCheck className="w-3 h-3 shrink-0" /> Store Manager
                </>
              ) : (
                <>
                  <UserIcon className="w-3 h-3 shrink-0" /> {currentUser?.designation || 'Staff'}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Scrollbar-free Dropdown Navigation */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-1.5">
          {/* Primary Direct Links */}
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer min-h-[42px] ${
              currentTab === 'dashboard'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-sm shadow-emerald-950/40 font-bold'
                : 'text-slate-200 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <LayoutDashboard
                className={`w-[18px] h-[18px] ${
                  currentTab === 'dashboard' ? 'text-slate-950' : 'text-emerald-400'
                }`}
              />
              <span>{isAdmin ? 'Owner Dashboard' : 'Shift Overview'}</span>
            </span>
          </button>

          {canMakeSales && (
            <button
              type="button"
              onClick={() => handleNavigate('pos')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer min-h-[42px] ${
                currentTab === 'pos'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-sm shadow-emerald-950/40 font-bold'
                  : 'bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 border border-emerald-500/20'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <ShoppingCart
                  className={`w-[18px] h-[18px] ${
                    currentTab === 'pos' ? 'text-slate-950' : 'text-emerald-400'
                  }`}
                />
                <span>POS Counter</span>
              </span>
              <kbd
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  currentTab === 'pos'
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-white/10 text-emerald-300'
                }`}
              >
                F2
              </kbd>
            </button>
          )}

          {/* Divider */}
          <div className="pt-1.5 pb-1 px-2">
            <div className="h-px bg-white/[0.07]" />
          </div>

          {/* Collapsible Dropdown Menu Groups */}
          <div className="space-y-1">
            {dropdownGroups.map(group => {
              const isExpanded = Boolean(openGroups[group.key]);
              const hasActiveChild = group.items.some(item => item.id === currentTab);

              return (
                <div
                  key={group.key}
                  className={`rounded-xl transition-colors ${
                    isExpanded
                      ? 'bg-white/[0.04] border border-white/[0.07]'
                      : 'border border-transparent hover:bg-white/[0.03]'
                  }`}
                >
                  {/* Dropdown Trigger Header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={isExpanded}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer min-h-[42px] ${
                      hasActiveChild ? 'text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`shrink-0 ${
                          hasActiveChild ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {group.icon}
                      </span>
                      <span className="truncate">{group.label}</span>
                    </span>

                    <span className="flex items-center gap-2 shrink-0">
                      {!isExpanded && group.badge !== undefined && (
                        <span
                          className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold tabular-nums ${badgeToneClass(
                            group.badgeTone
                          )}`}
                        >
                          {group.badge}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-emerald-400' : ''
                        }`}
                      />
                    </span>
                  </button>

                  {/* Smooth CSS Grid Accordion Panel */}
                  <div
                    className={`grid transition-all duration-200 ease-out ${
                      isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-4 pl-2.5 pr-2 pb-2 pt-0.5 border-l border-white/[0.1] space-y-0.5">
                        {group.items.map(item => {
                          const isActive = currentTab === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleNavigate(item.id)}
                              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-all cursor-pointer min-h-[38px] ${
                                isActive
                                  ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/25'
                                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] border border-transparent'
                              }`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`shrink-0 ${
                                    isActive ? 'text-emerald-400' : 'text-slate-500'
                                  }`}
                                >
                                  {item.icon}
                                </span>
                                <span className="truncate">{item.label}</span>
                              </span>

                              {item.badge !== undefined && (
                                <span
                                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold tabular-nums shrink-0 ${badgeToneClass(
                                    item.badgeTone
                                  )}`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Clean Footer */}
        <div className="p-3 border-t border-white/[0.07] bg-[#091418] space-y-2 shrink-0">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer min-h-[42px]"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};
