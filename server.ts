/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type Request, type Response } from 'express';
import http from 'http';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, type Collection } from 'mongodb';
import {
  DATA_CLEAN_VERSION,
  INITIAL_SETTINGS,
  INITIAL_USERS,
  INITIAL_SUPPLIERS,
  INITIAL_CUSTOMERS,
  INITIAL_MEDICINES,
  INITIAL_EXPENSES,
  INITIAL_SALES,
  INITIAL_PURCHASES,
  INITIAL_ADJUSTMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS,
  sanitizeStaffAccounts,
} from './src/data/initialData.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'pharmacy_database.json');
const DEFAULT_STORE_ID = 'store-1';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(String(plain).trim()).digest('hex');
}

export interface DatabaseSchema {
  cleanVersion?: string;
  // 1. Stores
  stores: any[];
  // 2. Users & 3. Staff
  users: typeof INITIAL_USERS;
  staffMembers: typeof INITIAL_USERS;
  // 4. Medicines
  medicines: typeof INITIAL_MEDICINES;
  // 5. Medicine Categories
  categories: any[];
  // 6. Suppliers
  suppliers: typeof INITIAL_SUPPLIERS;
  // 7. Customers
  customers: typeof INITIAL_CUSTOMERS;
  // 8. Purchases & 9. Purchase Items
  purchases: typeof INITIAL_PURCHASES;
  purchaseItems: any[];
  // 10. Sales & 11. Sale Items
  sales: typeof INITIAL_SALES;
  saleItems: any[];
  saleReturns: any[];
  // 12. Stock Transactions
  stockTransactions: any[];
  adjustments: typeof INITIAL_ADJUSTMENTS;
  // 13. Expenses
  expenses: typeof INITIAL_EXPENSES;
  // 14. Payments
  payments: any[];
  // 15. Cash Memos / Invoices
  cashMemos: any[];
  // 16. Activity Logs
  auditLogs: typeof INITIAL_AUDIT_LOGS;
  notifications: typeof INITIAL_NOTIFICATIONS;
  // 17. Store Settings
  settings: typeof INITIAL_SETTINGS;
  // 18. Staff Permissions
  staffPermissions: any[];
  deletedIds?: string[];
  lastUpdated: string;
}

const DEFAULT_CATEGORIES = [
  'Analgesics & Antipyretics',
  'Antibiotics',
  'Gastrointestinal',
  'Antihistamines & Respiratory',
  'Cardiovascular & Hypertension',
  'Antidiabetics',
  'Vitamins & Supplements',
  'Dermatological',
  'Surgical & First Aid',
];

function getInitialDatabase(): DatabaseSchema {
  const now = new Date().toISOString();
  const usersWithHash = INITIAL_USERS.map(u => ({
    ...u,
    storeId: DEFAULT_STORE_ID,
    createdBy: 'usr-owner-1',
    passwordHash: hashPassword(u.password || 'admin'),
  }));
  return {
    cleanVersion: DATA_CLEAN_VERSION,
    stores: [
      {
        id: DEFAULT_STORE_ID,
        name: INITIAL_SETTINGS.storeName,
        ownerId: 'usr-owner-1',
        drugLicenseNumber: INITIAL_SETTINGS.drugLicenseNumber,
        taxRegistrationNumber: INITIAL_SETTINGS.taxRegistrationNumber,
        address: INITIAL_SETTINGS.storeAddress,
        city: INITIAL_SETTINGS.city,
        phone: INITIAL_SETTINGS.phone,
        email: INITIAL_SETTINGS.email,
        createdAt: now,
      },
    ],
    users: usersWithHash,
    staffMembers: usersWithHash,
    medicines: INITIAL_MEDICINES,
    categories: DEFAULT_CATEGORIES.map((name, idx) => ({
      id: `cat-${idx + 1}`,
      storeId: DEFAULT_STORE_ID,
      name,
      createdBy: 'usr-owner-1',
      createdAt: now,
    })),
    suppliers: INITIAL_SUPPLIERS,
    customers: INITIAL_CUSTOMERS,
    purchases: INITIAL_PURCHASES,
    purchaseItems: [],
    sales: INITIAL_SALES,
    saleItems: [],
    saleReturns: [],
    stockTransactions: [],
    adjustments: INITIAL_ADJUSTMENTS,
    expenses: INITIAL_EXPENSES,
    payments: [],
    cashMemos: [],
    auditLogs: INITIAL_AUDIT_LOGS,
    notifications: INITIAL_NOTIFICATIONS,
    settings: INITIAL_SETTINGS,
    staffPermissions: usersWithHash.map(u => ({
      id: `perm-${u.id}`,
      storeId: DEFAULT_STORE_ID,
      userId: u.id,
      username: u.username,
      role: u.role,
      ...u.permissions,
    })),
    deletedIds: [],
    lastUpdated: now,
  };
}

function sanitizeDatabaseState(data: any): DatabaseSchema {
  if (!data || data.cleanVersion !== DATA_CLEAN_VERSION) {
    const clean = getInitialDatabase();
    const staff = sanitizeStaffAccounts(data?.staffMembers).map(u => ({
      ...u,
      storeId: DEFAULT_STORE_ID,
      createdBy: u.createdBy || 'usr-owner-1',
      passwordHash: u.passwordHash || hashPassword(u.password || (u.id === 'usr-owner-1' ? 'admin' : 'seller123')),
    }));
    clean.staffMembers = staff;
    clean.users = staff;
    return clean;
  }

  const now = new Date().toISOString();
  const deletedSet = new Set<string>(Array.isArray(data.deletedIds) ? data.deletedIds : []);

  const rawMedicines = Array.isArray(data.medicines) ? data.medicines : [];
  const cleanMedicines = rawMedicines
    .filter((m: any) => m && m.id && !deletedSet.has(m.id))
    .map((m: any) => {
      const batches = Array.isArray(m.batches) ? m.batches : [];
      const totalQuantity = batches.reduce((sum: number, b: any) => sum + Number(b.quantity || 0), 0);
      return {
        ...m,
        storeId: m.storeId || DEFAULT_STORE_ID,
        createdBy: m.createdBy || 'usr-owner-1',
        batches,
        totalQuantity,
      };
    });

  const cleanStaff = sanitizeStaffAccounts(data.staffMembers)
    .filter((u: any) => !deletedSet.has(u.id))
    .map((u: any) => ({
      ...u,
      storeId: u.storeId || DEFAULT_STORE_ID,
      createdBy: u.createdBy || 'usr-owner-1',
      passwordHash: u.passwordHash || hashPassword(u.password || (u.id === 'usr-owner-1' ? 'admin' : 'seller123')),
    }));

  const cleanSuppliers = (Array.isArray(data.suppliers) ? data.suppliers : [])
    .filter((s: any) => s && s.id && !deletedSet.has(s.id))
    .map((s: any) => ({
      ...s,
      storeId: s.storeId || DEFAULT_STORE_ID,
      createdBy: s.createdBy || 'usr-owner-1',
    }));

  const cleanCustomers = (Array.isArray(data.customers) ? data.customers : [])
    .filter((c: any) => c && c.id && !deletedSet.has(c.id))
    .map((c: any) => ({
      ...c,
      storeId: c.storeId || DEFAULT_STORE_ID,
      createdBy: c.createdBy || 'usr-owner-1',
    }));

  const cleanSales = (Array.isArray(data.sales) ? data.sales : [])
    .filter((s: any) => s && s.id && !deletedSet.has(s.id))
    .map((s: any) => ({
      ...s,
      storeId: s.storeId || DEFAULT_STORE_ID,
      createdBy: s.createdBy || s.staffId || 'usr-owner-1',
    }));

  const cleanPurchases = (Array.isArray(data.purchases) ? data.purchases : [])
    .filter((p: any) => p && p.id && !deletedSet.has(p.id))
    .map((p: any) => ({
      ...p,
      storeId: p.storeId || DEFAULT_STORE_ID,
      createdBy: p.createdBy || 'usr-owner-1',
    }));

  const cleanExpenses = (Array.isArray(data.expenses) ? data.expenses : [])
    .filter((e: any) => e && e.id && !deletedSet.has(e.id))
    .map((e: any) => ({
      ...e,
      storeId: e.storeId || DEFAULT_STORE_ID,
      createdBy: e.createdBy || e.addedBy || 'usr-owner-1',
    }));

  const cleanAdjustments = (Array.isArray(data.adjustments) ? data.adjustments : []).map((a: any) => ({
    ...a,
    storeId: a.storeId || DEFAULT_STORE_ID,
    createdBy: a.createdBy || a.performedBy || 'usr-owner-1',
  }));

  // Derive / synchronize relational child tables
  const categoryNames = new Set<string>(DEFAULT_CATEGORIES);
  cleanMedicines.forEach((m: any) => {
    if (m.category) categoryNames.add(m.category);
  });
  const categories = Array.from(categoryNames).map((name, idx) => ({
    id: `cat-${idx + 1}`,
    storeId: DEFAULT_STORE_ID,
    name,
    createdBy: 'usr-owner-1',
    createdAt: now,
  }));

  const saleItems: any[] = [];
  const cashMemos: any[] = [];
  cleanSales.forEach((sale: any) => {
    if (Array.isArray(sale.items)) {
      sale.items.forEach((item: any, idx: number) => {
        saleItems.push({
          ...item,
          id: item.id || `${sale.id}-item-${idx + 1}`,
          saleId: sale.id,
          storeId: DEFAULT_STORE_ID,
        });
      });
    }
    cashMemos.push({
      id: `memo-${sale.id}`,
      storeId: DEFAULT_STORE_ID,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      date: sale.date,
      time: sale.time,
      createdBy: sale.staffId || 'usr-owner-1',
      createdByName: sale.staffName || 'Store Dispenser',
      customerId: sale.customerId,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      subtotal: sale.subtotal,
      discountTotal: sale.discountTotal,
      taxTotal: sale.taxTotal,
      grandTotal: sale.grandTotal,
      amountPaid: sale.amountPaid,
      changeGiven: sale.changeGiven,
      paymentMethod: sale.paymentMethod,
      itemsCount: Array.isArray(sale.items) ? sale.items.length : 0,
      status: sale.status || 'completed',
    });
  });

  const purchaseItems: any[] = [];
  cleanPurchases.forEach((po: any) => {
    if (Array.isArray(po.items)) {
      po.items.forEach((item: any, idx: number) => {
        purchaseItems.push({
          ...item,
          id: item.id || `${po.id}-pitem-${idx + 1}`,
          purchaseId: po.id,
          storeId: DEFAULT_STORE_ID,
        });
      });
    }
  });

  const settings = { ...INITIAL_SETTINGS, ...(data.settings || {}) };
  const stores = [
    {
      id: DEFAULT_STORE_ID,
      name: settings.storeName,
      ownerId: 'usr-owner-1',
      drugLicenseNumber: settings.drugLicenseNumber,
      taxRegistrationNumber: settings.taxRegistrationNumber,
      address: settings.storeAddress,
      city: settings.city,
      phone: settings.phone,
      email: settings.email,
      createdAt: data.stores?.[0]?.createdAt || now,
    },
  ];

  const staffPermissions = cleanStaff.map((u: any) => ({
    id: `perm-${u.id}`,
    storeId: DEFAULT_STORE_ID,
    userId: u.id,
    username: u.username,
    role: u.role,
    ...(u.permissions || {}),
  }));

  return {
    ...data,
    cleanVersion: DATA_CLEAN_VERSION,
    stores,
    users: cleanStaff,
    staffMembers: cleanStaff,
    medicines: cleanMedicines,
    categories,
    suppliers: cleanSuppliers,
    customers: cleanCustomers,
    purchases: cleanPurchases,
    purchaseItems,
    sales: cleanSales,
    saleItems,
    saleReturns: Array.isArray(data.saleReturns) ? data.saleReturns : [],
    stockTransactions: Array.isArray(data.stockTransactions) ? data.stockTransactions : [],
    adjustments: cleanAdjustments,
    expenses: cleanExpenses,
    payments: Array.isArray(data.payments) ? data.payments : [],
    cashMemos,
    auditLogs: Array.isArray(data.auditLogs) ? data.auditLogs : [],
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    settings,
    staffPermissions,
    deletedIds: Array.from(deletedSet),
    lastUpdated: data.lastUpdated || now,
  };
}

