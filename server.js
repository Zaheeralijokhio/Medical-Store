var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server.ts
import express from "express";
import http from "http";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

// src/data/initialData.ts
var DATA_CLEAN_VERSION = "pharmacare_clean_v3";
var INITIAL_SETTINGS = {
  storeName: "PharmaCare Medical & General Store",
  storeTagline: "Quality Medicines \u2022 Licensed Pharmacist on Duty \u2022 24/7 Service",
  storeLogoUrl: "",
  storeAddress: "Main Commercial Market",
  city: "Pakistan",
  phone: "",
  email: "admin@pharmacare.pk",
  drugLicenseNumber: "DRAP-LIC-0001",
  taxRegistrationNumber: "",
  currency: "PKR",
  currencySymbol: "Rs.",
  timezone: "Asia/Karachi",
  taxRatePercentage: 0,
  lowStockThresholdDefault: 20,
  expiryAlertDays: 90,
  invoiceHeader: "COMPUTERIZED PHARMACY CASH MEMO",
  invoiceFooter: "Medicines once sold will not be returned without cash memo within 7 days. Cold chain products & cut strips non-returnable.",
  allowStaffDiscounts: true,
  maxStaffDiscountPercentage: 10,
  businessOpeningHours: "08:00 AM",
  businessClosingHours: "12:00 AM (Midnight)"
};
var OWNER_ACCOUNT = {
  id: "usr-owner-1",
  username: "admin",
  fullName: "Dr. Abdul Rehman (Owner)",
  email: "admin@pharmacare.pk",
  phone: "",
  role: "admin",
  pin: "1234",
  password: "admin",
  designation: "Store Owner & Administrator",
  status: "active",
  joiningDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
  permissions: {
    canMakeSales: true,
    canViewInventory: true,
    canAddCustomer: true,
    canViewReports: true,
    canAdjustStock: true,
    canManagePurchases: true,
    canModifyPrices: true
  }
};
var LEGACY_DEMO_USER_IDS = /* @__PURE__ */ new Set([
  "usr-admin-1",
  "usr-pharm-1",
  "usr-staff-1",
  "usr-staff-2"
]);
function sanitizeStaffAccounts(users2) {
  if (!Array.isArray(users2) || users2.length === 0) {
    return [OWNER_ACCOUNT];
  }
  const byUsername = /* @__PURE__ */ new Map();
  for (const u of users2) {
    if (u && u.id && u.id !== OWNER_ACCOUNT.id && !LEGACY_DEMO_USER_IDS.has(u.id)) {
      const uname = String(u.username || u.id).trim().toLowerCase().replace(/^@/, "");
      if (uname && uname !== "admin") {
        byUsername.set(uname, {
          ...u,
          username: uname,
          status: u.status || "active",
          pin: u.pin || "5678",
          password: u.password || "seller123"
        });
      }
    }
  }
  const customStaff = Array.from(byUsername.values());
  const existingOwner = users2.find((u) => u && u.id === OWNER_ACCOUNT.id);
  const ownerToUse = existingOwner ? {
    ...OWNER_ACCOUNT,
    ...existingOwner,
    id: OWNER_ACCOUNT.id,
    username: "admin",
    password: existingOwner.password === "password123" ? "admin" : existingOwner.password || "admin",
    role: "admin",
    status: "active",
    permissions: OWNER_ACCOUNT.permissions
  } : OWNER_ACCOUNT;
  return [ownerToUse, ...customStaff];
}
var INITIAL_USERS = [OWNER_ACCOUNT];
var INITIAL_SUPPLIERS = [];
var INITIAL_CUSTOMERS = [];
var INITIAL_MEDICINES = [];
var INITIAL_EXPENSES = [];
var INITIAL_SALES = [];
var INITIAL_PURCHASES = [];
var INITIAL_ADJUSTMENTS = [];
var INITIAL_AUDIT_LOGS = [];
var INITIAL_NOTIFICATIONS = [];

// src/lib/firebase-admin.ts
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "probable-apparatus-7cbh2",
  appId: "1:452503122064:web:d89b58fa8b9f800756e815",
  apiKey: "AIzaSyBOYzaLMz2iHRqhVflebzEQLLN4L2grSw4",
  authDomain: "probable-apparatus-7cbh2.firebaseapp.com",
  storageBucket: "probable-apparatus-7cbh2.firebasestorage.app",
  messagingSenderId: "452503122064",
  measurementId: "",
  oAuthClientId: "452503122064-gav1smj4mr551k6k9kaqt40efmlfrb9d.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// src/lib/firebase-admin.ts
if (!getApps().length) {
  initializeApp({
    projectId: firebase_applet_config_default.projectId
  });
}
var adminAuth = getAuth();

