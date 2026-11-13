/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Search,
  Download,
  Eye,
  RotateCcw,
  Calendar,
  Filter,
  User,
  CreditCard,
  Banknote,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { Sale } from '../../types/pharmacy';
import { formatPKR, exportToCSV, getStoreTodayDateStr } from '../../utils/helpers';
import { InvoiceModal } from '../pos/InvoiceModal';
import { SaleReturnModal } from '../pos/SaleReturnModal';

export const SalesHistory: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const { sales, saleReturns, settings, staffMembers } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'mine'>('all');
  const [selectedStaff, setSelectedStaff] = useState<string>('All');
  const [selectedPayment, setSelectedPayment] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

  const [selectedSaleForView, setSelectedSaleForView] = useState<Sale | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);

  const mySalesCount = useMemo(
    () => (sales || []).filter(s => s && s.staffId === currentUser?.id).length,
    [sales, currentUser?.id]
  );

  // Show all store sales by default; allow switching to "My Invoices"
  const effectiveStaffSales = useMemo(() => {
    if (scopeFilter === 'mine' && currentUser?.id) {
      return (sales || []).filter(s => s.staffId === currentUser.id);
    }
    return sales || [];
  }, [sales, scopeFilter, currentUser?.id]);

  const todayStr = useMemo(() => getStoreTodayDateStr(), []);

  // Filter sales
  const filteredSales = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return effectiveStaffSales.filter(sale => {
      // Date filter
      const saleDate = String(sale?.date || '');
      if (dateFilter === 'today' && saleDate !== todayStr) return false;
      if (dateFilter === 'month' && !saleDate.startsWith(todayStr.substring(0, 7))) return false;

      // Staff filter
      if (selectedStaff !== 'All' && sale.staffId !== selectedStaff) return false;

      // Payment filter
      if (selectedPayment !== 'All' && sale.paymentMethod !== selectedPayment) return false;

      // Search match
      if (q) {
        const matchInv = String(sale.invoiceNumber || '').toLowerCase().includes(q);
        const matchCust = String(sale.customerName || '').toLowerCase().includes(q);
        const matchStaff = String(sale.staffName || '').toLowerCase().includes(q);
        const matchItem = (sale.items || []).some(i => String(i?.medicineName || '').toLowerCase().includes(q));
        if (!matchInv && !matchCust && !matchStaff && !matchItem) return false;
      }

      return true;
    });
  }, [effectiveStaffSales, searchQuery, selectedStaff, selectedPayment, dateFilter, todayStr]);

  // Aggregate totals
  const totalVolume = filteredSales.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);
  const totalDiscounts = filteredSales.reduce((sum, s) => sum + Number(s.discountTotal || 0), 0);

  const handleExportCSV = () => {
    const rows = filteredSales.map(s => ({
      InvoiceNumber: s.invoiceNumber,
      Date: s.date,
      Time: s.time,
      StaffName: s.staffName,
      CustomerName: s.customerName,
      CustomerPhone: s.customerPhone || 'N/A',
      ItemsCount: (s.items || []).length,
      Subtotal: s.subtotal,
      Discount: s.discountTotal,
      Tax: s.taxTotal,
      GrandTotal: s.grandTotal,
      PaymentMethod: s.paymentMethod,
      Status: s.status,
    }));
    exportToCSV(`Sales_History_${getStoreTodayDateStr()}`, rows);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pro-card p-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#0F766E]" />
            Store Sales Transactions &amp; Customer Invoices
          </h3>
          <p className="text-xs text-slate-500">
            Audit history of completed cash memos, payment types, and returns
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {!isAdmin && (
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setScopeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  scopeFilter === 'all'
                    ? 'bg-[#0F766E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Store ({sales.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('mine')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  scopeFilter === 'mine'
                    ? 'bg-[#0F766E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Shift ({mySalesCount})
              </button>
            </div>
          )}

          <button
            onClick={() => setShowReturnModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 transition-colors min-h-[42px]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" /> Sale Return / Refund
          </button>

          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors min-h-[42px]"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 pro-card">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Filtered Total Volume
          </span>
          <h4 className="text-xl font-black text-slate-900 mt-1 tabular-nums">
            {formatPKR(totalVolume)}
          </h4>
          <span className="text-[11px] text-slate-400">{filteredSales.length} invoices in view</span>
        </div>

        <div className="p-4 pro-card">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Discounts Granted
          </span>
          <h4 className="text-xl font-black text-emerald-700 mt-1 tabular-nums">
            {formatPKR(totalDiscounts)}
          </h4>
          <span className="text-[11px] text-slate-400">Authorized promo &amp; patient concessions</span>
        </div>

        <div className="p-4 pro-card">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Returns Processed
          </span>
          <h4 className="text-xl font-black text-amber-700 mt-1 tabular-nums">
            {saleReturns.length} memo{saleReturns.length !== 1 ? 's' : ''}
          </h4>
          <span className="text-[11px] text-slate-400 tabular-nums">
            Total refunded: {formatPKR(saleReturns.reduce((sum, r) => sum + r.totalRefund, 0))}
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 pro-card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, customer..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
            />
          </div>

          <div>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as any)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white min-h-[40px]"
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
              <option value="month">Current Month</option>
            </select>
          </div>

          <div>
            <select
              value={selectedPayment}
              onChange={e => setSelectedPayment(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white min-h-[40px]"
            >
              <option value="All">All Payment Modes</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="EasyPaisa">EasyPaisa</option>
              <option value="JazzCash">JazzCash</option>
            </select>
          </div>

          <div>
            <select
              value={selectedStaff}
              onChange={e => setSelectedStaff(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white min-h-[40px]"
            >
              <option value="All">All Staff / Sellers</option>
              {staffMembers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* MOBILE CARDS VIEW (<768px) */}
      <div className="md:hidden space-y-3">
        {filteredSales.length === 0 ? (
          <div className="py-12 text-center text-slate-400 pro-card">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No sales invoices found matching your filters.</p>
          </div>
        ) : (
          filteredSales.map(sale => (
            <div key={sale.id} className="pro-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-mono font-bold text-xs text-[#0F766E] block">
                    {sale.invoiceNumber}
                  </span>
                  <h4 className="font-bold text-sm text-slate-900 truncate mt-0.5">
                    {sale.customerName}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {sale.date} · {sale.time} · {sale.staffName}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-black text-base text-slate-900 tabular-nums block">
                    {formatPKR(sale.grandTotal)}
                  </span>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      sale.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {sale.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-slate-600">
                  <span className="font-semibold text-slate-800">{sale.items.length}</span> items ·{' '}
                  <span className="font-semibold text-slate-800">{sale.paymentMethod}</span>
                </div>
                {sale.discountTotal > 0 && (
                  <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                    Disc: -{formatPKR(sale.discountTotal)}
                  </span>
                )}
              </div>

              <button
                onClick={() => setSelectedSaleForView(sale)}
                className="w-full py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#0F766E] font-bold text-xs flex items-center justify-center gap-1.5 min-h-[42px] transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>View Cash Memo / Print</span>
              </button>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP TABLE (>=768px) */}
      <div className="hidden md:block pro-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Invoice #</th>
                <th className="py-3 px-3">Date &amp; Time</th>
                <th className="py-3 px-3">Staff Dispenser</th>
                <th className="py-3 px-3">Customer / Patient</th>
                <th className="py-3 px-3 text-center">Formulations</th>
                <th className="py-3 px-3">Payment</th>
                <th className="py-3 px-3 text-right">Discount</th>
                <th className="py-3 px-3 text-right">Grand Total (PKR)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No sales invoices found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#0F766E]">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                      {sale.date} <span className="text-slate-400">{sale.time}</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {sale.staffName}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 block">{sale.customerName}</span>
                      {sale.customerPhone && (
                        <span className="text-[10px] text-slate-400 font-mono">{sale.customerPhone}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700">
                      {sale.discountTotal > 0 ? `-${formatPKR(sale.discountTotal)}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 text-sm">
                      {formatPKR(sale.grandTotal)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sale.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedSaleForView(sale)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#0F766E] font-semibold text-xs inline-flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Memo</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal for reprint / view */}
      <InvoiceModal
        sale={selectedSaleForView}
        settings={settings}
        isOpen={!!selectedSaleForView}
        onClose={() => setSelectedSaleForView(null)}
      />

      {/* Return Modal */}
      <SaleReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
      />
    </div>
  );
};
