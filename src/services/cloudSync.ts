/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real-Time Cross-Account & Cross-Device Cloud Synchronization Service
 * Ensures Medicines, Batches, Staff Accounts, Sales, and Store State added
 * by Staff or Owner are saved in real-time and reflected immediately across
 * all devices (Mobile & Desktop) and all user accounts.
 */

import { User } from '../types/pharmacy';
import { DATA_CLEAN_VERSION, sanitizeStaffAccounts } from '../data/initialData';
import { normalizeMedicine } from '../utils/normalizers';

// Primary Cloud SQL (PostgreSQL) Backend Server URL (works from Hostinger medicalstore.edulinker.online & all devices)
export const CLOUD_SQL_BACKEND_URL =
  'https://ais-pre-7lndyrwswjnhb2fqfm5wmy-728386787870.asia-southeast1.run.app';

// Dedicated, Highly-Available HTTPS Cloud Objects on api.restful-api.dev
export const MEDICINES_CLOUD_PRIMARY =
  'https://api.restful-api.dev/objects/ff808181a09d98f701a1cb0e8bd70a30';
export const MEDICINES_CLOUD_BACKUP =
  'https://api.restful-api.dev/objects/ff808181a09d98f701a1cb0f4a9f0a32';

export const STORE_CLOUD_OBJECT_URL =
  'https://api.restful-api.dev/objects/ff808181a09d98f701a1caaa9a45092c';
export const STAFF_CLOUD_OBJECT_URL =
  'https://api.restful-api.dev/objects/ff808181a09d98f701a1caacf16f092e';

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

function isValidCleanVersion(v?: string): boolean {
  if (!v) return true;
  return (
    v === DATA_CLEAN_VERSION ||
    v === 'v3-clean-owner-only' ||
    v.includes('clean') ||
    v.includes('v3')
  );
}

