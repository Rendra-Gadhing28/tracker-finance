import { writable, readable, derived } from 'svelte/store';
import { getDb, seedInitialData } from '../db.js';
import { getWeekRange, isDateInWeek, calculateBudgetFormulas, toWIBISOString } from '../week.js';
import { enqueueAction, onDataSynced, startPolling } from '../sync/outbox.js';
import { sync } from './sync.js';

export const DEFAULT_SETTINGS = {
  uang_jajan_mingguan: 145000,
  awal_minggu: 1,
  saldo_awal: 0,
  tanpa_jajan: '',
  script_url: '',
  script_token: ''
};

/**
 * Reactive ticker store updating every 60s and on visibilitychange / window focus (PRD 10.5).
 */
export const ticker = readable(Date.now(), (set) => {
  if (typeof window === 'undefined') return;

  const update = () => set(Date.now());
  const interval = setInterval(update, 60000);

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      update();
    }
  };

  const handleFocus = () => {
    update();
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }
  window.addEventListener('focus', handleFocus);

  return () => {
    clearInterval(interval);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
    window.removeEventListener('focus', handleFocus);
  };
});

/**
 * Core writable stores.
 */
export const transactions = writable([]);
export const budgets = writable([]);
export const goals = writable([]);
export const settings = writable({ ...DEFAULT_SETTINGS });

/**
 * Derived store: active week range { start: Date, end: Date } based on settings.awal_minggu.
 */
export const currentWeekRange = derived([settings, ticker], ([$settings, _]) => {
  const startDay = $settings?.awal_minggu ?? 1;
  return getWeekRange(new Date(), startDay);
});

/**
 * Derived store: transactions within the current week.
 */
export const transactionsThisWeek = derived(
  [transactions, currentWeekRange, ticker],
  ([$transactions, $range, _]) => {
    return ($transactions || []).filter((tx) =>
      isDateInWeek(tx.tanggal, $range.start, $range.end)
    );
  }
);

/**
 * Derived store: core budget calculations (A, P, S, r, hari_ke, hari_sisa, jatah, sisa_hari, status).
 */
export const budgetSummary = derived(
  [budgets, transactionsThisWeek, settings, ticker],
  ([$budgets, $transactionsThisWeek, $settings, _]) => {
    return calculateBudgetFormulas({
      budgetCategories: $budgets,
      transactionsThisWeek: $transactionsThisWeek,
      todayDate: new Date(),
      startDayOfWeek: $settings?.awal_minggu ?? 1
    });
  }
);

export const weeklyCalculations = budgetSummary;

/**
 * Derived store: total wallet balance according to PRD 10.1:
 * saldo_awal + all masuk - all keluar - all tabung
 */
export const walletBalance = derived(
  [transactions, settings],
  ([$transactions, $settings]) => {
    const saldoAwal = Number($settings?.saldo_awal) || 0;
    let total = saldoAwal;

    for (const tx of $transactions || []) {
      const nominal = Number(tx.nominal) || 0;
      if (tx.tipe === 'masuk') {
        total += nominal;
      } else if (tx.tipe === 'keluar') {
        total -= nominal;
      } else if (tx.tipe === 'tabung') {
        total -= nominal;
      }
    }

    return total;
  }
);

/**
 * Derived store: goals with calculated accumulated savings ('terkumpul').
 */
export const goalsWithProgress = derived(
  [goals, transactions],
  ([$goals, $transactions]) => {
    const progressMap = {};
    for (const tx of $transactions || []) {
      if (tx.tipe === 'tabung' && tx.goal_id) {
        progressMap[tx.goal_id] = (progressMap[tx.goal_id] || 0) + (Number(tx.nominal) || 0);
      }
    }
    return ($goals || []).map((g) => ({
      ...g,
      terkumpul: progressMap[g.id] || 0
    }));
  }
);

/**
 * Generate a client transaction ID (e.g. tx_lq3k9a_x7f2).
 * @returns {string}
 */
export function generateTxId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 6);
  return `tx_${timestamp}_${randomPart}`;
}

/**
 * Reload all stores directly from IndexedDB.
 */
export async function reloadFromDb() {
  const db = await getDb();
  if (!db) return;

  const [txList, budgetList, goalList, settingList] = await Promise.all([
    db.getAll('transaksi'),
    db.getAll('budget'),
    db.getAll('goals'),
    db.getAll('setting')
  ]);

  if (Array.isArray(txList)) {
    // Sort transactions by date descending
    txList.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
    transactions.set(txList);
  }

  if (Array.isArray(budgetList)) {
    // Sort budget by urut ascending
    budgetList.sort((a, b) => (a.urut || 0) - (b.urut || 0));
    budgets.set(budgetList);
  }

  if (Array.isArray(goalList)) {
    goals.set(goalList);
  }

  if (Array.isArray(settingList)) {
    const sObj = { ...DEFAULT_SETTINGS };
    for (const item of settingList) {
      if (item.key) {
        sObj[item.key] = item.value;
      }
    }
    settings.set(sObj);
  }
}

