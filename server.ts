/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type Request, type Response } from 'express';
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

// Ensure data and backup directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

interface DatabaseSchema {
  cleanVersion?: string;
  settings: typeof INITIAL_SETTINGS;
  medicines: typeof INITIAL_MEDICINES;
  suppliers: typeof INITIAL_SUPPLIERS;
  customers: typeof INITIAL_CUSTOMERS;
  sales: typeof INITIAL_SALES;
  saleReturns: any[];
  purchases: typeof INITIAL_PURCHASES;
  expenses: typeof INITIAL_EXPENSES;
  adjustments: typeof INITIAL_ADJUSTMENTS;
  auditLogs: typeof INITIAL_AUDIT_LOGS;
  notifications: typeof INITIAL_NOTIFICATIONS;
  staffMembers: typeof INITIAL_USERS;
  lastUpdated: string;
}

// Initial Database Seeder (100% Clean, No Dummy Data)
function getInitialDatabase(): DatabaseSchema {
  return {
    cleanVersion: DATA_CLEAN_VERSION,
    settings: INITIAL_SETTINGS,
    medicines: INITIAL_MEDICINES,
    suppliers: INITIAL_SUPPLIERS,
    customers: INITIAL_CUSTOMERS,
    sales: INITIAL_SALES,
    saleReturns: [],
    purchases: INITIAL_PURCHASES,
    expenses: INITIAL_EXPENSES,
    adjustments: INITIAL_ADJUSTMENTS,
    auditLogs: INITIAL_AUDIT_LOGS,
    notifications: INITIAL_NOTIFICATIONS,
    staffMembers: INITIAL_USERS,
    lastUpdated: new Date().toISOString(),
  };
}

function sanitizeDatabaseState(data: any): DatabaseSchema {
  if (!data || data.cleanVersion !== DATA_CLEAN_VERSION) {
    // Strip all old dummy records while keeping any custom staff accounts created by Owner
    const clean = getInitialDatabase();
    clean.staffMembers = sanitizeStaffAccounts(data?.staffMembers);
    return clean;
  }

  return {
    ...data,
    cleanVersion: DATA_CLEAN_VERSION,
    medicines: Array.isArray(data.medicines) ? data.medicines : [],
    suppliers: Array.isArray(data.suppliers) ? data.suppliers : [],
    customers: Array.isArray(data.customers) ? data.customers : [],
    sales: Array.isArray(data.sales) ? data.sales : [],
    saleReturns: Array.isArray(data.saleReturns) ? data.saleReturns : [],
    purchases: Array.isArray(data.purchases) ? data.purchases : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    adjustments: Array.isArray(data.adjustments) ? data.adjustments : [],
    auditLogs: Array.isArray(data.auditLogs) ? data.auditLogs : [],
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    staffMembers: sanitizeStaffAccounts(data.staffMembers),
    lastUpdated: data.lastUpdated || new Date().toISOString(),
  };
}

// Optional MongoDB Atlas Cloud Persistence (auto-enabled when MONGODB_URI is set on Hostinger)
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

    // Also mirror key collections so they are directly inspectable in MongoDB Atlas Data Explorer
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
      console.log('Synchronized clean state from MongoDB Atlas.');
    } else {
      const currentLocal = readDatabase();
      await syncCollectionsToMongo(currentLocal);
      console.log('Seeded clean pharmacy database to MongoDB Atlas.');
    }
  } catch (err: any) {
    mongoConnected = false;
    mongoErrorMsg = err?.message || 'Connection error';
    console.error('MongoDB Atlas connection warning (using local disk database fallback):', err);
  }
}

function writeLocalFileOnly(data: DatabaseSchema): void {
  data.cleanVersion = DATA_CLEAN_VERSION;
  data.lastUpdated = new Date().toISOString();
  const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Failed atomic write to database:', err);
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }
}

// Read database from disk with fallback
function readDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.cleanVersion === DATA_CLEAN_VERSION) {
        const sanitized = sanitizeDatabaseState(parsed);
        return sanitized;
      }
    }
  } catch (err) {
    console.error('Error reading pharmacy_database.json:', err);
  }

  const initial = getInitialDatabase();
  writeDatabase(initial);
  return initial;
}

// Atomic file write + automatic MongoDB Atlas cloud sync
function writeDatabase(data: DatabaseSchema): void {
  const clean = sanitizeDatabaseState(data);
  writeLocalFileOnly(clean);
  if (mongoCollection && mongoConnected) {
    syncCollectionsToMongo(clean);
  }
}