function mergeArraysById<T extends { id: string }>(
  olderArr: T[] = [],
  newerArr: T[] = [],
  deletedIds: Set<string> = new Set()
): T[] {
  const map = new Map<string, T>();
  if (Array.isArray(olderArr)) {
    for (const item of olderArr) {
      if (item && item.id && !deletedIds.has(item.id)) {
        map.set(item.id, item);
      }
    }
  }
  if (Array.isArray(newerArr)) {
    for (const item of newerArr) {
      if (item && item.id && !deletedIds.has(item.id)) {
        map.set(item.id, item);
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Direct fetch of dedicated medicines cloud registry + Cloud SQL Backend
 */
export async function fetchCloudMedicines(): Promise<{ medicines: any[]; deletedIds: string[] } | null> {
  const deletedSet = new Set<string>();
  let mergedMeds: any[] = [];
  let foundAny = false;

  // 1. Check live Cloud SQL PostgreSQL backend (works from Hostinger too)
  try {
    const res = await fetch(`${CLOUD_SQL_BACKEND_URL}/api/state`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      const d = json?.data;
      if (d && Array.isArray(d.medicines)) {
        foundAny = true;
        if (Array.isArray(d.deletedIds)) {
          d.deletedIds.forEach((id: string) => deletedSet.add(id));
        }
        mergedMeds = mergeArraysById(mergedMeds, d.medicines, deletedSet);
      }
    }
  } catch {}

  // 2. Check dedicated cloud objects
  const endpoints = [MEDICINES_CLOUD_PRIMARY, MEDICINES_CLOUD_BACKUP];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        const data = json?.data;
        if (data && Array.isArray(data.medicines)) {
          foundAny = true;
          if (Array.isArray(data.deletedIds)) {
            data.deletedIds.forEach((id: string) => deletedSet.add(id));
          }
          mergedMeds = mergeArraysById(mergedMeds, data.medicines, deletedSet);
        }
      }
    } catch {}
  }

  if (!foundAny) return null;

  return {
    medicines: mergedMeds
      .filter((m: any) => m && m.id && !deletedSet.has(m.id))
      .map(normalizeMedicine)
      .filter(Boolean),
    deletedIds: Array.from(deletedSet),
  };
}

/**
 * Push an added, updated, or deleted medicine immediately to Cloud SQL Backend + Cloud Storage
 */
export async function pushCloudMedicineRealtime(medicine: any, deletedId?: string): Promise<boolean> {
  // 1. Broadcast immediately to any other tab / account open in the same browser (0ms)
  try {
    if (medicine) {
      broadcast?.postMessage({ type: 'MEDICINE_SYNC', medicine });
    } else if (deletedId) {
      broadcast?.postMessage({ type: 'MEDICINE_DELETE', id: deletedId });
    }
  } catch {}

  // 1b. Push directly to live Cloud SQL PostgreSQL Backend (for Hostinger & cross-domain sync)
  try {
    if (medicine && medicine.id) {
      fetch(`${CLOUD_SQL_BACKEND_URL}/api/medicine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medicine),
      }).catch(() => {});
    } else if (deletedId) {
      fetch(`${CLOUD_SQL_BACKEND_URL}/api/medicine/${encodeURIComponent(deletedId)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  } catch {}

  // 2. Fetch current cloud medicines to merge cleanly
  let currentMedicines: any[] = [];
  let currentDeletedIds: string[] = [];

  try {
    const existing = await fetchCloudMedicines();
    if (existing) {
      currentMedicines = existing.medicines;
      currentDeletedIds = existing.deletedIds;
    }
  } catch {}

  const deletedSet = new Set<string>(currentDeletedIds);

  if (deletedId) {
    deletedSet.add(deletedId);
    currentMedicines = currentMedicines.filter((m: any) => m && m.id !== deletedId);
  }

  if (medicine && medicine.id) {
    deletedSet.delete(medicine.id);
    const existingIdx = currentMedicines.findIndex((m: any) => m && m.id === medicine.id);
    if (existingIdx >= 0) {
      currentMedicines[existingIdx] = medicine;
    } else {
      currentMedicines.unshift(medicine);
    }
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    cleanVersion: DATA_CLEAN_VERSION,
    deletedIds: Array.from(deletedSet),
    medicines: currentMedicines,
  };

  let ok = false;
  const endpoints = [MEDICINES_CLOUD_PRIMARY, MEDICINES_CLOUD_BACKUP];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'pharmacare_live_medicines_v1',
          data: payload,
        }),
      });
      if (res.ok) ok = true;
    } catch {}
  }

  return ok;
}

/**
 * Fetch latest staff accounts from dedicated RESTful Cloud Object
 */
export async function fetchCloudStaff(): Promise<User[] | null> {
  const collected: User[] = [];
  const deletedIds = new Set<string>();

  // 1. Live Cloud SQL PostgreSQL Backend (works from Hostinger medicalstore.edulinker.online too)
  try {
    const res = await fetch(`${CLOUD_SQL_BACKEND_URL}/api/staff`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.staffMembers)) {
        collected.push(...json.staffMembers);
      }
    }
  } catch {}

  // 2. Fallback RESTful Cloud Object
  try {
    const res = await fetch(STAFF_CLOUD_OBJECT_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      const data = json?.data;
      if (data && isValidCleanVersion(data.cleanVersion)) {
        if (Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach((id: string) => deletedIds.add(id));
        }
        if (Array.isArray(data.staffMembers)) {
          collected.push(...data.staffMembers);
        }
      }
    }
  } catch {}

  if (collected.length === 0) {
    return null;
  }

  const byUsername = new Map<string, User>();
  for (const u of collected) {
    if (!u || !u.id || deletedIds.has(u.id)) continue;
    const key = String(u.username || u.id).toLowerCase().trim();
    byUsername.set(key, u);
  }

  return sanitizeStaffAccounts(Array.from(byUsername.values()));
}

