/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Layers,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  AlertOctagon,
  Clock,
  CheckCircle2,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';
import { Medicine, MedicineBatch } from '../../types/pharmacy';
import { useStore } from '../../context/StoreContext';
import { formatPKR, isExpired, isNearExpiry, getStoreTodayDateStr } from '../../utils/helpers';

interface BatchManagerModalProps {
  medicine: Medicine | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BatchManagerModal: React.FC<BatchManagerModalProps> = ({
  medicine,
  isOpen,
  onClose,
}) => {
  const { medicines, addBatch, deleteBatch, settings, suppliers } = useStore();
  const liveMedicine = medicines.find(m => m.id === medicine?.id) || medicine;

  const [showAddBatchForm, setShowAddBatchForm] = useState(false);
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [newPurchasePrice, setNewPurchasePrice] = useState('');
  const [newSalePrice, setNewSalePrice] = useState('');
  const [newWholesalePrice, setNewWholesalePrice] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newMfgDate, setNewMfgDate] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newSupplierId, setNewSupplierId] = useState(suppliers[0]?.id || '');

  if (!isOpen || !liveMedicine) return null;

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchNumber.trim()) {
      alert('Batch number is required.');
      return;
    }

    const selectedSup = suppliers.find(s => s.id === newSupplierId);
    const parsedQty = parseInt(newQuantity, 10) || 0;
    const parsedPurchase = parseFloat(newPurchasePrice) || 0;
    const parsedSale = parseFloat(newSalePrice) || 0;
    const parsedWholesale = parseFloat(newWholesalePrice) || parsedSale;

    addBatch(liveMedicine.id, {
      batchNumber: newBatchNumber.trim().toUpperCase(),
      purchasePrice: parsedPurchase,
      salePrice: parsedSale,
      wholesalePrice: parsedWholesale,
      quantity: parsedQty,
      initialQuantity: parsedQty,
      mfgDate: newMfgDate || getStoreTodayDateStr(),
      expiryDate: newExpiryDate,
      supplierId: selectedSup?.id,
      supplierName: selectedSup?.companyName,
      receivedDate: getStoreTodayDateStr(),
    });

    setShowAddBatchForm(false);
    setNewBatchNumber('');
    setNewQuantity('');
    setNewPurchasePrice('');
    setNewSalePrice('');
    setNewWholesalePrice('');
    setNewMfgDate('');
    setNewExpiryDate('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="font-bold text-sm text-white">
                Batch Manager: {liveMedicine.name}
              </h3>
              <p className="text-[11px] text-slate-300">
                FEFO Expiry Tracking • Total Units: {liveMedicine.totalQuantity}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          {/* Top Bar with Add Batch Trigger */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-700">
                Active Batches ({(liveMedicine.batches || []).length})
              </span>
              <p className="text-[11px] text-slate-500">
                Sorted by FEFO (First Expiry, First Out)
              </p>
            </div>
            {!showAddBatchForm && (
              <button
                type="button"
                onClick={() => {
                  setNewPurchasePrice(
                    liveMedicine.fixedPurchasePrice !== undefined ? String(liveMedicine.fixedPurchasePrice) : ''
                  );
                  setNewSalePrice(
                    liveMedicine.fixedSalePrice !== undefined ? String(liveMedicine.fixedSalePrice) : ''
                  );
                  setNewQuantity('');
                  setShowAddBatchForm(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> New Batch
              </button>
            )}
          </div>

          {/* Add Batch Form */}
          {showAddBatchForm && (
            <form onSubmit={handleCreateBatch} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="font-bold text-slate-800 text-xs">Register Additional Batch:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Batch Number *</label>
                  <input
                    type="text"
                    required
                    value={newBatchNumber}
                    onChange={e => setNewBatchNumber(e.target.value)}
                    placeholder="e.g. BAT-26F2"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Batch Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newQuantity}
                    onChange={e => setNewQuantity(e.target.value)}
                    placeholder="Enter qty"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Purchase Price (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newPurchasePrice}
                    onChange={e => setNewPurchasePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Retail Sale Price (PKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newSalePrice}
                    onChange={e => setNewSalePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-teal-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Mfg Date</label>
                  <input
                    type="date"
                    value={newMfgDate}
                    onChange={e => setNewMfgDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={newExpiryDate}
                    onChange={e => setNewExpiryDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBatchForm(false)}
                  className="px-3 py-1.5 bg-slate-200 rounded-lg font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg"
                >
                  Save Batch
                </button>
              </div>
            </form>
          )}

          {/* Batches Table */}
          <div className="space-y-2">
            {(liveMedicine.batches || []).length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                No active batches recorded. Add an opening batch.
              </div>
            ) : (
              (liveMedicine.batches || []).map(batch => {
                const expired = isExpired(batch.expiryDate);
                const nearExp = !expired && isNearExpiry(batch.expiryDate, settings.expiryAlertDays);

                return (
                  <div
                    key={batch.id}
                    className={`p-3 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      expired
                        ? 'bg-rose-950/10 border-rose-300'
                        : nearExp
                        ? 'bg-amber-50/70 border-amber-300'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900">
                          {batch.batchNumber}
                        </span>
                        {expired ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-white">
                            EXPIRED (Sale Locked)
                          </span>
                        ) : nearExp ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                            Near Expiry (&lt;{settings.expiryAlertDays}d)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Available Stock
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-600">
                        <span>
                          Qty: <strong className="text-slate-900">{batch.quantity}</strong> units
                        </span>
                        <span>•</span>
                        <span>
                          Purchase: <strong className="font-mono">{formatPKR(batch.purchasePrice)}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Sale: <strong className="font-mono text-teal-800">{formatPKR(batch.salePrice)}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-mono">
                        <span>Mfg: {batch.mfgDate}</span>
                        <span>•</span>
                        <span className={expired ? 'text-rose-700 font-bold' : nearExp ? 'text-amber-800 font-bold' : ''}>
                          Exp: {batch.expiryDate}
                        </span>
                        {batch.supplierName && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">Vendor: {batch.supplierName}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => {
                          if (confirm(`Delete batch ${batch.batchNumber} from ${liveMedicine.name}?`)) {
                            deleteBatch(liveMedicine.id, batch.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
