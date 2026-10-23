<script>
  /**
   * @typedef {Object} Props
   * @property {'primary' | 'secondary' | 'danger' | 'ghost'} [variant]
   * @property {'sm' | 'md' | 'lg'} [size]
   * @property {boolean} [full]
   * @property {boolean} [disabled]
   * @property {'button' | 'submit' | 'reset'} [type]
   * @property {() => void} [onclick]
   * @property {string} [class]
   * @property {import('svelte').Snippet} [children]
   */
  let {
    variant = 'primary',
    size = 'md',
    full = false,
    disabled = false,
    type = 'button',
    onclick = undefined,
    class: className = '',
    children,
    ...rest
  } = $props();
</script>

<button
  {type}
  {disabled}
  {onclick}
  class="neko-btn {variant} size-{size} {full ? 'full-width' : ''} {className}"
  {...rest}
>
  {@render children?.()}
</button>

<style>
  .neko-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: var(--r, 10px);
    font-family: var(--font-ui);
    font-weight: 600;
    cursor: pointer;
    box-sizing: border-box;
    transition: opacity 120ms var(--ease), background-color 120ms var(--ease);
    text-decoration: none;
    line-height: 1.2;
    touch-action: manipulation;
    user-select: none;
    border: none;
    box-shadow: none;
  }

  .neko-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .neko-btn:active:not(:disabled) {
    opacity: 0.85;
  }

  /* Sizes with minimum 44px touch target on md/lg */
  .size-sm {
    position: relative;
    min-height: 36px;
    padding: 8px 12px;
    font-size: var(--fs-sm, 14px);
  }

  .size-sm::before {
    content: '';
    position: absolute;
    inset: -4px;
  }

  .size-md {
    min-height: 44px;
    padding: 12px 20px;
    font-size: var(--fs-body, 16px);
  }

  .size-lg {
    min-height: 52px;
    padding: 16px 24px;
    font-size: 16px;
  }

  .full-width {
    width: 100%;
  }

  /* Primary button */
  .primary {
    background: var(--accent);
    color: var(--on-accent);
  }

  /* Secondary button */
  .secondary {
    background: var(--bg-raised);
    color: var(--fg);
    border: 1px solid var(--line);
  }

  /* Danger button */
  .danger {
    background: var(--expense);
    color: #FFFFFF;
  }

  /* Ghost button */
  .ghost {
    background: transparent;
    color: var(--fg-muted);
  }

  .ghost:hover:not(:disabled) {
    color: var(--fg);
  }
</style>
