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

  // Perayaan tercapai otomatis per PRD 18.4
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
    const pastelColors = ['#5ED6E6', '#7EE5A1', '#FFB84D', '#A78BFA', '#FB7185', '#38BDF8'];
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
    <div class="not-found-card glass-panel">
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
      <div class="celebration-banner-jump glass-panel" role="alert">
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
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div class="header-center">
        <span class="header-target-name">{target.nama}</span>
      </div>

      <div class="menu-container">
        <button
          type="button"
          class="menu-trigger-btn"
          onclick={() => (showMenu = !showMenu)}
          aria-label="Menu opsi target"
          aria-expanded={showMenu}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
            <circle cx="5" cy="12" r="2" />
          </svg>
        </button>

        {#if showMenu}
          <div
            class="menu-backdrop"
            onclick={() => (showMenu = false)}
            role="presentation"
          ></div>
          <div class="menu-popup glass-panel" role="menu">
            <button
              type="button"
              class="menu-item"
              onclick={() => {
                showMenu = false;
                isGoalSheetOpen = true;
              }}
            >
              <span>✏️</span>
              <span>Ubah target</span>
            </button>
            <button
              type="button"
              class="menu-item danger"
              onclick={() => {
                showMenu = false;
                isGoalSheetOpen = true;
              }}
            >
              <span>🗑️</span>
              <span>Hapus target</span>
            </button>
          </div>
        {/if}
      </div>
    </header>

    <!-- Kartu Hero (.glass-core, split card) -->
    <div class="hero-vault-card hero-split-card glass-core">
      <div class="hero-icon-circle">
        <span class="hero-icon">{target.ikon}</span>
      </div>

      <div class="hero-main-stats font-num tabular-nums">
        <span class="hero-pct">
          {#if (goalProgress?.lebih ?? 0) > 0}
            100% · +{formatRp(goalProgress?.lebih ?? 0)}
          {:else}
            {goalProgress?.persen ?? 0}%
          {/if}
        </span>
        <h2 class="hero-collected-amount">
          {formatRp(goalProgress?.terkumpul ?? 0)}
        </h2>
        <span class="hero-target-denom">
          dari target {formatRp(goalProgress?.target ?? 0)}
        </span>
      </div>

      <!-- Progress Track -->
      <div class="hero-progress-track">
        <div
          class="hero-progress-fill"
          style="width: {goalProgress?.barPersen ?? 0}%;"
        ></div>
      </div>
    </div>

    <!-- Quick Deposit Section -->
    <div class="deposit-section">
      <div class="deposit-header-row">
        <span class="deposit-title">Setor Cepat</span>
        <span class="deposit-sub font-num tabular-nums">Pilih nominal</span>
      </div>

      <div class="chips-row" role="radiogroup" aria-label="Pilih nominal setoran cepat">
        {#each QUICK_AMOUNTS as amt}
          <button
            type="button"
            class="quick-chip font-num tabular-nums {selectedNominal === amt ? 'selected' : ''}"
            onclick={() => {
              selectedNominal = selectedNominal === amt ? null : amt;
            }}
            role="radio"
            aria-checked={selectedNominal === amt}
          >
            +{formatRp(amt).replace('Rp ', '')}
          </button>
        {/each}
      </div>

      <div class="deposit-actions">
        <button
          type="button"
          class="deposit-submit-btn font-num tabular-nums"
          disabled={!selectedNominal}
          onclick={handleQuickDeposit}
        >
          {selectedNominal ? `Setor ${formatRp(selectedNominal)} Sekarang` : 'Pilih nominal setoran'}
        </button>

        <button
          type="button"
          class="deposit-custom-btn"
          onclick={() => {
            txManager?.openCreate?.({
              tipe: 'tabung',
              goal_id: target.id
            });
          }}
        >
          Nominal lain
        </button>
      </div>
    </div>

    <!-- Riwayat Setoran -->
    <section class="history-section" aria-label="Riwayat setoran">
      <h3 class="history-title">Riwayat Setoran</h3>

      {#if depositHistory.length === 0}
        <div class="history-empty glass-panel">
          <p class="history-empty-text">Belum ada setoran untuk target ini.</p>
        </div>
      {:else}
        <div class="history-list">
          {#each depositHistory as tx (tx.id)}
            <div
              class="history-row glass-row"
              role="button"
              tabindex="0"
              onclick={() => txManager?.openEdit?.(tx)}
              onkeydown={(e) => e.key === 'Enter' && txManager?.openEdit?.(tx)}
            >
              <div class="history-info">
                <div class="history-icon-orb">
                  <span>🐷</span>
                </div>
                <div class="history-details">
                  <span class="history-label">{tx.catatan || 'Setoran Tabungan'}</span>
                  <span class="history-date">{formatDateIndo(tx.tanggal)}</span>
                </div>
              </div>
              <span class="history-amount font-num tabular-nums">
                +{formatRp(tx.nominal)}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </section>

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
    width: 100%;
    box-sizing: border-box;
  }

  /* Jumping celebration banner */
  .celebration-banner-jump {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--bg-raised);
    border: 1px solid var(--accent);
    border-radius: var(--r, 10px);
    padding: 12px 16px;
    box-shadow: none;
    animation: banner-jump 450ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes banner-jump {
    0% {
      transform: translateY(16px) scale(0.96);
      opacity: 0;
    }
    100% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  .jump-cat {
    font-size: 28px;
    line-height: 1;
  }

  .celebration-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .celebration-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--fg);
  }

  .celebration-sub {
    font-size: 11px;
    color: var(--fg-muted);
  }

  .close-banner-btn {
    background: transparent;
    border: none;
    font-size: 14px;
    color: var(--fg-muted);
    cursor: pointer;
    padding: 4px;
    line-height: 1;
  }

  /* Detail Header */
  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .back-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--r, 10px);
    border: 1px solid var(--line);
    background: var(--bg-raised);
    color: var(--fg);
    cursor: pointer;
    transition: opacity 120ms var(--ease);
  }

  .back-btn::before {
    content: '';
    position: absolute;
    inset: -6px;
  }

  .back-btn:hover {
    background: var(--line);
    border-color: var(--line);
  }

  .back-btn:active {
    opacity: 0.8;
  }

  .header-center {
    flex: 1;
    min-width: 0;
    text-align: center;
  }

  .header-target-name {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .menu-container {
    position: relative;
  }

  .menu-trigger-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--r, 10px);
    border: 1px solid var(--line);
    background: var(--bg-raised);
    color: var(--fg-muted);
    cursor: pointer;
    transition: opacity 120ms var(--ease);
  }

  .menu-trigger-btn:hover {
    color: var(--fg);
    border-color: var(--line);
  }

  .menu-trigger-btn:active {
    opacity: 0.8;
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
  }

  .menu-popup {
    position: absolute;
    top: 46px;
    right: 0;
    z-index: 50;
    border-radius: var(--r, 10px);
    background: var(--bg-raised);
    border: 1px solid var(--line);
    min-width: 170px;
    padding: 6px;
    box-shadow: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-radius: var(--r-bar, 4px);
    border: none;
    background: transparent;
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
    text-align: left;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .menu-item:hover, .menu-item:active {
    background: var(--line);
  }

  .menu-item.danger {
    color: var(--expense);
  }

  /* Vault Hero Card */
  .hero-vault-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 24px 18px;
    border-radius: var(--r, 10px);
    gap: 12px;
    box-shadow: none;
  }

  .hero-icon-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--bg-raised);
    border: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    box-shadow: none;
  }

  .hero-main-stats {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .hero-pct {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--line);
    padding: 2px 10px;
    border-radius: var(--r, 10px);
  }

  .hero-collected-amount {
    font-family: var(--font-display);
    font-size: 30px;
    font-weight: 700;
    color: var(--fg);
    letter-spacing: -0.02em;
    margin: 4px 0 0;
  }

  .hero-target-denom {
    font-size: 12px;
    color: var(--fg-muted);
    font-weight: 500;
  }

  .hero-progress-track {
    width: 100%;
    height: 8px;
    background: var(--track);
    border-radius: var(--r-bar, 4px);
    overflow: hidden;
    margin-top: 4px;
  }

  .hero-progress-fill {
    height: 100%;
    background: var(--accent);
    box-shadow: none;
    border-radius: var(--r-bar, 4px);
  }

  /* Quick Deposit Section */
  .deposit-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--bg-raised);
    border: 1px solid var(--line);
    border-radius: var(--r, 10px);
    padding: 16px;
  }

  .deposit-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .deposit-title {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    color: var(--fg);
  }

  .deposit-sub {
    font-size: 11px;
    color: var(--fg-muted);
  }

  .chips-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
    touch-action: pan-x pan-y;
  }

  .chips-row::-webkit-scrollbar {
    display: none;
  }

  .quick-chip {
    flex: 1;
    min-height: 38px;
    padding: 6px 8px;
    border-radius: var(--r, 10px);
    border: 1px solid var(--line);
    background: var(--bg-raised);
    color: var(--fg-muted);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 120ms ease;
    white-space: nowrap;
    text-align: center;
  }

  .quick-chip:hover {
    color: var(--fg);
    border-color: var(--line);
  }

  .quick-chip.selected {
    background: var(--fg);
    border-color: var(--fg);
    color: var(--bg);
    box-shadow: none;
  }

  .deposit-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .deposit-submit-btn {
    border: none;
    font-family: var(--font-ui);
    font-size: 14px;
    font-weight: 600;
    color: var(--on-accent);
    background: var(--accent);
    box-shadow: none;
    border-radius: var(--r, 10px);
    padding: 12px 18px;
    cursor: pointer;
    transition: opacity 120ms ease;
  }

  .deposit-submit-btn:active {
    opacity: 0.85;
  }

  .deposit-submit-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
  }

  .deposit-custom-btn {
    border: 1px solid var(--line);
    background: transparent;
    color: var(--fg);
    font-size: 13px;
    font-weight: 600;
    border-radius: var(--r, 10px);
    padding: 8px 14px;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .deposit-custom-btn:hover {
    background: var(--line);
    border-color: var(--line);
  }

  /* Riwayat Setoran */
  .history-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .history-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--fg);
    margin: 0;
  }

  .history-empty {
    padding: 24px 16px;
    text-align: center;
    border-radius: var(--r, 10px);
  }

  .history-empty-text {
    font-size: 13px;
    color: var(--fg-muted);
    margin: 0;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .history-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-radius: var(--r, 10px);
    cursor: pointer;
    transition: opacity 120ms ease;
  }

  .history-row:active {
    opacity: 0.85;
    border-color: var(--line);
  }

  .history-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .history-icon-orb {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-raised);
    border: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    box-shadow: none;
  }

  .history-details {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .history-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg);
  }

  .history-date {
    font-size: 11px;
    color: var(--fg-muted);
  }

  .history-amount {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    text-shadow: none;
  }

  /* Not Found */
  .not-found-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 36px 20px;
    border-radius: var(--r, 10px);
    gap: 10px;
  }

  .not-found-cat {
    font-size: 40px;
  }

  .not-found-title {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 700;
    color: var(--fg);
    margin: 0;
  }

  .not-found-desc {
    font-size: 13px;
    color: var(--fg-muted);
    margin: 0;
  }
</style>
