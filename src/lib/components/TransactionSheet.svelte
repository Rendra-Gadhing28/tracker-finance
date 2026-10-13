<script>
  import BottomSheet from './BottomSheet.svelte';
  import Button from './Button.svelte';
  import Chip from './Chip.svelte';
  import { formatRp, parseRp } from '../money.js';
  import { toWIBISOString, getWIBParts, createWIBDate } from '../week.js';

  /**
   * @typedef {Object} Props
   * @property {boolean} [open]
   * @property {'create' | 'edit'} [mode]
   * @property {Object|null} [initialTx]
   * @property {Array} [categories]
   * @property {Array} [transactions]
   * @property {Array} [goals]
   * @property {number} [totalBudgetA]
   * @property {number} [totalSpentP]
   * @property {Record<string, number>} [categorySpentMap]
   * @property {number} [lastNominal]
   * @property {(tx: Object) => void} [onsave]
   * @property {(txId: string) => void} [ondelete]
   * @property {() => void} [onclose]
   */
  let {
    open = $bindable(false),
    mode = 'create',
    initialTx = null,
    categories = [],
    transactions = [],
    goals = [],
    totalBudgetA = 116000,
    totalSpentP = 0,
    categorySpentMap = {},
    lastNominal = 0,
    onsave = undefined,
    ondelete = undefined,
    onclose = undefined
  } = $props();

  let tipe = $state('keluar');
  let kategoriId = $state('');
  let goalId = $state('');
  let rawNominal = $state('');
  let dateOption = $state('today'); // 'today' | 'yesterday' | 'custom'
  let customDateVal = $state('');
  let catatan = $state('');
  let showCatatan = $state(false);
  let isSubmitting = $state(false);

  // Available categories for selected type, sorted by urut
  const filteredCategories = $derived(
    (categories || [])
      .filter((c) => c.tipe === tipe)
      .sort((a, b) => (a.urut || 0) - (b.urut || 0))
  );

  const selectedCategory = $derived(
    filteredCategories.find((c) => c.id === kategoriId) || filteredCategories[0] || null
  );

  const numericNominal = $derived(parseRp(rawNominal));

  // Last nominal used for currently selected category (PRD 12.3: Chip pertama ↺ = nominal terakhir untuk kategori itu)
  const lastNominalForCategory = $derived.by(() => {
    if (!kategoriId) return lastNominal || 0;
    const tx = (transactions || []).find((t) => t.kategori_id === kategoriId);
    return tx ? Number(tx.nominal) || 0 : (lastNominal || 0);
  });

  // Today's WIB date YYYY-MM-DD for datepicker max
  const todayISO = $derived.by(() => {
    const p = getWIBParts(new Date());
    const pad = (n) => String(n).padStart(2, '0');
    return `${p.year}-${pad(p.month + 1)}-${pad(p.date)}`;
  });

  function getLastUsedCategoryId(targetType) {
    const matchingCats = (categories || []).filter((c) => c.tipe === targetType);
    if (matchingCats.length === 0) return '';

    // Check newest transaction in transactions matching targetType
    const lastTxOfType = (transactions || []).find((t) => t.tipe === targetType);
    if (lastTxOfType && matchingCats.some((c) => c.id === lastTxOfType.kategori_id)) {
      return lastTxOfType.kategori_id;
    }

    // Fallback to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(`last_cat_${targetType}`);
        if (stored && matchingCats.some((c) => c.id === stored)) {
          return stored;
        }
      } catch (e) {
        // ignore
      }
    }

    // Fallback to first matching category
    return matchingCats[0]?.id || '';
  }

  // Unreached goals for Tabung chips (PRD 18.5)
  const unreachedGoals = $derived.by(() => {
    return (goals || []).filter((g) => {
      if (mode === 'edit' && initialTx?.goal_id === g.id) return true;
      const target = Math.round(Number(g.target)) || 0;
      if (target <= 0) return true;
      const terkumpul = (transactions || [])
        .filter((t) => t.tipe === 'tabung' && t.goal_id === g.id && t.id !== initialTx?.id)
        .reduce((sum, t) => sum + (Math.round(Number(t.nominal)) || 0), 0);
      return terkumpul < target;
    });
  });

  function getDefaultGoalId() {
    if (initialTx?.goal_id) return initialTx.goal_id;
    // Check last used tabung transaction
    const lastTabungTx = (transactions || []).find((t) => t.tipe === 'tabung' && t.goal_id);
    if (lastTabungTx?.goal_id && unreachedGoals.some((g) => g.id === lastTabungTx.goal_id)) {
      return lastTabungTx.goal_id;
    }
    // Check localStorage fallback
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('last_goal_id');
        if (stored && unreachedGoals.some((g) => g.id === stored)) {
          return stored;
        }
      } catch (e) {}
    }
    // Default to first unreached goal
    return unreachedGoals[0]?.id || '';
  }

  // Calculate non-blocking budget warnings
  const budgetWarning = $derived.by(() => {
    if (tipe !== 'keluar' || numericNominal <= 0 || !selectedCategory) return null;

    const catLimit = Number(selectedCategory.limit_mingguan) || 0;
    const catSpent = categorySpentMap[selectedCategory.id] || 0;
    // When editing, deduct initial nominal from check
    const currentTxBaseline =
      mode === 'edit' && initialTx?.id && initialTx?.kategori_id === selectedCategory.id
        ? Number(initialTx.nominal) || 0
        : 0;

    const newCatSpent = catSpent - currentTxBaseline + numericNominal;
    if (catLimit > 0 && newCatSpent > catLimit) {
      const over = newCatSpent - catLimit;
      return `Melebihi budget ${selectedCategory.nama} ${formatRp(over)}`;
    }

    const totalBaseline = mode === 'edit' && initialTx?.id ? Number(initialTx.nominal) || 0 : 0;
    const newTotalSpent = totalSpentP - totalBaseline + numericNominal;
    if (totalBudgetA > 0 && newTotalSpent > totalBudgetA) {
      const over = newTotalSpent - totalBudgetA;
      return `Melebihi jajan minggu ini ${formatRp(over)}`;
    }

    return null;
  });

  // Synchronize state when sheet opens or initialTx changes
  $effect(() => {
    if (open) {
      if (mode === 'edit' && initialTx) {
        tipe = initialTx.tipe || 'keluar';
        kategoriId = initialTx.kategori_id || '';
        goalId = initialTx.goal_id || '';
        rawNominal = (Number(initialTx.nominal) || 0).toLocaleString('id-ID');
        catatan = initialTx.catatan || '';
        showCatatan = !!catatan;

        // Parse date for edit mode
        const txParts = getWIBParts(initialTx.tanggal || new Date());
        const pad = (n) => String(n).padStart(2, '0');
        const txDateStr = `${txParts.year}-${pad(txParts.month + 1)}-${pad(txParts.date)}`;
        if (txDateStr === todayISO) {
          dateOption = 'today';
        } else {
          dateOption = 'custom';
          customDateVal = txDateStr;
        }
      } else {
        // Create mode
        tipe = initialTx?.tipe || 'keluar';
        if (initialTx?.kategori_id) {
          kategoriId = initialTx.kategori_id;
        } else {
          kategoriId = getLastUsedCategoryId(tipe);
        }

        goalId = getDefaultGoalId();

        rawNominal = '';
        catatan = '';
        showCatatan = false;

        if (initialTx?.tanggal) {
          const txParts = getWIBParts(initialTx.tanggal);
          const pad = (n) => String(n).padStart(2, '0');
          const txDateStr = `${txParts.year}-${pad(txParts.month + 1)}-${pad(txParts.date)}`;
          if (txDateStr === todayISO) {
            dateOption = 'today';
            customDateVal = todayISO;
          } else {
            dateOption = 'custom';
            customDateVal = txDateStr;
          }
        } else {
          dateOption = 'today';
          customDateVal = todayISO;
        }
      }
    }
  });

  // Ensure valid category when type changes
  $effect(() => {
    if (filteredCategories.length > 0) {
      const exists = filteredCategories.some((c) => c.id === kategoriId);
      if (!exists) {
        kategoriId = getLastUsedCategoryId(tipe);
      }
    } else {
      kategoriId = '';
    }
  });

  function handleTypeChange(newType) {
    tipe = newType;
    kategoriId = getLastUsedCategoryId(newType);
    if (newType === 'tabung' && !goalId) {
      goalId = getDefaultGoalId();
    }
  }

  function handleNominalInput(event) {
    let clean = event.target.value.replace(/[^\d]/g, '');
    let num = parseInt(clean, 10) || 0;
    if (num > 10000000) {
      num = 10000000;
    }
    rawNominal = num > 0 ? num.toLocaleString('id-ID') : '';
  }

  function applyQuickAmount(amount) {
    if (amount > 0 && amount <= 10000000) {
      rawNominal = amount.toLocaleString('id-ID');
    }
  }

  function calculateTargetDate() {
    const now = new Date();
    if (dateOption === 'today') {
      return toWIBISOString(now);
    }

    if (dateOption === 'yesterday') {
      const todayParts = getWIBParts(now);
      const yesterday = createWIBDate(todayParts.year, todayParts.month, todayParts.date - 1);
      // Yesterday 12:00 WIB per PRD 12.3
      const yesterdayNoon = new Date(yesterday.getTime() + 12 * 60 * 60 * 1000);
      return toWIBISOString(yesterdayNoon);
    }

    if (dateOption === 'custom' && customDateVal) {
      const [y, m, d] = customDateVal.split('-').map(Number);
      const customDay = createWIBDate(y, m - 1, d);
      const customNoon = new Date(customDay.getTime() + 12 * 60 * 60 * 1000);
      return toWIBISOString(customNoon);
    }

    return toWIBISOString(now);
  }

  function handleBeforeClose() {
    // PRD 12.6: Isian dibuang tanpa konfirmasi bila nominal masih kosong; bila sudah terisi, tanya "Buang catatan ini?"
    if (numericNominal > 0) {
      return confirm('Buang catatan ini?');
    }
    return true;
  }

  function handleSubmit() {
    if (numericNominal <= 0 || !selectedCategory || isSubmitting) return;

    // PRD 12.3 / 17: Tanggal masa depan ditolak
    if (dateOption === 'custom' && customDateVal > todayISO) return;

    isSubmitting = true;
    setTimeout(() => {
      isSubmitting = false;
    }, 600); // 600ms double-tap protection per PRD 12.3

    // Determine target date (Fix Critical 2: only preserve initialTx date if it was already today WIB)
    let targetTanggal;
    if (mode === 'edit' && dateOption === 'today' && initialTx?.tanggal) {
      const wasAlreadyToday = toWIBISOString(new Date(initialTx.tanggal)).slice(0, 10) === todayISO;
      targetTanggal = wasAlreadyToday ? initialTx.tanggal : calculateTargetDate();
    } else {
      targetTanggal = calculateTargetDate();
    }

    // Remember last-used category for this type
    if (typeof localStorage !== 'undefined' && selectedCategory?.id) {
      try {
        localStorage.setItem(`last_cat_${tipe}`, selectedCategory.id);
      } catch (e) {
        // ignore
      }
    }

    // Remember last used goal for tabung
    if (typeof localStorage !== 'undefined' && tipe === 'tabung') {
      try {
        if (goalId) {
          localStorage.setItem('last_goal_id', goalId);
        } else {
          localStorage.removeItem('last_goal_id');
        }
      } catch (e) {
        // ignore
      }
    }

    const txData = {
      ...(initialTx?.id ? { id: initialTx.id } : {}),
      tipe,
      kategori_id: selectedCategory.id,
      nominal: numericNominal,
      catatan: catatan.slice(0, 60).trim(),
      tanggal: targetTanggal,
      ...(tipe === 'tabung' ? { goal_id: goalId || '' } : {})
    };

    onsave?.(txData);
    open = false;
  }

  function handleDelete() {
    if (initialTx?.id) {
      ondelete?.(initialTx.id);
      open = false;
    }
  }
