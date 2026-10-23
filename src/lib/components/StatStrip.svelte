<script>
  /**
   * @typedef {Object} StatItem
   * @property {string} label
   * @property {string} value
   * @property {string} [color]
   * @property {() => void} [onclick]
   */

  /**
   * @typedef {Object} Props
   * @property {StatItem[]} items
   * @property {string} [class]
   */
  let {
    items = [],
    class: className = ''
  } = $props();
</script>

<div class="stat-strip {className}">
  {#each items as item, i}
    {#if item.onclick}
      <button
        type="button"
        class="stat-col stat-btn"
        onclick={item.onclick}
      >
        <span class="stat-label">{item.label}</span>
        <span class="stat-value num" style={item.color ? `color: ${item.color}` : ''}>
          {item.value}
        </span>
      </button>
    {:else}
      <div class="stat-col">
        <span class="stat-label">{item.label}</span>
        <span class="stat-value num" style={item.color ? `color: ${item.color}` : ''}>
          {item.value}
        </span>
      </div>
    {/if}
  {/each}
</div>

<style>
  .stat-strip {
    display: flex;
    align-items: stretch;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    background: transparent;
    width: 100%;
    box-sizing: border-box;
  }

  .stat-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px 8px;
    gap: 4px;
    text-align: center;
    background: transparent;
    border: none;
    box-sizing: border-box;
  }

  .stat-col:not(:last-child) {
    border-right: 1px solid var(--line);
  }

  .stat-btn {
    cursor: pointer;
    transition: opacity 120ms var(--ease);
  }

  .stat-btn:active {
    opacity: 0.7;
  }

  .stat-label {
    font-size: var(--fs-cap, 13px);
    color: var(--fg-muted);
    line-height: 1.2;
  }

  .stat-value {
    font-size: 17px;
    font-weight: 600;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }
</style>
