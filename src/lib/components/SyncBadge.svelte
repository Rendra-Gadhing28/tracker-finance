<script>
  /**
   * @typedef {Object} Props
   * @property {'ok' | 'synced' | 'saving' | 'pending' | 'offline' | 'error'} [status]
   * @property {string} [label]
   * @property {boolean} [showLabel]
   * @property {() => void} [onclick]
   * @property {string} [class]
   */
  let {
    status = 'ok',
    label = undefined,
    showLabel = true,
    onclick = undefined,
    class: className = ''
  } = $props();

  let showTooltip = $state(false);

  const normalizedStatus = $derived(
    status === 'synced' ? 'ok' : status === 'pending' ? 'saving' : status
  );

  const displayLabel = $derived(
    label ??
      (normalizedStatus === 'ok'
        ? 'Tersinkron'
        : normalizedStatus === 'saving'
          ? 'Menyimpan'
          : normalizedStatus === 'offline'
            ? 'Offline'
            : 'Gagal')
  );

  const statusDescription = $derived(
    normalizedStatus === 'ok'
      ? 'Semua data tersinkron ke Google Sheets.'
      : normalizedStatus === 'saving'
        ? 'Sedang menyimpan antrean ke Google Sheets...'
        : normalizedStatus === 'offline'
          ? 'Mode offline. Transaksi aman tersimpan di HP.'
          : 'Koneksi gagal. Akan dicoba ulang otomatis.'
  );

  function handleClick(event) {
    if (onclick) {
      onclick();
    } else {
      showTooltip = !showTooltip;
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && showTooltip) {
      showTooltip = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="sync-badge-wrapper {className}">
  <button
    type="button"
    class="sync-badge status-{normalizedStatus}"
    onclick={handleClick}
    aria-label="Status sinkronisasi: {displayLabel}"
  >
    <span class="sync-dot"></span>
    {#if showLabel}
      <span class="sync-text">{displayLabel}</span>
    {/if}
  </button>

  {#if showTooltip}
    <!-- Scrim to dismiss on tap outside -->
    <div
      class="popover-backdrop"
      onclick={() => (showTooltip = false)}
      role="presentation"
    ></div>

    <div class="sync-popover" role="tooltip">
      <div class="popover-header">
        <span class="sync-dot-inline status-{normalizedStatus}"></span>
        <strong>{displayLabel}</strong>
      </div>
      <p class="popover-desc">{statusDescription}</p>
    </div>
  {/if}
</div>

<style>
  .sync-badge-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .sync-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 32px;
    padding: 4px 10px;
    border-radius: var(--radius-chip, 999px);
    border: 1.5px solid var(--line);
    background-color: var(--card);
    color: var(--mute);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    box-sizing: border-box;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: background-color 150ms ease-out, border-color 150ms ease-out;
  }

  .sync-badge:hover,
  .sync-badge:active {
    background-color: #F8F0E0;
    border-color: var(--mute);
  }

  .sync-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .sync-badge.status-ok .sync-dot,
  .sync-dot-inline.status-ok {
    background-color: var(--good);
    box-shadow: 0 0 0 2px rgba(141, 191, 122, 0.25);
  }

  .sync-badge.status-saving .sync-dot,
  .sync-dot-inline.status-saving {
    background-color: var(--warn);
    box-shadow: 0 0 0 2px rgba(233, 182, 90, 0.25);
    animation: dotPulse 1.4s ease-in-out infinite;
  }

  .sync-badge.status-offline .sync-dot,
  .sync-dot-inline.status-offline {
    background-color: var(--mute);
  }

  .sync-badge.status-error .sync-dot,
  .sync-dot-inline.status-error {
    background-color: var(--bad);
  }

  .sync-dot-inline {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .sync-text {
    line-height: 1;
    color: var(--ink);
  }

  .popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 110;
  }

  .sync-popover {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 210px;
    background-color: var(--card);
    border: 1.5px solid var(--line);
    border-bottom: 3px solid #D6C8B2;
    border-radius: 14px;
    padding: 10px 12px;
    z-index: 111;
    box-shadow: 0 4px 12px rgba(74, 59, 50, 0.08);
    animation: popoverFade 150ms ease-out;
  }

  .popover-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink);
    margin-bottom: 4px;
  }

  .popover-desc {
    font-size: 12px;
    color: var(--mute);
    line-height: 1.4;
  }

  @keyframes dotPulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.85);
    }
  }

  @keyframes popoverFade {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