</script>

<BottomSheet
  bind:open
  title={mode === 'edit' ? 'Ubah transaksi' : 'Catat transaksi'}
  beforeClose={handleBeforeClose}
  {onclose}
>
  <div class="tx-sheet-content">
    <!-- Type Selector -->
    <div class="type-segmented-group" role="tablist">
      <button
        type="button"
        class="type-tab {tipe === 'keluar' ? 'active' : ''}"
        onclick={() => handleTypeChange('keluar')}
      >
        💸 Keluar
      </button>
      <button
        type="button"
        class="type-tab {tipe === 'masuk' ? 'active' : ''}"
        onclick={() => handleTypeChange('masuk')}
      >
        💰 Masuk
      </button>
      <button
        type="button"
        class="type-tab {tipe === 'tabung' ? 'active' : ''}"
        onclick={() => handleTypeChange('tabung')}
      >
        🐷 Tabung
      </button>
    </div>

    <!-- Category Chips (Horizontally Scrollable) -->
    <div class="category-scroll-container">
      {#if filteredCategories.length === 0}
        <p class="empty-cats-text">Belum ada kategori untuk tipe ini.</p>
      {:else}
        {#each filteredCategories as cat}
          <button
            type="button"
            class="cat-chip {kategoriId === cat.id ? 'selected' : ''}"
            style="--cat-fill: var(--cat-{cat.warna || cat.id}-fill, #FBE0D3); --cat-border: var(--cat-{cat.warna || cat.id}-border, #F2B28C);"
            onclick={() => (kategoriId = cat.id)}
          >
            <span class="cat-chip-icon">{cat.ikon}</span>
            <span class="cat-chip-label">{cat.nama}</span>
          </button>
        {/each}
      {/if}
    </div>

    <!-- Large Nominal Input -->
    <div class="nominal-input-box">
      <span class="currency-prefix">Rp</span>
      <input
        type="text"
        inputmode="numeric"
        class="nominal-field tabular-nums"
        placeholder="0"
        value={rawNominal}
        oninput={handleNominalInput}
        aria-label="Nominal transaksi"
      />
    </div>

    {#if numericNominal >= 10000000}
      <p class="max-limit-hint">Maksimal Rp 10.000.000</p>
    {/if}

    <!-- Quick Amount Chips -->
    <div class="quick-chips-row">
      {#if lastNominalForCategory > 0}
        <button
          type="button"
          class="quick-pill last-used-pill"
          onclick={() => applyQuickAmount(lastNominalForCategory)}
        >
          ↺ {lastNominalForCategory.toLocaleString('id-ID')}
        </button>
      {/if}
      <button type="button" class="quick-pill" onclick={() => applyQuickAmount(2000)}>
        2.000
      </button>
      <button type="button" class="quick-pill" onclick={() => applyQuickAmount(5000)}>
        5.000
      </button>
      <button type="button" class="quick-pill" onclick={() => applyQuickAmount(10000)}>
        10.000
      </button>
      <button type="button" class="quick-pill" onclick={() => applyQuickAmount(15000)}>
        15.000
      </button>
    </div>

    <!-- Goal Target Selection for Tabung (PRD 12.3 & 18.5) -->
    {#if tipe === 'tabung'}
      <div class="goal-selection-box">
        <span class="goal-section-label">Untuk target:</span>
        <div class="goal-chips-scroll" role="radiogroup" aria-label="Untuk target">
          {#each unreachedGoals as g}
            <button
              type="button"
              class="goal-chip {goalId === g.id ? 'selected' : ''}"
              onclick={() => (goalId = g.id)}
              role="radio"
              aria-checked={goalId === g.id}
            >
              <span>{g.ikon || '🎯'}</span>
              <span>{g.nama}</span>
            </button>
          {/each}
          <button
            type="button"
            class="goal-chip {!goalId ? 'selected' : ''}"
            onclick={() => (goalId = '')}
            role="radio"
            aria-checked={!goalId}
          >
            <span>🏷️</span>
            <span>Umum</span>
          </button>
        </div>
      </div>
    {/if}

    <!-- Date selector & Note toggle -->
    <div class="meta-row">
      <div class="date-pills">
        <button
          type="button"
          class="meta-pill {dateOption === 'today' ? 'active' : ''}"
          onclick={() => (dateOption = 'today')}
        >
          Hari ini
        </button>
        <button
          type="button"
          class="meta-pill {dateOption === 'yesterday' ? 'active' : ''}"
          onclick={() => (dateOption = 'yesterday')}
        >
          Kemarin
        </button>
        <button
          type="button"
          class="meta-pill {dateOption === 'custom' ? 'active' : ''}"
          onclick={() => (dateOption = 'custom')}
        >
          Pilih tgl
        </button>
      </div>

      {#if !showCatatan}
        <button
          type="button"
          class="toggle-note-btn"
          onclick={() => (showCatatan = true)}
        >
          ＋ Catatan
        </button>
      {/if}
    </div>

    <!-- Custom date input if selected -->
    {#if dateOption === 'custom'}
      <div class="custom-date-box">
        <label for="custom-date-input" class="custom-date-label">Tanggal:</label>
        <input
          id="custom-date-input"
          type="date"
          class="custom-date-input"
          max={todayISO}
          bind:value={customDateVal}
        />
      </div>
    {/if}

    <!-- Optional Note Input -->
    {#if showCatatan}
      <div class="note-input-box">
        <input
          type="text"
          class="note-field"
          placeholder="Catatan kecil (mis. Es teh, bensin)"
          maxlength="60"
          bind:value={catatan}
        />
        <span class="note-counter">{catatan.length}/60</span>
      </div>
    {/if}

    <!-- Budget Warning Pill (Non-blocking) -->
    {#if budgetWarning}
      <div class="warning-pill" role="status">
        <span class="warning-icon">⚠️</span>
        <span class="warning-text">{budgetWarning}</span>
      </div>
    {/if}

    <!-- Submit / Action Buttons -->
    <div class="actions-row">
      {#if mode === 'edit'}
        <Button
          variant="danger"
          size="md"
          onclick={handleDelete}
        >
          Hapus
        </Button>
        <Button
          variant="primary"
          size="md"
          full
          disabled={numericNominal <= 0 || !selectedCategory || isSubmitting}
          onclick={handleSubmit}
        >
          Simpan
        </Button>
      {:else}
        <Button
          variant="primary"
          size="lg"
          full
          disabled={numericNominal <= 0 || !selectedCategory || isSubmitting}
          onclick={handleSubmit}
        >
          Catat
        </Button>
      {/if}
    </div>
  </div>
</BottomSheet>

<style>
  .tx-sheet-content {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Segmented Type Control */
  .type-segmented-group {
    display: flex;
    background-color: var(--bg);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-btn, 16px);
    padding: 3px;
    gap: 4px;
  }

  .type-tab {
    flex: 1;
    min-height: 40px;
    border: none;
    background: transparent;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    color: var(--mute);
    cursor: pointer;
    transition: all 150ms ease-out;
  }

  .type-tab.active {
    background-color: var(--card);
    color: var(--ink);
    box-shadow: 0 2px 6px rgba(74, 59, 50, 0.08);
  }

  /* Category scroll */
  .category-scroll-container {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .category-scroll-container::-webkit-scrollbar {
    display: none;
  }

  .cat-chip {
    flex-shrink: 0;
    min-height: 40px;
    padding: 6px 14px;
    border-radius: var(--radius-chip, 999px);
    border: 1.5px solid var(--line);
    background-color: var(--card);
    color: var(--ink);
    font-size: 13px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: all 120ms ease-out;
  }

  .cat-chip.selected {
    background-color: var(--cat-fill, #FBE0D3);
    border-color: var(--cat-border, #F2B28C);
    border-bottom: 3px solid var(--cat-border, #F2B28C);
    font-weight: 700;
  }

  .cat-chip:active {
    transform: translateY(1px);
  }

  .cat-chip-icon {
    font-size: 16px;
  }

  .empty-cats-text {
    font-size: 13px;
    color: var(--mute);
    padding: 8px 0;
  }

  /* Large Nominal Input */
  .nominal-input-box {
    display: flex;
    align-items: center;
    background-color: var(--card);
    border: 2px solid var(--line);
    border-bottom: 4px solid #D6C8B2;
    border-radius: var(--radius-card, 22px);
    padding: 10px 18px;
    gap: 8px;
  }

  .currency-prefix {
    font-size: 26px;
    font-weight: 700;
    color: var(--mute);
  }

  .nominal-field {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 32px;
    font-weight: 700;
    color: var(--ink);
    outline: none;
    width: 100%;
    font-variant-numeric: tabular-nums;
  }

  .nominal-field::placeholder {
    color: #CFC2B4;
  }

  .max-limit-hint {
    font-size: 12px;
    color: var(--warn);
    font-weight: 700;
    margin-top: -6px;
    padding-left: 6px;
  }

  /* Quick chips */
  .quick-chips-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .quick-chips-row::-webkit-scrollbar {
    display: none;
  }

  .quick-pill {
    flex-shrink: 0;
    min-height: 36px;
    padding: 4px 12px;
    border-radius: var(--radius-chip, 999px);
    border: 1.5px solid var(--line);
    background-color: var(--bg);
    color: var(--ink);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 100ms ease-out;
  }

  .quick-pill:active {
    background-color: #EADFCB;
  }

  .quick-pill.last-used-pill {
    background-color: var(--cat-jajan-fill, #FBE0D3);
    border-color: var(--cat-jajan-border, #F2B28C);
    color: var(--ink);
  }

  /* Goal selection chips */
  .goal-selection-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .goal-section-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--mute);
  }

  .goal-chips-scroll {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .goal-chips-scroll::-webkit-scrollbar {
    display: none;
  }

  .goal-chip {
    flex-shrink: 0;
    min-height: 36px;
    padding: 4px 12px;
    border-radius: var(--radius-chip, 999px);
    border: 1.5px solid var(--line);
    background-color: var(--bg);
    color: var(--ink);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 120ms ease-out;
  }

  .goal-chip.selected {
    background-color: var(--cat-nabung-fill, #FBE1E7);
    border-color: var(--cat-nabung-border, #F2B8C6);
    border-bottom: 3px solid var(--cat-nabung-border, #F2B8C6);
    font-weight: 700;
  }

  /* Meta row */
  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 2px;
  }

  .date-pills {
    display: flex;
    gap: 4px;
    background-color: var(--bg);
    border: 1.5px solid var(--line);
    border-radius: 999px;
    padding: 2px;
  }

  .meta-pill {
    border: none;
    background: transparent;
    border-radius: 999px;
    padding: 5px 10px;
    font-size: 12px;
    font-weight: 500;
    color: var(--mute);
    cursor: pointer;
  }

  .meta-pill.active {
    background-color: var(--card);
    color: var(--ink);
    font-weight: 700;
  }

  .toggle-note-btn {
    border: none;
    background: transparent;
    color: var(--accent-pressed);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    padding: 6px 8px;
  }

  .custom-date-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: var(--bg);
    border: 1.5px solid var(--line);
    border-radius: 12px;
    padding: 6px 12px;
  }

  .custom-date-label {
    font-size: 12px;
    color: var(--mute);
  }

  .custom-date-input {
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 13px;
    color: var(--ink);
    outline: none;
  }

  /* Note field */
  .note-input-box {
    display: flex;
    align-items: center;
    background-color: var(--card);
    border: 1.5px solid var(--line);
    border-radius: 14px;
    padding: 8px 12px;
    gap: 8px;
  }

  .note-field {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 14px;
    color: var(--ink);
    outline: none;
  }

  .note-counter {
    font-size: 11px;
    color: var(--mute);
  }

  /* Warning pill */
  .warning-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: #FEF3E2;
    border: 1.5px solid #F4D58D;
    border-radius: 12px;
    padding: 8px 12px;
    font-size: 12px;
    color: #7A5223;
  }

  .warning-icon {
    font-size: 14px;
  }

  .actions-row {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }
</style>
