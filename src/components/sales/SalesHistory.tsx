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
import { formatPKR, exportToCSV } from '../../utils/helpers';
import { InvoiceModal } from '../pos/InvoiceModal';
import { SaleReturnModal } from '../pos/SaleReturnModal';

export const SalesHistory: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const { sales, saleReturns, settings, staffMembers } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string>('All');
  const [selectedPayment, setSelectedPayment] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

  const [selectedSaleForView, setSelectedSaleForView] = useState<Sale | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // If staff, default view their own sales unless admin
  const effectiveStaffSales = useMemo(() => {
    if (isAdmin) return sales;
    return sales.filter(s => s.staffId === currentUser?.id);
  }, [sales, isAdmin, currentUser]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter sales
  const filteredSales = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return effectiveStaffSales.filter(sale => {
      // Date filter
      if (dateFilter === 'today' && sale.date !== todayStr) return false;
      if (dateFilter === 'month' && !sale.date.startsWith(todayStr.substring(0, 7))) return false;

      // Staff filter
      if (selectedStaff !== 'All' && sale.staffId !== selectedStaff) return false;

      // Payment filter
      if (selectedPayment !== 'All' && sale.paymentMethod !== selectedPayment) return false;

      // Search match
      if (q) {
        const matchInv = sale.invoiceNumber.toLowerCase().includes(q);
        const matchCust = sale.customerName.toLowerCase().includes(q);
        const matchStaff = sale.staffName.toLowerCase().includes(q);
        const matchItem = sale.items.some(i => i.medicineName.toLowerCase().includes(q));
        if (!matchInv && !matchCust && !matchStaff && !matchItem) return false;
      }

      return true;
    });
  }, [effectiveStaffSales, searchQuery, selectedStaff, selectedPayment, dateFilter, todayStr]);

  // Aggregate totals
  const totalVolume = filteredSales.reduce((sum, s) => sum + s.grandTotal, 0);
  const totalDiscounts = filteredSales.reduce((sum, s) => sum + s.discountTotal, 0);

  const handleExportCSV = () => {
    const rows = filteredSales.map(s => ({
      InvoiceNumber: s.invoiceNumber,
      Date: s.date,
      Time: s.time,
      StaffName: s.staffName,
      CustomerName: s.customerName,
      CustomerPhone: s.customerPhone || 'N/A',
      ItemsCount: s.items.length,
      Subtotal: s.subtotal,
      Discount: s.discountTotal,
      Tax: s.taxTotal,
      GrandTotal: s.grandTotal,
      PaymentMethod: s.paymentMethod,
      Status: s.status,
    }));
    exportToCSV(`Sales_History_${new Date().toISOString().split('T')[0]}`, rows);
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal-600" />
            {isAdmin ? 'Store Sales Transactions & Customer Invoices' : 'My Shift Sales Log'}
          </h3>
          <p className="text-xs text-slate-500">
            Audit history of completed cash memos, payment types, and returns
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReturnModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" /> Sale Return / Refund
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Filtered Total Volume
          </span>
          <h4 className="text-xl font-black text-slate-900 mt-1">
            {formatPKR(totalVolume)}
          </h4>
          <span className="text-[10px] text-slate-400">{filteredSales.length} invoices in view</span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Discounts Granted
          </span>
          <h4 className="text-xl font-black text-emerald-700 mt-1">
            {formatPKR(totalDiscounts)}
          </h4>
          <span className="text-[10px] text-slate-400">Authorized promo & patient concessions</span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Returns Processed
          </span>
          <h4 className="text-xl font-black text-amber-700 mt-1">
            {saleReturns.length} memo{saleReturns.length !== 1 ? 's' : ''}
          </h4>
          <span className="text-[10px] text-slate-400">Total refunded: {formatPKR(saleReturns.reduce((sum, r) => sum + r.totalRefund, 0))}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, customer..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as any)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white"
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
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white"
            >
              <option value="All">All Payment Modes</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="EasyPaisa">EasyPaisa</option>
              <option value="JazzCash">JazzCash</option>
            </select>
          </div>

          {isAdmin && (
            <div>
              <select
                value={selectedStaff}
                onChange={e => setSelectedStaff(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white"
              >
                <option value="All">All Staff / Sellers</option>
                {staffMembers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Invoice #</th>
                <th className="py-3 px-3">Date & Time</th>
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
                    <td className="py-3 px-3 font-mono font-bold text-teal-700">
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
                    <td className="py-3 px-3 text-right font-mono text-emerald-700">
                      {sale.discountTotal > 0 ? `-${formatPKR(sale.discountTotal)}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
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
                        className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-xs inline-flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-600" />
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
