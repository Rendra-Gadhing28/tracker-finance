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
      border ? `--card-border: ${border}; --card-bottom: ${border};` : ''
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
    --card-fill: var(--card);
    --card-border: var(--line);
    --card-bottom: #D6C8B2;

    position: relative;
    background-color: var(--card-fill);
    border: 2px solid var(--card-border);
    border-bottom: var(--border-card-bottom, 5px) solid var(--card-bottom);
    border-radius: var(--radius-card, 22px);
    padding: 16px;
    color: var(--ink);
    box-sizing: border-box;
    transition: transform 150ms ease-out, border-bottom-width 150ms ease-out;
  }

  /* Preset category variants */
  .neko-card.jajan {
    --card-fill: var(--cat-jajan-fill);
    --card-border: var(--cat-jajan-border);
    --card-bottom: #E59A6A;
  }

  .neko-card.pulsa {
    --card-fill: var(--cat-pulsa-fill);
    --card-border: var(--cat-pulsa-border);
    --card-bottom: #8BB6CC;
  }

  .neko-card.bensin {
    --card-fill: var(--cat-bensin-fill);
    --card-border: var(--cat-bensin-border);
    --card-bottom: #8CB876;
  }

  .neko-card.jajanin {
    --card-fill: var(--cat-jajanin-fill);
    --card-border: var(--cat-jajanin-border);
    --card-bottom: #B79BCF;
  }

  .neko-card.nabung {
    --card-fill: var(--cat-nabung-fill);
    --card-border: var(--cat-nabung-border);
    --card-bottom: #E3A3B2;
  }

  .neko-card.masuk {
    --card-fill: var(--cat-masuk-fill);
    --card-border: var(--cat-masuk-border);
    --card-bottom: #E2C172;
  }

  .neko-card.interactive {
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .neko-card.interactive:active {
    transform: translateY(2px);
    border-bottom-width: 3px;
  }
</style>
