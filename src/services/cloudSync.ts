/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real-Time Cross-Account & Cross-Device Cloud Synchronization Service
 * Ensures Staff Accounts, Medicines, Batches, Sales, Purchases, Suppliers,
 * Customers, and Expenses added by either Staff or Owner are saved in real-time
 * and reflected immediately across both Owner and Staff accounts on all devices.
 */

import { User } from '../types/pharmacy';
import { DATA_CLEAN_VERSION, sanitizeStaffAccounts } from '../data/initialData';

const STAFF_CLOUD_OBJECT_URL =
  'https://api.restful-api.dev/objects/ff808181a09d98f701a1caacf16f092e';
const STORE_CLOUD_OBJECT_URL =
  'https://api.restful-api.dev/objects/ff808181a09d98f701a1caaa9a45092c';
const NTFY_STAFF_TOPIC_URL = 'https://ntfy.sh/pharmacare_edulinker_staff_v3';
const NTFY_STORE_TOPIC_URL = 'https://ntfy.sh/pharmacare_edulinker_store_v3';

export interface CloudStorePayload {
  cleanVersion: string;
  updatedAt: string;
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
 * Fetch latest staff accounts from redundant HTTPS cloud channels
 */
export async function fetchCloudStaff(): Promise<User[] | null> {
  const collected: User[] = [];
  const deletedIds = new Set<string>();
  let clearedAllOthers = false;

  // Channel 1: Dedicated RESTful Cloud Object
  try {
    const res = await fetch(STAFF_CLOUD_OBJECT_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      const data = json?.data;
      if (data && data.cleanVersion === DATA_CLEAN_VERSION) {
        if (Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach((id: string) => deletedIds.add(id));
        }
        if (data.clearedAllOthers) {
          clearedAllOthers = true;
        }
        if (Array.isArray(data.staffMembers)) {
          collected.push(...data.staffMembers);
        }
      }
    }
  } catch {
    // try backup channel
  }

  // Channel 2: Redundant ntfy.sh JSON stream (last 24h)
  try {
    const res = await fetch(`${NTFY_STAFF_TOPIC_URL}/json?poll=1&since=24h`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event?.event === 'message' && typeof event.message === 'string') {
            const payload = JSON.parse(event.message);
            if (payload?.cleanVersion === DATA_CLEAN_VERSION) {
              if (Array.isArray(payload.deletedIds)) {
                payload.deletedIds.forEach((id: string) => deletedIds.add(id));
              }
              if (payload.forceReplace && Array.isArray(payload.staffMembers)) {
                collected.length = 0;
                collected.push(...payload.staffMembers);
              } else if (Array.isArray(payload.staffMembers)) {
                collected.push(...payload.staffMembers);
              }
            }
          }
        } catch {
          // ignore malformed line
        }
      }
    }
  } catch {
    // ignore network error
  }

  if (collected.length === 0 && !clearedAllOthers) {
    return null;
  }

  const byUsername = new Map<string, User>();
  for (const u of collected) {
    if (!u || !u.id || deletedIds.has(u.id)) continue;
    const key = (u.username || u.id).toLowerCase().trim();
    byUsername.set(key, u);
  }

  return sanitizeStaffAccounts(Array.from(byUsername.values()));
}

/**
 * Push updated staff accounts to redundant HTTPS cloud channels
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

  let ok = false;

  try {
    const res = await fetch(STAFF_CLOUD_OBJECT_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'pharmacare_staff_accounts',
        data: payload,
      }),
    });
    if (res.ok) ok = true;
  } catch {}

  try {
    const res = await fetch(NTFY_STAFF_TOPIC_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.ok) ok = true;
  } catch {}

  return ok;
}

/**
 * Fetch full store state (medicines, sales, purchases, suppliers, customers, staff)
 * merging both primary Cloud Object and real-time ntfy stream so medicines added by
 * Staff or Owner are always present.
 */
