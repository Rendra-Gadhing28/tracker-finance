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
    bottom: calc(76px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 32px);
    max-width: 440px;
    background-color: #382C24;
    color: #FFFDF7;
    border-radius: var(--radius-chip, 999px);
    padding: 12px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    z-index: 95;
    box-shadow: 0 4px 16px rgba(56, 44, 36, 0.25);
    box-sizing: border-box;
    animation: snackbarSlideUp 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .snackbar-message {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .snackbar-action-btn {
    border: none;
    background: transparent;
    color: #F4D58D;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    padding: 4px 6px;
    flex-shrink: 0;
    border-radius: 8px;
    transition: transform 100ms ease-out;
  }

  .snackbar-action-btn:active {
    transform: scale(0.95);
    color: #FFFFFF;
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