/**
 * Push updated staff accounts to HTTPS cloud channel
 */
export async function pushCloudStaff(
  staffMembers: User[],
  options?: { forceReplace?: boolean; deletedId?: string }
): Promise<boolean> {
  const cleanStaff = sanitizeStaffAccounts(staffMembers);
  let mergedStaff = cleanStaff;

  if (!options?.forceReplace) {
    try {
      const existing = await fetchCloudStaff();
      if (existing && existing.length > 0) {
        const map = new Map<string, User>();
        existing.forEach(u => {
          if (u.id !== options?.deletedId) {
            map.set(u.username.toLowerCase(), u);
          }
        });
        cleanStaff.forEach(u => {
          if (u.id !== options?.deletedId) {
            map.set(u.username.toLowerCase(), u);
          }
        });
        mergedStaff = sanitizeStaffAccounts(Array.from(map.values()));
      }
    } catch {}
  }

  const payload = {
    cleanVersion: DATA_CLEAN_VERSION,
    updatedAt: new Date().toISOString(),
    forceReplace: Boolean(options?.forceReplace),
    deletedIds: options?.deletedId ? [options.deletedId] : [],
    staffMembers: mergedStaff,
  };

  try {
    const res = await fetch(STAFF_CLOUD_OBJECT_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'pharmacare_staff_accounts',
        data: payload,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch full store state (medicines, sales, purchases, suppliers, customers, staff)
 * automatically merging dedicated medicine endpoints so medicines added by Staff or Owner
 * are ALWAYS returned.
 */
export async function fetchCloudStoreState(): Promise<CloudStorePayload | null> {
  let combined: CloudStorePayload | null = null;
  const deletedIds = new Set<string>();

  // 0. Live Cloud SQL PostgreSQL Backend (works from Hostinger medicalstore.edulinker.online & all devices)
  try {
    const res = await fetch(`${CLOUD_SQL_BACKEND_URL}/api/state`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      const data = json?.data as CloudStorePayload | undefined;
      if (data && isValidCleanVersion(data.cleanVersion)) {
        if (Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach(id => deletedIds.add(id));
        }
        combined = { ...data };
      }
    }
  } catch {}

  // 1. Primary Full Store Cloud Object
  try {
    const res = await fetch(STORE_CLOUD_OBJECT_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      const data = json?.data as CloudStorePayload | undefined;
      if (data && isValidCleanVersion(data.cleanVersion)) {
        if (Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach(id => deletedIds.add(id));
        }
        if (!combined) {
          combined = { ...data };
        } else {
          combined.medicines = mergeArraysById(combined.medicines, data.medicines, deletedIds);
          combined.suppliers = mergeArraysById(combined.suppliers, data.suppliers, deletedIds);
          combined.customers = mergeArraysById(combined.customers, data.customers, deletedIds);
          combined.sales = mergeArraysById(combined.sales, data.sales, deletedIds);
          combined.saleReturns = mergeArraysById(combined.saleReturns, data.saleReturns, deletedIds);
          combined.purchases = mergeArraysById(combined.purchases, data.purchases, deletedIds);
          combined.expenses = mergeArraysById(combined.expenses, data.expenses, deletedIds);
          combined.adjustments = mergeArraysById(combined.adjustments, data.adjustments, deletedIds);
          combined.staffMembers = sanitizeStaffAccounts(
            mergeArraysById(combined.staffMembers, data.staffMembers, deletedIds)
          );
        }
      }
    }
  } catch {}

  // 2. Also merge dedicated medicines registry
  try {
    const medCloud = await fetchCloudMedicines();
    if (medCloud) {
      if (Array.isArray(medCloud.deletedIds)) {
        medCloud.deletedIds.forEach(id => deletedIds.add(id));
      }
      if (!combined) {
        combined = {
          cleanVersion: DATA_CLEAN_VERSION,
          updatedAt: new Date().toISOString(),
          medicines: [],
          suppliers: [],
          customers: [],
          sales: [],
          saleReturns: [],
          purchases: [],
          expenses: [],
          adjustments: [],
          staffMembers: [],
        };
      }
      if (Array.isArray(medCloud.medicines)) {
        combined.medicines = mergeArraysById(combined.medicines, medCloud.medicines, deletedIds);
      }
    }
  } catch {}

  if (combined) {
    if (deletedIds.size > 0) {
      combined.deletedIds = Array.from(deletedIds);
    }
    combined.medicines = (combined.medicines || [])
      .filter(m => m && !deletedIds.has(m.id))
      .map(normalizeMedicine)
      .filter(Boolean);
    combined.suppliers = (combined.suppliers || []).filter(s => s && !deletedIds.has(s.id));
    combined.customers = (combined.customers || []).filter(c => c && !deletedIds.has(c.id));
    combined.expenses = (combined.expenses || []).filter(e => e && !deletedIds.has(e.id));
  }

  return combined;
}

/**
 * Push full store state to cloud AFTER merging with existing cloud records so
 * neither Staff nor Owner sessions ever overwrite medicines/sales added by the other!
 */
export async function pushCloudStoreState(
  state: Omit<CloudStorePayload, 'cleanVersion' | 'updatedAt'>,
  options?: { deletedId?: string }
): Promise<boolean> {
  const deletedIds = new Set<string>(state.deletedIds || []);
  if (options?.deletedId) {
    deletedIds.add(options.deletedId);
  }

  let existing: CloudStorePayload | null = null;
  try {
    existing = await fetchCloudStoreState();
    if (existing?.deletedIds) {
      existing.deletedIds.forEach(id => deletedIds.add(id));
    }
  } catch {}

  const mergedMedicines = mergeArraysById(existing?.medicines, state.medicines, deletedIds);

  const mergedPayload: CloudStorePayload = {
    cleanVersion: DATA_CLEAN_VERSION,
    updatedAt: new Date().toISOString(),
    deletedIds: Array.from(deletedIds),
    settings: state.settings || existing?.settings,
    medicines: mergedMedicines,
    suppliers: mergeArraysById(existing?.suppliers, state.suppliers, deletedIds),
    customers: mergeArraysById(existing?.customers, state.customers, deletedIds),
    sales: mergeArraysById(existing?.sales, state.sales, deletedIds),
    saleReturns: mergeArraysById(existing?.saleReturns, state.saleReturns, deletedIds),
    purchases: mergeArraysById(existing?.purchases, state.purchases, deletedIds),
    expenses: mergeArraysById(existing?.expenses, state.expenses, deletedIds),
    adjustments: mergeArraysById(existing?.adjustments, state.adjustments, deletedIds),
    staffMembers: sanitizeStaffAccounts(
      mergeArraysById(existing?.staffMembers, state.staffMembers, deletedIds)
    ),
  };

  // Push to live Cloud SQL PostgreSQL Backend (works from Hostinger too)
  fetch(`${CLOUD_SQL_BACKEND_URL}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mergedPayload),
  }).catch(() => {});

  // Also sync dedicated medicine objects in parallel
  if (Array.isArray(mergedMedicines) && mergedMedicines.length > 0) {
    const medPayload = {
      updatedAt: new Date().toISOString(),
      cleanVersion: DATA_CLEAN_VERSION,
      deletedIds: Array.from(deletedIds),
      medicines: mergedMedicines,
    };
    [MEDICINES_CLOUD_PRIMARY, MEDICINES_CLOUD_BACKUP].forEach(url => {
      fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'pharmacare_live_medicines_v1',
          data: medPayload,
        }),
      }).catch(() => {});
    });
  }

  let ok = false;
  try {
    const res = await fetch(STORE_CLOUD_OBJECT_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'pharmacare_store_state',
        data: mergedPayload,
      }),
    });
    if (res.ok) ok = true;
  } catch {}

  return ok;
}

