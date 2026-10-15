<script>
  import { getContext } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import confetti from 'canvas-confetti';
  import Button from '$lib/components/Button.svelte';
  import GoalSheet from '$lib/components/GoalSheet.svelte';
  import { formatRp } from '$lib/money.js';
  import { getWIBParts } from '$lib/week.js';
  import { calculateGoalProgress } from '$lib/goals.js';
  import {
    goals,
    transactions,
    budgets,
    saveGoal,
    deleteGoal,
    addTransaction,
    deleteTransaction
  } from '$lib/stores/index.js';

  const txManager = getContext('txManager');

  const INDO_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const QUICK_AMOUNTS = [2000, 5000, 10000, 25000, 50000];

  let selectedNominal = $state(10000);
  let showMenu = $state(false);
  let isGoalSheetOpen = $state(false);
  let celebrationBanner = $state('');
  let celebrationTimer = null;

  const goalId = $derived(page.params.id);
  const target = $derived(($goals || []).find((g) => g.id === goalId) || null);

  // Calculate progress for current target
  const goalProgress = $derived.by(() => {
    if (!target) return null;
    const list = calculateGoalProgress([target], $transactions);
    return list[0] || null;
  });

  // History transactions for this goal (newest first)
  const depositHistory = $derived.by(() => {
    if (!target) return [];
    return ($transactions || [])
      .filter((tx) => tx.tipe === 'tabung' && tx.goal_id === target.id)
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  });

  // Perayaan tercapai otomatis per PRD 18.4 (berjalan untuk setor cepat maupun TransactionSheet)
  $effect(() => {
    if (!target || !goalProgress) return;
    if (goalProgress.isAchieved && typeof localStorage !== 'undefined') {
      const key = `celebrated_goal_${target.id}`;
      if (localStorage.getItem(key) !== 'true') {
        localStorage.setItem(key, 'true');
        celebrationBanner = `Target tercapai! ${target.ikon} ${target.nama}`;
        triggerPastelConfetti();

        if (celebrationTimer) clearTimeout(celebrationTimer);
        celebrationTimer = setTimeout(() => {
          celebrationBanner = '';
        }, 6000);
      }
    }
  });

  function formatDateIndo(iso) {
    if (!iso) return '';
    const p = getWIBParts(iso);
    const d = String(p.date).padStart(2, '0');
    return `${d} ${INDO_MONTHS[p.month]}`;
  }

  function triggerPastelConfetti() {
    const pastelColors = ['#FBE0D3', '#DCEEF7', '#E4F2DA', '#EBE0F5', '#FBE1E7', '#FBF0CF', '#E59A6A'];
    const duration = 2000;
    const end = Date.now() + duration;

    const interval = setInterval(() => {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }
      confetti({
        particleCount: 16,
        spread: 70,
        origin: { x: Math.random(), y: Math.random() * 0.4 },
        colors: pastelColors,
        disableForReducedMotion: true
      });
    }, 120);
  }

  async function handleQuickDeposit() {
    if (!target || !selectedNominal) return;

    const nominal = selectedNominal;
    const tabungCat = ($budgets || [])
      .filter((b) => b.tipe === 'tabung')
      .sort((a, b) => (a.urut || 0) - (b.urut || 0))[0] || { id: 'nabung' };

    const created = await addTransaction({
      tipe: 'tabung',
      kategori_id: tabungCat.id,
      goal_id: target.id,
      nominal
    });

    txManager?.showToast?.(`Disetor ${formatRp(nominal)}`, async () => {
      await deleteTransaction(created.id);
    });
  }

  async function handleSaveGoal(goalData) {
    await saveGoal(goalData);
    txManager?.showToast?.(`Target ${goalData.nama} diperbarui`);
  }

  async function handleDeleteGoal(id) {
    const deleted = target;
    await deleteGoal(id);
    txManager?.showToast?.('Target dihapus', async () => {
      if (deleted) await saveGoal(deleted);
    });
    goto('/tabungan');
  }
</script>

<svelte:head>
  <title>{target ? target.nama : 'Detail Target'} · Neko Dompet</title>
