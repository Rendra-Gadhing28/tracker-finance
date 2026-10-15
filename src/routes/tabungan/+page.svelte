<script>
  import { getContext } from 'svelte';
  import { goto } from '$app/navigation';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import GoalSheet from '$lib/components/GoalSheet.svelte';
  import { formatRp } from '$lib/money.js';
  import { getWeekRange } from '$lib/week.js';
  import {
    calculateGoalProgress,
    calculateGoalEta,
    calculateGeneralSavings,
    calculateTotalSavings
  } from '$lib/goals.js';
  import {
    goals,
    transactions,
    budgets,
    settings,
    saveGoal
  } from '$lib/stores/index.js';

  const txManager = getContext('txManager');

  let isGoalSheetOpen = $state(false);
  let showReached = $state(false);

  // Weekly Nabung budget category limit (default 29.000)
  const nabungCategory = $derived(
    ($budgets || []).find((b) => b.tipe === 'tabung') || { limit_mingguan: 29000 }
  );
  const budgetNabungLimit = $derived(Number(nabungCategory.limit_mingguan) || 29000);

  // Current week range based on settings.awal_minggu
  const currentWeekRange = $derived(getWeekRange(new Date(), $settings?.awal_minggu ?? 1));

  // Total savings and weekly progress
  const totalSavings = $derived(
    calculateTotalSavings($transactions, currentWeekRange.start, currentWeekRange.end, budgetNabungLimit)
  );

  // General savings
  const generalSavings = $derived(calculateGeneralSavings($goals, $transactions));

  // Goal progress calculations
  const allGoalsWithProgress = $derived(calculateGoalProgress($goals, $transactions));

  // Active goals: not yet achieved, sorted by created date (oldest first)
  const activeGoals = $derived.by(() => {
    return allGoalsWithProgress
      .filter((g) => !g.isAchieved)
      .sort((a, b) => new Date(a.dibuat || 0).getTime() - new Date(b.dibuat || 0).getTime())
      .map((g) => {
        const eta = calculateGoalEta({
          goal: g,
          transactions: $transactions,
          budgetNabungLimit,
          todayDate: new Date()
        });
        return {
          ...g,
          etaText: eta ? eta.text : '—'
        };
      });
  });

  // Reached goals: achieved
  const reachedGoals = $derived(
    allGoalsWithProgress
      .filter((g) => g.isAchieved)
      .sort((a, b) => new Date(a.dibuat || 0).getTime() - new Date(b.dibuat || 0).getTime())
  );

  const isMaxGoalsReached = $derived(($goals || []).length >= 10);

  function openCreateGoal() {
    if (isMaxGoalsReached) return;
    isGoalSheetOpen = true;
  }

  async function handleSaveGoal(goalData) {
    await saveGoal(goalData);
    txManager?.showToast?.(`Target ${goalData.nama} disimpan`);
  }
</script>

<svelte:head>
  <title>Tabungan · Neko Dompet</title>
</svelte:head>

