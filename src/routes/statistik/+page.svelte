<script>
  import { getContext } from 'svelte';
  import Card from '$lib/components/Card.svelte';
  import DonutChart from '$lib/components/DonutChart.svelte';
  import { formatRp } from '$lib/money.js';
  import { getWIBParts } from '$lib/week.js';
  import { calculateStats, INDO_DAYS, INDO_MONTHS } from '$lib/stats.js';
  import { floatView } from '$lib/actions/floatView.js';
  import {
    transactions,
    budgets,
    settings
  } from '$lib/stores/index.js';

  const txManager = getContext('txManager');

  const INDO_MONTHS_FULL = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  let period = $state('minggu'); // 'minggu' | 'bulan'
  let mode = $state('terpakai'); // 'terpakai' | 'rencana'
  let weekOffset = $state(0);
  let monthOffset = $state(0);

  let selectedSliceId = $state(null);
  let unfoldedCatId = $state(null);
  let showAllTx = $state(false);
  let activeBarTooltip = $state(null);

  const isCurrentPeriod = $derived(
    period === 'minggu' ? weekOffset === 0 : monthOffset === 0
  );

  // Ambang Batas Jatah Rata-rata Statistik: hitung A dari kategori 'keluar' (default 116.000)
  const weeklyA = $derived.by(() => {
    const keluarCats = ($budgets || []).filter((b) => b.tipe === 'keluar');
    return keluarCats.length > 0
      ? keluarCats.reduce((sum, b) => sum + (Number(b.limit_mingguan) || 0), 0)
      : 116000;
  });

  // Compute stats
  const stats = $derived.by(() => {
    return calculateStats({
      transactions: $transactions,
      budgets: $budgets,
      period,
      mode,
      weekOffset,
      monthOffset,
      startDayOfWeek: $settings?.awal_minggu ?? 1,
      weeklyAllowance: weeklyA,
      now: new Date()
    });
  });

  // Period label: e.g. "12–18 Okt 2026" or "Oktober 2026"
  const periodLabel = $derived.by(() => {
    const startP = getWIBParts(stats.range.start);
    const endP = getWIBParts(new Date(stats.range.end.getTime() - 1000));

    if (period === 'minggu') {
      if (startP.month === endP.month) {
        return `${startP.date}–${endP.date} ${INDO_MONTHS[startP.month]} ${startP.year}`;
      }
      return `${startP.date} ${INDO_MONTHS[startP.month]} – ${endP.date} ${INDO_MONTHS[endP.month]} ${endP.year}`;
    }

    return `${INDO_MONTHS_FULL[startP.month]} ${startP.year}`;
  });

  function handlePrevPeriod() {
    if (period === 'minggu') {
      weekOffset -= 1;
    } else {
      monthOffset -= 1;
    }
    selectedSliceId = null;
    unfoldedCatId = null;
    showAllTx = false;
    activeBarTooltip = null;
  }

  function handleNextPeriod() {
    if (isCurrentPeriod) return;
    if (period === 'minggu') {
      weekOffset += 1;
    } else {
      monthOffset += 1;
    }
    selectedSliceId = null;
    unfoldedCatId = null;
    showAllTx = false;
    activeBarTooltip = null;
  }

  function handleCategoryRowClick(cat) {
    if (selectedSliceId === cat.id) {
      selectedSliceId = null;
      unfoldedCatId = null;
      showAllTx = false;
    } else {
      selectedSliceId = cat.id;
      unfoldedCatId = cat.id;
      showAllTx = false;
    }
  }

  // Get transactions for unfolded category in period, sorted largest nominal first
  const unfoldedTransactions = $derived.by(() => {
    if (!unfoldedCatId) return [];
    const startMs = stats.range.start.getTime();
    const endMs = stats.range.end.getTime();
    const knownCatIds = new Set(($budgets || []).map((b) => b.id));

    return ($transactions || [])
      .filter((t) => {
        const d = new Date(t.tanggal).getTime();
        const matchesCategory =
          unfoldedCatId === 'lainnya'
            ? (!t.kategori_id || !knownCatIds.has(t.kategori_id) || t.kategori_id === 'lainnya')
            : t.kategori_id === unfoldedCatId;

        return (
          d >= startMs &&
          d < endMs &&
          matchesCategory &&
          (t.tipe === 'keluar' || t.tipe === 'tabung')
        );
      })
      .sort((a, b) => (Number(b.nominal) || 0) - (Number(a.nominal) || 0));
  });

  // Calculate maximum value for daily bars scale
  const maxBarValue = $derived.by(() => {
    const maxVal = Math.max(...stats.dailyBars.map((b) => b.value), 1);
    const threshold = stats.dailySpending?.averageBudget || stats.dailyBars?.[0]?.threshold || 1;
    return Math.max(maxVal, threshold * 1.25);
  });
