<script>
  import { getContext, onMount } from 'svelte';
  import CatWorld from '$lib/components/CatWorld.svelte';
  import AchievementSheet from '$lib/components/AchievementSheet.svelte';
  import CategorySheet from '$lib/components/CategorySheet.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import StatStrip from '$lib/components/StatStrip.svelte';
  import TransactionRow from '$lib/components/TransactionRow.svelte';
  import ExpenseLineChart from '$lib/components/ExpenseLineChart.svelte';
  import { formatRp } from '$lib/money.js';
  import { rupiah, compact } from '$lib/format.js';
  import {
    getWeekRange,
    isDateInWeek,
    calculateBudgetFormulas,
    getWIBParts
  } from '$lib/week.js';
  import { calculateLast7DaysSpending } from '$lib/stats.js';
  import { floatView } from '$lib/actions/floatView.js';
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
  let isCatWorldModalOpen = $state(false);
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

  // Week switcher label
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

  // Hero Status Text & Color (DESIGN.md Section 5)
  const heroStatus = $derived.by(() => {
    const s = activeSummary.S;
    const a = activeSummary.A;
    const p = activeSummary.P;
    if (s < 0) {
      return {
        label: `Lewat ${rupiah(Math.abs(s))}`,
        color: 'var(--expense)',
        type: 'lewat'
      };
    }
    const ratio = a > 0 ? p / a : 0;
    if (ratio >= 0.8) {
      return {
        label: `Hampir habis · sisa ${compact(s)}`,
        color: 'var(--warn)',
        type: 'hampir'
      };
    }
    return {
      label: 'Aman',
      color: 'var(--accent)',
      type: 'aman'
    };
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

  // 7 hari terakhir spending and daily budget limit
  const last7DaysData = $derived.by(() => {
    const _tick = $ticker;
    return calculateLast7DaysSpending({
      transactions: $transactions || [],
      todayDate: new Date()
    });
  });

  const dailyBudgetLimit = $derived.by(() => {
    const weeklyLimit =
      ($budgets || [])
        .filter((b) => b.tipe === 'keluar')
        .reduce((sum, b) => sum + (Number(b.limit_mingguan) || 0), 0) || 116000;
    return Math.round(weeklyLimit / 7);
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

  // Filtered transactions by type segment
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

  // Gamification & Streak state
  let isAchievementSheetOpen = $state(false);
  let hasShownBadgeToastThisSession = false;
  let seenBadgeIds = $state(new Set());
  let everUnlockedBadgeIds = $state(new Set());
  let catReactionCallback = null;

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

    txManager?.registerCatReaction?.((actionType, detail) => {
      catReactionCallback?.(actionType, detail);
    });
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

  // Set active week date for creation modal preset
  $effect(() => {
    if (weekOffset !== 0) {
      const mid = new Date(activeWeekRange.start.getTime() + 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
      txManager?.setActiveWeekDate?.(mid.toISOString());
    } else {
      txManager?.setActiveWeekDate?.(null);
    }
  });

  // Pull to refresh support
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
      <span>{isRefreshing ? 'Menyegarkan...' : 'Tarik untuk menyegarkan'}</span>
    </div>
  {/if}

  {#if !$isDataLoaded}
    <!-- Loading skeleton state -->
    <div class="skeleton-wrapper" aria-label="Memuat data">
      <div class="skeleton-line" style="width: 40%; height: 20px;"></div>
      <div class="skeleton-line" style="width: 70%; height: 48px; margin: 16px 0;"></div>
      <div class="skeleton-line" style="width: 100%; height: 60px;"></div>
      <div class="skeleton-line" style="width: 100%; height: 120px;"></div>
    </div>
  {:else}
    <!-- 1. Header Atas Beranda -->
    <header class="beranda-header float-item" use:floatView>
      <div class="header-top-row">
        <div class="greeting-group">
          <span class="greeting-title">{greeting}</span>
          <!-- Week Switcher -->
          <div class="week-switch-row">
            <button
              type="button"
              class="week-nav-btn"
              onclick={() => (weekOffset -= 1)}
              aria-label="Minggu sebelumnya"
            >
              ‹
            </button>
            <span class="week-text-label">{weekLabel}</span>
            <button
              type="button"
              class="week-nav-btn"
              disabled={isCurrentWeek}
              onclick={() => !isCurrentWeek && (weekOffset += 1)}
              aria-label="Minggu berikutnya"
            >
              ›
            </button>
          </div>
        </div>

        <!-- Tombol Kucing CatWorld & Pencapaian (min 44x44px tap target) -->
        <button
          type="button"
          class="catworld-trigger-btn"
          onclick={() => (isCatWorldModalOpen = true)}
          aria-label="Buka CatWorld dan Pencapaian"
        >
          <span class="cat-btn-icon" aria-hidden="true">🐱</span>
          <span class="cat-btn-streak num">{streakData.currentStreak}d</span>
        </button>
      </div>
    </header>

    <!-- 2. Income Reminder Banner if not recorded this week -->
    {#if isCurrentWeek && !hasIncomeThisWeek}
      <div class="income-banner float-item" use:floatView>
        <span class="income-banner-text">Uang jajan minggu ini belum dicatat</span>
        <button
          type="button"
          class="income-banner-action"
          onclick={handleRecordIncome}
        >
          Catat {formatRp($settings?.uang_jajan_mingguan || 145000)}
        </button>
      </div>
    {/if}

    <!-- 3. Hero Saldo / Sisa Utama (DESIGN.md Section 1, 2.2, 5) -->
    <section class="hero-section float-item" use:floatView aria-label="Sisa Uang">
      <div class="hero-top-info">
        <span class="hero-label">
          {isCurrentWeek ? 'Sisa uang minggu ini' : 'Sisa uang minggu lalu'}
        </span>
        <button
          type="button"
          class="wallet-pill-btn"
          onclick={toggleBalancePrivacy}
          aria-label={isBalanceHidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
        >
          <span class="wallet-pill-label">Dompet</span>
          <span class="wallet-pill-val num">
            {#if isBalanceHidden}••••••{:else}{rupiah($walletBalance)}{/if}
          </span>
        </button>
      </div>

      <div class="hero-amount-row">
        <h2 class="hero-amount font-num num" class:over-limit={activeSummary.S < 0}>
          {#if isBalanceHidden}
            Rp •••••••
          {:else}
            <AnimatedNumber value={activeSummary.S} />
          {/if}
        </h2>
      </div>

      <!-- Teks Status Pendamping -->
      <div class="hero-status-row">
        <span class="status-dot" style:background={heroStatus.color}></span>
        <span class="status-text" style:color={heroStatus.color}>
          {heroStatus.label}
        </span>
      </div>
    </section>

    <!-- 4. StatStrip Ringkas 3 Kolom (DESIGN.md Section 4.3) -->
    <div class="float-item" use:floatView>
      <StatStrip
        items={[
          {
            label: 'Masuk',
            value: isBalanceHidden ? '••••' : (totalsByTipe.masuk >= 1000000 ? compact(totalsByTipe.masuk) : rupiah(totalsByTipe.masuk)),
            color: 'var(--accent)',
            onclick: () => txManager?.openCreate?.({ tipe: 'masuk' })
          },
          {
            label: 'Keluar',
            value: isBalanceHidden ? '••••' : (totalsByTipe.keluar >= 1000000 ? compact(totalsByTipe.keluar) : rupiah(totalsByTipe.keluar)),
            color: 'var(--expense)',
            onclick: () => txManager?.openCreate?.({ tipe: 'keluar' })
          },
          {
            label: 'Tabung',
            value: isBalanceHidden ? '••••' : (totalsByTipe.tabung >= 1000000 ? compact(totalsByTipe.tabung) : rupiah(totalsByTipe.tabung)),
            color: 'var(--warn)',
            onclick: () => txManager?.openCreate?.({ tipe: 'tabung' })
          }
        ]}
      />
    </div>

    <!-- 5. Batas Harian (Daily Allowance Meter, Current week only) -->
    {#if isCurrentWeek}
      <section class="daily-allowance-section float-item" use:floatView aria-label="Batas Harian">
        <div class="daily-meta-row">
          <span class="daily-label">Batas Hari Ini</span>
          <span class="daily-details num">
            {#if dailySisa < 0}
              <span class={activeSummary.S < 0 ? 'daily-over' : 'daily-warn'}>
                Lewat jatah {rupiah(Math.abs(dailySisa))}
              </span>
            {:else}
              <span>Sisa {rupiah(dailySisa)} / Jatah {rupiah(dailyJatah)}</span>
            {/if}
          </span>
        </div>
        <ProgressBar
          value={dailyJatah > 0 ? dailySpent / dailyJatah : 0}
          color={activeSummary.S < 0 ? 'var(--expense)' : dailySisa < 0 ? 'var(--warn)' : dailySpentPct >= 80 ? 'var(--warn)' : 'var(--accent)'}
        />
      </section>
    {/if}

    <!-- 6. Grafik Garis 7 Hari Terakhir & Batas Budget Harian -->
    <section class="weekly-chart-section float-item" use:floatView aria-label="Pengeluaran 7 Hari Terakhir">
      <div class="section-title-bar">
        <h3 class="section-heading">7 hari terakhir</h3>
        <span class="section-meta num">Rata-rata {rupiah(last7DaysData.average)}</span>
      </div>
      <ExpenseLineChart
        data={last7DaysData.days}
        dailyBudget={dailyBudgetLimit}
        average={last7DaysData.average}
      />
    </section>

    <!-- 7. Kantong Anggaran (DESIGN.md Section 4.6 BudgetRow) -->
    <section class="budgets-section float-item" use:floatView aria-label="Kantong Anggaran">
      <div class="section-title-bar">
        <h3 class="section-heading">Kantong anggaran</h3>
        <button
          type="button"
          class="section-sub-link"
          onclick={() => {
            selectedCategoryToEdit = null;
            isCategorySheetOpen = true;
          }}
        >
          Atur jatah ›
        </button>
      </div>

      <div class="budget-rows-list">
        {#each displayCategories as cat}
          {@const spent = categorySpentMap[cat.id] || 0}
          {@const limit = Number(cat.limit_mingguan) || 1}
          {@const ratio = limit > 0 ? spent / limit : 0}
          {@const isOver = spent > limit}
          {@const isNear = ratio >= 0.8 && !isOver}

          <button
            type="button"
            class="budget-item-row"
            onclick={() => txManager?.openCreate?.({ kategori_id: cat.id, tipe: cat.tipe })}
          >
            <div class="budget-top-line">
              <div class="budget-title-wrap">
                <span class="budget-emoji" aria-hidden="true">{cat.ikon}</span>
                <span class="budget-name">{cat.nama}</span>
              </div>
              <div class="budget-values num">
                <span class="budget-spent-val" class:val-over={isOver}>{rupiah(spent)}</span>
                <span class="budget-limit-val"> / {rupiah(limit)}</span>
              </div>
            </div>

            <ProgressBar
              value={ratio}
              color={isOver ? 'var(--expense)' : isNear ? 'var(--warn)' : 'var(--accent)'}
            />

            {#if isOver}
              <div class="budget-status-line num over">Lewat +{rupiah(spent - limit)}</div>
            {:else if isNear}
              <div class="budget-status-line num near">Hampir habis · sisa {rupiah(limit - spent)}</div>
            {/if}
          </button>
        {/each}
      </div>
    </section>

    <!-- 7. Daftar Transaksi (DESIGN.md Section 4.1 & 4.2) -->
    <section class="transactions-section float-item" use:floatView aria-label="Daftar Transaksi">
      <div class="section-title-bar">
        <h3 class="section-heading">Transaksi</h3>
        <!-- Filter Tabs -->
        <div class="filter-group" role="tablist">
          {#each ['semua', 'keluar', 'masuk'] as f}
            <button
              type="button"
              class="filter-chip"
              class:selected={txFilter === f}
              role="tab"
              aria-selected={txFilter === f}
              onclick={() => (txFilter = f)}
            >
              {f === 'semua' ? 'Semua' : f === 'keluar' ? 'Keluar' : 'Masuk'}
            </button>
          {/each}
        </div>
      </div>

      {#if filteredGroupedTransactions.length === 0}
        <div class="empty-tx-box">
          <p class="empty-message">Belum ada transaksi di minggu ini.</p>
          <button
            type="button"
            class="empty-cta-btn"
            onclick={() => txManager?.openCreate?.(null)}
          >
            Catat transaksi pertama
          </button>
        </div>
      {:else}
        <div class="tx-groups-container">
          {#each filteredGroupedTransactions as group}
            <div class="day-group">
              <div class="day-group-header">
                <span class="day-header-label">{group.dayLabel}</span>
                {#if group.totalKeluar > 0 && txFilter !== 'masuk'}
                  <span class="day-header-total num">−{rupiah(group.totalKeluar)}</span>
                {/if}
              </div>

              <div class="tx-items-list">
                {#each group.items as tx}
                  {@const meta = getCategoryMeta(tx.kategori_id)}
                  <TransactionRow
                    title={tx.catatan || meta?.nama || 'Pengeluaran'}
                    subtitle={`${meta?.nama ? meta.nama + ' · ' : ''}${formatTime(tx.tanggal)}`}
                    amount={Number(tx.nominal) || 0}
                    type={tx.tipe}
                    onclick={() => txManager?.openEdit?.(tx)}
                    class={highlightedTxId === tx.id ? 'just-highlighted' : ''}
                  />
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  <!-- CatWorld & Pencapaian Modal -->
  <BottomSheet
    bind:open={isCatWorldModalOpen}
    title="CatWorld & Pencapaian"
    onclose={() => (isCatWorldModalOpen = false)}
  >
    <div class="catworld-modal-body">
      <!-- Mascot Display -->
      <div class="catworld-mascot-box">
        <CatWorld
          r={activeSummary.r}
          sisa_hari={activeSummary.sisa_hari}
          streak={streakData.currentStreak}
          onregister={(fn) => { catReactionCallback = fn; }}
        />
      </div>

      <!-- Streak Status Box -->
      <div class="streak-card-box">
        <div class="streak-card-header">
          <span class="streak-card-title">{streakData.streakTitle}</span>
          <span class="streak-card-count num">🔥 {streakData.currentStreak} hari</span>
        </div>
        <div class="streak-dots-track">
          {#each streakData.last7Days as day}
            <span class="streak-dot-pill {day.type}" title="{day.dayLabel}: {day.type}">
              {day.symbol}
            </span>
          {/each}
        </div>
      </div>

      <!-- Tombol Hari ini tidak jajan -->
      {#if streakData.canMarkTanpaJajanToday}
        <Button
          variant="secondary"
          full
          onclick={handleMarkTanpaJajan}
          class="tanpa-jajan-action-btn"
        >
          <span>Hari ini tidak jajan</span>
          <span>🌙</span>
        </Button>
      {/if}

      <!-- Achievements Bar -->
      <div class="achievements-quick-bar">
        <div class="achievements-text">
          <span class="achieve-title-text">Lencana Terkumpul</span>
          <span class="achieve-count-text num">{displayUnlockedCount} dari {rawBadges.totalBadges || 10} tercapai</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onclick={() => {
            isCatWorldModalOpen = false;
            handleOpenAchievementSheet();
          }}
        >
          Lihat Semua
        </Button>
      </div>
    </div>
  </BottomSheet>

  <!-- Full Achievement Modal -->
  <AchievementSheet
    bind:open={isAchievementSheetOpen}
    currentStreak={streakData.currentStreak}
    bestStreak={streakData.bestStreak}
    badges={displayBadges}
    unlockedCount={displayUnlockedCount}
    totalBadges={rawBadges.totalBadges || 10}
    onclose={() => (isAchievementSheetOpen = false)}
  />

  <!-- Category Editor Modal -->
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
    gap: 32px;
    width: 100%;
    box-sizing: border-box;
  }

  /* Pull to refresh */
  .pull-refresh-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 0;
    font-size: var(--fs-cap, 13px);
    color: var(--fg-muted);
  }

  /* Skeleton */
  .skeleton-wrapper {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px 0;
  }

  .skeleton-line {
    background: var(--track);
    border-radius: var(--r-bar, 4px);
  }

  /* 1. Header */
  .beranda-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .header-top-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .greeting-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .greeting-title {
    font-size: var(--fs-sm, 14px);
    font-weight: 500;
    color: var(--fg-muted);
    margin: 0;
  }

  .week-switch-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .week-nav-btn {
    border: none;
    background: transparent;
    color: var(--fg-muted);
    font-size: 18px;
    padding: 0 4px;
    cursor: pointer;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 120ms var(--ease);
  }

  .week-nav-btn:hover:not(:disabled) {
    color: var(--fg);
  }

  .week-nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .week-text-label {
    font-size: var(--fs-cap, 13px);
    font-weight: 500;
    color: var(--fg);
  }

  /* Tombol Akses CatWorld (min 44x44px tap target) */
  .catworld-trigger-btn {
    min-width: 44px;
    min-height: 44px;
    padding: 6px 12px;
    border: 1px solid var(--line);
    border-radius: var(--r, 10px);
    background: var(--bg-raised);
    color: var(--fg);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    box-shadow: none;
    transition: opacity 120ms var(--ease);
  }

  .catworld-trigger-btn:active {
    opacity: 0.8;
  }

  .cat-btn-icon {
    font-size: 18px;
    line-height: 1;
  }

  .cat-btn-streak {
    font-size: 13px;
    font-weight: 600;
    color: var(--warn);
    line-height: 1;
  }

  /* Income Banner */
  .income-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border: 1px solid var(--line);
    border-radius: var(--r, 10px);
    background: var(--bg-raised);
    font-size: var(--fs-sm, 14px);
    color: var(--fg);
  }

  .income-banner-action {
    border: none;
    background: var(--accent);
    color: var(--on-accent);
    padding: 8px 12px;
    border-radius: var(--r-bar, 4px);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  /* 2. Hero Section */
  .hero-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 0;
  }

  .hero-top-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .hero-label {
    font-size: var(--fs-sm, 14px);
    color: var(--fg-muted);
  }

  .wallet-pill-btn {
    border: 1px solid var(--line);
    background: var(--bg-raised);
    color: var(--fg-muted);
    border-radius: var(--r, 10px);
    padding: 4px 10px;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: opacity 120ms var(--ease);
  }

  .wallet-pill-btn:active {
    opacity: 0.8;
  }

  .wallet-pill-val {
    color: var(--fg);
    font-weight: 500;
  }

  .hero-amount-row {
    display: flex;
    align-items: baseline;
  }

  .hero-amount {
    font-family: var(--font-display);
    font-size: var(--fs-hero, clamp(40px, 11vw, 48px));
    font-weight: 400;
    color: var(--fg);
    line-height: 1.1;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .hero-amount.over-limit {
    color: var(--expense);
  }

  .hero-status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-sm, 14px);
    font-weight: 500;
    margin-top: 4px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-text {
    line-height: 1;
  }

  /* 3. Daily Allowance */
  .daily-allowance-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .daily-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--fs-cap, 13px);
  }

  .daily-label {
    color: var(--fg-muted);
  }

  .daily-details {
    color: var(--fg);
    font-weight: 500;
  }

  .daily-over {
    color: var(--expense);
    font-weight: 600;
  }

  .daily-warn {
    color: var(--warn);
    font-weight: 600;
  }

  /* 4. Chart 7 Hari */
  .weekly-chart-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-meta {
    font-size: var(--fs-sm, 14px);
    color: var(--fg-muted);
  }

  /* 5. Kantong Anggaran */
  .budgets-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-heading {
    font-family: var(--font-ui);
    font-size: var(--fs-h, 18px);
    font-weight: 600;
    color: var(--fg);
    margin: 0;
  }

  .section-sub-link {
    border: none;
    background: transparent;
    color: var(--fg-muted);
    font-size: var(--fs-sm, 14px);
    cursor: pointer;
    padding: 4px 0;
  }

  .section-sub-link:hover {
    color: var(--fg);
  }

  .budget-rows-list {
    display: flex;
    flex-direction: column;
  }

  .budget-item-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 0;
    border: none;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
    background: transparent;
    text-align: left;
    width: 100%;
    font-family: inherit;
    color: inherit;
    transition: opacity 120ms var(--ease);
  }

  .budget-item-row:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .budget-item-row:active {
    opacity: 0.7;
  }

  .budget-top-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .budget-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .budget-emoji {
    font-size: 16px;
  }

  .budget-name {
    font-size: var(--fs-body, 16px);
    font-weight: 500;
    color: var(--fg);
  }

  .budget-values {
    font-size: var(--fs-sm, 14px);
  }

  .budget-spent-val {
    font-weight: 500;
    color: var(--fg);
  }

  .budget-spent-val.val-over {
    color: var(--expense);
  }

  .budget-limit-val {
    color: var(--fg-muted);
  }

  .budget-status-line {
    font-size: var(--fs-cap, 13px);
  }

  .budget-status-line.over {
    color: var(--expense);
  }

  .budget-status-line.near {
    color: var(--warn);
  }

  /* 5. Transaksi Section */
  .transactions-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-chip {
    border: 1px solid var(--line);
    background: transparent;
    color: var(--fg-muted);
    font-size: 13px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: var(--r, 10px);
    cursor: pointer;
    transition: background-color 120ms var(--ease), color 120ms var(--ease);
  }

  .filter-chip.selected {
    background: var(--fg);
    color: var(--bg);
    border-color: var(--fg);
  }

  .empty-tx-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 36px 16px;
    gap: 12px;
    text-align: center;
    border: 1px dashed var(--line);
    border-radius: var(--r, 10px);
  }

  .empty-message {
    font-size: var(--fs-sm, 14px);
    color: var(--fg-muted);
    margin: 0;
  }

  .empty-cta-btn {
    border: 1px solid var(--line);
    background: var(--bg-raised);
    color: var(--fg);
    padding: 8px 16px;
    border-radius: var(--r, 10px);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  .tx-groups-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .day-group {
    display: flex;
    flex-direction: column;
  }

  .day-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 0 6px;
    font-size: var(--fs-sm, 14px);
    color: var(--fg-muted);
  }

  .day-header-label {
    font-weight: 500;
  }

  .day-header-total {
    font-weight: 500;
  }

  .tx-items-list {
    display: flex;
    flex-direction: column;
  }

  :global(.just-highlighted) {
    animation: flashRow 1.2s ease-out;
  }

  @keyframes flashRow {
    0% { background: var(--track); }
    100% { background: transparent; }
  }

  /* CatWorld Modal Content */
  .catworld-modal-body {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .catworld-mascot-box {
    width: 100%;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .streak-card-box {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--r, 10px);
  }

  .streak-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .streak-card-title {
    font-size: var(--fs-sm, 14px);
    font-weight: 600;
    color: var(--fg);
  }

  .streak-card-count {
    font-size: 14px;
    font-weight: 600;
    color: var(--warn);
  }

  .streak-dots-track {
    display: flex;
    gap: 6px;
    justify-content: space-between;
  }

  .streak-dot-pill {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 0;
    border-radius: var(--r-bar, 4px);
    background: var(--track);
    font-size: 12px;
    color: var(--fg);
  }

  .achievements-quick-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: var(--r, 10px);
    background: var(--bg);
  }

  .achievements-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .achieve-title-text {
    font-size: var(--fs-sm, 14px);
    font-weight: 600;
    color: var(--fg);
  }

  .achieve-count-text {
    font-size: var(--fs-cap, 13px);
    color: var(--fg-muted);
  }
</style>