<div class="tabungan-page">
  <!-- Page Header -->
  <header class="page-header">
    <h1 class="page-title">Tabungan</h1>
  </header>

  <!-- 1. Kartu Total Ditabung (PRD 18.3) -->
  <Card variant="nabung" class="total-tabungan-card">
    <div class="total-header">
      <span class="total-title">Total ditabung</span>
      <span class="total-sticker" aria-hidden="true">🐱🐷</span>
    </div>

    <div class="total-main-amount">
      <span class="amount-text tabular-nums">{formatRp(totalSavings.totalAllTime)}</span>
    </div>

    <div class="weekly-meta">
      <span class="weekly-label">
        Minggu ini {formatRp(totalSavings.totalMingguIni)} / {formatRp(totalSavings.budgetNabungLimit)}
      </span>
      <span class="weekly-pct tabular-nums">{totalSavings.persenMingguIni}%</span>
    </div>

    <div class="weekly-progress-bar">
      <div
        class="weekly-progress-fill"
        style="width: {Math.min(100, totalSavings.persenMingguIni)}%;"
      ></div>
    </div>
  </Card>

  <!-- Empty State (PRD 18.3) -->
  {#if ($goals || []).length === 0}
    <div class="empty-state-card">
      <div class="empty-mascot-hug" aria-hidden="true">
        <span class="cat-hug">🐱</span>
        <span class="piggy-hug">🐷</span>
      </div>
      <h2 class="empty-title">Belum ada target</h2>
      <p class="empty-desc">Buat target pertamamu.</p>
      <div class="empty-btn-wrap">
        <Button variant="primary" size="md" onclick={openCreateGoal}>
          Target baru
        </Button>
      </div>
    </div>
  {:else}
    <!-- 2. Target Saya Section Header -->
    <div class="section-header">
      <h2 class="section-title">Target saya</h2>
      {#if isMaxGoalsReached}
        <span class="max-note">Maksimal 10 target</span>
      {/if}
    </div>

    <!-- Active Goals List -->
    {#if activeGoals.length > 0}
      <div class="goals-list">
        {#each activeGoals as goal (goal.id)}
          <Card
            variant={goal.warna || 'nabung'}
            interactive
            class="goal-card"
            onclick={() => goto(`/tabungan/${goal.id}`)}
          >
            <!-- Header baris atas: Ikon + Nama di kiri, persentase di kanan -->
            <div class="goal-card-top">
              <div class="goal-info">
                <span class="goal-icon">{goal.ikon}</span>
                <span class="goal-name">{goal.nama}</span>
              </div>
              <span class="goal-pct tabular-nums">
                {#if goal.lebih > 0}
                  100% · Lebih {formatRp(goal.lebih)}
                {:else}
                  {goal.persen}%
                {/if}
              </span>
            </div>

            <!-- Bar progress dengan kucing berjalan dan bendera finish -->
            <div class="goal-track-wrap">
              <div class="goal-track">
                <div
                  class="goal-fill"
                  style="width: {goal.barPersen}%;"
                ></div>
                <div
                  class="walking-cat"
                  style="left: clamp(0px, calc({goal.barPersen}% - 10px), calc(100% - 20px));"
                  aria-hidden="true"
                >
                  🐱
                </div>
              </div>
              <span class="finish-flag" aria-hidden="true">🏁</span>
            </div>

            <!-- Angka dan perkiraan -->
            <div class="goal-card-bottom">
              <span class="goal-nominal tabular-nums">
                {formatRp(goal.terkumpul)} / {formatRp(goal.target)}
              </span>
              <span class="goal-eta">
                {goal.etaText}
              </span>
            </div>
          </Card>
        {/each}
      </div>
    {/if}

    <!-- Tabungan Umum (Hanya jika > 0) -->
    {#if generalSavings > 0}
      <div class="tabungan-umum-card">
        <div class="umum-left">
          <span class="umum-icon">🐷</span>
          <span class="umum-label">Tabungan umum</span>
        </div>
        <span class="umum-amount tabular-nums">{formatRp(generalSavings)}</span>
      </div>
    {/if}

    <!-- Tombol [ ＋ Target baru ] -->
    <div class="add-goal-action">
      <Button
        variant="primary"
        size="lg"
        full
        disabled={isMaxGoalsReached}
        onclick={openCreateGoal}
      >
        {isMaxGoalsReached ? 'Maksimal 10 target' : '＋ Target baru'}
      </Button>
    </div>

    <!-- Section Tercapai (Collapsible) -->
    {#if reachedGoals.length > 0}
      <div class="reached-section">
        <button
          type="button"
          class="reached-collapse-trigger"
          onclick={() => (showReached = !showReached)}
          aria-expanded={showReached}
        >
          <span class="arrow-icon">{showReached ? '▾' : '▸'}</span>
          <span class="reached-heading">Tercapai ({reachedGoals.length})</span>
        </button>

        {#if showReached}
          <div class="reached-list">
            {#each reachedGoals as goal (goal.id)}
              <Card
                variant={goal.warna || 'nabung'}
                interactive
                class="goal-card reached-card"
                onclick={() => goto(`/tabungan/${goal.id}`)}
              >
                <div class="goal-card-top">
                  <div class="goal-info">
                    <span class="goal-icon">{goal.ikon}</span>
                    <span class="goal-name">{goal.nama}</span>
                    <span class="check-mark" aria-label="Tercapai">✅</span>
                  </div>
                  <span class="finish-flag" aria-hidden="true">🏁</span>
                </div>

                <div class="goal-card-bottom">
                  <span class="goal-nominal tabular-nums">
                    {formatRp(goal.terkumpul)} / {formatRp(goal.target)}
                  </span>
                  {#if goal.lebih > 0}
                    <span class="goal-extra tabular-nums">
                      Lebih {formatRp(goal.lebih)}
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

  <!-- Sheet Target Baru -->
  <GoalSheet
    bind:open={isGoalSheetOpen}
    goal={null}
    existingGoalsCount={($goals || []).length}
    transactions={$transactions}
    onsave={handleSaveGoal}
  />
</div>

<style>
  .tabungan-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 24px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .page-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--ink);
  }

  /* Total Tabungan Card */
  .total-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .total-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
  }

  .total-sticker {
    font-size: 22px;
    line-height: 1;
    filter: drop-shadow(0 2px 4px rgba(74, 59, 50, 0.12));
  }

  .total-main-amount {
    margin-bottom: 12px;
  }

  .amount-text {
    font-size: 32px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.5px;
  }

  .weekly-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: var(--mute);
    margin-bottom: 6px;
  }

  .weekly-label {
    font-weight: 600;
    color: var(--ink);
  }

  .weekly-pct {
    font-weight: 700;
    color: var(--ink);
  }

  .weekly-progress-bar {
    width: 100%;
    height: 12px;
    background-color: var(--line);
    border-radius: 999px;
    overflow: hidden;
  }

  .weekly-progress-fill {
    height: 100%;
    background-color: var(--cat-nabung-border);
    border-radius: 999px;
    transition: width 400ms ease-out;
  }

  /* Section Header */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
  }

  .section-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--ink);
  }

  .max-note {
    font-size: 12px;
    font-weight: 700;
    color: var(--bad);
  }

  /* Goals List */
  .goals-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .goal-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .goal-info {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .goal-icon {
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
  }

  .goal-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .goal-pct {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
    flex-shrink: 0;
  }

  /* Walking Cat Progress Track */
  .goal-track-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 0 8px 0;
  }

  .goal-track {
    position: relative;
    flex: 1;
    height: 12px;
    background-color: rgba(74, 59, 50, 0.12);
    border-radius: 999px;
    overflow: visible;
  }

  .goal-fill {
    height: 100%;
    background-color: var(--card-border, var(--accent));
    border-radius: 999px;
    transition: width 400ms ease-out;
  }

  .walking-cat {
    position: absolute;
    top: -6px;
    font-size: 16px;
    line-height: 1;
    transition: left 400ms ease-out;
    pointer-events: none;
    user-select: none;
  }

  .finish-flag {
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
    user-select: none;
  }

  .goal-card-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
  }

  .goal-nominal {
    font-weight: 700;
    color: var(--ink);
  }

  .goal-eta {
    color: var(--mute);
    font-weight: 600;
  }

  /* Tabungan Umum */
  .tabungan-umum-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--card);
    border: 2px dashed var(--line);
    border-bottom: 4px solid #D6C8B2;
    border-radius: var(--radius-card, 22px);
    padding: 12px 16px;
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
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
  }

  .umum-amount {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }

  .add-goal-action {
    margin-top: 4px;
  }

  /* Collapsible Reached Section */
  .reached-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
  }

  .reached-collapse-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    padding: 6px 2px;
    cursor: pointer;
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
    text-align: left;
    outline: none;
  }

  .arrow-icon {
    font-size: 14px;
    color: var(--mute);
  }

  .reached-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .check-mark {
    font-size: 14px;
  }

  .goal-extra {
    font-weight: 700;
    color: var(--good);
  }

  /* Empty State */
  .empty-state-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background-color: var(--card);
    border: 2px dashed var(--line);
    border-radius: var(--radius-card, 22px);
    padding: 32px 20px;
    gap: 10px;
  }

  .empty-mascot-hug {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    line-height: 1;
    margin-bottom: 4px;
    filter: drop-shadow(0 4px 8px rgba(74, 59, 50, 0.1));
  }

  .cat-hug {
    transform: rotate(-10deg) translateX(4px);
  }

  .piggy-hug {
    transform: rotate(10deg) translateX(-4px);
  }

  .empty-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }

  .empty-desc {
    font-size: 14px;
    color: var(--mute);
    margin: 0;
  }

  .empty-btn-wrap {
    margin-top: 10px;
  }
</style>
