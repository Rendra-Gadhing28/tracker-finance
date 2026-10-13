<script>
  /**
   * @typedef {Object} Props
   * @property {number} [r] - Budget ratio S / A (e.g. 0.74 = 74%)
   * @property {number} [sisa_hari] - Remaining budget for today
   * @property {string} [moodOverride]
   * @property {string} [messageOverride]
   * @property {() => void} [onclick]
   */
  let {
    r = 1,
    sisa_hari = 0,
    moodOverride = undefined,
    messageOverride = undefined,
    onclick = undefined
  } = $props();

  let isPetted = $state(false);
  let petTimeout = null;

  // Determine base mood from ratio r per PRD Section 22.2
  const computedBaseMood = $derived.by(() => {
    if (r > 0.65) return 'santai';
    if (r > 0.35) return 'tenang';
    if (r >= 0.10) return 'cemas';
    if (r >= 0) return 'panik';
    return 'pingsan';
  });

  // Daily adjustment: if sisa_hari < 0 and mood is Santai or Tenang, degrade one level down
  const effectiveMood = $derived.by(() => {
    if (moodOverride) return moodOverride;
    if (isPetted) return 'santai';

    let mood = computedBaseMood;
    if (sisa_hari < 0) {
      if (mood === 'santai') mood = 'tenang';
      else if (mood === 'tenang') mood = 'cemas';
    }
    return mood;
  });

  // Default speech bubble messages per PRD 22.4
  const speechMessage = $derived.by(() => {
    if (messageOverride) return messageOverride;
    if (isPetted) return 'Mrrr~ Nyaman dielus, nyan! ♪';

    switch (effectiveMood) {
      case 'santai':
        return 'Dompetmu masih gemuk, nyan!';
      case 'tenang':
        return 'Masih aman, tapi aku mengawasi.';
      case 'cemas':
        return 'Eh, sisanya mulai tipis...';
      case 'panik':
        return 'Nyaaa! Hampir habis!';
      case 'pingsan':
        return 'Budget minggu ini jebol... x_x';
      default:
        return 'Halo, nyan!';
    }
  });

  function handlePet() {
    isPetted = true;
    if (petTimeout) clearTimeout(petTimeout);
    petTimeout = setTimeout(() => {
      isPetted = false;
    }, 2000);
    onclick?.();
  }
</script>

<div
  class="cat-world-container {effectiveMood} {isPetted ? 'is-petted' : ''}"
  onclick={handlePet}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === 'Enter' && handlePet()}
  aria-label="Kucing Neko Dompet. Mood: {effectiveMood}. Ketuk untuk mengelus."
