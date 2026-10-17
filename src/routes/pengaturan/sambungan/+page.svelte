<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import { settings, saveSetting, reloadFromDb } from '$lib/stores';
  import { getDb, clear } from '$lib/db';

  let url = $state('');
  let token = $state('');
  let testing = $state(false);
  let statusType = $state(''); // 'success' | 'error' | ''
  let statusMessage = $state('');
  let testedData = $state(null);

  onMount(() => {
    url =
      $settings.script_url ||
      (typeof import.meta !== 'undefined' ? import.meta.env?.PUBLIC_APPS_SCRIPT_URL : '') ||
      '';
    token =
      $settings.script_token ||
      (typeof import.meta !== 'undefined' ? import.meta.env?.PUBLIC_APPS_SCRIPT_TOKEN : '') ||
      '';
  });

  async function handleTest() {
    testing = true;
    statusType = '';
    statusMessage = '';
    testedData = null;

    const trimmedUrl = url.trim();
    const trimmedToken = token.trim();

    // Validasi URL: Harus diawali https://script.google.com/
    if (!trimmedUrl.startsWith('https://script.google.com/')) {
      statusType = 'error';
      statusMessage = 'URL harus diawali https://script.google.com/';
      testing = false;
      return;
    }

    try {
      const testUrl = new URL(trimmedUrl);
      testUrl.searchParams.set('action', 'all');
      if (trimmedToken) {
        testUrl.searchParams.set('token', trimmedToken);
      }

      const res = await fetch(testUrl.toString(), { method: 'GET' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          statusType = 'error';
          statusMessage = 'Token tidak cocok.';
          testing = false;
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json.ok) {
        const err = String(json.error || json.message || '').toLowerCase();
        if (err.includes('token') || err.includes('unauthorized') || err.includes('auth')) {
          statusType = 'error';
          statusMessage = 'Token tidak cocok.';
        } else {
          statusType = 'error';
          statusMessage = json.error || 'Tidak bisa terhubung. Cek URL dan sinyal.';
        }
      } else {
        const categories = json.data?.budget || json.budget || [];
        if (categories.length === 0) {
          statusType = 'error';
          statusMessage = 'Jalankan setup() di Apps Script dulu.';
        } else {
          statusType = 'success';
          statusMessage = `✓ Terhubung · ${categories.length} kategori ditemukan`;
          let settingList = [];
          const rawSetting = json.settings || json.setting || json.data?.setting;
          if (Array.isArray(rawSetting)) {
            settingList = rawSetting;
          } else if (rawSetting && typeof rawSetting === 'object') {
            settingList = Object.entries(rawSetting).map(([k, v]) => ({ key: k, value: v }));
          }
          testedData = json.data || {
            budget: categories,
            goals: json.goals || [],
            transaksi: json.tx || json.transaksi || [],
            setting: settingList
          };
        }
      }
    } catch {
      statusType = 'error';
      statusMessage = 'Tidak bisa terhubung. Cek URL dan sinyal.';
    } finally {
      testing = false;
    }
  }

  async function handleSaveAndStart() {
    const trimmedUrl = url.trim();
    const trimmedToken = token.trim();

    await saveSetting('script_url', trimmedUrl);
    await saveSetting('script_token', trimmedToken);

    if (testedData) {
      const db = await getDb();
      if (db) {
        const tx = db.transaction(['transaksi', 'budget', 'goals', 'setting'], 'readwrite');
        if (Array.isArray(testedData.transaksi)) {
          for (const item of testedData.transaksi) await tx.objectStore('transaksi').put(item);
        }
        if (Array.isArray(testedData.budget)) {
          for (const item of testedData.budget) await tx.objectStore('budget').put(item);
        }
        if (Array.isArray(testedData.goals)) {
          for (const item of testedData.goals) await tx.objectStore('goals').put(item);
        }
        if (Array.isArray(testedData.setting)) {
          for (const item of testedData.setting) await tx.objectStore('setting').put(item);
        } else if (testedData.setting && typeof testedData.setting === 'object') {
          for (const [key, value] of Object.entries(testedData.setting)) {
            await tx.objectStore('setting').put({ key, value });
          }
        }
        await tx.done;
      }
      await reloadFromDb();
    }

    goto('/');
  }

  async function handleDisconnect() {
    const confirmed = confirm(
      'Lepas sambungan akan menghapus URL, token, cache, dan antrean yang belum terkirim. Yakin?'
    );
    if (!confirmed) return;

    await saveSetting('script_url', '');
    await saveSetting('script_token', '');

    const db = await getDb();
    if (db) {
      await clear('outbox');
      await clear('transaksi');
      await clear('budget');
      await clear('goals');
    }

    url = '';
    token = '';
    statusType = '';
    statusMessage = '';
    testedData = null;

    await reloadFromDb();
    alert('Sambungan berhasil dilepas.');
  }
</script>

<svelte:head>
  <title>Sambungan Sheet · Neko Dompet</title>
</svelte:head>

<div class="connect-page">
  <div class="nav-back-row">
    <a href="/pengaturan" class="back-link">
      <span>‹</span>
      <span>Kembali ke Pengaturan</span>
    </a>
  </div>

  <Card>
    <div class="header-section">
      <span class="cat-hero" aria-hidden="true">🐱</span>
      <h2 class="title">Hubungkan ke Sheet-mu</h2>
      <p class="subtitle">
        Masukkan URL Web App dan token dari Google Apps Script untuk sinkronisasi otomatis.
      </p>
    </div>

    <form class="connect-form" onsubmit={(e) => { e.preventDefault(); handleTest(); }}>
      <div class="form-group">
        <label for="input-url">URL Web App</label>
        <input
          id="input-url"
          type="url"
          placeholder="https://script.google.com/macros/s/..."
          bind:value={url}
          required
        />
      </div>

      <div class="form-group">
        <label for="input-token">Token</label>
        <input
          id="input-token"
          type="password"
          placeholder="••••••••••••••••"
          bind:value={token}
          required
        />
      </div>

      <div class="actions">
        <Button
          type="submit"
          variant="secondary"
          full
          disabled={testing || !url.trim()}
        >
          {testing ? 'Menguji...' : 'Uji sambungan'}
        </Button>

        {#if statusMessage}
          <div class="status-box status-{statusType}" role="alert">
            {statusMessage}
          </div>
        {/if}

        {#if statusType === 'success'}
          <Button
            type="button"
            variant="primary"
            full
            onclick={handleSaveAndStart}
          >
            Mulai
          </Button>
        {/if}
      </div>
    </form>
  </Card>

  {#if $settings.script_url}
    <div class="disconnect-section">
      <Button
        variant="danger"
        size="sm"
        full
        onclick={handleDisconnect}
      >
        Lepas sambungan
      </Button>
    </div>
  {/if}
</div>

<style>
  .connect-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    box-sizing: border-box;
  }

  .nav-back-row {
    display: flex;
    align-items: center;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--kabut);
    text-decoration: none;
    padding: 6px 12px;
    background: var(--glass-1);
    border: 1px solid var(--edge-soft);
    border-radius: 999px;
    transition: all 120ms ease;
  }

  .back-link:hover {
    color: var(--komorebi);
    border-color: var(--edge-bright);
    background: var(--glass-2);
  }

  .header-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    margin-bottom: 20px;
  }

  .cat-hero {
    font-size: 40px;
  }

  .title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    color: var(--komorebi);
    margin: 0;
  }

  .subtitle {
    font-size: 13px;
    color: var(--kabut);
    margin: 0;
    line-height: 1.45;
    max-width: 320px;
  }

  .connect-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    font-size: 13px;
    font-weight: 700;
    color: var(--komorebi);
  }

  input {
    width: 100%;
    min-height: 44px;
    padding: 10px 14px;
    border-radius: 14px;
    border: 1px solid var(--edge-soft);
    background-color: var(--glass-1);
    color: var(--komorebi);
    font-size: 14px;
    box-sizing: border-box;
    transition: all 120ms ease;
  }

  input:focus {
    border-color: var(--aether);
    background-color: var(--glass-2);
    outline: none;
    box-shadow: var(--glow-aether);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 6px;
  }

  .status-box {
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    text-align: center;
    line-height: 1.4;
  }

  .status-box.status-success {
    background-color: rgba(56, 161, 105, 0.10);
    color: var(--tunas);
    border: 1px solid var(--tunas);
    box-shadow: var(--glow-tunas);
  }

  .status-box.status-error {
    background-color: rgba(209, 67, 67, 0.10);
    color: var(--api);
    border: 1px solid var(--api);
    box-shadow: var(--glow-api);
  }

  .disconnect-section {
    padding: 4px 0;
  }
</style>
