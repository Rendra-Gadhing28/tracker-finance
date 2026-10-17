<script>
  import { getContext } from 'svelte';
  import { goto } from '$app/navigation';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import GoalSheet from '$lib/components/GoalSheet.svelte';
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';
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
    <div class="header-titles">
      <h1 class="page-title">Tabungan</h1>
      <span class="page-subtitle">Kumpulkan impianmu sedikit demi sedikit</span>
    </div>
    <button
      type="button"
      class="new-goal-header-btn interactive-tap"
      disabled={isMaxGoalsReached}
      onclick={openCreateGoal}
      aria-label="Buat target baru"
    >
      <span>＋ Target</span>
    </button>
  </header>

  <!-- 1. Vault Hero Card (.glass-core) -->
  <section class="vault-hero glass-core" aria-label="Ringkasan Tabungan">
    <div class="vault-header">
      <div class="vault-label-group">
        <span class="vault-label">Total ditabung</span>
        <span class="vault-pill font-num tabular-nums">Semua target</span>
      </div>
      <div class="vault-crystal-orb" aria-hidden="true">
        <span>💎</span>
      </div>
    </div>

    <div class="vault-amount-row">
      <h2 class="vault-amount font-num tabular-nums">
        <AnimatedNumber value={totalSavings.totalAllTime} />
      </h2>
    </div>

    <!-- Weekly Savings Rate -->
    <div class="vault-weekly-box">
      <div class="weekly-meta font-num tabular-nums">
        <span class="weekly-label">
          Minggu ini {formatRp(totalSavings.totalMingguIni)} <span class="weekly-denom">/ {formatRp(totalSavings.budgetNabungLimit)}</span>
        </span>
        <span class="weekly-pct">{totalSavings.persenMingguIni}%</span>
      </div>

      <div class="weekly-track">
        <div
          class="weekly-fill"
          style="width: {Math.min(100, totalSavings.persenMingguIni)}%;"
        ></div>
      </div>
    </div>
  </section>

  <!-- Tabungan Umum (.glass-panel) -->
  {#if generalSavings > 0}
    <div class="tabungan-umum-card glass-panel interactive-tap">
      <div class="umum-left">
        <div class="umum-icon-orb">
          <span>🐷</span>
        </div>
        <div class="umum-text-group">
          <span class="umum-label">Tabungan Umum</span>
          <span class="umum-sub">Dana cadangan tanpa target</span>
        </div>
      </div>
      <div class="umum-right">
        <span class="umum-amount font-num tabular-nums">{formatRp(generalSavings)}</span>
        <button
          type="button"
          class="quick-tabung-chip interactive-tap"
          onclick={() => txManager?.openCreate?.({ tipe: 'tabung', goal_id: '' })}
          aria-label="Tambah tabungan umum"
        >
          ＋ Setor
        </button>
      </div>
    </div>
  {/if}

  <!-- Empty State -->
  {#if ($goals || []).length === 0}
    <div class="empty-state-card glass-panel">
      <div class="empty-mascot-hug" aria-hidden="true">
        <span class="cat-hug">🐱</span>
        <span class="piggy-hug">🐷</span>
      </div>
      <h2 class="empty-title">Belum ada target</h2>
      <p class="empty-desc">Buat target impian pertamamu sekarang.</p>
      <div class="empty-btn-wrap">
        <Button variant="primary" size="md" onclick={openCreateGoal}>
          ＋ Buat Target Baru
        </Button>
      </div>
    </div>
  {:else}
    <!-- 2. Target Saya Section Header -->
    <div class="section-header">
      <h3 class="section-title">Target Saya</h3>
      {#if isMaxGoalsReached}
        <span class="max-note">Maksimal 10 target</span>
      {/if}
    </div>

    <!-- Active Goals List -->
    {#if activeGoals.length > 0}
      <div class="goals-list">
        {#each activeGoals as goal, i (goal.id)}
          <div
            class="goal-card glass-panel interactive-tap animate-stagger"
            style="--i: {i}"
          >
            <!-- Header baris atas: Ikon + Nama di kiri (klik menuju detail), persentase di kanan -->
            <div
              class="goal-card-top"
              role="button"
              tabindex="0"
              onclick={() => goto(`/tabungan/${goal.id}`)}
              onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && goto(`/tabungan/${goal.id}`)}
              aria-label="Buka detail target {goal.nama}"
            >
              <div class="goal-info">
                <div class="goal-icon-halo {goal.warna || 'nabung'}">
                  <span class="goal-icon">{goal.ikon}</span>
                </div>
                <div class="goal-name-group">
                  <span class="goal-name">{goal.nama}</span>
                  <span class="goal-eta-badge">{goal.etaText}</span>
                </div>
              </div>
              <div class="goal-pct-badge font-num tabular-nums">
                {#if goal.lebih > 0}
                  <span class="pct-over">100% · +{formatRp(goal.lebih)}</span>
                {:else}
                  <span class="pct-val">{goal.persen}%</span>
                {/if}
              </div>
            </div>

            <!-- Bar progress dengan kucing berjalan dan bendera finish -->
            <div
              class="goal-track-wrap"
              role="presentation"
              onclick={() => goto(`/tabungan/${goal.id}`)}
            >
              <div class="goal-track">
                <div
                  class="goal-fill"
                  style="width: {goal.barPersen}%;"
                ></div>
                <div
                  class="walking-cat"
                  style="left: clamp(0px, calc({goal.barPersen}% - 12px), calc(100% - 24px));"
                  aria-hidden="true"
                >
                  🐱
                </div>
              </div>
              <span class="finish-flag" aria-hidden="true">🏁</span>
            </div>

            <!-- Angka dan aksi -->
            <div class="goal-card-bottom font-num tabular-nums">
              <div
                class="goal-nominal-group"
                role="presentation"
                onclick={() => goto(`/tabungan/${goal.id}`)}
              >
                <span class="goal-collected">{formatRp(goal.terkumpul)}</span>
                <span class="goal-target-sep">/</span>
                <span class="goal-target-val">{formatRp(goal.target)}</span>
              </div>

              <button
                type="button"
                class="quick-add-btn interactive-tap"
                onclick={(e) => {
                  e.stopPropagation();
                  txManager?.openCreate?.({ tipe: 'tabung', goal_id: goal.id });
                }}
                aria-label="Setor ke {goal.nama}"
              >
                ＋ Setor
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

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
          <span class="reached-heading">Target Tercapai ({reachedGoals.length})</span>
          <span class="celebration-badge">🏆</span>
        </button>

        {#if showReached}
          <div class="reached-list">
            {#each reachedGoals as goal (goal.id)}
              <div
                class="goal-card glass-panel reached-card"
                role="button"
                tabindex="0"
                onclick={() => goto(`/tabungan/${goal.id}`)}
                onkeydown={(e) => e.key === 'Enter' && goto(`/tabungan/${goal.id}`)}
              >
                <div class="goal-card-top">
                  <div class="goal-info">
                    <div class="goal-icon-halo reached">
                      <span class="goal-icon">{goal.ikon}</span>
                    </div>
                    <div class="goal-name-group">
                      <span class="goal-name">{goal.nama}</span>
                      <span class="reached-tag">Selesai ✓</span>
                    </div>
                  </div>
                  <span class="finish-flag" aria-hidden="true">🏁</span>
                </div>

                <div class="goal-card-bottom font-num tabular-nums">
                  <span class="goal-collected">{formatRp(goal.terkumpul)} / {formatRp(goal.target)}</span>
                  {#if goal.lebih > 0}
                    <span class="goal-extra">
                      Lebih +{formatRp(goal.lebih)}
                    </span>
                  {/if}
                </div>
              </div>
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
    width: 100%;
    box-sizing: border-box;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .header-titles {
    display: flex;
    flex-direction: column;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    color: var(--komorebi);
    letter-spacing: -0.01em;
    margin: 0;
  }

  .page-subtitle {
    font-size: 11px;
    color: var(--kabut);
    margin-top: 1px;
  }

  .new-goal-header-btn {
    border: none;
    font-size: 12px;
    font-weight: 700;
    color: #FFFFFF;
    background: linear-gradient(135deg, var(--aether) 0%, #2B8A9E 100%);
    box-shadow: var(--glow-aether);
    border-radius: 999px;
    padding: 6px 14px;
    cursor: pointer;
    transition: transform 120ms ease;
  }

  .new-goal-header-btn:active {
    transform: scale(0.96);
  }

  .new-goal-header-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* 1. Vault Hero Card */
  .vault-hero {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    border-radius: 28px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .vault-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .vault-label-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .vault-label {
    font-size: 13px;
    color: var(--kabut);
    font-weight: 500;
  }

  .vault-pill {
    font-size: 10px;
    font-weight: 700;
    color: var(--aether);
    background: rgba(59, 154, 184, 0.10);
    border: 1px solid rgba(59, 154, 184, 0.25);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .vault-crystal-orb {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--glass-1);
    border: 1px solid var(--edge-bright);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    box-shadow: var(--glow-aether);
  }

  .vault-amount-row {
    display: flex;
    align-items: baseline;
  }

  .vault-amount {
    font-size: 32px;
    font-weight: 700;
    line-height: 1.1;
    color: var(--bara);
    text-shadow: var(--glow-bara);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .vault-weekly-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(0, 0, 0, 0.22);
    border: 1px solid var(--edge-soft);
    border-radius: 16px;
    padding: 10px 14px;
  }

  .weekly-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }

  .weekly-label {
    font-weight: 600;
    color: var(--komorebi);
  }

  .weekly-denom {
    color: var(--kabut);
    font-weight: 400;
  }

  .weekly-pct {
    font-weight: 700;
    color: var(--bara);
  }

  .weekly-track {
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
  }

  .weekly-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--bara) 0%, #B45309 100%);
    box-shadow: var(--glow-bara);
    border-radius: 999px;
  }

  /* Tabungan Umum */
  .tabungan-umum-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-radius: 20px;
    gap: 12px;
  }

  .umum-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .umum-icon-orb {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--glass-2);
    border: 1px solid var(--edge-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 0 10px rgba(217, 119, 6, 0.12);
  }

  .umum-text-group {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .umum-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--komorebi);
  }

  .umum-sub {
    font-size: 11px;
    color: var(--kabut);
  }

  .umum-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .umum-amount {
    font-size: 14px;
    font-weight: 700;
    color: var(--bara);
  }

  .quick-tabung-chip {
    border: none;
    font-size: 11px;
    font-weight: 700;
    color: var(--bara);
    background: rgba(217, 119, 6, 0.10);
    border: 1px solid rgba(217, 119, 6, 0.25);
    border-radius: 999px;
    padding: 4px 10px;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .quick-tabung-chip:active {
    transform: scale(0.95);
    background: rgba(217, 119, 6, 0.18);
  }

  /* Section Header */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2px;
    margin-top: 4px;
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--komorebi);
    margin: 0;
  }

  .max-note {
    font-size: 11px;
    font-weight: 700;
    color: var(--api);
  }

  /* Goals List */
  .goals-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .goal-card {
    display: flex;
    flex-direction: column;
    padding: 14px 16px;
    border-radius: 22px;
    cursor: pointer;
    gap: 10px;
    transition: transform 120ms ease, border-color 150ms ease;
  }

  .goal-card:active {
    transform: scale(0.985);
    border-color: var(--edge-bright);
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
    gap: 10px;
    min-width: 0;
  }

  .goal-icon-halo {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--glass-2);
    border: 1px solid var(--edge-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 10px rgba(59, 154, 184, 0.12);
  }

  .goal-icon {
    font-size: 18px;
    line-height: 1;
  }

  .goal-name-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .goal-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--komorebi);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .goal-eta-badge {
    font-size: 11px;
    color: var(--kabut);
    font-weight: 500;
  }

  .goal-pct-badge {
    font-size: 13px;
    font-weight: 700;
    color: var(--bara);
    flex-shrink: 0;
  }

  .pct-over {
    color: var(--tunas);
  }

  /* Walking Cat Progress Track */
  .goal-track-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 2px 0;
  }

  .goal-track {
    position: relative;
    flex: 1;
    height: 10px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: visible;
  }

  .goal-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--bara) 0%, #B45309 100%);
    box-shadow: var(--glow-bara);
    border-radius: 999px;
  }

  .walking-cat {
    position: absolute;
    top: -8px;
    font-size: 14px;
    line-height: 1;
    transition: left 400ms ease-out;
    pointer-events: none;
    user-select: none;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
  }

  .finish-flag {
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
    user-select: none;
  }

  .goal-card-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
  }

  .goal-nominal-group {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .goal-collected {
    font-weight: 700;
    color: var(--bara);
  }

  .goal-target-sep {
    color: var(--kabut);
  }

  .goal-target-val {
    color: var(--kabut);
    font-weight: 500;
  }

  .quick-add-btn {
    position: relative;
    border: none;
    font-size: 11px;
    font-weight: 700;
    color: var(--bara);
    background: rgba(217, 119, 6, 0.10);
    border: 1px solid rgba(217, 119, 6, 0.25);
    border-radius: 999px;
    padding: 4px 12px;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .quick-add-btn::before {
    content: '';
    position: absolute;
    inset: -8px;
  }

  .quick-add-btn:hover {
    border-color: var(--edge-bright);
    background: var(--glass-3);
  }

  .quick-add-btn:active {
    transform: scale(0.95);
  }

  /* Collapsible Reached Section */
  .reached-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 6px;
  }

  .reached-collapse-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    padding: 6px 2px;
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--kabut);
    text-align: left;
    border-radius: 8px;
    transition: color 150ms ease;
  }

  .reached-collapse-trigger:focus-visible {
    outline: 2px solid var(--aether);
    outline-offset: 2px;
  }

  .reached-collapse-trigger:hover {
    color: var(--komorebi);
  }

  .arrow-icon {
    font-size: 13px;
  }

  .celebration-badge {
    font-size: 14px;
  }

  .reached-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .reached-card {
    opacity: 0.85;
  }

  .goal-icon-halo.reached {
    box-shadow: 0 0 10px rgba(56, 161, 105, 0.16);
    border-color: rgba(56, 161, 105, 0.35);
  }

  .reached-tag {
    font-size: 11px;
    font-weight: 700;
    color: var(--tunas);
  }

  .goal-extra {
    font-weight: 700;
    color: var(--tunas);
  }

  /* Empty State */
  .empty-state-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 36px 20px;
    border-radius: 24px;
    gap: 8px;
  }

  .empty-mascot-hug {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 44px;
    line-height: 1;
    margin-bottom: 4px;
  }

  .cat-hug {
    transform: rotate(-10deg) translateX(4px);
  }

  .piggy-hug {
    transform: rotate(10deg) translateX(-4px);
  }

  .empty-title {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 700;
    color: var(--komorebi);
    margin: 0;
  }

  .empty-desc {
    font-size: 13px;
    color: var(--kabut);
    margin: 0;
  }

  .empty-btn-wrap {
    margin-top: 10px;
  }
</style>
