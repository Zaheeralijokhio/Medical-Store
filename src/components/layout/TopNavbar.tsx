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
  ChevronDown,
  RotateCcw,
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
  const {
    notifications,
    isOnline,
    pendingSyncCount,
    offlineSyncStatus,
    syncOfflineQueue,
    refreshData,
  } = useStore();
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
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 15000);
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
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        setShowIOSInstallGuide(true);
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

  const visibleNotifications = isAdmin
    ? notifications || []
    : (notifications || []).filter(
        n =>
          n &&
          n.type !== 'staff_activity' &&
          n.type !== 'payment_due' &&
          !String(n.message || '').includes('Owner')
      );
  const unreadNotifs = visibleNotifications.filter(n => !n.read).length;

  const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: isAdmin ? 'Executive Dashboard' : 'Shift Summary',
      subtitle: 'Store activity, valuation & real-time revenue',
    },
    pos: {
      title: 'POS Billing Terminal',
      subtitle: 'Barcode scanner, FEFO batches & instant cash memo',
    },
    inventory: {
      title: 'Medicine Inventory',
      subtitle: 'Batch tracking, expiry rules & fixed retail prices',
    },
    sales: {
      title: 'Sales & Cash Memos',
      subtitle: 'Completed invoices, receipts & customer returns',
    },
    purchases: {
      title: 'Supplier Purchases',
      subtitle: 'Goods inflow, supplier bills & stock batches',
    },
    suppliers: {
      title: 'Suppliers & Vendors',
      subtitle: 'Pharmaceutical distributors & payable ledgers',
    },
    customers: {
      title: 'Customer Directory',
      subtitle: 'Patient profiles, prescriptions & credit accounts',
    },
    staff: {
      title: 'Staff & Access Control',
      subtitle: 'Dispenser logins, passwords, PINs & permissions',
    },
    expenses: {
      title: 'Store Expenses',
      subtitle: 'Rent, utilities, payroll & cold chain costs',
    },
    adjustments: {
      title: 'Stock Audit & Adjust',
      subtitle: 'Reconciliation, damage logs & expired disposal',
    },
    reports: {
      title: 'Reports & P&L Analytics',
      subtitle: 'Exact COGS profit, margins & CSV/PDF exports',
    },
    notifications: {
      title: 'Alerts & Expiry Center',
      subtitle: 'Near-expiry thresholds & low stock notifications',
    },
    settings: {
      title: 'System Settings',
      subtitle: 'Store details, DRAP license, tax & database backups',
    },
  };

  const currentInfo = tabTitles[currentTab] || {
    title: 'Pharmacy Management',
    subtitle: 'Store Operations',
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2.5 sm:gap-4">
          {/* Left: Mobile drawer trigger + Page Title */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 lg:hidden transition-colors shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight truncate">
                {currentInfo.title}
              </h2>
              <p className="hidden sm:block text-[11px] text-slate-500 font-medium truncate">
                {currentInfo.subtitle}
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Sync / Offline Control */}
            {isOnline ? (
              <button
                type="button"
                onClick={() => {
                  syncOfflineQueue();
                  refreshData();
                }}
                disabled={isSyncing}
                className="min-h-[38px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100 transition-colors whitespace-nowrap"
                title="Sync cloud database"
              >
                <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="hidden md:inline">Synced</span>
                {pendingSyncCount > 0 && (
                  <span className="flex items-center gap-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-md font-bold tabular-nums">
                    <RefreshCw className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {pendingSyncCount}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="min-h-[38px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap"
                title="Offline mode — queuing changes locally"
              >
                <WifiOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="hidden xs:inline">Offline</span>
              </button>
            )}

            {/* PWA Install Button when promptable */}
            {!isInstalled && installPrompt && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 min-h-[38px] rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden xl:inline">Install App</span>
              </button>
            )}

            {/* Live Clock Asia/Karachi */}
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 text-slate-600 text-xs font-mono font-medium whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span className="tabular-nums">PKT {currentTime}</span>
            </div>

            {/* Quick POS CTA */}
            {currentTab !== 'pos' && (
              <button
                type="button"
                onClick={() => onNavigate('pos')}
                className="min-h-[38px] flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-all active:scale-[0.98] whitespace-nowrap"
              >
                <ShoppingCart className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">POS</span>
                <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] bg-white/15 rounded text-emerald-100 font-mono">
                  F2
                </kbd>
              </button>
            )}

            {/* Notifications Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  setIsNotifOpen(prev => !prev);
                }}
                className="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-[18px] h-[18px]" />
                {unreadNotifs > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </span>
                )}
              </button>

              <NotificationDropdown
                isOpen={isNotifOpen}
                onClose={() => setIsNotifOpen(false)}
                onNavigate={onNavigate}
              />
            </div>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsNotifOpen(false);
                  setIsUserMenuOpen(prev => !prev);
                }}
                className="min-h-[40px] flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl border border-slate-200/90 hover:border-teal-500/40 hover:bg-slate-50 transition-colors"
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold text-white shrink-0 ${
                    isAdmin ? 'bg-[#0B191E]' : 'bg-teal-700'
                  }`}
                >
                  {(currentUser?.fullName || currentUser?.username || 'U').charAt(0)}
                </div>
                <div className="hidden md:block text-left max-w-[120px]">
                  <span className="text-xs font-bold text-slate-800 block leading-tight truncate">
                    {currentUser?.fullName || currentUser?.username || 'User'}
                  </span>
                  <span className="text-[10px] text-slate-500 block leading-none truncate">
                    {isAdmin ? 'Store Owner' : currentUser?.designation || 'Staff'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block shrink-0" />
              </button>

              {isUserMenuOpen && (
                <div className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-full sm:mt-2 w-[calc(100vw-1.5rem)] max-w-[288px] sm:w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-2.5">
                  <div className="p-2.5 border-b border-slate-100 mb-1.5">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentUser?.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      @{currentUser?.username} · {currentUser?.designation}
                    </p>
                  </div>

                  {isAdmin && (
                    <>
                      <div className="pb-1.5 mb-1.5 border-b border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            onNavigate('staff');
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full min-h-[40px] flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-900 hover:bg-emerald-100 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <PlusCircle className="w-4 h-4 text-emerald-600" />
                            Manage Staff Accounts
                          </span>
                        </button>
                      </div>

                      <div className="py-1 max-h-48 overflow-y-auto no-scrollbar">
                        <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Switch Portal ({availableUsers.length})
                        </p>
                        {availableUsers.map(user => {
                          const isSelected = user.id === currentUser?.id;
                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => {
                                switchUser(user.id);
                                setIsUserMenuOpen(false);
                              }}
                              className={`w-full min-h-[38px] flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'bg-teal-50 text-teal-900 font-bold'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="truncate">{user.fullName}</span>
                              <span className="text-[10px] uppercase text-slate-400 shrink-0 ml-2">
                                {user.id === 'usr-owner-1' ? 'Owner' : user.role}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <div className={`${isAdmin ? 'border-t border-slate-100 pt-1.5 mt-1.5' : 'pt-0.5'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full min-h-[42px] flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-rose-700 hover:bg-rose-50 font-bold cursor-pointer"
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
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
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
              type="button"
              onClick={() => setShowIOSInstallGuide(false)}
              className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
