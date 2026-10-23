<script>
  import { rupiah } from '$lib/format.js';

  /**
   * @typedef {Object} Props
   * @property {string} title
   * @property {string} [subtitle]
   * @property {number} amount
   * @property {'keluar' | 'masuk' | 'tabung'} [type]
   * @property {() => void} [onclick]
   * @property {string} [class]
   */
  let {
    title = '',
    subtitle = '',
    amount = 0,
    type = 'keluar',
    onclick = undefined,
    class: className = ''
  } = $props();

  const formattedAmount = $derived(rupiah(Math.abs(amount)));
  const sign = $derived(type === 'keluar' ? '−' : type === 'masuk' ? '+' : '');
</script>

<button
  type="button"
  class="tx-row {className}"
  {onclick}
>
  <div class="tx-left">
    <span class="tx-title">{title}</span>
    {#if subtitle}
      <span class="tx-caption">{subtitle}</span>
    {/if}
  </div>
  <div class="tx-right num {type}">
    {sign}{formattedAmount}
  </div>
</button>

<style>
  .tx-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 64px;
    padding: 12px 0;
    border: none;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
    background: transparent;
    transition: opacity 120ms var(--ease);
    box-sizing: border-box;
    text-align: left;
    width: 100%;
    font-family: inherit;
    color: inherit;
  }

  .tx-row:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .tx-row:active {
    opacity: 0.7;
  }

  .tx-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
    padding-right: 16px;
  }

  .tx-title {
    font-size: var(--fs-body, 16px);
    font-weight: 500;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tx-caption {
    font-size: var(--fs-cap, 13px);
    color: var(--fg-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tx-right {
    font-size: var(--fs-body, 16px);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    text-align: right;
  }

  .tx-right.keluar {
    color: var(--expense);
  }

  .tx-right.masuk {
    color: var(--accent);
  }

  .tx-right.tabung {
    color: var(--warn);
  }
</style>
