import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  stores,
  staffMembers,
  medicineCategories,
  medicines,
  suppliers,
  customers,
  purchases,
  sales,
  expenses,
  cashMemos,
  auditLogs,
  storeSettings,
} from './schema.ts';

const DEFAULT_STORE_ID = 'store-1';

export async function loadStateFromCloudSql(): Promise<any | null> {
  if (!process.env.SQL_HOST) return null;
  try {
    const rows = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.storeId, DEFAULT_STORE_ID))
      .limit(1);

    if (rows.length > 0 && rows[0].stateSnapshot) {
      return rows[0].stateSnapshot;
    }
    return null;
  } catch (error: any) {
    console.error('[Database Error]:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    return null;
  }
}

export async function syncStateToCloudSql(state: any): Promise<boolean> {
  if (!process.env.SQL_HOST || !state) return false;
  try {
    const s = state.settings || {};

    // 1. Upsert store_settings + state_snapshot
    await db
      .insert(storeSettings)
      .values({
        id: 'settings-1',
        storeId: DEFAULT_STORE_ID,
        storeName: String(s.storeName || 'PharmaCare Medical Store'),
        tagline: String(s.tagline || ''),
        drugLicenseNumber: String(s.drugLicenseNumber || ''),
        taxRegistrationNumber: String(s.taxRegistrationNumber || ''),
        storeAddress: String(s.storeAddress || ''),
        city: String(s.city || ''),
        phone: String(s.phone || ''),
        email: String(s.email || ''),
        currencySymbol: String(s.currencySymbol || 'Rs.'),
        defaultTaxRate: String(s.defaultTaxRate ?? 0),
        lowStockAlertDefault: Number(s.lowStockAlertDefault ?? 15),
        expiryWarningDays: Number(s.expiryWarningDays ?? 90),
        invoicePrefix: String(s.invoicePrefix || 'INV-'),
        receiptFooterNote: String(s.receiptFooterNote || ''),
        printerPaperSize: String(s.printerPaperSize || '80mm'),
        stateSnapshot: state,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: storeSettings.id,
        set: {
          storeName: String(s.storeName || 'PharmaCare Medical Store'),
          tagline: String(s.tagline || ''),
          drugLicenseNumber: String(s.drugLicenseNumber || ''),
          taxRegistrationNumber: String(s.taxRegistrationNumber || ''),
          storeAddress: String(s.storeAddress || ''),
          city: String(s.city || ''),
          phone: String(s.phone || ''),
          email: String(s.email || ''),
          currencySymbol: String(s.currencySymbol || 'Rs.'),
          defaultTaxRate: String(s.defaultTaxRate ?? 0),
          lowStockAlertDefault: Number(s.lowStockAlertDefault ?? 15),
          expiryWarningDays: Number(s.expiryWarningDays ?? 90),
          invoicePrefix: String(s.invoicePrefix || 'INV-'),
          receiptFooterNote: String(s.receiptFooterNote || ''),
          printerPaperSize: String(s.printerPaperSize || '80mm'),
          stateSnapshot: state,
          updatedAt: new Date(),
        },
      });

    // 2. Upsert stores
    if (Array.isArray(state.stores) && state.stores.length > 0) {
      for (const st of state.stores) {
        await db
          .insert(stores)
          .values({
            id: String(st.id || DEFAULT_STORE_ID),
            name: String(st.name || s.storeName || 'PharmaCare Medical Store'),
            ownerId: String(st.ownerId || 'usr-owner-1'),
            drugLicenseNumber: String(st.drugLicenseNumber || ''),
            taxRegistrationNumber: String(st.taxRegistrationNumber || ''),
            address: String(st.address || ''),
            city: String(st.city || ''),
            phone: String(st.phone || ''),
            email: String(st.email || ''),
          })
          .onConflictDoUpdate({
            target: stores.id,
            set: {
              name: String(st.name || s.storeName || 'PharmaCare Medical Store'),
              drugLicenseNumber: String(st.drugLicenseNumber || ''),
              taxRegistrationNumber: String(st.taxRegistrationNumber || ''),
              address: String(st.address || ''),
              city: String(st.city || ''),
              phone: String(st.phone || ''),
              email: String(st.email || ''),
            },
          });
      }
    }

    // 3. Upsert staff_members
    if (Array.isArray(state.staffMembers)) {
      for (const u of state.staffMembers) {
        await db
          .insert(staffMembers)
          .values({
            id: String(u.id),
            storeId: String(u.storeId || DEFAULT_STORE_ID),
            name: String(u.name || u.username),
            username: String(u.username),
            password: String(u.password || ''),
            passwordHash: String(u.passwordHash || ''),
            role: String(u.role || 'Cashier / Seller'),
            phone: String(u.phone || ''),
            email: String(u.email || ''),
            cnic: String(u.cnic || ''),
            joiningDate: String(u.joiningDate || ''),
            salary: String(u.salary ?? 0),
            status: String(u.status || 'active'),
            lastLogin: String(u.lastLogin || ''),
            permissions: u.permissions || {},
            createdBy: String(u.createdBy || 'usr-owner-1'),
          })
          .onConflictDoUpdate({
            target: staffMembers.id,
            set: {
              name: String(u.name || u.username),
              password: String(u.password || ''),
              passwordHash: String(u.passwordHash || ''),
              role: String(u.role || 'Cashier / Seller'),
              phone: String(u.phone || ''),
              email: String(u.email || ''),
              status: String(u.status || 'active'),
              lastLogin: String(u.lastLogin || ''),
              permissions: u.permissions || {},
            },
          });
      }
    }

    // 4. Upsert categories
    if (Array.isArray(state.categories)) {
      for (const cat of state.categories) {
        await db
          .insert(medicineCategories)
          .values({
            id: String(cat.id),
            storeId: String(cat.storeId || DEFAULT_STORE_ID),
            name: String(cat.name),
            createdBy: String(cat.createdBy || 'usr-owner-1'),
          })
          .onConflictDoUpdate({
            target: medicineCategories.id,
            set: { name: String(cat.name) },
          });
      }
    }

    // 5. Upsert medicines
    if (Array.isArray(state.medicines)) {
      for (const m of state.medicines) {
        await db
          .insert(medicines)
          .values({
            id: String(m.id),
            storeId: String(m.storeId || DEFAULT_STORE_ID),
            name: String(m.name),
            genericName: String(m.genericName || ''),
            brandManufacturer: String(m.brandManufacturer || ''),
            category: String(m.category || 'General'),
            dosageForm: String(m.dosageForm || 'Tablet'),
            strength: String(m.strength || ''),
            unitType: String(m.unitType || 'Pack'),
            unitsPerPack: Number(m.unitsPerPack ?? 10),
            rackLocation: String(m.rackLocation || ''),
            minimumStockThreshold: Number(m.minimumStockThreshold ?? 15),
            prescriptionRequired: Boolean(m.prescriptionRequired),
            taxPercentage: String(m.taxPercentage ?? 0),
            batches: Array.isArray(m.batches) ? m.batches : [],
            totalQuantity: Number(m.totalQuantity ?? 0),
            notes: String(m.notes || ''),
            createdBy: String(m.createdBy || 'usr-owner-1'),
          })
          .onConflictDoUpdate({
            target: medicines.id,
            set: {
              name: String(m.name),
              genericName: String(m.genericName || ''),
              brandManufacturer: String(m.brandManufacturer || ''),
              category: String(m.category || 'General'),
              dosageForm: String(m.dosageForm || 'Tablet'),
              strength: String(m.strength || ''),
              rackLocation: String(m.rackLocation || ''),
              minimumStockThreshold: Number(m.minimumStockThreshold ?? 15),
              batches: Array.isArray(m.batches) ? m.batches : [],
              totalQuantity: Number(m.totalQuantity ?? 0),
            },
          });
      }
    }

    // 6. Upsert suppliers
    if (Array.isArray(state.suppliers)) {
      for (const sup of state.suppliers) {
        await db
          .insert(suppliers)
          .values({
            id: String(sup.id),
            storeId: String(sup.storeId || DEFAULT_STORE_ID),
            companyName: String(sup.companyName || ''),
            contactPerson: String(sup.contactPerson || ''),
            phone: String(sup.phone || ''),
            email: String(sup.email || ''),
            address: String(sup.address || ''),
            city: String(sup.city || ''),
            ntnOrGstNumber: String(sup.ntnOrGstNumber || ''),
            paymentTerms: String(sup.paymentTerms || 'Cash'),
            openingBalance: String(sup.openingBalance ?? 0),
            outstandingBalance: String(sup.outstandingBalance ?? 0),
            createdBy: String(sup.createdBy || 'usr-owner-1'),
          })
          .onConflictDoUpdate({
            target: suppliers.id,
            set: {
              companyName: String(sup.companyName || ''),
              contactPerson: String(sup.contactPerson || ''),
              phone: String(sup.phone || ''),
              outstandingBalance: String(sup.outstandingBalance ?? 0),
            },
          });
      }
    }

    // 7. Upsert customers
    if (Array.isArray(state.customers)) {
      for (const cust of state.customers) {
        await db
          .insert(customers)
          .values({
            id: String(cust.id),
            storeId: String(cust.storeId || DEFAULT_STORE_ID),
            name: String(cust.name || ''),
            phone: String(cust.phone || ''),
            address: String(cust.address || ''),
            cnicOrNotes: String(cust.cnicOrNotes || ''),
            creditBalance: String(cust.creditBalance ?? 0),
            totalPurchasesCount: Number(cust.totalPurchasesCount ?? 0),
            totalSpent: String(cust.totalSpent ?? 0),
            lastVisit: String(cust.lastVisit || ''),
            createdBy: String(cust.createdBy || 'usr-owner-1'),
          })
          .onConflictDoUpdate({
            target: customers.id,
            set: {
              name: String(cust.name || ''),
              phone: String(cust.phone || ''),
              address: String(cust.address || ''),
              creditBalance: String(cust.creditBalance ?? 0),
              totalPurchasesCount: Number(cust.totalPurchasesCount ?? 0),
              totalSpent: String(cust.totalSpent ?? 0),
              lastVisit: String(cust.lastVisit || ''),
            },
          });
      }
    }

    // 8. Upsert purchases
    if (Array.isArray(state.purchases)) {
      for (const p of state.purchases) {
        await db
          .insert(purchases)
          .values({
            id: String(p.id),
            storeId: String(p.storeId || DEFAULT_STORE_ID),
            purchaseOrderNumber: String(p.purchaseOrderNumber || ''),
            supplierInvoiceNumber: String(p.supplierInvoiceNumber || ''),
            supplierId: String(p.supplierId || ''),
            supplierName: String(p.supplierName || ''),
            purchaseDate: String(p.purchaseDate || ''),
            items: Array.isArray(p.items) ? p.items : [],
            subtotal: String(p.subtotal ?? 0),
            discountTotal: String(p.discountTotal ?? 0),
            taxTotal: String(p.taxTotal ?? 0),
            shippingCharges: String(p.shippingCharges ?? 0),
            grandTotal: String(p.grandTotal ?? 0),
            amountPaid: String(p.amountPaid ?? 0),
            balanceDue: String(p.balanceDue ?? 0),
            paymentStatus: String(p.paymentStatus || 'Paid'),
            paymentMethod: String(p.paymentMethod || 'Cash'),
            notes: String(p.notes || ''),
            createdBy: String(p.createdBy || 'usr-owner-1'),
          })
          .onConflictDoUpdate({
            target: purchases.id,
            set: {
              amountPaid: String(p.amountPaid ?? 0),
              balanceDue: String(p.balanceDue ?? 0),
              paymentStatus: String(p.paymentStatus || 'Paid'),
            },
          });
      }
    }

    // 9. Upsert sales
    if (Array.isArray(state.sales)) {
      for (const sl of state.sales) {
        await db
          .insert(sales)
          .values({
            id: String(sl.id),
            storeId: String(sl.storeId || DEFAULT_STORE_ID),
            invoiceNumber: String(sl.invoiceNumber || ''),
            date: String(sl.date || ''),
            time: String(sl.time || ''),
            customerId: sl.customerId ? String(sl.customerId) : null,
            customerName: String(sl.customerName || 'Walk-in Customer'),
            customerPhone: String(sl.customerPhone || ''),
            doctorName: String(sl.doctorName || ''),
            prescriptionNumber: String(sl.prescriptionNumber || ''),
            staffId: String(sl.staffId || 'usr-owner-1'),
            staffName: String(sl.staffName || 'Owner'),
            items: Array.isArray(sl.items) ? sl.items : [],
            subtotal: String(sl.subtotal ?? 0),
            discountTotal: String(sl.discountTotal ?? 0),
            taxTotal: String(sl.taxTotal ?? 0),
            grandTotal: String(sl.grandTotal ?? 0),
            totalCost: String(sl.totalCost ?? 0),
            netProfit: String(sl.netProfit ?? 0),
            paymentMethod: String(sl.paymentMethod || 'Cash'),
            amountPaid: String(sl.amountPaid ?? 0),
            changeGiven: String(sl.changeGiven ?? 0),
            status: String(sl.status || 'completed'),
            createdBy: String(sl.createdBy || sl.staffId || 'usr-owner-1'),
          })
          .onConflictDoUpdate({
            target: sales.id,
            set: {
              status: String(sl.status || 'completed'),
              amountPaid: String(sl.amountPaid ?? 0),
            },
          });
      }
    }

    // 10. Upsert expenses
    if (Array.isArray(state.expenses)) {
      for (const ex of state.expenses) {
        await db
          .insert(expenses)
          .values({
            id: String(ex.id),
            storeId: String(ex.storeId || DEFAULT_STORE_ID),
            date: String(ex.date || ''),
            category: String(ex.category || 'Miscellaneous'),
            description: String(ex.description || ''),
            amount: String(ex.amount ?? 0),
            paymentMethod: String(ex.paymentMethod || 'Cash'),
            referenceNumber: String(ex.referenceNumber || ''),
            addedBy: String(ex.addedBy || 'Owner'),
            createdBy: String(ex.createdBy || 'usr-owner-1'),
          })
          .onConflictDoUpdate({
            target: expenses.id,
            set: {
              category: String(ex.category || 'Miscellaneous'),
              description: String(ex.description || ''),
              amount: String(ex.amount ?? 0),
              paymentMethod: String(ex.paymentMethod || 'Cash'),
            },
          });
      }
    }

    // 11. Upsert cash_memos
    if (Array.isArray(state.cashMemos)) {
      for (const memo of state.cashMemos) {
        await db
          .insert(cashMemos)
          .values({
            id: String(memo.id),
            storeId: String(memo.storeId || DEFAULT_STORE_ID),
            saleId: String(memo.saleId),
            invoiceNumber: String(memo.invoiceNumber),
            date: String(memo.date || ''),
            time: String(memo.time || ''),
            createdBy: String(memo.createdBy || 'usr-owner-1'),
            createdByName: String(memo.createdByName || 'Store Dispenser'),
            customerId: memo.customerId ? String(memo.customerId) : null,
            customerName: String(memo.customerName || 'Walk-in Customer'),
            customerPhone: String(memo.customerPhone || ''),
            subtotal: String(memo.subtotal ?? 0),
            discountTotal: String(memo.discountTotal ?? 0),
            taxTotal: String(memo.taxTotal ?? 0),
            grandTotal: String(memo.grandTotal ?? 0),
            amountPaid: String(memo.amountPaid ?? 0),
            changeGiven: String(memo.changeGiven ?? 0),
            paymentMethod: String(memo.paymentMethod || 'Cash'),
            itemsCount: Number(memo.itemsCount ?? 0),
            status: String(memo.status || 'completed'),
          })
          .onConflictDoUpdate({
            target: cashMemos.id,
            set: {
              status: String(memo.status || 'completed'),
            },
          });
      }
    }

    // 12. Upsert recent audit_logs (top 100)
    if (Array.isArray(state.auditLogs)) {
      for (const log of state.auditLogs.slice(0, 100)) {
        await db
          .insert(auditLogs)
          .values({
            id: String(log.id),
            storeId: String(log.storeId || DEFAULT_STORE_ID),
            timestamp: String(log.timestamp || ''),
            userId: String(log.userId || 'usr-owner-1'),
            userName: String(log.userName || 'Owner'),
            userRole: String(log.userRole || 'owner'),
            action: String(log.action || ''),
            module: String(log.module || 'System'),
            details: String(log.details || ''),
          })
          .onConflictDoNothing();
      }
    }

    return true;
  } catch (error: any) {
    console.error('[Database Error]:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    return false;
  }
}
