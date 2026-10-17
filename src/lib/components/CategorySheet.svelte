<script>
  import BottomSheet from './BottomSheet.svelte';
  import Button from './Button.svelte';
  import Chip from './Chip.svelte';
  import { parseRp, formatRp } from '../money.js';
  import { settings } from '../stores/data.js';

  /**
   * @typedef {Object} Category
   * @property {string} id
   * @property {string} nama
   * @property {string} ikon
   * @property {string} warna
   * @property {'keluar' | 'tabung' | 'masuk'} tipe
   * @property {number} limit_mingguan
   * @property {number} [urut]
   */

  /**
   * @typedef {Object} Props
   * @property {boolean} [open]
   * @property {Category|null} [category]
   * @property {Category[]} [existingCategories]
   * @property {Array} [transactions]
   * @property {(cat: Category) => void} [onsave]
   * @property {(catId: string) => void} [ondelete]
   * @property {(catA: Category, catB: Category) => void} [onswaporder]
   */
  let {
    open = $bindable(false),
    category = null,
    existingCategories = [],
    transactions = [],
    onsave = undefined,
    ondelete = undefined,
    onswaporder = undefined
  } = $props();

  const EMOJI_LIST = [
    '🍙', '🍜', '🍰', '🥤', '🍱', '🍕', '☕', '🍔',
    '📱', '⛽', '🚗', '🛵', '🚌', '🎁', '🛒', '📚',
    '🎮', '🎬', '🐷', '💰', '💵', '🏷️', '⭐', '🐾'
  ];

  const COLOR_OPTIONS = [
    { key: 'jajan', label: 'Jajan', fill: 'rgba(217, 119, 6, 0.16)', border: '#D97706' },
    { key: 'pulsa', label: 'Pulsa', fill: 'rgba(59, 154, 184, 0.16)', border: '#3B9AB8' },
    { key: 'bensin', label: 'Bensin', fill: 'rgba(56, 161, 105, 0.16)', border: '#38A169' },
    { key: 'jajanin', label: 'Jajanin', fill: 'rgba(147, 112, 219, 0.16)', border: '#9370DB' },
    { key: 'nabung', label: 'Nabung', fill: 'rgba(43, 138, 158, 0.16)', border: '#2B8A9E' },
    { key: 'masuk', label: 'Masuk', fill: 'rgba(226, 232, 240, 0.16)', border: '#E2E8F0' }
  ];

  let name = $state('');
  let icon = $state('🍙');
  let color = $state('jajan');
  let type = $state('keluar');
  let limitInput = $state('0');

  // Reset or populate fields whenever category changes or sheet opens
  $effect(() => {
    if (open) {
      if (category) {
        name = category.nama || '';
        icon = category.ikon || '🍙';
        color = category.warna || 'jajan';
        type = category.tipe || 'keluar';
        limitInput = String(category.limit_mingguan ?? 0);
      } else {
        name = '';
        icon = '🍙';
        color = 'jajan';
        type = 'keluar';
        limitInput = '0';
      }
    }
  });

  const parsedLimit = $derived(parseRp(limitInput));
  const isLimitValid = $derived(parsedLimit >= 0 && parsedLimit <= 10000000);

  const trimmedName = $derived(name.trim());
  const isNameEmpty = $derived(trimmedName.length === 0);
  const isNameTooLong = $derived(trimmedName.length > 20);

  const isDuplicateName = $derived(
    existingCategories.some(
      (c) =>
        c.id !== category?.id &&
        c.nama.trim().toLowerCase() === trimmedName.toLowerCase()
    )
  );

  const isNameValid = $derived(!isNameEmpty && !isNameTooLong && !isDuplicateName);

  // Check if type is locked: category used in transactions
  const usedCount = $derived(
    category ? transactions.filter((t) => t.kategori_id === category.id).length : 0
  );
  const isTypeLocked = $derived(usedCount > 0);

  // Adjacent categories of same type for order swap
  const sameTypeCategories = $derived(
    existingCategories
      .filter((c) => c.tipe === (category?.tipe || type))
      .sort((a, b) => (a.urut || 0) - (b.urut || 0))
  );

  const currentIndex = $derived(
    category ? sameTypeCategories.findIndex((c) => c.id === category.id) : -1
  );

  const canMoveUp = $derived(currentIndex > 0);
  const canMoveDown = $derived(
    currentIndex >= 0 && currentIndex < sameTypeCategories.length - 1
  );

  // Budget allocation summary indicator
  const weeklyAllowance = $derived(Number($settings?.uang_jajan_mingguan) || 145000);

  const totalAllocatedKeluar = $derived.by(() => {
    let sum = 0;
    for (const c of existingCategories) {
      if (c.tipe === 'keluar') {
        if (category && c.id === category.id) {
          sum += type === 'keluar' ? parsedLimit : 0;
        } else {
          sum += Number(c.limit_mingguan) || 0;
        }
      }
    }
    if (!category && type === 'keluar') {
      sum += parsedLimit;
    }
    return sum;
  });

  const allocDiff = $derived(weeklyAllowance - totalAllocatedKeluar);
  const allocStatus = $derived.by(() => {
    if (allocDiff === 0) return 'equal';
    if (allocDiff > 0) return 'less';
    return 'more';
  });

  const allocPercent = $derived(
    weeklyAllowance > 0 ? Math.min(100, Math.round((totalAllocatedKeluar / weeklyAllowance) * 100)) : 0
  );

  function handleLimitInput(e) {
    const raw = e.target.value;
    const cleanNum = parseRp(raw);
    limitInput = cleanNum > 0 ? cleanNum.toLocaleString('id-ID') : '0';
  }

  function handleMoveUp() {
    if (!canMoveUp || !category) return;
    const target = sameTypeCategories[currentIndex - 1];
    onswaporder?.(category, target);
  }

  function handleMoveDown() {
    if (!canMoveDown || !category) return;
    const target = sameTypeCategories[currentIndex + 1];
    onswaporder?.(category, target);
  }

  function handleSave() {
    if (!isNameValid || !isLimitValid) return;

    let catId = category?.id;
    if (!catId) {
      const cleanSlug = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const rand = Math.random().toString(36).substring(2, 6);
      catId = `${cleanSlug || 'kat'}_${rand}`;
    }

    const maxUrut = sameTypeCategories.reduce((max, c) => Math.max(max, c.urut || 0), 0);
    const catUrut = category?.urut ?? maxUrut + 1;

    const savedCategory = {
      id: catId,
      nama: trimmedName,
      ikon: icon,
      warna: color,
      tipe: type,
      limit_mingguan: parsedLimit,
      urut: catUrut
    };

    onsave?.(savedCategory);
    open = false;
  }

  function handleDelete() {
    if (!category || isTypeLocked) return;
    ondelete?.(category.id);
    open = false;
  }
