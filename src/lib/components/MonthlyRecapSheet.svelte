<script>
  import BottomSheet from './BottomSheet.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import { generateMonthlyRecap } from '../recap.js';
  import { formatRp } from '../money.js';

  /**
   * @typedef {Object} Props
   * @property {boolean} [open]
   * @property {Array} [transactions]
   * @property {Array} [categories]
   * @property {() => void} [onclose]
   */
  let {
    open = $bindable(false),
    transactions = [],
    categories = [],
    onclose = undefined
  } = $props();

  const recap = $derived(generateMonthlyRecap(transactions, categories));

  function close() {
    open = false;
    onclose?.();
  }
</script>

<BottomSheet bind:open {onclose} class="monthly-recap-sheet">
  <div class="recap-content">
    <!-- Header: Badge Bulan & Tombol Tutup -->
    <div class="recap-header">
      <div class="recap-month-badge">
        <Icon name="calendar" size={15} />
        <span class="badge-text font-num">Rekap Bulanan · {recap.periodName}</span>
      </div>
      <button
        type="button"
        class="recap-close-btn"
        onclick={close}
        aria-label="Tutup rekap bulanan"
      >
        <Icon name="x" size={18} />
      </button>
    </div>

    <!-- Neko Advice Box -->
    <div class="neko-advice-box">
      <div class="neko-advice-top">
        <div class="neko-paw-badge">
          <Icon name="paw" size={15} />
        </div>
        <span class="neko-label">Saran Keuangan Neko</span>
        <span class="neko-sparkle-icon">
          <Icon name="sparkles" size={14} />
        </span>
      </div>
      <p class="neko-advice-text">{recap.catAdvice}</p>
    </div>

    <!-- Stat Cards Grid (2x2) -->
    <div class="stats-grid">
      <!-- Pemasukan -->
      <div class="stat-card masuk">
        <div class="stat-card-header">
          <span class="stat-label">Pemasukan</span>
          <span class="stat-icon-wrap masuk-icon">
            <Icon name="wallet" size={15} />
          </span>
        </div>
        <div class="stat-value font-num tabular-nums">{formatRp(recap.totalMasuk)}</div>
      </div>

      <!-- Pengeluaran -->
      <div class="stat-card keluar">
        <div class="stat-card-header">
          <span class="stat-label">Pengeluaran</span>
          <span class="stat-icon-wrap keluar-icon">
            <Icon name="flying_money" size={15} />
          </span>
        </div>
        <div class="stat-value font-num tabular-nums">{formatRp(recap.totalKeluar)}</div>
      </div>

      <!-- Ditabung -->
      <div class="stat-card tabung">
        <div class="stat-card-header">
          <span class="stat-label">Ditabung</span>
          <span class="stat-icon-wrap tabung-icon">
            <Icon name="piggy" size={15} />
          </span>
        </div>
        <div class="stat-value font-num tabular-nums">{formatRp(recap.totalTabung)}</div>
      </div>

      <!-- Sisa Bersih / Surplus / Defisit -->
      <div class="stat-card {recap.netSavings >= 0 ? 'surplus' : 'defisit'}">
        <div class="stat-card-header">
          <span class="stat-label">{recap.netSavings >= 0 ? 'Surplus Bersih' : 'Defisit'}</span>
          <span class="stat-icon-wrap sisa-icon">
            <Icon name={recap.netSavings >= 0 ? 'target' : 'warning'} size={15} />
          </span>
        </div>
        <div class="stat-value font-num tabular-nums">
          {recap.netSavings < 0 ? '-' : ''}{formatRp(Math.abs(recap.netSavings))}
        </div>
      </div>
    </div>

    <!-- Indikator Perbandingan vs Bulan Lalu -->
    <div class="prev-month-indicator">
      {#if recap.prevMonthDiff < 0}
        <span class="diff-icon hemat">
          <Icon name="chevron-down" size={16} />
        </span>
        <span class="diff-text hemat">
          <strong>{Math.abs(recap.prevMonthDiff)}% lebih hemat</strong> dibanding bulan lalu!
        </span>
      {:else if recap.prevMonthDiff > 0}
        <span class="diff-icon boros">
          <Icon name="chevron-right" size={16} />
        </span>
        <span class="diff-text boros">
          <strong>{recap.prevMonthDiff}% lebih tinggi</strong> dibanding bulan lalu
        </span>
      {:else}
        <span class="diff-icon sama">
          <Icon name="check" size={16} />
        </span>
        <span class="diff-text sama">
          Pengeluaran sama persis dengan bulan lalu
        </span>
      {/if}
    </div>

    <!-- Top 3 Kategori Pengeluaran -->
    {#if recap.topCategories.length > 0}
      <div class="top-categories-section">
        <h4 class="top-categories-title">Top Kategori Pengeluaran</h4>
        <div class="top-categories-list">
          {#each recap.topCategories.slice(0, 3) as cat, index}
            <div class="top-cat-row">
              <div class="top-cat-rank font-num">{index + 1}</div>
              <div class="top-cat-icon">
                <Icon name={cat.ikon} size={18} />
              </div>
              <div class="top-cat-details">
                <div class="top-cat-info-row">
                  <span class="top-cat-name">{cat.nama}</span>
                  <span class="top-cat-amount font-num tabular-nums">{formatRp(cat.total)}</span>
                </div>
                <div class="top-cat-bar-track">
                  <div class="top-cat-bar-fill" style="width: {cat.persentase}%;"></div>
                </div>
              </div>
              <div class="top-cat-percent font-num tabular-nums">{cat.persentase}%</div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Tombol Tutup & Lanjutkan -->
    <div class="recap-actions">
      <Button variant="primary" size="lg" full onclick={close}>
        Tutup & Lanjutkan
      </Button>
    </div>
  </div>
</BottomSheet>

<style>
  .recap-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 8px;
  }

  /* Header */
  .recap-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 2px;
  }

  .recap-month-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--bg);
    border: 1px solid var(--line);
    font-size: 13px;
    font-weight: 700;
    color: var(--fg);
  }

  .recap-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg-muted);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .recap-close-btn:hover {
    background: var(--line);
    color: var(--fg);
  }

  /* Neko Advice Box */
  .neko-advice-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border-radius: var(--r, 10px);
    background: rgba(31, 92, 70, 0.08);
    border: 1px solid rgba(31, 92, 70, 0.22);
  }

  .neko-advice-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .neko-paw-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--on-accent, #fff);
  }

  .neko-label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--accent);
  }

  .neko-sparkle-icon {
    margin-left: auto;
    color: var(--accent);
    opacity: 0.8;
  }

  .neko-advice-text {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--fg);
    font-weight: 500;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border-radius: var(--r, 10px);
    background: var(--bg);
    border: 1px solid var(--line);
  }

  .stat-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .stat-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.04);
    color: var(--fg-muted);
  }

  .masuk-icon { color: var(--accent); background: rgba(31, 92, 70, 0.1); }
  .keluar-icon { color: var(--expense); background: rgba(168, 69, 42, 0.1); }
  .tabung-icon { color: #3F5F8F; background: rgba(63, 95, 143, 0.1); }
  .sisa-icon { color: var(--fg); }

  .stat-value {
    font-family: var(--font-display, serif);
    font-size: 15px;
    font-weight: 700;
    color: var(--fg);
  }

  .stat-card.defisit .stat-value {
    color: var(--expense);
  }

  /* Indicator vs Prev Month */
  .prev-month-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: var(--r, 10px);
    background: var(--bg);
    border: 1px solid var(--line);
    font-size: 13px;
  }

  .diff-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .diff-icon.hemat { color: var(--accent); }
  .diff-icon.boros { color: var(--expense); }
  .diff-icon.sama { color: var(--fg-muted); }

  .diff-text {
    color: var(--fg);
  }

  .diff-text strong {
    font-weight: 700;
  }

  .diff-text.hemat strong { color: var(--accent); }
  .diff-text.boros strong { color: var(--expense); }

  /* Top 3 Categories */
  .top-categories-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .top-categories-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--fg);
  }

  .top-categories-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .top-cat-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--r, 10px);
    background: var(--bg);
    border: 1px solid var(--line);
  }

  .top-cat-rank {
    font-size: 11px;
    font-weight: 700;
    color: var(--fg-muted);
    width: 14px;
    text-align: center;
  }

  .top-cat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.04);
    color: var(--fg);
    flex-shrink: 0;
  }

  .top-cat-details {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    min-width: 0;
  }

  .top-cat-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .top-cat-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .top-cat-amount {
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-muted);
  }

  .top-cat-bar-track {
    width: 100%;
    height: 4px;
    background: var(--track, rgba(0, 0, 0, 0.06));
    border-radius: 999px;
    overflow: hidden;
  }

  .top-cat-bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 999px;
    transition: width 300ms ease-out;
  }

  .top-cat-percent {
    font-size: 12px;
    font-weight: 700;
    color: var(--fg-muted);
    width: 32px;
    text-align: right;
  }

  /* Actions */
  .recap-actions {
    margin-top: 4px;
  }
</style>
