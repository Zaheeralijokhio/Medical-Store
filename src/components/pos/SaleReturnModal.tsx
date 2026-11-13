/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  RotateCcw,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
  Package,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatPKR } from '../../utils/helpers';
import { Sale } from '../../types/pharmacy';

interface SaleReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SaleReturnModal: React.FC<SaleReturnModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { sales, processSaleReturn } = useStore();

  const [searchInvoice, setSearchInvoice] = useState('');
  const [matchedSale, setMatchedSale] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<{
    medicineId: string;
    batchId: string;
    medicineName: string;
    batchNumber: string;
    unitPrice: number;
    maxQty: number;
    quantity: number;
    reason: string;
  }[]>([]);
  const [returnReasonGlobal, setReturnReasonGlobal] = useState('Doctor changed prescription');
  const [notes, setNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSearchSale = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const query = searchInvoice.trim().toUpperCase();
    if (!query) return;

    const found = sales.find(s => String(s?.invoiceNumber || '').toUpperCase() === query);
    if (!found) {
      setStatusMessage({ type: 'error', text: `Invoice "${query}" not found in sales history.` });
      setMatchedSale(null);
      setReturnItems([]);
      return;
    }

    if (found.status === 'returned') {
      setStatusMessage({ type: 'error', text: `Invoice "${query}" has already been returned.` });
    }

    setMatchedSale(found);
    setReturnItems(
      (found.items || []).map(i => ({
        medicineId: i.medicineId,
        batchId: i.batchId,
        medicineName: i.medicineName || 'Medicine',
        batchNumber: i.batchNumber || 'Batch',
        unitPrice: Number(i.unitPrice || 0),
        maxQty: Number(i.quantity || 0),
        quantity: 0,
        reason: 'Doctor changed prescription',
      }))
    );
  };

  const handleQtyChange = (index: number, qty: number) => {
    const updated = [...returnItems];
    const max = updated[index].maxQty;
    updated[index].quantity = Math.max(0, Math.min(qty, max));
    setReturnItems(updated);
  };

  const totalRefundAmount = returnItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const handleSubmitReturn = () => {
    if (!matchedSale) return;
    const itemsToReturn = returnItems
      .filter(i => i.quantity > 0)
      .map(i => ({
        medicineId: i.medicineId,
        batchId: i.batchId,
        quantity: i.quantity,
        refundAmount: i.quantity * i.unitPrice,
        reason: i.reason || returnReasonGlobal,
      }));

    if (itemsToReturn.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please specify a return quantity of at least 1 item.' });
      return;
    }

    const res = processSaleReturn(matchedSale.id, itemsToReturn, notes);
    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Return processed! Refunded ${formatPKR(totalRefundAmount)} and restored stock to inventory.`,
      });
      setTimeout(() => {
        onClose();
      }, 2000);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to process return.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm text-white">
                Process Sale Return & Restock
              </h3>
              <p className="text-[11px] text-slate-300">
                Restores batch inventory and issues customer refund memo
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {statusMessage && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2 font-medium ${
                statusMessage.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Search by Invoice # */}
          <form onSubmit={handleSearchSale} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchInvoice}
                onChange={e => setSearchInvoice(e.target.value)}
                placeholder="Enter Invoice # (e.g. INV-2026-00101)"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold transition-colors"
            >
              Find Invoice
            </button>
          </form>

          {/* Matched Sale Details */}
          {matchedSale && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <span className="font-mono font-bold text-teal-800 text-sm">
                    {matchedSale.invoiceNumber}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Sold on: {matchedSale.date} at {matchedSale.time} by {matchedSale.staffName}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer</span>
                  <span className="font-bold text-slate-800">{matchedSale.customerName}</span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5 uppercase text-[10px] tracking-wider">
                  Select Quantities to Return:
                </label>
                <div className="space-y-2">
                  {returnItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-800 block truncate">
                          {item.medicineName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Batch: {item.batchNumber} • Original Qty: {item.maxQty} @ {formatPKR(item.unitPrice)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-500">Return Qty:</span>
                        <input
                          type="number"
                          min="0"
                          max={item.maxQty}
                          value={item.quantity}
                          onChange={e => handleQtyChange(idx, parseInt(e.target.value) || 0)}
                          className="w-16 p-1 border border-slate-200 rounded text-center font-bold font-mono text-xs"
                        />
                        <span className="font-mono font-bold text-slate-900 w-16 text-right">
                          {formatPKR(item.quantity * item.unitPrice)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reason Selector */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Return Reason</label>
                <select
                  value={returnReasonGlobal}
                  onChange={e => setReturnReasonGlobal(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  <option value="Doctor changed prescription">Doctor changed prescription</option>
                  <option value="Customer purchased wrong strength/medicine">Customer purchased wrong strength/medicine</option>
                  <option value="Packaging intact & customer changed mind">Packaging intact & customer changed mind</option>
                  <option value="Adverse reaction or allergy reported">Adverse reaction or allergy reported</option>
                  <option value="Dispenser packing error">Dispenser packing error</option>
                </select>
              </div>

              {/* Total Refund Banner */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between font-bold text-amber-900">
                <span>Calculated Refund to Customer:</span>
                <span className="text-base font-mono font-black">{formatPKR(totalRefundAmount)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!matchedSale || totalRefundAmount === 0}
              onClick={handleSubmitReturn}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-bold rounded-xl transition-colors shadow-xs"
            >
              Confirm Refund & Restore Stock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
