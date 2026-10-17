<script>
  import { onMount, onDestroy } from 'svelte';
  import { getTimePhase } from '../gamification.js';

  /**
   * @typedef {Object} Props
   * @property {number} [r] - Budget ratio S / A
   * @property {number} [sisa_hari] - Today's remaining balance
   * @property {number} [streak] - Current streak count
   * @property {string} [moodOverride]
   * @property {string} [messageOverride]
   * @property {() => void} [onclick]
   * @property {(fn: (actionType: string, detail?: any) => void) => void} [onregister]
   */
  let {
    r = 1,
    sisa_hari = 0,
    streak = 0,
    moodOverride = undefined,
    messageOverride = undefined,
    onclick = undefined,
    onregister = undefined
  } = $props();

  // Current time phase state
  let now = $state(new Date());
  let timePhase = $derived(getTimePhase(now));

  // Active temporary reaction state
  let activeReaction = $state(null);
  let reactionDetail = $state({});
  let reactionTimer = null;

  // Sleeping state for night phase (after 20s inactive)
  let isSleeping = $state(false);
  let sleepTimer = null;

  // Non-repeating speech tracker
  let lastSpeech = '';

  // 1. Determine Base Mood from ratio r (PRD 22.2)
  const computedBaseMood = $derived.by(() => {
    if (r > 0.65) return 'santai';
    if (r > 0.35) return 'tenang';
    if (r >= 0.10) return 'cemas';
    if (r >= 0) return 'panik';
    return 'pingsan';
  });

  // Daily adjustment (PRD 22.2): if sisa_hari < 0, degrade 1 level down
  const baseMoodWithDailyAdj = $derived.by(() => {
    let mood = computedBaseMood;
    if (sisa_hari < 0) {
      if (mood === 'santai') mood = 'tenang';
      else if (mood === 'tenang') mood = 'cemas';
    }
    return mood;
  });

  // Effective mood: reaction overrides base mood
  const effectiveMood = $derived.by(() => {
    if (moodOverride) return moodOverride;
    if (activeReaction) {
      if (activeReaction === 'keluar_makan') return 'santai';
      if (activeReaction === 'tabung') return 'santai';
      if (activeReaction === 'masuk') return 'santai';
      if (activeReaction === 'over_limit') return 'panik';
      if (activeReaction === 'undo') return 'tenang';
      if (activeReaction === 'pet') return 'santai';
      if (activeReaction === 'streak_milestone' || activeReaction === 'badge') return 'santai';
      if (activeReaction === 'tanpa_jajan') return 'santai';
    }
    if (isSleeping) return 'santai';
    return baseMoodWithDailyAdj;
  });

  // Bonus creatures count (PRD 24.3): 3 if santai (6 if streak >= 3), 0 otherwise
  const creatureCount = $derived.by(() => {
    if (effectiveMood !== 'santai') return 0;
    return streak >= 3 ? 6 : 3;
  });

  // Speech bubble generator with non-repeating rule (PRD 22.4)
  const speechMessage = $derived.by(() => {
    if (messageOverride) return messageOverride;

    const speechPools = {
      santai: [
        'Dompetmu masih gemuk, nyaman banget.',
        'Mrrr, hari yang tenang.',
        'Hemat itu keren, nyan!'
      ],
      tenang: [
        'Masih aman, tapi aku mengawasi.',
        'Pelan-pelan ya jajannya.',
        'Hari yang damai, nyan.'
      ],
      cemas: [
        'Eh, sisanya mulai tipis...',
        'Aku mulai deg-degan, nyan.',
        'Hati-hati ya pengeluarannya.'
      ],
      panik: [
        'Nyaaa! Hampir habis!',
        'Tolong, dompetnya kurus!',
        'Gawat, nyan!'
      ],
      pingsan: [
        'Budget minggu ini jebol... x_x',
        'Pingsan dulu ya... x_x'
      ],
      keluar_makan: [
        'Nyam nyam... enak?',
        'Kenyang, nyan!'
      ],
      tabung: [
        'Ditabung! Celengan makin berat.',
        'Koin masuk celengan! ♪'
      ],
      masuk: [
        'Uang jajan datang! Selamat minggu baru.',
        'Horee, dompet terisi lagi!'
      ],
      over_limit: [
        'Waaah, melebihi batas!',
        'Telingaku kaget, nyan!'
      ],
      undo: [
        'Eh, dibatalkan ya? Meong?',
        'Catatan ditarik kembali.'
      ],
      pet: [
        'Mrrr~ Nyaman dielus, nyan! ♪',
        'Purrr... dielus enak!'
      ],
      tanpa_jajan: [
        'Hebat, hari ini tidak jajan! 🌙',
        'Hari hemat tercatat! Keren, nyan!'
      ],
      sleep: [
        'zZ... zZ...',
        'Kucing tidur pulas...'
      ],
      badge: [
        'Waaah, dapat lencana baru! ✨',
        'Bangga banget, nyan!'
      ]
    };

    let pool = speechPools[activeReaction] || (isSleeping ? speechPools.sleep : speechPools[effectiveMood]) || ['Halo, nyan!'];
    const candidates = pool.filter((msg) => msg !== lastSpeech);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
    lastSpeech = chosen;
    return chosen;
  });

  function resetSleepTimer() {
    isSleeping = false;
    if (sleepTimer) clearTimeout(sleepTimer);
    if (timePhase.phase === 'malam') {
      sleepTimer = setTimeout(() => {
        isSleeping = true;
      }, 20000); // 20s inactive at night per PRD 22.3
    }
  }

  export function triggerReaction(actionType, detail = {}) {
    if (actionType === 'night_sleep') {
      isSleeping = true;
      return;
    }
    resetSleepTimer();
    activeReaction = actionType;
    reactionDetail = detail;

    if (reactionTimer) clearTimeout(reactionTimer);

    let duration = 1500;
    if (actionType === 'keluar_lain') duration = 1200;
    else if (actionType === 'undo') duration = 1000;
    else if (actionType === 'over_limit') duration = 1200;
    else if (actionType === 'streak_milestone' || actionType === 'badge') duration = 2000;

    reactionTimer = setTimeout(() => {
      activeReaction = null;
      reactionDetail = {};
    }, duration);
  }

  function handleInteraction() {
    isSleeping = false;
    resetSleepTimer();
    triggerReaction('pet');
    onclick?.();
  }

  let clockInterval = null;
  onMount(() => {
    onregister?.(triggerReaction);
    resetSleepTimer();
    clockInterval = setInterval(() => {
      now = new Date();
      if (!isSleeping && timePhase.phase === 'malam' && !sleepTimer) {
        resetSleepTimer();
      }
    }, 60000);
  });

  onDestroy(() => {
    if (clockInterval) clearInterval(clockInterval);
    if (sleepTimer) clearTimeout(sleepTimer);
    if (reactionTimer) clearTimeout(reactionTimer);
  });