// src/middleware/auth.ts
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
}

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  auditLogs: () => auditLogs,
  cashMemos: () => cashMemos,
  customers: () => customers,
  expenses: () => expenses,
  medicineCategories: () => medicineCategories,
  medicines: () => medicines,
  payments: () => payments,
  purchaseItems: () => purchaseItems,
  purchases: () => purchases,
  saleItems: () => saleItems,
  sales: () => sales,
  staffMembers: () => staffMembers,
  staffPermissions: () => staffPermissions,
  stockTransactions: () => stockTransactions,
  storeSettings: () => storeSettings,
  stores: () => stores,
  suppliers: () => suppliers,
  users: () => users
});
import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb
} from "drizzle-orm/pg-core";
var stores = pgTable("stores", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  drugLicenseNumber: text("drug_license_number"),
  taxRegistrationNumber: text("tax_registration_number"),
  address: text("address"),
  city: text("city"),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  photoUrl: text("photo_url"),
  storeId: text("store_id").default("store-1"),
  role: text("role").default("Cashier / Seller"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var staffMembers = pgTable("staff_members", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  password: text("password"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("Cashier / Seller"),
  phone: text("phone"),
  email: text("email"),
  cnic: text("cnic"),
  joiningDate: text("joining_date"),
  salary: numeric("salary", { precision: 12, scale: 2 }).default("0"),
  status: text("status").notNull().default("active"),
  lastLogin: text("last_login"),
  permissions: jsonb("permissions").default({}),
  createdBy: text("created_by").default("usr-owner-1"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var staffPermissions = pgTable("staff_permissions", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  role: text("role").notNull(),
  pos: boolean("pos").default(true),
  inventoryView: boolean("inventory_view").default(true),
  inventoryEdit: boolean("inventory_edit").default(false),
  purchases: boolean("purchases").default(false),
  salesHistory: boolean("sales_history").default(true),
  customers: boolean("customers").default(true),
  suppliers: boolean("suppliers").default(false),
  expenses: boolean("expenses").default(false),
  reports: boolean("reports").default(false),
  staff: boolean("staff").default(false),
  settings: boolean("settings").default(false)
});
var medicineCategories = pgTable("medicine_categories", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by").default("usr-owner-1"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var suppliers = pgTable("suppliers", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  ntnOrGstNumber: text("ntn_or_gst_number"),
  paymentTerms: text("payment_terms").default("Cash"),
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).default("0"),
  outstandingBalance: numeric("outstanding_balance", { precision: 12, scale: 2 }).default("0"),
  createdBy: text("created_by").default("usr-owner-1"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var customers = pgTable("customers", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  cnicOrNotes: text("cnic_or_notes"),
  creditBalance: numeric("credit_balance", { precision: 12, scale: 2 }).default("0"),
  totalPurchasesCount: integer("total_purchases_count").default(0),
  totalSpent: numeric("total_spent", { precision: 12, scale: 2 }).default("0"),
  lastVisit: text("last_visit"),
  createdBy: text("created_by").default("usr-owner-1"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var medicines = pgTable("medicines", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  brandManufacturer: text("brand_manufacturer"),
  category: text("category").notNull(),
  dosageForm: text("dosage_form").default("Tablet"),
  strength: text("strength"),
  unitType: text("unit_type").default("Pack"),
  unitsPerPack: integer("units_per_pack").default(10),
  rackLocation: text("rack_location"),
  minimumStockThreshold: integer("minimum_stock_threshold").default(15),
  prescriptionRequired: boolean("prescription_required").default(false),
  taxPercentage: numeric("tax_percentage", { precision: 5, scale: 2 }).default("0"),
  batches: jsonb("batches").default([]),
  totalQuantity: integer("total_quantity").default(0),
  notes: text("notes"),
  createdBy: text("created_by").default("usr-owner-1"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var purchases = pgTable("purchases", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  purchaseOrderNumber: text("purchase_order_number").notNull(),
  supplierInvoiceNumber: text("supplier_invoice_number"),
  supplierId: text("supplier_id").notNull(),
  supplierName: text("supplier_name").notNull(),
  purchaseDate: text("purchase_date").notNull(),
  items: jsonb("items").default([]),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0"),
  discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).default("0"),
  taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).default("0"),
  shippingCharges: numeric("shipping_charges", { precision: 12, scale: 2 }).default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).default("0"),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).default("0"),
  balanceDue: numeric("balance_due", { precision: 12, scale: 2 }).default("0"),
  paymentStatus: text("payment_status").default("Paid"),
  paymentMethod: text("payment_method").default("Cash"),
  notes: text("notes"),
  createdBy: text("created_by").default("usr-owner-1"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var purchaseItems = pgTable("purchase_items", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  purchaseId: text("purchase_id").notNull(),
  medicineId: text("medicine_id").notNull(),
  medicineName: text("medicine_name").notNull(),
  batchNumber: text("batch_number").notNull(),
  expiryDate: text("expiry_date").notNull(),
  quantity: integer("quantity").notNull(),
  bonusQuantity: integer("bonus_quantity").default(0),
  purchasePricePerUnit: numeric("purchase_price_per_unit", { precision: 12, scale: 2 }).default("0"),
  sellingPricePerUnit: numeric("selling_price_per_unit", { precision: 12, scale: 2 }).default("0"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).default("0"),
  taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).default("0"),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).default("0")
});
var sales = pgTable("sales", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  invoiceNumber: text("invoice_number").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  customerId: text("customer_id"),
  customerName: text("customer_name").default("Walk-in Customer"),
  customerPhone: text("customer_phone"),
  doctorName: text("doctor_name"),
  prescriptionNumber: text("prescription_number"),
  staffId: text("staff_id").notNull(),
  staffName: text("staff_name").notNull(),
  items: jsonb("items").default([]),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0"),
  discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).default("0"),
  taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).default("0"),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).default("0"),
  netProfit: numeric("net_profit", { precision: 12, scale: 2 }).default("0"),
  paymentMethod: text("payment_method").default("Cash"),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).default("0"),
  changeGiven: numeric("change_given", { precision: 12, scale: 2 }).default("0"),
  status: text("status").default("completed"),
  createdBy: text("created_by").default("usr-owner-1"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var saleItems = pgTable("sale_items", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  saleId: text("sale_id").notNull(),
  medicineId: text("medicine_id").notNull(),
  medicineName: text("medicine_name").notNull(),
  genericName: text("generic_name"),
  strength: text("strength"),
  dosageForm: text("dosage_form"),
  batchId: text("batch_id"),
  batchNumber: text("batch_number"),
  expiryDate: text("expiry_date"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0"),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }).default("0"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).default("0"),
  taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0"),
  netTotal: numeric("net_total", { precision: 12, scale: 2 }).default("0")
});
var stockTransactions = pgTable("stock_transactions", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  date: text("date").notNull(),
  medicineId: text("medicine_id").notNull(),
  medicineName: text("medicine_name").notNull(),
  batchId: text("batch_id"),
  batchNumber: text("batch_number"),
  type: text("type").notNull(),
  quantityChange: integer("quantity_change").notNull(),
  previousQuantity: integer("previous_quantity").default(0),
  newQuantity: integer("new_quantity").default(0),
  referenceId: text("reference_id"),
  notes: text("notes"),
  createdBy: text("created_by").default("usr-owner-1"),
  createdByName: text("created_by_name")
});
var expenses = pgTable("expenses", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  date: text("date").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").default("Cash"),
  referenceNumber: text("reference_number"),
  addedBy: text("added_by").notNull(),
  createdBy: text("created_by").default("usr-owner-1"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var payments = pgTable("payments", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  date: text("date").notNull(),
  type: text("type").notNull(),
  partyId: text("party_id").notNull(),
  partyName: text("party_name").notNull(),
  referenceId: text("reference_id"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").default("Cash"),
  notes: text("notes"),
  createdBy: text("created_by").default("usr-owner-1"),
  createdByName: text("created_by_name")
});
var cashMemos = pgTable("cash_memos", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  saleId: text("sale_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  createdBy: text("created_by").notNull(),
  createdByName: text("created_by_name").notNull(),
  customerId: text("customer_id"),
  customerName: text("customer_name").default("Walk-in Customer"),
  customerPhone: text("customer_phone"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0"),
  discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).default("0"),
  taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).default("0"),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).default("0"),
  changeGiven: numeric("change_given", { precision: 12, scale: 2 }).default("0"),
  paymentMethod: text("payment_method").default("Cash"),
  itemsCount: integer("items_count").default(0),
  status: text("status").default("completed")
});
var auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().default("store-1"),
  timestamp: text("timestamp").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  action: text("action").notNull(),
  module: text("module").notNull(),
  details: text("details").notNull()
});
var storeSettings = pgTable("store_settings", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().unique().default("store-1"),
  storeName: text("store_name").notNull(),
  tagline: text("tagline"),
  drugLicenseNumber: text("drug_license_number"),
  taxRegistrationNumber: text("tax_registration_number"),
  storeAddress: text("store_address"),
  city: text("city"),
  phone: text("phone"),
  email: text("email"),
  currencySymbol: text("currency_symbol").default("Rs."),
  defaultTaxRate: numeric("default_tax_rate", { precision: 5, scale: 2 }).default("0"),
  lowStockAlertDefault: integer("low_stock_alert_default").default(15),
  expiryWarningDays: integer("expiry_warning_days").default(90),
  invoicePrefix: text("invoice_prefix").default("INV-"),
  receiptFooterNote: text("receipt_footer_note"),
  printerPaperSize: text("printer_paper_size").default("80mm"),
  stateSnapshot: jsonb("state_snapshot"),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// src/db/index.ts
var pool = new Pool({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DB_NAME,
  max: 10,
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 15e3,
  keepAlive: true
});
pool.on("error", (err) => {
  console.warn("[Database Pool]: Idle connection closed by server, will reconnect on next query:", err.message);
});
var db = drizzle(pool, { schema: schema_exports });

// src/db/users.ts
async function getOrCreateUser(decodedToken) {
  const { uid, email, name, picture } = decodedToken;
  if (!email) {
    throw new Error("Email is required inside the auth token");
  }
  try {
    const [user] = await db.insert(users).values({
      id: uid,
      email,
      displayName: name || null,
      photoUrl: picture || null
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        email,
        displayName: name || null,
        photoUrl: picture || null,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return user;
  } catch (error) {
    console.error("[Database Error]:", {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    throw new Error("Failed to synchronize user account");
  }
}

// src/db/pharmacyStoreRepo.ts
import { eq } from "drizzle-orm";
var DEFAULT_STORE_ID = "store-1";
async function loadStateFromCloudSql() {
  if (!process.env.SQL_HOST) return null;
  try {
    const rows = await db.select().from(storeSettings).where(eq(storeSettings.storeId, DEFAULT_STORE_ID)).limit(1);
    if (rows.length > 0 && rows[0].stateSnapshot) {
      return rows[0].stateSnapshot;
    }
    return null;
  } catch (error) {
    console.error("[Database Error]:", {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    return null;
  }
}
async function syncStateToCloudSql(state) {
  if (!process.env.SQL_HOST || !state) return false;
  try {
    const s = state.settings || {};
    await db.insert(storeSettings).values({
      id: "settings-1",
      storeId: DEFAULT_STORE_ID,
      storeName: String(s.storeName || "PharmaCare Medical Store"),
      tagline: String(s.tagline || ""),
      drugLicenseNumber: String(s.drugLicenseNumber || ""),
      taxRegistrationNumber: String(s.taxRegistrationNumber || ""),
      storeAddress: String(s.storeAddress || ""),
      city: String(s.city || ""),
      phone: String(s.phone || ""),
      email: String(s.email || ""),
      currencySymbol: String(s.currencySymbol || "Rs."),
      defaultTaxRate: String(s.defaultTaxRate ?? 0),
      lowStockAlertDefault: Number(s.lowStockAlertDefault ?? 15),
      expiryWarningDays: Number(s.expiryWarningDays ?? 90),
      invoicePrefix: String(s.invoicePrefix || "INV-"),
      receiptFooterNote: String(s.receiptFooterNote || ""),
      printerPaperSize: String(s.printerPaperSize || "80mm"),
      stateSnapshot: state,
      updatedAt: /* @__PURE__ */ new Date()
    }).onConflictDoUpdate({
      target: storeSettings.id,
      set: {
        storeName: String(s.storeName || "PharmaCare Medical Store"),
        tagline: String(s.tagline || ""),
        drugLicenseNumber: String(s.drugLicenseNumber || ""),
        taxRegistrationNumber: String(s.taxRegistrationNumber || ""),
        storeAddress: String(s.storeAddress || ""),
        city: String(s.city || ""),
        phone: String(s.phone || ""),
        email: String(s.email || ""),
        currencySymbol: String(s.currencySymbol || "Rs."),
        defaultTaxRate: String(s.defaultTaxRate ?? 0),
        lowStockAlertDefault: Number(s.lowStockAlertDefault ?? 15),
        expiryWarningDays: Number(s.expiryWarningDays ?? 90),
        invoicePrefix: String(s.invoicePrefix || "INV-"),
        receiptFooterNote: String(s.receiptFooterNote || ""),
        printerPaperSize: String(s.printerPaperSize || "80mm"),
        stateSnapshot: state,
        updatedAt: /* @__PURE__ */ new Date()
      }
    });
    if (Array.isArray(state.stores) && state.stores.length > 0) {
      for (const st of state.stores) {
        await db.insert(stores).values({
          id: String(st.id || DEFAULT_STORE_ID),
          name: String(st.name || s.storeName || "PharmaCare Medical Store"),
          ownerId: String(st.ownerId || "usr-owner-1"),
          drugLicenseNumber: String(st.drugLicenseNumber || ""),
          taxRegistrationNumber: String(st.taxRegistrationNumber || ""),
          address: String(st.address || ""),
          city: String(st.city || ""),
          phone: String(st.phone || ""),
          email: String(st.email || "")
        }).onConflictDoUpdate({
          target: stores.id,
          set: {
            name: String(st.name || s.storeName || "PharmaCare Medical Store"),
            drugLicenseNumber: String(st.drugLicenseNumber || ""),
            taxRegistrationNumber: String(st.taxRegistrationNumber || ""),
            address: String(st.address || ""),
            city: String(st.city || ""),
            phone: String(st.phone || ""),
            email: String(st.email || "")
          }
        });
      }
    }
    if (Array.isArray(state.staffMembers)) {
      for (const u of state.staffMembers) {
        await db.insert(staffMembers).values({
          id: String(u.id),
          storeId: String(u.storeId || DEFAULT_STORE_ID),
          name: String(u.name || u.username),
          username: String(u.username),
          password: String(u.password || ""),
          passwordHash: String(u.passwordHash || ""),
          role: String(u.role || "Cashier / Seller"),
          phone: String(u.phone || ""),
          email: String(u.email || ""),
          cnic: String(u.cnic || ""),
          joiningDate: String(u.joiningDate || ""),
          salary: String(u.salary ?? 0),
          status: String(u.status || "active"),
          lastLogin: String(u.lastLogin || ""),
          permissions: u.permissions || {},
          createdBy: String(u.createdBy || "usr-owner-1")
        }).onConflictDoUpdate({
          target: staffMembers.id,
          set: {
            name: String(u.name || u.username),
            password: String(u.password || ""),
            passwordHash: String(u.passwordHash || ""),
            role: String(u.role || "Cashier / Seller"),
            phone: String(u.phone || ""),
            email: String(u.email || ""),
            status: String(u.status || "active"),
            lastLogin: String(u.lastLogin || ""),
            permissions: u.permissions || {}
          }
        });
      }
    }
    if (Array.isArray(state.categories)) {
      for (const cat of state.categories) {
        await db.insert(medicineCategories).values({
          id: String(cat.id),
          storeId: String(cat.storeId || DEFAULT_STORE_ID),
          name: String(cat.name),
          createdBy: String(cat.createdBy || "usr-owner-1")
        }).onConflictDoUpdate({
          target: medicineCategories.id,
          set: { name: String(cat.name) }
        });
      }
    }
    if (Array.isArray(state.medicines)) {
      for (const m of state.medicines) {
        await db.insert(medicines).values({
          id: String(m.id),
          storeId: String(m.storeId || DEFAULT_STORE_ID),
          name: String(m.name),
          genericName: String(m.genericName || ""),
          brandManufacturer: String(m.brandManufacturer || ""),
          category: String(m.category || "General"),
          dosageForm: String(m.dosageForm || "Tablet"),
          strength: String(m.strength || ""),
          unitType: String(m.unitType || "Pack"),
          unitsPerPack: Number(m.unitsPerPack ?? 10),
          rackLocation: String(m.rackLocation || ""),
          minimumStockThreshold: Number(m.minimumStockThreshold ?? 15),
          prescriptionRequired: Boolean(m.prescriptionRequired),
          taxPercentage: String(m.taxPercentage ?? 0),
          batches: Array.isArray(m.batches) ? m.batches : [],
          totalQuantity: Number(m.totalQuantity ?? 0),
          notes: String(m.notes || ""),
          createdBy: String(m.createdBy || "usr-owner-1")
        }).onConflictDoUpdate({
          target: medicines.id,
          set: {
            name: String(m.name),
            genericName: String(m.genericName || ""),
            brandManufacturer: String(m.brandManufacturer || ""),
            category: String(m.category || "General"),
            dosageForm: String(m.dosageForm || "Tablet"),
            strength: String(m.strength || ""),
            rackLocation: String(m.rackLocation || ""),
            minimumStockThreshold: Number(m.minimumStockThreshold ?? 15),
            batches: Array.isArray(m.batches) ? m.batches : [],
            totalQuantity: Number(m.totalQuantity ?? 0)
          }
        });
      }
    }
    if (Array.isArray(state.suppliers)) {
      for (const sup of state.suppliers) {
        await db.insert(suppliers).values({
          id: String(sup.id),
          storeId: String(sup.storeId || DEFAULT_STORE_ID),
          companyName: String(sup.companyName || ""),
          contactPerson: String(sup.contactPerson || ""),
          phone: String(sup.phone || ""),
          email: String(sup.email || ""),
          address: String(sup.address || ""),
          city: String(sup.city || ""),
          ntnOrGstNumber: String(sup.ntnOrGstNumber || ""),
          paymentTerms: String(sup.paymentTerms || "Cash"),
          openingBalance: String(sup.openingBalance ?? 0),
          outstandingBalance: String(sup.outstandingBalance ?? 0),
          createdBy: String(sup.createdBy || "usr-owner-1")
        }).onConflictDoUpdate({
          target: suppliers.id,
          set: {
            companyName: String(sup.companyName || ""),
            contactPerson: String(sup.contactPerson || ""),
            phone: String(sup.phone || ""),
            outstandingBalance: String(sup.outstandingBalance ?? 0)
          }
        });
      }
    }
    if (Array.isArray(state.customers)) {
      for (const cust of state.customers) {
        await db.insert(customers).values({
          id: String(cust.id),
          storeId: String(cust.storeId || DEFAULT_STORE_ID),
          name: String(cust.name || ""),
          phone: String(cust.phone || ""),
          address: String(cust.address || ""),
          cnicOrNotes: String(cust.cnicOrNotes || ""),
          creditBalance: String(cust.creditBalance ?? 0),
          totalPurchasesCount: Number(cust.totalPurchasesCount ?? 0),
          totalSpent: String(cust.totalSpent ?? 0),
          lastVisit: String(cust.lastVisit || ""),
          createdBy: String(cust.createdBy || "usr-owner-1")
        }).onConflictDoUpdate({
          target: customers.id,
          set: {
            name: String(cust.name || ""),
            phone: String(cust.phone || ""),
            address: String(cust.address || ""),
            creditBalance: String(cust.creditBalance ?? 0),
            totalPurchasesCount: Number(cust.totalPurchasesCount ?? 0),
            totalSpent: String(cust.totalSpent ?? 0),
            lastVisit: String(cust.lastVisit || "")
          }
        });
      }
    }
    if (Array.isArray(state.purchases)) {
      for (const p of state.purchases) {
        await db.insert(purchases).values({
          id: String(p.id),
          storeId: String(p.storeId || DEFAULT_STORE_ID),
          purchaseOrderNumber: String(p.purchaseOrderNumber || ""),
          supplierInvoiceNumber: String(p.supplierInvoiceNumber || ""),
          supplierId: String(p.supplierId || ""),
          supplierName: String(p.supplierName || ""),
          purchaseDate: String(p.purchaseDate || ""),
          items: Array.isArray(p.items) ? p.items : [],
          subtotal: String(p.subtotal ?? 0),
          discountTotal: String(p.discountTotal ?? 0),
          taxTotal: String(p.taxTotal ?? 0),
          shippingCharges: String(p.shippingCharges ?? 0),
          grandTotal: String(p.grandTotal ?? 0),
          amountPaid: String(p.amountPaid ?? 0),
          balanceDue: String(p.balanceDue ?? 0),
          paymentStatus: String(p.paymentStatus || "Paid"),
          paymentMethod: String(p.paymentMethod || "Cash"),
          notes: String(p.notes || ""),
          createdBy: String(p.createdBy || "usr-owner-1")
        }).onConflictDoUpdate({
          target: purchases.id,
          set: {
            amountPaid: String(p.amountPaid ?? 0),
            balanceDue: String(p.balanceDue ?? 0),
            paymentStatus: String(p.paymentStatus || "Paid")
          }
        });
      }
    }
    if (Array.isArray(state.sales)) {
      for (const sl of state.sales) {
        await db.insert(sales).values({
          id: String(sl.id),
          storeId: String(sl.storeId || DEFAULT_STORE_ID),
          invoiceNumber: String(sl.invoiceNumber || ""),
          date: String(sl.date || ""),
          time: String(sl.time || ""),
          customerId: sl.customerId ? String(sl.customerId) : null,
          customerName: String(sl.customerName || "Walk-in Customer"),
          customerPhone: String(sl.customerPhone || ""),
          doctorName: String(sl.doctorName || ""),
          prescriptionNumber: String(sl.prescriptionNumber || ""),
          staffId: String(sl.staffId || "usr-owner-1"),
          staffName: String(sl.staffName || "Owner"),
          items: Array.isArray(sl.items) ? sl.items : [],
          subtotal: String(sl.subtotal ?? 0),
          discountTotal: String(sl.discountTotal ?? 0),
          taxTotal: String(sl.taxTotal ?? 0),
          grandTotal: String(sl.grandTotal ?? 0),
          totalCost: String(sl.totalCost ?? 0),
          netProfit: String(sl.netProfit ?? 0),
          paymentMethod: String(sl.paymentMethod || "Cash"),
          amountPaid: String(sl.amountPaid ?? 0),
          changeGiven: String(sl.changeGiven ?? 0),
          status: String(sl.status || "completed"),
          createdBy: String(sl.createdBy || sl.staffId || "usr-owner-1")
        }).onConflictDoUpdate({
          target: sales.id,
          set: {
            status: String(sl.status || "completed"),
            amountPaid: String(sl.amountPaid ?? 0)
          }
        });
      }
    }
    if (Array.isArray(state.expenses)) {
      for (const ex of state.expenses) {
        await db.insert(expenses).values({
          id: String(ex.id),
          storeId: String(ex.storeId || DEFAULT_STORE_ID),
          date: String(ex.date || ""),
          category: String(ex.category || "Miscellaneous"),
          description: String(ex.description || ""),
          amount: String(ex.amount ?? 0),
          paymentMethod: String(ex.paymentMethod || "Cash"),
          referenceNumber: String(ex.referenceNumber || ""),
          addedBy: String(ex.addedBy || "Owner"),
          createdBy: String(ex.createdBy || "usr-owner-1")
        }).onConflictDoUpdate({
          target: expenses.id,
          set: {
            category: String(ex.category || "Miscellaneous"),
            description: String(ex.description || ""),
            amount: String(ex.amount ?? 0),
            paymentMethod: String(ex.paymentMethod || "Cash")
          }
        });
      }
    }
    if (Array.isArray(state.cashMemos)) {
      for (const memo of state.cashMemos) {
        await db.insert(cashMemos).values({
          id: String(memo.id),
          storeId: String(memo.storeId || DEFAULT_STORE_ID),
          saleId: String(memo.saleId),
          invoiceNumber: String(memo.invoiceNumber),
          date: String(memo.date || ""),
          time: String(memo.time || ""),
          createdBy: String(memo.createdBy || "usr-owner-1"),
          createdByName: String(memo.createdByName || "Store Dispenser"),
          customerId: memo.customerId ? String(memo.customerId) : null,
          customerName: String(memo.customerName || "Walk-in Customer"),
          customerPhone: String(memo.customerPhone || ""),
          subtotal: String(memo.subtotal ?? 0),
          discountTotal: String(memo.discountTotal ?? 0),
          taxTotal: String(memo.taxTotal ?? 0),
          grandTotal: String(memo.grandTotal ?? 0),
          amountPaid: String(memo.amountPaid ?? 0),
          changeGiven: String(memo.changeGiven ?? 0),
          paymentMethod: String(memo.paymentMethod || "Cash"),
          itemsCount: Number(memo.itemsCount ?? 0),
          status: String(memo.status || "completed")
        }).onConflictDoUpdate({
          target: cashMemos.id,
          set: {
            status: String(memo.status || "completed")
          }
        });
      }
    }
    if (Array.isArray(state.auditLogs)) {
      for (const log of state.auditLogs.slice(0, 100)) {
        await db.insert(auditLogs).values({
          id: String(log.id),
          storeId: String(log.storeId || DEFAULT_STORE_ID),
          timestamp: String(log.timestamp || ""),
          userId: String(log.userId || "usr-owner-1"),
          userName: String(log.userName || "Owner"),
          userRole: String(log.userRole || "owner"),
          action: String(log.action || ""),
          module: String(log.module || "System"),
          details: String(log.details || "")
        }).onConflictDoNothing();
      }
    }
    return true;
  } catch (error) {
    console.error("[Database Error]:", {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    return false;
  }
}

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var DATA_DIR = path.join(__dirname, "data");
var BACKUPS_DIR = path.join(DATA_DIR, "backups");
var DB_FILE = path.join(DATA_DIR, "pharmacy_database.json");
var DEFAULT_STORE_ID2 = "store-1";
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
function hashPassword(plain) {
  return crypto.createHash("sha256").update(String(plain).trim()).digest("hex");
}
var DEFAULT_CATEGORIES = [
  "Analgesics & Antipyretics",
  "Antibiotics",
  "Gastrointestinal",
  "Antihistamines & Respiratory",
  "Cardiovascular & Hypertension",
  "Antidiabetics",
  "Vitamins & Supplements",
  "Dermatological",
  "Surgical & First Aid"
];
function getInitialDatabase() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const usersWithHash = INITIAL_USERS.map((u) => ({
    ...u,
    storeId: DEFAULT_STORE_ID2,
    createdBy: "usr-owner-1",
    passwordHash: hashPassword(u.password || "admin")
  }));
  return {
    cleanVersion: DATA_CLEAN_VERSION,
    stores: [
      {
        id: DEFAULT_STORE_ID2,
        name: INITIAL_SETTINGS.storeName,
        ownerId: "usr-owner-1",
        drugLicenseNumber: INITIAL_SETTINGS.drugLicenseNumber,
        taxRegistrationNumber: INITIAL_SETTINGS.taxRegistrationNumber,
        address: INITIAL_SETTINGS.storeAddress,
        city: INITIAL_SETTINGS.city,
        phone: INITIAL_SETTINGS.phone,
        email: INITIAL_SETTINGS.email,
        createdAt: now
      }
    ],
    users: usersWithHash,
    staffMembers: usersWithHash,
    medicines: INITIAL_MEDICINES,
    categories: DEFAULT_CATEGORIES.map((name, idx) => ({
      id: `cat-${idx + 1}`,
      storeId: DEFAULT_STORE_ID2,
      name,
      createdBy: "usr-owner-1",
      createdAt: now
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
    staffPermissions: usersWithHash.map((u) => ({
      id: `perm-${u.id}`,
      storeId: DEFAULT_STORE_ID2,
      userId: u.id,
      username: u.username,
      role: u.role,
      ...u.permissions
    })),
    deletedIds: [],
    lastUpdated: now
  };
}
function sanitizeDatabaseState(data) {
  if (!data || data.cleanVersion !== DATA_CLEAN_VERSION) {
    const clean = getInitialDatabase();
    const staff = sanitizeStaffAccounts(data?.staffMembers).map((u) => ({
      ...u,
      storeId: DEFAULT_STORE_ID2,
      createdBy: u.createdBy || "usr-owner-1",
      passwordHash: u.passwordHash || hashPassword(u.password || (u.id === "usr-owner-1" ? "admin" : "seller123"))
    }));
    clean.staffMembers = staff;
    clean.users = staff;
    return clean;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const deletedSet = new Set(Array.isArray(data.deletedIds) ? data.deletedIds : []);
  const rawMedicines = Array.isArray(data.medicines) ? data.medicines : [];
  const cleanMedicines = rawMedicines.filter((m) => m && m.id && !deletedSet.has(m.id)).map((m) => {
    const batches = Array.isArray(m.batches) ? m.batches : [];
    const totalQuantity = batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
    return {
      ...m,
      storeId: m.storeId || DEFAULT_STORE_ID2,
      createdBy: m.createdBy || "usr-owner-1",
      batches,
      totalQuantity
    };
  });
  const cleanStaff = sanitizeStaffAccounts(data.staffMembers).filter((u) => !deletedSet.has(u.id)).map((u) => ({
    ...u,
    storeId: u.storeId || DEFAULT_STORE_ID2,
    createdBy: u.createdBy || "usr-owner-1",
    passwordHash: u.passwordHash || hashPassword(u.password || (u.id === "usr-owner-1" ? "admin" : "seller123"))
  }));
  const cleanSuppliers = (Array.isArray(data.suppliers) ? data.suppliers : []).filter((s) => s && s.id && !deletedSet.has(s.id)).map((s) => ({
    ...s,
    storeId: s.storeId || DEFAULT_STORE_ID2,
    createdBy: s.createdBy || "usr-owner-1"
  }));
  const cleanCustomers = (Array.isArray(data.customers) ? data.customers : []).filter((c) => c && c.id && !deletedSet.has(c.id)).map((c) => ({
    ...c,
    storeId: c.storeId || DEFAULT_STORE_ID2,
    createdBy: c.createdBy || "usr-owner-1"
  }));
  const cleanSales = (Array.isArray(data.sales) ? data.sales : []).filter((s) => s && s.id && !deletedSet.has(s.id)).map((s) => ({
    ...s,
    storeId: s.storeId || DEFAULT_STORE_ID2,
    createdBy: s.createdBy || s.staffId || "usr-owner-1"
  }));
  const cleanPurchases = (Array.isArray(data.purchases) ? data.purchases : []).filter((p) => p && p.id && !deletedSet.has(p.id)).map((p) => ({
    ...p,
    storeId: p.storeId || DEFAULT_STORE_ID2,
    createdBy: p.createdBy || "usr-owner-1"
  }));
  const cleanExpenses = (Array.isArray(data.expenses) ? data.expenses : []).filter((e) => e && e.id && !deletedSet.has(e.id)).map((e) => ({
    ...e,
    storeId: e.storeId || DEFAULT_STORE_ID2,
    createdBy: e.createdBy || e.addedBy || "usr-owner-1"
  }));
  const cleanAdjustments = (Array.isArray(data.adjustments) ? data.adjustments : []).map((a) => ({
    ...a,
    storeId: a.storeId || DEFAULT_STORE_ID2,
    createdBy: a.createdBy || a.performedBy || "usr-owner-1"
  }));
  const categoryNames = new Set(DEFAULT_CATEGORIES);
  cleanMedicines.forEach((m) => {
    if (m.category) categoryNames.add(m.category);
  });
  const categories = Array.from(categoryNames).map((name, idx) => ({
    id: `cat-${idx + 1}`,
    storeId: DEFAULT_STORE_ID2,
    name,
    createdBy: "usr-owner-1",
    createdAt: now
  }));
  const saleItems2 = [];
  const cashMemos2 = [];
  cleanSales.forEach((sale) => {
    if (Array.isArray(sale.items)) {
      sale.items.forEach((item, idx) => {
        saleItems2.push({
          ...item,
          id: item.id || `${sale.id}-item-${idx + 1}`,
          saleId: sale.id,
          storeId: DEFAULT_STORE_ID2
        });
      });
    }
    cashMemos2.push({
      id: `memo-${sale.id}`,
      storeId: DEFAULT_STORE_ID2,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      date: sale.date,
      time: sale.time,
      createdBy: sale.staffId || "usr-owner-1",
      createdByName: sale.staffName || "Store Dispenser",
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
      status: sale.status || "completed"
    });
  });
  const purchaseItems2 = [];
  cleanPurchases.forEach((po) => {
    if (Array.isArray(po.items)) {
      po.items.forEach((item, idx) => {
        purchaseItems2.push({
          ...item,
          id: item.id || `${po.id}-pitem-${idx + 1}`,
          purchaseId: po.id,
          storeId: DEFAULT_STORE_ID2
        });
      });
    }
  });
  const settings = { ...INITIAL_SETTINGS, ...data.settings || {} };
  const stores2 = [
    {
      id: DEFAULT_STORE_ID2,
      name: settings.storeName,
      ownerId: "usr-owner-1",
      drugLicenseNumber: settings.drugLicenseNumber,
      taxRegistrationNumber: settings.taxRegistrationNumber,
      address: settings.storeAddress,
      city: settings.city,
      phone: settings.phone,
      email: settings.email,
      createdAt: data.stores?.[0]?.createdAt || now
    }
  ];
  const staffPermissions2 = cleanStaff.map((u) => ({
    id: `perm-${u.id}`,
    storeId: DEFAULT_STORE_ID2,
    userId: u.id,
    username: u.username,
    role: u.role,
    ...u.permissions || {}
  }));
  return {
    ...data,
    cleanVersion: DATA_CLEAN_VERSION,
    stores: stores2,
    users: cleanStaff,
    staffMembers: cleanStaff,
    medicines: cleanMedicines,
    categories,
    suppliers: cleanSuppliers,
    customers: cleanCustomers,
    purchases: cleanPurchases,
    purchaseItems: purchaseItems2,
    sales: cleanSales,
    saleItems: saleItems2,
    saleReturns: Array.isArray(data.saleReturns) ? data.saleReturns : [],
    stockTransactions: Array.isArray(data.stockTransactions) ? data.stockTransactions : [],
    adjustments: cleanAdjustments,
    expenses: cleanExpenses,
    payments: Array.isArray(data.payments) ? data.payments : [],
    cashMemos: cashMemos2,
    auditLogs: Array.isArray(data.auditLogs) ? data.auditLogs : [],
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    settings,
    staffPermissions: staffPermissions2,
    deletedIds: Array.from(deletedSet),
    lastUpdated: data.lastUpdated || now
  };
}
var MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || (process.env.DATABASE_URL?.startsWith("mongodb") ? process.env.DATABASE_URL : "");
var mongoClientInstance = null;
var mongoCollection = null;
var mongoConnected = false;
var lastMongoSyncAt = null;
var mongoErrorMsg = null;
var MONGO_DB_NAME = process.env.MONGODB_DB_NAME || "pharmacare_erp";
async function syncCollectionsToMongo(clean) {
  if (!mongoClientInstance || !mongoConnected || !mongoCollection) return;
  try {
    const db2 = mongoClientInstance.db(MONGO_DB_NAME);
    await mongoCollection.updateOne(
      { _id: "primary_store_state" },
      { $set: { state: clean, updatedAt: clean.lastUpdated } },
      { upsert: true }
    );
    const staffCol = db2.collection("staff_accounts");
    if (Array.isArray(clean.staffMembers) && clean.staffMembers.length > 0) {
      await Promise.all(
        clean.staffMembers.map(
          (user) => staffCol.updateOne({ id: user.id }, { $set: { ...user, updatedAt: clean.lastUpdated } }, { upsert: true })
        )
      );
      const validIds = clean.staffMembers.map((u) => u.id);
      await staffCol.deleteMany({ id: { $nin: validIds } });
    }
    lastMongoSyncAt = (/* @__PURE__ */ new Date()).toISOString();
    mongoErrorMsg = null;
  } catch (err) {
    mongoErrorMsg = err?.message || "Failed to sync to MongoDB Atlas";
    console.error("Failed to sync state to MongoDB Atlas:", err);
  }
}
async function initMongoDB() {
  if (!MONGODB_URI) return;
  try {
    mongoClientInstance = new MongoClient(MONGODB_URI);
    await mongoClientInstance.connect();
    const db2 = mongoClientInstance.db(MONGO_DB_NAME);
    mongoCollection = db2.collection("pharmacy_store_state");
    mongoConnected = true;
    mongoErrorMsg = null;
    console.log("Connected to MongoDB Atlas cloud database successfully.");
    const existingDoc = await mongoCollection.findOne({ _id: "primary_store_state" });
    if (existingDoc && existingDoc.state && existingDoc.state.cleanVersion === DATA_CLEAN_VERSION) {
      const cloudState = sanitizeDatabaseState(existingDoc.state);
      writeLocalFileOnly(cloudState);
      lastMongoSyncAt = (/* @__PURE__ */ new Date()).toISOString();
    } else {
      const currentLocal = readDatabase();
      await syncCollectionsToMongo(currentLocal);
    }
  } catch (err) {
    mongoConnected = false;
    mongoErrorMsg = err?.message || "Connection error";
  }
}
function writeLocalFileOnly(data) {
  data.cleanVersion = DATA_CLEAN_VERSION;
  data.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  const tmpFile = `${DB_FILE}.tmp.${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error("Failed atomic write to database:", err);
    if (fs.existsSync(tmpFile)) {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
      }
    }
  }
}
function readDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.cleanVersion === DATA_CLEAN_VERSION) {
        return sanitizeDatabaseState(parsed);
      }
    }
  } catch (err) {
    console.error("Error reading pharmacy_database.json:", err);
  }
  const initial = getInitialDatabase();
  writeLocalFileOnly(initial);
  return initial;
}
var wssInstance = null;
function broadcastRealtimeUpdate(clean, event = "STATE_SYNC") {
  if (!wssInstance) return;
  const payload = JSON.stringify({
    type: "DB_UPDATED",
    event,
    storeId: DEFAULT_STORE_ID2,
    timestamp: clean.lastUpdated,
    data: clean
  });
  wssInstance.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch {
      }
    }
  });
}
function writeDatabase(data, event = "STATE_SYNC") {
  const clean = sanitizeDatabaseState(data);
  writeLocalFileOnly(clean);
  if (mongoCollection && mongoConnected) {
    syncCollectionsToMongo(clean);
  }
  if (process.env.SQL_HOST) {
    syncStateToCloudSql(clean).catch(() => {
    });
  }
  broadcastRealtimeUpdate(clean, event);
  return clean;
}
async function initCloudSql() {
  if (!process.env.SQL_HOST) return;
  try {
    const cloudState = await loadStateFromCloudSql();
    if (cloudState && cloudState.cleanVersion === DATA_CLEAN_VERSION) {
      const clean = sanitizeDatabaseState(cloudState);
      writeLocalFileOnly(clean);
    } else {
      const currentLocal = readDatabase();
      await syncStateToCloudSql(currentLocal);
    }
  } catch (err) {
    console.error("[Database Error]:", { message: err?.message });
  }
}
function createBackupSnapshot(comment = "Manual backup") {
  const db2 = readDatabase();
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const filename = `backup_${timestamp2}.json`;
  const filePath = path.join(BACKUPS_DIR, filename);
  const payload = {
    snapshotId: `snap-${Date.now()}`,
    comment,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    data: db2
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
  return { snapshotId: payload.snapshotId, filename };
}
async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3e3;
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  wssInstance = wss;
  wss.on("error", () => {
  });
  wss.on("connection", (ws) => {
    ws.on("error", () => {
    });
    try {
      const db2 = readDatabase();
      ws.send(
        JSON.stringify({
          type: "CONNECTED",
          storeId: DEFAULT_STORE_ID2,
          timestamp: db2.lastUpdated,
          data: db2
        })
      );
    } catch {
    }
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === "PING") {
          ws.send(JSON.stringify({ type: "PONG", timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
        } else if (msg.type === "REQUEST_STATE") {
          const db2 = readDatabase();
          ws.send(
            JSON.stringify({
              type: "DB_UPDATED",
              event: "REQUEST_STATE",
              storeId: DEFAULT_STORE_ID2,
              timestamp: db2.lastUpdated,
              data: db2
            })
          );
        }
      } catch {
      }
    });
  });
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id, X-User-Role, X-Store-Id");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });
  app.use(express.json({ limit: "15mb" }));
  readDatabase();
  await initMongoDB();
  initCloudSql().catch(() => {
  });
  app.post("/api/auth/google-sync", requireAuth, async (req, res) => {
    try {
      const decodedToken = req.user;
      const syncedUser = await getOrCreateUser(decodedToken);
      res.json({ success: true, user: syncedUser });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Failed to synchronize user account" });
    }
  });
  function getActorFromReq(req, db2) {
    const headerUserId = String(req.headers["x-user-id"] || req.body?.actorId || "").trim();
    const headerRole = String(req.headers["x-user-role"] || req.body?.actorRole || "").trim();
    if (headerUserId) {
      const found = db2.staffMembers.find((u) => u.id === headerUserId || u.username === headerUserId);
      if (found) return found;
    }
    if (headerRole === "staff" || headerRole === "cashier" || headerRole === "pharmacist") {
      return {
        id: headerUserId || "staff-actor",
        role: headerRole,
        status: "active",
        permissions: {
          canMakeSales: true,
          canViewInventory: true,
          canAddCustomer: true,
          canViewReports: false,
          canAdjustStock: headerRole === "pharmacist",
          canManagePurchases: headerRole === "pharmacist"
        }
      };
    }
    return db2.staffMembers.find((u) => u.id === "usr-owner-1") || db2.staffMembers[0];
  }
  app.get("/api/audit-schema", (_req, res) => {
    try {
      const db2 = readDatabase();
      const tables = [
        { id: 1, name: "Stores", key: "stores", pk: "id", fk: ["ownerId"], count: db2.stores.length },
        { id: 2, name: "Users", key: "users", pk: "id", fk: ["storeId", "createdBy"], count: db2.users.length },
        { id: 3, name: "Staff", key: "staffMembers", pk: "id", fk: ["storeId", "createdBy"], count: db2.staffMembers.length },
        { id: 4, name: "Medicines", key: "medicines", pk: "id", fk: ["storeId", "createdBy", "category"], count: db2.medicines.length },
        { id: 5, name: "Medicine Categories", key: "categories", pk: "id", fk: ["storeId"], count: db2.categories.length },
        { id: 6, name: "Suppliers", key: "suppliers", pk: "id", fk: ["storeId", "createdBy"], count: db2.suppliers.length },
        { id: 7, name: "Customers", key: "customers", pk: "id", fk: ["storeId", "createdBy"], count: db2.customers.length },
        { id: 8, name: "Purchases", key: "purchases", pk: "id", fk: ["storeId", "supplierId", "createdBy"], count: db2.purchases.length },
        { id: 9, name: "Purchase Items", key: "purchaseItems", pk: "id", fk: ["purchaseId", "medicineId", "storeId"], count: db2.purchaseItems.length },
        { id: 10, name: "Sales", key: "sales", pk: "id", fk: ["storeId", "staffId", "customerId", "createdBy"], count: db2.sales.length },
        { id: 11, name: "Sale Items", key: "saleItems", pk: "id", fk: ["saleId", "medicineId", "batchId", "storeId"], count: db2.saleItems.length },
        { id: 12, name: "Stock Transactions", key: "stockTransactions", pk: "id", fk: ["storeId", "medicineId", "batchId", "createdBy"], count: db2.stockTransactions.length },
        { id: 13, name: "Expenses", key: "expenses", pk: "id", fk: ["storeId", "addedBy", "createdBy"], count: db2.expenses.length },
        { id: 14, name: "Payments", key: "payments", pk: "id", fk: ["storeId", "referenceId", "partyId", "createdBy"], count: db2.payments.length },
        { id: 15, name: "Cash Memos / Invoices", key: "cashMemos", pk: "id", fk: ["storeId", "saleId", "invoiceNumber", "createdBy"], count: db2.cashMemos.length },
        { id: 16, name: "Activity Logs", key: "auditLogs", pk: "id", fk: ["userId"], count: db2.auditLogs.length },
        { id: 17, name: "Store Settings", key: "settings", pk: "storeName", fk: ["storeId"], count: 1 },
        { id: 18, name: "Staff Permissions", key: "staffPermissions", pk: "id", fk: ["storeId", "userId"], count: db2.staffPermissions.length }
      ];
      res.json({
        success: true,
        storeId: DEFAULT_STORE_ID2,
        totalTablesVerified: tables.length,
        wsClientsConnected: wss.clients.size,
        tables
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.get("/api/db-status", (_req, res) => {
    try {
      const db2 = readDatabase();
      res.json({
        success: true,
        storageEngine: mongoConnected ? "hostinger_mongodb_atlas" : "server_local_disk",
        mongoConfigured: Boolean(MONGODB_URI),
        mongoConnected,
        mongoDbName: MONGO_DB_NAME,
        lastMongoSyncAt,
        mongoErrorMsg,
        wsClientsConnected: wss.clients.size,
        localFilePath: "data/pharmacy_database.json",
        lastUpdated: db2.lastUpdated,
        counts: {
          stores: db2.stores.length,
          staffAccounts: db2.staffMembers.length,
          medicines: db2.medicines.length,
          categories: db2.categories.length,
          sales: db2.sales.length,
          saleItems: db2.saleItems.length,
          purchases: db2.purchases.length,
          purchaseItems: db2.purchaseItems.length,
          suppliers: db2.suppliers.length,
          customers: db2.customers.length,
          expenses: db2.expenses.length,
          payments: db2.payments.length,
          cashMemos: db2.cashMemos.length,
          stockTransactions: db2.stockTransactions.length
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/db-sync-now", async (_req, res) => {
    try {
      const db2 = readDatabase();
      writeDatabase(db2, "MANUAL_SYNC");
      if (MONGODB_URI && !mongoConnected) {
        await initMongoDB();
      }
      if (mongoConnected) {
        await syncCollectionsToMongo(db2);
      }
      res.json({
        success: true,
        storageEngine: mongoConnected ? "hostinger_mongodb_atlas" : "server_local_disk",
        mongoConnected,
        lastUpdated: db2.lastUpdated,
        lastMongoSyncAt
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  function mergeCollectionById(existingArr = [], incomingArr = [], deletedSet = /* @__PURE__ */ new Set()) {
    const map = /* @__PURE__ */ new Map();
    if (Array.isArray(existingArr)) {
      existingArr.forEach((item) => {
        if (item && item.id && !deletedSet.has(item.id)) map.set(item.id, item);
      });
    }
    if (Array.isArray(incomingArr)) {
      incomingArr.forEach((item) => {
        if (item && item.id && !deletedSet.has(item.id)) map.set(item.id, item);
      });
    }
    return Array.from(map.values());
  }
  async function readLatestDatabaseWithMongo() {
    const localDb = readDatabase();
    if (!mongoClientInstance || !mongoConnected) {
      return localDb;
    }
    try {
      const db2 = mongoClientInstance.db(MONGO_DB_NAME);
      const staffCol = db2.collection("staff_accounts");
      const mongoStaff = await staffCol.find({}).toArray();
      const stateDoc = await mongoCollection?.findOne({ _id: "primary_store_state" });
      const mergedStaffMap = /* @__PURE__ */ new Map();
      (localDb.staffMembers || []).forEach((u) => {
        if (u && u.id) mergedStaffMap.set(u.id, u);
      });
      if (stateDoc?.state?.staffMembers && Array.isArray(stateDoc.state.staffMembers)) {
        stateDoc.state.staffMembers.forEach((u) => {
          if (u && u.id) mergedStaffMap.set(u.id, u);
        });
      }
      mongoStaff.forEach((u) => {
        if (u && u.id) {
          const { _id, ...rest } = u;
          mergedStaffMap.set(rest.id, rest);
        }
      });
      const mergedDb = sanitizeDatabaseState({
        ...stateDoc?.state || {},
        ...localDb,
        medicines: localDb.medicines.length >= (stateDoc?.state?.medicines?.length || 0) ? localDb.medicines : stateDoc.state.medicines,
        staffMembers: sanitizeStaffAccounts(Array.from(mergedStaffMap.values()))
      });
      writeLocalFileOnly(mergedDb);
      return mergedDb;
    } catch {
      return localDb;
    }
  }
  app.get("/api/state", async (_req, res) => {
    try {
      const db2 = await readLatestDatabaseWithMongo();
      res.json({
        success: true,
        storageEngine: mongoConnected ? "mongodb_atlas" : "local_disk",
        data: db2
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/sync", async (req, res) => {
    try {
      const incoming = req.body;
      if (!incoming || !Array.isArray(incoming.medicines)) {
        return res.status(400).json({ success: false, error: "Invalid state payload" });
      }
      const existingDb = await readLatestDatabaseWithMongo();
      const deletedSet = new Set(incoming.resetDeletedIds ? [] : existingDb.deletedIds || []);
      if (Array.isArray(incoming.deletedIds)) {
        incoming.deletedIds.forEach((id) => deletedSet.add(id));
      }
      if (incoming.forceReplaceAll) {
        const replaced = writeDatabase(
          {
            ...existingDb,
            ...incoming,
            cleanVersion: DATA_CLEAN_VERSION,
            deletedIds: Array.from(deletedSet),
            lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
          },
          "CLIENT_SYNC"
        );
        return res.json({
          success: true,
          storageEngine: mongoConnected ? "mongodb_atlas" : "local_disk",
          message: "Database state replaced and persisted",
          staffCount: replaced.staffMembers.length,
          medicineCount: replaced.medicines.length,
          data: replaced
        });
      }
      const mergedStaff = incoming.forceStaffReplace ? incoming.staffMembers.filter((u) => !deletedSet.has(u.id)) : mergeCollectionById(existingDb.staffMembers, incoming.staffMembers, deletedSet);
      const mergedMedicines = incoming.forceMedicineReplace ? incoming.medicines.filter((m) => !deletedSet.has(m.id)) : mergeCollectionById(existingDb.medicines, incoming.medicines, deletedSet);
      const nextDb = {
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
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      };
      const saved = writeDatabase(nextDb, "CLIENT_SYNC");
      res.json({
        success: true,
        storageEngine: mongoConnected ? "mongodb_atlas" : "local_disk",
        message: "Database state updated and persisted",
        staffCount: saved.staffMembers.length,
        medicineCount: saved.medicines.length,
        data: saved
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/medicine", (req, res) => {
    try {
      const medicine = req.body;
      if (!medicine || !String(medicine.name || "").trim()) {
        return res.status(400).json({ success: false, error: "Medicine name is required" });
      }
      const batches = Array.isArray(medicine.batches) ? medicine.batches : [];
      for (const b of batches) {
        if (Number(b.quantity) < 0) {
          return res.status(400).json({ success: false, error: "Batch quantity cannot be negative" });
        }
        if (Number(b.purchasePrice) < 0 || Number(b.salePrice) <= 0) {
          return res.status(400).json({ success: false, error: "Sale price must be greater than zero" });
        }
        if (!b.expiryDate || isNaN(Date.parse(b.expiryDate))) {
          return res.status(400).json({ success: false, error: "Valid batch expiry date is required" });
        }
      }
      const db2 = readDatabase();
      const actor = getActorFromReq(req, db2);
      if (!Array.isArray(db2.deletedIds)) db2.deletedIds = [];
      db2.deletedIds = db2.deletedIds.filter((delId) => delId !== medicine.id);
      const totalQuantity = batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
      const medRecord = {
        ...medicine,
        id: medicine.id || `med-${Date.now()}`,
        storeId: DEFAULT_STORE_ID2,
        createdBy: medicine.createdBy || actor?.id || "usr-owner-1",
        batches,
        totalQuantity
      };
      const existingIdx = db2.medicines.findIndex((m) => m.id === medRecord.id);
      if (existingIdx >= 0) {
        db2.medicines[existingIdx] = medRecord;
      } else {
        db2.medicines.unshift(medRecord);
        for (const b of batches) {
          if (Number(b.quantity) > 0) {
            db2.stockTransactions.unshift({
              id: `stx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              storeId: DEFAULT_STORE_ID2,
              medicineId: medRecord.id,
              medicineName: medRecord.name,
              batchId: b.id,
              batchNumber: b.batchNumber,
              type: "opening",
              quantityChange: Number(b.quantity),
              previousQuantity: 0,
              newQuantity: Number(b.quantity),
              referenceId: medRecord.id,
              createdBy: medRecord.createdBy,
              createdByName: actor?.fullName || "Store User",
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
      db2.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: "MEDICINE_CREATED",
        description: `Registered formulation ${medRecord.name} (${medRecord.strength || ""}) with ${totalQuantity} units`,
        userId: actor?.id || "usr-owner-1",
        userName: actor?.fullName || "Store User",
        userRole: actor?.role || "admin",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const saved = writeDatabase(db2, "MEDICINE_ADDED");
      res.json({ success: true, medicine: medRecord, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.put("/api/medicine/:id", (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db2 = readDatabase();
      const index = db2.medicines.findIndex((m) => m.id === id);
      if (index === -1) {
        return res.status(404).json({ success: false, error: "Medicine not found" });
      }
      const actor = getActorFromReq(req, db2);
      const merged = { ...db2.medicines[index], ...updates, storeId: DEFAULT_STORE_ID2 };
      if (Array.isArray(merged.batches)) {
        merged.totalQuantity = merged.batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
      }
      db2.medicines[index] = merged;
      db2.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: "MEDICINE_UPDATED",
        description: `Updated medicine ${merged.name} (Stock: ${merged.totalQuantity})`,
        userId: actor?.id || "usr-owner-1",
        userName: actor?.fullName || "Store User",
        userRole: actor?.role || "admin",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const saved = writeDatabase(db2, "MEDICINE_UPDATED");
      res.json({ success: true, medicine: merged, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.delete("/api/medicine/:id", (req, res) => {
    try {
      const { id } = req.params;
      const db2 = readDatabase();
      const actor = getActorFromReq(req, db2);
      if (actor && actor.role !== "admin" && actor.role !== "pharmacist" && !actor.permissions?.canAdjustStock) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized: Staff without stock management permission cannot delete medicines"
        });
      }
      const target = db2.medicines.find((m) => m.id === id);
      if (!target) {
        return res.status(404).json({ success: false, error: "Medicine not found" });
      }
      db2.medicines = db2.medicines.filter((m) => m.id !== id);
      if (!Array.isArray(db2.deletedIds)) db2.deletedIds = [];
      if (!db2.deletedIds.includes(id)) db2.deletedIds.push(id);
      db2.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: "MEDICINE_DELETED",
        description: `Removed medicine formulation ${target.name}`,
        userId: actor?.id || "usr-owner-1",
        userName: actor?.fullName || "Store Owner",
        userRole: actor?.role || "admin",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const saved = writeDatabase(db2, "MEDICINE_DELETED");
      res.json({ success: true, message: "Medicine deleted successfully", data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/sale", (req, res) => {
    try {
      const sale = req.body;
      if (!sale || !Array.isArray(sale.items) || sale.items.length === 0) {
        return res.status(400).json({ success: false, error: "Cart items cannot be empty" });
      }
      const db2 = readDatabase();
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      if (db2.sales.some((s) => s.id === sale.id || s.invoiceNumber === sale.invoiceNumber)) {
        return res.status(409).json({ success: false, error: `Duplicate invoice number: ${sale.invoiceNumber}` });
      }
      for (const item of sale.items) {
        if (!item.quantity || Number(item.quantity) <= 0) {
          return res.status(400).json({ success: false, error: "Sale item quantity must be greater than zero" });
        }
        const med = db2.medicines.find((m) => m.id === item.medicineId);
        if (!med) {
          return res.status(404).json({ success: false, error: `Medicine ${item.medicineName} not found` });
        }
        const batch = med.batches.find((b) => b.id === item.batchId || b.batchNumber === item.batchNumber);
        if (!batch) {
          return res.status(404).json({ success: false, error: `Batch ${item.batchNumber} not found` });
        }
        if (batch.expiryDate && batch.expiryDate < todayStr) {
          return res.status(400).json({
            success: false,
            error: `Cannot sell expired batch ${batch.batchNumber} of ${med.name} (Expired: ${batch.expiryDate})`
          });
        }
        if (batch.quantity < item.quantity) {
          return res.status(400).json({
            success: false,
            error: `Insufficient stock in batch ${batch.batchNumber} for ${med.name}. Available: ${batch.quantity}, Requested: ${item.quantity}`
          });
        }
      }
      for (const item of sale.items) {
        const med = db2.medicines.find((m) => m.id === item.medicineId);
        const batch = med.batches.find((b) => b.id === item.batchId || b.batchNumber === item.batchNumber);
        const prevQty = batch.quantity;
        batch.quantity -= Number(item.quantity);
        med.totalQuantity = med.batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
        db2.stockTransactions.unshift({
          id: `stx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          storeId: DEFAULT_STORE_ID2,
          medicineId: med.id,
          medicineName: med.name,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          type: "sale",
          quantityChange: -Number(item.quantity),
          previousQuantity: prevQty,
          newQuantity: batch.quantity,
          referenceId: sale.id,
          createdBy: sale.staffId || "usr-owner-1",
          createdByName: sale.staffName || "Store Dispenser",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      const saleRecord = {
        ...sale,
        storeId: DEFAULT_STORE_ID2,
        createdBy: sale.staffId || "usr-owner-1",
        status: sale.status || "completed"
      };
      db2.sales.unshift(saleRecord);
      if (saleRecord.customerId) {
        const cust = db2.customers.find((c) => c.id === saleRecord.customerId);
        if (cust) {
          cust.totalPurchases = Number(cust.totalPurchases || 0) + Number(saleRecord.grandTotal || 0);
          cust.lastPurchaseDate = saleRecord.date;
          const unpaidAmount = Math.max(0, Number(saleRecord.grandTotal || 0) - Number(saleRecord.amountPaid || 0));
          if (saleRecord.paymentMethod === "Credit" || unpaidAmount > 0) {
            cust.outstandingBalance = Number(cust.outstandingBalance || 0) + unpaidAmount;
          }
        }
      }
      if (Number(saleRecord.amountPaid) > 0) {
        db2.payments.unshift({
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          storeId: DEFAULT_STORE_ID2,
          type: "customer_payment",
          referenceId: saleRecord.id,
          partyId: saleRecord.customerId,
          partyName: saleRecord.customerName || "Walk-in Customer",
          amount: Math.min(Number(saleRecord.amountPaid), Number(saleRecord.grandTotal)),
          paymentMethod: saleRecord.paymentMethod || "Cash",
          date: saleRecord.date,
          createdBy: saleRecord.staffId || "usr-owner-1",
          createdByName: saleRecord.staffName || "Store Dispenser",
          notes: `Payment for Invoice ${saleRecord.invoiceNumber}`
        });
      }
      db2.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: "SALE_COMPLETED",
        description: `Dispensed invoice ${saleRecord.invoiceNumber} for Rs. ${saleRecord.grandTotal} via ${saleRecord.paymentMethod}`,
        userId: saleRecord.staffId || "usr-owner-1",
        userName: saleRecord.staffName || "Staff Cashier",
        userRole: "staff",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const saved = writeDatabase(db2, "SALE_COMPLETED");
      res.json({ success: true, sale: saleRecord, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/sale-return", (req, res) => {
    try {
      const saleReturn = req.body;
      if (!saleReturn || !saleReturn.saleId || !Array.isArray(saleReturn.items)) {
        return res.status(400).json({ success: false, error: "Valid sale return payload required" });
      }
      const db2 = readDatabase();
      const targetSale = db2.sales.find((s) => s.id === saleReturn.saleId);
      if (!targetSale) {
        return res.status(404).json({ success: false, error: "Original sale not found" });
      }
      if (targetSale.status === "returned") {
        return res.status(409).json({ success: false, error: "Sale has already been returned" });
      }
      targetSale.status = "returned";
      for (const rItem of saleReturn.items) {
        const med = db2.medicines.find((m) => m.id === rItem.medicineId);
        if (med) {
          const batch = med.batches.find((b) => b.id === rItem.batchId || b.batchNumber === rItem.batchNumber);
          if (batch) {
            const prevQty = batch.quantity;
            batch.quantity += Number(rItem.quantity);
            med.totalQuantity = med.batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
            db2.stockTransactions.unshift({
              id: `stx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              storeId: DEFAULT_STORE_ID2,
              medicineId: med.id,
              medicineName: med.name,
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              type: "return",
              quantityChange: Number(rItem.quantity),
              previousQuantity: prevQty,
              newQuantity: batch.quantity,
              referenceId: saleReturn.id,
              createdBy: saleReturn.staffId || "usr-owner-1",
              createdByName: saleReturn.staffName || "Store Staff",
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
      db2.saleReturns.unshift({
        ...saleReturn,
        storeId: DEFAULT_STORE_ID2,
        createdBy: saleReturn.staffId || "usr-owner-1"
      });
      db2.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: "SALE_RETURN",
        description: `Processed return for Invoice ${saleReturn.invoiceNumber} (Refund Rs. ${saleReturn.totalRefund})`,
        userId: saleReturn.staffId || "usr-owner-1",
        userName: saleReturn.staffName || "Store Staff",
        userRole: "staff",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const saved = writeDatabase(db2, "SALE_RETURNED");
      res.json({ success: true, saleReturn, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/purchase", (req, res) => {
    try {
      const purchase = req.body;
      if (!purchase || !Array.isArray(purchase.items) || purchase.items.length === 0) {
        return res.status(400).json({ success: false, error: "Purchase items required" });
      }
      for (const pItem of purchase.items) {
        if (!pItem.quantity || Number(pItem.quantity) <= 0) {
          return res.status(400).json({ success: false, error: "Purchase item quantity must be positive" });
        }
        if (Number(pItem.purchasePrice) <= 0 || Number(pItem.salePrice) <= 0) {
          return res.status(400).json({ success: false, error: "Purchase and sale prices must be positive" });
        }
      }
      const db2 = readDatabase();
      const actor = getActorFromReq(req, db2);
      const totalAmount = Number(purchase.totalAmount || 0);
      const paidAmount = Number(purchase.paidAmount || 0);
      const balanceAmount = Math.max(0, totalAmount - paidAmount);
      const paymentStatus = balanceAmount === 0 ? "Paid" : paidAmount > 0 ? "Partial" : "Pending";
      const poRecord = {
        ...purchase,
        id: purchase.id || `po-${Date.now()}`,
        storeId: DEFAULT_STORE_ID2,
        createdBy: purchase.createdBy || actor?.id || "usr-owner-1",
        totalAmount,
        paidAmount,
        balanceAmount,
        paymentStatus
      };
      db2.purchases.unshift(poRecord);
      for (const pItem of poRecord.items) {
        const med = db2.medicines.find((m) => m.id === pItem.medicineId);
        if (med) {
          const existingBatch = med.batches.find((b) => b.batchNumber === pItem.batchNumber);
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
              mfgDate: pItem.mfgDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
              expiryDate: pItem.expiryDate,
              supplierId: poRecord.supplierId,
              supplierName: poRecord.supplierName,
              receivedDate: poRecord.purchaseDate
            });
          }
          med.totalQuantity = med.batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
          db2.stockTransactions.unshift({
            id: `stx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            storeId: DEFAULT_STORE_ID2,
            medicineId: med.id,
            medicineName: med.name,
            batchId,
            batchNumber: pItem.batchNumber,
            type: "purchase",
            quantityChange: Number(pItem.quantity),
            previousQuantity: prevQty,
            newQuantity: prevQty + Number(pItem.quantity),
            referenceId: poRecord.id,
            createdBy: poRecord.createdBy,
            createdByName: poRecord.receivedBy || actor?.fullName || "Store Owner",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
      const sup = db2.suppliers.find((s) => s.id === poRecord.supplierId);
      if (sup) {
        sup.totalPurchases = Number(sup.totalPurchases || 0) + totalAmount;
        sup.totalPaid = Number(sup.totalPaid || 0) + paidAmount;
        sup.outstandingBalance = Number(sup.outstandingBalance || 0) + balanceAmount;
      }
      if (paidAmount > 0) {
        db2.payments.unshift({
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          storeId: DEFAULT_STORE_ID2,
          type: "purchase_payment",
          referenceId: poRecord.id,
          partyId: poRecord.supplierId,
          partyName: poRecord.supplierName,
          amount: paidAmount,
          paymentMethod: poRecord.paymentMethod || "Cash",
          date: poRecord.purchaseDate,
          createdBy: poRecord.createdBy,
          createdByName: poRecord.receivedBy || "Store Owner",
          notes: `Payment on PO ${poRecord.purchaseNumber}`
        });
      }
      db2.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: "PURCHASE_RECORDED",
        description: `Received PO ${poRecord.purchaseNumber} from ${poRecord.supplierName} (Rs. ${totalAmount})`,
        userId: poRecord.createdBy,
        userName: poRecord.receivedBy || "Store Owner",
        userRole: actor?.role || "admin",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const saved = writeDatabase(db2, "PURCHASE_ADDED");
      res.json({ success: true, purchase: poRecord, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/purchase/:id/payment", (req, res) => {
    try {
      const { id } = req.params;
      const { amount, paymentMethod = "Cash" } = req.body;
      const payAmt = Number(amount || 0);
      if (payAmt <= 0) {
        return res.status(400).json({ success: false, error: "Payment amount must be greater than zero" });
      }
      const db2 = readDatabase();
      const po = db2.purchases.find((p) => p.id === id);
      if (!po) {
        return res.status(404).json({ success: false, error: "Purchase order not found" });
      }
      const actualPay = Math.min(payAmt, po.balanceAmount);
      po.paidAmount += actualPay;
      po.balanceAmount = Math.max(0, po.totalAmount - po.paidAmount);
      po.paymentStatus = po.balanceAmount === 0 ? "Paid" : "Partial";
      const sup = db2.suppliers.find((s) => s.id === po.supplierId);
      if (sup) {
        sup.totalPaid += actualPay;
        sup.outstandingBalance = Math.max(0, sup.outstandingBalance - actualPay);
      }
      db2.payments.unshift({
        id: `pay-${Date.now()}`,
        storeId: DEFAULT_STORE_ID2,
        type: "purchase_payment",
        referenceId: po.id,
        partyId: po.supplierId,
        partyName: po.supplierName,
        amount: actualPay,
        paymentMethod,
        date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        createdBy: "usr-owner-1",
        createdByName: "Store Owner",
        notes: `Installment payment for PO ${po.purchaseNumber}`
      });
      const saved = writeDatabase(db2, "PURCHASE_PAYMENT");
      res.json({ success: true, purchase: po, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/adjustment", (req, res) => {
    try {
      const adj = req.body;
      if (!adj || !adj.medicineId || !adj.batchId) {
        return res.status(400).json({ success: false, error: "Medicine and batch are required for stock adjustment" });
      }
      const db2 = readDatabase();
      const actor = getActorFromReq(req, db2);
      if (actor && actor.role !== "admin" && actor.role !== "pharmacist" && !actor.permissions?.canAdjustStock) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized: You do not have permission to adjust stock"
        });
      }
      const med = db2.medicines.find((m) => m.id === adj.medicineId);
      if (!med) {
        return res.status(404).json({ success: false, error: "Medicine not found" });
      }
      const batch = med.batches.find((b) => b.id === adj.batchId || b.batchNumber === adj.batchNumber);
      if (!batch) {
        return res.status(404).json({ success: false, error: "Batch not found" });
      }
      const prevQty = Number(batch.quantity || 0);
      const newQty = typeof adj.newQuantity === "number" ? Math.max(0, adj.newQuantity) : Math.max(0, prevQty + Number(adj.adjustedQuantity || 0));
      const diff = newQty - prevQty;
      batch.quantity = newQty;
      med.totalQuantity = med.batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
      const adjRecord = {
        ...adj,
        id: adj.id || `adj-${Date.now()}`,
        storeId: DEFAULT_STORE_ID2,
        createdBy: adj.performedBy || actor?.id || "usr-owner-1",
        previousQuantity: prevQty,
        adjustedQuantity: diff,
        newQuantity: newQty,
        timestamp: adj.timestamp || (/* @__PURE__ */ new Date()).toISOString()
      };
      db2.adjustments.unshift(adjRecord);
      db2.stockTransactions.unshift({
        id: `stx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        storeId: DEFAULT_STORE_ID2,
        medicineId: med.id,
        medicineName: med.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        type: "adjustment",
        quantityChange: diff,
        previousQuantity: prevQty,
        newQuantity: newQty,
        referenceId: adjRecord.id,
        createdBy: adjRecord.createdBy,
        createdByName: adjRecord.performedByName || actor?.fullName || "Store User",
        timestamp: adjRecord.timestamp
      });
      db2.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: "STOCK_ADJUSTED",
        description: `Adjusted ${med.name} (${batch.batchNumber}): ${prevQty} -> ${newQty} (${adjRecord.adjustmentType})`,
        userId: adjRecord.createdBy,
        userName: adjRecord.performedByName || "Store User",
        userRole: actor?.role || "admin",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const saved = writeDatabase(db2, "STOCK_ADJUSTED");
      res.json({ success: true, adjustment: adjRecord, medicine: med, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/customer", (req, res) => {
    try {
      const customer = req.body;
      if (!customer || !String(customer.name || "").trim()) {
        return res.status(400).json({ success: false, error: "Customer name is required" });
      }
      const db2 = readDatabase();
      const actor = getActorFromReq(req, db2);
      const custRecord = {
        ...customer,
        id: customer.id || `cust-${Date.now()}`,
        storeId: DEFAULT_STORE_ID2,
        createdBy: customer.createdBy || actor?.id || "usr-owner-1",
        totalPurchases: Number(customer.totalPurchases || 0),
        outstandingBalance: Number(customer.outstandingBalance || 0),
        createdAt: customer.createdAt || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      };
      if (!Array.isArray(db2.deletedIds)) db2.deletedIds = [];
      db2.deletedIds = db2.deletedIds.filter((id) => id !== custRecord.id);
      const idx = db2.customers.findIndex((c) => c.id === custRecord.id);
      if (idx >= 0) db2.customers[idx] = custRecord;
      else db2.customers.unshift(custRecord);
      const saved = writeDatabase(db2, "CUSTOMER_ADDED");
      res.json({ success: true, customer: custRecord, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.put("/api/customer/:id", (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db2 = readDatabase();
      const idx = db2.customers.findIndex((c) => c.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Customer not found" });
      db2.customers[idx] = { ...db2.customers[idx], ...updates, storeId: DEFAULT_STORE_ID2 };
      const saved = writeDatabase(db2, "CUSTOMER_UPDATED");
      res.json({ success: true, customer: db2.customers[idx], data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.delete("/api/customer/:id", (req, res) => {
    try {
      const { id } = req.params;
      const db2 = readDatabase();
      const actor = getActorFromReq(req, db2);
      if (actor && actor.role !== "admin" && !actor.permissions?.canAddCustomer) {
        return res.status(403).json({ success: false, error: "Unauthorized to delete customer" });
      }
      const target = db2.customers.find((c) => c.id === id);
      if (!target) return res.status(404).json({ success: false, error: "Customer not found" });
      db2.customers = db2.customers.filter((c) => c.id !== id);
      if (!Array.isArray(db2.deletedIds)) db2.deletedIds = [];
      if (!db2.deletedIds.includes(id)) db2.deletedIds.push(id);
      const saved = writeDatabase(db2, "CUSTOMER_DELETED");
      res.json({ success: true, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/customer/:id/payment", (req, res) => {
    try {
      const { id } = req.params;
      const { amount, paymentMethod = "Cash" } = req.body;
      const payAmt = Number(amount || 0);
      if (payAmt <= 0) return res.status(400).json({ success: false, error: "Payment amount must be positive" });
      const db2 = readDatabase();
      const cust = db2.customers.find((c) => c.id === id);
      if (!cust) return res.status(404).json({ success: false, error: "Customer not found" });
      const actualPay = Math.min(payAmt, cust.outstandingBalance);
      cust.outstandingBalance = Math.max(0, cust.outstandingBalance - actualPay);
      db2.payments.unshift({
        id: `pay-${Date.now()}`,
        storeId: DEFAULT_STORE_ID2,
        type: "customer_payment",
        referenceId: cust.id,
        partyId: cust.id,
        partyName: cust.name,
        amount: actualPay,
        paymentMethod,
        date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        createdBy: "usr-owner-1",
        createdByName: "Store User",
        notes: `Customer credit recovery from ${cust.name}`
      });
      const saved = writeDatabase(db2, "CUSTOMER_PAYMENT");
      res.json({ success: true, customer: cust, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/supplier", (req, res) => {
    try {
      const supplier = req.body;
      if (!supplier || !String(supplier.companyName || "").trim()) {
        return res.status(400).json({ success: false, error: "Supplier company name is required" });
      }
      const db2 = readDatabase();
      const actor = getActorFromReq(req, db2);
      const supRecord = {
        ...supplier,
        id: supplier.id || `sup-${Date.now()}`,
        storeId: DEFAULT_STORE_ID2,
        createdBy: supplier.createdBy || actor?.id || "usr-owner-1",
        openingBalance: Number(supplier.openingBalance || 0),
        totalPurchases: Number(supplier.totalPurchases || 0),
        totalPaid: Number(supplier.totalPaid || 0),
        outstandingBalance: Number(
          supplier.outstandingBalance !== void 0 ? supplier.outstandingBalance : supplier.openingBalance || 0
        ),
        createdAt: supplier.createdAt || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      };
      if (!Array.isArray(db2.deletedIds)) db2.deletedIds = [];
      db2.deletedIds = db2.deletedIds.filter((id) => id !== supRecord.id);
      const idx = db2.suppliers.findIndex((s) => s.id === supRecord.id);
      if (idx >= 0) db2.suppliers[idx] = supRecord;
      else db2.suppliers.unshift(supRecord);
      const saved = writeDatabase(db2, "SUPPLIER_ADDED");
      res.json({ success: true, supplier: supRecord, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.put("/api/supplier/:id", (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db2 = readDatabase();
      const idx = db2.suppliers.findIndex((s) => s.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Supplier not found" });
      db2.suppliers[idx] = { ...db2.suppliers[idx], ...updates, storeId: DEFAULT_STORE_ID2 };
      const saved = writeDatabase(db2, "SUPPLIER_UPDATED");
      res.json({ success: true, supplier: db2.suppliers[idx], data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.delete("/api/supplier/:id", (req, res) => {
    try {
      const { id } = req.params;
      const db2 = readDatabase();
      const target = db2.suppliers.find((s) => s.id === id);
      if (!target) return res.status(404).json({ success: false, error: "Supplier not found" });
      db2.suppliers = db2.suppliers.filter((s) => s.id !== id);
      if (!Array.isArray(db2.deletedIds)) db2.deletedIds = [];
      if (!db2.deletedIds.includes(id)) db2.deletedIds.push(id);
      const saved = writeDatabase(db2, "SUPPLIER_DELETED");
      res.json({ success: true, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/supplier/:id/payment", (req, res) => {
    try {
      const { id } = req.params;
      const { amount, paymentMethod = "Cash" } = req.body;
      const payAmt = Number(amount || 0);
      if (payAmt <= 0) return res.status(400).json({ success: false, error: "Payment amount must be positive" });
      const db2 = readDatabase();
      const sup = db2.suppliers.find((s) => s.id === id);
      if (!sup) return res.status(404).json({ success: false, error: "Supplier not found" });
      const actualPay = Math.min(payAmt, sup.outstandingBalance);
      sup.totalPaid += actualPay;
      sup.outstandingBalance = Math.max(0, sup.outstandingBalance - actualPay);
      db2.payments.unshift({
        id: `pay-${Date.now()}`,
        storeId: DEFAULT_STORE_ID2,
        type: "supplier_payment",
        referenceId: sup.id,
        partyId: sup.id,
        partyName: sup.companyName,
        amount: actualPay,
        paymentMethod,
        date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        createdBy: "usr-owner-1",
        createdByName: "Store Owner",
        notes: `Direct supplier ledger payment to ${sup.companyName}`
      });
      const saved = writeDatabase(db2, "SUPPLIER_PAYMENT");
      res.json({ success: true, supplier: sup, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/expense", (req, res) => {
    try {
      const expense = req.body;
      if (!expense || !String(expense.description || "").trim() || Number(expense.amount) <= 0) {
        return res.status(400).json({ success: false, error: "Valid expense description and positive amount required" });
      }
      const db2 = readDatabase();
      const actor = getActorFromReq(req, db2);
      const expRecord = {
        ...expense,
        id: expense.id || `exp-${Date.now()}`,
        storeId: DEFAULT_STORE_ID2,
        createdBy: expense.addedBy || actor?.id || "usr-owner-1",
        amount: Number(expense.amount)
      };
      if (!Array.isArray(db2.deletedIds)) db2.deletedIds = [];
      db2.deletedIds = db2.deletedIds.filter((id) => id !== expRecord.id);
      const idx = db2.expenses.findIndex((e) => e.id === expRecord.id);
      if (idx >= 0) db2.expenses[idx] = expRecord;
      else db2.expenses.unshift(expRecord);
      db2.payments.unshift({
        id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        storeId: DEFAULT_STORE_ID2,
        type: "expense_payment",
        referenceId: expRecord.id,
        partyName: expRecord.category,
        amount: expRecord.amount,
        paymentMethod: expRecord.paymentMethod || "Cash",
        date: expRecord.date,
        createdBy: expRecord.createdBy,
        createdByName: expRecord.addedByName || "Store Owner",
        notes: expRecord.description
      });
      const saved = writeDatabase(db2, "EXPENSE_ADDED");
      res.json({ success: true, expense: expRecord, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.put("/api/expense/:id", (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db2 = readDatabase();
      const idx = db2.expenses.findIndex((e) => e.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: "Expense not found" });
      db2.expenses[idx] = {
        ...db2.expenses[idx],
        ...updates,
        amount: updates.amount !== void 0 ? Number(updates.amount) : db2.expenses[idx].amount,
        storeId: DEFAULT_STORE_ID2
      };
      const saved = writeDatabase(db2, "EXPENSE_UPDATED");
      res.json({ success: true, expense: db2.expenses[idx], data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.delete("/api/expense/:id", (req, res) => {
    try {
      const { id } = req.params;
      const db2 = readDatabase();
      const actor = getActorFromReq(req, db2);
      if (actor && actor.role !== "admin" && !actor.permissions?.canViewReports) {
        return res.status(403).json({ success: false, error: "Unauthorized: Only Owner can delete expenses" });
      }
      const target = db2.expenses.find((e) => e.id === id);
      if (!target) return res.status(404).json({ success: false, error: "Expense not found" });
      db2.expenses = db2.expenses.filter((e) => e.id !== id);
      if (!Array.isArray(db2.deletedIds)) db2.deletedIds = [];
      if (!db2.deletedIds.includes(id)) db2.deletedIds.push(id);
      const saved = writeDatabase(db2, "EXPENSE_DELETED");
      res.json({ success: true, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.put("/api/settings", (req, res) => {
    try {
      const db2 = readDatabase();
      const actor = getActorFromReq(req, db2);
      if (actor && actor.role !== "admin") {
        return res.status(403).json({ success: false, error: "Unauthorized: Only Store Owner can modify Store Settings" });
      }
      db2.settings = { ...db2.settings, ...req.body };
      const saved = writeDatabase(db2, "SETTINGS_UPDATED");
      res.json({ success: true, settings: saved.settings, data: saved });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.get("/api/backups", (_req, res) => {
    try {
      const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith(".json"));
      const snapshots = files.map((file) => {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          id: file.replace(".json", ""),
          filename: file,
          timestamp: stats.mtime.toISOString(),
          sizeBytes: stats.size
        };
      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json({ success: true, snapshots });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/backups", (req, res) => {
    try {
      const { comment } = req.body || {};
      const result = createBackupSnapshot(comment);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/backups/restore", (req, res) => {
    try {
      const { filename } = req.body;
      if (!filename) {
        return res.status(400).json({ success: false, error: "Filename is required" });
      }
      const filePath = path.join(BACKUPS_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: "Backup snapshot file not found" });
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      const snapshotData = parsed.data || parsed;
      if (!snapshotData.medicines || !snapshotData.sales) {
        return res.status(400).json({ success: false, error: "Corrupt or invalid backup snapshot" });
      }
      createBackupSnapshot("Auto safety snapshot before restore");
      writeDatabase(snapshotData, "BACKUP_RESTORED");
      res.json({ success: true, message: "Database restored successfully" });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.get("/api/staff", async (_req, res) => {
    try {
      const db2 = await readLatestDatabaseWithMongo();
      res.json({ success: true, staffMembers: db2.staffMembers });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/staff", async (req, res) => {
    try {
      const db2 = await readLatestDatabaseWithMongo();
      const actor = getActorFromReq(req, db2);
      if (actor && actor.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Unauthorized: Only Store Owner can create staff accounts"
        });
      }
      const newStaff = req.body;
      if (!newStaff || !newStaff.username || !newStaff.fullName) {
        return res.status(400).json({ success: false, error: "Full name and username are required" });
      }
      const cleanUsername = String(newStaff.username).trim().toLowerCase().replace(/^@/, "");
      const plainPassword = String(newStaff.password || "seller123").trim();
      const existingIdx = db2.staffMembers.findIndex(
        (u) => u.id === newStaff.id || u.username.toLowerCase() === cleanUsername
      );
      const userToSave = {
        ...newStaff,
        id: existingIdx >= 0 ? db2.staffMembers[existingIdx].id : newStaff.id || `usr-staff-${Date.now()}`,
        storeId: DEFAULT_STORE_ID2,
        createdBy: "usr-owner-1",
        username: cleanUsername,
        password: plainPassword,
        passwordHash: hashPassword(plainPassword),
        pin: String(newStaff.pin || "5678").trim(),
        status: newStaff.status || "active",
        joiningDate: newStaff.joiningDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      };
      if (existingIdx >= 0) {
        db2.staffMembers[existingIdx] = userToSave;
      } else {
        db2.staffMembers.push(userToSave);
      }
      if (!Array.isArray(db2.deletedIds)) db2.deletedIds = [];
      db2.deletedIds = db2.deletedIds.filter((delId) => delId !== userToSave.id);
      db2.staffMembers = sanitizeStaffAccounts(db2.staffMembers);
      db2.auditLogs.unshift({
        id: `log-${Date.now()}`,
        action: "STAFF_CREATED",
        description: `Owner saved staff account for ${userToSave.fullName} (@${userToSave.username})`,
        userId: "usr-owner-1",
        userName: "Dr. Abdul Rehman (Owner)",
        userRole: "admin",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const saved = writeDatabase(db2, "STAFF_UPDATED");
      if (mongoConnected) {
        await syncCollectionsToMongo(saved);
      }
      res.json({ success: true, user: userToSave, staffMembers: saved.staffMembers });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.put("/api/staff/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db2 = await readLatestDatabaseWithMongo();
      const actor = getActorFromReq(req, db2);
      if (actor && actor.role !== "admin") {
        if (actor.id !== id || updates.permissions || updates.role || updates.status) {
          return res.status(403).json({
            success: false,
            error: "Unauthorized: Staff cannot modify roles, permissions, or other accounts"
          });
        }
      }
      const idx = db2.staffMembers.findIndex((u) => u.id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: "Staff account not found" });
      }
      const nextPassword = updates.password !== void 0 ? String(updates.password).trim() : db2.staffMembers[idx].password;
      db2.staffMembers[idx] = {
        ...db2.staffMembers[idx],
        ...updates,
        password: nextPassword,
        passwordHash: nextPassword ? hashPassword(nextPassword) : db2.staffMembers[idx].passwordHash
      };
      db2.staffMembers = sanitizeStaffAccounts(db2.staffMembers);
      const saved = writeDatabase(db2, "STAFF_UPDATED");
      if (mongoConnected) {
        await syncCollectionsToMongo(saved);
      }
      res.json({ success: true, user: saved.staffMembers[idx], staffMembers: saved.staffMembers });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.delete("/api/staff/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const db2 = await readLatestDatabaseWithMongo();
      const actor = getActorFromReq(req, db2);
      if (actor && actor.role !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Unauthorized: Only Store Owner can delete staff accounts"
        });
      }
      if (id === "all-others") {
        db2.staffMembers = sanitizeStaffAccounts([]);
        if (mongoClientInstance && mongoConnected) {
          await mongoClientInstance.db(MONGO_DB_NAME).collection("staff_accounts").deleteMany({ id: { $ne: "usr-owner-1" } });
        }
      } else {
        if (id === "usr-owner-1") {
          return res.status(403).json({ success: false, error: "Owner account cannot be deleted" });
        }
        db2.staffMembers = sanitizeStaffAccounts(db2.staffMembers.filter((u) => u.id !== id));
        if (!Array.isArray(db2.deletedIds)) db2.deletedIds = [];
        if (!db2.deletedIds.includes(id)) db2.deletedIds.push(id);
        if (mongoClientInstance && mongoConnected) {
          await mongoClientInstance.db(MONGO_DB_NAME).collection("staff_accounts").deleteOne({ id });
        }
      }
      const saved = writeDatabase(db2, "STAFF_DELETED");
      if (mongoConnected) {
        await syncCollectionsToMongo(saved);
      }
      res.json({ success: true, staffMembers: saved.staffMembers });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username) {
        return res.status(400).json({ success: false, error: "Username is required" });
      }
      const rawInput = String(username).trim().toLowerCase().replace(/^@/, "");
      const cleanCompact = rawInput.replace(/\s+/g, "");
      const cleanPass = String(password || "").trim();
      const incomingHash = hashPassword(cleanPass);
      const db2 = await readLatestDatabaseWithMongo();
      const user = db2.staffMembers.find((u) => {
        const uName = (u.username || "").trim().toLowerCase().replace(/^@/, "");
        const uFull = (u.fullName || "").trim().toLowerCase();
        const uCompact = uFull.replace(/[^a-z0-9]/g, "");
        const uEmail = (u.email || "").trim().toLowerCase();
        return uName === rawInput || uName === cleanCompact || uFull === rawInput || uCompact === cleanCompact || uEmail === rawInput || u.id === "usr-owner-1" && ["admin", "owner", "abdulrehman"].includes(cleanCompact);
      });
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Account not found. Enter "admin" for Owner or a valid staff username created by the Owner.'
        });
      }
      if (user.status !== "active") {
        return res.status(403).json({ success: false, error: "This staff account is deactivated." });
      }
      const expectedPassword = user.id === "usr-owner-1" ? (user.password || "admin").trim() : (user.password || "").trim();
      const expectedHash = user.passwordHash || hashPassword(expectedPassword);
      if (expectedPassword && cleanPass !== expectedPassword && incomingHash !== expectedHash) {
        return res.status(401).json({
          success: false,
          error: user.id === "usr-owner-1" ? "Invalid password for Owner account." : `Incorrect password for @${user.username}.`
        });
      }
      user.lastLogin = (/* @__PURE__ */ new Date()).toISOString();
      writeDatabase(db2, "USER_LOGIN");
      res.json({ success: true, user, staffMembers: db2.staffMembers });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/auth/pin-login", async (req, res) => {
    try {
      const { pin, username } = req.body;
      if (!pin) {
        return res.status(400).json({ success: false, error: "PIN is required" });
      }
      const db2 = await readLatestDatabaseWithMongo();
      const user = db2.staffMembers.find((u) => {
        if (u.id === "usr-owner-1") return false;
        const matchesPin = u.pin === pin;
        if (username) {
          return matchesPin && (u.id.toLowerCase() === username.toLowerCase() || u.username.toLowerCase() === username.toLowerCase() || u.fullName.toLowerCase() === username.toLowerCase());
        }
        return matchesPin;
      });
      if (!user) {
        return res.status(401).json({ success: false, error: "Invalid 4-digit PIN" });
      }
      if (user.status !== "active") {
        return res.status(403).json({ success: false, error: "Account is deactivated" });
      }
      user.lastLogin = (/* @__PURE__ */ new Date()).toISOString();
      writeDatabase(db2, "USER_LOGIN");
      res.json({ success: true, user, staffMembers: db2.staffMembers });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  const distPath = path.join(__dirname, "dist");
  const isProdMode = process.env.NODE_ENV === "production" || process.env.VITE_DEV !== "true" && fs.existsSync(path.join(distPath, "index.html"));
  if (!isProdMode) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }
  httpServer.listen(PORT, () => {
    console.log(`PharmaCare ERP & POS server + WebSocket running at http://localhost:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
export {
  hashPassword
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
