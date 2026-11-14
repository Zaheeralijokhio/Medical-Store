/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Pill,
  Search,
  Plus,
  Minus,
  Download,
  Upload,
  Layers,
  Edit2,
  Trash2,
  ShoppingCart,
  ArrowUpDown,
  Lock,
  PackagePlus,
  X,
  CheckSquare,
  Square,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  PackageX,
  Boxes,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { Medicine, MedicineBatch } from '../../types/pharmacy';
import {
  formatPKR,
  getMedicineStockStatus,
  exportToCSV,
  getFefoBatches,
  getStoreTodayDateStr,
} from '../../utils/helpers';
import { MedicineModal } from './MedicineModal';
import { BatchManagerModal } from './BatchManagerModal';
import { BulkImportModal } from './BulkImportModal';
import { NavTab } from '../layout/Sidebar';

interface MedicineListProps {
  onNavigate?: (tab: NavTab) => void;
}

interface QuickAddStockPayload extends Partial<MedicineBatch> {
  existingBatchId?: string;
}

interface QuickAddStockModalProps {
  medicine: Medicine | null;
  isOpen: boolean;
  onClose: () => void;
  onStockAdded: (batch: QuickAddStockPayload) => void;
}

const generateDefaultBatchCode = () =>
  `BAT-${new Date().getFullYear().toString().slice(-2)}${Math.floor(100 + Math.random() * 900)}`;

const AVATAR_GRADIENTS = [
  'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/25',
  'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-500/25',
  'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/25',
  'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm shadow-amber-500/25',
  'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-sm shadow-rose-500/25',
  'bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-sm shadow-cyan-500/25',
];

