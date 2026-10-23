<script>
  /**
   * @typedef {Object} Props
   * @property {'neutral' | 'jajan' | 'pulsa' | 'bensin' | 'jajanin' | 'nabung' | 'masuk'} [variant]
   * @property {string} [fill]
   * @property {string} [border]
   * @property {boolean} [interactive]
   * @property {string} [class]
   * @property {import('svelte').Snippet} [children]
   */
  let {
    variant = 'neutral',
    fill = undefined,
    border = undefined,
    interactive = false,
    class: className = '',
    children,
    ...rest
  } = $props();

  const customStyle = $derived(
    [
      fill ? `--card-fill: ${fill};` : '',
      border ? `--card-border: ${border};` : ''
    ]
      .filter(Boolean)
      .join(' ')
  );
</script>

<div
  class="neko-card {variant} {interactive ? 'interactive' : ''} {className}"
  style={customStyle || undefined}
  {...rest}
>
  {@render children?.()}
</div>

<style>
  .neko-card {
    position: relative;
    background-color: var(--card-fill, var(--bg-raised));
    border: 1px solid var(--card-border, var(--line));
    border-radius: var(--r, 10px);
    padding: 20px;
    color: var(--fg);
    box-sizing: border-box;
    box-shadow: none;
    transition: opacity 120ms var(--ease), border-color 120ms var(--ease);
  }

  .neko-card.interactive {
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .neko-card.interactive:active {
    opacity: 0.88;
  }
</style>