</script>

<svelte:head>
  <title>Statistik · Neko Dompet</title>
</svelte:head>

<div class="stats-page">
  <!-- 1. Period & Mode Controls -->
  <div class="controls-card glass-panel float-item" use:floatView>
    <!-- Period Segmented [ Minggu ] [ Bulan ] -->
    <div class="segmented-control" role="tablist">
      <button
        type="button"
        class="seg-btn interactive-tap {period === 'minggu' ? 'active' : ''}"
        onclick={() => { period = 'minggu'; weekOffset = 0; selectedSliceId = null; }}
      >
        Minggu
      </button>
      <button
        type="button"
        class="seg-btn interactive-tap {period === 'bulan' ? 'active' : ''}"
        onclick={() => { period = 'bulan'; monthOffset = 0; selectedSliceId = null; }}
      >
        Bulan
      </button>
    </div>

    <!-- Period Navigator ‹ Label › -->
    <div class="period-navigator">
      <button
        type="button"
        class="period-nav-arrow interactive-tap"
        onclick={handlePrevPeriod}
        aria-label="Periode sebelumnya"
      >
        ‹
      </button>
      <span class="period-title font-num">{periodLabel}</span>
      <button
        type="button"
        class="period-nav-arrow interactive-tap"
        disabled={isCurrentPeriod}
        onclick={handleNextPeriod}
        aria-label="Periode berikutnya"
      >
        ›
      </button>
    </div>

    <!-- Mode Segmented [ Terpakai ] [ Rencana ] -->
    <div class="mode-control-row">
      <div class="segmented-control mode-seg" role="tablist">
        <button
          type="button"
          class="seg-btn interactive-tap {mode === 'terpakai' ? 'active' : ''}"
          onclick={() => (mode = 'terpakai')}
        >
          Terpakai
        </button>
        <button
          type="button"
          class="seg-btn interactive-tap {mode === 'rencana' ? 'active' : ''}"
          onclick={() => (mode = 'rencana')}
        >
          Rencana
        </button>
      </div>
    </div>
  </div>

  <!-- 2. Donut Chart Section (PRD 19.4) -->
  <div class="float-item" use:floatView>
    <Card variant="neutral" class="donut-card">
      <DonutChart
        slices={stats.slices}
        totalAmount={stats.totalAmount}
        {mode}
        periodKey={`${period}_${weekOffset}_${monthOffset}`}
        bind:selectedSliceId
      />
    </Card>
  </div>

  <!-- 3. Insights (PRD 19.7) -->
  {#if stats.insights.length > 0}
    <div class="insights-box float-item" use:floatView>
      {#each stats.insights as insight}
        <div class="insight-row">
          <span class="insight-sparkle">✦</span>
          <span class="insight-text">{insight}</span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- 4. Category Breakdown List (PRD 19.5) -->
  <section class="breakdown-section float-item" use:floatView aria-label="Rincian Kategori">
    <h3 class="section-title">Rincian Kategori</h3>
    <div class="category-breakdown-list">
      {#each stats.categoryList as cat, i}
        {@const isZero = cat.nominal === 0}
        {@const isSelected = selectedSliceId === cat.id}

        <div class="cat-breakdown-wrapper animate-stagger float-item" style="--i: {i}" use:floatView>
          <Card
            variant={cat.warna || 'jajan'}
            interactive
            class="cat-row-card {isZero ? 'zero-nominal' : ''} {isSelected ? 'selected-row' : ''}"
            onclick={() => handleCategoryRowClick(cat)}
          >
            <div class="cat-row-top">
              <div class="cat-identity">
                <span class="cat-icon">{cat.ikon}</span>
                <div class="cat-names">
                  <span class="cat-name">{cat.nama}</span>
                  {#if mode === 'terpakai' && !isZero}
                    <span class="selisih-label {cat.selisihType}">
                      {cat.selisihText}
                    </span>
                  {/if}
                </div>
              </div>

              <div class="cat-figures tabular-nums">
                <span class="cat-amount">{formatRp(cat.nominal)}</span>
                <span class="cat-pct">{Math.round(cat.persen)}%</span>
              </div>
            </div>

            <!-- Relative bar -->
            <div class="cat-bar-track">
              <div
                class="cat-bar-fill"
                style="width: {cat.barPercent}%; background-color: {cat.borderHex || 'var(--accent)'};"
              ></div>
            </div>
          </Card>

          <!-- Unfolded Top Transactions (PRD 19.5) -->
          {#if unfoldedCatId === cat.id && unfoldedTransactions.length > 0}
            {@const displayedTxs = showAllTx ? unfoldedTransactions : unfoldedTransactions.slice(0, 3)}
            <div class="unfolded-txs-container">
              <span class="unfolded-header">Transaksi terbesar:</span>
              <div class="unfolded-items">
                {#each displayedTxs as tx}
                  <div
                    class="unfolded-item"
                    role="button"
                    tabindex="0"
                    onclick={() => txManager?.openEdit?.(tx)}
                    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && txManager?.openEdit?.(tx)}
                  >
                    <span class="tx-note">{tx.catatan || cat.nama}</span>
                    <span class="tx-val tabular-nums">−{formatRp(tx.nominal)}</span>
                  </div>
                {/each}
              </div>

              {#if unfoldedTransactions.length > 3}
                <button
                  type="button"
                  class="btn-see-all"
                  onclick={() => (showAllTx = !showAllTx)}
                >
                  {showAllTx ? 'Tutup' : `Lihat semua (${unfoldedTransactions.length})`}
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <!-- 5. Daily Spending Bars (PRD 19.6) -->
  <section class="daily-bars-section float-item" use:floatView aria-label="Pengeluaran per Hari">
    <div class="daily-bars-header">
      <h3 class="section-title">
        {period === 'minggu' ? 'Pengeluaran per hari' : 'Pengeluaran per minggu'}
      </h3>
      <span class="average-hint">
        ┄ rata-rata {formatRp(stats.dailySpending?.averageBudget || stats.dailyBars?.[0]?.threshold || 0)}
      </span>
    </div>

    <Card variant="neutral" class="daily-bars-card">
      <div class="bars-container">
        <!-- Average threshold dashed line -->
        {#if (stats.dailySpending?.averageBudget || stats.dailyBars?.[0]?.threshold)}
          {@const thresholdVal = stats.dailySpending?.averageBudget || stats.dailyBars?.[0]?.threshold}
          {@const thresholdPct = Math.round((thresholdVal / maxBarValue) * 100)}
          <div
            class="threshold-line"
            style="bottom: {thresholdPct}%"
            aria-hidden="true"
          ></div>
        {/if}

        <!-- Bars -->
        {#each stats.dailyBars as bar}
          {@const heightPct = Math.min(100, Math.round((bar.value / maxBarValue) * 100))}
          <div
            class="bar-column {bar.isFuture ? 'future' : ''}"
            onclick={() => (activeBarTooltip = activeBarTooltip === bar.label ? null : bar.label)}
            role="button"
            tabindex="0"
            onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (activeBarTooltip = bar.label)}
            aria-label="{bar.label}: {formatRp(bar.value)}"
          >
            {#if activeBarTooltip === bar.label}
              <div class="bar-tooltip tabular-nums">
                {formatRp(bar.value)}
              </div>
            {/if}

            <div class="bar-pillar-wrap">
              <div
                class="bar-pillar {(bar.isOver || bar.isOverBudget) ? 'over' : ''}"
                style="height: {heightPct}%"
              ></div>
            </div>

            <span class="bar-label">{bar.shortLabel || bar.label}</span>
          </div>
        {/each}
      </div>
    </Card>
  </section>
</div>

<style>
  .stats-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    box-sizing: border-box;
  }

  /* 1. Controls Card */
  .controls-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 22px;
  }

  .segmented-control {
    display: flex;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--r, 10px);
    padding: 3px;
    gap: 4px;
  }

  .mode-seg {
    width: 100%;
  }

  .seg-btn {
    flex: 1;
    min-height: 38px;
    border: none;
    background: transparent;
    border-radius: var(--r-bar, 4px);
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-muted);
    cursor: pointer;
    transition: all 140ms ease;
  }

  .seg-btn.active {
    background: var(--fg);
    color: var(--bg);
    border: 1px solid var(--fg);
    box-shadow: none;
  }

  .period-navigator {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 4px;
  }

  .period-nav-arrow {
    position: relative;
    border: none;
    background: var(--bg-raised);
    border: 1px solid var(--line);
    font-size: 22px;
    line-height: 1;
    color: var(--fg);
    cursor: pointer;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 120ms ease;
  }

  .period-nav-arrow::before {
    content: '';
    position: absolute;
    inset: -4px;
  }

  .period-nav-arrow:hover {
    background: var(--line);
    border-color: var(--line);
  }

  .period-nav-arrow:active {
    opacity: 0.8;
  }

  .period-nav-arrow:disabled {
    opacity: 0.2;
    cursor: not-allowed;
    border-color: transparent;
  }

  .period-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--fg);
  }

  /* 2. Donut Card */
  .donut-card {
    display: flex;
    justify-content: center;
    padding: 14px 10px;
    border-radius: var(--r, 10px);
  }

  /* 3. Insights Box */
  .insights-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--bg-raised);
    border: 1px solid var(--line);
    border-radius: var(--r, 10px);
    padding: 12px 16px;
    box-shadow: none;
  }

  .insight-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .insight-sparkle {
    color: var(--accent);
    font-size: 14px;
    text-shadow: none;
  }

  .insight-text {
    font-size: 13px;
    font-weight: 500;
    color: var(--fg);
    line-height: 1.45;
  }

  /* 4. Category Breakdown List */
  .breakdown-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--fg);
    padding-left: 2px;
    margin: 0;
  }

  .category-breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cat-breakdown-wrapper {
    display: flex;
    flex-direction: column;
  }

  .cat-row-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cat-row-card.zero-nominal {
    opacity: 0.45;
  }

  .cat-row-card.selected-row {
    border-color: var(--accent);
    box-shadow: none;
  }

  .cat-row-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .cat-identity {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .cat-icon {
    font-size: 20px;
  }

  .cat-names {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .cat-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg);
  }

  .selisih-label {
    font-size: 11px;
    font-weight: 600;
  }

  .selisih-label.hemat {
    color: var(--accent);
  }

  .selisih-label.lewat {
    color: var(--expense);
  }

  .selisih-label.pas {
    color: var(--fg-muted);
  }

  .cat-figures {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .cat-amount {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg);
    letter-spacing: -0.01em;
  }

  .cat-pct {
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-muted);
  }

  .cat-bar-track {
    width: 100%;
    height: 8px;
    background-color: var(--track);
    border-radius: var(--r-bar, 4px);
    overflow: hidden;
  }

  .cat-bar-fill {
    height: 100%;
    border-radius: var(--r-bar, 4px);
  }

  /* Unfolded transactions */
  .unfolded-txs-container {
    background: var(--bg-raised);
    border: 1px solid var(--line);
    border-top: none;
    border-bottom-left-radius: var(--r, 10px);
    border-bottom-right-radius: var(--r, 10px);
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: -6px;
  }

  .unfolded-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-muted);
  }

  .unfolded-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .unfolded-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    padding: 6px 10px;
    border-radius: var(--r-bar, 4px);
    background-color: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .unfolded-item:hover, .unfolded-item:active {
    background-color: var(--line);
    border-color: var(--line);
  }

  .tx-note {
    color: var(--fg);
    font-weight: 500;
  }

  .tx-val {
    color: var(--fg);
    font-weight: 600;
  }

  .btn-see-all {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--line);
    padding: 6px 14px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    color: var(--accent);
    cursor: pointer;
    border-radius: var(--r, 10px);
    margin-top: 4px;
    align-self: center;
    transition: opacity 120ms ease;
  }

  .btn-see-all:hover {
    background: var(--line);
    border-color: var(--line);
  }

  .btn-see-all:active {
    opacity: 0.8;
  }

  /* 5. Daily Spending Bars */
  .daily-bars-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .daily-bars-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0 2px;
  }

  .average-hint {
    font-size: 11px;
    color: var(--fg-muted);
    font-weight: 500;
  }

  .daily-bars-card {
    padding: 20px 14px 14px;
    border-radius: var(--r, 10px);
  }

  .bars-container {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    height: 130px;
    width: 100%;
  }

  .threshold-line {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1.5px dashed var(--warn);
    z-index: 1;
    pointer-events: none;
    opacity: 0.6;
  }

  .bar-column {
    position: relative;
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .bar-column.future {
    opacity: 0.25;
  }

  .bar-pillar-wrap {
    width: 14px;
    height: calc(100% - 24px);
    display: flex;
    align-items: flex-end;
    background-color: var(--track);
    border-radius: var(--r-bar, 4px);
  }

  .bar-pillar {
    width: 100%;
    background: var(--accent);
    box-shadow: none;
    border-radius: var(--r-bar, 4px);
  }

  .bar-pillar.over {
    background: var(--expense);
    box-shadow: none;
  }

  .bar-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-muted);
    line-height: 1;
  }

  .bar-tooltip {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--fg);
    border: 1px solid var(--line);
    color: var(--bg);
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: var(--r-bar, 4px);
    white-space: nowrap;
    z-index: 10;
    box-shadow: none;
  }
</style>
