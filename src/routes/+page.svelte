<script>
  import { getContext, onMount } from 'svelte';
  import CatWorld from '$lib/components/CatWorld.svelte';
  import AchievementSheet from '$lib/components/AchievementSheet.svelte';
  import CategorySheet from '$lib/components/CategorySheet.svelte';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';
  import { formatRp } from '$lib/money.js';
  import {
    getWeekRange,
    isDateInWeek,
    calculateBudgetFormulas,
    getWIBParts
  } from '$lib/week.js';
  import {
    budgets,
    transactions,
    goals,
    settings,
    saveSetting,
    walletBalance,
    addTransaction,
    deleteTransaction,
    saveBudget,
    deleteBudget,
    isDataLoaded,
    ticker
  } from '$lib/stores/data.js';
  import { sync } from '$lib/stores/sync.js';
  import { calculateStreak, calculateBadges } from '$lib/gamification.js';

  const txManager = getContext('txManager');

  const INDO_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  let weekOffset = $state(0); // 0 = current week, -1 = last week, etc.
  let isBalanceHidden = $state(false);
  let txFilter = $state('semua'); // 'semua' | 'keluar' | 'masuk'
  let isCategorySheetOpen = $state(false);
  let selectedCategoryToEdit = $state(null);

  const isCurrentWeek = $derived(weekOffset === 0);

  // Time-of-day greeting
  const greeting = $derived.by(() => {
    const _tick = $ticker;
    const p = getWIBParts(new Date());
    const h = p.hours;
    if (h >= 5 && h < 11) return 'Selamat pagi';
    if (h >= 11 && h < 15) return 'Selamat siang';
    if (h >= 15 && h < 18) return 'Selamat sore';
    return 'Selamat malam';
  });

  // Active week range based on offset
  const activeWeekRange = $derived.by(() => {
    const _tick = $ticker;
    const startDay = $settings?.awal_minggu ?? 1;
    const offsetMs = weekOffset * 7 * 24 * 60 * 60 * 1000;
    const targetDate = new Date(Date.now() + offsetMs);
    return getWeekRange(targetDate, startDay);
  });

  // Week switcher label: e.g. "Minggu ini · 12–18 Okt"
  const weekLabel = $derived.by(() => {
    const startP = getWIBParts(activeWeekRange.start);
    const lastDayP = getWIBParts(new Date(activeWeekRange.end.getTime() - 1000));

    let rangeStr = '';
    if (startP.month === lastDayP.month) {
      rangeStr = `${startP.date}–${lastDayP.date} ${INDO_MONTHS[startP.month]}`;
    } else {
      rangeStr = `${startP.date} ${INDO_MONTHS[startP.month]} – ${lastDayP.date} ${INDO_MONTHS[lastDayP.month]}`;
    }

    if (weekOffset === 0) return `Minggu ini · ${rangeStr}`;
    if (weekOffset === -1) return `Minggu lalu · ${rangeStr}`;
    return rangeStr;
  });

  // Filter transactions for active week
  const weekTransactions = $derived.by(() => {
    return ($transactions || []).filter((tx) =>
      isDateInWeek(tx.tanggal, activeWeekRange.start, activeWeekRange.end)
    );
  });

  // Check if current week has income recorded
  const hasIncomeThisWeek = $derived.by(() => {
    return weekTransactions.some((tx) => tx.tipe === 'masuk');
  });

  // Budget calculations for active week
  const activeSummary = $derived.by(() => {
    const _tick = $ticker;
    return calculateBudgetFormulas({
      budgetCategories: $budgets,
      transactionsThisWeek: weekTransactions,
      todayDate: isCurrentWeek ? new Date() : activeWeekRange.start,
      startDayOfWeek: $settings?.awal_minggu ?? 1
    });
  });

  // Summary counts for Keluar, Masuk, Tabung in active week
  const totalsByTipe = $derived.by(() => {
    let keluar = 0;
    let masuk = 0;
    let tabung = 0;
    for (const tx of weekTransactions) {
      const nom = Number(tx.nominal) || 0;
      if (tx.tipe === 'keluar') keluar += nom;
      else if (tx.tipe === 'masuk') masuk += nom;
      else if (tx.tipe === 'tabung') tabung += nom;
    }
    return { keluar, masuk, tabung };
  });

  // Map category spent for progress bars
  const categorySpentMap = $derived.by(() => {
    const map = {};
    for (const tx of weekTransactions) {
      if (tx.kategori_id) {
        map[tx.kategori_id] = (map[tx.kategori_id] || 0) + (Number(tx.nominal) || 0);
      }
    }
    return map;
  });

  // Daily allowance meter computations
  const dailySpent = $derived(Number(activeSummary?.P_hari_ini) || 0);
  const dailyJatah = $derived(Number(activeSummary?.jatah) || 0);
  const dailySisa = $derived(Number(activeSummary?.sisa_hari) || 0);

  const dailySpentPct = $derived.by(() => {
    if (dailyJatah <= 0) return 0;
    return Math.round((dailySpent / dailyJatah) * 100);
  });

  const dailyMeterState = $derived.by(() => {
    if (dailySpentPct >= 85 || dailySisa < 0) return 'danger';
    if (dailySpentPct >= 70) return 'warning';
    return 'normal';
  });

  // Group transactions by date descending
  const groupedTransactions = $derived.by(() => {
    const groups = [];
    const dateMap = new Map();

    for (const tx of weekTransactions) {
      const p = getWIBParts(tx.tanggal);
      const dateKey = `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.date).padStart(2, '0')}`;

      if (!dateMap.has(dateKey)) {
        const dayLabel = `${INDO_DAYS[p.day]}, ${p.date} ${INDO_MONTHS[p.month]}`;
        const newGroup = {
          dateKey,
          dayLabel,
          totalKeluar: 0,
          items: []
        };
        dateMap.set(dateKey, newGroup);
        groups.push(newGroup);
      }

      const group = dateMap.get(dateKey);
      group.items.push(tx);
      if (tx.tipe === 'keluar') {
        group.totalKeluar += Number(tx.nominal) || 0;
      }
    }

    return groups;
  });

  // Filtered transactions by type segment pill
  const filteredGroupedTransactions = $derived.by(() => {
    if (txFilter === 'semua') return groupedTransactions;
    const filtered = [];
    for (const group of groupedTransactions) {
      const matching = group.items.filter((item) => item.tipe === txFilter);
      if (matching.length > 0) {
        filtered.push({
          ...group,
          items: matching
        });
      }
    }
    return filtered;
  });

  // Categories for envelopes: keluar & tabung
  const displayCategories = $derived.by(() => {
    return ($budgets || [])
      .filter((c) => c.tipe === 'keluar' || c.tipe === 'tabung')
      .sort((a, b) => (a.urut || 0) - (b.urut || 0));
  });

  // Gamification & Streak state (PRD 23, 24, 25)
  let isAchievementSheetOpen = $state(false);
  let hasShownBadgeToastThisSession = false;
  let seenBadgeIds = $state(new Set());
  let everUnlockedBadgeIds = $state(new Set());

  const streakData = $derived.by(() => {
    const _tick = $ticker;
    const weeklyLimit =
      ($budgets || [])
        .filter((b) => b.tipe === 'keluar')
        .reduce((sum, b) => sum + (Number(b.limit_mingguan) || 0), 0) || 116000;

    return calculateStreak({
      transactions: $transactions || [],
      totalWeeklyLimit: weeklyLimit,
      tanpaJajan: $settings?.tanpa_jajan || '',
      now: new Date()
    });
  });

  const rawBadges = $derived.by(() => {
    const _tick = $ticker;
    const weeklyLimit =
      ($budgets || [])
        .filter((b) => b.tipe === 'keluar')
        .reduce((sum, b) => sum + (Number(b.limit_mingguan) || 0), 0) || 116000;

    return calculateBadges({
      transactions: $transactions || [],
      budgets: $budgets || [],
      goals: $goals || [],
      streak: streakData,
      totalWeeklyLimit: weeklyLimit,
      startDayOfWeek: $settings?.awal_minggu ?? 1,
      now: new Date()
    });
  });

  const displayBadges = $derived.by(() => {
    return rawBadges.map((b) => {
      const isUnlocked = b.unlocked || everUnlockedBadgeIds.has(b.id);
      const isNew = isUnlocked && !seenBadgeIds.has(b.id);
      return {
        ...b,
        unlocked: isUnlocked,
        isNew
      };
    });
  });

  const displayUnlockedCount = $derived(
    displayBadges.filter((b) => b.unlocked).length
  );

  onMount(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedSeen = localStorage.getItem('neko_seen_badges');
      const storedEver = localStorage.getItem('neko_ever_unlocked_badges');
      const storedPrivacy = localStorage.getItem('hide_balance');
      if (storedPrivacy === 'true') {
        isBalanceHidden = true;
      }

      if (storedSeen === null) {
        const initialUnlocked = rawBadges.filter((b) => b.unlocked).map((b) => b.id);
        seenBadgeIds = new Set(initialUnlocked);
        everUnlockedBadgeIds = new Set(initialUnlocked);
        localStorage.setItem('neko_seen_badges', JSON.stringify(initialUnlocked));
        localStorage.setItem('neko_ever_unlocked_badges', JSON.stringify(initialUnlocked));
      } else {
        const seenArr = JSON.parse(storedSeen) || [];
        const everArr = JSON.parse(storedEver || '[]') || [];
        seenBadgeIds = new Set(seenArr);
        everUnlockedBadgeIds = new Set(everArr);
      }
    } catch (e) {
      console.error('Error reading badge history:', e);
    }
  });

  $effect(() => {
    if (typeof window === 'undefined' || !$isDataLoaded) return;
    const currentUnlocked = rawBadges.filter((b) => b.unlocked);
    if (currentUnlocked.length === 0) return;

    let updatedEver = false;
    const newEver = new Set(everUnlockedBadgeIds);
    for (const b of currentUnlocked) {
      if (!newEver.has(b.id)) {
        newEver.add(b.id);
        updatedEver = true;
      }
    }
    if (updatedEver) {
      everUnlockedBadgeIds = newEver;
      try {
        localStorage.setItem('neko_ever_unlocked_badges', JSON.stringify([...newEver]));
      } catch (e) {}
    }

    const unseen = currentUnlocked.filter((b) => !seenBadgeIds.has(b.id));
    if (unseen.length > 0 && !hasShownBadgeToastThisSession) {
      const firstNew = unseen[0];
      hasShownBadgeToastThisSession = true;
      txManager?.triggerCatReaction?.('badge');
      txManager?.showToast?.(`Lencana baru: ${firstNew.name}`, () => {
        handleOpenAchievementSheet();
      });
    }
  });

  function toggleBalancePrivacy() {
    isBalanceHidden = !isBalanceHidden;
    try {
      localStorage.setItem('hide_balance', String(isBalanceHidden));
    } catch (e) {}
  }

  function handleOpenAchievementSheet() {
    isAchievementSheetOpen = true;
    const allUnlocked = displayBadges.filter((b) => b.unlocked).map((b) => b.id);
    seenBadgeIds = new Set(allUnlocked);
    try {
      localStorage.setItem('neko_seen_badges', JSON.stringify(allUnlocked));
    } catch (e) {}
  }

  async function handleMarkTanpaJajan() {
    const todayISO = streakData.todayISO;
    const existingStr = $settings?.tanpa_jajan || '';
    const existing = existingStr.split(',').map((s) => s.trim()).filter(Boolean);
    if (!existing.includes(todayISO)) {
      const updated = [...existing, todayISO].slice(-60).join(',');
      await saveSetting('tanpa_jajan', updated);
      txManager?.triggerCatReaction?.('tanpa_jajan');
      txManager?.showToast?.('Ditandai · Hari ini tidak jajan', async () => {
        await saveSetting('tanpa_jajan', existingStr);
        txManager?.triggerCatReaction?.('undo');
      });
    }
  }

  async function handleRecordIncome() {
    const masukCat = ($budgets || []).find((c) => c.tipe === 'masuk') || {
      id: 'masuk',
      tipe: 'masuk'
    };
    const nominal = Number($settings?.uang_jajan_mingguan) || 145000;
    const created = await addTransaction({
      tipe: 'masuk',
      kategori_id: masukCat.id,
      nominal,
      catatan: 'Uang jajan mingguan'
    });
    txManager?.triggerCatReaction?.('masuk');
    txManager?.showToast?.(`Dicatat ${formatRp(nominal)}`, async () => {
      await deleteTransaction(created.id);
      txManager?.triggerCatReaction?.('undo');
    });
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    const p = getWIBParts(isoString);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(p.hours)}:${pad(p.minutes)}`;
  }

  function getCategoryMeta(kategoriId) {
    return ($budgets || []).find((b) => b.id === kategoriId) || null;
  }

  const highlightedTxId = $derived(txManager?.getHighlightedTxId?.());

  // Set active week date for creation modal preset (PRD 11.5)
  $effect(() => {
    if (weekOffset !== 0) {
      const mid = new Date(activeWeekRange.start.getTime() + 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
      txManager?.setActiveWeekDate?.(mid.toISOString());
    } else {
      txManager?.setActiveWeekDate?.(null);
    }
  });

  // Pull to refresh support (PRD 11.4)
  let pullStartY = 0;
  let pullDistance = $state(0);
  let isRefreshing = $state(false);

  function handleTouchStart(e) {
    if (typeof window !== 'undefined' && window.scrollY === 0) {
      pullStartY = e.touches[0].clientY;
    } else {
      pullStartY = 0;
    }
  }

  function handleTouchMove(e) {
    if (!pullStartY) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - pullStartY;
    if (diff > 0 && typeof window !== 'undefined' && window.scrollY === 0) {
      pullDistance = Math.min(50, diff * 0.4);
    }
  }

  async function handleTouchEnd() {
    if (pullDistance >= 35 && !isRefreshing) {
      isRefreshing = true;
      pullDistance = 35;
      try {
        await sync?.trigger?.();
      } catch (err) {
        console.error('Refresh sync error:', err);
      } finally {
        setTimeout(() => {
          isRefreshing = false;
          pullDistance = 0;
        }, 400);
      }
    } else {
      pullDistance = 0;
    }
    pullStartY = 0;
  }
</script>

<div
  class="beranda-container"
  role="region"
  aria-label="Beranda"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
>
  {#if pullDistance > 0 || isRefreshing}
    <div class="pull-refresh-indicator">
      <span>{isRefreshing ? '🔄 Menyegarkan...' : '⬇️ Tarik untuk menyegarkan'}</span>
    </div>
  {/if}

  {#if !$isDataLoaded}
    <!-- Skeleton state -->
    <div class="skeleton-wrapper" aria-label="Memuat data">
      <div class="skeleton-block skeleton-cat"></div>
      <div class="skeleton-block skeleton-nav"></div>
      <div class="skeleton-block skeleton-card"></div>
      <div class="skeleton-grid">
        <div class="skeleton-block skeleton-pill"></div>
        <div class="skeleton-block skeleton-pill"></div>
        <div class="skeleton-block skeleton-pill"></div>
      </div>
      <div class="skeleton-block skeleton-category"></div>
      <div class="skeleton-block skeleton-category"></div>
    </div>
  {:else}
    <!-- 1. Header Section -->
    <header class="beranda-header">
      <div class="greeting-row">
        <div class="greeting-text-group">
          <span class="greeting-title">{greeting}</span>
          <span class="greeting-subtitle">Mari kelola keuanganmu hari ini</span>
        </div>
        <button
          type="button"
          class="streak-badge-btn"
          onclick={handleOpenAchievementSheet}
          aria-label="Lihat lencana dan pencapaian"
        >
          <span class="streak-fire">🔥</span>
          <span class="streak-count font-num tabular-nums">{streakData.currentStreak}</span>
          <span class="streak-sep">·</span>
          <span class="badge-icon">🎖️</span>
          <span class="badge-count font-num tabular-nums">{displayUnlockedCount}</span>
        </button>
      </div>

      <!-- Week Switcher Capsule -->
      <div class="week-capsule-nav">
        <button
          type="button"
          class="week-nav-arrow"
          onclick={() => (weekOffset -= 1)}
          aria-label="Minggu sebelumnya"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span class="week-capsule-label">{weekLabel}</span>
        <button
          type="button"
          class="week-nav-arrow"
          disabled={isCurrentWeek}
          onclick={() => !isCurrentWeek && (weekOffset += 1)}
          aria-label="Minggu berikutnya"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </header>

    <!-- 2. CatWorld Mascot Frame -->
    <section class="catworld-section" aria-label="Kucing Reaktif">
      <CatWorld
        r={activeSummary.r}
        sisa_hari={activeSummary.sisa_hari}
        streak={streakData.currentStreak}
        onregister={(fn) => txManager?.registerCatReaction?.(fn)}
      />
    </section>

    <!-- 3. Income Banner if not recorded this week -->
    {#if isCurrentWeek && !hasIncomeThisWeek}
      <div class="income-banner glass-panel">
        <div class="banner-text">
          <span class="banner-icon">💰</span>
          <span>Uang jajan minggu ini belum dicatat</span>
        </div>
        <button
          type="button"
          class="banner-action-btn"
          onclick={handleRecordIncome}
        >
          Catat {formatRp($settings?.uang_jajan_mingguan || 145000)}
        </button>
      </div>
    {/if}

    <!-- 4. Aether Core Hero -->
    <section class="aether-hero glass-core" aria-label="Ringkasan Anggaran">
      <div class="hero-top-row">
        <div class="hero-label-group">
          <span class="hero-label">
            {isCurrentWeek ? 'Sisa jajan minggu ini' : 'Sisa jajan minggu lalu'}
          </span>
          <span class="hero-wallet-pill tabular-nums">
            Dompet {#if isBalanceHidden}••••••{:else}<AnimatedNumber value={$walletBalance} />{/if}
          </span>
        </div>
        <button
          type="button"
          class="privacy-toggle-btn"
          onclick={toggleBalancePrivacy}
          aria-label={isBalanceHidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
        >
          {#if isBalanceHidden}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          {/if}
        </button>
      </div>

      <div class="hero-balance-row">
        <h2 class="hero-balance font-num tabular-nums {activeSummary.S < 0 ? 'over-budget' : ''}">
          {#if isBalanceHidden}
            Rp •••••••
          {:else}
            <AnimatedNumber value={activeSummary.S} />
          {/if}
        </h2>
        <div class="hero-status-badge">
          {#if activeSummary.S < 0}
            <span class="badge-over font-num tabular-nums">
              Lewat {formatRp(Math.abs(activeSummary.S))}
            </span>
          {:else}
            <span class="badge-ratio font-num tabular-nums">
              {Math.round(Math.max(0, activeSummary.r * 100))}%
            </span>
          {/if}
        </div>
      </div>

      <!-- Mini Stat Panels: Masuk, Keluar, Tabung -->
      <div class="hero-stats-grid">
        <button
          type="button"
          class="hero-stat-box masuk interactive-tap"
          onclick={() => txManager?.openCreate?.({ tipe: 'masuk' })}
          aria-label="Catat transaksi pemasukan"
        >
          <div class="stat-icon-label">
            <span class="stat-arrow down">↓</span>
            <span>Masuk</span>
          </div>
          <span class="stat-value font-num tabular-nums">
            {#if isBalanceHidden}••••{:else}<AnimatedNumber value={totalsByTipe.masuk} />{/if}
          </span>
        </button>

        <button
          type="button"
          class="hero-stat-box keluar interactive-tap"
          onclick={() => txManager?.openCreate?.({ tipe: 'keluar' })}
          aria-label="Catat transaksi pengeluaran"
        >
          <div class="stat-icon-label">
            <span class="stat-arrow up">↑</span>
            <span>Keluar</span>
          </div>
          <span class="stat-value font-num tabular-nums">
            {#if isBalanceHidden}••••{:else}<AnimatedNumber value={totalsByTipe.keluar} />{/if}
          </span>
        </button>

        <button
          type="button"
          class="hero-stat-box tabung interactive-tap"
          onclick={() => txManager?.openCreate?.({ tipe: 'tabung' })}
          aria-label="Catat tabungan"
        >
          <div class="stat-icon-label">
            <span class="stat-arrow piggy">🐷</span>
            <span>Tabung</span>
          </div>
          <span class="stat-value font-num tabular-nums">
            {#if isBalanceHidden}••••{:else}<AnimatedNumber value={totalsByTipe.tabung} />{/if}
          </span>
        </button>
      </div>

      <!-- Batas Harian / Daily Limit Meter Bar (Current week only) -->
      {#if isCurrentWeek}
        <div class="daily-limit-card {dailyMeterState}">
          <div class="daily-limit-header">
            <div class="daily-header-left">
              <span class="daily-title">Batas Harian</span>
              {#if dailyMeterState === 'danger'}
                <span class="danger-badge">Bahaya!</span>
              {/if}
            </div>
            <span class="daily-spent-now tabular-nums">
              Hari ini {formatRp(dailySpent)}
            </span>
          </div>

          <!-- Progress Track with Cat Indicator -->
          <div class="daily-track-wrapper">
            <div class="daily-progress-track">
              <div
                class="daily-progress-fill state-{dailyMeterState}"
                style="width: {Math.min(100, Math.max(0, dailySpentPct))}%"
              ></div>
            </div>
            <div
              class="cat-meter-avatar state-{dailyMeterState}"
              style="left: clamp(4%, {Math.min(96, Math.max(4, dailySpentPct))}%, 96%);"
              aria-hidden="true"
            >
              🐱
            </div>
          </div>

          <div class="daily-limit-footer tabular-nums">
            {#if dailyJatah === 0}
              <span class="daily-subtext">Jatah habis</span>
            {:else if dailySisa < 0}
              <span class="daily-subtext danger">
                Lewat {formatRp(Math.abs(dailySisa))} dari jatah {formatRp(dailyJatah)}
              </span>
            {:else}
              <span class="daily-subtext">
                Sisa {formatRp(dailySisa)} dari jatah {formatRp(dailyJatah)}
              </span>
            {/if}
          </div>
        </div>

        <!-- 7-day streak track -->
        <div
          class="streak-strip"
          role="button"
          tabindex="0"
          onclick={handleOpenAchievementSheet}
          onkeydown={(e) => e.key === 'Enter' && handleOpenAchievementSheet()}
          aria-label="Lihat pencapaian: {streakData.streakTitle}"
        >
          <div class="streak-dots">
            {#each streakData.last7Days as day}
              <span class="streak-dot {day.type}" title="{day.dayLabel}: {day.type}">
                {day.symbol}
              </span>
            {/each}
          </div>
          <span class="streak-title-text">{streakData.streakTitle}</span>
        </div>

        <!-- Tombol Hari ini tidak jajan -->
        {#if streakData.canMarkTanpaJajanToday}
          <button
            type="button"
            class="tanpa-jajan-glass-btn"
            onclick={handleMarkTanpaJajan}
          >
            <span>Hari ini tidak jajan</span>
            <span class="moon-icon">🌙</span>
          </button>
        {/if}
      {/if}
    </section>

    <!-- 5. Kantong Anggaran (Envelopes / Categories) -->
    <section class="envelopes-section" aria-label="Kantong Anggaran">
      <div class="section-title-row">
        <h3 class="section-title">Kantong anggaran</h3>
        <button
          type="button"
          class="manage-budget-chip"
          onclick={() => {
            selectedCategoryToEdit = null;
            isCategorySheetOpen = true;
          }}
        >
          <span>Atur Jatah</span>
          <span class="chip-arrow">›</span>
        </button>
      </div>

      <div class="envelopes-list">
        {#each displayCategories as cat, i}
          {@const spent = categorySpentMap[cat.id] || 0}
          {@const limit = Number(cat.limit_mingguan) || 1}
          {@const pct = Math.round((spent / limit) * 100)}
          {@const isOver85 = pct >= 85}
          {@const isOverLimit = spent > limit}

          <div
            class="envelope-card glass-panel interactive-tap animate-stagger {isOver85 ? 'over-85' : ''}"
            style="--i: {i}"
            role="button"
            tabindex="0"
            onclick={() => txManager?.openCreate?.({ kategori_id: cat.id, tipe: cat.tipe })}
            onkeydown={(e) => e.key === 'Enter' && txManager?.openCreate?.({ kategori_id: cat.id, tipe: cat.tipe })}
          >
            <div class="envelope-top">
              <div class="envelope-identity">
                <div class="envelope-icon-orb {cat.warna || cat.id}">
                  <span>{cat.ikon}</span>
                </div>
                <div class="envelope-name-group">
                  <span class="envelope-name">{cat.nama}</span>
                  <span class="envelope-limits tabular-nums">
                    {formatRp(spent)} / {formatRp(limit)}
                  </span>
                </div>
              </div>
              <div class="envelope-pct-group">
                <span class="envelope-pct font-num tabular-nums {isOver85 ? 'text-api' : ''}">
                  {pct}%
                </span>
                {#if isOverLimit}
                  <span class="over-chip tabular-nums">+{formatRp(spent - limit)}</span>
                {/if}
              </div>
            </div>

            <div class="capsule-track">
              <div
                class="capsule-fill {isOver85 ? 'fill-api' : ''}"
                style="width: {Math.min(100, pct)}%"
              ></div>
              <div class="threshold-85-marker" title="Batas aman 85%"></div>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <!-- 6. Jurnal Transaksi (Recent Transactions) -->
    <section class="journal-section" aria-label="Jurnal Transaksi">
      <div class="section-title-row">
        <h3 class="section-title">Jurnal Transaksi</h3>
      </div>

      <div class="tx-filter-bar" role="tablist" aria-label="Filter transaksi">
        <button
          type="button"
          class="filter-tab {txFilter === 'semua' ? 'active' : ''}"
          onclick={() => (txFilter = 'semua')}
          role="tab"
          aria-selected={txFilter === 'semua'}
        >
          Semua
        </button>
        <button
          type="button"
          class="filter-tab {txFilter === 'keluar' ? 'active' : ''}"
          onclick={() => (txFilter = 'keluar')}
          role="tab"
          aria-selected={txFilter === 'keluar'}
        >
          Keluar
        </button>
        <button
          type="button"
          class="filter-tab {txFilter === 'masuk' ? 'active' : ''}"
          onclick={() => (txFilter = 'masuk')}
          role="tab"
          aria-selected={txFilter === 'masuk'}
        >
          Masuk
        </button>
      </div>

      {#if filteredGroupedTransactions.length === 0}
        <div class="empty-journal-card glass-panel">
          <div class="sleepy-cat-icon" aria-hidden="true">🐱💤</div>
          <p class="empty-main-text">Belum ada catatan di sini.</p>
          <p class="empty-sub-text">Ketuk + untuk menambah.</p>
        </div>
      {:else}
        <div class="journal-groups">
          {#each filteredGroupedTransactions as group}
            <div class="journal-group">
              <div class="group-header">
                <span class="group-day-label">{group.dayLabel}</span>
                {#if group.totalKeluar > 0 && txFilter !== 'masuk'}
                  <span class="group-day-total tabular-nums">
                    −{formatRp(group.totalKeluar)}
                  </span>
                {/if}
              </div>

              <div class="group-items">
                {#each group.items as tx, i}
                  {@const meta = getCategoryMeta(tx.kategori_id)}
                  <div
                    class="tx-item-row glass-row interactive-tap animate-stagger {highlightedTxId === tx.id ? 'just-added' : ''}"
                    style="--i: {i}"
                    role="button"
                    tabindex="0"
                    onclick={() => txManager?.openEdit?.(tx)}
                    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && txManager?.openEdit?.(tx)}
                  >
                    <div class="tx-item-left">
                      <div class="tx-badge-orb {meta?.warna || meta?.id || 'jajan'} tipe-{tx.tipe}">
                        <span>{meta?.ikon || '🍙'}</span>
                      </div>
                      <div class="tx-details">
                        <span class="tx-title">{tx.catatan || meta?.nama || 'Pengeluaran'}</span>
                        <span class="tx-meta-sub">
                          {#if tx.catatan && meta?.nama}
                            {meta.nama} ·
                          {/if}
                          {formatTime(tx.tanggal)}
                        </span>
                      </div>
                    </div>

                    <div class="tx-item-right font-num tabular-nums">
                      {#if tx.tipe === 'masuk'}
                        <span class="amount-masuk">+{formatRp(tx.nominal)}</span>
                      {:else if tx.tipe === 'tabung'}
                        <span class="amount-tabung">{formatRp(tx.nominal)}</span>
                      {:else}
                        <span class="amount-keluar">−{formatRp(tx.nominal)}</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <!-- Modals -->
  <AchievementSheet
    bind:open={isAchievementSheetOpen}
    currentStreak={streakData.currentStreak}
    bestStreak={streakData.bestStreak}
    badges={displayBadges}
    unlockedCount={displayUnlockedCount}
    totalBadges={rawBadges.totalBadges || 10}
    onclose={() => (isAchievementSheetOpen = false)}
  />

  <CategorySheet
    bind:open={isCategorySheetOpen}
    category={selectedCategoryToEdit}
    existingCategories={$budgets}
    transactions={$transactions}
    onsave={async (catData) => {
      await saveBudget(catData);
      txManager?.showToast?.(`Kategori ${catData.nama} disimpan`);
    }}
    ondelete={async (catId) => {
      await deleteBudget(catId);
      txManager?.showToast?.('Kategori dihapus');
    }}
    onswaporder={async (catA, catB) => {
      const updatedA = { ...catA, urut: catB.urut };
      const updatedB = { ...catB, urut: catA.urut };
      await saveBudget(updatedA);
      await saveBudget(updatedB);
    }}
  />
</div>

<style>
  .beranda-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    box-sizing: border-box;
  }

  /* 1. Header Section */
  .beranda-header {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .greeting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .greeting-text-group {
    display: flex;
    flex-direction: column;
  }

  .greeting-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--komorebi);
    letter-spacing: -0.01em;
  }

  .greeting-subtitle {
    font-size: 11px;
    color: var(--kabut);
    margin-top: 1px;
  }

  .streak-badge-btn {
    position: relative;
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    border-radius: 999px;
    padding: 6px 12px;
    color: var(--komorebi);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: transform 120ms ease, border-color 150ms ease, background-color 150ms ease;
  }

  .streak-badge-btn::before {
    content: '';
    position: absolute;
    inset: -6px;
  }

  .streak-badge-btn:active {
    transform: scale(0.96);
    border-color: var(--edge-bright);
    background: var(--glass-2);
  }

  .streak-fire,
  .badge-icon {
    font-size: 13px;
    line-height: 1;
  }

  .streak-count,
  .badge-count {
    color: var(--bara);
    font-weight: 700;
  }

  .streak-sep {
    color: var(--lumut);
    font-weight: 400;
  }

  /* Week Switcher Capsule */
  .week-capsule-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    border-radius: 999px;
    padding: 4px 8px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .week-nav-arrow {
    position: relative;
    border: none;
    background: transparent;
    color: var(--komorebi);
    cursor: pointer;
    padding: 6px 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: opacity 120ms ease, background-color 150ms ease;
  }

  .week-nav-arrow::before {
    content: '';
    position: absolute;
    inset: -6px;
  }

  .week-nav-arrow:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .week-nav-arrow:not(:disabled):active {
    background: var(--glass-2);
  }

  .week-capsule-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--komorebi);
    letter-spacing: -0.01em;
  }

  /* 2. CatWorld Section */
  .catworld-section {
    width: 100%;
  }

  /* 3. Income Banner */
  .income-banner {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(217, 119, 6, 0.08);
    border: 1px solid rgba(217, 119, 6, 0.25);
    border-radius: 20px;
    padding: 12px 16px;
    box-sizing: border-box;
  }

  .banner-text {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: var(--komorebi);
  }

  .banner-icon {
    font-size: 18px;
  }

  .banner-action-btn {
    align-self: flex-start;
    border: none;
    background: linear-gradient(135deg, var(--bara) 0%, #B45309 100%);
    color: var(--on-bara);
    font-size: 12px;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 999px;
    cursor: pointer;
    box-shadow: var(--glow-bara);
    transition: transform 100ms ease;
  }

  .banner-action-btn:active {
    transform: scale(0.96);
  }

  /* 4. Aether Hero Core */
  .aether-hero {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 18px;
    border-radius: 28px;
    background: var(--glass-2);
    border: 1px solid var(--edge-soft);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .hero-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .hero-label-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hero-label {
    font-size: 13px;
    color: var(--kabut);
    font-weight: 500;
  }

  .hero-wallet-pill {
    font-size: 11px;
    font-weight: 600;
    color: var(--aether);
    background: rgba(59, 154, 184, 0.10);
    border: 1px solid rgba(59, 154, 184, 0.25);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .privacy-toggle-btn {
    border: none;
    background: transparent;
    color: var(--kabut);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 50%;
    transition: color 150ms ease;
  }

  .privacy-toggle-btn:hover {
    color: var(--komorebi);
  }

  .hero-balance-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .hero-balance {
    font-size: 32px;
    font-weight: 700;
    line-height: 1.1;
    color: var(--aether);
    text-shadow: var(--glow-aether);
    letter-spacing: -0.02em;
  }

  .hero-balance.over-budget {
    color: var(--api);
    text-shadow: var(--glow-api);
  }

  .hero-status-badge {
    display: flex;
    align-items: center;
  }

  .badge-ratio {
    font-size: 13px;
    font-weight: 700;
    color: var(--aether);
    background: rgba(59, 154, 184, 0.10);
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(59, 154, 184, 0.25);
  }

  .badge-over {
    font-size: 12px;
    font-weight: 700;
    color: var(--api);
    background: rgba(209, 67, 67, 0.10);
    border: 1px solid rgba(209, 67, 67, 0.28);
    padding: 4px 10px;
    border-radius: 999px;
  }

  /* Hero stats grid */
  .hero-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .hero-stat-box {
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    border-radius: 16px;
    padding: 10px 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    box-sizing: border-box;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;
  }

  .hero-stat-box:hover {
    background: var(--glass-2);
  }

  .hero-stat-box:active {
    transform: scale(0.97);
  }

  .hero-stat-box.masuk {
    border-color: rgba(56, 161, 105, 0.22);
  }

  .hero-stat-box.keluar {
    border-color: rgba(209, 67, 67, 0.22);
  }

  .hero-stat-box.tabung {
    border-color: rgba(217, 119, 6, 0.22);
  }

  .stat-icon-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 700;
    color: var(--kabut);
  }

  .stat-arrow.down {
    color: var(--tunas);
    font-weight: 800;
  }

  .stat-arrow.up {
    color: var(--api);
    font-weight: 800;
  }

  .stat-arrow.piggy {
    font-size: 11px;
    line-height: 1;
    color: var(--bara);
  }

  .stat-value {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .hero-stat-box.masuk .stat-value {
    color: var(--tunas);
    text-shadow: 0 0 10px rgba(56, 161, 105, 0.16);
  }

  .hero-stat-box.keluar .stat-value {
    color: var(--api);
    text-shadow: 0 0 10px rgba(209, 67, 67, 0.16);
  }

  .hero-stat-box.tabung .stat-value {
    color: var(--bara);
    text-shadow: 0 0 10px rgba(217, 119, 6, 0.16);
  }

  /* Daily Limit Meter */
  .daily-limit-card {
    background: rgba(0, 0, 0, 0.22);
    border: 1px solid var(--edge-soft);
    border-radius: 18px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }

  .daily-limit-card.danger {
    border-color: rgba(209, 67, 67, 0.35);
    box-shadow: 0 0 14px rgba(209, 67, 67, 0.12);
  }

  .daily-limit-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .daily-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .daily-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--kabut);
  }

  .danger-badge {
    font-size: 10px;
    font-weight: 800;
    color: #FFFFFF;
    background: var(--api);
    padding: 2px 7px;
    border-radius: 999px;
    box-shadow: var(--glow-api);
  }

  .daily-spent-now {
    font-size: 12px;
    font-weight: 700;
    color: var(--komorebi);
  }

  .daily-track-wrapper {
    position: relative;
    width: 100%;
    height: 10px;
    display: flex;
    align-items: center;
  }

  .daily-progress-track {
    width: 100%;
    height: 10px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
  }

  .daily-progress-fill {
    height: 100%;
    border-radius: 999px;
    transition: background-color 300ms ease-out;
  }

  .daily-progress-fill.state-normal {
    background: linear-gradient(90deg, var(--tunas) 0%, var(--bara) 100%);
    box-shadow: var(--glow-tunas);
  }

  .daily-progress-fill.state-warning {
    background: var(--bara);
    box-shadow: var(--glow-bara);
  }

  .daily-progress-fill.state-danger {
    background: var(--api);
    box-shadow: var(--glow-api);
  }

  .cat-meter-avatar {
    position: absolute;
    top: -8px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--senja);
    border: 1.5px solid var(--bara);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), var(--glow-bara);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    transform: translateX(-50%);
    pointer-events: none;
    transition: left 350ms ease-out, border-color 300ms ease-out;
    z-index: 3;
  }

  .cat-meter-avatar.state-danger {
    border-color: var(--api);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), var(--glow-api);
  }

  .daily-limit-footer {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .daily-subtext {
    font-size: 11px;
    color: var(--kabut);
    font-weight: 500;
  }

  .daily-subtext.danger {
    color: var(--api);
    font-weight: 700;
  }

  /* 7-Day Streak Strip */
  .streak-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 10px;
    border-top: 1px solid var(--edge-soft);
    cursor: pointer;
    border-radius: 8px;
    transition: opacity 120ms ease;
  }

  .streak-strip:active {
    opacity: 0.8;
  }

  .streak-dots {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .streak-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    line-height: 1;
    box-sizing: border-box;
  }

  .streak-dot.hemat {
    background: rgba(255, 184, 77, 0.16);
    color: var(--bara);
    border: 1.5px solid rgba(255, 184, 77, 0.45);
  }

  .streak-dot.lewat {
    background: rgba(255, 107, 74, 0.16);
    color: var(--api);
    border: 1.5px solid rgba(255, 107, 74, 0.45);
  }

  .streak-dot.kosong {
    background: var(--glass-1);
    color: var(--lumut);
    border: 1.5px solid var(--edge-soft);
  }

  .streak-dot.today {
    background: transparent;
    color: var(--komorebi);
    border: 1.5px dashed var(--aether);
  }

  .streak-title-text {
    font-size: 11px;
    font-weight: 700;
    color: var(--kabut);
    text-align: right;
  }

  .tanpa-jajan-glass-btn {
    width: 100%;
    padding: 10px 14px;
    background: var(--glass-1);
    border: 1px solid var(--edge-bright);
    border-radius: 14px;
    font-size: 13px;
    font-weight: 700;
    color: var(--komorebi);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: transform 120ms ease, background-color 150ms ease;
  }

  .tanpa-jajan-glass-btn:active {
    transform: scale(0.98);
    background: var(--glass-2);
  }

  .moon-icon {
    font-size: 14px;
  }

  /* 5. Kantong Anggaran */
  .envelopes-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 2px;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--komorebi);
    letter-spacing: -0.01em;
  }

  .manage-budget-chip {
    border: none;
    font-size: 12px;
    font-weight: 700;
    color: var(--aether);
    background: rgba(59, 154, 184, 0.08);
    border: 1px solid rgba(59, 154, 184, 0.22);
    border-radius: 999px;
    padding: 4px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: transform 120ms ease, background-color 150ms ease;
  }

  .manage-budget-chip:active {
    transform: scale(0.95);
    background: rgba(59, 154, 184, 0.16);
  }

  .chip-arrow {
    font-size: 14px;
    line-height: 1;
  }

  .envelopes-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .envelope-card {
    padding: 14px 16px;
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    cursor: pointer;
    transition: transform 120ms ease, border-color 150ms ease;
  }

  .envelope-card:active {
    transform: scale(0.985);
    border-color: var(--edge-bright);
  }

  .envelope-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .envelope-identity {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .envelope-icon-orb {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--glass-2);
    border: 1px solid var(--edge-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 0 12px rgba(94, 214, 230, 0.12);
  }

  .envelope-name-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .envelope-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--komorebi);
  }

  .envelope-limits {
    font-size: 12px;
    color: var(--kabut);
    font-weight: 500;
  }

  .envelope-pct-group {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .envelope-pct {
    font-size: 14px;
    font-weight: 700;
    color: var(--kabut);
  }

  .envelope-pct.text-api {
    color: var(--api);
    text-shadow: var(--glow-api);
  }

  .over-chip {
    font-size: 10px;
    font-weight: 800;
    color: var(--api);
  }

  .capsule-track {
    position: relative;
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
  }

  .capsule-fill {
    height: 100%;
    background: var(--aether);
    border-radius: 999px;
    box-shadow: var(--glow-aether);
  }

  .capsule-fill.fill-api {
    background: var(--api);
    box-shadow: var(--glow-api);
  }

  .threshold-85-marker {
    position: absolute;
    left: 85%;
    top: 0;
    bottom: 0;
    width: 2px;
    background: rgba(255, 107, 74, 0.6);
    z-index: 2;
  }

  /* 6. Jurnal Transaksi */
  .journal-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
  }

  .tx-filter-bar {
    display: flex;
    gap: 6px;
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    padding: 4px;
    border-radius: 14px;
  }

  .filter-tab {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--kabut);
    font-size: 12px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: 10px;
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease;
  }

  .filter-tab.active {
    background: var(--glass-3);
    color: var(--komorebi);
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .empty-journal-card {
    padding: 36px 20px;
    border-radius: 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .sleepy-cat-icon {
    font-size: 32px;
    margin-bottom: 4px;
  }

  .empty-main-text {
    font-size: 14px;
    font-weight: 700;
    color: var(--komorebi);
  }

  .empty-sub-text {
    font-size: 12px;
    color: var(--kabut);
  }

  .journal-groups {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .journal-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }

  .group-day-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--kabut);
  }

  .group-day-total {
    font-size: 12px;
    font-weight: 700;
    color: var(--api);
  }

  .group-items {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tx-item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-radius: 14px;
    cursor: pointer;
    transition: transform 120ms ease, border-color 150ms ease;
  }

  .tx-item-row:active {
    transform: scale(0.985);
    border-color: var(--edge-bright);
  }

  .tx-item-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .tx-badge-orb {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--glass-2);
    border: 1px solid var(--edge-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 17px;
    flex-shrink: 0;
  }

  .tx-badge-orb.tipe-masuk {
    border-color: rgba(56, 161, 105, 0.35);
    box-shadow: 0 0 8px rgba(56, 161, 105, 0.14);
  }

  .tx-badge-orb.tipe-keluar {
    border-color: rgba(209, 67, 67, 0.35);
    box-shadow: 0 0 8px rgba(209, 67, 67, 0.14);
  }

  .tx-badge-orb.tipe-tabung {
    border-color: rgba(217, 119, 6, 0.35);
    box-shadow: 0 0 8px rgba(217, 119, 6, 0.14);
  }

  .tx-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tx-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--komorebi);
  }

  .tx-meta-sub {
    font-size: 11px;
    color: var(--kabut);
  }

  .tx-item-right {
    font-size: 13px;
    font-weight: 700;
  }

  .amount-masuk {
    color: var(--tunas);
    text-shadow: 0 0 10px rgba(74, 222, 128, 0.25);
  }

  .amount-keluar {
    color: var(--api);
    text-shadow: 0 0 10px rgba(255, 92, 92, 0.25);
  }

  .amount-tabung {
    color: var(--bara);
    text-shadow: 0 0 10px rgba(251, 191, 36, 0.25);
  }

  /* Flash highlight 1.2s for newly added/edited row (PRD 12.4) */
  .tx-item-row.just-added {
    animation: flashHighlight 1.2s ease-out;
  }

  @keyframes flashHighlight {
    0% {
      background: rgba(255, 184, 77, 0.25);
      border-color: var(--bara);
      transform: scale(1.02);
    }
    100% {
      background: var(--glass-1);
      border-color: var(--edge-soft);
      transform: scale(1);
    }
  }

  /* Pull to refresh */
  .pull-refresh-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 14px;
    background: var(--glass-2);
    border: 1px solid var(--edge-soft);
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    color: var(--kabut);
    margin: 0 auto;
    width: fit-content;
  }

  /* Skeleton Loading State */
  .skeleton-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skeleton-block {
    background: linear-gradient(90deg, rgba(190, 255, 235, 0.04) 25%, rgba(190, 255, 235, 0.10) 50%, rgba(190, 255, 235, 0.04) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 16px;
    border: 1px solid var(--edge-soft);
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .skeleton-cat {
    height: 140px;
    border-radius: 24px;
  }

  .skeleton-nav {
    height: 36px;
    width: 60%;
    margin: 0 auto;
    border-radius: 999px;
  }

  .skeleton-card {
    height: 120px;
    border-radius: 28px;
  }

  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .skeleton-pill {
    height: 60px;
    border-radius: 16px;
  }

  .skeleton-category {
    height: 80px;
    border-radius: 20px;
  }
</style>
