/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Clock,
  CheckCircle2,
  DollarSign,
  Package,
  Check,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { PharmacyNotification } from '../../types/pharmacy';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: any) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { notifications, markNotificationRead, markAllNotificationsRead, clearNotification } = useStore();
  const { isAdmin } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const visibleNotifications = isAdmin
    ? (notifications || [])
    : (notifications || []).filter(
        n => n && n.type !== 'staff_activity' && n.type !== 'payment_due' && !String(n.message || '').includes('Owner')
      );

  const unreadCount = visibleNotifications.filter(n => !n.read).length;

  const getIcon = (type: PharmacyNotification['type']) => {
    switch (type) {
      case 'expired':
        return <AlertOctagon className="w-4 h-4 text-rose-600" />;
      case 'near_expiry':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'out_of_stock':
      case 'low_stock':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'sale_completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'payment_due':
        return <DollarSign className="w-4 h-4 text-blue-600" />;
      default:
        return <Package className="w-4 h-4 text-indigo-600" />;
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-700" />
          <h3 className="font-semibold text-sm text-slate-800">Notifications & Alerts</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllNotificationsRead()}
            className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> Mark all read
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
        {visibleNotifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No new notifications</p>
          </div>
        ) : (
          visibleNotifications.slice(0, 10).map(notif => (
            <div
              key={notif.id}
              className={`p-3 text-left transition-colors flex items-start gap-3 hover:bg-slate-50 ${
                !notif.read ? 'bg-teal-50/40' : ''
              }`}
            >
              <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 shrink-0">
                {getIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4
                    onClick={() => {
                      markNotificationRead(notif.id);
                      if (notif.type === 'near_expiry' || notif.type === 'expired' || notif.type === 'low_stock') {
                        onNavigate('inventory');
                      } else if (notif.type === 'sale_completed') {
                        onNavigate('sales');
                      } else {
                        onNavigate('notifications');
                      }
                      onClose();
                    }}
                    className={`text-xs font-semibold truncate cursor-pointer hover:underline ${
                      !notif.read ? 'text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    {notif.title}
                  </h4>
                  <button
                    onClick={() => clearNotification(notif.id)}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                    title="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                  {notif.message}
                </p>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {notif.timestamp}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
        <button
          onClick={() => {
            onNavigate('notifications');
            onClose();
          }}
          className="text-xs font-medium text-teal-600 hover:text-teal-700"
        >
          View All Notifications & Expiry Rules →
        </button>
      </div>
    </div>
  );
};
