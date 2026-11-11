/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  CreditCard,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Purchase } from '../../types/pharmacy';
import { formatPKR, exportToCSV } from '../../utils/helpers';
import { NewPurchaseModal } from './NewPurchaseModal';

export const PurchaseList: React.FC = () => {
  const { purchases, recordPurchasePayment } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<Purchase | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [payingPurchaseId, setPayingPurchaseId] = useState<string | null>(null);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return purchases.filter(p => {
      if (statusFilter !== 'All' && p.paymentStatus !== statusFilter) return false;

      if (q) {
        const matchNum = p.purchaseNumber.toLowerCase().includes(q);
        const matchSup = p.supplierName.toLowerCase().includes(q);
        const matchInv = p.invoiceNumber.toLowerCase().includes(q);
        const matchMed = p.items.some(i => i.medicineName.toLowerCase().includes(q));
        if (!matchNum && !matchSup && !matchInv && !matchMed) return false;
      }

      return true;
    });
  }, [purchases, searchQuery, statusFilter]);

  // Aggregations
  const totalPurchased = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalPaid = purchases.reduce((sum, p) => sum + p.paidAmount, 0);
  const totalPending = purchases.reduce((sum, p) => sum + p.balanceAmount, 0);

  const handleExportCSV = () => {
    const rows = filteredPurchases.map(p => ({
      PurchaseOrder: p.purchaseNumber,
      Supplier: p.supplierName,
      SupplierBill: p.invoiceNumber,
      PurchaseDate: p.purchaseDate,
      ItemsCount: p.items.length,
      TotalAmount: p.totalAmount,
      PaidAmount: p.paidAmount,
      BalanceAmount: p.balanceAmount,
      PaymentStatus: p.paymentStatus,
      PaymentMethod: p.paymentMethod,
      ReceivedBy: p.receivedBy,
    }));
    exportToCSV(`Purchases_History_${new Date().toISOString().split('T')[0]}`, rows);
  };

  const handlePayBalance = (purchase: Purchase) => {
    if (paymentAmount <= 0) return;
    recordPurchasePayment(purchase.id, paymentAmount);
    setPayingPurchaseId(null);
    setPaymentAmount(0);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Truck className="w-5 h-5 text-teal-600" />
            Supplier Purchases & Inventory Restocking
          </h3>
          <p className="text-xs text-slate-500">
            Track vendor purchase bills, stock arrival, and outstanding supplier payments
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Record New Purchase
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Inflow Purchases
          </span>
          <h4 className="text-xl font-black text-slate-900 mt-1">
            {formatPKR(totalPurchased)}
          </h4>
          <span className="text-[10px] text-slate-400">{purchases.length} supplier orders</span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Paid to Vendors
          </span>
          <h4 className="text-xl font-black text-emerald-700 mt-1">
            {formatPKR(totalPaid)}
          </h4>
          <span className="text-[10px] text-slate-400">Cleared through banking & cash</span>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Outstanding Vendor Payable
          </span>
          <h4 className="text-xl font-black text-rose-700 mt-1">
            {formatPKR(totalPending)}
          </h4>
          <span className="text-[10px] text-slate-400">Due for credit purchases</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search PO #, supplier, medicine..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white font-semibold"
            >
              <option value="All">All Payment Statuses</option>
              <option value="Paid">Fully Paid</option>
              <option value="Partial">Partial Payments</option>
              <option value="Pending">Pending / Unpaid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">PO Number</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Supplier Name</th>
                <th className="py-3 px-3">Supplier Bill #</th>
                <th className="py-3 px-3 text-center">Items</th>
                <th className="py-3 px-3 text-right">Total (PKR)</th>
                <th className="py-3 px-3 text-right">Paid (PKR)</th>
                <th className="py-3 px-3 text-right">Balance</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No purchase orders found matching your search.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-teal-800">
                      {p.purchaseNumber}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                      {p.purchaseDate}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {p.supplierName}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                      {p.invoiceNumber}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold">
                      {p.items.length} item{p.items.length !== 1 ? 's' : ''}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {formatPKR(p.totalAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-700 font-semibold">
                      {formatPKR(p.paidAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                      {p.balanceAmount > 0 ? formatPKR(p.balanceAmount) : '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.paymentStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.paymentStatus === 'Partial'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.balanceAmount > 0 && (
                          <button
                            onClick={() => {
                              setPayingPurchaseId(p.id);
                              setPaymentAmount(p.balanceAmount);
                            }}
                            className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-[11px]"
                          >
                            Pay Balance
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedPurchaseDetails(p)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Balance Popover */}
      {payingPurchaseId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-2xl">
            <h4 className="font-bold text-sm text-slate-900 mb-2">Record Supplier Balance Payment</h4>
            <p className="text-xs text-slate-500 mb-3">
              Enter the amount disbursed to clear outstanding supplier invoice balance.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Payment Amount (PKR)</label>
                <input
                  type="number"
                  min="1"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setPayingPurchaseId(null)}
                  className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const target = purchases.find(p => p.id === payingPurchaseId);
                    if (target) handlePayBalance(target);
                  }}
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg"
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Item Details Modal */}
      {selectedPurchaseDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  {selectedPurchaseDetails.purchaseNumber} Details
                </h4>
                <p className="text-[11px] text-slate-500">
                  Vendor: {selectedPurchaseDetails.supplierName} • Bill: {selectedPurchaseDetails.invoiceNumber}
                </p>
              </div>
              <button
                onClick={() => setSelectedPurchaseDetails(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-bold text-slate-700 block">Formulations Received:</span>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {selectedPurchaseDetails.items.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">{item.medicineName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Batch: {item.batchNumber} • Exp: {item.expiryDate}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900 block">
                        {item.quantity} units @ {formatPKR(item.purchasePrice)}
                      </span>
                      <span className="text-[10px] text-teal-700 font-mono">
                        Total: {formatPKR(item.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-slate-200">
              <span>Total Invoice Amount:</span>
              <span className="font-mono text-base text-slate-900">
                {formatPKR(selectedPurchaseDetails.totalAmount)}
              </span>
            </div>

            <div className="text-right">
              <button
                onClick={() => setSelectedPurchaseDetails(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Purchase Modal */}
      <NewPurchaseModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
      />
    </div>
  );
};
