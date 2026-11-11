/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Medicine, MedicineBatch, StockStatusType } from '../types/pharmacy';

// Formats number to PKR currency: Rs. 1,250.00
export function formatPKR(amount: number | undefined | null, includeDecimals = true): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rs. 0';
  return 'Rs. ' + amount.toLocaleString('en-PK', {
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  });
}

// Calculates days remaining until an expiry date (negative if expired)
export function getDaysUntilExpiry(expiryDateStr: string): number {
  if (!expiryDateStr) return 9999;
  const expiry = new Date(expiryDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Checks if a date is strictly before today
export function isExpired(expiryDateStr: string): boolean {
  return getDaysUntilExpiry(expiryDateStr) < 0;
}

// Checks if a date expires within the threshold (e.g. 90 days) but is not yet expired
export function isNearExpiry(expiryDateStr: string, alertDays = 90): boolean {
  const days = getDaysUntilExpiry(expiryDateStr);
  return days >= 0 && days <= alertDays;
}

// Calculates composite stock status for a medicine
export function getMedicineStockStatus(
  medicine: Medicine,
  expiryAlertDays = 90
): {
  status: StockStatusType;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
} {
  // Check if all batches are expired or if active quantity is 0
  const activeBatches = (medicine.batches || []).filter(b => b.quantity > 0);
  const nonExpiredBatches = activeBatches.filter(b => !isExpired(b.expiryDate));
  const availableQty = nonExpiredBatches.reduce((acc, b) => acc + b.quantity, 0);

  // If any active batch is strictly expired
  const hasExpiredBatch = activeBatches.some(b => isExpired(b.expiryDate));
  const hasNearExpiryBatch = nonExpiredBatches.some(b => isNearExpiry(b.expiryDate, expiryAlertDays));

  if (availableQty === 0) {
    if (hasExpiredBatch) {
      return {
        status: 'expired',
        label: 'Expired',
        badgeBg: 'bg-rose-950/20 text-rose-900 border-rose-300',
        badgeText: 'text-rose-950 font-bold',
        badgeBorder: 'border-rose-400',
      };
    }
    return {
      status: 'out_of_stock',
      label: 'Out of Stock',
      badgeBg: 'bg-red-50 text-red-700 border-red-200',
      badgeText: 'text-red-700 font-semibold',
      badgeBorder: 'border-red-300',
    };
  }

  if (hasExpiredBatch) {
    return {
      status: 'expired',
      label: 'Has Expired Batch',
      badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
      badgeText: 'text-rose-900 font-semibold',
      badgeBorder: 'border-rose-400',
    };
  }

  if (hasNearExpiryBatch) {
    return {
      status: 'near_expiry',
      label: 'Near Expiry',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
      badgeText: 'text-amber-800 font-semibold',
      badgeBorder: 'border-amber-400',
    };
  }

  if (availableQty <= medicine.minStockLevel) {
    return {
      status: 'low',
      label: 'Low Stock',
      badgeBg: 'bg-yellow-50 text-yellow-800 border-yellow-300',
      badgeText: 'text-yellow-800 font-semibold',
      badgeBorder: 'border-yellow-400',
    };
  }

  return {
    status: 'available',
    label: 'In Stock',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    badgeText: 'text-emerald-800 font-semibold',
    badgeBorder: 'border-emerald-300',
  };
}

// FEFO (First Expiry, First Out) batch selector
// Automatically sorts available batches with earliest expiry first and skips expired batches!
export function getFefoBatches(medicine: Medicine): MedicineBatch[] {
  return [...(medicine.batches || [])]
    .filter(b => b.quantity > 0 && !isExpired(b.expiryDate))
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
}

// Auto-allocates items from FEFO batches for a given requested quantity
export function allocateFefoStock(
  medicine: Medicine,
  requestedQty: number
): {
  success: boolean;
  allocations: { batch: MedicineBatch; quantity: number }[];
  error?: string;
} {
  const fefoBatches = getFefoBatches(medicine);
  const totalAvailable = fefoBatches.reduce((sum, b) => sum + b.quantity, 0);

  if (requestedQty <= 0) {
    return { success: false, allocations: [], error: 'Requested quantity must be at least 1' };
  }

  if (requestedQty > totalAvailable) {
    return {
      success: false,
      allocations: [],
      error: `Insufficient non-expired stock for ${medicine.name}. Available: ${totalAvailable}, Requested: ${requestedQty}`,
    };
  }

  let remaining = requestedQty;
  const allocations: { batch: MedicineBatch; quantity: number }[] = [];

  for (const batch of fefoBatches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    allocations.push({ batch, quantity: take });
    remaining -= take;
  }

  return { success: true, allocations };
}

// Formats timestamp nicely
export function formatDateTime(isoOrDateStr: string): string {
  if (!isoOrDateStr) return '';
  const date = new Date(isoOrDateStr);
  if (isNaN(date.getTime())) return isoOrDateStr;
  return date.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Generates next sequence number
export function generateInvoiceNumber(existingSalesCount: number): string {
  const year = new Date().getFullYear();
  const seq = (existingSalesCount + 101).toString().padStart(5, '0');
  return `INV-${year}-${seq}`;
}

export function generatePurchaseNumber(existingPurchasesCount: number): string {
  const year = new Date().getFullYear();
  const seq = (existingPurchasesCount + 51).toString().padStart(4, '0');
  return `PO-${year}-${seq}`;
}

// Exports any array of objects to standard CSV
export function exportToCSV(filename: string, rows: Record<string, any>[]): void {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map(row => {
        return keys
          .map(k => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
