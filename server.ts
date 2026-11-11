/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, Collection } from 'mongodb';
import { createServer as createViteServer } from 'vite';
import {
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

// Optional MongoDB Atlas Cloud Persistence (auto-enabled when MONGODB_URI is set on Hostinger)
const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  (process.env.DATABASE_URL?.startsWith('mongodb') ? process.env.DATABASE_URL : '');

let mongoCollection: Collection<any> | null = null;
let mongoConnected = false;

async function initMongoDB(): Promise<void> {
  if (!MONGODB_URI) return;
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'pharmacare_erp');
    mongoCollection = db.collection('pharmacy_store_state');
    mongoConnected = true;
    console.log('Connected to MongoDB Atlas cloud database successfully.');

    // Load existing cloud state onto local disk cache if present, or seed cloud from local disk
    const existingDoc = await mongoCollection.findOne({ _id: 'primary_store_state' });
    if (existingDoc && existingDoc.state && existingDoc.state.medicines) {
      const cloudState = existingDoc.state as DatabaseSchema;
      cloudState.staffMembers = sanitizeStaffAccounts(cloudState.staffMembers);
      writeLocalFileOnly(cloudState);
      console.log('Synchronized state from MongoDB Atlas.');
    } else {
      const currentLocal = readDatabase();
      await mongoCollection.updateOne(
        { _id: 'primary_store_state' },
        { $set: { state: currentLocal, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      console.log('Seeded initial pharmacy database to MongoDB Atlas.');
    }
  } catch (err) {
    console.error('MongoDB Atlas connection warning (using local disk database fallback):', err);
  }
}

// Initial Database Seeder
function getInitialDatabase(): DatabaseSchema {
  return {
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

function writeLocalFileOnly(data: DatabaseSchema): void {
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
      const data = JSON.parse(raw);
      if (data && data.medicines && data.sales) {
        const sanitizedStaff = sanitizeStaffAccounts(data.staffMembers);
        if (JSON.stringify(data.staffMembers) !== JSON.stringify(sanitizedStaff)) {
          data.staffMembers = sanitizedStaff;
          writeDatabase(data);
        }
        return data;
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
  writeLocalFileOnly(data);
  if (mongoCollection && mongoConnected) {
    mongoCollection
      .updateOne(
        { _id: 'primary_store_state' },
        { $set: { state: data, updatedAt: data.lastUpdated } },
        { upsert: true }
      )
      .catch(err => console.error('Failed to sync state to MongoDB Atlas:', err));
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

  app.use(express.json({ limit: '15mb' }));

  // Ensure initial database exists on startup and connect MongoDB Atlas if MONGODB_URI is provided
  readDatabase();
  await initMongoDB();

  // -------------------------------------------------------------
  // REST API ENDPOINTS
  // -------------------------------------------------------------

  // GET /api/state: Full database state
  app.get('/api/state', (_req: Request, res: Response) => {
    try {
      const db = readDatabase();
      res.json({
        success: true,
        storageEngine: mongoConnected ? 'mongodb_atlas' : 'local_disk',
        data: db,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/sync: Bulk synchronize or update state from client
  app.post('/api/sync', (req: Request, res: Response) => {
    try {
      const incoming = req.body;
      if (!incoming || !incoming.medicines) {
        return res.status(400).json({ success: false, error: 'Invalid state payload' });
      }

      incoming.staffMembers = sanitizeStaffAccounts(incoming.staffMembers);
      writeDatabase(incoming);
      res.json({ success: true, message: 'Database state updated and persisted to disk' });
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

  // POST /api/auth/pin-login: PIN Keypad login verification
  app.post('/api/auth/pin-login', (req: Request, res: Response) => {
    try {
      const { pin, username } = req.body;
      if (!pin) {
        return res.status(400).json({ success: false, error: 'PIN is required' });
      }

      const db = readDatabase();
      const user = db.staffMembers.find(u => {
        const matchesPin = u.pin === pin || (!u.pin && pin === '1234');
        if (username) {
          return matchesPin && (u.username.toLowerCase() === username.toLowerCase() || u.fullName.toLowerCase() === username.toLowerCase());
        }
        return matchesPin;
      });

      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid 4-digit PIN' });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Account is deactivated' });
      }

      res.json({ success: true, user });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // VITE DEV SERVER INTEGRATION (Dev Mode on port 3000)
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(__dirname, 'dist');
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
