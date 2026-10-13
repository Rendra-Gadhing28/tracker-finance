<script>
  import BottomSheet from './BottomSheet.svelte';
  import Button from './Button.svelte';
  import Chip from './Chip.svelte';
  import { parseRp, formatRp } from '../money.js';

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
    { key: 'jajan', label: 'Jajan', fill: '#FBE0D3', border: '#F2B28C' },
    { key: 'pulsa', label: 'Pulsa', fill: '#DCEEF7', border: '#9CC5D9' },
    { key: 'bensin', label: 'Bensin', fill: '#E4F2DA', border: '#9FC88A' },
    { key: 'jajanin', label: 'Jajanin', fill: '#EBE0F5', border: '#C9B0E0' },
    { key: 'nabung', label: 'Nabung', fill: '#FBE1E7', border: '#F2B8C6' },
    { key: 'masuk', label: 'Masuk', fill: '#FBF0CF', border: '#F4D58D' }
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
    <!-- Nama -->
    <div class="form-group">
      <div class="label-row">
        <label for="cat-name">Nama Kategori</label>
        <span class="char-count {trimmedName.length > 20 ? 'error' : ''}">
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
      <span class="group-label">Ikon ({icon})</span>
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
      <span class="group-label">Warna</span>
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
        <span class="limit-preview tabular-nums">{formatRp(parsedLimit)}</span>
      </div>
      <div class="input-with-prefix">
        <span class="prefix">Rp</span>
        <input
          id="cat-limit"
          type="text"
          inputmode="numeric"
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
          <span class="order-info">Posisi #{currentIndex + 1} dari {sameTypeCategories.length}</span>
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
    color: var(--ink);
  }

  .char-count,
  .order-info {
    font-size: 12px;
    color: var(--mute);
  }

  .char-count.error,
  .field-error {
    color: var(--bad);
    font-size: 12px;
    font-weight: 700;
  }

  .locked-hint {
    font-size: 11px;
    color: var(--mute);
    font-style: italic;
  }

  input[type="text"] {
    width: 100%;
    min-height: 44px;
    padding: 10px 14px;
    border-radius: var(--radius-btn, 16px);
    border: 1.5px solid var(--line);
    background-color: var(--bg);
    color: var(--ink);
    font-size: 15px;
    box-sizing: border-box;
    transition: border-color 150ms ease-out, background-color 150ms ease-out;
  }

  input[type="text"]:focus {
    border-color: var(--accent);
    background-color: #FFFDF7;
    outline: none;
  }

  .input-with-prefix {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-with-prefix .prefix {
    position: absolute;
    left: 14px;
    font-size: 15px;
    font-weight: 700;
    color: var(--mute);
    pointer-events: none;
  }

  .input-with-prefix input {
    padding-left: 42px;
  }

  .limit-preview {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
  }

  /* 24-Emoji Icon Grid */
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 6px;
    max-height: 128px;
    overflow-y: auto;
    padding: 4px;
    background-color: var(--bg);
    border-radius: 16px;
    border: 1.5px solid var(--line);
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
    background-color: rgba(74, 59, 50, 0.06);
  }

  .icon-btn.selected {
    background-color: #FFFDF7;
    border-color: var(--accent);
    box-shadow: 0 2px 6px rgba(229, 154, 106, 0.3);
    transform: scale(1.08);
  }

  /* Color Swatches */
  .color-row {
    display: flex;
    gap: 10px;
    justify-content: space-between;
    padding: 6px 0;
  }

  .color-swatch {
    flex: 1;
    height: 38px;
    border-radius: 12px;
    border: 2.5px solid;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 120ms ease-out;
  }

  .color-swatch:hover {
    transform: translateY(-2px);
  }

  .color-swatch.selected {
    transform: scale(1.08);
    box-shadow: 0 0 0 2px var(--ink);
  }

  .check-mark {
    font-size: 14px;
    font-weight: 800;
    color: var(--ink);
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
