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
    { id: 'jajan', label: 'Jajan', fill: '#FBE0D3', border: '#F2B28C' },
    { id: 'pulsa', label: 'Pulsa', fill: '#DCEEF7', border: '#9CC5D9' },
    { id: 'bensin', label: 'Bensin', fill: '#E4F2DA', border: '#9FC88A' },
    { id: 'jajanin', label: 'Jajanin', fill: '#EBE0F5', border: '#C9B0E0' },
    { id: 'nabung', label: 'Nabung', fill: '#FBE1E7', border: '#F2B8C6' },
    { id: 'masuk', label: 'Masuk', fill: '#FBF0CF', border: '#F4D58D' }
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
          <span class="char-count">{nama.length}/24</span>
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
            class="nominal-field tabular-nums"
            placeholder="0"
            value={rawTarget}
            oninput={handleTargetInput}
          />
        </div>
        {#if numericTarget > 0 && numericTarget < 1000}
          <p class="field-error">Minimal Rp 1.000</p>
        {/if}
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
    color: var(--ink);
  }

  .input-card {
    display: flex;
    align-items: center;
    background-color: var(--card);
    border: 2px solid var(--line);
    border-radius: var(--radius-btn, 16px);
    padding: 10px 14px;
    gap: 8px;
  }

  .text-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 15px;
    color: var(--ink);
    outline: none;
    font-weight: 500;
  }

  .char-count {
    font-size: 12px;
    color: var(--mute);
  }

  .nominal-input-card {
    display: flex;
    align-items: center;
    background-color: var(--card);
    border: 2px solid var(--line);
    border-bottom: 4px solid #D6C8B2;
    border-radius: var(--radius-card, 22px);
    padding: 10px 16px;
    gap: 8px;
  }

  .currency-prefix {
    font-size: 24px;
    font-weight: 700;
    color: var(--mute);
  }

  .nominal-field {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 28px;
    font-weight: 700;
    color: var(--ink);
    outline: none;
    width: 100%;
  }

  .field-error {
    font-size: 12px;
    color: var(--bad);
    font-weight: 700;
    margin-top: 2px;
  }

  /* 24 Icons Grid */
  .icons-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    background-color: var(--bg);
    border: 1.5px solid var(--line);
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

  .icon-btn.selected {
    background-color: var(--card);
    border-color: var(--accent);
    transform: scale(1.1);
    box-shadow: 0 2px 6px rgba(74, 59, 50, 0.1);
  }

  /* Colors Row */
  .colors-row {
    display: flex;
    gap: 10px;
    justify-content: space-between;
    padding: 4px 2px;
  }

  .color-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background-color: var(--c-fill);
    border: 3px solid var(--c-border);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 120ms ease-out;
  }

  .color-btn.selected {
    transform: scale(1.12);
    box-shadow: 0 0 0 2px var(--ink);
  }

  .check-mark {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
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
    padding: 12px 6px;
  }

  .warning-icon {
    font-size: 36px;
  }

  .confirm-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }

  .confirm-desc {
    font-size: 14px;
    color: var(--mute);
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