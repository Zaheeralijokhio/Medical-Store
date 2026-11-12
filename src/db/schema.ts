import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

// 1. Stores
export const stores = pgTable('stores', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull(),
  drugLicenseNumber: text('drug_license_number'),
  taxRegistrationNumber: text('tax_registration_number'),
  address: text('address'),
  city: text('city'),
  phone: text('phone'),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Users (Firebase Auth + Store Users)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  storeId: text('store_id').default('store-1'),
  role: text('role').default('Cashier / Seller'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Staff Accounts
export const staffMembers = pgTable('staff_members', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  password: text('password'),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('Cashier / Seller'),
  phone: text('phone'),
  email: text('email'),
  cnic: text('cnic'),
  joiningDate: text('joining_date'),
  salary: numeric('salary', { precision: 12, scale: 2 }).default('0'),
  status: text('status').notNull().default('active'),
  lastLogin: text('last_login'),
  permissions: jsonb('permissions').default({}),
  createdBy: text('created_by').default('usr-owner-1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Staff Permissions
export const staffPermissions = pgTable('staff_permissions', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  role: text('role').notNull(),
  pos: boolean('pos').default(true),
  inventoryView: boolean('inventory_view').default(true),
  inventoryEdit: boolean('inventory_edit').default(false),
  purchases: boolean('purchases').default(false),
  salesHistory: boolean('sales_history').default(true),
  customers: boolean('customers').default(true),
  suppliers: boolean('suppliers').default(false),
  expenses: boolean('expenses').default(false),
  reports: boolean('reports').default(false),
  staff: boolean('staff').default(false),
  settings: boolean('settings').default(false),
});

// 5. Medicine Categories
export const medicineCategories = pgTable('medicine_categories', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: text('created_by').default('usr-owner-1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Suppliers
export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  companyName: text('company_name').notNull(),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  city: text('city'),
  ntnOrGstNumber: text('ntn_or_gst_number'),
  paymentTerms: text('payment_terms').default('Cash'),
  openingBalance: numeric('opening_balance', { precision: 12, scale: 2 }).default('0'),
  outstandingBalance: numeric('outstanding_balance', { precision: 12, scale: 2 }).default('0'),
  createdBy: text('created_by').default('usr-owner-1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Customers
export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  cnicOrNotes: text('cnic_or_notes'),
  creditBalance: numeric('credit_balance', { precision: 12, scale: 2 }).default('0'),
  totalPurchasesCount: integer('total_purchases_count').default(0),
  totalSpent: numeric('total_spent', { precision: 12, scale: 2 }).default('0'),
  lastVisit: text('last_visit'),
  createdBy: text('created_by').default('usr-owner-1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Medicines
export const medicines = pgTable('medicines', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  name: text('name').notNull(),
  genericName: text('generic_name'),
  brandManufacturer: text('brand_manufacturer'),
  category: text('category').notNull(),
  dosageForm: text('dosage_form').default('Tablet'),
  strength: text('strength'),
  unitType: text('unit_type').default('Pack'),
  unitsPerPack: integer('units_per_pack').default(10),
  rackLocation: text('rack_location'),
  minimumStockThreshold: integer('minimum_stock_threshold').default(15),
  prescriptionRequired: boolean('prescription_required').default(false),
  taxPercentage: numeric('tax_percentage', { precision: 5, scale: 2 }).default('0'),
  batches: jsonb('batches').default([]),
  totalQuantity: integer('total_quantity').default(0),
  notes: text('notes'),
  createdBy: text('created_by').default('usr-owner-1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Purchases
export const purchases = pgTable('purchases', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  purchaseOrderNumber: text('purchase_order_number').notNull(),
  supplierInvoiceNumber: text('supplier_invoice_number'),
  supplierId: text('supplier_id').notNull(),
  supplierName: text('supplier_name').notNull(),
  purchaseDate: text('purchase_date').notNull(),
  items: jsonb('items').default([]),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0'),
  discountTotal: numeric('discount_total', { precision: 12, scale: 2 }).default('0'),
  taxTotal: numeric('tax_total', { precision: 12, scale: 2 }).default('0'),
  shippingCharges: numeric('shipping_charges', { precision: 12, scale: 2 }).default('0'),
  grandTotal: numeric('grand_total', { precision: 12, scale: 2 }).default('0'),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).default('0'),
  balanceDue: numeric('balance_due', { precision: 12, scale: 2 }).default('0'),
  paymentStatus: text('payment_status').default('Paid'),
  paymentMethod: text('payment_method').default('Cash'),
  notes: text('notes'),
  createdBy: text('created_by').default('usr-owner-1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Purchase Items
export const purchaseItems = pgTable('purchase_items', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  purchaseId: text('purchase_id').notNull(),
  medicineId: text('medicine_id').notNull(),
  medicineName: text('medicine_name').notNull(),
  batchNumber: text('batch_number').notNull(),
  expiryDate: text('expiry_date').notNull(),
  quantity: integer('quantity').notNull(),
  bonusQuantity: integer('bonus_quantity').default(0),
  purchasePricePerUnit: numeric('purchase_price_per_unit', { precision: 12, scale: 2 }).default('0'),
  sellingPricePerUnit: numeric('selling_price_per_unit', { precision: 12, scale: 2 }).default('0'),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).default('0'),
  taxPercent: numeric('tax_percent', { precision: 5, scale: 2 }).default('0'),
  lineTotal: numeric('line_total', { precision: 12, scale: 2 }).default('0'),
});

// 11. Sales
export const sales = pgTable('sales', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  invoiceNumber: text('invoice_number').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  customerId: text('customer_id'),
  customerName: text('customer_name').default('Walk-in Customer'),
  customerPhone: text('customer_phone'),
  doctorName: text('doctor_name'),
  prescriptionNumber: text('prescription_number'),
  staffId: text('staff_id').notNull(),
  staffName: text('staff_name').notNull(),
  items: jsonb('items').default([]),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0'),
  discountTotal: numeric('discount_total', { precision: 12, scale: 2 }).default('0'),
  taxTotal: numeric('tax_total', { precision: 12, scale: 2 }).default('0'),
  grandTotal: numeric('grand_total', { precision: 12, scale: 2 }).default('0'),
  totalCost: numeric('total_cost', { precision: 12, scale: 2 }).default('0'),
  netProfit: numeric('net_profit', { precision: 12, scale: 2 }).default('0'),
  paymentMethod: text('payment_method').default('Cash'),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).default('0'),
  changeGiven: numeric('change_given', { precision: 12, scale: 2 }).default('0'),
  status: text('status').default('completed'),
  createdBy: text('created_by').default('usr-owner-1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Sale Items
export const saleItems = pgTable('sale_items', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  saleId: text('sale_id').notNull(),
  medicineId: text('medicine_id').notNull(),
  medicineName: text('medicine_name').notNull(),
  genericName: text('generic_name'),
  strength: text('strength'),
  dosageForm: text('dosage_form'),
  batchId: text('batch_id'),
  batchNumber: text('batch_number'),
  expiryDate: text('expiry_date'),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).default('0'),
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }).default('0'),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).default('0'),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).default('0'),
  taxPercent: numeric('tax_percent', { precision: 5, scale: 2 }).default('0'),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0'),
  netTotal: numeric('net_total', { precision: 12, scale: 2 }).default('0'),
});

// 13. Stock Transactions
export const stockTransactions = pgTable('stock_transactions', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  date: text('date').notNull(),
  medicineId: text('medicine_id').notNull(),
  medicineName: text('medicine_name').notNull(),
  batchId: text('batch_id'),
  batchNumber: text('batch_number'),
  type: text('type').notNull(),
  quantityChange: integer('quantity_change').notNull(),
  previousQuantity: integer('previous_quantity').default(0),
  newQuantity: integer('new_quantity').default(0),
  referenceId: text('reference_id'),
  notes: text('notes'),
  createdBy: text('created_by').default('usr-owner-1'),
  createdByName: text('created_by_name'),
});

// 14. Expenses
export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  date: text('date').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').default('Cash'),
  referenceNumber: text('reference_number'),
  addedBy: text('added_by').notNull(),
  createdBy: text('created_by').default('usr-owner-1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 15. Payments
export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  date: text('date').notNull(),
  type: text('type').notNull(),
  partyId: text('party_id').notNull(),
  partyName: text('party_name').notNull(),
  referenceId: text('reference_id'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').default('Cash'),
  notes: text('notes'),
  createdBy: text('created_by').default('usr-owner-1'),
  createdByName: text('created_by_name'),
});

// 16. Cash Memos / Invoices
export const cashMemos = pgTable('cash_memos', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  saleId: text('sale_id').notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  createdBy: text('created_by').notNull(),
  createdByName: text('created_by_name').notNull(),
  customerId: text('customer_id'),
  customerName: text('customer_name').default('Walk-in Customer'),
  customerPhone: text('customer_phone'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0'),
  discountTotal: numeric('discount_total', { precision: 12, scale: 2 }).default('0'),
  taxTotal: numeric('tax_total', { precision: 12, scale: 2 }).default('0'),
  grandTotal: numeric('grand_total', { precision: 12, scale: 2 }).default('0'),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).default('0'),
  changeGiven: numeric('change_given', { precision: 12, scale: 2 }).default('0'),
  paymentMethod: text('payment_method').default('Cash'),
  itemsCount: integer('items_count').default(0),
  status: text('status').default('completed'),
});

// 17. Activity Logs
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().default('store-1'),
  timestamp: text('timestamp').notNull(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  userRole: text('user_role').notNull(),
  action: text('action').notNull(),
  module: text('module').notNull(),
  details: text('details').notNull(),
});

// 18. Store Settings & Primary State Snapshot
export const storeSettings = pgTable('store_settings', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().unique().default('store-1'),
  storeName: text('store_name').notNull(),
  tagline: text('tagline'),
  drugLicenseNumber: text('drug_license_number'),
  taxRegistrationNumber: text('tax_registration_number'),
  storeAddress: text('store_address'),
  city: text('city'),
  phone: text('phone'),
  email: text('email'),
  currencySymbol: text('currency_symbol').default('Rs.'),
  defaultTaxRate: numeric('default_tax_rate', { precision: 5, scale: 2 }).default('0'),
  lowStockAlertDefault: integer('low_stock_alert_default').default(15),
  expiryWarningDays: integer('expiry_warning_days').default(90),
  invoicePrefix: text('invoice_prefix').default('INV-'),
  receiptFooterNote: text('receipt_footer_note'),
  printerPaperSize: text('printer_paper_size').default('80mm'),
  stateSnapshot: jsonb('state_snapshot'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
