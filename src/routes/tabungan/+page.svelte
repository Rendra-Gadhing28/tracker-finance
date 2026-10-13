<script>
  import { getContext } from 'svelte';
  import confetti from 'canvas-confetti';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import GoalSheet from '$lib/components/GoalSheet.svelte';
  import { formatRp } from '$lib/money.js';
  import { getWIBParts } from '$lib/week.js';
  import { calculateGoalMetrics } from '$lib/goals.js';
  import {
    goals,
    transactions,
    budgets,
    settings,
    saveGoal,
    deleteGoal,
    addTransaction,
    deleteTransaction
  } from '$lib/stores/index.js';

  const txManager = getContext('txManager');

  const INDO_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const DEPOSIT_AMOUNTS = [2000, 5000, 10000, 25000, 50000];

  let selectedGoalId = $state(null);
  let isGoalSheetOpen = $state(false);
  let goalSheetMode = $state('create'); // 'create' | 'edit'
  let activeGoalForSheet = $state(null);

  let selectedDepositChip = $state(10000);
  let showReachedCollapsible = $state(false);
  let showDetailMenu = $state(false);
  let celebratedBannerGoalName = $state('');

  // Weekly Nabung budget category limit (default 29.000)
  const nabungCategory = $derived.by(() => {
    return ($budgets || []).find((b) => b.tipe === 'tabung') || {
      id: 'nabung',
      nama: 'Nabung',
      ikon: '🐷',
      warna: 'nabung',
      limit_mingguan: 29000,
      tipe: 'tabung'
    };
  });

  const weeklyNabungLimit = $derived(Number(nabungCategory.limit_mingguan) || 29000);

  // Compute goals metrics
  const metrics = $derived.by(() => {
    return calculateGoalMetrics({
      goals: $goals,
      transactions: $transactions,
      weeklyNabungLimit,
      startDayOfWeek: $settings?.awal_minggu ?? 1,
      now: new Date()
    });
  });

  // Selected goal object if in Detail View
  const selectedGoal = $derived.by(() => {
    if (!selectedGoalId) return null;
    return metrics.goalsWithMetrics.find((g) => g.id === selectedGoalId) || null;
  });

  const activeGoals = $derived.by(() => {
    return metrics.goalsWithMetrics.filter((g) => !g.isReached);
  });

  const reachedGoals = $derived.by(() => {
    return metrics.goalsWithMetrics.filter((g) => g.isReached);
  });

  function openCreateGoal() {
    if (metrics.isMaxGoalsReached) return;
    goalSheetMode = 'create';
    activeGoalForSheet = null;
    isGoalSheetOpen = true;
  }

  function openEditGoal(goal) {
    goalSheetMode = 'edit';
    activeGoalForSheet = goal;
    showDetailMenu = false;
    isGoalSheetOpen = true;
  }

  async function handleSaveGoal(goalData) {
    await saveGoal(goalData);
    txManager?.showToast?.(`Target ${goalData.nama} disimpan`);
  }

  async function handleDeleteGoal(goalId) {
    const deleted = ($goals || []).find((g) => g.id === goalId);
    await deleteGoal(goalId);
    if (selectedGoalId === goalId) {
      selectedGoalId = null;
    }
    txManager?.showToast?.(`Target dihapus`, async () => {
      if (deleted) await saveGoal(deleted);
    });
  }

  async function handleQuickDeposit() {
    if (!selectedGoal || !selectedDepositChip) return;

    const nominal = selectedDepositChip;
    const goal = selectedGoal;
    const cat = nabungCategory;

    const created = await addTransaction({
      tipe: 'tabung',
      kategori_id: cat.id,
      goal_id: goal.id,
      nominal,
      catatan: `Setor untuk ${goal.nama}`
    });

    txManager?.showToast?.(`Disetor ${formatRp(nominal)}`, async () => {
      await deleteTransaction(created.id);
    });

    // Check celebration
    const isNowReached = goal.terkumpul + nominal >= goal.target;
    if (isNowReached && typeof localStorage !== 'undefined') {
      const storageKey = `celebrated_goal_${goal.id}`;
      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, 'true');
        celebratedBannerGoalName = goal.nama;
        confetti({
          particleCount: 75,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#E59A6A', '#FBE1E7', '#F2B8C6', '#B5D6A0', '#BFE0E6', '#F4D58D'],
          disableForReducedMotion: true
        });
        setTimeout(() => {
          celebratedBannerGoalName = '';
        }, 6000);
      }
    }
  }

  function formatDateShort(iso) {
    if (!iso) return '';
    const p = getWIBParts(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(p.date)} ${INDO_MONTHS[p.month]}`;
  }
</script>

<svelte:head>
  <title>Tabungan · Neko Dompet</title>
</svelte:head>

<div class="tabungan-page">
  {#if celebratedBannerGoalName}
    <div class="celebration-banner" role="alert">
      <span class="celebration-icon">🎉</span>
      <div class="celebration-text">
        <strong>Target tercapai!</strong>
        <span>Selamat, {celebratedBannerGoalName} sudah terpenuhi!</span>
      </div>
    </div>
  {/if}

  {#if selectedGoal}
    <!-- ============================================== -->
    <!-- DETAIL TARGET VIEW (PRD 18.4)                 -->
    <!-- ============================================== -->
    <div class="detail-view">
      <!-- Detail Header -->
      <div class="detail-header">
        <button
          type="button"
          class="back-btn"
          onclick={() => { selectedGoalId = null; showDetailMenu = false; }}
          aria-label="Kembali ke daftar target"
        >
          ←
        </button>
        <h2 class="detail-title">{selectedGoal.nama}</h2>
        <div class="detail-menu-wrap">
          <button
            type="button"
            class="menu-dots-btn"
            onclick={() => (showDetailMenu = !showDetailMenu)}
            aria-label="Menu target"
          >
            ⋯
          </button>
          {#if showDetailMenu}
            <div class="menu-dropdown">
              <button
                type="button"
                class="dropdown-item"
                onclick={() => openEditGoal(selectedGoal)}
              >
                ✏️ Ubah target
              </button>
              <button
                type="button"
                class="dropdown-item text-danger"
                onclick={() => { showDetailMenu = false; openEditGoal(selectedGoal); }}
              >
                🗑️ Hapus target
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Quick Deposit Chips Row -->
      <div class="chips-selector-row">
        {#each DEPOSIT_AMOUNTS as amt}
          <button
            type="button"
            class="deposit-chip {selectedDepositChip === amt ? 'selected' : ''}"
            onclick={() => (selectedDepositChip = amt)}
          >
            {formatRp(amt).replace('Rp ', '')}
          </button>
        {/each}
      </div>

      <!-- Split Hero Card (PRD 18.4) -->
      <div
        class="split-hero-card"
        style="
          --cat-border: var(--cat-{selectedGoal.warna}-border, #F2B8C6);
          --cat-fill: var(--cat-{selectedGoal.warna}-fill, #FBE1E7);
        "
      >
        <!-- Split background filled according to progress -->
        <div class="split-bg">
          <div
            class="split-left"
            style="width: {selectedGoal.barPersen}%"
          ></div>
          <div class="split-right"></div>
        </div>

        <!-- Content Overlay -->
        <div class="hero-content">
          <div class="hero-icon-bubble">
            <span class="hero-icon">{selectedGoal.ikon}</span>
          </div>
          <h3 class="hero-name">{selectedGoal.nama}</h3>
          <div class="hero-figures tabular-nums">
            <span class="hero-terkumpul">{formatRp(selectedGoal.terkumpul)}</span>
            <span class="hero-target">/ {formatRp(selectedGoal.target)}</span>
            <span class="hero-pct">{selectedGoal.persen}%</span>
          </div>
          {#if selectedGoal.kelebihan > 0}
            <span class="hero-over-badge tabular-nums">
              Lebih {formatRp(selectedGoal.kelebihan)}
            </span>
          {/if}
        </div>
      </div>

      <!-- Deposit Actions -->
      <div class="deposit-buttons-row">
        <Button
          variant="primary"
          size="lg"
          full
          disabled={!selectedDepositChip}
          onclick={handleQuickDeposit}
        >
          {selectedDepositChip ? `Setor ${formatRp(selectedDepositChip)}` : 'Pilih nominal setoran'}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onclick={() => {
            txManager?.openCreate?.({
              tipe: 'tabung',
              goal_id: selectedGoal.id,
              kategori_id: nabungCategory.id
            });
          }}
        >
          Nominal lain
        </Button>
      </div>

      <!-- Deposit History Section -->
      <div class="history-section">
        <h4 class="history-heading">Riwayat Setoran</h4>
        {#if selectedGoal.history.length === 0}
          <div class="history-empty">
            <p>Belum ada setoran untuk target ini.</p>
          </div>
        {:else}
          <div class="history-list">
            {#each selectedGoal.history as tx}
              <div
                class="history-item"
                role="button"
                tabindex="0"
                onclick={() => txManager?.openEdit?.(tx)}
                onkeydown={(e) => e.key === 'Enter' && txManager?.openEdit?.(tx)}
              >
                <div class="history-left">
                  <span class="history-icon">🐷</span>
                  <div class="history-meta">
                    <span class="history-note">{tx.catatan || 'Setoran target'}</span>
                    <span class="history-date">{formatDateShort(tx.tanggal)}</span>
                  </div>
                </div>
                <span class="history-amount tabular-nums">
                  +{formatRp(tx.nominal)}
                </span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- ============================================== -->
    <!-- LIST TABUNGAN VIEW (PRD 18.3)                  -->
    <!-- ============================================== -->
    <!-- 1. Total Ditabung Card -->
    <Card variant="nabung" class="total-tabungan-card">
      <div class="total-card-header">
        <span class="total-label">Total ditabung</span>
        <span class="total-piggy-cat">🐱🐷</span>
      </div>

      <div class="total-amount-row">
        <h2 class="total-amount tabular-nums">
          {formatRp(metrics.totalDitabung)}
        </h2>
      </div>

      <!-- Weekly nabung progress -->
      <div class="weekly-nabung-meta">
        <span class="weekly-text">
          Minggu ini: <strong>{formatRp(metrics.mingguIniDitabung)}</strong> / {formatRp(weeklyNabungLimit)}
        </span>
        <span class="weekly-pct tabular-nums">
          {Math.round(Math.min(100, (metrics.mingguIniDitabung / weeklyNabungLimit) * 100))}%
        </span>
      </div>

      <div class="weekly-progress-track">
        <div
          class="weekly-progress-fill"
          style="width: {Math.min(100, Math.round((metrics.mingguIniDitabung / weeklyNabungLimit) * 100))}%"
        ></div>
      </div>
    </Card>

    <!-- 2. Target Saya Section -->
    <div class="section-title-row">
      <h3 class="section-title">Target saya</h3>
      {#if metrics.isMaxGoalsReached}
        <span class="max-badge">Maks 10 target</span>
      {/if}
    </div>

    {#if metrics.goalsWithMetrics.length === 0}
      <!-- Empty State -->
      <div class="empty-goals-card">
        <div class="empty-mascot-row">
          <span class="empty-mascot">🐱</span>
          <span class="empty-piggy">🐷</span>
        </div>
        <h4 class="empty-title">Belum ada target</h4>
        <p class="empty-desc">
          Mulai wujudkan impianmu. Buat target tabungan pertamamu!
        </p>
        <Button variant="primary" size="md" onclick={openCreateGoal}>
          ＋ Target baru
        </Button>
      </div>
    {:else}
      <!-- Active Goals List -->
      <div class="goals-grid">
        {#each activeGoals as goal}
          <Card
            variant={goal.warna || 'nabung'}
            interactive
            class="goal-card"
            onclick={() => (selectedGoalId = goal.id)}
          >
            <div class="goal-card-header">
              <div class="goal-identity">
                <span class="goal-icon">{goal.ikon}</span>
                <span class="goal-name">{goal.nama}</span>
              </div>
              <span class="goal-pct tabular-nums">{goal.persen}%</span>
            </div>

            <!-- Progress Track with Walking Cat Marker & Finish Flag -->
            <div class="goal-track-wrap">
              <div class="goal-track">
                <div
                  class="goal-fill"
                  style="width: {goal.barPersen}%"
                ></div>
                <!-- Cat Marker -->
                <div
                  class="walking-cat-marker"
                  style="left: calc({goal.barPersen}% - 12px)"
                  aria-hidden="true"
                >
                  🐱
                </div>
              </div>
              <span class="finish-flag" aria-hidden="true">🏁</span>
            </div>

            <div class="goal-card-footer">
              <span class="goal-amounts tabular-nums">
                {formatRp(goal.terkumpul)} / {formatRp(goal.target)}
              </span>
              {#if goal.estimasiLabel}
                <span class="goal-estimate">
                  {goal.estimasiLabel}
                </span>
              {/if}
            </div>
          </Card>
        {/each}
      </div>

      <!-- Tabungan Umum Card if exists -->
      {#if metrics.tabunganUmum > 0}
        <div class="tabungan-umum-card">
          <div class="umum-left">
            <span class="umum-icon">🐷</span>
            <span class="umum-label">Tabungan umum</span>
          </div>
          <span class="umum-val tabular-nums">
            {formatRp(metrics.tabunganUmum)}
          </span>
        </div>
      {/if}

      <!-- Add Target Button -->
      <div class="add-goal-btn-wrap">
        <Button
          variant="secondary"
          size="md"
          full
          disabled={metrics.isMaxGoalsReached}
          onclick={openCreateGoal}
        >
          {metrics.isMaxGoalsReached ? 'Maksimal 10 target' : '＋ Target baru'}
        </Button>
      </div>

      <!-- Collapsible Reached Goals (Tercapai) -->
      {#if reachedGoals.length > 0}
        <div class="reached-section">
          <button
            type="button"
            class="reached-toggle-btn"
            onclick={() => (showReachedCollapsible = !showReachedCollapsible)}
          >
            <span class="toggle-arrow">{showReachedCollapsible ? '▾' : '▸'}</span>
            <span>Tercapai ({reachedGoals.length})</span>
          </button>

          {#if showReachedCollapsible}
            <div class="reached-list">
              {#each reachedGoals as goal}
                <Card
                  variant={goal.warna || 'nabung'}
                  interactive
                  class="goal-card reached-card"
                  onclick={() => (selectedGoalId = goal.id)}
                >
                  <div class="goal-card-header">
                    <div class="goal-identity">
                      <span class="goal-icon">{goal.ikon}</span>
                      <span class="goal-name">{goal.nama}</span>
                      <span class="check-pill">✓ Tercapai</span>
                    </div>
                    <span class="finish-icon">🏁</span>
                  </div>

                  <div class="goal-card-footer">
                    <span class="goal-amounts tabular-nums">
                      {formatRp(goal.terkumpul)} / {formatRp(goal.target)}
                    </span>
                    {#if goal.kelebihan > 0}
                      <span class="goal-over-text tabular-nums">
                        Lebih {formatRp(goal.kelebihan)}
                      </span>
                    {/if}
                  </div>
                </Card>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  {/if}

  <!-- Goal BottomSheet (Create / Edit) -->
  <GoalSheet
    bind:open={isGoalSheetOpen}
    mode={goalSheetMode}
    goal={activeGoalForSheet}
    onsave={handleSaveGoal}
    ondelete={handleDeleteGoal}
  />
</div>

<style>
  .tabungan-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Celebration Banner */
  .celebration-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    background-color: var(--cat-masuk-fill);
    border: 2px solid var(--cat-masuk-border);
    border-bottom: 4px solid #E2C172;
    border-radius: var(--radius-card, 22px);
    padding: 12px 16px;
    color: var(--ink);
    animation: bannerPop 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .celebration-icon {
    font-size: 28px;
  }

  .celebration-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
  }

  /* 1. Total Ditabung Card */
  :global(.total-tabungan-card) {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .total-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .total-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--mute);
  }

  .total-piggy-cat {
    font-size: 20px;
  }

  .total-amount {
    font-size: 34px;
    font-weight: 700;
    color: var(--ink);
    line-height: 1;
  }

  .weekly-nabung-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: var(--ink);
    margin-top: 2px;
  }

  .weekly-text {
    color: var(--mute);
  }

  .weekly-text strong {
    color: var(--ink);
  }

  .weekly-pct {
    font-weight: 700;
    color: var(--mute);
  }

  .weekly-progress-track {
    width: 100%;
    height: 10px;
    background-color: rgba(255, 255, 255, 0.65);
    border-radius: 999px;
    overflow: hidden;
  }

  .weekly-progress-fill {
    height: 100%;
    background-color: var(--good);
    border-radius: 999px;
    transition: width 400ms ease-out;
  }

  /* Section Title Row */
  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 2px;
  }

  .section-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }

  .max-badge {
    font-size: 11px;
    font-weight: 700;
    color: var(--warn);
    background-color: #FEF3E2;
    padding: 2px 8px;
    border-radius: 999px;
  }

  /* Empty Goals State */
  .empty-goals-card {
    background-color: var(--card);
    border: 2px dashed var(--line);
    border-radius: var(--radius-card, 22px);
    padding: 28px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
  }

  .empty-mascot-row {
    font-size: 32px;
    margin-bottom: 4px;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }

  .empty-desc {
    font-size: 13px;
    color: var(--mute);
    max-width: 260px;
    margin-bottom: 8px;
  }

  /* Goals Grid */
  .goals-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  :global(.goal-card) {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .goal-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .goal-identity {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .goal-icon {
    font-size: 20px;
  }

  .goal-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }

  .goal-pct {
    font-size: 14px;
    font-weight: 700;
    color: var(--mute);
  }

  /* Progress track with walking cat */
  .goal-track-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
  }

  .goal-track {
    position: relative;
    flex: 1;
    height: 12px;
    background-color: rgba(255, 255, 255, 0.7);
    border-radius: 999px;
    overflow: visible;
  }

  .goal-fill {
    height: 100%;
    background-color: var(--accent);
    border-radius: 999px;
    transition: width 400ms ease-out;
  }

  .walking-cat-marker {
    position: absolute;
    top: -8px;
    font-size: 18px;
    line-height: 1;
    transition: left 400ms ease-out;
    pointer-events: none;
  }

  .finish-flag {
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
  }

  .goal-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: var(--ink);
  }

  .goal-amounts {
    font-weight: 700;
  }

  .goal-estimate {
    font-size: 12px;
    color: var(--mute);
    font-weight: 500;
  }

  .goal-over-text {
    font-size: 12px;
    font-weight: 700;
    color: var(--bad);
  }

  /* Tabungan Umum */
  .tabungan-umum-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--card);
    border: 1.5px dashed var(--line);
    border-radius: 16px;
    padding: 10px 14px;
  }

  .umum-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .umum-icon {
    font-size: 18px;
  }

  .umum-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--mute);
  }

  .umum-val {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
  }

  .add-goal-btn-wrap {
    margin-top: 4px;
  }

  /* Reached Section */
  .reached-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
  }

  .reached-toggle-btn {
    align-self: flex-start;
    border: none;
    background: transparent;
    font-size: 14px;
    font-weight: 700;
    color: var(--mute);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 2px;
  }

  .toggle-arrow {
    font-size: 12px;
  }

  .reached-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  :global(.reached-card) {
    opacity: 0.88;
  }

  .check-pill {
    font-size: 11px;
    font-weight: 700;
    background-color: #E4F2DA;
    color: #43702A;
    padding: 2px 8px;
    border-radius: 999px;
  }

  .finish-icon {
    font-size: 18px;
  }

  /* ============================================== */
  /* DETAIL VIEW STYLES                             */
  /* ============================================== */
  .detail-view {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
  }

  .back-btn {
    border: none;
    background: transparent;
    font-size: 22px;
    color: var(--ink);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 8px;
  }

  .detail-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }

  .detail-menu-wrap {
    position: relative;
  }

  .menu-dots-btn {
    border: none;
    background: transparent;
    font-size: 20px;
    color: var(--ink);
    cursor: pointer;
    padding: 4px 8px;
  }

  .menu-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background-color: var(--card);
    border: 1.5px solid var(--line);
    border-bottom: 3px solid #D6C8B2;
    border-radius: 14px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    min-width: 150px;
    z-index: 40;
    box-shadow: 0 4px 12px rgba(74, 59, 50, 0.12);
  }

  .dropdown-item {
    border: none;
    background: transparent;
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
    padding: 8px 10px;
    text-align: left;
    border-radius: 8px;
    cursor: pointer;
  }

  .dropdown-item:hover,
  .dropdown-item:active {
    background-color: var(--bg);
  }

  .dropdown-item.text-danger {
    color: var(--bad);
  }

  /* Quick chips */
  .chips-selector-row {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }

  .chips-selector-row::-webkit-scrollbar {
    display: none;
  }

  .deposit-chip {
    flex-shrink: 0;
    min-height: 40px;
    padding: 6px 14px;
    border-radius: var(--radius-chip, 999px);
    border: 1.5px solid var(--line);
    background-color: var(--card);
    color: var(--ink);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 120ms ease-out;
  }

  .deposit-chip.selected {
    background-color: var(--cat-jajan-fill);
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent);
    transform: scale(1.02);
  }

  /* Split Hero Card (PRD 18.4) */
  .split-hero-card {
    position: relative;
    border-radius: var(--radius-card, 22px);
    border: 2px solid var(--cat-border);
    border-bottom: var(--border-card-bottom, 5px) solid var(--cat-border);
    overflow: hidden;
    min-height: 160px;
  }

  .split-bg {
    position: absolute;
    inset: 0;
    display: flex;
  }

  .split-left {
    background-color: var(--cat-border);
    transition: width 600ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .split-right {
    flex: 1;
    background-color: var(--cat-fill);
  }

  .hero-content {
    position: relative;
    z-index: 2;
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
  }

  .hero-icon-bubble {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(74, 59, 50, 0.1);
  }

  .hero-icon {
    font-size: 30px;
  }

  .hero-name {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }

  .hero-figures {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 15px;
    color: var(--ink);
  }

  .hero-terkumpul {
    font-size: 20px;
    font-weight: 700;
  }

  .hero-target {
    font-size: 14px;
    color: var(--mute);
  }

  .hero-pct {
    font-weight: 700;
    margin-left: 4px;
  }

  .hero-over-badge {
    font-size: 12px;
    font-weight: 700;
    background-color: var(--card);
    color: var(--bad);
    padding: 3px 10px;
    border-radius: 999px;
  }

  .deposit-buttons-row {
    display: flex;
    gap: 10px;
  }

  /* History Section */
  .history-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
  }

  .history-heading {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
    padding-left: 2px;
  }

  .history-empty {
    background-color: var(--card);
    border: 1.5px dashed var(--line);
    border-radius: 16px;
    padding: 20px;
    text-align: center;
    font-size: 13px;
    color: var(--mute);
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .history-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--card);
    border: 1.5px solid var(--line);
    border-bottom: 3px solid #D6C8B2;
    border-radius: 16px;
    padding: 10px 14px;
    cursor: pointer;
    box-sizing: border-box;
    transition: transform 100ms ease-out;
  }

  .history-item:active {
    transform: translateY(1px);
    background-color: #F8F0E0;
  }

  .history-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .history-icon {
    font-size: 18px;
  }

  .history-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .history-note {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
  }

  .history-date {
    font-size: 12px;
    color: var(--mute);
  }

  .history-amount {
    font-size: 14px;
    font-weight: 700;
    color: var(--good);
  }

  @keyframes bannerPop {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .split-left,
    .walking-cat-marker,
    .weekly-progress-fill,
    .goal-fill {
      transition: none !important;
    }
    .celebration-banner {
      animation: none !important;
    }
  }
</style>
