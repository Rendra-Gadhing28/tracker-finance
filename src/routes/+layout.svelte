<script>
  import '../app.css';
  import { setContext, onMount } from 'svelte';
  import { page } from '$app/state';
  import SyncBadge from '$lib/components/SyncBadge.svelte';
  import TransactionSheet from '$lib/components/TransactionSheet.svelte';
  import Snackbar from '$lib/components/Snackbar.svelte';
  import {
    initData,
    budgets,
    transactions,
    goals,
    settings,
    budgetSummary,
    addTransaction,
    updateTransaction,
    deleteTransaction
  } from '$lib/stores/data.js';
  import { sync } from '$lib/stores/sync.js';
  import { formatRp } from '$lib/money.js';

  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} children
   */
  let { children } = $props();

  // Transaction Sheet state
  let isTxSheetOpen = $state(false);
  let txSheetMode = $state('create'); // 'create' | 'edit'
  let activeTx = $state(null);
  let lastUsedNominal = $state(0);
  let highlightedTxId = $state(null);
  let activeWeekDate = $state(null);

  // Snackbar state
  let isSnackbarOpen = $state(false);
  let snackbarMessage = $state('');
  let snackbarUndoFn = $state(null);

  onMount(() => {
    let cleanUp = null;
    initData().then((res) => {
      cleanUp = res;
    });

    return () => {
      cleanUp?.destroy?.();
    };
  });

  function openCreate(preset = null) {
    txSheetMode = 'create';
    if (preset) {
      activeTx = preset;
    } else if (activeWeekDate) {
      activeTx = { tanggal: activeWeekDate };
    } else {
      activeTx = null;
    }
    isTxSheetOpen = true;
  }

  function openEdit(tx) {
    txSheetMode = 'edit';
    activeTx = tx;
    isTxSheetOpen = true;
  }

  function showToast(message, onUndo) {
    snackbarMessage = message;
    snackbarUndoFn = onUndo || null;
    isSnackbarOpen = true;
  }

  // Provide to child pages via Svelte context
  setContext('txManager', {
    openCreate,
    openEdit,
    showToast,
    setActiveWeekDate: (d) => {
      activeWeekDate = d;
    },
    getHighlightedTxId: () => highlightedTxId
  });

  // Calculate category spent map for warning pills
  const categorySpentMap = $derived.by(() => {
    const map = {};
    for (const tx of $transactions || []) {
      if (tx.tipe === 'keluar' && tx.kategori_id) {
        map[tx.kategori_id] = (map[tx.kategori_id] || 0) + (Number(tx.nominal) || 0);
      }
    }
    return map;
  });

  async function handleSaveTransaction(txData) {
    if (txSheetMode === 'edit') {
      const originalTx = { ...activeTx };
      await updateTransaction(txData);
      showToast(`Diperbarui ${formatRp(txData.nominal)}`, async () => {
        await updateTransaction(originalTx);
      });
    } else {
      const created = await addTransaction(txData);
      lastUsedNominal = created.nominal;
      highlightedTxId = created.id;
      setTimeout(() => {
        if (highlightedTxId === created.id) {
          highlightedTxId = null;
        }
      }, 1200); // 1.2s flash per PRD 12.4
      showToast(`Dicatat ${formatRp(created.nominal)}`, async () => {
        await deleteTransaction(created.id);
      });
    }
  }

  async function handleDeleteTransaction(txId) {
    const deletedTx = { ...activeTx };
    await deleteTransaction(txId);
    showToast(`Dihapus`, async () => {
      await addTransaction(deletedTx);
    });
  }

  const navItems = [
    { href: '/', label: 'Beranda', icon: '🏠' },
    { href: '/statistik', label: 'Statistik', icon: '📊' },
    { action: 'tambah', label: 'Tambah', icon: '＋' },
    { href: '/tabungan', label: 'Tabungan', icon: '🐷' },
    { href: '/pengaturan', label: 'Atur', icon: '⚙️' }
  ];

  function isActive(href) {
    if (!href) return false;
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname.startsWith(href);
  }

  const syncStatus = $derived.by(() => {
    if ($sync.status === 'offline') return 'offline';
    if ($sync.pendingCount > 0) return 'saving';
    return 'ok';
  });

  const syncLabel = $derived.by(() => {
    if ($sync.status === 'offline') return 'Offline';
    if ($sync.pendingCount > 0) return `${$sync.pendingCount} menunggu terkirim`;
    return 'Tersinkron';
  });
</script>

