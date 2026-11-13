/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Medicine, MedicineBatch, StockStatusType } from '../types/pharmacy';

// Returns current store date in YYYY-MM-DD using Asia/Karachi timezone
export function getStoreTodayDateStr(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

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
        badgeBg: 'bg-gradient-to-r from-rose-800 to-red-950 text-white shadow-xs shadow-rose-900/25',
        badgeText: 'text-white font-bold',
        badgeBorder: 'border-rose-900/40',
      };
    }
    return {
      status: 'out_of_stock',
      label: 'Out of Stock',
      badgeBg: 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-xs shadow-rose-500/25',
      badgeText: 'text-white font-bold',
      badgeBorder: 'border-rose-600/20',
    };
  }

  if (hasExpiredBatch) {
    return {
      status: 'expired',
      label: 'Has Expired Batch',
      badgeBg: 'bg-gradient-to-r from-rose-700 to-red-900 text-white shadow-xs shadow-rose-800/25',
      badgeText: 'text-white font-bold',
      badgeBorder: 'border-rose-800/30',
    };
  }

  if (hasNearExpiryBatch) {
    return {
      status: 'near_expiry',
      label: 'Near Expiry',
      badgeBg: 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-xs shadow-amber-400/30',
      badgeText: 'text-slate-950 font-bold',
      badgeBorder: 'border-amber-500/40',
    };
  }

  if (availableQty <= medicine.minStockLevel) {
    return {
      status: 'low',
      label: 'Low Stock',
      badgeBg: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs shadow-orange-500/25',
      badgeText: 'text-white font-bold',
      badgeBorder: 'border-orange-600/20',
    };
  }

  return {
    status: 'available',
    label: 'In Stock',
    badgeBg: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xs shadow-emerald-500/25',
    badgeText: 'text-white font-bold',
    badgeBorder: 'border-emerald-600/20',
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
