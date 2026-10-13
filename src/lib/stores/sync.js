import { writable } from 'svelte/store';

/**
 * Sync state store representing sync status with Google Sheets / outbox queue.
 * Shape: { status: 'synced' | 'pending' | 'offline', pendingCount: number, lastSyncedAt: Date|null }
 */
export const sync = writable({
  status: 'synced',
  pendingCount: 0,
  lastSyncedAt: null
});

export const syncStore = sync;
