<script>
  /**
   * @typedef {Object} Props
   * @property {number} value - Progress ratio 0 to 1 (or > 1)
   * @property {string} [color]
   * @property {number} [height]
   */
  let {
    value = 0,
    color = 'var(--accent)',
    height = 6
  } = $props();

  const pct = $derived(Math.min(Math.max(value, 0), 1) * 100);
</script>

<div
  class="track"
  role="progressbar"
  aria-valuenow={Math.round(value * 100)}
  aria-valuemin="0"
  aria-valuemax="100"
  style:height="{height}px"
>
  <div
    class="fill"
    style:transform="scaleX({Math.min(Math.max(value, 0), 1)})"
    style:background={color}
  ></div>
</div>

<style>
  .track {
    width: 100%;
    border-radius: var(--r-bar, 4px);
    background: var(--track);
    overflow: hidden;
  }
  .fill {
    width: 100%;
    height: 100%;
    border-radius: var(--r-bar, 4px);
    transform-origin: left;
    transition: transform 400ms var(--ease);
  }
</style>
