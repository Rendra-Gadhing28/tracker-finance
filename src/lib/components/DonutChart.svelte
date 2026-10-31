<script>
  import { formatRp } from '../money.js';
  import Icon from './Icon.svelte';

  /**
   * @typedef {Object} Slice
   * @property {string} id
   * @property {string} nama
   * @property {string} ikon
   * @property {number} nominal
   * @property {number} persen
   * @property {number} startAngle
   * @property {number} endAngle
   * @property {number} angle
   * @property {string} warnaHex
   * @property {string} borderHex
   */

  /**
   * @typedef {Object} Props
   * @property {Slice[]} [slices]
   * @property {number} [totalAmount]
   * @property {'terpakai' | 'rencana'} [mode]
   * @property {string|null} [selectedSliceId]
   * @property {(sliceId: string|null) => void} [onselect]
   */
  let {
    slices = [],
    totalAmount = 0,
    mode = 'terpakai',
    periodKey = '',
    selectedSliceId = $bindable(null),
    onselect = undefined
  } = $props();

  const cx = 120;
  const cy = 138;
  const baseR = 88;
  const baseThickness = 28;

  let earTwitch = $state(false);

  // Trigger ear twitch when selectedSliceId changes
  $effect(() => {
    if (selectedSliceId) {
      earTwitch = true;
      const t = setTimeout(() => {
        earTwitch = false;
      }, 350);
      return () => clearTimeout(t);
    }
  });

  const selectedSlice = $derived(
    slices.find((s) => s.id === selectedSliceId) || null
  );

  // Calculate cat eye offset
  const catEyeOffset = $derived.by(() => {
    if (!selectedSlice) {
      return { dx: 0, dy: 1.5 }; // looking down into center
    }
    const midDeg = (selectedSlice.startAngle + selectedSlice.endAngle) / 2;
    const rad = ((midDeg - 90) * Math.PI) / 180;
    return {
      dx: Math.cos(rad) * 2.2,
      dy: Math.sin(rad) * 2.2
    };
  });

  function makeArcPath(rIn, rOut, startDeg, endDeg) {
    const delta = endDeg - startDeg;
    if (delta >= 359.9) {
      return `M ${cx} ${cy - rOut}
              A ${rOut} ${rOut} 0 1 1 ${cx} ${cy + rOut}
              A ${rOut} ${rOut} 0 1 1 ${cx} ${cy - rOut}
              M ${cx} ${cy - rIn}
              A ${rIn} ${rIn} 0 1 0 ${cx} ${cy + rIn}
              A ${rIn} ${rIn} 0 1 0 ${cx} ${cy - rIn} Z`;
    }

    const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
    const startRad = toRad(startDeg);
    const endRad = toRad(endDeg);

    const x1 = cx + rOut * Math.cos(startRad);
    const y1 = cy + rOut * Math.sin(startRad);
    const x2 = cx + rOut * Math.cos(endRad);
    const y2 = cy + rOut * Math.sin(endRad);

    const x3 = cx + rIn * Math.cos(endRad);
    const y3 = cy + rIn * Math.sin(endRad);
    const x4 = cx + rIn * Math.cos(startRad);
    const y4 = cy + rIn * Math.sin(startRad);

    const largeArc = delta > 180 ? 1 : 0;

    return `M ${x1} ${y1}
            A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2} ${y2}
            L ${x3} ${y3}
            A ${rIn} ${rIn} 0 ${largeArc} 0 ${x4} ${y4}
            Z`;
  }

  function handleSliceClick(slice) {
    if (selectedSliceId === slice.id) {
      selectedSliceId = null;
      onselect?.(null);
    } else {
      selectedSliceId = slice.id;
      onselect?.(slice.id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10); // 10ms haptic feedback per PRD 19.4
      }
    }
  }

  function handleCenterClick() {
    selectedSliceId = null;
    onselect?.(null);
  }
</script>

