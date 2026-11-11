/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Truck,
  Plus,
  Trash2,
  Calendar,
  Building2,
  CheckCircle2,
  PackagePlus,
  FileSpreadsheet,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { PurchaseItem, PaymentMethod, MedicineType } from '../../types/pharmacy';
import { formatPKR } from '../../utils/helpers';

interface NewPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewPurchaseModal: React.FC<NewPurchaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const { suppliers, medicines, addPurchase, addMedicine } = useStore();

  const [inwardMode, setInwardMode] = useState<'existing' | 'new_formulation'>('existing');

  // Supplier & General Purchase Details
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Partial' | 'Pending'>('Paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Option 1: Existing Medicines Line Items
  const [items, setItems] = useState<PurchaseItem[]>([
    {
      medicineId: medicines[0]?.id || '',
      medicineName: medicines[0]?.name || '',
      batchNumber: `BAT-${new Date().getFullYear().toString().slice(-2)}${Math.floor(100 + Math.random() * 900)}`,
      quantity: 100,
      purchasePrice: 15,
      salePrice: 20,
      mfgDate: '2025-01-01',
      expiryDate: '2028-01-01',
      total: 1500,
    },
  ]);

  // Option 2: New Formulation State
  const [newMedName, setNewMedName] = useState('');
  const [newGenericName, setNewGenericName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newCategory, setNewCategory] = useState('Antibiotics');
  const [newManufacturer, setNewManufacturer] = useState('GSK Pakistan');
  const [newMedType, setNewMedType] = useState<MedicineType>('Tablet');
  const [newStrength, setNewStrength] = useState('500mg');
  const [newPackingSize, setNewPackingSize] = useState('10 Tablets / Strip');
  const [newBarcode, setNewBarcode] = useState(`${Math.floor(100000000000 + Math.random() * 900000000000)}`);
  const [newStorageLocation, setNewStorageLocation] = useState('Rack A-1');
  const [newBatchNumber, setNewBatchNumber] = useState(`BAT-${new Date().getFullYear().toString().slice(-2)}${Math.floor(100 + Math.random() * 900)}`);
  const [newQty, setNewQty] = useState(100);
  const [newCostPrice, setNewCostPrice] = useState(25);
  const [newSalePrice, setNewSalePrice] = useState(35);
  const [newExpiryDate, setNewExpiryDate] = useState('2028-01-01');

  if (!isOpen) return null;

  // Option 1 Helpers
  const handleAddItem = () => {
    const med = medicines[0];
    setItems(prev => [
      ...prev,
      {
        medicineId: med?.id || '',
        medicineName: med?.name || '',
        batchNumber: `BAT-${new Date().getFullYear().toString().slice(-2)}${Math.floor(100 + Math.random() * 900)}`,
        quantity: 50,
        purchasePrice: 10,
        salePrice: 15,
        mfgDate: '2025-01-01',
        expiryDate: '2028-01-01',
        total: 500,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    if (field === 'medicineId') {
      const selectedMed = medicines.find(m => m.id === value);
      if (selectedMed) {
        item.medicineName = selectedMed.name;
        const b = selectedMed.batches[0];
        if (b) {
          item.purchasePrice = b.purchasePrice;
          item.salePrice = b.salePrice;
        }
      }
    }

    if (field === 'quantity' || field === 'purchasePrice') {
      const q = field === 'quantity' ? Number(value) : item.quantity;
      const p = field === 'purchasePrice' ? Number(value) : item.purchasePrice;
      item.total = q * p;
    }

    updated[index] = item;
    setItems(updated);
  };

  const totalPurchaseAmount = inwardMode === 'existing'
    ? items.reduce((sum, i) => sum + i.total, 0)
    : newQty * newCostPrice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const sup = suppliers.find(s => s.id === supplierId);
    if (!sup) {
      alert('Please select a supplier.');
      return;
    }

    const actualPaid = paymentStatus === 'Paid' ? totalPurchaseAmount : paymentStatus === 'Pending' ? 0 : paidAmount;
    const invNumber = supplierInvoiceNumber.trim() || `BILL-${Date.now().toString().slice(-5)}`;

    if (inwardMode === 'existing') {
      if (items.length === 0) {
        alert('Add at least one medicine item to the purchase.');
        return;
      }

      addPurchase({
        supplierId: sup.id,
        supplierName: sup.companyName,
        invoiceNumber: invNumber,
        purchaseDate,
        items,
        totalAmount: totalPurchaseAmount,
        paidAmount: actualPaid,
        balanceAmount: Math.max(0, totalPurchaseAmount - actualPaid),
        paymentStatus,
        paymentMethod,
        receivedBy: currentUser?.fullName || 'Dr. Abdul Rehman (Owner)',
        notes,
      });
    } else {
      // Option 2: Register New Medicine + Purchase
      if (!newMedName.trim() || !newGenericName.trim()) {
        alert('Medicine name and generic formula are required.');
        return;
      }

      const generatedCode = `MED-${Math.floor(1000 + Math.random() * 9000)}`;

      addMedicine(
        {
          code: generatedCode,
          name: newMedName.trim(),
          genericName: newGenericName.trim(),
          brandName: newBrandName.trim() || newMedName.trim(),
          category: newCategory,
          manufacturer: newManufacturer,
          medicineType: newMedType,
          strength: newStrength.trim(),
          packingSize: newPackingSize.trim(),
          barcode: newBarcode.trim(),
          minStockLevel: 20,
          storageLocation: newStorageLocation.trim(),
          description: `Registered during supplier purchase from ${sup.companyName}`,
          batches: [],
          status: 'active',
          requiresPrescription: false,
        },
        {
          batchNumber: newBatchNumber.trim(),
          purchasePrice: newCostPrice,
          salePrice: newSalePrice,
          quantity: newQty,
          expiryDate: newExpiryDate,
          supplierId: sup.id,
          supplierName: sup.companyName,
        }
      );

      // Record corresponding purchase record
      addPurchase({
        supplierId: sup.id,
        supplierName: sup.companyName,
        invoiceNumber: invNumber,
        purchaseDate,
        items: [
          {
            medicineId: generatedCode,
            medicineName: newMedName.trim(),
            batchNumber: newBatchNumber.trim(),
            quantity: newQty,
            purchasePrice: newCostPrice,
            salePrice: newSalePrice,
            mfgDate: '2025-01-01',
            expiryDate: newExpiryDate,
            total: newQty * newCostPrice,
          },
        ],
        totalAmount: totalPurchaseAmount,
        paidAmount: actualPaid,
        balanceAmount: Math.max(0, totalPurchaseAmount - actualPaid),
        paymentStatus,
        paymentMethod,
        receivedBy: currentUser?.fullName || 'Dr. Abdul Rehman (Owner)',
        notes: `New formulation registered with purchase: ${newMedName}`,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="font-bold text-sm text-white">
                Record Supplier Purchase & Stock Inflow
              </h3>
              <p className="text-[11px] text-slate-300">
                Increases inventory batch quantities, calculates profit margin %, and updates supplier balance
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInwardMode('existing')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              inwardMode === 'existing'
                ? 'bg-white text-teal-800 shadow-xs border border-teal-600/30'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-600" />
            <span>Option 1: Inward Stock for Existing Medicines</span>
          </button>

          <button
            type="button"
            onClick={() => setInwardMode('new_formulation')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              inwardMode === 'new_formulation'
                ? 'bg-white text-teal-800 shadow-xs border border-teal-600/30'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <PackagePlus className="w-4 h-4 text-emerald-600" />
            <span>Option 2: Register New Medicine on the Fly</span>
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          {/* Supplier & Invoice Info */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Supplier Company *</label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Supplier Invoice / Bill # *</label>
              <input
                type="text"
                required
                value={supplierInvoiceNumber}
                onChange={e => setSupplierInvoiceNumber(e.target.value)}
                placeholder="e.g. GSK-INV-9921"
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Purchase Date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
              >
                <option value="Paid">Fully Paid</option>
                <option value="Partial">Partial Payment</option>
                <option value="Pending">Pending / On Credit</option>
              </select>
            </div>
          </div>

          {/* Mode 1: Existing Medicines Table */}
          {inwardMode === 'existing' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Purchased Items & Batch Margin Analysis
                </h4>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Another Item
                </button>
              </div>

              <div className="space-y-2">
                {items.map((item, index) => {
                  const marginPct = item.salePrice > 0
                    ? (((item.salePrice - item.purchasePrice) / item.salePrice) * 100).toFixed(1)
                    : '0';

                  return (
                    <div
                      key={index}
                      className="p-3 bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-3">
                        <label className="text-[10px] text-slate-400 block">Medicine</label>
                        <select
                          value={item.medicineId}
                          onChange={e => handleItemChange(index, 'medicineId', e.target.value)}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                        >
                          {medicines.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.strength})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-slate-400 block">Batch Number</label>
                        <input
                          type="text"
                          required
                          value={item.batchNumber}
                          onChange={e => handleItemChange(index, 'batchNumber', e.target.value)}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="text-[10px] text-slate-400 block">Qty</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs text-center font-bold"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="text-[10px] text-slate-400 block">Cost (PKR)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={item.purchasePrice}
                          onChange={e => handleItemChange(index, 'purchasePrice', parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="text-[10px] text-slate-400 block">Sale (PKR)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={item.salePrice}
                          onChange={e => handleItemChange(index, 'salePrice', parseFloat(e.target.value) || 0)}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-teal-800"
                        />
                      </div>

                      <div className="sm:col-span-1 text-center">
                        <label className="text-[10px] text-slate-400 block">Margin</label>
                        <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
                          {marginPct}%
                        </span>
                      </div>

                      <div className="sm:col-span-1">
                        <label className="text-[10px] text-slate-400 block">Expiry</label>
                        <input
                          type="date"
                          required
                          value={item.expiryDate}
                          onChange={e => handleItemChange(index, 'expiryDate', e.target.value)}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-[10px] font-bold"
                        />
                      </div>

                      <div className="sm:col-span-1 text-right">
                        <label className="text-[10px] text-slate-400 block">Total</label>
                        <span className="font-mono font-bold text-slate-900 block text-xs">
                          {formatPKR(item.total)}
                        </span>
                      </div>

                      <div className="sm:col-span-1 text-right">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Mode 2: New Formulation Registration on the fly */
            <div className="p-4 bg-white border border-teal-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <PackagePlus className="w-4 h-4 text-emerald-600" /> New Medicine Formulation Details
                </span>
                <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                  Calculated Margin: {newSalePrice > 0 ? (((newSalePrice - newCostPrice) / newSalePrice) * 100).toFixed(1) : 0}%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Brand Name *</label>
                  <input
                    type="text"
                    required
                    value={newMedName}
                    onChange={e => setNewMedName(e.target.value)}
                    placeholder="e.g. Augmentin 625mg"
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Generic Formula *</label>
                  <input
                    type="text"
                    required
                    value={newGenericName}
                    onChange={e => setNewGenericName(e.target.value)}
                    placeholder="e.g. Co-Amoxiclav"
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Manufacturer *</label>
                  <input
                    type="text"
                    required
                    value={newManufacturer}
                    onChange={e => setNewManufacturer(e.target.value)}
                    placeholder="e.g. GSK Pakistan"
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  >
                    <option value="Antibiotics">Antibiotics</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Analgesics">Analgesics & Pain</option>
                    <option value="Antidiabetic">Antidiabetic</option>
                    <option value="Gastrointestinal">Gastrointestinal</option>
                    <option value="Respiratory">Respiratory</option>
                    <option value="General Health">General Health</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Dosage Form</label>
                  <select
                    value={newMedType}
                    onChange={e => setNewMedType(e.target.value as any)}
                    className="w-full p-2 border border-slate-200 rounded-lg"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Cream">Cream / Ointment</option>
                    <option value="Drops">Drops</option>
                    <option value="Inhaler">Inhaler</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Strength & Packing</label>
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="text"
                      value={newStrength}
                      onChange={e => setNewStrength(e.target.value)}
                      placeholder="e.g. 500mg"
                      className="p-2 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      value={newPackingSize}
                      onChange={e => setNewPackingSize(e.target.value)}
                      placeholder="e.g. 10s Strip"
                      className="p-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">First Batch Number *</label>
                  <input
                    type="text"
                    required
                    value={newBatchNumber}
                    onChange={e => setNewBatchNumber(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Quantity Received</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newQty}
                    onChange={e => setNewQty(parseInt(e.target.value) || 1)}
                    className="w-full p-2 border border-slate-200 rounded-lg font-bold text-center"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Batch Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={newExpiryDate}
                    onChange={e => setNewExpiryDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Purchase Cost (PKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newCostPrice}
                    onChange={e => setNewCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Retail Selling Price (PKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newSalePrice}
                    onChange={e => setNewSalePrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold text-teal-800"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Rack Location & Barcode</label>
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="text"
                      value={newStorageLocation}
                      onChange={e => setNewStorageLocation(e.target.value)}
                      placeholder="Rack A-1"
                      className="p-2 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      value={newBarcode}
                      onChange={e => setNewBarcode(e.target.value)}
                      placeholder="Barcode"
                      className="p-2 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment & Summary */}
          <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-600 space-y-1">
              <div>
                <span className="font-semibold text-slate-700">Total Purchase Amount:</span>{' '}
                <strong className="text-base font-black text-slate-900 font-mono">
                  {formatPKR(totalPurchaseAmount)}
                </strong>
              </div>
              {paymentStatus === 'Partial' && (
                <div className="flex items-center gap-2">
                  <span>Paid Now:</span>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-28 p-1 bg-white border border-slate-300 rounded font-mono text-xs font-bold"
                  />
                  <span>Remaining: <strong>{formatPKR(Math.max(0, totalPurchaseAmount - paidAmount))}</strong></span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700">Payment Mode:</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Card">Corporate Card</option>
                <option value="EasyPaisa">EasyPaisa</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-xs"
            >
              {inwardMode === 'existing'
                ? 'Record Purchase & Increase Inventory Stock'
                : 'Register Formulation & Record Purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
