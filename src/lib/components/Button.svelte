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
    font-family: var(--font-ui);
    font-weight: 700;
    cursor: pointer;
    box-sizing: border-box;
    transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), background-color 220ms ease-out, border-color 220ms ease-out, box-shadow 320ms ease;
    text-decoration: none;
    line-height: 1.2;
    touch-action: manipulation;
    user-select: none;
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
    font-size: 15px;
  }

  .size-lg {
    min-height: 52px;
    padding: 14px 22px;
    font-size: 17px;
  }

  .full-width {
    width: 100%;
  }

  /* Primary Dark Aether button */
  .primary {
    background: linear-gradient(135deg, var(--bara) 0%, #B45309 100%);
    color: var(--on-bara);
    border: 1px solid rgba(255, 255, 255, 0.16);
    box-shadow: var(--glow-bara), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .primary:active:not(:disabled) {
    transform: scale(0.97);
    filter: brightness(0.95);
  }

  /* Secondary translucent glass button */
  .secondary {
    background: var(--glass-2);
    color: var(--komorebi);
    border: 1px solid var(--edge-soft);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .secondary:active:not(:disabled) {
    transform: scale(0.97);
    background: var(--glass-3);
    border-color: var(--edge-bright);
  }

  /* Danger Dark Aether button */
  .danger {
    background: linear-gradient(135deg, var(--api) 0%, #991B1B 100%);
    color: #FFFFFF;
    border: 1px solid rgba(209, 67, 67, 0.35);
    box-shadow: var(--glow-api), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .danger:active:not(:disabled) {
    transform: scale(0.97);
    filter: brightness(0.92);
  }

  /* Ghost subtle button */
  .ghost {
    background: transparent;
    color: var(--kabut);
    border: 1px solid transparent;
  }

  .ghost:active:not(:disabled) {
    transform: scale(0.97);
    background: var(--glass-1);
    color: var(--komorebi);
  }

  .neko-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }
</style>
