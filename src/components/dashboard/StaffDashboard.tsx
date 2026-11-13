/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  ShoppingCart,
  Pill,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Search,
  RefreshCw,
  Eye,
  Users,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { Sale } from '../../types/pharmacy';
import {
  formatPKR,
  getMedicineStockStatus,
  getStoreTodayDateStr,
} from '../../utils/helpers';
import { NavTab } from '../layout/Sidebar';
import { InvoiceModal } from '../pos/InvoiceModal';

interface StaffDashboardProps {
  onNavigate: (tab: NavTab) => void;
  onOpenInvoice?: (sale: Sale) => void;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { sales, medicines, customers, settings, isHydrating, refreshData } = useStore();

  const [invoiceScope, setInvoiceScope] = useState<'all' | 'mine'>('all');
  const [medSearch, setMedSearch] = useState('');
  const [selectedSaleForView, setSelectedSaleForView] = useState<Sale | null>(null);

  const todayStr = useMemo(() => getStoreTodayDateStr(), []);

  const activeSales = useMemo(
    () => (sales || []).filter(s => s && s.status !== 'returned'),
    [sales]
  );

  const storeTodaySales = useMemo(
    () => activeSales.filter(s => s.date === todayStr),
    [activeSales, todayStr]
  );

  const myAllSales = useMemo(
    () => (sales || []).filter(s => s && s.staffId === currentUser?.id),
    [sales, currentUser?.id]
  );

  const myTodaySales = useMemo(
    () => storeTodaySales.filter(s => s.staffId === currentUser?.id),
    [storeTodaySales, currentUser?.id]
  );

