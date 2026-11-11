/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Medicine, Sale } from '../types/pharmacy';

const DB_NAME = 'pharmacare_indexeddb_v1';
const DB_VERSION = 1;

export interface OfflineQueuedSale {
  offlineId: string;
  createdAt: string;
  saleData: any;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  error?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('medicines_cache')) {
        db.createObjectStore('medicines_cache', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('pending_sales_queue')) {
        db.createObjectStore('pending_sales_queue', { keyPath: 'offlineId' });
      }

      if (!db.objectStoreNames.contains('offline_meta')) {
        db.createObjectStore('offline_meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Cache active medicine catalog for offline counter search & dispensing
export async function cacheMedicinesOffline(medicines: Medicine[]): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(['medicines_cache', 'offline_meta'], 'readwrite');
    const store = tx.objectStore('medicines_cache');

    store.clear();
    for (const med of medicines) {
      store.put(med);
    }

    const metaStore = tx.objectStore('offline_meta');
    metaStore.put({ key: 'last_cache_time', value: new Date().toISOString() });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to cache medicines in IndexedDB:', err);
  }
}

// Retrieve cached medicines when offline
export async function getCachedMedicines(): Promise<Medicine[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction('medicines_cache', 'readonly');
    const store = tx.objectStore('medicines_cache');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to read cached medicines from IndexedDB:', err);
    return [];
  }
}

// Queue an offline sale for background sync
export async function enqueueOfflineSale(saleData: any): Promise<string> {
  const offlineId = `off-sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const queuedItem: OfflineQueuedSale = {
    offlineId,
    createdAt: new Date().toISOString(),
    saleData,
    status: 'pending',
  };

  try {
    const db = await openDatabase();
    const tx = db.transaction('pending_sales_queue', 'readwrite');
    const store = tx.objectStore('pending_sales_queue');
    store.put(queuedItem);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return offlineId;
  } catch (err) {
    console.error('Failed to enqueue offline sale:', err);
    throw err;
  }
}

// Get all pending offline sales
export async function getPendingSalesQueue(): Promise<OfflineQueuedSale[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction('pending_sales_queue', 'readonly');
    const store = tx.objectStore('pending_sales_queue');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

// Remove an item after successful sync to server
export async function removePendingSale(offlineId: string): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction('pending_sales_queue', 'readwrite');
    const store = tx.objectStore('pending_sales_queue');
    store.delete(offlineId);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to delete pending sale from queue:', err);
  }
}
