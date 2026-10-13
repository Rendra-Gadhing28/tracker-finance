import { openDB } from 'idb';

export const DB_NAME = 'neko-dompet-db';
export const DB_VERSION = 1;

export const INITIAL_BUDGETS = [
  { id: 'jajan', nama: 'Jajan & makan', ikon: '🍙', warna: 'jajan', limit_mingguan: 72500, tipe: 'keluar', urut: 1 },
  { id: 'pulsa', nama: 'Pulsa', ikon: '📱', warna: 'pulsa', limit_mingguan: 4000, tipe: 'keluar', urut: 2 },
  { id: 'bensin', nama: 'Bensin', ikon: '⛽', warna: 'bensin', limit_mingguan: 25000, tipe: 'keluar', urut: 3 },
  { id: 'jajanin', nama: 'Jajanin', ikon: '🎁', warna: 'jajanin', limit_mingguan: 14500, tipe: 'keluar', urut: 4 },
  { id: 'nabung', nama: 'Nabung', ikon: '🐷', warna: 'nabung', limit_mingguan: 29000, tipe: 'tabung', urut: 5 },
  { id: 'masuk', nama: 'Uang jajan', ikon: '💰', warna: 'masuk', limit_mingguan: 145000, tipe: 'masuk', urut: 6 }
];

export const INITIAL_SETTINGS = [
  { key: 'uang_jajan_mingguan', value: 145000 },
  { key: 'awal_minggu', value: 1 },
  { key: 'saldo_awal', value: 0 },
  { key: 'tanpa_jajan', value: '' },
  {
    key: 'script_url',
    value: (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPS_SCRIPT_URL) || ''
  },
  {
    key: 'script_token',
    value: (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_APPS_SCRIPT_TOKEN) || ''
  }
];

let dbPromise = null;

/**
 * Get or open the IndexedDB database instance.
 * @returns {Promise<import('idb').IDBPDatabase|null>}
 */
export async function getDb() {
  if (typeof indexedDB === 'undefined') {
    return null;
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('transaksi')) {
          db.createObjectStore('transaksi', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('budget')) {
          db.createObjectStore('budget', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('goals')) {
          db.createObjectStore('goals', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('setting')) {
          db.createObjectStore('setting', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
        }
      }
    });
  }

  return dbPromise;
}

/**
 * Seed initial data if the database stores are empty.
 * @param {import('idb').IDBPDatabase} [customDb]
 */
export async function seedInitialData(customDb) {
  const db = customDb || (await getDb());
  if (!db) return;

  const budgetCount = await db.count('budget');
  if (budgetCount === 0) {
    const tx = db.transaction(['budget', 'setting'], 'readwrite');
    for (const item of INITIAL_BUDGETS) {
      await tx.objectStore('budget').put(item);
    }
    for (const item of INITIAL_SETTINGS) {
      const existing = await tx.objectStore('setting').get(item.key);
      if (!existing) {
        await tx.objectStore('setting').put(item);
      }
    }
    await tx.done;
  }
}

/**
 * Generic helper to get all items from an object store.
 * @param {string} storeName
 * @returns {Promise<Array>}
 */
export async function getAll(storeName) {
  const db = await getDb();
  if (!db) return [];
  return db.getAll(storeName);
}

/**
 * Generic helper to get an item by key from an object store.
 * @param {string} storeName
 * @param {any} key
 * @returns {Promise<any>}
 */
export async function get(storeName, key) {
  const db = await getDb();
  if (!db) return null;
  return db.get(storeName, key);
}

/**
 * Generic helper to put an item into an object store.
 * @param {string} storeName
 * @param {any} value
 * @returns {Promise<any>}
 */
export async function put(storeName, value) {
  const db = await getDb();
  if (!db) return null;
  return db.put(storeName, value);
}

/**
 * Generic helper to delete an item by key from an object store.
 * @param {string} storeName
 * @param {any} key
 * @returns {Promise<void>}
 */
export async function del(storeName, key) {
  const db = await getDb();
  if (!db) return;
  return db.delete(storeName, key);
}

/**
 * Generic helper to clear an object store.
 * @param {string} storeName
 * @returns {Promise<void>}
 */
export async function clear(storeName) {
  const db = await getDb();
  if (!db) return;
  return db.clear(storeName);
}
