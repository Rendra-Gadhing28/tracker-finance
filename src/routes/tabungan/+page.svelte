<script>
  import Card from '$lib/components/Card.svelte';
</script>

<svelte:head>
  <title>Tabungan · Neko Dompet</title>
</svelte:head>

<div class="page-container">
  <Card variant="nabung">
    <div class="placeholder-content">
      <span class="icon">🐷</span>
      <h2>Tabungan & Goals</h2>
      <p>Tabungan / Goals (Tahap 3)</p>
    </div>
  </Card>
</div>

<style>
  .page-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .placeholder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 24px 8px;
    gap: 8px;
  }

  .icon {
    font-size: 36px;
  }

  h2 {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
  }

  p {
    font-size: 14px;
    color: var(--mute);
    margin: 0;
  }
</style>
