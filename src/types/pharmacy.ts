/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'pharmacist' | 'cashier' | 'staff';

export interface StaffPermission {
  canMakeSales: boolean;
  canViewInventory: boolean;
  canAddCustomer: boolean;
  canViewReports: boolean;
  canAdjustStock: boolean;
  canManagePurchases: boolean;
  canModifyPrices?: boolean;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  pin?: string; // 4-digit numeric keypad PIN
  password?: string; // Staff login password set by Owner
  designation: string;
  status: 'active' | 'inactive';
  permissions: StaffPermission;
  joiningDate: string;
  lastLogin?: string;
  avatarUrl?: string;
}

export type MedicineType = 
  | 'Tablet' 
  | 'Capsule' 
  | 'Syrup' 
  | 'Injection' 
  | 'Cream' 
  | 'Drops' 
  | 'Inhaler' 
  | 'Sachet' 
  | 'Ointment' 
  | 'Suspension';

export interface MedicineBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  purchasePrice: number; // PKR
  salePrice: number;     // PKR
  wholesalePrice?: number;
  quantity: number;
  initialQuantity: number;
  mfgDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  supplierId?: string;
  supplierName?: string;
  receivedDate: string;
}

export interface Medicine {
  id: string;
  code: string;
  name: string;
  genericName: string;
  brandName: string;
  category: string;
  manufacturer: string;
  medicineType: MedicineType;
  strength: string; // e.g. 500mg, 10ml
  packingSize: string; // e.g. Box of 10 strips, 60ml bottle
  barcode: string;
  batches: MedicineBatch[];
  totalQuantity: number;
  minStockLevel: number;
  storageLocation: string; // e.g. Rack A-3, Cold Storage 2-8°C
  description?: string;
  status: 'active' | 'inactive';
  requiresPrescription?: boolean;
  fixedSalePrice?: number;
  fixedPurchasePrice?: number;
}

export type StockStatusType = 
  | 'available'    // Green: quantity > minStockLevel and not near expiry
  | 'low'          // Yellow: 0 < quantity <= minStockLevel
  | 'out_of_stock' // Red: quantity === 0
  | 'near_expiry'  // Orange: expires within alert days (e.g. 90 days)
  | 'expired';     // Dark Red: expiryDate < today

export interface SaleItem {
  medicineId: string;
  medicineName: string;
  genericName: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  unitPrice: number;       // Sale price per unit
  purchaseCost: number;    // Batch purchase price for accurate COGS
  discountAmount: number;  // Per line item discount
  totalAmount: number;     // (unitPrice * quantity) - discountAmount
  expiryDate: string;
}

export type PaymentMethod = 'Cash' | 'Card' | 'Bank Transfer' | 'EasyPaisa' | 'JazzCash' | 'Credit';

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  staffId: string;
  staffName: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  changeGiven: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  status: 'completed' | 'returned' | 'partially_returned';
}

export interface SaleReturnItem {
  medicineId: string;
  batchId: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  reason: string;
}

export interface SaleReturn {
  id: string;
  saleId: string;
  invoiceNumber: string;
  returnDate: string;
  returnTime: string;
  staffId: string;
  staffName: string;
  items: SaleReturnItem[];
  totalRefund: number;
  notes?: string;
}

export interface Supplier {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  ntn?: string;
  openingBalance: number;
  totalPurchases: number;
  totalPaid: number;
  outstandingBalance: number;
  createdAt: string;
}

export interface PurchaseItem {
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  purchasePrice: number;
  salePrice: number;
  mfgDate: string;
  expiryDate: string;
  total: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string; // Supplier's invoice #
  purchaseDate: string;
  items: PurchaseItem[];
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Pending';
  paymentMethod: PaymentMethod;
  notes?: string;
  receivedBy: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  outstandingBalance: number;
  lastPurchaseDate?: string;
  createdAt: string;
}

export type ExpenseCategory = 
  | 'Shop Rent' 
  | 'Electricity' 
  | 'Employee Salaries' 
  | 'Internet' 
  | 'Transportation' 
  | 'Maintenance' 
  | 'Licensing & Taxes'
  | 'Other Expenses';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  addedBy: string;
  addedByName: string;
  receiptRef?: string;
}

export type AdjustmentType = 
  | 'increase' 
  | 'decrease' 
  | 'damage' 
  | 'expired' 
  | 'missing' 
  | 'physical_verification';

export interface StockAdjustment {
  id: string;
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  previousQuantity: number;
  adjustedQuantity: number; // positive or negative
  newQuantity: number;
  adjustmentType: AdjustmentType;
  reason: string;
  performedBy: string;
  performedByName: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  action: string;
  description: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  timestamp: string;
  ipAddress?: string;
  details?: Record<string, any>;
}

export type NotificationSeverity = 'info' | 'warning' | 'danger' | 'success';

export interface PharmacyNotification {
  id: string;
  type: 
    | 'low_stock' 
    | 'out_of_stock' 
    | 'near_expiry' 
    | 'expired' 
    | 'sale_completed' 
    | 'purchase_recorded' 
    | 'payment_due' 
    | 'stock_adjustment'
    | 'staff_activity';
  title: string;
  message: string;
  date: string;
  timestamp: string;
  read: boolean;
  severity: NotificationSeverity;
  referenceId?: string;
}

export interface StoreSettings {
  storeName: string;
  storeTagline: string;
  storeLogoUrl: string;
  storeAddress: string;
  city: string;
  phone: string;
  email: string;
  drugLicenseNumber: string;
  taxRegistrationNumber: string; // NTN / STRN
  currency: string; // 'PKR'
  currencySymbol: string; // 'Rs.' or 'PKR'
  timezone: string; // 'Asia/Karachi'
  taxRatePercentage: number; // e.g. 0% or 2% or 5%
  lowStockThresholdDefault: number; // e.g. 20
  expiryAlertDays: number; // default 90 days
  invoiceHeader: string;
  invoiceFooter: string;
  allowStaffDiscounts: boolean;
  maxStaffDiscountPercentage: number;
  businessOpeningHours: string;
  businessClosingHours: string;
}

export interface BackupSnapshot {
  id: string;
  filename: string;
  timestamp: string;
  sizeBytes: number;
  recordsCount: {
    medicines: number;
    sales: number;
    purchases: number;
    customers: number;
    suppliers: number;
  };
}
