/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Barcode,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  User,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  UserPlus,
  X,
  Pill,
  CheckSquare,
  Square,
  Lock,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { Medicine, MedicineBatch, PaymentMethod, Sale } from '../../types/pharmacy';
import { formatPKR, isExpired, getFefoBatches } from '../../utils/helpers';
import { InvoiceModal } from './InvoiceModal';
import { SaleReturnModal } from './SaleReturnModal';

interface CartItem {
  medicine: Medicine;
  selectedBatch: MedicineBatch;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
}

export const POSScreen: React.FC = () => {
  const { isAdmin } = useAuth();
  const {
    medicines,
    customers,
    settings,
    processSale,
    addCustomer,
    queuedPosItems,
    clearQueuedPosItems,
  } = useStore();

  // Search & Scanner state
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Multi-select state: medicineId -> quantity to add
  const [multiSelected, setMultiSelected] = useState<Record<string, number>>({});

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState<string>('');

  // Post-sale / Return modals
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Helper to get the fixed inventory price for any medicine
  const getFixedInventoryPrice = useCallback((med: Medicine, batch?: MedicineBatch): number => {
    if (med.fixedSalePrice !== undefined && med.fixedSalePrice > 0) {
      return med.fixedSalePrice;
    }
    if (batch && batch.salePrice > 0) {
      return batch.salePrice;
    }
    return med.batches[0]?.salePrice || 0;
  }, []);

  // Add medicine to cart with automatic FEFO batch selection and fixed inventory price
  const addToCartWithQty = useCallback(
    (med: Medicine, qtyToAdd = 1, specificBatch?: MedicineBatch) => {
      setErrorMessage('');
      const fefoBatches = getFefoBatches(med);

      if (fefoBatches.length === 0) {
        setErrorMessage(`Cannot add ${med.name}: All batches are out of stock or EXPIRED.`);
        return false;
      }

      const batchToUse = specificBatch || fefoBatches[0];

      if (isExpired(batchToUse.expiryDate)) {
        setErrorMessage(
          `CRITICAL: Batch ${batchToUse.batchNumber} of ${med.name} is EXPIRED (${batchToUse.expiryDate}) and blocked from sale.`
        );
        return false;
      }

      const fixedPrice = getFixedInventoryPrice(med, batchToUse);

      setCart(prev => {
        const existingIndex = prev.findIndex(
          item => item.medicine.id === med.id && item.selectedBatch.id === batchToUse.id
        );
        const currentQtyInCart = existingIndex >= 0 ? prev[existingIndex].quantity : 0;
        const targetQty = Math.min(batchToUse.quantity, currentQtyInCart + qtyToAdd);

        if (currentQtyInCart + qtyToAdd > batchToUse.quantity) {
          setErrorMessage(
            `Maximum available stock reached for ${med.name} (Batch ${batchToUse.batchNumber}: ${batchToUse.quantity} available).`
          );
        }

        if (targetQty <= 0) return prev;

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: targetQty,
            unitPrice: fixedPrice,
          };
          return updated;
        } else {
          return [
            ...prev,
            {
              medicine: med,
              selectedBatch: batchToUse,
              quantity: targetQty,
              unitPrice: fixedPrice,
              discountAmount: 0,
            },
          ];
        }
      });

      return true;
    },
    [getFixedInventoryPrice]
  );

  // Consume any multi-selected medicines queued from the Inventory screen
  useEffect(() => {
    if (queuedPosItems && queuedPosItems.length > 0) {
      let addedCount = 0;
      queuedPosItems.forEach(qItem => {
        const med = medicines.find(m => m.id === qItem.medicineId);
        if (med) {
          const ok = addToCartWithQty(med, qItem.quantity);
          if (ok) addedCount++;
        }
      });
      clearQueuedPosItems();
      if (addedCount > 0) {
        setSuccessToast(
          `Added ${addedCount} selected medicine(s) to bill at their fixed inventory prices.`
        );
        setTimeout(() => setSuccessToast(''), 4000);
      }
    }
  }, [queuedPosItems, medicines, addToCartWithQty, clearQueuedPosItems]);

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach(m => {
      if (m.category) set.add(m.category);
    });
    return ['All', ...Array.from(set)];
  }, [medicines]);

  // Filtered medicines for product grid/table
  const filteredMedicines = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (medicines || []).filter(med => {
      if (!med || med.status !== 'active') return false;
      const matchesCat = selectedCategory === 'All' || med.category === selectedCategory;
      const matchesSearch =
        !q ||
        String(med.name || '').toLowerCase().includes(q) ||
        String(med.genericName || '').toLowerCase().includes(q) ||
        String(med.brandName || '').toLowerCase().includes(q) ||
        String(med.barcode || '').includes(q) ||
        String(med.code || '').toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [medicines, searchQuery, selectedCategory]);

  // Available selectable medicines in current view
  const selectableFilteredMedicines = useMemo(() => {
    return filteredMedicines.filter(med => {
      const fefoBatches = getFefoBatches(med);
      const totalNonExpiredQty = fefoBatches.reduce((sum, b) => sum + b.quantity, 0);
      return totalNonExpiredQty > 0;
    });
  }, [filteredMedicines]);

  // Multi-select handlers
  const toggleMultiSelect = (med: Medicine) => {
    const fefoBatches = getFefoBatches(med);
    if (fefoBatches.length === 0) return;

    setMultiSelected(prev => {
      const next = { ...prev };
      if (next[med.id]) {
        delete next[med.id];
      } else {
        next[med.id] = 1;
      }
      return next;
    });
  };

  const updateMultiSelectQty = (med: Medicine, qty: number) => {
    const fefoBatches = getFefoBatches(med);
    const maxQty = fefoBatches[0]?.quantity || 1;
    const clamped = Math.max(1, Math.min(maxQty, qty));
    setMultiSelected(prev => ({
      ...prev,
      [med.id]: clamped,
    }));
  };

  const handleSelectAllVisible = () => {
    const allSelected =
      selectableFilteredMedicines.length > 0 &&
      selectableFilteredMedicines.every(m => !!multiSelected[m.id]);

    if (allSelected) {
      setMultiSelected(prev => {
        const next = { ...prev };
        selectableFilteredMedicines.forEach(m => {
          delete next[m.id];
        });
        return next;
      });
    } else {
      setMultiSelected(prev => {
        const next = { ...prev };
        selectableFilteredMedicines.forEach(m => {
          if (!next[m.id]) next[m.id] = 1;
        });
        return next;
      });
    }
  };

  const selectedEntries = useMemo(() => {
    return Object.entries(multiSelected)
      .map(([medId, qty]) => {
        const med = medicines.find(m => m.id === medId);
        if (!med) return null;
        const fefoBatches = getFefoBatches(med);
        const primaryBatch = fefoBatches[0];
        const fixedPrice = getFixedInventoryPrice(med, primaryBatch);
        return { med, qty, fixedPrice };
      })
      .filter((x): x is { med: Medicine; qty: number; fixedPrice: number } => x !== null);
  }, [multiSelected, medicines, getFixedInventoryPrice]);

  const multiSelectTotalAmount = useMemo(() => {
    return selectedEntries.reduce((sum, item) => sum + item.fixedPrice * item.qty, 0);
  }, [selectedEntries]);

  const handleAddAllSelectedToCart = () => {
    if (selectedEntries.length === 0) return;
    let added = 0;
    selectedEntries.forEach(({ med, qty }) => {
      const ok = addToCartWithQty(med, qty);
      if (ok) added++;
    });
    setMultiSelected({});
    if (added > 0) {
      setSuccessToast(`Added ${added} selected medicine(s) to the billing cart at fixed prices!`);
      setTimeout(() => setSuccessToast(''), 3500);
    }
  };

  // Handle barcode quick entry
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matchedMed = medicines.find(m => m.barcode === barcodeInput.trim());
    if (matchedMed) {
      addToCartWithQty(matchedMed, 1);
      setBarcodeInput('');
      setErrorMessage('');
    } else {
      setErrorMessage(`No medicine found with barcode "${barcodeInput}"`);
    }
  };

  // Update quantity for a cart item
  const updateCartQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }

    const item = cart[index];
    if (newQty > item.selectedBatch.quantity) {
      setErrorMessage(
        `Cannot set quantity above available batch stock of ${item.selectedBatch.quantity}`
      );
      return;
    }

    const updated = [...cart];
    updated[index].quantity = newQty;
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setOrderDiscount(0);
    setDiscountPercent(0);
    setCashTendered('');
    setErrorMessage('');
  };

  // Calculate Subtotals & Grand Totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  // Apply discount percent
  const handleDiscountPercentChange = (pct: number) => {
    if (!isAdmin && settings.allowStaffDiscounts && pct > settings.maxStaffDiscountPercentage) {
      setErrorMessage(
        `Staff discount cannot exceed ${settings.maxStaffDiscountPercentage}%. Contact admin for higher discounts.`
      );
      pct = settings.maxStaffDiscountPercentage;
    }
    setDiscountPercent(pct);
    const calculatedDiscount = (subtotal * pct) / 100;
    setOrderDiscount(Number(calculatedDiscount.toFixed(2)));
  };

  const taxAmount = useMemo(() => {
    const afterDiscount = Math.max(0, subtotal - orderDiscount);
    return (afterDiscount * (settings.taxRatePercentage || 0)) / 100;
  }, [subtotal, orderDiscount, settings.taxRatePercentage]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - orderDiscount + taxAmount);
  }, [subtotal, orderDiscount, taxAmount]);

  const changeDue = useMemo(() => {
    const tendered = parseFloat(cashTendered);
    if (isNaN(tendered) || tendered < grandTotal) return 0;
    return tendered - grandTotal;
  }, [cashTendered, grandTotal]);

  // Complete Sale
  const handleCompleteSale = () => {
    setErrorMessage('');

    if (cart.length === 0) {
      setErrorMessage('Cart is empty. Please select medicines to proceed.');
      return;
    }

    const tenderedNum = parseFloat(cashTendered);
    if (paymentMethod === 'Cash' && cashTendered && tenderedNum < grandTotal) {
      setErrorMessage(
        `Insufficient cash tendered. Total is ${formatPKR(grandTotal)}, but received only ${formatPKR(tenderedNum)}.`
      );
      return;
    }

    if (paymentMethod === 'Credit' && !selectedCustomerId) {
      setErrorMessage(
        'Credit sales require selecting a registered patient/customer from the dropdown or creating a new patient.'
      );
      return;
    }

    const saleItems = cart.map(item => ({
      medicineId: item.medicine.id,
      batchId: item.selectedBatch.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
    }));

    const actualAmountPaid =
      paymentMethod === 'Credit'
        ? 0
        : paymentMethod === 'Cash' && tenderedNum
        ? tenderedNum
        : grandTotal;

    const result = processSale({
      customerId: selectedCustomerId || undefined,
      customerName: customerName || 'Walk-in Customer',
      customerPhone: customerPhone || undefined,
      items: saleItems,
      discountTotal: orderDiscount,
      paymentMethod,
      amountPaid: actualAmountPaid,
      notes: saleNotes,
    });

    if (result.success && result.sale) {
      setCompletedSale(result.sale);
      setShowInvoiceModal(true);
      clearCart();
      setMultiSelected({});
      setSuccessToast(`Sale ${result.sale.invoiceNumber} completed successfully!`);
      setTimeout(() => setSuccessToast(''), 4000);
    } else {
      setErrorMessage(result.error || 'Failed to process sale. Check batch availability.');
    }
  };

  // Quick Customer Creation
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      alert('Customer name and phone number are required.');
      return;
    }

    const created = addCustomer({
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      address: newCustAddress.trim(),
    });

    setSelectedCustomerId(created.id);
    setCustomerName(created.name);
    setCustomerPhone(created.phone);
    setShowAddCustomerModal(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
  };

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {successToast && (
        <div className="p-3 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-600 text-white text-xs font-semibold rounded-xl shadow-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Two-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (7 Cols): Medicine Search & Multi-Select Inventory Catalog */}
        <div className="lg:col-span-7 space-y-4">
          {/* Barcode & Search Bar */}
          <div className="p-4 pro-card space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Name/Generic Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search brand, generic (e.g. Paracetamol), strength or barcode..."
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[42px]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Barcode Scanner Simulator Input */}
              <form onSubmit={handleBarcodeSubmit} className="relative sm:w-56">
                <Barcode className="w-4 h-4 text-[#0F766E] absolute left-3 top-3" />
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode [Enter]"
                  className="w-full pl-9 pr-14 py-2.5 bg-slate-50/90 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[42px]"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 px-2.5 py-1.5 rounded-lg bg-[#0F766E] hover:bg-[#0D655E] text-white text-[10px] font-bold transition-colors"
                >
                  Add
                </button>
              </form>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors min-h-[34px] cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#0B191E] text-emerald-300 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Sticky Multi-Select Action Banner when multiple items are checked */}
          {selectedEntries.length > 0 && (
            <div className="p-3.5 bg-[#0B191E] text-white rounded-2xl shadow-lg border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm shrink-0">
                  {selectedEntries.length}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    {selectedEntries.length} Medicine{selectedEntries.length !== 1 ? 's' : ''} Selected for Sale
                  </p>
                  <p className="text-[11px] text-emerald-300 font-mono tabular-nums">
                    Fixed Inventory Total: <strong>{formatPKR(multiSelectTotalAmount)}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMultiSelected({})}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition-colors min-h-[38px]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleAddAllSelectedToCart}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all min-h-[38px]"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Add {selectedEntries.length} to Bill</span>
                </button>
              </div>
            </div>
          )}

          {/* Medicines Grid / Catalog */}
          <div className="pro-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-[#0F766E] min-h-[34px]"
                >
                  {selectableFilteredMedicines.length > 0 &&
                  selectableFilteredMedicines.every(m => !!multiSelected[m.id]) ? (
                    <CheckSquare className="w-4 h-4 text-[#0F766E]" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Select Multiple ({filteredMedicines.length})</span>
                </button>
              </div>
              <span className="font-semibold text-[#0F766E] flex items-center gap-1">
                <Lock className="w-3 h-3" /> Fixed Price · FEFO Active
              </span>
            </div>

            <div className="max-h-[540px] overflow-y-auto no-scrollbar space-y-2">
              {filteredMedicines.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Pill className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No medicines matching your search.</p>
                </div>
              ) : (
                filteredMedicines.map(med => {
                  const fefoBatches = getFefoBatches(med);
                  const totalNonExpiredQty = fefoBatches.reduce((sum, b) => sum + b.quantity, 0);
                  const primaryBatch = fefoBatches[0];
                  const hasExpiredOnly = med.totalQuantity > 0 && totalNonExpiredQty === 0;
                  const isDisabled = totalNonExpiredQty === 0 || hasExpiredOnly;
                  const fixedPrice = getFixedInventoryPrice(med, primaryBatch);

                  const isChecked = !!multiSelected[med.id];
                  const checkedQty = multiSelected[med.id] || 1;

                  const cartIndex = cart.findIndex(item => item.medicine.id === med.id);
                  const inCartItem = cartIndex >= 0 ? cart[cartIndex] : null;

                  return (
                    <div
                      key={med.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isChecked
                          ? 'border-teal-500 bg-teal-50/40 shadow-xs'
                          : inCartItem
                          ? 'border-emerald-400 bg-emerald-50/20'
                          : 'border-slate-200 hover:border-teal-400 bg-white hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Left: Checkbox + Med Details */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Multi-Select Checkbox */}
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => toggleMultiSelect(med)}
                          className={`mt-0.5 p-1 rounded-lg transition-colors shrink-0 ${
                            isDisabled
                              ? 'text-slate-200 cursor-not-allowed'
                              : isChecked
                              ? 'text-teal-600 bg-teal-100/80'
                              : 'text-slate-400 hover:text-teal-600 hover:bg-slate-100'
                          }`}
                          title="Select multiple items for sale"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>

                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => {
                            if (!isDisabled) toggleMultiSelect(med);
                          }}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-slate-900 truncate">
                              {med.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {med.medicineType}
                            </span>
                            {med.requiresPrescription && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Rx Only
                              </span>
                            )}
                            {inCartItem && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                                In Bill: {inCartItem.quantity}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 truncate">
                            {med.genericName} • <span className="text-slate-600">{med.manufacturer}</span>
                          </p>

                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px]">
                            {/* Stock Status Badge */}
                            {hasExpiredOnly ? (
                              <span className="text-rose-900 font-bold bg-rose-100 px-2 py-0.5 rounded text-[10px]">
                                EXPIRED BATCH ONLY (Sale Blocked)
                              </span>
                            ) : totalNonExpiredQty === 0 ? (
                              <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded text-[10px]">
                                Out of Stock
                              </span>
                            ) : totalNonExpiredQty <= med.minStockLevel ? (
                              <span className="text-yellow-800 font-bold bg-yellow-100 px-2 py-0.5 rounded text-[10px]">
                                Low Stock ({totalNonExpiredQty} left)
                              </span>
                            ) : (
                              <span className="text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                                {totalNonExpiredQty} units in stock
                              </span>
                            )}

                            {primaryBatch && (
                              <span className="text-slate-500 font-mono text-[10px]">
                                Batch: <span className="text-slate-700 font-bold">{primaryBatch.batchNumber}</span> (Exp: {primaryBatch.expiryDate})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Fixed Inventory Price & Multi-Select Qty / Add to Cart button */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pl-8 sm:pl-0">
                        <div className="text-left sm:text-right">
                          <span className="text-base font-black text-teal-800 font-mono block">
                            {fixedPrice > 0 ? formatPKR(fixedPrice) : 'N/A'}
                          </span>
                          <span className="text-[10px] text-slate-500 inline-flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-teal-600" /> Fixed Inventory Price
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* If checked in multi-select, show inline qty adjuster for batch add */}
                          {isChecked && (
                            <div className="flex items-center gap-1 bg-teal-100/80 border border-teal-400 rounded-lg px-1.5 py-1">
                              <button
                                type="button"
                                onClick={() => updateMultiSelectQty(med, checkedQty - 1)}
                                className="w-5 h-5 rounded bg-white text-teal-900 flex items-center justify-center font-bold text-xs"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={primaryBatch?.quantity || 999}
                                value={checkedQty}
                                onChange={e => updateMultiSelectQty(med, parseInt(e.target.value) || 1)}
                                className="w-10 text-center font-mono font-bold text-xs bg-transparent text-teal-950 focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() => updateMultiSelectQty(med, checkedQty + 1)}
                                className="w-5 h-5 rounded bg-white text-teal-900 flex items-center justify-center font-bold text-xs"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {/* Direct 1-click Add or In-Cart Stepper */}
                          {inCartItem ? (
                            <div className="flex items-center gap-1 bg-emerald-600 text-white rounded-lg px-1.5 py-1">
                              <button
                                type="button"
                                onClick={() => updateCartQty(cartIndex, inCartItem.quantity - 1)}
                                className="w-5 h-5 rounded bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center font-bold text-xs"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-1.5 font-mono font-bold text-xs">
                                {inCartItem.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartQty(cartIndex, inCartItem.quantity + 1)}
                                className="w-5 h-5 rounded bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center font-bold text-xs"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isDisabled}
                              onClick={() => addToCartWithQty(med, isChecked ? checkedQty : 1)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-bold text-xs shadow-xs transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 Cols): POS Cart, Customer Details & Cashier Checkout */}
        <div id="pos-cart-section" className="lg:col-span-5 space-y-4">
          <div className="pro-card overflow-hidden">
            {/* Cart Header */}
            <div className="p-4 bg-[#0B191E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">
                  Active Billing Cart
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-slate-950 tabular-nums">
                  {cart.length} item{cart.length !== 1 ? 's' : ''}
                </span>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-rose-300 hover:text-rose-100 flex items-center gap-1 font-semibold px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Cart
                </button>
              )}
            </div>

            {/* Customer Selector Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-teal-600" /> Customer Information
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="text-[11px] text-teal-600 font-bold hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" /> New Patient
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedCustomerId}
                  onChange={e => {
                    const cid = e.target.value;
                    setSelectedCustomerId(cid);
                    if (!cid) {
                      setCustomerName('Walk-in Customer');
                      setCustomerPhone('');
                    } else {
                      const cust = customers.find(c => c.id === cid);
                      if (cust) {
                        setCustomerName(cust.name);
                        setCustomerPhone(cust.phone);
                      }
                    }
                  }}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Patient Name"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>
            </div>

            {/* Cart Items List */}
            <div className="max-h-72 overflow-y-auto no-scrollbar divide-y divide-slate-100 p-2">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs px-4">
                    Tick multiple medicines on the left and click &quot;Add to Bill&quot;, or tap + Add.
                  </p>
                </div>
              ) : (
                cart.map((item, index) => (
                  <div
                    key={`${item.medicine.id}-${item.selectedBatch.id}`}
                    className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50 rounded-xl"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {item.medicine.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 shrink-0">
                          {item.medicine.medicineType}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[#0F766E] font-semibold">
                          Batch: {item.selectedBatch.batchNumber}
                        </span>
                        <span>·</span>
                        <span>Exp: {item.selectedBatch.expiryDate}</span>
                      </div>
                      <div className="text-[11px] font-mono tabular-nums font-bold text-[#0F766E] mt-0.5 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-emerald-600" />
                        <span>{formatPKR(item.unitPrice)} / unit</span>
                      </div>
                    </div>

                    {/* Qty +/- & Delete */}
                    <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateCartQty(index, item.quantity - 1)}
                          className="w-8 h-8 sm:w-6 sm:h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                        >
                          <Minus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                        </button>

                        <input
                          type="number"
                          min="1"
                          max={item.selectedBatch.quantity}
                          value={item.quantity}
                          onChange={e => updateCartQty(index, parseInt(e.target.value) || 1)}
                          className="w-12 py-1 text-center font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
                        />

                        <button
                          onClick={() => updateCartQty(index, item.quantity + 1)}
                          className="w-8 h-8 sm:w-6 sm:h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                        >
                          <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="w-16 text-right font-mono tabular-nums font-bold text-xs text-slate-900">
                          {formatPKR(item.unitPrice * item.quantity)}
                        </div>

                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Calculations & Discounts */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Cart Subtotal (Fixed Inventory Prices):</span>
                <span className="font-mono font-bold text-slate-800">{formatPKR(subtotal)}</span>
              </div>

              {/* Discount Selector */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
                <span className="font-medium text-slate-700">Special Discount:</span>
                <div className="flex items-center gap-1">
                  {[0, 5, 10].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleDiscountPercentChange(pct)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        discountPercent === pct
                          ? 'bg-teal-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                  <div className="flex items-center bg-white border border-slate-200 rounded px-1.5 py-0.5 w-20">
                    <span className="text-[10px] text-slate-400">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      value={orderDiscount}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setOrderDiscount(val);
                        setDiscountPercent(0);
                      }}
                      className="w-full text-right text-xs font-mono font-bold focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {settings.taxRatePercentage > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Sales Tax ({settings.taxRatePercentage}%):</span>
                  <span className="font-mono font-semibold">{formatPKR(taxAmount)}</span>
                </div>
              )}

              {/* Grand Total Bar */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#0B191E] to-[#114842] text-white flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-300 block tracking-wider">
                    Total Payable
                  </span>
                  <span className="text-xl font-black font-mono tabular-nums tracking-tight">
                    {formatPKR(grandTotal)}
                  </span>
                </div>
                <div className="text-right text-[11px] text-emerald-200 font-mono tabular-nums">
                  {cart.length} item(s)
                </div>
              </div>

              {/* Payment Method Tabs */}
              <div className="pt-2">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Select Payment Method:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-[11px]">
                  {(
                    ['Cash', 'Card', 'Bank Transfer', 'EasyPaisa', 'JazzCash', 'Credit'] as PaymentMethod[]
                  ).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-1 rounded-xl font-bold text-center border transition-all min-h-[38px] ${
                        paymentMethod === method
                          ? method === 'Credit'
                            ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                            : 'bg-[#0F766E] text-white border-[#0F766E] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Cash Presets & Change Calculator */}
              {paymentMethod === 'Cash' && (
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-600">
                      Cash Received (PKR):
                    </span>
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={e => setCashTendered(e.target.value)}
                      placeholder={grandTotal.toString()}
                      className="w-28 p-1 bg-slate-50 border border-slate-200 rounded text-right font-mono font-bold text-xs"
                    />
                  </div>

                  {/* Cash Preset Buttons */}
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-[10px] text-slate-400 mr-1">Quick:</span>
                    {[500, 1000, 2000, 5000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashTendered(amt.toString())}
                        className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px] font-semibold"
                      >
                        {amt}
                      </button>
                    ))}
                  </div>

                  {parseFloat(cashTendered) > grandTotal && (
                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                      <span>Change to Return:</span>
                      <span className="font-mono text-sm">{formatPKR(changeDue)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Complete Checkout Button */}
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={handleCompleteSale}
                className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-md shadow-teal-700/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Confirm Sale & Print Cash Memo</span>
              </button>
            </div>
          </div>

          {/* Quick Trigger for Returns / Refunds */}
          <div className="text-center">
            <button
              onClick={() => setShowReturnModal(true)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 py-1 px-3 rounded-lg border border-slate-300 bg-white"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              Process Patient Sale Return / Stock Refund
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Receipt Modal */}
      <InvoiceModal
        sale={completedSale}
        settings={settings}
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
      />

      {/* Sale Return / Refund Modal */}
      <SaleReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
      />

      {/* Quick Add Patient Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-teal-600" /> Register Customer / Patient
              </h3>
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Patient Name *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Phone Number (Mobile) *
                </label>
                <input
                  type="text"
                  required
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Address / Clinic (Optional)
                </label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={e => setNewCustAddress(e.target.value)}
                  placeholder="Street / Area in Karachi"
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 py-2 bg-slate-100 rounded-lg font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold"
                >
                  Save Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Floating Cart Summary Bar (<1024px) positioned above bottom nav */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-[62px] left-2 right-2 z-30 p-2.5 bg-[#0B191E]/95 backdrop-blur-md border border-emerald-500/40 rounded-2xl shadow-2xl flex items-center justify-between gap-2 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2.5 pl-1.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center tabular-nums">
              {cart.length}
            </span>
            <div>
              <p className="text-white text-xs font-bold leading-tight font-mono tabular-nums">
                {formatPKR(grandTotal)}
              </p>
              <p className="text-[10px] text-emerald-300">
                {cart.reduce((s, i) => s + i.quantity, 0)} units in cart
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              document.getElementById('pos-cart-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md active:scale-95 transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Checkout &rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
};
