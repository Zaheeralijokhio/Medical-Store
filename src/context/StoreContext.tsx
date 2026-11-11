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
  fetchCloudStaff,
  pushCloudStaff,
  fetchCloudStoreState,
  pushCloudStoreState,
  pushCloudMedicineRealtime,
} from '../services/cloudSync';

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
  pendingSyncCount: number;
  syncOfflineQueue: () => Promise<{ synced: number; conflicts: number }>;
  offlineSyncStatus: 'synced' | 'syncing' | 'offline' | 'pending';

  // Backup & Restore
  backupSnapshots: BackupSnapshot[];
  fetchBackupSnapshots: () => Promise<void>;
  createInstantSnapshot: (comment?: string) => Promise<boolean>;
  restoreSnapshot: (filename: string) => Promise<boolean>;

  // Medicine Actions
  addMedicine: (medicine: Omit<Medicine, 'id' | 'totalQuantity'>, initialBatch?: Partial<MedicineBatch>) => void;
  updateMedicine: (id: string, updated: Partial<Medicine>) => void;
  deleteMedicine: (id: string) => void;
  addBatch: (medicineId: string, batchData: Omit<MedicineBatch, 'id' | 'medicineId'>) => void;
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

  // Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'addedBy' | 'addedByName'>) => void;
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

  // Multi-select POS Queue (from Inventory or Quick Selection)
  queuedPosItems: { medicineId: string; quantity: number }[];
  queueMedicinesForPos: (items: { medicineId: string; quantity: number }[]) => void;
  clearQueuedPosItems: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Ensure any legacy dummy data in localStorage is wiped once for DATA_CLEAN_VERSION
function ensureCleanStorageVersion(): void {
  try {
    const ver = localStorage.getItem('pharmacare_clean_version');
    if (ver !== DATA_CLEAN_VERSION) {
      const keysToClear = [
        'pharmacare_medicines',
        'pharmacare_suppliers',
        'pharmacare_customers',
        'pharmacare_sales',
        'pharmacare_returns',
        'pharmacare_purchases',
        'pharmacare_expenses',
        'pharmacare_adjustments',
        'pharmacare_audit_logs',
        'pharmacare_notifications',
      ];
      keysToClear.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('pharmacare_clean_version', DATA_CLEAN_VERSION);
    }
  } catch {}
}

