/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Medicine,
  MedicineBatch,
  Supplier,
  Customer,
  Sale,
  SaleItem,
  SaleReturn,
  SaleReturnItem,
  Purchase,
  Expense,
  StockAdjustment,
  AuditLog,
  PharmacyNotification,
  StoreSettings,
  User,
  PaymentMethod,
  BackupSnapshot,
} from '../types/pharmacy';
import {
  DATA_CLEAN_VERSION,
  INITIAL_SETTINGS,
  INITIAL_USERS,
  OWNER_ACCOUNT,
  sanitizeStaffAccounts,
  INITIAL_SUPPLIERS,
  INITIAL_CUSTOMERS,
  INITIAL_MEDICINES,
  INITIAL_EXPENSES,
  INITIAL_SALES,
  INITIAL_PURCHASES,
  INITIAL_ADJUSTMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS,
} from '../data/initialData';
import {
  generateInvoiceNumber,
  generatePurchaseNumber,
  getStoreTodayDateStr,
  isExpired,
  isNearExpiry,
} from '../utils/helpers';
import { useAuth } from './AuthContext';
import {
  cacheMedicinesOffline,
  enqueueOfflineSale,
  getPendingSalesQueue,
  removePendingSale,
} from '../services/offlineDb';
import {
  pushCloudMedicineRealtime,
  broadcastFullRefresh,
} from '../services/cloudSync';
import {
  normalizeMedicine,
  normalizeSale,
  normalizePurchase,
  normalizeAuditLog,
  normalizeNotification,
  normalizeSettings,
  normalizeStaffList,
} from '../utils/normalizers';

interface StoreContextType {
  // Data
  settings: StoreSettings;
  medicines: Medicine[];
  suppliers: Supplier[];
  customers: Customer[];
  sales: Sale[];
  saleReturns: SaleReturn[];
  purchases: Purchase[];
  expenses: Expense[];
  adjustments: StockAdjustment[];
  auditLogs: AuditLog[];
  notifications: PharmacyNotification[];
  staffMembers: User[];

  // Offline & Sync Engine
  isOnline: boolean;
  isHydrating: boolean;
  pendingSyncCount: number;
  syncOfflineQueue: () => Promise<{ synced: number; conflicts: number }>;
  offlineSyncStatus: 'synced' | 'syncing' | 'offline' | 'pending';

  // Backup & Restore
  backupSnapshots: BackupSnapshot[];
  fetchBackupSnapshots: () => Promise<void>;
  createInstantSnapshot: (comment?: string) => Promise<boolean>;
  restoreSnapshot: (filename: string) => Promise<boolean>;

  // Medicine Actions
  addMedicine: (medicine: Omit<Medicine, 'id' | 'totalQuantity'>, initialBatch?: Partial<MedicineBatch>) => Medicine;
  updateMedicine: (id: string, updated: Partial<Medicine>) => void;
  deleteMedicine: (id: string) => void;
  addBatch: (
    medicineId: string,
    batchData: Omit<MedicineBatch, 'id' | 'medicineId'>,
    options?: { syncFixedPrices?: boolean; existingBatchId?: string }
  ) => void;
  updateBatch: (medicineId: string, batchId: string, updated: Partial<MedicineBatch>) => void;
  deleteBatch: (medicineId: string, batchId: string) => void;
  addStockToMedicine: (medicineId: string, batchId: string, additionalQty: number, costPrice?: number, salePrice?: number) => void;
  bulkImportMedicines: (items: any[]) => { imported: number; errors: string[] };

  // Sales & POS Actions
  processSale: (saleInput: {
    customerId?: string;
    customerName: string;
    customerPhone?: string;
    items: {
      medicineId: string;
      batchId: string;
      quantity: number;
      unitPrice: number;
      discountAmount?: number;
    }[];
    discountTotal: number;
    paymentMethod: PaymentMethod;
    amountPaid: number;
    notes?: string;
  }) => { success: boolean; sale?: Sale; error?: string };

  processSaleReturn: (
    saleId: string,
    returnItems: {
      medicineId: string;
      batchId: string;
      quantity: number;
      refundAmount: number;
      reason: string;
    }[],
    notes?: string
  ) => { success: boolean; returnRecord?: SaleReturn; error?: string };

  // Purchases
  addPurchase: (purchaseData: Omit<Purchase, 'id' | 'purchaseNumber'>) => { success: boolean; purchase?: Purchase };
  recordPurchasePayment: (purchaseId: string, amount: number) => void;

