<script>
  import { untrack } from 'svelte';
  import BottomSheet from './BottomSheet.svelte';
  import Button from './Button.svelte';
  import Chip from './Chip.svelte';
  import Icon from './Icon.svelte';
  import { parseReceiptText } from '../ai/receipt.js';
  import { extractTextFromImage } from '../ai/ocr.js';
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

  // AI Scan Receipt state
  let isScanOpen = $state(false);
  let scanRawText = $state('');
  let scanFeedback = $state('');
  let scanCandidates = $state([]);
  let selectedImagePreview = $state(null);
  let isOcrLoading = $state(false);
  let showTextarea = $state(false);
  let cameraInputRef = $state(null);
  let fileInputRef = $state(null);

  function clearImagePreview() {
    if (selectedImagePreview && typeof selectedImagePreview === 'string' && selectedImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(selectedImagePreview);
    }
    selectedImagePreview = null;
    if (cameraInputRef) cameraInputRef.value = '';
    if (fileInputRef) fileInputRef.value = '';
  }

  async function handleFileSelected(e) {
    const file = e.target?.files?.[0];
    if (!file) return;

    if (selectedImagePreview && typeof selectedImagePreview === 'string' && selectedImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(selectedImagePreview);
    }
    selectedImagePreview = URL.createObjectURL(file);
    isOcrLoading = true;
    scanFeedback = '';

    try {
      const ocrText = await extractTextFromImage(file);
      if (ocrText && ocrText.trim()) {
        scanRawText = ocrText.trim();
        handleExtractReceipt('✓ Struk berhasil dipindai dari gambar!');
      } else {
        scanFeedback = 'Teks struk tidak terdeteksi. Silakan ketik nominal/keterangan.';
        showTextarea = true;
      }
    } catch (err) {
      scanFeedback = err?.message || 'Tidak dapat memuat OCR otomatis. Silakan gunakan input teks.';
      showTextarea = true;
    } finally {
      isOcrLoading = false;
    }
  }

  function handleExtractReceipt(customSuccessMsg) {
    if (!scanRawText.trim()) return;
    const res = parseReceiptText(scanRawText, categories);
    if (res && res.success) {
      scanCandidates = res.candidates || (res.nominal > 0 ? [res.nominal] : []);
      if (res.nominal) {
        rawNominal = Number(res.nominal).toLocaleString('id-ID');
      }
      if (res.tipe) {
        tipe = res.tipe;
      }
      if (res.kategori_id) {
        kategoriId = res.kategori_id;
      }
      if (res.catatan) {
        catatan = res.catatan;
        showCatatan = true;
      }
      if (res.tanggal) {
        if (res.tanggal === todayISO) {
          dateOption = 'today';
        } else {
          dateOption = 'custom';
          customDateVal = res.tanggal;
        }
      }
      scanFeedback = customSuccessMsg || '✓ Ekstrak struk berhasil!';
      setTimeout(() => {
        scanFeedback = '';
        isScanOpen = false;
        scanRawText = '';
        clearImagePreview();
        scrollToSelectedChip();
      }, 700);
    } else {
      scanCandidates = res?.candidates || [];
      scanFeedback = 'Format teks struk tidak dikenali';
      showTextarea = true;
      setTimeout(() => {
        scanFeedback = '';
      }, 2500);
    }
  }

  function handleCloseScan() {
    isScanOpen = false;
    scanRawText = '';
    scanFeedback = '';
    showTextarea = false;
    clearImagePreview();
  }

  const DEFAULT_MASUK_CAT = {
    id: 'masuk',
    nama: 'Uang jajan',
    ikon: '💰',
    warna: 'masuk',
    limit_mingguan: 145000,
    tipe: 'masuk',
    urut: 6
  };

  const DEFAULT_TABUNG_CAT = {
    id: 'nabung',
    nama: 'Nabung',
    ikon: '🐷',
    warna: 'nabung',
    limit_mingguan: 29000,
    tipe: 'tabung',
    urut: 5
  };

  const DEFAULT_KELUAR_CAT = {
    id: 'jajan',
    nama: 'Jajan & makan',
    ikon: '🍙',
    warna: 'jajan',
    limit_mingguan: 72500,
    tipe: 'keluar',
    urut: 1
  };

  // Categories for active type, sorted by urut (PRD 12.3: hanya kategori bertipe sama)
  const currentCategories = $derived.by(() => {
    const normType = (tipe || 'keluar').trim().toLowerCase();
    const matching = (categories || []).filter(
      (c) => (c.tipe || 'keluar').trim().toLowerCase() === normType
    );
    if (matching.length === 0) {
      if (normType === 'masuk') return [DEFAULT_MASUK_CAT];
      if (normType === 'tabung') return [DEFAULT_TABUNG_CAT];
      if (normType === 'keluar') return [DEFAULT_KELUAR_CAT];
    }
    return matching.slice().sort((a, b) => (a.urut || 0) - (b.urut || 0));
  });

  const selectedCategory = $derived(
    currentCategories.find((c) => c.id === kategoriId) || currentCategories[0] || null
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
    let matchingCats = (categories || []).filter(
      (c) => (c.tipe || '').trim().toLowerCase() === normTarget
    );
    if (matchingCats.length === 0) {
      if (normTarget === 'masuk') matchingCats = [DEFAULT_MASUK_CAT];
      else if (normTarget === 'tabung') matchingCats = [DEFAULT_TABUNG_CAT];
      else if (normTarget === 'keluar') matchingCats = [DEFAULT_KELUAR_CAT];
    }
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
    if (initialTx && 'goal_id' in initialTx) return initialTx.goal_id || '';
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

  let wasOpen = false;
  let lastInitialTx = null;

  // Synchronize state only when sheet opens or initialTx changes
  $effect(() => {
    const isOpening = open && !wasOpen;
    const initialTxChanged = open && initialTx !== lastInitialTx;
    wasOpen = open;
    lastInitialTx = initialTx;

    if (isOpening || initialTxChanged) {
      untrack(() => {
        isScanOpen = false;
        scanRawText = '';
        scanFeedback = '';
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
      });
    }
  });

  // Ensure valid category is selected for current type
  $effect(() => {
    if (currentCategories.length > 0) {
      const exists = currentCategories.some((c) => c.id === kategoriId);
      if (!exists) {
        kategoriId = untrack(() => getLastUsedCategoryId(tipe)) || currentCategories[0].id;
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
    <!-- Type Selector & AI Scan Trigger -->
    <div class="type-selector-header">
      <div class="type-segmented-group" role="tablist" aria-label="Tipe Transaksi">
        <button
          type="button"
          class="type-tab {tipe === 'keluar' ? 'active-keluar' : ''}"
          onclick={() => handleTypeChange('keluar')}
          role="tab"
          aria-selected={tipe === 'keluar'}
        >
          <Icon name="flying_money" size={16} />
          <span>Keluar</span>
        </button>
        <button
          type="button"
          class="type-tab {tipe === 'masuk' ? 'active-masuk' : ''}"
          onclick={() => handleTypeChange('masuk')}
          role="tab"
          aria-selected={tipe === 'masuk'}
        >
          <Icon name="wallet" size={16} />
          <span>Masuk</span>
        </button>
        <button
          type="button"
          class="type-tab {tipe === 'tabung' ? 'active-tabung' : ''}"
          onclick={() => handleTypeChange('tabung')}
          role="tab"
          aria-selected={tipe === 'tabung'}
        >
          <Icon name="piggy" size={16} />
          <span>Tabung</span>
        </button>
      </div>

      <button
        type="button"
        class="scan-receipt-toggle-btn {isScanOpen ? 'active' : ''}"
        onclick={() => (isScanOpen = !isScanOpen)}
        aria-label="Scan Struk dengan AI"
      >
        <Icon name="sparkles" size={14} />
        <span>Scan Struk (AI)</span>
      </button>
    </div>

    <!-- AI Scan Receipt Expandable Box -->
    {#if isScanOpen}
      <div class="scan-receipt-box">
        <!-- Hidden file inputs for Camera and File Picker -->
        <input
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden-file-input"
          bind:this={cameraInputRef}
          onchange={handleFileSelected}
        />
        <input
          type="file"
          accept="image/*"
          class="hidden-file-input"
          bind:this={fileInputRef}
          onchange={handleFileSelected}
        />

        <!-- Scan Method Selector -->
        <div class="scan-methods-row">
          <button
            type="button"
            class="scan-method-btn"
            onclick={() => cameraInputRef?.click()}
          >
            <Icon name="camera" size={16} />
            <span>Kamera</span>
          </button>
          <button
            type="button"
            class="scan-method-btn"
            onclick={() => fileInputRef?.click()}
          >
            <Icon name="image" size={16} />
            <span>Galeri / File</span>
          </button>
          <button
            type="button"
            class="scan-method-btn {showTextarea ? 'active' : ''}"
            onclick={() => (showTextarea = !showTextarea)}
          >
            <Icon name="note" size={16} />
            <span>Teks</span>
          </button>
        </div>

        {#if selectedImagePreview}
          <div class="receipt-image-preview">
            <img src={selectedImagePreview} alt="Preview Struk" />
            <button
              type="button"
              class="remove-preview-btn"
              onclick={clearImagePreview}
              aria-label="Hapus gambar"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        {/if}

        {#if isOcrLoading}
          <div class="scan-loading-pill">
            <span class="ocr-spinner"></span> Memindai teks struk...
          </div>
        {/if}

        {#if showTextarea || scanRawText.trim()}
          <textarea
            class="scan-receipt-input"
            placeholder="Tempel teks struk belanja, SMS m-banking, invoice, QRIS, dll..."
            rows="3"
            bind:value={scanRawText}
          ></textarea>
        {/if}

        {#if scanFeedback}
          <div class="scan-feedback-pill {scanFeedback.startsWith('✓') ? 'success' : 'error'}">
            {scanFeedback}
          </div>
        {/if}

        {#if scanCandidates.length > 1}
          <div class="candidate-chips-wrap">
            <span class="candidate-label">Pilihan nominal terdeteksi:</span>
            <div class="candidate-chips">
              {#each scanCandidates as c}
                <button
                  type="button"
                  class="candidate-chip {numericNominal === c ? 'active' : ''}"
                  onclick={() => (rawNominal = String(c))}
                >
                  {formatRp(c)}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <div class="scan-receipt-btn-row">
          <Button
            variant="secondary"
            size="sm"
            onclick={handleCloseScan}
          >
            Batal
          </Button>
          <Button
            variant="primary"
            size="sm"
            onclick={() => handleExtractReceipt()}
            disabled={!scanRawText.trim() || isOcrLoading}
          >
            <Icon name="sparkles" size={14} />
            <span>Ekstrak Otomatis</span>
          </Button>
        </div>
      </div>
    {/if}

    <!-- Category Chips (Horizontally Scrollable) -->
    <div
      class="category-scroll-container"
      bind:this={scrollContainerRef}
      onwheel={handleWheel}
      role="radiogroup"
      aria-label="Pilih kategori"
    >
      {#if currentCategories.length === 0}
        <p class="empty-cats-text">Belum ada kategori.</p>
      {:else}
        {#each currentCategories as cat}
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
            <span class="cat-chip-icon"><Icon name={cat.ikon} size={16} /></span>
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

    <!-- Candidate Nominal Chips from AI Scan -->
    {#if scanCandidates.length > 1}
      <div class="candidate-chips-wrap">
        <span class="candidate-label">Pilihan nominal terdeteksi:</span>
        <div class="candidate-chips">
          {#each scanCandidates as c}
            <button
              type="button"
              class="candidate-chip {numericNominal === c ? 'active' : ''}"
              onclick={() => (rawNominal = String(c))}
            >
              {formatRp(c)}
            </button>
          {/each}
        </div>
      </div>
    {/if}

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
      {#if tipe === 'masuk'}
        <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickAmount(50000)}>
          50.000
        </button>
        <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickAmount(100000)}>
          100.000
        </button>
        <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickAmount(145000)}>
          145.000
        </button>
        <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickAmount(200000)}>
          200.000
        </button>
        <button type="button" class="quick-pill font-num tabular-nums" onclick={() => applyQuickAmount(500000)}>
          500.000
        </button>
      {:else}
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
      {/if}
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
              <Icon name={g.ikon || 'target'} size={15} />
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
            <Icon name="tag" size={15} />
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
        <span class="warning-icon"><Icon name="warning" size={14} /></span>
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
  .type-selector-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .scan-receipt-toggle-btn {
    align-self: flex-end;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid var(--edge-soft);
    background: var(--glass-1);
    color: var(--kabut);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 140ms ease;
  }

  .scan-receipt-toggle-btn:hover,
  .scan-receipt-toggle-btn.active {
    background: rgba(31, 92, 70, 0.12);
    border-color: var(--accent);
    color: var(--komorebi);
  }

  /* Scan Receipt Expandable Box */
  .scan-receipt-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 14px;
    background: var(--glass-1);
    border: 1px solid var(--accent);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    animation: scanSlideDown 180ms ease-out;
  }

  @keyframes scanSlideDown {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .hidden-file-input {
    display: none;
  }

  .scan-methods-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .scan-method-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 10px;
    border-radius: 9px;
    background: var(--bg);
    border: 1px solid var(--edge-soft);
    color: var(--fg);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .scan-method-btn:hover {
    border-color: var(--accent);
    background: rgba(31, 92, 70, 0.06);
    color: var(--accent);
  }

  .scan-method-btn.active {
    background: rgba(31, 92, 70, 0.12);
    border-color: var(--accent);
    color: var(--komorebi);
    font-weight: 600;
  }

  .receipt-image-preview {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    max-height: 140px;
    background: rgba(0, 0, 0, 0.03);
    border: 1px dashed var(--edge-soft);
    border-radius: 10px;
    padding: 6px;
    overflow: hidden;
  }

  .receipt-image-preview img {
    max-height: 128px;
    max-width: 100%;
    object-fit: contain;
    border-radius: 6px;
  }

  .remove-preview-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .remove-preview-btn:hover {
    background: rgba(0, 0, 0, 0.8);
  }

  .scan-loading-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 8px;
    background: rgba(31, 92, 70, 0.1);
    color: var(--accent);
    font-size: 12px;
    font-weight: 500;
  }

  .ocr-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: ocrSpin 0.7s linear infinite;
  }

  @keyframes ocrSpin {
    to {
      transform: rotate(360deg);
    }
  }

  .scan-receipt-input {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--edge-soft);
    background: var(--bg);
    color: var(--fg);
    font-family: inherit;
    font-size: 13px;
    line-height: 1.4;
    resize: vertical;
    outline: none;
  }

  .scan-receipt-input:focus {
    border-color: var(--accent);
  }

  .scan-feedback-pill {
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
  }

  .scan-feedback-pill.success {
    background: rgba(31, 92, 70, 0.15);
    color: var(--accent);
  }

  .scan-feedback-pill.error {
    background: rgba(168, 69, 42, 0.15);
    color: var(--expense);
  }

  .scan-receipt-btn-row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  /* Candidate Nominal Chips */
  .candidate-chips-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--glass-1);
    border: 1px dashed var(--edge-soft);
    animation: fadeIn 150ms ease-out;
  }

  .candidate-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-muted);
  }

  .candidate-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .candidate-chip {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 8px;
    background: var(--bg);
    border: 1px solid var(--edge-soft);
    color: var(--fg);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .candidate-chip:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .candidate-chip.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

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

  /* Custom submit styling matching type */
  :global(.btn-submit-keluar) {
    background: var(--expense) !important;
    color: #FFF !important;
    box-shadow: none !important;
  }

  :global(.btn-submit-masuk) {
    background: var(--accent) !important;
    color: var(--on-accent) !important;
    box-shadow: none !important;
  }

  :global(.btn-submit-tabung) {
    background: var(--warn) !important;
    color: #FFF !important;
    box-shadow: none !important;
  }
</style>
