/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Menu,
  Bell,
  ShoppingCart,
  PlusCircle,
  Clock,
  ShieldCheck,
  User as UserIcon,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  Share,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { NavTab } from './Sidebar';
import { NotificationDropdown } from './NotificationDropdown';

interface TopNavbarProps {
  onToggleSidebar: () => void;
  currentTab: NavTab;
  onNavigate: (tab: NavTab) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  onToggleSidebar,
  currentTab,
  onNavigate,
}) => {
  const { currentUser, isAdmin, switchUser, availableUsers, logout } = useAuth();
  const { settings, notifications, isOnline, pendingSyncCount, offlineSyncStatus, syncOfflineQueue } = useStore();
  const isSyncing = offlineSyncStatus === 'syncing';

  const [currentTime, setCurrentTime] = useState<string>('');
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSInstallGuide, setShowIOSInstallGuide] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Karachi',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setInstallPrompt(null);
    } else {
      // Check if iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        setShowIOSInstallGuide(true);
      } else {
        alert('To install PharmaCare Pro: click your browser menu (⋮ or Share) and select "Add to Home screen" or "Install App".');
      }
    }
  };

  // Keyboard shortcut listener for F2 -> POS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        onNavigate('pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate]);

  const unreadNotifs = notifications.filter(n => !n.read).length;

  const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: isAdmin ? 'Executive Pharmacy Dashboard' : 'Cashier Counter & Shift Summary',
      subtitle: 'Real-time store activity, inventory valuation, and sales metrics',
    },
    pos: {
      title: 'Point of Sale (POS) Terminal',
      subtitle: 'Barcode scanner support, FEFO batch selection, instant checkout',
    },
    inventory: {
      title: 'Medicine Catalog & Batch Inventory',
      subtitle: 'Multi-batch tracking, expiry alerts, wholesale & retail pricing',
    },
    sales: {
      title: 'Sales Transactions & Cash Memos',
      subtitle: 'Completed sales invoices, customer receipts, and refunds',
    },
    purchases: {
      title: 'Supplier Purchases & Goods Receipt',
      subtitle: 'Stock replenishment, supplier bills, and batch records',
    },
    suppliers: {
      title: 'Pharmaceutical Suppliers & Vendors',
      subtitle: 'Company directory, outstanding balances, and payment ledgers',
    },
    customers: {
      title: 'Customer Directory & Accounts',
      subtitle: 'Patient records, prescription history, and credit ledgers',
    },
    staff: {
      title: 'Staff Accounts & RBAC Permissions',
      subtitle: 'Manage pharmacy dispensers, cashiers, and login access',
    },
    expenses: {
      title: 'Pharmacy Operational Expenses',
      subtitle: 'Utilities, rent, staff payroll, refrigeration & maintenance',
    },
    adjustments: {
      title: 'Stock Audit & Reconciliation',
      subtitle: 'Physical count audits, damaged stocks, and expired batch logs',
    },
    reports: {
      title: 'Financial Reports & Profit Analytics',
      subtitle: 'COGS batch profit, daily/monthly revenue, Excel & PDF exports',
    },
    notifications: {
      title: 'Alerts, Expiry Rules & Thresholds',
      subtitle: 'Near-expiry warnings (90-day alert), stock level notifications',
    },
    settings: {
      title: 'System Settings & Pharmacy Profile',
      subtitle: 'Store details, Drug License, NTN, currency, and data backups',
    },
  };

  const currentInfo = tabTitles[currentTab] || {
    title: 'Pharmacy Management',
    subtitle: 'Store Operations',
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: Mobile hamburger + Tab title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden focus:outline-hidden"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {currentInfo.title}
              </h2>
              <p className="hidden sm:block text-xs text-slate-500 font-medium">
                {currentInfo.subtitle}
              </p>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Online / Offline Sync Badge */}
            <div className="flex items-center">
              {isOnline ? (
                <button
                  type="button"
                  onClick={() => syncOfflineQueue()}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  title={pendingSyncCount > 0 ? `${pendingSyncCount} sales pending sync` : 'Connected to Server Database'}
                >
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline font-semibold">Online</span>
                  {pendingSyncCount > 0 && (
                    <span className="flex items-center gap-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      <RefreshCw className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      {pendingSyncCount}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse"
                  title="Running in Offline Cache Mode. Sales are safely stored in IndexedDB and will sync once reconnected."
                >
                  <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                  <span className="font-semibold">Offline</span>
                  {pendingSyncCount > 0 && (
                    <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {pendingSyncCount} saved
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* PWA Install Button */}
            {!isInstalled && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold transition-colors"
                title="Install Pharmacy POS App"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden lg:inline">Install App</span>
              </button>
            )}

            {/* Live Clock Asia/Karachi */}
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-mono font-medium">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>PKT: {currentTime}</span>
            </div>

            {/* Quick POS Button */}
            {currentTab !== 'pos' && (
              <button
                onClick={() => onNavigate('pos')}
                className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm shadow-sm shadow-teal-700/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden xs:inline">Open POS</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-teal-700/50 rounded text-teal-100 border border-teal-500/40 font-mono">
                  F2
                </kbd>
              </button>
            )}

            {/* Notifications Button */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(prev => !prev)}
                className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifs > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unreadNotifs}
                  </span>
                )}
              </button>

              <NotificationDropdown
                isOpen={isNotifOpen}
                onClose={() => setIsNotifOpen(false)}
                onNavigate={onNavigate}
              />
            </div>

            {/* Fast Switch User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(prev => !prev)}
                className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    isAdmin ? 'bg-indigo-600' : 'bg-teal-600'
                  }`}
                >
                  {currentUser?.fullName.charAt(0) || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <span className="text-xs font-semibold text-slate-800 block leading-tight">
                    {currentUser?.fullName}
                  </span>
                  <span className="text-[10px] text-slate-500 block leading-none">
                    {currentUser?.role === 'admin' ? 'Store Owner' : currentUser?.designation || 'Seller / Staff'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-2.5 border-b border-slate-100 mb-1">
                    <p className="text-xs font-bold text-slate-900">{currentUser?.fullName}</p>
                    <p className="text-[11px] text-slate-500">@{currentUser?.username} • {currentUser?.email}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {currentUser?.designation}
                      </span>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="pb-1 mb-1 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate('staff');
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <PlusCircle className="w-3.5 h-3.5 text-teal-600" />
                          Create / Remove Staff Accounts
                        </span>
                        <span className="text-[10px] bg-teal-600 text-white px-1.5 py-0.5 rounded">
                          Owner
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="py-1">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Active Accounts ({availableUsers.length}):
                    </p>
                    {availableUsers.map(user => {
                      const isSelected = user.id === currentUser?.id;
                      return (
                        <button
                          key={user.id}
                          onClick={() => {
                            switchUser(user.id);
                            setIsUserMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-teal-50 text-teal-800 font-semibold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                user.role === 'admin' ? 'bg-indigo-600' : user.role === 'pharmacist' ? 'bg-teal-500' : 'bg-amber-500'
                              }`}
                            />
                            <span className="truncate">{user.fullName}</span>
                          </div>
                          <span className="text-[10px] uppercase text-slate-400 shrink-0 ml-2">
                            {user.id === 'usr-owner-1' ? 'Owner' : user.role}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-100 pt-1 mt-1 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg text-xs text-rose-700 hover:bg-rose-50 font-bold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Sign Out to Login Screen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* iOS Safari PWA Install Modal */}
      {showIOSInstallGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-2xl text-center">
            <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Share className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">
              Install PharmaCare on iPhone/iPad
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              1. Tap the <strong className="text-slate-900">Share</strong> button at the bottom of Safari.<br />
              2. Scroll down and select <strong className="text-teal-700 font-bold">Add to Home Screen</strong>.<br />
              3. Tap <strong className="text-slate-900">Add</strong> in the top-right corner to launch full screen.
            </p>
            <button
              onClick={() => setShowIOSInstallGuide(false)}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
