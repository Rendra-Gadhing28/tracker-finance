<script>
  /**
   * @typedef {Object} Props
   * @property {boolean} [open]
   * @property {string} [message]
   * @property {string} [actionLabel]
   * @property {() => void} [onaction]
   * @property {() => void} [onclose]
   * @property {number} [duration]
   */
  let {
    open = $bindable(false),
    message = '',
    actionLabel = 'Urungkan',
    onaction = undefined,
    onclose = undefined,
    duration = 5000
  } = $props();

  let timer = null;

  $effect(() => {
    if (open) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        open = false;
        onclose?.();
      }, duration);

      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  });

  function handleAction() {
    if (timer) clearTimeout(timer);
    open = false;
    onaction?.();
  }
</script>

{#if open}
  <div class="snackbar-container" role="status" aria-live="polite">
    <span class="snackbar-message">{message}</span>
    {#if actionLabel}
      <button
        type="button"
        class="snackbar-action-btn"
        onclick={handleAction}
      >
        {actionLabel}
      </button>
    {/if}
  </div>
{/if}

<style>
  .snackbar-container {
    position: fixed;
    bottom: calc(88px + env(safe-area-inset-bottom, 12px));
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 32px);
    max-width: 480px;
    background: var(--fg);
    color: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--r, 10px);
    padding: 12px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    z-index: 95;
    box-shadow: none;
    box-sizing: border-box;
    animation: snackbarSlideUp 180ms var(--ease) forwards;
  }

  .snackbar-message {
    font-size: var(--fs-sm, 14px);
    font-weight: 500;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--bg);
  }

  .snackbar-action-btn {
    border: none;
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: var(--fs-sm, 14px);
    cursor: pointer;
    padding: 4px 8px;
    flex-shrink: 0;
    border-radius: var(--r-bar, 4px);
    transition: opacity 120ms var(--ease);
  }

  .snackbar-action-btn:active {
    opacity: 0.8;
  }

  @keyframes snackbarSlideUp {
    from {
      opacity: 0;
      transform: translate(-50%, 12px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .snackbar-container {
      animation: none !important;
    }
  }
</style>
