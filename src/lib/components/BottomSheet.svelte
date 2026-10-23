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
    background: var(--overlay);
    z-index: 100;
    animation: fadeIn 200ms ease-out forwards;
  }

  .sheet-container {
    position: fixed;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: 100%;
    max-width: 720px;
    background: var(--bg-raised);
    border-top-left-radius: var(--r, 10px);
    border-top-right-radius: var(--r, 10px);
    border: 1px solid var(--line);
    border-bottom: none;
    box-shadow: none;
    box-sizing: border-box;
    z-index: 101;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 240ms var(--ease) forwards;
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
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--track);
    transition: background 150ms ease;
  }

  .sheet-handle-wrap:hover .sheet-handle {
    background: var(--line);
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 20px 14px;
    border-bottom: 1px solid var(--line);
  }

  .sheet-title {
    font-family: var(--font-ui);
    font-size: var(--fs-h, 18px);
    font-weight: 600;
    color: var(--fg);
    letter-spacing: -0.01em;
    margin: 0;
  }

  .sheet-close-btn {
    width: 36px;
    height: 36px;
    position: relative;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--fg-muted);
    border-radius: var(--r, 10px);
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
    color: var(--fg);
    border-color: var(--fg-muted);
  }

  .sheet-close-btn:active {
    opacity: 0.8;
  }

  .sheet-content {
    overflow-y: auto;
    padding: 20px;
    -webkit-overflow-scrolling: touch;
    color: var(--fg);
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