// Optional MongoDB Atlas Cloud Persistence
const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  (process.env.DATABASE_URL?.startsWith('mongodb') ? process.env.DATABASE_URL : '');

let mongoClientInstance: MongoClient | null = null;
let mongoCollection: Collection<any> | null = null;
let mongoConnected = false;
let lastMongoSyncAt: string | null = null;
let mongoErrorMsg: string | null = null;
const MONGO_DB_NAME = process.env.MONGODB_DB_NAME || 'pharmacare_erp';

async function syncCollectionsToMongo(clean: DatabaseSchema): Promise<void> {
  if (!mongoClientInstance || !mongoConnected || !mongoCollection) return;
  try {
    const db = mongoClientInstance.db(MONGO_DB_NAME);
    await mongoCollection.updateOne(
      { _id: 'primary_store_state' },
      { $set: { state: clean, updatedAt: clean.lastUpdated } },
      { upsert: true }
    );

    const staffCol = db.collection('staff_accounts');
    if (Array.isArray(clean.staffMembers) && clean.staffMembers.length > 0) {
      await Promise.all(
        clean.staffMembers.map(user =>
          staffCol.updateOne({ id: user.id }, { $set: { ...user, updatedAt: clean.lastUpdated } }, { upsert: true })
        )
      );
      const validIds = clean.staffMembers.map(u => u.id);
      await staffCol.deleteMany({ id: { $nin: validIds } });
    }

    lastMongoSyncAt = new Date().toISOString();
    mongoErrorMsg = null;
  } catch (err: any) {
    mongoErrorMsg = err?.message || 'Failed to sync to MongoDB Atlas';
    console.error('Failed to sync state to MongoDB Atlas:', err);
  }
}

async function initMongoDB(): Promise<void> {
  if (!MONGODB_URI) return;
  try {
    mongoClientInstance = new MongoClient(MONGODB_URI);
    await mongoClientInstance.connect();
    const db = mongoClientInstance.db(MONGO_DB_NAME);
    mongoCollection = db.collection('pharmacy_store_state');
    mongoConnected = true;
    mongoErrorMsg = null;
    console.log('Connected to MongoDB Atlas cloud database successfully.');

    const existingDoc = await mongoCollection.findOne({ _id: 'primary_store_state' });
    if (existingDoc && existingDoc.state && existingDoc.state.cleanVersion === DATA_CLEAN_VERSION) {
      const cloudState = sanitizeDatabaseState(existingDoc.state);
      writeLocalFileOnly(cloudState);
      lastMongoSyncAt = new Date().toISOString();
    } else {
      const currentLocal = readDatabase();
      await syncCollectionsToMongo(currentLocal);
    }
  } catch (err: any) {
    mongoConnected = false;
    mongoErrorMsg = err?.message || 'Connection error';
  }
}

