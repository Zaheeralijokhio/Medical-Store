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
  Eye,
  X,
  CheckSquare,
  Square,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { Medicine, MedicineBatch } from '../../types/pharmacy';
import {
  formatPKR,
  getMedicineStockStatus,
  exportToCSV,
  getFefoBatches,
} from '../../utils/helpers';
import { MedicineModal } from './MedicineModal';
import { BatchManagerModal } from './BatchManagerModal';
import { BulkImportModal } from './BulkImportModal';
import { NavTab } from '../layout/Sidebar';

interface MedicineListProps {
  onNavigate?: (tab: NavTab) => void;
}

interface QuickAddStockModalProps {
  medicine: Medicine | null;
  isOpen: boolean;
  onClose: () => void;
  onStockAdded: (batch: Partial<MedicineBatch>) => void;
}

const QuickAddStockModal: React.FC<QuickAddStockModalProps> = ({
  medicine,
  isOpen,
  onClose,
  onStockAdded,
}) => {
  if (!isOpen || !medicine) return null;

  const fixedSale =
    medicine.fixedSalePrice !== undefined
      ? medicine.fixedSalePrice
      : medicine.batches[0]?.salePrice || 15;
  const fixedCost =
    medicine.fixedPurchasePrice !== undefined
      ? medicine.fixedPurchasePrice
      : medicine.batches[0]?.purchasePrice || 10;

  const defaultBatch = `BAT-${new Date().getFullYear().toString().slice(-2)}${Math.floor(100 + Math.random() * 900)}`;
  const [batchNumber, setBatchNumber] = useState(defaultBatch);
  const [quantity, setQuantity] = useState(100);
  const [purchasePrice, setPurchasePrice] = useState(fixedCost);
  const [salePrice, setSalePrice] = useState(fixedSale);
  const [mfgDate, setMfgDate] = useState('2025-01-01');
  const [expiryDate, setExpiryDate] = useState('2028-01-01');

  const grossMargin = salePrice > 0 ? (((salePrice - purchasePrice) / salePrice) * 100).toFixed(1) : '0';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchNumber.trim() || quantity <= 0) {
      alert('Please enter a valid batch number and quantity.');
      return;
    }
    onStockAdded({
      batchNumber: batchNumber.trim(),
      quantity: Number(quantity),
      purchasePrice: Number(purchasePrice),
      salePrice: Number(salePrice),
      mfgDate,
      expiryDate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Add Inward Stock & Fixed Price</h3>
              <p className="text-[11px] text-slate-300 truncate max-w-xs">
                {medicine.name} ({medicine.strength})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Batch Number *</label>
              <input
                type="text"
                required
                value={batchNumber}
                onChange={e => setBatchNumber(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Quantity Received *</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full p-2 border border-slate-200 rounded-lg font-bold text-center"
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
              Confirm Batch Stock
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

    exportToCSV(`PharmaCare_Inventory_${new Date().toISOString().split('T')[0]}`, exportRows);
  };

  return (
    <div className="space-y-4">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Pill className="w-5 h-5 text-teal-600" />
            Master Medicine Catalog & Fixed Price Inventory
          </h3>
          <p className="text-xs text-slate-500">
            Select multiple medicines at once to sell in POS • Fixed inventory prices auto-apply on sale
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors min-h-[42px]"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors min-h-[42px]"
          >
            <Upload className="w-3.5 h-3.5 text-teal-600" /> Bulk Import
          </button>

          <button
            onClick={() => {
              setMedicineToEdit(null);
              setShowAddEditModal(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors min-h-[42px]"
          >
            <Plus className="w-4 h-4" /> Add Medicine & Fixed Price
          </button>
        </div>
      </div>

      {/* Multi-Select Floating / Sticky Bar when items are selected for sale */}
      {selectedList.length > 0 && (
        <div className="sticky top-16 z-20 p-3.5 bg-slate-900 text-white rounded-2xl shadow-xl border border-teal-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500 text-slate-950 font-black flex items-center justify-center text-sm">
              {selectedList.length}
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                {selectedList.length} Medicine{selectedList.length !== 1 ? 's' : ''} Selected for Sale
              </p>
              <p className="text-[11px] text-teal-300 font-mono">
                Total at Fixed Inventory Prices: <strong>{formatPKR(selectedTotalValue)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedForSale({})}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Clear Selection
            </button>
            <button
              type="button"
              onClick={handleSellSelectedNow}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs shadow-md transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Sell Selected ({selectedList.length}) in POS</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Advanced Filters Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search brand, generic, barcode..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white"
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
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white"
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
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white"
            >
              <option value="All">All Stock Statuses</option>
              <option value="available">🟢 Available in Stock</option>
              <option value="low">🟡 Low Stock</option>
              <option value="out_of_stock">🔴 Out of Stock</option>
              <option value="near_expiry">🟠 Near Expiry (&lt;90 days)</option>
              <option value="expired">🟣 Expired Batches</option>
            </select>
          </div>
        </div>
      </div>

      {/* MOBILE TOUCH CARDS VIEW (<1024px) */}
      <div className="lg:hidden space-y-3">
        {filteredMedicines.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
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

            return (
              <div
                key={med.id}
                className={`bg-white rounded-2xl border shadow-xs p-4 space-y-3 transition-all ${
                  isChecked ? 'border-teal-500 bg-teal-50/20' : 'border-slate-200'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={!canSell}
                      onClick={() => toggleSelectForSale(med)}
                      className={`mt-0.5 p-1 rounded-lg ${
                        !canSell
                          ? 'text-slate-200'
                          : isChecked
                          ? 'text-teal-600 bg-teal-100'
                          : 'text-slate-400 hover:text-teal-600'
                      }`}
                    >
                      {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900">{med.name}</h4>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {med.medicineType}
                        </span>
                        {med.requiresPrescription && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Rx
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{med.genericName}</p>
                      <p className="text-[11px] text-slate-400">
                        {med.manufacturer} • {med.storageLocation}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-teal-800 font-mono block">
                      {fixedPrice > 0 ? formatPKR(fixedPrice) : 'N/A'}
                    </span>
                    <span className="text-[9px] text-teal-700 font-bold flex items-center justify-end gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> Fixed Price
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold border inline-block mt-1 ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.badgeBorder}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                </div>

                {/* If selected, show quantity selector */}
                {isChecked && (
                  <div className="flex items-center justify-between bg-teal-100/70 border border-teal-300 px-3 py-2 rounded-xl text-xs">
                    <span className="font-bold text-teal-950">Sale Quantity:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateSelectedQty(med, checkedQty - 1)}
                        className="w-6 h-6 rounded bg-white text-teal-900 flex items-center justify-center font-bold"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono font-black text-sm text-teal-950">{checkedQty}</span>
                      <button
                        type="button"
                        onClick={() => updateSelectedQty(med, checkedQty + 1)}
                        className="w-6 h-6 rounded bg-white text-teal-900 flex items-center justify-center font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Stock info */}
                <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Current Stock</span>
                    <strong className="text-slate-900 font-bold">{med.totalQuantity} units</strong>
                    <span className="text-slate-400 text-[10px] ml-1">(Min: {med.minStockLevel})</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px]">Earliest Expiry</span>
                    <strong className="font-mono text-slate-800">
                      {primaryBatch ? primaryBatch.expiryDate : 'N/A'}
                    </strong>
                  </div>
                </div>

                {/* 4 Action Buttons with high touch target (>44px) */}
                <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-slate-100">
                  {/* Sell Button */}
                  <button
                    type="button"
                    disabled={!canSell}
                    onClick={() => handleSellSingleMedicine(med)}
                    className="flex flex-col items-center justify-center min-h-[46px] py-1.5 px-1 rounded-xl bg-teal-50 hover:bg-teal-100 disabled:opacity-30 text-teal-800 font-bold text-[11px] transition-colors"
                    title="Sell at Fixed Price"
                  >
                    <ShoppingCart className="w-4 h-4 text-teal-600 mb-0.5" />
                    <span>Sell</span>
                  </button>

                  {/* Add Stock Button */}
                  <button
                    type="button"
                    onClick={() => setQuickStockMed(med)}
                    className="flex flex-col items-center justify-center min-h-[46px] py-1.5 px-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition-colors"
                    title="Add Inward Stock Batch"
                  >
                    <PackagePlus className="w-4 h-4 text-emerald-600 mb-0.5" />
                    <span>+ Stock</span>
                  </button>

                  {/* View Details / Batches */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMedForBatches(med);
                      setShowBatchModal(true);
                    }}
                    className="flex flex-col items-center justify-center min-h-[46px] py-1.5 px-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] transition-colors"
                    title="View Batches & Expiry"
                  >
                    <Eye className="w-4 h-4 text-slate-600 mb-0.5" />
                    <span>Batches</span>
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setMedicineToEdit(med);
                      setShowAddEditModal(true);
                    }}
                    className="flex flex-col items-center justify-center min-h-[46px] py-1.5 px-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-semibold text-[11px] transition-colors"
                    title="Edit Formulation & Fixed Price"
                  >
                    <Edit2 className="w-4 h-4 text-indigo-600 mb-0.5" />
                    <span>Edit</span>
                  </button>

                  {/* Delete Button */}
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
                    className="flex flex-col items-center justify-center min-h-[46px] py-1.5 px-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition-colors"
                    title="Delete Formulation"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600 mb-0.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP SORTABLE TABLE (>=1024px) */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    className="text-slate-500 hover:text-teal-600"
                    title="Select all available medicines for sale"
                  >
                    {selectableMedicines.length > 0 &&
                    selectableMedicines.every(m => !!selectedForSale[m.id]) ? (
                      <CheckSquare className="w-4 h-4 text-teal-600 mx-auto" />
                    ) : (
                      <Square className="w-4 h-4 mx-auto" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Medicine & Generic</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3">Type & Strength</th>
                <th className="py-3 px-3">Manufacturer</th>
                <th className="py-3 px-3 text-center">Batches</th>
                <th
                  onClick={() => toggleSort('stock')}
                  className="py-3 px-3 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Stock</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('price')}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <Lock className="w-3 h-3 text-teal-600" />
                    <span>Fixed Selling Price</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMedicines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No medicines matching the selected criteria.
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

                  return (
                    <tr
                      key={med.id}
                      className={`transition-colors ${
                        isChecked ? 'bg-teal-50/60 hover:bg-teal-50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Multi-select Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={!canSell}
                          onClick={() => toggleSelectForSale(med)}
                          className={`p-1 rounded transition-colors ${
                            !canSell
                              ? 'text-slate-200 cursor-not-allowed'
                              : isChecked
                              ? 'text-teal-600'
                              : 'text-slate-400 hover:text-teal-600'
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
                      <td className="py-3 px-3">
                        <div className="flex items-start gap-2">
                          <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                            {(med.name || 'M').charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{med.name || 'Medicine'}</span>
                            <span className="text-[11px] text-slate-500 block truncate max-w-xs">
                              {med.genericName || ''}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Barcode: {med.barcode || 'N/A'} • {med.storageLocation || 'Shelf'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type & Strength */}
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 block">{med.strength || '-'}</span>
                        <span className="text-[11px] text-slate-500">
                          {med.medicineType || 'Tablet'} • {med.packingSize || 'Pack'}
                        </span>
                      </td>

                      {/* Manufacturer */}
                      <td className="py-3 px-3 text-slate-700 font-medium">{med.manufacturer || '-'}</td>

                      {/* Batches count */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedMedForBatches(med);
                            setShowBatchModal(true);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1"
                        >
                          <Layers className="w-3 h-3 text-teal-600" />
                          <span>
                            {(med.batches || []).length} batch{(med.batches || []).length !== 1 ? 'es' : ''}
                          </span>
                        </button>
                      </td>

                      {/* Available Stock */}
                      <td className="py-3 px-3 text-center">
                        <span className="text-sm font-black text-slate-900">
                          {med.totalQuantity}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Min: {med.minStockLevel}
                        </span>
                      </td>

                      {/* Fixed Selling Price (with inline quick-edit for Admin/Pharmacist) */}
                      <td className="py-3 px-3 text-right">
                        {editingPriceMedId === med.id ? (
                          <div className="inline-flex items-center gap-1 justify-end">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={inlinePriceValue}
                              onChange={e => setInlinePriceValue(e.target.value)}
                              className="w-20 p-1 border-2 border-teal-500 rounded text-right font-mono font-bold text-xs"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveInlineFixedPrice(med)}
                              className="p-1 rounded bg-teal-600 text-white hover:bg-teal-700"
                              title="Save Fixed Price"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPriceMedId(null)}
                              className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="inline-flex items-center gap-1 justify-end">
                              <span className="font-mono font-black text-sm text-teal-800">
                                {fixedPrice > 0 ? formatPKR(fixedPrice) : 'N/A'}
                              </span>
                              {canModifyPrices && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPriceMedId(med.id);
                                    setInlinePriceValue(String(fixedPrice));
                                  }}
                                  className="text-slate-400 hover:text-teal-600 p-0.5"
                                  title="Click to set/edit fixed selling price"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {primaryBatch && (
                              <span className="text-[10px] text-slate-400 block font-mono">
                                Cost: {formatPKR(primaryBatch.purchasePrice)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] border ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.badgeBorder}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* If checked, show quantity stepper */}
                          {isChecked && (
                            <div className="flex items-center gap-1 bg-teal-100 border border-teal-400 rounded-lg px-1.5 py-0.5 mr-1">
                              <button
                                type="button"
                                onClick={() => updateSelectedQty(med, checkedQty - 1)}
                                className="w-4 h-4 rounded bg-white text-teal-900 flex items-center justify-center font-bold"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="font-mono font-bold text-xs text-teal-950 px-1">
                                {checkedQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateSelectedQty(med, checkedQty + 1)}
                                className="w-4 h-4 rounded bg-white text-teal-900 flex items-center justify-center font-bold"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}

                          {/* Sell Button */}
                          <button
                            type="button"
                            disabled={!canSell}
                            onClick={() => handleSellSingleMedicine(med)}
                            className="px-2 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                            title="Sell at Fixed Price in POS"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>Sell</span>
                          </button>

                          {/* Quick Add Stock */}
                          <button
                            onClick={() => setQuickStockMed(med)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Quick Add Inward Stock"
                          >
                            <PackagePlus className="w-4 h-4 text-emerald-600" />
                          </button>

                          {/* Manage Batches */}
                          <button
                            onClick={() => {
                              setSelectedMedForBatches(med);
                              setShowBatchModal(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            title="Manage Batches"
                          >
                            <Layers className="w-4 h-4" />
                          </button>

                          {/* Edit (Admin or permitted role only) */}
                          {canModifyPrices ? (
                            <button
                              onClick={() => {
                                setMedicineToEdit(med);
                                setShowAddEditModal(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit Formulation & Fixed Selling Price"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span
                              className="p-1.5 text-slate-300 cursor-not-allowed"
                              title="Cashiers cannot modify official medicine prices"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}

                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Are you sure you want to delete ${med.name}? It will be removed immediately from inventory and database across all devices.`
                                )
                              ) {
                                deleteMedicine(med.id);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Formulation"
                          >
                            <Trash2 className="w-4 h-4" />
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
          if (quickStockMed) {
            if (batch.salePrice && batch.salePrice > 0) {
              updateMedicine(quickStockMed.id, {
                fixedSalePrice: Number(batch.salePrice),
                fixedPurchasePrice: Number(batch.purchasePrice || 0),
              });
            }
            addBatch(quickStockMed.id, {
              batchNumber: batch.batchNumber || `BAT-${Date.now()}`,
              quantity: Number(batch.quantity || 1),
              initialQuantity: Number(batch.quantity || 1),
              purchasePrice: Number(batch.purchasePrice || 0),
              salePrice: Number(batch.salePrice || 0),
              mfgDate: batch.mfgDate || '2025-01-01',
              expiryDate: batch.expiryDate || '2028-01-01',
              receivedDate: new Date().toISOString().split('T')[0],
            });
          }
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