</script>

<BottomSheet
  bind:open
  title={category ? 'Ubah Kategori' : 'Kategori Baru'}
>
  <form class="cat-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
    <!-- Allocation Summary Indicator Card -->
    {#if type === 'keluar'}
      <div class="alloc-summary-card state-{allocStatus}">
        <div class="alloc-header-row">
          <span class="alloc-title">Alokasi Anggaran Mingguan</span>
          <span class="alloc-badge font-num tabular-nums state-{allocStatus}">
            {#if allocStatus === 'equal'}
              Pas ✓
            {:else if allocStatus === 'less'}
              Sisa {formatRp(allocDiff)}
            {:else}
              Lebih {formatRp(Math.abs(allocDiff))}
            {/if}
          </span>
        </div>

        <div class="alloc-track">
          <div
            class="alloc-fill state-{allocStatus}"
            style="width: {allocPercent}%;"
          ></div>
        </div>

        <div class="alloc-footer-row font-num tabular-nums">
          <span class="alloc-spent-text">
            Teralokasi {formatRp(totalAllocatedKeluar)} dari jatah {formatRp(weeklyAllowance)}
          </span>
          <span class="alloc-pct-text">{allocPercent}%</span>
        </div>
      </div>
    {/if}

    <!-- Nama -->
    <div class="form-group">
      <div class="label-row">
        <label for="cat-name">Nama Kategori</label>
        <span class="char-count {trimmedName.length > 20 ? 'error' : ''} tabular-nums">
          {trimmedName.length}/20
        </span>
      </div>
      <input
        id="cat-name"
        type="text"
        placeholder="mis. Makan Siang"
        maxlength="20"
        bind:value={name}
        required
      />
      {#if isDuplicateName}
        <span class="field-error">Nama sudah dipakai</span>
      {/if}
    </div>

    <!-- Ikon Grid -->
    <div class="form-group">
      <span class="group-label">Pilih Ikon ({icon})</span>
      <div class="icon-grid" role="radiogroup" aria-label="Pilih Ikon">
        {#each EMOJI_LIST as item}
          <button
            type="button"
            class="icon-btn {icon === item ? 'selected' : ''}"
            onclick={() => (icon = item)}
            aria-checked={icon === item}
            role="radio"
          >
            {item}
          </button>
        {/each}
      </div>
    </div>

    <!-- Warna Swatches -->
    <div class="form-group">
      <span class="group-label">Pilih Warna</span>
      <div class="color-row" role="radiogroup" aria-label="Pilih Warna">
        {#each COLOR_OPTIONS as opt}
          <button
            type="button"
            class="color-swatch {color === opt.key ? 'selected' : ''}"
            style="background-color: {opt.fill}; border-color: {opt.border};"
            onclick={() => (color = opt.key)}
            aria-checked={color === opt.key}
            role="radio"
            title={opt.label}
          >
            {#if color === opt.key}
              <span class="check-mark">✓</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <!-- Tipe Selector -->
    <div class="form-group">
      <div class="label-row">
        <span class="group-label">Tipe</span>
        {#if isTypeLocked}
          <span class="locked-hint">Terkunci (dipakai transaksi)</span>
        {/if}
      </div>
      <div class="type-row">
        <Chip
          selected={type === 'keluar'}
          icon="💸"
          label="Keluar"
          disabled={isTypeLocked}
          onclick={() => { if (!isTypeLocked) type = 'keluar'; }}
        />
        <Chip
          selected={type === 'tabung'}
          icon="🐷"
          label="Tabung"
          disabled={isTypeLocked}
          onclick={() => { if (!isTypeLocked) type = 'tabung'; }}
        />
        <Chip
          selected={type === 'masuk'}
          icon="💰"
          label="Masuk"
          disabled={isTypeLocked}
          onclick={() => { if (!isTypeLocked) type = 'masuk'; }}
        />
      </div>
    </div>

    <!-- Limit Mingguan -->
    <div class="form-group">
      <div class="label-row">
        <label for="cat-limit">
          {type === 'masuk' ? 'Target Pemasukan / Minggu' : 'Limit / Minggu'}
        </label>
        <span class="limit-preview font-num tabular-nums">{formatRp(parsedLimit)}</span>
      </div>
      <div class="input-with-prefix">
        <span class="prefix">Rp</span>
        <input
          id="cat-limit"
          type="text"
          inputmode="numeric"
          class="font-num tabular-nums"
          bind:value={limitInput}
          oninput={handleLimitInput}
        />
      </div>
      {#if parsedLimit > 10000000}
        <span class="field-error">Maksimal Rp 10.000.000</span>
      {/if}
    </div>

    <!-- Urutan (Only shown for existing category) -->
    {#if category}
      <div class="form-group">
        <div class="label-row">
          <span class="group-label">Urutan Tampil</span>
          <span class="order-info tabular-nums">Posisi #{currentIndex + 1} dari {sameTypeCategories.length}</span>
        </div>
        <div class="order-controls">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!canMoveUp}
            onclick={handleMoveUp}
          >
            ↑ Geser Naik
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!canMoveDown}
            onclick={handleMoveDown}
          >
            ↓ Geser Turun
          </Button>
        </div>
      </div>
    {/if}

    <!-- Bottom Actions -->
    <div class="sheet-actions-row">
      <Button
        type="submit"
        variant="primary"
        full
        disabled={!isNameValid || !isLimitValid}
      >
        Simpan
      </Button>

      {#if category}
        <Button
          type="button"
          variant="danger"
          full
          disabled={isTypeLocked}
          onclick={handleDelete}
        >
          {isTypeLocked ? `Dipakai di ${usedCount} transaksi` : 'Hapus Kategori'}
        </Button>
      {/if}
    </div>
  </form>
</BottomSheet>

<style>
  .cat-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Allocation Summary Card */
  .alloc-summary-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    border-radius: 18px;
    padding: 12px 14px;
    transition: border-color 200ms ease;
  }

  .alloc-summary-card.state-equal {
    border-color: rgba(56, 161, 105, 0.35);
    box-shadow: 0 0 10px rgba(56, 161, 105, 0.12);
  }

  .alloc-summary-card.state-less {
    border-color: rgba(217, 119, 6, 0.35);
    box-shadow: 0 0 10px rgba(217, 119, 6, 0.12);
  }

  .alloc-summary-card.state-more {
    border-color: rgba(209, 67, 67, 0.35);
    box-shadow: 0 0 10px rgba(209, 67, 67, 0.12);
  }

  .alloc-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .alloc-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--kabut);
  }

  .alloc-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 999px;
  }

  .alloc-badge.state-equal {
    background: rgba(56, 161, 105, 0.12);
    color: var(--tunas);
    border: 1px solid rgba(56, 161, 105, 0.35);
  }

  .alloc-badge.state-less {
    background: rgba(217, 119, 6, 0.12);
    color: var(--bara);
    border: 1px solid rgba(217, 119, 6, 0.35);
  }

  .alloc-badge.state-more {
    background: rgba(209, 67, 67, 0.12);
    color: var(--api);
    border: 1px solid rgba(209, 67, 67, 0.35);
  }

  .alloc-track {
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
  }

  .alloc-fill {
    height: 100%;
    border-radius: 999px;
    transition: background-color 200ms ease;
  }

  .alloc-fill.state-equal {
    background: var(--tunas);
    box-shadow: var(--glow-tunas);
  }

  .alloc-fill.state-less {
    background: var(--bara);
    box-shadow: var(--glow-bara);
  }

  .alloc-fill.state-more {
    background: var(--api);
    box-shadow: var(--glow-api);
  }

  .alloc-footer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
  }

  .alloc-spent-text {
    color: var(--kabut);
    font-weight: 500;
  }

  .alloc-pct-text {
    color: var(--komorebi);
    font-weight: 700;
  }

  /* Form groups */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  label,
  .group-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--komorebi);
  }

  .char-count,
  .order-info {
    font-size: 12px;
    color: var(--kabut);
  }

  .char-count.error,
  .field-error {
    color: var(--api);
    font-size: 12px;
    font-weight: 700;
  }

  .locked-hint {
    font-size: 11px;
    color: var(--kabut);
    font-style: italic;
  }

  input[type="text"] {
    width: 100%;
    min-height: 44px;
    padding: 10px 14px;
    border-radius: 16px;
    border: 1px solid var(--edge-soft);
    background: var(--glass-1);
    color: var(--komorebi);
    font-size: 14px;
    box-sizing: border-box;
    transition: border-color 150ms ease-out, background-color 150ms ease-out;
  }

  input[type="text"]:focus {
    border-color: var(--aether);
    box-shadow: var(--glow-aether);
    outline: none;
    background: var(--glass-2);
  }

  input[type="text"]::placeholder {
    color: var(--lumut);
  }

  .input-with-prefix {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-with-prefix .prefix {
    position: absolute;
    left: 14px;
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--kabut);
    pointer-events: none;
  }

  .input-with-prefix input {
    padding-left: 44px;
  }

  .limit-preview {
    font-size: 13px;
    font-weight: 700;
    color: var(--aether);
  }

  /* 24-Emoji Icon Grid */
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 6px;
    max-height: 128px;
    overflow-y: auto;
    padding: 6px;
    background: var(--glass-1);
    border-radius: 16px;
    border: 1px solid var(--edge-soft);
  }

  .icon-btn {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 10px;
    border: 1.5px solid transparent;
    background: transparent;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 100ms, transform 100ms;
  }

  .icon-btn:hover {
    background: var(--glass-2);
  }

  .icon-btn.selected {
    background: rgba(59, 154, 184, 0.16);
    border-color: var(--aether);
    box-shadow: var(--glow-aether);
    transform: scale(1.1);
  }

  /* Color Swatches */
  .color-row {
    display: flex;
    gap: 10px;
    justify-content: space-between;
    padding: 4px 0;
  }

  .color-swatch {
    flex: 1;
    height: 38px;
    border-radius: 12px;
    border: 2px solid;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 120ms ease-out, box-shadow 120ms ease-out;
  }

  .color-swatch:hover {
    transform: translateY(-2px);
  }

  .color-swatch.selected {
    transform: scale(1.1);
    box-shadow: 0 0 12px currentColor, 0 0 0 2px var(--komorebi);
  }

  .check-mark {
    font-size: 14px;
    font-weight: 800;
    color: #060B12;
  }

  /* Type Row */
  .type-row {
    display: flex;
    gap: 8px;
    justify-content: flex-start;
  }

  /* Order Controls */
  .order-controls {
    display: flex;
    gap: 10px;
  }

  /* Bottom Actions */
  .sheet-actions-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
    padding-top: 8px;
  }
</style>