// Storage helper with fallback
function loadFromStorage<T>(key: string, fallback: T): T {
  ensureCleanStorageVersion();
  try {
    const item = localStorage.getItem(`pharmacare_${key}`);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, syncStaffList } = useAuth();

  const [settings, setSettings] = useState<StoreSettings>(() => loadFromStorage('settings', INITIAL_SETTINGS));
  const [medicines, setMedicines] = useState<Medicine[]>(() => loadFromStorage('medicines', INITIAL_MEDICINES));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadFromStorage('suppliers', INITIAL_SUPPLIERS));
  const [customers, setCustomers] = useState<Customer[]>(() => loadFromStorage('customers', INITIAL_CUSTOMERS));
  const [sales, setSales] = useState<Sale[]>(() => loadFromStorage('sales', INITIAL_SALES));
  const [saleReturns, setSaleReturns] = useState<SaleReturn[]>(() => loadFromStorage('returns', []));
  const [purchases, setPurchases] = useState<Purchase[]>(() => loadFromStorage('purchases', INITIAL_PURCHASES));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadFromStorage('expenses', INITIAL_EXPENSES));
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>(() => loadFromStorage('adjustments', INITIAL_ADJUSTMENTS));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadFromStorage('audit_logs', INITIAL_AUDIT_LOGS));
  const [notifications, setNotifications] = useState<PharmacyNotification[]>(() => loadFromStorage('notifications', INITIAL_NOTIFICATIONS));
  const [staffMembers, setStaffMembers] = useState<User[]>(() =>
    sanitizeStaffAccounts(loadFromStorage('staff', INITIAL_USERS))
  );

  // Connectivity & Sync States
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
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

  // Helper to merge arrays by ID so neither server nor local unsynced items are ever lost
  const mergeById = <T extends { id: string }>(
    olderArr: T[] = [],
    newerArr: T[] = [],
    deletedSet: Set<string> = new Set()
  ): T[] => {
    const map = new Map<string, T>();
    olderArr.forEach(item => {
      if (item && item.id && !deletedSet.has(item.id)) map.set(item.id, item);
    });
    newerArr.forEach(item => {
      if (item && item.id && !deletedSet.has(item.id)) map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  const deletedRecordIdsRef = useRef<Set<string>>(new Set());

  // Pull and merge latest state from both Backend API (/api/state) and Cross-Device Cloud Sync
  const pullLatestDatabaseState = async () => {
    const applyIncomingState = (d: any) => {
      if (!d) return;
      if (Array.isArray(d.deletedIds)) {
        d.deletedIds.forEach((id: string) => deletedRecordIdsRef.current.add(id));
      }
      const delSet = deletedRecordIdsRef.current;

      if (d.settings) setSettings(d.settings);
      if (Array.isArray(d.medicines)) {
        setMedicines(prev => {
          const merged = mergeById(prev, d.medicines, delSet);
          try {
            localStorage.setItem('pharmacare_medicines', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
      if (Array.isArray(d.suppliers)) {
        setSuppliers(prev => mergeById(prev, d.suppliers, delSet));
      }
      if (Array.isArray(d.customers)) {
        setCustomers(prev => mergeById(prev, d.customers, delSet));
      }
      if (Array.isArray(d.sales)) {
        setSales(prev => mergeById(prev, d.sales, delSet));
      }
      if (Array.isArray(d.saleReturns)) {
        setSaleReturns(prev => mergeById(prev, d.saleReturns, delSet));
      }
      if (Array.isArray(d.purchases)) {
        setPurchases(prev => mergeById(prev, d.purchases, delSet));
      }
      if (Array.isArray(d.expenses)) {
        setExpenses(prev => mergeById(prev, d.expenses, delSet));
      }
      if (Array.isArray(d.adjustments)) {
        setAdjustments(prev => mergeById(prev, d.adjustments, delSet));
      }
      if (Array.isArray(d.auditLogs) && d.auditLogs.length > 0) {
        setAuditLogs(prev => mergeById(prev, d.auditLogs, delSet));
      }
      if (Array.isArray(d.notifications) && d.notifications.length > 0) {
        setNotifications(prev => mergeById(prev, d.notifications, delSet));
      }
      if (Array.isArray(d.staffMembers) && d.staffMembers.length > 0) {
        setStaffMembers(prevLocal => {
          const combined = mergeById<User>(prevLocal, d.staffMembers, delSet);
          return sanitizeStaffAccounts(combined);
        });
      }
    };

    await Promise.allSettled([
      fetch('/api/state', { cache: 'no-store' })
        .then(res => (res.ok ? res.json() : null))
        .then(res => {
          if (res?.success && res?.data) {
            applyIncomingState(res.data);
          }
        }),
      fetchCloudStoreState().then(cloudData => {
        if (cloudData) {
          applyIncomingState(cloudData);
        }
      }),
      fetchCloudStaff().then(cloudStaff => {
        if (cloudStaff && cloudStaff.length > 0) {
          setStaffMembers(prevLocal => {
            const combined = mergeById<User>(prevLocal, cloudStaff, deletedRecordIdsRef.current);
            return sanitizeStaffAccounts(combined);
          });
        }
      }),
    ]);
  };

  // Initial Boot + Re-sync whenever Owner or Staff logs in / out + Real-time polling + Tab Focus / Storage events
  useEffect(() => {
    pullLatestDatabaseState().finally(() => {
      hasHydratedFromServer.current = true;
      fetchBackupSnapshots();
    });
  }, [currentUser?.id]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pharmacare_medicines' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setMedicines(prev => mergeById(prev, parsed, deletedRecordIdsRef.current));
          }
        } catch {}
      } else if (e.key === 'pharmacare_sales' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setSales(prev => mergeById(prev, parsed, deletedRecordIdsRef.current));
          }
        } catch {}
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        pullLatestDatabaseState();
      }
    };

    const interval = setInterval(() => {
      if (navigator.onLine) {
        pullLatestDatabaseState();
      }
    }, 4500);

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  // Keep AuthContext availableUsers synchronized whenever staffMembers state updates
  useEffect(() => {
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(staffMembers));
    } catch {}
    syncStaffList(staffMembers);
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

  // Fast server & Cross-Device Cloud sync of full state
  useEffect(() => {
    if (!hasHydratedFromServer.current) {
      return;
    }

    const timer = setTimeout(() => {
      if (isOnline) {
        const statePayload = {
          cleanVersion: DATA_CLEAN_VERSION,
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
        };
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(statePayload),
        }).catch(() => {});

        pushCloudStoreState({
          settings,
          medicines,
          suppliers,
          customers,
          sales,
          saleReturns,
          purchases,
          expenses,
          adjustments,
          staffMembers,
        }).catch(() => {});
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [
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
  ]);

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
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString('en-PK'),
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
            headers: { 'Content-Type': 'application/json' },
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
  ) => {
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
        mfgDate: initialBatch.mfgDate || new Date().toISOString().split('T')[0],
        expiryDate: initialBatch.expiryDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
        supplierId: initialBatch.supplierId,
        supplierName: initialBatch.supplierName,
        receivedDate: new Date().toISOString().split('T')[0],
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
      fixedSalePrice: resolvedFixedSalePrice,
      fixedPurchasePrice: resolvedFixedPurchasePrice,
      batches: syncedBatches,
      totalQuantity,
      status: 'active',
    };

    setMedicines(prev => {
      const next = [newMed, ...prev];
      try {
        localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
      } catch {}
      return next;
    });
    fetch('/api/medicine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMed),
    }).catch(() => {});
    pushCloudMedicineRealtime(newMed).catch(() => {});
    logActivity('MEDICINE_ADDED', `Added new medicine: ${newMed.name} (${newMed.strength}) - Fixed Price Rs. ${resolvedFixedSalePrice}`, { medId });
    addNotification('stock_adjustment', 'New Medicine Registered', `${newMed.name} added to inventory catalog at Fixed Price Rs. ${resolvedFixedSalePrice}.`, 'info', medId);
  };

  const updateMedicine = (id: string, updated: Partial<Medicine>) => {
    let updatedTarget: Medicine | null = null;
    setMedicines(prev => {
      const next = prev.map(med => {
        if (med.id !== id) return med;
        let newBatches = updated.batches || med.batches;
        if (updated.fixedSalePrice !== undefined || updated.fixedPurchasePrice !== undefined) {
          newBatches = newBatches.map(b => ({
            ...b,
            salePrice: updated.fixedSalePrice !== undefined ? Number(updated.fixedSalePrice) : b.salePrice,
            purchasePrice: updated.fixedPurchasePrice !== undefined ? Number(updated.fixedPurchasePrice) : b.purchasePrice,
          }));
        }
        const totalQuantity = newBatches.reduce((sum, b) => sum + b.quantity, 0);
        updatedTarget = {
          ...med,
          ...updated,
          batches: newBatches,
          totalQuantity,
        };
        return updatedTarget;
      });
      try {
        localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (updatedTarget) {
      fetch(`/api/medicine/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTarget),
      }).catch(() => {});
      pushCloudMedicineRealtime(updatedTarget).catch(() => {});
    }
    logActivity('MEDICINE_EDITED', `Updated medicine specifications & fixed inventory price for ID: ${id}`);
  };

  const deleteMedicine = (id: string) => {
    const target = medicines.find(m => m.id === id);
    if (!target) return;
    deletedRecordIdsRef.current.add(id);
    setMedicines(prev => {
      const next = prev.filter(m => m.id !== id);
      try {
        localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
      } catch {}
      return next;
    });
    fetch(`/api/medicine/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => {});
    pushCloudMedicineRealtime(null, id).catch(() => {});
    logActivity('MEDICINE_DELETED', `Deleted medicine: ${target.name}`);
  };

  const addBatch = (medicineId: string, batchData: Omit<MedicineBatch, 'id' | 'medicineId'>) => {
    const batchId = `bat-${Date.now()}`;
    const newBatch: MedicineBatch = {
      ...batchData,
      id: batchId,
      medicineId,
      quantity: Number(batchData.quantity),
      initialQuantity: Number(batchData.quantity),
      purchasePrice: Number(batchData.purchasePrice),
      salePrice: Number(batchData.salePrice),
    };

    let updatedMed: Medicine | null = null;
    setMedicines(prev => {
      const next = prev.map(med => {
        if (med.id !== medicineId) return med;
        const updatedBatches = [...(med.batches || []), newBatch];
        const totalQuantity = updatedBatches.reduce((sum, b) => sum + b.quantity, 0);
        updatedMed = {
          ...med,
          batches: updatedBatches,
          totalQuantity,
        };
        return updatedMed;
      });
      try {
        localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (updatedMed) {
      fetch(`/api/medicine/${encodeURIComponent(medicineId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMed),
      }).catch(() => {});
      pushCloudMedicineRealtime(updatedMed).catch(() => {});
    }

    logActivity('BATCH_ADDED', `Added batch ${newBatch.batchNumber} to medicine ID ${medicineId} (Qty: ${newBatch.quantity})`);
  };

  const updateBatch = (medicineId: string, batchId: string, updated: Partial<MedicineBatch>) => {
    let updatedMed: Medicine | null = null;
    setMedicines(prev => {
      const next = prev.map(med => {
        if (med.id !== medicineId) return med;
        const updatedBatches = (med.batches || []).map(b => (b.id === batchId ? { ...b, ...updated } : b));
        const totalQuantity = updatedBatches.reduce((sum, b) => sum + b.quantity, 0);
        updatedMed = {
          ...med,
          batches: updatedBatches,
          totalQuantity,
        };
        return updatedMed;
      });
      try {
        localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (updatedMed) {
      fetch(`/api/medicine/${encodeURIComponent(medicineId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMed),
      }).catch(() => {});
      pushCloudMedicineRealtime(updatedMed).catch(() => {});
    }
    logActivity('BATCH_UPDATED', `Updated batch ID ${batchId} on medicine ID ${medicineId}`);
  };

  const deleteBatch = (medicineId: string, batchId: string) => {
    let updatedMed: Medicine | null = null;
    setMedicines(prev => {
      const next = prev.map(med => {
        if (med.id !== medicineId) return med;
        const updatedBatches = (med.batches || []).filter(b => b.id !== batchId);
        const totalQuantity = updatedBatches.reduce((sum, b) => sum + b.quantity, 0);
        updatedMed = {
          ...med,
          batches: updatedBatches,
          totalQuantity,
        };
        return updatedMed;
      });
      try {
        localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (updatedMed) {
      fetch(`/api/medicine/${encodeURIComponent(medicineId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMed),
      }).catch(() => {});
      pushCloudMedicineRealtime(updatedMed).catch(() => {});
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
    let updatedMed: Medicine | null = null;
    setMedicines(prev => {
      const next = prev.map(med => {
        if (med.id !== medicineId) return med;
        const updatedBatches = med.batches.map(b => {
          if (b.id !== batchId) return b;
          return {
            ...b,
            quantity: b.quantity + additionalQty,
            purchasePrice: costPrice !== undefined ? costPrice : b.purchasePrice,
            salePrice: salePrice !== undefined ? salePrice : b.salePrice,
          };
        });
        const totalQuantity = updatedBatches.reduce((sum, b) => sum + b.quantity, 0);
        updatedMed = {
          ...med,
          batches: updatedBatches,
          totalQuantity,
        };
        return updatedMed;
      });
      try {
        localStorage.setItem('pharmacare_medicines', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (updatedMed) {
      fetch(`/api/medicine/${encodeURIComponent(medicineId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMed),
      }).catch(() => {});
      pushCloudMedicineRealtime(updatedMed).catch(() => {});
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
          receivedDate: new Date().toISOString().split('T')[0],
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

        setMedicines(prev => [newMed, ...prev]);
        imported++;
      } catch (err: any) {
        errors.push(`Row ${index + 1}: ${err.message || 'Unknown error'}`);
      }
    });

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

    // Step 1: Strict validation of stock availability and expiry
    for (const item of saleInput.items) {
      const med = medicines.find(m => m.id === item.medicineId);
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
      const med = medicines.find(m => m.id === item.medicineId)!;
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
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-PK', { hour12: false });
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
    setMedicines(prevMedicines =>
      prevMedicines.map(med => {
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
      })
    );

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
    setSales(prev => [newSale, ...prev]);

    // Step 6: Post to server or enqueue in IndexedDB if offline
    if (isOnline) {
      fetch('/api/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSale),
      }).catch(() => {
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

    const returnRecord: SaleReturn = {
      id: `ret-${Date.now()}`,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      returnDate: now.toISOString().split('T')[0],
      returnTime: now.toLocaleTimeString('en-PK', { hour12: false }),
      staffId: currentUser?.id || 'admin',
      staffName: currentUser?.fullName || 'Admin Pharmacist',
      items: returnItems.map(item => {
        const med = medicines.find(m => m.id === item.medicineId);
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
    setMedicines(prevMedicines =>
      prevMedicines.map(med => {
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
      })
    );

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

    setSaleReturns(prev => [returnRecord, ...prev]);

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
    setMedicines(prevMedicines =>
      prevMedicines.map(med => {
        const purchaseItemsForMed = purchaseData.items.filter(i => i.medicineId === med.id);
        if (purchaseItemsForMed.length === 0) return med;

        let updatedBatches = [...(med.batches || [])];

        for (const pItem of purchaseItemsForMed) {
          const existingBatchIndex = updatedBatches.findIndex(b => b.batchNumber === pItem.batchNumber);

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
          batches: updatedBatches,
          totalQuantity: newTotalQty,
        };
      })
    );

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

    setPurchases(prev => [newPurchase, ...prev]);

    // Send to server
    if (isOnline) {
      fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPurchase),
      }).catch(() => {});
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
    setPurchases(prev =>
      prev.map(p => {
        if (p.id !== purchaseId) return p;
        const newPaid = p.paidAmount + amount;
        const newBalance = Math.max(0, p.totalAmount - newPaid);
        const newStatus = newBalance === 0 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Pending';

        setSuppliers(sups =>
          sups.map(s => {
            if (s.id !== p.supplierId) return s;
            const updatedPaid = s.totalPaid + amount;
            const updatedOutstanding = Math.max(0, s.totalPurchases - updatedPaid);
            return {
              ...s,
              totalPaid: updatedPaid,
              outstandingBalance: updatedOutstanding,
            };
          })
        );

        return {
          ...p,
          paidAmount: newPaid,
          balanceAmount: newBalance,
          paymentStatus: newStatus,
        };
      })
    );

    logActivity('PAYMENT_RECORDED', `Paid Rs. ${amount} for Purchase ID ${purchaseId}`);
  };

  // Suppliers & Customers
  const addSupplier = (supplier: Omit<Supplier, 'id' | 'totalPurchases' | 'totalPaid' | 'outstandingBalance' | 'createdAt'>) => {
    const newSup: Supplier = {
      ...supplier,
      id: `sup-${Date.now()}`,
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: supplier.openingBalance || 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setSuppliers(prev => [newSup, ...prev]);
    logActivity('SUPPLIER_ADDED', `Registered supplier: ${newSup.companyName}`);
  };

  const updateSupplier = (id: string, updated: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => (s.id === id ? { ...s, ...updated } : s)));
    logActivity('SUPPLIER_UPDATED', `Updated supplier ID ${id}`);
  };

  const deleteSupplier = (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    logActivity('SUPPLIER_DELETED', `Deleted supplier ID ${id}`);
  };

  const recordSupplierPayment = (supplierId: string, amount: number) => {
    setSuppliers(prev =>
      prev.map(s => {
        if (s.id !== supplierId) return s;
        const totalPaid = s.totalPaid + amount;
        const outstandingBalance = Math.max(0, s.totalPurchases - totalPaid);
        return {
          ...s,
          totalPaid,
          outstandingBalance,
        };
      })
    );
    logActivity('SUPPLIER_PAYMENT', `Disbursed supplier payment of Rs. ${amount} to ID: ${supplierId}`);
  };

  const addCustomer = (customer: Omit<Customer, 'id' | 'totalPurchases' | 'outstandingBalance' | 'createdAt'>): Customer => {
    const newCust: Customer = {
      ...customer,
      id: `cust-${Date.now()}`,
      totalPurchases: 0,
      outstandingBalance: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setCustomers(prev => [newCust, ...prev]);
    logActivity('CUSTOMER_ADDED', `Registered customer: ${newCust.name} (${newCust.phone})`);
    return newCust;
  };

  const updateCustomer = (id: string, updated: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => (c.id === id ? { ...c, ...updated } : c)));
  };

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  // Expenses
  const addExpense = (expense: Omit<Expense, 'id' | 'addedBy' | 'addedByName'>) => {
    const newExp: Expense = {
      ...expense,
      id: `exp-${Date.now()}`,
      addedBy: currentUser?.id || 'admin',
      addedByName: currentUser?.fullName || 'Pharmacist',
    };
    setExpenses(prev => [newExp, ...prev]);
    logActivity('EXPENSE_ADDED', `Recorded ${newExp.category} expense: Rs. ${newExp.amount} - ${newExp.description}`);
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
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
    const med = medicines.find(m => m.id === adjustment.medicineId);
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
      timestamp: new Date().toLocaleString('en-PK'),
    };

    setMedicines(prev =>
      prev.map(m => {
        if (m.id !== med.id) return m;
        const updatedBatches = m.batches.map(b => (b.id === batch.id ? { ...b, quantity: newQuantity } : b));
        const totalQuantity = updatedBatches.reduce((acc, b) => acc + b.quantity, 0);
        return {
          ...m,
          batches: updatedBatches,
          totalQuantity,
        };
      })
    );

    setAdjustments(prev => [adjRecord, ...prev]);

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
    const newUser: User = {
      ...userData,
      id: `usr-staff-${Date.now()}`,
      username: userData.username.trim().toLowerCase(),
      password: userData.password || 'seller123',
      pin: userData.pin || '5678',
      joiningDate: new Date().toISOString().split('T')[0],
      status: 'active',
    };
    const nextList = sanitizeStaffAccounts([...staffMembers, newUser]);
    setStaffMembers(nextList);
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(nextList));
    } catch {}
    syncStaffList(nextList);

    fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    }).catch(() => {});

    pushCloudStaff(nextList).catch(() => {});

    logActivity('STAFF_CREATED', `Dr. Abdul Rehman (Owner) created new account for ${newUser.fullName} (${newUser.designation})`);
    addNotification('staff_activity', 'New Staff Account Created', `${newUser.fullName} (@${newUser.username}) was added as ${newUser.designation}.`, 'info');
  };

  const updateStaff = (id: string, updated: Partial<User>) => {
    const nextList = sanitizeStaffAccounts(
      staffMembers.map(u => (u.id === id ? { ...u, ...updated } : u))
    );
    setStaffMembers(nextList);
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(nextList));
    } catch {}
    syncStaffList(nextList);

    fetch(`/api/staff/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});

    pushCloudStaff(nextList).catch(() => {});

    logActivity('STAFF_UPDATED', `Updated staff account details for ID ${id}`);
  };

  const toggleStaffStatus = (id: string) => {
    if (id === OWNER_ACCOUNT.id) return;
    let toggledStatus: 'active' | 'inactive' = 'active';
    const nextList = sanitizeStaffAccounts(
      staffMembers.map(u => {
        if (u.id !== id) return u;
        toggledStatus = u.status === 'active' ? 'inactive' : 'active';
        return { ...u, status: toggledStatus };
      })
    );
    setStaffMembers(nextList);
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(nextList));
    } catch {}
    syncStaffList(nextList);

    fetch(`/api/staff/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: toggledStatus }),
    }).catch(() => {});

    pushCloudStaff(nextList).catch(() => {});
  };

  const deleteStaff = (id: string) => {
    if (id === OWNER_ACCOUNT.id) return;
    const target = staffMembers.find(u => u.id === id);
    const nextList = sanitizeStaffAccounts(staffMembers.filter(u => u.id !== id));
    setStaffMembers(nextList);
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(nextList));
    } catch {}
    syncStaffList(nextList);

    fetch(`/api/staff/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => {});

    pushCloudStaff(nextList, { forceReplace: true, deletedId: id }).catch(() => {});

    logActivity('STAFF_DELETED', `Dr. Abdul Rehman (Owner) removed staff account: ${target?.fullName || id}`);
    if (target) {
      addNotification('staff_activity', 'Staff Account Removed', `Account for ${target.fullName} (@${target.username}) was removed.`, 'warning');
    }
  };

  const removeAllOtherStaff = () => {
    const ownerOnly = staffMembers.filter(u => u.id === OWNER_ACCOUNT.id);
    const nextList = ownerOnly.length > 0 ? ownerOnly : [OWNER_ACCOUNT];
    setStaffMembers(nextList);
    try {
      localStorage.setItem('pharmacare_staff', JSON.stringify(nextList));
    } catch {}
    syncStaffList(nextList);

    fetch('/api/staff/all-others', {
      method: 'DELETE',
    }).catch(() => {});

    pushCloudStaff(nextList, { forceReplace: true }).catch(() => {});

    logActivity('STAFF_CLEARED', 'Dr. Abdul Rehman (Owner) removed all other staff accounts.');
    addNotification('staff_activity', 'All Other Staff Accounts Removed', 'Only Dr. Abdul Rehman (Owner) account remains active.', 'warning');
  };

  // Notifications
  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Settings
  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
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
        pendingSyncCount,
        syncOfflineQueue,
        offlineSyncStatus,

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

        addExpense,
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