function writeLocalFileOnly(data: DatabaseSchema): void {
  data.cleanVersion = DATA_CLEAN_VERSION;
  data.lastUpdated = new Date().toISOString();
  const tmpFile = `${DB_FILE}.tmp.${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Failed atomic write to database:', err);
    if (fs.existsSync(tmpFile)) {
      try {
        fs.unlinkSync(tmpFile);
      } catch {}
    }
  }
}

function readDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.cleanVersion === DATA_CLEAN_VERSION) {
        return sanitizeDatabaseState(parsed);
      }
    }
  } catch (err) {
    console.error('Error reading pharmacy_database.json:', err);
  }

  const initial = getInitialDatabase();
  writeLocalFileOnly(initial);
  return initial;
}

// Active WebSocket clients for Real-Time Synchronization (Part 3)
let wssInstance: WebSocketServer | null = null;

function broadcastRealtimeUpdate(clean: DatabaseSchema, event = 'STATE_SYNC'): void {
  if (!wssInstance) return;
  const payload = JSON.stringify({
    type: 'DB_UPDATED',
    event,
    storeId: DEFAULT_STORE_ID,
    timestamp: clean.lastUpdated,
    data: clean,
  });
  wssInstance.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch {}
    }
  });
}

function writeDatabase(data: DatabaseSchema, event = 'STATE_SYNC'): DatabaseSchema {
  const clean = sanitizeDatabaseState(data);
  writeLocalFileOnly(clean);
  if (mongoCollection && mongoConnected) {
    syncCollectionsToMongo(clean);
  }
  broadcastRealtimeUpdate(clean, event);
  return clean;
}

function createBackupSnapshot(comment = 'Manual backup'): { snapshotId: string; filename: string } {
  const db = readDatabase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${timestamp}.json`;
  const filePath = path.join(BACKUPS_DIR, filename);

  const payload = {
    snapshotId: `snap-${Date.now()}`,
    comment,
    createdAt: new Date().toISOString(),
    data: db,
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return { snapshotId: payload.snapshotId, filename };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  // Attach Real-Time WebSocket Server on /ws
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wssInstance = wss;

  wss.on('connection', ws => {
    try {
      const db = readDatabase();
      ws.send(
        JSON.stringify({
          type: 'CONNECTED',
          storeId: DEFAULT_STORE_ID,
          timestamp: db.lastUpdated,
          data: db,
        })
      );
    } catch {}

    ws.on('message', raw => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        } else if (msg.type === 'REQUEST_STATE') {
          const db = readDatabase();
          ws.send(
            JSON.stringify({
              type: 'DB_UPDATED',
              event: 'REQUEST_STATE',
              storeId: DEFAULT_STORE_ID,
              timestamp: db.lastUpdated,
              data: db,
            })
          );
        }
      } catch {}
    });
  });

  app.use((req: Request, res: Response, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id, X-User-Role, X-Store-Id');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: '15mb' }));

  readDatabase();
  await initMongoDB();

  // Helper to inspect request actor role & permissions
  function getActorFromReq(req: Request, db: DatabaseSchema) {
    const headerUserId = String(req.headers['x-user-id'] || req.body?.actorId || '').trim();
    const headerRole = String(req.headers['x-user-role'] || req.body?.actorRole || '').trim();
    if (headerUserId) {
      const found = db.staffMembers.find(u => u.id === headerUserId || u.username === headerUserId);
      if (found) return found;
    }
    if (headerRole === 'staff' || headerRole === 'cashier' || headerRole === 'pharmacist') {
      return {
        id: headerUserId || 'staff-actor',
        role: headerRole,
        status: 'active',
        permissions: {
          canMakeSales: true,
          canViewInventory: true,
          canAddCustomer: true,
          canViewReports: false,
          canAdjustStock: headerRole === 'pharmacist',
          canManagePurchases: headerRole === 'pharmacist',
        },
      } as any;
    }
    return db.staffMembers.find(u => u.id === 'usr-owner-1') || db.staffMembers[0];
  }

  // -------------------------------------------------------------
  // PART 1: COMPLETE DATABASE AUDIT ENDPOINT
  // -------------------------------------------------------------
  app.get('/api/audit-schema', (_req: Request, res: Response) => {
    try {
      const db = readDatabase();
      const tables = [
        { id: 1, name: 'Stores', key: 'stores', pk: 'id', fk: ['ownerId'], count: db.stores.length },
        { id: 2, name: 'Users', key: 'users', pk: 'id', fk: ['storeId', 'createdBy'], count: db.users.length },
        { id: 3, name: 'Staff', key: 'staffMembers', pk: 'id', fk: ['storeId', 'createdBy'], count: db.staffMembers.length },
        { id: 4, name: 'Medicines', key: 'medicines', pk: 'id', fk: ['storeId', 'createdBy', 'category'], count: db.medicines.length },
        { id: 5, name: 'Medicine Categories', key: 'categories', pk: 'id', fk: ['storeId'], count: db.categories.length },
        { id: 6, name: 'Suppliers', key: 'suppliers', pk: 'id', fk: ['storeId', 'createdBy'], count: db.suppliers.length },
        { id: 7, name: 'Customers', key: 'customers', pk: 'id', fk: ['storeId', 'createdBy'], count: db.customers.length },
        { id: 8, name: 'Purchases', key: 'purchases', pk: 'id', fk: ['storeId', 'supplierId', 'createdBy'], count: db.purchases.length },
        { id: 9, name: 'Purchase Items', key: 'purchaseItems', pk: 'id', fk: ['purchaseId', 'medicineId', 'storeId'], count: db.purchaseItems.length },
        { id: 10, name: 'Sales', key: 'sales', pk: 'id', fk: ['storeId', 'staffId', 'customerId', 'createdBy'], count: db.sales.length },
        { id: 11, name: 'Sale Items', key: 'saleItems', pk: 'id', fk: ['saleId', 'medicineId', 'batchId', 'storeId'], count: db.saleItems.length },
        { id: 12, name: 'Stock Transactions', key: 'stockTransactions', pk: 'id', fk: ['storeId', 'medicineId', 'batchId', 'createdBy'], count: db.stockTransactions.length },
        { id: 13, name: 'Expenses', key: 'expenses', pk: 'id', fk: ['storeId', 'addedBy', 'createdBy'], count: db.expenses.length },
        { id: 14, name: 'Payments', key: 'payments', pk: 'id', fk: ['storeId', 'referenceId', 'partyId', 'createdBy'], count: db.payments.length },
        { id: 15, name: 'Cash Memos / Invoices', key: 'cashMemos', pk: 'id', fk: ['storeId', 'saleId', 'invoiceNumber', 'createdBy'], count: db.cashMemos.length },
        { id: 16, name: 'Activity Logs', key: 'auditLogs', pk: 'id', fk: ['userId'], count: db.auditLogs.length },
        { id: 17, name: 'Store Settings', key: 'settings', pk: 'storeName', fk: ['storeId'], count: 1 },
        { id: 18, name: 'Staff Permissions', key: 'staffPermissions', pk: 'id', fk: ['storeId', 'userId'], count: db.staffPermissions.length },
      ];
      res.json({
        success: true,
        storeId: DEFAULT_STORE_ID,
        totalTablesVerified: tables.length,
        wsClientsConnected: wss.clients.size,
        tables,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/db-status
  app.get('/api/db-status', (_req: Request, res: Response) => {
    try {
      const db = readDatabase();
      res.json({
        success: true,
        storageEngine: mongoConnected ? 'hostinger_mongodb_atlas' : 'server_local_disk',
        mongoConfigured: Boolean(MONGODB_URI),
        mongoConnected,
        mongoDbName: MONGO_DB_NAME,
        lastMongoSyncAt,
        mongoErrorMsg,
        wsClientsConnected: wss.clients.size,
        localFilePath: 'data/pharmacy_database.json',
        lastUpdated: db.lastUpdated,
        counts: {
          stores: db.stores.length,
          staffAccounts: db.staffMembers.length,
          medicines: db.medicines.length,
          categories: db.categories.length,
          sales: db.sales.length,
          saleItems: db.saleItems.length,
          purchases: db.purchases.length,
          purchaseItems: db.purchaseItems.length,
          suppliers: db.suppliers.length,
          customers: db.customers.length,
          expenses: db.expenses.length,
          payments: db.payments.length,
          cashMemos: db.cashMemos.length,
          stockTransactions: db.stockTransactions.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/db-sync-now
  app.post('/api/db-sync-now', async (_req: Request, res: Response) => {
    try {
      const db = readDatabase();
      writeDatabase(db, 'MANUAL_SYNC');
      if (MONGODB_URI && !mongoConnected) {
        await initMongoDB();
      }
      if (mongoConnected) {
        await syncCollectionsToMongo(db);
      }
      res.json({
        success: true,
        storageEngine: mongoConnected ? 'hostinger_mongodb_atlas' : 'server_local_disk',
        mongoConnected,
        lastUpdated: db.lastUpdated,
        lastMongoSyncAt,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  function mergeCollectionById<T extends { id: string }>(
    existingArr: T[] = [],
    incomingArr: T[] = [],
    deletedSet: Set<string> = new Set()
  ): T[] {
    const map = new Map<string, T>();
    if (Array.isArray(existingArr)) {
      existingArr.forEach(item => {
        if (item && item.id && !deletedSet.has(item.id)) map.set(item.id, item);
      });
    }
    if (Array.isArray(incomingArr)) {
      incomingArr.forEach(item => {
        if (item && item.id && !deletedSet.has(item.id)) map.set(item.id, item);
      });
    }
    return Array.from(map.values());
  }

  async function readLatestDatabaseWithMongo(): Promise<DatabaseSchema> {
    const localDb = readDatabase();
    if (!mongoClientInstance || !mongoConnected) {
      return localDb;
    }
    try {
      const db = mongoClientInstance.db(MONGO_DB_NAME);
      const staffCol = db.collection('staff_accounts');
      const mongoStaff = await staffCol.find({}).toArray();
      const stateDoc = await mongoCollection?.findOne({ _id: 'primary_store_state' });

      const mergedStaffMap = new Map<string, any>();
      (localDb.staffMembers || []).forEach(u => {
        if (u && u.id) mergedStaffMap.set(u.id, u);
      });
      if (stateDoc?.state?.staffMembers && Array.isArray(stateDoc.state.staffMembers)) {
        stateDoc.state.staffMembers.forEach((u: any) => {
          if (u && u.id) mergedStaffMap.set(u.id, u);
        });
      }
      mongoStaff.forEach((u: any) => {
        if (u && u.id) {
          const { _id, ...rest } = u;
          mergedStaffMap.set(rest.id, rest);
        }
      });

      const mergedDb = sanitizeDatabaseState({
        ...(stateDoc?.state || {}),
        ...localDb,
        medicines:
          localDb.medicines.length >= (stateDoc?.state?.medicines?.length || 0)
            ? localDb.medicines
            : stateDoc.state.medicines,
        staffMembers: sanitizeStaffAccounts(Array.from(mergedStaffMap.values())),
      });
      writeLocalFileOnly(mergedDb);
      return mergedDb;
    } catch {
      return localDb;
    }
  }

  // GET /api/state
  app.get('/api/state', async (_req: Request, res: Response) => {
    try {
      const db = await readLatestDatabaseWithMongo();
      res.json({
        success: true,
        storageEngine: mongoConnected ? 'mongodb_atlas' : 'local_disk',
        data: db,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/sync
  app.post('/api/sync', async (req: Request, res: Response) => {
    try {
      const incoming = req.body;
      if (!incoming || !Array.isArray(incoming.medicines)) {
        return res.status(400).json({ success: false, error: 'Invalid state payload' });
      }

      const existingDb = await readLatestDatabaseWithMongo();
      const deletedSet = new Set<string>(incoming.resetDeletedIds ? [] : existingDb.deletedIds || []);
      if (Array.isArray(incoming.deletedIds)) {
        incoming.deletedIds.forEach((id: string) => deletedSet.add(id));
      }

      if (incoming.forceReplaceAll) {
        const replaced = writeDatabase(
          {
            ...existingDb,
            ...incoming,
            cleanVersion: DATA_CLEAN_VERSION,
            deletedIds: Array.from(deletedSet),
            lastUpdated: new Date().toISOString(),
          },
          'CLIENT_SYNC'
        );
        return res.json({
          success: true,
          storageEngine: mongoConnected ? 'mongodb_atlas' : 'local_disk',
          message: 'Database state replaced and persisted',
          staffCount: replaced.staffMembers.length,
          medicineCount: replaced.medicines.length,
          data: replaced,
        });
      }

      const mergedStaff = incoming.forceStaffReplace
        ? incoming.staffMembers.filter((u: any) => !deletedSet.has(u.id))
        : mergeCollectionById(existingDb.staffMembers, incoming.staffMembers, deletedSet);

      const mergedMedicines = incoming.forceMedicineReplace
        ? incoming.medicines.filter((m: any) => !deletedSet.has(m.id))
        : mergeCollectionById(existingDb.medicines, incoming.medicines, deletedSet);

      const nextDb: DatabaseSchema = {
        ...existingDb,
        ...incoming,
        cleanVersion: DATA_CLEAN_VERSION,
        medicines: mergedMedicines,
        suppliers: mergeCollectionById(existingDb.suppliers, incoming.suppliers, deletedSet),
        customers: mergeCollectionById(existingDb.customers, incoming.customers, deletedSet),
        sales: mergeCollectionById(existingDb.sales, incoming.sales, deletedSet),
        saleReturns: mergeCollectionById(existingDb.saleReturns, incoming.saleReturns, deletedSet),
        purchases: mergeCollectionById(existingDb.purchases, incoming.purchases, deletedSet),
        expenses: mergeCollectionById(existingDb.expenses, incoming.expenses, deletedSet),
        adjustments: mergeCollectionById(existingDb.adjustments, incoming.adjustments, deletedSet),
        payments: mergeCollectionById(existingDb.payments, incoming.payments, deletedSet),
        stockTransactions: mergeCollectionById(existingDb.stockTransactions, incoming.stockTransactions, deletedSet),
        staffMembers: sanitizeStaffAccounts(mergedStaff),
        deletedIds: Array.from(deletedSet),
        lastUpdated: new Date().toISOString(),
      };

      const saved = writeDatabase(nextDb, 'CLIENT_SYNC');
      res.json({
        success: true,
        storageEngine: mongoConnected ? 'mongodb_atlas' : 'local_disk',
        message: 'Database state updated and persisted',
        staffCount: saved.staffMembers.length,
        medicineCount: saved.medicines.length,
        data: saved,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // MEDICINE ENDPOINTS (Part 2.B & Part 7)
  // -------------------------------------------------------------
  app.post('/api/medicine', (req: Request, res: Response) => {
    try {
      const medicine = req.body;
      if (!medicine || !String(medicine.name || '').trim()) {
        return res.status(400).json({ success: false, error: 'Medicine name is required' });
      }

      const batches = Array.isArray(medicine.batches) ? medicine.batches : [];
      for (const b of batches) {
        if (Number(b.quantity) < 0) {
          return res.status(400).json({ success: false, error: 'Batch quantity cannot be negative' });
        }
        if (Number(b.purchasePrice) < 0 || Number(b.salePrice) <= 0) {
          return res.status(400).json({ success: false, error: 'Sale price must be greater than zero' });
        }
        if (!b.expiryDate || isNaN(Date.parse(b.expiryDate))) {
          return res.status(400).json({ success: false, error: 'Valid batch expiry date is required' });
        }
      }

      const db = readDatabase();
      const actor = getActorFromReq(req, db);

      if (!Array.isArray(db.deletedIds)) db.deletedIds = [];
      db.deletedIds = db.deletedIds.filter(delId => delId !== medicine.id);

      const totalQuantity = batches.reduce((sum: number, b: any) => sum + Number(b.quantity || 0), 0);
      const medRecord = {
        ...medicine,
        id: medicine.id || `med-${Date.now()}`,
        storeId: DEFAULT_STORE_ID,
        createdBy: medicine.createdBy || actor?.id || 'usr-owner-1',
        batches,
        totalQuantity,
      };

      const existingIdx = db.medicines.findIndex(m => m.id === medRecord.id);
      if (existingIdx >= 0) {
        db.medicines[existingIdx] = medRecord;
      } else {
        db.medicines.unshift(medRecord);
        // Record opening stock transactions for initial batches
        for (const b of batches) {
          if (Number(b.quantity) > 0) {
            db.stockTransactions.unshift({
              id: `stx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              storeId: DEFAULT_STORE_ID,
              medicineId: medRecord.id,
              medicineName: medRecord.name,
              batchId: b.id,
              batchNumber: b.batchNumber,
              type: 'opening',
              quantityChange: Number(b.quantity),
              previousQuantity: 0,
              newQuantity: Number(b.quantity),
              referenceId: medRecord.id,
              createdBy: medRecord.createdBy,
              createdByName: actor?.fullName || 'Store User',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'MEDICINE_CREATED',
        description: `Registered formulation ${medRecord.name} (${medRecord.strength || ''}) with ${totalQuantity} units`,
        userId: actor?.id || 'usr-owner-1',
        userName: actor?.fullName || 'Store User',
        userRole: actor?.role || 'admin',
        timestamp: new Date().toISOString(),
      });

      const saved = writeDatabase(db, 'MEDICINE_ADDED');
      res.json({ success: true, medicine: medRecord, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/medicine/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db = readDatabase();
      const index = db.medicines.findIndex(m => m.id === id);

      if (index === -1) {
        return res.status(404).json({ success: false, error: 'Medicine not found' });
      }

      const actor = getActorFromReq(req, db);
      const merged = { ...db.medicines[index], ...updates, storeId: DEFAULT_STORE_ID };
      if (Array.isArray(merged.batches)) {
        merged.totalQuantity = merged.batches.reduce((sum: number, b: any) => sum + Number(b.quantity || 0), 0);
      }
      db.medicines[index] = merged;

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'MEDICINE_UPDATED',
        description: `Updated medicine ${merged.name} (Stock: ${merged.totalQuantity})`,
        userId: actor?.id || 'usr-owner-1',
        userName: actor?.fullName || 'Store User',
        userRole: actor?.role || 'admin',
        timestamp: new Date().toISOString(),
      });

      const saved = writeDatabase(db, 'MEDICINE_UPDATED');
      res.json({ success: true, medicine: merged, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/medicine/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const db = readDatabase();
      const actor = getActorFromReq(req, db);

      // Part 6 Security: Check if staff without stock/inventory permission tries to delete medicine
      if (
        actor &&
        actor.role !== 'admin' &&
        actor.role !== 'pharmacist' &&
        !actor.permissions?.canAdjustStock
      ) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Staff without stock management permission cannot delete medicines',
        });
      }

      const target = db.medicines.find(m => m.id === id);
      if (!target) {
        return res.status(404).json({ success: false, error: 'Medicine not found' });
      }

      db.medicines = db.medicines.filter(m => m.id !== id);
      if (!Array.isArray(db.deletedIds)) db.deletedIds = [];
      if (!db.deletedIds.includes(id)) db.deletedIds.push(id);

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'MEDICINE_DELETED',
        description: `Removed medicine formulation ${target.name}`,
        userId: actor?.id || 'usr-owner-1',
        userName: actor?.fullName || 'Store Owner',
        userRole: actor?.role || 'admin',
        timestamp: new Date().toISOString(),
      });

      const saved = writeDatabase(db, 'MEDICINE_DELETED');
      res.json({ success: true, message: 'Medicine deleted successfully', data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // SALES & CASH MEMO ENDPOINTS (Part 2.D, Part 5, Part 7)
  // -------------------------------------------------------------
  app.post('/api/sale', (req: Request, res: Response) => {
    try {
      const sale = req.body;
      if (!sale || !Array.isArray(sale.items) || sale.items.length === 0) {
        return res.status(400).json({ success: false, error: 'Cart items cannot be empty' });
      }

      const db = readDatabase();
      const todayStr = new Date().toISOString().split('T')[0];

      // Prevent duplicate invoice number or duplicate sale ID
      if (db.sales.some(s => s.id === sale.id || s.invoiceNumber === sale.invoiceNumber)) {
        return res.status(409).json({ success: false, error: `Duplicate invoice number: ${sale.invoiceNumber}` });
      }

      // First pass: validate all items, stock quantities, and expiry dates BEFORE mutating any stock
      for (const item of sale.items) {
        if (!item.quantity || Number(item.quantity) <= 0) {
          return res.status(400).json({ success: false, error: 'Sale item quantity must be greater than zero' });
        }
        const med = db.medicines.find(m => m.id === item.medicineId);
        if (!med) {
          return res.status(404).json({ success: false, error: `Medicine ${item.medicineName} not found` });
        }

        const batch = med.batches.find(b => b.id === item.batchId || b.batchNumber === item.batchNumber);
        if (!batch) {
          return res.status(404).json({ success: false, error: `Batch ${item.batchNumber} not found` });
        }

        if (batch.expiryDate && batch.expiryDate < todayStr) {
          return res.status(400).json({
            success: false,
            error: `Cannot sell expired batch ${batch.batchNumber} of ${med.name} (Expired: ${batch.expiryDate})`,
          });
        }

        if (batch.quantity < item.quantity) {
          return res.status(400).json({
            success: false,
            error: `Insufficient stock in batch ${batch.batchNumber} for ${med.name}. Available: ${batch.quantity}, Requested: ${item.quantity}`,
          });
        }
      }

      // Second pass: atomically deduct stock and record StockTransactions
      for (const item of sale.items) {
        const med = db.medicines.find(m => m.id === item.medicineId)!;
        const batch = med.batches.find(b => b.id === item.batchId || b.batchNumber === item.batchNumber)!;
        const prevQty = batch.quantity;
        batch.quantity -= Number(item.quantity);
        med.totalQuantity = med.batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);

        db.stockTransactions.unshift({
          id: `stx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          storeId: DEFAULT_STORE_ID,
          medicineId: med.id,
          medicineName: med.name,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          type: 'sale',
          quantityChange: -Number(item.quantity),
          previousQuantity: prevQty,
          newQuantity: batch.quantity,
          referenceId: sale.id,
          createdBy: sale.staffId || 'usr-owner-1',
          createdByName: sale.staffName || 'Store Dispenser',
          timestamp: new Date().toISOString(),
        });
      }

      const saleRecord = {
        ...sale,
        storeId: DEFAULT_STORE_ID,
        createdBy: sale.staffId || 'usr-owner-1',
        status: sale.status || 'completed',
      };

      db.sales.unshift(saleRecord);

      // Update Customer ledger if customerId is linked
      if (saleRecord.customerId) {
        const cust = db.customers.find(c => c.id === saleRecord.customerId);
        if (cust) {
          cust.totalPurchases = Number(cust.totalPurchases || 0) + Number(saleRecord.grandTotal || 0);
          cust.lastPurchaseDate = saleRecord.date;
          const unpaidAmount = Math.max(0, Number(saleRecord.grandTotal || 0) - Number(saleRecord.amountPaid || 0));
          if (saleRecord.paymentMethod === 'Credit' || unpaidAmount > 0) {
            cust.outstandingBalance = Number(cust.outstandingBalance || 0) + unpaidAmount;
          }
        }
      }

      // Record Payment entry if amountPaid > 0
      if (Number(saleRecord.amountPaid) > 0) {
        db.payments.unshift({
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          storeId: DEFAULT_STORE_ID,
          type: 'customer_payment',
          referenceId: saleRecord.id,
          partyId: saleRecord.customerId,
          partyName: saleRecord.customerName || 'Walk-in Customer',
          amount: Math.min(Number(saleRecord.amountPaid), Number(saleRecord.grandTotal)),
          paymentMethod: saleRecord.paymentMethod || 'Cash',
          date: saleRecord.date,
          createdBy: saleRecord.staffId || 'usr-owner-1',
          createdByName: saleRecord.staffName || 'Store Dispenser',
          notes: `Payment for Invoice ${saleRecord.invoiceNumber}`,
        });
      }

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'SALE_COMPLETED',
        description: `Dispensed invoice ${saleRecord.invoiceNumber} for Rs. ${saleRecord.grandTotal} via ${saleRecord.paymentMethod}`,
        userId: saleRecord.staffId || 'usr-owner-1',
        userName: saleRecord.staffName || 'Staff Cashier',
        userRole: 'staff',
        timestamp: new Date().toISOString(),
      });

      const saved = writeDatabase(db, 'SALE_COMPLETED');
      res.json({ success: true, sale: saleRecord, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/sale-return
  app.post('/api/sale-return', (req: Request, res: Response) => {
    try {
      const saleReturn = req.body;
      if (!saleReturn || !saleReturn.saleId || !Array.isArray(saleReturn.items)) {
        return res.status(400).json({ success: false, error: 'Valid sale return payload required' });
      }

      const db = readDatabase();
      const targetSale = db.sales.find(s => s.id === saleReturn.saleId);
      if (!targetSale) {
        return res.status(404).json({ success: false, error: 'Original sale not found' });
      }
      if (targetSale.status === 'returned') {
        return res.status(409).json({ success: false, error: 'Sale has already been returned' });
      }

      targetSale.status = 'returned';

      for (const rItem of saleReturn.items) {
        const med = db.medicines.find(m => m.id === rItem.medicineId);
        if (med) {
          const batch = med.batches.find(b => b.id === rItem.batchId || b.batchNumber === rItem.batchNumber);
          if (batch) {
            const prevQty = batch.quantity;
            batch.quantity += Number(rItem.quantity);
            med.totalQuantity = med.batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);

            db.stockTransactions.unshift({
              id: `stx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              storeId: DEFAULT_STORE_ID,
              medicineId: med.id,
              medicineName: med.name,
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              type: 'return',
              quantityChange: Number(rItem.quantity),
              previousQuantity: prevQty,
              newQuantity: batch.quantity,
              referenceId: saleReturn.id,
              createdBy: saleReturn.staffId || 'usr-owner-1',
              createdByName: saleReturn.staffName || 'Store Staff',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      db.saleReturns.unshift({
        ...saleReturn,
        storeId: DEFAULT_STORE_ID,
        createdBy: saleReturn.staffId || 'usr-owner-1',
      });

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'SALE_RETURN',
        description: `Processed return for Invoice ${saleReturn.invoiceNumber} (Refund Rs. ${saleReturn.totalRefund})`,
        userId: saleReturn.staffId || 'usr-owner-1',
        userName: saleReturn.staffName || 'Store Staff',
        userRole: 'staff',
        timestamp: new Date().toISOString(),
      });

      const saved = writeDatabase(db, 'SALE_RETURNED');
      res.json({ success: true, saleReturn, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // PURCHASE ENDPOINTS (Part 2.C)
  // -------------------------------------------------------------
  app.post('/api/purchase', (req: Request, res: Response) => {
    try {
      const purchase = req.body;
      if (!purchase || !Array.isArray(purchase.items) || purchase.items.length === 0) {
        return res.status(400).json({ success: false, error: 'Purchase items required' });
      }

      for (const pItem of purchase.items) {
        if (!pItem.quantity || Number(pItem.quantity) <= 0) {
          return res.status(400).json({ success: false, error: 'Purchase item quantity must be positive' });
        }
        if (Number(pItem.purchasePrice) <= 0 || Number(pItem.salePrice) <= 0) {
          return res.status(400).json({ success: false, error: 'Purchase and sale prices must be positive' });
        }
      }

      const db = readDatabase();
      const actor = getActorFromReq(req, db);

      const totalAmount = Number(purchase.totalAmount || 0);
      const paidAmount = Number(purchase.paidAmount || 0);
      const balanceAmount = Math.max(0, totalAmount - paidAmount);
      const paymentStatus =
        balanceAmount === 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending';

      const poRecord = {
        ...purchase,
        id: purchase.id || `po-${Date.now()}`,
        storeId: DEFAULT_STORE_ID,
        createdBy: purchase.createdBy || actor?.id || 'usr-owner-1',
        totalAmount,
        paidAmount,
        balanceAmount,
        paymentStatus,
      };

      db.purchases.unshift(poRecord);

      // Update medicine batches & stock transactions
      for (const pItem of poRecord.items) {
        const med = db.medicines.find(m => m.id === pItem.medicineId);
        if (med) {
          const existingBatch = med.batches.find(b => b.batchNumber === pItem.batchNumber);
          let batchId = existingBatch?.id || `bat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const prevQty = existingBatch ? Number(existingBatch.quantity || 0) : 0;

          if (existingBatch) {
            existingBatch.quantity += Number(pItem.quantity);
            existingBatch.purchasePrice = Number(pItem.purchasePrice);
            existingBatch.salePrice = Number(pItem.salePrice);
            if (pItem.expiryDate) existingBatch.expiryDate = pItem.expiryDate;
          } else {
            med.batches.push({
              id: batchId,
              medicineId: med.id,
              batchNumber: pItem.batchNumber,
              purchasePrice: Number(pItem.purchasePrice),
              salePrice: Number(pItem.salePrice),
              quantity: Number(pItem.quantity),
              initialQuantity: Number(pItem.quantity),
              mfgDate: pItem.mfgDate || new Date().toISOString().split('T')[0],
              expiryDate: pItem.expiryDate,
              supplierId: poRecord.supplierId,
              supplierName: poRecord.supplierName,
              receivedDate: poRecord.purchaseDate,
            });
          }
          med.totalQuantity = med.batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);

          db.stockTransactions.unshift({
            id: `stx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            storeId: DEFAULT_STORE_ID,
            medicineId: med.id,
            medicineName: med.name,
            batchId,
            batchNumber: pItem.batchNumber,
            type: 'purchase',
            quantityChange: Number(pItem.quantity),
            previousQuantity: prevQty,
            newQuantity: prevQty + Number(pItem.quantity),
            referenceId: poRecord.id,
            createdBy: poRecord.createdBy,
            createdByName: poRecord.receivedBy || actor?.fullName || 'Store Owner',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Update supplier ledger balances
      const sup = db.suppliers.find(s => s.id === poRecord.supplierId);
      if (sup) {
        sup.totalPurchases = Number(sup.totalPurchases || 0) + totalAmount;
        sup.totalPaid = Number(sup.totalPaid || 0) + paidAmount;
        sup.outstandingBalance = Number(sup.outstandingBalance || 0) + balanceAmount;
      }

      // Record payment if paidAmount > 0
      if (paidAmount > 0) {
        db.payments.unshift({
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          storeId: DEFAULT_STORE_ID,
          type: 'purchase_payment',
          referenceId: poRecord.id,
          partyId: poRecord.supplierId,
          partyName: poRecord.supplierName,
          amount: paidAmount,
          paymentMethod: poRecord.paymentMethod || 'Cash',
          date: poRecord.purchaseDate,
          createdBy: poRecord.createdBy,
          createdByName: poRecord.receivedBy || 'Store Owner',
          notes: `Payment on PO ${poRecord.purchaseNumber}`,
        });
      }

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'PURCHASE_RECORDED',
        description: `Received PO ${poRecord.purchaseNumber} from ${poRecord.supplierName} (Rs. ${totalAmount})`,
        userId: poRecord.createdBy,
        userName: poRecord.receivedBy || 'Store Owner',
        userRole: actor?.role || 'admin',
        timestamp: new Date().toISOString(),
      });

      const saved = writeDatabase(db, 'PURCHASE_ADDED');
      res.json({ success: true, purchase: poRecord, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/purchase/:id/payment
  app.post('/api/purchase/:id/payment', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { amount, paymentMethod = 'Cash' } = req.body;
      const payAmt = Number(amount || 0);
      if (payAmt <= 0) {
        return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
      }

      const db = readDatabase();
      const po = db.purchases.find(p => p.id === id);
      if (!po) {
        return res.status(404).json({ success: false, error: 'Purchase order not found' });
      }

      const actualPay = Math.min(payAmt, po.balanceAmount);
      po.paidAmount += actualPay;
      po.balanceAmount = Math.max(0, po.totalAmount - po.paidAmount);
      po.paymentStatus = po.balanceAmount === 0 ? 'Paid' : 'Partial';

      const sup = db.suppliers.find(s => s.id === po.supplierId);
      if (sup) {
        sup.totalPaid += actualPay;
        sup.outstandingBalance = Math.max(0, sup.outstandingBalance - actualPay);
      }

      db.payments.unshift({
        id: `pay-${Date.now()}`,
        storeId: DEFAULT_STORE_ID,
        type: 'purchase_payment',
        referenceId: po.id,
        partyId: po.supplierId,
        partyName: po.supplierName,
        amount: actualPay,
        paymentMethod,
        date: new Date().toISOString().split('T')[0],
        createdBy: 'usr-owner-1',
        createdByName: 'Store Owner',
        notes: `Installment payment for PO ${po.purchaseNumber}`,
      });

      const saved = writeDatabase(db, 'PURCHASE_PAYMENT');
      res.json({ success: true, purchase: po, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // STOCK ADJUSTMENT ENDPOINT (Part 2.E)
  // -------------------------------------------------------------
  app.post('/api/adjustment', (req: Request, res: Response) => {
    try {
      const adj = req.body;
      if (!adj || !adj.medicineId || !adj.batchId) {
        return res.status(400).json({ success: false, error: 'Medicine and batch are required for stock adjustment' });
      }

      const db = readDatabase();
      const actor = getActorFromReq(req, db);
      if (
        actor &&
        actor.role !== 'admin' &&
        actor.role !== 'pharmacist' &&
        !actor.permissions?.canAdjustStock
      ) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: You do not have permission to adjust stock',
        });
      }

      const med = db.medicines.find(m => m.id === adj.medicineId);
      if (!med) {
        return res.status(404).json({ success: false, error: 'Medicine not found' });
      }

      const batch = med.batches.find(b => b.id === adj.batchId || b.batchNumber === adj.batchNumber);
      if (!batch) {
        return res.status(404).json({ success: false, error: 'Batch not found' });
      }

      const prevQty = Number(batch.quantity || 0);
      const newQty =
        typeof adj.newQuantity === 'number'
          ? Math.max(0, adj.newQuantity)
          : Math.max(0, prevQty + Number(adj.adjustedQuantity || 0));
      const diff = newQty - prevQty;

      batch.quantity = newQty;
      med.totalQuantity = med.batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);

      const adjRecord = {
        ...adj,
        id: adj.id || `adj-${Date.now()}`,
        storeId: DEFAULT_STORE_ID,
        createdBy: adj.performedBy || actor?.id || 'usr-owner-1',
        previousQuantity: prevQty,
        adjustedQuantity: diff,
        newQuantity: newQty,
        timestamp: adj.timestamp || new Date().toISOString(),
      };

      db.adjustments.unshift(adjRecord);

      db.stockTransactions.unshift({
        id: `stx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        storeId: DEFAULT_STORE_ID,
        medicineId: med.id,
        medicineName: med.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        type: 'adjustment',
        quantityChange: diff,
        previousQuantity: prevQty,
        newQuantity: newQty,
        referenceId: adjRecord.id,
        createdBy: adjRecord.createdBy,
        createdByName: adjRecord.performedByName || actor?.fullName || 'Store User',
        timestamp: adjRecord.timestamp,
      });

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'STOCK_ADJUSTED',
        description: `Adjusted ${med.name} (${batch.batchNumber}): ${prevQty} -> ${newQty} (${adjRecord.adjustmentType})`,
        userId: adjRecord.createdBy,
        userName: adjRecord.performedByName || 'Store User',
        userRole: actor?.role || 'admin',
        timestamp: new Date().toISOString(),
      });

      const saved = writeDatabase(db, 'STOCK_ADJUSTED');
      res.json({ success: true, adjustment: adjRecord, medicine: med, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // CUSTOMER ENDPOINTS (Part 2.F)
  // -------------------------------------------------------------
  app.post('/api/customer', (req: Request, res: Response) => {
    try {
      const customer = req.body;
      if (!customer || !String(customer.name || '').trim()) {
        return res.status(400).json({ success: false, error: 'Customer name is required' });
      }
      const db = readDatabase();
      const actor = getActorFromReq(req, db);
      const custRecord = {
        ...customer,
        id: customer.id || `cust-${Date.now()}`,
        storeId: DEFAULT_STORE_ID,
        createdBy: customer.createdBy || actor?.id || 'usr-owner-1',
        totalPurchases: Number(customer.totalPurchases || 0),
        outstandingBalance: Number(customer.outstandingBalance || 0),
        createdAt: customer.createdAt || new Date().toISOString().split('T')[0],
      };

      if (!Array.isArray(db.deletedIds)) db.deletedIds = [];
      db.deletedIds = db.deletedIds.filter(id => id !== custRecord.id);

      const idx = db.customers.findIndex(c => c.id === custRecord.id);
      if (idx >= 0) db.customers[idx] = custRecord;
      else db.customers.unshift(custRecord);

      const saved = writeDatabase(db, 'CUSTOMER_ADDED');
      res.json({ success: true, customer: custRecord, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/customer/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db = readDatabase();
      const idx = db.customers.findIndex(c => c.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Customer not found' });

      db.customers[idx] = { ...db.customers[idx], ...updates, storeId: DEFAULT_STORE_ID };
      const saved = writeDatabase(db, 'CUSTOMER_UPDATED');
      res.json({ success: true, customer: db.customers[idx], data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/customer/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const db = readDatabase();
      const actor = getActorFromReq(req, db);
      if (actor && actor.role !== 'admin' && !actor.permissions?.canAddCustomer) {
        return res.status(403).json({ success: false, error: 'Unauthorized to delete customer' });
      }
      const target = db.customers.find(c => c.id === id);
      if (!target) return res.status(404).json({ success: false, error: 'Customer not found' });

      db.customers = db.customers.filter(c => c.id !== id);
      if (!Array.isArray(db.deletedIds)) db.deletedIds = [];
      if (!db.deletedIds.includes(id)) db.deletedIds.push(id);

      const saved = writeDatabase(db, 'CUSTOMER_DELETED');
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/customer/:id/payment', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { amount, paymentMethod = 'Cash' } = req.body;
      const payAmt = Number(amount || 0);
      if (payAmt <= 0) return res.status(400).json({ success: false, error: 'Payment amount must be positive' });

      const db = readDatabase();
      const cust = db.customers.find(c => c.id === id);
      if (!cust) return res.status(404).json({ success: false, error: 'Customer not found' });

      const actualPay = Math.min(payAmt, cust.outstandingBalance);
      cust.outstandingBalance = Math.max(0, cust.outstandingBalance - actualPay);

      db.payments.unshift({
        id: `pay-${Date.now()}`,
        storeId: DEFAULT_STORE_ID,
        type: 'customer_payment',
        referenceId: cust.id,
        partyId: cust.id,
        partyName: cust.name,
        amount: actualPay,
        paymentMethod,
        date: new Date().toISOString().split('T')[0],
        createdBy: 'usr-owner-1',
        createdByName: 'Store User',
        notes: `Customer credit recovery from ${cust.name}`,
      });

      const saved = writeDatabase(db, 'CUSTOMER_PAYMENT');
      res.json({ success: true, customer: cust, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // SUPPLIER ENDPOINTS (Part 2.F)
  // -------------------------------------------------------------
  app.post('/api/supplier', (req: Request, res: Response) => {
    try {
      const supplier = req.body;
      if (!supplier || !String(supplier.companyName || '').trim()) {
        return res.status(400).json({ success: false, error: 'Supplier company name is required' });
      }
      const db = readDatabase();
      const actor = getActorFromReq(req, db);
      const supRecord = {
        ...supplier,
        id: supplier.id || `sup-${Date.now()}`,
        storeId: DEFAULT_STORE_ID,
        createdBy: supplier.createdBy || actor?.id || 'usr-owner-1',
        openingBalance: Number(supplier.openingBalance || 0),
        totalPurchases: Number(supplier.totalPurchases || 0),
        totalPaid: Number(supplier.totalPaid || 0),
        outstandingBalance: Number(
          supplier.outstandingBalance !== undefined ? supplier.outstandingBalance : supplier.openingBalance || 0
        ),
        createdAt: supplier.createdAt || new Date().toISOString().split('T')[0],
      };

      if (!Array.isArray(db.deletedIds)) db.deletedIds = [];
      db.deletedIds = db.deletedIds.filter(id => id !== supRecord.id);

      const idx = db.suppliers.findIndex(s => s.id === supRecord.id);
      if (idx >= 0) db.suppliers[idx] = supRecord;
      else db.suppliers.unshift(supRecord);

      const saved = writeDatabase(db, 'SUPPLIER_ADDED');
      res.json({ success: true, supplier: supRecord, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/supplier/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db = readDatabase();
      const idx = db.suppliers.findIndex(s => s.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Supplier not found' });

      db.suppliers[idx] = { ...db.suppliers[idx], ...updates, storeId: DEFAULT_STORE_ID };
      const saved = writeDatabase(db, 'SUPPLIER_UPDATED');
      res.json({ success: true, supplier: db.suppliers[idx], data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/supplier/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const db = readDatabase();
      const target = db.suppliers.find(s => s.id === id);
      if (!target) return res.status(404).json({ success: false, error: 'Supplier not found' });

      db.suppliers = db.suppliers.filter(s => s.id !== id);
      if (!Array.isArray(db.deletedIds)) db.deletedIds = [];
      if (!db.deletedIds.includes(id)) db.deletedIds.push(id);

      const saved = writeDatabase(db, 'SUPPLIER_DELETED');
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/supplier/:id/payment', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { amount, paymentMethod = 'Cash' } = req.body;
      const payAmt = Number(amount || 0);
      if (payAmt <= 0) return res.status(400).json({ success: false, error: 'Payment amount must be positive' });

      const db = readDatabase();
      const sup = db.suppliers.find(s => s.id === id);
      if (!sup) return res.status(404).json({ success: false, error: 'Supplier not found' });

      const actualPay = Math.min(payAmt, sup.outstandingBalance);
      sup.totalPaid += actualPay;
      sup.outstandingBalance = Math.max(0, sup.outstandingBalance - actualPay);

      db.payments.unshift({
        id: `pay-${Date.now()}`,
        storeId: DEFAULT_STORE_ID,
        type: 'supplier_payment',
        referenceId: sup.id,
        partyId: sup.id,
        partyName: sup.companyName,
        amount: actualPay,
        paymentMethod,
        date: new Date().toISOString().split('T')[0],
        createdBy: 'usr-owner-1',
        createdByName: 'Store Owner',
        notes: `Direct supplier ledger payment to ${sup.companyName}`,
      });

      const saved = writeDatabase(db, 'SUPPLIER_PAYMENT');
      res.json({ success: true, supplier: sup, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // EXPENSE ENDPOINTS (Part 2.G)
  // -------------------------------------------------------------
  app.post('/api/expense', (req: Request, res: Response) => {
    try {
      const expense = req.body;
      if (!expense || !String(expense.description || '').trim() || Number(expense.amount) <= 0) {
        return res.status(400).json({ success: false, error: 'Valid expense description and positive amount required' });
      }
      const db = readDatabase();
      const actor = getActorFromReq(req, db);
      const expRecord = {
        ...expense,
        id: expense.id || `exp-${Date.now()}`,
        storeId: DEFAULT_STORE_ID,
        createdBy: expense.addedBy || actor?.id || 'usr-owner-1',
        amount: Number(expense.amount),
      };

      if (!Array.isArray(db.deletedIds)) db.deletedIds = [];
      db.deletedIds = db.deletedIds.filter(id => id !== expRecord.id);

      const idx = db.expenses.findIndex(e => e.id === expRecord.id);
      if (idx >= 0) db.expenses[idx] = expRecord;
      else db.expenses.unshift(expRecord);

      db.payments.unshift({
        id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        storeId: DEFAULT_STORE_ID,
        type: 'expense_payment',
        referenceId: expRecord.id,
        partyName: expRecord.category,
        amount: expRecord.amount,
        paymentMethod: expRecord.paymentMethod || 'Cash',
        date: expRecord.date,
        createdBy: expRecord.createdBy,
        createdByName: expRecord.addedByName || 'Store Owner',
        notes: expRecord.description,
      });

      const saved = writeDatabase(db, 'EXPENSE_ADDED');
      res.json({ success: true, expense: expRecord, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/expense/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db = readDatabase();
      const idx = db.expenses.findIndex(e => e.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Expense not found' });

      db.expenses[idx] = {
        ...db.expenses[idx],
        ...updates,
        amount: updates.amount !== undefined ? Number(updates.amount) : db.expenses[idx].amount,
        storeId: DEFAULT_STORE_ID,
      };
      const saved = writeDatabase(db, 'EXPENSE_UPDATED');
      res.json({ success: true, expense: db.expenses[idx], data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/expense/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const db = readDatabase();
      const actor = getActorFromReq(req, db);
      if (actor && actor.role !== 'admin' && !actor.permissions?.canViewReports) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Only Owner can delete expenses' });
      }
      const target = db.expenses.find(e => e.id === id);
      if (!target) return res.status(404).json({ success: false, error: 'Expense not found' });

      db.expenses = db.expenses.filter(e => e.id !== id);
      if (!Array.isArray(db.deletedIds)) db.deletedIds = [];
      if (!db.deletedIds.includes(id)) db.deletedIds.push(id);

      const saved = writeDatabase(db, 'EXPENSE_DELETED');
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // SETTINGS ENDPOINT (Part 6 Security Guarded)
  // -------------------------------------------------------------
  app.put('/api/settings', (req: Request, res: Response) => {
    try {
      const db = readDatabase();
      const actor = getActorFromReq(req, db);
      if (actor && actor.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Unauthorized: Only Store Owner can modify Store Settings' });
      }
      db.settings = { ...db.settings, ...req.body };
      const saved = writeDatabase(db, 'SETTINGS_UPDATED');
      res.json({ success: true, settings: saved.settings, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // BACKUP ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/backups', (_req: Request, res: Response) => {
    try {
      const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
      const snapshots = files
        .map(file => {
          const filePath = path.join(BACKUPS_DIR, file);
          const stats = fs.statSync(filePath);
          return {
            id: file.replace('.json', ''),
            filename: file,
            timestamp: stats.mtime.toISOString(),
            sizeBytes: stats.size,
          };
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({ success: true, snapshots });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/backups', (req: Request, res: Response) => {
    try {
      const { comment } = req.body || {};
      const result = createBackupSnapshot(comment);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/backups/restore', (req: Request, res: Response) => {
    try {
      const { filename } = req.body;
      if (!filename) {
        return res.status(400).json({ success: false, error: 'Filename is required' });
      }

      const filePath = path.join(BACKUPS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Backup snapshot file not found' });
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const snapshotData = parsed.data || parsed;

      if (!snapshotData.medicines || !snapshotData.sales) {
        return res.status(400).json({ success: false, error: 'Corrupt or invalid backup snapshot' });
      }

      createBackupSnapshot('Auto safety snapshot before restore');
      writeDatabase(snapshotData, 'BACKUP_RESTORED');
      res.json({ success: true, message: 'Database restored successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // STAFF & AUTHENTICATION ENDPOINTS (Part 2.A & Part 6)
  // -------------------------------------------------------------
  app.get('/api/staff', async (_req: Request, res: Response) => {
    try {
      const db = await readLatestDatabaseWithMongo();
      res.json({ success: true, staffMembers: db.staffMembers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/staff', async (req: Request, res: Response) => {
    try {
      const db = await readLatestDatabaseWithMongo();
      const actor = getActorFromReq(req, db);
      if (actor && actor.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Only Store Owner can create staff accounts',
        });
      }

      const newStaff = req.body;
      if (!newStaff || !newStaff.username || !newStaff.fullName) {
        return res.status(400).json({ success: false, error: 'Full name and username are required' });
      }

      const cleanUsername = String(newStaff.username).trim().toLowerCase().replace(/^@/, '');
      const plainPassword = String(newStaff.password || 'seller123').trim();

      const existingIdx = db.staffMembers.findIndex(
        u => u.id === newStaff.id || u.username.toLowerCase() === cleanUsername
      );

      const userToSave = {
        ...newStaff,
        id: existingIdx >= 0 ? db.staffMembers[existingIdx].id : newStaff.id || `usr-staff-${Date.now()}`,
        storeId: DEFAULT_STORE_ID,
        createdBy: 'usr-owner-1',
        username: cleanUsername,
        password: plainPassword,
        passwordHash: hashPassword(plainPassword),
        pin: String(newStaff.pin || '5678').trim(),
        status: newStaff.status || 'active',
        joiningDate: newStaff.joiningDate || new Date().toISOString().split('T')[0],
      };

      if (existingIdx >= 0) {
        db.staffMembers[existingIdx] = userToSave;
      } else {
        db.staffMembers.push(userToSave);
      }

      if (!Array.isArray(db.deletedIds)) db.deletedIds = [];
      db.deletedIds = db.deletedIds.filter(delId => delId !== userToSave.id);
      db.staffMembers = sanitizeStaffAccounts(db.staffMembers);

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'STAFF_CREATED',
        description: `Owner saved staff account for ${userToSave.fullName} (@${userToSave.username})`,
        userId: 'usr-owner-1',
        userName: 'Dr. Abdul Rehman (Owner)',
        userRole: 'admin',
        timestamp: new Date().toISOString(),
      });

      const saved = writeDatabase(db, 'STAFF_UPDATED');
      if (mongoConnected) {
        await syncCollectionsToMongo(saved);
      }

      res.json({ success: true, user: userToSave, staffMembers: saved.staffMembers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/staff/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db = await readLatestDatabaseWithMongo();
      const actor = getActorFromReq(req, db);

      // Staff cannot escalate their own permissions or modify other accounts
      if (actor && actor.role !== 'admin') {
        if (actor.id !== id || updates.permissions || updates.role || updates.status) {
          return res.status(403).json({
            success: false,
            error: 'Unauthorized: Staff cannot modify roles, permissions, or other accounts',
          });
        }
      }

      const idx = db.staffMembers.findIndex(u => u.id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Staff account not found' });
      }

      const nextPassword =
        updates.password !== undefined ? String(updates.password).trim() : db.staffMembers[idx].password;

      db.staffMembers[idx] = {
        ...db.staffMembers[idx],
        ...updates,
        password: nextPassword,
        passwordHash: nextPassword ? hashPassword(nextPassword) : db.staffMembers[idx].passwordHash,
      };
      db.staffMembers = sanitizeStaffAccounts(db.staffMembers);

      const saved = writeDatabase(db, 'STAFF_UPDATED');
      if (mongoConnected) {
        await syncCollectionsToMongo(saved);
      }
      res.json({ success: true, user: saved.staffMembers[idx], staffMembers: saved.staffMembers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/staff/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const db = await readLatestDatabaseWithMongo();
      const actor = getActorFromReq(req, db);

      if (actor && actor.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Only Store Owner can delete staff accounts',
        });
      }

      if (id === 'all-others') {
        db.staffMembers = sanitizeStaffAccounts([]);
        if (mongoClientInstance && mongoConnected) {
          await mongoClientInstance
            .db(MONGO_DB_NAME)
            .collection('staff_accounts')
            .deleteMany({ id: { $ne: 'usr-owner-1' } });
        }
      } else {
        if (id === 'usr-owner-1') {
          return res.status(403).json({ success: false, error: 'Owner account cannot be deleted' });
        }
        db.staffMembers = sanitizeStaffAccounts(db.staffMembers.filter(u => u.id !== id));
        if (!Array.isArray(db.deletedIds)) db.deletedIds = [];
        if (!db.deletedIds.includes(id)) db.deletedIds.push(id);
        if (mongoClientInstance && mongoConnected) {
          await mongoClientInstance
            .db(MONGO_DB_NAME)
            .collection('staff_accounts')
            .deleteOne({ id });
        }
      }

      const saved = writeDatabase(db, 'STAFF_DELETED');
      if (mongoConnected) {
        await syncCollectionsToMongo(saved);
      }
      res.json({ success: true, staffMembers: saved.staffMembers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body || {};
      if (!username) {
        return res.status(400).json({ success: false, error: 'Username is required' });
      }

      const rawInput = String(username).trim().toLowerCase().replace(/^@/, '');
      const cleanCompact = rawInput.replace(/\s+/g, '');
      const cleanPass = String(password || '').trim();
      const incomingHash = hashPassword(cleanPass);

      const db = await readLatestDatabaseWithMongo();
      const user = db.staffMembers.find(u => {
        const uName = (u.username || '').trim().toLowerCase().replace(/^@/, '');
        const uFull = (u.fullName || '').trim().toLowerCase();
        const uCompact = uFull.replace(/[^a-z0-9]/g, '');
        const uEmail = (u.email || '').trim().toLowerCase();
        return (
          uName === rawInput ||
          uName === cleanCompact ||
          uFull === rawInput ||
          uCompact === cleanCompact ||
          uEmail === rawInput ||
          (u.id === 'usr-owner-1' && ['admin', 'owner', 'abdulrehman'].includes(cleanCompact))
        );
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Account not found. Enter "admin" for Owner or a valid staff username created by the Owner.',
        });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ success: false, error: 'This staff account is deactivated.' });
      }

      const expectedPassword =
        user.id === 'usr-owner-1' ? (user.password || 'admin').trim() : (user.password || '').trim();
      const expectedHash = user.passwordHash || hashPassword(expectedPassword);

      if (expectedPassword && cleanPass !== expectedPassword && incomingHash !== expectedHash) {
        return res.status(401).json({
          success: false,
          error:
            user.id === 'usr-owner-1'
              ? 'Invalid password for Owner account.'
              : `Incorrect password for @${user.username}.`,
        });
      }

      user.lastLogin = new Date().toISOString();
      writeDatabase(db, 'USER_LOGIN');

      res.json({ success: true, user, staffMembers: db.staffMembers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/auth/pin-login
  app.post('/api/auth/pin-login', async (req: Request, res: Response) => {
    try {
      const { pin, username } = req.body;
      if (!pin) {
        return res.status(400).json({ success: false, error: 'PIN is required' });
      }

      const db = await readLatestDatabaseWithMongo();
      const user = db.staffMembers.find(u => {
        if (u.id === 'usr-owner-1') return false;
        const matchesPin = u.pin === pin;
        if (username) {
          return (
            matchesPin &&
            (u.id.toLowerCase() === username.toLowerCase() ||
              u.username.toLowerCase() === username.toLowerCase() ||
              u.fullName.toLowerCase() === username.toLowerCase())
          );
        }
        return matchesPin;
      });

      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid 4-digit PIN' });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Account is deactivated' });
      }

      user.lastLogin = new Date().toISOString();
      writeDatabase(db, 'USER_LOGIN');

      res.json({ success: true, user, staffMembers: db.staffMembers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // VITE DEV SERVER OR PRODUCTION STATIC SERVING
  // -------------------------------------------------------------
  const distPath = path.join(__dirname, 'dist');
  const isProdMode =
    process.env.NODE_ENV === 'production' ||
    (process.env.VITE_DEV !== 'true' && fs.existsSync(path.join(distPath, 'index.html')));

  if (!isProdMode) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, () => {
    console.log(`PharmaCare ERP & POS server + WebSocket running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
