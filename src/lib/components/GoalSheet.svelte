<script>
  import BottomSheet from './BottomSheet.svelte';
  import Button from './Button.svelte';
  import { parseRp } from '../money.js';

  /**
   * @typedef {Object} Props
   * @property {boolean} [open]
   * @property {Object|null} [goal]
   * @property {'create' | 'edit'} [mode]
   * @property {number} [existingGoalsCount]
   * @property {Array} [transactions]
   * @property {(goalData: Object) => void} [onsave]
   * @property {(goalId: string) => void} [ondelete]
   * @property {() => void} [onclose]
   */
  let {
    open = $bindable(false),
    goal = null,
    mode: propMode = undefined,
    existingGoalsCount = 0,
    transactions = [],
    onsave = undefined,
    ondelete = undefined,
    onclose = undefined
  } = $props();

  const mode = $derived(propMode ?? (goal ? 'edit' : 'create'));

  const GOAL_ICONS = [
    '🍙', '🍜', '🍰', '🥤', '🍱', '🍕',
    '☕', '🍔', '📱', '⛽', '🚗', '🛵',
    '🚌', '🎁', '🛒', '📚', '🎮', '🎬',
    '🐷', '💰', '💵', '🏷️', '⭐', '🐾'
  ];

  const COLOR_OPTIONS = [
    { id: 'jajan', label: 'Jajan', fill: 'rgba(217, 119, 6, 0.16)', border: '#D97706' },
    { id: 'pulsa', label: 'Pulsa', fill: 'rgba(59, 154, 184, 0.16)', border: '#3B9AB8' },
    { id: 'bensin', label: 'Bensin', fill: 'rgba(56, 161, 105, 0.16)', border: '#38A169' },
    { id: 'jajanin', label: 'Jajanin', fill: 'rgba(147, 112, 219, 0.16)', border: '#9370DB' },
    { id: 'nabung', label: 'Nabung', fill: 'rgba(43, 138, 158, 0.16)', border: '#2B8A9E' },
    { id: 'masuk', label: 'Masuk', fill: 'rgba(226, 232, 240, 0.16)', border: '#E2E8F0' }
  ];

  let nama = $state('');
  let ikon = $state('🍙');
  let warna = $state('nabung');
  let rawTarget = $state('');
  let showDeleteConfirm = $state(false);

  const numericTarget = $derived(parseRp(rawTarget));
  const isValid = $derived(
    nama.trim().length >= 1 &&
    nama.trim().length <= 24 &&
    numericTarget >= 1000 &&
    numericTarget <= 100000000
  );

  const relatedTxCount = $derived(
    goal?.id
      ? (transactions || []).filter((tx) => tx.tipe === 'tabung' && tx.goal_id === goal.id).length
      : 0
  );

  $effect(() => {
    if (open) {
      showDeleteConfirm = false;
      if (mode === 'edit' && goal) {
        nama = goal.nama || '';
        ikon = goal.ikon || '🍙';
        warna = goal.warna || 'nabung';
        rawTarget = (Math.round(Number(goal.target)) || 0).toLocaleString('id-ID');
      } else {
        nama = '';
        ikon = '🍙';
        warna = 'nabung';
        rawTarget = '';
      }
    }
  });

  function handleTargetInput(event) {
    let clean = event.target.value.replace(/[^\d]/g, '');
    let num = parseInt(clean, 10) || 0;
    if (num > 100000000) num = 100000000;
    rawTarget = num > 0 ? num.toLocaleString('id-ID') : '';
  }

  function applyQuickTarget(amount) {
    if (amount >= 1000 && amount <= 100000000) {
      rawTarget = amount.toLocaleString('id-ID');
    }
  }

  function handleSubmit() {
    if (!isValid) return;
    if (mode === 'create' && existingGoalsCount >= 10) return;

    const goalData = {
      id: mode === 'edit' && goal?.id ? goal.id : `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      dibuat: mode === 'edit' && goal?.dibuat ? goal.dibuat : new Date().toISOString(),
      nama: nama.trim().slice(0, 24),
      ikon,
      warna,
      target: numericTarget
    };

    onsave?.(goalData);
    open = false;
  }

  function handleDelete() {
    if (goal?.id) {
      ondelete?.(goal.id);
      open = false;
    }
  }
</script>

<BottomSheet
  bind:open
  title={mode === 'edit' ? 'Ubah target' : 'Target baru'}
  {onclose}
>
  <div class="goal-sheet-content">
    {#if showDeleteConfirm}
      <div class="delete-confirm-box">
        <span class="warning-icon" aria-hidden="true">⚠️</span>
        <h3 class="confirm-title">Hapus target "{goal?.nama}"?</h3>
        <p class="confirm-desc">
          {relatedTxCount} setoran akan menjadi tabungan umum.
        </p>
        <div class="confirm-actions">
          <Button variant="secondary" full onclick={() => (showDeleteConfirm = false)}>
            Batal
          </Button>
          <Button variant="danger" full onclick={handleDelete}>
            Hapus Target
          </Button>
        </div>
      </div>
    {:else}
      <!-- Nama Target -->
      <div class="form-group">
        <label for="goal-name-input" class="form-label">Nama target</label>
        <div class="input-card">
          <input
            id="goal-name-input"
            type="text"
            class="text-input"
            placeholder="mis. Sepatu baru, Konsol"
            maxlength="24"
            bind:value={nama}
          />
          <span class="char-count tabular-nums">{nama.length}/24</span>
        </div>
      </div>

      <!-- Nominal Target -->
      <div class="form-group">
        <label for="goal-target-input" class="form-label">Target nominal</label>
        <div class="nominal-input-card">
          <span class="currency-prefix">Rp</span>
          <input
            id="goal-target-input"
            type="text"
            inputmode="numeric"
            class="nominal-field font-num tabular-nums"
            placeholder="0"
            value={rawTarget}
            oninput={handleTargetInput}
          />
        </div>
        {#if numericTarget > 0 && numericTarget < 1000}
          <p class="field-error">Minimal Rp 1.000</p>
        {/if}

        <!-- Quick target chips -->
        <div class="quick-chips-row">
          <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickTarget(50000)}>
            50.000
          </button>
          <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickTarget(100000)}>
            100.000
          </button>
          <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickTarget(250000)}>
            250.000
          </button>
          <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickTarget(500000)}>
            500.000
          </button>
          <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickTarget(1000000)}>
            1.000.000
          </button>
        </div>
      </div>

      <!-- Icon Picker -->
      <div class="form-group">
        <span class="form-label">Pilih ikon</span>
        <div class="icons-grid">
          {#each GOAL_ICONS as ic}
            <button
              type="button"
              class="icon-btn {ikon === ic ? 'selected' : ''}"
              onclick={() => (ikon = ic)}
              aria-label="Pilih ikon {ic}"
            >
              {ic}
            </button>
          {/each}
        </div>
      </div>

      <!-- Color Picker -->
      <div class="form-group">
        <span class="form-label">Pilih warna</span>
        <div class="colors-row">
          {#each COLOR_OPTIONS as col}
            <button
              type="button"
              class="color-btn {warna === col.id ? 'selected' : ''}"
              style="--c-fill: {col.fill}; --c-border: {col.border};"
              onclick={() => (warna = col.id)}
              aria-label="Pilih warna {col.label}"
            >
              {#if warna === col.id}
                <span class="check-mark">✓</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- Actions -->
      <div class="actions-row">
        {#if mode === 'edit'}
          <Button
            variant="danger"
            size="md"
            onclick={() => (showDeleteConfirm = true)}
          >
            Hapus Target
          </Button>
          <Button
            variant="primary"
            size="md"
            full
            disabled={!isValid}
            onclick={handleSubmit}
          >
            Simpan
          </Button>
        {:else if existingGoalsCount >= 10}
          <Button
            variant="primary"
            size="lg"
            full
            disabled={true}
          >
            Maksimal 10 target
          </Button>
        {:else}
          <Button
            variant="primary"
            size="lg"
            full
            disabled={!isValid}
            onclick={handleSubmit}
          >
            Buat target
          </Button>
        {/if}
      </div>
    {/if}
  </div>
</BottomSheet>

<style>
  .goal-sheet-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--komorebi);
  }

  .input-card {
    display: flex;
    align-items: center;
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    border-radius: 16px;
    padding: 10px 14px;
    gap: 8px;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }

  .input-card:focus-within {
    border-color: var(--aether);
    box-shadow: var(--glow-aether);
  }

  .text-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 14px;
    color: var(--komorebi);
    outline: none;
    font-weight: 500;
  }

  .text-input::placeholder {
    color: var(--lumut);
  }

  .char-count {
    font-size: 11px;
    color: var(--kabut);
  }

  .nominal-input-card {
    display: flex;
    align-items: center;
    background: var(--glass-2);
    border: 1.5px solid var(--edge-soft);
    border-radius: 20px;
    padding: 12px 18px;
    gap: 10px;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }

  .nominal-input-card:focus-within {
    border-color: var(--aether);
    box-shadow: var(--glow-aether);
  }

  .currency-prefix {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    color: var(--kabut);
  }

  .nominal-field {
    flex: 1;
    border: none;
    background: transparent;
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 700;
    color: var(--komorebi);
    outline: none;
    width: 100%;
    letter-spacing: -0.02em;
  }

  .nominal-field::placeholder {
    color: var(--lumut);
  }

  .field-error {
    font-size: 12px;
    color: var(--api);
    font-weight: 700;
    margin-top: 2px;
  }

  /* Quick chips */
  .quick-chips-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    margin-top: 4px;
    overscroll-behavior-x: contain;
    touch-action: pan-x pan-y;
  }

  .quick-chips-row::-webkit-scrollbar {
    display: none;
  }

  .quick-pill {
    flex-shrink: 0;
    min-height: 32px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--edge-soft);
    background: var(--glass-1);
    color: var(--kabut);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .quick-pill:hover {
    color: var(--komorebi);
    border-color: var(--edge-bright);
    background: var(--glass-2);
  }

  .quick-pill:active {
    transform: scale(0.96);
  }

  /* 24 Icons Grid */
  .icons-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    border-radius: 16px;
    padding: 10px;
  }

  .icon-btn {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    border-radius: 12px;
    border: 1.5px solid transparent;
    background: transparent;
    cursor: pointer;
    transition: all 120ms ease-out;
  }

  .icon-btn:hover {
    background: var(--glass-2);
  }

  .icon-btn.selected {
    background: rgba(94, 214, 230, 0.2);
    border-color: var(--aether);
    box-shadow: var(--glow-aether);
    transform: scale(1.1);
  }

  /* Colors Row */
  .colors-row {
    display: flex;
    gap: 10px;
    justify-content: space-between;
    padding: 4px 2px;
  }

  .color-btn {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background-color: var(--c-fill);
    border: 2px solid var(--c-border);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 120ms ease-out, box-shadow 120ms ease-out;
  }

  .color-btn.selected {
    transform: scale(1.12);
    box-shadow: 0 0 12px var(--c-border), 0 0 0 2px var(--komorebi);
  }

  .check-mark {
    font-size: 15px;
    font-weight: 800;
    color: #060B12;
  }

  .actions-row {
    display: flex;
    gap: 10px;
    margin-top: 6px;
  }

  /* Delete Confirmation */
  .delete-confirm-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
    padding: 16px 8px;
    background: rgba(255, 107, 74, 0.08);
    border: 1px solid rgba(255, 107, 74, 0.3);
    border-radius: 20px;
  }

  .warning-icon {
    font-size: 36px;
  }

  .confirm-title {
    font-family: var(--font-ui);
    font-size: 17px;
    font-weight: 700;
    color: var(--komorebi);
    margin: 0;
  }

  .confirm-desc {
    font-size: 13px;
    color: var(--kabut);
    line-height: 1.4;
    margin: 0;
  }

  .confirm-actions {
    display: flex;
    gap: 10px;
    width: 100%;
    margin-top: 8px;
  }
</style>