const getMedicineAvatarGradient = (name: string) => {
  const clean = (name || 'Medicine').trim();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % AVATAR_GRADIENTS.length;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

const QuickAddStockModal: React.FC<QuickAddStockModalProps> = ({
  medicine,
  isOpen,
  onClose,
  onStockAdded,
}) => {
  const [stockMode, setStockMode] = useState<'new' | 'existing'>('new');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [batchNumber, setBatchNumber] = useState<string>(generateDefaultBatchCode);
  const [quantity, setQuantity] = useState<number>(0);
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [mfgDate, setMfgDate] = useState<string>('2025-01-01');
  const [expiryDate, setExpiryDate] = useState<string>('2028-01-01');
  const [formError, setFormError] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !medicine) return;
    const existingBatches = Array.isArray(medicine.batches) ? medicine.batches : [];
    const firstBatch = existingBatches[0];
    const fixedSale =
      medicine.fixedSalePrice !== undefined && medicine.fixedSalePrice > 0
        ? medicine.fixedSalePrice
        : firstBatch?.salePrice || 15;
    const fixedCost =
      medicine.fixedPurchasePrice !== undefined && medicine.fixedPurchasePrice > 0
        ? medicine.fixedPurchasePrice
        : firstBatch?.purchasePrice || 0;

    setFormError('');
    setQuantity(0);
    if (existingBatches.length > 0 && firstBatch) {
      setStockMode('existing');
      setSelectedBatchId(firstBatch.id);
      setBatchNumber(firstBatch.batchNumber || generateDefaultBatchCode());
      setPurchasePrice(firstBatch.purchasePrice ?? fixedCost);
      setSalePrice(fixedSale);
      setMfgDate(firstBatch.mfgDate || '2025-01-01');
      setExpiryDate(firstBatch.expiryDate || '2028-01-01');
    } else {
      setStockMode('new');
      setSelectedBatchId('');
      setBatchNumber(generateDefaultBatchCode());
      setPurchasePrice(fixedCost);
      setSalePrice(fixedSale);
      setMfgDate('2025-01-01');
      setExpiryDate('2028-01-01');
    }
  }, [isOpen, medicine?.id]);

  if (!isOpen || !medicine) return null;

  const existingBatches = Array.isArray(medicine.batches) ? medicine.batches : [];
  const currentTotal = Number(medicine.totalQuantity || 0);
  const qtyToAdd = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const projectedTotal = currentTotal + qtyToAdd;
  const grossMargin = salePrice > 0 ? (((salePrice - purchasePrice) / salePrice) * 100).toFixed(1) : '0';

  const handleModeSwitch = (mode: 'new' | 'existing') => {
    setStockMode(mode);
    setFormError('');
    if (mode === 'existing' && existingBatches.length > 0) {
      const target = existingBatches.find(b => b.id === selectedBatchId) || existingBatches[0];
      setSelectedBatchId(target.id);
      setBatchNumber(target.batchNumber);
      setPurchasePrice(target.purchasePrice ?? (medicine.fixedPurchasePrice || 0));
      setSalePrice(
        medicine.fixedSalePrice && medicine.fixedSalePrice > 0
          ? medicine.fixedSalePrice
          : target.salePrice || 0
      );
      setMfgDate(target.mfgDate || '2025-01-01');
      setExpiryDate(target.expiryDate || '2028-01-01');
    } else {
      setBatchNumber(generateDefaultBatchCode());
      setPurchasePrice(medicine.fixedPurchasePrice || existingBatches[0]?.purchasePrice || 0);
      setSalePrice(
        medicine.fixedSalePrice && medicine.fixedSalePrice > 0
          ? medicine.fixedSalePrice
          : existingBatches[0]?.salePrice || 15
      );
      setMfgDate('2025-01-01');
      setExpiryDate('2028-01-01');
    }
  };

  const handleSelectExistingBatch = (bId: string) => {
    setSelectedBatchId(bId);
    const target = existingBatches.find(b => b.id === bId);
    if (target) {
      setBatchNumber(target.batchNumber);
      setPurchasePrice(target.purchasePrice ?? 0);
      setSalePrice(
        medicine.fixedSalePrice && medicine.fixedSalePrice > 0
          ? medicine.fixedSalePrice
          : target.salePrice || 0
      );
      setMfgDate(target.mfgDate || '2025-01-01');
      setExpiryDate(target.expiryDate || '2028-01-01');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQty = Number(quantity);
    if (!Number.isFinite(cleanQty) || cleanQty <= 0) {
      setFormError('Please enter a valid quantity greater than 0.');
      return;
    }
    if (stockMode === 'new' && !batchNumber.trim()) {
      setFormError('Please enter a valid batch number.');
      return;
    }
    onStockAdded({
      existingBatchId: stockMode === 'existing' ? selectedBatchId : undefined,
      batchNumber: batchNumber.trim() || generateDefaultBatchCode(),
      quantity: cleanQty,
      purchasePrice: Number(purchasePrice) || 0,
      salePrice: Number(salePrice) || 0,
      mfgDate,
      expiryDate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in">
        <div className="p-4 bg-[#0B191E] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Add Inward Stock &amp; Fixed Price</h3>
              <p className="text-[11px] text-slate-300 truncate max-w-xs">
                {medicine.name} {medicine.strength ? `(${medicine.strength})` : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {/* Live Current -> Projected Stock Bar */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Item Stock Update
              </span>
              <span className="text-xs font-semibold text-slate-700">
                Current: <strong className="font-mono text-slate-900">{currentTotal}</strong>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                After Adding (+{qtyToAdd})
              </span>
              <span className="text-sm font-black font-mono text-emerald-700">
                {projectedTotal} units
              </span>
            </div>
          </div>

          {/* Mode Toggle if existing batches exist */}
          {existingBatches.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => handleModeSwitch('existing')}
                className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all ${
                  stockMode === 'existing'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Add to Existing Batch
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('new')}
                className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all ${
                  stockMode === 'new'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + New Batch Shipment
              </button>
            </div>
          )}

          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-[11px]">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                {stockMode === 'existing' && existingBatches.length > 0
                  ? 'Select Batch *'
                  : 'Batch Number *'}
              </label>
              {stockMode === 'existing' && existingBatches.length > 0 ? (
                <select
                  value={selectedBatchId}
                  onChange={e => handleSelectExistingBatch(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold bg-white"
                >
                  {existingBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} ({b.quantity} units)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={batchNumber}
                  onChange={e => setBatchNumber(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
                />
              )}
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Quantity Received *</label>
              <input
                type="number"
                min="1"
                required
                value={quantity || ''}
                onChange={e => setQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                placeholder="Enter qty"
                className="w-full p-2 border-2 border-emerald-400 rounded-lg font-bold text-center text-emerald-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Cost Price (PKR)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={purchasePrice}
                onChange={e => setPurchasePrice(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="font-bold text-teal-900 block mb-1">Fixed Selling Price (PKR) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={salePrice}
                onChange={e => setSalePrice(parseFloat(e.target.value) || 0)}
                className="w-full p-2 border-2 border-teal-500 rounded-lg font-mono font-bold text-teal-800"
              />
            </div>
          </div>

          <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-200 flex items-center justify-between">
            <span className="text-slate-600 font-medium">Estimated Gross Profit Margin:</span>
            <span className="font-bold font-mono text-teal-800">{grossMargin}%</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Manufacturing Date</label>
              <input
                type="date"
                required
                value={mfgDate}
                onChange={e => setMfgDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Expiry Date *</label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-bold"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-xs"
            >
              Confirm &amp; Add Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const MedicineList: React.FC<MedicineListProps> = ({ onNavigate }) => {
  const { currentUser, isAdmin } = useAuth();
  const {
    medicines,
    deleteMedicine,
    updateMedicine,
    addBatch,
    settings,
    queueMedicinesForPos,
    refreshData,
  } = useStore();

  // Refresh latest medicines once when opening Inventory catalog
  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search, Filter & Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price' | 'expiry'>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Multi-select for instant POS selling: medicineId -> quantity
  const [selectedForSale, setSelectedForSale] = useState<Record<string, number>>({});

  // Inline fixed price editing state
  const [editingPriceMedId, setEditingPriceMedId] = useState<string | null>(null);
  const [inlinePriceValue, setInlinePriceValue] = useState<string>('');

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [medicineToEdit, setMedicineToEdit] = useState<Medicine | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedMedForBatches, setSelectedMedForBatches] = useState<Medicine | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [quickStockMed, setQuickStockMed] = useState<Medicine | null>(null);
  const [stockToast, setStockToast] = useState<string | null>(null);

  useEffect(() => {
    if (!stockToast) return;
    const t = setTimeout(() => setStockToast(null), 4000);
    return () => clearTimeout(t);
  }, [stockToast]);

  // Allow adding, editing, managing batches and deleting medicines for both Owner and Staff
  const canModifyPrices = true;
  const canDeleteMedicine = true;

  const getFixedPrice = (med: Medicine): number => {
    if (med.fixedSalePrice !== undefined && med.fixedSalePrice > 0) {
      return med.fixedSalePrice;
    }
    return med.batches[0]?.salePrice || 0;
  };

  // Distinct categories & manufacturers
  const categories = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return ['All', ...Array.from(set)];
  }, [medicines]);

  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach(m => {
      if (m.manufacturer) set.add(m.manufacturer);
    });
    return ['All', ...Array.from(set)];
  }, [medicines]);

  // Filtered & Sorted List
  const filteredMedicines = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = medicines.filter(med => {
      if (selectedCategory !== 'All' && med.category !== selectedCategory) return false;
      if (selectedManufacturer !== 'All' && med.manufacturer !== selectedManufacturer) return false;

      if (selectedStatus !== 'All') {
        const { status } = getMedicineStockStatus(med, settings.expiryAlertDays);
        if (selectedStatus !== status) return false;
      }

      if (q) {
        const matchName = String(med.name || '').toLowerCase().includes(q);
        const matchGen = String(med.genericName || '').toLowerCase().includes(q);
        const matchBrand = String(med.brandName || '').toLowerCase().includes(q);
        const matchBarcode = String(med.barcode || '').includes(q);
        const matchCode = String(med.code || '').toLowerCase().includes(q);
        const matchBatch = (med.batches || []).some(b => String(b?.batchNumber || '').toLowerCase().includes(q));
        if (!matchName && !matchGen && !matchBrand && !matchBarcode && !matchCode && !matchBatch) {
          return false;
        }
      }

      return true;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = String(a.name || '').localeCompare(String(b.name || ''));
      } else if (sortBy === 'stock') {
        comparison = Number(a.totalQuantity || 0) - Number(b.totalQuantity || 0);
      } else if (sortBy === 'price') {
        comparison = getFixedPrice(a) - getFixedPrice(b);
      } else if (sortBy === 'expiry') {
        const expA = (a.batches || [])[0]?.expiryDate || '9999-99-99';
        const expB = (b.batches || [])[0]?.expiryDate || '9999-99-99';
        comparison = expA.localeCompare(expB);
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [
    medicines,
    searchQuery,
    selectedCategory,
    selectedManufacturer,
    selectedStatus,
    settings.expiryAlertDays,
    sortBy,
    sortAsc,
  ]);

  const inventorySummary = useMemo(() => {
    let inStockCount = 0;
    let lowOrOutCount = 0;
    let totalUnits = 0;
    let totalRetailValue = 0;

    medicines.forEach(med => {
      const st = getMedicineStockStatus(med, settings.expiryAlertDays).status;
      if (st === 'available') inStockCount += 1;
      if (st === 'low' || st === 'out_of_stock') lowOrOutCount += 1;
      const qty = Number(med.totalQuantity || 0);
      totalUnits += qty;
      totalRetailValue += qty * getFixedPrice(med);
    });

    return {
      totalItems: medicines.length,
      inStockCount,
      lowOrOutCount,
      totalUnits,
      totalRetailValue,
    };
  }, [medicines, settings.expiryAlertDays]);

  const selectableMedicines = useMemo(() => {
    return filteredMedicines.filter(med => {
      const fefoBatches = getFefoBatches(med);
      return fefoBatches.reduce((s, b) => s + b.quantity, 0) > 0;
    });
  }, [filteredMedicines]);

  const toggleSelectForSale = (med: Medicine) => {
    const fefoBatches = getFefoBatches(med);
    if (fefoBatches.length === 0) return;

    setSelectedForSale(prev => {
      const next = { ...prev };
      if (next[med.id]) {
        delete next[med.id];
      } else {
        next[med.id] = 1;
      }
      return next;
    });
  };

  const updateSelectedQty = (med: Medicine, qty: number) => {
    const fefoBatches = getFefoBatches(med);
    const maxStock = fefoBatches.reduce((s, b) => s + b.quantity, 0) || 1;
    setSelectedForSale(prev => ({
      ...prev,
      [med.id]: Math.max(1, Math.min(maxStock, qty)),
    }));
  };

  const handleSelectAllVisible = () => {
    const allSelected =
      selectableMedicines.length > 0 &&
      selectableMedicines.every(m => !!selectedForSale[m.id]);

    if (allSelected) {
      setSelectedForSale(prev => {
        const next = { ...prev };
        selectableMedicines.forEach(m => delete next[m.id]);
        return next;
      });
    } else {
      setSelectedForSale(prev => {
        const next = { ...prev };
        selectableMedicines.forEach(m => {
          if (!next[m.id]) next[m.id] = 1;
        });
        return next;
      });
    }
  };

  const selectedList = useMemo(() => {
    return Object.entries(selectedForSale)
      .map(([medId, qty]) => {
        const med = medicines.find(m => m.id === medId);
        if (!med) return null;
        return { med, qty, fixedPrice: getFixedPrice(med) };
      })
      .filter((x): x is { med: Medicine; qty: number; fixedPrice: number } => x !== null);
  }, [selectedForSale, medicines]);

  const selectedTotalValue = useMemo(() => {
    return selectedList.reduce((sum, item) => sum + item.fixedPrice * item.qty, 0);
  }, [selectedList]);

  const handleSellSelectedNow = () => {
    if (selectedList.length === 0) return;
    queueMedicinesForPos(
      selectedList.map(item => ({
        medicineId: item.med.id,
        quantity: item.qty,
      }))
    );
    setSelectedForSale({});
    onNavigate?.('pos');
  };

  const handleSellSingleMedicine = (med: Medicine) => {
    queueMedicinesForPos([{ medicineId: med.id, quantity: selectedForSale[med.id] || 1 }]);
    onNavigate?.('pos');
  };

  const handleSaveInlineFixedPrice = (med: Medicine) => {
    const parsed = parseFloat(inlinePriceValue);
    if (!isNaN(parsed) && parsed > 0) {
      updateMedicine(med.id, { fixedSalePrice: parsed });
    }
    setEditingPriceMedId(null);
  };

  const toggleSort = (field: 'name' | 'stock' | 'price' | 'expiry') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  };

  // Export Inventory CSV
  const handleExportCSV = () => {
    const exportRows = medicines.flatMap(med => {
      const fixedPrice = getFixedPrice(med);
      if (!med.batches || med.batches.length === 0) {
        return [
          {
            Code: med.code,
            Name: med.name,
            Generic: med.genericName,
            Category: med.category,
            Manufacturer: med.manufacturer,
            Type: med.medicineType,
            Strength: med.strength,
            Packing: med.packingSize,
            Barcode: med.barcode,
            Batch: 'N/A',
            PurchasePrice: med.fixedPurchasePrice || 0,
            FixedSalePrice: fixedPrice,
            Quantity: 0,
            ExpiryDate: 'N/A',
            Location: med.storageLocation,
          },
        ];
      }
      return med.batches.map(b => ({
        Code: med.code,
        Name: med.name,
        Generic: med.genericName,
        Category: med.category,
        Manufacturer: med.manufacturer,
        Type: med.medicineType,
        Strength: med.strength,
        Packing: med.packingSize,
        Barcode: med.barcode,
        Batch: b.batchNumber,
        PurchasePrice: b.purchasePrice,
        FixedSalePrice: fixedPrice,
        Quantity: b.quantity,
        ExpiryDate: b.expiryDate,
        Location: med.storageLocation,
      }));
    });

    exportToCSV(`PharmaCare_Inventory_${getStoreTodayDateStr()}`, exportRows);
  };

  return (
    <div className="space-y-4">
      {stockToast && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{stockToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setStockToast(null)}
            className="p-0.5 text-emerald-700 hover:text-emerald-950"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pro-card rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-white via-teal-50/35 to-emerald-50/40">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0F766E] via-teal-600 to-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-teal-600/25">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base tracking-tight">
              Master Medicine Catalog &amp; Fixed Price Inventory
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select medicines for POS checkout · Fixed selling prices apply automatically on invoices
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200/90 text-sky-800 font-bold text-xs transition-all min-h-[40px] whitespace-nowrap shrink-0 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-sky-600" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/90 text-indigo-800 font-bold text-xs transition-all min-h-[40px] whitespace-nowrap shrink-0 shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            <span>Bulk Import</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMedicineToEdit(null);
              setShowAddEditModal(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0F766E] via-teal-600 to-emerald-500 hover:from-[#0D655E] hover:to-emerald-400 text-white font-bold text-xs shadow-md shadow-teal-600/25 hover:-translate-y-0.5 transition-all min-h-[40px] whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medicine</span>
          </button>
        </div>
      </div>

      {/* Quick Inventory Overview Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setSelectedStatus('All')}
          className={`rounded-2xl p-3.5 text-left transition-all border bg-gradient-to-br from-[#0B191E] via-[#102E37] to-[#0F766E] text-white shadow-md hover:-translate-y-0.5 ${
            selectedStatus === 'All'
              ? 'border-emerald-400 ring-2 ring-emerald-400/30'
              : 'border-teal-900/50'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-emerald-200">Total Catalog Items</span>
            <div className="w-7 h-7 rounded-lg bg-white/15 text-emerald-300 flex items-center justify-center shrink-0">
              <Boxes className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-xl font-black text-white tabular-nums">
              {inventorySummary.totalItems}
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-300 tabular-nums">
              {inventorySummary.totalUnits.toLocaleString()} units
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'available' ? 'All' : 'available')}
          className={`rounded-2xl p-3.5 text-left transition-all border bg-gradient-to-br from-emerald-50 via-teal-50/70 to-white hover:border-emerald-400 hover:-translate-y-0.5 shadow-xs ${
            selectedStatus === 'available'
              ? 'border-emerald-500 ring-2 ring-emerald-500/25'
              : 'border-emerald-200/90'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-emerald-800">In Stock &amp; Ready</span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-xl font-black text-emerald-900 tabular-nums">
              {inventorySummary.inStockCount}
            </span>
            <span className="text-[11px] font-bold text-emerald-700 whitespace-nowrap">
              Filter Ready
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'out_of_stock' ? 'All' : 'out_of_stock')}
          className={`rounded-2xl p-3.5 text-left transition-all border bg-gradient-to-br from-amber-50 via-orange-50/70 to-white hover:border-orange-400 hover:-translate-y-0.5 shadow-xs ${
            selectedStatus === 'out_of_stock' || selectedStatus === 'low'
              ? 'border-orange-500 ring-2 ring-orange-500/25'
              : 'border-amber-200/90'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-orange-800">Low / Out of Stock</span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-xl font-black text-orange-900 tabular-nums">
              {inventorySummary.lowOrOutCount}
            </span>
            <span className="text-[11px] font-bold text-orange-700 whitespace-nowrap">
              Needs Restock
            </span>
          </div>
        </button>

        <div className="rounded-2xl p-3.5 text-left border border-indigo-200/90 bg-gradient-to-br from-indigo-50 via-violet-50/70 to-white shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-indigo-800">Retail Stock Value</span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-lg sm:text-xl font-black text-indigo-950 font-mono tabular-nums truncate">
              {formatPKR(inventorySummary.totalRetailValue, false)}
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Select Floating / Sticky Bar when items are selected for sale */}
      {selectedList.length > 0 && (
        <div className="sticky top-16 z-20 p-3.5 bg-[#0B191E] text-white rounded-2xl shadow-xl border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm shrink-0 tabular-nums">
              {selectedList.length}
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                {selectedList.length} Medicine{selectedList.length !== 1 ? 's' : ''} Selected for Sale
              </p>
              <p className="text-[11px] text-emerald-300 font-mono tabular-nums">
                Total at Fixed Inventory Prices: <strong>{formatPKR(selectedTotalValue)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedForSale({})}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition-colors min-h-[40px] whitespace-nowrap shrink-0"
            >
              Clear Selection
            </button>
            <button
              type="button"
              onClick={handleSellSelectedNow}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all min-h-[40px] whitespace-nowrap shrink-0"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Sell Selected ({selectedList.length}) in POS</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Advanced Filters Bar */}
      <div className="p-4 pro-card rounded-2xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search brand, generic, barcode..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white min-h-[40px]"
            >
              <option value="All">All Categories</option>
              {categories
                .filter(c => c !== 'All')
                .map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>

          {/* Manufacturer Filter */}
          <div>
            <select
              value={selectedManufacturer}
              onChange={e => setSelectedManufacturer(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white min-h-[40px]"
            >
              <option value="All">All Manufacturers</option>
              {manufacturers
                .filter(m => m !== 'All')
                .map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white min-h-[40px]"
            >
              <option value="All">All Stock Statuses</option>
              <option value="available">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="near_expiry">Near Expiry (&lt;90 days)</option>
              <option value="expired">Expired Batches</option>
            </select>
          </div>
        </div>
      </div>

      {/* MOBILE & TABLET RESPONSIVE CARDS VIEW (<1024px) */}
      <div className="lg:hidden space-y-3">
        {filteredMedicines.length === 0 ? (
          <div className="py-12 text-center text-slate-400 pro-card rounded-2xl">
            <Pill className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No medicines matching the selected criteria.</p>
          </div>
        ) : (
          filteredMedicines.map(med => {
            const statusInfo = getMedicineStockStatus(med, settings.expiryAlertDays);
            const primaryBatch = med.batches[0];
            const fixedPrice = getFixedPrice(med);
            const isChecked = !!selectedForSale[med.id];
            const checkedQty = selectedForSale[med.id] || 1;
            const canSell = getFefoBatches(med).reduce((s, b) => s + b.quantity, 0) > 0;
            const batchCount = (med.batches || []).length;
            const isLowOrOut =
              statusInfo.status === 'low' ||
              statusInfo.status === 'out_of_stock' ||
              statusInfo.status === 'expired';

            return (
              <div
                key={med.id}
                className={`pro-card rounded-2xl p-3.5 sm:p-4 space-y-3 transition-all ${
                  isChecked ? '!border-emerald-500 bg-emerald-50/20' : ''
                }`}
              >
                {/* Top Row: Checkbox + Colorful Avatar + Medicine Name & Generic + Status Badge */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={!canSell}
                      onClick={() => toggleSelectForSale(med)}
                      className={`mt-1 p-1 rounded-lg transition-colors shrink-0 ${
                        !canSell
                          ? 'text-slate-200 cursor-not-allowed'
                          : isChecked
                          ? 'text-[#0F766E] bg-teal-100'
                          : 'text-slate-400 hover:text-[#0F766E]'
                      }`}
                    >
                      {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>

                    <div
                      className={`w-9 h-9 rounded-xl font-extrabold flex items-center justify-center shrink-0 text-xs mt-0.5 ${getMedicineAvatarGradient(
                        med.name
                      )}`}
                    >
                      {(med.name || 'M').charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900 leading-tight break-words">
                          {med.name || 'Medicine'}
                        </h4>
                        {med.requiresPrescription && (
                          <span className="text-[10px] font-bold text-white bg-gradient-to-r from-rose-500 to-pink-600 px-1.5 py-0.5 rounded shadow-2xs">
                            Rx
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-0.5">
                        {med.genericName || 'Generic formulation'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                        {med.barcode || 'No Barcode'} · {med.storageLocation || 'Shelf'}
                      </p>
                    </div>
                  </div>

                  {/* Interactive Colorful Status Pill */}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedStatus(selectedStatus === statusInfo.status ? 'All' : statusInfo.status)
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-all ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.badgeBorder}`}
                  >
                    {statusInfo.status === 'available' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : statusInfo.status === 'out_of_stock' ? (
                      <PackageX className="w-3.5 h-3.5 shrink-0" />
                    ) : statusInfo.status === 'expired' ? (
                      <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{statusInfo.label}</span>
                  </button>
                </div>

                {/* If selected for multi-sale, show quantity stepper */}
                {isChecked && (
                  <div className="flex items-center justify-between bg-teal-100/70 border border-teal-300 px-3 py-2 rounded-xl text-xs">
                    <span className="font-bold text-teal-950">Sale Quantity:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateSelectedQty(med, checkedQty - 1)}
                        className="w-7 h-7 rounded-lg bg-white text-teal-900 flex items-center justify-center font-bold border border-teal-200"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono font-black text-sm text-teal-950 tabular-nums px-1">
                        {checkedQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateSelectedQty(med, checkedQty + 1)}
                        className="w-7 h-7 rounded-lg bg-white text-teal-900 flex items-center justify-center font-bold border border-teal-200"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Middle Responsive Details Grid: Type & Strength | Manufacturer | Stock & Bar | Fixed Price */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-slate-50/90 p-3 rounded-xl border border-slate-200/75">
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Type &amp; Strength
                    </span>
                    <strong className="text-slate-900 font-bold block mt-0.5 truncate">
                      {med.strength || '-'}
                    </strong>
                    <span className="text-[11px] text-slate-500 block truncate">
                      {med.medicineType || 'Tablet'} · {med.packingSize || 'Pack'}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Manufacturer
                    </span>
                    <strong className="text-slate-800 font-semibold block mt-0.5 line-clamp-2 leading-snug">
                      {med.manufacturer || '-'}
                    </strong>
                  </div>

                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Stock
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <strong
                        className={`text-sm font-black tabular-nums ${
                          med.totalQuantity === 0
                            ? 'text-rose-600'
                            : isLowOrOut
                            ? 'text-orange-600'
                            : 'text-slate-900'
                        }`}
                      >
                        {med.totalQuantity}
                      </strong>
                      <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                        Min: {med.minStockLevel}
                      </span>
                    </div>
                    <div className="w-full max-w-[96px] h-1.5 bg-slate-200/80 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          med.totalQuantity === 0
                            ? 'bg-rose-500'
                            : isLowOrOut
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            med.totalQuantity === 0
                              ? 0
                              : Math.max(
                                  10,
                                  Math.round(
                                    (med.totalQuantity / Math.max((med.minStockLevel || 10) * 3, 1)) * 100
                                  )
                                )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="min-w-0 sm:text-right">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Fixed Price
                    </span>
                    {editingPriceMedId === med.id ? (
                      <div className="inline-flex items-center gap-1 mt-0.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={inlinePriceValue}
                          onChange={e => setInlinePriceValue(e.target.value)}
                          className="w-16 p-1 border-2 border-teal-500 rounded-lg text-right font-mono font-bold text-xs bg-white tabular-nums"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInlineFixedPrice(med)}
                          className="p-1 rounded-lg bg-[#0F766E] text-white"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPriceMedId(null)}
                          className="p-1 rounded-lg bg-slate-200 text-slate-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-0.5">
                        <div className="inline-flex items-center gap-1">
                          <span className="font-mono font-black text-sm text-[#0F766E] tabular-nums">
                            {fixedPrice > 0 ? formatPKR(fixedPrice) : 'N/A'}
                          </span>
                          {canModifyPrices && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPriceMedId(med.id);
                                setInlinePriceValue(String(fixedPrice));
                              }}
                              className="text-slate-400 hover:text-[#0F766E] p-0.5 rounded hover:bg-teal-50"
                              title="Edit Fixed Selling Price"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {primaryBatch && (
                          <span className="text-[10px] text-slate-400 block font-mono tabular-nums">
                            Cost: {formatPKR(primaryBatch.purchasePrice)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Colorful Action Buttons Row (Matches Desktop Table Buttons) */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Batch Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMedForBatches(med);
                      setShowBatchModal(true);
                    }}
                    className={`flex-1 min-w-[92px] min-h-[40px] px-2.5 py-2 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 border transition-all whitespace-nowrap tabular-nums ${
                      batchCount === 0
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 shadow-2xs'
                        : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white border-indigo-600/20 shadow-xs shadow-indigo-500/20'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {batchCount} {batchCount === 1 ? 'Batch' : 'Batches'}
                    </span>
                  </button>

                  {/* Sell Button */}
                  <button
                    type="button"
                    disabled={!canSell}
                    onClick={() => handleSellSingleMedicine(med)}
                    className="flex-1 min-w-[82px] min-h-[40px] px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-100 disabled:to-slate-200 text-white disabled:text-slate-400 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all shadow-xs shadow-emerald-600/20 disabled:shadow-none whitespace-nowrap"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                    <span>Sell</span>
                  </button>

                  {/* + Stock Button */}
                  <button
                    type="button"
                    onClick={() => setQuickStockMed(med)}
                    className="flex-1 min-w-[92px] min-h-[40px] px-2.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all shadow-xs shadow-sky-500/20 whitespace-nowrap"
                  >
                    <PackagePlus className="w-3.5 h-3.5 shrink-0" />
                    <span>+ Stock</span>
                  </button>

                  {/* Edit Formulation */}
                  <button
                    type="button"
                    onClick={() => {
                      setMedicineToEdit(med);
                      setShowAddEditModal(true);
                    }}
                    className="min-w-[40px] min-h-[40px] p-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-500 hover:border-amber-500 text-amber-700 hover:text-white inline-flex items-center justify-center transition-all shadow-2xs shrink-0"
                    title="Edit Formulation & Fixed Selling Price"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Delete Formulation */}
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `Are you sure you want to delete ${med.name}? It will be removed immediately from inventory and database across all devices.`
                        )
                      ) {
                        deleteMedicine(med.id);
                      }
                    }}
                    className="min-w-[40px] min-h-[40px] p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-600 hover:border-rose-600 text-rose-600 hover:text-white inline-flex items-center justify-center transition-all shadow-2xs shrink-0"
                    title="Delete Formulation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP SORTABLE TABLE (>=1024px) — Compact & Responsive with Zero Horizontal Overflow */}
      <div className="hidden lg:block pro-card rounded-2xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#0B191E] text-slate-200 font-semibold text-[11px] tracking-wide">
                <th className="py-3 px-2 xl:px-3 w-9 text-center">
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    className="text-slate-300 hover:text-emerald-400 transition-colors"
                    title="Select all available medicines for sale"
                  >
                    {selectableMedicines.length > 0 &&
                    selectableMedicines.every(m => !!selectedForSale[m.id]) ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 mx-auto" />
                    ) : (
                      <Square className="w-4 h-4 mx-auto" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3 px-2 xl:px-3 cursor-pointer hover:bg-white/5 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Medicine &amp; Generic</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                  </div>
                </th>
                <th className="py-3 px-2 xl:px-3 whitespace-nowrap">Type &amp; Strength</th>
                <th className="py-3 px-2 xl:px-3 whitespace-nowrap">Manufacturer</th>
                <th className="py-3 px-2 xl:px-3 text-center whitespace-nowrap">Batches</th>
                <th
                  onClick={() => toggleSort('stock')}
                  className="py-3 px-2 xl:px-3 text-center cursor-pointer hover:bg-white/5 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Stock</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('price')}
                  className="py-3 px-2 xl:px-3 text-right cursor-pointer hover:bg-white/5 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1">
                    <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Fixed Price</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                  </div>
                </th>
                <th className="py-3 px-2 xl:px-3 text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-2.5 xl:px-3.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredMedicines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400">
                    <Pill className="w-8 h-8 mx-auto mb-2 opacity-25" />
                    <p className="text-xs font-medium text-slate-500">
                      No medicines matching the selected criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMedicines.map(med => {
                  const statusInfo = getMedicineStockStatus(med, settings.expiryAlertDays);
                  const primaryBatch = med.batches[0];
                  const fixedPrice = getFixedPrice(med);
                  const isChecked = !!selectedForSale[med.id];
                  const checkedQty = selectedForSale[med.id] || 1;
                  const canSell = getFefoBatches(med).reduce((s, b) => s + b.quantity, 0) > 0;
                  const batchCount = (med.batches || []).length;
                  const isLowOrOut =
                    statusInfo.status === 'low' ||
                    statusInfo.status === 'out_of_stock' ||
                    statusInfo.status === 'expired';

                  return (
                    <tr
                      key={med.id}
                      className={`group transition-colors ${
                        isChecked ? 'bg-teal-50/70 hover:bg-teal-50' : 'hover:bg-slate-50/90'
                      }`}
                    >
                      {/* Multi-select Checkbox */}
                      <td className="py-3 px-2 xl:px-3 text-center">
                        <button
                          type="button"
                          disabled={!canSell}
                          onClick={() => toggleSelectForSale(med)}
                          className={`p-1 rounded-lg transition-colors ${
                            !canSell
                              ? 'text-slate-200 cursor-not-allowed'
                              : isChecked
                              ? 'text-[#0F766E] bg-teal-100'
                              : 'text-slate-400 hover:text-[#0F766E]'
                          }`}
                          title={canSell ? 'Select to sell in POS' : 'Out of stock / expired'}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Name & Generic */}
                      <td className="py-3 px-2 xl:px-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 xl:w-9 xl:h-9 rounded-xl font-extrabold flex items-center justify-center shrink-0 text-xs ${getMedicineAvatarGradient(
                              med.name
                            )}`}
                          >
                            {(med.name || 'M').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-xs xl:text-[13px] leading-tight truncate max-w-[140px] xl:max-w-[190px]">
                                {med.name || 'Medicine'}
                              </span>
                              {med.requiresPrescription && (
                                <span className="text-[10px] font-bold text-white bg-gradient-to-r from-rose-500 to-pink-600 px-1.5 py-0.5 rounded shadow-2xs shrink-0">
                                  Rx
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-600 block truncate max-w-[150px] xl:max-w-[200px] mt-0.5">
                              {med.genericName || 'Generic formulation'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block truncate max-w-[160px] xl:max-w-[210px] mt-0.5">
                              {med.barcode || 'No Barcode'} · {med.storageLocation || 'Shelf'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type & Strength */}
                      <td className="py-3 px-2 xl:px-3">
                        <span className="font-bold text-slate-800 block leading-tight">
                          {med.strength || '-'}
                        </span>
                        <span className="text-[11px] text-slate-500 block leading-snug max-w-[125px] xl:max-w-[155px] mt-0.5">
                          {med.medicineType || 'Tablet'} · {med.packingSize || 'Pack'}
                        </span>
                      </td>

                      {/* Manufacturer */}
                      <td className="py-3 px-2 xl:px-3">
                        <span className="text-slate-700 font-medium block max-w-[115px] xl:max-w-[145px] leading-snug">
                          {med.manufacturer || '-'}
                        </span>
                      </td>

                      {/* Interactive Colorful Batch Button */}
                      <td className="py-3 px-2 xl:px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMedForBatches(med);
                            setShowBatchModal(true);
                          }}
                          className={`px-2.5 xl:px-3 py-1.5 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 border transition-all whitespace-nowrap shrink-0 tabular-nums hover:-translate-y-0.5 ${
                            batchCount === 0
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 shadow-2xs'
                              : 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white border-indigo-600/20 shadow-xs shadow-indigo-500/25'
                          }`}
                          title="Open Batch & Expiry Manager"
                        >
                          <Layers className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {batchCount} {batchCount === 1 ? 'Batch' : 'Batches'}
                          </span>
                        </button>
                      </td>

                      {/* Available Stock + Health Bar */}
                      <td className="py-3 px-2 xl:px-3 text-center whitespace-nowrap">
                        <span
                          className={`text-sm font-black tabular-nums block ${
                            med.totalQuantity === 0
                              ? 'text-rose-600'
                              : isLowOrOut
                              ? 'text-orange-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {med.totalQuantity}
                        </span>
                        <div className="w-12 xl:w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden mx-auto my-1 border border-slate-200/70">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              med.totalQuantity === 0
                                ? 'bg-rose-500'
                                : isLowOrOut
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                med.totalQuantity === 0
                                  ? 0
                                  : Math.max(
                                      10,
                                      Math.round(
                                        (med.totalQuantity / Math.max((med.minStockLevel || 10) * 3, 1)) * 100
                                      )
                                    )
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono tabular-nums block">
                          Min: {med.minStockLevel}
                        </span>
                      </td>

                      {/* Fixed Selling Price (with inline quick-edit) */}
                      <td className="py-3 px-2 xl:px-3 text-right whitespace-nowrap">
                        {editingPriceMedId === med.id ? (
                          <div className="inline-flex items-center gap-1 justify-end">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={inlinePriceValue}
                              onChange={e => setInlinePriceValue(e.target.value)}
                              className="w-16 xl:w-20 p-1.5 border-2 border-teal-500 rounded-lg text-right font-mono font-bold text-xs tabular-nums"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveInlineFixedPrice(med)}
                              className="p-1.5 rounded-lg bg-[#0F766E] text-white hover:bg-[#0D655E]"
                              title="Save Fixed Price"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPriceMedId(null)}
                              className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="inline-flex items-center gap-1 justify-end">
                              <span className="font-mono font-black text-xs xl:text-[13px] text-[#0F766E] tabular-nums">
                                {fixedPrice > 0 ? formatPKR(fixedPrice) : 'N/A'}
                              </span>
                              {canModifyPrices && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPriceMedId(med.id);
                                    setInlinePriceValue(String(fixedPrice));
                                  }}
                                  className="text-slate-400 hover:text-[#0F766E] p-0.5 rounded hover:bg-teal-50 transition-colors"
                                  title="Edit Fixed Selling Price"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {primaryBatch && (
                              <span className="text-[10px] text-slate-400 block font-mono tabular-nums">
                                Cost: {formatPKR(primaryBatch.purchasePrice)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Interactive Colorful Status Button */}
                      <td className="py-3 px-2 xl:px-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStatus(
                              selectedStatus === statusInfo.status ? 'All' : statusInfo.status
                            )
                          }
                          title={
                            selectedStatus === statusInfo.status
                              ? 'Click to clear status filter'
                              : `Filter by ${statusInfo.label}`
                          }
                          className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-[11px] font-bold border inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-all hover:-translate-y-0.5 hover:shadow-sm ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.badgeBorder}`}
                        >
                          {statusInfo.status === 'available' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          ) : statusInfo.status === 'out_of_stock' ? (
                            <PackageX className="w-3.5 h-3.5 shrink-0" />
                          ) : statusInfo.status === 'expired' ? (
                            <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{statusInfo.label}</span>
                        </button>
                      </td>

                      {/* Vibrant Cohesive Action Buttons */}
                      <td className="py-3 px-2.5 xl:px-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1 xl:gap-1.5 whitespace-nowrap shrink-0">
                          {isChecked && (
                            <div className="flex items-center gap-1 bg-teal-100 border border-teal-300 rounded-lg px-1.5 py-1 mr-0.5">
                              <button
                                type="button"
                                onClick={() => updateSelectedQty(med, checkedQty - 1)}
                                className="w-5 h-5 rounded bg-white text-teal-900 flex items-center justify-center font-bold"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="font-mono font-bold text-xs text-teal-950 px-1 tabular-nums">
                                {checkedQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateSelectedQty(med, checkedQty + 1)}
                                className="w-5 h-5 rounded bg-white text-teal-900 flex items-center justify-center font-bold"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}

                          {/* Primary Sell Button */}
                          <button
                            type="button"
                            disabled={!canSell}
                            onClick={() => handleSellSingleMedicine(med)}
                            className="px-2.5 xl:px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-100 disabled:to-slate-200 text-white disabled:text-slate-400 font-bold text-[11px] inline-flex items-center gap-1 transition-all shadow-sm shadow-emerald-600/25 disabled:shadow-none hover:-translate-y-0.5 disabled:hover:translate-y-0 whitespace-nowrap shrink-0"
                            title="Sell at Fixed Price in POS"
                          >
                            <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                            <span>Sell</span>
                          </button>

                          {/* Quick Add Inward Stock Button */}
                          <button
                            type="button"
                            onClick={() => setQuickStockMed(med)}
                            className="px-2 xl:px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-[11px] inline-flex items-center gap-1 transition-all shadow-sm shadow-sky-500/25 hover:-translate-y-0.5 whitespace-nowrap shrink-0"
                            title="Quick Add Inward Stock"
                          >
                            <PackagePlus className="w-3.5 h-3.5 shrink-0" />
                            <span>+ Stock</span>
                          </button>

                          {/* Edit Formulation */}
                          {canModifyPrices ? (
                            <button
                              type="button"
                              onClick={() => {
                                setMedicineToEdit(med);
                                setShowAddEditModal(true);
                              }}
                              className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-500 hover:border-amber-500 text-amber-700 hover:text-white transition-all shadow-2xs"
                              title="Edit Formulation & Fixed Selling Price"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span
                              className="p-1.5 text-slate-300 cursor-not-allowed"
                              title="Cashiers cannot modify official medicine prices"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}

                          {/* Delete Formulation */}
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirm(
                                  `Are you sure you want to delete ${med.name}? It will be removed immediately from inventory and database across all devices.`
                                )
                              ) {
                                deleteMedicine(med.id);
                              }
                            }}
                            className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-600 hover:border-rose-600 text-rose-600 hover:text-white transition-all shadow-2xs"
                            title="Delete Formulation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Add Stock Modal */}
      <QuickAddStockModal
        medicine={quickStockMed}
        isOpen={!!quickStockMed}
        onClose={() => setQuickStockMed(null)}
        onStockAdded={batch => {
          if (!quickStockMed) return;
          const addedQty = Number(batch.quantity || 0);
          const nextTotal = Number(quickStockMed.totalQuantity || 0) + addedQty;
          addBatch(
            quickStockMed.id,
            {
              batchNumber: batch.batchNumber || `BAT-${Date.now()}`,
              quantity: addedQty,
              initialQuantity: addedQty,
              purchasePrice: Number(batch.purchasePrice || 0),
              salePrice: Number(batch.salePrice || 0),
              mfgDate: batch.mfgDate || '2025-01-01',
              expiryDate: batch.expiryDate || '2028-01-01',
              receivedDate: getStoreTodayDateStr(),
            },
            {
              syncFixedPrices: Boolean(batch.salePrice && batch.salePrice > 0),
              existingBatchId: batch.existingBatchId,
            }
          );
          setStockToast(
            `+${addedQty} units added to ${quickStockMed.name} (Total Stock: ${nextTotal} units)`
          );
        }}
      />

      {/* Medicine Add/Edit Modal */}
      <MedicineModal
        isOpen={showAddEditModal}
        onClose={() => {
          setShowAddEditModal(false);
          setMedicineToEdit(null);
        }}
        medicineToEdit={medicineToEdit}
      />

      {/* Batch Manager Modal */}
      <BatchManagerModal
        isOpen={showBatchModal}
        onClose={() => {
          setShowBatchModal(false);
          setSelectedMedForBatches(null);
        }}
        medicine={selectedMedForBatches}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
};