</script>

<div
  class="cat-world-container phase-{timePhase.phase} {effectiveMood} {activeReaction ? `reaction-${activeReaction}` : ''} {isSleeping ? 'is-sleeping' : ''}"
  style="
    --sky-top: {timePhase.skyTop};
    --sky-bottom: {timePhase.skyBottom};
    --grass-color: {timePhase.grass};
  "
  onclick={handleInteraction}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleInteraction()}
  role="button"
  tabindex="0"
  aria-label="Kucing Neko Dompet. Mood: {effectiveMood}. Ketuk untuk berinteraksi."
>
  <!-- Overcast layer for Panik & Pingsan (PRD 24.3) -->
  {#if effectiveMood === 'panik' || effectiveMood === 'pingsan'}
    <div class="overcast-layer" aria-hidden="true"></div>
  {/if}

  <!-- Celestial Bodies: Sun / Moon & Stars -->
  <div class="celestial-layer" aria-hidden="true">
    {#if timePhase.phase === 'pagi'}
      <div class="morning-sun"></div>
    {:else if timePhase.phase === 'senja'}
      <div class="sunset-sun"></div>
    {:else if timePhase.phase === 'malam'}
      <div class="night-moon"></div>
      <div class="star star-1">★</div>
      <div class="star star-2">✦</div>
      <div class="star star-3">★</div>
      <div class="star star-4">✦</div>
    {/if}
  </div>

  <!-- Soft Clouds -->
  <div class="sky-elements" aria-hidden="true">
    <div class="cloud cloud-1"></div>
    <div class="cloud cloud-2"></div>
  </div>

  <!-- Bonus Creatures (PRD 24.3) -->
  {#if creatureCount > 0}
    <div class="creatures-layer" aria-hidden="true">
      {#each Array(creatureCount) as _, i}
        <span
          class="creature-item creature-{timePhase.creatures} index-{i}"
          style="--creature-idx: {i};"
        >
          {#if timePhase.creatures === 'birds' || timePhase.creatures === 'birds_return'}
            <svg class="bird-svg" viewBox="0 0 16 10">
              <path d="M 0 6 Q 4 0 8 5 Q 12 0 16 6" fill="none" stroke="#5A4E46" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          {:else if timePhase.creatures === 'butterflies'}
            🦋
          {:else if timePhase.creatures === 'fireflies'}
            <span class="firefly-glow"></span>
          {/if}
        </span>
      {/each}
    </div>
  {/if}

  <!-- Temporary Reaction Particles Overlay (PRD 22.3) -->
  {#if activeReaction}
    <div class="particles-layer" aria-hidden="true">
      {#if activeReaction === 'keluar_makan'}
        <span class="particle p1">🍙</span>
        <span class="particle p2">🍙</span>
        <span class="particle p3">🍙</span>
        <span class="particle p4">🍙</span>
      {:else if activeReaction === 'keluar_lain'}
        <span class="particle p1">{reactionDetail?.icon || '💸'}</span>
        <span class="particle p2">{reactionDetail?.icon || '💸'}</span>
        <span class="particle p3">{reactionDetail?.icon || '💸'}</span>
      {:else if activeReaction === 'tabung'}
        <span class="particle p1">💖</span>
        <span class="particle p2">💖</span>
        <span class="particle p3">💖</span>
        <span class="particle p4">💖</span>
        <span class="particle p5">💖</span>
      {:else if activeReaction === 'masuk'}
        <span class="particle rain r1">🪙</span>
        <span class="particle rain r2">🪙</span>
        <span class="particle rain r3">🪙</span>
        <span class="particle rain r4">🪙</span>
        <span class="particle rain r5">🪙</span>
        <span class="particle rain r6">🪙</span>
      {:else if activeReaction === 'pet'}
        <span class="particle p1">♪</span>
        <span class="particle p2">♫</span>
        <span class="particle p3">♪</span>
      {:else if activeReaction === 'undo'}
        <span class="particle p-center">❓</span>
      {:else if activeReaction === 'streak_milestone' || activeReaction === 'badge'}
        <span class="particle p1">✨</span>
        <span class="particle p2">🌟</span>
        <span class="particle p3">✨</span>
      {:else if activeReaction === 'tanpa_jajan'}
        <span class="particle p1">🌙</span>
        <span class="particle p2">✨</span>
        <span class="particle p3">🌙</span>
      {/if}
    </div>
  {/if}

  <!-- Sleep Zz Floating -->
  {#if isSleeping}
    <div class="sleep-zz-layer" aria-hidden="true">
      <span class="zz zz1">z</span>
      <span class="zz zz2">Z</span>
      <span class="zz zz3">zZ</span>
    </div>
  {/if}

  <!-- Speech bubble -->
  <div class="speech-bubble" role="status" aria-live="polite">
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
      <linearGradient id="hillBackGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color={timePhase.grass} stop-opacity="0.9" />
        <stop offset="100%" stop-color={timePhase.grass} stop-opacity="0.75" />
      </linearGradient>

      <linearGradient id="hillFrontGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color={timePhase.grass} stop-opacity="1" />
        <stop offset="100%" stop-color={timePhase.grass} stop-opacity="0.88" />
      </linearGradient>

      <linearGradient id="catCoatGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#F5AE82" />
        <stop offset="100%" stop-color="#E89662" />
      </linearGradient>
    </defs>

    <!-- Background Distant Hill -->
    <path
      d="M -20 170 Q 70 85 190 120 Q 280 145 380 115 L 380 170 Z"
      fill="url(#hillBackGrad)"
    />

    <!-- Foreground Main Hill -->
    <path
      d="M -20 170 Q 110 115 180 116 Q 260 117 380 170 Z"
      fill="url(#hillFrontGrad)"
    />

    <!-- Swaying Grass Blades (PRD 24.3) -->
    <g class="swaying-grass-group">
      <path d="M 45 150 Q 48 140 43 134 Q 50 142 53 150" fill={timePhase.grass} filter="brightness(0.85)" />
      <path d="M 52 152 Q 56 141 53 136 Q 58 144 60 152" fill={timePhase.grass} filter="brightness(0.85)" />
      <path d="M 310 155 Q 315 144 311 138 Q 318 145 320 155" fill={timePhase.grass} filter="brightness(0.85)" />
    </g>

    <!-- CAT GROUP -->
    <g class="cat-group {activeReaction ? `anim-${activeReaction}` : ''}" transform="translate(180, 142)">
      <!-- Cat Tail -->
      <g class="cat-tail {effectiveMood} {isSleeping ? 'sleep-tail' : ''}">
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
      <g class="cat-head {activeReaction === 'undo' ? 'head-tilt' : ''}">
        <!-- Ears -->
        {#if activeReaction === 'over_limit'}
          <!-- Shocked drooping ears -->
          <polygon points="-26,-40 -18,-54 0,-42" fill="#E89662" />
          <polygon points="-22,-41 -17,-50 -3,-44" fill="#F7BFBE" />
          <polygon points="0,-42 18,-54 26,-40" fill="#E89662" />
          <polygon points="3,-44 17,-50 22,-41" fill="#F7BFBE" />
        {:else}
          <!-- Normal perky ears -->
          <polygon points="-26,-46 -12,-72 0,-48" fill="#E89662" />
          <polygon points="-22,-48 -12,-66 -3,-50" fill="#F7BFBE" />
          <polygon points="0,-48 12,-72 26,-46" fill="#E89662" />
          <polygon points="3,-50 12,-66 22,-48" fill="#F7BFBE" />
        {/if}

        <!-- Head Base -->
        <ellipse cx="0" cy="-42" rx="30" ry="24" fill="url(#catCoatGrad)" />
        <ellipse cx="0" cy="-35" rx="18" ry="12" fill="#FFF8EC" />

        <!-- Forehead Stripes -->
        <path d="M -6 -56 L -4 -48" stroke="#D98555" stroke-width="2.5" stroke-linecap="round" />
        <path d="M 0 -58 L 0 -48" stroke="#D98555" stroke-width="2.5" stroke-linecap="round" />
        <path d="M 6 -56 L 4 -48" stroke="#D98555" stroke-width="2.5" stroke-linecap="round" />

        <!-- Whiskers -->
        <path d="M -16 -36 L -32 -38" stroke="#4A3B32" stroke-width="1.2" stroke-linecap="round" />
        <path d="M -16 -33 L -33 -32" stroke="#4A3B32" stroke-width="1.2" stroke-linecap="round" />
        <path d="M 16 -36 L 32 -38" stroke="#4A3B32" stroke-width="1.2" stroke-linecap="round" />
        <path d="M 16 -33 L 33 -32" stroke="#4A3B32" stroke-width="1.2" stroke-linecap="round" />

        <!-- Nose -->
        <polygon points="0,-37 -3.5,-41 3.5,-41" fill="#E68B87" />

        <!-- EYES & MOUTH based on reaction or mood -->
        {#if isSleeping}
          <!-- Sleeping eyes: curved shut ^ ^ -->
          <path d="M -15 -42 Q -11 -46 -7 -42" fill="none" stroke="#4A3B32" stroke-width="2" stroke-linecap="round" />
          <path d="M 7 -42 Q 11 -46 15 -42" fill="none" stroke="#4A3B32" stroke-width="2" stroke-linecap="round" />
          <path d="M -4 -35 Q 0 -33 4 -35" fill="none" stroke="#4A3B32" stroke-width="1.5" stroke-linecap="round" />

        {:else if activeReaction === 'masuk'}
          <!-- Starry sparkling eyes -->
          <text x="-16" y="-38" font-size="11" fill="#E59A6A">✨</text>
          <text x="6" y="-38" font-size="11" fill="#E59A6A">✨</text>
          <path d="M -7 -34 Q 0 -26 7 -34" fill="none" stroke="#4A3B32" stroke-width="2" stroke-linecap="round" />

        {:else if activeReaction === 'tabung' || activeReaction === 'pet'}
          <!-- Happy purr eyes ^ ^ -->
          <path d="M -15 -42 Q -11 -47 -7 -42" fill="none" stroke="#4A3B32" stroke-width="2" stroke-linecap="round" />
          <path d="M 7 -42 Q 11 -47 15 -42" fill="none" stroke="#4A3B32" stroke-width="2" stroke-linecap="round" />
          <ellipse cx="-19" cy="-37" rx="4" ry="2" fill="#F4B4B4" opacity="0.6" />
          <ellipse cx="19" cy="-37" rx="4" ry="2" fill="#F4B4B4" opacity="0.6" />
          <path d="M -6 -34 Q 0 -29 6 -34" fill="none" stroke="#4A3B32" stroke-width="1.8" stroke-linecap="round" />

        {:else if activeReaction === 'keluar_makan'}
          <!-- Chewing mouth -->
          <circle cx="-11" cy="-43" r="4.5" fill="#4A3B32" />
          <circle cx="-9.5" cy="-44.5" r="1.8" fill="#FFFFFF" />
          <circle cx="11" cy="-43" r="4.5" fill="#4A3B32" />
          <circle cx="12.5" cy="-44.5" r="1.8" fill="#FFFFFF" />
          <!-- Chewing oval mouth -->
          <ellipse cx="0" cy="-33" rx="5" ry="3.5" fill="#4A3B32" class="chewing-mouth" />

        {:else if activeReaction === 'keluar_lain'}
          <!-- Small smile -->
          <circle cx="-11" cy="-42" r="4" fill="#4A3B32" class="cat-eye" />
          <circle cx="-9.8" cy="-43.2" r="1.5" fill="#FFFFFF" />
          <circle cx="11" cy="-42" r="4" fill="#4A3B32" class="cat-eye" />
          <circle cx="12.2" cy="-43.2" r="1.5" fill="#FFFFFF" />
          <path d="M -5 -35 Q 0 -31 5 -35" fill="none" stroke="#4A3B32" stroke-width="1.6" stroke-linecap="round" />

        {:else if effectiveMood === 'santai'}
          <circle cx="-11" cy="-43" r="4.5" fill="#4A3B32" class="cat-eye" />
          <circle cx="-9.5" cy="-44.5" r="1.8" fill="#FFFFFF" />
          <circle cx="-12" cy="-41.5" r="0.8" fill="#FFFFFF" />
          <circle cx="11" cy="-43" r="4.5" fill="#4A3B32" class="cat-eye" />
          <circle cx="12.5" cy="-44.5" r="1.8" fill="#FFFFFF" />
          <circle cx="10" cy="-41.5" r="0.8" fill="#FFFFFF" />
          <ellipse cx="-19" cy="-37" rx="4" ry="2" fill="#F4B4B4" opacity="0.6" />
          <ellipse cx="19" cy="-37" rx="4" ry="2" fill="#F4B4B4" opacity="0.6" />
          <path d="M -7 -34 Q 0 -28 7 -34" fill="none" stroke="#4A3B32" stroke-width="1.8" stroke-linecap="round" />

        {:else if effectiveMood === 'tenang'}
          <circle cx="-11" cy="-42" r="4" fill="#4A3B32" class="cat-eye" />
          <circle cx="-9.8" cy="-43.2" r="1.5" fill="#FFFFFF" />
          <circle cx="11" cy="-42" r="4" fill="#4A3B32" class="cat-eye" />
          <circle cx="12.2" cy="-43.2" r="1.5" fill="#FFFFFF" />
          <path d="M -5 -35 Q 0 -31 5 -35" fill="none" stroke="#4A3B32" stroke-width="1.6" stroke-linecap="round" />

        {:else if effectiveMood === 'cemas'}
          <path d="M -15 -49 L -7 -47" stroke="#4A3B32" stroke-width="1.8" stroke-linecap="round" />
          <path d="M 15 -49 L 7 -47" stroke="#4A3B32" stroke-width="1.8" stroke-linecap="round" />
          <ellipse cx="-11" cy="-41" rx="4" ry="4.5" fill="#4A3B32" />
          <circle cx="-10" cy="-42" r="1.4" fill="#FFFFFF" />
          <ellipse cx="11" cy="-41" rx="4" ry="4.5" fill="#4A3B32" />
          <circle cx="12" cy="-42" r="1.4" fill="#FFFFFF" />
          <path d="M -6 -34 Q -3 -37 0 -34 Q 3 -31 6 -34" fill="none" stroke="#4A3B32" stroke-width="1.6" stroke-linecap="round" />
          <path d="M -24 -52 C -24 -56 -21 -59 -21 -59 C -21 -59 -18 -56 -18 -52 C -18 -49 -20 -48 -21 -48 C -22 -48 -24 -49 -24 -52 Z" fill="#88CBEA" />

        {:else if effectiveMood === 'panik'}
          <ellipse cx="-11" cy="-41" rx="5.5" ry="5.5" fill="#4A3B32" />
          <circle cx="-10" cy="-43" r="1.2" fill="#FFFFFF" />
          <ellipse cx="11" cy="-41" rx="5.5" ry="5.5" fill="#4A3B32" />
          <circle cx="12" cy="-43" r="1.2" fill="#FFFFFF" />
          <ellipse cx="0" cy="-33" rx="4" ry="5" fill="#4A3B32" />
          <ellipse cx="0" cy="-32" rx="2.5" ry="3" fill="#D9776B" />
          <path d="M -24 -53 C -24 -57 -21 -60 -21 -60 C -21 -60 -18 -57 -18 -53 C -18 -50 -20 -49 -21 -49 C -22 -49 -24 -50 -24 -53 Z" fill="#88CBEA" />
          <path d="M 24 -51 C 24 -55 21 -58 21 -58 C 21 -58 18 -55 18 -51 C 18 -48 20 -47 21 -47 C 22 -47 24 -48 24 -51 Z" fill="#88CBEA" />

        {:else}
          <!-- Pingsan -->
          <line x1="-15" y1="-45" x2="-7" y2="-37" stroke="#4A3B32" stroke-width="2.2" stroke-linecap="round" />
          <line x1="-7" y1="-45" x2="-15" y2="-37" stroke="#4A3B32" stroke-width="2.2" stroke-linecap="round" />
          <line x1="7" y1="-45" x2="15" y2="-37" stroke="#4A3B32" stroke-width="2.2" stroke-linecap="round" />
          <line x1="15" y1="-45" x2="7" y2="-37" stroke="#4A3B32" stroke-width="2.2" stroke-linecap="round" />
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
    border-radius: 24px;
    overflow: hidden;
    background: linear-gradient(180deg, var(--sky-top, #0C233F) 0%, var(--sky-bottom, #0D3430) 100%);
    border: 1px solid var(--edge-soft);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35), inset 0 0 30px rgba(12, 31, 54, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    box-sizing: border-box;
    cursor: pointer;
    touch-action: manipulation;
    transition: background 2s ease-out; /* 2s crossfade between phases (PRD 24.3) */
  }

  /* Overcast layer for Panik & Pingsan (PRD 24.3: 25% opacity) */
  .overcast-layer {
    position: absolute;
    inset: 0;
    background-color: rgba(120, 130, 140, 0.25);
    pointer-events: none;
    z-index: 2;
  }

  /* Celestial Bodies */
  .celestial-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }

  .morning-sun {
    position: absolute;
    top: 24px;
    right: 50px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: radial-gradient(circle, #FFE7A0 40%, rgba(255, 217, 138, 0.4) 100%);
    box-shadow: 0 0 16px #FFD98A;
  }

  .sunset-sun {
    position: absolute;
    top: 40px;
    right: 65px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: radial-gradient(circle, #FFAA73 40%, rgba(242, 160, 106, 0.3) 100%);
    box-shadow: 0 0 20px #F2A06A;
  }

  .night-moon {
    position: absolute;
    top: 20px;
    right: 45px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background-color: #FFF4C9;
    box-shadow: 0 0 14px rgba(255, 244, 201, 0.8);
  }

  .star {
    position: absolute;
    color: #FFF9D9;
    font-size: 10px;
    opacity: 0.85;
    animation: twinkle 3s ease-in-out infinite alternate;
  }

  .star-1 { top: 18px; left: 60px; animation-delay: 0.3s; }
  .star-2 { top: 35px; left: 140px; animation-delay: 1.2s; }
  .star-3 { top: 22px; right: 110px; animation-delay: 0.7s; }
  .star-4 { top: 48px; right: 30px; animation-delay: 1.8s; }

  /* Clouds */
  .sky-elements {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }

  .cloud {
    position: absolute;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 999px;
  }

  .phase-senja .cloud {
    background: rgba(255, 218, 228, 0.75);
  }

  .cloud-1 {
    top: 18px;
    right: 28px;
    width: 58px;
    height: 18px;
    animation: cloudDrift 38s ease-in-out infinite alternate;
  }

  .cloud-2 {
    top: 42px;
    left: 20px;
    width: 44px;
    height: 14px;
    opacity: 0.55;
    animation: cloudDrift 44s ease-in-out infinite alternate-reverse;
  }

  /* Bonus Creatures (PRD 24.3) */
  .creatures-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
  }

  .creature-item {
    position: absolute;
  }

  .creature-birds,
  .creature-birds_return {
    top: 25px;
    animation: birdFly 16s linear infinite;
  }

  .bird-svg {
    width: 14px;
    height: 8px;
  }

  .creature-birds.index-0 { top: 20px; left: 10%; animation-delay: 0s; }
  .creature-birds.index-1 { top: 32px; left: 25%; animation-delay: 3s; }
  .creature-birds.index-2 { top: 18px; left: 70%; animation-delay: 6s; }
  .creature-birds.index-3 { top: 40px; left: 45%; animation-delay: 1.5s; }
  .creature-birds.index-4 { top: 28px; left: 80%; animation-delay: 4.5s; }
  .creature-birds.index-5 { top: 14px; left: 5%; animation-delay: 7s; }

  .creature-butterflies {
    font-size: 14px;
    animation: butterflyFlutter 4s ease-in-out infinite alternate;
  }

  .creature-butterflies.index-0 { top: 60px; left: 18%; animation-delay: 0.2s; }
  .creature-butterflies.index-1 { top: 75px; left: 42%; animation-delay: 1.4s; }
  .creature-butterflies.index-2 { top: 55px; left: 78%; animation-delay: 0.8s; }
  .creature-butterflies.index-3 { top: 68px; left: 28%; animation-delay: 2.1s; }
  .creature-butterflies.index-4 { top: 82px; left: 62%; animation-delay: 1.7s; }
  .creature-butterflies.index-5 { top: 50px; left: 88%; animation-delay: 0.5s; }

  .creature-fireflies {
    animation: fireflyGlow 3s ease-in-out infinite alternate;
  }

  .firefly-glow {
    display: block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #FFF2A8;
    box-shadow: 0 0 8px #FFF2A8;
  }

  .creature-fireflies.index-0 { top: 80px; left: 22%; animation-delay: 0.4s; }
  .creature-fireflies.index-1 { top: 95px; left: 45%; animation-delay: 1.6s; }
  .creature-fireflies.index-2 { top: 70px; left: 72%; animation-delay: 0.9s; }
  .creature-fireflies.index-3 { top: 105px; left: 30%; animation-delay: 2.2s; }
  .creature-fireflies.index-4 { top: 85px; left: 60%; animation-delay: 1.2s; }
  .creature-fireflies.index-5 { top: 75px; left: 85%; animation-delay: 2.8s; }

  /* Temporary Reaction Particles Layer (PRD 22.3) */
  .particles-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 6;
  }

  .particle {
    position: absolute;
    font-size: 18px;
    line-height: 1;
    animation: floatUpParticle 1.4s ease-out forwards;
  }

  .particle.p1 { bottom: 45px; left: 42%; animation-delay: 0.05s; }
  .particle.p2 { bottom: 42px; left: 48%; animation-delay: 0.15s; }
  .particle.p3 { bottom: 48px; left: 54%; animation-delay: 0.25s; }
  .particle.p4 { bottom: 44px; left: 38%; animation-delay: 0.35s; }
  .particle.p5 { bottom: 46px; left: 58%; animation-delay: 0.45s; }
  .particle.p-center { bottom: 65px; left: 50%; font-size: 24px; animation: tiltQuestion 1s ease-out forwards; }

  /* Coin Rain Shower */
  .particle.rain {
    top: -10px;
    animation: coinShower 1.4s ease-in forwards;
  }

  .particle.rain.r1 { left: 36%; animation-delay: 0.05s; }
  .particle.rain.r2 { left: 42%; animation-delay: 0.2s; }
  .particle.rain.r3 { left: 48%; animation-delay: 0.1s; }
  .particle.rain.r4 { left: 54%; animation-delay: 0.3s; }
  .particle.rain.r5 { left: 60%; animation-delay: 0.15s; }
  .particle.rain.r6 { left: 45%; animation-delay: 0.35s; }

  /* Sleeping Zz Layer */
  .sleep-zz-layer {
    position: absolute;
    bottom: 80px;
    left: 54%;
    pointer-events: none;
    z-index: 6;
  }

  .zz {
    position: absolute;
    color: #FFFDF7;
    font-weight: 700;
    opacity: 0;
    animation: zzFloat 3.2s ease-in-out infinite;
  }

  .zz1 { font-size: 13px; animation-delay: 0s; }
  .zz2 { font-size: 16px; animation-delay: 1s; left: 12px; }
  .zz3 { font-size: 19px; animation-delay: 2s; left: 24px; }

  /* Speech bubble at top left */
  .speech-bubble {
    position: absolute;
    top: 12px;
    left: 14px;
    max-width: 210px;
    background: rgba(12, 31, 54, 0.92);
    border: 1px solid var(--edge-bright);
    border-radius: 14px;
    padding: 7px 11px;
    z-index: 5;
    pointer-events: none;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), 0 0 12px rgba(94, 214, 230, 0.15);
  }

  .speech-text {
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-ui);
    color: var(--komorebi);
    line-height: 1.35;
    display: block;
  }

  .bubble-pointer {
    position: absolute;
    bottom: -6px;
    left: 24px;
    width: 10px;
    height: 6px;
    background-color: rgba(12, 31, 54, 0.92);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
  }

  .world-svg {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  /* Swaying grass blades (PRD 24.3: 6s cycle) */
  .swaying-grass-group {
    animation: grassSway 6s ease-in-out infinite;
    transform-origin: 180px 170px;
  }

  /* Cat Tail animations */
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

  .cat-tail.pingsan,
  .sleep-tail {
    animation: none;
    transform: rotate(25deg);
  }

  /* Cat Body motions for reactions */
  .cat-group.anim-keluar_makan,
  .cat-group.anim-tabung,
  .cat-group.anim-pet,
  .cat-group.anim-tanpa_jajan {
    animation: catBob 0.4s ease-out 3;
  }

  .cat-group.anim-masuk {
    animation: catJump 0.5s ease-out 2;
  }

  .cat-group.anim-over_limit {
    animation: catRecoil 0.3s ease-in-out 3;
  }

  .cat-group.anim-streak_milestone,
  .cat-group.anim-badge {
    animation: catProud 0.6s ease-out 2;
  }

  .head-tilt {
    transform: rotate(8deg);
    transform-origin: 0px -42px;
    transition: transform 200ms ease-out;
  }

  .chewing-mouth {
    animation: chewing 0.25s infinite alternate;
    transform-origin: 0px -33px;
  }

  @keyframes grassSway {
    0%, 100% { transform: skewX(0deg); }
    50% { transform: skewX(2.5deg); }
  }

  @keyframes tailWag {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-14deg); }
  }

  @keyframes tailWagFast {
    0%, 100% { transform: rotate(4deg); }
    50% { transform: rotate(-18deg); }
  }

  @keyframes catBlink {
    0%, 96%, 100% { transform: scaleY(1); }
    98% { transform: scaleY(0.1); }
  }

  @keyframes twinkle {
    from { opacity: 0.3; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1.1); }
  }

  @keyframes cloudDrift {
    from { transform: translateX(0); }
    to { transform: translateX(12px); }
  }

  @keyframes floatUpParticle {
    0% { opacity: 0; transform: translateY(10px) scale(0.6); }
    20% { opacity: 1; transform: translateY(0) scale(1.1); }
    80% { opacity: 0.9; }
    100% { opacity: 0; transform: translateY(-40px) scale(0.9); }
  }

  @keyframes coinShower {
    0% { opacity: 0; transform: translateY(-10px) scale(0.7); }
    30% { opacity: 1; }
    85% { opacity: 1; }
    100% { opacity: 0; transform: translateY(120px) scale(1); }
  }

  @keyframes tiltQuestion {
    0% { opacity: 0; transform: scale(0.6); }
    30% { opacity: 1; transform: scale(1.2) rotate(-8deg); }
    70% { opacity: 1; transform: scale(1.1) rotate(6deg); }
    100% { opacity: 0; transform: translateY(-20px); }
  }

  @keyframes catBob {
    0%, 100% { transform: translate(180px, 142px); }
    50% { transform: translate(180px, 134px); }
  }

  @keyframes catJump {
    0%, 100% { transform: translate(180px, 142px); }
    50% { transform: translate(180px, 126px); }
  }

  @keyframes catRecoil {
    0%, 100% { transform: translate(180px, 142px); }
    50% { transform: translate(180px, 145px) scale(0.95); }
  }

  @keyframes catProud {
    0%, 100% { transform: translate(180px, 142px); }
    50% { transform: translate(180px, 136px) scale(1.05); }
  }

  @keyframes chewing {
    from { rx: 5; ry: 3.5; }
    to { rx: 6; ry: 2; }
  }

  @keyframes zzFloat {
    0% { opacity: 0; transform: translateY(0) scale(0.7); }
    40% { opacity: 0.85; transform: translateY(-12px) scale(1); }
    80% { opacity: 0.6; }
    100% { opacity: 0; transform: translateY(-28px) scale(1.15); }
  }

  @keyframes butterflyFlutter {
    from { transform: translateY(0) rotate(-6deg); }
    to { transform: translateY(-10px) rotate(6deg); }
  }

  @keyframes fireflyGlow {
    from { opacity: 0.2; transform: translateY(0) scale(0.7); }
    to { opacity: 1; transform: translateY(-6px) scale(1.2); }
  }

  .cat-eye {
    animation: catBlink 5s infinite;
    transform-box: fill-box;
    transform-origin: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .cloud-1,
    .cloud-2,
    .cat-tail,
    .cat-eye,
    .cat-group,
    .swaying-grass-group,
    .particle,
    .creature-item {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
