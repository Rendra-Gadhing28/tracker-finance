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
    border-radius: var(--radius-btn, 16px);
    font-weight: 700;
    cursor: pointer;
    box-sizing: border-box;
    transition: transform 120ms ease-out, border-bottom-width 120ms ease-out, background-color 120ms ease-out;
    text-decoration: none;
    line-height: 1.2;
    touch-action: manipulation;
  }

  /* Sizes with minimum 44px touch targets on standard sizes */
  .size-sm {
    min-height: 36px;
    padding: 6px 14px;
    font-size: 14px;
  }

  .size-md {
    min-height: 44px;
    padding: 10px 18px;
    font-size: 16px;
  }

  .size-lg {
    min-height: 52px;
    padding: 14px 22px;
    font-size: 18px;
  }

  .full-width {
    width: 100%;
  }

  /* Primary sticker button */
  .primary {
    background-color: var(--accent);
    color: #FFFDF7;
    border: 2px solid var(--accent-pressed);
    border-bottom: var(--border-btn-bottom, 4px) solid var(--accent-pressed);
  }

  .primary:active:not(:disabled) {
    transform: translateY(3px);
    border-bottom-width: 1px;
    background-color: var(--accent-pressed);
  }

  /* Secondary dashed/outline sticker button */
  .secondary {
    background-color: var(--card);
    color: var(--ink);
    border: 2px dashed var(--mute);
    border-bottom: var(--border-btn-bottom, 4px) dashed var(--mute);
  }

  .secondary:active:not(:disabled) {
    transform: translateY(3px);
    border-bottom-width: 1px;
    background-color: #F8F0E0;
  }

  /* Danger sticker button */
  .danger {
    background-color: var(--bad);
    color: #FFFDF7;
    border: 2px solid var(--bad-pressed);
    border-bottom: var(--border-btn-bottom, 4px) solid var(--bad-pressed);
  }

  .danger:active:not(:disabled) {
    transform: translateY(3px);
    border-bottom-width: 1px;
    background-color: var(--bad-pressed);
  }

  /* Ghost subtle button */
  .ghost {
    background-color: transparent;
    color: var(--ink);
    border: 2px solid transparent;
    border-bottom: 2px solid transparent;
  }

  .ghost:active:not(:disabled) {
    transform: translateY(1px);
    background-color: rgba(74, 59, 50, 0.08);
  }

  .neko-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }
</style>
