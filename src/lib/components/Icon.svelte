<script>
  let {
    name = '',
    size = 18,
    class: className = '',
    ...rest
  } = $props();

  const ICONS = {
    food: `<path d="M3 11h18c0 4.97-4.03 9-9 9s-9-4.03-9-9z"/><path d="M8 3l1 5"/><path d="M16 3l-1 5"/><line x1="6" y1="20" x2="18" y2="20"/>`,
    phone: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`,
    fuel: `<line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>`,
    gift: `<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>`,
    piggy: `<path d="M19 5c-1.5 0-2.8 1.2-3 2-3.5-1-11 0-11 5 0 2 1 3.5 2 4.5V20h3v-2h6v2h3v-3.5c1.8-1.2 3-3 3-5.5 0-3-1.5-6-3-6z"/><path d="M2 10v3"/><path d="M9 11h.01"/><line x1="12" y1="6" x2="12" y2="8"/>`,
    wallet: `<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>`,
    tag: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`,
    fire: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>`,
    lock: `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
    warning: `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    note: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
    calendar: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
    star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
    mountain: `<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>`,
    leaf: `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`,
    flag: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>`,
    trophy: `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H8v4h8v-4h-1c-.55 0-1-.45-1-1v-2.34"/><path d="M6 4h12a2 2 0 0 1 2 2v3a8 8 0 0 1-16 0V6a2 2 0 0 1 2-2z"/>`,
    paw: `<circle cx="12" cy="16" r="3"/><circle cx="7" cy="11" r="1.8"/><circle cx="17" cy="11" r="1.8"/><circle cx="9" cy="7" r="1.5"/><circle cx="15" cy="7" r="1.5"/>`,
    target: `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
    flying_money: `<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/><path d="M22 6c-2-2-5-2-7 0M2 18c2 2 5 2 7 0"/>`,
    sparkles: `<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>`,
    receipt: `<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>`,
    check: `<polyline points="20 6 9 17 4 12"/>`,
    'chevron-right': `<polyline points="9 18 15 12 9 6"/>`,
    'chevron-down': `<polyline points="6 9 12 15 18 9"/>`,
    close: `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`
  };

  const ALIASES = {
    '🍙': 'food',
    jajan: 'food',
    food: 'food',

    '📱': 'phone',
    pulsa: 'phone',
    phone: 'phone',

    '⛽': 'fuel',
    bensin: 'fuel',
    fuel: 'fuel',

    '🎁': 'gift',
    jajanin: 'gift',
    gift: 'gift',

    '🐷': 'piggy',
    nabung: 'piggy',
    piggy: 'piggy',

    '💰': 'wallet',
    masuk: 'wallet',
    wallet: 'wallet',
    money: 'wallet',

    '🏷️': 'tag',
    '🏷': 'tag',
    lainnya: 'tag',
    tag: 'tag',

    '🔥': 'fire',
    fire: 'fire',
    streak: 'fire',

    '🔒': 'lock',
    lock: 'lock',

    '⚠️': 'warning',
    '⚠': 'warning',
    warning: 'warning',
    alert: 'warning',

    '📝': 'note',
    note: 'note',
    first_tx: 'note',

    '🗓️': 'calendar',
    '🗓': 'calendar',
    calendar: 'calendar',
    week_active: 'calendar',

    '🌟': 'star',
    star: 'star',
    streak_7: 'star',

    '🏔️': 'mountain',
    '🏔': 'mountain',
    mountain: 'mountain',
    streak_30: 'mountain',

    '🍃': 'leaf',
    leaf: 'leaf',
    perfect_week: 'leaf',

    '🏁': 'flag',
    flag: 'flag',
    goal_reached: 'flag',

    '🏆': 'trophy',
    trophy: 'trophy',
    award: 'trophy',

    '🐾': 'paw',
    paw: 'paw',

    '🎯': 'target',
    target: 'target',
    goal: 'target',

    '💸': 'flying_money',
    flying_money: 'flying_money',

    sparkles: 'sparkles',
    ai: 'sparkles',

    receipt: 'receipt',
    scan: 'receipt',

    check: 'check',

    'chevron-right': 'chevron-right',
    'arrow-right': 'chevron-right',

    'chevron-down': 'chevron-down',
    'arrow-down': 'chevron-down',

    close: 'close',
    x: 'close'
  };

  let iconKey = $derived.by(() => {
    if (!name) return null;
    const key = String(name).trim();
    if (ALIASES[key]) return ALIASES[key];
    const stripped = key.replace(/\uFE0F/g, '').toLowerCase();
    if (ALIASES[stripped]) return ALIASES[stripped];
    return null;
  });

  let isFallback = $derived(iconKey === null && !!name && [...String(name).trim()].length <= 2);
</script>

{#if iconKey && ICONS[iconKey]}
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width={size}
    height={size}
    class="neko-icon {className}"
    {...rest}
  >
    {@html ICONS[iconKey]}
  </svg>
{:else if isFallback}
  <span class="neko-icon-fallback {className}" style="font-size: {size}px; line-height: 1;" {...rest}>{name}</span>
{/if}

<style>
  .neko-icon {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
  }
  .neko-icon-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    flex-shrink: 0;
  }
</style>
