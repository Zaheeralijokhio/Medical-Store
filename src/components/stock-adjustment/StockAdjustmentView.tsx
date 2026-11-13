/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Plus,
  AlertTriangle,
  History,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  Search,
  X,
  FileText,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { AdjustmentType } from '../../types/pharmacy';

export const StockAdjustmentView: React.FC = () => {
  const { medicines, adjustments, recordStockAdjustment } = useStore();
  const { currentUser } = useAuth();

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState(medicines[0]?.id || '');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [adjustedQty, setAdjustedQty] = useState<number>(-1);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('damage');
  const [reason, setReason] = useState('');
  const [searchLog, setSearchLog] = useState('');

  const selectedMed = medicines.find(m => m.id === selectedMedId);
  const activeBatches = selectedMed?.batches || [];
  const selectedBatch = activeBatches.find(b => b.id === selectedBatchId) || activeBatches[0];

  const handleOpenModal = () => {
    if (medicines.length > 0) {
      setSelectedMedId(medicines[0].id);
      if ((medicines[0].batches || []).length > 0) {
        setSelectedBatchId(medicines[0].batches[0].id);
      }
    }
    setAdjustedQty(-1);
    setAdjustmentType('damage');
    setReason('');
    setShowAdjustModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMed || !selectedBatch) {
      alert('Please select a valid medicine and batch.');
      return;
    }

    if (!reason.trim()) {
      alert('A clinical or inventory reason must be specified for the non-editable audit record.');
      return;
    }

    const res = recordStockAdjustment({
      medicineId: selectedMed.id,
      batchId: selectedBatch.id,
      adjustedQuantity: Number(adjustedQty),
      adjustmentType,
      reason: reason.trim(),
    });

    if (res.success) {
      setShowAdjustModal(false);
    } else {
      alert(res.error || 'Adjustment failed');
    }
  };

  const filteredLogs = adjustments.filter(adj => {
    if (!searchLog) return true;
    const q = searchLog.toLowerCase();
    return (
      adj.medicineName.toLowerCase().includes(q) ||
      adj.batchNumber.toLowerCase().includes(q) ||
      adj.reason.toLowerCase().includes(q) ||
      adj.performedByName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-teal-600" />
            Stock Audit, Reconciliation & Damage Records
          </h3>
          <p className="text-xs text-slate-500">
            Immutable audit trail for physical inventory counts, broken glass, leaked syrups, and expired disposals
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" /> Perform Stock Adjustment
        </button>
      </div>

      {/* Audit Log Overview */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchLog}
            onChange={e => setSearchLog(e.target.value)}
            placeholder="Search audit trail by medicine, batch number, reason, pharmacist..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Adjustments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Date & Timestamp</th>
                <th className="py-3 px-3">Medicine Formulation</th>
                <th className="py-3 px-3">Batch Number</th>
                <th className="py-3 px-3 text-center">Previous Qty</th>
                <th className="py-3 px-3 text-center">Change</th>
                <th className="py-3 px-3 text-center">New Qty</th>
                <th className="py-3 px-3">Adjustment Type</th>
                <th className="py-3 px-3">Audit Reason</th>
                <th className="py-3 px-3">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No stock adjustments recorded. Inventory matches physical shelf counts.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {log.medicineName}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-teal-800">
                      {log.batchNumber}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-600">
                      {log.previousQuantity}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          log.adjustedQuantity > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.adjustedQuantity > 0 ? `+${log.adjustedQuantity}` : log.adjustedQuantity}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                      {log.newQuantity}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {log.adjustmentType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 max-w-xs">
                      {log.reason}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {log.performedByName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Perform Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-teal-600" /> Stock Adjustment Protocol
              </h4>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select Medicine Formulation *</label>
                <select
                  value={selectedMedId}
                  onChange={e => {
                    setSelectedMedId(e.target.value);
                    const m = medicines.find(med => med.id === e.target.value);
                    if (m && (m.batches || []).length > 0) {
                      setSelectedBatchId(m.batches[0].id);
                    }
                  }}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  {medicines.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.strength}) - Available: {m.totalQuantity}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select Specific Batch *</label>
                <select
                  value={selectedBatchId || selectedBatch?.id}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                >
                  {activeBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      Batch: {b.batchNumber} (Current Qty: {b.quantity} | Exp: {b.expiryDate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Adjustment Reason Category *</label>
                <select
                  value={adjustmentType}
                  onChange={e => setAdjustmentType(e.target.value as AdjustmentType)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold"
                >
                  <option value="damage">Damaged Medicine / Broken Packaging</option>
                  <option value="expired">Expired Stock Removal (Safe Disposal)</option>
                  <option value="missing">Missing / Pilferage Shortage</option>
                  <option value="physical_verification">Physical Stock Count Reconciliation</option>
                  <option value="increase">Stock Inward / Unrecorded Inventory</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Quantity Change (+ to increase, - to decrease) *
                </label>
                <input
                  type="number"
                  required
                  value={adjustedQty}
                  onChange={e => setAdjustedQty(parseInt(e.target.value) || 0)}
                  placeholder="-5"
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold text-sm"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Current batch stock: <strong>{selectedBatch?.quantity || 0}</strong>. Resulting stock will be:{' '}
                  <strong className="text-slate-900">
                    {Math.max(0, (selectedBatch?.quantity || 0) + Number(adjustedQty))}
                  </strong>
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Audit Justification & Memo *</label>
                <textarea
                  rows={2}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Amber bottle broke during shelf restocking; physical audit verified."
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 py-2 bg-slate-100 rounded-lg font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold"
                >
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