  // Suppliers & Customers
  addSupplier: (supplier: Omit<Supplier, 'id' | 'totalPurchases' | 'totalPaid' | 'outstandingBalance' | 'createdAt'>) => void;
  updateSupplier: (id: string, updated: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  recordSupplierPayment: (supplierId: string, amount: number) => void;

  addCustomer: (customer: Omit<Customer, 'id' | 'totalPurchases' | 'outstandingBalance' | 'createdAt'>) => Customer;
  updateCustomer: (id: string, updated: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  recordCustomerPayment: (customerId: string, amount: number) => void;

  // Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'addedBy' | 'addedByName'>) => void;
  updateExpense: (id: string, updated: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // Stock Adjustment
  recordStockAdjustment: (adjustment: {
    medicineId: string;
    batchId: string;
    adjustedQuantity: number; // + or -
    adjustmentType: StockAdjustment['adjustmentType'];
    reason: string;
  }) => { success: boolean; error?: string };

  // Staff Management
  addStaff: (user: Omit<User, 'id' | 'joiningDate'>) => void;
  updateStaff: (id: string, updated: Partial<User>) => void;
  toggleStaffStatus: (id: string) => void;
  deleteStaff: (id: string) => void;
  removeAllOtherStaff: () => void;

  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotification: (id: string) => void;

  // Settings & System
  updateSettings: (newSettings: Partial<StoreSettings>) => void;
  resetToDemoData: () => void;
  refreshData: () => Promise<void>;

  // Multi-select POS Queue (from Inventory or Quick Selection)
  queuedPosItems: { medicineId: string; quantity: number }[];
  queueMedicinesForPos: (items: { medicineId: string; quantity: number }[]) => void;
  clearQueuedPosItems: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Ensure any legacy dummy or stale cache data in localStorage is wiped once for DATA_CLEAN_VERSION
function ensureCleanStorageVersion(): void {
  try {
    const ver = localStorage.getItem('pharmacare_clean_version');
    if (ver !== DATA_CLEAN_VERSION) {
      const keysToClear = [
        'pharmacare_suppliers',
        'pharmacare_customers',
        'pharmacare_sales',
        'pharmacare_returns',
        'pharmacare_purchases',
        'pharmacare_expenses',
        'pharmacare_adjustments',
        'pharmacare_audit_logs',
        'pharmacare_notifications',
        'pharmacare_deleted_ids',
      ];
      keysToClear.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('pharmacare_clean_version', DATA_CLEAN_VERSION);
    }
  } catch {}
}

function isTestOrDummyId(id: unknown): boolean {
  const s = String(id || '');
  if (!s) return true;
  if (s.includes('-e2e-') || s.includes('-test-') || s === 'sal-test-dup' || s.includes('e2estaff')) {
    return true;
  }
  return false;
}

// Storage helper with fallback
function loadFromStorage<T>(key: string, fallback: T): T {
  ensureCleanStorageVersion();
  try {
    const item = localStorage.getItem(`pharmacare_${key}`);
    if (!item) return fallback;
    const parsed = JSON.parse(item);
    if (Array.isArray(parsed)) {
      return parsed.filter((row: any) => row && !isTestOrDummyId(row.id)) as unknown as T;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAdmin, syncStaffList } = useAuth();

  const [settings, setSettings] = useState<StoreSettings>(() =>
    normalizeSettings(loadFromStorage('settings', INITIAL_SETTINGS))
  );
  const [medicines, setMedicines] = useState<Medicine[]>(() =>
    (loadFromStorage<any[]>('medicines', INITIAL_MEDICINES) || [])
      .map(normalizeMedicine)
      .filter((m): m is Medicine => m !== null && !isTestOrDummyId(m.id))
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadFromStorage('suppliers', INITIAL_SUPPLIERS));
  const [customers, setCustomers] = useState<Customer[]>(() => loadFromStorage('customers', INITIAL_CUSTOMERS));
  const [sales, setSales] = useState<Sale[]>(() =>
    (loadFromStorage<any[]>('sales', INITIAL_SALES) || [])
      .map(normalizeSale)
      .filter((s): s is Sale => s !== null && !isTestOrDummyId(s.id))
  );
  const [saleReturns, setSaleReturns] = useState<SaleReturn[]>(() => loadFromStorage('returns', []));
  const [purchases, setPurchases] = useState<Purchase[]>(() =>
    (loadFromStorage<any[]>('purchases', INITIAL_PURCHASES) || [])
      .map(normalizePurchase)
      .filter((p): p is Purchase => p !== null && !isTestOrDummyId(p.id))
  );
  const [expenses, setExpenses] = useState<Expense[]>(() => loadFromStorage('expenses', INITIAL_EXPENSES));
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>(() => loadFromStorage('adjustments', INITIAL_ADJUSTMENTS));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    (loadFromStorage<any[]>('audit_logs', INITIAL_AUDIT_LOGS) || [])
      .map(normalizeAuditLog)
      .filter((l): l is AuditLog => l !== null && !isTestOrDummyId(l.id))
  );
  const [notifications, setNotifications] = useState<PharmacyNotification[]>(() =>
    (loadFromStorage<any[]>('notifications', INITIAL_NOTIFICATIONS) || [])
      .map(normalizeNotification)
      .filter((n): n is PharmacyNotification => n !== null && !isTestOrDummyId(n.id))
  );
  const [staffMembers, setStaffMembers] = useState<User[]>(() =>
    normalizeStaffList(loadFromStorage('staff', INITIAL_USERS))
  );

  const medicinesRef = useRef<Medicine[]>(medicines);
  useEffect(() => {
    medicinesRef.current = medicines;
  }, [medicines]);

  const staffMembersRef = useRef<User[]>(staffMembers);
  useEffect(() => {
    staffMembersRef.current = staffMembers;
  }, [staffMembers]);

  // Connectivity & Sync States
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isHydrating, setIsHydrating] = useState<boolean>(true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [offlineSyncStatus, setOfflineSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'pending'>('synced');
  const [backupSnapshots, setBackupSnapshots] = useState<BackupSnapshot[]>([]);
  const [queuedPosItems, setQueuedPosItems] = useState<{ medicineId: string; quantity: number }[]>([]);

  const queueMedicinesForPos = (items: { medicineId: string; quantity: number }[]) => {
    setQueuedPosItems(prev => {
      const merged = [...prev];
      items.forEach(incoming => {
        const existingIdx = merged.findIndex(m => m.medicineId === incoming.medicineId);
        if (existingIdx >= 0) {
          merged[existingIdx] = {
            ...merged[existingIdx],
            quantity: merged[existingIdx].quantity + incoming.quantity,
          };
        } else {
          merged.push({ ...incoming });
        }
      });
      return merged;
    });
  };

  const clearQueuedPosItems = () => {
    setQueuedPosItems([]);
  };

  const hasHydratedFromServer = useRef(false);
  const hasCheckedUnsyncedLocalMeds = useRef(false);
  const staffForceReplaceRef = useRef(false);
  const localDirtyVersionRef = useRef(0);
  const lastSyncedVersionRef = useRef(0);
  const lastLocalMutationAtRef = useRef(0);

  const markLocalDirty = (): number => {
    localDirtyVersionRef.current += 1;
    lastLocalMutationAtRef.current = Date.now();
    return localDirtyVersionRef.current;
  };

  const ackDedicatedMutation = (versionAtStart: number) => {
    lastSyncedVersionRef.current = Math.max(lastSyncedVersionRef.current, versionAtStart);
  };

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (currentUser?.id) {
      headers['X-User-Id'] = currentUser.id;
      headers['X-User-Role'] = currentUser.role || 'staff';
      return headers;
    }
    try {
      const raw = sessionStorage.getItem('pharmacare_auth_session_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) {
          headers['X-User-Id'] = String(parsed.id);
          headers['X-User-Role'] = String(parsed.role || 'staff');
        }
      }
    } catch {}
    return headers;
  };

  // Connectivity Listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setOfflineSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check pending offline queue count
  const refreshPendingQueueCount = async () => {
    try {
      const queue = await getPendingSalesQueue();
      setPendingSyncCount(queue.length);
      if (queue.length > 0) {
        setOfflineSyncStatus(isOnline ? 'pending' : 'offline');
      } else {
        setOfflineSyncStatus(isOnline ? 'synced' : 'offline');
      }
    } catch {
      setPendingSyncCount(0);
    }
  };

  useEffect(() => {
    refreshPendingQueueCount();
  }, [sales]);

  // Helper to merge arrays by ID when local unsynced mutations are still in flight
  const mergeById = <T extends { id: string }>(
    olderArr: T[] = [],
    newerArr: T[] = [],
    deletedSet: Set<string> = new Set()
  ): T[] => {
    const map = new Map<string, T>();
    olderArr.forEach(item => {
      if (item && item.id && !deletedSet.has(item.id) && !isTestOrDummyId(item.id)) map.set(item.id, item);
    });
    newerArr.forEach(item => {
      if (item && item.id && !deletedSet.has(item.id) && !isTestOrDummyId(item.id)) map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  const isSameJson = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  };

  const deletedRecordIdsRef = useRef<Set<string>>(new Set());

  const recordDeletedId = (id: string) => {
    deletedRecordIdsRef.current.add(id);
    try {
      localStorage.setItem('pharmacare_deleted_ids', JSON.stringify(Array.from(deletedRecordIdsRef.current)));
    } catch {}
  };

  // Pull and sync latest state from same-origin SQL Backend API (/api/state)
  const pullLatestDatabaseState = async (force = false): Promise<boolean> => {
    if (!force && Date.now() - lastLocalMutationAtRef.current < 4500) {
      return false;
    }

    const fetchStartedDirtyVersion = localDirtyVersionRef.current;
    const fetchStartedAt = Date.now();

    const applyIncomingState = (d: any) => {
      if (!d) return;
      const mutatedDuringFetch =
        localDirtyVersionRef.current !== fetchStartedDirtyVersion ||
        Date.now() - lastLocalMutationAtRef.current < 5000;
      const hasUnsyncedLocalEdits =
        localDirtyVersionRef.current > lastSyncedVersionRef.current || mutatedDuringFetch;

      // Trust server's authoritative deletedIds list so old browser cache never hides active server medicines
      if (Array.isArray(d.deletedIds)) {
        const serverDelSet = new Set<string>(d.deletedIds.map(String));
        if (!hasUnsyncedLocalEdits) {
          deletedRecordIdsRef.current = serverDelSet;
        } else {
          serverDelSet.forEach(id => deletedRecordIdsRef.current.add(id));
        }
        try {
          localStorage.setItem('pharmacare_deleted_ids', JSON.stringify(Array.from(deletedRecordIdsRef.current)));
        } catch {}
      }
      const delSet = deletedRecordIdsRef.current;

      if (d.settings) {
        const cleanSettings = normalizeSettings(d.settings);
        setSettings(prev => {
          if (isSameJson(prev, cleanSettings)) return prev;
          try {
            localStorage.setItem('pharmacare_settings', JSON.stringify(cleanSettings));
          } catch {}
          return cleanSettings;
        });
      }

      if (Array.isArray(d.medicines)) {
        const cleanIncomingMeds = d.medicines
          .map(normalizeMedicine)
          .filter((m: Medicine | null): m is Medicine => m !== null && !delSet.has(m.id) && !isTestOrDummyId(m.id));

        // On first boot, if this device (e.g. staff mobile) had a real medicine saved in localStorage
        // while offline or cached that is not on the server yet and not deleted, upload it automatically
        if (!hasCheckedUnsyncedLocalMeds.current) {
          hasCheckedUnsyncedLocalMeds.current = true;
          const serverMedIds = new Set(cleanIncomingMeds.map((m: Medicine) => m.id));
          const localOnlyRealMeds = medicinesRef.current.filter(
            m => m && m.id && !serverMedIds.has(m.id) && !delSet.has(m.id) && !isTestOrDummyId(m.id)
          );
          if (localOnlyRealMeds.length > 0) {
            localOnlyRealMeds.forEach(med => {
              fetch('/api/medicine', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(med),
              }).catch(() => {});
            });
          }
        }

        setMedicines(prev => {
          const next = hasUnsyncedLocalEdits
            ? mergeById(cleanIncomingMeds, prev, delSet)
            : cleanIncomingMeds;
          medicinesRef.current = next;
          try {
            localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
          } catch {}
          if (isSameJson(prev, next)) return prev;
          return next;
        });
      }

      if (Array.isArray(d.suppliers)) {
        const cleanIncoming = d.suppliers.filter((s: any) => s && s.id && !delSet.has(s.id) && !isTestOrDummyId(s.id));
        setSuppliers(prev => {
          const next = hasUnsyncedLocalEdits
            ? mergeById(cleanIncoming, prev, delSet)
            : cleanIncoming;
          try {
            localStorage.setItem('pharmacare_suppliers', JSON.stringify(next));
          } catch {}
          if (isSameJson(prev, next)) return prev;
          return next;
        });
      }

      if (Array.isArray(d.customers)) {
        const cleanIncoming = d.customers.filter((c: any) => c && c.id && !delSet.has(c.id) && !isTestOrDummyId(c.id));
        setCustomers(prev => {
          const next = hasUnsyncedLocalEdits
            ? mergeById(cleanIncoming, prev, delSet)
            : cleanIncoming;
          try {
            localStorage.setItem('pharmacare_customers', JSON.stringify(next));
          } catch {}
          if (isSameJson(prev, next)) return prev;
          return next;
        });
      }

      if (Array.isArray(d.sales)) {
        const cleanSales = d.sales
          .map(normalizeSale)
          .filter((s: Sale | null): s is Sale => s !== null && !delSet.has(s.id) && !isTestOrDummyId(s.id));
        setSales(prev => {
          const next = hasUnsyncedLocalEdits
            ? mergeById(cleanSales, prev, delSet)
            : cleanSales;
          try {
            localStorage.setItem('pharmacare_sales', JSON.stringify(next));
          } catch {}
          if (isSameJson(prev, next)) return prev;
          return next;
        });
      }

      if (Array.isArray(d.saleReturns)) {
        const cleanReturns = d.saleReturns.filter((r: any) => r && r.id && !delSet.has(r.id) && !isTestOrDummyId(r.id));
        setSaleReturns(prev => {
          const next = hasUnsyncedLocalEdits
            ? mergeById(cleanReturns, prev, delSet)
            : cleanReturns;
          try {
            localStorage.setItem('pharmacare_returns', JSON.stringify(next));
          } catch {}
          if (isSameJson(prev, next)) return prev;
          return next;
        });
      }

      if (Array.isArray(d.purchases)) {
        const cleanPurchases = d.purchases
          .map(normalizePurchase)
          .filter((p: Purchase | null): p is Purchase => p !== null && !delSet.has(p.id) && !isTestOrDummyId(p.id));
        setPurchases(prev => {
          const next = hasUnsyncedLocalEdits
            ? mergeById(cleanPurchases, prev, delSet)
            : cleanPurchases;
          try {
            localStorage.setItem('pharmacare_purchases', JSON.stringify(next));
          } catch {}
          if (isSameJson(prev, next)) return prev;
          return next;
        });
      }

      if (Array.isArray(d.expenses)) {
        const cleanExpenses = d.expenses.filter((e: any) => e && e.id && !delSet.has(e.id) && !isTestOrDummyId(e.id));
        setExpenses(prev => {
          const next = hasUnsyncedLocalEdits
            ? mergeById(cleanExpenses, prev, delSet)
            : cleanExpenses;
          try {
            localStorage.setItem('pharmacare_expenses', JSON.stringify(next));
          } catch {}
          if (isSameJson(prev, next)) return prev;
          return next;
        });
      }

      if (Array.isArray(d.adjustments)) {
        const cleanAdjustments = d.adjustments.filter((a: any) => a && a.id && !delSet.has(a.id) && !isTestOrDummyId(a.id));
        setAdjustments(prev => {
          const next = hasUnsyncedLocalEdits
            ? mergeById(cleanAdjustments, prev, delSet)
            : cleanAdjustments;
          try {
            localStorage.setItem('pharmacare_adjustments', JSON.stringify(next));
          } catch {}
          if (isSameJson(prev, next)) return prev;
          return next;
        });
      }

      if (Array.isArray(d.auditLogs)) {
        const cleanLogs = d.auditLogs
          .map(normalizeAuditLog)
          .filter((l: AuditLog | null): l is AuditLog => l !== null && !delSet.has(l.id) && !isTestOrDummyId(l.id));
        setAuditLogs(prev => {
          const next = hasUnsyncedLocalEdits
            ? mergeById(cleanLogs, prev, delSet)
            : cleanLogs;
          try {
            localStorage.setItem('pharmacare_audit_logs', JSON.stringify(next));
          } catch {}
          if (isSameJson(prev, next)) return prev;
          return next;
        });
      }

      if (Array.isArray(d.notifications)) {
        const cleanNotifs = d.notifications
          .map(normalizeNotification)
          .filter((n: PharmacyNotification | null): n is PharmacyNotification => n !== null && !delSet.has(n.id) && !isTestOrDummyId(n.id));
        setNotifications(prev => {
          const next = hasUnsyncedLocalEdits
            ? mergeById(cleanNotifs, prev, delSet)
            : cleanNotifs;
          try {
            localStorage.setItem('pharmacare_notifications', JSON.stringify(next));
          } catch {}
          if (isSameJson(prev, next)) return prev;
          return next;
        });
      }

      if (Array.isArray(d.staffMembers) && d.staffMembers.length > 0) {
        const incomingStaff = normalizeStaffList(
          d.staffMembers.filter((u: any) => u && u.id && !delSet.has(u.id) && !isTestOrDummyId(u.id))
        );
        staffForceReplaceRef.current = !hasUnsyncedLocalEdits;
        setStaffMembers(prevLocal => {
          const nextStaff = normalizeStaffList(
            hasUnsyncedLocalEdits
              ? mergeById<User>(incomingStaff, prevLocal, delSet)
              : incomingStaff
          );
          staffMembersRef.current = nextStaff;
          try {
            localStorage.setItem('pharmacare_staff', JSON.stringify(nextStaff));
          } catch {}
          if (isSameJson(prevLocal, nextStaff)) return prevLocal;
          return nextStaff;
        });
      }
    };

    try {
      const res = await fetch('/api/state', {
        cache: 'no-store',
        headers: {
          ...getAuthHeaders(),
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json?.data) {
          // If a local mutation occurred while this poll was in flight, do NOT overwrite with stale server data
          if (
            localDirtyVersionRef.current !== fetchStartedDirtyVersion ||
            lastLocalMutationAtRef.current >= fetchStartedAt - 1000
          ) {
            return false;
          }
          hasHydratedFromServer.current = true;
          applyIncomingState(json.data);
          return true;
        }
      }
    } catch {}
    return false;
  };

  // Initial Boot + Force Re-sync whenever Owner or Staff logs in / out (critical for Incognito sessions)
  useEffect(() => {
    let active = true;
    setIsHydrating(true);
    pullLatestDatabaseState(true)
      .then(ok => {
        if (!active) return;
        if (ok) {
          hasHydratedFromServer.current = true;
        }
        if (currentUser && isAdmin) {
          fetchBackupSnapshots();
        }
        if (typeof navigator === 'undefined' || navigator.onLine) {
          syncOfflineQueue();
        }
      })
      .finally(() => {
        if (active) setIsHydrating(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pharmacare_medicines' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            const cleanMeds = parsed
              .map(normalizeMedicine)
              .filter((m): m is Medicine => m !== null);
            setMedicines(prev => mergeById(prev, cleanMeds, deletedRecordIdsRef.current));
          }
        } catch {}
      } else if (e.key === 'pharmacare_sales' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            const cleanSales = parsed
              .map(normalizeSale)
              .filter((s): s is Sale => s !== null);
            setSales(prev => mergeById(prev, cleanSales, deletedRecordIdsRef.current));
          }
        } catch {}
      } else if (e.key === 'pharmacare_deleted_ids' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            parsed.forEach((id: string) => recordDeletedId(id));
            setMedicines(prev => prev.filter(m => !deletedRecordIdsRef.current.has(m.id)));
          }
        } catch {}
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        pullLatestDatabaseState();
      }
    };

    // Fast 2.5-second polling interval for cross-device cloud updates
    const interval = setInterval(() => {
      if (navigator.onLine) {
        pullLatestDatabaseState();
      }
    }, 2500);

    // Real-Time WebSocket connection to /ws when running on Node Express; stops cleanly on Apache/PHP hosting
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;
    let wsEverConnected = false;
    let wsAttempts = 0;

    const connectWebSocket = () => {
      if (isUnmounted || typeof window === 'undefined') return;
      if (!wsEverConnected && wsAttempts >= 2) return;
      wsAttempts += 1;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          wsEverConnected = true;
          wsAttempts = 0;
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(String(event.data));
            if ((msg.type === 'DB_UPDATED' || msg.type === 'CONNECTED') && msg.data) {
              const d = msg.data;
              const hasUnsyncedLocalEdits =
                localDirtyVersionRef.current > lastSyncedVersionRef.current ||
                Date.now() - lastLocalMutationAtRef.current < 5000;
              if (Array.isArray(d.deletedIds)) {
                d.deletedIds.forEach((id: string) => recordDeletedId(id));
              }
              const delSet = deletedRecordIdsRef.current;
              if (d.settings) {
                const cleanSettings = normalizeSettings(d.settings);
                setSettings(prev => (isSameJson(prev, cleanSettings) ? prev : cleanSettings));
              }
              if (Array.isArray(d.medicines)) {
                const incomingMeds = d.medicines
                  .filter((m: any) => m && !delSet.has(m.id))
                  .map(normalizeMedicine)
                  .filter((m: Medicine | null): m is Medicine => m !== null);
                setMedicines(prev => {
                  const next = hasUnsyncedLocalEdits
                    ? mergeById(incomingMeds, prev, delSet)
                    : mergeById(prev, incomingMeds, delSet);
                  medicinesRef.current = next;
                  return isSameJson(prev, next) ? prev : next;
                });
              }
              if (Array.isArray(d.suppliers)) {
                const incoming = d.suppliers.filter((s: any) => s && !delSet.has(s.id));
                setSuppliers(prev => {
                  const next = hasUnsyncedLocalEdits
                    ? mergeById(incoming, prev, delSet)
                    : mergeById(prev, incoming, delSet);
                  return isSameJson(prev, next) ? prev : next;
                });
              }
              if (Array.isArray(d.customers)) {
                const incoming = d.customers.filter((c: any) => c && !delSet.has(c.id));
                setCustomers(prev => {
                  const next = hasUnsyncedLocalEdits
                    ? mergeById(incoming, prev, delSet)
                    : mergeById(prev, incoming, delSet);
                  return isSameJson(prev, next) ? prev : next;
                });
              }
              if (Array.isArray(d.sales)) {
                const incoming = d.sales
                  .filter((s: any) => s && !delSet.has(s.id))
                  .map(normalizeSale)
                  .filter((s: Sale | null): s is Sale => s !== null);
                setSales(prev => {
                  const next = hasUnsyncedLocalEdits
                    ? mergeById(incoming, prev, delSet)
                    : mergeById(prev, incoming, delSet);
                  return isSameJson(prev, next) ? prev : next;
                });
              }
              if (Array.isArray(d.saleReturns)) {
                setSaleReturns(prev => {
                  const next = hasUnsyncedLocalEdits
                    ? mergeById(d.saleReturns, prev, delSet)
                    : mergeById(prev, d.saleReturns, delSet);
                  return isSameJson(prev, next) ? prev : next;
                });
              }
              if (Array.isArray(d.purchases)) {
                const incoming = d.purchases
                  .map(normalizePurchase)
                  .filter((p: Purchase | null): p is Purchase => p !== null);
                setPurchases(prev => {
                  const next = hasUnsyncedLocalEdits
                    ? mergeById(incoming, prev, delSet)
                    : mergeById(prev, incoming, delSet);
                  return isSameJson(prev, next) ? prev : next;
                });
              }
              if (Array.isArray(d.expenses)) {
                const incoming = d.expenses.filter((e: any) => e && !delSet.has(e.id));
                setExpenses(prev => {
                  const next = hasUnsyncedLocalEdits
                    ? mergeById(incoming, prev, delSet)
                    : mergeById(prev, incoming, delSet);
                  return isSameJson(prev, next) ? prev : next;
                });
              }
              if (Array.isArray(d.adjustments)) {
                setAdjustments(prev => {
                  const next = hasUnsyncedLocalEdits
                    ? mergeById(d.adjustments, prev, delSet)
                    : mergeById(prev, d.adjustments, delSet);
                  return isSameJson(prev, next) ? prev : next;
                });
              }
              if (Array.isArray(d.auditLogs)) {
                const incoming = d.auditLogs
                  .map(normalizeAuditLog)
                  .filter((l: AuditLog | null): l is AuditLog => l !== null);
                setAuditLogs(prev => {
                  const next = hasUnsyncedLocalEdits
                    ? mergeById(incoming, prev, delSet)
                    : mergeById(prev, incoming, delSet);
                  return isSameJson(prev, next) ? prev : next;
                });
              }
              if (Array.isArray(d.staffMembers) && d.staffMembers.length > 0) {
                const incomingStaff = normalizeStaffList(d.staffMembers.filter((u: any) => u && !delSet.has(u.id)));
                staffForceReplaceRef.current = !hasUnsyncedLocalEdits;
                setStaffMembers(prev => {
                  const nextStaff = normalizeStaffList(
                    hasUnsyncedLocalEdits
                      ? mergeById<User>(incomingStaff, prev, delSet)
                      : mergeById<User>(prev, incomingStaff, delSet)
                  );
                  staffMembersRef.current = nextStaff;
                  if (isSameJson(prev, nextStaff)) return prev;
                  try {
                    localStorage.setItem('pharmacare_staff', JSON.stringify(nextStaff));
                  } catch {}
                  return nextStaff;
                });
              }
            }
          } catch {}
        };

        ws.onclose = () => {
          if (!isUnmounted && (wsEverConnected || wsAttempts < 2)) {
            reconnectTimer = setTimeout(connectWebSocket, 3000);
          }
        };

        ws.onerror = () => {
          try {
            ws?.close();
          } catch {}
        };
      } catch {}
    };

    connectWebSocket();

    // Instant cross-tab & cross-account sync on same device (0ms)
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('pharmacare_erp_realtime_sync');
        bc.onmessage = (event) => {
          if (event.data?.type === 'MEDICINE_SYNC' && event.data?.medicine) {
            const incomingMed = normalizeMedicine(event.data.medicine);
            if (!incomingMed) return;
            deletedRecordIdsRef.current.delete(incomingMed.id);
            setMedicines(prev => {
              const next = [incomingMed, ...prev.filter(m => m.id !== incomingMed.id)];
              try {
                localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
              } catch {}
              return next;
            });
          } else if (event.data?.type === 'MEDICINE_DELETE' && event.data?.id) {
            recordDeletedId(event.data.id);
            setMedicines(prev => {
              const next = prev.filter(m => m.id !== event.data.id);
              try {
                localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
              } catch {}
              return next;
            });
          } else if (event.data?.type === 'FULL_REFRESH') {
            pullLatestDatabaseState();
          }
        };
      }
    } catch {}

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      isUnmounted = true;
      clearInterval(interval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch {}
      try { bc?.close(); } catch {}
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  // Keep AuthContext availableUsers synchronized whenever staffMembers state updates after hydration
  useEffect(() => {
    if (!hasHydratedFromServer.current && staffMembers.length <= 1) {
      return;
    }
    const shouldForceReplace = staffForceReplaceRef.current;
    staffForceReplaceRef.current = false;
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(staffMembers));
    } catch {}
    syncStaffList(staffMembers, shouldForceReplace ? { forceReplace: true } : undefined);
  }, [staffMembers]);

  // Cache medicines in IndexedDB whenever medicines update
  useEffect(() => {
    cacheMedicinesOffline(medicines);
  }, [medicines]);

  // Sync to localStorage
  useEffect(() => { localStorage.setItem('pharmacare_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('pharmacare_medicines', JSON.stringify(medicines)); }, [medicines]);
  useEffect(() => { localStorage.setItem('pharmacare_suppliers', JSON.stringify(suppliers)); }, [suppliers]);
  useEffect(() => { localStorage.setItem('pharmacare_customers', JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem('pharmacare_sales', JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem('pharmacare_returns', JSON.stringify(saleReturns)); }, [saleReturns]);
  useEffect(() => { localStorage.setItem('pharmacare_purchases', JSON.stringify(purchases)); }, [purchases]);
  useEffect(() => { localStorage.setItem('pharmacare_expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('pharmacare_adjustments', JSON.stringify(adjustments)); }, [adjustments]);
  useEffect(() => { localStorage.setItem('pharmacare_audit_logs', JSON.stringify(auditLogs)); }, [auditLogs]);
  useEffect(() => { localStorage.setItem('pharmacare_notifications', JSON.stringify(notifications)); }, [notifications]);

  // Dedicated atomic endpoints (/api/medicine, /api/sale, /api/purchase, /api/staff, etc.)
  // handle all database mutations directly so stale client localStorage never overwrites server state.

  // Helper to append audit log
  const logActivity = (action: string, description: string, details?: Record<string, any>) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action,
      description,
      userId: currentUser?.id || 'system',
      userName: currentUser?.fullName || 'System Automated',
      userRole: currentUser?.role || 'admin',
      timestamp: new Date().toLocaleString('en-PK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      details,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Helper to add notification
  const addNotification = (
    type: PharmacyNotification['type'],
    title: string,
    message: string,
    severity: PharmacyNotification['severity'] = 'info',
    referenceId?: string
  ) => {
    const newNotif: PharmacyNotification = {
      id: `notif-${Date.now()}`,
      type,
      title,
      message,
      date: getStoreTodayDateStr(),
      timestamp: new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }),
      read: false,
      severity,
      referenceId,
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Background Sync Queue Engine
  const syncOfflineQueue = async (): Promise<{ synced: number; conflicts: number }> => {
    setOfflineSyncStatus('syncing');
    let synced = 0;
    let conflicts = 0;

    try {
      const queue = await getPendingSalesQueue();
      if (queue.length === 0) {
        setOfflineSyncStatus('synced');
        setPendingSyncCount(0);
        return { synced: 0, conflicts: 0 };
      }

      for (const item of queue) {
        try {
          const res = await fetch('/api/sale', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(item.saleData),
          });

          if (res.ok) {
            await removePendingSale(item.offlineId);
            synced++;
          } else {
            const errJson = await res.json().catch(() => ({}));
            if (res.status === 409) {
              // Already exists on server, safe to remove from local queue
              await removePendingSale(item.offlineId);
              synced++;
            } else {
              conflicts++;
              console.warn(`Sync conflict on sale ${item.offlineId}:`, errJson.error);
            }
          }
        } catch {
          conflicts++;
        }
      }

      await refreshPendingQueueCount();
      setOfflineSyncStatus(conflicts > 0 ? 'pending' : 'synced');
      return { synced, conflicts };
    } catch {
      setOfflineSyncStatus('offline');
      return { synced, conflicts };
    }
  };

  // Backup & Restore
  const fetchBackupSnapshots = async () => {
    try {
      const res = await fetch('/api/backups');
      const data = await res.json();
      if (data.success && Array.isArray(data.snapshots)) {
        setBackupSnapshots(data.snapshots);
      }
    } catch {}
  };

  const createInstantSnapshot = async (comment = 'Manual User Backup'): Promise<boolean> => {
    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
      const data = await res.json();
      if (data.success) {
        logActivity('BACKUP_CREATED', `Created database snapshot: ${data.filename}`);
        await fetchBackupSnapshots();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const restoreSnapshot = async (filename: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (data.success) {
        // Reload state from server
        const stateRes = await fetch('/api/state');
        const stateData = await stateRes.json();
        if (stateData.success && stateData.data) {
          const d = stateData.data;
          if (d.settings) setSettings(d.settings);
          if (d.medicines) setMedicines(d.medicines);
          if (d.suppliers) setSuppliers(d.suppliers);
          if (d.customers) setCustomers(d.customers);
          if (d.sales) setSales(d.sales);
          if (d.purchases) setPurchases(d.purchases);
          if (d.expenses) setExpenses(d.expenses);
        }
        logActivity('BACKUP_RESTORED', `Restored database from snapshot ${filename}`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Medicine Actions
  const addMedicine = (
    medicineData: Omit<Medicine, 'id' | 'totalQuantity'>,
    initialBatch?: Partial<MedicineBatch>
  ): Medicine => {
    const medId = `med-${Date.now()}`;
    const batches: MedicineBatch[] = [];

    if (initialBatch && initialBatch.batchNumber) {
      batches.push({
        id: `bat-${Date.now()}`,
        medicineId: medId,
        batchNumber: initialBatch.batchNumber,
        purchasePrice: Number(initialBatch.purchasePrice || 0),
        salePrice: Number(initialBatch.salePrice || 0),
        wholesalePrice: Number(initialBatch.wholesalePrice || initialBatch.salePrice || 0),
        quantity: Number(initialBatch.quantity || 0),
        initialQuantity: Number(initialBatch.quantity || 0),
        mfgDate: initialBatch.mfgDate || getStoreTodayDateStr(),
        expiryDate: initialBatch.expiryDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
        supplierId: initialBatch.supplierId,
        supplierName: initialBatch.supplierName,
        receivedDate: getStoreTodayDateStr(),
      });
    }

    const totalQuantity = batches.reduce((sum, b) => sum + b.quantity, 0);
    const resolvedFixedSalePrice =
      medicineData.fixedSalePrice !== undefined
        ? Number(medicineData.fixedSalePrice)
        : initialBatch?.salePrice !== undefined
        ? Number(initialBatch.salePrice)
        : batches[0]?.salePrice || 0;
    const resolvedFixedPurchasePrice =
      medicineData.fixedPurchasePrice !== undefined
        ? Number(medicineData.fixedPurchasePrice)
        : initialBatch?.purchasePrice !== undefined
        ? Number(initialBatch.purchasePrice)
        : batches[0]?.purchasePrice || 0;

    const syncedBatches = batches.map(b => ({
      ...b,
      salePrice: resolvedFixedSalePrice > 0 ? resolvedFixedSalePrice : b.salePrice,
      purchasePrice: resolvedFixedPurchasePrice > 0 ? resolvedFixedPurchasePrice : b.purchasePrice,
    }));

    const newMed: Medicine = {
      ...medicineData,
      id: medId,
      createdBy: currentUser?.id || 'usr-owner-1',
      fixedSalePrice: resolvedFixedSalePrice,
      fixedPurchasePrice: resolvedFixedPurchasePrice,
      batches: syncedBatches,
      totalQuantity,
      status: 'active',
    };

    deletedRecordIdsRef.current.delete(medId);
    try {
      localStorage.setItem('pharmacare_deleted_ids', JSON.stringify(Array.from(deletedRecordIdsRef.current)));
    } catch {}

    const nextMedicines = [newMed, ...medicinesRef.current.filter(m => m.id !== medId)];
    medicinesRef.current = nextMedicines;
    const ver = markLocalDirty();
    setMedicines(nextMedicines);
    try {
      localStorage.setItem('pharmacare_medicines', JSON.stringify(nextMedicines));
    } catch {}

    fetch('/api/medicine', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newMed),
    })
      .then(res => {
        if (res.ok) {
          ackDedicatedMutation(ver);
          pushCloudMedicineRealtime(newMed).catch(() => {});
        }
      })
      .catch(() => {});

    logActivity('MEDICINE_ADDED', `Added new medicine: ${newMed.name} (${newMed.strength}) - Fixed Price Rs. ${resolvedFixedSalePrice}`, { medId });
    addNotification('stock_adjustment', 'New Medicine Registered', `${newMed.name} added to inventory catalog at Fixed Price Rs. ${resolvedFixedSalePrice}.`, 'info', medId);
    return newMed;
  };

  const syncUpdatedMedicineToServer = (med: Medicine, ver: number) => {
    fetch(`/api/medicine/${encodeURIComponent(med.id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(med),
    })
      .then(async res => {
        if (res.ok) {
          ackDedicatedMutation(ver);
          return;
        }
        if (res.status === 404) {
          const postRes = await fetch('/api/medicine', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(med),
          });
          if (postRes.ok) ackDedicatedMutation(ver);
        }
      })
      .catch(() => {});
    pushCloudMedicineRealtime(med).catch(() => {});
  };

  const updateMedicine = (id: string, updated: Partial<Medicine>) => {
    const ver = markLocalDirty();
    let updatedTarget: Medicine | null = null;
    const next = medicinesRef.current.map(med => {
      if (med.id !== id) return med;
      let newBatches = updated.batches || med.batches || [];
      if (updated.fixedSalePrice !== undefined || updated.fixedPurchasePrice !== undefined) {
        newBatches = newBatches.map(b => ({
          ...b,
          salePrice: updated.fixedSalePrice !== undefined ? Number(updated.fixedSalePrice) : b.salePrice,
          purchasePrice: updated.fixedPurchasePrice !== undefined ? Number(updated.fixedPurchasePrice) : b.purchasePrice,
        }));
      }
      const totalQuantity = newBatches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
      updatedTarget = {
        ...med,
        ...updated,
        batches: newBatches,
        totalQuantity,
      };
      return updatedTarget;
    });
    medicinesRef.current = next;
    setMedicines(next);
    try {
      localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
    } catch {}
    if (updatedTarget) {
      syncUpdatedMedicineToServer(updatedTarget, ver);
    }
    logActivity('MEDICINE_EDITED', `Updated medicine specifications & fixed inventory price for ID: ${id}`);
  };

  const deleteMedicine = (id: string) => {
    const ver = markLocalDirty();
    const target = medicinesRef.current.find(m => m.id === id);
    recordDeletedId(id);
    const next = medicinesRef.current.filter(m => m.id !== id);
    medicinesRef.current = next;
    setMedicines(next);
    try {
      localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
    } catch {}

    fetch(`/api/medicine/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});

    pushCloudMedicineRealtime(null, id).catch(() => {});

    logActivity('MEDICINE_DELETED', `Deleted medicine: ${target?.name || id}`);
  };

  const addBatch = (
    medicineId: string,
    batchData: Omit<MedicineBatch, 'id' | 'medicineId'>,
    options?: { syncFixedPrices?: boolean; existingBatchId?: string }
  ) => {
    const ver = markLocalDirty();
    const addedQty = Math.max(0, Number(batchData.quantity || 0));
    const batchId = `bat-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const cleanBatchNumber = (batchData.batchNumber || `BAT-${Date.now()}`).trim();
    const newSalePrice = Number(batchData.salePrice || 0);
    const newPurchasePrice = Number(batchData.purchasePrice || 0);

    const newBatch: MedicineBatch = {
      ...batchData,
      id: batchId,
      medicineId,
      batchNumber: cleanBatchNumber,
      quantity: addedQty,
      initialQuantity: Number(batchData.initialQuantity || addedQty),
      purchasePrice: newPurchasePrice,
      salePrice: newSalePrice,
      receivedDate: batchData.receivedDate || getStoreTodayDateStr(),
    };

    let updatedMed: Medicine | null = null;
    const next = medicinesRef.current.map(med => {
      if (med.id !== medicineId) return med;
      const existingBatches = Array.isArray(med.batches) ? med.batches : [];
      const targetBatchIdx = options?.existingBatchId
        ? existingBatches.findIndex(b => b.id === options.existingBatchId)
        : -1;

      let updatedBatches: MedicineBatch[];
      if (targetBatchIdx >= 0) {
        updatedBatches = existingBatches.map((b, idx) => {
          if (idx !== targetBatchIdx) return b;
          return {
            ...b,
            quantity: Number(b.quantity || 0) + addedQty,
            initialQuantity: Number(b.initialQuantity || b.quantity || 0) + addedQty,
            purchasePrice: newPurchasePrice >= 0 ? newPurchasePrice : b.purchasePrice,
            salePrice: newSalePrice > 0 ? newSalePrice : b.salePrice,
            mfgDate: batchData.mfgDate || b.mfgDate,
            expiryDate: batchData.expiryDate || b.expiryDate,
            receivedDate: batchData.receivedDate || getStoreTodayDateStr(),
          };
        });
      } else {
        updatedBatches = [...existingBatches, newBatch];
      }

      const nextFixedSale =
        options?.syncFixedPrices && newSalePrice > 0 ? newSalePrice : med.fixedSalePrice;
      const nextFixedCost =
        options?.syncFixedPrices && batchData.purchasePrice !== undefined
          ? newPurchasePrice
          : med.fixedPurchasePrice;

      if (options?.syncFixedPrices && newSalePrice > 0) {
        updatedBatches = updatedBatches.map(b => ({
          ...b,
          salePrice: newSalePrice,
          purchasePrice: batchData.purchasePrice !== undefined ? newPurchasePrice : b.purchasePrice,
        }));
      }

      const totalQuantity = updatedBatches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
      updatedMed = {
        ...med,
        fixedSalePrice: nextFixedSale,
        fixedPurchasePrice: nextFixedCost,
        batches: updatedBatches,
        totalQuantity,
        status: 'active',
      };
      return updatedMed;
    });

    medicinesRef.current = next;
    setMedicines(next);
    try {
      localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
    } catch {}

    if (updatedMed) {
      syncUpdatedMedicineToServer(updatedMed, ver);
      const medName = (updatedMed as Medicine).name;
      const medTotal = (updatedMed as Medicine).totalQuantity;
      logActivity(
        'INWARD_STOCK_ADDED',
        `Added +${addedQty} units (${cleanBatchNumber}) to ${medName} — Total Stock: ${medTotal}`,
        { medId: medicineId, addedQty, totalQuantity: medTotal }
      );
      addNotification(
        'stock_adjustment',
        'Inward Stock Added',
        `+${addedQty} units (${cleanBatchNumber}) added to ${medName}. Current stock: ${medTotal}.`,
        'info',
        medicineId
      );
    }
  };

  const updateBatch = (medicineId: string, batchId: string, updated: Partial<MedicineBatch>) => {
    const ver = markLocalDirty();
    let updatedMed: Medicine | null = null;
    const next = medicinesRef.current.map(med => {
      if (med.id !== medicineId) return med;
      const updatedBatches = (med.batches || []).map(b => (b.id === batchId ? { ...b, ...updated } : b));
      const totalQuantity = updatedBatches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
      updatedMed = {
        ...med,
        batches: updatedBatches,
        totalQuantity,
      };
      return updatedMed;
    });
    medicinesRef.current = next;
    setMedicines(next);
    try {
      localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
    } catch {}
    if (updatedMed) {
      syncUpdatedMedicineToServer(updatedMed, ver);
    }
    logActivity('BATCH_UPDATED', `Updated batch ID ${batchId} on medicine ID ${medicineId}`);
  };

  const deleteBatch = (medicineId: string, batchId: string) => {
    const ver = markLocalDirty();
    let updatedMed: Medicine | null = null;
    const next = medicinesRef.current.map(med => {
      if (med.id !== medicineId) return med;
      const updatedBatches = (med.batches || []).filter(b => b.id !== batchId);
      const totalQuantity = updatedBatches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
      updatedMed = {
        ...med,
        batches: updatedBatches,
        totalQuantity,
      };
      return updatedMed;
    });
    medicinesRef.current = next;
    setMedicines(next);
    try {
      localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
    } catch {}
    if (updatedMed) {
      syncUpdatedMedicineToServer(updatedMed, ver);
    }
    logActivity('BATCH_DELETED', `Deleted batch ID ${batchId} on medicine ID ${medicineId}`);
  };

  const addStockToMedicine = (
    medicineId: string,
    batchId: string,
    additionalQty: number,
    costPrice?: number,
    salePrice?: number
  ) => {
    const ver = markLocalDirty();
    let updatedMed: Medicine | null = null;
    const next = medicinesRef.current.map(med => {
      if (med.id !== medicineId) return med;
      const updatedBatches = (med.batches || []).map(b => {
        if (b.id !== batchId) return b;
        return {
          ...b,
          quantity: Number(b.quantity || 0) + additionalQty,
          purchasePrice: costPrice !== undefined ? costPrice : b.purchasePrice,
          salePrice: salePrice !== undefined ? salePrice : b.salePrice,
        };
      });
      const totalQuantity = updatedBatches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
      updatedMed = {
        ...med,
        batches: updatedBatches,
        totalQuantity,
      };
      return updatedMed;
    });
    medicinesRef.current = next;
    setMedicines(next);
    try {
      localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
    } catch {}
    if (updatedMed) {
      syncUpdatedMedicineToServer(updatedMed, ver);
    }
    logActivity('STOCK_ADDED', `Added +${additionalQty} units to medicine ID ${medicineId} (Batch ID: ${batchId})`);
  };

  const bulkImportMedicines = (items: any[]): { imported: number; errors: string[] } => {
    let imported = 0;
    const errors: string[] = [];

    items.forEach((item, index) => {
      try {
        if (!item.name) {
          errors.push(`Row ${index + 1}: Name is required`);
          return;
        }

        const medId = `med-${Date.now()}-${index}`;
        const batchNum = item.batchNumber || `BAT-${Math.floor(1000 + Math.random() * 9000)}`;
        const pPrice = Number(item.purchasePrice || 10);
        const sPrice = Number(item.salePrice || 15);
        const qty = Number(item.quantity || 50);

        const newBatch: MedicineBatch = {
          id: `bat-${Date.now()}-${index}`,
          medicineId: medId,
          batchNumber: batchNum,
          purchasePrice: pPrice,
          salePrice: sPrice,
          wholesalePrice: Number(item.wholesalePrice || sPrice * 0.9),
          quantity: qty,
          initialQuantity: qty,
          mfgDate: item.mfgDate || '2025-01-01',
          expiryDate: item.expiryDate || '2027-12-31',
          supplierName: item.manufacturer || 'Bulk Import',
          receivedDate: getStoreTodayDateStr(),
        };

        const newMed: Medicine = {
          id: medId,
          code: item.code || `MED-${Math.floor(100 + Math.random() * 900)}`,
          name: item.name,
          genericName: item.genericName || item.name,
          brandName: item.brandName || item.name.split(' ')[0],
          category: item.category || 'General Medicine',
          manufacturer: item.manufacturer || 'Local Pharma',
          medicineType: item.medicineType || 'Tablet',
          strength: item.strength || 'Standard',
          packingSize: item.packingSize || 'Pack',
          barcode: item.barcode || `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
          minStockLevel: Number(item.minStockLevel || 20),
          storageLocation: item.storageLocation || 'General Rack',
          description: item.description || '',
          batches: [newBatch],
          totalQuantity: qty,
          status: 'active',
        };

        const ver = markLocalDirty();
        const nextMeds = [newMed, ...medicinesRef.current];
        medicinesRef.current = nextMeds;
        setMedicines(nextMeds);
        try {
          localStorage.setItem('pharmacare_medicines', JSON.stringify(nextMeds));
        } catch {}
        fetch('/api/medicine', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(newMed),
        })
          .then(res => {
            if (res.ok) ackDedicatedMutation(ver);
          })
          .catch(() => {});
        imported++;
      } catch (err: any) {
        errors.push(`Row ${index + 1}: ${err.message || 'Unknown error'}`);
      }
    });

    if (imported > 0) {
      markLocalDirty();
      broadcastFullRefresh();
    }
    logActivity('BULK_IMPORT', `Bulk imported ${imported} medicines`);
    return { imported, errors };
  };

  // Sales / POS Transaction Processing with Atomic FEFO stock deductions & validation
  const processSale = (saleInput: {
    customerId?: string;
    customerName: string;
    customerPhone?: string;
    items: {
      medicineId: string;
      batchId: string;
      quantity: number;
      unitPrice: number;
      discountAmount?: number;
    }[];
    discountTotal: number;
    paymentMethod: PaymentMethod;
    amountPaid: number;
    notes?: string;
  }): { success: boolean; sale?: Sale; error?: string } => {
    if (!saleInput.items || saleInput.items.length === 0) {
      return { success: false, error: 'Cart is empty. Add at least one medicine.' };
    }

    const currentMeds = medicinesRef.current.length > 0 ? medicinesRef.current : medicines;

    // Step 1: Strict validation of stock availability and expiry
    for (const item of saleInput.items) {
      const med = currentMeds.find(m => m.id === item.medicineId);
      if (!med) {
        return { success: false, error: `Medicine not found for ID: ${item.medicineId}` };
      }

      const batch = med.batches.find(b => b.id === item.batchId);
      if (!batch) {
        return { success: false, error: `Batch not found for ${med.name}` };
      }

      // STRICT SAFETY REQUIREMENT: NEVER allow expired medicines to be sold!
      if (isExpired(batch.expiryDate)) {
        return {
          success: false,
          error: `CRITICAL SAFETY VIOLATION: Batch ${batch.batchNumber} of ${med.name} is EXPIRED (${batch.expiryDate}). Expired medicines cannot be dispensed!`,
        };
      }

      if (batch.quantity < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock in batch ${batch.batchNumber} of ${med.name}. Available: ${batch.quantity}, Requested: ${item.quantity}`,
        };
      }
    }

    // Step 2: Build enriched SaleItems with actual batch purchase cost for real COGS calculation
    const processedSaleItems: SaleItem[] = [];
    let calculatedSubtotal = 0;

    for (const item of saleInput.items) {
      const med = currentMeds.find(m => m.id === item.medicineId)!;
      const batch = med.batches.find(b => b.id === item.batchId)!;

      const lineDiscount = item.discountAmount || 0;
      const lineTotal = item.unitPrice * item.quantity - lineDiscount;
      calculatedSubtotal += item.unitPrice * item.quantity;

      processedSaleItems.push({
        medicineId: med.id,
        medicineName: med.name,
        genericName: med.genericName,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        purchaseCost: batch.purchasePrice,
        discountAmount: lineDiscount,
        totalAmount: lineTotal,
        expiryDate: batch.expiryDate,
      });
    }

    const discountTotal = saleInput.discountTotal || 0;
    const subtotalAfterDiscounts = Math.max(0, calculatedSubtotal - discountTotal);
    const taxRate = settings.taxRatePercentage || 0;
    const taxTotal = Number(((subtotalAfterDiscounts * taxRate) / 100).toFixed(2));
    const grandTotal = Number((subtotalAfterDiscounts + taxTotal).toFixed(2));
    const amountPaid = saleInput.amountPaid || grandTotal;
    const changeGiven = Math.max(0, amountPaid - grandTotal);

    const now = new Date();
    const dateStr = getStoreTodayDateStr();
    const timeStr = now.toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour12: false });
    const invoiceNumber = generateInvoiceNumber(sales.length);

    const newSale: Sale = {
      id: `sal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      invoiceNumber,
      date: dateStr,
      time: timeStr,
      staffId: currentUser?.id || 'usr-staff-1',
      staffName: currentUser?.fullName || 'Cashier Attendant',
      customerId: saleInput.customerId,
      customerName: saleInput.customerName || 'Walk-in Customer',
      customerPhone: saleInput.customerPhone,
      items: processedSaleItems,
      subtotal: calculatedSubtotal,
      discountTotal,
      taxTotal,
      grandTotal,
      amountPaid,
      changeGiven,
      paymentMethod: saleInput.paymentMethod,
      notes: saleInput.notes,
      status: 'completed',
    };

    // Step 3: Deduct sold quantities from batches atomically
    const nextMedicinesAfterSale = currentMeds.map(med => {
      const itemsForThisMed = saleInput.items.filter(i => i.medicineId === med.id);
      if (itemsForThisMed.length === 0) return med;

      const updatedBatches = med.batches.map(batch => {
        const matchedItem = itemsForThisMed.find(i => i.batchId === batch.id);
        if (!matchedItem) return batch;
        const newQty = Math.max(0, batch.quantity - matchedItem.quantity);
        return {
          ...batch,
          quantity: newQty,
        };
      });

      const newTotalQty = updatedBatches.reduce((acc, b) => acc + b.quantity, 0);

      if (newTotalQty === 0) {
        addNotification('out_of_stock', `Out of Stock: ${med.name}`, `${med.name} stock has reached 0 units.`, 'danger', med.id);
      } else if (newTotalQty <= med.minStockLevel) {
        addNotification('low_stock', `Low Stock Alert: ${med.name}`, `${med.name} quantity (${newTotalQty}) is at or below minimum threshold (${med.minStockLevel}).`, 'warning', med.id);
      }

      return {
        ...med,
        batches: updatedBatches,
        totalQuantity: newTotalQty,
      };
    });
    medicinesRef.current = nextMedicinesAfterSale;
    setMedicines(nextMedicinesAfterSale);
    try {
      localStorage.setItem('pharmacare_medicines', JSON.stringify(nextMedicinesAfterSale));
    } catch {}

    // Step 4: Record customer purchase stats if customer exists
    if (saleInput.customerId) {
      setCustomers(prev =>
        prev.map(c => {
          if (c.id !== saleInput.customerId) return c;
          const isCredit = saleInput.paymentMethod === 'Credit';
          return {
            ...c,
            totalPurchases: c.totalPurchases + grandTotal,
            outstandingBalance: isCredit ? c.outstandingBalance + grandTotal : c.outstandingBalance,
            lastPurchaseDate: dateStr,
          };
        })
      );
    }

    // Step 5: Save Sale record locally
    const ver = markLocalDirty();
    setSales(prev => [newSale, ...prev]);

    // Step 6: Post to server or enqueue in IndexedDB if offline
    if (isOnline) {
      fetch('/api/sale', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newSale),
      })
        .then(res => {
          if (res.ok || res.status === 409) {
            ackDedicatedMutation(ver);
            broadcastFullRefresh();
          } else {
            enqueueOfflineSale(newSale).then(refreshPendingQueueCount);
          }
        })
        .catch(() => {
          // Enqueue if network fail
          enqueueOfflineSale(newSale).then(refreshPendingQueueCount);
        });
    } else {
      enqueueOfflineSale(newSale).then(refreshPendingQueueCount);
    }

    // Step 7: Log activity & notification
    logActivity(
      'SALE_CREATED',
      `Completed sale ${invoiceNumber} for Rs. ${grandTotal} via ${saleInput.paymentMethod} (Operator: ${currentUser?.fullName})`,
      { invoiceNumber, grandTotal }
    );

    addNotification(
      'sale_completed',
      `Sale Completed (${invoiceNumber})`,
      `Invoice ${invoiceNumber} generated for Rs. ${grandTotal} (${saleInput.paymentMethod}).`,
      'success',
      newSale.id
    );

    return { success: true, sale: newSale };
  };

  // Sale Return & Stock Restoration
  const processSaleReturn = (
    saleId: string,
    returnItems: {
      medicineId: string;
      batchId: string;
      quantity: number;
      refundAmount: number;
      reason: string;
    }[],
    notes?: string
  ): { success: boolean; returnRecord?: SaleReturn; error?: string } => {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return { success: false, error: 'Sale record not found' };

    const totalRefund = returnItems.reduce((sum, item) => sum + item.refundAmount, 0);
    const now = new Date();

    const currentMeds = medicinesRef.current.length > 0 ? medicinesRef.current : medicines;

    const returnRecord: SaleReturn = {
      id: `ret-${Date.now()}`,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      returnDate: getStoreTodayDateStr(),
      returnTime: now.toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour12: false }),
      staffId: currentUser?.id || 'admin',
      staffName: currentUser?.fullName || 'Admin Pharmacist',
      items: returnItems.map(item => {
        const med = currentMeds.find(m => m.id === item.medicineId);
        const batch = med?.batches.find(b => b.id === item.batchId);
        return {
          medicineId: item.medicineId,
          batchId: item.batchId,
          medicineName: med?.name || 'Medicine',
          batchNumber: batch?.batchNumber || 'Batch',
          quantity: item.quantity,
          unitPrice: item.refundAmount / item.quantity,
          refundAmount: item.refundAmount,
          reason: item.reason,
        };
      }),
      totalRefund,
      notes,
    };

    // Restore stock to batches
    const nextMedicinesAfterReturn = currentMeds.map(med => {
      const itemsToRestore = returnItems.filter(i => i.medicineId === med.id);
      if (itemsToRestore.length === 0) return med;

      const updatedBatches = med.batches.map(batch => {
        const matched = itemsToRestore.find(i => i.batchId === batch.id);
        if (!matched) return batch;
        return {
          ...batch,
          quantity: batch.quantity + matched.quantity,
        };
      });

      const newTotalQty = updatedBatches.reduce((acc, b) => acc + b.quantity, 0);
      return {
        ...med,
        batches: updatedBatches,
        totalQuantity: newTotalQty,
      };
    });
    medicinesRef.current = nextMedicinesAfterReturn;
    setMedicines(nextMedicinesAfterReturn);
    try {
      localStorage.setItem('pharmacare_medicines', JSON.stringify(nextMedicinesAfterReturn));
    } catch {}

    // Update Sale status
    setSales(prev =>
      prev.map(s => {
        if (s.id !== saleId) return s;
        return {
          ...s,
          status: 'returned',
        };
      })
    );

    const ver = markLocalDirty();
    setSaleReturns(prev => [returnRecord, ...prev]);

    fetch('/api/sale-return', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(returnRecord),
    })
      .then(res => {
        if (res.ok) {
          ackDedicatedMutation(ver);
          broadcastFullRefresh();
        }
      })
      .catch(() => {});

    logActivity(
      'SALE_RETURN',
      `Processed return for invoice ${sale.invoiceNumber}. Restored items and refunded Rs. ${totalRefund}`,
      { invoiceNumber: sale.invoiceNumber, totalRefund }
    );

    addNotification(
      'stock_adjustment',
      `Sale Return Processed (${sale.invoiceNumber})`,
      `Refunded Rs. ${totalRefund} and restored stock to inventory.`,
      'info'
    );

    return { success: true, returnRecord };
  };

  // Purchase Management
  const addPurchase = (purchaseData: Omit<Purchase, 'id' | 'purchaseNumber'>) => {
    const purchaseId = `pur-${Date.now()}`;
    const purchaseNumber = generatePurchaseNumber(purchases.length);

    const newPurchase: Purchase = {
      ...purchaseData,
      id: purchaseId,
      purchaseNumber,
    };

    // Update or add batches to medicines
    const currentMeds = medicinesRef.current.length > 0 ? medicinesRef.current : medicines;
    const nextMedicinesAfterPurchase = currentMeds.map(med => {
      const purchaseItemsForMed = purchaseData.items.filter(
        i => i.medicineId === med.id && !(i as any).skipStockAddition
      );
      if (purchaseItemsForMed.length === 0) return med;

      let updatedBatches = [...(med.batches || [])];
      let nextFixedSale = med.fixedSalePrice;
      let nextFixedCost = med.fixedPurchasePrice;

      for (const pItem of purchaseItemsForMed) {
        const existingBatchIndex = updatedBatches.findIndex(b => b.batchNumber === pItem.batchNumber);
        if (pItem.salePrice && Number(pItem.salePrice) > 0) {
          nextFixedSale = Number(pItem.salePrice);
        }
        if (pItem.purchasePrice !== undefined) {
          nextFixedCost = Number(pItem.purchasePrice);
        }

        if (existingBatchIndex >= 0) {
          const existing = updatedBatches[existingBatchIndex];
          updatedBatches[existingBatchIndex] = {
            ...existing,
            quantity: existing.quantity + pItem.quantity,
            purchasePrice: pItem.purchasePrice,
            salePrice: pItem.salePrice,
            expiryDate: pItem.expiryDate || existing.expiryDate,
            mfgDate: pItem.mfgDate || existing.mfgDate,
          };
        } else {
          updatedBatches.push({
            id: `bat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            medicineId: med.id,
            batchNumber: pItem.batchNumber,
            purchasePrice: pItem.purchasePrice,
            salePrice: pItem.salePrice,
            wholesalePrice: pItem.salePrice * 0.9,
            quantity: pItem.quantity,
            initialQuantity: pItem.quantity,
            mfgDate: pItem.mfgDate,
            expiryDate: pItem.expiryDate,
            supplierId: purchaseData.supplierId,
            supplierName: purchaseData.supplierName,
            receivedDate: purchaseData.purchaseDate,
          });
        }
      }

      const newTotalQty = updatedBatches.reduce((acc, b) => acc + b.quantity, 0);
      return {
        ...med,
        fixedSalePrice: nextFixedSale,
        fixedPurchasePrice: nextFixedCost,
        batches: updatedBatches,
        totalQuantity: newTotalQty,
      };
    });
    medicinesRef.current = nextMedicinesAfterPurchase;
    setMedicines(nextMedicinesAfterPurchase);
    try {
      localStorage.setItem('pharmacare_medicines', JSON.stringify(nextMedicinesAfterPurchase));
    } catch {}

    // Update Supplier ledger
    setSuppliers(prev =>
      prev.map(sup => {
        if (sup.id !== purchaseData.supplierId) return sup;
        const totalPurchases = sup.totalPurchases + purchaseData.totalAmount;
        const totalPaid = sup.totalPaid + purchaseData.paidAmount;
        const outstandingBalance = totalPurchases - totalPaid;
        return {
          ...sup,
          totalPurchases,
          totalPaid,
          outstandingBalance,
        };
      })
    );

    const ver = markLocalDirty();
    setPurchases(prev => [newPurchase, ...prev]);

    // Send to server
    if (isOnline) {
      fetch('/api/purchase', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newPurchase),
      })
        .then(res => {
          if (res.ok) {
            ackDedicatedMutation(ver);
            broadcastFullRefresh();
          }
        })
        .catch(() => {});
    }

    logActivity(
      'PURCHASE_CREATED',
      `Recorded purchase order ${purchaseNumber} from ${purchaseData.supplierName} for Rs. ${purchaseData.totalAmount}`,
      { purchaseNumber, totalAmount: purchaseData.totalAmount }
    );

    addNotification(
      'purchase_recorded',
      `New Stock Purchase Recorded`,
      `Order ${purchaseNumber} (Rs. ${purchaseData.totalAmount}) received from ${purchaseData.supplierName}. Inventory increased.`,
      'success',
      newPurchase.id
    );

    return { success: true, purchase: newPurchase };
  };

  const recordPurchasePayment = (purchaseId: string, amount: number) => {
    const ver = markLocalDirty();
    const targetPurchase = purchases.find(p => p.id === purchaseId);
    const targetSupplierId = targetPurchase?.supplierId || '';

    setPurchases(prev =>
      prev.map(p => {
        if (p.id !== purchaseId) return p;
        const newPaid = p.paidAmount + amount;
        const newBalance = Math.max(0, p.totalAmount - newPaid);
        const newStatus = newBalance === 0 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Pending';

        return {
          ...p,
          paidAmount: newPaid,
          balanceAmount: newBalance,
          paymentStatus: newStatus,
        };
      })
    );

    if (targetSupplierId) {
      setSuppliers(sups =>
        sups.map(s => {
          if (s.id !== targetSupplierId) return s;
          const updatedPaid = s.totalPaid + amount;
          const updatedOutstanding = Math.max(0, s.totalPurchases - updatedPaid);
          return {
            ...s,
            totalPaid: updatedPaid,
            outstandingBalance: updatedOutstanding,
          };
        })
      );
    }

    fetch(`/api/purchase/${encodeURIComponent(purchaseId)}/payment`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ amount }),
    })
      .then(res => {
        if (res.ok) {
          ackDedicatedMutation(ver);
          broadcastFullRefresh();
        }
      })
      .catch(() => {});

    logActivity('PAYMENT_RECORDED', `Paid Rs. ${amount} for Purchase ID ${purchaseId}`);
  };

  // Suppliers & Customers
  const addSupplier = (supplier: Omit<Supplier, 'id' | 'totalPurchases' | 'totalPaid' | 'outstandingBalance' | 'createdAt'>) => {
    const ver = markLocalDirty();
    const newSup: Supplier = {
      ...supplier,
      id: `sup-${Date.now()}`,
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: supplier.openingBalance || 0,
      createdAt: getStoreTodayDateStr(),
    };
    setSuppliers(prev => [newSup, ...prev]);
    fetch('/api/supplier', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newSup),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});
    logActivity('SUPPLIER_ADDED', `Registered supplier: ${newSup.companyName}`);
  };

  const updateSupplier = (id: string, updated: Partial<Supplier>) => {
    const ver = markLocalDirty();
    setSuppliers(prev => prev.map(s => (s.id === id ? { ...s, ...updated } : s)));
    fetch(`/api/supplier/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updated),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});
    logActivity('SUPPLIER_UPDATED', `Updated supplier ID ${id}`);
  };

  const deleteSupplier = (id: string) => {
    const ver = markLocalDirty();
    recordDeletedId(id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
    fetch(`/api/supplier/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});
    logActivity('SUPPLIER_DELETED', `Deleted supplier ID ${id}`);
  };

  const recordSupplierPayment = (supplierId: string, amount: number) => {
    const ver = markLocalDirty();
    setSuppliers(prev =>
      prev.map(s => {
        if (s.id !== supplierId) return s;
        const totalPaid = s.totalPaid + amount;
        const outstandingBalance = Math.max(0, s.outstandingBalance - amount);
        return {
          ...s,
          totalPaid,
          outstandingBalance,
        };
      })
    );
    fetch(`/api/supplier/${encodeURIComponent(supplierId)}/payment`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ amount }),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});
    logActivity('SUPPLIER_PAYMENT', `Disbursed supplier payment of Rs. ${amount} to ID: ${supplierId}`);
  };

  const addCustomer = (customer: Omit<Customer, 'id' | 'totalPurchases' | 'outstandingBalance' | 'createdAt'>): Customer => {
    const ver = markLocalDirty();
    const newCust: Customer = {
      ...customer,
      id: `cust-${Date.now()}`,
      totalPurchases: 0,
      outstandingBalance: 0,
      createdAt: getStoreTodayDateStr(),
    };
    setCustomers(prev => [newCust, ...prev]);
    fetch('/api/customer', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newCust),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});
    logActivity('CUSTOMER_ADDED', `Registered customer: ${newCust.name} (${newCust.phone})`);
    return newCust;
  };

  const updateCustomer = (id: string, updated: Partial<Customer>) => {
    const ver = markLocalDirty();
    setCustomers(prev => prev.map(c => (c.id === id ? { ...c, ...updated } : c)));
    fetch(`/api/customer/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updated),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});
    logActivity('CUSTOMER_UPDATED', `Updated customer ID ${id}`);
  };

  const deleteCustomer = (id: string) => {
    const ver = markLocalDirty();
    recordDeletedId(id);
    setCustomers(prev => prev.filter(c => c.id !== id));
    fetch(`/api/customer/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});
    logActivity('CUSTOMER_DELETED', `Deleted customer ID ${id}`);
  };

  const recordCustomerPayment = (customerId: string, amount: number) => {
    const ver = markLocalDirty();
    setCustomers(prev =>
      prev.map(c => {
        if (c.id !== customerId) return c;
        return {
          ...c,
          outstandingBalance: Math.max(0, c.outstandingBalance - amount),
        };
      })
    );
    fetch(`/api/customer/${encodeURIComponent(customerId)}/payment`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ amount }),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});
    logActivity('CUSTOMER_PAYMENT', `Received Rs. ${amount} credit recovery from customer ID ${customerId}`);
  };

  // Expenses
  const addExpense = (expense: Omit<Expense, 'id' | 'addedBy' | 'addedByName'>) => {
    const ver = markLocalDirty();
    const newExp: Expense = {
      ...expense,
      id: `exp-${Date.now()}`,
      addedBy: currentUser?.id || 'admin',
      addedByName: currentUser?.fullName || 'Pharmacist',
    };
    setExpenses(prev => [newExp, ...prev]);
    fetch('/api/expense', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newExp),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});
    logActivity('EXPENSE_ADDED', `Recorded ${newExp.category} expense: Rs. ${newExp.amount} - ${newExp.description}`);
  };

  const updateExpense = (id: string, updated: Partial<Expense>) => {
    const ver = markLocalDirty();
    setExpenses(prev => prev.map(e => (e.id === id ? { ...e, ...updated } : e)));
    fetch(`/api/expense/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updated),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});
    logActivity('EXPENSE_UPDATED', `Updated expense record ID: ${id}`);
  };

  const deleteExpense = (id: string) => {
    const ver = markLocalDirty();
    recordDeletedId(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
    fetch(`/api/expense/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});
    logActivity('EXPENSE_DELETED', `Removed expense record ID: ${id}`);
  };

  // Stock Adjustment
  const recordStockAdjustment = (adjustment: {
    medicineId: string;
    batchId: string;
    adjustedQuantity: number;
    adjustmentType: StockAdjustment['adjustmentType'];
    reason: string;
  }): { success: boolean; error?: string } => {
    const currentMeds = medicinesRef.current.length > 0 ? medicinesRef.current : medicines;
    const med = currentMeds.find(m => m.id === adjustment.medicineId);
    if (!med) return { success: false, error: 'Medicine not found' };

    const batch = med.batches.find(b => b.id === adjustment.batchId);
    if (!batch) return { success: false, error: 'Batch not found' };

    const previousQuantity = batch.quantity;
    const newQuantity = Math.max(0, previousQuantity + adjustment.adjustedQuantity);

    const adjRecord: StockAdjustment = {
      id: `adj-${Date.now()}`,
      medicineId: med.id,
      medicineName: med.name,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      previousQuantity,
      adjustedQuantity: adjustment.adjustedQuantity,
      newQuantity,
      adjustmentType: adjustment.adjustmentType,
      reason: adjustment.reason,
      performedBy: currentUser?.id || 'admin',
      performedByName: currentUser?.fullName || 'Admin Pharmacist',
      timestamp: new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }),
    };

    const ver = markLocalDirty();
    const nextMedicinesAfterAdj = currentMeds.map(m => {
      if (m.id !== med.id) return m;
      const updatedBatches = m.batches.map(b => (b.id === batch.id ? { ...b, quantity: newQuantity } : b));
      const totalQuantity = updatedBatches.reduce((acc, b) => acc + b.quantity, 0);
      return {
        ...m,
        batches: updatedBatches,
        totalQuantity,
      };
    });
    medicinesRef.current = nextMedicinesAfterAdj;
    setMedicines(nextMedicinesAfterAdj);
    try {
      localStorage.setItem('pharmacare_medicines', JSON.stringify(nextMedicinesAfterAdj));
    } catch {}

    setAdjustments(prev => [adjRecord, ...prev]);

    fetch('/api/adjustment', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(adjRecord),
    })
      .then(res => {
        if (res.ok) {
          ackDedicatedMutation(ver);
          broadcastFullRefresh();
        }
      })
      .catch(() => {});

    logActivity(
      'STOCK_ADJUSTED',
      `Adjusted ${med.name} (Batch ${batch.batchNumber}) by ${adjustment.adjustedQuantity > 0 ? '+' : ''}${adjustment.adjustedQuantity} units [${adjustment.adjustmentType}]: ${adjustment.reason}`
    );

    addNotification(
      'stock_adjustment',
      'Stock Adjustment Logged',
      `${med.name} batch ${batch.batchNumber} was adjusted (${adjustment.adjustedQuantity} units).`,
      'warning'
    );

    return { success: true };
  };

  // Staff Management
  const addStaff = (userData: Omit<User, 'id' | 'joiningDate'>) => {
    const ver = markLocalDirty();
    const newUser: User = {
      ...userData,
      id: `usr-staff-${Date.now()}`,
      username: userData.username.trim().toLowerCase().replace(/^@/, ''),
      password: userData.password || 'seller123',
      pin: userData.pin || '5678',
      joiningDate: getStoreTodayDateStr(),
      status: 'active',
    };
    deletedRecordIdsRef.current.delete(newUser.id);
    try {
      localStorage.setItem('pharmacare_deleted_ids', JSON.stringify(Array.from(deletedRecordIdsRef.current)));
    } catch {}
    const nextList = sanitizeStaffAccounts([...staffMembersRef.current, newUser]);
    staffMembersRef.current = nextList;
    setStaffMembers(nextList);
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(nextList));
    } catch {}
    syncStaffList(nextList);

    fetch('/api/staff', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newUser),
    })
      .then(res => {
        if (res.ok) {
          ackDedicatedMutation(ver);
          broadcastFullRefresh();
        }
      })
      .catch(() => {});

    logActivity('STAFF_CREATED', `Dr. Abdul Rehman (Owner) created new account for ${newUser.fullName} (${newUser.designation})`);
    addNotification('staff_activity', 'New Staff Account Created', `${newUser.fullName} (@${newUser.username}) was added as ${newUser.designation}.`, 'info');
  };

  const updateStaff = (id: string, updated: Partial<User>) => {
    const ver = markLocalDirty();
    const nextList = sanitizeStaffAccounts(
      staffMembersRef.current.map(u => (u.id === id ? { ...u, ...updated } : u))
    );
    staffMembersRef.current = nextList;
    setStaffMembers(nextList);
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(nextList));
    } catch {}
    syncStaffList(nextList);

    fetch(`/api/staff/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updated),
    })
      .then(res => {
        if (res.ok) {
          ackDedicatedMutation(ver);
          broadcastFullRefresh();
        }
      })
      .catch(() => {});

    logActivity('STAFF_UPDATED', `Updated staff account details for ID ${id}`);
  };

  const toggleStaffStatus = (id: string) => {
    if (id === OWNER_ACCOUNT.id) return;
    const ver = markLocalDirty();
    let toggledStatus: 'active' | 'inactive' = 'active';
    const nextList = sanitizeStaffAccounts(
      staffMembersRef.current.map(u => {
        if (u.id !== id) return u;
        toggledStatus = u.status === 'active' ? 'inactive' : 'active';
        return { ...u, status: toggledStatus };
      })
    );
    staffMembersRef.current = nextList;
    setStaffMembers(nextList);
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(nextList));
    } catch {}
    syncStaffList(nextList);

    fetch(`/api/staff/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: toggledStatus }),
    })
      .then(res => {
        if (res.ok) {
          ackDedicatedMutation(ver);
          broadcastFullRefresh();
        }
      })
      .catch(() => {});
  };

  const deleteStaff = (id: string) => {
    if (id === OWNER_ACCOUNT.id) return;
    const ver = markLocalDirty();
    const target = staffMembersRef.current.find(u => u.id === id);
    recordDeletedId(id);
    const nextList = sanitizeStaffAccounts(staffMembersRef.current.filter(u => u.id !== id));
    staffMembersRef.current = nextList;
    staffForceReplaceRef.current = true;
    setStaffMembers(nextList);
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(nextList));
    } catch {}
    syncStaffList(nextList, { forceReplace: true });

    fetch(`/api/staff/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
      .then(res => {
        if (res.ok) {
          ackDedicatedMutation(ver);
          broadcastFullRefresh();
        }
      })
      .catch(() => {});

    logActivity('STAFF_DELETED', `Dr. Abdul Rehman (Owner) removed staff account: ${target?.fullName || id}`);
    if (target) {
      addNotification('staff_activity', 'Staff Account Removed', `Account for ${target.fullName} (@${target.username}) was removed.`, 'warning');
    }
  };

  const removeAllOtherStaff = () => {
    const ver = markLocalDirty();
    staffMembersRef.current.forEach(u => {
      if (u && u.id && u.id !== OWNER_ACCOUNT.id) {
        recordDeletedId(u.id);
      }
    });
    const ownerOnly = staffMembersRef.current.filter(u => u.id === OWNER_ACCOUNT.id);
    const nextList = ownerOnly.length > 0 ? ownerOnly : [OWNER_ACCOUNT];
    staffMembersRef.current = nextList;
    staffForceReplaceRef.current = true;
    setStaffMembers(nextList);
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(nextList));
    } catch {}
    syncStaffList(nextList, { forceReplace: true });

    fetch('/api/staff/all-others', {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
      .then(res => {
        if (res.ok) {
          ackDedicatedMutation(ver);
          broadcastFullRefresh();
        }
      })
      .catch(() => {});

    logActivity('STAFF_CLEARED', 'Dr. Abdul Rehman (Owner) removed all other staff accounts.');
    addNotification('staff_activity', 'All Other Staff Accounts Removed', 'Only Dr. Abdul Rehman (Owner) account remains active.', 'warning');
  };

  // Notifications
  const markNotificationRead = (id: string) => {
    setNotifications(prev => {
      const next = prev.map(n => (n.id === id ? { ...n, read: true } : n));
      try {
        localStorage.setItem('pharmacare_notifications', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      try {
        localStorage.setItem('pharmacare_notifications', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => {
      const next = prev.filter(n => n.id !== id);
      try {
        localStorage.setItem('pharmacare_notifications', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Settings
  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    const ver = markLocalDirty();
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    fetch('/api/settings', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(merged),
    })
      .then(res => {
        if (res.ok) ackDedicatedMutation(ver);
      })
      .catch(() => {});
    logActivity('SETTINGS_UPDATED', 'Updated store configuration & parameters');
  };

  const resetToDemoData = () => {
    setSettings(INITIAL_SETTINGS);
    setMedicines(INITIAL_MEDICINES);
    setSuppliers(INITIAL_SUPPLIERS);
    setCustomers(INITIAL_CUSTOMERS);
    setSales(INITIAL_SALES);
    setSaleReturns([]);
    setPurchases(INITIAL_PURCHASES);
    setExpenses(INITIAL_EXPENSES);
    setAdjustments(INITIAL_ADJUSTMENTS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setStaffMembers(INITIAL_USERS);
    syncStaffList(INITIAL_USERS);
    logActivity('SYSTEM_RESET', 'Database was reset to default realistic demo fixtures.');
  };

  return (
    <StoreContext.Provider
      value={{
        settings,
        medicines,
        suppliers,
        customers,
        sales,
        saleReturns,
        purchases,
        expenses,
        adjustments,
        auditLogs,
        notifications,
        staffMembers,

        isOnline,
        isHydrating,
        pendingSyncCount,
        syncOfflineQueue,
        offlineSyncStatus,
        refreshData: async () => {
          await pullLatestDatabaseState(true);
        },

        backupSnapshots,
        fetchBackupSnapshots,
        createInstantSnapshot,
        restoreSnapshot,

        addMedicine,
        updateMedicine,
        deleteMedicine,
        addBatch,
        updateBatch,
        deleteBatch,
        addStockToMedicine,
        bulkImportMedicines,

        processSale,
        processSaleReturn,

        addPurchase,
        recordPurchasePayment,

        addSupplier,
        updateSupplier,
        deleteSupplier,
        recordSupplierPayment,

        addCustomer,
        updateCustomer,
        deleteCustomer,
        recordCustomerPayment,

        addExpense,
        updateExpense,
        deleteExpense,

        recordStockAdjustment,

        addStaff,
        updateStaff,
        toggleStaffStatus,
        deleteStaff,
        removeAllOtherStaff,

        markNotificationRead,
        markAllNotificationsRead,
        clearNotification,

        updateSettings,
        resetToDemoData,

        queuedPosItems,
        queueMedicinesForPos,
        clearQueuedPosItems,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