let isInitialized = false;
let stopPollingFn = null;

/**
 * Initialize data layer: seeds initial DB, populates stores, starts outbox polling.
 * Safe to call multiple times or during app boot.
 */
export async function initData() {
  if (typeof indexedDB === 'undefined') return;

  await seedInitialData();
  await reloadFromDb();

  const db = await getDb();
  if (db) {
    const pendingCount = await db.count('outbox');
    const isOnline = typeof navigator === 'undefined' || navigator.onLine;
    sync.update((s) => ({
      ...s,
      pendingCount,
      status: !isOnline ? 'offline' : pendingCount > 0 ? 'pending' : 'synced'
    }));
  }

  if (!isInitialized) {
    isInitialized = true;
    onDataSynced(() => {
      reloadFromDb();
    });
    stopPollingFn = startPolling(20000);
  }

  return {
    destroy: () => {
      if (stopPollingFn) {
        stopPollingFn();
        stopPollingFn = null;
      }
      isInitialized = false;
    }
  };
}

/**
 * Add a new transaction (optimistic UI + outbox queue).
 * @param {Object} tx
 * @returns {Promise<Object>}
 */
export async function addTransaction(tx) {
  const newTx = {
    ...tx,
    id: tx.id || generateTxId(),
    tanggal: tx.tanggal || toWIBISOString(new Date()),
    nominal: Math.round(Number(tx.nominal)) || 0
  };

  transactions.update((list) => [newTx, ...list]);
  await enqueueAction('saveTx', newTx);
  return newTx;
}

/**
 * Update an existing transaction (optimistic UI + outbox queue).
 * @param {Object} tx
 * @returns {Promise<Object>}
 */
export async function updateTransaction(tx) {
  const updatedTx = {
    ...tx,
    nominal: Math.round(Number(tx.nominal)) || 0
  };

  transactions.update((list) =>
    list.map((item) => (item.id === updatedTx.id ? updatedTx : item))
  );
  await enqueueAction('saveTx', updatedTx);
  return updatedTx;
}

/**
 * Delete a transaction (optimistic UI + outbox queue).
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteTransaction(id) {
  transactions.update((list) => list.filter((item) => item.id !== id));
  await enqueueAction('delTx', { id });
}

/**
 * Save / upsert a budget category (optimistic UI + outbox queue).
 * @param {Object} budget
 * @returns {Promise<Object>}
 */
export async function saveBudget(budget) {
  budgets.update((list) => {
    const idx = list.findIndex((b) => b.id === budget.id);
    if (idx >= 0) {
      const copy = [...list];
      copy[idx] = budget;
      return copy;
    }
    return [...list, budget];
  });

  await enqueueAction('saveBudget', budget);
  return budget;
}

/**
 * Delete a budget category (optimistic UI + outbox queue).
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteBudget(id) {
  budgets.update((list) => list.filter((b) => b.id !== id));
  await enqueueAction('delBudget', { id });
}

/**
 * Save / upsert a goal (optimistic UI + outbox queue).
 * @param {Object} goal
 * @returns {Promise<Object>}
 */
export async function saveGoal(goal) {
  goals.update((list) => {
    const idx = list.findIndex((g) => g.id === goal.id);
    if (idx >= 0) {
      const copy = [...list];
      copy[idx] = goal;
      return copy;
    }
    return [...list, goal];
  });

  await enqueueAction('saveGoal', goal);
  return goal;
}

/**
 * Delete a goal (optimistic UI + outbox queue).
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteGoal(id) {
  goals.update((list) => list.filter((g) => g.id !== id));
  await enqueueAction('delGoal', { id });
}

/**
 * Save a setting key-value pair (optimistic UI + outbox queue).
 * Secret settings starting with 'script_' bypass outbox and are saved directly to IndexedDB.
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
export async function saveSetting(key, value) {
  settings.update((s) => ({ ...s, [key]: value }));
  if (typeof key === 'string' && key.startsWith('script_')) {
    const db = await getDb();
    if (db) {
      await db.put('setting', { key, value });
    }
    return;
  }
  await enqueueAction('saveSetting', { key, value });
}