export async function fetchCloudStoreState(): Promise<CloudStorePayload | null> {
  let combined: CloudStorePayload | null = null;
  const deletedIds = new Set<string>();

  // 1. Primary Cloud Object
  try {
    const res = await fetch(STORE_CLOUD_OBJECT_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      const data = json?.data as CloudStorePayload | undefined;
      if (data && data.cleanVersion === DATA_CLEAN_VERSION) {
        if (Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach(id => deletedIds.add(id));
        }
        combined = { ...data };
      }
    }
  } catch {}

  // 2. Real-Time ntfy store stream (captures instant medicine/sale additions)
  try {
    const res = await fetch(`${NTFY_STORE_TOPIC_URL}/json?poll=1&since=24h`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event?.event === 'message' && typeof event.message === 'string') {
            const parsed = JSON.parse(event.message);
            if (parsed?.cleanVersion === DATA_CLEAN_VERSION) {
              if (Array.isArray(parsed.deletedIds)) {
                parsed.deletedIds.forEach((id: string) => deletedIds.add(id));
              }
              if (!combined) {
                combined = {
                  cleanVersion: DATA_CLEAN_VERSION,
                  updatedAt: parsed.updatedAt || new Date().toISOString(),
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
              if (parsed.medicine) {
                combined.medicines = mergeArraysById(combined.medicines, [parsed.medicine], deletedIds);
              }
              if (Array.isArray(parsed.medicines)) {
                combined.medicines = mergeArraysById(combined.medicines, parsed.medicines, deletedIds);
              }
              if (Array.isArray(parsed.suppliers)) {
                combined.suppliers = mergeArraysById(combined.suppliers, parsed.suppliers, deletedIds);
              }
              if (Array.isArray(parsed.customers)) {
                combined.customers = mergeArraysById(combined.customers, parsed.customers, deletedIds);
              }
              if (Array.isArray(parsed.sales)) {
                combined.sales = mergeArraysById(combined.sales, parsed.sales, deletedIds);
              }
              if (Array.isArray(parsed.saleReturns)) {
                combined.saleReturns = mergeArraysById(combined.saleReturns, parsed.saleReturns, deletedIds);
              }
              if (Array.isArray(parsed.purchases)) {
                combined.purchases = mergeArraysById(combined.purchases, parsed.purchases, deletedIds);
              }
              if (Array.isArray(parsed.expenses)) {
                combined.expenses = mergeArraysById(combined.expenses, parsed.expenses, deletedIds);
              }
              if (Array.isArray(parsed.adjustments)) {
                combined.adjustments = mergeArraysById(combined.adjustments, parsed.adjustments, deletedIds);
              }
              if (Array.isArray(parsed.staffMembers)) {
                combined.staffMembers = sanitizeStaffAccounts(
                  mergeArraysById(combined.staffMembers, parsed.staffMembers, deletedIds)
                );
              }
            }
          }
        } catch {}
      }
    }
  } catch {}

  if (combined && deletedIds.size > 0) {
    combined.deletedIds = Array.from(deletedIds);
    combined.medicines = (combined.medicines || []).filter(m => !deletedIds.has(m.id));
    combined.suppliers = (combined.suppliers || []).filter(s => !deletedIds.has(s.id));
    combined.customers = (combined.customers || []).filter(c => !deletedIds.has(c.id));
    combined.expenses = (combined.expenses || []).filter(e => !deletedIds.has(e.id));
  }

  return combined;
}

/**
 * Push a single added/updated medicine immediately in real-time to cloud
 */
export async function pushCloudMedicineRealtime(medicine: any, deletedId?: string): Promise<void> {
  const eventPayload = {
    cleanVersion: DATA_CLEAN_VERSION,
    updatedAt: new Date().toISOString(),
    medicine: medicine || undefined,
    deletedIds: deletedId ? [deletedId] : [],
  };

  try {
    await fetch(NTFY_STORE_TOPIC_URL, {
      method: 'POST',
      body: JSON.stringify(eventPayload),
    });
  } catch {}
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

  const mergedPayload: CloudStorePayload = {
    cleanVersion: DATA_CLEAN_VERSION,
    updatedAt: new Date().toISOString(),
    deletedIds: Array.from(deletedIds),
    settings: state.settings || existing?.settings,
    medicines: mergeArraysById(existing?.medicines, state.medicines, deletedIds),
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
