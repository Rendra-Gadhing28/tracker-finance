<script>
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import CategorySheet from '$lib/components/CategorySheet.svelte';
  import Snackbar from '$lib/components/Snackbar.svelte';
  import {
    budgets,
    settings,
    transactions,
    skippedRowsCount,
    saveBudget,
    deleteBudget,
    saveSetting
  } from '$lib/stores';
  import { formatRp, parseRp } from '$lib/money';
  import { setTheme, getTheme } from '$lib/theme.js';

  let currentTheme = $state('system');
  $effect(() => {
    currentTheme = getTheme();
  });

  function handleThemeChange(t) {
    currentTheme = t;
    setTheme(t);
  }

  // Category sheet state
  let isCategorySheetOpen = $state(false);
  let selectedCategory = $state(null);

  // Uang jajan edit sheet state
  let isUangJajanSheetOpen = $state(false);
  let uangJajanInput = $state('145.000');

  // Saldo awal edit sheet state
  let isSaldoAwalSheetOpen = $state(false);
  let saldoAwalInput = $state('0');

  // Awal minggu notice
  let showAwalMingguNote = $state(false);

  // 5-second undo snackbar state
  let isSnackbarOpen = $state(false);
  let deletedCategoryForUndo = $state(null);

  const HARI_OPTIONS = [
    { value: 1, label: 'Senin' },
    { value: 2, label: 'Selasa' },
    { value: 3, label: 'Rabu' },
    { value: 4, label: 'Kamis' },
    { value: 5, label: 'Jumat' },
    { value: 6, label: 'Sabtu' },
    { value: 7, label: 'Minggu' }
  ];

  // Grouped and sorted categories
  const keluarCategories = $derived(
    $budgets
      .filter((b) => b.tipe === 'keluar')
      .sort((a, b) => (a.urut || 0) - (b.urut || 0))
  );

  const tabungCategories = $derived(
    $budgets
      .filter((b) => b.tipe === 'tabung')
      .sort((a, b) => (a.urut || 0) - (b.urut || 0))
  );

  const masukCategories = $derived(
    $budgets
      .filter((b) => b.tipe === 'masuk')
      .sort((a, b) => (a.urut || 0) - (b.urut || 0))
  );

  // Allocation calculations
  const totalAllocated = $derived(
    $budgets
      .filter((b) => b.tipe === 'keluar' || b.tipe === 'tabung')
      .reduce((sum, b) => sum + (Number(b.limit_mingguan) || 0), 0)
  );

  const uangJajan = $derived(Number($settings.uang_jajan_mingguan) || 145000);
  const allocDiff = $derived(uangJajan - totalAllocated);

  const allocStatus = $derived(
    totalAllocated === uangJajan
      ? 'equal'
      : totalAllocated < uangJajan
        ? 'less'
        : 'more'
  );

  const allocPercent = $derived(
    uangJajan > 0 ? Math.min(100, Math.round((totalAllocated / uangJajan) * 100)) : 0
  );

  function openEditCategory(cat) {
    selectedCategory = cat;
    isCategorySheetOpen = true;
  }

  function openNewCategory() {
    selectedCategory = null;
    isCategorySheetOpen = true;
  }

  async function handleSaveCategory(catData) {
    await saveBudget(catData);
  }

  async function handleSwapCategoryOrder(catA, catB) {
    const tempUrut = catA.urut;
    const updatedA = { ...catA, urut: catB.urut };
    const updatedB = { ...catB, urut: tempUrut };
    await saveBudget(updatedA);
    await saveBudget(updatedB);
  }

  async function handleDeleteCategory(catId) {
    const deletedCat = $budgets.find((b) => b.id === catId);
    if (!deletedCat) return;

    await deleteBudget(catId);
    deletedCategoryForUndo = deletedCat;
    isSnackbarOpen = true;
  }

  async function handleUndoDelete() {
    if (deletedCategoryForUndo) {
      await saveBudget(deletedCategoryForUndo);
      deletedCategoryForUndo = null;
    }
  }

  function openUangJajanEditor() {
    uangJajanInput = (Number($settings.uang_jajan_mingguan) || 145000).toLocaleString('id-ID');
    isUangJajanSheetOpen = true;
  }

  async function handleSaveUangJajan() {
    const parsed = parseRp(uangJajanInput);
    if (parsed >= 0 && parsed <= 10000000) {
      await saveSetting('uang_jajan_mingguan', parsed);
    }
    isUangJajanSheetOpen = false;
  }

  function openSaldoAwalEditor() {
    saldoAwalInput = (Number($settings.saldo_awal) || 0).toLocaleString('id-ID');
    isSaldoAwalSheetOpen = true;
  }

  async function handleSaveSaldoAwal() {
    const parsed = parseRp(saldoAwalInput);
    await saveSetting('saldo_awal', parsed);
    isSaldoAwalSheetOpen = false;
  }

  async function handleAwalMingguChange(e) {
    const val = Number(e.target.value);
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Pembagian minggu berubah untuk seluruh riwayat. Lanjutkan?')
      : true;

    if (!confirmed) {
      e.target.value = String($settings.awal_minggu ?? 1);
      return;
    }

    showAwalMingguNote = true;
    await saveSetting('awal_minggu', val);
  }
