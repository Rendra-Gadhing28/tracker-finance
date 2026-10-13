<script>
  /**
   * @typedef {Object} Props
   * @property {boolean} [selected]
   * @property {string} [icon]
   * @property {string} [label]
   * @property {boolean} [disabled]
   * @property {() => void} [onclick]
   * @property {string} [class]
   * @property {import('svelte').Snippet} [children]
   */
  let {
    selected = false,
    icon = undefined,
    label = '',
    disabled = false,
    onclick = undefined,
    class: className = '',
    children,
    ...rest
  } = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={selected}
  {disabled}
  {onclick}
  class="neko-chip {selected ? 'selected' : ''} {className}"
  {...rest}
>
  {#if icon}
    <span class="chip-icon">{icon}</span>
  {/if}
  {#if label}
    <span class="chip-label">{label}</span>
  {/if}
  {@render children?.()}
</button>

<style>
  .neko-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--touch-min, 44px);
    padding: 8px 16px;
    border-radius: var(--radius-chip, 999px);
    border: 1.5px solid var(--line);
    background-color: var(--card);
    color: var(--ink);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-sizing: border-box;
    transition: all 150ms ease-out;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .chip-icon {
    font-size: 16px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
  }

  .chip-label {
    line-height: 1.2;
  }

  .neko-chip.selected {
    border-color: var(--accent);
    background-color: var(--cat-jajan-fill);
    color: var(--ink);
    font-weight: 700;
  }

  .neko-chip:active:not(:disabled) {
    transform: translateY(1px) scale(0.98);
  }

  .neko-chip:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
</style>
