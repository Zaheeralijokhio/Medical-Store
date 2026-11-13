/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import {
  ShoppingCart,
  Pill,
  Receipt,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Search,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { formatPKR, isExpired, isNearExpiry } from '../../utils/helpers';
import { NavTab } from '../layout/Sidebar';

interface StaffDashboardProps {
  onNavigate: (tab: NavTab) => void;
  onOpenInvoice?: (sale: any) => void;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { sales, medicines, settings } = useStore();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter sales for this staff member
  const myTodaySales = useMemo(() => {
    return sales.filter(s => s.staffId === currentUser?.id && s.date === todayStr);
  }, [sales, currentUser, todayStr]);

  const myTotalRevenueToday = useMemo(() => {
    return myTodaySales.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);
  }, [myTodaySales]);

  // Inventory Quick Stats
  const activeMeds = (medicines || []).filter(m => Number(m.totalQuantity || 0) > 0).length;
  const lowStockCount = (medicines || []).filter(
    m => Number(m.totalQuantity || 0) <= Number(m.minStockLevel ?? 15) && Number(m.totalQuantity || 0) > 0
  ).length;
  const outOfStockCount = (medicines || []).filter(m => Number(m.totalQuantity || 0) === 0).length;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Welcome & Fast POS Launcher Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#0B191E] via-[#0F2F34] to-[#114842] text-white shadow-lg border border-emerald-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-emerald-300 font-semibold mb-1">
              Active Dispensing Shift · Karachi Terminal
            </p>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Welcome, {currentUser?.fullName}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Role: <span className="font-semibold text-white">{currentUser?.designation}</span>. Ready to dispense medications, scan barcodes, and generate customer cash memos.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="w-full md:w-auto min-h-[46px] flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-sm shadow-md transition-all active:scale-[0.98] shrink-0"
          >
            <ShoppingCart className="w-5 h-5 text-slate-950" />
            <span>Launch POS Counter (F2)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row 1: Shift Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Today&apos;s Shift Cash
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 mt-3 tabular-nums">
            {formatPKR(myTotalRevenueToday)}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            {myTodaySales.length} customer memos
          </p>
        </div>

        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Invoices
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 mt-3 tabular-nums">
            {myTodaySales.length}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Completed today
          </p>
        </div>

        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Available Meds
            </span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-700">
              <Pill className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 mt-3 tabular-nums">
            {activeMeds} / {medicines.length}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            Ready to dispense
          </p>
        </div>

        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Stock Alerts
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <h3 className="text-lg sm:text-2xl font-extrabold text-amber-700 mt-3 tabular-nums">
            {lowStockCount + outOfStockCount}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
            {lowStockCount} low · {outOfStockCount} out
          </p>
        </div>
      </div>

      {/* Row 2: Quick Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Left 2 Cols: My Recent Invoices */}
        <div className="lg:col-span-2 pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
                My Recent Sales &amp; Invoices
              </h3>
              <p className="text-xs text-slate-500">
                Invoices processed during your shift
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-xs text-teal-700 font-bold hover:underline shrink-0"
            >
              Archive &rarr;
            </button>
          </div>

          {/* Mobile Invoice Cards (<768px) */}
          <div className="md:hidden space-y-2.5">
            {myTodaySales.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No sales processed yet on this shift.
              </div>
            ) : (
              myTodaySales.slice(0, 6).map(sale => (
                <div
                  key={sale.id}
                  className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-teal-800 block">
                      {sale.invoiceNumber}
                    </span>
                    <span className="font-semibold text-slate-800 block truncate">
                      {sale.customerName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {(sale.items || []).length} item(s) · {sale.paymentMethod} · {sale.time}
                    </span>
                  </div>
                  <div className="text-right shrink-0 font-mono font-extrabold text-slate-900 tabular-nums">
                    {formatPKR(sale.grandTotal)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (>=768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Items</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3 text-right">Total (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myTodaySales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No sales processed yet on this shift. Click &quot;Launch POS Counter&quot; to start.
                    </td>
                  </tr>
                ) : (
                  myTodaySales.slice(0, 6).map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-teal-700">
                        {sale.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {sale.customerName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {(sale.items || []).length} item(s)
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {sale.time}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatPKR(sale.grandTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Quick Search & Protocols */}
        <div className="space-y-4">
          <div className="pro-card p-4 sm:p-5 rounded-2xl">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-1.5 flex items-center gap-2">
              <Pill className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
              Quick Medicine Lookup
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Search retail prices, generics &amp; shelf locations
            </p>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 hover:border-teal-600 bg-slate-50 text-slate-600 text-xs text-left transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">Search Panadol, Risek, Augmentin...</span>
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-200 rounded text-slate-700 shrink-0 ml-2">
                Go
              </kbd>
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-[#0B191E] text-white border border-white/[0.08] shadow-sm">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-2.5">
              <ShieldCheck className="w-4 h-4" /> DRAP Dispensing Protocols
            </div>
            <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
              <li>Verify prescriptions for Schedule-G Antibiotics &amp; Psychotropics.</li>
              <li>Expired batches are blocked automatically under FEFO rules.</li>
              <li>Cold chain (2°C–8°C) items are non-returnable once dispensed.</li>
              <li>Issue a Computerized Cash Memo for every customer transaction.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