</script>

<svelte:head>
  <title>Pengaturan · Neko Dompet</title>
</svelte:head>

<div class="pengaturan-page">
  <!-- Page Header -->
  <header class="page-header">
    <h1 class="page-title">Pengaturan</h1>
  </header>

  {#if $skippedRowsCount > 0}
    <div class="skipped-rows-pill" role="alert">
      <span>⚠️ {$skippedRowsCount} baris diabaikan</span>
    </div>
  {/if}

  <!-- Card Uang Jajan Mingguan & Allocation Bar (Section 13.2) -->
  <Card variant="neutral">
    <div class="uang-jajan-block">
      <div class="uj-top-row">
        <div>
          <span class="uj-label">Uang jajan mingguan</span>
          <div class="uj-amount font-num tabular-nums">{formatRp(uangJajan)}</div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onclick={openUangJajanEditor}
          aria-label="Ubah uang jajan mingguan"
        >
          Ubah
        </Button>
      </div>

      <!-- Allocation Progress Bar -->
      <div class="alloc-bar-track">
        <div
          class="alloc-bar-fill status-{allocStatus}"
          style="width: {allocPercent}%;"
        ></div>
      </div>

      <!-- Allocation Status Text / Pill -->
      <div class="alloc-status-row">
        {#if allocStatus === 'equal'}
          <span class="alloc-text status-equal">
            Teralokasi {formatRp(totalAllocated)} · pas ✓
          </span>
        {:else if allocStatus === 'less'}
          <span class="alloc-text status-less">
            Belum dialokasikan {formatRp(allocDiff)}
          </span>
        {:else}
          <span class="alloc-text status-more">
            Lebih {formatRp(Math.abs(allocDiff))} dari uang jajan
          </span>
        {/if}
      </div>
    </div>
  </Card>

  <!-- Categories Section Grouped by Type (Section 13.3) -->
  <div class="categories-section">
    <!-- Pengeluaran -->
    <div class="cat-group">
      <h3 class="cat-group-title">Pengeluaran</h3>
      <div class="cat-list">
        {#each keluarCategories as cat (cat.id)}
          <button
            type="button"
            class="cat-row interactive-tap"
            onclick={() => openEditCategory(cat)}
            aria-label="Ubah kategori {cat.nama}"
          >
            <div class="cat-left">
              <span class="cat-badge var-{cat.warna}">{cat.ikon}</span>
              <span class="cat-name">{cat.nama}</span>
            </div>
            <div class="cat-right">
              <span class="cat-limit tipe-keluar tabular-nums">{formatRp(cat.limit_mingguan)}</span>
              <span class="chevron" aria-hidden="true">›</span>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Tabungan -->
    <div class="cat-group">
      <h3 class="cat-group-title">Tabungan</h3>
      <div class="cat-list">
        {#each tabungCategories as cat (cat.id)}
          <button
            type="button"
            class="cat-row interactive-tap"
            onclick={() => openEditCategory(cat)}
            aria-label="Ubah kategori {cat.nama}"
          >
            <div class="cat-left">
              <span class="cat-badge var-{cat.warna}">{cat.ikon}</span>
              <span class="cat-name">{cat.nama}</span>
            </div>
            <div class="cat-right">
              <span class="cat-limit tipe-tabung tabular-nums">{formatRp(cat.limit_mingguan)}</span>
              <span class="chevron" aria-hidden="true">›</span>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Pemasukan -->
    <div class="cat-group">
      <h3 class="cat-group-title">Pemasukan</h3>
      <div class="cat-list">
        {#each masukCategories as cat (cat.id)}
          <button
            type="button"
            class="cat-row interactive-tap"
            onclick={() => openEditCategory(cat)}
            aria-label="Ubah kategori {cat.nama}"
          >
            <div class="cat-left">
              <span class="cat-badge var-{cat.warna}">{cat.ikon}</span>
              <span class="cat-name">{cat.nama}</span>
            </div>
            <div class="cat-right">
              <span class="cat-limit tipe-masuk tabular-nums">{formatRp(cat.limit_mingguan)}</span>
              <span class="chevron" aria-hidden="true">›</span>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Tambah Kategori Baru Button -->
    <div class="new-cat-btn-wrap">
      <Button
        variant="secondary"
        full
        onclick={openNewCategory}
      >
        ＋ Kategori baru
      </Button>
    </div>
  </div>

  <!-- General Settings Section (Umum) -->
  <div class="general-section">
    <h3 class="section-title">Umum</h3>
    <Card>
      <div class="settings-rows">
        <!-- Awal Minggu -->
        <div class="setting-item">
          <div class="setting-text">
            <span class="setting-label">Awal minggu</span>
            {#if showAwalMingguNote}
              <span class="setting-subnote">Pembagian minggu berubah</span>
            {/if}
          </div>
          <div class="setting-control">
            <select
              class="select-control"
              value={$settings.awal_minggu ?? 1}
              onchange={handleAwalMingguChange}
              aria-label="Pilih hari awal minggu"
            >
              {#each HARI_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Saldo Awal -->
        <div class="setting-item">
          <div class="setting-text">
            <span class="setting-label">Saldo awal</span>
          </div>
          <button
            type="button"
            class="setting-btn-link"
            onclick={openSaldoAwalEditor}
          >
            <span class="tabular-nums">{formatRp($settings.saldo_awal ?? 0)}</span>
            <span class="chevron" aria-hidden="true">›</span>
          </button>
        </div>

        <!-- Tema Tampilan -->
        <div class="setting-item">
          <div class="setting-text">
            <span class="setting-label">Tema tampilan</span>
          </div>
          <div class="theme-toggle-group">
            <button
              type="button"
              class="theme-chip"
              class:active={currentTheme === 'system'}
              onclick={() => handleThemeChange('system')}
            >
              Sistem
            </button>
            <button
              type="button"
              class="theme-chip"
              class:active={currentTheme === 'light'}
              onclick={() => handleThemeChange('light')}
            >
              Terang
            </button>
            <button
              type="button"
              class="theme-chip"
              class:active={currentTheme === 'dark'}
              onclick={() => handleThemeChange('dark')}
            >
              Gelap
            </button>
          </div>
        </div>

        <!-- Sambungan Sheet -->
        <div class="setting-item">
          <div class="setting-text">
            <span class="setting-label">Sambungan Sheet</span>
            <span class="setting-subnote">
              {$settings.script_url ? '✓ Terhubung' : 'Belum terhubung'}
            </span>
          </div>
          <a href="/pengaturan/sambungan" class="setting-btn-link">
            <span>Atur</span>
            <span class="chevron" aria-hidden="true">›</span>
          </a>
        </div>
      </div>
    </Card>
  </div>
</div>

<!-- Category Edit/Create Sheet (Section 13.4) -->
<CategorySheet
  bind:open={isCategorySheetOpen}
  category={selectedCategory}
  existingCategories={$budgets}
  transactions={$transactions}
  onsave={handleSaveCategory}
  ondelete={handleDeleteCategory}
  onswaporder={handleSwapCategoryOrder}
/>

<!-- Sheet for Editing Uang Jajan Mingguan -->
<BottomSheet bind:open={isUangJajanSheetOpen} title="Uang Jajan Mingguan">
  <form class="quick-edit-form" onsubmit={(e) => { e.preventDefault(); handleSaveUangJajan(); }}>
    <div class="form-group">
      <label for="uj-input">Nominal Mingguan</label>
      <div class="input-with-prefix">
        <span class="prefix">Rp</span>
        <input
          id="uj-input"
          type="text"
          inputmode="numeric"
          bind:value={uangJajanInput}
          oninput={(e) => {
            const num = parseRp(e.target.value);
            uangJajanInput = num > 0 ? num.toLocaleString('id-ID') : '0';
          }}
          required
        />
      </div>
      <span class="input-preview tabular-nums">
        {formatRp(parseRp(uangJajanInput))}
      </span>
    </div>

    <div class="modal-actions">
      <Button
        type="button"
        variant="secondary"
        full
        onclick={() => (isUangJajanSheetOpen = false)}
      >
        Batal
      </Button>
      <Button
        type="submit"
        variant="primary"
        full
      >
        Simpan
      </Button>
    </div>
  </form>
</BottomSheet>

<!-- Sheet for Editing Saldo Awal -->
<BottomSheet bind:open={isSaldoAwalSheetOpen} title="Saldo Awal Dompet">
  <form class="quick-edit-form" onsubmit={(e) => { e.preventDefault(); handleSaveSaldoAwal(); }}>
    <div class="form-group">
      <label for="sa-input">Nominal Saldo Awal</label>
      <div class="input-with-prefix">
        <span class="prefix">Rp</span>
        <input
          id="sa-input"
          type="text"
          inputmode="numeric"
          bind:value={saldoAwalInput}
          oninput={(e) => {
            const num = parseRp(e.target.value);
            saldoAwalInput = num > 0 ? num.toLocaleString('id-ID') : '0';
          }}
          required
        />
      </div>
      <span class="input-preview tabular-nums">
        {formatRp(parseRp(saldoAwalInput))}
      </span>
    </div>

    <div class="modal-actions">
      <Button
        type="button"
        variant="secondary"
        full
        onclick={() => (isSaldoAwalSheetOpen = false)}
      >
        Batal
      </Button>
      <Button
        type="submit"
        variant="primary"
        full
      >
        Simpan
      </Button>
    </div>
  </form>
</BottomSheet>

<!-- 5-Second Undo Snackbar -->
<Snackbar
  bind:open={isSnackbarOpen}
  message={`Kategori "${deletedCategoryForUndo?.nama || ''}" dihapus`}
  actionLabel="Urungkan"
  onaction={handleUndoDelete}
  duration={5000}
/>

<style>
  .pengaturan-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 24px;
    width: 100%;
    box-sizing: border-box;
  }

  /* Page Header */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 0 4px;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    color: var(--fg);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .skipped-rows-pill {
    background-color: var(--bg-raised);
    border: 1px solid var(--warn);
    border-radius: var(--r, 10px);
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--warn);
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: none;
  }

  /* Uang Jajan Card */
  .uang-jajan-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .uj-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .uj-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--fg-muted);
  }

  .uj-amount {
    font-size: 26px;
    font-weight: 700;
    color: var(--fg);
    margin-top: 2px;
    letter-spacing: -0.02em;
  }

  .alloc-bar-track {
    width: 100%;
    height: 8px;
    background-color: var(--track);
    border-radius: var(--r-bar, 4px);
    overflow: hidden;
  }

  .alloc-bar-fill {
    height: 100%;
    border-radius: var(--r-bar, 4px);
    transition: background-color 240ms ease-out;
  }

  .alloc-bar-fill.status-equal {
    background-color: var(--accent);
    box-shadow: none;
  }

  .alloc-bar-fill.status-less {
    background-color: var(--warn);
    box-shadow: none;
  }

  .alloc-bar-fill.status-more {
    background-color: var(--expense);
    box-shadow: none;
  }

  .alloc-status-row {
    display: flex;
    align-items: center;
  }

  .alloc-text {
    font-size: 13px;
    font-weight: 600;
  }

  .alloc-text.status-equal {
    color: var(--accent);
  }

  .alloc-text.status-less {
    color: var(--warn);
  }

  .alloc-text.status-more {
    color: var(--expense);
  }

  /* Categories Section */
  .categories-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .cat-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cat-group-title {
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-left: 4px;
    margin: 0;
  }

  .cat-list {
    display: flex;
    flex-direction: column;
    background: var(--bg-raised);
    border-radius: var(--r, 10px);
    border: 1px solid var(--line);
    overflow: hidden;
  }

  .cat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border: none;
    background: transparent;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: background-color 100ms ease-out;
    width: 100%;
    box-sizing: border-box;
  }

  .cat-row:last-child {
    border-bottom: none;
  }

  .cat-row:hover, .cat-row:active {
    background-color: var(--line);
  }

  .cat-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .cat-badge {
    width: 34px;
    height: 34px;
    border-radius: var(--r-bar, 4px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    border: 1px solid var(--line);
    background: var(--bg-raised);
    flex-shrink: 0;
  }

  .cat-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg);
  }

  .cat-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cat-limit {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-muted);
  }

  .cat-limit.tipe-keluar {
    color: var(--expense);
  }

  .cat-limit.tipe-tabung {
    color: var(--warn);
  }

  .cat-limit.tipe-masuk {
    color: var(--accent);
  }

  .chevron {
    font-size: 18px;
    color: var(--fg-muted);
    font-weight: 600;
  }

  .new-cat-btn-wrap {
    margin-top: 4px;
  }

  /* General Settings */
  .general-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-left: 4px;
    margin: 0;
  }

  .settings-rows {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
  }

  .setting-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .setting-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg);
  }

  .setting-subnote {
    font-size: 12px;
    color: var(--fg-muted);
  }

  .theme-toggle-group {
    display: flex;
    gap: 4px;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--r, 10px);
    padding: 3px;
  }

  .theme-chip {
    border: none;
    background: transparent;
    color: var(--fg-muted);
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 120ms var(--ease), color 120ms var(--ease);
  }

  .theme-chip.active {
    background: var(--fg);
    color: var(--bg);
    font-weight: 600;
  }

  .select-control {
    padding: 6px 12px;
    border-radius: var(--r, 10px);
    border: 1px solid var(--line);
    background-color: var(--bg-raised);
    color: var(--fg);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .select-control:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: none;
  }

  .setting-btn-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--accent);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    padding: 4px 0;
  }

  .setting-btn-link:hover {
    color: var(--fg);
  }

  /* Quick Edit Modal / Sheet Forms */
  .quick-edit-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
  }

  .input-with-prefix {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-with-prefix .prefix {
    position: absolute;
    left: 14px;
    font-size: 14px;
    font-weight: 600;
    color: var(--fg-muted);
    pointer-events: none;
  }

  .input-with-prefix input {
    width: 100%;
    min-height: 44px;
    padding: 10px 14px 10px 42px;
    border-radius: var(--r, 10px);
    border: 1px solid var(--line);
    background-color: var(--bg-raised);
    color: var(--fg);
    font-family: var(--font-display);
    font-size: 16px;
    box-sizing: border-box;
    transition: all 120ms ease;
  }

  .input-with-prefix input:focus {
    border-color: var(--accent);
    background-color: var(--bg-raised);
    outline: none;
    box-shadow: none;
  }

  .input-preview {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-muted);
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }
</style>
