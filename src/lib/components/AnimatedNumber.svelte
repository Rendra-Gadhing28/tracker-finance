<script>
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { formatRp } from '$lib/money.js';

  /**
   * @typedef {Object} Props
   * @property {number} [value=0]
   * @property {((v: number) => string)|null} [format=null]
   * @property {number} [duration=1500]
   * @property {string} [class='']
   */
  let props = $props();

  const tween = tweened(0, {
    duration: 1500,
    easing: cubicOut
  });

  $effect(() => {
    tween.set(Number(props.value) || 0);
  });

  const formatted = $derived.by(() => {
    const current = Math.round($tween);
    if (typeof props.format === 'function') {
      return props.format(current);
    }
    return formatRp(current);
  });
</script>

<span class="tabular-nums {props.class ?? ''}">{formatted}</span>
