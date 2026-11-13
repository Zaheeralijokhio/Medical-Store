/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Clock,
  CheckCircle2,
  DollarSign,
  Package,
  Check,
  Trash2,
  Sliders,
  X,
  Filter,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { PharmacyNotification, NotificationSeverity } from '../../types/pharmacy';

export const NotificationCenter: React.FC = () => {
  const {
    notifications,
    settings,
    updateSettings,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotification,
  } = useStore();
  const { isAdmin } = useAuth();

  const [filterType, setFilterType] = useState<string>('All');
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Settings form
  const [expiryDays, setExpiryDays] = useState(settings.expiryAlertDays || 90);
  const [stockThreshold, setStockThreshold] = useState(settings.lowStockThresholdDefault || 25);

  const filteredNotifications = useMemo(() => {
    return (notifications || []).filter(n => {
      if (!n) return false;
      if (!isAdmin && (n.type === 'staff_activity' || n.type === 'payment_due' || String(n.message || '').includes('Owner'))) {
        return false;
      }
      if (filterType === 'All') return true;
      if (filterType === 'unread') return !n.read;
      if (filterType === 'expiry') return n.type === 'near_expiry' || n.type === 'expired';
      if (filterType === 'stock') return n.type === 'low_stock' || n.type === 'out_of_stock';
      if (filterType === 'transactions') return n.type === 'sale_completed' || n.type === 'purchase_recorded';
      return true;
    });
  }, [notifications, filterType, isAdmin]);

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      expiryAlertDays: Number(expiryDays),
      lowStockThresholdDefault: Number(stockThreshold),
    });
    setShowConfigModal(false);
  };

  const getIcon = (type: PharmacyNotification['type']) => {
    switch (type) {
      case 'expired':
        return <AlertOctagon className="w-5 h-5 text-rose-600" />;
      case 'near_expiry':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'out_of_stock':
      case 'low_stock':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'sale_completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'payment_due':
        return <DollarSign className="w-5 h-5 text-blue-600" />;
      default:
        return <Package className="w-5 h-5 text-[#0F766E]" />;
    }
  };

  const getSeverityBadge = (sev: NotificationSeverity) => {
    switch (sev) {
      case 'danger':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'success':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pro-card p-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#0F766E]" />
            Automated Alert Center &amp; Expiry Notifications
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time triggers for expired batches, low stocks, customer sales, and vendor balances
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {notifications.some(n => !n.read) && (
            <button
              onClick={() => markAllNotificationsRead()}
              className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Mark All Read
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F766E] hover:bg-[#0D655E] text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Sliders className="w-4 h-4" /> Configure Thresholds
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
        {[
          { id: 'All', label: 'All Alerts' },
          { id: 'unread', label: 'Unread Only' },
          { id: 'expiry', label: 'Near Expiry & Expired' },
          { id: 'stock', label: 'Low & Out of Stock' },
          { id: 'transactions', label: 'Sales & Purchases' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap shrink-0 transition-colors ${
              filterType === tab.id
                ? 'bg-[#0F766E] text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-2.5">
        {filteredNotifications.length === 0 ? (
          <div className="pro-card p-12 text-center text-slate-400">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold">No alerts matching this filter.</p>
            <p className="text-xs text-slate-400 mt-1">All inventory thresholds and store operations are running normally.</p>
          </div>
        ) : (
          filteredNotifications.map(notif => (
            <div
              key={notif.id}
              className={`pro-card p-3.5 sm:p-4 transition-all flex items-start gap-3 ${
                !notif.read
                  ? 'bg-emerald-50/35 border-emerald-200'
                  : ''
              }`}
            >
              <div className="p-2 rounded-xl bg-slate-100 shrink-0">
                {getIcon(notif.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 truncate">
                      {notif.title}
                    </h4>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getSeverityBadge(notif.severity)}`}>
                      {notif.severity.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                      {notif.timestamp}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {notif.message}
                </p>

                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-slate-400">
                    Category: <strong className="text-slate-600 capitalize">{notif.type.replace('_', ' ')}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    {!notif.read && (
                      <button
                        onClick={() => markNotificationRead(notif.id)}
                        className="text-teal-600 hover:text-teal-700 font-semibold"
                      >
                        Mark as Read
                      </button>
                    )}
                    <button
                      onClick={() => clearNotification(notif.id)}
                      className="text-slate-400 hover:text-rose-600"
                      title="Dismiss"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Configure Thresholds Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden text-xs">
            <div className="flex items-center justify-between bg-[#0B191E] text-white px-5 py-3.5">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" /> Configure System Alert Thresholds
              </h4>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveThresholds} className="p-5 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Near Expiry Warning Window (Days)
                </label>
                <input
                  type="number"
                  min="15"
                  max="365"
                  required
                  value={expiryDays}
                  onChange={e => setExpiryDays(parseInt(e.target.value) || 90)}
                  className="w-full min-h-[40px] p-2.5 border border-slate-200 rounded-xl font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Medicines expiring within this many days will display orange warnings on POS and Inventory. Default: 90 days.
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Default Minimum Stock Alert Threshold (Units)
                </label>
                <input
                  type="number"
                  min="5"
                  max="1000"
                  required
                  value={stockThreshold}
                  onChange={e => setStockThreshold(parseInt(e.target.value) || 20)}
                  className="w-full min-h-[40px] p-2.5 border border-slate-200 rounded-xl font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Triggers yellow low-stock alert when available quantity drops below this level.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 min-h-[42px] py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[42px] py-2 bg-[#0F766E] hover:bg-[#0D655E] text-white rounded-xl font-bold"
                >
                  Save Thresholds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
