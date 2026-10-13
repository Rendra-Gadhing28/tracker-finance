import { getDb } from './db.js';

/**
 * Valid action types supported by Google Apps Script / local store.
 */
export const VALID_ACTIONS = [
  'saveTx',
  'delTx',
  'saveBudget',
  'delBudget',
  'saveGoal',
  'delGoal',
  'saveSetting'
];

/**
 * Retrieve current API configuration (URL and token).
 * @returns {Promise<{ url: string, token: string }>}
 */
export async function getApiConfig() {
  let url = '';
  let token = '';

  const db = await getDb();
  if (db) {
    try {
      const urlSetting = await db.get('setting', 'script_url');
      const tokenSetting = await db.get('setting', 'script_token');
      url = urlSetting?.value || '';
      token = tokenSetting?.value || '';
    } catch {
      // ignore read error
    }
  }

  if (!url && typeof import.meta !== 'undefined') {
    url = import.meta.env?.PUBLIC_APPS_SCRIPT_URL || '';
  }
  if (!url && typeof process !== 'undefined') {
    url = process.env?.PUBLIC_APPS_SCRIPT_URL || '';
  }
  if (!token && typeof import.meta !== 'undefined') {
    token = import.meta.env?.PUBLIC_APPS_SCRIPT_TOKEN || '';
  }
  if (!token && typeof process !== 'undefined') {
    token = process.env?.PUBLIC_APPS_SCRIPT_TOKEN || '';
  }

  return { url, token };
}

/**
 * Apply mutation locally to IndexedDB.
 * @param {string} action
 * @param {any} payload
 * @returns {Promise<number>} timestamp revision
 */
export async function applyActionToLocalDb(action, payload) {
  const db = await getDb();
  if (!db) return Date.now();

  if (action === 'saveTx') {
    if (payload) await db.put('transaksi', payload);
  } else if (action === 'delTx') {
    const id = typeof payload === 'object' && payload !== null ? payload.id : payload;
    if (id) await db.delete('transaksi', id);
  } else if (action === 'saveBudget') {
    if (payload) await db.put('budget', payload);
  } else if (action === 'delBudget') {
    const id = typeof payload === 'object' && payload !== null ? payload.id : payload;
    if (id) await db.delete('budget', id);
  } else if (action === 'saveGoal') {
    if (payload) await db.put('goals', payload);
  } else if (action === 'delGoal') {
    const id = typeof payload === 'object' && payload !== null ? payload.id : payload;
    if (id) await db.delete('goals', id);
  } else if (action === 'saveSetting') {
    if (payload && payload.key !== undefined) {
      await db.put('setting', { key: payload.key, value: payload.value });
    } else if (payload && typeof payload === 'object') {
      for (const [k, v] of Object.entries(payload)) {
        await db.put('setting', { key: k, value: v });
      }
    }
  }

  const rev = Date.now();
  await db.put('setting', { key: '_last_rev', value: rev });
  return rev;
}

/**
 * Mock fetchAll operating against IndexedDB.
 */
export async function mockFetchAll() {
  const db = await getDb();
  if (!db) {
    return {
      ok: true,
      rev: Date.now(),
      data: { transaksi: [], budget: [], goals: [], setting: [] }
    };
  }

  const [transaksi, budget, goals, settingList] = await Promise.all([
    db.getAll('transaksi'),
    db.getAll('budget'),
    db.getAll('goals'),
    db.getAll('setting')
  ]);

  const lastRevSetting = settingList.find((s) => s.key === '_last_rev');
  const rev = lastRevSetting?.value || Date.now();

  return {
    ok: true,
    rev,
    data: {
      transaksi,
      budget,
      goals,
      setting: settingList
    }
  };
}

/**
 * Mock fetchRev operating against IndexedDB.
 */
export async function mockFetchRev() {
  const db = await getDb();
  if (!db) return { ok: true, rev: Date.now() };
  const lastRev = await db.get('setting', '_last_rev');
  return { ok: true, rev: lastRev?.value || Date.now() };
}

/**
 * Mock postAction operating against IndexedDB.
 */
export async function mockPostAction(action, payload) {
  const rev = (await applyActionToLocalDb(action, payload)) || Date.now();
  return { ok: true, rev };
}

/**
 * Checks whether the browser is online.
 * @returns {boolean}
 */
export function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

/**
 * Fetch all data from Google Apps Script or fallback to IndexedDB.
 * @returns {Promise<{ ok: boolean, rev: number, data: { transaksi: Array, budget: Array, goals: Array, setting: Array } }>}
 */
export function fetchAll() {
  return (async () => {
    const { url, token } = await getApiConfig();

    if (!url || !isOnline()) {
      return await mockFetchAll();
    }

    try {
      const reqUrl = new URL(url);
      reqUrl.searchParams.set('action', 'all');
      if (token) reqUrl.searchParams.set('token', token);

      const res = await fetch(reqUrl.toString(), { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json;
    } catch (err) {
      console.warn('fetchAll remote failed, using local mock data:', err);
      return await mockFetchAll();
    }
  })();
}

/**
 * Fetch current revision number from Google Apps Script or fallback to IndexedDB.
 * @returns {Promise<{ ok: boolean, rev: number }>}
 */
export function fetchRev() {
  return (async () => {
    const { url, token } = await getApiConfig();

    if (!url || !isOnline()) {
      return await mockFetchRev();
    }

    try {
      const reqUrl = new URL(url);
      reqUrl.searchParams.set('action', 'rev');
      if (token) reqUrl.searchParams.set('token', token);

      const res = await fetch(reqUrl.toString(), { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json;
    } catch (err) {
      console.warn('fetchRev remote failed, using local mock rev:', err);
      return await mockFetchRev();
    }
  })();
}

/**
 * Post an action to Google Apps Script or fallback to IndexedDB.
 * @param {string} action
 * @param {any} payload
 * @param {{ remoteOnly?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, rev: number }>}
 */
export async function postAction(action, payload, options = {}) {
  const { url, token } = await getApiConfig();
  const online = isOnline();

  if (!url || !online) {
    if (options.remoteOnly) {
      throw new Error(online ? 'Script URL not configured' : 'Network offline');
    }
    return await mockPostAction(action, payload);
  }

  try {
    const body = {
      action,
      token,
      payload,
      ...(typeof payload === 'object' && payload !== null ? payload : {})
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json || !json.ok) {
      throw new Error(json?.error || json?.message || 'Server returned ok: false');
    }
    await applyActionToLocalDb(action, payload);
    return json;
  } catch (err) {
    if (options.remoteOnly) {
      throw err;
    }
    console.warn(`postAction ${action} remote failed, applying locally:`, err);
    return await mockPostAction(action, payload);
  }
}
