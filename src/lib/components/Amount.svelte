<script>
  import { rupiah, compact } from '$lib/format.js';

  /**
   * @typedef {Object} Props
   * @property {number} value
   * @property {boolean} [short]
   * @property {boolean} [signed]
   */
  let {
    value = 0,
    short = false,
    signed = true
  } = $props();

  const text = $derived(short ? 'Rp ' + compact(Math.abs(value)) : rupiah(Math.abs(value)));
  const sign = $derived(!signed ? '' : value < 0 ? '−' : value > 0 ? '+' : '');
</script>

<span class="amt num" class:out={value < 0} class:in={value > 0}>{sign}{text}</span>

<style>
  .amt {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .out {
    color: var(--expense);
  }
  .in {
    color: var(--accent);
  }
</style>
