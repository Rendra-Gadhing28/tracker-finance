import { getDb } from '../db.js';
import { getApiConfig, postAction, fetchRev, fetchAll, applyActionToLocalDb } from '../api.js';
import { sync } from '../stores/sync.js';

export const RETRY_DELAYS = [2000, 5000, 15000, 60000];

let isProcessing = false;
let retryTimeout = null;
let pollIntervalId = null;
let lastKnownRev = null;
const syncCallbacks = new Set();

/**
 * Register a listener called when fresh remote data is synced into local storage.
 * @param {Function} callback
 * @returns {Function} unregister function
 */
export function onDataSynced(callback) {
  syncCallbacks.add(callback);
  return () => syncCallbacks.delete(callback);
}

function notifyDataSynced(data) {
  for (const cb of syncCallbacks) {
    try {
      cb(data);
    } catch (err) {
      console.error('Error in onDataSynced callback:', err);
    }
  }
}

/**
 * Enqueue an action to be saved locally immediately (optimistic UI)
 * and sent to the remote backend via outbox.
 *
 * @param {string} action
 * @param {any} payload
 * @returns {Promise<{ ok: boolean }>}
 */
export async function enqueueAction(action, payload) {
  // 1. Write locally immediately (optimistic UI)
  await applyActionToLocalDb(action, payload);

  // 2. Check if remote API is configured
  const { url } = await getApiConfig();
  const db = await getDb();

  if (url && db) {
    await db.add('outbox', {
      action,
      payload,
      createdAt: Date.now(),
      attempts: 0
    });

    const pendingCount = await db.count('outbox');
    const isOnline = typeof navigator === 'undefined' || navigator.onLine;

    sync.update((s) => ({
      ...s,
      pendingCount,
      status: !isOnline ? 'offline' : 'pending'
    }));

    // Trigger queue processing
    processQueue();
  } else {
    // Mock / local-only mode
    sync.update((s) => ({
      ...s,
      status: 'synced',
      pendingCount: 0,
      lastSyncedAt: new Date()
    }));
  }

  return { ok: true };
}

/**
 * Process pending mutation items in the IndexedDB outbox queue sequentially.
 */
export async function processQueue() {
  if (isProcessing) return;

  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }

  const isOnline = typeof navigator === 'undefined' || navigator.onLine;
  if (!isOnline) {
    sync.update((s) => ({ ...s, status: 'offline' }));
    return;
  }

  const { url } = await getApiConfig();
  const db = await getDb();
  if (!db) return;

  if (!url) {
    // If no remote URL is configured, clear pending outbox items and mark synced
    await db.clear('outbox');
    sync.update((s) => ({
      ...s,
      status: 'synced',
      pendingCount: 0,
      lastSyncedAt: new Date()
    }));
    return;
  }

  isProcessing = true;

  try {
    while (true) {
      const stillOnline = typeof navigator === 'undefined' || navigator.onLine;
      if (!stillOnline) {
        const count = await db.count('outbox');
        sync.update((s) => ({ ...s, status: 'offline', pendingCount: count }));
        return;
      }

      const items = await db.getAll('outbox');
      if (!items || items.length === 0) {
        sync.update((s) => ({
          ...s,
          status: 'synced',
          pendingCount: 0,
          lastSyncedAt: s.lastSyncedAt || new Date()
        }));
        return;
      }

      sync.update((s) => ({
        ...s,
        status: 'pending',
        pendingCount: items.length
      }));

      let hadError = false;

      for (const item of items) {
        const onlineNow = typeof navigator === 'undefined' || navigator.onLine;
        if (!onlineNow) {
          const currentCount = await db.count('outbox');
          sync.update((s) => ({ ...s, status: 'offline', pendingCount: currentCount }));
          return;
        }

        try {
          await postAction(item.action, item.payload, { remoteOnly: true });
          await db.delete('outbox', item.id);

          const currentCount = await db.count('outbox');
          sync.update((s) => ({
            ...s,
            pendingCount: currentCount
          }));
        } catch (err) {
          console.warn(`Failed to sync outbox item #${item.id} (${item.action}):`, err);

          item.attempts = (item.attempts || 0) + 1;
          await db.put('outbox', item);

          const currentCount = await db.count('outbox');
          const onlineAfterFail = typeof navigator === 'undefined' || navigator.onLine;
          if (!onlineAfterFail) {
            sync.update((s) => ({ ...s, status: 'offline', pendingCount: currentCount }));
            return;
          }

          const delayIndex = Math.min(item.attempts - 1, RETRY_DELAYS.length - 1);
          const delay = RETRY_DELAYS[delayIndex];

          sync.update((s) => ({
            ...s,
            status: 'pending',
            pendingCount: currentCount
          }));

          retryTimeout = setTimeout(() => {
            processQueue();
          }, delay);
          hadError = true;
          return;
        }
      }

      if (hadError) return;

      const remainingCount = await db.count('outbox');
      if (remainingCount === 0) {
        sync.update((s) => ({
          ...s,
          status: 'synced',
          pendingCount: 0,
          lastSyncedAt: new Date()
        }));
        return;
      }
    }
  } finally {
    isProcessing = false;
  }
}

// Attach window online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    sync.update((s) => ({ ...s, status: s.pendingCount > 0 ? 'pending' : 'synced' }));
    processQueue();
  });

  window.addEventListener('offline', () => {
    sync.update((s) => ({ ...s, status: 'offline' }));
  });
}

/**
 * Start periodic polling of remote revision.
 * Polling checks `fetchRev()` when document.visibilityState is 'visible'.
 * If revision has changed, it triggers `fetchAll()` and updates local IndexedDB.
 *
 * @param {number} [intervalMs=20000]
 * @returns {Function} cleanup function to stop polling
 */
export function startPolling(intervalMs = 20000) {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }

  async function checkRevAndSync() {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }

    try {
      const revRes = await fetchRev();
      if (!revRes || !revRes.ok) return;

      const newRev = revRes.rev;
      if (lastKnownRev !== null && newRev !== lastKnownRev) {
        const allRes = await fetchAll();
        if (allRes && allRes.ok && allRes.data) {
          const db = await getDb();
          if (db) {
            const { transaksi, budget, goals, setting } = allRes.data;

            const tx = db.transaction(['transaksi', 'budget', 'goals', 'setting'], 'readwrite');
            if (Array.isArray(transaksi)) {
              for (const item of transaksi) await tx.objectStore('transaksi').put(item);
            }
            if (Array.isArray(budget)) {
              for (const item of budget) await tx.objectStore('budget').put(item);
            }
            if (Array.isArray(goals)) {
              for (const item of goals) await tx.objectStore('goals').put(item);
            }
            if (Array.isArray(setting)) {
              for (const item of setting) await tx.objectStore('setting').put(item);
            } else if (setting && typeof setting === 'object') {
              for (const [key, value] of Object.entries(setting)) {
                await tx.objectStore('setting').put({ key, value });
              }
            }
            await tx.done;
          }
          notifyDataSynced(allRes.data);
        }
      }
      lastKnownRev = newRev;
    } catch (err) {
      console.warn('Error during polling check:', err);
    }
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      checkRevAndSync();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  pollIntervalId = setInterval(checkRevAndSync, intervalMs);

  // Initial check
  checkRevAndSync();

  return () => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}
