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
    --card-fill: var(--glass-1);
    --card-border: var(--edge-soft);

    position: relative;
    background-color: var(--card-fill);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-card, 22px);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    padding: 16px;
    color: var(--komorebi);
    box-sizing: border-box;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition: transform 140ms ease-out, border-color 140ms ease-out, background-color 140ms ease-out;
  }

  /* Preset category variants */
  .neko-card.jajan,
  .neko-card.pulsa,
  .neko-card.bensin,
  .neko-card.jajanin {
    --card-fill: rgba(209, 67, 67, 0.08);
    --card-border: rgba(209, 67, 67, 0.22);
  }

  .neko-card.nabung {
    --card-fill: rgba(217, 119, 6, 0.08);
    --card-border: rgba(217, 119, 6, 0.22);
  }

  .neko-card.masuk {
    --card-fill: rgba(56, 161, 105, 0.08);
    --card-border: rgba(56, 161, 105, 0.22);
  }

  .neko-card.interactive {
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), border-color 220ms ease-out, background-color 220ms ease-out, box-shadow 320ms ease;
    will-change: transform;
  }

  .neko-card.interactive:active {
    transform: scale(0.95);
    border-color: var(--edge-bright);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }
</style>
