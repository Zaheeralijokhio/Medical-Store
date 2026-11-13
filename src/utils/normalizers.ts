import {
  Medicine,
  MedicineBatch,
  Sale,
  SaleItem,
  Purchase,
  PurchaseItem,
  AuditLog,
  PharmacyNotification,
  StoreSettings,
  User,
  UserRole,
} from '../types/pharmacy';
import { INITIAL_SETTINGS, OWNER_ACCOUNT, sanitizeStaffAccounts } from '../data/initialData';

export function normalizeMedicine(raw: any): Medicine | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const rawBatches = Array.isArray(raw.batches) ? raw.batches : [];
  const batches: MedicineBatch[] = rawBatches
    .filter((b: any) => b && typeof b === 'object')
    .map((b: any, idx: number) => ({
      id: String(b.id || `bat-${raw.id}-${idx}`),
      medicineId: String(b.medicineId || raw.id),
      batchNumber: String(b.batchNumber || 'DEFAULT'),
      purchasePrice: Number(b.purchasePrice || 0),
      salePrice: Number(b.salePrice || 0),
      wholesalePrice: Number(b.wholesalePrice || b.salePrice || 0),
      quantity: Number(b.quantity || 0),
      initialQuantity: Number(b.initialQuantity ?? b.quantity ?? 0),
      mfgDate: String(b.mfgDate || ''),
      expiryDate: String(b.expiryDate || '2028-12-31'),
      supplierId: b.supplierId ? String(b.supplierId) : undefined,
      supplierName: b.supplierName ? String(b.supplierName) : undefined,
      receivedDate: String(b.receivedDate || new Date().toISOString().split('T')[0]),
    }));

  const totalQuantity = batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
  const name = String(raw.name || 'Unnamed Medicine');

  return {
    ...raw,
    id: String(raw.id),
    code: String(raw.code || raw.id),
    name,
    genericName: String(raw.genericName || name),
    brandName: String(raw.brandName || name.split(' ')[0] || 'General'),
    category: String(raw.category || 'General'),
    manufacturer: String(raw.manufacturer || 'Standard Pharma'),
    medicineType: raw.medicineType || 'Tablet',
    strength: String(raw.strength || ''),
    packingSize: String(raw.packingSize || 'Pack'),
    barcode: String(raw.barcode || raw.id),
    minStockLevel: Number(raw.minStockLevel ?? 15),
    storageLocation: String(raw.storageLocation || 'General Shelf'),
    requiresPrescription: Boolean(raw.requiresPrescription),
    fixedSalePrice: Number(raw.fixedSalePrice ?? batches[0]?.salePrice ?? 0),
    fixedPurchasePrice: Number(raw.fixedPurchasePrice ?? batches[0]?.purchasePrice ?? 0),
    batches,
    totalQuantity: batches.length > 0 ? totalQuantity : Number(raw.totalQuantity || 0),
    status: raw.status === 'inactive' ? 'inactive' : 'active',
  };
}

export function normalizeSale(raw: any): Sale | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: SaleItem[] = rawItems
    .filter((i: any) => i && typeof i === 'object')
    .map((i: any) => {
      const qty = Number(i.quantity || 0);
      const unitPrice = Number(i.unitPrice || 0);
      const discountAmount = Number(i.discountAmount || 0);
      const totalAmount = Number(i.totalAmount ?? Math.max(0, qty * unitPrice - discountAmount));
      return {
        medicineId: String(i.medicineId || ''),
        medicineName: String(i.medicineName || 'Medicine'),
        genericName: String(i.genericName || ''),
        batchId: String(i.batchId || ''),
        batchNumber: String(i.batchNumber || 'N/A'),
        quantity: qty,
        unitPrice,
        purchaseCost: Number(i.purchaseCost || 0),
        discountAmount,
        taxAmount: Number(i.taxAmount || 0),
        totalAmount,
      };
    });

  const computedSubtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const subtotal = Number(raw.subtotal ?? computedSubtotal);
  const discountTotal = Number(raw.discountTotal || 0);
  const taxTotal = Number(raw.taxTotal || 0);
  const grandTotal = Number(raw.grandTotal ?? Math.max(0, subtotal - discountTotal + taxTotal));
  const totalCost = Number(raw.totalCost ?? items.reduce((s, i) => s + i.quantity * i.purchaseCost, 0));

  return {
    ...raw,
    id: String(raw.id),
    invoiceNumber: String(raw.invoiceNumber || raw.id),
    date: String(raw.date || new Date().toISOString().split('T')[0]),
    time: String(raw.time || '12:00 PM'),
    customerName: String(raw.customerName || 'Walk-in Customer'),
    staffId: String(raw.staffId || raw.createdBy || OWNER_ACCOUNT.id),
    staffName: String(raw.staffName || 'Store Staff'),
    items,
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
    totalCost,
    netProfit: Number(raw.netProfit ?? grandTotal - totalCost),
    paymentMethod: raw.paymentMethod || 'Cash',
    amountPaid: Number(raw.amountPaid ?? grandTotal),
    changeGiven: Number(raw.changeGiven || 0),
    status: raw.status === 'returned' || raw.status === 'partial_return' ? raw.status : 'completed',
  };
}

