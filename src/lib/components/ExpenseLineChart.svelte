<script>
  import { compact, rupiah } from '$lib/format.js';

  let {
    data = [],
    dailyBudget = 0,
    average = 0
  } = $props();

  let activeIndex = $state(null);

  const padLeft = 24;
  const padRight = 32;
  const padTop = 32;
  const padBottom = 28;
  const plotWidth = 360 - padLeft - padRight;
  const plotHeight = 180 - padTop - padBottom;
  const baseline = padTop + plotHeight;

  const maxNominal = $derived.by(() => {
    const vals = data.map((d) => Number(d.nominal) || 0);
    const b = Number(dailyBudget) || 0;
    return Math.max(...vals, b, 1000);
  });

  const maxY = $derived(maxNominal * 1.25);

  const points = $derived.by(() => {
    if (!data || data.length === 0) return [];
    const n = data.length;
    const stepX = n > 1 ? plotWidth / (n - 1) : 0;

    return data.map((d, i) => {
      const x = padLeft + i * stepX;
      const nom = Number(d.nominal) || 0;
      const y = baseline - (nom / maxY) * plotHeight;
      return {
        ...d,
        index: i,
        x,
        y,
        isOver: dailyBudget > 0 && nom > dailyBudget
      };
    });
  });

  const pathD = $derived.by(() => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
  });

  const budgetY = $derived.by(() => {
    if (!dailyBudget || dailyBudget <= 0) return null;
    const rawY = baseline - (dailyBudget / maxY) * plotHeight;
    return Math.max(padTop - 8, Math.min(baseline, rawY));
  });

  const budgetLabelY = $derived.by(() => {
    if (budgetY === null) return 0;
    return budgetY < 24 ? budgetY + 12 : budgetY - 5;
  });
</script>

<div
  class="line-chart-wrapper"
  role="region"
  aria-label="Grafik garis pengeluaran 7 hari terakhir"
>
  <svg
    viewBox="0 0 360 180"
    class="chart-svg"
    role="img"
    aria-label="Grafik pengeluaran 7 hari terakhir. Rata-rata {compact(average)}, batas harian {compact(dailyBudget)}"
  >
    <!-- Baseline 0 -->
    <line
      x1="16"
      y1={baseline}
      x2="344"
      y2={baseline}
      stroke="var(--line)"
      stroke-width="1"
    />

    <!-- Garis Batas Budget Harian (Merah Putus-putus) -->
    {#if budgetY !== null}
      <line
        x1="16"
        y1={budgetY}
        x2="344"
        y2={budgetY}
        class="budget-line"
        stroke="var(--expense, #A8452A)"
        stroke-width="1.5"
        stroke-dasharray="4 4"
      />
      <text
        x="344"
        y={budgetLabelY}
        text-anchor="end"
        class="budget-label num"
        fill="var(--expense, #A8452A)"
      >
        Batas {compact(dailyBudget)}
      </text>
    {/if}

    <!-- Garis Tren Pengeluaran -->
    {#if pathD}
      <path
        d={pathD}
        fill="none"
        stroke="var(--accent)"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="trend-line"
      />
    {/if}

    <!-- Titik Data & Label -->
    {#each points as p}
      <!-- Label Nilai di Atas Titik -->
      {#if p.nominal > 0 || p.isToday}
        <text
          x={p.x}
          y={Math.max(12, p.y - 8)}
          text-anchor="middle"
          class="point-label num"
          class:label-over={p.isOver}
          class:label-today={p.isToday}
        >
          {compact(p.nominal)}
        </text>
      {/if}

      <!-- Titik Lingkaran -->
      <circle
        cx={p.x}
        cy={p.y}
        r={p.isToday ? 5.5 : 4.5}
        class="point-dot"
        class:dot-today={p.isToday}
        class:dot-over={p.isOver}
        stroke={p.isOver ? 'var(--expense, #A8452A)' : 'var(--accent)'}
        fill={p.isToday ? (p.isOver ? 'var(--expense, #A8452A)' : 'var(--accent)') : 'var(--bg-raised, #FFF)'}
        stroke-width="2"
      />

      <!-- Area Sentuh / Tap Target -->
      <circle
        cx={p.x}
        cy={p.y}
        r="18"
        fill="transparent"
        class="point-touch-target"
        role="button"
        tabindex="0"
        aria-label="{p.label}: {rupiah(p.nominal)}"
        onclick={() => (activeIndex = activeIndex === p.index ? null : p.index)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            activeIndex = activeIndex === p.index ? null : p.index;
          }
        }}
      />

      <!-- Sumbu X: Nama Hari -->
      <text
        x={p.x}
        y={baseline + 18}
        text-anchor="middle"
        class="day-label"
        class:day-today={p.isToday}
      >
        {p.shortLabel}
      </text>
    {/each}
  </svg>

  <!-- Tooltip jika titik disentuh / ditekan -->
  {#if activeIndex !== null && points[activeIndex]}
    {@const activePoint = points[activeIndex]}
    <div
      class="active-tooltip tabular-nums"
      style:left="{((activePoint.x / 360) * 100).toFixed(1)}%"
    >
      <span class="tooltip-day">{activePoint.label}:</span>
      <span class="tooltip-val">{rupiah(activePoint.nominal)}</span>
    </div>
  {/if}
</div>

<style>
  .line-chart-wrapper {
    position: relative;
    width: 100%;
    user-select: none;
    -webkit-user-select: none;
    padding: 8px 0 4px;
  }

  .chart-svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .budget-line {
    transition: y1 300ms var(--ease, ease), y2 300ms var(--ease, ease);
  }

  .budget-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .trend-line {
    transition: d 300ms var(--ease, ease);
  }

  .point-dot {
    transition: cx 300ms var(--ease, ease), cy 300ms var(--ease, ease), r 150ms var(--ease, ease);
  }

  .point-dot.dot-today {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
  }

  .point-touch-target {
    cursor: pointer;
  }

  .point-touch-target:focus-visible {
    outline: none;
  }

  .point-label {
    font-size: 11px;
    font-weight: 500;
    fill: var(--fg);
  }

  .point-label.label-over {
    fill: var(--expense, #A8452A);
    font-weight: 600;
  }

  .point-label.label-today {
    font-weight: 600;
  }

  .day-label {
    font-size: 12px;
    fill: var(--fg-muted);
    font-weight: 400;
  }

  .day-label.day-today {
    fill: var(--accent);
    font-weight: 600;
  }

  .active-tooltip {
    position: absolute;
    bottom: 2px;
    transform: translateX(-50%);
    background: var(--fg);
    color: var(--bg);
    padding: 4px 8px;
    border-radius: var(--r-bar, 4px);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    pointer-events: none;
    z-index: 5;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .tooltip-day {
    opacity: 0.8;
    margin-right: 4px;
  }

  .tooltip-val {
    font-weight: 600;
  }
</style>