</svelte:head>

<div class="target-detail-page">
  {#if !target}
    <!-- Not Found State -->
    <div class="not-found-card">
      <span class="not-found-cat" aria-hidden="true">😿</span>
      <h2 class="not-found-title">Target tidak ditemukan</h2>
      <p class="not-found-desc">Target tabungan ini mungkin sudah dihapus.</p>
      <Button variant="primary" size="md" onclick={() => goto('/tabungan')}>
        ← Kembali ke Tabungan
      </Button>
    </div>
  {:else}
    <!-- Celebration Jumping Banner (PRD 18.4) -->
    {#if celebrationBanner}
      <div class="celebration-banner-jump" role="alert">
        <span class="jump-cat" aria-hidden="true">🐱🎉</span>
        <div class="celebration-content">
          <strong class="celebration-title">{celebrationBanner}</strong>
          <span class="celebration-sub">Selamat atas pencapaianmu!</span>
        </div>
        <button
          type="button"
          class="close-banner-btn"
          onclick={() => (celebrationBanner = '')}
          aria-label="Tutup pemberitahuan"
        >
          ✕
        </button>
      </div>
    {/if}

    <!-- Header Detail Target -->
    <header class="detail-header">
      <button
        type="button"
        class="back-btn"
        onclick={() => goto('/tabungan')}
        aria-label="Kembali ke tabungan"
      >
        ←
      </button>

      <h1 class="header-target-name">{target.nama}</h1>

      <div class="menu-container">
        <button
          type="button"
          class="menu-trigger-btn"
          onclick={() => (showMenu = !showMenu)}
          aria-label="Menu opsi target"
          aria-expanded={showMenu}
        >
          ⋯
        </button>

        {#if showMenu}
          <div
            class="menu-backdrop"
            onclick={() => (showMenu = false)}
            role="presentation"
          ></div>
          <div class="menu-popup" role="menu">
            <button
              type="button"
              class="menu-item"
              onclick={() => {
                showMenu = false;
                isGoalSheetOpen = true;
              }}
            >
              ✏️ Ubah target
            </button>
            <button
              type="button"
              class="menu-item danger"
              onclick={() => {
                showMenu = false;
                isGoalSheetOpen = true;
              }}
            >
              🗑️ Hapus target
            </button>
          </div>
        {/if}
      </div>
    </header>

    <!-- Chip Nominal Cepat -->
    <div class="chips-row" role="radiogroup" aria-label="Pilih nominal setoran cepat">
      {#each QUICK_AMOUNTS as amt}
        <button
          type="button"
          class="quick-chip {selectedNominal === amt ? 'selected' : ''}"
          onclick={() => {
            selectedNominal = selectedNominal === amt ? null : amt;
          }}
          role="radio"
          aria-checked={selectedNominal === amt}
        >
          {formatRp(amt).replace('Rp ', '')}
        </button>
      {/each}
    </div>

    <!-- Kartu Hero Split (PRD 18.4) -->
    <div
      class="hero-split-card"
      style="
        --hero-border: var(--cat-{target.warna}-border, #F2B8C6);
        --hero-fill: var(--cat-{target.warna}-fill, #FBE1E7);
      "
    >
      <div class="split-bg" aria-hidden="true">
        <div
          class="split-left"
          style="width: {goalProgress?.barPersen ?? 0}%;"
        ></div>
        <div class="split-right"></div>
      </div>

      <div class="hero-content">
        <div class="hero-icon-circle">
          <span class="hero-icon">{target.ikon}</span>
        </div>
        <h2 class="hero-name">{target.nama}</h2>
        <div class="hero-stats tabular-nums">
          <span class="hero-terkumpul">{formatRp(goalProgress?.terkumpul ?? 0)}</span>
          <span class="hero-sep">/</span>
          <span class="hero-target">{formatRp(goalProgress?.target ?? 0)}</span>
          <span class="hero-pct">
            {#if (goalProgress?.lebih ?? 0) > 0}
              100% · Lebih {formatRp(goalProgress?.lebih ?? 0)}
            {:else}
              {goalProgress?.persen ?? 0}%
            {/if}
          </span>
        </div>
      </div>
    </div>

    <!-- Riwayat Setoran -->
    <section class="history-section" aria-label="Riwayat setoran">
      <h3 class="history-title">Riwayat Setoran</h3>

      {#if depositHistory.length === 0}
        <div class="history-empty">
          <p>Belum ada setoran untuk target ini</p>
        </div>
      {:else}
        <div class="history-list">
          {#each depositHistory as tx (tx.id)}
            <div
              class="history-row"
              role="button"
              tabindex="0"
              onclick={() => txManager?.openEdit?.(tx)}
              onkeydown={(e) => e.key === 'Enter' && txManager?.openEdit?.(tx)}
            >
              <div class="history-info">
                <span class="history-icon">🐷</span>
                <span class="history-date">{formatDateIndo(tx.tanggal)}</span>
              </div>
              <span class="history-amount tabular-nums">
                +{formatRp(tx.nominal)}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Tombol Aksi di Bawah -->
    <div class="bottom-actions">
      <Button
        variant="primary"
        size="lg"
        full
        disabled={!selectedNominal}
        onclick={handleQuickDeposit}
      >
        {selectedNominal ? `Setor ${formatRp(selectedNominal)}` : 'Pilih nominal setoran'}
      </Button>

      <Button
        variant="secondary"
        size="md"
        full
        onclick={() => {
          txManager?.openCreate?.({
            tipe: 'tabung',
            goal_id: target.id
          });
        }}
      >
        Nominal lain
      </Button>
    </div>

    <!-- Sheet Ubah/Hapus Target -->
    <GoalSheet
      bind:open={isGoalSheetOpen}
      goal={target}
      existingGoalsCount={($goals || []).length}
      transactions={$transactions}
      onsave={handleSaveGoal}
      ondelete={handleDeleteGoal}
    />
  {/if}
</div>

<style>
  .target-detail-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 24px;
  }

  /* Jumping celebration banner */
  .celebration-banner-jump {
    display: flex;
    align-items: center;
    gap: 12px;
    background-color: var(--cat-nabung-fill);
    border: 2px solid var(--cat-nabung-border);
    border-bottom: 5px solid var(--cat-nabung-border);
    border-radius: var(--radius-card, 22px);
    padding: 12px 16px;
    animation: banner-jump 500ms cubic-bezier(0.18, 0.89, 0.32, 1.28) both;
  }

  @keyframes banner-jump {
    0% {
      transform: translateY(24px) scale(0.9);
      opacity: 0;
    }
    50% {
      transform: translateY(-8px) scale(1.04);
      opacity: 1;
    }
    75% {
      transform: translateY(3px) scale(0.99);
    }
    100% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  .jump-cat {
    font-size: 28px;
    line-height: 1;
    animation: cat-bob 1s ease-in-out infinite alternate;
  }

  @keyframes cat-bob {
    0% { transform: translateY(0); }
    100% { transform: translateY(-4px) rotate(4deg); }
  }

  .celebration-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .celebration-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }

  .celebration-sub {
    font-size: 12px;
    color: var(--mute);
  }

  .close-banner-btn {
    background: transparent;
    border: none;
    font-size: 16px;
    color: var(--mute);
    cursor: pointer;
    padding: 4px;
    line-height: 1;
  }

  /* Detail Header */
  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid var(--line);
    border-bottom: 4px solid #D6C8B2;
    background-color: var(--card);
    font-size: 20px;
    font-weight: 700;
    color: var(--ink);
    cursor: pointer;
    transition: transform 120ms ease-out;
  }

  .back-btn:active {
    transform: translateY(2px);
    border-bottom-width: 2px;
  }

  .header-target-name {
    flex: 1;
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu-container {
    position: relative;
  }

  .menu-trigger-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid var(--line);
    border-bottom: 4px solid #D6C8B2;
    background-color: var(--card);
    font-size: 20px;
    font-weight: 700;
    color: var(--ink);
    cursor: pointer;
    transition: transform 120ms ease-out;
  }

  .menu-trigger-btn:active {
    transform: translateY(2px);
    border-bottom-width: 2px;
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
  }

  .menu-popup {
    position: absolute;
    top: 50px;
    right: 0;
    z-index: 50;
    background-color: var(--card);
    border: 2px solid var(--line);
    border-bottom: 4px solid #D6C8B2;
    border-radius: 16px;
    min-width: 160px;
    padding: 6px;
    box-shadow: 0 8px 24px rgba(74, 59, 50, 0.15);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    border: none;
    background: transparent;
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    transition: background-color 120ms;
  }

  .menu-item:hover, .menu-item:active {
    background-color: var(--bg);
  }

  .menu-item.danger {
    color: var(--bad);
  }

  /* Quick Deposit Chips */
  .chips-row {
    display: flex;
    gap: 8px;
  }

  .quick-chip {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 8px 4px;
    background-color: var(--card);
    border: 2px solid var(--line);
    border-bottom: 4px solid #D6C8B2;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
    cursor: pointer;
    transition: all 140ms ease-out;
  }

  .quick-chip.selected {
    border-color: var(--ink);
    border-bottom: 4px solid var(--ink);
    background-color: var(--cat-nabung-fill);
    transform: translateY(-2px);
    box-shadow: 0 0 0 2px var(--accent);
  }

  /* Split Hero Card (PRD 18.4) */
  .hero-split-card {
    position: relative;
    border-radius: var(--radius-card, 22px);
    border: 2px solid var(--hero-border);
    border-bottom: 5px solid var(--hero-border);
    overflow: hidden;
    background-color: var(--hero-fill);
    box-shadow: 0 2px 8px rgba(74, 59, 50, 0.06);
  }

  .split-bg {
    position: absolute;
    inset: 0;
    display: flex;
    pointer-events: none;
  }

  .split-left {
    height: 100%;
    background-color: var(--hero-border);
    transition: width 600ms ease-out;
  }

  .split-right {
    flex: 1;
    height: 100%;
    background-color: var(--hero-fill);
  }

  .hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 24px 16px;
    gap: 8px;
  }

  .hero-icon-circle {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background-color: var(--card);
    border: 2.5px solid var(--hero-border);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(74, 59, 50, 0.1);
  }

  .hero-icon {
    font-size: 34px;
    line-height: 1;
  }

  .hero-name {
    font-size: 19px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }

  .hero-stats {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 16px;
  }

  .hero-terkumpul {
    font-size: 20px;
    font-weight: 700;
    color: var(--ink);
  }

  .hero-sep, .hero-target {
    font-size: 15px;
    color: var(--mute);
    font-weight: 600;
  }

  .hero-pct {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
    background-color: var(--card);
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--hero-border);
    margin-left: 4px;
  }

  /* History Section */
  .history-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .history-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }

  .history-empty {
    background-color: var(--card);
    border: 2px dashed var(--line);
    border-radius: 16px;
    padding: 24px 16px;
    text-align: center;
    color: var(--mute);
    font-size: 14px;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .history-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--card);
    border: 2px solid var(--line);
    border-bottom: 4px solid #D6C8B2;
    border-radius: 16px;
    padding: 12px 14px;
    cursor: pointer;
    transition: transform 120ms ease-out;
  }

  .history-row:hover, .history-row:active {
    transform: translateY(1px);
    border-bottom-width: 3px;
  }

  .history-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .history-icon {
    font-size: 16px;
  }

  .history-date {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }

  .history-amount {
    font-size: 15px;
    font-weight: 700;
    color: var(--good);
  }

  /* Bottom Actions */
  .bottom-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  /* Not Found Card */
  .not-found-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background-color: var(--card);
    border: 2px dashed var(--line);
    border-radius: var(--radius-card, 22px);
    padding: 36px 20px;
    gap: 12px;
  }

  .not-found-cat {
    font-size: 48px;
  }

  .not-found-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }

  .not-found-desc {
    font-size: 14px;
    color: var(--mute);
    margin: 0;
  }
</style>