export function normalizePurchase(raw: any): Purchase | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: PurchaseItem[] = rawItems
    .filter((i: any) => i && typeof i === 'object')
    .map((i: any) => ({
      medicineId: String(i.medicineId || ''),
      medicineName: String(i.medicineName || 'Medicine'),
      batchNumber: String(i.batchNumber || 'N/A'),
      quantity: Number(i.quantity || 0),
      bonusQuantity: Number(i.bonusQuantity || 0),
      purchasePrice: Number(i.purchasePrice || 0),
      salePrice: Number(i.salePrice || 0),
      wholesalePrice: Number(i.wholesalePrice || i.salePrice || 0),
      mfgDate: String(i.mfgDate || ''),
      expiryDate: String(i.expiryDate || ''),
      totalCost: Number(i.totalCost || Number(i.quantity || 0) * Number(i.purchasePrice || 0)),
    }));

  return {
    ...raw,
    id: String(raw.id),
    purchaseNumber: String(raw.purchaseNumber || raw.purchaseOrderNumber || raw.id),
    supplierId: String(raw.supplierId || ''),
    supplierName: String(raw.supplierName || 'Supplier'),
    invoiceNumber: String(raw.invoiceNumber || raw.supplierInvoiceNumber || 'N/A'),
    purchaseDate: String(raw.purchaseDate || new Date().toISOString().split('T')[0]),
    items,
    totalAmount: Number(raw.totalAmount ?? raw.grandTotal ?? 0),
    paidAmount: Number(raw.paidAmount ?? raw.amountPaid ?? 0),
    balanceAmount: Number(raw.balanceAmount ?? raw.balanceDue ?? 0),
    paymentStatus: raw.paymentStatus || 'Paid',
    paymentMethod: raw.paymentMethod || 'Cash',
    receivedBy: String(raw.receivedBy || 'Store Staff'),
  };
}

export function normalizeAuditLog(raw: any): AuditLog | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const r = String(raw.userRole || 'admin');
  const userRole: UserRole =
    r === 'admin' || r === 'pharmacist' || r === 'cashier' || r === 'staff' ? r : 'admin';
  return {
    id: String(raw.id),
    action: String(raw.action || 'ACTIVITY'),
    description: String(raw.description || raw.details || ''),
    userId: String(raw.userId || 'system'),
    userName: String(raw.userName || 'System'),
    userRole,
    timestamp: String(raw.timestamp || ''),
    details: typeof raw.details === 'object' ? raw.details : undefined,
  };
}

export function normalizeNotification(raw: any): PharmacyNotification | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  return {
    id: String(raw.id),
    type: raw.type || 'stock_adjustment',
    title: String(raw.title || 'Notification'),
    message: String(raw.message || ''),
    date: String(raw.date || ''),
    timestamp: String(raw.timestamp || ''),
    read: Boolean(raw.read),
    severity: raw.severity || 'info',
    referenceId: raw.referenceId ? String(raw.referenceId) : undefined,
  };
}

export function normalizeSettings(raw: any): StoreSettings {
  if (!raw || typeof raw !== 'object') return INITIAL_SETTINGS;
  return {
    ...INITIAL_SETTINGS,
    ...raw,
    storeName: String(raw.storeName || INITIAL_SETTINGS.storeName),
    currencySymbol: String(raw.currencySymbol || INITIAL_SETTINGS.currencySymbol),
    expiryAlertDays: Number(raw.expiryAlertDays ?? INITIAL_SETTINGS.expiryAlertDays),
    lowStockThresholdDefault: Number(raw.lowStockThresholdDefault ?? INITIAL_SETTINGS.lowStockThresholdDefault),
  };
}

export function normalizePermissions(rawPerms: any, role?: string) {
  const isAdm = role === 'admin';
  const isCash = role === 'cashier';
  const base = {
    canMakeSales: true,
    canViewInventory: true,
    canAddCustomer: true,
    canViewReports: isAdm,
    canAdjustStock: isAdm || !isCash,
    canManagePurchases: isAdm || !isCash,
    canModifyPrices: isAdm || !isCash,
  };
  if (!rawPerms || typeof rawPerms !== 'object') {
    return base;
  }
  return {
    canMakeSales: rawPerms.canMakeSales !== undefined ? Boolean(rawPerms.canMakeSales) : base.canMakeSales,
    canViewInventory: rawPerms.canViewInventory !== undefined ? Boolean(rawPerms.canViewInventory) : base.canViewInventory,
    canAddCustomer: rawPerms.canAddCustomer !== undefined ? Boolean(rawPerms.canAddCustomer) : base.canAddCustomer,
    canViewReports: rawPerms.canViewReports !== undefined ? Boolean(rawPerms.canViewReports) : base.canViewReports,
    canAdjustStock: rawPerms.canAdjustStock !== undefined ? Boolean(rawPerms.canAdjustStock) : base.canAdjustStock,
    canManagePurchases: rawPerms.canManagePurchases !== undefined ? Boolean(rawPerms.canManagePurchases) : base.canManagePurchases,
    canModifyPrices: rawPerms.canModifyPrices !== undefined ? Boolean(rawPerms.canModifyPrices) : base.canModifyPrices,
  };
}

export function normalizeStaffList(rawList?: any[]): User[] {
  const safeArr = Array.isArray(rawList)
    ? rawList
        .filter((u: any) => u && typeof u === 'object')
        .map((u: any) => ({
          ...u,
          fullName: String(u.fullName || u.name || u.username || 'Store User'),
          username: String(u.username || u.id || 'user'),
          email: String(u.email || ''),
          designation: String(u.designation || (u.role === 'admin' ? 'Store Owner' : 'Staff Dispenser')),
          permissions: normalizePermissions(u.permissions, u.role),
        }))
    : [];
  return sanitizeStaffAccounts(safeArr);
}
