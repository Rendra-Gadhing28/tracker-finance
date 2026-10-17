<script>
  /**
   * @typedef {Object} Props
   * @property {boolean} [open]
   * @property {string} [title]
   * @property {() => boolean} [beforeClose]
   * @property {() => void} [onclose]
   * @property {string} [class]
   * @property {import('svelte').Snippet} [children]
   */
  let {
    open = $bindable(false),
    title = '',
    beforeClose = undefined,
    onclose = undefined,
    class: className = '',
    children
  } = $props();

  function close() {
    if (beforeClose && !beforeClose()) {
      return;
    }
    open = false;
    onclose?.();
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  }

  $effect(() => {
    if (open) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeydown);

      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('keydown', handleKeydown);
      };
    }
  });
</script>

{#if open}
  <div class="sheet-scrim" onclick={close} role="presentation"></div>

  <div
    class="sheet-container {className}"
    role="dialog"
    aria-modal="true"
    aria-label={title || 'Dialog'}
  >
    <div class="sheet-handle-wrap" onclick={close} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && close()} aria-label="Tutup sheet">
      <div class="sheet-handle"></div>
    </div>

    {#if title}
      <div class="sheet-header">
        <h2 class="sheet-title">{title}</h2>
        <button type="button" class="sheet-close-btn" onclick={close} aria-label="Tutup">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    {/if}

    <div class="sheet-content">
      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  .sheet-scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim, rgba(3, 7, 12, 0.75));
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 100;
    animation: fadeIn 200ms ease-out forwards;
  }

  .sheet-container {
    position: fixed;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: 100%;
    max-width: 480px;
    background: rgba(8, 14, 22, 0.96);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-top-left-radius: var(--radius-sheet, 28px);
    border-top-right-radius: var(--radius-sheet, 28px);
    border: 1px solid var(--edge-soft);
    border-top: 1px solid var(--edge-bright);
    border-bottom: none;
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    box-sizing: border-box;
    z-index: 101;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  }

  .sheet-handle-wrap {
    width: 100%;
    padding: 12px 0 8px;
    display: flex;
    justify-content: center;
    cursor: pointer;
    touch-action: pan-y;
  }

  .sheet-handle {
    width: 44px;
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.22);
    transition: background 150ms ease;
  }

  .sheet-handle-wrap:hover .sheet-handle {
    background: rgba(255, 255, 255, 0.4);
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 20px 14px;
    border-bottom: 1px solid var(--edge-soft);
  }

  .sheet-title {
    font-family: var(--font-ui);
    font-size: 17px;
    font-weight: 700;
    color: var(--komorebi);
    letter-spacing: -0.01em;
    margin: 0;
  }

  .sheet-close-btn {
    width: 36px;
    height: 36px;
    position: relative;
    border: 1px solid var(--edge-soft);
    background: var(--glass-1);
    color: var(--kabut);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .sheet-close-btn::before {
    content: '';
    position: absolute;
    inset: -6px;
  }

  .sheet-close-btn:hover {
    color: var(--komorebi);
    border-color: var(--edge-bright);
    background: var(--glass-2);
  }

  .sheet-close-btn:active {
    transform: scale(0.92);
  }

  .sheet-content {
    overflow-y: auto;
    padding: 16px 20px;
    -webkit-overflow-scrolling: touch;
    color: var(--komorebi);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translate(-50%, 100%);
    }
    to {
      transform: translate(-50%, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet-scrim {
      animation: none !important;
    }
    .sheet-container {
      animation: none !important;
      transform: translate(-50%, 0) !important;
    }
  }
</style>
