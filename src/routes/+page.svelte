<script>
  import { getContext, onMount } from 'svelte';
  import CatWorld from '$lib/components/CatWorld.svelte';
  import AchievementSheet from '$lib/components/AchievementSheet.svelte';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
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
    isDataLoaded,
    ticker
  } from '$lib/stores/data.js';
  import { sync } from '$lib/stores/sync.js';
  import { calculateStreak, calculateBadges } from '$lib/gamification.js';

  const txManager = getContext('txManager');

  const INDO_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  let weekOffset = $state(0); // 0 = current week, -1 = last week, etc.

  const isCurrentWeek = $derived(weekOffset === 0);

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
    // End is 00:00 7 days later, so last day of week is 1 day before end
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

  // Categories for cards: keluar & tabung
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

  // Animated sisa amount (300ms counter animation per PRD 11.3)
  let animatedS = $state(0);
  let isInitialS = true;

  $effect(() => {
    const target = activeSummary.S;
    if (isInitialS) {
      animatedS = target;
      isInitialS = false;
      return;
    }
    const start = animatedS;
    if (target === start) return;
    const duration = 300;
    const startTime = performance.now();
    let animId;
    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      animatedS = Math.round(start + (target - start) * ease);
      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        animatedS = target;
      }
    }
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  });

  // Highlighted transaction ID for flash animation
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
    <!-- Skeleton state per PRD 11.7: abu bernada krem -->
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
    <!-- 1. CatWorld Mascot Top Area -->
    <section class="catworld-section" aria-label="Kucing Reaktif">
      <CatWorld
        r={activeSummary.r}
        sisa_hari={activeSummary.sisa_hari}
        streak={streakData.currentStreak}
        onregister={(fn) => txManager?.registerCatReaction?.(fn)}
      />
    </section>

    <!-- 2. Week Switcher -->
    <div class="week-switcher">
      <button
        type="button"
        class="week-nav-btn"
        onclick={() => (weekOffset -= 1)}
        aria-label="Minggu sebelumnya"
      >
        ‹
      </button>
      <span class="week-nav-label">{weekLabel}</span>
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

    <!-- 3. Income Banner if not recorded this week -->
    {#if isCurrentWeek && !hasIncomeThisWeek}
      <div class="income-banner">
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

    <!-- 4. Sisa Jajan Card -->
    <Card variant="neutral" class="sisa-card">
      <div class="sisa-card-header">
        <span class="sisa-title">
          {isCurrentWeek ? 'Sisa jajan minggu ini' : 'Sisa jajan minggu lalu'}
        </span>
        <span class="wallet-pill tabular-nums">
          Dompet {formatRp($walletBalance)}
        </span>
      </div>

      <div class="sisa-amount-row">
        <h2 class="sisa-amount tabular-nums {activeSummary.S < 0 ? 'over-budget' : ''}">
          {formatRp(activeSummary.S)}
        </h2>
        {#if activeSummary.S < 0}
          <span class="sisa-percent sisa-over-label tabular-nums">
            Lewat {formatRp(Math.abs(activeSummary.S))}
          </span>
        {:else}
          <span class="sisa-percent tabular-nums">
            {Math.round(Math.max(0, activeSummary.r * 100))}%
          </span>
        {/if}
      </div>

      <!-- Progress Bar (PRD 11.7: terlampaui -> bar merah penuh) -->
      <div class="sisa-progress-track">
        <div
          class="sisa-progress-fill {activeSummary.S < 0 ? 'bar-bad' : `status-${activeSummary.status}`}"
          style="width: {activeSummary.S < 0 ? 100 : Math.max(0, Math.min(100, Math.round(activeSummary.r * 100)))}%"
        ></div>
      </div>

      <!-- Daily Allowance (Current week only) -->
      {#if isCurrentWeek}
        <div class="daily-allowance-row">
          <span class="daily-label">Boleh jajan hari ini</span>
          <span class="daily-value tabular-nums">
            {#if activeSummary.jatah === 0}
              Jatah habis
            {:else if activeSummary.sisa_hari < 0}
              Lewat {formatRp(Math.abs(activeSummary.sisa_hari))} hari ini
            {:else}
              {formatRp(activeSummary.sisa_hari)}
            {/if}
          </span>
        </div>

        <!-- 7-day streak track (PRD 23.4) -->
        <div
          class="streak-track-row"
          role="button"
          tabindex="0"
          onclick={handleOpenAchievementSheet}
          onkeydown={(e) => e.key === 'Enter' && handleOpenAchievementSheet()}
          aria-label="Lihat pencapaian. {streakData.streakTitle}"
        >
          <div class="streak-badges-list">
            {#each streakData.last7Days as day}
              <span
                class="streak-pill-dot {day.type}"
                title="{day.dayLabel}: {day.type}"
              >
                {day.symbol}
              </span>
            {/each}
          </div>
          <span class="streak-title-label">
            {streakData.streakTitle}
          </span>
        </div>

        <!-- Tombol Hari ini tidak jajan (PRD 23.3) -->
        {#if streakData.canMarkTanpaJajanToday}
          <button
            type="button"
            class="tanpa-jajan-btn"
            onclick={handleMarkTanpaJajan}
          >
            Hari ini tidak jajan 🌙
          </button>
        {/if}
      {/if}
    </Card>

    <!-- 5. Mini Summary Cards (Keluar, Masuk, Tabung) -->
    <div class="summary-grid">
      <div class="summary-pill keluar">
        <span class="pill-label">💸 Keluar</span>
        <span class="pill-value tabular-nums">{formatRp(totalsByTipe.keluar)}</span>
      </div>
      <div class="summary-pill masuk">
        <span class="pill-label">💰 Masuk</span>
        <span class="pill-value tabular-nums">{formatRp(totalsByTipe.masuk)}</span>
      </div>
      <div class="summary-pill tabung">
        <span class="pill-label">🐷 Tabung</span>
        <span class="pill-value tabular-nums">{formatRp(totalsByTipe.tabung)}</span>
      </div>
    </div>

    <!-- 6. Category Cards -->
    <section class="categories-section" aria-label="Kategori Anggaran">
      <h3 class="section-heading">Kategori</h3>
      <div class="categories-list">
        {#each displayCategories as cat}
          {@const spent = categorySpentMap[cat.id] || 0}
          {@const limit = Number(cat.limit_mingguan) || 1}
          {@const pct = Math.round((spent / limit) * 100)}
          {@const isOver = spent > limit}

          <Card
            variant={cat.warna || cat.id}
            interactive
            class="cat-item-card"
            onclick={() => txManager?.openCreate?.({ kategori_id: cat.id, tipe: cat.tipe })}
          >
            <div class="cat-card-header">
              <div class="cat-identity">
                <span class="cat-icon">{cat.ikon}</span>
                <span class="cat-name">{cat.nama}</span>
              </div>
              <span class="cat-pct tabular-nums {isOver ? 'text-over' : ''}">
                {pct}%
              </span>
            </div>

            <div class="cat-progress-track">
              <div
                class="cat-progress-fill {isOver ? 'bar-over' : ''}"
                style="width: {Math.min(100, pct)}%"
              ></div>
            </div>

            <div class="cat-card-footer tabular-nums">
              <span class="cat-amounts">
                {formatRp(spent)} / {formatRp(limit)}
              </span>
              {#if isOver}
                <span class="cat-over-text">
                  Lewat {formatRp(spent - limit)}
                </span>
              {/if}
            </div>
          </Card>
        {/each}
      </div>
    </section>

    <!-- 7. Daily Transactions List / Empty State -->
    <section class="transactions-section" aria-label="Daftar Transaksi">
      {#if groupedTransactions.length === 0}
        <!-- Empty state per PRD 11.7 -->
        <div class="empty-state-box">
          <div class="empty-cat-paw" aria-hidden="true">🐾</div>
          <p class="empty-state-text">
            {#if isCurrentWeek}
              Belum ada catatan. Ketuk <strong>＋</strong> untuk jajan pertamamu.
            {:else}
              Tidak ada catatan di minggu ini.
            {/if}
          </p>
        </div>
      {:else}
        {#each groupedTransactions as group}
          <div class="daily-group">
            <div class="daily-group-header">
              <span class="daily-group-title">{group.dayLabel}</span>
              {#if group.totalKeluar > 0}
                <span class="daily-group-total tabular-nums">
                  −{formatRp(group.totalKeluar)}
                </span>
              {/if}
            </div>

            <div class="daily-items-list">
              {#each group.items as tx}
                {@const meta = getCategoryMeta(tx.kategori_id)}
                <div
                  class="tx-row-item {highlightedTxId === tx.id ? 'just-added' : ''}"
                  role="button"
                  tabindex="0"
                  onclick={() => txManager?.openEdit?.(tx)}
                  onkeydown={(e) => e.key === 'Enter' && txManager?.openEdit?.(tx)}
                >
                  <div class="tx-row-left">
                    <div
                      class="tx-icon-pill"
                      style="background-color: var(--cat-{meta?.warna || meta?.id || 'jajan'}-fill, #FBE0D3);"
                    >
                      {meta?.ikon || '🍙'}
                    </div>
                    <div class="tx-info">
                      <span class="tx-primary-label">
                        {tx.catatan || meta?.nama || 'Pengeluaran'}
                      </span>
                      <span class="tx-secondary-meta">
                        {#if tx.catatan && meta?.nama}
                          {meta.nama} ·
                        {/if}
                        {formatTime(tx.tanggal)}
                      </span>
                    </div>
                  </div>

                  <div class="tx-row-right tabular-nums">
                    {#if tx.tipe === 'keluar'}
                      <span class="tx-amount keluar">−{formatRp(tx.nominal)}</span>
                    {:else if tx.tipe === 'masuk'}
                      <span class="tx-amount masuk">+{formatRp(tx.nominal)}</span>
                    {:else}
                      <span class="tx-amount tabung">{formatRp(tx.nominal)}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </section>
  {/if}

  <AchievementSheet
    bind:open={isAchievementSheetOpen}
    currentStreak={streakData.currentStreak}
    bestStreak={streakData.bestStreak}
    badges={displayBadges}
    unlockedCount={displayUnlockedCount}
    totalBadges={rawBadges.totalBadges || 10}
    onclose={() => (isAchievementSheetOpen = false)}
  />
</div>

<style>
  .beranda-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* 1. CatWorld Section */
  .catworld-section {
    width: 100%;
  }

  /* 2. Week Switcher */
  .week-switcher {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
    background-color: transparent;
  }

  .week-nav-btn {
    border: none;
    background: transparent;
    font-size: 26px;
    color: var(--ink);
    cursor: pointer;
    padding: 4px 12px;
    line-height: 1;
    border-radius: 999px;
    transition: opacity 120ms ease-out;
  }

  .week-nav-btn:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .week-nav-btn:not(:disabled):active {
    background-color: var(--line);
  }

  .week-nav-label {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.2px;
  }

  /* 3. Income Banner */
  .income-banner {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background-color: var(--cat-masuk-fill);
    border: 2px solid var(--cat-masuk-border);
    border-bottom: 4px solid #E2C172;
    border-radius: var(--radius-card, 22px);
    padding: 12px 14px;
    color: var(--ink);
    box-sizing: border-box;
  }

  .banner-text {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
  }

  .banner-icon {
    font-size: 18px;
  }

  .banner-action-btn {
    align-self: flex-start;
    border: none;
    background-color: #E2C172;
    color: #4A3B32;
    font-size: 13px;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 999px;
    cursor: pointer;
    transition: transform 100ms ease-out;
  }

  .banner-action-btn:active {
    transform: scale(0.96);
  }

  /* 4. Sisa Card */
  .sisa-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sisa-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sisa-title {
    font-size: 14px;
    color: var(--mute);
    font-weight: 500;
  }

  .wallet-pill {
    font-size: 12px;
    font-weight: 700;
    color: var(--mute);
    background-color: #F8F0E0;
    border: 1px solid var(--line);
    padding: 3px 10px;
    border-radius: 999px;
  }

  .sisa-amount-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .sisa-amount {
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
    color: var(--ink);
  }

  .sisa-amount.over-budget {
    color: var(--bad);
  }

  .sisa-percent {
    font-size: 18px;
    font-weight: 700;
    color: var(--mute);
  }

  .sisa-over-label {
    font-size: 14px;
    font-weight: 700;
    color: var(--bad);
  }

  .sisa-progress-track {
    width: 100%;
    height: 12px;
    background-color: var(--line);
    border-radius: 999px;
    overflow: hidden;
  }

  .sisa-progress-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 350ms ease-out, background-color 300ms ease-out;
  }

  .sisa-progress-fill.status-good {
    background-color: var(--good);
  }

  .sisa-progress-fill.status-warn {
    background-color: var(--warn);
  }

  .sisa-progress-fill.status-bad,
  .sisa-progress-fill.bar-bad {
    background-color: var(--bad);
  }

  .daily-allowance-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 4px;
    border-top: 1px dashed var(--line);
    font-size: 13px;
  }

  .daily-label {
    color: var(--mute);
  }

  .daily-value {
    font-weight: 700;
    color: var(--ink);
  }

  /* 7-Day Streak Track Row (PRD 23.4) */
  .streak-track-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--line);
    cursor: pointer;
    border-radius: 8px;
    transition: opacity 120ms ease-out;
  }

  .streak-track-row:active {
    opacity: 0.8;
  }

  .streak-badges-list {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .streak-pill-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    line-height: 1;
    box-sizing: border-box;
    transition: transform 120ms ease-out;
  }

  .streak-pill-dot.hemat {
    background-color: #FBE6D3;
    color: #D97736;
    border: 1.5px solid #F3C7A2;
  }

  .streak-pill-dot.lewat {
    background-color: #FCE8E6;
    color: #D96B6B;
    border: 1.5px solid #F7C8C4;
  }

  .streak-pill-dot.kosong {
    background-color: #F3EFE9;
    color: #9E9485;
    border: 1.5px solid #E2DDD5;
  }

  .streak-pill-dot.today {
    background-color: transparent;
    color: var(--ink);
    border: 1.5px dashed #A89F91;
  }

  .streak-title-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--mute);
    text-align: right;
  }

  /* Tanpa Jajan Button (PRD 23.3) */
  .tanpa-jajan-btn {
    width: 100%;
    margin-top: 6px;
    padding: 8px 12px;
    background-color: var(--card);
    border: 2px solid var(--accent);
    border-bottom: 3px solid var(--accent-pressed);
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: transform 100ms ease-out, border-bottom 100ms ease-out;
  }

  .tanpa-jajan-btn:active {
    transform: translateY(2px);
    border-bottom-width: 1px;
  }

  /* 5. Summary Grid */
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .summary-pill {
    background-color: var(--card);
    border: 1.5px solid var(--line);
    border-bottom: 3px solid #D6C8B2;
    border-radius: 16px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-sizing: border-box;
  }

  .pill-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--mute);
  }

  .pill-value {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
  }

  /* 6. Categories Section */
  .categories-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-heading {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
    padding-left: 2px;
  }

  .categories-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .cat-item-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cat-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .cat-identity {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cat-icon {
    font-size: 18px;
    line-height: 1;
  }

  .cat-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }

  .cat-pct {
    font-size: 13px;
    font-weight: 700;
    color: var(--mute);
  }

  .cat-pct.text-over {
    color: var(--bad);
  }

  .cat-progress-track {
    width: 100%;
    height: 10px;
    background-color: rgba(255, 255, 255, 0.55);
    border-radius: 999px;
    overflow: hidden;
  }

  .cat-progress-fill {
    height: 100%;
    background-color: var(--good);
    border-radius: 999px;
    transition: width 350ms ease-out;
  }

  .cat-progress-fill.bar-over {
    background-color: var(--bad);
  }

  .cat-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: var(--ink);
  }

  .cat-amounts {
    font-weight: 700;
  }

  .cat-over-text {
    font-size: 12px;
    font-weight: 700;
    color: var(--bad);
  }

  /* 7. Transactions Section */
  .transactions-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 4px;
  }

  .empty-state-box {
    background-color: var(--card);
    border: 2px dashed var(--line);
    border-radius: var(--radius-card, 22px);
    padding: 32px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .empty-cat-paw {
    font-size: 28px;
    opacity: 0.6;
  }

  .empty-state-text {
    font-size: 14px;
    color: var(--mute);
    line-height: 1.4;
  }

  .daily-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .daily-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }

  .daily-group-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--mute);
  }

  .daily-group-total {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
  }

  .daily-items-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tx-row-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--card);
    border: 1.5px solid var(--line);
    border-bottom: 3px solid #D6C8B2;
    border-radius: 16px;
    padding: 10px 14px;
    cursor: pointer;
    transition: transform 120ms ease-out, background-color 120ms ease-out;
    box-sizing: border-box;
  }

  .tx-row-item:active {
    transform: translateY(1px);
    background-color: #F8F0E0;
  }

  .tx-row-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .tx-icon-pill {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }

  .tx-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tx-primary-label {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
  }

  .tx-secondary-meta {
    font-size: 12px;
    color: var(--mute);
  }

  .tx-row-right {
    font-size: 14px;
    font-weight: 700;
  }

  .tx-amount.keluar {
    color: var(--ink);
  }

  .tx-amount.masuk {
    color: var(--good);
  }

  .tx-amount.tabung {
    color: var(--accent-pressed);
  }

  /* Pull to refresh */
  .pull-refresh-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    background-color: var(--card);
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    color: var(--mute);
    margin: 0 auto;
    width: fit-content;
  }

  /* Skeleton Loading State (PRD 11.7: abu bernada krem) */
  .skeleton-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skeleton-block {
    background: linear-gradient(90deg, #EDE5D5 25%, #F4EEE3 50%, #EDE5D5 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 16px;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .skeleton-cat {
    height: 140px;
    border-radius: var(--radius-card, 22px);
  }

  .skeleton-nav {
    height: 36px;
    width: 60%;
    margin: 0 auto;
    border-radius: 999px;
  }

  .skeleton-card {
    height: 120px;
    border-radius: var(--radius-card, 22px);
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
    border-radius: var(--radius-card, 22px);
  }

  /* Flash highlight 1.2s for newly added/edited row (PRD 12.4) */
  .tx-row-item.just-added {
    animation: flashHighlight 1.2s ease-out;
  }

  @keyframes flashHighlight {
    0% {
      background-color: #FFF2CC;
      border-color: #E2C172;
      transform: scale(1.02);
    }
    100% {
      background-color: var(--card);
      border-color: var(--line);
      transform: scale(1);
    }
  }
</style>