<div class="donut-chart-wrapper">
  <svg
    viewBox="0 0 240 260"
    class="donut-svg"
    role="img"
    aria-label="Grafik Donut Statistik Pengeluaran"
  >
    <defs>
      <filter id="blossomShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#4A3B32" flood-opacity="0.15" />
      </filter>

      <!-- Sweep Mask for 700ms initial sweep / period change animation (PRD 19.4) -->
      <mask id="donutSweepMask">
        {#key periodKey}
          <circle
            cx={cx}
            cy={cy}
            r={baseR}
            fill="none"
            stroke="#ffffff"
            stroke-width={baseThickness + 24}
            stroke-dasharray="553"
            stroke-dashoffset="553"
            class="sweep-mask-circle"
            transform="rotate(-90 {cx} {cy})"
          />
        {/key}
      </mask>
    </defs>

    <!-- PEEKING CAT ON TOP OF THE RING (PRD 19.4) -->
    <g class="peeking-cat-group">
      <!-- Left Ear -->
      <polygon
        points="104,36 94,16 112,28"
        fill="#E89662"
        class="cat-ear-left {earTwitch ? 'twitch-left' : ''}"
      />
      <polygon
        points="103,34 97,20 110,29"
        fill="#F7BFBE"
        class="cat-ear-left {earTwitch ? 'twitch-left' : ''}"
      />

      <!-- Right Ear -->
      <polygon
        points="136,36 146,16 128,28"
        fill="#E89662"
        class="cat-ear-right {earTwitch ? 'twitch-right' : ''}"
      />
      <polygon
        points="137,34 143,20 130,29"
        fill="#F7BFBE"
        class="cat-ear-right {earTwitch ? 'twitch-right' : ''}"
      />

      <!-- Head Base -->
      <ellipse cx="120" cy="36" rx="22" ry="16" fill="#F5AE82" />
      <ellipse cx="120" cy="40" rx="14" ry="9" fill="#FFF8EC" />

      <!-- Cute Nose -->
      <polygon points="120,38 118,36 122,36" fill="#E68B87" />

      <!-- Eyes & Pupils (following selected slice) -->
      <!-- Left Eye -->
      <circle cx="112" cy="33" r="3.2" fill="#FFFFFF" />
      <circle
        cx={112 + catEyeOffset.dx}
        cy={33 + catEyeOffset.dy}
        r="1.8"
        fill="#4A3B32"
        class="cat-pupil"
      />

      <!-- Right Eye -->
      <circle cx="128" cy="33" r="3.2" fill="#FFFFFF" />
      <circle
        cx={128 + catEyeOffset.dx}
        cy={33 + catEyeOffset.dy}
        r="1.8"
        fill="#4A3B32"
        class="cat-pupil"
      />

      <!-- Whiskers -->
      <line x1="106" y1="38" x2="96" y2="37" stroke="#4A3B32" stroke-width="1" stroke-linecap="round" />
      <line x1="106" y1="40" x2="95" y2="42" stroke="#4A3B32" stroke-width="1" stroke-linecap="round" />
      <line x1="134" y1="38" x2="144" y2="37" stroke="#4A3B32" stroke-width="1" stroke-linecap="round" />
      <line x1="134" y1="40" x2="145" y2="42" stroke="#4A3B32" stroke-width="1" stroke-linecap="round" />

      <!-- Paws resting on top of donut ring -->
      <ellipse cx="106" cy="48" rx="6" ry="4" fill="#FFF8EC" stroke="#E59A6A" stroke-width="1.2" />
      <ellipse cx="134" cy="48" rx="6" ry="4" fill="#FFF8EC" stroke="#E59A6A" stroke-width="1.2" />
    </g>

    <!-- DONUT SLICES OR EMPTY RING -->
    {#if slices.length === 0 || totalAmount <= 0}
      <!-- Empty State: dashed gray ring with text (PRD 19.4) -->
      <circle
        cx={cx}
        cy={cy}
        r={baseR}
        fill="none"
        stroke="var(--edge-soft)"
        stroke-width={baseThickness}
        stroke-dasharray="6 6"
        class="empty-donut-ring"
      />
    {:else}
      {#key periodKey}
        <g class="donut-slices-group donut-slices-reveal" mask="url(#donutSweepMask)">
          {#each slices as slice (slice.id)}
            {@const isSelected = selectedSliceId === slice.id}
            {@const hasSelection = selectedSliceId !== null}
            {@const isDimmed = hasSelection && !isSelected}

            {@const rIn = isSelected ? baseR - baseThickness / 2 - 3 : baseR - baseThickness / 2}
            {@const rOut = isSelected ? baseR + baseThickness / 2 + 3 : baseR + baseThickness / 2}
            {@const pathD = makeArcPath(rIn, rOut, slice.startAngle, slice.endAngle)}

            {@const midAngle = (slice.startAngle + slice.endAngle) / 2}
            {@const rad = ((midAngle - 90) * Math.PI) / 180}
            {@const shiftX = isSelected ? Math.cos(rad) * 4 : 0}
            {@const shiftY = isSelected ? Math.sin(rad) * 4 : 0}

            <path
              d={pathD}
              fill={slice.color?.border || slice.borderHex || slice.warnaHex || '#5ED6E6'}
              stroke="rgba(7, 12, 20, 0.95)"
              stroke-width="1.5"
              stroke-linejoin="round"
              role="button"
              tabindex="0"
              aria-label="{slice.label}: {slice.nominal} rupiah ({slice.percent}%)"
              class="donut-slice {isSelected ? 'blossomed' : ''} {isDimmed ? 'dimmed' : ''}"
              style="transform: translate({shiftX}px, {shiftY}px);"
              filter={isSelected ? 'url(#blossomShadow)' : undefined}
              onclick={() => handleSliceClick(slice)}
              onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSliceClick(slice)}
            />
          {/each}
        </g>
      {/key}
    {/if}

    <!-- CENTER HOLE (Interactive touch reset target) -->
    <circle
      cx={cx}
      cy={cy}
      r={baseR - baseThickness / 2 - 4}
      fill="transparent"
      role="button"
      tabindex={selectedSliceId ? 0 : -1}
      aria-label="Kembalikan pilihan donat"
      class="center-hitbox"
      onclick={handleCenterClick}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCenterClick()}
    />

    <!-- CENTER TEXT CONTENT (PRD 19.4) -->
    {#key periodKey}
      <g class="donut-center-text center-text-reveal" pointer-events="none">
        {#if slices.length === 0 || totalAmount <= 0}
          <text
            x={cx}
            y={cy - 10}
            text-anchor="middle"
            class="center-empty-text-1"
          >
            Belum ada
          </text>
          <text
            x={cx}
            y={cy + 10}
            text-anchor="middle"
            class="center-empty-text-2"
          >
            pengeluaran
          </text>
          <text
            x={cx}
            y={cy + 28}
            text-anchor="middle"
            class="center-empty-text-3"
          >
            di periode ini
          </text>
        {:else if selectedSlice}
          <!-- Selected Slice View -->
          <foreignObject x={cx - 14} y={cy - 28} width="28" height="28">
            <div class="center-slice-icon-box">
              <Icon name={selectedSlice.ikon} size={22} />
            </div>
          </foreignObject>
          <text x={cx} y={cy + 10} text-anchor="middle" class="center-slice-name">
            {selectedSlice.nama}
          </text>
          <text x={cx} y={cy + 24} text-anchor="middle" class="center-slice-nominal tabular-nums">
            {formatRp(selectedSlice.nominal)} · {selectedSlice.persen}%
          </text>
        {:else}
          <!-- Default State: Total + Mode Label -->
          <text x={cx} y={cy - 8} text-anchor="middle" class="center-total-amount tabular-nums">
            {formatRp(totalAmount)}
          </text>
          <text x={cx} y={cy + 14} text-anchor="middle" class="center-mode-label">
            {mode === 'rencana' ? 'Rencana' : 'Terpakai'}
          </text>
        {/if}
      </g>
    {/key}
  </svg>
</div>

<style>
  .donut-chart-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .donut-svg {
    width: 100%;
    max-width: 250px;
    height: auto;
    overflow: visible;
  }

  .donut-slice {
    cursor: pointer;
    transition: d 500ms cubic-bezier(0.4, 0, 0.2, 1),
                transform 200ms cubic-bezier(0.16, 1, 0.3, 1),
                opacity 200ms ease-out;
    outline: none;
  }

  .donut-slice:focus-visible {
    stroke: var(--accent);
    stroke-width: 2.5px;
  }

  .donut-slice.dimmed {
    opacity: 0.4;
  }

  .donut-slice.blossomed {
    opacity: 1;
  }

  .empty-donut-ring {
    opacity: 0.7;
  }

  .center-hitbox {
    cursor: pointer;
  }

  /* Cat Eye pupil smooth tracking */
  .cat-pupil {
    transition: cx 200ms ease-out, cy 200ms ease-out;
  }

  /* Cat Ear twitch animations */
  .cat-ear-left {
    transform-origin: 104px 36px;
  }

  .cat-ear-right {
    transform-origin: 136px 36px;
  }

  .twitch-left {
    animation: earTwitchLeft 300ms ease-in-out;
  }

  .twitch-right {
    animation: earTwitchRight 300ms ease-in-out;
  }

  @keyframes earTwitchLeft {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-8deg); }
  }

  @keyframes earTwitchRight {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(8deg); }
  }

  /* Center Typography */
  .center-empty-text-1,
  .center-empty-text-2,
  .center-empty-text-3 {
    font-size: 11px;
    font-family: var(--font-ui);
    font-weight: 500;
    fill: var(--kabut);
  }

  .center-total-amount {
    font-size: 16px;
    font-family: var(--font-display);
    font-weight: 700;
    fill: var(--komorebi);
  }

  .center-mode-label {
    font-size: 12px;
    font-family: var(--font-ui);
    font-weight: 600;
    fill: var(--aether);
  }

  .center-slice-icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--komorebi);
  }

  .center-slice-name {
    font-size: 12px;
    font-family: var(--font-ui);
    font-weight: 700;
    fill: var(--komorebi);
  }

  .center-slice-nominal {
    font-size: 11px;
    font-family: var(--font-display);
    font-weight: 600;
    fill: var(--aether);
  }

  .sweep-mask-circle {
    animation: sweepMaskAnim 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes sweepMaskAnim {
    from {
      stroke-dashoffset: 553;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  .donut-slices-reveal {
    transform-origin: 120px 138px;
    animation: donutSlicesEntrance 0.75s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes donutSlicesEntrance {
    0% {
      transform: scale(0.94) rotate(-6deg);
      opacity: 0.8;
    }
    100% {
      transform: scale(1) rotate(0deg);
      opacity: 1;
    }
  }

  .center-text-reveal {
    transform-origin: 120px 138px;
    animation: centerTextEntrance 0.75s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes centerTextEntrance {
    0% {
      opacity: 0;
      transform: scale(0.88);
    }
    35% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .donut-slice,
    .cat-pupil,
    .sweep-mask-circle,
    .donut-slices-reveal,
    .center-text-reveal {
      animation: none !important;
      transition: none !important;
      transform: none !important;
      opacity: 1 !important;
      stroke-dashoffset: 0 !important;
    }
  }
</style>
