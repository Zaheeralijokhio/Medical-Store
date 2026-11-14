/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Pill, Plus, Calendar, DollarSign, Barcode, MapPin, Lock, CheckCircle2 } from 'lucide-react';
import { Medicine, MedicineType } from '../../types/pharmacy';
import { useStore } from '../../context/StoreContext';
import { formatPKR } from '../../utils/helpers';

interface MedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicineToEdit?: Medicine | null;
}

export const MedicineModal: React.FC<MedicineModalProps> = ({
  isOpen,
  onClose,
  medicineToEdit,
}) => {
  const { suppliers, addMedicine, updateMedicine } = useStore();

  const isEditing = !!medicineToEdit;

  // Medicine core fields
  const [name, setName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [category, setCategory] = useState('Analgesics & Antipyretics');
  const [manufacturer, setManufacturer] = useState('GlaxoSmithKline (GSK)');
  const [medicineType, setMedicineType] = useState<MedicineType>('Tablet');
  const [strength, setStrength] = useState('500mg');
  const [packingSize, setPackingSize] = useState('Box of 200 Tablets');
  const [barcode, setBarcode] = useState('');
  const [minStockLevel, setMinStockLevel] = useState(25);
  const [storageLocation, setStorageLocation] = useState('Shelf A-1');
  const [description, setDescription] = useState('');
  const [requiresPrescription, setRequiresPrescription] = useState(false);

  // Fixed Inventory Price & Batch fields
  const [batchNumber, setBatchNumber] = useState('');
  const [purchasePrice, setPurchasePrice] = useState(10);
  const [salePrice, setSalePrice] = useState(15);
  const [wholesalePrice, setWholesalePrice] = useState(13.5);
  const [initialQuantity, setInitialQuantity] = useState(100);
  const [mfgDate, setMfgDate] = useState('2025-01-01');
  const [expiryDate, setExpiryDate] = useState('2027-12-31');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');

  const [formError, setFormError] = useState('');

  // Reset form fields ONLY when the modal opens or when switching which medicine is being edited.
  // Never depend on `suppliers` array reference here so background polling never clears typed inputs!
  useEffect(() => {
    if (!isOpen) return;
    setFormError('');

    if (medicineToEdit) {
      setName(medicineToEdit.name);
      setGenericName(medicineToEdit.genericName);
      setBrandName(medicineToEdit.brandName);
      setCategory(medicineToEdit.category);
      setManufacturer(medicineToEdit.manufacturer);
      setMedicineType(medicineToEdit.medicineType);
      setStrength(medicineToEdit.strength);
      setPackingSize(medicineToEdit.packingSize);
      setBarcode(medicineToEdit.barcode);
      setMinStockLevel(medicineToEdit.minStockLevel);
      setStorageLocation(medicineToEdit.storageLocation);
      setDescription(medicineToEdit.description || '');
      setRequiresPrescription(medicineToEdit.requiresPrescription || false);

      const primaryBatch = (medicineToEdit.batches || [])[0];
      const currentFixedSale =
        medicineToEdit.fixedSalePrice !== undefined
          ? medicineToEdit.fixedSalePrice
          : primaryBatch?.salePrice || 15;
      const currentFixedCost =
        medicineToEdit.fixedPurchasePrice !== undefined
          ? medicineToEdit.fixedPurchasePrice
          : primaryBatch?.purchasePrice || 10;

      setSalePrice(currentFixedSale);
      setPurchasePrice(currentFixedCost);
      setWholesalePrice(primaryBatch?.wholesalePrice || Number((currentFixedSale * 0.92).toFixed(2)));
    } else {
      // Default reset only when modal first opens for a new medicine
      setName('');
      setGenericName('');
      setBrandName('');
      setCategory('Analgesics & Antipyretics');
      setManufacturer('GlaxoSmithKline (GSK)');
      setMedicineType('Tablet');
      setStrength('500mg');
      setPackingSize('Box of 100 Tablets');
      setBarcode(`8964000${Math.floor(100000 + Math.random() * 900000)}`);
      setMinStockLevel(25);
      setStorageLocation('Shelf A-1');
      setDescription('');
      setRequiresPrescription(false);

      const rndBatch = `BAT-${new Date().getFullYear().toString().slice(-2)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(10 + Math.random() * 90)}`;
      setBatchNumber(rndBatch);
      setPurchasePrice(15);
      setSalePrice(20);
      setWholesalePrice(18);
      setInitialQuantity(100);
      setMfgDate('2025-01-10');
      setExpiryDate('2027-12-31');
      if (suppliers.length > 0) {
        setSupplierId(suppliers[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, medicineToEdit?.id]);

  // Separate effect to populate default supplierId if suppliers finish loading after modal open
  useEffect(() => {
    if (!isOpen) return;
    if (suppliers.length > 0 && (!supplierId || !suppliers.some(s => s.id === supplierId))) {
      setSupplierId(suppliers[0].id);
    }
  }, [isOpen, suppliers, supplierId]);

  if (!isOpen) return null;

  const unitProfit = Math.max(0, Number(salePrice) - Number(purchasePrice));
  const profitMarginPct = salePrice > 0 ? ((unitProfit / Number(salePrice)) * 100).toFixed(1) : '0.0';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const cleanName = name.trim();
    const cleanGeneric = genericName.trim() || cleanName;
    if (!cleanName) {
      setFormError('Please enter the Commercial Medicine Name.');
      return;
    }

    if (isEditing && medicineToEdit) {
      updateMedicine(medicineToEdit.id, {
        name: cleanName,
        genericName: cleanGeneric,
        brandName: brandName.trim() || cleanName.split(' ')[0],
        category,
        manufacturer,
        medicineType,
        strength,
        packingSize,
        barcode: barcode.trim(),
        minStockLevel: Number(minStockLevel),
        storageLocation,
        description,
        requiresPrescription,
        fixedSalePrice: Number(salePrice),
        fixedPurchasePrice: Number(purchasePrice),
      });
    } else {
      const selectedSup = suppliers.find(s => s.id === supplierId);
      addMedicine(
        {
          code: `MED-${Math.floor(100 + Math.random() * 900)}`,
          name: cleanName,
          genericName: cleanGeneric,
          brandName: brandName.trim() || cleanName.split(' ')[0],
          category,
          manufacturer,
          medicineType,
          strength,
          packingSize,
          barcode: barcode.trim() || `${Date.now()}`,
          minStockLevel: Number(minStockLevel),
          storageLocation,
          description,
          requiresPrescription,
          fixedSalePrice: Number(salePrice),
          fixedPurchasePrice: Number(purchasePrice),
          status: 'active',
          batches: [],
        },
        batchNumber.trim()
          ? {
              batchNumber: batchNumber.trim(),
              purchasePrice: Number(purchasePrice),
              salePrice: Number(salePrice),
              wholesalePrice: Number(wholesalePrice),
              quantity: Number(initialQuantity),
              mfgDate,
              expiryDate,
              supplierId: selectedSup?.id,
              supplierName: selectedSup?.companyName,
            }
          : undefined
      );
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-[#0B191E] text-white flex items-center justify-between gap-2 shrink-0 border-b border-emerald-500/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <Pill className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-white truncate">
                {isEditing ? `Edit Medicine & Fixed Price: ${medicineToEdit?.name}` : 'Register New Medicine & Fixed Selling Price'}
              </h3>
              <p className="text-[11px] text-slate-300">
                Selling price set here is fixed &amp; automatically locked during POS counter billing
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-xs">
              {formError}
            </div>
          )}
          {/* Basic Formulation Details */}
          <div>
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
              1. Medicine General Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Commercial Medicine Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Panadol 500mg, Augmentin 625mg"
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Generic Chemical Formula</label>
                <input
                  type="text"
                  value={genericName}
                  onChange={e => setGenericName(e.target.value)}
                  placeholder="e.g. Paracetamol, Omeprazole (optional)"
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Brand / Trade Name</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={e => setBrandName(e.target.value)}
                  placeholder="e.g. Panadol, Risek"
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pharmacological Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="Analgesics & Antipyretics">Analgesics & Antipyretics</option>
                  <option value="Antibiotics">Antibiotics</option>
                  <option value="Gastrointestinal & Antacids">Gastrointestinal & Antacids</option>
                  <option value="Anti-Allergic & Antihistamines">Anti-Allergic & Antihistamines</option>
                  <option value="Cardiovascular & Hypertensives">Cardiovascular & Hypertensives</option>
                  <option value="Pediatric Care">Pediatric Care</option>
                  <option value="Vitamins & Nutritional Supplements">Vitamins & Nutritional Supplements</option>
                  <option value="Respiratory & Asthma">Respiratory & Asthma</option>
                  <option value="Dermatologicals & Topicals">Dermatologicals & Topicals</option>
                  <option value="Ophthalmics & Otics">Ophthalmics & Otics</option>
                  <option value="General Medicine">General Medicine</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Manufacturer</label>
                <input
                  type="text"
                  value={manufacturer}
                  onChange={e => setManufacturer(e.target.value)}
                  placeholder="e.g. GlaxoSmithKline, Getz Pharma, Abbott"
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Dosage Form / Type</label>
                <select
                  value={medicineType}
                  onChange={e => setMedicineType(e.target.value as MedicineType)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="Tablet">Tablet</option>
                  <option value="Capsule">Capsule</option>
                  <option value="Syrup">Syrup</option>
                  <option value="Suspension">Suspension</option>
                  <option value="Injection">Injection</option>
                  <option value="Cream">Cream</option>
                  <option value="Ointment">Ointment</option>
                  <option value="Drops">Drops</option>
                  <option value="Inhaler">Inhaler</option>
                  <option value="Sachet">Sachet</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Strength (e.g. 500mg, 20ml)</label>
                <input
                  type="text"
                  value={strength}
                  onChange={e => setStrength(e.target.value)}
                  placeholder="500mg / 10mg / 120mg/5ml"
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Packing Presentation</label>
                <input
                  type="text"
                  value={packingSize}
                  onChange={e => setPackingSize(e.target.value)}
                  placeholder="Box of 200 (20 strips x 10)"
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* FIXED INVENTORY PRICING SECTION (Shown in BOTH Add & Edit modes) */}
          <div className="p-3.5 sm:p-4 bg-emerald-50/50 border-2 border-[#0F766E]/30 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 pb-2">
              <h4 className="font-bold text-teal-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>2. Fixed Inventory Price (Locked for POS Sales)</span>
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0F766E] text-white tabular-nums">
                Margin: {profitMarginPct}% ({formatPKR(unitProfit)}/unit)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-teal-900 block mb-1">
                  Fixed Selling Price (PKR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={salePrice}
                  onChange={e => setSalePrice(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-white border-2 border-teal-600 rounded-xl text-sm font-mono font-black text-teal-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-[10px] text-teal-700 font-medium block mt-1">
                  Auto-applied when selected for sale
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Purchase Cost Price (PKR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={purchasePrice}
                  onChange={e => setPurchasePrice(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  Used for COGS profit calculation
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Wholesale Rate (PKR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={wholesalePrice}
                  onChange={e => setWholesalePrice(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-700"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  Optional bulk supply rate
                </span>
              </div>
            </div>
          </div>

          {/* Barcode & Storage */}
          <div>
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
              3. Barcode, Storage & Inventory Alerts
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Barcode (EAN-13 / Code128)</label>
                <div className="relative">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    placeholder="8964000..."
                    className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Min Stock Alert Level</label>
                <input
                  type="number"
                  min="1"
                  value={minStockLevel}
                  onChange={e => setMinStockLevel(parseInt(e.target.value) || 20)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Physical Rack / Location</label>
                <input
                  type="text"
                  value={storageLocation}
                  onChange={e => setStorageLocation(e.target.value)}
                  placeholder="Rack A-1 / Cold Storage"
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="checkbox"
                id="prescriptionRx"
                checked={requiresPrescription}
                onChange={e => setRequiresPrescription(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600"
              />
              <label htmlFor="prescriptionRx" className="font-semibold text-slate-700 cursor-pointer">
                Requires Doctor&apos;s Prescription (Schedule-G Antibiotic / Controlled Drug)
              </label>
            </div>
          </div>

          {/* Initial Stock Batch (Only when adding new medicine) */}
          {!isEditing && (
            <div>
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <span>4. Opening Stock & Batch Expiry</span>
                <span className="text-[10px] text-teal-600 font-normal">(FEFO Tracked)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Batch Number *</label>
                  <input
                    type="text"
                    required
                    value={batchNumber}
                    onChange={e => setBatchNumber(e.target.value)}
                    placeholder="e.g. BAT-25K9"
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Opening Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={initialQuantity}
                    onChange={e => setInitialQuantity(parseInt(e.target.value) || 1)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Supplier</label>
                  <select
                    value={supplierId}
                    onChange={e => setSupplierId(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Mfg Date</label>
                  <input
                    type="date"
                    value={mfgDate}
                    onChange={e => setMfgDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={e => setExpiryDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Pharmacological Usage & Indications</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Indications, contraindications, or dosage instructions..."
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[42px] py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[42px] py-2.5 px-3 bg-[#0F766E] hover:bg-[#0D655E] text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="truncate">{isEditing ? `Save Medicine & Fixed Price (${formatPKR(salePrice)})` : `Register Medicine (${formatPKR(salePrice)})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
