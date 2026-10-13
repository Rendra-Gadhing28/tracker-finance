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
          ✕
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
    background-color: rgba(74, 59, 50, 0.45);
    backdrop-filter: blur(2px);
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
    background-color: var(--card);
    border-top-left-radius: var(--radius-sheet, 28px);
    border-top-right-radius: var(--radius-sheet, 28px);
    border: 2px solid var(--line);
    border-bottom: none;
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
    padding: 10px 0 6px;
    display: flex;
    justify-content: center;
    cursor: pointer;
  }

  .sheet-handle {
    width: 42px;
    height: 5px;
    border-radius: 999px;
    background-color: var(--line);
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 20px 12px;
    border-bottom: 1px solid var(--line);
  }

  .sheet-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
  }

  .sheet-close-btn {
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    color: var(--mute);
    font-size: 16px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .sheet-close-btn:active {
    background-color: var(--line);
  }

  .sheet-content {
    overflow-y: auto;
    padding: 16px 20px;
    -webkit-overflow-scrolling: touch;
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
