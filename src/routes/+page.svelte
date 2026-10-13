<script>
  import Card from '$lib/components/Card.svelte';
  import { walletBalance, budgetSummary } from '$lib/stores';
  import { formatRp } from '$lib/money';
</script>

<svelte:head>
  <title>Beranda · Neko Dompet</title>
</svelte:head>

<div class="home-page">
  <!-- Saldo Dompet Card -->
  <Card variant="neutral">
    <div class="balance-block">
      <span class="card-eyebrow">Saldo Dompet</span>
      <div class="balance-amount tabular-nums">{formatRp($walletBalance)}</div>
    </div>
  </Card>

  <!-- Jatah Hari Ini & Weekly Summary Card -->
  <Card variant="jajan">
    <div class="budget-block">
      <div class="budget-header">
        <div>
          <span class="card-eyebrow">Jatah Hari Ini · Hari ke-{$budgetSummary.hari_ke}</span>
          <div class="jatah-amount tabular-nums">{formatRp($budgetSummary.jatah)}</div>
        </div>
        <div class="status-pill status-{$budgetSummary.status}">
          {$budgetSummary.status === 'good'
            ? 'Aman'
            : $budgetSummary.status === 'warn'
              ? 'Hati-hati'
              : 'Kritis'}
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-item">
          <span class="metric-label">Sisa hari ini</span>
          <strong class="metric-value tabular-nums">{formatRp($budgetSummary.sisa_hari)}</strong>
        </div>
        <div class="metric-item">
          <span class="metric-label">Sisa minggu (S)</span>
          <strong class="metric-value tabular-nums">{formatRp($budgetSummary.S)}</strong>
        </div>
        <div class="metric-item">
          <span class="metric-label">Terpakai (P)</span>
          <strong class="metric-value tabular-nums">{formatRp($budgetSummary.P)}</strong>
        </div>
        <div class="metric-item">
          <span class="metric-label">Batas (A)</span>
          <strong class="metric-value tabular-nums">{formatRp($budgetSummary.A)}</strong>
        </div>
      </div>
    </div>
  </Card>
</div>

<style>
  .home-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .balance-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .card-eyebrow {
    font-size: 13px;
    font-weight: 500;
    color: var(--mute);
  }

  .balance-amount {
    font-size: 28px;
    font-weight: 800;
    color: var(--ink);
    letter-spacing: -0.5px;
  }

  .budget-block {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .budget-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .jatah-amount {
    font-size: 24px;
    font-weight: 800;
    color: var(--ink);
    margin-top: 2px;
  }

  .status-pill {
    font-size: 12px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: var(--radius-chip, 999px);
    text-transform: capitalize;
  }

  .status-pill.status-good {
    background-color: var(--good);
    color: #FFFDF7;
  }

  .status-pill.status-warn {
    background-color: var(--warn);
    color: #FFFDF7;
  }

  .status-pill.status-bad {
    background-color: var(--bad);
    color: #FFFDF7;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding-top: 12px;
    border-top: 1.5px dashed var(--cat-jajan-border);
  }

  .metric-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .metric-label {
    font-size: 12px;
    color: var(--mute);
  }

  .metric-value {
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
  }
</style>