// Create a snapshot backup file
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
  const PORT = process.env.PORT || 3000;

  app.use((req: Request, res: Response, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: '15mb' }));

  // Ensure initial database exists on startup and connect MongoDB Atlas if MONGODB_URI is provided
  readDatabase();
  await initMongoDB();

  // -------------------------------------------------------------
  // REST API ENDPOINTS
  // -------------------------------------------------------------

  // GET /api/db-status: Live diagnostic info on where the database is currently stored
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
        localFilePath: 'data/pharmacy_database.json',
        lastUpdated: db.lastUpdated,
        counts: {
          staffAccounts: db.staffMembers.length,
          medicines: db.medicines.length,
          sales: db.sales.length,
          purchases: db.purchases.length,
          suppliers: db.suppliers.length,
          customers: db.customers.length,
          expenses: db.expenses.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/db-sync-now: Force immediate write to both Server Disk and Hostinger MongoDB Atlas
  app.post('/api/db-sync-now', async (_req: Request, res: Response) => {
    try {
      const db = readDatabase();
      writeLocalFileOnly(db);
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

  // Helper to merge collections by ID so neither Owner nor Staff sessions overwrite records added by the other
  function mergeCollectionById<T extends { id: string }>(existingArr: T[] = [], incomingArr: T[] = []): T[] {
    const map = new Map<string, T>();
    if (Array.isArray(existingArr)) {
      existingArr.forEach(item => {
        if (item && item.id) map.set(item.id, item);
      });
    }
    if (Array.isArray(incomingArr)) {
      incomingArr.forEach(item => {
        if (item && item.id) map.set(item.id, item);
      });
    }
    return Array.from(map.values());
  }

  // GET /api/state: Full database state (merged with MongoDB Atlas if connected)
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

  // POST /api/sync: Synchronize state from client by merging records across Owner & Staff accounts
  app.post('/api/sync', async (req: Request, res: Response) => {
    try {
      const incoming = req.body;
      if (!incoming || !Array.isArray(incoming.medicines)) {
        return res.status(400).json({ success: false, error: 'Invalid state payload' });
      }

      const existingDb = await readLatestDatabaseWithMongo();

      const mergedStaff = incoming.forceStaffReplace
        ? incoming.staffMembers
        : mergeCollectionById(existingDb.staffMembers, incoming.staffMembers);

      const mergedMedicines = incoming.forceMedicineReplace
        ? incoming.medicines
        : mergeCollectionById(existingDb.medicines, incoming.medicines);

      const nextDb: DatabaseSchema = {
        ...existingDb,
        ...incoming,
        cleanVersion: DATA_CLEAN_VERSION,
        medicines: mergedMedicines,
        suppliers: mergeCollectionById(existingDb.suppliers, incoming.suppliers),
        customers: mergeCollectionById(existingDb.customers, incoming.customers),
        sales: mergeCollectionById(existingDb.sales, incoming.sales),
        saleReturns: mergeCollectionById(existingDb.saleReturns, incoming.saleReturns),
        purchases: mergeCollectionById(existingDb.purchases, incoming.purchases),
        expenses: mergeCollectionById(existingDb.expenses, incoming.expenses),
        adjustments: mergeCollectionById(existingDb.adjustments, incoming.adjustments),
        staffMembers: sanitizeStaffAccounts(mergedStaff),
        lastUpdated: new Date().toISOString(),
      };

      writeDatabase(nextDb);
      res.json({
        success: true,
        storageEngine: mongoConnected ? 'mongodb_atlas' : 'local_disk',
        message: 'Database state updated and persisted',
        staffCount: nextDb.staffMembers.length,
        medicineCount: nextDb.medicines.length,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/sale: Complete sale with atomic batch deduction & audit log
  app.post('/api/sale', (req: Request, res: Response) => {
    try {
      const sale = req.body;
      if (!sale || !sale.items || sale.items.length === 0) {
        return res.status(400).json({ success: false, error: 'Cart items cannot be empty' });
      }

      const db = readDatabase();

      // Check for duplicate invoice number
      if (db.sales.some(s => s.invoiceNumber === sale.invoiceNumber)) {
        return res.status(409).json({ success: false, error: 'Duplicate invoice number' });
      }

      // Revalidate stock and deduct from batches
      for (const item of sale.items) {
        const med = db.medicines.find(m => m.id === item.medicineId);
        if (!med) {
          return res.status(404).json({ success: false, error: `Medicine ${item.medicineName} not found` });
        }

        const batch = med.batches.find(b => b.id === item.batchId);
        if (!batch) {
          return res.status(404).json({ success: false, error: `Batch ${item.batchNumber} not found` });
        }

        if (batch.quantity < item.quantity) {
          return res.status(400).json({
            success: false,
            error: `Insufficient stock in batch ${batch.batchNumber} for ${med.name}. Available: ${batch.quantity}, Requested: ${item.quantity}`,
          });
        }

        batch.quantity -= item.quantity;
        med.totalQuantity = med.batches.reduce((sum, b) => sum + b.quantity, 0);
      }

      // Save sale
      db.sales.unshift(sale);

      // Add audit log
      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'SALE_COMPLETED',
        description: `Dispensed invoice ${sale.invoiceNumber} for Rs. ${sale.grandTotal} via ${sale.paymentMethod}`,
        userId: sale.staffId || 'system',
        userName: sale.staffName || 'Staff Cashier',
        userRole: 'staff',
        timestamp: new Date().toISOString(),
      });

      writeDatabase(db);
      res.json({ success: true, sale });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/purchase: Record supplier purchase and stock inflow
  app.post('/api/purchase', (req: Request, res: Response) => {
    try {
      const purchase = req.body;
      if (!purchase || !purchase.items || purchase.items.length === 0) {
        return res.status(400).json({ success: false, error: 'Purchase items required' });
      }

      const db = readDatabase();
      db.purchases.unshift(purchase);

      // Update batches and stock
      for (const pItem of purchase.items) {
        const med = db.medicines.find(m => m.id === pItem.medicineId);
        if (med) {
          const existingBatch = med.batches.find(b => b.batchNumber === pItem.batchNumber);
          if (existingBatch) {
            existingBatch.quantity += pItem.quantity;
            existingBatch.purchasePrice = pItem.purchasePrice;
            existingBatch.salePrice = pItem.salePrice;
          } else {
            med.batches.push({
              id: `bat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              medicineId: med.id,
              batchNumber: pItem.batchNumber,
              purchasePrice: pItem.purchasePrice,
              salePrice: pItem.salePrice,
              quantity: pItem.quantity,
              initialQuantity: pItem.quantity,
              mfgDate: pItem.mfgDate,
              expiryDate: pItem.expiryDate,
              supplierId: purchase.supplierId,
              supplierName: purchase.supplierName,
              receivedDate: purchase.purchaseDate,
            });
          }
          med.totalQuantity = med.batches.reduce((sum, b) => sum + b.quantity, 0);
        }
      }

      // Add audit log
      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'PURCHASE_RECORDED',
        description: `Received PO ${purchase.purchaseNumber} from ${purchase.supplierName} (Rs. ${purchase.totalAmount})`,
        userId: 'admin',
        userName: purchase.receivedBy || 'Store Owner',
        userRole: 'admin',
        timestamp: new Date().toISOString(),
      });

      writeDatabase(db);
      res.json({ success: true, purchase });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/medicine: Register new medicine
  app.post('/api/medicine', (req: Request, res: Response) => {
    try {
      const medicine = req.body;
      const db = readDatabase();
      db.medicines.unshift(medicine);

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'MEDICINE_CREATED',
        description: `Registered formulation ${medicine.name} (${medicine.strength})`,
        userId: 'admin',
        userName: 'Store Owner',
        userRole: 'admin',
        timestamp: new Date().toISOString(),
      });

      writeDatabase(db);
      res.json({ success: true, medicine });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT /api/medicine/:id: Update medicine
  app.put('/api/medicine/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db = readDatabase();
      const index = db.medicines.findIndex(m => m.id === id);

      if (index === -1) {
        return res.status(404).json({ success: false, error: 'Medicine not found' });
      }

      db.medicines[index] = { ...db.medicines[index], ...updates };

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'MEDICINE_UPDATED',
        description: `Updated medicine ${db.medicines[index].name}`,
        userId: 'admin',
        userName: 'Store Owner',
        userRole: 'admin',
        timestamp: new Date().toISOString(),
      });

      writeDatabase(db);
      res.json({ success: true, medicine: db.medicines[index] });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/medicine/:id: Delete medicine with audit log
  app.delete('/api/medicine/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const db = readDatabase();
      const target = db.medicines.find(m => m.id === id);

      if (!target) {
        return res.status(404).json({ success: false, error: 'Medicine not found' });
      }

      db.medicines = db.medicines.filter(m => m.id !== id);

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: 'MEDICINE_DELETED',
        description: `Removed medicine formulation ${target.name}`,
        userId: 'admin',
        userName: 'Store Owner',
        userRole: 'admin',
        timestamp: new Date().toISOString(),
      });

      writeDatabase(db);
      res.json({ success: true, message: 'Medicine deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/backups: List available backup snapshots
  app.get('/api/backups', (_req: Request, res: Response) => {
    try {
      const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
      const snapshots = files.map(file => {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          id: file.replace('.json', ''),
          filename: file,
          timestamp: stats.mtime.toISOString(),
          sizeBytes: stats.size,
        };
      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({ success: true, snapshots });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/backups: Create an instant backup snapshot
  app.post('/api/backups', (req: Request, res: Response) => {
    try {
      const { comment } = req.body || {};
      const result = createBackupSnapshot(comment);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/backups/restore: Restore database from snapshot
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

      // Create pre-restore safety snapshot of current state
      createBackupSnapshot('Auto safety snapshot before restore');

      writeDatabase(snapshotData);
      res.json({ success: true, message: 'Database restored successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Helper to read latest database state merging local disk + MongoDB Atlas staff_accounts
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

      const mergedDb: DatabaseSchema = {
        ...(stateDoc?.state || {}),
        ...localDb,
        medicines:
          localDb.medicines.length >= (stateDoc?.state?.medicines?.length || 0)
            ? localDb.medicines
            : stateDoc.state.medicines,
        staffMembers: sanitizeStaffAccounts(Array.from(mergedStaffMap.values())),
      };
      writeLocalFileOnly(mergedDb);
      return mergedDb;
    } catch {
      return localDb;
    }
  }

  // GET /api/staff: Get all staff accounts from database (local + MongoDB Atlas)
  app.get('/api/staff', async (_req: Request, res: Response) => {
    try {
      const db = await readLatestDatabaseWithMongo();
      res.json({ success: true, staffMembers: db.staffMembers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/staff: Create new staff account and persist immediately to Disk + MongoDB Atlas
  app.post('/api/staff', async (req: Request, res: Response) => {
    try {
      const newStaff = req.body;
      if (!newStaff || !newStaff.username || !newStaff.fullName) {
        return res.status(400).json({ success: false, error: 'Full name and username are required' });
      }

      const db = await readLatestDatabaseWithMongo();
      const cleanUsername = String(newStaff.username).trim().toLowerCase().replace(/^@/, '');

      const existingIdx = db.staffMembers.findIndex(
        u => u.id === newStaff.id || u.username.toLowerCase() === cleanUsername
      );

      const userToSave = {
        ...newStaff,
        id: existingIdx >= 0 ? db.staffMembers[existingIdx].id : newStaff.id || `usr-staff-${Date.now()}`,
        username: cleanUsername,
        password: String(newStaff.password || 'seller123').trim(),
        pin: String(newStaff.pin || '5678').trim(),
        status: newStaff.status || 'active',
        joiningDate: newStaff.joiningDate || new Date().toISOString().split('T')[0],
      };

      if (existingIdx >= 0) {
        db.staffMembers[existingIdx] = userToSave;
      } else {
        db.staffMembers.push(userToSave);
      }

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

      writeDatabase(db);
      if (mongoConnected) {
        await syncCollectionsToMongo(db);
      }

      res.json({ success: true, user: userToSave, staffMembers: db.staffMembers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT /api/staff/:id: Update staff account and persist immediately
  app.put('/api/staff/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db = await readLatestDatabaseWithMongo();
      const idx = db.staffMembers.findIndex(u => u.id === id);

      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Staff account not found' });
      }

      db.staffMembers[idx] = { ...db.staffMembers[idx], ...updates };
      db.staffMembers = sanitizeStaffAccounts(db.staffMembers);

      writeDatabase(db);
      if (mongoConnected) {
        await syncCollectionsToMongo(db);
      }
      res.json({ success: true, user: db.staffMembers[idx], staffMembers: db.staffMembers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/staff/:id: Delete a staff account (or 'all-others' to clear non-owner accounts)
  app.delete('/api/staff/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const db = await readLatestDatabaseWithMongo();

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
        if (mongoClientInstance && mongoConnected) {
          await mongoClientInstance
            .db(MONGO_DB_NAME)
            .collection('staff_accounts')
            .deleteOne({ id });
        }
      }

      writeDatabase(db);
      if (mongoConnected) {
        await syncCollectionsToMongo(db);
      }
      res.json({ success: true, staffMembers: db.staffMembers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/auth/login: Username + Password login verification against server + MongoDB database
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body || {};
      if (!username) {
        return res.status(400).json({ success: false, error: 'Username is required' });
      }

      const rawInput = String(username).trim().toLowerCase().replace(/^@/, '');
      const cleanCompact = rawInput.replace(/\s+/g, '');
      const cleanPass = String(password || '').trim();
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
      if (expectedPassword && cleanPass !== expectedPassword) {
        return res.status(401).json({
          success: false,
          error:
            user.id === 'usr-owner-1'
              ? 'Invalid password for Owner account.'
              : `Incorrect password for @${user.username}.`,
        });
      }

      res.json({ success: true, user, staffMembers: db.staffMembers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/auth/pin-login: PIN Keypad login verification (Strictly for Staff accounts)
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
    // Production static serving (Hostinger / Cloud)
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, () => {
    console.log(`PharmaCare ERP & POS server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
