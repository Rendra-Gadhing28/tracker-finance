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
  let scrollContainerRef = $state(null);

  // All available categories sorted by urut
  const allCategories = $derived(
    (categories || [])
      .slice()
      .sort((a, b) => (a.urut || 0) - (b.urut || 0))
  );

  const selectedCategory = $derived(
    allCategories.find((c) => c.id === kategoriId) || allCategories[0] || null
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
    const normTarget = (targetType || '').trim().toLowerCase();
    const matchingCats = (categories || []).filter(
      (c) => (c.tipe || '').trim().toLowerCase() === normTarget
    );
    if (matchingCats.length === 0) return '';

    // Check newest transaction in transactions matching targetType
    const lastTxOfType = (transactions || []).find(
      (t) => (t.tipe || '').trim().toLowerCase() === normTarget
    );
    if (lastTxOfType && matchingCats.some((c) => c.id === lastTxOfType.kategori_id)) {
      return lastTxOfType.kategori_id;
    }

    // Fallback to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(`last_cat_${normTarget}`);
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

  function scrollToSelectedChip() {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        const el = scrollContainerRef?.querySelector('.cat-chip.selected');
        el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
    }
  }

  function handleWheel(event) {
    if (event.deltaY !== 0) {
      event.currentTarget.scrollLeft += event.deltaY;
    }
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
        scrollToSelectedChip();
      } else {
        // Create mode
        if (initialTx?.kategori_id) {
          kategoriId = initialTx.kategori_id;
          const matchingCat = (categories || []).find((c) => c.id === kategoriId);
          tipe = matchingCat?.tipe || initialTx?.tipe || 'keluar';
        } else {
          tipe = initialTx?.tipe || 'keluar';
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
        scrollToSelectedChip();
      }
    }
  });

  // Ensure valid category is selected when category list changes
  $effect(() => {
    if (allCategories.length > 0) {
      const exists = allCategories.some((c) => c.id === kategoriId);
      if (!exists) {
        kategoriId = getLastUsedCategoryId(tipe) || allCategories[0].id;
      }
    } else {
      kategoriId = '';
    }
  });

  function handleSelectCategory(cat, event) {
    kategoriId = cat.id;
    const catTipe = (cat.tipe || '').trim().toLowerCase();
    if (catTipe && catTipe !== tipe) {
      tipe = catTipe;
      if (catTipe === 'tabung' && !goalId) {
        goalId = getDefaultGoalId();
      }
    }
    event?.currentTarget?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function handleTypeChange(newType) {
    tipe = newType;
    kategoriId = getLastUsedCategoryId(newType);
    if (newType === 'tabung' && !goalId) {
      goalId = getDefaultGoalId();
    }
    scrollToSelectedChip();
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
    <div class="type-segmented-group" role="tablist" aria-label="Tipe Transaksi">
      <button
        type="button"
        class="type-tab {tipe === 'keluar' ? 'active-keluar' : ''}"
        onclick={() => handleTypeChange('keluar')}
        role="tab"
        aria-selected={tipe === 'keluar'}
      >
        <span>💸</span>
        <span>Keluar</span>
      </button>
      <button
        type="button"
        class="type-tab {tipe === 'masuk' ? 'active-masuk' : ''}"
        onclick={() => handleTypeChange('masuk')}
        role="tab"
        aria-selected={tipe === 'masuk'}
      >
        <span>💰</span>
        <span>Masuk</span>
      </button>
      <button
        type="button"
        class="type-tab {tipe === 'tabung' ? 'active-tabung' : ''}"
        onclick={() => handleTypeChange('tabung')}
        role="tab"
        aria-selected={tipe === 'tabung'}
      >
        <span>🐷</span>
        <span>Tabung</span>
      </button>
    </div>

    <!-- Category Chips (Horizontally Scrollable) -->
    <div
      class="category-scroll-container"
      bind:this={scrollContainerRef}
      onwheel={handleWheel}
      role="radiogroup"
      aria-label="Pilih kategori"
    >
      {#if allCategories.length === 0}
        <p class="empty-cats-text">Belum ada kategori.</p>
      {:else}
        {#each allCategories as cat}
          {@const catLimit = Number(cat.limit_mingguan) || 0}
          {@const catSpent = categorySpentMap[cat.id] || 0}
          {@const isNearLimit = catLimit > 0 && catSpent >= catLimit * 0.85 && catSpent <= catLimit}
          {@const isOverLimit = catLimit > 0 && catSpent > catLimit}
          <button
            type="button"
            class="cat-chip {kategoriId === cat.id ? 'selected' : ''} type-{cat.tipe || 'keluar'}"
            onclick={(e) => handleSelectCategory(cat, e)}
            role="radio"
            aria-checked={kategoriId === cat.id}
          >
            <span class="cat-chip-icon">{cat.ikon}</span>
            <span class="cat-chip-label">{cat.nama}</span>
            {#if isOverLimit}
              <span class="limit-dot over" title="Melebihi budget"></span>
            {:else if isNearLimit}
              <span class="limit-dot near" title="Mendekati limit"></span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>

    <!-- Large Nominal Input -->
    <div class="nominal-input-box state-{tipe}">
      <span class="currency-prefix">Rp</span>
      <input
        type="text"
        inputmode="numeric"
        class="nominal-field font-num tabular-nums"
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
          class="quick-pill last-used-pill font-num tabular-nums"
          onclick={() => applyQuickAmount(lastNominalForCategory)}
        >
          ↺ {lastNominalForCategory.toLocaleString('id-ID')}
        </button>
      {/if}
      <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickAmount(2000)}>
        2.000
      </button>
      <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickAmount(5000)}>
        5.000
      </button>
      <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickAmount(10000)}>
        10.000
      </button>
      <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickAmount(15000)}>
        15.000
      </button>
      <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickAmount(20000)}>
        20.000
      </button>
      <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickAmount(50000)}>
        50.000
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
          aria-label="Catatan kecil"
          placeholder="Catatan kecil (mis. Es teh, bensin)"
          maxlength="60"
          bind:value={catatan}
        />
        <span class="note-counter tabular-nums">{catatan.length}/60</span>
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
          class="btn-submit-{tipe}"
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
          class="btn-submit-{tipe}"
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
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    border-radius: 16px;
    padding: 4px;
    gap: 4px;
  }

  .type-tab {
    flex: 1;
    min-height: 40px;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    color: var(--kabut);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 150ms ease-out;
  }

  .type-tab:hover {
    color: var(--komorebi);
  }

  .type-tab.active-keluar {
    background: rgba(255, 92, 92, 0.18);
    border-color: var(--api);
    color: var(--api);
    box-shadow: var(--glow-api);
  }

  .type-tab.active-masuk {
    background: rgba(74, 222, 128, 0.18);
    border-color: var(--tunas);
    color: var(--tunas);
    box-shadow: var(--glow-tunas);
  }

  .type-tab.active-tabung {
    background: rgba(251, 191, 36, 0.18);
    border-color: var(--bara);
    color: var(--bara);
    box-shadow: var(--glow-bara);
  }

  /* Category scroll */
  .category-scroll-container {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    touch-action: pan-x pan-y;
  }

  .category-scroll-container::-webkit-scrollbar {
    display: none;
  }

  .cat-chip {
    flex-shrink: 0;
    min-height: 38px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--edge-soft);
    background: var(--glass-1);
    color: var(--kabut);
    font-size: 13px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: all 120ms ease-out;
  }

  .cat-chip:hover {
    color: var(--komorebi);
    border-color: var(--edge-bright);
    background: var(--glass-2);
  }

  .cat-chip.selected {
    color: var(--komorebi);
    font-weight: 700;
  }

  .cat-chip.selected.type-keluar {
    background: rgba(255, 92, 92, 0.2);
    border-color: var(--api);
    box-shadow: var(--glow-api);
  }

  .cat-chip.selected.type-masuk {
    background: rgba(74, 222, 128, 0.2);
    border-color: var(--tunas);
    box-shadow: var(--glow-tunas);
  }

  .cat-chip.selected.type-tabung {
    background: rgba(251, 191, 36, 0.2);
    border-color: var(--bara);
    box-shadow: var(--glow-bara);
  }

  .cat-chip:active {
    transform: scale(0.97);
  }

  .cat-chip-icon {
    font-size: 15px;
    line-height: 1;
  }

  .limit-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .limit-dot.near {
    background: var(--bara);
    box-shadow: var(--glow-bara);
  }

  .limit-dot.over {
    background: var(--api);
    box-shadow: var(--glow-api);
  }

  .empty-cats-text {
    font-size: 13px;
    color: var(--kabut);
    padding: 8px 0;
  }

  /* Large Nominal Input */
  .nominal-input-box {
    display: flex;
    align-items: center;
    background: var(--glass-2);
    border: 1.5px solid var(--edge-soft);
    border-radius: 20px;
    padding: 12px 18px;
    gap: 10px;
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }

  .nominal-input-box.state-keluar:focus-within {
    border-color: var(--api);
    box-shadow: var(--glow-api);
  }

  .nominal-input-box.state-masuk:focus-within {
    border-color: var(--tunas);
    box-shadow: var(--glow-tunas);
  }

  .nominal-input-box.state-tabung:focus-within {
    border-color: var(--bara);
    box-shadow: var(--glow-bara);
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
    font-size: 30px;
    font-weight: 700;
    color: var(--komorebi);
    outline: none;
    width: 100%;
    letter-spacing: -0.02em;
  }

  .nominal-field::placeholder {
    color: var(--lumut);
  }

  .max-limit-hint {
    font-size: 12px;
    color: var(--api);
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
    overscroll-behavior-x: contain;
    touch-action: pan-x pan-y;
  }

  .quick-chips-row::-webkit-scrollbar {
    display: none;
  }

  .quick-pill {
    flex-shrink: 0;
    min-height: 34px;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid var(--edge-soft);
    background: var(--glass-1);
    color: var(--kabut);
    font-size: 12px;
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

  .quick-pill.last-used-pill {
    background: rgba(255, 184, 77, 0.14);
    border-color: rgba(255, 184, 77, 0.35);
    color: var(--bara);
  }

  /* Goal selection chips */
  .goal-selection-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: rgba(94, 214, 230, 0.05);
    border: 1px solid rgba(94, 214, 230, 0.2);
    border-radius: 16px;
    padding: 10px 12px;
  }

  .goal-section-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--aether);
  }

  .goal-chips-scroll {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    touch-action: pan-x pan-y;
  }

  .goal-chips-scroll::-webkit-scrollbar {
    display: none;
  }

  .goal-chip {
    flex-shrink: 0;
    min-height: 34px;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid var(--edge-soft);
    background: var(--glass-1);
    color: var(--kabut);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 120ms ease-out;
  }

  .goal-chip.selected {
    background: rgba(94, 214, 230, 0.2);
    border-color: var(--aether);
    color: var(--komorebi);
    font-weight: 700;
    box-shadow: var(--glow-aether);
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
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    border-radius: 999px;
    padding: 3px;
  }

  .meta-pill {
    border: none;
    background: transparent;
    border-radius: 999px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--kabut);
    cursor: pointer;
    transition: all 120ms ease;
  }

  .meta-pill:hover {
    color: var(--komorebi);
  }

  .meta-pill.active {
    background: var(--glass-3);
    color: var(--komorebi);
    font-weight: 700;
  }

  .toggle-note-btn {
    border: none;
    background: transparent;
    color: var(--aether);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 999px;
    transition: background 150ms ease;
  }

  .toggle-note-btn:hover {
    background: var(--glass-1);
  }

  .custom-date-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    border-radius: 14px;
    padding: 8px 14px;
  }

  .custom-date-label {
    font-size: 12px;
    color: var(--kabut);
    font-weight: 600;
  }

  .custom-date-input {
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 13px;
    color: var(--komorebi);
    outline: none;
    color-scheme: dark;
  }

  /* Note field */
  .note-input-box {
    display: flex;
    align-items: center;
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    border-radius: 14px;
    padding: 10px 14px;
    gap: 8px;
  }

  .note-field {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 13px;
    color: var(--komorebi);
    outline: none;
  }

  .note-field::placeholder {
    color: var(--lumut);
  }

  .note-counter {
    font-size: 11px;
    color: var(--kabut);
  }

  /* Warning pill */
  .warning-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 107, 74, 0.12);
    border: 1px solid rgba(255, 107, 74, 0.35);
    border-radius: 14px;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--api);
    font-weight: 600;
  }

  .warning-icon {
    font-size: 14px;
  }

  .actions-row {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }

  /* Custom submit gradients matching type */
  :global(.btn-submit-keluar) {
    background: linear-gradient(135deg, var(--api) 0%, #991B1B 100%) !important;
    color: #FFF !important;
    box-shadow: var(--glow-api) !important;
  }

  :global(.btn-submit-masuk) {
    background: linear-gradient(135deg, var(--tunas) 0%, #15803D 100%) !important;
    color: #FFF !important;
    box-shadow: var(--glow-tunas) !important;
  }

  :global(.btn-submit-tabung) {
    background: linear-gradient(135deg, var(--bara) 0%, #B45309 100%) !important;
    color: var(--on-bara) !important;
    box-shadow: var(--glow-bara) !important;
  }
</style>
