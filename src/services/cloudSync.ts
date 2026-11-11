/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cross-Device Cloud Synchronization Service
 * Ensures Staff Accounts, Medicines, Sales, Purchases, and Store Data sync
 * across PC, Mobile Phone, and Tablet browsers even when Hostinger serves
 * the frontend via static CDN (hcdn) where /api/* routes return HTTP 404.
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

/**
 * Fetch latest staff accounts from redundant HTTPS cloud channels
 */
export async function fetchCloudStaff(): Promise<User[] | null> {
  const collected: User[] = [];
  let deletedIds = new Set<string>();
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

  // Deduplicate by ID and username (latest wins)
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

  // Channel 1: PUT to RESTful Cloud Object
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

  // Channel 2: POST to ntfy.sh stream
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
 * Fetch full store state (medicines, sales, purchases, suppliers, customers, staff) from cloud
 */
export async function fetchCloudStoreState(): Promise<CloudStorePayload | null> {
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
        return data;
      }
    }
  } catch {}

  // Fallback to ntfy store stream
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
      let latestState: CloudStorePayload | null = null;
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event?.event === 'message' && typeof event.message === 'string') {
            const parsed = JSON.parse(event.message);
            if (parsed?.cleanVersion === DATA_CLEAN_VERSION) {
              latestState = parsed;
            }
          }
        } catch {}
      }
      if (latestState) return latestState;
    }
  } catch {}

  return null;
}

/**
 * Push full store state to cloud
 */
export async function pushCloudStoreState(state: Omit<CloudStorePayload, 'cleanVersion' | 'updatedAt'>): Promise<boolean> {
  const payload: CloudStorePayload = {
    ...state,
    cleanVersion: DATA_CLEAN_VERSION,
    updatedAt: new Date().toISOString(),
    staffMembers: sanitizeStaffAccounts(state.staffMembers),
  };

  let ok = false;
  try {
    const res = await fetch(STORE_CLOUD_OBJECT_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'pharmacare_store_state',
        data: payload,
      }),
    });
    if (res.ok) ok = true;
  } catch {}

  return ok;
}
