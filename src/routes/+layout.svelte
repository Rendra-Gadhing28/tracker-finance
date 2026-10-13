<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { sync, initData } from '$lib/stores';
  import SyncBadge from '$lib/components/SyncBadge.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Button from '$lib/components/Button.svelte';

  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} children
   */
  let { children } = $props();

  let isTambahOpen = $state(false);
  let selectedTipe = $state('keluar');

  onMount(() => {
    const handle = initData();
    return () => {
      handle?.then((h) => h?.destroy?.());
    };
  });

  const syncLabel = $derived(
    $sync.pendingCount > 0 ? `${$sync.pendingCount} antrean` : undefined
  );

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
</script>

<div class="app-viewport">
  <div class="mobile-shell">
    <!-- Top Header -->
    <header class="app-header">
      <div class="header-left">
        <SyncBadge status={$sync.status} label={syncLabel} />
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
                onclick={() => (isTambahOpen = true)}
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

    <!-- BottomSheet for Tambah Transaksi -->
    <BottomSheet bind:open={isTambahOpen} title="Catat Transaksi">
      <div class="tambah-sheet-body">
        <div class="type-selector">
          <Chip
            selected={selectedTipe === 'keluar'}
            icon="💸"
            label="Keluar"
            onclick={() => (selectedTipe = 'keluar')}
          />
          <Chip
            selected={selectedTipe === 'masuk'}
            icon="💰"
            label="Masuk"
            onclick={() => (selectedTipe = 'masuk')}
          />
          <Chip
            selected={selectedTipe === 'tabung'}
            icon="🐷"
            label="Tabung"
            onclick={() => (selectedTipe = 'tabung')}
          />
        </div>

        <div class="sheet-form-placeholder">
          <p class="sheet-hint">
            Pencatatan cepat dengan kartu kategori dan nominal instan.
          </p>
        </div>

        <div class="sheet-actions">
          <Button
            variant="secondary"
            full
            onclick={() => (isTambahOpen = false)}
          >
            Batal
          </Button>
          <Button
            variant="primary"
            full
            onclick={() => (isTambahOpen = false)}
          >
            Lanjut
          </Button>
        </div>
      </div>
    </BottomSheet>
  </div>
</div>

<style>
  .app-viewport {
    display: flex;
    justify-content: center;
    align-items: stretch;
    min-height: 100dvh;
    background-color: #ECE2D0; /* subtle framing background on wide monitors */
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

  /* Sheet body inside Tambah */
  .tambah-sheet-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .type-selector {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .sheet-form-placeholder {
    padding: 16px;
    background-color: var(--bg);
    border-radius: var(--radius-card, 22px);
    border: 1.5px solid var(--line);
    text-align: center;
  }

  .sheet-hint {
    font-size: 14px;
    color: var(--mute);
    margin: 0;
  }

  .sheet-actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }
</style>
