/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real-Time Cross-Account & Cross-Device Database Synchronization Service
 * Connects directly to the same-origin /api/* SQL backend (Hostinger SQLite
 * on medicalstore.edulinker.online, or Node Express/Cloud SQL on localhost)
 * plus BroadcastChannel for instant (0ms) cross-tab updates.
 */

import { User } from '../types/pharmacy';
import { DATA_CLEAN_VERSION, sanitizeStaffAccounts } from '../data/initialData';
import { normalizeMedicine } from '../utils/normalizers';

// Same-origin API base URL so Hostinger SQLite (/api/index.php) and Express (/api/*) work seamlessly
export const CLOUD_SQL_BACKEND_URL = '';

// Local BroadcastChannel for instant (0ms) cross-tab / cross-account sync on same device
const broadcast =
  typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('pharmacare_erp_realtime_sync')
    : null;

export interface CloudStorePayload {
  cleanVersion?: string;
  updatedAt?: string;
  deletedIds?: string[];
  settings?: any;
  medicines?: any[];
  suppliers?: any[];
  customers?: any[];
  sales?: any[];
  saleReturns?: any[];
  purchases?: any[];
  expenses?: any[];
  adjustments?: any[];
  staffMembers?: User[];
}

function getSessionActorHeaders(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem('pharmacare_auth_session_v2');
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.id) {
        return {
          'X-User-Id': String(user.id),
          'X-User-Role': String(user.role || 'staff'),
        };
      }
    }
  } catch {}
  return {};
}

export function broadcastFullRefresh(): void {
  try {
    broadcast?.postMessage({ type: 'FULL_REFRESH' });
  } catch {}
}

/**
 * Direct fetch of live medicines & deletedIds from same-origin SQL backend
 */
export async function fetchCloudMedicines(): Promise<{ medicines: any[]; deletedIds: string[] } | null> {
  try {
    const res = await fetch('/api/state', {
      method: 'GET',
      headers: { Accept: 'application/json', ...getSessionActorHeaders() },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.data;
    if (!d || !Array.isArray(d.medicines)) return null;

    const deletedIds: string[] = Array.isArray(d.deletedIds) ? d.deletedIds.map(String) : [];
    const deletedSet = new Set(deletedIds);

    return {
      medicines: d.medicines
        .filter((m: any) => m && m.id && !deletedSet.has(m.id))
        .map(normalizeMedicine)
        .filter(Boolean),
      deletedIds,
    };
  } catch {
    return null;
  }
}

/**
 * Broadcast medicine update/deletion immediately to same-browser tabs
 * (API persistence is handled by StoreContext's /api/medicine call)
 */
export async function pushCloudMedicineRealtime(medicine: any, deletedId?: string): Promise<boolean> {
  try {
    if (medicine) {
      broadcast?.postMessage({ type: 'MEDICINE_SYNC', medicine });
    } else if (deletedId) {
      broadcast?.postMessage({ type: 'MEDICINE_DELETE', id: deletedId });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch latest staff accounts from live same-origin SQL backend
 */
export async function fetchCloudStaff(): Promise<User[] | null> {
  try {
    const res = await fetch('/api/staff', {
      method: 'GET',
      headers: { Accept: 'application/json', ...getSessionActorHeaders() },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json?.staffMembers) || json.staffMembers.length === 0) {
      return null;
    }
    return sanitizeStaffAccounts(json.staffMembers);
  } catch {
    return null;
  }
}

/**
 * Sync staff list via same-origin SQL backend and notify other tabs
 */
export async function pushCloudStaff(
  staffMembers: User[],
  options?: { forceReplace?: boolean; deletedId?: string }
): Promise<boolean> {
  const cleanStaff = sanitizeStaffAccounts(staffMembers);
  try {
    broadcast?.postMessage({ type: 'FULL_REFRESH' });
  } catch {}

  try {
    if (options?.deletedId) {
      const res = await fetch(`/api/staff/${encodeURIComponent(options.deletedId)}`, {
        method: 'DELETE',
        headers: { ...getSessionActorHeaders() },
      });
      return res.ok;
    }
    if (options?.forceReplace) {
      return true;
    }
    const staffOnly = cleanStaff.filter(u => u.id !== 'usr-owner-1');
    if (staffOnly.length === 0) return true;
    const results = await Promise.all(
      staffOnly.map(u =>
        fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getSessionActorHeaders() },
          body: JSON.stringify(u),
        }).then(r => r.ok).catch(() => false)
      )
    );
    return results.some(Boolean);
  } catch {
    return false;
  }
}

/**
 * Fetch full store state from same-origin SQL backend
 */
export async function fetchCloudStoreState(): Promise<CloudStorePayload | null> {
  try {
    const res = await fetch('/api/state', {
      method: 'GET',
      headers: { Accept: 'application/json', ...getSessionActorHeaders() },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data as CloudStorePayload | undefined;
    if (!data) return null;

    const deletedSet = new Set<string>(Array.isArray(data.deletedIds) ? data.deletedIds : []);
    return {
      ...data,
      medicines: (data.medicines || [])
        .filter(m => m && !deletedSet.has(m.id))
        .map(normalizeMedicine)
        .filter(Boolean),
      suppliers: (data.suppliers || []).filter(s => s && !deletedSet.has(s.id)),
      customers: (data.customers || []).filter(c => c && !deletedSet.has(c.id)),
      expenses: (data.expenses || []).filter(e => e && !deletedSet.has(e.id)),
      staffMembers: Array.isArray(data.staffMembers)
        ? sanitizeStaffAccounts(data.staffMembers.filter(u => u && !deletedSet.has(u.id)))
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Push full store state to same-origin SQL backend
 */
export async function pushCloudStoreState(
  state: Omit<CloudStorePayload, 'cleanVersion' | 'updatedAt'>,
  options?: { deletedId?: string }
): Promise<boolean> {
  const deletedIds = new Set<string>(state.deletedIds || []);
  if (options?.deletedId) {
    deletedIds.add(options.deletedId);
  }

  const payload: CloudStorePayload = {
    cleanVersion: DATA_CLEAN_VERSION,
    updatedAt: new Date().toISOString(),
    deletedIds: Array.from(deletedIds),
    settings: state.settings,
    medicines: (state.medicines || []).filter(m => m && !deletedIds.has(m.id)),
    suppliers: (state.suppliers || []).filter(s => s && !deletedIds.has(s.id)),
    customers: (state.customers || []).filter(c => c && !deletedIds.has(c.id)),
    sales: (state.sales || []).filter(s => s && !deletedIds.has(s.id)),
    saleReturns: (state.saleReturns || []).filter(r => r && !deletedIds.has(r.id)),
    purchases: (state.purchases || []).filter(p => p && !deletedIds.has(p.id)),
    expenses: (state.expenses || []).filter(e => e && !deletedIds.has(e.id)),
    adjustments: (state.adjustments || []).filter(a => a && !deletedIds.has(a.id)),
    staffMembers: sanitizeStaffAccounts(
      (state.staffMembers || []).filter(u => u && !deletedIds.has(u.id))
    ),
  };

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getSessionActorHeaders() },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
