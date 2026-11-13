/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  User,
  Medicine,
  Supplier,
  Customer,
  Sale,
  Purchase,
  Expense,
  StockAdjustment,
  AuditLog,
  PharmacyNotification,
  StoreSettings,
} from '../types/pharmacy';

export const DATA_CLEAN_VERSION = 'pharmacare_clean_v3';

export const INITIAL_SETTINGS: StoreSettings = {
  storeName: 'PharmaCare Medical & General Store',
  storeTagline: 'Quality Medicines • Licensed Pharmacist on Duty • 24/7 Service',
  storeLogoUrl: '',
  storeAddress: 'Main Commercial Market',
  city: 'Pakistan',
  phone: '',
  email: 'admin@pharmacare.pk',
  drugLicenseNumber: 'DRAP-LIC-0001',
  taxRegistrationNumber: '',
  currency: 'PKR',
  currencySymbol: 'Rs.',
  timezone: 'Asia/Karachi',
  taxRatePercentage: 0,
  lowStockThresholdDefault: 20,
  expiryAlertDays: 90,
  invoiceHeader: 'COMPUTERIZED PHARMACY CASH MEMO',
  invoiceFooter: 'Medicines once sold will not be returned without cash memo within 7 days. Cold chain products & cut strips non-returnable.',
  allowStaffDiscounts: true,
  maxStaffDiscountPercentage: 10,
  businessOpeningHours: '08:00 AM',
  businessClosingHours: '12:00 AM (Midnight)',
};

export const OWNER_ACCOUNT: User = {
  id: 'usr-owner-1',
  username: 'admin',
  fullName: 'Dr. Abdul Rehman (Owner)',
  email: 'admin@pharmacare.pk',
  phone: '',
  role: 'admin',
  pin: '1234',
  password: 'admin',
  designation: 'Store Owner & Administrator',
  status: 'active',
  joiningDate: new Date().toISOString().split('T')[0],
  permissions: {
    canMakeSales: true,
    canViewInventory: true,
    canAddCustomer: true,
    canViewReports: true,
    canAdjustStock: true,
    canManagePurchases: true,
    canModifyPrices: true,
  },
};

export const LEGACY_DEMO_USER_IDS = new Set([
  'usr-admin-1',
  'usr-pharm-1',
  'usr-staff-1',
  'usr-staff-2',
]);

export const LEGACY_DEMO_USERNAMES = new Set<string>([]);

export const LEGACY_DUMMY_IDS = new Set([
  'med-1',
  'med-2',
  'med-3',
  'med-4',
  'med-5',
  'sup-1',
  'sup-2',
  'sup-3',
  'cust-1',
  'cust-2',
  'sal-1001',
  'sal-1002',
  'pur-501',
  'exp-1',
]);

export function sanitizeStaffAccounts(users?: User[]): User[] {
  if (!Array.isArray(users) || users.length === 0) {
    return [OWNER_ACCOUNT];
  }

  // Keep all custom staff created by the Owner; deduplicate by ID and username (keeping latest)
  const byUsername = new Map<string, User>();

  for (const u of users) {
    if (
      u &&
      u.id &&
      u.id !== OWNER_ACCOUNT.id &&
      !LEGACY_DEMO_USER_IDS.has(u.id)
    ) {
      const uname = String(u.username || u.id).trim().toLowerCase().replace(/^@/, '');
      if (uname && uname !== 'admin') {
        byUsername.set(uname, {
          ...u,
          username: uname,
          fullName: String(u.fullName || (u as any).name || uname),
          email: String(u.email || ''),
          designation: String(u.designation || 'Staff Dispenser'),
          status: u.status || 'active',
          pin: u.pin || '5678',
          password: u.password || 'seller123',
        });
      }
    }
  }

  const customStaff: User[] = Array.from(byUsername.values());

  const existingOwner = users.find(u => u && u.id === OWNER_ACCOUNT.id);
  const ownerToUse: User = existingOwner
    ? {
        ...OWNER_ACCOUNT,
        ...existingOwner,
        id: OWNER_ACCOUNT.id,
        username: 'admin',
        password: existingOwner.password === 'password123' ? 'admin' : existingOwner.password || 'admin',
        role: 'admin',
        status: 'active',
        permissions: OWNER_ACCOUNT.permissions,
      }
    : OWNER_ACCOUNT;

  return [ownerToUse, ...customStaff];
}

export const INITIAL_USERS: User[] = [OWNER_ACCOUNT];
export const INITIAL_SUPPLIERS: Supplier[] = [];
export const INITIAL_CUSTOMERS: Customer[] = [];
export const INITIAL_MEDICINES: Medicine[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_SALES: Sale[] = [];
export const INITIAL_PURCHASES: Purchase[] = [];
export const INITIAL_ADJUSTMENTS: StockAdjustment[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
export const INITIAL_NOTIFICATIONS: PharmacyNotification[] = [];