<div class="app-viewport">
  <div class="mobile-shell">
    <!-- Top Header -->
    <header class="app-header">
      <div class="header-left">
        <SyncBadge status={syncStatus} label={syncLabel} />
      </div>
      <div class="header-right">
        <h1 class="header-title">
          <span class="cat-paw" aria-hidden="true">🐾</span>
          <span>Neko Dompet</span>
        </h1>
      </div>
    </header>

    <!-- Main Page Content -->
    <main class="app-content">
      {@render children?.()}
    </main>

    <!-- Bottom Tab Bar -->
    <nav class="bottom-nav" aria-label="Navigasi Utama">
      <div class="bottom-nav-inner">
        {#each navItems as item}
          {#if item.action === 'tambah'}
            <div class="nav-item-center-wrapper">
              <button
                type="button"
                class="nav-btn-tambah"
                onclick={() => openCreate(null)}
                aria-label="Tambah Transaksi"
              >
                <span class="tambah-icon" aria-hidden="true">＋</span>
              </button>
              <span class="tambah-label">Tambah</span>
            </div>
          {:else}
            <a
              href={item.href}
              class="nav-tab {isActive(item.href) ? 'active' : ''}"
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              <span class="nav-tab-icon">{item.icon}</span>
              <span class="nav-tab-label">{item.label}</span>
            </a>
          {/if}
        {/each}
      </div>
    </nav>

    <!-- Global Transaction Bottom Sheet -->
    <TransactionSheet
      bind:open={isTxSheetOpen}
      mode={txSheetMode}
      initialTx={activeTx}
      categories={$budgets}
      transactions={$transactions}
      goals={$goals}
      totalBudgetA={$budgetSummary.A}
      totalSpentP={$budgetSummary.P}
      {categorySpentMap}
      lastNominal={lastUsedNominal}
      onsave={handleSaveTransaction}
      ondelete={handleDeleteTransaction}
    />

    <!-- Global Floating Snackbar -->
    <Snackbar
      bind:open={isSnackbarOpen}
      message={snackbarMessage}
      onaction={() => snackbarUndoFn?.()}
    />
  </div>
</div>

<style>
  .app-viewport {
    display: flex;
    justify-content: center;
    align-items: stretch;
    min-height: 100dvh;
    background-color: #ECE2D0;
  }

  .mobile-shell {
    position: relative;
    width: 100%;
    max-width: 480px;
    min-height: 100dvh;
    background-color: var(--bg);
    display: flex;
    flex-direction: column;
    box-shadow: 0 0 24px rgba(74, 59, 50, 0.08);
  }

  /* Header */
  .app-header {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background-color: var(--bg);
    border-bottom: 1.5px solid var(--line);
    min-height: 56px;
    box-sizing: border-box;
  }

  .header-left {
    display: flex;
    align-items: center;
  }

  .header-right {
    display: flex;
    align-items: center;
  }

  .header-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .cat-paw {
    font-size: 16px;
  }

  /* Main content area */
  .app-content {
    flex: 1;
    padding: 14px;
    padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;
  }

  /* Bottom Navigation */
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 480px;
    background-color: var(--card);
    border-top: 2px solid var(--line);
    z-index: 60;
    box-sizing: border-box;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .bottom-nav-inner {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 64px;
    padding: 0 4px;
    position: relative;
  }

  .nav-tab {
    flex: 1;
    min-height: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    color: var(--mute);
    gap: 2px;
    transition: color 150ms ease-out, transform 100ms ease-out;
    padding: 6px 0;
  }

  .nav-tab:active {
    transform: scale(0.95);
  }

  .nav-tab.active {
    color: var(--accent-pressed);
    font-weight: 700;
  }

  .nav-tab-icon {
    font-size: 20px;
    line-height: 1;
  }

  .nav-tab-label {
    font-size: 11px;
    line-height: 1;
  }

  /* Center Prominent Tambah Button */
  .nav-item-center-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    position: relative;
    padding-bottom: 4px;
  }

  .nav-btn-tambah {
    position: absolute;
    top: -20px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background-color: var(--accent);
    color: #FFFDF7;
    border: 2px solid var(--accent-pressed);
    border-bottom: 4px solid var(--accent-pressed);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    touch-action: manipulation;
    box-sizing: border-box;
    transition: transform 120ms ease-out, border-bottom-width 120ms ease-out, background-color 120ms ease-out;
  }

  .nav-btn-tambah:active {
    transform: translateY(3px);
    border-bottom-width: 1px;
    background-color: var(--accent-pressed);
  }

  .tambah-icon {
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
  }

  .tambah-label {
    font-size: 11px;
    color: var(--mute);
    margin-top: 36px;
    line-height: 1;
  }
</style>
