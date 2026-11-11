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
    return myTodaySales.reduce((sum, s) => sum + s.grandTotal, 0);
  }, [myTodaySales]);

  // Inventory Quick Stats
  const activeMeds = medicines.filter(m => m.totalQuantity > 0).length;
  const lowStockCount = medicines.filter(m => m.totalQuantity <= m.minStockLevel && m.totalQuantity > 0).length;
  const outOfStockCount = medicines.filter(m => m.totalQuantity === 0).length;

  return (
    <div className="space-y-6">
      {/* Welcome & Fast POS Launcher Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/30 text-teal-200 border border-teal-400/30">
                Active Dispensing Shift
              </span>
              <span className="text-xs text-teal-300">
                Station Terminal • Karachi, PK
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Welcome, {currentUser?.fullName}
            </h2>
            <p className="text-xs text-teal-100/90 mt-1 max-w-xl">
              Role: <span className="font-semibold text-white">{currentUser?.designation}</span>.
              Ready to dispense medications, scan barcodes, and generate customer cash memos.
            </p>
          </div>

          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-sm shadow-lg shadow-teal-950/30 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <ShoppingCart className="w-5 h-5 text-slate-950" />
            <span>Launch POS Billing Counter (F2)</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>

      {/* Row 1: Shift Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              My Today's Shift Cash
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-3">
            {formatPKR(myTotalRevenueToday)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Calculated from {myTodaySales.length} customer memos
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Dispensed Invoices
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-3">
            {myTodaySales.length}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Completed sales this shift
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Available Formulations
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Pill className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-3">
            {activeMeds} / {medicines.length}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Medicines ready for dispensing
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Stock Warnings
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-700 mt-3">
            {lowStockCount + outOfStockCount}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {lowStockCount} low stock • {outOfStockCount} out of stock
          </p>
        </div>
      </div>

      {/* Row 2: Quick Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: My Recent Invoices */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-teal-600" />
                My Recent Sales & Invoices
              </h3>
              <p className="text-xs text-slate-500">
                Invoices processed during your current counter shift
              </p>
            </div>
            <button
              onClick={() => onNavigate('sales')}
              className="text-xs text-teal-600 font-semibold hover:underline"
            >
              Full Sales Archive →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
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
                      No sales processed yet on this shift. Click "Launch POS Billing Counter" to start.
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
                        {sale.items.length} item(s)
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {sale.time}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
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
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-2 flex items-center gap-2">
              <Pill className="w-5 h-5 text-indigo-600" />
              Quick Medicine Price Check
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Search retail prices, generic substitutes and current rack location
            </p>
            <button
              onClick={() => onNavigate('inventory')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:border-teal-500 bg-slate-50 text-slate-500 text-xs text-left"
            >
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400" /> Search Panadol, Risek, Augmentin...
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-200 rounded text-slate-700">
                Go
              </kbd>
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-xs">
            <div className="flex items-center gap-2 text-teal-400 text-xs font-bold mb-2">
              <ShieldCheck className="w-4 h-4" /> DRAP Dispensing Safety Protocols
            </div>
            <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
              <li>Always verify prescription for Schedule-G Antibiotics & Psychotropics.</li>
              <li>System automatically blocks expired batches under First Expiry, First Out (FEFO).</li>
              <li>Refrigerated cold chain (2°C - 8°C) items are non-returnable once taken outside.</li>
              <li>Always issue Computerized Cash Memo to customers for tax compliance.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
