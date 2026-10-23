<script>
  /**
   * @typedef {Object} Props
   * @property {number} value - Ratio 0 to 1
   * @property {number} [size] - Diameter in px
   * @property {string} [color]
   */
  let {
    value = 0,
    size = 88,
    color = 'var(--accent)'
  } = $props();

  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = $derived(c * Math.min(Math.max(value, 0), 1));
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 88 88"
  role="img"
  aria-label="{Math.round(value * 100)}% anggaran terpakai"
>
  <circle cx="44" cy="44" r={r} fill="none" stroke="var(--track)" stroke-width="8" />
  <circle
    cx="44"
    cy="44"
    r={r}
    fill="none"
    stroke={color}
    stroke-width="8"
    stroke-linecap="round"
    stroke-dasharray="{dash} {c}"
    transform="rotate(-90 44 44)"
    style="transition: stroke-dasharray 400ms var(--ease)"
  />
  <text
    x="44"
    y="51"
    text-anchor="middle"
    font-family="var(--font-ui)"
    font-size="20"
    font-weight="600"
    fill="var(--fg)"
  >
    {Math.round(value * 100)}%
  </text>
</svg>
