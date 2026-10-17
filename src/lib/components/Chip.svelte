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
    gap: 6px;
    min-height: var(--touch-min, 44px);
    padding: 8px 16px;
    border-radius: var(--radius-chip, 999px);
    border: 1px solid var(--edge-soft);
    background: var(--glass-1);
    color: var(--kabut);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-sizing: border-box;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), background-color 220ms ease-out, border-color 220ms ease-out, box-shadow 320ms ease-out, color 220ms ease-out;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .neko-chip:hover:not(:disabled) {
    color: var(--komorebi);
    border-color: var(--edge-bright);
    background: var(--glass-2);
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
    border-color: var(--aether);
    background: rgba(59, 154, 184, 0.14);
    color: var(--komorebi);
    font-weight: 700;
    box-shadow: 0 0 10px rgba(59, 154, 184, 0.16), inset 0 0 8px rgba(59, 154, 184, 0.08);
  }

  .neko-chip.variant-outline {
    background: transparent;
    border: 1px dashed var(--edge-soft);
  }

  .neko-chip.variant-outline.selected {
    border-style: solid;
    border-color: var(--aether);
    background: rgba(59, 154, 184, 0.10);
  }

  .neko-chip:active:not(:disabled) {
    transform: scale(0.96);
  }

  .neko-chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }
</style>
