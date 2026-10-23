<script>
  /**
   * @typedef {Object} Props
   * @property {boolean} [selected]
   * @property {string} [icon]
   * @property {string} [label]
   * @property {boolean} [disabled]
   * @property {'default' | 'outline' | 'pill'} [variant]
   * @property {() => void} [onclick]
   * @property {string} [class]
   * @property {import('svelte').Snippet} [children]
   */
  let {
    selected = false,
    icon = undefined,
    label = '',
    disabled = false,
    variant = 'default',
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
  class="neko-chip variant-{variant} {selected ? 'selected' : ''} {className}"
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
    gap: 8px;
    height: 44px;
    min-height: 44px;
    padding: 0 16px;
    border-radius: var(--r, 10px);
    border: 1px solid var(--line);
    background: var(--bg-raised);
    color: var(--fg-muted);
    font-size: 15px;
    font-family: var(--font-ui);
    font-weight: 500;
    cursor: pointer;
    box-sizing: border-box;
    transition: background-color 120ms var(--ease), color 120ms var(--ease), border-color 120ms var(--ease);
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    box-shadow: none;
  }

  .neko-chip:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .neko-chip:hover:not(:disabled) {
    color: var(--fg);
    border-color: var(--fg-muted);
  }

  .neko-chip.selected {
    background: var(--fg);
    color: var(--bg);
    border-color: var(--fg);
    font-weight: 600;
  }

  .neko-chip.variant-outline {
    background: transparent;
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
</style>