  const storeTotalRevenueToday = useMemo(
    () => storeTodaySales.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0),
    [storeTodaySales]
  );

  const myTotalRevenueToday = useMemo(
    () => myTodaySales.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0),
    [myTodaySales]
  );

  const displayedInvoices = useMemo(() => {
    const list = invoiceScope === 'mine' ? myAllSales : sales || [];
    return list.slice(0, 8);
  }, [invoiceScope, myAllSales, sales]);

  // Inventory Quick Stats
  const activeMeds = (medicines || []).filter(m => Number(m.totalQuantity || 0) > 0).length;
  const totalUnitsInStock = (medicines || []).reduce(
    (sum, m) => sum + Number(m.totalQuantity || 0),
    0
  );
  const lowStockCount = (medicines || []).filter(
    m =>
      Number(m.totalQuantity || 0) <= Number(m.minStockLevel ?? 15) &&
      Number(m.totalQuantity || 0) > 0
  ).length;
  const outOfStockCount = (medicines || []).filter(m => Number(m.totalQuantity || 0) === 0).length;

  const filteredMedicines = useMemo(() => {
    const q = medSearch.trim().toLowerCase();
    const list = medicines || [];
    if (!q) return list.slice(0, 8);
    return list
      .filter(
        m =>
          String(m.name || '').toLowerCase().includes(q) ||
          String(m.genericName || '').toLowerCase().includes(q) ||
          String(m.category || '').toLowerCase().includes(q) ||
          String(m.storageLocation || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [medicines, medSearch]);

  const showInitialHydratingBanner =
    isHydrating && medicines.length === 0 && sales.length === 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {showInitialHydratingBanner && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-emerald-900 text-xs font-semibold">
          <span className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-700" />
            Syncing live medicines, invoices &amp; customer records from database...
          </span>
          <button
            type="button"
            onClick={() => refreshData()}
            className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold text-[11px]"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Welcome & Fast POS Launcher Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#0B191E] via-[#0F2F34] to-[#114842] text-white shadow-lg border border-emerald-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-emerald-300 font-semibold mb-1">
              Active Dispensing Shift · {settings?.city || 'Karachi'} Terminal · {todayStr}
            </p>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Welcome, {currentUser?.fullName}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Role: <span className="font-semibold text-white">{currentUser?.designation}</span>. Ready to dispense medications, view store stock &amp; invoices, and issue cash memos.
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

      {/* Row 1: Store & Shift Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Store Today Cash
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 mt-3 tabular-nums">
            {formatPKR(storeTotalRevenueToday)}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 tabular-nums">
            Your shift: <span className="font-semibold text-teal-700">{formatPKR(myTotalRevenueToday)}</span>
          </p>
        </div>

        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Store Invoices
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 mt-3 tabular-nums">
            {sales.length}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 tabular-nums">
            {storeTodaySales.length} today · {myAllSales.length} yours
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
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 tabular-nums">
            {totalUnitsInStock.toLocaleString()} units in stock
          </p>
        </div>

        <div className="pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Alerts &amp; Patients
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              {lowStockCount + outOfStockCount > 0 ? (
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
              )}
            </div>
          </div>
          <h3 className="text-lg sm:text-2xl font-extrabold text-amber-700 mt-3 tabular-nums">
            {lowStockCount + outOfStockCount} alerts
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 tabular-nums">
            {customers.length} customers · {outOfStockCount} out
          </p>
        </div>
      </div>

      {/* Row 2: Recent Store & Shift Invoices + Quick Lookup / Protocols */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Left 2 Cols: Store & Shift Invoices */}
        <div className="lg:col-span-2 pro-card p-4 sm:p-5 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
                Recent Sales &amp; Cash Memos
              </h3>
              <p className="text-xs text-slate-500">
                Live store-wide and shift billing records synced with database
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex rounded-xl bg-slate-100 p-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setInvoiceScope('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    invoiceScope === 'all'
                      ? 'bg-[#0F766E] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Store ({sales.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceScope('mine')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    invoiceScope === 'mine'
                      ? 'bg-[#0F766E] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  My Invoices ({myAllSales.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('sales')}
                className="text-xs text-teal-700 font-bold hover:underline shrink-0"
              >
                All Invoices &rarr;
              </button>
            </div>
          </div>

          {/* Mobile Invoice Cards (<768px) */}
          <div className="md:hidden space-y-2.5">
            {displayedInvoices.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                {invoiceScope === 'mine'
                  ? 'No sales processed by your account yet.'
                  : 'No store invoices recorded yet.'}
              </div>
            ) : (
              displayedInvoices.map(sale => (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => setSelectedSaleForView(sale)}
                  className="w-full text-left p-3 rounded-xl bg-slate-50/80 hover:bg-emerald-50/50 border border-slate-200/70 flex items-center justify-between gap-2 text-xs transition-colors"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-teal-800 block">
                      {sale.invoiceNumber}
                    </span>
                    <span className="font-semibold text-slate-800 block truncate">
                      {sale.customerName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {sale.date} · {sale.staffName} · {(sale.items || []).length} item(s)
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-extrabold text-slate-900 tabular-nums block">
                      {formatPKR(sale.grandTotal)}
                    </span>
                    <span className="text-[10px] text-teal-700 font-bold inline-flex items-center gap-0.5 mt-0.5">
                      <Eye className="w-3 h-3" /> Receipt
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Desktop Table (>=768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Dispenser</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3 text-right">Total (PKR)</th>
                  <th className="py-2.5 px-3 text-right">Memo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No invoices found. Click &quot;Launch POS Counter&quot; to create a new sale.
                    </td>
                  </tr>
                ) : (
                  displayedInvoices.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-teal-700">
                        {sale.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {sale.date}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {sale.staffName}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {sale.customerName}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatPKR(sale.grandTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedSaleForView(sale)}
                          className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-teal-800 font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
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
              Quick Catalog Access
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Open full inventory catalog, batches &amp; shelf locations
            </p>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 hover:border-teal-600 bg-slate-50 text-slate-600 text-xs text-left transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">Browse all {medicines.length} medicines...</span>
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-200 rounded text-slate-700 shrink-0 ml-2">
                Open
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

      {/* Row 3: Live Store Medicines & Stock Availability Preview */}
      <div className="pro-card p-4 sm:p-5 rounded-2xl space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Pill className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700" />
              Store Medicines &amp; Live Stock ({medicines.length})
            </h3>
            <p className="text-xs text-slate-500">
              Real-time rates, shelf racks &amp; available quantities across the store
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={medSearch}
                onChange={e => setMedSearch(e.target.value)}
                placeholder="Filter medicine, generic, shelf..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[38px]"
              />
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs whitespace-nowrap min-h-[38px]"
            >
              Full Catalog &rarr;
            </button>
          </div>
        </div>

        {filteredMedicines.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No medicines matched your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {filteredMedicines.map(med => {
              const statusInfo = getMedicineStockStatus(med, settings?.expiryAlertDays ?? 90);
              const salePrice =
                med.fixedSalePrice && med.fixedSalePrice > 0
                  ? med.fixedSalePrice
                  : med.batches?.[0]?.salePrice || 0;

              return (
                <div
                  key={med.id}
                  className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                        {med.name}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] border shrink-0 ${statusInfo.badgeBg}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {med.genericName || med.category} {med.strength ? `· ${med.strength}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/70">
                    <div>
                      <span className="font-mono font-extrabold text-teal-800 block tabular-nums">
                        {formatPKR(salePrice)}
                      </span>
                      <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" /> {med.storageLocation || 'Shelf'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-black text-slate-900 tabular-nums block">
                        {med.totalQuantity} units
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {(med.batches || []).length} batch(es)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      <InvoiceModal
        sale={selectedSaleForView}
        settings={settings}
        isOpen={!!selectedSaleForView}
        onClose={() => setSelectedSaleForView(null)}
      />
    </div>
  );
};