>
  <!-- Atmospheric clouds & sun glow -->
  <div class="sky-elements" aria-hidden="true">
    <div class="cloud cloud-1"></div>
    <div class="cloud cloud-2"></div>
  </div>

  <!-- Speech bubble -->
  <div class="speech-bubble" role="status">
    <span class="speech-text">{speechMessage}</span>
    <div class="bubble-pointer" aria-hidden="true"></div>
  </div>

  <!-- Ghibli-inspired Hills & Cat SVG -->
  <svg
    class="world-svg"
    viewBox="0 0 360 170"
    preserveAspectRatio="xMidYMax slice"
    aria-hidden="true"
  >
    <defs>
      <!-- Background Hill Gradient -->
      <linearGradient id="hillBackGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#A2CD8E" />
        <stop offset="100%" stop-color="#91BE7D" />
      </linearGradient>

      <!-- Foreground Hill Gradient -->
      <linearGradient id="hillFrontGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#BEE0AA" />
        <stop offset="100%" stop-color="#ACD695" />
      </linearGradient>

      <!-- Cat Ginger Gradient -->
      <linearGradient id="catCoatGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#F5AE82" />
        <stop offset="100%" stop-color="#E89662" />
      </linearGradient>
    </defs>

    <!-- Background distant hill -->
    <path
      d="M -20 170 Q 70 85 190 120 Q 280 145 380 115 L 380 170 Z"
      fill="url(#hillBackGrad)"
    />

    <!-- Little distant bush / trees -->
    <ellipse cx="60" cy="112" rx="14" ry="10" fill="#7FA96C" />
    <ellipse cx="78" cy="116" rx="11" ry="8" fill="#759F63" />
    <ellipse cx="295" cy="132" rx="15" ry="9" fill="#88B474" />

    <!-- Foreground main hill -->
    <path
      d="M -20 170 Q 110 115 180 116 Q 260 117 380 170 Z"
      fill="url(#hillFrontGrad)"
    />

    <!-- Decorative small grass blades -->
    <path d="M 45 150 Q 48 140 43 134 Q 50 142 53 150" fill="#7FA96C" />
    <path d="M 52 152 Q 56 141 53 136 Q 58 144 60 152" fill="#7FA96C" />
    <path d="M 310 155 Q 315 144 311 138 Q 318 145 320 155" fill="#7FA96C" />

    <!-- CAT GROUP -->
    <g class="cat-group" transform="translate(180, 142)">
      <!-- Cat Tail -->
      <g class="cat-tail {effectiveMood}">
        <path
          d="M 28 -8 C 42 -12 52 -28 46 -42 C 43 -49 34 -47 36 -39 C 39 -29 32 -18 20 -10 Z"
          fill="#E89662"
        />
      </g>

      <!-- Cat Body -->
      <ellipse cx="0" cy="-22" rx="36" ry="26" fill="url(#catCoatGrad)" />

      <!-- Cat Cream Chest & Belly -->
      <ellipse cx="0" cy="-18" rx="22" ry="18" fill="#FFF8EC" />

      <!-- Cat Paws -->
      <ellipse cx="-16" cy="-2" rx="9" ry="6" fill="#FFF8EC" stroke="#E59A6A" stroke-width="1.5" />
      <ellipse cx="16" cy="-2" rx="9" ry="6" fill="#FFF8EC" stroke="#E59A6A" stroke-width="1.5" />

      <!-- Cat Head -->
      <g class="cat-head">
        <!-- Ears -->
        <!-- Left Ear -->
        <polygon points="-26,-46 -12,-72 0,-48" fill="#E89662" />
        <polygon points="-22,-48 -12,-66 -3,-50" fill="#F7BFBE" />

        <!-- Right Ear -->
        <polygon points="0,-48 12,-72 26,-46" fill="#E89662" />
        <polygon points="3,-50 12,-66 22,-48" fill="#F7BFBE" />

        <!-- Head Base -->
        <ellipse cx="0" cy="-42" rx="30" ry="24" fill="url(#catCoatGrad)" />

        <!-- Cheeks / Muzzle cream -->
        <ellipse cx="0" cy="-35" rx="18" ry="12" fill="#FFF8EC" />

        <!-- Forehead Stripes -->
        <path d="M -6 -56 L -4 -48" stroke="#D98555" stroke-width="2.5" stroke-linecap="round" />
        <path d="M 0 -58 L 0 -48" stroke="#D98555" stroke-width="2.5" stroke-linecap="round" />
        <path d="M 6 -56 L 4 -48" stroke="#D98555" stroke-width="2.5" stroke-linecap="round" />

        <!-- Whiskers -->
        <!-- Left -->
        <path d="M -16 -36 L -32 -38" stroke="#4A3B32" stroke-width="1.2" stroke-linecap="round" />
        <path d="M -16 -33 L -33 -32" stroke="#4A3B32" stroke-width="1.2" stroke-linecap="round" />
        <!-- Right -->
        <path d="M 16 -36 L 32 -38" stroke="#4A3B32" stroke-width="1.2" stroke-linecap="round" />
        <path d="M 16 -33 L 33 -32" stroke="#4A3B32" stroke-width="1.2" stroke-linecap="round" />

        <!-- Nose -->
        <polygon points="0,-37 -3.5,-41 3.5,-41" fill="#E68B87" />

        <!-- EYES & BROWS by Mood -->
        {#if effectiveMood === 'santai'}
          <!-- Santai: Sparkly round eyes + happy brows -->
          <circle cx="-11" cy="-43" r="4.5" fill="#4A3B32" class="cat-eye" />
          <circle cx="-9.5" cy="-44.5" r="1.8" fill="#FFFFFF" />
          <circle cx="-12" cy="-41.5" r="0.8" fill="#FFFFFF" />

          <circle cx="11" cy="-43" r="4.5" fill="#4A3B32" class="cat-eye" />
          <circle cx="12.5" cy="-44.5" r="1.8" fill="#FFFFFF" />
          <circle cx="10" cy="-41.5" r="0.8" fill="#FFFFFF" />

          <!-- Blush -->
          <ellipse cx="-19" cy="-37" rx="4" ry="2" fill="#F4B4B4" opacity="0.6" />
          <ellipse cx="19" cy="-37" rx="4" ry="2" fill="#F4B4B4" opacity="0.6" />

          <!-- Wide happy smile -->
          <path d="M -7 -34 Q 0 -28 7 -34" fill="none" stroke="#4A3B32" stroke-width="1.8" stroke-linecap="round" />

        {:else if effectiveMood === 'tenang'}
          <!-- Tenang: Calm cute eyes + gentle smile -->
          <circle cx="-11" cy="-42" r="4" fill="#4A3B32" class="cat-eye" />
          <circle cx="-9.8" cy="-43.2" r="1.5" fill="#FFFFFF" />

          <circle cx="11" cy="-42" r="4" fill="#4A3B32" class="cat-eye" />
          <circle cx="12.2" cy="-43.2" r="1.5" fill="#FFFFFF" />

          <!-- Gentle smile -->
          <path d="M -5 -35 Q 0 -31 5 -35" fill="none" stroke="#4A3B32" stroke-width="1.6" stroke-linecap="round" />

        {:else if effectiveMood === 'cemas'}
          <!-- Cemas: Slanted eyebrows + wavy mouth + 1 sweat drop -->
          <path d="M -15 -49 L -7 -47" stroke="#4A3B32" stroke-width="1.8" stroke-linecap="round" />
          <path d="M 15 -49 L 7 -47" stroke="#4A3B32" stroke-width="1.8" stroke-linecap="round" />

          <ellipse cx="-11" cy="-41" rx="4" ry="4.5" fill="#4A3B32" />
          <circle cx="-10" cy="-42" r="1.4" fill="#FFFFFF" />

          <ellipse cx="11" cy="-41" rx="4" ry="4.5" fill="#4A3B32" />
          <circle cx="12" cy="-42" r="1.4" fill="#FFFFFF" />

          <!-- Wavy mouth -->
          <path d="M -6 -34 Q -3 -37 0 -34 Q 3 -31 6 -34" fill="none" stroke="#4A3B32" stroke-width="1.6" stroke-linecap="round" />

          <!-- 1 sweat drop on left side -->
          <path d="M -24 -52 C -24 -56 -21 -59 -21 -59 C -21 -59 -18 -56 -18 -52 C -18 -49 -20 -48 -21 -48 C -22 -48 -24 -49 -24 -52 Z" fill="#88CBEA" />

        {:else if effectiveMood === 'panik'}
          <!-- Panik: Wide open eyes + open mouth + 2 sweat drops -->
          <ellipse cx="-11" cy="-41" rx="5.5" ry="5.5" fill="#4A3B32" />
          <circle cx="-10" cy="-43" r="1.2" fill="#FFFFFF" />

          <ellipse cx="11" cy="-41" rx="5.5" ry="5.5" fill="#4A3B32" />
          <circle cx="12" cy="-43" r="1.2" fill="#FFFFFF" />

          <!-- Open trembling mouth -->
          <ellipse cx="0" cy="-33" rx="4" ry="5" fill="#4A3B32" />
          <ellipse cx="0" cy="-32" rx="2.5" ry="3" fill="#D9776B" />

          <!-- 2 sweat drops -->
          <path d="M -24 -53 C -24 -57 -21 -60 -21 -60 C -21 -60 -18 -57 -18 -53 C -18 -50 -20 -49 -21 -49 C -22 -49 -24 -50 -24 -53 Z" fill="#88CBEA" />
          <path d="M 24 -51 C 24 -55 21 -58 21 -58 C 21 -58 18 -55 18 -51 C 18 -48 20 -47 21 -47 C 22 -47 24 -48 24 -51 Z" fill="#88CBEA" />

        {:else}
          <!-- Pingsan: 'X X' eyes + flat line mouth -->
          <!-- Left X -->
          <line x1="-15" y1="-45" x2="-7" y2="-37" stroke="#4A3B32" stroke-width="2.2" stroke-linecap="round" />
          <line x1="-7" y1="-45" x2="-15" y2="-37" stroke="#4A3B32" stroke-width="2.2" stroke-linecap="round" />

          <!-- Right X -->
          <line x1="7" y1="-45" x2="15" y2="-37" stroke="#4A3B32" stroke-width="2.2" stroke-linecap="round" />
          <line x1="15" y1="-45" x2="7" y2="-37" stroke="#4A3B32" stroke-width="2.2" stroke-linecap="round" />

          <!-- Flat line mouth -->
          <line x1="-6" y1="-34" x2="6" y2="-34" stroke="#4A3B32" stroke-width="1.8" stroke-linecap="round" />
        {/if}
      </g>
    </g>
  </svg>
</div>

<style>
  .cat-world-container {
    position: relative;
    width: 100%;
    height: 170px;
    border-radius: var(--radius-card, 22px);
    overflow: hidden;
    background: linear-gradient(180deg, #BFE0E6 0%, #D8ECF0 55%, #EAF4E4 100%);
    border: 2px solid var(--line);
    border-bottom: var(--border-card-bottom, 5px) solid #91BE7D;
    box-sizing: border-box;
    cursor: pointer;
    touch-action: manipulation;
    transition: background 300ms ease-out;
  }

  /* Panik & Pingsan overcast/gloom */
  .cat-world-container.panik,
  .cat-world-container.pingsan {
    background: linear-gradient(180deg, #CAD7DC 0%, #D8DFDE 60%, #E3E8DC 100%);
    border-bottom-color: #889980;
  }

  /* Soft decorative clouds */
  .sky-elements {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .cloud {
    position: absolute;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 999px;
  }

  .cloud-1 {
    top: 18px;
    right: 28px;
    width: 58px;
    height: 18px;
    animation: cloudDrift 28s ease-in-out infinite alternate;
  }

  .cloud-2 {
    top: 42px;
    left: 20px;
    width: 44px;
    height: 14px;
    opacity: 0.55;
    animation: cloudDrift 36s ease-in-out infinite alternate-reverse;
  }

  /* Speech bubble at top left */
  .speech-bubble {
    position: absolute;
    top: 12px;
    left: 14px;
    max-width: 210px;
    background-color: var(--card);
    border: 1.5px solid var(--line);
    border-bottom: 3px solid #D6C8B2;
    border-radius: 14px;
    padding: 7px 11px;
    z-index: 5;
    pointer-events: none;
    box-shadow: 0 3px 8px rgba(74, 59, 50, 0.08);
  }

  .speech-text {
    font-size: 12px;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.3;
    display: block;
  }

  .bubble-pointer {
    position: absolute;
    bottom: -6px;
    left: 24px;
    width: 10px;
    height: 6px;
    background-color: var(--card);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
  }

  .world-svg {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  /* Cat tail animation */
  .cat-tail {
    transform-origin: 20px -8px;
    animation: tailWag 3.2s ease-in-out infinite;
  }

  .cat-tail.cemas {
    animation: tailWagFast 1.2s ease-in-out infinite;
  }

  .cat-tail.panik {
    animation: tailWagFast 0.8s ease-in-out infinite;
  }

  .cat-tail.pingsan {
    animation: none;
    transform: rotate(25deg);
  }

  /* Cat shiver in panik */
  .cat-world-container.panik .cat-group {
    animation: catShiver 0.2s linear infinite;
  }

  /* Cat bounce when petted */
  .cat-world-container.is-petted .cat-group {
    animation: catPetBounce 0.5s ease-out 2;
  }

  /* Blink animation */
  .cat-eye {
    animation: catBlink 5.5s infinite;
    transform-origin: center;
  }

  @keyframes tailWag {
    0%, 100% {
      transform: rotate(0deg);
    }
    50% {
      transform: rotate(-14deg);
    }
  }

  @keyframes tailWagFast {
    0%, 100% {
      transform: rotate(4deg);
    }
    50% {
      transform: rotate(-18deg);
    }
  }

  @keyframes catBlink {
    0%, 96%, 100% {
      transform: scaleY(1);
    }
    98% {
      transform: scaleY(0.1);
    }
  }

  @keyframes catShiver {
    0%, 100% {
      transform: translate(180px, 142px);
    }
    50% {
      transform: translate(181px, 141.5px);
    }
  }

  @keyframes catPetBounce {
    0%, 100% {
      transform: translate(180px, 142px);
    }
    50% {
      transform: translate(180px, 134px);
    }
  }

  @keyframes cloudDrift {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(12px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cloud-1,
    .cloud-2,
    .cat-tail,
    .cat-eye,
    .cat-group {
      animation: none !important;
    }
  }
</style>
