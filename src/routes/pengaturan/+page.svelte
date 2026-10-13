<script>
  import Card from '$lib/components/Card.svelte';
  import { settings } from '$lib/stores';
  import { formatRp } from '$lib/money';

  function formatDay(day) {
    if (day === 1) return 'Senin';
    if (day === 0 || day === 7) return 'Minggu';
    const names = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return names[day] || `Hari ke-${day}`;
  }
</script>

<svelte:head>
  <title>Pengaturan · Neko Dompet</title>
</svelte:head>

<div class="page-container">
  <Card interactive class="link-card">
    <a href="/pengaturan/sambungan" class="sheet-link">
      <div class="link-info">
        <span class="link-icon">🐱</span>
        <div>
          <h3 class="link-title">Sambungan Google Sheet</h3>
          <p class="link-desc">
            {$settings.script_url ? '✓ Terhubung ke Google Apps Script' : 'Belum terhubung'}
          </p>
        </div>
      </div>
      <span class="chevron" aria-hidden="true">›</span>
    </a>
  </Card>

  <Card>
    <h3 class="section-title">Ringkasan Pengaturan</h3>
    <div class="settings-list">
      <div class="setting-row">
        <span class="label">Uang Jajan Mingguan</span>
        <strong class="value">{formatRp($settings.uang_jajan_mingguan ?? 145000)}</strong>
      </div>
      <div class="setting-row">
        <span class="label">Hari Awal Minggu</span>
        <strong class="value">{formatDay($settings.awal_minggu ?? 1)}</strong>
      </div>
      <div class="setting-row">
        <span class="label">Saldo Awal</span>
        <strong class="value">{formatRp($settings.saldo_awal ?? 0)}</strong>
      </div>
    </div>
  </Card>
</div>

<style>
  .page-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sheet-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-decoration: none;
    color: inherit;
    width: 100%;
  }

  .link-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .link-icon {
    font-size: 24px;
  }

  .link-title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }

  .link-desc {
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--mute);
  }

  .chevron {
    font-size: 22px;
    color: var(--mute);
    font-weight: 700;
  }

  .section-title {
    margin: 0 0 14px;
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }

  .settings-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    padding-bottom: 8px;
    border-bottom: 1.5px dashed var(--line);
  }

  .setting-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .label {
    color: var(--mute);
  }

  .value {
    color: var(--ink);
    font-weight: 700;
  }
</style>
