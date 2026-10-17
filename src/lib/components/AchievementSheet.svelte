<script>
  import BottomSheet from './BottomSheet.svelte';
  import Button from './Button.svelte';
  import { getWIBParts } from '../week.js';

  /**
   * @typedef {Object} Badge
   * @property {string} id
   * @property {string} icon
   * @property {string} name
   * @property {string} desc
   * @property {boolean} unlocked
   * @property {string} progressText
   * @property {string|null} [unlockedAt]
   */

  /**
   * @typedef {Object} Props
   * @property {boolean} [open]
   * @property {number} [currentStreak]
   * @property {number} [bestStreak]
   * @property {Badge[]} [badges]
   * @property {number} [unlockedCount]
   * @property {number} [totalBadges]
   * @property {() => void} [onclose]
   */
  let {
    open = $bindable(false),
    currentStreak = 0,
    bestStreak = 0,
    badges = [],
    unlockedCount = 0,
    totalBadges = 10,
    onclose = undefined
  } = $props();

  let selectedBadge = $state(null);

  const INDO_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function formatUnlockedDate(iso) {
    if (!iso) return 'Selesai';
    if (iso.includes('terpenuhi')) return iso;
    try {
      const p = getWIBParts(iso);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(p.date)} ${INDO_MONTHS[p.month]} ${p.year}`;
    } catch {
      return 'Selesai';
    }
  }

  function handleBadgeClick(badge) {
    selectedBadge = selectedBadge?.id === badge.id ? null : badge;
  }
</script>

<BottomSheet bind:open title="Pencapaian" {onclose}>
  <div class="achievement-sheet-content">
    <!-- Streak Summary Banner -->
    <div class="streak-summary-card">
      <div class="streak-paw-circle">
        <span class="streak-paw-icon">🔥</span>
      </div>
      <div class="streak-summary-info">
        <h3 class="streak-main-title font-num tabular-nums">
          {currentStreak} hari hemat beruntun
        </h3>
        <p class="streak-sub-text">
          Rekor terbaik: <strong class="font-num tabular-nums">{bestStreak} hari</strong>
        </p>
      </div>
    </div>

    <!-- Badges Section Header -->
    <div class="badges-header-row">
      <h4 class="badges-section-title">
        Lencana ({unlockedCount} dari {totalBadges})
      </h4>
      <span class="badges-pct font-num tabular-nums">
        {Math.round((unlockedCount / Math.max(1, totalBadges)) * 100)}%
      </span>
    </div>

    <!-- 3-Column Badge Grid -->
    <div class="badges-grid">
      {#each badges as badge (badge.id)}
        <button
          type="button"
          class="badge-card {badge.unlocked ? 'unlocked' : 'locked'} {selectedBadge?.id === badge.id ? 'active' : ''}"
          onclick={() => handleBadgeClick(badge)}
          aria-label="{badge.name}: {badge.unlocked ? 'Diraih' : 'Terkunci'}"
        >
          <div class="badge-icon-wrap">
            <span class="badge-icon">{badge.icon}</span>
            {#if !badge.unlocked}
              <span class="lock-mini-icon">🔒</span>
            {:else if badge.isNew}
              <span class="new-mini-dot" title="Baru"></span>
            {/if}
          </div>
          <span class="badge-name">{badge.name}</span>
          <span class="badge-status-tag font-num tabular-nums">
            {badge.unlocked ? 'Diraih ✓' : badge.progressText}
          </span>
        </button>
      {/each}
    </div>

    <!-- Selected Badge Detail Dialog / Card -->
    {#if selectedBadge}
      <div class="badge-detail-card" role="region" aria-label="Detail lencana">
        <div class="detail-top-row">
          <div class="detail-badge-icon-box {selectedBadge.unlocked ? 'unlocked' : 'locked'}">
            <span class="detail-icon">{selectedBadge.icon}</span>
          </div>
          <div class="detail-badge-headings">
            <h5 class="detail-name">{selectedBadge.name}</h5>
            <span class="detail-status {selectedBadge.unlocked ? 'text-good' : 'text-mute'}">
              {selectedBadge.unlocked
                ? `Diraih · ${formatUnlockedDate(selectedBadge.unlockedAt)}`
                : 'Belum diraih'}
            </span>
          </div>
          <button
            type="button"
            class="detail-close-btn"
            onclick={() => (selectedBadge = null)}
            aria-label="Tutup detail"
          >
            ✕
          </button>
        </div>

        <p class="detail-desc">{selectedBadge.desc}</p>

        <div class="detail-progress-row font-num tabular-nums">
          <span class="detail-progress-label">Kemajuan:</span>
          <strong class="detail-progress-val">{selectedBadge.progressText}</strong>
        </div>
      </div>
    {/if}

    <p class="footer-hint">Ketuk lencana untuk melihat caranya.</p>
  </div>
</BottomSheet>

<style>
  .achievement-sheet-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 4px;
  }

  /* Streak Summary */
  .streak-summary-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    border-radius: 20px;
    padding: 12px 16px;
  }

  .streak-paw-circle {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--glass-2);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--bara);
    box-shadow: var(--glow-bara);
    flex-shrink: 0;
  }

  .streak-paw-icon {
    font-size: 20px;
    line-height: 1;
  }

  .streak-summary-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .streak-main-title {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--komorebi);
    letter-spacing: -0.01em;
    margin: 0;
  }

  .streak-sub-text {
    font-size: 12px;
    color: var(--kabut);
    margin: 0;
  }

  .streak-sub-text strong {
    color: var(--bara);
  }

  /* Badges Header */
  .badges-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 2px;
  }

  .badges-section-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--komorebi);
    margin: 0;
  }

  .badges-pct {
    font-size: 13px;
    font-weight: 700;
    color: var(--aether);
  }

  /* 3-Column Badges Grid */
  .badges-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .badge-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 12px 6px;
    border-radius: 16px;
    border: 1px solid var(--edge-soft);
    background: var(--glass-1);
    cursor: pointer;
    box-sizing: border-box;
    transition: transform 120ms ease-out, border-color 120ms ease-out, box-shadow 120ms ease-out;
  }

  .badge-card:active {
    transform: scale(0.96);
  }

  .badge-card.unlocked {
    background: rgba(217, 119, 6, 0.08);
    border-color: rgba(217, 119, 6, 0.35);
    box-shadow: 0 0 10px rgba(217, 119, 6, 0.12);
  }

  .badge-card.locked {
    background: rgba(0, 0, 0, 0.2);
    border: 1px dashed var(--edge-soft);
    opacity: 0.55;
  }

  .badge-card.active {
    border-color: var(--aether);
    box-shadow: var(--glow-aether);
    transform: scale(1.03);
  }

  .badge-icon-wrap {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--glass-2);
    margin-bottom: 6px;
    border: 1px solid var(--edge-soft);
  }

  .badge-card.unlocked .badge-icon-wrap {
    border-color: rgba(217, 119, 6, 0.4);
    background: rgba(217, 119, 6, 0.12);
    box-shadow: 0 0 8px rgba(217, 119, 6, 0.15);
  }

  .badge-icon {
    font-size: 22px;
    line-height: 1;
  }

  .lock-mini-icon {
    position: absolute;
    bottom: -2px;
    right: -2px;
    font-size: 10px;
    background: rgba(0, 0, 0, 0.6);
    color: var(--kabut);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--edge-soft);
  }

  .new-mini-dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background-color: var(--api);
    box-shadow: var(--glow-api);
    border: 1.5px solid var(--senja);
  }

  .badge-name {
    font-size: 11px;
    font-weight: 700;
    color: var(--komorebi);
    line-height: 1.25;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .badge-status-tag {
    font-size: 10px;
    font-weight: 700;
    margin-top: 4px;
    color: var(--kabut);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge-card.unlocked .badge-status-tag {
    color: var(--tunas);
  }

  /* Badge Detail Card */
  .badge-detail-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--glass-2);
    border: 1px solid var(--edge-bright);
    border-radius: 18px;
    padding: 14px 16px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5), var(--glow-aether);
    animation: fadeIn 150ms ease-out;
  }

  .detail-top-row {
    display: flex;
    align-items: center;
    gap: 10px;
    position: relative;
  }

  .detail-badge-icon-box {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(217, 119, 6, 0.12);
    border: 1px solid rgba(217, 119, 6, 0.4);
    flex-shrink: 0;
  }

  .detail-badge-icon-box.locked {
    background: rgba(0, 0, 0, 0.25);
    border-color: var(--edge-soft);
    opacity: 0.8;
  }

  .detail-icon {
    font-size: 22px;
  }

  .detail-badge-headings {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .detail-name {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--komorebi);
    margin: 0;
  }

  .detail-status {
    font-size: 11px;
    font-weight: 700;
  }

  .text-good {
    color: var(--tunas);
  }

  .text-mute {
    color: var(--kabut);
  }

  .detail-close-btn {
    border: 1px solid var(--edge-soft);
    background: var(--glass-1);
    font-size: 13px;
    color: var(--kabut);
    cursor: pointer;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 120ms ease;
  }

  .detail-close-btn:hover {
    color: var(--komorebi);
    border-color: var(--edge-bright);
    background: var(--glass-2);
  }

  .detail-desc {
    font-size: 12px;
    color: var(--komorebi);
    margin: 0;
    line-height: 1.4;
  }

  .detail-progress-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .detail-progress-label {
    color: var(--kabut);
  }

  .detail-progress-val {
    color: var(--aether);
  }

  .footer-hint {
    font-size: 11px;
    color: var(--kabut);
    text-align: center;
    margin: 0;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
